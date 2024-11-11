import { app } from 'scripts/comfyAPI'

const LiteGraph = window.LiteGraph

const modelNodeType = {
  checkpoints: 'CheckpointLoaderSimple',
  clip: 'CLIPLoader',
  clip_vision: 'CLIPVisionLoader',
  controlnet: 'ControlNetLoader',
  diffusers: 'DiffusersLoader',
  embeddings: 'Embedding',
  gligen: 'GLIGENLoader',
  hypernetworks: 'HypernetworkLoader',
  photomaker: 'PhotoMakerLoader',
  loras: 'LoraLoader',
  style_models: 'StyleModelLoader',
  unet: 'UNETLoader',
  upscale_models: 'UpscaleModelLoader',
  vae: 'VAELoader',
  vae_approx: undefined,
}

export class ModelGrid {
  /**
   * @param {string} nodeType
   * @returns {int}
   */
  static modelWidgetIndex(nodeType) {
    return nodeType === undefined ? -1 : 0
  }

  /**
   * @param {string} text
   * @param {string} file
   * @param {boolean} removeExtension
   * @returns {string}
   */
  static insertEmbeddingIntoText(text, file, removeExtension) {
    let name = file
    if (removeExtension) {
      name = SearchPath.splitExtension(name)[0]
    }
    const sep = text.length === 0 || text.slice(-1).match(/\s/) ? '' : ' '
    return text + sep + '(embedding:' + name + ':1.0)'
  }

