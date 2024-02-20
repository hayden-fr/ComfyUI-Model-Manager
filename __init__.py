import os
import pathlib
import shutil
from datetime import datetime
import sys
import copy
import importlib
import re

from aiohttp import web
import server
import urllib.parse
import urllib.request
import struct
import json
import requests
requests.packages.urllib3.disable_warnings()

import folder_paths

config_loader_path = os.path.join(os.path.dirname(__file__), 'config_loader.py')
config_loader_spec = importlib.util.spec_from_file_location('config_loader', config_loader_path)
config_loader = importlib.util.module_from_spec(config_loader_spec)
config_loader_spec.loader.exec_module(config_loader)

comfyui_model_uri = os.path.join(os.getcwd(), "models")
extension_uri = os.path.join(os.getcwd(), "custom_nodes" + os.path.sep + "ComfyUI-Model-Manager")
no_preview_image = os.path.join(extension_uri, "no-preview.png")
ui_settings_uri = os.path.join(extension_uri, "ui_settings.yaml")
server_settings_uri = os.path.join(extension_uri, "server_settings.yaml")

fallback_model_extensions = set([".bin", ".ckpt", ".onnx", ".pt", ".pth", ".safetensors"]) # TODO: magic values
image_extensions = (".apng", ".gif", ".jpeg", ".jpg", ".png", ".webp")
#video_extensions = (".avi", ".mp4", ".webm") # TODO: Requires ffmpeg or cv2. Cache preview frame?

_folder_names_and_paths = None # dict[str, tuple[list[str], list[str]]]
def folder_paths_folder_names_and_paths(refresh = False):
    global _folder_names_and_paths
    if refresh or _folder_names_and_paths is None:
        _folder_names_and_paths = {}
        for item_name in os.listdir(comfyui_model_uri):
            item_path = os.path.join(comfyui_model_uri, item_name)
            if not os.path.isdir(item_path):
                continue
            if item_name == "configs":
                continue
            if item_name in folder_paths.folder_names_and_paths:
                dir_paths, extensions = copy.deepcopy(folder_paths.folder_names_and_paths[item_name])
            else:
                dir_paths = [item_path]
                extensions = copy.deepcopy(fallback_model_extensions)
            _folder_names_and_paths[item_name] = (dir_paths, extensions)
    return _folder_names_and_paths

def folder_paths_get_folder_paths(folder_name, refresh = False): # API function crashes querying unknown model folder
    paths = folder_paths_folder_names_and_paths(refresh)
    if folder_name in paths:
        return paths[folder_name][0]

    maybe_path = os.path.join(comfyui_model_uri, folder_name)
    if os.path.exists(maybe_path):
        return [maybe_path]
    return []

def folder_paths_get_supported_pt_extensions(folder_name, refresh = False): # Missing API function
    paths = folder_paths_folder_names_and_paths(refresh)
    if folder_name in paths:
        return paths[folder_name][1]
    model_extensions = copy.deepcopy(fallback_model_extensions)
    return model_extensions


def search_path_to_system_path(model_path, model_path_type):
    # TODO: return model type (since it is bakedi into the search path anyways; simplifies other code)
    model_path = model_path.replace("/", os.path.sep)
    regex_result = re.search(r'\d+', model_path)
    if regex_result is None:
        return None
    try:
        model_path_index = int(regex_result.group())
    except:
        return None
    paths = folder_paths_get_folder_paths(model_path_type)
    if model_path_index < 0 or model_path_index >= len(paths):
        return None
    model_path_span = regex_result.span()
    return os.path.join(
        comfyui_model_uri, 
        (
            paths[model_path_index] + 
            model_path[model_path_span[1]:]
        )
    )


def get_safetensor_header(path):
    try:
        with open(path, "rb") as f:
            length_of_header = struct.unpack("<Q", f.read(8))[0]
            header_bytes = f.read(length_of_header)
            header_json = json.loads(header_bytes)
            return header_json
    except:
        return {}


