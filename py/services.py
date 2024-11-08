import os

import folder_paths

from multidict import MultiDictProxy
from . import config
from . import utils
from . import download


def scan_models():
    result = []
    model_base_paths = config.model_base_paths
    for model_type in model_base_paths:

        folders, extensions = folder_paths.folder_names_and_paths[model_type]
        for path_index, base_path in enumerate(folders):
            files = utils.recursive_search_files(base_path)

            models = folder_paths.filter_files_extensions(files, extensions)
            images = folder_paths.filter_files_content_types(files, ["image"])
            image_dict = utils.file_list_to_name_dict(images)

            for fullname in models:
                fullname = utils.normalize_path(fullname)
                basename = os.path.splitext(fullname)[0]
                extension = os.path.splitext(fullname)[1]

                abs_path = utils.join_path(base_path, fullname)
                file_stats = os.stat(abs_path)

                # Resolve preview
                image_name = image_dict.get(basename, "no-preview.png")
                abs_image_path = utils.join_path(base_path, image_name)
                if os.path.isfile(abs_image_path):
                    image_state = os.stat(abs_image_path)
                    image_timestamp = round(image_state.st_mtime_ns / 1000000)
                    image_name = f"{image_name}?ts={image_timestamp}"
                model_preview = (
                    f"/model-manager/preview/{model_type}/{path_index}/{image_name}"
                )

                model_info = {
                    "fullname": fullname,
                    "basename": basename,
                    "extension": extension,
                    "type": model_type,
                    "pathIndex": path_index,
                    "sizeBytes": file_stats.st_size,
                    "preview": model_preview,
                    "createdAt": round(file_stats.st_ctime_ns / 1000000),
                    "updatedAt": round(file_stats.st_mtime_ns / 1000000),
                }

                result.append(model_info)

    return result


def get_model_info(model_path: str):
    directory = os.path.dirname(model_path)

    metadata = utils.get_model_metadata(model_path)

    description_file = utils.get_model_description_name(model_path)
    description_file = utils.join_path(directory, description_file)
    description = None
    if os.path.isfile(description_file):
        with open(description_file, "r", encoding="utf-8", newline="") as f:
            description = f.read()

    return {
        "metadata": metadata,
        "description": description,
    }


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
        os.remove(utils.join_path(model_dirname, preview))

    model_descriptions = utils.get_model_all_descriptions(model_path)
    for description in model_descriptions:
        os.remove(utils.join_path(model_dirname, description))


async def create_model_download_task(post, request):
    dict_post = dict(post)
    return await download.create_model_download_task(dict_post, request)


async def scan_model_download_task_list():
    return await download.scan_model_download_task_list()


async def pause_model_download_task(task_id):
    return await download.pause_model_download_task(task_id)


async def resume_model_download_task(task_id, request):
    return await download.download_model(task_id, request)


async def delete_model_download_task(task_id):
    return await download.delete_model_download_task(task_id)
