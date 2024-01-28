import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { ComfyDialog, $el } from "../../scripts/ui.js";

/**
 * @param {Function} callback
 * @param {number | undefined} delay
 * @returns {Function}
 */
function debounce(callback, delay) {
    let timeoutId = null;
    return (...args) => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            callback(...args);
        }, delay);
    };
}

/**
 * @param {string} url
 * @param {any} options
 * @returns {Promise}
 */
function request(url, options) {
    return new Promise((resolve, reject) => {
        api.fetchApi(url, options)
            .then((response) => response.json())
            .then(resolve)
            .catch(reject);
    });
}

const modelNodeType = {
    "checkpoints": "CheckpointLoaderSimple",
    "clip": "CLIPLoader",
    "clip_vision": "CLIPVisionLoader",
    "controlnet": "ControlNetLoader",
    "diffusers": "DiffusersLoader",
    "embeddings": "Embedding",
    "gligen": "GLIGENLoader",
    "hypernetworks": "HypernetworkLoader",
    "photomaker": "PhotoMakerLoader",
    "loras": "LoraLoader",
    "style_models": "StyleModelLoader",
    "unet": "UNETLoader",
    "upscale_models": "UpscaleModelLoader",
    "vae": "VAELoader",
    "vae_approx": undefined,
};

const DROPDOWN_DIRECTORY_SELECTION_CLASS = "search-dropdown-selected";

/**
 * @typedef {Object} DirectoryItem
 * @param {string} name
 * @param {number | undefined} childCount
 * @param {number | undefined} childIndex
 */

class DirectoryDropdown {
    /** @type {HTMLDivElement} */
    element = undefined;

    /** @type {HTMLInputElement} */
    #input = undefined;

    /** @type {Function} */
    #submitSearch = null;