def end_swap_and_pop(x, i):
    x[i], x[-1] = x[-1], x[i]
    return x.pop(-1)


def model_type_to_dir_name(model_type):
    if model_type == "checkpoint": return "checkpoints"
    #elif model_type == "clip": return "clip"
    #elif model_type == "clip_vision": return "clip_vision"
    #elif model_type == "controlnet": return "controlnet"
    elif model_type == "diffuser": return "diffusers"
    elif model_type == "embedding": return "embeddings"
    #elif model_type== "gligen": return "gligen"
    elif model_type == "hypernetwork": return "hypernetworks"
    elif model_type == "lora": return "loras"
    #elif model_type == "style_models": return "style_models"
    #elif model_type == "unet": return "unet"
    elif model_type == "upscale_model": return "upscale_models"
    #elif model_type == "vae": return "vae"
    #elif model_type == "vae_approx": return "vae_approx"
    else: return model_type


def ui_rules():
    Rule = config_loader.Rule
    return [
        Rule("sidebar-default-height", 0.5, float, 0.0, 1.0),
        Rule("sidebar-default-width", 0.5, float, 0.0, 1.0),
        Rule("model-search-always-append", "", str),
        Rule("model-persistent-search", True, bool),
        Rule("model-show-label-extensions", False, bool),
        Rule("model-show-add-button", True, bool),
        Rule("model-show-copy-button", True, bool),
        Rule("model-add-embedding-extension", False, bool),
        Rule("model-add-drag-strict-on-field", False, bool),
        Rule("model-add-offset", 25, int),
    ]


def server_rules():
    Rule = config_loader.Rule
    return [
        #Rule("model_extension_download_whitelist", [".safetensors"], list),
        Rule("civitai_api_key", "", str),
        Rule("huggingface_api_key", "", str),
    ]
server_settings = config_loader.yaml_load(server_settings_uri, server_rules())
config_loader.yaml_save(server_settings_uri, server_rules(), server_settings)

@server.PromptServer.instance.routes.get("/model-manager/settings/load")
async def load_ui_settings(request):
    rules = ui_rules()
    settings = config_loader.yaml_load(ui_settings_uri, rules)
    return web.json_response({ "settings": settings })


@server.PromptServer.instance.routes.post("/model-manager/settings/save")
async def save_ui_settings(request):
    body = await request.json()
    settings = body.get("settings")
    rules = ui_rules()
    validated_settings = config_loader.validated(rules, settings)
    success = config_loader.yaml_save(ui_settings_uri, rules, validated_settings)
    return web.json_response({
        "success": success,
        "settings": validated_settings if success else "",
    })


@server.PromptServer.instance.routes.get("/model-manager/preview/get")
async def get_model_preview(request):
    uri = request.query.get("uri")

    image_path = no_preview_image
    image_extension = "png"

    if uri != "no-post":
        rel_image_path = os.path.dirname(uri)

        i = uri.find(os.path.sep)
        model_type = uri[0:i]

        j = uri.find(os.path.sep, i + len(os.path.sep))
        if j == -1:
            j = len(rel_image_path)
        base_index = int(uri[i + len(os.path.sep):j])
        base_path = folder_paths_get_folder_paths(model_type)[base_index]

        abs_image_path = os.path.normpath(base_path + os.path.sep + uri[j:]) # do NOT use os.path.join
        if os.path.exists(abs_image_path):
            image_path = abs_image_path
            _, image_extension = os.path.splitext(uri)
            image_extension = image_extension[1:]

    with open(image_path, "rb") as img_file:
        image_data = img_file.read()

    return web.Response(body=image_data, content_type="image/" + image_extension)


