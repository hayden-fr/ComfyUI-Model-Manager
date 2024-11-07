import os
import folder_paths
from .py import config
from .py import utils


# Init config settings
config.extension_uri = utils.normalize_path(os.path.dirname(__file__))
utils.resolve_model_base_paths()

version = utils.get_current_version()
utils.download_web_distribution(version)


import logging
from aiohttp import web
import traceback
from .py import services


routes = config.routes


@routes.get("/model-manager/ws")
async def socket_handler(request):
    """
    Handle websocket connection.
    """
    ws = await services.connect_websocket(request)
    return ws


@routes.get("/model-manager/base-folders")
async def get_model_paths(request):
    """
    Returns the base folders for models.
    """
    model_base_paths = config.model_base_paths
    return web.json_response({"success": True, "data": model_base_paths})


@routes.post("/model-manager/model")
async def create_model(request):
    """
    Create a new model.

    request body: x-www-form-urlencoded
    - type: model type.
    - pathIndex: index of the model folders.
    - fullname: filename that relative to the model folder.
    - previewFile: preview file.
    - description: description.
    - downloadPlatform: download platform.
    - downloadUrl: download url.
    - hash: a JSON string containing the hash value of the downloaded model.
    """
    post = await request.post()
    try:
        task_id = await services.create_model_download_task(post)
        return web.json_response({"success": True, "data": {"taskId": task_id}})
    except Exception as e:
        error_msg = f"Create model download task failed: {str(e)}"
        logging.error(error_msg)
        logging.debug(traceback.format_exc())
        return web.json_response({"success": False, "error": error_msg})


@routes.get("/model-manager/models")
async def read_models(request):
    """
    Scan all models and read their information.
    """
    try:
        result = services.scan_models()
        return web.json_response({"success": True, "data": result})
    except Exception as e:
        error_msg = f"Read models failed: {str(e)}"
        logging.error(error_msg)
        logging.debug(traceback.format_exc())
        return web.json_response({"success": False, "error": error_msg})


@routes.get("/model-manager/model/{type}/{index}/{filename:.*}")
async def read_model_info(request):
    """
    Get the information of the specified model.
    """
    model_type = request.match_info.get("type", None)
    index = int(request.match_info.get("index", None))
    filename = request.match_info.get("filename", None)

    try:
        model_path = utils.get_valid_full_path(model_type, index, filename)
        result = services.get_model_info(model_path)
        return web.json_response({"success": True, "data": result})
    except Exception as e:
        error_msg = f"Read model info failed: {str(e)}"
        logging.error(error_msg)
        logging.debug(traceback.format_exc())
        return web.json_response({"success": False, "error": error_msg})


@routes.put("/model-manager/model/{type}/{index}/{filename:.*}")
async def update_model(request):
    """
    Update model information.

    request body: x-www-form-urlencoded
    - previewFile: preview file.
    - description: description.
    - type: model type.
    - pathIndex: index of the model folders.
    - fullname: filename that relative to the model folder.
    All fields are optional, but type, pathIndex and fullname must appear together.
    """
    model_type = request.match_info.get("type", None)
    index = int(request.match_info.get("index", None))
    filename = request.match_info.get("filename", None)

    post: dict = await request.post()

    try:
        model_path = utils.get_valid_full_path(model_type, index, filename)
        if model_path is None:
            raise RuntimeError(f"File {filename} not found")
        services.update_model(model_path, post)
        return web.json_response({"success": True})
    except Exception as e:
        error_msg = f"Update model failed: {str(e)}"
        logging.error(error_msg)
        logging.debug(traceback.format_exc())
        return web.json_response({"success": False, "error": error_msg})


@routes.delete("/model-manager/model/{type}/{index}/{filename:.*}")
async def delete_model(request):
    """
    Delete model.
    """
    model_type = request.match_info.get("type", None)
    index = int(request.match_info.get("index", None))
    filename = request.match_info.get("filename", None)

    try:
        model_path = utils.get_valid_full_path(model_type, index, filename)
        if model_path is None:
            raise RuntimeError(f"File {filename} not found")
        services.remove_model(model_path)
        return web.json_response({"success": True})
    except Exception as e:
        error_msg = f"Delete model failed: {str(e)}"
        logging.error(error_msg)
        logging.debug(traceback.format_exc())
        return web.json_response({"success": False, "error": error_msg})


@routes.get("/model-manager/preview/{type}/{index}/{filename:.*}")
async def read_model_preview(request):
    """
    Get the file stream of the specified image.
    If the file does not exist, no-preview.png is returned.

    :param type: The type of the model. eg.checkpoints, loras, vae, etc.
    :param index: The index of the model folders.
    :param filename: The filename of the image.
    """
    model_type = request.match_info.get("type", None)
    index = int(request.match_info.get("index", None))
    filename = request.match_info.get("filename", None)

    extension_uri = config.extension_uri

    try:
        folders = folder_paths.get_folder_paths(model_type)
        base_path = folders[index]
        abs_path = utils.join_path(base_path, filename)
    except:
        abs_path = extension_uri

    if not os.path.isfile(abs_path):
        abs_path = utils.join_path(extension_uri, "assets", "no-preview.png")
    return web.FileResponse(abs_path)


@routes.get("/model-manager/preview/download/{filename}")
async def read_download_preview(request):
    filename = request.match_info.get("filename", None)
    extension_uri = config.extension_uri

    download_path = utils.get_download_path()
    preview_path = utils.join_path(download_path, filename)

    if not os.path.isfile(preview_path):
        preview_path = utils.join_path(extension_uri, "assets", "no-preview.png")

    return web.FileResponse(preview_path)


WEB_DIRECTORY = "web"
NODE_CLASS_MAPPINGS = {}
__all__ = ["WEB_DIRECTORY", "NODE_CLASS_MAPPINGS"]