    /**
     * @param {HTMLInputElement} input
     * @param {Function} updateDropdown
     * @param {Function} submitSearch
     */
    constructor(input, updateDropdown, submitSearch) {
        /** @type {HTMLDivElement} */
        const dropdown = $el("div.search-dropdown", { // TODO: change to `search-directory-dropdown`
            style: { display: "none" },
        });
        this.element = dropdown;
        this.#input = input;
        this.#submitSearch = submitSearch;

        input.addEventListener("input", () => updateDropdown());
        input.addEventListener("focus", () => updateDropdown());
        input.addEventListener("blur", () => { dropdown.style.display = "none"; });
        input.addEventListener(
            "keydown",
            (e) => {
                const options = dropdown.children;
                let iSelection;
                for (iSelection = 0; iSelection < options.length; iSelection++) {
                    const selection = options[iSelection];
                    if (selection.classList.contains(DROPDOWN_DIRECTORY_SELECTION_CLASS)) {
                        break;
                    }
                }
                if (e.key === "Escape") {
                    e.stopPropagation();
                    if (iSelection < options.length) {
                        const selection = options[iSelection];
                        selection.classList.remove(DROPDOWN_DIRECTORY_SELECTION_CLASS);
                    }
                    else {
                        e.target.blur();
                    }
                }
                else if (e.key === "Enter") {
                    e.stopPropagation();
                    submitSearch(e.target, options[iSelection]);
                }
                else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.stopPropagation();
                    let iNext = options.length;
                    if (iSelection < options.length) {
                        const selection = options[iSelection];
                        selection.classList.remove(DROPDOWN_DIRECTORY_SELECTION_CLASS);
                        const delta = e.key === "ArrowDown" ? 1 : -1;
                        iNext = iSelection + delta;
                        if (0 <= iNext && iNext < options.length) {
                            const selectionNext = options[iNext];
                            selectionNext.classList.add(DROPDOWN_DIRECTORY_SELECTION_CLASS);
                        }
                    }
                    else if (iSelection === options.length) {
                        iNext = e.key === "ArrowDown" ? 0 : options.length-1;
                        const selection = options[iNext]
                        selection.classList.add(DROPDOWN_DIRECTORY_SELECTION_CLASS);
                    }
                    if (0 <= iNext && iNext < options.length) {
                        let dropdownTop = dropdown.scrollTop;
                        const dropdownHeight = dropdown.offsetHeight;
                        const selection = options[iNext];
                        const selectionHeight = selection.offsetHeight;
                        const selectionTop = selection.offsetTop;
                        dropdownTop = Math.max(dropdownTop, selectionTop - dropdownHeight + selectionHeight);
                        dropdownTop = Math.min(dropdownTop, selectionTop);
                        dropdown.scrollTop = dropdownTop;
                    }
                    else {
                        dropdown.scrollTop = 0;
                        const options = dropdown.children;
                        for (iSelection = 0; iSelection < options.length; iSelection++) {
                            const selection = options[iSelection];
                            if (selection.classList.contains(DROPDOWN_DIRECTORY_SELECTION_CLASS)) {
                                selection.classList.remove(DROPDOWN_DIRECTORY_SELECTION_CLASS);
                            }
                        }
                    }
                }
            },
        );
    }

    /**
     * @param {DirectoryItem[]} directories
     * @param {string} sep
     * @param {string} [modelType = ""]
     */
    update(directories, sep, modelType = "") {
        const dropdown = this.element;
        const input = this.#input;
        const submitSearch = this.#submitSearch;

        const filter = input.value;
        if (filter[0] !== sep) {
            dropdown.style.display = "none";
            return;
        }

        let cwd = 0;
        if (modelType !== "") {
            const root = directories[0];
            const rootChildIndex = root["childIndex"];
            const rootChildCount = root["childCount"];
            cwd = null;
            for (let i = rootChildIndex; i < rootChildIndex + rootChildCount; i++) {
                const modelDir = directories[i];
                if (modelDir["name"] === modelType) {
                    cwd = i;
                    break;
                }
            }
        }

        // TODO: directories === undefined?
        let indexLastWord = 1;
        while (true) {
            const indexNextWord = filter.indexOf(sep, indexLastWord);
            if (indexNextWord === -1) {
                // end of filter
                break;
            }

            const item = directories[cwd];
            const childCount = item["childCount"];
            if (childCount === undefined) {
                // file
                break;
            }
            if (childCount === 0) {
                // directory is empty
                break;
            }
            const childIndex = item["childIndex"];
            const items = directories.slice(childIndex, childIndex + childCount);

            const word = filter.substring(indexLastWord, indexNextWord);
            cwd = null;
            for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                const itemName = items[itemIndex]["name"];
                if (itemName === word) {
                    // directory exists
                    cwd = childIndex + itemIndex;
                    break;
                }
            }
            if (cwd === null) {
                // directory does not exist
                break;
            }
            indexLastWord = indexNextWord + 1;
        }
        if (cwd === null) {
            dropdown.style.display = "none";
            return;
        }

        let options = [];
        const lastWord = filter.substring(indexLastWord);
        const item = directories[cwd];
        if (item["childIndex"] !== undefined) {
            const childIndex = item["childIndex"];
            const childCount = item["childCount"];
            const items = directories.slice(childIndex, childIndex + childCount);
            for (let i = 0; i < items.length; i++) {
                const itemName = items[i]["name"];
                if (itemName.startsWith(lastWord)) {
                    options.push(itemName);
                }
            }
        }
        else {
            const filename = item["name"];
            if (filename.startsWith(lastWord)) {
                options.push(filename);
            }
        }
        if (options.length === 0) {
            dropdown.style.display = "none";
            return;
        }

        const selection_select = (e) => {
            const selection = e.target;
            if (e.movementX === 0 && e.movementY === 0) { return; }
            if (!selection.classList.contains(DROPDOWN_DIRECTORY_SELECTION_CLASS)) {
                // assumes only one will ever selected at a time
                e.stopPropagation();
                const children = dropdown.children;
                let iChild;
                for (iChild = 0; iChild < children.length; iChild++) {
                    const child = children[iChild];
                    child.classList.remove(DROPDOWN_DIRECTORY_SELECTION_CLASS);
                }
                selection.classList.add(DROPDOWN_DIRECTORY_SELECTION_CLASS);
            }
        };
        const selection_deselect = (e) => {
            e.stopPropagation();
            e.target.classList.remove(DROPDOWN_DIRECTORY_SELECTION_CLASS);
        };
        const selection_submit = (e) => {
            e.stopPropagation();
            submitSearch(input, e.target);
        };
        const innerHtml = options.map((text) => {
            /** @type {HTMLParagraphElement} */
            const p = $el(
                "p",
                {
                    onmouseenter: (e) => selection_select(e),
                    onmousemove: (e) => selection_select(e),
                    onmouseleave: (e) => selection_deselect(e),
                    onmousedown: (e) => selection_submit(e),
                },
                [
                    text
                ]
            );
            return p;
        });
        dropdown.innerHTML = "";
        dropdown.append.apply(dropdown, innerHtml);
        dropdown.style.display = "block";
    }

    /**
     * @param {HTMLParagraphElement} selection
     * @param {HTMLInputElement} input
     * @param {string} sep
     */
    static appendSelectionToInput(selection, input, sep) {
        selection.classList.remove(DROPDOWN_DIRECTORY_SELECTION_CLASS);
        const selectedText = selection.innerText;
        const oldFilterText = input.value;
        const iSep = oldFilterText.lastIndexOf(sep);
        const previousPath = oldFilterText.substring(0, iSep + 1);
        input.value = previousPath + selectedText;
    }
}

