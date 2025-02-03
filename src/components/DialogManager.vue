<template>
  <div
    ref="contentContainer"
    class="flex h-full flex-col gap-4 overflow-hidden"
  >
    <div
      class="grid grid-cols-1 justify-center gap-4 px-8"
      :style="$content_lg(contentStyle)"
    >
      <div ref="toolbarContainer" class="col-span-full">
        <div :class="['flex gap-4', $toolbar_2xl('flex-row', 'flex-col')]">
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

    <ResponseScroll :items="list" :itemSize="itemSize" class="h-full flex-1">
      <template #item="{ item }">
        <div
          class="grid grid-cols-1 justify-center gap-8 px-8"
          :style="contentStyle"
        >
          <ModelCard
            v-for="model in item.row"
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
import { useElementSize } from '@vueuse/core'
import ModelCard from 'components/ModelCard.vue'
import ResponseInput from 'components/ResponseInput.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import { configSetting, useConfig } from 'hooks/config'
import { useContainerQueries } from 'hooks/container'
import { useModels } from 'hooks/model'
import { chunk } from 'lodash'
import { app } from 'scripts/comfyAPI'
import { Model } from 'types/typings'
import { genModelKey } from 'utils/model'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { isMobile, gutter, cardSize } = useConfig()

const { data, folders } = useModels()
const { t } = useI18n()

const toolbarContainer = ref<HTMLElement | null>(null)
const { $2xl: $toolbar_2xl } = useContainerQueries(toolbarContainer)

const contentContainer = ref<HTMLElement | null>(null)
const { $lg: $content_lg } = useContainerQueries(contentContainer)

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

const itemSize = computed(() => {
  let itemHeight = cardSize.value.height
  let itemGutter = gutter
  if (isMobile.value) {
    const baseSize = 16
    itemHeight = window.innerWidth - baseSize * 2 * 2
    itemGutter = baseSize * 2
  }
  return itemHeight + itemGutter
})

const { width } = useElementSize(contentContainer)

const cols = computed(() => {
  if (isMobile.value) {
    return 1
  }
  const containerWidth = width.value
  const itemWidth = cardSize.value.width
  return Math.floor((containerWidth - gutter) / (itemWidth + gutter))
})

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

  return chunk(sortedList, cols.value).map((row) => {
    return { key: row.map(genModelKey).join(','), row }
  })
})

const contentStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fit, ${cardSize.value.width}px)`,
  gap: `${gutter}px`,
  paddingLeft: `1rem`,
  paddingRight: `1rem`,
}))
</script>
