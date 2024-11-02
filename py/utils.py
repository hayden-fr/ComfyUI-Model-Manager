import os
import json
import yaml
import shutil
import tarfile
import logging
import requests
import configparser

import comfy.utils
import folder_paths

from aiohttp import web
from typing import Any
from . import config


def get_current_version():
    try:
        pyproject_path = os.path.join(config.extension_uri, "pyproject.toml")
        config_parser = configparser.ConfigParser()
        config_parser.read(pyproject_path)
        version = config_parser.get("project", "version")
        return version.strip("'\"")
    except:
        return "0.0.0"


def download_web_distribution(version: str):
    web_path = os.path.join(config.extension_uri, "web")
    dev_web_file = os.path.join(web_path, "manager-dev.js")
    if os.path.exists(dev_web_file):
        return

    web_version = "0.0.0"
    version_file = os.path.join(web_path, "version.yaml")
    if os.path.exists(version_file):
        with open(version_file, "r") as f:
            version_content = yaml.safe_load(f)
            web_version = version_content.get("version", web_version)

    if version == web_version:
        return

    try:
        logging.info(f"current version {version}, web version {web_version}")
        logging.info("Downloading web distribution...")
        download_url = f"https://github.com/hayden-fr/ComfyUI-Model-Manager/releases/download/v{version}/dist.tar.gz"
        response = requests.get(download_url, stream=True)
        response.raise_for_status()

        temp_file = os.path.join(config.extension_uri, "temp.tar.gz")
        with open(temp_file, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        if os.path.exists(web_path):
            shutil.rmtree(web_path)

        logging.info("Extracting web distribution...")
        with tarfile.open(temp_file, "r:gz") as tar:
            members = [
                member for member in tar.getmembers() if member.name.startswith("web/")
            ]
            tar.extractall(path=config.extension_uri, members=members)

        os.remove(temp_file)
        logging.info("Web distribution downloaded successfully.")
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to download web distribution: {e}")
    except tarfile.TarError as e:
        logging.error(f"Failed to extract web distribution: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")


def resolve_model_base_paths():
    folders = list(folder_paths.folder_names_and_paths.keys())
    config.model_base_paths = {}
    for folder in folders:
        if folder == "configs":
            continue
        if folder == "custom_nodes":
            continue
        config.model_base_paths[folder] = folder_paths.get_folder_paths(folder)


def get_full_path(model_type: str, path_index: int, filename: str):
    """
    Get the absolute path in the model type through string concatenation.
    """
    folders = config.model_base_paths.get(model_type, [])
    if not path_index < len(folders):
        raise RuntimeError(f"PathIndex {path_index} is not in {model_type}")
    base_path = folders[path_index]
    return os.path.join(base_path, filename)


def get_valid_full_path(model_type: str, path_index: int, filename: str):
    """
    Like get_full_path but it will check whether the file is valid.
    """
    folders = config.model_base_paths.get(model_type, [])
    if not path_index < len(folders):
        raise RuntimeError(f"PathIndex {path_index} is not in {model_type}")
    base_path = folders[path_index]
    full_path = os.path.join(base_path, filename)
    if os.path.isfile(full_path):
        return full_path
    elif os.path.islink(full_path):
        raise RuntimeError(
            f"WARNING path {full_path} exists but doesn't link anywhere, skipping."
        )


def get_download_path():
    download_path = os.path.join(config.extension_uri, "downloads")
    if not os.path.exists(download_path):
        os.makedirs(download_path)
    return download_path


def recursive_search_files(directory: str):
    files, folder_all = folder_paths.recursive_search(
        directory, excluded_dir_names=[".git"]
    )
    return files


def search_files(directory: str):
    entries = os.listdir(directory)
    files = [f for f in entries if os.path.isfile(os.path.join(directory, f))]
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
    return images[0] if len(images) > 0 else "no-preview.png"


def save_model_preview_image(model_path: str, image_file: Any):
    if not isinstance(image_file, web.FileField):
        raise RuntimeError("Invalid image file")

    content_type: str = image_file.content_type
    if not content_type.startswith("image/"):
        raise RuntimeError(f"FileTypeError: expected image, got {content_type}")

    base_dirname = os.path.dirname(model_path)

    # remove old preview images
    old_preview_images = get_model_all_images(model_path)
    a1111_civitai_helper_image = False
    for image in old_preview_images:
        if os.path.splitext(image)[1].endswith(".preview"):
            a1111_civitai_helper_image = True
        image_path = os.path.join(base_dirname, image)
        os.remove(image_path)

    # save new preview image
    basename = os.path.splitext(os.path.basename(model_path))[0]
    extension = f".{content_type.split('/')[1]}"
    new_preview_path = os.path.join(base_dirname, f"{basename}{extension}")

    with open(new_preview_path, "wb") as f:
        f.write(image_file.file.read())

    # TODO Is it possible to abandon the current rules and adopt the rules of a1111 civitai_helper?
    if a1111_civitai_helper_image:
        """
        Keep preview image of a1111_civitai_helper
        """
        new_preview_path = os.path.join(base_dirname, f"{basename}.preview{extension}")
        with open(new_preview_path, "wb") as f:
            f.write(image_file.file.read())


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

    # remove old descriptions
    old_descriptions = get_model_all_descriptions(model_path)
    for desc in old_descriptions:
        description_path = os.path.join(base_dirname, desc)
        os.remove(description_path)

    # save new description
    basename = os.path.splitext(os.path.basename(model_path))[0]
    extension = ".md"
    new_desc_path = os.path.join(base_dirname, f"{basename}{extension}")

    with open(new_desc_path, "w", encoding="utf-8") as f:
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
    os.rename(model_path, new_model_path)

    # move preview
    previews = get_model_all_images(model_path)
    for preview in previews:
        preview_path = os.path.join(model_dirname, preview)
        preview_name = os.path.splitext(preview)[0]
        preview_ext = os.path.splitext(preview)[1]
        new_preview_path = (
            os.path.join(new_model_dirname, new_model_name + preview_ext)
            if preview_name == model_name
            else os.path.join(
                new_model_dirname, new_model_name + ".preview" + preview_ext
            )
        )
        os.rename(preview_path, new_preview_path)

    # move description
    description = get_model_description_name(model_path)
    description_path = os.path.join(model_dirname, description)
    if os.path.isfile(description_path):
        new_description_path = os.path.join(new_model_dirname, f"{new_model_name}.md")
        os.rename(description_path, new_description_path)


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


def set_setting_value(key: str, value: Any):
    setting_id = resolve_setting_key(key)
    fake_request = config.FakeRequest()
    settings = config.serverInstance.user_manager.settings.get_settings(fake_request)
    settings[setting_id] = value
    config.serverInstance.user_manager.settings.save_settings(fake_request, settings)


def get_setting_value(key: str, default: Any = None) -> Any:
    setting_id = resolve_setting_key(key)
    fake_request = config.FakeRequest()
    settings = config.serverInstance.user_manager.settings.get_settings(fake_request)
    return settings.get(setting_id, default)


from dataclasses import asdict, is_dataclass


def unpack_dataclass(data: Any):
    if isinstance(data, dict):
        return {key: unpack_dataclass(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [unpack_dataclass(x) for x in data]
    elif is_dataclass(data):
        return asdict(data)
    else:
        return data
