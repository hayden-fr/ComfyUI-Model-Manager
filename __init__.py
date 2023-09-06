from aiohttp import web
import server
import os


model_uri = os.path.join(os.getcwd(), "models")
extension_uri = os.path.join(os.getcwd(), "custom_nodes/ComfyUI-Model-Manager")

model_type_dir_dict = {
    "checkpoint": "checkpoints",
    "clip": "clip",
    "clip_vision": "clip_vision",
    "controlnet": "controlnet",
    "diffuser": "diffusers",
    "embedding": "embeddings",
    "gligen": "gligen",
    "hypernetwork": "hypernetworks",
    "lora": "loras",
    "style_models": "style_models",
    "unet": "unet",
    "upscale_model": "upscale_models",
    "vae": "vae",
    "vae_approx": "vae_approx",
}


@server.PromptServer.instance.routes.get("/model-manager/imgPreview")
async def img_preview(request):
    uri = request.query.get("uri")
    filepath = os.path.join(model_uri, uri)

    if os.path.exists(filepath):
        with open(filepath, "rb") as img_file:
            image_data = img_file.read()
    else:
        with open(os.path.join(extension_uri, "no-preview.png"), "rb") as img_file:
            image_data = img_file.read()

    return web.Response(body=image_data, content_type="image/png")


import json


@server.PromptServer.instance.routes.get("/model-manager/source")
async def load_source_from(request):
    uri = request.query.get("uri", "local")
    if uri == "local":
        with open(os.path.join(extension_uri, "index.json")) as file:
            dataSource = json.load(file)
    else:
        response = requests.get(uri)
        dataSource = response.json()

    # check if it installed
    for item in dataSource:
        model_type = item.get("type")
        model_name = item.get("name")
        model_type_path = model_type_dir_dict.get(model_type)
        if model_type_path is None:
            continue
        if os.path.exists(os.path.join(model_uri, model_type_path, model_name)):
            item["installed"] = True

    return web.json_response(dataSource)


@server.PromptServer.instance.routes.get("/model-manager/models")
async def load_download_models(request):
    model_types = os.listdir(model_uri)
    model_types = sorted(model_types)
    model_types = [content for content in model_types if content != "configs"]

    model_suffix = (".safetensors", ".pt", ".pth", ".bin", ".ckpt")
    models = {}

    for model_type in model_types:
        model_type_uri = os.path.join(model_uri, model_type)
        filenames = os.listdir(model_type_uri)
        filenames = sorted(filenames)
        model_files = [f for f in filenames if f.endswith(model_suffix)]

        def name2item(name):
            item = {"name": name}
            file_name, ext = os.path.splitext(name)
            post_name = file_name + ".png"
            if post_name in filenames:
                post_path = os.path.join(model_type, post_name)
                item["post"] = post_path
            return item

        model_items = list(map(name2item, model_files))
        models[model_type] = model_items

    return web.json_response(models)


import sys
import requests


requests.packages.urllib3.disable_warnings()

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
    model_type_path = model_type_dir_dict.get(model_type)
    if model_type_path is None:
        return web.json_response({"success": False})

    download_uri = body.get("download")
    if download_uri is None:
        return web.json_response({"success": False})

    model_name = body.get("name")
    file_name = os.path.join(model_uri, model_type_path, model_name)
    download_model_file(download_uri, file_name)
    print("文件下载完成！")
    return web.json_response({"success": True})


WEB_DIRECTORY = "web"
NODE_CLASS_MAPPINGS = {}
__all__ = ["NODE_CLASS_MAPPINGS"]
