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
          <div class="flex-1">
            <ResponseInput
              v-model="searchContent"
              :placeholder="$t('searchModels')"
              :allow-clear="true"
              suffix-icon="pi pi-search"
            ></ResponseInput>
          </div>

          <div class="flex items-center justify-between gap-4 overflow-hidden">
            <ResponseSelect
              class="flex-1"
              v-model="currentType"
              :items="typeOptions"
            ></ResponseSelect>
            <ResponseSelect
              class="flex-1"
              v-model="sortOrder"
              :items="sortOrderOptions"
            ></ResponseSelect>
            <ResponseSelect
              class="flex-1"
              v-model="cardSizeFlag"
              :items="cardSizeOptions"
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
            :style="{
              width: `${cardSize.width}px`,
              height: `${cardSize.height}px`,
            }"
            class="group/card cursor-pointer !p-0"
            @click="openModelDetail(model)"
            v-tooltip.top="{
              value: getFullPath(model),
              autoHide: false,
              showDelay: 800,
              hideDelay: 300,
              pt: { root: { style: { zIndex: 2100, maxWidth: '32rem' } } },
            }"
          >
            <template #name>
              <div
                v-show="showModelName"
                class="absolute top-0 h-full w-full p-2"
              >
                <div class="flex h-full flex-col justify-end text-lg">
                  <div class="line-clamp-3 break-all font-bold text-shadow">
                    {{ model.basename }}
                  </div>
                </div>
              </div>
            </template>

            <template #extra>
              <div
                v-show="showModeAction"
                class="pointer-events-none absolute right-2 top-2 opacity-0 duration-300 group-hover/card:opacity-100"
              >
                <div class="flex flex-col gap-2">
                  <Button
                    icon="pi pi-plus"
                    severity="secondary"
                    rounded
                    @click.stop="addModelNode(model)"
                  ></Button>
                  <Button
                    icon="pi pi-copy"
                    severity="secondary"
                    rounded
                    @click.stop="copyModelNode(model)"
                  ></Button>
                  <Button
                    v-show="model.preview"
                    icon="pi pi-file-import"
                    severity="secondary"
                    rounded
                    @click.stop="loadPreviewWorkflow(model)"
                  ></Button>
                </div>
              </div>
            </template>
          </ModelCard>
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
import { useModelNodeAction, useModels } from 'hooks/model'
import { chunk } from 'lodash'
import Button from 'primevue/button'
import { app } from 'scripts/comfyAPI'
import { Model } from 'types/typings'
import { genModelKey } from 'utils/model'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const {
  isMobile,
  gutter,
  cardSize,
  cardSizeMap,
  cardSizeFlag,
  dialog: settings,
} = useConfig()

const { data, folders, openModelDetail, getFullPath } = useModels()
const { t } = useI18n()

const toolbarContainer = ref<HTMLElement | null>(null)
const { $2xl: $toolbar_2xl } = useContainerQueries(toolbarContainer)

const contentContainer = ref<HTMLElement | null>(null)
const { $lg: $content_lg } = useContainerQueries(contentContainer)

const searchContent = ref<string>()

const allType = 'All'
const currentType = ref(allType)
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
    allType,
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
  const pureModels = mergedList.filter((item) => {
    return !item.isFolder
  })

function buildRegex(raw: string): RegExp {
  try {
    // Escape regex specials, then restore * wildcards as .*
    const escaped = raw
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*')
    return new RegExp(escaped, 'i') // case-insensitive
  } catch (e) {
    return new RegExp(raw, 'i')
  }
}

const filterList = pureModels.filter((model) => {
  const showAllModel = currentType.value === allType
  const matchType = showAllModel || model.type === currentType.value

  const rawFilter = searchContent.value ?? ''
  const tokens = rawFilter.split(/\s+/).filter(Boolean)
  const regexes = tokens.map(buildRegex)

  // Require every token to match either the folder or the name
  const matchesAll = regexes.every((re) =>
    re.test(model.subFolder) || re.test(model.basename)
  )
  
  return matchType && matchesAll
})

  let sortStrategy: (a: Model, b: Model) => number = () => 0
  switch (sortOrder.value) {
    case 'name':
      sortStrategy = (a, b) => a.basename.localeCompare(b.basename)
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

const cardSizeOptions = computed(() => {
  const customSize = 'size.custom'

  const customOptionMap = {
    ...cardSizeMap.value,
    [customSize]: 'custom',
  }

  return Object.keys(customOptionMap).map((key) => {
    return {
      label: t(key),
      value: key,
      command: () => {
        if (key === customSize) {
          settings.showCardSizeSetting()
        } else {
          cardSizeFlag.value = key
        }
      },
    }
  })
})

const showModelName = computed(() => {
  return cardSize.value.width > 120 && cardSize.value.height > 160
})

const showModeAction = computed(() => {
  return cardSize.value.width > 120 && cardSize.value.height > 160
})

const { addModelNode, copyModelNode, loadPreviewWorkflow } =
  useModelNodeAction()
</script>