/**
 * @param {string} nodeType
 * @returns {int}
 */
function modelWidgetIndex(nodeType) {
    return 0;
}

/**
 * @param {string} path
 * @returns {string}
 */
function pathToFileString(path) {
    const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1;
    return path.slice(i);
}

/**
 * @param {string} file
 * @returns {string | undefined}
 */
function removeModelExtension(file) {
    // This is a bit sloppy (can assume server sends without)
    const i = file.lastIndexOf(".");
    if (i != -1) {
        return file.substring(0, i);
    }
}

/**
 * @param {string} text
 * @param {string} file
 * @param {boolean} removeExtension
 * @returns {string}
 */
function insertEmbeddingIntoText(text, file, removeExtension) {
    let name = file;
    if (removeExtension) {
        name = removeModelExtension(name)
    }
    const sep = text.length === 0 || text.slice(-1).match(/\s/) ? "" : " ";
    return text + sep + "(embedding:" +  name  + ":1.0)";
}

/**
 * @param {HTMLButtonElement} element
 * @param {boolean} success
 * @param {string} [successText=""]
 * @param {string} [failureText=""]
 * @param {string} [resetText=""]
 */
function buttonAlert(element, success, successText = "", failureText = "", resetText = "") {
    const name = success ? "button-success" : "button-failure";
    element.classList.add(name);
    if (successText != "" && failureText != "") {
        element.innerHTML = success ? successText : failureText;
    }
    // TODO: debounce would be nice to get working...
    window.setTimeout((element, name, innerHTML) => {
        element.classList.remove(name);
        if (innerHTML != "") {
            element.innerHTML = innerHTML;
        }
    }, 500, element, name, resetText);
}

class Tabs {
    /** @type {Record<string, HTMLDivElement>} */
    #head = {};
    /** @type {Record<string, HTMLDivElement>} */
    #body = {};

    /**
     * @param {HTMLDivElement[]} tabs
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

    /**
     * @param {string} name
     */
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
 * @param {Record<HTMLDivElement, Any>} tabs
 * @returns {HTMLDivElement[]}
 */
function $tabs(tabs) {
    const instance = new Tabs(tabs);
    return instance.element;
}

/**
 * @param {string} name
 * @param {HTMLDivElement[]} el
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

    /** @type {Column[]} */
    #columns = [];

    /** @type {Record<string, any>[]} */
    #dataSource = [];

    /** @type {HTMLDivElement} */
    #tbody = null;

    /**
     * @param {Column[]} columns
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

    /**
     * @param {Array} dataSource
     */
    setData(dataSource) {
        this.#dataSource = dataSource;
        this.#updateList();
    }

