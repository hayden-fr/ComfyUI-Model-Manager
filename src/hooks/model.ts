import { useConfig } from 'hooks/config'
import { useLoading } from 'hooks/loading'
import { useMarkdown } from 'hooks/markdown'
import { request, useRequest } from 'hooks/request'
import { defineStore } from 'hooks/store'
import { useToast } from 'hooks/toast'
import { cloneDeep } from 'lodash'
import { app } from 'scripts/comfyAPI'
import { BaseModel, Model, SelectEvent } from 'types/typings'
import { bytesToSize, formatDate } from 'utils/common'
import { ModelGrid } from 'utils/legacy'
import { genModelKey, resolveModelTypeLoader } from 'utils/model'
import {
  computed,
  inject,
  InjectionKey,
  onMounted,
  provide,
  ref,
  toRaw,
  unref,
} from 'vue'
import { useI18n } from 'vue-i18n'

export const useModels = defineStore('models', (store) => {
  const { data, refresh } = useRequest<Model[]>('/models', { defaultValue: [] })
  const { toast, confirm } = useToast()
  const { t } = useI18n()
  const loading = useLoading()

  const updateModel = async (model: BaseModel, data: BaseModel) => {
    const updateData = new Map()
    let oldKey: string | null = null

    // Check current preview
    if (model.preview !== data.preview) {
      updateData.set('previewFile', data.preview)
    }

    // Check current description
    if (model.description !== data.description) {
      updateData.set('description', data.description)
    }

    // Check current name and pathIndex
    if (
      model.fullname !== data.fullname ||
      model.pathIndex !== data.pathIndex
    ) {
      oldKey = genModelKey(model)
      updateData.set('type', data.type)
      updateData.set('pathIndex', data.pathIndex.toString())
      updateData.set('fullname', data.fullname)
    }

    if (updateData.size === 0) {
      return
    }

    loading.show()
    await request(`/model/${model.type}/${model.pathIndex}/${model.fullname}`, {
      method: 'PUT',
      body: JSON.stringify(Object.fromEntries(updateData.entries())),
    })
      .catch((err) => {
        const error_message = err.message ?? err.error
        toast.add({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to update model: ${error_message}`,
          life: 15000,
        })
        throw new Error(error_message)
      })
      .finally(() => {
        loading.hide()
      })

    if (oldKey) {
      store.dialog.close({ key: oldKey })
    }

    refresh()
  }

  const deleteModel = async (model: BaseModel) => {
    return new Promise((resolve) => {
      confirm.require({
        message: t('deleteAsk', [t('model').toLowerCase()]),
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
          const dialogKey = genModelKey(model)
          loading.show()
          request(`/model/${model.type}/${model.pathIndex}/${model.fullname}`, {
            method: 'DELETE',
          })
            .then(() => {
              toast.add({
                severity: 'success',
                summary: 'Success',
                detail: `${model.fullname} Deleted`,
                life: 2000,
              })
              store.dialog.close({ key: dialogKey })
              return refresh()
            })
            .then(() => {
              resolve(void 0)
            })
            .catch((e) => {
              toast.add({
                severity: 'error',
                summary: 'Error',
                detail: e.message ?? 'Failed to delete model',
                life: 15000,
              })
            })
            .finally(() => {
              loading.hide()
            })
        },
        reject: () => {
          resolve(void 0)
        },
      })
    })
  }

  return { data, refresh, remove: deleteModel, update: updateModel }
})

declare module 'hooks/store' {
  interface StoreProvider {
    models: ReturnType<typeof useModels>
  }
}

export const useModelFormData = (getFormData: () => BaseModel) => {
  const formData = ref<BaseModel>(getFormData())
  const modelData = ref<BaseModel>(getFormData())

  type ResetCallback = () => void
  const resetCallback = ref<ResetCallback[]>([])

  const registerReset = (callback: ResetCallback) => {
    resetCallback.value.push(callback)
  }

  const reset = () => {
    formData.value = getFormData()
    modelData.value = getFormData()
    for (const callback of resetCallback.value) {
      callback()
    }
  }

  type SubmitCallback = (data: BaseModel) => void
  const submitCallback = ref<SubmitCallback[]>([])

  const registerSubmit = (callback: SubmitCallback) => {
    submitCallback.value.push(callback)
  }

  const submit = () => {
    const data = cloneDeep(toRaw(unref(formData)))
    for (const callback of submitCallback.value) {
      callback(data)
    }
    return data
  }

  const metadata = ref<Record<string, any>>({})

  return {
    formData,
    modelData,
    registerReset,
    reset,
    registerSubmit,
    submit,
    metadata,
  }
}

type ModelFormInstance = ReturnType<typeof useModelFormData>

/**
 * Model base info
 */
const baseInfoKey = Symbol('baseInfo') as InjectionKey<
  ReturnType<typeof useModelBaseInfoEditor>
>

export const useModelBaseInfoEditor = (formInstance: ModelFormInstance) => {
  const { formData: model, modelData } = formInstance

  const { modelFolders } = useConfig()

  const type = computed({
    get: () => {
      return model.value.type
    },
    set: (val) => {
      model.value.type = val
    },
  })

  const pathIndex = computed({
    get: () => {
      return model.value.pathIndex
    },
    set: (val) => {
      model.value.pathIndex = val
    },
  })

  const extension = computed(() => {
    return model.value.extension
  })

  const basename = computed({
    get: () => {
      return model.value.fullname.replace(model.value.extension, '')
    },
    set: (val) => {
      model.value.fullname = `${val ?? ''}${model.value.extension}`
    },
  })

  interface BaseInfoItem {
    key: string
    display: string
    value: any
  }

  interface FieldsItem {
    key: keyof Model
    formatter: (val: any) => string | undefined | null
  }

  const baseInfo = computed(() => {
    const fields: FieldsItem[] = [
      {
        key: 'type',
        formatter: () =>
          modelData.value.type in modelFolders.value
            ? modelData.value.type
            : undefined,
      },
      {
        key: 'pathIndex',
        formatter: () => {
          const modelType = modelData.value.type
          const pathIndex = modelData.value.pathIndex
          const folders = modelFolders.value[modelType] ?? []
          return `${folders[pathIndex]}`
        },
      },
      {
        key: 'fullname',
        formatter: (val) => val,
      },
      {
        key: 'sizeBytes',
        formatter: (val) => (val == 0 ? 'Unknown' : bytesToSize(val)),
      },
      {
        key: 'createdAt',
        formatter: (val) => val && formatDate(val),
      },
      {
        key: 'updatedAt',
        formatter: (val) => val && formatDate(val),
      },
    ]

    const information: Record<string, BaseInfoItem> = {}
    for (const item of fields) {
      const key = item.key
      const value = model.value[key]
      const display = item.formatter(value)

      if (display) {
        information[key] = { key, value, display }
      }
    }

    return information
  })

  const result = {
    type,
    baseInfo,
    basename,
    extension,
    pathIndex,
  }

  provide(baseInfoKey, result)

  return result
}

export const useModelBaseInfo = () => {
  return inject(baseInfoKey)!
}

/**
 * Editable preview image.
 *
 * In edit mode, there are 4 methods for setting a preview picture:
 * 1. default value, which is the default image of the model type
 * 2. network picture
 * 3. local file
 * 4. no preview
 */
const previewKey = Symbol('preview') as InjectionKey<
  ReturnType<typeof useModelPreviewEditor>
>

export const useModelPreviewEditor = (formInstance: ModelFormInstance) => {
  const { formData: model, registerReset, registerSubmit } = formInstance

  const typeOptions = ref(['default', 'network', 'local', 'none'])
  const currentType = ref('default')

  /**
   * Default images
   */
  const defaultContent = computed(() => {
    return Array.isArray(model.value.preview)
      ? model.value.preview
      : [model.value.preview]
  })
  const defaultContentPage = ref(0)

  /**
   * Network picture url
   */
  const networkContent = ref<string>()

  /**
   * Local file url
   */
  const localContent = ref<string>()
  const updateLocalContent = async (event: SelectEvent) => {
    const { files } = event
    localContent.value = files[0].objectURL
  }

  /**
   * No preview
   */
  const noPreviewContent = computed(() => {
    return `/model-manager/preview/${model.value.type}/0/no-preview.png`
  })

  const preview = computed(() => {
    let content: string | undefined

    switch (currentType.value) {
      case 'default':
        content = defaultContent.value[defaultContentPage.value]
        break
      case 'network':
        content = networkContent.value
        break
      case 'local':
        content = localContent.value
        break
      default:
        content = noPreviewContent.value
        break
    }

    return content
  })

  onMounted(() => {
    registerReset(() => {
      currentType.value = 'default'
      defaultContentPage.value = 0
      networkContent.value = undefined
      localContent.value = undefined
    })

    registerSubmit((data) => {
      data.preview = preview.value ?? noPreviewContent.value
    })
  })

  const result = {
    preview,
    typeOptions,
    currentType,
    // default value
    defaultContent,
    defaultContentPage,
    // network picture
    networkContent,
    // local file
    localContent,
    updateLocalContent,
    // no preview
    noPreviewContent,
  }

  provide(previewKey, result)

  return result
}

export const useModelPreview = () => {
  return inject(previewKey)!
}

/**
 * Model description
 */
const descriptionKey = Symbol('description') as InjectionKey<
  ReturnType<typeof useModelDescriptionEditor>
>

export const useModelDescriptionEditor = (formInstance: ModelFormInstance) => {
  const { formData: model, metadata } = formInstance

  const md = useMarkdown({ metadata: metadata.value })

  const description = computed({
    get: () => {
      return model.value.description
    },
    set: (val) => {
      model.value.description = val
    },
  })

  const renderedDescription = computed(() => {
    return description.value ? md.render(description.value) : undefined
  })

  const result = { renderedDescription, description }

  provide(descriptionKey, result)

  return result
}

export const useModelDescription = () => {
  return inject(descriptionKey)!
}

/**
 * Model metadata
 */
const metadataKey = Symbol('metadata') as InjectionKey<
  ReturnType<typeof useModelMetadataEditor>
>

export const useModelMetadataEditor = (formInstance: ModelFormInstance) => {
  const { formData: model } = formInstance

  const metadata = computed(() => {
    return model.value.metadata
  })

  const result = { metadata }

  provide(metadataKey, result)

  return result
}

export const useModelMetadata = () => {
  return inject(metadataKey)!
}

export const useModelNodeAction = (model: BaseModel) => {
  const { t } = useI18n()
  const { toast, wrapperToastError } = useToast()

  const createNode = (options: Record<string, any> = {}) => {
    const nodeType = resolveModelTypeLoader(model.type)
    if (!nodeType) {
      throw new Error(t('unSupportedModelType', [model.type]))
    }

    const node = window.LiteGraph.createNode(nodeType, null, options)
    const widgetIndex = node.widgets.findIndex((w) => w.type === 'combo')
    if (widgetIndex > -1) {
      node.widgets[widgetIndex].value = model.fullname
    }
    return node
  }

  const dragToAddModelNode = wrapperToastError((event: DragEvent) => {
    // const target = document.elementFromPoint(event.clientX, event.clientY)
    // if (
    //   target?.tagName.toLocaleLowerCase() === 'canvas' &&
    //   target.id === 'graph-canvas'
    // ) {
    //   const pos = app.clientPosToCanvasPos([event.clientX - 20, event.clientY])
    //   const node = createNode({ pos })
    //   app.graph.add(node)
    //   app.canvas.selectNode(node)
    // }
    //
    // Use the legacy method instead
    const removeEmbeddingExtension = true
    const strictDragToAdd = false

    ModelGrid.dragAddModel(
      event,
      model.type,
      model.fullname,
      removeEmbeddingExtension,
      strictDragToAdd,
    )
  })

  const addModelNode = wrapperToastError(() => {
    const selectedNodes = app.canvas.selected_nodes
    const firstSelectedNode = Object.values(selectedNodes)[0]
    const offset = 25
    const pos = firstSelectedNode
      ? [firstSelectedNode.pos[0] + offset, firstSelectedNode.pos[1] + offset]
      : app.canvas.canvas_mouse
    const node = createNode({ pos })
    app.graph.add(node)
    app.canvas.selectNode(node)
  })

  const copyModelNode = wrapperToastError(() => {
    const node = createNode()
    app.canvas.copyToClipboard([node])
    toast.add({
      severity: 'success',
      summary: 'Success',
      detail: t('modelCopied'),
      life: 2000,
    })
  })

  const loadPreviewWorkflow = wrapperToastError(async () => {
    const previewUrl = model.preview as string
    const response = await fetch(previewUrl)
    const data = await response.blob()
    const type = data.type
    const extension = type.split('/').pop()
    const file = new File([data], `${model.fullname}.${extension}`, { type })
    app.handleFile(file)
  })

  return {
    addModelNode,
    dragToAddModelNode,
    copyModelNode,
    loadPreviewWorkflow,
  }
}
