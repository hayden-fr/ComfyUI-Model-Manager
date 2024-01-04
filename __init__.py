import os
import sys
import hashlib
from aiohttp import web
import server
import urllib.parse
import struct
import json
import requests
import folder_paths

requests.packages.urllib3.disable_warnings()

comfyui_model_uri = os.path.join(os.getcwd(), "models")
extension_uri = os.path.join(os.getcwd(), "custom_nodes" + os.path.sep + "ComfyUI-Model-Manager")
index_uri = os.path.join(extension_uri, "index.json")
#checksum_cache_uri = os.path.join(extension_uri, "checksum_cache.txt")
no_preview_image = os.path.join(extension_uri, "no-preview.png")

image_extensions = (".apng", ".gif", ".jpeg", ".jpg", ".png", ".webp")
#video_extensions = (".avi", ".mp4", ".webm") # TODO: Requires ffmpeg or cv2. Cache preview frame?

#hash_buffer_size = 4096


def folder_paths_get_folder_paths(folder_name): # API function crashes querying unknown model folder
    paths = folder_paths.folder_names_and_paths
    if folder_name in paths:
        return paths[folder_name][0][:]

    maybe_path = os.path.join(comfyui_model_uri, folder_name)
    if os.path.exists(maybe_path):
        return [maybe_path]
    return []


def folder_paths_get_supported_pt_extensions(folder_name): # Missing API function
    paths = folder_paths.folder_names_and_paths
    if folder_name in paths:
        return paths[folder_name][1]

    return set(['.ckpt', '.pt', '.bin', '.pth', '.safetensors'])


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


@server.PromptServer.instance.routes.get("/model-manager/image-preview")
async def img_preview(request):
    uri = request.query.get("uri")

    image_path = no_preview_image
    image_extension = "png"

    if (uri != "no-post"):
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

#def calculate_sha256(file_path):
#    try:
#        with open(file_path, "rb") as f:
#            sha256 = hashlib.sha256()
#            while True:
#                data = f.read(hash_buffer_size)
#                if not data:
#                    break
#                sha256.update(data)
#        return sha256.hexdigest()
#    except:
#        return ""

@server.PromptServer.instance.routes.get("/model-manager/source")
async def load_source_from(request):
    uri = request.query.get("uri", "local")
    if uri == "local":
        with open(index_uri) as file:
            dataSource = json.load(file)
    else:
        response = requests.get(uri)
        dataSource = response.json()

    model_types = os.listdir(comfyui_model_uri)
    model_types.remove("configs")
    sourceSorted = {}
    for model_type in model_types:
        sourceSorted[model_type] = []
    for item in dataSource:
        item_model_type = model_type_to_dir_name(item.get("type"))
        sourceSorted[item_model_type].append(item)
        item["installed"] = False

    #checksum_cache = []
    #if os.path.exists(checksum_cache_uri):
    #    with open(checksum_cache_uri, "r") as file:
    #        checksum_cache = file.read().splitlines()
    #else:
    #    with open(checksum_cache_uri, "w") as file:
    #        pass
    #print(checksum_cache)

    for model_type in model_types:
        for model_base_path in folder_paths_get_folder_paths(model_type):
            if not os.path.exists(model_base_path): # Bug in main code?
                continue
            for cwd, _subdirs, files in os.walk(model_base_path):
                for file in files:
                    source_type = sourceSorted[model_type]
                    for iItem in range(len(source_type)-1,-1,-1):
                        item = source_type[iItem]

                        # TODO: Make hashing optional (because it is slow to compute).
                        if file != item.get("name"):
                            continue

                        #file_path = os.path.join(cwd, file)
                        #file_size = int(item.get("size") or 0)
                        #if os.path.getsize(file_path) != file_size:
                        #    continue
                        #
                        #checksum = item.get("SHA256")
                        #if checksum == "" or checksum == None:
                        #    continue
                        # BUG: Model always hashed if same size but different hash.
                        # TODO: Change code to save list (NOT dict) with absolute model path and checksum on each line
                        #if checksum not in checksum_cache:
                        #    sha256 = calculate_sha256(file_path) # TODO: Make checksum optional!
                        #    checksum_cache.append(sha256)
                        #    print(f"{file}: calc:{sha256}, real:{checksum}")
                        #    if sha256 != checksum:
                        #        continue

                        item["installed"] = True
                        end_swap_and_pop(source_type, iItem)

    #with open(checksum_cache_uri, "w") as file:
    #    file.writelines(checksum + '\n' for checksum in checksum_cache) # because python is a mess

    return web.json_response(dataSource)