    /**
     * @returns {Array}
     */
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

    /**
     * @param {Array} list
     * @param {string} searchString
     * @param {string} installedType
     */
    filterList(list, searchString, installedType) {
        /** @type {string[]} */
        const keywords = searchString
            .replace("*", " ")
            .split(/(-?".*?"|[^\s"]+)+/g)
            .map((item) => item
                .trim()
                .replace(/(?:'|")+/g, "")
                .toLowerCase())
            .filter(Boolean);

        // TODO: handle /directory keywords seperately/differently

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
    /**
     * @param {Array} list
     * @param {string} searchString
     * @returns {Array}
     */
    static #filter(list, searchString) {
        /** @type {string[]} */
        const keywords = searchString
            .replace("*", " ")
            .split(/(-?".*?"|[^\s"]+)+/g)
            .map((item) => item
                .trim()
                .replace(/(?:")+/g, "")
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

    /**
     * @param {Event} event
     * @param {string} modelType
     * @param {string} path
     * @param {boolean} removeEmbeddingExtension
     * @param {int} addOffset
     */
    static #addModel(event, modelType, path, removeEmbeddingExtension, addOffset) {
        let success = false;
        if (modelType !== "embeddings") {
            const nodeType = modelNodeType[modelType];
            const widgetIndex = modelWidgetIndex(nodeType);
            let node = LiteGraph.createNode(nodeType, null, []);
            if (node) {
                node.widgets[widgetIndex].value = path;
                const selectedNodes = app.canvas.selected_nodes;
                let isSelectedNode = false;
                for (var i in selectedNodes) {
                    const selectedNode = selectedNodes[i];
                    node.pos[0] = selectedNode.pos[0] + addOffset;
                    node.pos[1] = selectedNode.pos[1] + addOffset;
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
                success = true;
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
                    target.value = insertEmbeddingIntoText(target.value, embeddingFile, removeEmbeddingExtension);
                    success = true;
                }
            }
            if (!success) {
                console.warn("Try selecting a node before adding the embedding.");
            }
            event.stopPropagation();
        }
        buttonAlert(event.target, success, "✔", "✖", "✚");
    }

    /**
     * @param {Event} event
     * @param {string} modelType
     * @param {string} path
     * @param {boolean} removeEmbeddingExtension
     * @param {boolean} strictDragToAdd
     */
    static #dragAddModel(event, modelType, path, removeEmbeddingExtension, strictDragToAdd) {
        const target = document.elementFromPoint(event.x, event.y);
        if (modelType !== "embeddings" && target.id === "graph-canvas") {
            const nodeType = modelNodeType[modelType];
            const widgetIndex = modelWidgetIndex(nodeType);
            const pos = app.canvas.convertEventToCanvasOffset(event);
            const nodeAtPos = app.graph.getNodeOnPos(pos[0], pos[1], app.canvas.visible_nodes);

            let draggedOnNode = nodeAtPos && nodeAtPos.type === nodeType;
            if (strictDragToAdd) {
                const draggedOnWidget = app.canvas.processNodeWidgets(nodeAtPos, pos, event) === nodeAtPos.widgets[widgetIndex];
                draggedOnNode = draggedOnNode && draggedOnWidget;
            }

            if (draggedOnNode) {
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
                target.value = insertEmbeddingIntoText(target.value, embeddingFile, removeEmbeddingExtension);
                event.stopPropagation();
            }
        }
    }

    /**
     * @param {Event} event
     * @param {string} modelType
     * @param {string} path
     * @param {boolean} removeEmbeddingExtension
     */
    static #copyModelToClipboard(event, modelType, path, removeEmbeddingExtension) {
        const nodeType = modelNodeType[modelType];
        let success = false;
        if (nodeType === "Embedding") {
            if (navigator.clipboard){
                const embeddingFile = pathToFileString(path);
                const embeddingText = insertEmbeddingIntoText("", embeddingFile, removeEmbeddingExtension);
                navigator.clipboard.writeText(embeddingText);
                success = true;
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
            success = true;
        }
        else {
            console.warn(`Unable to copy unknown model type '${modelType}.`);
        }
        buttonAlert(event.target, success, "✔", "✖", "⧉︎");
    }

    /**
     * @param {Array} models
     * @param {string} modelType
     * @param {Object.<HTMLInputElement>} settingsElements
     * @returns {HTMLElement[]}
     */
    static #generateInnerHtml(models, modelType, settingsElements) {
        // TODO: seperate text and model logic; getting too messy
        // TODO: fallback on button failure to copy text?
        const canShowButtons = modelNodeType[modelType] !== undefined;
        const showAddButton = canShowButtons && settingsElements["model-show-add-button"].checked;
        const showCopyButton = canShowButtons && settingsElements["model-show-copy-button"].checked;
        const strictDragToAdd = settingsElements["model-add-drag-strict-on-field"].checked;
        const addOffset = parseInt(settingsElements["model-add-offset"].value);
        const showModelExtension = settingsElements["model-show-label-extensions"].checked;
        const removeEmbeddingExtension = !settingsElements["model-add-embedding-extension"].checked;
        if (models.length > 0) {
            return models.map((item) => {
                const uri = item.post ?? "no-post";
                const imgUrl = `/model-manager/image-preview?uri=${uri}`;
                let buttons = [];
                if (showAddButton) {
                    buttons.push(
                        $el("button.icon-button.model-button", {
                            type: "button",
                            textContent: "⧉︎",
                            onclick: (e) => ModelGrid.#copyModelToClipboard(e, modelType, item.path, removeEmbeddingExtension),
                            draggable: false,
                        })
                    );
                }
                if (showCopyButton) {
                    buttons.push(
                        $el("button.icon-button.model-button", {
                            type: "button",
                            textContent: "✚",
                            onclick: (e) => ModelGrid.#addModel(e, modelType, item.path, removeEmbeddingExtension, addOffset),
                            draggable: false,
                        })
                    );
                }
                const dragAdd = (e) => ModelGrid.#dragAddModel(e, modelType, item.path, removeEmbeddingExtension, strictDragToAdd);
                return $el("div.item", {}, [
                    $el("img.model-preview", {
                        src: imgUrl,
                        draggable: false,
                    }),
                    $el("div.model-preview-overlay", {
                        ondragend: (e) => dragAdd(e),
                        draggable: true,
                    }),
                    $el("div.model-preview-top-right", {
                        draggable: false,
                    },
                        buttons
                    ),
                    $el("div.model-label", {
                        ondragend: (e) => dragAdd(e),
                        draggable: true,
                    }, [
                        $el("p", [showModelExtension ? item.name : removeModelExtension(item.name)])
                    ]),
                ]);
            });
        } else {
            return [$el("h2", ["No Models"])];
        }
    }

    /**
     * @param {HTMLDivElement} modelGrid
     * @param {Object} models
     * @param {HTMLSelectElement} modelSelect
     * @param {Object.<{value: string}>} previousModelType
     * @param {Object} settings
     * @param {Array} previousModelFilters
     * @param {HTMLInputElement} modelFilter
     */
    static update(modelGrid, models, modelSelect, previousModelType, settings, previousModelFilters, modelFilter) {
        let modelType = modelSelect.value;
        if (models[modelType] === undefined) {
            modelType = "checkpoints"; // TODO: magic value
        }

        if (modelType !== previousModelType.value) {
            if (settings["model-persistent-search"].checked) {
                previousModelFilters.splice(0, previousModelFilters.length); // TODO: make sure this actually worked!
            }
            else {
                // cache previous filter text
                previousModelFilters[previousModelType.value] = modelFilter.value;
                // read cached filter text
                modelFilter.value = previousModelFilters[modelType] ?? "";
            }
            previousModelType.value = modelType;
        }

        let modelTypeOptions = [];
        for (const [key, value] of Object.entries(models)) {
            const el = $el("option", [key]);
            modelTypeOptions.push(el);
        }
        modelSelect.innerHTML = "";
        modelTypeOptions.forEach(option => modelSelect.add(option));
        modelSelect.value = modelType;

        const searchAppend = settings["model-search-always-append"].value;
        const searchText = modelFilter.value + " " + searchAppend;
        const modelList = ModelGrid.#filter(models[modelType], searchText);

        modelGrid.innerHTML = "";
        const modelGridModels = ModelGrid.#generateInnerHtml(modelList, modelType, settings);
        modelGrid.append.apply(modelGrid, modelGridModels);
    }
}

/**
 * @param {Any} attr
 * @returns {HTMLDivElement}
 */
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
        /** @type {HTMLButtonElement} */ loadSourceBtn: null,
        /** @type {HTMLInputElement} */ loadSourceFromInput: null,
        /** @type {HTMLSelectElement} */ sourceInstalledFilter: null,
        /** @type {HTMLInputElement} */ sourceContentFilter: null,

        /** @type {HTMLDivElement} */ modelGrid: null,
        /** @type {HTMLSelectElement} */ modelTypeSelect: null,
        /** @type {HTMLDivElement} */ searchDirectoryDropdown: null,
        /** @type {HTMLInputElement} */ modelContentFilter: null,

        /** @type {HTMLDivElement} */ sidebarButtons: null,

        /** @type {HTMLDivElement} */ settingsTab: null,
        /** @type {HTMLButtonElement} */ settings_reloadBtn: null,
        /** @type {HTMLButtonElement} */ settings_saveBtn: null,
        settings: {
            //"sidebar-default-height": null,
            //"sidebar-default-width": null,
            /** @type {HTMLTextAreaElement} */ "model-search-always-append": null,
            /** @type {HTMLInputElement} */ "model-persistent-search": null,
            /** @type {HTMLInputElement} */ "model-show-label-extensions": null,
            /** @type {HTMLInputElement} */ "model-show-add-button": null,
            /** @type {HTMLInputElement} */ "model-show-copy-button": null,
            /** @type {HTMLInputElement} */ "model-add-embedding-extension": null,
            /** @type {HTMLInputElement} */ "model-add-drag-strict-on-field": null,
            /** @type {HTMLInputElement} */ "model-add-offset": null,
        }
    };

    #data = {
        /** @type {Array} */ sources: [],
        /** @type {Object} */ models: {},
        /** @type {DirectoryItem[]} */ modelDirectories: [],
        /** @type {Array} */ previousModelFilters: [],
        /** @type {Object.<{value: string}>} */ previousModelType: { value: undefined },
    };

    /** @type {string} */
    #sep = "/";

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
                $el("div.comfy-modal-content", [ // TODO: settings.top_bar_left_to_right or settings.top_bar_right_to_left
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
                                    textContent: "⬒",
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
                        $tab("Models", this.#modelTab_new()),
                        $tab("Settings", [this.#settingsTab_new()]),
                    ]),
                ]),
            ]
        );

        this.#init();
    }

    #init() {
        this.#settingsTab_reload(false);
        this.#refreshSourceList();
        this.#modelTab_updateModels();
    }

    /**
     * @returns {HTMLDivElement[]}
     */
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
                        onkeydown: (e) => e.key === "Enter" && this.#filterSourceList(),
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

    /**
     * @returns {HTMLElement}
     */
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

    /** @type {DirectoryDropdown} */
    #modelContentFilterDirectoryDropdown = null;

    /**
     * @returns {HTMLElement[]}
     */
    #modelTab_new() {
        /** @type {HTMLDivElement} */
        const modelGrid = $el("div.comfy-grid");
        this.#el.modelGrid = modelGrid;

        const searchInput = $el("input.search-text-area", {
            $: (el) => (this.#el.modelContentFilter = el),
            placeholder: "example: /0/1.5/styles/clothing -.pt",
        });

        const searchDropdown = new DirectoryDropdown(
            searchInput,
            this.#modelTab_updateDirectoryDropdown,
            this.#modelTab_submitSearch
        );
        this.#modelContentFilterDirectoryDropdown = searchDropdown;

        return [
            $el("div.row.tab-header", [
                $el("div.row.tab-header-flex-block", [
                    $el("button.icon-button", {
                        type: "button",
                        textContent: "⟳",
                        onclick: () => this.#modelTab_updateModels(),
                    }),
                    $el("select.model-type-dropdown", {
                        $: (el) => (this.#el.modelTypeSelect = el),
                        name: "model-type",
                        onchange: () => this.#modelTab_updateModelGrid(),
                    }),
                ]),
                $el("div.row.tab-header-flex-block", [
                    $el("div.search-models", [
                        searchInput,
                        searchDropdown.element,
                    ]),
                    $el("button.icon-button", {
                        type: "button",
                        textContent: "🔍︎",
                        onclick: () => this.#modelTab_updateModelGrid(),
                    }),
                ]),
            ]),
            modelGrid,
        ];
    }

    #modelTab_updateModelGrid = () => ModelGrid.update(
        this.#el.modelGrid,
        this.#data.models,
        this.#el.modelTypeSelect,
        this.#data.previousModelType,
        this.#el.settings,
        this.#data.previousModelFilters,
        this.#el.modelContentFilter
    );

    async #modelTab_updateModels() {
        this.#data.models = await request("/model-manager/models");
        this.#data.modelDirectories = await request("/model-manager/model-directory-list");
        this.#modelTab_updateModelGrid();
    }

    #modelTab_updateDirectoryDropdown = () => {
        const modelType = this.#el.modelTypeSelect.value;
        this.#modelContentFilterDirectoryDropdown.update(
            this.#data.modelDirectories,
            this.#sep,
            modelType,
        );
        const value = this.#el.modelContentFilter.value;
        this.#data.previousModelFilters[modelType] = value;
    }

