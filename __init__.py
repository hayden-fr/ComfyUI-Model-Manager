import os
import io
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
image_extensions = (".apng", ".gif", ".jpeg", ".jpg", ".png", ".webp")  # TODO: JavaScript does not know about this (x2 states)
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


def search_path_to_system_path(model_path):
    sep = os.path.sep
    model_path = os.path.normpath(model_path.replace("/", sep))

    isep0 = 0 if model_path[0] == sep else -1

    isep1 = model_path.find(sep, isep0 + 1)
    if isep1 == -1 or isep1 == len(model_path):
        return (None, None)

    isep2 = model_path.find(sep, isep1 + 1)
    if isep2 == -1 or isep2 - isep1 == 1:
        isep2 = len(model_path)

    model_path_type = model_path[isep0 + 1:isep1]
    paths = folder_paths_get_folder_paths(model_path_type)
    if len(paths) == 0:
        return (None, None)

    model_path_index = model_path[isep1 + 1:isep2]
    try:
        model_path_index = int(model_path_index)
    except:
        return (None, None)
    if model_path_index < 0 or model_path_index >= len(paths):
        return (None, None)

    system_path = os.path.normpath(
        paths[model_path_index] + 
        sep + 
        model_path[isep2:]
    )

    return (system_path, model_path_type)


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

    if uri != "no-preview":
        sep = os.path.sep
        uri = uri.replace("/" if sep == "\\" else "/", os.path.sep)
        image_path, _ = search_path_to_system_path(uri)
        if os.path.exists(image_path):
            _, image_extension = os.path.splitext(uri)
            image_extension = image_extension[1:]

    with open(image_path, "rb") as img_file:
        image_data = img_file.read()

    return web.Response(body=image_data, content_type="image/" + image_extension)


def download_model_preview(formdata):
    path = formdata.get("path", None)
    if type(path) is not str:
        raise ("Invalid path!")
    path, _ = search_path_to_system_path(path)
    path_without_extension, _ = os.path.splitext(path)

    overwrite = formdata.get("overwrite", "true").lower()
    overwrite = True if overwrite == "true" else False

    image = formdata.get("image", None)
    if type(image) is str:
        image_path = download_image(image, path, overwrite)
        _, image_extension = os.path.splitext(image_path)
    else:
        content_type = image.content_type
        if not content_type.startswith("image/"):
            raise ("Invalid content type!")
        image_extension = "." + content_type[len("image/"):]
        if image_extension not in image_extensions:
            raise ("Invalid extension!")

        image_path = path_without_extension + image_extension
        if not overwrite and os.path.isfile(image_path):
            raise ("Image already exists!")
        file: io.IOBase = image.file
        image_data = file.read()
        with open(image_path, "wb") as f:
            f.write(image_data)

    delete_same_name_files(path_without_extension, image_extensions, image_extension)


@server.PromptServer.instance.routes.post("/model-manager/preview/set")
async def set_model_preview(request):
    formdata = await request.post()
    try:
        download_model_preview(formdata)
        return web.json_response({ "success": True })
    except ValueError as e:
        print(e, file=sys.stderr, flush=True)
        return web.json_response({ "success": False })


