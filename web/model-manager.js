import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { ComfyDialog, $el } from "../../scripts/ui.js";

function debounce(callback, delay) {
    let timeoutId = null;
    return (...args) => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            callback(...args);
        }, delay);
    };
}

function request(url, options) {
    return new Promise((resolve, reject) => {
        api.fetchApi(url, options)
            .then((response) => response.json())
            .then(resolve)
            .catch(reject);
    });
}

function modelNodeType(modelType) {
    if (modelType === "checkpoints") return "CheckpointLoaderSimple";
    else if (modelType === "clip") return "CLIPLoader";
    else if (modelType === "clip_vision") return "CLIPVisionLoader";
    else if (modelType === "controlnet") return "ControlNetLoader";
    else if (modelType === "diffusers") return "DiffusersLoader";
    else if (modelType === "embeddings") return "Embedding";
    else if (modelType === "gligen") return "GLIGENLoader";
    else if (modelType === "hypernetworks") return "HypernetworkLoader";
    else if (modelType === "loras") return "LoraLoader";
    else if (modelType === "style_models") return "StyleModelLoader";
    else if (modelType === "unet") return "UNETLoader";
    else if (modelType === "upscale_models") return "UpscaleModelLoader";
    else if (modelType === "vae") return "VAELoader";
    else if (modelType === "vae_approx") return undefined;
    else { console.warn(`ModelType ${modelType} unrecognized.`); return undefined; }
}

function modelWidgetIndex(nodeType) {
    return 0;
}

function pathToFileString(path) {
    const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1;
    return path.slice(i);
}

function insertEmbeddingIntoText(currentText, embeddingFile, removeExtension = false) {
    if (removeExtension) {
        // TODO: setting.remove_extension_embedding
    }
    // TODO: don't add if it is already in the text?
    const sep = currentText.length === 0 || currentText.slice(-1).match(/\s/) ? "" : " ";
    return currentText + sep + "(embedding:" +  embeddingFile  + ":1.0)";
}

class Tabs {
    /** @type {Record<string, HTMLDivElement>} */
    #head = {};
    /** @type {Record<string, HTMLDivElement>} */
    #body = {};

    /**
     * @param {Array<HTMLDivElement>} tabs
     */
    constructor(tabs) {
        const head = [];
        const body = [];

        tabs.forEach((el, index) => {
            const name = el.getAttribute("data-name");

            /** @type {HTMLDivElement} */
            const tag = $el(
                "div.head-item",
                { onclick: () => this.active(name) },
                [name]
            );

            if (index === 0) {
                this.#active = name;
            }

            this.#head[name] = tag;
            head.push(tag);
            this.#body[name] = el;
            body.push(el);
        });

        this.element = $el("div.comfy-tabs", [
            $el("div.comfy-tabs-head", head),
            $el("div.comfy-tabs-body", body),
        ]);

        this.active(this.#active);
    }

    #active = undefined;

    active(name) {
        this.#active = name;
        Object.keys(this.#head).forEach((key) => {
            if (name === key) {
                this.#head[key].classList.add("active");
                this.#body[key].style.display = "";
            } else {
                this.#head[key].classList.remove("active");
                this.#body[key].style.display = "none";
            }
        });
    }
}

/**
 * @param {Record<string, any>} option
 * @param {Array<HTMLDivElement>} tabs
 */
function $tabs(tabs) {
    const instance = new Tabs(tabs);
    return instance.element;
}

/**
 * @param {string} name
 * @param {Array<HTMLDivElement>} el
 * @returns {HTMLDivElement}
 */
function $tab(name, el) {
    return $el("div", { dataset: { name } }, el);
}

class SourceList {
    /**
     * @typedef Column
     * @prop {string} title
     * @prop {string} dataIndex
     * @prop {number} width
     * @prop {string} align
     * @prop {Function} render
     */

    /** @type {Array<Column>} */
    #columns = [];

    /** @type {Array<Record<string, any>>} */
    #dataSource = [];

    /** @type {HTMLDivElement} */
    #tbody = null;

