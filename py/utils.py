import os
import json
import yaml
import shutil
import tarfile
import logging
import requests
import traceback
import configparser
import functools
import mimetypes

import comfy.utils
import folder_paths

from aiohttp import web
from typing import Any, Optional
from . import config


def print_info(msg, *args, **kwargs):
    logging.info(f"[{config.extension_tag}] {msg}", *args, **kwargs)


def print_warning(msg, *args, **kwargs):
    logging.warning(f"[{config.extension_tag}][WARNING] {msg}", *args, **kwargs)


def print_error(msg, *args, **kwargs):
    logging.error(f"[{config.extension_tag}] {msg}", *args, **kwargs)
    logging.debug(traceback.format_exc())


def print_debug(msg, *args, **kwargs):
    logging.debug(f"[{config.extension_tag}] {msg}", *args, **kwargs)


def deprecated(reason: str):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            print_warning(f"{func.__name__} is deprecated: {reason}")
            return func(*args, **kwargs)

        return wrapper

    return decorator


def _matches(predicate: dict):
    def _filter(obj: dict):
        return all(obj.get(key, None) == value for key, value in predicate.items())

    return _filter


def filter_with(list: list, predicate):
    if isinstance(predicate, dict):
        predicate = _matches(predicate)

    return [item for item in list if predicate(item)]


async def get_request_body(request) -> dict:
    try:
        return await request.json()
    except:
        return {}


def normalize_path(path: str):
    normpath = os.path.normpath(path)
    return normpath.replace(os.path.sep, "/")


def join_path(path: str, *paths: list[str]):
    return normalize_path(os.path.join(path, *paths))


def get_current_version():
    try:
        pyproject_path = join_path(config.extension_uri, "pyproject.toml")
        config_parser = configparser.ConfigParser()
        config_parser.read(pyproject_path)
        version = config_parser.get("project", "version")
        return version.strip("'\"")
    except:
        return "0.0.0"


