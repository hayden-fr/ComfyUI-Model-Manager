<template>
  <div
    class="flex h-full w-full select-none flex-col overflow-hidden"
    @contextmenu.prevent="nonContextMenu"
  >
    <div class="flex w-full gap-4 overflow-hidden px-4 pb-4">
      <div :class="['flex gap-4 overflow-hidden', showToolbar || 'flex-1']">
        <div class="flex overflow-hidden">
          <Button
            icon="pi pi-arrow-up"
            text
            rounded
            severity="secondary"
            :disabled="folderPaths.length < 2"
            @click="handleGoBackParentFolder"
          ></Button>
        </div>

        <ResponseBreadcrumb
          v-show="!showToolbar"
          class="h-10 flex-1"
          :items="folderPaths"
        ></ResponseBreadcrumb>
      </div>

      <div :class="['flex gap-4', showToolbar && 'flex-1']">
        <ResponseInput
          v-model="searchContent"
          :placeholder="$t('searchModels')"
        ></ResponseInput>

        <div
          v-show="showToolbar"
          class="flex flex-1 items-center justify-end gap-2"
        >
          <ResponseSelect
            v-model="sortOrder"
            :items="sortOrderOptions"
          ></ResponseSelect>
          <ResponseSelect
            v-model="cardSizeFlag"
            :items="cardSizeOptions"
          ></ResponseSelect>
        </div>

        <Button
          :icon="`mdi mdi-menu-${showToolbar ? 'close' : 'open'}`"
          text
          severity="secondary"
          @click="toggleToolbar"
        ></Button>
      </div>
    </div>

    <div
      ref="contentContainer"
      class="relative flex-1 overflow-hidden px-2"
      @contextmenu.stop.prevent=""
    >
      <ResponseScroll :items="renderedList" :item-size="itemSize">
        <template #item="{ item }">
          <div
            class="grid h-full justify-center"
            :style="{
              gridTemplateColumns: `repeat(auto-fit, ${cardSize.width}px)`,
              columnGap: `${gutter.x}px`,
              rowGap: `${gutter.y}px`,
            }"
          >
            <ModelCard
              v-for="rowItem in item.row"
              :model="rowItem"
              :key="genModelKey(rowItem)"
              :style="{
                width: `${cardSize.width}px`,
                height: `${cardSize.height}px`,
              }"
              v-tooltip.top="{
                value: getFullPath(rowItem),
                disabled: folderPaths.length < 2,
                autoHide: false,
                showDelay: 800,
                hideDelay: 300,
                pt: { root: { style: { zIndex: 2100, maxWidth: '32rem' } } },
              }"
              @dblclick="openItem(rowItem, $event)"
              @contextmenu.stop.prevent="openItemContext(rowItem, $event)"
            ></ModelCard>
            <div class="col-span-full"></div>
          </div>
        </template>
      </ResponseScroll>
    </div>

    <div class="flex justify-between px-4 py-2 text-sm">
      <div></div>
      <div></div>
    </div>

    <ContextMenu ref="menu" :model="contextItems"></ContextMenu>

    <ConfirmDialog group="confirm-name">
      <template #container="{ acceptCallback: accept, rejectCallback: reject }">
        <div class="flex w-90 flex-col items-end rounded px-4 pb-4 pt-8">
          <InputText
            class="w-full"
            type="text"
            v-model="confirmName"
            v-focus
            @keyup.enter="accept"
          ></InputText>
          <div class="mt-6 flex items-center gap-2">
            <Button :label="$t('cancel')" @click="reject" outlined></Button>
            <Button :label="$t('confirm')" @click="accept"></Button>
          </div>
        </div>
      </template>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import ModelCard from 'components/ModelCard.vue'