@server.PromptServer.instance.routes.get("/model-manager/models/list")
async def load_download_models(request):
    model_types = os.listdir(comfyui_model_uri)
    model_types.remove("configs")
    model_types.sort()

    models = {}
    for model_type in model_types:
        model_extensions = tuple(folder_paths_get_supported_pt_extensions(model_type))
        file_infos = []
        for base_path_index, model_base_path in enumerate(folder_paths_get_folder_paths(model_type)):
            if not os.path.exists(model_base_path): # Bug in main code?
                continue
            for cwd, _subdirs, files in os.walk(model_base_path):
                dir_models = []
                dir_images = []

                for file in files:
                    if file.lower().endswith(model_extensions):
                        dir_models.append(file)
                    elif file.lower().endswith(image_extensions):
                        dir_images.append(file)

                for model in dir_models:
                    model_name, _ = os.path.splitext(model)
                    image = None
                    for iImage in range(len(dir_images)-1, -1, -1):
                        image_name, _ = os.path.splitext(dir_images[iImage])
                        if model_name == image_name:
                            image = end_swap_and_pop(dir_images, iImage)
                            break
                    abs_path = os.path.join(cwd, model)
                    stats = pathlib.Path(abs_path).stat()
                    date_modified = stats.st_mtime_ns
                    date_created = stats.st_ctime_ns
                    rel_path = "" if cwd == model_base_path else os.path.relpath(cwd, model_base_path)
                    info = (model, image, base_path_index, rel_path, date_modified, date_created)
                    file_infos.append(info)
        file_infos.sort(key=lambda tup: tup[4], reverse=True) # TODO: remove sort; sorted on client

        model_items = []
        for model, image, base_path_index, rel_path, date_modified, date_created in file_infos:
            item = {
                "name": model,
                "path": "/" + os.path.join(model_type, str(base_path_index), rel_path, model).replace(os.path.sep, "/"), # relative logical path
                #"systemPath": os.path.join(rel_path, model), # relative system path (less information than "search path")
                "dateModified": date_modified,
                "dateCreated": date_created,
                #"dateLastUsed": "", # TODO: track server-side, send increment client-side
                #"countUsed": 0, # TODO: track server-side, send increment client-side
            }
            if image is not None:
                raw_post = os.path.join(model_type, str(base_path_index), rel_path, image)
                item["post"] = urllib.parse.quote_plus(raw_post)
            model_items.append(item)

        models[model_type] = model_items

    return web.json_response(models)


def linear_directory_hierarchy(refresh = False):
    model_paths = folder_paths_folder_names_and_paths(refresh)
    dir_list = []
    dir_list.append({ "name": "", "childIndex": 1, "childCount": len(model_paths) })
    for model_dir_name, (model_dirs, _) in model_paths.items():
        dir_list.append({ "name": model_dir_name, "childIndex": None, "childCount": len(model_dirs) })
    for model_dir_index, (_, (model_dirs, extension_whitelist)) in enumerate(model_paths.items()):
        model_dir_child_index = len(dir_list)
        dir_list[model_dir_index + 1]["childIndex"] = model_dir_child_index
        for dir_path_index, dir_path in enumerate(model_dirs):
            dir_list.append({ "name": str(dir_path_index), "childIndex": None, "childCount": None })
        for dir_path_index, dir_path in enumerate(model_dirs):
            if not os.path.exists(dir_path) or os.path.isfile(dir_path):
                continue

            #dir_list.append({ "name": str(dir_path_index), "childIndex": None, "childCount": 0 })
            dir_stack = [(dir_path, model_dir_child_index + dir_path_index)]
            while len(dir_stack) > 0: # DEPTH-FIRST
                dir_path, dir_index = dir_stack.pop()
                
                dir_items = os.listdir(dir_path)
                dir_items = sorted(dir_items, key=str.casefold)
                
                dir_child_count = 0
                
                # TODO: sort content of directory: alphabetically
                # TODO: sort content of directory: files first
                
                subdirs = []
                for item_name in dir_items: # BREADTH-FIRST
                    item_path = os.path.join(dir_path, item_name)
                    if os.path.isdir(item_path):
                        # dir
                        subdir_index = len(dir_list) # this must be done BEFORE `dir_list.append`
                        subdirs.append((item_path, subdir_index))
                        dir_list.append({ "name": item_name, "childIndex": None, "childCount": 0 })
                        dir_child_count += 1
                    else:
                        # file
                        _, file_extension = os.path.splitext(item_name)
                        if extension_whitelist is None or file_extension in extension_whitelist:
                            dir_list.append({ "name": item_name })
                            dir_child_count += 1
                if dir_child_count > 0:
                    dir_list[dir_index]["childIndex"] = len(dir_list) - dir_child_count
                dir_list[dir_index]["childCount"] = dir_child_count
                subdirs.reverse()
                for dir_path, subdir_index in subdirs:
                    dir_stack.append((dir_path, subdir_index))
    return dir_list