  /**
   * @param {Array} list
   * @param {string} searchString
   * @returns {Array}
   */
  static #filter(list, searchString) {
    /** @type {string[]} */
    const keywords = searchString
      //.replace("*", " ") // TODO: this is wrong for wildcards
      .split(/(-?".*?"|[^\s"]+)+/g)
      .map((item) =>
        item
          .trim()
          .replace(/(?:")+/g, '')
          .toLowerCase(),
      )
      .filter(Boolean)

    const regexSHA256 = /^[a-f0-9]{64}$/gi
    const fields = ['name', 'path']
    return list.filter((element) => {
      const text = fields
        .reduce((memo, field) => memo + ' ' + element[field], '')
        .toLowerCase()
      return keywords.reduce((memo, target) => {
        const excludeTarget = target[0] === '-'
        if (excludeTarget && target.length === 1) {
          return memo
        }
        const filteredTarget = excludeTarget ? target.slice(1) : target
        if (
          element['SHA256'] !== undefined &&
          regexSHA256.test(filteredTarget)
        ) {
          return (
            memo && excludeTarget !== (filteredTarget === element['SHA256'])
          )
        } else {
          return memo && excludeTarget !== text.includes(filteredTarget)
        }
      }, true)
    })
  }

  /**
   * In-place sort. Returns an array alias.
   * @param {Array} list
   * @param {string} sortBy
   * @param {bool} [reverse=false]
   * @returns {Array}
   */
  static #sort(list, sortBy, reverse = false) {
    let compareFn = null
    switch (sortBy) {
      case MODEL_SORT_DATE_NAME:
        compareFn = (a, b) => {
          return a[MODEL_SORT_DATE_NAME].localeCompare(b[MODEL_SORT_DATE_NAME])
        }
        break
      case MODEL_SORT_DATE_MODIFIED:
        compareFn = (a, b) => {
          return b[MODEL_SORT_DATE_MODIFIED] - a[MODEL_SORT_DATE_MODIFIED]
        }
        break
      case MODEL_SORT_DATE_CREATED:
        compareFn = (a, b) => {
          return b[MODEL_SORT_DATE_CREATED] - a[MODEL_SORT_DATE_CREATED]
        }
        break
      case MODEL_SORT_SIZE_BYTES:
        compareFn = (a, b) => {
          return b[MODEL_SORT_SIZE_BYTES] - a[MODEL_SORT_SIZE_BYTES]
        }
        break
      default:
        console.warn("Invalid filter sort value: '" + sortBy + "'")
        return list
    }
    const sorted = list.sort(compareFn)
    return reverse ? sorted.reverse() : sorted
  }

  /**
   * @param {Event} event
   * @param {string} modelType
   * @param {string} path
   * @param {boolean} removeEmbeddingExtension
   * @param {int} addOffset
   */
  static #addModel(
    event,
    modelType,
    path,
    removeEmbeddingExtension,
    addOffset,
  ) {
    let success = false
    if (modelType !== 'embeddings') {
      const nodeType = modelNodeType[modelType]
      const widgetIndex = ModelGrid.modelWidgetIndex(nodeType)
      let node = LiteGraph.createNode(nodeType, null, [])
      if (widgetIndex !== -1 && node) {
        node.widgets[widgetIndex].value = path
        const selectedNodes = app.canvas.selected_nodes
        let isSelectedNode = false
        for (var i in selectedNodes) {
          const selectedNode = selectedNodes[i]
          node.pos[0] = selectedNode.pos[0] + addOffset
          node.pos[1] = selectedNode.pos[1] + addOffset
          isSelectedNode = true
          break
        }
        if (!isSelectedNode) {
          const graphMouse = app.canvas.graph_mouse
          node.pos[0] = graphMouse[0]
          node.pos[1] = graphMouse[1]
        }
        app.graph.add(node, { doProcessChange: true })
        app.canvas.selectNode(node)
        success = true
      }
      event.stopPropagation()
    } else if (modelType === 'embeddings') {
      const [embeddingDirectory, embeddingFile] = SearchPath.split(path)
      const selectedNodes = app.canvas.selected_nodes
      for (var i in selectedNodes) {
        const selectedNode = selectedNodes[i]
        const nodeType = modelNodeType[modelType]
        const widgetIndex = ModelGrid.modelWidgetIndex(nodeType)
        const target = selectedNode?.widgets[widgetIndex]?.element
        if (target && target.type === 'textarea') {
          target.value = ModelGrid.insertEmbeddingIntoText(
            target.value,
            embeddingFile,
            removeEmbeddingExtension,
          )
          success = true
        }
      }
      if (!success) {
        console.warn('Try selecting a node before adding the embedding.')
      }
      event.stopPropagation()
    }
    comfyButtonAlert(event.target, success, 'mdi-check-bold', 'mdi-close-thick')
  }

  static #getWidgetComboIndices(node, value) {
    const widgetIndices = []
    node?.widgets?.forEach((widget, index) => {
      if (widget.type === 'combo' && widget.options.values?.includes(value)) {
        widgetIndices.push(index)
      }
    })
    return widgetIndices
  }

  /**
   * @param {DragEvent} event
   * @param {string} modelType
   * @param {string} path
   * @param {boolean} removeEmbeddingExtension
   * @param {boolean} strictlyOnWidget
   */
  static dragAddModel(
    event,
    modelType,
    path,
    removeEmbeddingExtension,
    strictlyOnWidget,
  ) {
    const target = document.elementFromPoint(event.clientX, event.clientY)
    if (modelType !== 'embeddings' && target.id === 'graph-canvas') {
      const pos = app.canvas.convertEventToCanvasOffset(event)

      const node = app.graph.getNodeOnPos(
        pos[0],
        pos[1],
        app.canvas.visible_nodes,
      )

      let widgetIndex = -1
      if (widgetIndex === -1) {
        const widgetIndices = this.#getWidgetComboIndices(node, path)
        if (widgetIndices.length === 0) {
          widgetIndex = -1
        } else if (widgetIndices.length === 1) {
          widgetIndex = widgetIndices[0]
          if (strictlyOnWidget) {
            const draggedWidget = app.canvas.processNodeWidgets(
              node,
              pos,
              event,
            )
            const widget = node.widgets[widgetIndex]
            if (draggedWidget != widget) {
              // != check NOT same object
              widgetIndex = -1
            }
          }
        } else {
          // ambiguous widget (strictlyOnWidget always true)
          const draggedWidget = app.canvas.processNodeWidgets(node, pos, event)
          widgetIndex = widgetIndices.findIndex((index) => {
            return draggedWidget == node.widgets[index] // == check same object
          })
        }
      }

      if (widgetIndex !== -1) {
        node.widgets[widgetIndex].value = path
        app.canvas.selectNode(node)
      } else {
        const expectedNodeType = modelNodeType[modelType]
        const newNode = LiteGraph.createNode(expectedNodeType, null, [])
        let newWidgetIndex = ModelGrid.modelWidgetIndex(expectedNodeType)
        if (newWidgetIndex === -1) {
          newWidgetIndex = this.#getWidgetComboIndices(newNode, path)[0] ?? -1
        }
        if (
          newNode !== undefined &&
          newNode !== null &&
          newWidgetIndex !== -1
        ) {
          newNode.pos[0] = pos[0]
          newNode.pos[1] = pos[1]
          newNode.widgets[newWidgetIndex].value = path
          app.graph.add(newNode, { doProcessChange: true })
          app.canvas.selectNode(newNode)
        }
      }
      event.stopPropagation()
    } else if (modelType === 'embeddings' && target.type === 'textarea') {
      const pos = app.canvas.convertEventToCanvasOffset(event)
      const nodeAtPos = app.graph.getNodeOnPos(
        pos[0],
        pos[1],
        app.canvas.visible_nodes,
      )
      if (nodeAtPos) {
        app.canvas.selectNode(nodeAtPos)
        const [embeddingDirectory, embeddingFile] = SearchPath.split(path)
        target.value = ModelGrid.insertEmbeddingIntoText(
          target.value,
          embeddingFile,
          removeEmbeddingExtension,
        )
        event.stopPropagation()
      }
    }
  }

  /**
   * @param {Event} event
   * @param {string} modelType
   * @param {string} path
   * @param {boolean} removeEmbeddingExtension
   */
  static #copyModelToClipboard(
    event,
    modelType,
    path,
    removeEmbeddingExtension,
  ) {
    const nodeType = modelNodeType[modelType]
    let success = false
    if (nodeType === 'Embedding') {
      if (navigator.clipboard) {
        const [embeddingDirectory, embeddingFile] = SearchPath.split(path)
        const embeddingText = ModelGrid.insertEmbeddingIntoText(
          '',
          embeddingFile,
          removeEmbeddingExtension,
        )
        navigator.clipboard.writeText(embeddingText)
        success = true
      } else {
        console.warn(
          'Cannot copy the embedding to the system clipboard; Try dragging it instead.',
        )
      }
    } else if (nodeType) {
      const node = LiteGraph.createNode(nodeType, null, [])
      const widgetIndex = ModelGrid.modelWidgetIndex(nodeType)
      if (widgetIndex !== -1) {
        node.widgets[widgetIndex].value = path
        app.canvas.copyToClipboard([node])
        success = true
      }
    } else {
      console.warn(`Unable to copy unknown model type '${modelType}.`)
    }
    comfyButtonAlert(event.target, success, 'mdi-check-bold', 'mdi-close-thick')
  }

