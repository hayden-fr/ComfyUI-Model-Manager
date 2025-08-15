import os
import re
import uuid
import math
import yaml
import requests
import markdownify


import folder_paths


from aiohttp import web
from abc import ABC, abstractmethod
from urllib.parse import urlparse, parse_qs
from PIL import Image
from io import BytesIO


from . import utils
from . import config
from . import thread


class ModelSearcher(ABC):
    """
    Abstract class for model searcher.
    """

    @abstractmethod
    def search_by_url(self, url: str) -> list[dict]:
        pass

    @abstractmethod
    def search_by_hash(self, hash: str) -> dict:
        pass


class UnknownWebsiteSearcher(ModelSearcher):
    def search_by_url(self, url: str):
        raise RuntimeError(f"Unknown Website, please input a URL from huggingface.co or civitai.com.")

    def search_by_hash(self, hash: str):
        raise RuntimeError(f"Unknown Website, unable to search with hash value.")


class CivitaiModelSearcher(ModelSearcher):
    def search_by_url(self, url: str):
        parsed_url = urlparse(url)

        pathname = parsed_url.path
        match = re.match(r"^/models/(\d*)", pathname)
        model_id = match.group(1) if match else None

        query_params = parse_qs(parsed_url.query)
        version_id = query_params.get("modelVersionId", [None])[0]

        if not model_id:
            return []

        response = requests.get(f"https://civitai.com/api/v1/models/{model_id}")
        response.raise_for_status()
        res_data: dict = response.json()

        model_versions: list[dict] = res_data["modelVersions"]
        if version_id:
            model_versions = utils.filter_with(model_versions, {"id": int(version_id)})

        models: list[dict] = []

        for version in model_versions:
            version_files: list[dict] = version.get("files", [])
            model_files = utils.filter_with(version_files, {"type": "Model"})
            # issue: https://github.com/hayden-fr/ComfyUI-Model-Manager/issues/188
            # Some Embeddings do not have Model file, but Negative
            # Make sure there are at least downloadable files
            model_files = version_files if len(model_files) == 0 else model_files

            shortname = version.get("name", None) if len(model_files) > 0 else None

            for file in model_files:
                name = file.get("name", None)
                extension = os.path.splitext(name)[1]
                basename = os.path.splitext(name)[0]

                metadata_info = {
                    "website": "Civitai",
                    "modelPage": f"https://civitai.com/models/{model_id}?modelVersionId={version.get('id')}",
                    "author": res_data.get("creator", {}).get("username", None),
                    "baseModel": version.get("baseModel"),
                    "hashes": file.get("hashes"),
                    "metadata": file.get("metadata"),
                    "preview": [i["url"] for i in version["images"]],
                }

                description_parts: list[str] = []
                description_parts.append("---")
                description_parts.append(yaml.dump(metadata_info).strip())
                description_parts.append("---")
                description_parts.append("")
                description_parts.append(f"# Trigger Words")
                description_parts.append("")
                description_parts.append(", ".join(version.get("trainedWords", ["No trigger words"])))
                description_parts.append("")
                description_parts.append(f"# About this version")
                description_parts.append("")
                description_parts.append(markdownify.markdownify(version.get("description", "<p>No description about this version</p>")).strip())
                description_parts.append("")
                description_parts.append(f"# {res_data.get('name')}")
                description_parts.append("")
                description_parts.append(markdownify.markdownify(res_data.get("description", "<p>No description about this model</p>")).strip())
                description_parts.append("")

                model = {
                    "id": version.get("id"),
                    "shortname": shortname or basename,
                    "basename": basename,
                    "extension": extension,
                    "preview": metadata_info.get("preview"),
                    "sizeBytes": file.get("sizeKB", 0) * 1024,
                    "type": self._resolve_model_type(res_data.get("type", "")),
                    "pathIndex": 0,
                    "subFolder": "",
                    "description": "\n".join(description_parts),
                    "metadata": file.get("metadata"),
                    "downloadPlatform": "civitai",
                    "downloadUrl": file.get("downloadUrl"),
                    "hashes": file.get("hashes"),
                    "files": version_files if len(version_files) > 1 else None,
                }
                models.append(model)

        return models

    def search_by_hash(self, hash: str):
        if not hash:
            raise RuntimeError(f"Hash value is empty.")

        response = requests.get(f"https://civitai.com/api/v1/model-versions/by-hash/{hash}")
        response.raise_for_status()
        version: dict = response.json()

        model_id = version.get("modelId")
        version_id = version.get("id")

        model_page = f"https://civitai.com/models/{model_id}?modelVersionId={version_id}"

        models = self.search_by_url(model_page)

        for model in models:
            sha256 = model.get("hashes", {}).get("SHA256")
            if sha256 == hash:
                return model

        return models[0]

    def _resolve_model_type(self, model_type: str):
        map_legacy = {
            "TextualInversion": "embeddings",
            "LoCon": "loras",
            "DoRA": "loras",
            "Controlnet": "controlnet",
            "Upscaler": "upscale_models",
            "VAE": "vae",
            "unknown": "",
        }
        return map_legacy.get(model_type, f"{model_type.lower()}s")


