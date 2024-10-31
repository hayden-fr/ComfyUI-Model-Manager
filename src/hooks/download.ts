import { useLoading } from 'hooks/loading'
import { MarkdownTool, useMarkdown } from 'hooks/markdown'
import { socket } from 'hooks/socket'
import { defineStore } from 'hooks/store'
import { useToast } from 'hooks/toast'
import { bytesToSize } from 'utils/common'
import { onBeforeMount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export const useDownload = defineStore('download', (store) => {
  const { toast, confirm } = useToast()
  const { t } = useI18n()

  const taskList = ref<DownloadTask[]>([])

  const refresh = () => {
    socket.send('downloadTaskList', null)
  }

  const createTaskItem = (item: DownloadTaskOptions) => {
    const { downloadedSize, totalSize, bps, ...rest } = item

    const task: DownloadTask = {
      ...rest,
      preview: `/model-manager/preview/download/${item.preview}`,
      downloadProgress: `${bytesToSize(downloadedSize)} / ${bytesToSize(totalSize)}`,
      downloadSpeed: `${bytesToSize(bps)}/s`,
      pauseTask() {
        socket.send('pauseDownloadTask', item.taskId)
      },
      resumeTask: () => {
        socket.send('resumeDownloadTask', item.taskId)
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
            socket.send('deleteDownloadTask', item.taskId)
          },
          reject: () => {},
        })
      },
    }

    return task
  }

  onBeforeMount(() => {
    socket.addEventListener('reconnected', () => {
      refresh()
    })

    socket.addEventListener('downloadTaskList', (event) => {
      const data = event.detail as DownloadTaskOptions[]

      taskList.value = data.map((item) => {
        return createTaskItem(item)
      })
    })

    socket.addEventListener('createDownloadTask', (event) => {
      const item = event.detail as DownloadTaskOptions
      taskList.value.unshift(createTaskItem(item))
    })

    socket.addEventListener('updateDownloadTask', (event) => {
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

    socket.addEventListener('deleteDownloadTask', (event) => {
      const taskId = event.detail as string
      taskList.value = taskList.value.filter((item) => item.taskId !== taskId)
    })

    socket.addEventListener('completeDownloadTask', (event) => {
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

abstract class ModelSearch {
  constructor(readonly md: MarkdownTool) {}

  abstract search(pathname: string): Promise<VersionModel[]>
}

class Civitai extends ModelSearch {
  async search(searchUrl: string): Promise<VersionModel[]> {
    const { pathname, searchParams } = new URL(searchUrl)

    const [, modelId] = pathname.match(/^\/models\/(\d*)/) ?? []
    const versionId = searchParams.get('modelVersionId')

    if (!modelId) {
      return Promise.resolve([])
    }

    return fetch(`https://civitai.com/api/v1/models/${modelId}`)
      .then((response) => response.json())
      .then((resData) => {
        const modelVersions: any[] = resData.modelVersions.filter(
          (version: any) => {
            if (versionId) {
              return version.id == versionId
            }
            return true
          },
        )

        const models: VersionModel[] = []

        for (const version of modelVersions) {
          const modelFiles: any[] = version.files.filter(
            (file: any) => file.type === 'Model',
          )

          const shortname = modelFiles.length > 0 ? version.name : undefined

          for (const file of modelFiles) {
            const fullname = file.name
            const extension = `.${fullname.split('.').pop()}`
            const basename = fullname.replace(extension, '')

            models.push({
              id: file.id,
              shortname: shortname ?? basename,
              fullname: fullname,
              basename: basename,
              extension: extension,
              preview: version.images.map((i: any) => i.url),
              sizeBytes: file.sizeKB * 1024,
              type: this.resolveType(resData.type),
              pathIndex: 0,
              description: [
                '---',
                ...[
                  `website: Civitai`,
                  `modelPage: https://civitai.com/models/${modelId}?modelVersionId=${version.id}`,
                  `author: ${resData.creator?.username}`,
                  version.baseModel && `baseModel: ${version.baseModel}`,
                  file.hashes && `hashes:`,
                  ...Object.entries(file.hashes ?? {}).map(
                    ([key, value]) => `  ${key}: ${value}`,
                  ),
                  file.metadata && `metadata:`,
                  ...Object.entries(file.metadata ?? {}).map(
                    ([key, value]) => `  ${key}: ${value}`,
                  ),
                ].filter(Boolean),
                '---',
                '',
                '# Trigger Words',
                `\n${(version.trainedWords ?? ['No trigger words']).join(', ')}\n`,
                '# About this version',
                this.resolveDescription(
                  version.description,
                  '\nNo description about this version\n',
                ),
                `# ${resData.name}`,
                this.resolveDescription(
                  resData.description,
                  'No description about this model',
                ),
              ].join('\n'),
              metadata: file.metadata,
              downloadPlatform: 'civitai',
              downloadUrl: file.downloadUrl,
              hashes: file.hashes,
            })
          }
        }

        return models
      })
  }

  private resolveType(type: string) {
    const mapLegacy = {
      TextualInversion: 'embeddings',
      LoCon: 'loras',
      DoRA: 'loras',
      Controlnet: 'controlnet',
      Upscaler: 'upscale_models',
      VAE: 'vae',
    }
    return mapLegacy[type] ?? `${type.toLowerCase()}s`
  }

  private resolveDescription(content: string, defaultContent: string) {
    const mdContent = this.md.parse(content ?? '').trim()
    return mdContent || defaultContent
  }
}

class Huggingface extends ModelSearch {
  async search(searchUrl: string): Promise<VersionModel[]> {
    const { pathname } = new URL(searchUrl)
    const [, space, name, ...restPaths] = pathname.split('/')

    if (!space || !name) {
      return Promise.resolve([])
    }

    const modelId = `${space}/${name}`
    const restPathname = restPaths.join('/')

    return fetch(`https://huggingface.co/api/models/${modelId}`)
      .then((response) => response.json())
      .then((resData) => {
        const siblingFiles: string[] = resData.siblings.map(
          (item: any) => item.rfilename,
        )

        const modelFiles: string[] = this.filterTreeFiles(
          this.filterModelFiles(siblingFiles),
          restPathname,
        )
        const images: string[] = this.filterTreeFiles(
          this.filterImageFiles(siblingFiles),
          restPathname,
        ).map((filename) => {
          return `https://huggingface.co/${modelId}/resolve/main/${filename}`
        })

        const models: VersionModel[] = []

        for (const filename of modelFiles) {
          const fullname = filename.split('/').pop()!
          const extension = `.${fullname.split('.').pop()}`
          const basename = fullname.replace(extension, '')

          models.push({
            id: filename,
            shortname: filename,
            fullname: fullname,
            basename: basename,
            extension: extension,
            preview: images,
            sizeBytes: 0,
            type: 'unknown',
            pathIndex: 0,
            description: [
              '---',
              ...[
                `website: HuggingFace`,
                `modelPage: https://huggingface.co/${modelId}`,
                `author: ${resData.author}`,
              ].filter(Boolean),
              '---',
              '',
              '# Trigger Words',
              '\nNo trigger words\n',
              '# About this version',
              '\nNo description about this version\n',
              `# ${resData.modelId}`,
              '\nNo description about this model\n',
            ].join('\n'),
            metadata: {},
            downloadPlatform: 'huggingface',
            downloadUrl: `https://huggingface.co/${modelId}/resolve/main/${filename}?download=true`,
          })
        }

        return models
      })
  }

  private filterTreeFiles(files: string[], pathname: string) {
    const [target, , ...paths] = pathname.split('/')

    if (!target) return files

    if (target !== 'tree' && target !== 'blob') return files

    const pathPrefix = paths.join('/')
    return files.filter((file) => {
      return file.startsWith(pathPrefix)
    })
  }

  private filterModelFiles(files: string[]) {
    const extension = [
      '.bin',
      '.ckpt',
      '.gguf',
      '.onnx',
      '.pt',
      '.pth',
      '.safetensors',
    ]
    return files.filter((file) => {
      const ext = file.split('.').pop()
      return ext ? extension.includes(`.${ext}`) : false
    })
  }

  private filterImageFiles(files: string[]) {
    const extension = [
      '.png',
      '.webp',
      '.jpeg',
      '.jpg',
      '.jfif',
      '.gif',
      '.apng',
    ]

    return files.filter((file) => {
      const ext = file.split('.').pop()
      return ext ? extension.includes(`.${ext}`) : false
    })
  }
}

class UnknownWebsite extends ModelSearch {
  async search(searchUrl: string): Promise<VersionModel[]> {
    return Promise.reject(
      new Error(
        'Unknown Website, please input a URL from huggingface.co or civitai.com.',
      ),
    )
  }
}

export const useModelSearch = () => {
  const loading = useLoading()
  const md = useMarkdown()
  const { toast } = useToast()
  const data = ref<(SelectOptions & { item: VersionModel })[]>([])
  const current = ref<string | number>()
  const currentModel = ref<BaseModel>()

  const handleSearchByUrl = async (url: string) => {
    if (!url) {
      return Promise.resolve([])
    }

    let instance: ModelSearch = new UnknownWebsite(md)

    const { hostname } = new URL(url ?? '')

    if (hostname === 'civitai.com') {
      instance = new Civitai(md)
    }

    if (hostname === 'huggingface.co') {
      instance = new Huggingface(md)
    }

    loading.show()
    return instance
      .search(url)
      .then((resData) => {
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