@server.PromptServer.instance.routes.get("/model-manager/models/directory-list")
async def directory_list(request):
    #body = await request.json()
    dir_list = linear_directory_hierarchy(True)
    #json.dump(dir_list, sys.stdout, indent=4)
    return web.json_response(dir_list)


def download_file(url, filename, overwrite):
    if not overwrite and os.path.isfile(filename):
        raise Exception("File already exists!")

    filename_temp = filename + ".download"

    def_headers = {
        "User-Agent": "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    }
    if url.startswith("https://civitai.com/"):
        api_key = server_settings["civitai_api_key"]
        if (api_key != ""):
            def_headers["Authorization"] = f"Bearer {api_key}"
            url = url + f"?token={api_key}" # TODO: Authorization didn't work in the header
    elif url.startswith("https://huggingface.co/"):
        api_key = server_settings["huggingface_api_key"]
        if api_key != "":
            def_headers["Authorization"] = f"Bearer {api_key}"

    rh = requests.get(url=url, stream=True, verify=False, headers=def_headers, proxies=None, allow_redirects=False)
    if not rh.ok:
        raise Exception("Unable to download")

    downloaded_size = 0
    if rh.status_code == 200 and os.path.exists(filename_temp):
        downloaded_size = os.path.getsize(filename_temp)

    headers = {"Range": "bytes=%d-" % downloaded_size}
    headers["User-Agent"] = def_headers["User-Agent"]

    r = requests.get(url=url, stream=True, verify=False, headers=headers, proxies=None, allow_redirects=False)
    if rh.status_code == 307 and r.status_code == 307:
        # Civitai redirect
        redirect_url = r.content.decode("utf-8")
        if not redirect_url.startswith("http"):
            # Civitai requires login (NSFW or user-required)
            # TODO: inform user WHY download failed
            raise Exception("Unable to download!")
        download_file(redirect_url, filename, overwrite)
        return
    if rh.status_code == 302 and r.status_code == 302:
        # HuggingFace redirect
        redirect_url = r.content.decode("utf-8")
        redirect_url_index = redirect_url.find("http")
        if redirect_url_index == -1:
            raise Exception("Unable to download!")
        download_file(redirect_url[redirect_url_index:], filename, overwrite)
        return
    elif rh.status_code == 200 and r.status_code == 206:
        # Civitai download link
        pass

    total_size = int(rh.headers.get("Content-Length", 0)) # TODO: pass in total size earlier

    print("Download file: " + filename)
    if total_size != 0:
        print("Download file size: " + str(total_size))

    mode = "wb" if overwrite else "ab"
    with open(filename_temp, mode) as f:
        for chunk in r.iter_content(chunk_size=1024):
            if chunk is not None:
                downloaded_size += len(chunk)
                f.write(chunk)
                f.flush()

                if total_size != 0:
                    fraction = 1 if downloaded_size == total_size else downloaded_size / total_size
                    progress = int(50 * fraction)
                    sys.stdout.reconfigure(encoding="utf-8")
                    sys.stdout.write(
                        "\r[%s%s] %d%%"
                        % (
                            "-" * progress,
                            " " * (50 - progress),
                            100 * fraction,
                        )
                    )
                    sys.stdout.flush()

    print()
    if overwrite and os.path.isfile(filename):
        os.remove(filename)
    os.rename(filename_temp, filename)


@server.PromptServer.instance.routes.get("/model-manager/model/info")
async def get_model_info(request):
    model_path = request.query.get("path", None)
    if model_path is None:
        return web.json_response({})
    model_path = urllib.parse.unquote(model_path)

    model_type = request.query.get("type") # TODO: in the searchPath?
    if model_type is None:
        return web.json_response({})
    model_type = urllib.parse.unquote(model_type)

    model_path_type = model_type_to_dir_name(model_type)
    file = search_path_to_system_path(model_path, model_path_type)
    if file is None:
        return web.json_response({})

    info = {}
    path, name = os.path.split(model_path)
    info["File Name"] = name
    info["File Directory"] = path
    info["File Size"] = os.path.getsize(file)
    stats = pathlib.Path(file).stat()
    date_format = "%Y/%m/%d %H:%M:%S"
    info["Date Created"] = datetime.fromtimestamp(stats.st_ctime).strftime(date_format)
    info["Date Modified"] = datetime.fromtimestamp(stats.st_mtime).strftime(date_format)

    header = get_safetensor_header(file)
    metadata = header.get("__metadata__", None)
    if metadata is not None:
        info["Base Model"] = metadata.get("ss_sd_model_name", "")
        info["Clip Skip"] = metadata.get("ss_clip_skip", "")
        info["Hash"] = metadata.get("sshs_model_hash", "")
        info["Output Name"] = metadata.get("ss_output_name", "")

    file_name, _ = os.path.splitext(file)
    txt_file = file_name + ".txt"
    description = ""
    if os.path.isfile(txt_file):
        with open(txt_file, 'r', encoding="utf-8") as f:
            description = f.read()
    info["Description"] = description

    if metadata is not None:
        img_buckets = metadata.get("ss_bucket_info", "{}")
        if type(img_buckets) is str:
            img_buckets = json.loads(img_buckets)
        resolutions = {}
        if img_buckets is not None:
            buckets = img_buckets.get("buckets", {})
            for resolution in buckets.values():
                dim = resolution["resolution"]
                x, y = dim[0], dim[1]
                count = resolution["count"]
                resolutions[str(x) + "x" + str(y)] = count
        resolutions = list(resolutions.items())
        resolutions.sort(key=lambda x: x[1], reverse=True)
        info["Bucket Resolutions"] = resolutions

        dir_tags = metadata.get("ss_tag_frequency", "{}")
        if type(dir_tags) is str:
            dir_tags = json.loads(dir_tags)
        tags = {}
        for train_tags in dir_tags.values():
            for tag, count in train_tags.items():
                tags[tag] = tags.get(tag, 0) + count
        tags = list(tags.items())
        tags.sort(key=lambda x: x[1], reverse=True)
        info["Tags"] = tags

    return web.json_response(info)


@server.PromptServer.instance.routes.get("/model-manager/system-separator")
async def get_system_separator(request):
    return web.json_response(os.path.sep)


@server.PromptServer.instance.routes.post("/model-manager/model/download")
async def download_model(request):
    body = await request.json()
    result = {
        "success": False,
        "invalid": None,
    }
    
    overwrite = body.get("overwrite", False)
    
    model_type = body.get("type")
    model_path_type = model_type_to_dir_name(model_type)
    if model_path_type is None or model_path_type == "":
        result["invalid"] = "type"
        return web.json_response(result)
    model_path = body.get("path", "/0")
    directory = search_path_to_system_path(model_path, model_path_type)
    if directory is None:
        result["invalid"] = "path"
        return web.json_response(result)

    download_uri = body.get("download")
    if download_uri is None:
        result["invalid"] = "download"
        return web.json_response(result)

    name = body.get("name")
    model_extension = None
    for ext in folder_paths_get_supported_pt_extensions(model_type):
        if name.endswith(ext):
            model_extension = ext
            break
    if model_extension is None:
        result["invalid"] = "name"
        return web.json_response(result)
    file_name = os.path.join(directory, name)
    try:
        download_file(download_uri, file_name, overwrite)
    except:
        result["invalid"] = "download"
        return web.json_response(result)

    image_uri = body.get("image")
    if image_uri is not None and image_uri != "":
        image_extension = None # TODO: doesn't work for https://civitai.com/images/...
        for ext in image_extensions:
            if image_uri.endswith(ext):
                image_extension = ext
                break
        if image_extension is not None:
            file_path_without_extension = name[:len(name) - len(model_extension)]
            image_name = os.path.join(
                directory,
                file_path_without_extension + image_extension
            )
            try:
                download_file(image_uri, image_name, overwrite)
            except Exception as e:
                print(e, file=sys.stderr, flush=True)

    result["success"] = True
    return web.json_response(result)


@server.PromptServer.instance.routes.post("/model-manager/model/move")
async def move_model(request):
    body = await request.json()
    model_type = body.get("type", None)
    if model_type is None:
        return web.json_response({ "success": False })

    old_file = body.get("oldFile", None)
    if old_file is None:
        return web.json_response({ "success": False })
    old_file = search_path_to_system_path(old_file, model_type)
    if not os.path.isfile(old_file):
        return web.json_response({ "success": False })
    _, filename = os.path.split(old_file)

    new_path = body.get("newDirectory", None)
    if new_path is None:
        return web.json_response({ "success": False })
    new_path = search_path_to_system_path(new_path, model_type)
    if not os.path.isdir(new_path):
        return web.json_response({ "success": False })

    new_file = os.path.join(new_path, filename)
    try:
        shutil.move(old_file, new_file)
    except:
        return web.json_response({ "success": False })

    old_file_without_extension, _ = os.path.splitext(old_file)
    new_file_without_extension, _ = os.path.splitext(new_file)

    for extension in image_extensions + (".txt",):
        old_file = old_file_without_extension + extension
        if os.path.isfile(old_file):
            try:
                shutil.move(old_file, new_file_without_extension + extension)
            except Exception as e:
                print(e, file=sys.stderr, flush=True)

    return web.json_response({ "success": True })


@server.PromptServer.instance.routes.post("/model-manager/model/delete")
async def delete_model(request):
    result = { "success": False }

    model_path = request.query.get("path", None)
    if model_path is None:
        return web.json_response(result)
    model_path = urllib.parse.unquote(model_path)

    model_type = request.query.get("type") # TODO: in the searchPath?
    if model_type is None:
        return web.json_response(result)
    model_type = urllib.parse.unquote(model_type)

    model_path_type = model_type_to_dir_name(model_type)
    file = search_path_to_system_path(model_path, model_path_type)
    if file is None:
        return web.json_response(result)

    is_model = None
    for ext in folder_paths_get_supported_pt_extensions(model_type):
        if file.endswith(ext):
            is_model = True
            break
    if not is_model:
        return web.json_response(result)

    if os.path.isfile(file):
        os.remove(file)
        result["success"] = True

        path_and_name, _ = os.path.splitext(file)

        for img_ext in image_extensions:
            image_file = path_and_name + img_ext
            if os.path.isfile(image_file):
                os.remove(image_file)

        txt_file = path_and_name + ".txt"
        if os.path.isfile(txt_file):
            os.remove(txt_file)

    return web.json_response(result)


WEB_DIRECTORY = "web"
NODE_CLASS_MAPPINGS = {}
__all__ = ["NODE_CLASS_MAPPINGS"]
