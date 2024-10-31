<template>
  <div
    class="flex h-full flex-col gap-4 overflow-hidden @container/content"
    :style="{
      ['--card-width']: `${cardWidth}px`,
      ['--gutter']: `${gutter}px`,
    }"
    v-resize="onContainerResize"
  >
    <div
      :class="[
        'grid grid-cols-1 justify-center gap-4 px-8',
        '@lg/content:grid-cols-[repeat(auto-fit,var(--card-width))]',
        '@lg/content:gap-[var(--gutter)]',
        '@lg/content:px-4',
      ]"
    >
      <div class="col-span-full @container/toolbar">
        <div :class="['flex flex-col gap-4', '@2xl/toolbar:flex-row']">
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
      :items="list"
      :itemSize="cardWidth / aspect + gutter"
      :row-key="(item) => item.map(genModelKey).join(',')"
      class="h-full flex-1"
    >
      <template #item="{ item }">
        <div
          :class="[
            'grid grid-cols-1 justify-center gap-8 px-8',
            '@lg/content:grid-cols-[repeat(auto-fit,var(--card-width))]',
            '@lg/content:gap-[var(--gutter)]',
            '@lg/content:px-4',
          ]"
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
import { useConfig } from 'hooks/config'
import { useModels } from 'hooks/model'
import ModelCard from 'components/ModelCard.vue'
import ResponseInput from 'components/ResponseInput.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { chunk } from 'lodash'
import { defineResizeCallback } from 'hooks/resize'
import { genModelKey } from 'utils/model'

const { isMobile, cardWidth, gutter, aspect, modelFolders } = useConfig()

const { data } = useModels()
const { t } = useI18n()

const searchContent = ref<string>()

const currentType = ref('all')
const typeOptions = computed(() => {
  return ['all', ...Object.keys(modelFolders.value)].map((type) => {
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

const colSpan = ref(1)
const colSpanWidth = ref(cardWidth)

const list = computed(() => {
  const filterList = data.value.filter((model) => {
    const showAllModel = currentType.value === 'all'

    const matchType = showAllModel || model.type === currentType.value
    const matchName = model.fullname
      .toLowerCase()
      .includes(searchContent.value?.toLowerCase() || '')

    return matchType && matchName
  })

  let sortStrategy = (a: Model, b: Model) => 0
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