@server.PromptServer.instance.routes.get("/model-manager/models")
async def load_download_models(request):
    model_types = os.listdir(comfyui_model_uri)
    model_types.remove("configs")
    model_types.sort()

    models = {}
    for model_type in model_types:
        model_extensions = tuple(folder_paths_get_supported_pt_extensions(model_type))
        file_names = []
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
                    rel_path = "" if cwd == model_base_path else os.path.relpath(cwd, model_base_path)
                    file_names.append((model, image, base_path_index, rel_path))
        file_names.sort(key=lambda tup: tup[0].lower())

        model_items = []
        for model, image, base_path_index, rel_path in file_names:
            name, _ = os.path.splitext(model)
            item = {
                "name": name,
                "search-path": os.path.join(model_type, rel_path, model).replace(os.path.sep, "/"), # TODO: Remove hack
                "path": os.path.join(rel_path, model),
            }
            if image is not None:
                raw_post = os.path.join(model_type, str(base_path_index), rel_path, image)
                item["post"] = urllib.parse.quote_plus(raw_post)
            model_items.append(item)

        models[model_type] = model_items

    return web.json_response(models)


def_headers = {
    "User-Agent": "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
}


def download_model_file(url, filename):
    dl_filename = filename + ".download"

    rh = requests.get(
        url=url, stream=True, verify=False, headers=def_headers, proxies=None
    )
    print("temp file is " + dl_filename)
    total_size = int(rh.headers["Content-Length"])

    basename, ext = os.path.splitext(filename)
    print("Start download {}, file size: {}".format(basename, total_size))

    downloaded_size = 0
    if os.path.exists(dl_filename):
        downloaded_size = os.path.getsize(download_file)

    headers = {"Range": "bytes=%d-" % downloaded_size}
    headers["User-Agent"] = def_headers["User-Agent"]

    r = requests.get(url=url, stream=True, verify=False, headers=headers, proxies=None)

    with open(dl_filename, "ab") as f:
        for chunk in r.iter_content(chunk_size=1024):
            if chunk:
                downloaded_size += len(chunk)
                f.write(chunk)
                f.flush()

                progress = int(50 * downloaded_size / total_size)
                sys.stdout.reconfigure(encoding="utf-8")
                sys.stdout.write(
                    "\r[%s%s] %d%%"
                    % (
                        "-" * progress,
                        " " * (50 - progress),
                        100 * downloaded_size / total_size,
                    )
                )
                sys.stdout.flush()

    print()
    os.rename(dl_filename, filename)


@server.PromptServer.instance.routes.post("/model-manager/download")
async def download_file(request):
    body = await request.json()
    model_type = body.get("type")
    model_type_path = model_type_to_dir_name(model_type)
    if model_type_path is None:
        return web.json_response({"success": False})

    download_uri = body.get("download")
    if download_uri is None:
        return web.json_response({"success": False})

    model_name = body.get("name")
    file_name = os.path.join(comfyui_model_uri, model_type_path, model_name)
    download_model_file(download_uri, file_name)
    print("File download completed!")
    return web.json_response({"success": True})


WEB_DIRECTORY = "web"
NODE_CLASS_MAPPINGS = {}
__all__ = ["NODE_CLASS_MAPPINGS"]
