<template>
  <div data-scroll-area class="group/scroll relative overflow-hidden">
    <div
      ref="viewport"
      data-scroll-viewport
      class="h-full w-full overflow-auto scrollbar-none"
      @scroll="onContentScroll"
      v-resize="onContainerResize"
    >
      <div data-scroll-content style="min-width: 100%">
        <slot name="default"></slot>
      </div>
    </div>

    <div
      v-for="scroll in scrollbars"
      :key="scroll.direction"
      v-show="scroll.visible"
      v-bind="{ [`data-scroll-bar-${scroll.direction}`]: '' }"
      :class="[
        'pointer-events-none absolute z-auto h-full w-full rounded-full',
        'data-[scroll-bar-horizontal]:bottom-0 data-[scroll-bar-horizontal]:left-0 data-[scroll-bar-horizontal]:h-2',
        'data-[scroll-bar-vertical]:right-0 data-[scroll-bar-vertical]:top-0 data-[scroll-bar-vertical]:w-2',
      ]"
    >
      <div
        v-bind="{ ['data-scroll-thumb']: scroll.direction }"
        :class="[
          'pointer-events-auto absolute h-full w-full rounded-full',
          'cursor-pointer bg-black dark:bg-white',
          'opacity-0 transition-opacity duration-300 group-hover/scroll:opacity-10',
        ]"
        :style="{
          [scrollbarAttrs[scroll.direction].size]: `${scroll.size}px`,
          [scrollbarAttrs[scroll.direction].offset]: `${scroll.offset}px`,
          opacity: isDragging ? 0.1 : '',
        }"
        @mousedown="startDragThumb"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref } from 'vue'
import { clamp, throttle } from 'lodash'

interface ScrollAreaProps {
  scrollbar?: boolean
}

const props = withDefaults(defineProps<ScrollAreaProps>(), {
  scrollbar: true,
})
const emit = defineEmits(['scroll', 'resize'])

type ScrollbarDirection = 'horizontal' | 'vertical'

interface Scrollbar {
  direction: ScrollbarDirection
  visible: boolean
  size: number
  offset: number
}

interface ScrollbarAttribute {
  clientSize: string
  scrollOffset: string
  pagePosition: string
  offset: string
  size: string
}

const scrollbarAttrs: Record<ScrollbarDirection, ScrollbarAttribute> = {
  horizontal: {
    clientSize: 'clientWidth',
    scrollOffset: 'scrollLeft',
    pagePosition: 'pageX',
    offset: 'left',
    size: 'width',
  },
  vertical: {
    clientSize: 'clientHeight',
    scrollOffset: 'scrollTop',
    pagePosition: 'pageY',
    offset: 'top',
    size: 'height',
  },
}

const scrollbars = ref<Record<ScrollbarDirection, Scrollbar>>({
  horizontal: {
    direction: 'horizontal',
    visible: props.scrollbar,
    size: 0,
    offset: 0,
  },
  vertical: {
    direction: 'vertical',
    visible: props.scrollbar,
    size: 0,
    offset: 0,
  },
})

const isDragging = ref(false)

const onContainerResize: ResizeObserverCallback = throttle((entries) => {
  emit('resize', entries)
  if (isDragging.value) return

  const entry = entries[0]
  const container = entry.target as HTMLElement
  const content = container.querySelector('[data-scroll-content]')!

  const resolveScrollbarSize = (item: Scrollbar, attr: ScrollbarAttribute) => {
    const containerSize: number = container[attr.clientSize]
    const contentSize: number = content[attr.clientSize]
    item.visible = props.scrollbar && contentSize > containerSize
    item.size = Math.pow(containerSize, 2) / contentSize
  }

  nextTick(() => {
    resolveScrollbarSize(scrollbars.value.horizontal, scrollbarAttrs.horizontal)
    resolveScrollbarSize(scrollbars.value.vertical, scrollbarAttrs.vertical)
  })
})

const onContentScroll = throttle((event: Event) => {
  emit('scroll', event)
  if (isDragging.value) return

  const container = event.target as HTMLDivElement
  const content = container.querySelector('[data-scroll-content]')!

  const resolveOffset = (item: Scrollbar, attr: ScrollbarAttribute) => {
    const containerSize = container[attr.clientSize]
    const contentSize = content[attr.clientSize]
    const scrollOffset = container[attr.scrollOffset]

    item.offset =
      (scrollOffset / (contentSize - containerSize)) *
      (containerSize - item.size)
  }

  resolveOffset(scrollbars.value.horizontal, scrollbarAttrs.horizontal)
  resolveOffset(scrollbars.value.vertical, scrollbarAttrs.vertical)
})

const viewport = ref<HTMLElement>()
const draggingDirection = ref<ScrollbarDirection>()
const prevDraggingEvent = ref<MouseEvent>()

const moveThumb = throttle((event: MouseEvent) => {
  if (isDragging.value) {
    const container = viewport.value!
    const content = container.querySelector('[data-scroll-content]')!

    const resolveOffset = (item: Scrollbar, attr: ScrollbarAttribute) => {
      const containerSize = container[attr.clientSize]
      const contentSize = content[attr.clientSize]

      // Resolve thumb position
      const prevPagePos = prevDraggingEvent.value![attr.pagePosition]
      const currPagePos = event[attr.pagePosition]
      const offset = currPagePos - prevPagePos
      item.offset = clamp(item.offset + offset, 0, containerSize - item.size)

      // Resolve scroll position
      const scrollOffset = containerSize - item.size
      const offsetSize = contentSize - containerSize

      container[attr.scrollOffset] = (item.offset / scrollOffset) * offsetSize
    }

    const scrollDirection = draggingDirection.value!

    resolveOffset(
      scrollbars.value[scrollDirection],
      scrollbarAttrs[scrollDirection],
    )
    prevDraggingEvent.value = event
  }
})

const stopMoveThumb = () => {
  isDragging.value = false
  draggingDirection.value = undefined
  prevDraggingEvent.value = undefined
  document.removeEventListener('mousemove', moveThumb)
  document.removeEventListener('mouseup', stopMoveThumb)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

const startDragThumb = (event: MouseEvent) => {
  isDragging.value = true
  const target = event.target as HTMLElement
  draggingDirection.value = <any>target.getAttribute('data-scroll-thumb')
  prevDraggingEvent.value = event
  document.addEventListener('mousemove', moveThumb)
  document.addEventListener('mouseup', stopMoveThumb)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'default'
}

onUnmounted(() => {
  stopMoveThumb()
})

defineExpose({
  viewport,
})
</script>
