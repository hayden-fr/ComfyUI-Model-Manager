import os
import folder_paths
from aiohttp import web


from . import utils


class ModelManager:

    def add_routes(self, routes):

        @routes.get("/model-manager/base-folders")
        @utils.deprecated(reason="Use `/model-manager/models` instead.")
        async def get_model_paths(request):
            """
            Returns the base folders for models.
            """
            model_base_paths = utils.resolve_model_base_paths()
            return web.json_response({"success": True, "data": model_base_paths})

        @routes.get("/model-manager/models")
        async def get_folders(request):
            """
            Returns the base folders for models.
            """
            try:
                result = utils.resolve_model_base_paths()
                return web.json_response({"success": True, "data": result})
            except Exception as e:
                error_msg = f"Read models failed: {str(e)}"
                utils.print_error(error_msg)
                return web.json_response({"success": False, "error": error_msg})

        @routes.get("/model-manager/models/{folder}")
        async def get_folder_models(request):
            try:
                folder = request.match_info.get("folder", None)
                results = self.scan_models(folder, request)
                return web.json_response({"success": True, "data": results})
            except Exception as e:
                error_msg = f"Read models failed: {str(e)}"
                utils.print_error(error_msg)
                return web.json_response({"success": False, "error": error_msg})

        @routes.get("/model-manager/model/{type}/{index}/{filename:.*}")
        async def get_model_info(request):
            """
            Get the information of the specified model.
            """
            model_type = request.match_info.get("type", None)
            path_index = int(request.match_info.get("index", None))
            filename = request.match_info.get("filename", None)

            try:
                model_path = utils.get_valid_full_path(model_type, path_index, filename)
                result = self.get_model_info(model_path)
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
            path_index = int(request.match_info.get("index", None))
            filename = request.match_info.get("filename", None)

            model_data = await request.post()
            model_data = dict(model_data)

            try:
                model_path = utils.get_valid_full_path(model_type, path_index, filename)
                if model_path is None:
                    raise RuntimeError(f"File {filename} not found")
                self.update_model(model_path, model_data)
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
            path_index = int(request.match_info.get("index", None))
            filename = request.match_info.get("filename", None)

            try:
                model_path = utils.get_valid_full_path(model_type, path_index, filename)
                if model_path is None:
                    raise RuntimeError(f"File {filename} not found")
                self.remove_model(model_path)
                return web.json_response({"success": True})
            except Exception as e:
                error_msg = f"Delete model failed: {str(e)}"
                utils.print_error(error_msg)
                return web.json_response({"success": False, "error": error_msg})

    def scan_models(self, folder: str, request):
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

    def get_model_info(self, model_path: str):
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

    def update_model(self, model_path: str, model_data: dict):

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

    def remove_model(self, model_path: str):
        model_dirname = os.path.dirname(model_path)
        os.remove(model_path)

        model_previews = utils.get_model_all_images(model_path)
        for preview in model_previews:
            os.remove(utils.join_path(model_dirname, preview))

        model_descriptions = utils.get_model_all_descriptions(model_path)
        for description in model_descriptions:
            os.remove(utils.join_path(model_dirname, description))
