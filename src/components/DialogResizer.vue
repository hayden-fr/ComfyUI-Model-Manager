<template>
  <div v-if="allowResize" data-dialog-resizer>
    <div
      v-if="allow?.x"
      data-resize-pos="left"
      class="absolute -left-1 top-0 h-full w-2 cursor-ew-resize"
      @mousedown="startResize"
    ></div>
    <div
      v-if="allow?.x"
      data-resize-pos="right"
      class="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
      @mousedown="startResize"
    ></div>
    <div
      v-if="allow?.y"
      data-resize-pos="top"
      class="absolute -top-1 left-0 h-2 w-full cursor-ns-resize"
      @mousedown="startResize"
    ></div>
    <div
      v-if="allow?.y"
      data-resize-pos="bottom"
      class="absolute -bottom-1 left-0 h-2 w-full cursor-ns-resize"
      @mousedown="startResize"
    ></div>
    <div
      v-if="allow?.x && allow?.y"
      data-resize-pos="top-left"
      class="absolute -left-1 -top-1 h-2 w-2 cursor-se-resize"
      @mousedown="startResize"
    ></div>
    <div
      v-if="allow?.x && allow?.y"
      data-resize-pos="top-right"
      class="absolute -right-1 -top-1 h-2 w-2 cursor-sw-resize"
      @mousedown="startResize"
    ></div>
    <div
      v-if="allow?.x && allow?.y"
      data-resize-pos="bottom-left"
      class="absolute -bottom-1 -left-1 h-2 w-2 cursor-sw-resize"
      @mousedown="startResize"
    ></div>
    <div
      v-if="allow?.x && allow?.y"
      data-resize-pos="bottom-right"
      class="absolute -bottom-1 -right-1 h-2 w-2 cursor-se-resize"
      @mousedown="startResize"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { clamp } from 'lodash'
import { useConfig } from 'hooks/config'
import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'

type ContainerSize = { width: number; height: number }
type ContainerPosition = { left: number; top: number }

interface ResizableProps {
  defaultSize?: Partial<ContainerSize>
  defaultMobileSize?: Partial<ContainerSize>
  allow?: { x?: boolean; y?: boolean }
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
}

const props = withDefaults(defineProps<ResizableProps>(), {
  allow: () => ({ x: true, y: true }),
})

const config = useConfig()
const allowResize = computed(() => {
  return !config.isMobile.value
})

const instance = getCurrentInstance()

const resizeDirection = ref<string[]>([])

const getContainer = () => {
  return instance!.parent!.vnode.el as HTMLDivElement
}

const minWidth = computed(() => {
  const defaultMinWidth = 100
  return props.minWidth ?? defaultMinWidth
})

const maxWidth = computed(() => {
  const defaultMaxWidth = window.innerWidth
  return props.maxWidth ?? defaultMaxWidth
})

const minHeight = computed(() => {
  const defaultMinHeight = 100
  return props.minHeight ?? defaultMinHeight
})

const maxHeight = computed(() => {
  const defaultMaxHeight = window.innerHeight
  return props.maxHeight ?? defaultMaxHeight
})

const isResizing = ref(false)

const defaultWidth = window.innerWidth * 0.6
const defaultHeight = window.innerHeight * 0.8

const containerSize = ref({
  width:
    props.defaultSize?.width ??
    clamp(defaultWidth, minWidth.value, maxWidth.value),
  height:
    props.defaultSize?.height ??
    clamp(defaultHeight, minHeight.value, maxHeight.value),
})
const containerPosition = ref<ContainerPosition>({ left: 0, top: 0 })

const updateContainerSize = (size: ContainerSize) => {
  const container = getContainer()
  container.style.width = `${size.width}px`
  container.style.height = `${size.height}px`
}

const updateContainerPosition = (position: ContainerPosition) => {
  const container = getContainer()
  container.style.left = `${position.left}px`
  container.style.top = `${position.top}px`
}