import ResponseBreadcrumb from 'components/ResponseBreadcrumb.vue'
import ResponseInput from 'components/ResponseInput.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import { useConfig } from 'hooks/config'
import { type ModelTreeNode, useModelExplorer } from 'hooks/explorer'
import { chunk } from 'lodash'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import ContextMenu from 'primevue/contextmenu'
import InputText from 'primevue/inputtext'
import { MenuItem } from 'primevue/menuitem'
import { genModelKey } from 'utils/model'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const gutter = {
  x: 4,
  y: 32,
}

const {
  dataTreeList,
  folderPaths,
  findFolder,
  openFolder,
  openModelDetail,
  getFullPath,
} = useModelExplorer()
const { cardSize, cardSizeMap, cardSizeFlag, dialog: settings } = useConfig()

const showToolbar = ref(false)
const toggleToolbar = () => {
  showToolbar.value = !showToolbar.value
}

const contentContainer = ref<HTMLElement | null>(null)
const contentSize = useElementSize(contentContainer)

const itemSize = computed(() => {
  return cardSize.value.height + gutter.y
})

const cols = computed(() => {
  const containerWidth = contentSize.width.value + gutter.x
  const itemWidth = cardSize.value.width + gutter.x

  return Math.floor(containerWidth / itemWidth)
})

const searchContent = ref<string>()

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

const currentDataList = computed(() => {
  let renderedList = dataTreeList.value
  for (const folderItem of folderPaths.value) {
    const found = findFolder(renderedList, {
      basename: folderItem.name,
      pathIndex: folderItem.pathIndex,
    })
    renderedList = found?.children || []
  }

  const filter = searchContent.value?.toLowerCase().trim() ?? ''
  if (filter) {
    const filterItems: ModelTreeNode[] = []

    const searchList = [...renderedList]

    while (searchList.length) {
      const item = searchList.pop()!
      const children = (item as any).children ?? []
      searchList.push(...children)

      const matchSubFolder = `${item.subFolder}/`.toLowerCase().includes(filter)
      const matchName = item.basename.toLowerCase().includes(filter)

      if (matchSubFolder || matchName) {
        filterItems.push(item)
      }
    }

    renderedList = filterItems
  }

  if (folderPaths.value.length > 1) {
    const folderItems: ModelTreeNode[] = []
    const modelItems: ModelTreeNode[] = []

    for (const item of renderedList) {
      if (item.isFolder) {
        folderItems.push(item)
      } else {
        modelItems.push(item)
      }
    }

    folderItems.sort((a, b) => {
      return a.basename.localeCompare(b.basename)
    })
    modelItems.sort((a, b) => {
      const sortFieldMap = {
        name: 'basename',
        size: 'sizeBytes',
        created: 'createdAt',
        modified: 'updatedAt',
      }
      const sortField = sortFieldMap[sortOrder.value]

      const aValue = a[sortField]
      const bValue = b[sortField]

      const result =
        typeof aValue === 'string'
          ? aValue.localeCompare(bValue)
          : aValue - bValue

      return result
    })
    renderedList = [...folderItems, ...modelItems]
  }

  return renderedList
})

const renderedList = computed(() => {
  return chunk(currentDataList.value, cols.value).map((row) => {
    return { key: row.map((o) => o.basename).join('#'), row }
  })
})

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

const menu = ref()
const contextItems = ref<MenuItem[]>([])
const confirmName = ref('')

const openItem = (item: ModelTreeNode, e: Event) => {
  menu.value.hide(e)
  if (item.isFolder) {
    searchContent.value = undefined
    openFolder(item)
  } else {
    openModelDetail(item)
  }
}

const openItemContext = (item: ModelTreeNode, e: Event) => {
  if (folderPaths.value.length < 2) {
    return
  }

  contextItems.value = [
    {
      label: t('open'),
      icon: 'pi pi-folder-open',
      command: () => {
        openItem(item, e)
      },
    },
  ]

  menu.value?.show(e)
}

const nonContextMenu = (e: Event) => {
  menu.value.hide(e)
}

const vFocus = {
  mounted: (el: HTMLInputElement) => el.focus(),
}

const handleGoBackParentFolder = () => {
  folderPaths.value.pop()
}
</script>
