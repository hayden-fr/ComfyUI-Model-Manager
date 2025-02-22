<template>
  <div class="flex flex-col gap-4">
    <div v-if="editable" class="flex flex-col gap-4">
      <ResponseSelect v-if="!baseInfo.type" v-model="type" :items="typeOptions">
        <template #prefix>
          <span>{{ $t('modelType') }}</span>
        </template>
      </ResponseSelect>

      <div class="flex gap-2 overflow-hidden">
        <div class="flex-1 overflow-hidden rounded bg-gray-500/30">
          <div class="flex h-full items-center justify-end">
            <span class="overflow-hidden text-ellipsis whitespace-nowrap px-2">
              {{ renderedModelFolder }}
            </span>
          </div>
        </div>
        <Button
          icon="pi pi-folder"
          :disabled="!type"
          @click="handleSelectFolder"
        ></Button>

        <Dialog
          v-model:visible="folderSelectVisible"
          :header="$t('folder')"
          :auto-z-index="false"
          :pt:mask:style="{ zIndex }"
          :pt:root:style="{ height: '50vh', maxWidth: '50vw' }"
          pt:content:class="flex-1"
        >
          <div class="flex h-full flex-col overflow-hidden">
            <div class="flex-1 overflow-hidden">
              <ResponseScroll>
                <Tree
                  class="h-full"
                  v-model:selection-keys="modelFolder"
                  :value="pathOptions"
                  selectionMode="single"
                  :pt:nodeLabel:class="'text-ellipsis overflow-hidden'"
                ></Tree>
              </ResponseScroll>
            </div>
            <div class="flex justify-end gap-2">
              <Button
                :label="$t('cancel')"
                severity="secondary"
                @click="handleCancelSelectFolder"
              ></Button>
              <Button
                :label="$t('select')"
                @click="handleConfirmSelectFolder"
              ></Button>
            </div>
          </div>
        </Dialog>
      </div>

      <ResponseInput
        v-model.trim.valid="basename"
        class="-mr-2 text-right"
        update-trigger="blur"
        :validate="validateBasename"
      >
        <template #suffix>
          <span class="text-base opacity-60">
            {{ extension }}
          </span>
        </template>
      </ResponseInput>
    </div>

    <table class="w-full table-fixed border-collapse border">
      <colgroup>
        <col class="w-32" />
        <col />
      </colgroup>
      <tbody>
        <tr
          v-for="item in information"
          :key="item.key"
          class="h-8 whitespace-nowrap border-b"
        >
          <td class="border-r bg-gray-300 px-4 dark:bg-gray-800">
            {{ $t(`info.${item.key}`) }}
          </td>
          <td
            class="overflow-hidden text-ellipsis break-all px-4"
            v-tooltip.top="{
              value: item.display,
              disabled: !['pathIndex', 'basename'].includes(item.key),
              autoHide: false,
              showDelay: 800,
              hideDelay: 300,
              pt: { root: { style: { zIndex: 2100, maxWidth: '32rem' } } },
            }"
          >
            {{ item.display }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import ResponseInput from 'components/ResponseInput.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import { useDialog } from 'hooks/dialog'
import { useModelBaseInfo, useModelFolder } from 'hooks/model'
import { useToast } from 'hooks/toast'
import Button from 'primevue/button'
import { usePrimeVue } from 'primevue/config'
import Dialog from 'primevue/dialog'
import Tree from 'primevue/tree'
import { computed, ref, watch } from 'vue'

const editable = defineModel<boolean>('editable')

const { toast } = useToast()

const {
  baseInfo,
  pathIndex,
  subFolder,
  basename,
  extension,
  type,
  modelFolders,
} = useModelBaseInfo()

watch(type, () => {
  subFolder.value = ''
})

const typeOptions = computed(() => {
  return Object.keys(modelFolders.value).map((curr) => {
    return {
      value: curr,
      label: curr,
      command: () => {
        type.value = curr
        pathIndex.value = 0
      },
    }
  })
})

const information = computed(() => {
  return Object.values(baseInfo.value).filter((row) => {
    if (editable.value) {
      const hiddenKeys = ['basename', 'pathIndex']
      return !hiddenKeys.includes(row.key)
    }
    return true
  })
})

const validateBasename = (val: string | undefined) => {
  if (!val) {
    toast.add({
      severity: 'error',
      detail: 'basename is required',
      life: 3000,
    })
    return false
  }
  const invalidChart = /[\\/:*?"<>|]/
  if (invalidChart.test(val)) {
    toast.add({
      severity: 'error',
      detail: 'basename is invalid, \\/:*?"<>|',
      life: 3000,
    })
    return false
  }
  return true
}

const folderSelectVisible = ref(false)

const { stack } = useDialog()
const { config } = usePrimeVue()
const zIndex = computed(() => {
  const baseZIndex = config.zIndex?.modal ?? 1100
  return baseZIndex + stack.value.length + 1
})

const handleSelectFolder = () => {
  if (!type.value) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Please select model type first',
      life: 5000,
    })
    return
  }
  folderSelectVisible.value = true
}

const { pathOptions } = useModelFolder({ type })

const selectedModelFolder = ref<string>()

const modelFolder = computed({
  get: () => {
    const folderPath = baseInfo.value.pathIndex.display
    const selectedKey = selectedModelFolder.value ?? folderPath
    return { [selectedKey]: true }
  },
  set: (val) => {
    const folderPath = Object.keys(val)[0]
    selectedModelFolder.value = folderPath
  },
})

const renderedModelFolder = computed(() => {
  return baseInfo.value.pathIndex?.display
})

const handleCancelSelectFolder = () => {
  selectedModelFolder.value = undefined
  folderSelectVisible.value = false
}

const handleConfirmSelectFolder = () => {
  const folderPath = Object.keys(modelFolder.value)[0]

  const folders = modelFolders.value[type.value]
  pathIndex.value = folders.findIndex((item) => folderPath.includes(item))
  if (pathIndex.value < 0) {
    toast.add({
      severity: 'error',
      detail: 'Folder not found',
      life: 3000,
    })
    return
  }
  const prefixPath = folders[pathIndex.value]
  subFolder.value = folderPath.replace(prefixPath, '')
  if (subFolder.value.startsWith('/')) {
    subFolder.value = subFolder.value.replace('/', '')
  }

  selectedModelFolder.value = undefined
  folderSelectVisible.value = false
}
</script>
