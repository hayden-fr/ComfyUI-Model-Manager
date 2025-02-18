<template>
  <div ref="container" class="breadcrumb-container">
    <div v-if="firstItem" class="breadcrumb-item">
      <span class="breadcrumb-label" @click="firstItem.onClick">
        <i v-if="firstItem.icon" :class="firstItem.icon"></i>
        <i v-else class="breadcrumb-name">{{ firstItem.name }}</i>
      </span>
      <ResponseSelect
        v-if="!!firstItem.children?.length"
        :items="firstItem.children"
      >
        <template #target="{ toggle, overlayVisible }">
          <span class="breadcrumb-split" @click="toggle">
            <i
              class="pi pi-angle-right transition-all"
              :style="{ transform: overlayVisible ? 'rotate(90deg)' : '' }"
            ></i>
          </span>
        </template>
      </ResponseSelect>
    </div>

    <div v-if="!!renderedItems.collapsed.length" class="breadcrumb-item">
      <ResponseSelect :items="renderedItems.collapsed">
        <template #target="{ toggle }">
          <span class="breadcrumb-split" @click="toggle">
            <i class="pi pi-ellipsis-h"></i>
          </span>
        </template>
      </ResponseSelect>
    </div>

    <div
      v-for="(item, index) in renderedItems.tail"
      :key="`${index}-${item.name}`"
      class="breadcrumb-item"
    >
      <span class="breadcrumb-label" @click="item.onClick">
        <i v-if="item.icon" :class="item.icon"></i>
        <i v-else class="breadcrumb-name">{{ item.name }}</i>
      </span>
      <ResponseSelect v-if="!!item.children?.length" :items="item.children">
        <template #target="{ toggle, overlayVisible }">
          <span class="breadcrumb-split" @click="toggle">
            <i
              class="pi pi-angle-right transition-all"
              :style="{ transform: overlayVisible ? 'rotate(90deg)' : '' }"
            ></i>
          </span>
        </template>
      </ResponseSelect>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import ResponseSelect from 'components/ResponseSelect.vue'
import { SelectOptions } from 'types/typings'
import { computed, ref } from 'vue'

interface BreadcrumbItem {
  name: string
  icon?: string
  onClick?: () => void
  children?: SelectOptions[]
}

interface Props {
  items: BreadcrumbItem[]
}

const props = defineProps<Props>()

const container = ref<HTMLElement | null>(null)
const { width } = useElementSize(container)

const firstItem = computed<BreadcrumbItem | null>(() => {
  return props.items[0]
})

const renderedItems = computed(() => {
  const [, ...items] = props.items

  const lastItem = items.pop()
  items.reverse()

  const separatorWidth = 32
  const calculateItemWidth = (item: BreadcrumbItem | undefined) => {
    if (!item) {
      return 0
    }

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    context.font = '16px Arial'

    const text = item.name
    return context.measureText(text).width + 16 + separatorWidth
  }

  const firstItemEL = container.value?.querySelector('div')
  const firstItemWidth = firstItemEL?.getBoundingClientRect().width ?? 0

  const lastItemWidth = calculateItemWidth(lastItem)

  const collapseWidth = separatorWidth

  let totalWidth = firstItemWidth + collapseWidth + lastItemWidth
  const containerWidth = width.value - 18
  const collapsed: SelectOptions[] = []
  const tail: BreadcrumbItem[] = []

  for (const item of items) {
    const itemWidth = calculateItemWidth(item)
    totalWidth += itemWidth

    if (totalWidth < containerWidth) {
      tail.unshift(item)
    } else {
      collapsed.unshift({
        value: item.name,
        label: item.name,
        command: () => {
          item.onClick?.()
        },
      })
    }
  }

  if (lastItem) {
    tail.push(lastItem)
  }

  return { collapsed, tail }
})
</script>

<style scoped>
.breadcrumb-container {
  @apply flex overflow-hidden rounded-lg bg-gray-500/30 px-2 py-1;
}

.breadcrumb-item {
  @apply flex h-full overflow-hidden rounded border border-transparent hover:border-gray-500/30;
}

.breadcrumb-item:nth-of-type(-n + 2) {
  @apply flex-shrink-0;
}

.breadcrumb-label {
  @apply flex h-full min-w-8 items-center overflow-hidden px-2 hover:bg-gray-500/30;
}

.breadcrumb-name {
  @apply overflow-hidden text-ellipsis whitespace-nowrap not-italic;
}

.breadcrumb-split {
  @apply flex aspect-square h-full min-w-8 items-center justify-center hover:bg-gray-500/30;
}
</style>
