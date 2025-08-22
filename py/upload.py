import os
import time

import folder_paths

from aiohttp import web

from . import utils


class ModelUploader:
    def add_routes(self, routes):

        @routes.get("/model-manager/supported-extensions")
        async def fetch_model_exts(request):
            """
            Get model exts
            """
            try:
                supported_extensions = list(folder_paths.supported_pt_extensions)
                return web.json_response({"success": True, "data": supported_extensions})
            except Exception as e:
                error_msg = f"Get model supported extension failed: {str(e)}"
                utils.print_error(error_msg)
                return web.json_response({"success": False, "error": error_msg})

        @routes.post("/model-manager/upload")
        async def upload_model(request):
            """
            Upload model
            """
            try:
                utils.print_info("Upload model start")
                reader = await request.multipart()
                utils.print_info(f"Resolve multipart {reader}")
                await self.upload_model(reader)
                utils.print_info(f"Upload model success")
                return web.json_response({"success": True, "data": None})
            except Exception as e:
                error_msg = f"Upload model failed: {str(e)}"
                utils.print_error(error_msg)
                return web.json_response({"success": False, "error": error_msg})

    async def upload_model(self, reader):
        uploaded_size = 0
        last_update_time = time.time()
        interval = 1.0

        while True:
            part = await reader.next()
            utils.print_info(f"Read reader part: {part}")
            if part is None:
                break

            name = part.name
            utils.print_info(f"    Part name: {name}")
            if name == "folder":
                file_folder = await part.text()

            if name == "file":
                filename = part.filename
                filepath = f"{file_folder}/{filename}"
                tmp_filepath = f"{file_folder}/{filename}.tmp"

                utils.print_info(f"        File path: {filepath}")
                utils.print_info(f"        Temp file path: {tmp_filepath}")
                with open(tmp_filepath, "wb") as f:
                    while True:
                        chunk = await part.read_chunk()
                        if not chunk:
                            break
                        f.write(chunk)
                        uploaded_size += len(chunk)

                        if time.time() - last_update_time >= interval:
                            utils.print_debug(f"            Uploaded {uploaded_size} bytes.")
                            update_upload_progress = {
                                "uploaded_size": uploaded_size,
                            }
                            await utils.send_json("update_upload_progress", update_upload_progress)

        utils.print_info(f"Upload model done, total uploaded size: {uploaded_size}")
        update_upload_progress = {
            "uploaded_size": uploaded_size,
        }
        await utils.send_json("update_upload_progress", update_upload_progress)
        os.rename(tmp_filepath, filepath)