@server.PromptServer.instance.routes.post("/model-manager/preview/delete")
async def delete_model_preview(request):
    model_path = request.query.get("path", None)
    if model_path is None:
        return web.json_response({ "success": False })
    model_path = urllib.parse.unquote(model_path)

    file, _ = search_path_to_system_path(model_path)
    path_and_name, _ = os.path.splitext(file)
    delete_same_name_files(path_and_name, image_extensions)
    
    return web.json_response({ "success": True })


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
                    image_modified = None
                    for iImage in range(len(dir_images)-1, -1, -1):
                        image_name, _ = os.path.splitext(dir_images[iImage])
                        if model_name == image_name:
                            image = end_swap_and_pop(dir_images, iImage)
                            img_abs_path = os.path.join(cwd, image)
                            image_modified = pathlib.Path(img_abs_path).stat().st_mtime_ns
                            break
                    abs_path = os.path.join(cwd, model)
                    stats = pathlib.Path(abs_path).stat()
                    model_modified = stats.st_mtime_ns
                    model_created = stats.st_ctime_ns
                    rel_path = "" if cwd == model_base_path else os.path.relpath(cwd, model_base_path)
                    info = (model, image, base_path_index, rel_path, model_modified, model_created, image_modified)
                    file_infos.append(info)
        file_infos.sort(key=lambda tup: tup[4], reverse=True) # TODO: remove sort; sorted on client

        model_items = []
        for model, image, base_path_index, rel_path, model_modified, model_created, image_modified in file_infos:
            item = {
                "name": model,
                "path": "/" + os.path.join(model_type, str(base_path_index), rel_path, model).replace(os.path.sep, "/"), # relative logical path
                #"systemPath": os.path.join(rel_path, model), # relative system path (less information than "search path")
                "dateModified": model_modified,
                "dateCreated": model_created,
                #"dateLastUsed": "", # TODO: track server-side, send increment client-side
                #"countUsed": 0, # TODO: track server-side, send increment client-side
            }
            if image is not None:
                raw_post = os.path.join(model_type, str(base_path_index), rel_path, image)
                item["preview"] = {
                    "path": urllib.parse.quote_plus(raw_post),
                    "dateModified": urllib.parse.quote_plus(str(image_modified)),
                }
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
        raise ValueError("File already exists!")

    filename_temp = filename + ".download"

    def_headers = {
        "User-Agent": "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    }

    if url.startswith("https://civitai.com/"):
        api_key = server_settings["civitai_api_key"]
        if (api_key != ""):
            def_headers["Authorization"] = f"Bearer {api_key}"
            url += "&" if "?" in url else "?" # not the most robust solution
            url += f"token={api_key}" # TODO: Authorization didn't work in the header
    elif url.startswith("https://huggingface.co/"):
        api_key = server_settings["huggingface_api_key"]
        if api_key != "":
            def_headers["Authorization"] = f"Bearer {api_key}"
    rh = requests.get(url=url, stream=True, verify=False, headers=def_headers, proxies=None, allow_redirects=False)
    if not rh.ok:
        raise ValueError(
            "Unable to download! Request header status code: " + 
            str(rh.status_code)
        )

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
            raise ValueError("Unable to download from Civitai! Redirect url: " + str(redirect_url))
        download_file(redirect_url, filename, overwrite)
        return
    if rh.status_code == 302 and r.status_code == 302:
        # HuggingFace redirect
        redirect_url = r.content.decode("utf-8")
        redirect_url_index = redirect_url.find("http")
        if redirect_url_index == -1:
            raise ValueError("Unable to download from HuggingFace! Redirect url: " + str(redirect_url))
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


def download_image(image_uri, model_path, overwrite):
    _, extension = os.path.splitext(image_uri) # TODO: doesn't work for https://civitai.com/images/...
    if not extension in image_extensions:
        raise ValueError("Invalid image type!")
    path_without_extension, _ = os.path.splitext(model_path)
    file = path_without_extension + extension
    download_file(image_uri, file, overwrite)
    return file


@server.PromptServer.instance.routes.get("/model-manager/model/info")
async def get_model_info(request):
    model_path = request.query.get("path", None)
    if model_path is None:
        return web.json_response({ "success": False })
    model_path = urllib.parse.unquote(model_path)

    file, _ = search_path_to_system_path(model_path)
    if file is None:
        return web.json_response({})

    info = {}
    path, name = os.path.split(model_path)
    info["File Name"] = name
    info["File Directory"] = path
    info["File Size"] = str(os.path.getsize(file)) + " bytes"
    stats = pathlib.Path(file).stat()
    date_format = "%Y/%m/%d %H:%M:%S"
    info["Date Created"] = datetime.fromtimestamp(stats.st_ctime).strftime(date_format)
    info["Date Modified"] = datetime.fromtimestamp(stats.st_mtime).strftime(date_format)

    file_name, _ = os.path.splitext(file)

    for extension in image_extensions:
        maybe_image = file_name + extension
        if os.path.isfile(maybe_image):
            image_path, _ = os.path.splitext(model_path)
            image_modified = pathlib.Path(maybe_image).stat().st_mtime_ns
            info["Preview"] = {
                "path": urllib.parse.quote_plus(image_path + extension),
                "dateModified": urllib.parse.quote_plus(str(image_modified)),
            }
            break

    header = get_safetensor_header(file)
    metadata = header.get("__metadata__", None)
    if metadata is not None:
        info["Base Model"] = metadata.get("ss_sd_model_name", "")
        info["Clip Skip"] = metadata.get("ss_clip_skip", "")
        info["Hash"] = metadata.get("sshs_model_hash", "")
        info["Output Name"] = metadata.get("ss_output_name", "")

    txt_file = file_name + ".txt"
    notes = ""
    if os.path.isfile(txt_file):
        with open(txt_file, 'r', encoding="utf-8") as f:
            notes = f.read()
    info["Notes"] = notes

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
    formdata = await request.post()
    result = {
        "success": False,
        "invalid": None,
    }

    overwrite = formdata.get("overwrite", "false").lower()
    overwrite = True if overwrite == "true" else False

    model_path = formdata.get("path", "/0")
    directory, model_type = search_path_to_system_path(model_path)
    if directory is None:
        result["invalid"] = "path"
        return web.json_response(result)

    download_uri = formdata.get("download")
    if download_uri is None:
        result["invalid"] = "download"
        return web.json_response(result)

    name = formdata.get("name")
    _, model_extension = os.path.splitext(name)
    if not model_extension in folder_paths_get_supported_pt_extensions(model_type):
        result["invalid"] = "name"
        return web.json_response(result)
    file_name = os.path.join(directory, name)
    try:
        download_file(download_uri, file_name, overwrite)
    except Exception as e:
        print(e, file=sys.stderr, flush=True)
        result["invalid"] = "model"
        return web.json_response(result)

    image = formdata.get("image")
    if image is not None and image != "":
        try:
            download_model_preview({
                "path": model_path + os.sep + name,
                "image": image,
                "overwrite": formdata.get("overwrite"),
            })
        except Exception as e:
            print(e, file=sys.stderr, flush=True)
            result["invalid"] = "preview"

    result["success"] = True
    return web.json_response(result)


@server.PromptServer.instance.routes.post("/model-manager/model/move")
async def move_model(request):
    body = await request.json()

    old_file = body.get("oldFile", None)
    if old_file is None:
        return web.json_response({ "success": False })
    old_file, old_model_type = search_path_to_system_path(old_file)
    if not os.path.isfile(old_file):
        return web.json_response({ "success": False })
    _, model_extension = os.path.splitext(old_file)
    if not model_extension in folder_paths_get_supported_pt_extensions(old_model_type):
        # cannot move arbitrary files
        return web.json_response({ "success": False })

    new_file = body.get("newFile", None)
    if new_file is None or new_file == "":
        # cannot have empty name
        return web.json_response({ "success": False })
    new_file, new_model_type = search_path_to_system_path(new_file)
    if not new_file.endswith(model_extension):
        return web.json_response({ "success": False })
    if os.path.isfile(new_file):
        # cannot overwrite existing file
        return web.json_response({ "success": False })
    if not model_extension in folder_paths_get_supported_pt_extensions(new_model_type):
        return web.json_response({ "success": False })
    new_file_dir, _ = os.path.split(new_file)
    if not os.path.isdir(new_file_dir):
        return web.json_response({ "success": False })

    if old_file == new_file:
        return web.json_response({ "success": False })
    try:
        shutil.move(old_file, new_file)
    except ValueError as e:
        print(e, file=sys.stderr, flush=True)
        return web.json_response({ "success": False })

    old_file_without_extension, _ = os.path.splitext(old_file)
    new_file_without_extension, _ = os.path.splitext(new_file)

    # TODO: this could overwrite existing files...
    for extension in image_extensions + (".txt",):
        old_file = old_file_without_extension + extension
        if os.path.isfile(old_file):
            try:
                shutil.move(old_file, new_file_without_extension + extension)
            except ValueError as e:
                print(e, file=sys.stderr, flush=True)

    return web.json_response({ "success": True })


def delete_same_name_files(path_without_extension, extensions, keep_extension=None):
    for extension in extensions:
        if extension == keep_extension: continue
        image_file = path_without_extension + extension
        if os.path.isfile(image_file):
            os.remove(image_file)


@server.PromptServer.instance.routes.post("/model-manager/model/delete")
async def delete_model(request):
    result = { "success": False }

    model_path = request.query.get("path", None)
    if model_path is None:
        return web.json_response(result)
    model_path = urllib.parse.unquote(model_path)

    file, model_type = search_path_to_system_path(model_path)
    if file is None:
        return web.json_response(result)

    _, extension = os.path.splitext(file)
    if not extension in folder_paths_get_supported_pt_extensions(model_type):
        # cannot delete arbitrary files
        return web.json_response(result)

    if os.path.isfile(file):
        os.remove(file)
        result["success"] = True

        path_and_name, _ = os.path.splitext(file)

        delete_same_name_files(path_and_name, image_extensions)

        txt_file = path_and_name + ".txt"
        if os.path.isfile(txt_file):
            os.remove(txt_file)

    return web.json_response(result)


@server.PromptServer.instance.routes.post("/model-manager/notes/save")
async def set_notes(request):
    body = await request.json()

    text = body.get("notes", None)
    if type(text) is not str:
        return web.json_response({ "success": False })

    model_path = body.get("path", None)
    if type(model_path) is not str:
        return web.json_response({ "success": False })
    model_path, _ = search_path_to_system_path(model_path)
    file_path_without_extension, _ = os.path.splitext(model_path)
    filename = os.path.normpath(file_path_without_extension + ".txt")
    if text.isspace() or text == "":
        if os.path.exists(filename):
            os.remove(filename)
    else:
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write(text)
        except ValueError as e:
            print(e, file=sys.stderr, flush=True)
            web.json_response({ "success": False })

    return web.json_response({ "success": True })


WEB_DIRECTORY = "web"
NODE_CLASS_MAPPINGS = {}
__all__ = ["NODE_CLASS_MAPPINGS"]