class HuggingfaceModelSearcher(ModelSearcher):
    def search_by_url(self, url: str):
        parsed_url = urlparse(url)

        pathname = parsed_url.path

        space, name, *rest_paths = pathname.strip("/").split("/")

        model_id = f"{space}/{name}"
        rest_pathname = "/".join(rest_paths)

        response = requests.get(f"https://huggingface.co/api/models/{model_id}")
        response.raise_for_status()
        res_data: dict = response.json()

        sibling_files: list[str] = [x.get("rfilename") for x in res_data.get("siblings", [])]

        model_files = utils.filter_with(
            utils.filter_with(sibling_files, self._match_model_files()),
            self._match_tree_files(rest_pathname),
        )

        image_files = utils.filter_with(
            utils.filter_with(sibling_files, self._match_image_files()),
            self._match_tree_files(rest_pathname),
        )
        image_files = [f"https://huggingface.co/{model_id}/resolve/main/{filename}" for filename in image_files]

        models: list[dict] = []

        for filename in model_files:
            fullname = os.path.basename(filename)
            extension = os.path.splitext(fullname)[1]
            basename = os.path.splitext(fullname)[0]

            description_parts: list[str] = []

            metadata_info = {
                "website": "HuggingFace",
                "modelPage": f"https://huggingface.co/{model_id}",
                "author": res_data.get("author", None),
                "preview": image_files,
            }

            description_parts: list[str] = []
            description_parts.append("---")
            description_parts.append(yaml.dump(metadata_info).strip())
            description_parts.append("---")
            description_parts.append("")
            description_parts.append(f"# Trigger Words")
            description_parts.append("")
            description_parts.append("No trigger words")
            description_parts.append("")
            description_parts.append(f"# About this version")
            description_parts.append("")
            description_parts.append("No description about this version")
            description_parts.append("")
            description_parts.append(f"# {res_data.get('name')}")
            description_parts.append("")
            description_parts.append("No description about this model")
            description_parts.append("")

            model = {
                "id": filename,
                "shortname": filename,
                "basename": basename,
                "extension": extension,
                "preview": image_files,
                "sizeBytes": 0,
                "type": "",
                "pathIndex": 0,
                "subFolder": "",
                "description": "\n".join(description_parts),
                "metadata": {},
                "downloadPlatform": "huggingface",
                "downloadUrl": f"https://huggingface.co/{model_id}/resolve/main/{filename}?download=true",
            }
            models.append(model)

        return models

    def search_by_hash(self, hash: str):
        raise RuntimeError("Hash search is not supported by Huggingface.")

    def _match_model_files(self):
        extension = [
            ".bin",
            ".ckpt",
            ".gguf",
            ".onnx",
            ".pt",
            ".pth",
            ".safetensors",
        ]

        def _filter_model_files(file: str):
            return any(file.endswith(ext) for ext in extension)

        return _filter_model_files

    def _match_image_files(self):
        extension = [
            ".png",
            ".webp",
            ".jpeg",
            ".jpg",
            ".jfif",
            ".gif",
            ".apng",
        ]

        def _filter_image_files(file: str):
            return any(file.endswith(ext) for ext in extension)

        return _filter_image_files

    def _match_tree_files(self, pathname: str):
        target, *paths = pathname.split("/")

        def _filter_tree_files(file: str):
            if not target:
                return True
            if target != "tree" and target != "blob":
                return True

            prefix_path = "/".join(paths)
            return file.startswith(prefix_path)

        return _filter_tree_files


