import os

import folder_paths

from . import utils
from . import download
from . import information


def scan_models(folder: str, request):
    result = []

    folders, extensions = folder_paths.folder_names_and_paths[folder]
    for path_index, base_path in enumerate(folders):
        files = utils.recursive_search_files(base_path, request)

        models = folder_paths.filter_files_extensions(files, folder_paths.supported_pt_extensions)

        for fullname in models:
            fullname = utils.normalize_path(fullname)
            basename = os.path.splitext(fullname)[0]
            extension = os.path.splitext(fullname)[1]

            abs_path = utils.join_path(base_path, fullname)
            file_stats = os.stat(abs_path)

            # Resolve preview
            image_name = utils.get_model_preview_name(abs_path)
            image_name = utils.join_path(os.path.dirname(fullname), image_name)
            abs_image_path = utils.join_path(base_path, image_name)
            if os.path.isfile(abs_image_path):
                image_state = os.stat(abs_image_path)
                image_timestamp = round(image_state.st_mtime_ns / 1000000)
                image_name = f"{image_name}?ts={image_timestamp}"
            model_preview = f"/model-manager/preview/{folder}/{path_index}/{image_name}"

            model_info = {
                "fullname": fullname,
                "basename": basename,
                "extension": extension,
                "type": folder,
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


def update_model(model_path: str, model_data: dict):

    if "previewFile" in model_data:
        previewFile = model_data["previewFile"]
        if type(previewFile) is str and previewFile == "undefined":
            utils.remove_model_preview_image(model_path)
        else:
            utils.save_model_preview_image(model_path, previewFile)

    if "description" in model_data:
        description = model_data["description"]
        utils.save_model_description(model_path, description)

    if "type" in model_data and "pathIndex" in model_data and "fullname" in model_data:
        model_type = model_data.get("type", None)
        path_index = int(model_data.get("pathIndex", None))
        fullname = model_data.get("fullname", None)
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


async def create_model_download_task(task_data, request):
    return await download.create_model_download_task(task_data, request)


async def scan_model_download_task_list():
    return await download.scan_model_download_task_list()


async def pause_model_download_task(task_id):
    return await download.pause_model_download_task(task_id)


async def resume_model_download_task(task_id, request):
    return await download.download_model(task_id, request)


async def delete_model_download_task(task_id):
    return await download.delete_model_download_task(task_id)


def fetch_model_info(model_page: str):
    if not model_page:
        return []

    model_searcher = information.get_model_searcher_by_url(model_page)
    result = model_searcher.search_by_url(model_page)
    return result


async def download_model_info(scan_mode: str, request):
    utils.print_info(f"Download model info for {scan_mode}")
    model_base_paths = utils.resolve_model_base_paths()
    for model_type in model_base_paths:

        folders, extensions = folder_paths.folder_names_and_paths[model_type]
        for path_index, base_path in enumerate(folders):
            files = utils.recursive_search_files(base_path, request)

            models = folder_paths.filter_files_extensions(files, folder_paths.supported_pt_extensions)

            for fullname in models:
                fullname = utils.normalize_path(fullname)
                basename = os.path.splitext(fullname)[0]

                abs_model_path = utils.join_path(base_path, fullname)

                image_name = utils.get_model_preview_name(abs_model_path)
                abs_image_path = utils.join_path(base_path, image_name)

                has_preview = os.path.isfile(abs_image_path)

                description_name = utils.get_model_description_name(abs_model_path)
                abs_description_path = utils.join_path(base_path, description_name) if description_name else None
                has_description = os.path.isfile(abs_description_path) if abs_description_path else False

                try:

                    utils.print_info(f"Checking model {abs_model_path}")
                    utils.print_debug(f"Scan mode: {scan_mode}")
                    utils.print_debug(f"Has preview: {has_preview}")
                    utils.print_debug(f"Has description: {has_description}")

                    if scan_mode != "full" and (has_preview and has_description):
                        continue

                    utils.print_debug(f"Calculate sha256 for {abs_model_path}")
                    hash_value = utils.calculate_sha256(abs_model_path)
                    utils.print_info(f"Searching model info by hash {hash_value}")
                    model_info = information.CivitaiModelSearcher().search_by_hash(hash_value)

                    preview_url_list = model_info.get("preview", [])
                    preview_image_url = preview_url_list[0] if preview_url_list else None
                    if preview_image_url:
                        utils.print_debug(f"Save preview image to {abs_image_path}")
                        utils.save_model_preview_image(abs_model_path, preview_image_url)

                    description = model_info.get("description", None)
                    if description:
                        utils.save_model_description(abs_model_path, description)
                except Exception as e:
                    utils.print_error(f"Failed to download model info for {abs_model_path}: {e}")

    utils.print_debug("Completed scan model information.")
