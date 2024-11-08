<template>
  <div data-scroll-area class="group/scroll relative overflow-hidden">
    <div
      ref="viewport"
      data-scroll-viewport
      class="h-full w-full overflow-auto scrollbar-none"
      :style="{ contain: items ? 'strict' : undefined }"
      @scroll="onContentScroll"
      v-resize="onContainerResize"
    >
      <div data-scroll-content class="relative min-w-full">
        <slot name="default">
          <div
            v-for="(item, index) in loadedItems"
            :key="genRowKey(item, index)"
            :style="{ height: `${itemSize}px` }"
          >
            <slot name="item" :item="item"></slot>
          </div>
          <slot v-if="loadedItems.length === 0" name="empty">
            <div class="absolute w-full py-20 text-center">No Data</div>
          </slot>
        </slot>
      </div>

      <div
        data-scroll-space
        class="pointer-events-none absolute left-0 top-0 h-px w-px"
        :style="spaceStyle"
      ></div>
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

<script setup lang="ts" generic="T">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { clamp, throttle } from 'lodash'

interface ScrollAreaProps {
  items?: T[][]
  itemSize?: number
  scrollbar?: boolean
  rowKey?: string | ((item: T[]) => string)
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

const spaceStyle = ref({})
const loadedItems = ref<T[][]>([])

const genRowKey = (item: any | any[], index: number) => {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(item)
  }
  return item[props.rowKey ?? 'key'] ?? index
}

const setSpacerSize = () => {
  const items = props.items
  if (items) {
    const itemSize = props.itemSize ?? 0
    spaceStyle.value = { height: `${itemSize * items.length}px` }
  } else {
    spaceStyle.value = {}
  }
}

const getContainerContent = (raw?: boolean): HTMLElement => {
  const container = viewport.value as HTMLElement

  if (props.items && !raw) {
    return container.querySelector('[data-scroll-space]')!
  }
  return container.querySelector('[data-scroll-content]')!
}

const init = () => {
  const container = viewport.value as HTMLElement
  container.scrollTop = 0
  getContainerContent().style.transform = ''
}

const calculateLoadItems = () => {
  let visibleItems: any[] = []

  if (props.items) {
    const container = viewport.value as HTMLElement
    const content = getContainerContent(true)

    const resolveVisibleItems = (items: any[], attr: ScrollbarAttribute) => {
      const containerSize = container[attr.clientSize]
      const itemSize = props.itemSize!
      const viewCount = Math.ceil(containerSize / itemSize)

      let start = Math.floor(container[attr.scrollOffset] / itemSize)
      const offset = start * itemSize

      let end = start + viewCount
      end = Math.min(end + viewCount, items.length)

      content.style.transform = `translateY(${offset}px)`
      return items.slice(start, end)
    }

    visibleItems = resolveVisibleItems(props.items, scrollbarAttrs.vertical)
  }

  loadedItems.value = visibleItems
}

const calculateScrollThumbSize = () => {
  const container = viewport.value as HTMLElement
  const content = getContainerContent()

  const resolveScrollbarSize = (item: Scrollbar, attr: ScrollbarAttribute) => {
    const containerSize: number = container[attr.clientSize]
    const contentSize: number = content[attr.clientSize]
    item.visible = props.scrollbar && contentSize > containerSize
    item.size = Math.max(Math.pow(containerSize, 2) / contentSize, 16)
  }

  nextTick(() => {
    resolveScrollbarSize(scrollbars.value.horizontal, scrollbarAttrs.horizontal)
    resolveScrollbarSize(scrollbars.value.vertical, scrollbarAttrs.vertical)
  })
}

const onContainerResize: ResizeObserverCallback = throttle((entries) => {
  emit('resize', entries)
  if (isDragging.value) return

  calculateScrollThumbSize()
})

const onContentScroll = throttle((event: Event) => {
  emit('scroll', event)
  if (isDragging.value) return

  const container = event.target as HTMLDivElement
  const content = getContainerContent()

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

  calculateLoadItems()
})

const viewport = ref<HTMLElement>()
const draggingDirection = ref<ScrollbarDirection>()
const prevDraggingEvent = ref<MouseEvent>()

const moveThumb = throttle((event: MouseEvent) => {
  if (isDragging.value) {
    const container = viewport.value!
    const content = getContainerContent()

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

    calculateLoadItems()
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

watch(
  () => props.items,
  () => {
    setSpacerSize()
    calculateScrollThumbSize()
    calculateLoadItems()
  },
)

onUnmounted(() => {
  stopMoveThumb()
})

defineExpose({
  viewport,
  init,
})
</script>