const recordContainerPosition = () => {
  const container = getContainer()
  containerPosition.value = {
    left: container.offsetLeft,
    top: container.offsetTop,
  }
}

const updateGlobalStyle = (direction?: string) => {
  let cursor = ''
  let select = ''
  switch (direction) {
    case 'left':
    case 'right':
      cursor = 'ew-resize'
      select = 'none'
      break
    case 'top':
    case 'bottom':
      cursor = 'ns-resize'
      select = 'none'
      break
    case 'top-left':
    case 'bottom-right':
      cursor = 'se-resize'
      select = 'none'
      break
    case 'top-right':
    case 'bottom-left':
      cursor = 'sw-resize'
      select = 'none'
      break
    default:
      break
  }
  document.body.style.cursor = cursor
  document.body.style.userSelect = select
}

const resize = (event: MouseEvent) => {
  if (isResizing.value) {
    const container = getContainer()

    for (const direction of resizeDirection.value) {
      if (direction === 'left') {
        if (event.clientX > 0) {
          containerSize.value.width = clamp(
            container.offsetLeft + container.offsetWidth - event.clientX,
            minWidth.value,
            maxWidth.value,
          )
        }
        if (
          containerSize.value.width > minWidth.value &&
          containerSize.value.width < maxWidth.value
        ) {
          containerPosition.value.left = clamp(
            event.clientX,
            0,
            window.innerWidth - containerSize.value.width,
          )
        }
      }

      if (direction === 'right') {
        containerSize.value.width = clamp(
          event.clientX - container.offsetLeft,
          minWidth.value,
          maxWidth.value,
        )
      }

      if (direction === 'top') {
        if (event.clientY > 0) {
          containerSize.value.height = clamp(
            container.offsetTop + container.offsetHeight - event.clientY,
            minHeight.value,
            maxHeight.value,
          )
        }
        if (
          containerSize.value.height > minHeight.value &&
          containerSize.value.height < maxHeight.value
        ) {
          containerPosition.value.top = clamp(
            event.clientY,
            0,
            window.innerHeight - containerSize.value.height,
          )
        }
      }

      if (direction === 'bottom') {
        containerSize.value.height = clamp(
          event.clientY - container.offsetTop,
          minHeight.value,
          maxHeight.value,
        )
      }
    }
    updateContainerSize(containerSize.value)
    updateContainerPosition(containerPosition.value)
  }
}

const stopResize = () => {
  isResizing.value = false
  resizeDirection.value = []
  document.removeEventListener('mousemove', resize)
  document.removeEventListener('mouseup', stopResize)
  updateGlobalStyle()
}

const startResize = (event: MouseEvent) => {
  isResizing.value = true
  const direction =
    (event.target as HTMLElement).getAttribute('data-resize-pos') ?? ''
  resizeDirection.value = direction.split('-')
  recordContainerPosition()
  updateGlobalStyle(direction)
  document.addEventListener('mousemove', resize)
  document.addEventListener('mouseup', stopResize)
}

onMounted(() => {
  if (allowResize.value) {
    updateContainerSize(containerSize.value)
  } else {
    updateContainerSize({
      width: props.defaultMobileSize?.width ?? window.innerWidth,
      height: props.defaultMobileSize?.height ?? window.innerHeight,
    })
  }

  recordContainerPosition()
  updateContainerPosition(containerPosition.value)
  getContainer().style.position = 'fixed'
})

onBeforeUnmount(() => {
  stopResize()
})

watch(allowResize, (allowResize) => {
  if (allowResize) {
    updateContainerSize(containerSize.value)
    updateContainerPosition(containerPosition.value)
  } else {
    updateContainerSize({
      width: props.defaultMobileSize?.width ?? window.innerWidth,
      height: props.defaultMobileSize?.height ?? window.innerHeight,
    })
    updateContainerPosition({ left: 0, top: 0 })
  }
})

defineExpose({
  updateContainerSize,
  updateContainerPosition,
})
</script>
