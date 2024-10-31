import asyncio
import threading
import queue
import logging
from . import utils


class DownloadThreadPool:
    def __init__(self) -> None:
        self.workers_count = 0
        self.task_queue = queue.Queue()
        self.running_tasks = set()
        self._lock = threading.Lock()

        default_max_workers = 5
        max_workers: int = utils.get_setting_value(
            "download.max_task_count", default_max_workers
        )

        if max_workers <= 0:
            max_workers = default_max_workers
            utils.set_setting_value("download.max_task_count", max_workers)

        self.max_worker = max_workers

    def submit(self, task, task_id):
        with self._lock:
            if task_id in self.running_tasks:
                return "Existing"
            self.running_tasks.add(task_id)
        self.task_queue.put((task, task_id))
        return self._adjust_worker_count()

    def _adjust_worker_count(self):
        if self.workers_count < self.max_worker:
            self._start_worker()
            return "Running"
        else:
            return "Waiting"

    def _start_worker(self):
        t = threading.Thread(target=self._worker, daemon=True)
        t.start()
        with self._lock:
            self.workers_count += 1

    def _worker(self):
        loop = asyncio.new_event_loop()

        while True:
            if self.task_queue.empty():
                break

            task, task_id = self.task_queue.get()

            try:
                loop.run_until_complete(task(task_id))
                with self._lock:
                    self.running_tasks.remove(task_id)
            except Exception as e:
                logging.error(f"worker run error: {str(e)}")

        with self._lock:
            self.workers_count -= 1
