import { genModelFullName, useModels } from 'hooks/model'
import { filter, find } from 'lodash'
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
  [x: string]: any
}

export type ModelItem = Model

export type ModelTreeNode = ModelFolder | ModelItem

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

        const modelFolders = folders.value[folder]

        const folderModels = data.value[folder] ?? []
        const folderRoot: ModelTreeNode[] = []

        for (const item of folderModels) {
          const fullPath = genModelFullName(item)
          const prefixPath = modelFolders[item.pathIndex]

          if (!prefixPath) {
            continue
          }

          const relativePath = fullPath.replace(`${prefixPath}/`, '')

          const pathParts = relativePath.split('/')
          pathParts.pop()
          let currentLevel = folderRoot
          const parts: string[] = []
          for (const part of pathParts) {
            parts.push(part)

            let found = currentLevel.find(
              (item) => item.type === 'folder' && item.basename === part,
            ) as ModelFolder | undefined

            if (!found) {
              const [, ...restPart] = parts
              found = genFolderItem(part, restPart.join('/'))
              currentLevel.push(found)
            }
            currentLevel = found.children
          }
          currentLevel.push(item)
        }

        folderItem.children = folderRoot
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
