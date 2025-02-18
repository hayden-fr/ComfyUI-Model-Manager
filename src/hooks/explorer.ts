import { genModelFullName, useModels } from 'hooks/model'
import { cloneDeep, filter, find } from 'lodash'
import { BaseModel, Model, SelectOptions } from 'types/typings'
import { computed, ref, watchEffect } from 'vue'

export interface FolderPathItem {
  name: string
  icon?: string
  onClick: () => void
  children: SelectOptions[]
}

export type ModelFolder = BaseModel & {
  type: 'folder'
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
  const { data, folders, ...modelRest } = useModels()

  const folderPaths = ref<FolderPathItem[]>([])

  const genFolderItem = (basename: string, subFolder: string): ModelFolder => {
    return {
      id: basename,
      basename: basename,
      subFolder: subFolder,
      pathIndex: 0,
      sizeBytes: 0,
      extension: '',
      description: '',
      metadata: {},
      preview: '',
      type: 'folder',
      children: [],
    }
  }

  const dataTreeList = computed<ModelTreeNode[]>(() => {
    const rootChildren: ModelTreeNode[] = []

    for (const folder in folders.value) {
      if (Object.prototype.hasOwnProperty.call(folders.value, folder)) {
        const folderItem = genFolderItem(folder, '')

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

    const root: ModelTreeNode = genFolderItem('root', '')
    root.children = rootChildren
    return [root]
  })

  function findFolder(list: ModelTreeNode[], name: string) {
    return find(list, { type: 'folder', basename: name }) as
      | ModelFolder
      | undefined
  }

  function findFolders(list: ModelTreeNode[]) {
    return filter(list, { type: 'folder' }) as ModelFolder[]
  }

  async function openFolder(level: number, name: string, icon?: string) {
    if (folderPaths.value.length >= level) {
      folderPaths.value.splice(level)
    }

    let currentLevel = dataTreeList.value
    for (const folderItem of folderPaths.value) {
      const found = findFolder(currentLevel, folderItem.name)
      currentLevel = found?.children || []
    }

    const folderItem = findFolder(currentLevel, name)
    const folderItemChildren = folderItem?.children ?? []
    const subFolders = findFolders(folderItemChildren)

    folderPaths.value.push({
      name,
      icon,
      onClick: () => {
        openFolder(level, name, icon)
      },
      children: subFolders.map((item) => {
        const name = item.basename
        return {
          value: name,
          label: name,
          command: () => openFolder(level + 1, name),
        }
      }),
    })
  }

  watchEffect(() => {
    if (Object.keys(folders.value).length > 0 && folderPaths.value.length < 2) {
      openFolder(0, 'root', 'pi pi-desktop')
    }
  }, {})

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
