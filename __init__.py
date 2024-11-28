import os
import folder_paths
from .py import config
from .py import utils

extension_uri = utils.normalize_path(os.path.dirname(__file__))

requirements_path = utils.join_path(extension_uri, "requirements.txt")

with open(requirements_path, "r", encoding="utf-8") as f:
    requirements = f.readlines()

requirements = [x.strip() for x in requirements]
requirements = [x for x in requirements if not x.startswith("#")]

uninstalled_package = [p for p in requirements if not utils.is_installed(p)]

if len(uninstalled_package) > 0:
    utils.print_info(f"Install dependencies...")
    for p in uninstalled_package:
        utils.pip_install(p)


# Init config settings
config.extension_uri = extension_uri
utils.resolve_model_base_paths()

version = utils.get_current_version()
utils.download_web_distribution(version)


from aiohttp import web
from .py import services


routes = config.routes


@routes.get("/model-manager/download/task")
async def scan_download_tasks(request):
    """
    Read download task list.
    """
    try:
        result = await services.scan_model_download_task_list()
        return web.json_response({"success": True, "data": result})
    except Exception as e:
        error_msg = f"Read download task list failed: {e}"
        utils.print_error(error_msg)
        return web.json_response({"success": False, "error": error_msg})


@routes.put("/model-manager/download/{task_id}")
async def resume_download_task(request):
    """
    Toggle download task status.
    """
    try:
        task_id = request.match_info.get("task_id", None)
        if task_id is None:
            raise web.HTTPBadRequest(reason="Invalid task id")
        json_data = await request.json()
        status = json_data.get("status", None)
        if status == "pause":
            await services.pause_model_download_task(task_id)
        elif status == "resume":
            await services.resume_model_download_task(task_id, request)
        else:
            raise web.HTTPBadRequest(reason="Invalid status")

        return web.json_response({"success": True})
    except Exception as e:
        error_msg = f"Resume download task failed: {str(e)}"
        utils.print_error(error_msg)
        return web.json_response({"success": False, "error": error_msg})


@routes.delete("/model-manager/download/{task_id}")
async def delete_model_download_task(request):
    """
    Delete download task.
    """
    task_id = request.match_info.get("task_id", None)
    try:
        await services.delete_model_download_task(task_id)
        return web.json_response({"success": True})
    except Exception as e:
        error_msg = f"Delete download task failed: {str(e)}"
        utils.print_error(error_msg)
        return web.json_response({"success": False, "error": error_msg})


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
    task_data = await request.json()
    try:
        task_id = await services.create_model_download_task(task_data, request)
        return web.json_response({"success": True, "data": {"taskId": task_id}})
    except Exception as e:
        error_msg = f"Create model download task failed: {str(e)}"
        utils.print_error(error_msg)
        return web.json_response({"success": False, "error": error_msg})


@routes.get("/model-manager/models")
async def read_models(request):
    """
    Scan all models and read their information.
    """
    try:
        result = services.scan_models(request)
        return web.json_response({"success": True, "data": result})
    except Exception as e:
        error_msg = f"Read models failed: {str(e)}"
        utils.print_error(error_msg)
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
        utils.print_error(error_msg)
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

    model_data: dict = await request.json()

    try:
        model_path = utils.get_valid_full_path(model_type, index, filename)
        if model_path is None:
            raise RuntimeError(f"File {filename} not found")
        services.update_model(model_path, model_data)
        return web.json_response({"success": True})
    except Exception as e:
        error_msg = f"Update model failed: {str(e)}"
        utils.print_error(error_msg)
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
        utils.print_error(error_msg)
        return web.json_response({"success": False, "error": error_msg})


@routes.get("/model-manager/model-info")
async def fetch_model_info(request):
    """
    Fetch model information from network with model page.
    """
    try:
        model_page = request.query.get("model-page", None)
        result = services.fetch_model_info(model_page)
        return web.json_response({"success": True, "data": result})
    except Exception as e:
        error_msg = f"Fetch model info failed: {str(e)}"
        utils.print_error(error_msg)
        return web.json_response({"success": False, "error": error_msg})


@routes.post("/model-manager/model-info/scan")
async def download_model_info(request):
    """
    Create a task to download model information.
    """
    post = await utils.get_request_body(request)
    try:
        scan_mode = post.get("scanMode", "diff")
        await services.download_model_info(scan_mode, request)
        return web.json_response({"success": True})
    except Exception as e:
        error_msg = f"Download model info failed: {str(e)}"
        utils.print_error(error_msg)
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


@routes.post("/model-manager/migrate")
async def migrate_legacy_information(request):
    """
    Migrate legacy information.
    """
    try:
        await services.migrate_legacy_information(request)
        return web.json_response({"success": True})
    except Exception as e:
        error_msg = f"Migrate model info failed: {str(e)}"
        utils.print_error(error_msg)
        return web.json_response({"success": False, "error": error_msg})


WEB_DIRECTORY = "web"
NODE_CLASS_MAPPINGS = {}
__all__ = ["WEB_DIRECTORY", "NODE_CLASS_MAPPINGS"]
