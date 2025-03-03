<template>
  <Dialog
    ref="dialogRef"
    :visible="true"
    @update:visible="updateVisible"
    :modal="modal"
    :close-on-escape="false"
    :maximizable="!isMobile"
    maximizeIcon="pi pi-arrow-up-right-and-arrow-down-left-from-center"
    minimizeIcon="pi pi-arrow-down-left-and-arrow-up-right-to-center"
    :pt:mask:class="['group', { open: visible }]"
    :pt:root:class="['max-h-full group-[:not(.open)]:!hidden', $style.dialog]"
    pt:content:class="p-0 flex-1"
    :base-z-index="1000"
    :auto-z-index="isNil(zIndex)"
    :pt:mask:style="isNil(zIndex) ? {} : { zIndex: 1000 + zIndex }"
    v-bind="$attrs"
  >
    <template #header>
      <slot name="header"></slot>
    </template>

    <slot name="default"></slot>

    <div v-if="allowResize" data-dialog-resizer>
      <div
        v-if="resizeAllow?.x"
        data-resize-pos="left"
        class="absolute -left-1 top-0 h-full w-2 cursor-ew-resize"
        @mousedown="startResize"
      ></div>
      <div
        v-if="resizeAllow?.x"
        data-resize-pos="right"
        class="absolute -right-1 top-0 h-full w-2 cursor-ew-resize"
        @mousedown="startResize"
      ></div>
      <div
        v-if="resizeAllow?.y"
        data-resize-pos="top"
        class="absolute -top-1 left-0 h-2 w-full cursor-ns-resize"
        @mousedown="startResize"
      ></div>
      <div
        v-if="resizeAllow?.y"
        data-resize-pos="bottom"
        class="absolute -bottom-1 left-0 h-2 w-full cursor-ns-resize"
        @mousedown="startResize"
      ></div>
      <div
        v-if="resizeAllow?.x && resizeAllow?.y"
        data-resize-pos="top-left"
        class="absolute -left-1 -top-1 h-2 w-2 cursor-se-resize"
        @mousedown="startResize"
      ></div>
      <div
        v-if="resizeAllow?.x && resizeAllow?.y"
        data-resize-pos="top-right"
        class="absolute -right-1 -top-1 h-2 w-2 cursor-sw-resize"
        @mousedown="startResize"
      ></div>
      <div
        v-if="resizeAllow?.x && resizeAllow?.y"
        data-resize-pos="bottom-left"
        class="absolute -bottom-1 -left-1 h-2 w-2 cursor-sw-resize"
        @mousedown="startResize"
      ></div>
      <div
        v-if="resizeAllow?.x && resizeAllow?.y"
        data-resize-pos="bottom-right"
        class="absolute -bottom-1 -right-1 h-2 w-2 cursor-se-resize"
        @mousedown="startResize"
      ></div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { useConfig } from 'hooks/config'
import { clamp, isNil } from 'lodash'
import Dialog from 'primevue/dialog'
import { ContainerPosition, ContainerSize } from 'types/typings'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  keepAlive?: boolean
  defaultSize?: Partial<ContainerSize>
  defaultMobileSize?: Partial<ContainerSize>
  resizeAllow?: { x?: boolean; y?: boolean }
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  zIndex?: number
  modal?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  resizeAllow: () => ({ x: true, y: true }),
})

defineOptions({
  inheritAttrs: false,
})

const visible = defineModel<boolean>('visible')

const emit = defineEmits(['hide'])

const updateVisible = (val: boolean) => {
  visible.value = val
  emit('hide')
}

const { isMobile } = useConfig()

const dialogRef = ref()

const allowResize = computed(() => {
  return !isMobile.value
})

const resizeDirection = ref<string[]>([])

const getContainer = () => {
  return dialogRef.value.container
}

const minWidth = computed(() => {
  const defaultMinWidth = 390
  return props.minWidth ?? defaultMinWidth
})

const maxWidth = computed(() => {
  const defaultMaxWidth = window.innerWidth
  return props.maxWidth ?? defaultMaxWidth
})

const minHeight = computed(() => {
  const defaultMinHeight = 390
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
  nextTick(() => {
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

<style lang="css" module>
@layer tailwind-utilities {
  :where(.dialog) {
    *,
    *::before,
    *::after {
      box-sizing: border-box;
      border: 0 solid var(--p-surface-500);
    }
  }
}
</style>
