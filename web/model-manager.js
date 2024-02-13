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

const MODEL_SORT_DATE_CREATED = "dateCreated";
const MODEL_SORT_DATE_MODIFIED = "dateModified";
const MODEL_SORT_DATE_NAME = "name";

const MODEL_EXTENSIONS = [".ckpt", ".pt", ".bin", ".pth", ".safetensors"]; // TODO: ask server for?
const IMAGE_EXTENSIONS = [".png", ".webp", ".gif"]; // TODO: ask server for?

/**
 * Tries to return the related ComfyUI model directory if unambigious.
 *
 * @param {string} modelType - Civitai model type.
 * @param {string} [fileType] - Civitai file type. Relevant for "Diffusers".
 *
 * @returns {(string|null)} Logical base directory name for model type. May be null if the directory is ambiguous or not a model type.
 */
function civitai_comfyUiDirectory(modelType, fileType) {
    if (fileType == "Diffusers") { return "diffusers"; } // TODO: is this correct?

    // TODO: somehow allow for SERVER to set dir?
    // TODO: allow user to choose EXISTING folder override/null? (style_models, HuggingFace) (use an object/map instead so settings can be dynamically set)
    if (modelType == "AestheticGradient") { return null; }
    else if (modelType == "Checkpoint") { return "checkpoints"; } // TODO: what about VAE?
    //else if (modelType == "") { return "clip"; }
    //else if (modelType == "") { return "clip_vision"; }
    else if (modelType == "Controlnet") { return "controlnet"; }
    //else if (modelType == "Controlnet") { return "style_models"; } // are these controlnets? (TI-Adapter)
    //else if (modelType == "") { return "gligen"; }
    else if (modelType == "Hypernetwork") { return "hypernetworks"; }
    else if (modelType == "LORA") { return "loras"; }
    else if (modelType == "LoCon") { return "loras"; }
    else if (modelType == "MotionModule") { return null; }
    else if (modelType == "Other") { return null; }
    else if (modelType == "Pose") { return null; }
    else if (modelType == "TextualInversion") { return "embeddings"; }
    //else if (modelType == "") { return "unet"; }
    else if (modelType == "Upscaler") { return "upscale_models"; }
    else if (modelType == "VAE") { return "vae"; }
    else if (modelType == "Wildcards") { return null; }
    else if (modelType == "Workflows") { return null; }
    return null;
}

/**
 * Get model info from Civitai.
 *
 * @param {string} id - Model ID.
 * @param {string} apiPath - Civitai request subdirectory. "models" for 'model' urls. "model-version" for 'api' urls.
 *
 * @returns {Object} Dictionary containing recieved model info. Returns an empty if fails.
 */
async function civitai_requestInfo(id, apiPath) {
    const url = "https://civitai.com/api/v1/" + apiPath +  "/" + id;
    return await request(url);
}

/**
 * Extract file information from the given model version infomation.
 *
 * @param {Object} modelVersionInfo - Model version infomation.
 * @param {(string|null)} [type=null] - Optional select by model type.
 * @param {(string|null)} [fp=null] - Optional select by floating point quantization.
 * @param {(string|null)} [size=null] - Optional select by sizing.
 * @param {(string|null)} [format=null] - Optional select by file format.
 *
 * @returns {Object} - Extracted list of infomation on each file of the given model version.
 */
function civitai_getModelFilesInfo(modelVersionInfo, type = null, fp = null, size = null, format = null) {
    const files = [];
    const modelVersionFiles = modelVersionInfo["files"];
    for (let i = 0; i < modelVersionFiles.length; i++) {
        const modelVersionFile = modelVersionFiles[i];
        
        const fileType = modelVersionFile["type"];
        if (type instanceof String && type != fileType) { continue; }
        
        const fileMeta = modelVersionFile["metadata"];
        
        const fileFp = fileMeta["fp"];
        if (fp instanceof String && fp != fileFp) { continue; }
        
        const fileSize = fileMeta["size"];
        if (size instanceof String && size != fileSize) { continue; }
        
        const fileFormat = fileMeta["format"];
        if (format instanceof String && format != fileFormat) { continue; }
        
        files.push({
            "downloadUrl": modelVersionFile["downloadUrl"],
            "format": fileFormat,
            "fp": fileFp,
            "hashes": modelVersionFile["hashes"],
            "name": modelVersionFile["name"],
            "size": fileSize,
            "sizeKB": modelVersionFile["sizeKB"],
            "type": fileType,
        });
    }
    return {
        "files": files,
        "id": modelVersionInfo["id"],
        "images": modelVersionInfo["images"].map((image) => {
            // TODO: do I need to double-check image matches resource?
            return image["url"];
        }),
        "name": modelVersionInfo["name"],
    };
}

