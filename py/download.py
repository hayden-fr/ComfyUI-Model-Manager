import os
import uuid
import time
import logging
import requests
import folder_paths
import traceback
from typing import Callable, Awaitable, Any, Literal, Union, Optional
from dataclasses import dataclass
from . import config
from . import utils
from . import socket
from . import thread


@dataclass
class TaskStatus:
    taskId: str
    type: str
    fullname: str
    preview: str
    status: Literal["pause", "waiting", "doing"] = "pause"
    platform: Union[str, None] = None
    downloadedSize: float = 0
    totalSize: float = 0
    progress: float = 0
    bps: float = 0
    error: Optional[str] = None


@dataclass
class TaskContent:
    type: str
    pathIndex: int
    fullname: str
    description: str
    downloadPlatform: str
    downloadUrl: str
    sizeBytes: float
    hashes: Optional[dict[str, str]] = None


download_model_task_status: dict[str, TaskStatus] = {}
download_thread_pool = thread.DownloadThreadPool()


def set_task_content(task_id: str, task_content: Union[TaskContent, dict]):
    download_path = utils.get_download_path()
    task_file_path = utils.join_path(download_path, f"{task_id}.task")
    utils.save_dict_pickle_file(task_file_path, utils.unpack_dataclass(task_content))


def get_task_content(task_id: str):
    download_path = utils.get_download_path()
    task_file = utils.join_path(download_path, f"{task_id}.task")
    if not os.path.isfile(task_file):
        raise RuntimeError(f"Task {task_id} not found")
    task_content = utils.load_dict_pickle_file(task_file)
    task_content["pathIndex"] = int(task_content.get("pathIndex", 0))
    task_content["sizeBytes"] = float(task_content.get("sizeBytes", 0))
    return TaskContent(**task_content)


def get_task_status(task_id: str):
    task_status = download_model_task_status.get(task_id, None)

    if task_status is None:
        download_path = utils.get_download_path()
        task_content = get_task_content(task_id)
        download_file = utils.join_path(download_path, f"{task_id}.download")
        download_size = 0
        if os.path.exists(download_file):
            download_size = os.path.getsize(download_file)

        total_size = task_content.sizeBytes
        task_status = TaskStatus(
            taskId=task_id,
            type=task_content.type,
            fullname=task_content.fullname,
            preview=utils.get_model_preview_name(download_file),
            platform=task_content.downloadPlatform,
            downloadedSize=download_size,
            totalSize=task_content.sizeBytes,
            progress=download_size / total_size * 100 if total_size > 0 else 0,
        )

        download_model_task_status[task_id] = task_status

    return task_status


def delete_task_status(task_id: str):
    download_model_task_status.pop(task_id, None)


async def scan_model_download_task_list(sid: str):
    """
    Scan the download directory and send the task list to the client.
    """
    try:
        download_dir = utils.get_download_path()
        task_files = utils.search_files(download_dir)
        task_files = folder_paths.filter_files_extensions(task_files, [".task"])
        task_files = sorted(
            task_files,
            key=lambda x: os.stat(utils.join_path(download_dir, x)).st_ctime,
            reverse=True,
        )
        task_list: list[dict] = []
        for task_file in task_files:
            task_id = task_file.replace(".task", "")
            task_status = get_task_status(task_id)
            task_list.append(task_status)

        await socket.send_json("downloadTaskList", task_list, sid)
    except Exception as e:
        error_msg = f"Refresh task list failed: {e}"
        await socket.send_json("error", error_msg, sid)
        logging.error(error_msg)


async def create_model_download_task(post: dict):
    """
    Creates a download task for the given post.
    """
    model_type = post.get("type", None)
    path_index = int(post.get("pathIndex", None))
    fullname = post.get("fullname", None)

    model_path = utils.get_full_path(model_type, path_index, fullname)
    # Check if the model path is valid
    if os.path.exists(model_path):
        raise RuntimeError(f"File already exists: {model_path}")

    download_path = utils.get_download_path()

    task_id = uuid.uuid4().hex
    task_path = utils.join_path(download_path, f"{task_id}.task")
    if os.path.exists(task_path):
        raise RuntimeError(f"Task {task_id} already exists")

    try:
        previewFile = post.pop("previewFile", None)
        utils.save_model_preview_image(task_path, previewFile)
        set_task_content(task_id, post)
        task_status = TaskStatus(
            taskId=task_id,
            type=model_type,
            fullname=fullname,
            preview=utils.get_model_preview_name(task_path),
            platform=post.get("downloadPlatform", None),
            totalSize=float(post.get("sizeBytes", 0)),
        )
        download_model_task_status[task_id] = task_status
        await socket.send_json("createDownloadTask", task_status)
    except Exception as e:
        await delete_model_download_task(task_id)
        raise RuntimeError(str(e)) from e

    await download_model(task_id)
    return task_id


async def pause_model_download_task(task_id: str):
    task_status = get_task_status(task_id=task_id)
    task_status.status = "pause"


