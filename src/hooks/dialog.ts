import { defineStore } from 'hooks/store'
import { ContainerSize } from 'types/typings'
import { Component, markRaw, ref } from 'vue'

interface HeaderButton {
  key: string
  icon: string
  command: () => void
}

export interface DialogItem {
  key: string
  title: string
  content: Component
  contentProps?: Record<string, any>
  keepAlive?: boolean
  headerButtons?: HeaderButton[]
  defaultSize?: Partial<ContainerSize>
  defaultMobileSize?: Partial<ContainerSize>
  resizeAllow?: { x?: boolean; y?: boolean }
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  modal?: boolean
}

export const useDialog = defineStore('dialog', () => {
  const stack = ref<(DialogItem & { visible?: boolean })[]>([])

  const rise = (dialog: { key: string }) => {
    const index = stack.value.findIndex((item) => item.key === dialog.key)
    if (index !== -1) {
      const item = stack.value.splice(index, 1)
      stack.value.push(...item)
    }
  }

  const open = (dialog: DialogItem) => {
    const item = stack.value.find((item) => item.key === dialog.key)
    if (item) {
      item.visible = true
      rise(dialog)
    } else {
      stack.value.push({
        ...dialog,
        content: markRaw(dialog.content),
        visible: true,
      })
    }
  }

  const close = (dialog?: { key: string }) => {
    if (!dialog) {
      stack.value.pop()
      return
    }

    const item = stack.value.find((item) => item.key === dialog.key)
    if (item?.keepAlive) {
      item.visible = false
    } else {
      stack.value = stack.value.filter((item) => item.key !== dialog.key)
    }
  }

  const closeAll = () => {
    stack.value = []
  }

  return { stack, open, close, closeAll, rise }
})

declare module 'hooks/store' {
  interface StoreProvider {
    dialog: ReturnType<typeof useDialog>
  }
}
