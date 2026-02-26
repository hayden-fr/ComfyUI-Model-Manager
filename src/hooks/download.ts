import { useLoading } from 'hooks/loading'
import { request } from 'hooks/request'
import { defineStore } from 'hooks/store'
import { useToast } from 'hooks/toast'
import { upperFirst } from 'lodash'
import { api } from 'scripts/comfyAPI'
import {
  DownloadTask,
  DownloadTaskOptions,
  SelectOptions,
  VersionModel,
  VersionModelFile,
} from 'types/typings'
import {
  bytesToSize,
  getFilenameFromUrl,
  getModelTypeFromFilename,
  isDirectFileUrl,
} from 'utils/common'
import { onBeforeMount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import yaml from 'yaml'

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

  // Initial download settings
  // Migrate API keys from user settings to private key
  const init = async () => {
    const res = await request('/download/init', { method: 'POST' })
    store.config.apiKeyInfo.value = res
  }

  onBeforeMount(() => {
    init()

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

type WithSelection<T> = SelectOptions & { item: T }

type FileSelectionVersionModel = VersionModel & {
  currentFileId?: number
  selectionFiles?: WithSelection<VersionModelFile>[]
}

export const useModelSearch = () => {
  const loading = useLoading()
  const { toast } = useToast()
  const data = ref<WithSelection<FileSelectionVersionModel>[]>([])
  const current = ref<string | number>()
  const currentModel = ref<FileSelectionVersionModel>()

  const genFileSelectionItem = (
    item: VersionModel,
  ): FileSelectionVersionModel => {
    const fileSelectionItem: FileSelectionVersionModel = { ...item }
    fileSelectionItem.selectionFiles = fileSelectionItem.files
      ?.sort((file) => (file.type === 'Model' ? -1 : 1))
      .map((file) => {
        const parts = file.name.split('.')
        const extension = `.${parts.pop()}`
        const basename = parts.join('.')

        const regexp = /---\n([\s\S]*?)\n---/
        const yamlMetadataMatch = item.description.match(regexp)
        let yamlMetadata: any = {}
        try {
          yamlMetadata = yaml.parse(yamlMetadataMatch?.[1] || '') || {}
        } catch (e) {
          console.warn('Failed to parse YAML metadata:', e)
          yamlMetadata = {}
        }
        yamlMetadata.hashes = file.hashes
        yamlMetadata.metadata = file.metadata
        const yamlContent = `---\n${yaml.stringify(yamlMetadata)}---`
        const description = item.description.replace(regexp, yamlContent)

        return {
          label: file.type === 'Model' ? upperFirst(item.type) : file.type,
          value: file.id,
          item: file,
          command() {
            if (currentModel.value) {
              currentModel.value.basename = basename
              currentModel.value.extension = extension
              currentModel.value.sizeBytes = file.sizeKB * 1024
              currentModel.value.metadata = file.metadata
              currentModel.value.downloadUrl = file.downloadUrl
              currentModel.value.hashes = file.hashes
              currentModel.value.description = description
              currentModel.value.currentFileId = file.id
            }
          },
        }
      })
    fileSelectionItem.currentFileId = item.files?.[0]?.id
    return fileSelectionItem
  }

  const createDirectFileModel = (
    url: string,
    modelType?: string,
  ): VersionModel => {
    try {
      const filename = getFilenameFromUrl(url)
      const parts = filename.split('.')
      const extension = `.${parts.pop()}`
      const basename = parts.join('.') || 'model'
      const detectedModelType = modelType || getModelTypeFromFilename(filename)

      // Create a proper YAML metadata structure for direct files
      const yamlMetadata = {
        source: 'direct-link',
        original_url: url,
        filename: filename,
        modelType: detectedModelType,
        downloadPlatform: 'Direct Link',
      }

      const description = `---
${Object.entries(yamlMetadata)
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}
---

# Direct File Download

This is a direct download link to a model file. The file size will be determined during download.

**Source:** ${url}
**Filename:** ${filename}
**Type:** ${detectedModelType}`

      return {
        id: `direct-${Date.now()}`,
        basename,
        extension,
        sizeBytes: 0, // Will be determined during download
        type: detectedModelType,
        subFolder: '',
        pathIndex: 0,
        isFolder: false,
        preview: '',
        description,
        metadata: {
          source: 'direct-link',
          original_url: url,
        },
        shortname: basename,
        downloadPlatform: 'Direct Link',
        downloadUrl: url,
        hashes: {},
        files: [
          {
            id: 1,
            sizeKB: 0, // Unknown until download starts
            name: filename,
            type: 'Model',
            metadata: {
              source: 'direct-link',
              original_url: url,
            },
            hashes: {},
            downloadUrl: url,
          },
        ],
      }
    } catch (error) {
      console.error('Error creating direct file model:', error)
      // Return a fallback model
      const fallbackType = modelType || 'checkpoints'
      return {
        id: `direct-${Date.now()}`,
        basename: 'model',
        extension: '.bin',
        sizeBytes: 0,
        type: fallbackType,
        subFolder: '',
        pathIndex: 0,
        isFolder: false,
        preview: '',
        description: `---
source: direct-link
original_url: ${url}
filename: model.bin
modelType: ${fallbackType}
downloadPlatform: Direct Link
---

# Direct File Download

This is a direct download link to a model file.`,
        metadata: {
          source: 'direct-link',
          original_url: url,
        },
        shortname: 'model',
        downloadPlatform: 'Direct Link',
        downloadUrl: url,
        hashes: {},
        files: [
          {
            id: 1,
            sizeKB: 0,
            name: 'model.bin',
            type: 'Model',
            metadata: {
              source: 'direct-link',
              original_url: url,
            },
            hashes: {},
            downloadUrl: url,
          },
        ],
      }
    }
  }

  const handleSearchByUrl = async (url: string, modelType?: string) => {
    if (!url) {
      return Promise.resolve([])
    }

    loading.show()

    // Check if this is a direct file URL
    if (isDirectFileUrl(url)) {
      try {
        // Create a mock model for direct file download
        const directModel = createDirectFileModel(url, modelType)
        const resolvedItem = genFileSelectionItem(directModel)

        data.value = [
          {
            label: directModel.shortname,
            value: directModel.id,
            item: resolvedItem,
            command() {
              current.value = directModel.id
            },
          },
        ]

        current.value = data.value[0]?.value
        currentModel.value = data.value[0]?.item

        loading.hide()
        return [directModel]
      } catch (error) {
        console.error('Error processing direct file URL:', error)
        loading.hide()
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to process direct file URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
          life: 5000,
        })
        return []
      }
    }

    // Original logic for model page URLs
    return request(`/model-info?model-page=${encodeURIComponent(url)}`, {})
      .then((resData: VersionModel[]) => {
        data.value = resData.map((item) => {
          const resolvedItem = genFileSelectionItem(item)
          return {
            label: item.shortname,
            value: item.id,
            item: resolvedItem,
            command() {
              current.value = item.id
            },
          }
        })
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
