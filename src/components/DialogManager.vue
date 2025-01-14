<template>
  <div
    class="flex h-full flex-col gap-4 overflow-hidden"
    v-resize="onContainerResize"
    v-container="contentContainer"
  >
    <div
      class="grid grid-cols-1 justify-center gap-4 px-8"
      :style="$content_lg(contentStyle)"
    >
      <div class="col-span-full" v-container="toolbarContainer">
        <div class="flex flex-col gap-4" :style="$toolbar_2xl(toolbarStyle)">
          <ResponseInput
            v-model="searchContent"
            :placeholder="$t('searchModels')"
            :allow-clear="true"
            suffix-icon="pi pi-search"
          ></ResponseInput>

          <div class="flex items-center justify-between gap-4 overflow-hidden">
            <ResponseSelect
              v-model="currentType"
              :items="typeOptions"
              :type="isMobile ? 'drop' : 'button'"
            ></ResponseSelect>
            <ResponseSelect
              v-model="sortOrder"
              :items="sortOrderOptions"
            ></ResponseSelect>
          </div>
        </div>
      </div>
    </div>

    <ResponseScroll
      ref="responseScroll"
      :items="list"
      :itemSize="itemSize"
      :row-key="(item) => item.map(genModelKey).join(',')"
      class="h-full flex-1"
    >
      <template #item="{ item }">
        <div
          class="grid grid-cols-1 justify-center gap-8 px-8"
          :style="contentStyle"
        >
          <ModelCard
            v-for="model in item"
            :key="genModelKey(model)"
            :model="model"
          ></ModelCard>
          <div class="col-span-full"></div>
        </div>
      </template>

      <template #empty>
        <div class="flex flex-col items-center gap-4 pt-20 opacity-70">
          <i class="pi pi-box text-4xl"></i>
          <div class="select-none text-lg font-bold">No models found</div>
        </div>
      </template>
    </ResponseScroll>
  </div>
</template>

<script setup lang="ts" name="manager-dialog">
import ModelCard from 'components/ModelCard.vue'
import ResponseInput from 'components/ResponseInput.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import { configSetting, useConfig } from 'hooks/config'
import { useContainerQueries } from 'hooks/container'
import { useModels } from 'hooks/model'
import { defineResizeCallback } from 'hooks/resize'
import { chunk } from 'lodash'
import { app } from 'scripts/comfyAPI'
import { Model } from 'types/typings'
import { genModelKey } from 'utils/model'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { isMobile, cardWidth, gutter, aspect } = useConfig()

const { data, folders } = useModels()
const { t } = useI18n()

const responseScroll = ref()

const searchContent = ref<string>()

const currentType = ref('all')
const typeOptions = computed(() => {
  const excludeScanTypes = app.ui?.settings.getSettingValue<string>(
    configSetting.excludeScanTypes,
  )
  const customBlackList =
    excludeScanTypes
      ?.split(',')
      .map((type) => type.trim())
      .filter(Boolean) ?? []
  return [
    'all',
    ...Object.keys(folders.value).filter(
      (folder) => !customBlackList.includes(folder),
    ),
  ].map((type) => {
    return {
      label: type,
      value: type,
      command: () => {
        currentType.value = type
      },
    }
  })
})

const sortOrder = ref('name')
const sortOrderOptions = ref(
  ['name', 'size', 'created', 'modified'].map((key) => {
    return {
      label: t(`sort.${key}`),
      value: key,
      icon: key === 'name' ? 'pi pi-sort-alpha-down' : 'pi pi-sort-amount-down',
      command: () => {
        sortOrder.value = key
      },
    }
  }),
)

watch([searchContent, currentType], () => {
  responseScroll.value.init()
})

const itemSize = computed(() => {
  let itemWidth = cardWidth
  let itemGutter = gutter
  if (isMobile.value) {
    const baseSize = 16
    itemWidth = window.innerWidth - baseSize * 2 * 2
    itemGutter = baseSize * 2
  }
  return itemWidth / aspect + itemGutter
})

const colSpan = ref(1)
const colSpanWidth = ref(cardWidth)

const list = computed(() => {
  const mergedList = Object.values(data.value).flat()

  const filterList = mergedList.filter((model) => {
    const showAllModel = currentType.value === 'all'

    const matchType = showAllModel || model.type === currentType.value
    const matchName = model.fullname
      .toLowerCase()
      .includes(searchContent.value?.toLowerCase() || '')

    return matchType && matchName
  })

  let sortStrategy: (a: Model, b: Model) => number = () => 0
  switch (sortOrder.value) {
    case 'name':
      sortStrategy = (a, b) => a.fullname.localeCompare(b.fullname)
      break
    case 'size':
      sortStrategy = (a, b) => b.sizeBytes - a.sizeBytes
      break
    case 'created':
      sortStrategy = (a, b) => b.createdAt - a.createdAt
      break
    case 'modified':
      sortStrategy = (a, b) => b.updatedAt - a.updatedAt
      break
    default:
      break
  }

  const sortedList = filterList.sort(sortStrategy)

  return chunk(sortedList, colSpan.value)
})

const toolbarContainer = Symbol('toolbar')
const { $2xl: $toolbar_2xl } = useContainerQueries(toolbarContainer)

const contentContainer = Symbol('content')
const { $lg: $content_lg } = useContainerQueries(contentContainer)

const contentStyle = {
  gridTemplateColumns: `repeat(auto-fit, ${cardWidth}px)`,
  gap: `${gutter}px`,
  paddingLeft: `1rem`,
  paddingRight: `1rem`,
}
const toolbarStyle = {
  flexDirection: 'row',
}

const onContainerResize = defineResizeCallback((entries) => {
  const entry = entries[0]
  if (isMobile.value) {
    colSpan.value = 1
  } else {
    const containerWidth = entry.contentRect.width
    colSpan.value = Math.floor((containerWidth - gutter) / (cardWidth + gutter))
    colSpanWidth.value = colSpan.value * (cardWidth + gutter) - gutter
  }
})
</script>
