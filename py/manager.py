from . import utils
from . import services


from aiohttp import web


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
                results = services.scan_models(folder, request)
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
            path_index = int(request.match_info.get("index", None))
            filename = request.match_info.get("filename", None)

            model_data = await request.post()
            model_data = dict(model_data)

            try:
                model_path = utils.get_valid_full_path(model_type, path_index, filename)
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
            path_index = int(request.match_info.get("index", None))
            filename = request.match_info.get("filename", None)

            try:
                model_path = utils.get_valid_full_path(model_type, path_index, filename)
                if model_path is None:
                    raise RuntimeError(f"File {filename} not found")
                services.remove_model(model_path)
                return web.json_response({"success": True})
            except Exception as e:
                error_msg = f"Delete model failed: {str(e)}"
                utils.print_error(error_msg)
                return web.json_response({"success": False, "error": error_msg})
