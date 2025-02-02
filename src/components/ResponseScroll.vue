<template>
  <div class="group/scroll relative overflow-hidden">
    <div ref="viewport" class="h-full w-full overflow-auto scrollbar-none">
      <div ref="content">
        <slot name="default">
          <slot v-if="renderedItems.length === 0" name="empty">
            <div class="absolute w-full py-20 text-center">No Data</div>
          </slot>

          <div :style="{ height: `${headHeight}px` }"></div>
          <div>
            <div
              v-for="item in renderedItems"
              :key="item.key"
              :style="{ height: `${itemSize}px` }"
              data-virtual-item
            >
              <slot name="item" :item="item"></slot>
            </div>
          </div>
          <div :style="{ height: `${tailHeight}px` }"></div>
        </slot>
      </div>
    </div>

    <div class="absolute right-0 top-0 h-full w-2">
      <div
        :class="[
          'absolute w-full cursor-pointer rounded-full bg-gray-500',
          'opacity-0 transition-opacity duration-300 group-hover/scroll:opacity-30',
        ]"
        :style="{ height: `${thumbSize}px`, top: `${thumbOffset}px` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { useContainerResize } from 'hooks/resize'
import { useContainerScroll } from 'hooks/scroll'
import { clamp } from 'lodash'
import { computed, ref } from 'vue'

interface ScrollAreaProps {
  items?: (T & { key: string })[]
  itemSize?: number
}

const props = defineProps<ScrollAreaProps>()

const viewport = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)

const { height: viewportHeight } = useContainerResize(viewport)
const { height: contentHeight } = useContainerResize(content)
const { y: scrollY } = useContainerScroll(viewport)

const itemSize = computed(() => props.itemSize || 0)

const viewRows = computed(() =>
  Math.ceil(viewportHeight.value / itemSize.value),
)
const offsetRows = computed(() => Math.floor(scrollY.value / itemSize.value))

const items = computed(() => {
  return props.items ?? []
})

const state = computed(() => {
  const bufferRows = viewRows.value

  const fromRow = offsetRows.value - bufferRows
  const toRow = offsetRows.value + bufferRows + viewRows.value

  const itemCount = items.value.length

  return {
    start: clamp(fromRow, 0, itemCount),
    end: clamp(toRow, fromRow, itemCount),
  }
})

const renderedItems = computed(() => {
  const { start, end } = state.value

  return props.items?.slice(start, end) ?? []
})

const headHeight = computed(() => {
  return state.value.start * itemSize.value
})

const tailHeight = computed(() => {
  return (items.value.length - state.value.end) * itemSize.value
})

const thumbSize = computed(() => {
  if (viewportHeight.value >= contentHeight.value) {
    return 0
  }

  const thumbHeight = Math.pow(viewportHeight.value, 2) / contentHeight.value
  return Math.max(thumbHeight, 16)
})

const thumbOffset = computed(() => {
  return (
    (scrollY.value / (contentHeight.value - viewportHeight.value)) *
    (viewportHeight.value - thumbSize.value)
  )
})
</script>