/**
 * 
 *
 * @param {string} stringUrl - Model url.
 *
 * @returns {Object} - Download information for the given url.
 */
async function civitai_getFilteredInfo(stringUrl) {
    const url = new URL(stringUrl);
    if (url.hostname != 'civitai.com') { return {}; }
    if (url.pathname == '/') { return {} }
    const urlPath = url.pathname;
    if (urlPath.startsWith('/api')) {
        const idEnd = urlPath.length - (urlPath.at(-1) == "/" ? 1 : 0);
        const idStart = urlPath.lastIndexOf("/", idEnd - 1) + 1;
        const modelVersionId = urlPath.substring(idStart, idEnd);
        if (parseInt(modelVersionId, 10) == NaN) {
            return {};
        }
        const modelVersionInfo = await civitai_requestInfo(modelVersionId, "model-versions");
        if (Object.keys(modelVersionInfo).length == 0) {
            return {};
        }
        const searchParams = url.searchParams;
        const filesInfo = civitai_getModelFilesInfo(
            modelVersionInfo,
            searchParams.get("type"),
            searchParams.get("fp"),
            searchParams.get("size"),
            searchParams.get("format"),
        );
        return {
            "name": modelVersionInfo["model"]["name"],
            "type": modelVersionInfo["model"]["type"],
            "versions": [filesInfo]
        }
    }
    else if (urlPath.startsWith('/models')) {
        const idStart = urlPath.indexOf("models/") + "models/".length;
        const idEnd = (() => {
            const idEnd = urlPath.indexOf("/", idStart);
            return idEnd === -1 ? urlPath.length : idEnd;
        })();
        const modelId = urlPath.substring(idStart, idEnd);
        if (parseInt(modelId, 10) == NaN) {
            return {};
        }
        const modelInfo = await civitai_requestInfo(modelId, "models");
        if (Object.keys(modelInfo).length == 0) {
            return {};
        }
        const modelVersionId = parseInt(url.searchParams.get("modelVersionId"));
        const modelVersions = [];
        const modelVersionInfos = modelInfo["modelVersions"];
        for (let i = 0; i < modelVersionInfos.length; i++) {
            const versionInfo = modelVersionInfos[i];
            if (!Number.isNaN(modelVersionId)) {
                if (modelVersionId != versionInfo["id"]) {continue; }
            }
            const filesInfo = civitai_getModelFilesInfo(versionInfo);
            modelVersions.push(filesInfo);
        }
        return {
            "name": modelInfo["name"],
            "type": modelInfo["type"],
            "versions": modelVersions
        }
    }
    else {
        return {};
    }
}

/**
 * Get model info from Huggingface.
 *
 * @param {string} id - Model ID.
 * @param {string} apiPath - API path.
 *
 * @returns {Promise<Object>} Dictionary containing recieved model info. Returns an empty if fails.
 */
async function huggingFace_requestInfo(id, apiPath = "models") {
    const url = "https://huggingface.co/api/" + apiPath + "/" + id;
    return await request(url);
}

/**
 * 
 *
 * @param {string} stringUrl - Model url.
 *
 * @returns {Promise<Object>}
 */
