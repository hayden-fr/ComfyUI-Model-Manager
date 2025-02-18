import { useLoading } from 'hooks/loading'
import { request } from 'hooks/request'
import { defineStore } from 'hooks/store'
import { useToast } from 'hooks/toast'
import { api } from 'scripts/comfyAPI'
import {
  BaseModel,
  DownloadTask,
  DownloadTaskOptions,
  SelectOptions,
  VersionModel,
} from 'types/typings'
import { bytesToSize } from 'utils/common'
import { onBeforeMount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export const useDownload = defineStore('download', (store) => {
  const { toast, confirm, wrapperToastError } = useToast()
  const { t } = useI18n()

  const taskList = ref<DownloadTask[]>([])

  const createTaskItem = (item: DownloadTaskOptions) => {
    const { downloadedSize, totalSize, bps, ...rest } = item

    const task: DownloadTask = {
      ...rest,
      preview: `/model-manager/preview/download/${item.preview}`,
      downloadProgress: `${bytesToSize(downloadedSize)} / ${bytesToSize(totalSize)}`,
      downloadSpeed: `${bytesToSize(bps)}/s`,
      pauseTask() {
        wrapperToastError(async () =>
          request(`/download/${item.taskId}`, {
            method: 'PUT',
            body: JSON.stringify({
              status: 'pause',
            }),
          }),
        )()
      },
      resumeTask: () => {
        wrapperToastError(async () =>
          request(`/download/${item.taskId}`, {
            method: 'PUT',
            body: JSON.stringify({
              status: 'resume',
            }),
          }),
        )()
      },
      deleteTask: () => {
        confirm.require({
          message: t('deleteAsk', [t('downloadTask').toLowerCase()]),
          header: 'Danger',
          icon: 'pi pi-info-circle',
          rejectProps: {
            label: t('cancel'),
            severity: 'secondary',
            outlined: true,
          },
          acceptProps: {
            label: t('delete'),
            severity: 'danger',
          },
          accept: () => {
            wrapperToastError(async () =>
              request(`/download/${item.taskId}`, {
                method: 'DELETE',
              }),
            )()
          },
          reject: () => {},
        })
      },
    }

    return task
  }

  const refresh = wrapperToastError(async () => {
    return request('/download/task').then((resData: DownloadTaskOptions[]) => {
      taskList.value = resData.map((item) => createTaskItem(item))
      return taskList.value
    })
  })

  onBeforeMount(() => {
    api.addEventListener('reconnected', () => {
      refresh()
    })

    api.addEventListener('fetch_download_task_list', (event) => {
      const data = event.detail as DownloadTaskOptions[]

      taskList.value = data.map((item) => {
        return createTaskItem(item)
      })
    })

    api.addEventListener('create_download_task', (event) => {
      const item = event.detail as DownloadTaskOptions
      taskList.value.unshift(createTaskItem(item))
    })

    api.addEventListener('update_download_task', (event) => {
      const item = event.detail as DownloadTaskOptions

      for (const task of taskList.value) {
        if (task.taskId === item.taskId) {
          if (item.error) {
            toast.add({
              severity: 'error',
              summary: 'Error',
              detail: item.error,
              life: 15000,
            })
            item.error = undefined
          }
          Object.assign(task, createTaskItem(item))
        }
      }
    })

    api.addEventListener('delete_download_task', (event) => {
      const taskId = event.detail as string
      taskList.value = taskList.value.filter((item) => item.taskId !== taskId)
    })

    api.addEventListener('complete_download_task', (event) => {
      const taskId = event.detail as string
      const task = taskList.value.find((item) => item.taskId === taskId)
      taskList.value = taskList.value.filter((item) => item.taskId !== taskId)
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: `${task?.fullname} Download completed`,
        life: 2000,
      })
      store.models.refresh()
    })
  })

  onMounted(() => {
    refresh()
  })

  return { data: taskList, refresh }
})

declare module 'hooks/store' {
  interface StoreProvider {
    download: ReturnType<typeof useDownload>
  }
}

export const useModelSearch = () => {
  const loading = useLoading()
  const { toast } = useToast()
  const data = ref<(SelectOptions & { item: VersionModel })[]>([])
  const current = ref<string | number>()
  const currentModel = ref<BaseModel>()

  const handleSearchByUrl = async (url: string) => {
    if (!url) {
      return Promise.resolve([])
    }

    loading.show()
    return request(`/model-info?model-page=${encodeURIComponent(url)}`, {})
      .then((resData: VersionModel[]) => {
        data.value = resData.map((item) => ({
          label: item.shortname,
          value: item.id,
          item,
          command() {
            current.value = item.id
          },
        }))
        current.value = data.value[0]?.value
        currentModel.value = data.value[0]?.item

        if (resData.length === 0) {
          toast.add({
            severity: 'warn',
            summary: 'No Model Found',
            detail: `No model found for ${url}`,
            life: 3000,
          })
        }

        return resData
      })
      .catch((err) => {
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: err.message,
          life: 15000,
        })
        return []
      })
      .finally(() => loading.hide())
  }

  watch(current, () => {
    currentModel.value = data.value.find(
      (option) => option.value === current.value,
    )?.item
  })

  return { data, current, currentModel, search: handleSearchByUrl }
}