  /**
   * @param {Array} models
   * @param {string} modelType
   * @param {Object.<HTMLInputElement>} settingsElements
   * @param {String} searchSeparator
   * @param {String} systemSeparator
   * @param {(searchPath: string) => Promise<void>} showModelInfo
   * @returns {HTMLElement[]}
   */
  static #generateInnerHtml(
    models,
    modelType,
    settingsElements,
    searchSeparator,
    systemSeparator,
    showModelInfo,
  ) {
    // TODO: separate text and model logic; getting too messy
    // TODO: fallback on button failure to copy text?
    const canShowButtons = modelNodeType[modelType] !== undefined
    const showAddButton =
      canShowButtons && settingsElements['model-show-add-button'].checked
    const showCopyButton =
      canShowButtons && settingsElements['model-show-copy-button'].checked
    const showLoadWorkflowButton =
      canShowButtons &&
      settingsElements['model-show-load-workflow-button'].checked
    const strictDragToAdd =
      settingsElements['model-add-drag-strict-on-field'].checked
    const addOffset = parseInt(settingsElements['model-add-offset'].value)
    const showModelExtension =
      settingsElements['model-show-label-extensions'].checked
    const modelInfoButtonOnLeft =
      !settingsElements['model-info-button-on-left'].checked
    const removeEmbeddingExtension =
      !settingsElements['model-add-embedding-extension'].checked
    const previewThumbnailFormat =
      settingsElements['model-preview-thumbnail-type'].value
    const previewThumbnailWidth = Math.round(
      settingsElements['model-preview-thumbnail-width'].value / 0.75,
    )
    const previewThumbnailHeight = Math.round(
      settingsElements['model-preview-thumbnail-height'].value / 0.75,
    )
    const buttonsOnlyOnHover =
      settingsElements['model-buttons-only-on-hover'].checked
    if (models.length > 0) {
      const $overlay = IS_FIREFOX
        ? (modelType, path, removeEmbeddingExtension, strictDragToAdd) => {
            return $el('div.model-preview-overlay', {
              ondragstart: (e) => {
                const data = {
                  modelType: modelType,
                  path: path,
                  removeEmbeddingExtension: removeEmbeddingExtension,
                  strictDragToAdd: strictDragToAdd,
                }
                e.dataTransfer.setData('manager-model', JSON.stringify(data))
                e.dataTransfer.setData('text/plain', '')
              },
              draggable: true,
            })
          }
        : (modelType, path, removeEmbeddingExtension, strictDragToAdd) => {
            return $el('div.model-preview-overlay', {
              ondragend: (e) =>
                ModelGrid.dragAddModel(
                  e,
                  modelType,
                  path,
                  removeEmbeddingExtension,
                  strictDragToAdd,
                ),
              draggable: true,
            })
          }
      const forHiddingButtonsClass = buttonsOnlyOnHover
        ? 'model-buttons-hidden'
        : 'model-buttons-visible'

      return models.map((item) => {
        const previewInfo = item.preview
        const previewThumbnail = $el('img.model-preview', {
          loading:
            'lazy' /* `loading` BEFORE `src`; Known bug in Firefox 124.0.2 and Safari for iOS 17.4.1 (https://stackoverflow.com/a/76252772) */,
          src: imageUri(
            previewInfo?.path,
            previewInfo?.dateModified,
            previewThumbnailWidth,
            previewThumbnailHeight,
            previewThumbnailFormat,
          ),
          draggable: false,
        })
        const searchPath = item.path
        const path = SearchPath.systemPath(
          searchPath,
          searchSeparator,
          systemSeparator,
        )
        let actionButtons = []
        if (showCopyButton) {
          actionButtons.push(
            new ComfyButton({
              icon: 'content-copy',
              tooltip: 'Copy model to clipboard',
              classList: 'comfyui-button icon-button model-button',
              action: (e) =>
                ModelGrid.#copyModelToClipboard(
                  e,
                  modelType,
                  path,
                  removeEmbeddingExtension,
                ),
            }).element,
          )
        }
        if (
          showAddButton &&
          !(modelType === 'embeddings' && !navigator.clipboard)
        ) {
          actionButtons.push(
            new ComfyButton({
              icon: 'plus-box-outline',
              tooltip: 'Add model to node grid',
              classList: 'comfyui-button icon-button model-button',
              action: (e) =>
                ModelGrid.#addModel(
                  e,
                  modelType,
                  path,
                  removeEmbeddingExtension,
                  addOffset,
                ),
            }).element,
          )
        }
        if (showLoadWorkflowButton) {
          actionButtons.push(
            new ComfyButton({
              icon: 'arrow-bottom-left-bold-box-outline',
              tooltip: 'Load preview workflow',
              classList: 'comfyui-button icon-button model-button',
              action: async (e) => {
                const urlString = previewThumbnail.src
                const url = new URL(urlString)
                const urlSearchParams = url.searchParams
                const uri = urlSearchParams.get('uri')
                const v = urlSearchParams.get('v')
                const urlFull =
                  urlString.substring(0, urlString.indexOf('?')) +
                  '?uri=' +
                  uri +
                  '&v=' +
                  v
                await loadWorkflow(urlFull)
              },
            }).element,
          )
        }
        const infoButtons = [
          new ComfyButton({
            icon: 'information-outline',
            tooltip: 'View model information',
            classList: 'comfyui-button icon-button model-button',
            action: async () => {
              await showModelInfo(searchPath)
            },
          }).element,
        ]
        return $el('div.item', {}, [
          previewThumbnail,
          $overlay(modelType, path, removeEmbeddingExtension, strictDragToAdd),
          $el(
            'div.model-preview-top-right.' + forHiddingButtonsClass,
            {
              draggable: false,
            },
            modelInfoButtonOnLeft ? infoButtons : actionButtons,
          ),
          $el(
            'div.model-preview-top-left.' + forHiddingButtonsClass,
            {
              draggable: false,
            },
            modelInfoButtonOnLeft ? actionButtons : infoButtons,
          ),
          $el(
            'div.model-label',
            {
              draggable: false,
            },
            [
              $el('p', [
                showModelExtension
                  ? item.name
                  : SearchPath.splitExtension(item.name)[0],
              ]),
            ],
          ),
        ])
      })
    } else {
      return [$el('h2', ['No Models'])]
    }
  }

  /**
   * @param {HTMLDivElement} modelGrid
   * @param {ModelData} modelData
   * @param {HTMLSelectElement} modelSelect
   * @param {Object.<{value: string}>} previousModelType
   * @param {Object} settings
   * @param {string} sortBy
   * @param {boolean} reverseSort
   * @param {Array} previousModelFilters
   * @param {HTMLInputElement} modelFilter
   * @param {(searchPath: string) => Promise<void>} showModelInfo
   */
  static update(
    modelGrid,
    modelData,
    modelSelect,
    previousModelType,
    settings,
    sortBy,
    reverseSort,
    previousModelFilters,
    modelFilter,
    showModelInfo,
  ) {
    const models = modelData.models
    let modelType = modelSelect.value
    if (models[modelType] === undefined) {
      modelType = settings['model-default-browser-model-type'].value
    }
    if (models[modelType] === undefined) {
      modelType = 'checkpoints' // panic fallback
    }

    if (modelType !== previousModelType.value) {
      if (settings['model-persistent-search'].checked) {
        previousModelFilters.splice(0, previousModelFilters.length) // TODO: make sure this actually worked!
      } else {
        // cache previous filter text
        previousModelFilters[previousModelType.value] = modelFilter.value
        // read cached filter text
        modelFilter.value = previousModelFilters[modelType] ?? ''
      }
      previousModelType.value = modelType
    }

    let modelTypeOptions = []
    for (const [key, value] of Object.entries(models)) {
      const el = $el('option', [key])
      modelTypeOptions.push(el)
    }
    modelSelect.innerHTML = ''
    modelTypeOptions.forEach((option) => modelSelect.add(option))
    modelSelect.value = modelType

    const searchAppend = settings['model-search-always-append'].value
    const searchText = modelFilter.value + ' ' + searchAppend
    const modelList = ModelGrid.#filter(models[modelType], searchText)
    ModelGrid.#sort(modelList, sortBy, reverseSort)

    modelGrid.innerHTML = ''
    const modelGridModels = ModelGrid.#generateInnerHtml(
      modelList,
      modelType,
      settings,
      modelData.searchSeparator,
      modelData.systemSeparator,
      showModelInfo,
    )
    modelGrid.append.apply(modelGrid, modelGridModels)
  }
}
