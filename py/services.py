import os
import logging
import traceback
import folder_paths

from typing import Any
from multidict import MultiDictProxy
from . import utils
from . import socket
from . import download


async def connect_websocket(request):
    async def message_handler(event_type: str, detail: Any, sid: str):
        try:
            if event_type == "downloadTaskList":
                await download.scan_model_download_task_list(sid=sid)

            if event_type == "resumeDownloadTask":
                await download.download_model(task_id=detail)

            if event_type == "pauseDownloadTask":
                await download.pause_model_download_task(task_id=detail)

            if event_type == "deleteDownloadTask":
                await download.delete_model_download_task(task_id=detail)
        except Exception:
            logging.error(traceback.format_exc())

    ws = await socket.create_websocket_handler(request, handler=message_handler)
    return ws


def scan_models_by_model_type(model_type: str):
    """
    Scans all models in the given model type and returns a list of models.
    """
    out = []
    folders, extensions = folder_paths.folder_names_and_paths[model_type]
    for path_index, base_path in enumerate(folders):
        files = utils.recursive_search_files(base_path)

        models = folder_paths.filter_files_extensions(files, extensions)

        for fullname in models:
            """
            fullname is model path relative to base_path
            eg.
                abs_path  is /path/to/models/stable-diffusion/custom_group/model_name.ckpt
                base_path is /path/to/models/stable-diffusion
                fullname  is custom_group/model_name.ckpt
                basename  is custom_group/model_name
                extension is .ckpt
            """

            fullname = fullname.replace(os.path.sep, "/")
            basename = os.path.splitext(fullname)[0]
            extension = os.path.splitext(fullname)[1]
            prefix_path = fullname.replace(os.path.basename(fullname), "")

            abs_path = os.path.join(base_path, fullname)
            file_stats = os.stat(abs_path)

            # Resolve metadata
            metadata = utils.get_model_metadata(abs_path)

            # Resolve preview
            image_name = utils.get_model_preview_name(abs_path)
            image_name = os.path.join(prefix_path, image_name)
            abs_image_path = os.path.join(base_path, image_name)
            if os.path.isfile(abs_image_path):
                image_state = os.stat(abs_image_path)
                image_timestamp = round(image_state.st_mtime_ns / 1000000)
                image_name = f"{image_name}?ts={image_timestamp}"
            model_preview = (
                f"/model-manager/preview/{model_type}/{path_index}/{image_name}"
            )

            # Resolve description
            description_file = utils.get_model_description_name(abs_path)
            description_file = os.path.join(prefix_path, description_file)
            abs_desc_path = os.path.join(base_path, description_file)
            description = None
            if os.path.isfile(abs_desc_path):
                with open(abs_desc_path, "r", encoding="utf-8") as f:
                    description = f.read()

            out.append(
                {
                    "fullname": fullname,
                    "basename": basename,
                    "extension": extension,
                    "type": model_type,
                    "pathIndex": path_index,
                    "sizeBytes": file_stats.st_size,
                    "preview": model_preview,
                    "description": description,
                    "createdAt": round(file_stats.st_ctime_ns / 1000000),
                    "updatedAt": round(file_stats.st_mtime_ns / 1000000),
                    "metadata": metadata,
                }
            )

    return out


def update_model(model_path: str, post: MultiDictProxy):

    if "previewFile" in post:
        previewFile = post["previewFile"]
        utils.save_model_preview_image(model_path, previewFile)

    if "description" in post:
        description = post["description"]
        utils.save_model_description(model_path, description)

    if "type" in post and "pathIndex" in post and "fullname" in post:
        model_type = post.get("type", None)
        path_index = int(post.get("pathIndex", None))
        fullname = post.get("fullname", None)
        if model_type is None or path_index is None or fullname is None:
            raise RuntimeError("Invalid type or pathIndex or fullname")

        # get new path
        new_model_path = utils.get_full_path(model_type, path_index, fullname)

        utils.rename_model(model_path, new_model_path)


def remove_model(model_path: str):
    model_dirname = os.path.dirname(model_path)
    os.remove(model_path)

    model_previews = utils.get_model_all_images(model_path)
    for preview in model_previews:
        os.remove(os.path.join(model_dirname, preview))

    model_descriptions = utils.get_model_all_descriptions(model_path)
    for description in model_descriptions:
        os.remove(os.path.join(model_dirname, description))


async def create_model_download_task(post):
    dict_post = dict(post)
    return await download.create_model_download_task(dict_post)
