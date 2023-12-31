import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { ComfyDialog, $el } from "../../scripts/ui.js";

function debounce(func, delay) {
    let timer;
    return function () {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, arguments);
        }, delay);
    };
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

class List {
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
}

class Grid {
    constructor() {
        this.element = $el("div.comfy-grid");
    }

    #dataSource = [];

    setData(dataSource) {
        this.#dataSource = dataSource;
        this.element.innerHTML = [];
        this.#updateList();
    }

    #updateList() {
        this.element.innerHTML = null;
        if (this.#dataSource.length > 0) {
            this.element.append.apply(
                this.element,
                this.#dataSource.map((item) => {
                    const uri = item.post ?? "no-post";
                    const imgUrl = `/model-manager/image-preview?uri=${uri}`;
                    return $el("div.item", {}, [
                        $el("img", { src: imgUrl }),
                        $el("div", {}, [
                            $el("p", [item.name])
                        ]),
                    ]);
                })
            );
        } else {
            this.element.innerHTML = "<h2>No Models</h2>";
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
    #request(url, options) {
        return new Promise((resolve, reject) => {
            api.fetchApi(url, options)
                .then((response) => response.json())
                .then(resolve)
                .catch(reject);
        });
    }

    #el = {
        loadSourceBtn: null,
        loadSourceFromInput: null,
        sourceInstalledFilter: null,
        sourceContentFilter: null,
        sourceFilterBtn: null,
        modelTypeSelect: null,
        modelContentFilter: null,
    };

    #data = {
        sources: [],
        models: {},
    };

    /** @type {List} */
    #sourceList = null;

    constructor() {
        super();
        this.element = $el(
            "div.comfy-modal.model-manager",
            { parent: document.body },
            [
                $el("div.comfy-modal-content", [
                    $el("button.close.icon-button", {
                        textContent: "✕",
                        onclick: () => this.close(),
                    }),
                    $tabs([
                        $tab("Install", this.#createSourceInstall()),
                        $tab("Models", this.#createModelList()),
                        $tab("Settings", []),
                    ]),
                ]),
            ]
        );

        this.#init();
    }

    #init() {
        this.#refreshSourceList();
        this.#refreshModelList();
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
                    $el(
                        "select",
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
        const sourceList = new List([
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
                            const response = await this.#request(
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
        const dataSource = await this.#request(
            `/model-manager/source?uri=${uri}`
        ).catch(() => []);
        this.#data.sources = dataSource;
        this.#sourceList.setData(dataSource);
        this.#el.sourceInstalledFilter.value = "Filter: All";
        this.#el.sourceContentFilter.value = "";

        this.#el.loadSourceBtn.disabled = false;
    }

#filterSourceList() {
    /** @type {Array<string>} */
    const content = this.#el.sourceContentFilter.value
        .replace("*", " ")
        .split(/(-?".*?"|[^\s"]+)+/g)
        .map((item) => item
            .trim()
            .replace(/(?:'|")+/g, "")
            .toLowerCase() // TODO: Quotes should be exact?
        )
        .filter(Boolean);

    const installedType = this.#el.sourceInstalledFilter.value;
    const newDataSource = this.#data.sources.filter((row) => {
        if (installedType !== "Filter: All") {
            if ((installedType === "Downloaded" && !row["installed"]) || 
                (installedType === "Not Downloaded" && row["installed"])) {
                return false;
            }
        }

        let filterField = ["type", "name", "base", "description"];
        const rowText = filterField
            .reduce((memo, field) => memo + " " + row[field], "")
            .toLowerCase();
        return content.reduce((memo, target) => {
            const excludeTarget = target[0] === "-";
            if (excludeTarget && target.length === 1) { return memo; }
            const filteredTarget = excludeTarget ? target.slice(1) : target;
            const regexSHA256 = /^[a-f0-9]{64}$/gi;
            if (row["SHA256"] !== undefined && regexSHA256.test(filteredTarget)) {
                return memo && excludeTarget !== (filteredTarget === row["SHA256"]);
            }
            else {
                return memo && excludeTarget !== rowText.includes(filteredTarget);
            }
        }, true);
    });

        this.#sourceList.setData(newDataSource);
    }

    /** @type {Grid} */
    #modelList = null;

    #createModelList() {
        const gridInstance = new Grid();
        this.#modelList = gridInstance;

        return [
            $el("div.row.tab-header", [
                $el("div.row.tab-header-flex-block",
                    [
                    $el("button.icon-button", {
                        type: "button",
                        textContent: "⟳",
                        onclick: () => this.#refreshModelList(),
                    }),
                    $el("select.model-type-dropdown",
                        {
                            $: (el) => (this.#el.modelTypeSelect = el),
                            name: "model-type",
                            onchange: () => this.#filterModelList(),
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
                    ]
                ),
                $el("div.row.tab-header-flex-block", [
                    $el("input.search-text-area", {
                        $: (el) => (this.#el.modelContentFilter = el),
                        placeholder: "example: 1.5/styles -.pt",
                        onkeyup: (e) => e.key === "Enter" && this.#filterModelList(),
                    }),
                    $el("button.icon-button", {
                        type: "button",
                        textContent: "🔍︎",
                        onclick: () => this.#filterModelList(),
                    }),
                ]),
            ]),
            gridInstance.element,
        ];
    }

    async #refreshModelList() {
        const dataSource = await this.#request("/model-manager/models");
        this.#data.models = dataSource;
        this.#filterModelList();
    }

    #filterModelList() {
        /** @type {Array<string>} */
        const content = this.#el.modelContentFilter.value
            .replace("*", " ")
            .split(/(-?".*?"|[^\s"]+)+/g)
            .map((item) => item
                .trim()
                .replace(/(?:'|")+/g, "")
                .toLowerCase() // TODO: Quotes should be exact?
            )
            .filter(Boolean);

        const modelType = this.#el.modelTypeSelect.value;

        const newDataSource = this.#data.models[modelType].filter((modelInfo) => {
            const filterField = ["name", "path"];
            const modelText = filterField
                .reduce((memo, field) => memo + " " + modelInfo[field], "")
                .toLowerCase();
            return content.reduce((memo, target) => {
                const excludeTarget = target[0] === "-";
                if (excludeTarget && target.length === 1) { return memo; }
                const filteredTarget = excludeTarget ? target.slice(1) : target;
                const regexSHA256 = /^[a-f0-9]{64}$/gi;
                if (modelInfo["SHA256"] !== undefined && regexSHA256.test(filteredTarget)) {
                    return memo && excludeTarget !== (filteredTarget === modelInfo["SHA256"]);
                }
                else {
                    return memo && excludeTarget !== modelText.includes(filteredTarget);
                }
            }, true);
        });
        this.#modelList.setData(newDataSource);
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