async function huggingFace_getFilteredInfo(stringUrl) {
    const url = new URL(stringUrl);
    if (url.hostname != 'huggingface.co') { return {}; }
    if (url.pathname == '/') { return {} }
    const urlPath = url.pathname;
    const i0 = 1;
    const i1 = urlPath.indexOf("/", i0);
    if (i1 == -1 || urlPath.length - 1 == i1) {
        // user-name only
        return {};
    }
    let i2 = urlPath.indexOf("/", i1 + 1);
    if (i2 == -1) {
        // model id only
        i2 = urlPath.length;
    }
    const modelId = urlPath.substring(i0, i2);
    const urlPathEnd = urlPath.substring(i2);
    
    let branch = null;
    if (urlPathEnd.startsWith("/resolve")) {
        branch = "/resolve";
    }
    else if (urlPathEnd.startsWith("/blob")) {
        branch = "/blob";
    }
    else if (urlPathEnd.startsWith("/tree")) {
        branch = "/tree";
    }
    
    let filePath = "";
    if (branch == null) {
        branch = "/tree/main";
    }
    else {
        const i0 = branch.length;
        const i1 = urlPathEnd.indexOf("/", i0 + 1);
        if (i1 == -1) {
            if (i0 == urlPathEnd.length) {
                // ends with '/tree' (invalid?)
                branch = "/tree/main";
            }
            else {
                // ends with branch
                branch = "/tree" + urlPathEnd.substring(i0);
            }
        }
        else {
            branch = "/tree" + urlPathEnd.substring(i0, i1);
            if (urlPathEnd.length - 1 > i1) {
                filePath = urlPathEnd.substring(i1);
            }
        }
    }
    
    const modelInfo = await huggingFace_requestInfo(modelId);
    //const modelInfo = await requestInfo(modelId + branch); // this only gives you the files at the given branch path...
    // oid: SHA-1?, lfs.oid: SHA-256
    
    const clippedFilePath = filePath.substring(filePath[0] === "/" ? 1 : 0);
    const modelFiles = modelInfo["siblings"].filter((sib) => {
        const filename = sib["rfilename"];
        for (let i = 0; i < MODEL_EXTENSIONS.length; i++) {
            if (filename.endsWith(MODEL_EXTENSIONS[i])) {
                return filename.startsWith(clippedFilePath);
            }
        }
        return false;
    }).map((sib) => {
        const filename = sib["rfilename"];
        return filename;
    });
    if (modelFiles.length === 0) {
        return {};
    }
    
    const imageFiles = modelInfo["siblings"].filter((sib) => {
        const filename = sib["rfilename"];
        for (let i = 0; i < IMAGE_EXTENSIONS.length; i++) {
            if (filename.endsWith(IMAGE_EXTENSIONS[i])) {
                return filename.startsWith(filePath);
            }
        }
        return false;
    }).map((sib) => {
        const filename = sib["rfilename"];
        return filename;
    });
    
    const baseDownloadUrl = url.origin + urlPath.substring(0, i2) + "/resolve" + branch.replace("/tree", "");
    return {
        "baseDownloadUrl": baseDownloadUrl,
        "modelFiles": modelFiles,
        "imageFiles": imageFiles,
    };
}

/**
 * @typedef {Object} DirectoryItem
 * @param {string} name
 * @param {number | undefined} childCount
 * @param {number | undefined} childIndex
 */

class DirectoryDropdown {
    /** @type {HTMLDivElement} */
    element = undefined;
    
    /** @type {Boolean} */
    showDirectoriesOnly = false;

    /** @type {HTMLInputElement} */
    #input = undefined;
    
    // TODO: remove this
    /** @type {Function} */
    #updateDropdown = null;
    
    /** @type {Function} */
    #updateCallback = null;
    
    /** @type {Function} */
    #submitCallback = null;
    