    /**
     * @param {Array<Column>} columns
     */
    constructor(columns) {
        this.#columns = columns;

        const colgroup = $el(
            "colgroup",
            columns.map((item) => {
                return $el("col", {
                    style: { width: `${item.width}px` },
                });
            })
        );

        const listTitle = $el(
            "tr",
            columns.map((item) => {
                return $el("th", [item.title ?? ""]);
            })
        );

        this.element = $el("table.comfy-table", [
            colgroup.cloneNode(true),
            $el("thead.table-head", [listTitle]),
            $el("tbody.table-body", { $: (el) => (this.#tbody = el) }),
        ]);
    }

    setData(dataSource) {
        this.#dataSource = dataSource;
        this.#updateList();
    }

    getData() {
        return this.#dataSource;
    }

    #updateList() {
        this.#tbody.innerHTML = null;
        this.#tbody.append.apply(
            this.#tbody,
            this.#dataSource.map((row, index) => {
                const cells = this.#columns.map((item) => {
                    const dataIndex = item.dataIndex;
                    const cellValue = row[dataIndex] ?? "";
                    const content = item.render
                        ? item.render(cellValue, row, index)
                        : cellValue ?? "-";

                    const style = { textAlign: item.align };
                    return $el("td", { style }, [content]);
                });
                return $el("tr", cells);
            })
        );
    }

    filterList(list, searchString, installedType) {
        /** @type {Array<string>} */
        const keywords = searchString
            .replace("*", " ")
            .split(/(-?".*?"|[^\s"]+)+/g)
            .map((item) => item
                .trim()
                .replace(/(?:'|")+/g, "")
                .toLowerCase())
            .filter(Boolean);

        let fields = ["type", "name", "base", "description"];
        const regexSHA256 = /^[a-f0-9]{64}$/gi;
        const newList = list.filter((element) => {
            if (installedType !== "Filter: All") {
                if ((installedType === "Downloaded" && !element["installed"]) || 
                    (installedType === "Not Downloaded" && element["installed"])) {
                    return false;
                }
            }
            const text = fields
                .reduce((memo, field) => memo + " " + element[field], "")
                .toLowerCase();
            return keywords.reduce((memo, target) => {
                const excludeTarget = target[0] === "-";
                if (excludeTarget && target.length === 1) { return memo; }
                const filteredTarget = excludeTarget ? target.slice(1) : target;
                if (element["SHA256"] !== undefined && regexSHA256.test(filteredTarget)) {
                    return memo && excludeTarget !== (filteredTarget === element["SHA256"]);
                }
                else {
                    return memo && excludeTarget !== text.includes(filteredTarget);
                }
            }, true);
        });

        this.setData(newList);
    }
}

class ModelGrid {
    static filter(list, searchString) {
        /** @type {Array<string>} */
        const keywords = searchString
            .replace("*", " ")
            .split(/(-?".*?"|[^\s"]+)+/g)
            .map((item) => item
                .trim()
                .replace(/(?:'|")+/g, "")
                .toLowerCase())
            .filter(Boolean);

        const regexSHA256 = /^[a-f0-9]{64}$/gi;
        const fields = ["name", "search-path"]; // TODO: Remove "search-path" hack.
        return list.filter((element) => {
            const text = fields
                .reduce((memo, field) => memo + " " + element[field], "")
                .toLowerCase();
            return keywords.reduce((memo, target) => {
                const excludeTarget = target[0] === "-";
                if (excludeTarget && target.length === 1) { return memo; }
                const filteredTarget = excludeTarget ? target.slice(1) : target;
                if (element["SHA256"] !== undefined && regexSHA256.test(filteredTarget)) {
                    return memo && excludeTarget !== (filteredTarget === element["SHA256"]);
                }
                else {
                    return memo && excludeTarget !== text.includes(filteredTarget);
                }
            }, true);
        });
    }
    
    static #buttonAlert(event, successful, innerHTML) {
        const element = event.target;
        const name = successful ? "model-button-success" : "model-button-failure";
        element.classList.add(name);
        element.innerHTML = successful ? "✔" : "✖";
        // TODO: debounce would be nice to get working...
        window.setTimeout((element, name) => {
            element.classList.remove(name);
            element.innerHTML = innerHTML;
        }, 500, element, name);
    }
    
    
    static #addModel(event, modelType, path) {
        let successful = false;
        if (modelType !== "embeddings") {
            const nodeType = modelNodeType(modelType);
            const widgetIndex = modelWidgetIndex(nodeType);
            let node = LiteGraph.createNode(nodeType, null, []);
            if (node) {
                node.widgets[widgetIndex].value = path;
                const selectedNodes = app.canvas.selected_nodes;
                let isSelectedNode = false;
                for (var i in selectedNodes) {
                    const selectedNode = selectedNodes[i];
                    // TODO: settings.model_add_offset
                    node.pos[0] = selectedNode.pos[0] + 25;
                    node.pos[1] = selectedNode.pos[1] + 25;
                    isSelectedNode = true;
                    break;
                }
                if (!isSelectedNode) {
                    const graphMouse = app.canvas.graph_mouse;
                    node.pos[0] = graphMouse[0];
                    node.pos[1] = graphMouse[1];
                }
                app.graph.add(node, {doProcessChange: true});
                app.canvas.selectNode(node);
                successful = true;
            }
            event.stopPropagation();
        }
        else if (modelType === "embeddings") {
            const embeddingFile = pathToFileString(path);
            const selectedNodes = app.canvas.selected_nodes;
            for (var i in selectedNodes) {
                const selectedNode = selectedNodes[i];
                const nodeType = modelNodeType(modelType);
                const widgetIndex = modelWidgetIndex(nodeType);
                const target = selectedNode.widgets[widgetIndex].element;
                if (target && target.type === "textarea") {
                    target.value = insertEmbeddingIntoText(target.value, embeddingFile);
                    successful = true;
                }
            }
            if (!successful) {
                console.warn("Try selecting a node before adding the embedding.");
            }
            event.stopPropagation();
        }
        this.#buttonAlert(event, successful, "✚");
    }

    static #dragAddModel(event, modelType, path) {
        const target = document.elementFromPoint(event.x, event.y);
        if (modelType !== "embeddings" && target.id === "graph-canvas") {
            const nodeType = modelNodeType(modelType);
            const widgetIndex = modelWidgetIndex(nodeType);
            const pos = app.canvas.convertEventToCanvasOffset(event);
            const nodeAtPos = app.graph.getNodeOnPos(pos[0], pos[1], app.canvas.visible_nodes);
            //if (nodeAtPos && nodeAtPos.type === nodeType && app.canvas.processNodeWidgets(nodeAtPos, pos, event) !== nodeAtPos.widgets[widgetIndex]) { // TODO: settings.strict_model_drag
            if (nodeAtPos && nodeAtPos.type === nodeType) {
                let node = nodeAtPos;
                node.widgets[widgetIndex].value = path;
                app.canvas.selectNode(node);
            }
            else {
                let node = LiteGraph.createNode(nodeType, null, []);
                if (node) {
                    node.pos[0] = pos[0];
                    node.pos[1] = pos[1];
                    node.widgets[widgetIndex].value = path;
                    app.graph.add(node, {doProcessChange: true});
                    app.canvas.selectNode(node);
                }
            }
            event.stopPropagation();
        }
        else if (modelType === "embeddings" && target.type === "textarea") {
            const pos = app.canvas.convertEventToCanvasOffset(event);
            const nodeAtPos = app.graph.getNodeOnPos(pos[0], pos[1], app.canvas.visible_nodes);
            if (nodeAtPos) {
                app.canvas.selectNode(nodeAtPos);
                const embeddingFile = pathToFileString(path);
                target.value = insertEmbeddingIntoText(target.value, embeddingFile);
                event.stopPropagation();
            }
        }
    }

    static #copyModelToClipboard(event, modelType, path) {
        const nodeType = modelNodeType(modelType);
        let successful = false;
        if (nodeType === "Embedding") {
            if (navigator.clipboard){
                const embeddingText = pathToFileString(path);
                navigator.clipboard.writeText(embeddingText);
                successful = true;
            }
            else {
                console.warn("Cannot copy the embedding to the system clipboard; Try dragging it instead.");
            }
        }
        else if (nodeType) {
            const node = LiteGraph.createNode(nodeType, null, []);
            const widgetIndex = modelWidgetIndex(nodeType);
            node.widgets[widgetIndex].value = path;
            app.canvas.copyToClipboard([node]);
            successful = true;
        }
        else {
            console.warn(`Unable to copy unknown model type '${modelType}.`);
        }
        this.#buttonAlert(event, successful, "⧉︎");
    }

    static generateInnerHtml(models, modelType) {
        if (models.length > 0) {
            // TODO: settings.show_model_add_button
            // TODO: settings.show_model_copy_button
            return models.map((item) => {
                const uri = item.post ?? "no-post";
                const imgUrl = `/model-manager/image-preview?uri=${uri}`;
                const dragAdd = (e) => ModelGrid.#dragAddModel(e, modelType, item.path);
                const clickCopy = (e) => ModelGrid.#copyModelToClipboard(e, modelType, item.path);
                const clickAdd = (e) => ModelGrid.#addModel(e, modelType, item.path);
                return $el("div.item", {}, [
                    $el("img.model-preview", {
                        src: imgUrl,
                        draggable: false,
                    }),
                    $el("div.model-preview-overlay", {
                        src: imgUrl,
                        ondragend: (e) => dragAdd(e),
                        draggable: true,
                    }),
                    $el("div.model-preview-top-right", {
                        draggable: false,
                    },
                    [
                        $el("button.icon-button.model-button", {
                            type: "button",
                            textContent: "⧉︎",
                            onclick: (e) => clickCopy(e),
                            draggable: false,
                        }),
                        $el("button.icon-button.model-button", {
                            type: "button",
                            textContent: "✚",
                            onclick: (e) => clickAdd(e),
                            draggable: false,
                        }),
                    ]),
                    $el("div.model-label", {
                        ondragend: (e) => dragAdd(e),
                        draggable: true,
                    }, [
                        $el("p", [item.name])
                    ]),
                ]);
            });
        } else {
            return [$el("h2", ["No Models"])];
        }
    }
}

function $radioGroup(attr) {
    const { name = Date.now(), onchange, options = [], $ } = attr;

    /** @type {HTMLDivElement[]} */
    const radioGroup = options.map((item, index) => {
        const inputRef = { value: null };

        return $el(
            "div.comfy-radio",
            { onclick: () => inputRef.value.click() },
            [
                $el("input.radio-input", {
                    type: "radio",
                    name: name,
                    value: item.value,
                    checked: index === 0,
                    $: (el) => (inputRef.value = el),
                }),
                $el("label", [item.label ?? item.value]),
            ]
        );
    });

    const element = $el("input", { value: options[0]?.value });
    $?.(element);

    radioGroup.forEach((radio) => {
        radio.addEventListener("change", (event) => {
            const selectedValue = event.target.value;
            element.value = selectedValue;
            onchange?.(selectedValue);
        });
    });

    return $el("div.comfy-radio-group", radioGroup);
}

class ModelManager extends ComfyDialog {
    #el = {
        loadSourceBtn: null,
        loadSourceFromInput: null,
        sourceInstalledFilter: null,
        sourceContentFilter: null,
        sourceFilterBtn: null,
        modelGrid: null,
        modelTypeSelect: null,
        modelContentFilter: null,
        sidebarButtons: null,
    };

    #data = {
        sources: [],
        models: {},
    };

    /** @type {SourceList} */
    #sourceList = null;

    constructor() {
        super();
        this.element = $el(
            "div.comfy-modal.model-manager",
            {
                parent: document.body,
            },
            [
                $el("div.comfy-modal-content", [
                    $el("div.topbar-buttons",
                        [
                            $el("div.sidebar-buttons",
                            {
                                $: (el) => (this.#el.sidebarButtons = el),
                            },
                            [
                                $el("button.icon-button", {
                                    textContent: "◧",
                                    onclick: (event) => this.#setSidebar(event),
                                }),
                                $el("button.icon-button", {
                                    textContent: "⬓",
                                    onclick: (event) => this.#setSidebar(event),
                                }),
                                $el("button.icon-button", {
                                    textContent: "◨",
                                    onclick: (event) => this.#setSidebar(event),
                                }),
                            ]),
                            $el("button.icon-button", {
                                textContent: "✖",
                                onclick: () => this.close(),
                            }),
                        ]
                    ),
                    $tabs([
                        $tab("Install", this.#createSourceInstall()),
                        $tab("Models", this.#createModelTabHtml()),
                        $tab("Settings", []),
                    ]),
                ]),
            ]
        );

        this.#init();
    }

    #init() {
        this.#refreshSourceList();
        this.#modelGridRefresh();
    }

    #createSourceInstall() {
        this.#createSourceList();
        return [
            $el("div.row.tab-header", [
                $el("div.row.tab-header-flex-block", [
                    $el("button.icon-button", {
                        type: "button",
                        textContent: "⟳",
                        $: (el) => (this.#el.loadSourceBtn = el),
                        onclick: () => this.#refreshSourceList(),
                    }),
                    $el("input.source-text-area", {
                        $: (el) => (this.#el.loadSourceFromInput = el),
                        placeholder: "https://ComfyUI-Model-Manager/index.json",
                    }),
                ]),
                $el("div.row.tab-header-flex-block", [
                    $el("input.search-text-area", {
                        $: (el) => (this.#el.sourceContentFilter = el),
                        placeholder: "example: \"sd_xl\" -vae",
                        onkeyup: (e) => e.key === "Enter" && this.#filterSourceList(),
                    }),
                    $el("select",
                        {
                            $: (el) => (this.#el.sourceInstalledFilter = el),
                            style: { width: 0 },
                            onchange: () => this.#filterSourceList(),
                        },
                        [
                            $el("option", ["Filter: All"]),
                            $el("option", ["Downloaded"]),
                            $el("option", ["Not Downloaded"]),
                        ]
                    ),
                    $el("button.icon-button", {
                        type: "button",
                        textContent: "🔍︎",
                        onclick: () => this.#filterSourceList(),
                    }),
                ]),
            ]),
            this.#sourceList.element,
        ];
    }

    #createSourceList() {
        const sourceList = new SourceList([
            {
                title: "Type",
                dataIndex: "type",
                width: "120",
                align: "center",
            },
            {
                title: "Base",
                dataIndex: "base",
                width: "120",
                align: "center",
            },
            {
                title: "Name",
                dataIndex: "name",
                width: "280",
                render: (value, record) => {
                    const href = record.page;
                    return $el("a", { target: "_blank", href }, [value]);
                },
            },
            {
                title: "Description",
                dataIndex: "description",
            },
            {
                title: "Download",
                width: "150",
                render: (_, record) => {
                    const installed = record.installed;
                    return $el("button.block", {
                        type: "button",
                        disabled: installed,
                        textContent: installed ? "✓︎" : "📥︎",
                        onclick: async (e) => {
                            e.disabled = true;
                            const response = await request(
                                "/model-manager/download",
                                {
                                    method: "POST",
                                    body: JSON.stringify(record),
                                }
                            );
                            e.disabled = false;
                        },
                    });
                },
            },
        ]);
        this.#sourceList = sourceList;
        return sourceList.element;
    }

    async #refreshSourceList() {
        this.#el.loadSourceBtn.disabled = true;

        const source = this.#el.loadSourceFromInput.value;
        const uri = (source === "https://ComfyUI-Model-Manager/index.json") || (source === "") ? "local" : source;
        const dataSource = await request(
            `/model-manager/source?uri=${uri}`
        ).catch(() => []);
        this.#data.sources = dataSource;
        this.#sourceList.setData(dataSource);
        this.#el.sourceInstalledFilter.value = "Filter: All";
        this.#el.sourceContentFilter.value = "";

        this.#el.loadSourceBtn.disabled = false;
    }

    #filterSourceList() {
        this.#sourceList.filterList(
            this.#data.sources, 
            this.#el.sourceContentFilter.value, 
            this.#el.sourceInstalledFilter.value
        );
    }

    #createModelTabHtml() {
        const modelGrid = $el("div.comfy-grid");
        this.#el.modelGrid = modelGrid;
        return [
            $el("div.row.tab-header", [
                $el("div.row.tab-header-flex-block", [
                    $el("button.icon-button", {
                        type: "button",
                        textContent: "⟳",
                        onclick: () => this.#modelGridRefresh(),
                    }),
                    $el("select.model-type-dropdown",
                        {
                            $: (el) => (this.#el.modelTypeSelect = el),
                            name: "model-type",
                            onchange: () => this.#modelGridUpdate(),
                        },
                        [
                            $el("option", ["checkpoints"]),
                            $el("option", ["clip"]),
                            $el("option", ["clip_vision"]),
                            $el("option", ["controlnet"]),
                            $el("option", ["diffusers"]),
                            $el("option", ["embeddings"]),
                            $el("option", ["gligen"]),
                            $el("option", ["hypernetworks"]),
                            $el("option", ["loras"]),
                            $el("option", ["style_models"]),
                            $el("option", ["unet"]),
                            $el("option", ["upscale_models"]),
                            $el("option", ["vae"]),
                            $el("option", ["vae_approx"]),
                        ]
                    ),
                ]),
                $el("div.row.tab-header-flex-block", [
                    $el("input.search-text-area", {
                        $: (el) => (this.#el.modelContentFilter = el),
                        placeholder: "example: styles/clothing -.pt",
                        onkeyup: (e) => e.key === "Enter" && this.#modelGridUpdate(),
                    }),
                    $el("button.icon-button", {
                        type: "button",
                        textContent: "🔍︎",
                        onclick: () => this.#modelGridUpdate(),
                    }),
                ]),
            ]),
            modelGrid,
        ];
    }

    #modelGridUpdate() {
        const searchText = this.#el.modelContentFilter.value;
        const modelType = this.#el.modelTypeSelect.value;
        const models = this.#data.models;
        const modelList = ModelGrid.filter(models[modelType], searchText);

        const modelGrid = this.#el.modelGrid;
        modelGrid.innerHTML = [];
        const innerHTML = ModelGrid.generateInnerHtml(modelList, modelType);
        modelGrid.append.apply(modelGrid, innerHTML);
    };

    async #modelGridRefresh() {
        this.#data.models = await request("/model-manager/models");
        this.#modelGridUpdate();
    };

    #setSidebar(event) {
        // TODO: use checkboxes with 0 or 1 values set at once?
        // TODO: settings.sidebar_side_width
        // TODO: settings.sidebar_bottom_height
        // TODO: draggable resize?
        const button = event.target;
        const sidebarButtons = this.#el.sidebarButtons.children;
        let buttonIndex;
        for (buttonIndex = 0; buttonIndex < sidebarButtons.length; buttonIndex++) {
            if (sidebarButtons[buttonIndex] === button) {
                break;
            }
        }

        const modelManager = this.element;
        const sidebarStates = ["sidebar-left", "sidebar-bottom", "sidebar-right"];
        let stateIndex;
        for (stateIndex = 0; stateIndex < sidebarStates.length; stateIndex++) {
            const state = sidebarStates[stateIndex];
            if (modelManager.classList.contains(state)) {
                modelManager.classList.remove(state);
                break;
            }
        }

        if (stateIndex != buttonIndex) {
            const newSidebarState = sidebarStates[buttonIndex];
            modelManager.classList.add(newSidebarState);
        }
    }
}

let instance;

/**
 * @returns {ModelManager}
 */
function getInstance() {
    if (!instance) {
        instance = new ModelManager();
    }
    return instance;
}

app.registerExtension({
    name: "Comfy.ModelManager",
    init() {
    },
    async setup() {
        $el("link", {
            parent: document.head,
            rel: "stylesheet",
            href: "./extensions/ComfyUI-Model-Manager/model-manager.css",
        });

        app.ui.menuContainer.appendChild(
            $el("button", {
                id: "comfyui-model-manager-button",
                parent: document.querySelector(".comfy-menu"),
                textContent: "Models",
                onclick: () => { getInstance().show(); },
            })
        );
    },
});

// ◧ ◨ ⬒ ⬓ ⛶ ✚
