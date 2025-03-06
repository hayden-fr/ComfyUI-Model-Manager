import { genModelFullName, useModels } from 'hooks/model'
import { cloneDeep, filter, find } from 'lodash'
import { BaseModel, Model, SelectOptions } from 'types/typings'
import { computed, ref, watch } from 'vue'

export interface FolderPathItem {
  name: string
  pathIndex: number
  icon?: string
  onClick: () => void
  children: SelectOptions[]
}

export type ModelFolder = BaseModel & {
  children: ModelTreeNode[]
}

export type ModelItem = Model

export type ModelTreeNode = BaseModel & {
  children?: ModelTreeNode[]
}

export type TreeItemNode = ModelTreeNode & {
  onDbClick: () => void
  onContextMenu: () => void
}

export const useModelExplorer = () => {
  const { data, folders, initialized, ...modelRest } = useModels()

  const folderPaths = ref<FolderPathItem[]>([])

  const genFolderItem = (
    basename: string,
    folder?: string,
    subFolder?: string,
  ): ModelFolder => {
    return {
      id: basename,
      basename: basename,
      subFolder: subFolder ?? '',
      pathIndex: 0,
      sizeBytes: 0,
      extension: '',
      description: '',
      metadata: {},
      preview: '',
      previewType: 'image',
      type: folder ?? '',
      isFolder: true,
      children: [],
    }
  }

  const dataTreeList = computed<ModelTreeNode[]>(() => {
    const rootChildren: ModelTreeNode[] = []

    for (const folder in folders.value) {
      if (Object.prototype.hasOwnProperty.call(folders.value, folder)) {
        const folderItem = genFolderItem(folder)

        const folderModels = cloneDeep(data.value[folder]) ?? []

        const pathMap: Record<string, ModelTreeNode> = Object.fromEntries(
          folderModels.map((item) => [
            `${item.pathIndex}-${genModelFullName(item)}`,
            item,
          ]),
        )

        for (const item of folderModels) {
          const key = genModelFullName(item)
          const parentKey = key.split('/').slice(0, -1).join('/')

          if (parentKey === '') {
            folderItem.children.push(item)
            continue
          }

          const parentItem = pathMap[`${item.pathIndex}-${parentKey}`]
          if (parentItem) {
            parentItem.children ??= []
            parentItem.children.push(item)
          }
        }
        rootChildren.push(folderItem)
      }
    }

    const root: ModelTreeNode = genFolderItem('root')
    root.children = rootChildren
    return [root]
  })

  function findFolder(
    list: ModelTreeNode[],
    feature: { basename: string; pathIndex: number },
  ) {
    return find(list, { ...feature, isFolder: true }) as ModelFolder | undefined
  }

  function findFolders(list: ModelTreeNode[]) {
    return filter(list, { isFolder: true }) as ModelFolder[]
  }

  async function openFolder(item: BaseModel) {
    const folderItems: FolderPathItem[] = []

    const folder = item.type
    const subFolderParts = item.subFolder.split('/').filter(Boolean)

    const pathParts: string[] = []
    if (folder) {
      pathParts.push(folder, ...subFolderParts)
    }
    pathParts.push(item.basename)
    if (pathParts[0] !== 'root') {
      pathParts.unshift('root')
    }

    let levelFolders = findFolders(dataTreeList.value)
    for (const [index, part] of pathParts.entries()) {
      const pathIndex = index < 2 ? 0 : item.pathIndex

      const currentFolder = findFolder(levelFolders, {
        basename: part,
        pathIndex: pathIndex,
      })
      if (!currentFolder) {
        break
      }

      levelFolders = findFolders(currentFolder.children ?? [])
      folderItems.push({
        name: currentFolder.basename,
        pathIndex: pathIndex,
        icon: index === 0 ? 'pi pi-desktop' : '',
        onClick: () => {
          openFolder(currentFolder)
        },
        children: levelFolders.map((child) => {
          const name = child.basename
          return {
            value: name,
            label: name,
            command: () => openFolder(child),
          }
        }),
      })
    }

    folderPaths.value = folderItems
  }

  watch(initialized, (val) => {
    if (val) {
      openFolder(dataTreeList.value[0])
    }
  })

  return {
    folders,
    folderPaths,
    dataTreeList,
    ...modelRest,
    findFolder: findFolder,
    findFolders: findFolders,
    openFolder: openFolder,
  }
}