    /**
     * @param {HTMLInputElement} input
     * @param {Function} updateDropdown
     * @param {Function} [updateCallback= () => {}]
     * @param {Function} [submitCallback= () => {}]
     * @param {String} [sep="/"]
     * @param {Boolean} [showDirectoriesOnly=false]
     */
    constructor(input, updateDropdown, updateCallback = () => {}, submitCallback = () => {}, sep = "/", showDirectoriesOnly = false) {
        /** @type {HTMLDivElement} */
        const dropdown = $el("div.search-dropdown", { // TODO: change to `search-directory-dropdown`
            style: {
                display: "none",
            },
        });
        this.element = dropdown;
        this.#input = input;
        this.#updateDropdown = updateDropdown;
        this.#updateCallback = updateCallback;
        this.#submitCallback = submitCallback;
        this.showDirectoriesOnly = showDirectoriesOnly;
        
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
                else if (e.key === "ArrowRight" && dropdown.style.display !== "none") {
                    const selection = options[iSelection];
                    if (selection !== undefined && selection !== null) {
                        e.stopPropagation();
                        e.preventDefault(); // prevent cursor move
                        const input = e.target;
                        DirectoryDropdown.selectionToInput(input, selection, sep);
                        updateDropdown();
                        //updateCallback();
                        //submitCallback();
                        const options = dropdown.children;
                        if (options.length > 0) {
                            // arrow key navigation
                            options[0].classList.add(DROPDOWN_DIRECTORY_SELECTION_CLASS);
                        }
                    }
                }
                else if (e.key === "ArrowLeft" && dropdown.style.display !== "none") {
                    const input = e.target;
                    const oldFilterText = input.value;
                    const iSep = oldFilterText.lastIndexOf(sep, oldFilterText.length - 2);
                    const newFilterText = oldFilterText.substring(0, iSep + 1);
                    if (oldFilterText !== newFilterText) {
                        const delta = oldFilterText.substring(iSep + 1);
                        let isMatch = delta[delta.length-1] === sep;
                        if (!isMatch) {
                            const options = dropdown.children;
                            for (let i = 0; i < options.length; i++) {
                                const option = options[i];
                                if (option.innerText.startsWith(delta)) {
                                    isMatch = true;
                                    break;
                                }
                            }
                        }
                        if (isMatch) {
                            e.stopPropagation();
                            e.preventDefault(); // prevent cursor move
                            input.value = newFilterText;
                            updateDropdown();
                            //updateCallback();
                            //submitCallback();
                            const options = dropdown.children;
                            let isSelected = false;
                            for (let i = 0; i < options.length; i++) {
                                const option = options[i];
                                if (option.innerText.startsWith(delta)) {
                                    option.classList.add(DROPDOWN_DIRECTORY_SELECTION_CLASS);
                                    isSelected = true;
                                    break;
                                }
                            }
                            if (!isSelected) {
                                const options = dropdown.children;
                                if (options.length > 0) {
                                    // arrow key navigation
                                    options[0].classList.add(DROPDOWN_DIRECTORY_SELECTION_CLASS);
                                }
                            }
                        }
                    }
                }
                else if (e.key === "Enter") {
                    e.stopPropagation();
                    const input = e.target
                    const selection = options[iSelection];
                    if (selection !== undefined && selection !== null) {
                        DirectoryDropdown.selectionToInput(input, selection, sep);
                        updateDropdown();
                        updateCallback();
                    }
                    submitCallback();
                    input.blur();
                }
                else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && dropdown.style.display !== "none") {
                    e.stopPropagation();
                    e.preventDefault(); // prevent cursor move
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
     * @param {HTMLInputElement} input
     * @param {HTMLParagraphElement | undefined | null} selection
     * @param {String} [sep="/"]
     */
    static selectionToInput(input, selection, sep) {
        selection.classList.remove(DROPDOWN_DIRECTORY_SELECTION_CLASS);
        const selectedText = selection.innerText;
        const oldFilterText = input.value;
        const iSep = oldFilterText.lastIndexOf(sep);
        const previousPath = oldFilterText.substring(0, iSep + 1);
        input.value = previousPath + selectedText;
    }
    
    /**
     * @param {DirectoryItem[]} directories
     * @param {string} sep
     * @param {string} [modelType = ""]
     */
    update(directories, sep, modelType = "") {
        const dropdown = this.element;
        const input = this.#input;
        const updateDropdown = this.#updateDropdown;
        const updateCallback = this.#updateCallback;
        const submitCallback = this.#submitCallback;
        const showDirectoriesOnly = this.showDirectoriesOnly;

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
                const child = items[i];
                const grandChildCount = child["childCount"];
                const isDir = grandChildCount !== undefined && grandChildCount !== null && grandChildCount > 0;
                const itemName = child["name"];
                if (itemName.startsWith(lastWord) && (!showDirectoriesOnly || (showDirectoriesOnly && isDir))) {
                    options.push(itemName + (isDir ? "/" : ""));
                }
            }
        }
        else if (!showDirectoriesOnly) {
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
            const selection = e.target;
            DirectoryDropdown.selectionToInput(input, selection, sep);
            updateDropdown();
            updateCallback();e.target
            submitCallback();
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
        // TODO: handle when dropdown is near the bottom of the window
        const inputRect = input.getBoundingClientRect();
        dropdown.style.minWidth = inputRect.width + "px";
        dropdown.style.top = (input.offsetTop + inputRect.height) + "px";
        dropdown.style.left = input.offsetLeft + "px";
        dropdown.style.display = "block";
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
            //.replace("*", " ") // TODO: this is wrong for wildcards
            .split(/(-?".*?"|[^\s"]+)+/g)
            .map((item) => item
                .trim()
                .replace(/(?:")+/g, "")
                .toLowerCase())
            .filter(Boolean);

        const regexSHA256 = /^[a-f0-9]{64}$/gi;
        const fields = ["name", "searchPath"]; // TODO: Remove "searchPath" hack.
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
     * In-place sort. Returns an arrat alias.
     * @param {Array} list
     * @param {string} sortBy
     * @param {bool} [reverse=false]
     * @returns {Array}
     */
    static #sort(list, sortBy, reverse = false) {
        let compareFn = undefined;
        switch (sortBy) {
            case MODEL_SORT_DATE_NAME:
                compareFn = (a, b) => { return a[MODEL_SORT_DATE_NAME].localeCompare(b[MODEL_SORT_DATE_NAME]); };
                break;
            case MODEL_SORT_DATE_MODIFIED:
                compareFn = (a, b) => { return b[MODEL_SORT_DATE_MODIFIED] - a[MODEL_SORT_DATE_MODIFIED]; };
                break;
            case MODEL_SORT_DATE_CREATED:
                compareFn = (a, b) => { return b[MODEL_SORT_DATE_CREATED] - a[MODEL_SORT_DATE_CREATED]; };
                break;
            default:
                console.warn("Invalid filter sort value: '" + sortBy + "'");
                return list;
        }
        const sorted = list.sort(compareFn);
        return reverse ? sorted.reverse() : sorted;
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
                const nodeType = modelNodeType[modelType];
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
     * @param {string} sortBy
     * @param {boolean} reverseSort
     * @param {Array} previousModelFilters
     * @param {HTMLInputElement} modelFilter
     */
    static update(modelGrid, models, modelSelect, previousModelType, settings, sortBy, reverseSort, previousModelFilters, modelFilter) {
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
        ModelGrid.#sort(modelList, sortBy, reverseSort);

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
        
        /** @type {HTMLDivElement} */ modelInfoUrl: null,
        /** @type {HTMLDivElement} */ modelInfos: null,

        /** @type {HTMLDivElement} */ modelGrid: null,
        /** @type {HTMLSelectElement} */ modelTypeSelect: null,
        /** @type {HTMLSelectElement} */ modelSortSelect: null,
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
                        //$tab("Download2", [this.#downloadTab_new()]),
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
            this.#modelTab_updatePreviousModelFilter,
            this.#modelTab_updateModelGrid,
            this.#sep,
            false,
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
                    $el("select.model-select-dropdown", {
                        $: (el) => (this.#el.modelTypeSelect = el),
                        name: "model-type",
                        onchange: () => this.#modelTab_updateModelGrid(),
                    }),
                    $el("select.model-select-dropdown",
                        {
                            $: (el) => (this.#el.modelSortSelect = el),
                            onchange: () => this.#modelTab_updateModelGrid(),
                        },
                        [
                            $el("option", { value: MODEL_SORT_DATE_CREATED }, ["Created (newest to oldest)"]),
                            $el("option", { value: "-" + MODEL_SORT_DATE_CREATED }, ["Created (oldest to newest)"]),
                            $el("option", { value: MODEL_SORT_DATE_MODIFIED }, ["Modified (newest to oldest)"]),
                            $el("option", { value: "-" + MODEL_SORT_DATE_MODIFIED }, ["Modified (oldest to newest)"]),
                            $el("option", { value: MODEL_SORT_DATE_NAME }, ["Name (A-Z)"]),
                            $el("option", { value: "-" + MODEL_SORT_DATE_NAME }, ["Name (Z-A)"]),
                        ],
                    ),
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

    #modelTab_updateModelGrid = () => {
        const sortValue = this.#el.modelSortSelect.value;
        const reverseSort = sortValue[0] === "-";
        const sortBy = reverseSort ? sortValue.substring(1) : sortValue;
        ModelGrid.update(
            this.#el.modelGrid,
            this.#data.models,
            this.#el.modelTypeSelect,
            this.#data.previousModelType,
            this.#el.settings,
            sortBy,
            reverseSort,
            this.#data.previousModelFilters,
            this.#el.modelContentFilter
        );
    }

    async #modelTab_updateModels() {
        this.#data.models = await request("/model-manager/models");
        const newModelDirectories = await request("/model-manager/model-directory-list");
        this.#data.modelDirectories.splice(0, Infinity, ...newModelDirectories); // note: do NOT create a new array
        this.#modelTab_updateModelGrid();
    }

    #modelTab_updatePreviousModelFilter = () => {
        const modelType = this.#el.modelTypeSelect.value;
        const value = this.#el.modelContentFilter.value;
        this.#data.previousModelFilters[modelType] = value;
    };

    #modelTab_updateDirectoryDropdown = () => {
        this.#modelContentFilterDirectoryDropdown.update(
            this.#data.modelDirectories,
            this.#sep,
            this.#el.modelTypeSelect.value,
        );
        this.#modelTab_updatePreviousModelFilter();
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
    
    /**
     * @param {HTMLDivElement} previewImageContainer
     * @param {Event} e 
     * @param {1 | -1} step 
     */
    static #downloadTab_updatePreview(previewImageContainer, step) {
        const children = previewImageContainer.children;
        if (children.length === 0) {
            return;
        }
        let currentIndex = -step;
        for (let i = 0; i < children.length; i++) {
            const previewImage = children[i];
            const display = previewImage.style.display;
            if (display !== "none") {
                currentIndex = i;
            }
            previewImage.style.display = "none";
        }
        currentIndex = currentIndex + step;
        if (currentIndex >= children.length) { currentIndex = 0; }
        else if (currentIndex < 0) { currentIndex = children.length - 1; }
        children[currentIndex].style.display = "block";
    }
    
    /**
     * @param {Object} info
     * @param {String[]} modelTypes
     * @param {DirectoryItem[]} modelDirectories
     * @param {String} sep
     * @returns {HTMLDivElement}
     */
    #downloadTab_modelInfo(info, modelTypes, modelDirectories, sep) {
        // TODO: use passed in info
        const RADIO_MODEL_PREVIEW_GROUP_NAME = "model-download-info-preview-model";
        const RADIO_MODEL_PREVIEW_DEFAULT = "Default Preview";
        const RADIO_MODEL_PREVIEW_CUSTOM = "Custom Preview Url";
        
        const els = {
            modelPreviewContainer: null,
            previewImgs: null,
            buttonLeft: null,
            buttonRight: null,
            
            customPreviewContainer: null,
            customPreviewUrl: null,
            
            modelTypeSelect: null,
            saveDirectoryPath: null,
            filename: null,
        };
        
        $el("input", {
            $: (el) => (els.saveDirectoryPath = el),
            type: "text",
            placeholder: "/0",
            value: "/0",
        });
        
        $el("select", {
            $: (el) => (els.modelTypeSelect = el),
        }, (() => {
            const options = [$el("option", { value: "" }, ["-- Model Type --"])];
            modelTypes.forEach((modelType) => {
                options.push($el("option", { value: modelType }, [modelType]));
            });
            return options;
        })());
        
        let searchDropdown = null;
        searchDropdown = new DirectoryDropdown(
            els.saveDirectoryPath,
            () => {
                const modelType = els.modelTypeSelect.value;
                if (modelType === "") { return; }
                searchDropdown.update(
                    modelDirectories,
                    sep,
                    modelType,
                );
            },
            () => {},
            () => {},
            sep,
            true,
        );
        
        const filepath = info["downloadFilePath"];
        const modelInfo = $el("details", [
            $el("summary", [filepath + info["fileName"]]),
            $el("div", [
                $el("div", [
                    $el("button", {
                        onclick: async (e) => {
                            const record = {};
                            record["download"] = info["downloadUrl"];
                            record["type"] = els.modelTypeSelect.value;
                            if (record["type"] === "") { return; } // TODO: notify user in app
                            record["path"] = els.saveDirectoryPath.value;
                            if (record["path"] === "/") { return; } // TODO: notify user in app
                            record["name"] = (() => {
                                const filename = info["fileName"];
                                const name = els.filename.value;
                                if (name === "") {
                                    return filename;
                                }
                                const ext = MODEL_EXTENSIONS.find((ext) => {
                                    return filename.endsWith(ext);
                                }) ?? "";
                                return name + ext;
                            })();
                            record["image"] = (() => {
                                const value = document.querySelector(`input[name="${RADIO_MODEL_PREVIEW_GROUP_NAME}"]:checked`).value;
                                switch (value) {
                                    case RADIO_MODEL_PREVIEW_DEFAULT:
                                        const children = els.previewImgs.children;
                                        for (let i = 0; i < children.length; i++) {
                                            const child = children[i];
                                            if (child.style.display !== "none") {
                                                return child.src;
                                            }
                                        }
                                        return "";
                                    case RADIO_MODEL_PREVIEW_CUSTOM:
                                        return els.customPreviewUrl.value;
                                }
                                return "";
                            })();
                            record["overwrite"] = true; // TODO: add to UI
                            e.disabled = true;
                            await request(
                                "/model-manager/download",
                                {
                                    method: "POST",
                                    body: JSON.stringify(record),
                                }
                            ).then(data => {
                                if (data["success"] !== true) {
                                    // TODO: notify user in app
                                    console.error('Failed to download model:', data);
                                }
                            }).catch(err => {
                                // TODO: notify user in app
                                console.error('Failed to download model:', err);
                            });
                            e.disabled = false;
                        },
                    }, ["Download"]),
                    els.modelTypeSelect,
                    $el("div", [
                        els.saveDirectoryPath,
                        searchDropdown.element,
                    ]),
                    $el("input", {
                        $: (el) => (els.filename = el),
                        type: "text",
                        placeholder: (() => {
                            const filename = info["fileName"];
                            // TODO: only remove valid model file extensions
                            const i = filename.lastIndexOf(".");
                            return i === - 1 ? filename : filename.substring(0, i);
                        })(),
                    }),
                ]),
                /*
                $el("div", (() => {
                    return Object.entries(info["details"]).filter(([, value]) => {
                        return value !== undefined && value !== null;
                    }).map(([key, value]) => {
                        const el = document.createElement("p");
                        el.innerText = key + ": " + value;
                        return el;
                    });
                })()),
                */
                $el("div.model-preview-select-radio-container", [
                    $radioGroup({
                        name: RADIO_MODEL_PREVIEW_GROUP_NAME,
                        onchange: (value) => {
                            switch (value) {
                                case RADIO_MODEL_PREVIEW_DEFAULT:
                                    const bottonStyleDisplay = els.previewImgs.children.length > 1 ? "block" : "none";
                                    els.buttonLeft.style.display = bottonStyleDisplay;
                                    els.buttonRight.style.display = bottonStyleDisplay;
                                    els.modelPreviewContainer.style.display = "block";
                                    els.customPreviewContainer.style.display = "none";
                                    break;
                                case RADIO_MODEL_PREVIEW_CUSTOM:
                                    els.modelPreviewContainer.style.display = "none";
                                    els.customPreviewContainer.style.display = "block";
                                    break;
                                default:
                                    els.modelPreviewContainer.style.display = "none";
                                    els.customPreviewContainer.style.display = "none";
                                    break;
                            }
                        },
                        options: (() => {
                            const radios = [];
                            radios.push({ value: "No Preview" });
                            if (info["images"].length > 0) {
                                radios.push({ value: RADIO_MODEL_PREVIEW_DEFAULT });
                            }
                            radios.push({ value: RADIO_MODEL_PREVIEW_CUSTOM });
                            return radios;
                        })(),
                    }),
                    $el("div", [
                        $el("div", {
                            $: (el) => (els.modelPreviewContainer = el),
                            style: { display: "none" },
                        }, [
                            $el("div", {
                                $: (el) => (els.previewImgs = el),
                            }, (() => {
                                const imgs = info["images"].map((url) => {
                                    return $el("img", {
                                        src: url,
                                        style: { display: "none" },
                                        loading: "lazy",
                                    });
                                });
                                if (imgs.length > 0) {
                                    imgs[0].style.display = "block";
                                }
                                return imgs;
                            })()),
                            $el("div", [
                                $el("button", {
                                    $: (el) => (els.buttonLeft = el),
                                    onclick: () => ModelManager.#downloadTab_updatePreview(els.previewImgs, -1),
                                }, ["LEFT"]),
                                $el("button", {
                                    $: (el) => (els.buttonRight = el),
                                    onclick: () => ModelManager.#downloadTab_updatePreview(els.previewImgs, 1),
                                }, ["RIGHT"]),
                            ]),
                        ]),
                        $el("div", {
                            $: (el) => (els.customPreviewContainer = el),
                            style: { display: "none" },
                        }, [
                            $el("input.search-text-area", {
                                $: (el) => (els.customPreviewUrl = el),
                                type: "text",
                                placeholder: "(preview image url)"
                            }),
                        ]),
                    ]),
                ]),
            ]),
        ]);
        
        const modelTypeSelect = els.modelTypeSelect;
        modelTypeSelect.selectedIndex = 0; // reset
        const comfyUIModelType = (
            civitai_comfyUiDirectory(info["details"]["fileType"]) ??
            civitai_comfyUiDirectory(info["modelType"]) ??
            null
        );
        if (comfyUIModelType !== undefined && comfyUIModelType !== null) {
            const modelTypeOptions = modelTypeSelect.children;
            for (let i = 0; i < modelTypeOptions.length; i++) {
                const option = modelTypeOptions[i];
                if (option.value === comfyUIModelType) {
                    modelTypeSelect.selectedIndex = i;
                    break;
                }
            }
        }
        
        return modelInfo;
    }
    
    async #downloadTab_search() {
        const infosHtml = this.#el.modelInfos;
        infosHtml.innerHTML = "";
        
        const urlText = this.#el.modelInfoUrl.value;
        const modelInfos = await (async () => {
            if (urlText.startsWith("https://civitai.com")) {
                const civitaiInfo = await civitai_getFilteredInfo(urlText);
                if (Object.keys(civitaiInfo).length === 0) {
                    return [];
                }
                const infos = [];
                const type = civitaiInfo["type"];
                civitaiInfo["versions"].forEach((version) => {
                    const images = version["images"];
                    version["files"].forEach((file) => {
                        infos.push({
                            "images": images,
                            "fileName": file["name"],
                            "modelType": type,
                            "downloadUrl": file["downloadUrl"],
                            "downloadFilePath": "",
                            "details": {
                                "fileSizeKB": file["sizeKB"],
                                "fileType": file["type"],
                                "fp": file["fp"],
                                "quant": file["size"],
                                "fileFormat": file["format"],
                            },
                        });
                    });
                });
                return infos;
            }
            if (urlText.startsWith("https://huggingface.co")) {
                const hfInfo = await huggingFace_getFilteredInfo(urlText);
                if (Object.keys(hfInfo).length === 0) {
                    return [];
                }
                const files = hfInfo["modelFiles"];
                if (files.length === 0) {
                    return [];
                }
                
                const baseDownloadUrl = hfInfo["baseDownloadUrl"];
                return hfInfo["modelFiles"].map((file) => {
                    const indexSep = file.lastIndexOf("/");
                    const filename = file.substring(indexSep + 1);
                    return {
                        "images": [], // TODO: ambiguous?
                        "fileName": filename,
                        "modelType": "",
                        "downloadUrl": baseDownloadUrl + "/" + file + "?download=true",
                        "downloadFilePath": file.substring(0, indexSep + 1),
                        "details": {
                            "fileSizeKB": undefined, // TODO: too hard?
                        },
                    };
                });
            }
            if (urlText.endsWith(".json")) {
                // TODO: support old index model files
                return [];
            }
            return [];
        })();
        
        const modelTypes = Object.keys(this.#data.models);
        const modelInfosHtml = modelInfos.filter((modelInfo) => {
            const filename = modelInfo["fileName"];
            return MODEL_EXTENSIONS.find((ext) => {
                return filename.endsWith(ext);
            }) ?? false;
        }).map((modelInfo) => {
            return this.#downloadTab_modelInfo(
                modelInfo,
                modelTypes,
                this.#data.modelDirectories,
                this.#sep,
            );
        });
        if (modelInfos.length === 0) {
            modelInfosHtml.push($el("div", ["No results found."]));
        }
        else if (modelInfos.length === 1) {
            modelInfosHtml[0].open = true;
        }
        infosHtml.append.apply(infosHtml, modelInfosHtml);
    }
    
    /**
     * @returns {HTMLElement}
     */
    #downloadTab_new() {
        return $el("div", [
            $el("div", [
                $el("input.search-text-area", {
                    $: (el) => (this.#el.modelInfoUrl = el),
                    type: "text",
                    placeholder: "Civitai or HuggingFace model",
                    onkeydown: (e) => {
                        if (e.key === "Enter") {
                            e.stopPropagation();
                            this.#downloadTab_search();
                        }
                    },
                }),
                $el("button", {
                    onclick: () => this.#downloadTab_search(),
                }, ["Search"]),
            ]),
            $el("div", {
                $: (el) => (this.#el.modelInfos = el),
            }),
        ]);
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