class Information:
    def add_routes(self, routes):

        @routes.get("/model-manager/model-info")
        async def fetch_model_info(request):
            """
            Fetch model information from network with model page.
            """
            try:
                model_page = request.query.get("model-page", None)
                result = self.fetch_model_info(model_page)
                return web.json_response({"success": True, "data": result})
            except Exception as e:
                error_msg = f"Fetch model info failed: {str(e)}"
                utils.print_error(error_msg)
                return web.json_response({"success": False, "error": error_msg})

        @routes.get("/model-manager/model-info/scan")
        async def get_model_info_download_task(request):
            """
            Get model information download task list.
            """
            try:
                result = self.get_scan_model_info_task_list()
                if result is not None:
                    await self.download_model_info(request)
                return web.json_response({"success": True, "data": result})
            except Exception as e:
                error_msg = f"Get model info download task list failed: {str(e)}"
                utils.print_error(error_msg)
                return web.json_response({"success": False, "error": error_msg})

        @routes.post("/model-manager/model-info/scan")
        async def create_model_info_download_task(request):
            """
            Create a task to download model information.

            - scanMode: The alternatives are diff and full.
            - mode: The alternatives are diff and full.
            - path: Scanning root path.
            """
            post = await utils.get_request_body(request)
            try:
                # TODO scanMode is deprecated, use mode instead.
                scan_mode = post.get("scanMode", "diff")
                scan_mode = post.get("mode", scan_mode)
                scan_path = post.get("path", None)
                result = await self.create_scan_model_info_task(scan_mode, scan_path, request)
                return web.json_response({"success": True, "data": result})
            except Exception as e:
                error_msg = f"Download model info failed: {str(e)}"
                utils.print_error(error_msg)
                return web.json_response({"success": False, "error": error_msg})

        @routes.get("/model-manager/preview/{type}/{index}/{filename:.*}")
        async def read_model_preview(request):
            """
            Get the file stream of the specified preview
            If the file does not exist, no-preview.png is returned.

            :param type: The type of the model. eg.checkpoints, loras, vae, etc.
            :param index: The index of the model folders.
            :param filename: The filename of the preview.
            """
            model_type = request.match_info.get("type", None)
            index = int(request.match_info.get("index", None))
            filename = request.match_info.get("filename", None)

            extension_uri = config.extension_uri

            try:
                folders = folder_paths.get_folder_paths(model_type)
                base_path = folders[index]
                abs_path = utils.join_path(base_path, filename)
                preview_name = utils.get_model_preview_name(abs_path)
                if preview_name:
                    dir_name = os.path.dirname(abs_path)
                    abs_path = utils.join_path(dir_name, preview_name)
            except:
                abs_path = extension_uri

            if not os.path.isfile(abs_path):
                abs_path = utils.join_path(extension_uri, "assets", "no-preview.png")

            # Determine content type from the actual file
            content_type = utils.resolve_file_content_type(abs_path)

            if content_type == "video":
                # Serve video files directly
                return web.FileResponse(abs_path)
            else:
                # Serve image files (WebP or fallback images)
                image_data = self.get_image_preview_data(abs_path)
                return web.Response(body=image_data.getvalue(), content_type="image/webp")

        @routes.get("/model-manager/preview/download/{filename}")
        async def read_download_preview(request):
            filename = request.match_info.get("filename", None)
            extension_uri = config.extension_uri

            download_path = utils.get_download_path()
            preview_path = utils.join_path(download_path, filename)

            if not os.path.isfile(preview_path):
                preview_path = utils.join_path(extension_uri, "assets", "no-preview.png")

            return web.FileResponse(preview_path)

    def get_image_preview_data(self, filename: str):
        with Image.open(filename) as img:
            max_size = 1024
            original_format = img.format

            exif_data = img.info.get("exif")
            icc_profile = img.info.get("icc_profile")

            if getattr(img, "is_animated", False) and img.n_frames > 1:
                total_frames = img.n_frames
                step = max(1, math.ceil(total_frames / 30))

                frames, durations = [], []

                for frame_idx in range(0, total_frames, step):
                    img.seek(frame_idx)
                    frame = img.copy()
                    frame.thumbnail((max_size, max_size), Image.Resampling.NEAREST)

                    frames.append(frame)
                    durations.append(img.info.get("duration", 100) * step)

                save_args = {
                    "format": "WEBP",
                    "save_all": True,
                    "append_images": frames[1:],
                    "duration": durations,
                    "loop": 0,
                    "quality": 80,
                    "method": 0,
                    "allow_mixed": False,
                }

                if exif_data:
                    save_args["exif"] = exif_data

                if icc_profile:
                    save_args["icc_profile"] = icc_profile

                img_byte_arr = BytesIO()
                frames[0].save(img_byte_arr, **save_args)
                img_byte_arr.seek(0)
                return img_byte_arr

            img.thumbnail((max_size, max_size), Image.Resampling.BICUBIC)

            img_byte_arr = BytesIO()
            save_args = {"format": "WEBP", "quality": 80}

            if exif_data:
                save_args["exif"] = exif_data
            if icc_profile:
                save_args["icc_profile"] = icc_profile

            img.save(img_byte_arr, **save_args)
            img_byte_arr.seek(0)
            return img_byte_arr

    def fetch_model_info(self, model_page: str):
        if not model_page:
            return []

        model_searcher = self.get_model_searcher_by_url(model_page)
        result = model_searcher.search_by_url(model_page)
        return result

    def get_scan_information_task_filepath(self):
        download_dir = utils.get_download_path()
        return utils.join_path(download_dir, "scan_information.task")

    def get_scan_model_info_task_list(self):
        scan_info_task_file = self.get_scan_information_task_filepath()
        if os.path.isfile(scan_info_task_file):
            return utils.load_dict_pickle_file(scan_info_task_file)
        return None

    async def create_scan_model_info_task(self, scan_mode: str, scan_path: str | None, request):
        scan_info_task_file = self.get_scan_information_task_filepath()
        scan_info_task_content = {"mode": scan_mode}
        scan_models: dict[str, bool] = {}

        scan_paths: list[str] = []
        if scan_path is None:
            model_base_paths = utils.resolve_model_base_paths()
            for model_type in model_base_paths:
                folders, *others = folder_paths.folder_names_and_paths[model_type]
                for path_index, base_path in enumerate(folders):
                    scan_paths.append(base_path)
        else:
            scan_paths = [scan_path]

        for base_path in scan_paths:
            files = utils.recursive_search_files(base_path, request)
            models = folder_paths.filter_files_extensions(files, folder_paths.supported_pt_extensions)
            for fullname in models:
                fullname = utils.normalize_path(fullname)
                abs_model_path = utils.join_path(base_path, fullname)
                utils.print_debug(f"Found model: {abs_model_path}")
                scan_models[abs_model_path] = False

        scan_info_task_content["models"] = scan_models
        utils.save_dict_pickle_file(scan_info_task_file, scan_info_task_content)
        await self.download_model_info(request)
        return scan_info_task_content

    download_thread_pool = thread.DownloadThreadPool()

    async def download_model_info(self, request):
        async def download_information_task(task_id: str):
            scan_info_task_file = self.get_scan_information_task_filepath()
            scan_info_task_content = utils.load_dict_pickle_file(scan_info_task_file)
            scan_mode = scan_info_task_content.get("mode", "diff")
            scan_models: dict[str, bool] = scan_info_task_content.get("models", {})
            for key, value in scan_models.items():
                if value is True:
                    continue

                abs_model_path = key
                base_path = os.path.dirname(abs_model_path)

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

                    if scan_mode == "full" or not has_preview or not has_description:
                        utils.print_debug(f"Calculate sha256 for {abs_model_path}")
                        hash_value = utils.calculate_sha256(abs_model_path)
                        utils.print_info(f"Searching model info by hash {hash_value}")
                        model_info = CivitaiModelSearcher().search_by_hash(hash_value)

                        preview_url_list = model_info.get("preview", [])
                        preview_url = preview_url_list[0] if preview_url_list else None
                        if preview_url:
                            utils.print_debug(f"Save preview to {abs_model_path}")
                            utils.save_model_preview(abs_model_path, preview_url)

                        description = model_info.get("description", None)
                        if description:
                            utils.save_model_description(abs_model_path, description)

                    scan_models[abs_model_path] = True
                    scan_info_task_content["models"] = scan_models
                    utils.save_dict_pickle_file(scan_info_task_file, scan_info_task_content)
                    utils.print_debug(f"Send update scan information task to frontend.")
                    await utils.send_json("update_scan_information_task", scan_info_task_content)
                except Exception as e:
                    utils.print_error(f"Failed to download model info for {abs_model_path}: {e}")

            os.remove(scan_info_task_file)
            utils.print_info("Completed scan model information.")

        try:
            task_id = uuid.uuid4().hex
            self.download_thread_pool.submit(download_information_task, task_id)
        except Exception as e:
            utils.print_debug(str(e))

    def get_model_searcher_by_url(self, url: str) -> ModelSearcher:
        parsed_url = urlparse(url)
        host_name = parsed_url.hostname
        if host_name == "civitai.com":
            return CivitaiModelSearcher()
        elif host_name == "huggingface.co":
            return HuggingfaceModelSearcher()
        return UnknownWebsiteSearcher()
