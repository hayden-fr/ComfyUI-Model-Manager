import os
import re
import yaml
import requests
import markdownify


import folder_paths


from aiohttp import web
from abc import ABC, abstractmethod
from urllib.parse import urlparse, parse_qs


from . import utils
from . import config


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
            model_files: list[dict] = version.get("files", [])
            model_files = utils.filter_with(model_files, {"type": "Model"})

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
                    "id": file.get("id"),
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

        @routes.post("/model-manager/model-info/scan")
        async def download_model_info(request):
            """
            Create a task to download model information.
            """
            post = await utils.get_request_body(request)
            try:
                scan_mode = post.get("scanMode", "diff")
                await self.download_model_info(scan_mode, request)
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

    def fetch_model_info(self, model_page: str):
        if not model_page:
            return []

        model_searcher = self.get_model_searcher_by_url(model_page)
        result = model_searcher.search_by_url(model_page)
        return result

    async def download_model_info(self, scan_mode: str, request):
        utils.print_info(f"Download model info for {scan_mode}")
        model_base_paths = utils.resolve_model_base_paths()
        for model_type in model_base_paths:

            folders, *others = folder_paths.folder_names_and_paths[model_type]
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
                        model_info = CivitaiModelSearcher().search_by_hash(hash_value)

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

    def get_model_searcher_by_url(self, url: str) -> ModelSearcher:
        parsed_url = urlparse(url)
        host_name = parsed_url.hostname
        if host_name == "civitai.com":
            return CivitaiModelSearcher()
        elif host_name == "huggingface.co":
            return HuggingfaceModelSearcher()
        return UnknownWebsiteSearcher()