async def delete_model_download_task(task_id: str):
    task_status = get_task_status(task_id)
    is_running = task_status.status == "doing"
    task_status.status = "waiting"
    await socket.send_json("deleteDownloadTask", task_id)

    # Pause the task
    if is_running:
        task_status.status = "pause"
        time.sleep(1)

    download_dir = utils.get_download_path()
    task_file_list = os.listdir(download_dir)
    for task_file in task_file_list:
        task_file_target = os.path.splitext(task_file)[0]
        if task_file_target == task_id:
            delete_task_status(task_id)
            os.remove(utils.join_path(download_dir, task_file))

    await socket.send_json("deleteDownloadTask", task_id)


async def download_model(task_id: str):
    async def download_task(task_id: str):
        async def report_progress(task_status: TaskStatus):
            await socket.send_json("updateDownloadTask", task_status)

        try:
            # When starting a task from the queue, the task may not exist
            task_status = get_task_status(task_id)
        except:
            return

        # Update task status
        task_status.status = "doing"
        await socket.send_json("updateDownloadTask", task_status)

        try:

            # Set download request headers
            headers = {"User-Agent": config.user_agent}

            download_platform = task_status.platform
            if download_platform == "civitai":
                api_key = utils.get_setting_value("api_key.civitai")
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

            elif download_platform == "huggingface":
                api_key = utils.get_setting_value("api_key.huggingface")
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

            progress_interval = 1.0
            await download_model_file(
                task_id=task_id,
                headers=headers,
                progress_callback=report_progress,
                interval=progress_interval,
            )
        except Exception as e:
            task_status.status = "pause"
            task_status.error = str(e)
            await socket.send_json("updateDownloadTask", task_status)
            task_status.error = None
            logging.error(str(e))

    try:
        status = download_thread_pool.submit(download_task, task_id)
        if status == "Waiting":
            task_status = get_task_status(task_id)
            task_status.status = "waiting"
            await socket.send_json("updateDownloadTask", task_status)
    except Exception as e:
        task_status.status = "pause"
        task_status.error = str(e)
        await socket.send_json("updateDownloadTask", task_status)
        task_status.error = None
        logging.error(traceback.format_exc())


async def download_model_file(
    task_id: str,
    headers: dict,
    progress_callback: Callable[[TaskStatus], Awaitable[Any]],
    interval: float = 1.0,
):

    async def download_complete():
        """
        Restore the model information from the task file
        and move the model file to the target directory.
        """
        model_type = task_content.type
        path_index = task_content.pathIndex
        fullname = task_content.fullname
        # Write description file
        description = task_content.description
        description_file = utils.join_path(download_path, f"{task_id}.md")
        with open(description_file, "w") as f:
            f.write(description)

        model_path = utils.get_full_path(model_type, path_index, fullname)

        utils.rename_model(download_tmp_file, model_path)

        time.sleep(1)
        task_file = utils.join_path(download_path, f"{task_id}.task")
        os.remove(task_file)
        await socket.send_json("completeDownloadTask", task_id)

    async def update_progress():
        nonlocal last_update_time
        nonlocal last_downloaded_size
        progress = (downloaded_size / total_size) * 100 if total_size > 0 else 0
        task_status.downloadedSize = downloaded_size
        task_status.progress = progress
        task_status.bps = downloaded_size - last_downloaded_size
        await progress_callback(task_status)
        last_update_time = time.time()
        last_downloaded_size = downloaded_size

    task_status = get_task_status(task_id)
    task_content = get_task_content(task_id)

    # Check download uri
    model_url = task_content.downloadUrl
    if not model_url:
        raise RuntimeError("No downloadUrl found")

    download_path = utils.get_download_path()
    download_tmp_file = utils.join_path(download_path, f"{task_id}.download")

    downloaded_size = 0
    if os.path.isfile(download_tmp_file):
        downloaded_size = os.path.getsize(download_tmp_file)
        headers["Range"] = f"bytes={downloaded_size}-"

    total_size = task_content.sizeBytes

    if total_size > 0 and downloaded_size == total_size:
        await download_complete()
        return

    last_update_time = time.time()
    last_downloaded_size = downloaded_size

    response = requests.get(
        url=model_url,
        headers=headers,
        stream=True,
        allow_redirects=True,
    )

    if response.status_code not in (200, 206):
        raise RuntimeError(
            f"Failed to download {task_content.fullname}, status code: {response.status_code}"
        )

    # Some models require logging in before they can be downloaded.
    # If no token is carried, it will be redirected to the login page.
    content_type = response.headers.get("content-type")
    if content_type and content_type.startswith("text/html"):
        raise RuntimeError(
            f"{task_content.fullname} needs to be logged in to download. Please set the API-Key first."
        )

    # When parsing model information from HuggingFace API,
    # the file size was not found and needs to be obtained from the response header.
    if total_size == 0:
        total_size = int(response.headers.get("content-length", 0))
        task_content.sizeBytes = total_size
        task_status.totalSize = total_size
        set_task_content(task_id, task_content)
        await socket.send_json("updateDownloadTask", task_content)

    with open(download_tmp_file, "ab") as f:
        for chunk in response.iter_content(chunk_size=8192):
            if task_status.status == "pause":
                break

            f.write(chunk)
            downloaded_size += len(chunk)

            if time.time() - last_update_time >= interval:
                await update_progress()

    await update_progress()

    if total_size > 0 and downloaded_size == total_size:
        await download_complete()
    else:
        task_status.status = "pause"
        await socket.send_json("updateDownloadTask", task_status)