def download_web_distribution(version: str):
    web_path = join_path(config.extension_uri, "web")
    dev_web_file = join_path(web_path, "manager-dev.js")
    if os.path.exists(dev_web_file):
        return

    web_version = "0.0.0"
    version_file = join_path(web_path, "version.yaml")
    if os.path.exists(version_file):
        with open(version_file, "r", encoding="utf-8", newline="") as f:
            version_content = yaml.safe_load(f)
            web_version = version_content.get("version", web_version)

    if version == web_version:
        return

    try:
        print_info(f"current version {version}, web version {web_version}")
        print_info("Downloading web distribution...")
        download_url = f"https://github.com/hayden-fr/ComfyUI-Model-Manager/releases/download/v{version}/dist.tar.gz"
        response = requests.get(download_url, stream=True)
        response.raise_for_status()

        temp_file = join_path(config.extension_uri, "temp.tar.gz")
        with open(temp_file, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        if os.path.exists(web_path):
            shutil.rmtree(web_path)

        print_info("Extracting web distribution...")
        with tarfile.open(temp_file, "r:gz") as tar:
            members = [member for member in tar.getmembers() if member.name.startswith("web/")]
            tar.extractall(path=config.extension_uri, members=members)

        os.remove(temp_file)
        print_info("Web distribution downloaded successfully.")
    except requests.exceptions.RequestException as e:
        print_error(f"Failed to download web distribution: {e}")
    except tarfile.TarError as e:
        print_error(f"Failed to extract web distribution: {e}")
    except Exception as e:
        print_error(f"An unexpected error occurred: {e}")


def resolve_model_base_paths() -> dict[str, list[str]]:
    """
    Resolve model base paths.
    eg. { "checkpoints": ["path/to/checkpoints"] }
    """
    folders = list(folder_paths.folder_names_and_paths.keys())
    model_base_paths = {}
    folder_black_list = ["configs", "custom_nodes"]
    for folder in folders:
        if folder in folder_black_list:
            continue
        folders = folder_paths.get_folder_paths(folder)
        model_base_paths[folder] = [normalize_path(f) for f in folders]
    return model_base_paths


def resolve_file_content_type(filename: str):
    extension_mimetypes_cache = folder_paths.extension_mimetypes_cache
    extension = filename.split(".")[-1]
    if extension not in extension_mimetypes_cache:
        mime_type, _ = mimetypes.guess_type(filename, strict=False)
        if not mime_type:
            return None
        content_type = mime_type.split("/")[0]
        extension_mimetypes_cache[extension] = content_type
    else:
        content_type = extension_mimetypes_cache[extension]
    return content_type


def get_full_path(model_type: str, path_index: int, filename: str):
    """
    Get the absolute path in the model type through string concatenation.
    """
    folders = resolve_model_base_paths().get(model_type, [])
    if not path_index < len(folders):
        raise RuntimeError(f"PathIndex {path_index} is not in {model_type}")
    base_path = folders[path_index]
    full_path = join_path(base_path, filename)
    return full_path


def get_valid_full_path(model_type: str, path_index: int, filename: str):
    """
    Like get_full_path but it will check whether the file is valid.
    """
    folders = resolve_model_base_paths().get(model_type, [])
    if not path_index < len(folders):
        raise RuntimeError(f"PathIndex {path_index} is not in {model_type}")
    base_path = folders[path_index]
    full_path = join_path(base_path, filename)
    if os.path.isfile(full_path):
        return full_path
    elif os.path.islink(full_path):
        raise RuntimeError(f"WARNING path {full_path} exists but doesn't link anywhere, skipping.")


def get_download_path():
    download_path = join_path(config.extension_uri, "downloads")
    if not os.path.exists(download_path):
        os.makedirs(download_path)
    return download_path


def recursive_search_files(directory: str, request):
    if not os.path.isdir(directory):
        return []

    excluded_dir_names = [".git"]
    result = []
    include_hidden_files = get_setting_value(request, "scan.include_hidden_files", False)

    for dirpath, subdirs, filenames in os.walk(directory, followlinks=True, topdown=True):
        subdirs[:] = [d for d in subdirs if d not in excluded_dir_names]
        if not include_hidden_files:
            subdirs[:] = [d for d in subdirs if not d.startswith(".")]
            filenames[:] = [f for f in filenames if not f.startswith(".")]

        for file_name in filenames:
            try:
                relative_path = os.path.relpath(os.path.join(dirpath, file_name), directory)
                result.append(relative_path)
            except:
                logging.warning(f"Warning: Unable to access {file_name}. Skipping this file.")
                continue

    return [normalize_path(f) for f in result]


def search_files(directory: str):
    entries = os.listdir(directory)
    files = [f for f in entries if os.path.isfile(join_path(directory, f))]
    return files


def file_list_to_name_dict(files: list[str]):
    file_dict: dict[str, str] = {}
    for file in files:
        filename = os.path.splitext(file)[0]
        file_dict[filename] = file
    return file_dict


def get_model_metadata(filename: str):
    if not filename.endswith(".safetensors"):
        return {}
    try:
        out = comfy.utils.safetensors_header(filename, max_size=1024 * 1024)
        if out is None:
            return {}
        dt = json.loads(out)
        if not "__metadata__" in dt:
            return {}
        return dt["__metadata__"]
    except:
        return {}


def get_model_all_images(model_path: str):
    base_dirname = os.path.dirname(model_path)
    files = search_files(base_dirname)
    files = folder_paths.filter_files_content_types(files, ["image"])

    basename = os.path.splitext(os.path.basename(model_path))[0]
    output: list[str] = []
    for file in files:
        file_basename = os.path.splitext(file)[0]
        if file_basename == basename:
            output.append(file)
        if file_basename == f"{basename}.preview":
            output.append(file)
    return output


def get_model_preview_name(model_path: str):
    images = get_model_all_images(model_path)
    basename = os.path.splitext(os.path.basename(model_path))[0]

    for image in images:
        image_name = os.path.splitext(image)[0]
        image_ext = os.path.splitext(image)[1]
        if image_name == basename and image_ext.lower() == ".webp":
            return image

    return images[0] if len(images) > 0 else "no-preview.png"


def get_model_all_videos(model_path: str):
    base_dirname = os.path.dirname(model_path)
    files = search_files(base_dirname)
    files = folder_paths.filter_files_content_types(files, ["video"])

    basename = os.path.splitext(os.path.basename(model_path))[0]
    output: list[str] = []
    for file in files:
        file_basename = os.path.splitext(file)[0]
        if file_basename == basename:
            output.append(file)
        if file_basename == f"{basename}.preview":
            output.append(file)
    return output


from PIL import Image
from io import BytesIO


def remove_model_preview_image(model_path: str):
    basename = os.path.splitext(model_path)[0]
    preview_path = f"{basename}.webp"
    if os.path.exists(preview_path):
        os.remove(preview_path)


def save_model_preview_image(model_path: str, image_file_or_url: Any, platform: Optional[str] = None):
    basename = os.path.splitext(model_path)[0]
    preview_path = f"{basename}.webp"
    # Download image file if it is url
    if type(image_file_or_url) is str:
        image_url = image_file_or_url

        try:
            image_response = requests.get(image_url)
            image_response.raise_for_status()

            image = Image.open(BytesIO(image_response.content))
            image.save(preview_path, "WEBP")

        except Exception as e:
            print_error(f"Failed to download image: {e}")

    else:
        # Assert image as file
        image_file = image_file_or_url

        if not isinstance(image_file, web.FileField):
            raise RuntimeError("Invalid image file")

        content_type: str = image_file.content_type
        if not content_type.startswith("image/"):
            if platform == "huggingface":
                # huggingface previewFile content_type='text/plain',  not startswith("image/")
                return
            else:
                raise RuntimeError(f"FileTypeError: expected image, got {content_type}")
        image = Image.open(image_file.file)
        image.save(preview_path, "WEBP")


def get_model_all_descriptions(model_path: str):
    base_dirname = os.path.dirname(model_path)
    files = search_files(base_dirname)
    files = folder_paths.filter_files_extensions(files, [".txt", ".md"])

    basename = os.path.splitext(os.path.basename(model_path))[0]
    output: list[str] = []
    for file in files:
        file_basename = os.path.splitext(file)[0]
        if file_basename == basename:
            output.append(file)
    return output


def get_model_description_name(model_path: str):
    descriptions = get_model_all_descriptions(model_path)
    basename = os.path.splitext(os.path.basename(model_path))[0]
    return descriptions[0] if len(descriptions) > 0 else f"{basename}.md"


def save_model_description(model_path: str, content: Any):
    if not isinstance(content, str):
        raise RuntimeError("Invalid description")

    base_dirname = os.path.dirname(model_path)

    # save new description
    basename = os.path.splitext(os.path.basename(model_path))[0]
    extension = ".md"
    new_desc_path = join_path(base_dirname, f"{basename}{extension}")

    with open(new_desc_path, "w", encoding="utf-8", newline="") as f:
        f.write(content)


def rename_model(model_path: str, new_model_path: str):
    if model_path == new_model_path:
        return

    if os.path.exists(new_model_path):
        raise RuntimeError(f"Model {new_model_path} already exists")

    model_name = os.path.splitext(os.path.basename(model_path))[0]
    new_model_name = os.path.splitext(os.path.basename(new_model_path))[0]

    model_dirname = os.path.dirname(model_path)
    new_model_dirname = os.path.dirname(new_model_path)

    if not os.path.exists(new_model_dirname):
        os.makedirs(new_model_dirname)

    # move model
    shutil.move(model_path, new_model_path)

    # move preview
    previews = get_model_all_images(model_path)
    for preview in previews:
        preview_path = join_path(model_dirname, preview)
        preview_name = os.path.splitext(preview)[0]
        preview_ext = os.path.splitext(preview)[1]
        new_preview_path = (
            join_path(new_model_dirname, new_model_name + preview_ext)
            if preview_name == model_name
            else join_path(new_model_dirname, new_model_name + ".preview" + preview_ext)
        )
        shutil.move(preview_path, new_preview_path)

    # move description
    description = get_model_description_name(model_path)
    description_path = join_path(model_dirname, description)
    if os.path.isfile(description_path):
        new_description_path = join_path(new_model_dirname, f"{new_model_name}.md")
        shutil.move(description_path, new_description_path)


import pickle


def save_dict_pickle_file(filename: str, data: dict):
    with open(filename, "wb") as f:
        pickle.dump(data, f)


def load_dict_pickle_file(filename: str) -> dict:
    with open(filename, "rb") as f:
        data = pickle.load(f)
    return data


def resolve_setting_key(key: str) -> str:
    key_paths = key.split(".")
    setting_id = config.setting_key
    try:
        for key_path in key_paths:
            setting_id = setting_id[key_path]
    except:
        pass
    if not isinstance(setting_id, str):
        raise RuntimeError(f"Invalid key: {key}")

    return setting_id


def set_setting_value(request: web.Request, key: str, value: Any):
    setting_id = resolve_setting_key(key)
    settings = config.serverInstance.user_manager.settings.get_settings(request)
    settings[setting_id] = value
    config.serverInstance.user_manager.settings.save_settings(request, settings)


def get_setting_value(request: web.Request, key: str, default: Any = None) -> Any:
    setting_id = resolve_setting_key(key)
    settings = config.serverInstance.user_manager.settings.get_settings(request)
    return settings.get(setting_id, default)


async def send_json(event: str, data: Any, sid: str = None):
    await config.serverInstance.send_json(event, data, sid)


import sys
import subprocess
import importlib.util
import importlib.metadata


def is_installed(package_name: str):
    try:
        dist = importlib.metadata.distribution(package_name)
    except importlib.metadata.PackageNotFoundError:
        try:
            spec = importlib.util.find_spec(package_name)
        except ModuleNotFoundError:
            return False

        return spec is not None

    return dist is not None


def pip_install(package_name: str):
    subprocess.run([sys.executable, "-m", "pip", "install", package_name], check=True)


import hashlib


def calculate_sha256(path, buffer_size=1024 * 1024):
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            data = f.read(buffer_size)
            if not data:
                break
            sha256.update(data)
    return sha256.hexdigest()