    /**
     * @param {HTMLInputElement} input
     * @param {HTMLParagraphElement | undefined | null} selection
     */
    #modelTab_submitSearch = (input, selection) => {
        if (selection !== undefined && selection !== null) {
            DirectoryDropdown.appendSelectionToInput(selection, input, this.#sep);
            this.#modelTab_updateDirectoryDropdown();
        }
        input.blur();
        this.#modelTab_updateModelGrid();
    }

    /**
     * @param {HTMLInputElement[]} settings 
     * @param {boolean} reloadData 
     */
    #setSettings(settings, reloadData) {
        const el = this.#el.settings;
        for (const [key, value] of Object.entries(settings)) {
            const setting = el[key];
            if (setting) {
                const type = setting.type;
                switch (type) {
                    case "checkbox": setting.checked = Boolean(value); break;
                    case "range": setting.value = parseFloat(value); break;
                    case "textarea": setting.value = value; break;
                    case "number": setting.value = parseInt(value); break;
                    default: console.warn("Unknown settings input type!");
                }
            }
        }

        if (reloadData) {
            // Is this slow?
            this.#refreshSourceList();
            this.#modelTab_updateModels();
        }
    }

    /**
     * @param {boolean} reloadData 
     */
    async #settingsTab_reload(reloadData) {
        const data = await request("/model-manager/settings/load");
        const settings = data["settings"];
        this.#setSettings(settings, reloadData);
        buttonAlert(this.#el.settings_reloadBtn, true);
    }

    async #settingsTab_save() {
        let settings = {};
        for (const [setting, el] of Object.entries(this.#el.settings)) {
            if (!el) { continue; } // hack
            const type = el.type;
            let value = null;
            switch (type) {
                case "checkbox": value = el.checked; break;
                case "range": value = el.value; break;
                case "textarea": value = el.value; break;
                case "number": value = el.value; break;
                default: console.warn("Unknown settings input type!");
            }
            settings[setting] = value;
        }

        const data = await request(
            "/model-manager/settings/save",
            {
                method: "POST",
                body: JSON.stringify({ "settings": settings }),
            }
        );
        const success = data["success"];
        if (success) {
            const settings = data["settings"];
            this.#setSettings(settings, true);
        }
        buttonAlert(this.#el.settings_saveBtn, success);
    }

    /**
     * @returns {HTMLElement}
     */
    #settingsTab_new() {
        const settingsTab = $el("div.model-manager-settings", [
            $el("h1", ["Settings"]),
            $el("div", [
                $el("button", {
                    $: (el) => (this.#el.settings_reloadBtn = el),
                    type: "button",
                    textContent: "Reload", // ⟳
                    onclick: () => this.#settingsTab_reload(true),
                }),
                $el("button", {
                    $: (el) => (this.#el.settings_saveBtn = el),
                    type: "button",
                    textContent: "Save", // 💾︎
                    onclick: () => this.#settingsTab_save(),
                }),
            ]),
            /*
            $el("h2", ["Window"]),
            $el("div", [
                $el("p", ["Default sidebar width"]),
                $el("input", {
                    $: (el) => (this.#el.settings["sidebar-default-width"] = el),
                    type: "number",
                    value: 0.5,
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                }),
            ]),
            $el("div", [
                $el("p", ["Default sidebar height"]),
                $el("input", {
                    $: (el) => (this.#el.settings["sidebar-default-height"] = el),
                    type: "number",
                    textContent: "Default sidebar height",
                    value: 0.5,
                    min: 0.0,
                    max: 1.0,
                    step: 0.05,
                }),
            ]),
            */
            $el("h2", ["Model Search"]),
            $el("div", [
                $el("div.search-settings-text", [
                    $el("p", ["Always include in model search:"]),
                    $el("textarea.comfy-multiline-input", {
                        $: (el) => (this.#el.settings["model-search-always-append"] = el),
                        placeholder: "example: -nsfw",
                    }),
                ]),
            ]),
            $el("div", [
                $el("input", {
                    $: (el) => (this.#el.settings["model-persistent-search"] = el),
                    type: "checkbox",
                }),
                $el("p", ["Persistent search text across model types"]),
            ]),
            $el("div", [
                $el("input", {
                    $: (el) => (this.#el.settings["model-show-label-extensions"] = el),
                    type: "checkbox",
                }),
                $el("p", ["Show model file extension in labels"]),
            ]),
            $el("div", [
                $el("input", {
                    $: (el) => (this.#el.settings["model-show-add-button"] = el),
                    type: "checkbox",
                }),
                $el("p", ["Show add button"]),
            ]),
            $el("div", [
                $el("input", {
                    $: (el) => (this.#el.settings["model-show-copy-button"] = el),
                    type: "checkbox",
                }),
                $el("p", ["Show copy button"]),
            ]),
            $el("h2", ["Model Add"]),
            $el("div", [
                $el("input", {
                    $: (el) => (this.#el.settings["model-add-embedding-extension"] = el),
                    type: "checkbox",
                }),
                $el("p", ["Add extension to embedding"]),
            ]),
            $el("div", [
                $el("input", {
                    $: (el) => (this.#el.settings["model-add-drag-strict-on-field"] = el),
                    type: "checkbox",
                }),
                $el("p", ["Strict dragging model onto a node's model field to add"]),
            ]),
            $el("div", [
                $el("input", {
                    $: (el) => (this.#el.settings["model-add-offset"] = el),
                    type: "number",
                    step: 5,
                }),
                $el("p", ["Add model offset"]),
            ]),
        ]);
        this.#el.settingsTab = settingsTab;
        return settingsTab;
    }

    /**
     * @param {Event} e
     */
    #setSidebar(e) {
        // TODO: settings["sidebar-default-width"]
        // TODO: settings["sidebar-default-height"]
        // TODO: draggable resize?
        const button = e.target;
        const modelManager = this.element;
        const sidebarButtons = this.#el.sidebarButtons.children;

        let buttonIndex;
        for (buttonIndex = 0; buttonIndex < sidebarButtons.length; buttonIndex++) {
            if (sidebarButtons[buttonIndex] === button) {
                break;
            }
        }

        const sidebarStates = ["sidebar-left", "sidebar-top", "sidebar-bottom", "sidebar-right"];
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
