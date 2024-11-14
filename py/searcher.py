import os
import re
import yaml
import requests
import markdownify


from abc import ABC, abstractmethod
from urllib.parse import urlparse, parse_qs

from . import utils


class ModelSearcher(ABC):
    """
    Abstract class for model searcher.
    """

    @abstractmethod
    def search_by_url(self, url: str):
        pass


class UnknownWebsiteSearcher(ModelSearcher):
    def search_by_url(self, url: str):
        raise RuntimeError(
            f"Unknown Website, please input a URL from huggingface.co or civitai.com."
        )


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
                fullname = file.get("name", None)
                extension = os.path.splitext(fullname)[1]
                basename = os.path.splitext(fullname)[0]

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
                description_parts.append(
                    ", ".join(version.get("trainedWords", ["No trigger words"]))
                )
                description_parts.append("")
                description_parts.append(f"# About this version")
                description_parts.append("")
                description_parts.append(
                    markdownify.markdownify(
                        version.get(
                            "description", "<p>No description about this version</p>"
                        )
                    ).strip()
                )
                description_parts.append("")
                description_parts.append(f"# {res_data.get('name')}")
                description_parts.append("")
                description_parts.append(
                    markdownify.markdownify(
                        res_data.get(
                            "description", "<p>No description about this model</p>"
                        )
                    ).strip()
                )
                description_parts.append("")

                model = {
                    "id": file.get("id"),
                    "shortname": shortname or basename,
                    "fullname": fullname,
                    "basename": basename,
                    "extension": extension,
                    "preview": metadata_info.get("preview"),
                    "sizeBytes": file.get("sizeKB", 0) * 1024,
                    "type": self._resolve_model_type(res_data.get("type", "unknown")),
                    "pathIndex": 0,
                    "description": "\n".join(description_parts),
                    "metadata": file.get("metadata"),
                    "downloadPlatform": "civitai",
                    "downloadUrl": file.get("downloadUrl"),
                    "hashes": file.get("hashes"),
                }
                models.append(model)

        return models

    def _resolve_model_type(self, model_type: str):
        map_legacy = {
            "TextualInversion": "embeddings",
            "LoCon": "loras",
            "DoRA": "loras",
            "Controlnet": "controlnet",
            "Upscaler": "upscale_models",
            "VAE": "vae",
            "unknown": "unknown",
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

        sibling_files: list[str] = [
            x.get("rfilename") for x in res_data.get("siblings", [])
        ]

        model_files = utils.filter_with(
            utils.filter_with(sibling_files, self._match_model_files()),
            self._match_tree_files(rest_pathname),
        )

        image_files = utils.filter_with(
            utils.filter_with(sibling_files, self._match_image_files()),
            self._match_tree_files(rest_pathname),
        )
        image_files = [
            f"https://huggingface.co/{model_id}/resolve/main/{filename}"
            for filename in image_files
        ]

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
                "fullname": fullname,
                "basename": basename,
                "extension": extension,
                "preview": image_files,
                "sizeBytes": 0,
                "type": "unknown",
                "pathIndex": 0,
                "description": "\n".join(description_parts),
                "metadata": {},
                "downloadPlatform": "",
                "downloadUrl": f"https://huggingface.co/{model_id}/resolve/main/{filename}?download=true",
            }
            models.append(model)

        return models

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


def get_model_searcher_by_url(url: str) -> ModelSearcher:
    parsed_url = urlparse(url)
    host_name = parsed_url.hostname
    if host_name == "civitai.com":
        return CivitaiModelSearcher()
    elif host_name == "huggingface.co":
        return HuggingfaceModelSearcher()
    return UnknownWebsiteSearcher()
