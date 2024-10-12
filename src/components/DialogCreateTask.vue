<template>
  <Dialog
    v-model:visible="visible"
    :header="$t('parseModelUrl')"
    :modal="true"
    :maximizable="!isMobile"
    maximizeIcon="pi pi-arrow-up-right-and-arrow-down-left-from-center"
    minimizeIcon="pi pi-arrow-down-left-and-arrow-up-right-to-center"
    pt:mask:style="--p-mask-background: rgba(0, 0, 0, 0.3)"
    pt:root:class="max-h-full"
    pt:content:class="px-0"
    @after-hide="clearContent"
  >
    <div class="flex h-full flex-col gap-4 px-5">
      <ResponseInput
        v-model="modelUrl"
        :allow-clear="true"
        :placeholder="$t('pleaseInputModelUrl')"
        @keypress.enter="searchModelsByUrl"
      >
        <template #suffix>
          <span
            class="pi pi-search pi-inputicon"
            @click="searchModelsByUrl"
          ></span>
        </template>
      </ResponseInput>

      <div v-show="data.length > 0">
        <ResponseSelect
          v-model="current"
          :items="data"
          :type="isMobile ? 'drop' : 'button'"
        >
          <template #prefix>
            <span>version:</span>
          </template>
        </ResponseSelect>
      </div>

      <ResponseScrollArea class="-mx-5 h-full">
        <div class="px-5">
          <ModelContent
            v-for="{ item } in data"
            v-show="current == item.id"
            :key="item.id"
            :model="item"
            :editable="true"
            @submit="createDownTask"
          >
            <template #action>
              <Button
                icon="pi pi-download"
                :label="$t('download')"
                type="submit"
              ></Button>
            </template>
          </ModelContent>

          <div v-show="data.length === 0">
            <div class="flex flex-col items-center gap-4 py-8">
              <i class="pi pi-box text-3xl"></i>
              <div>No Models Found</div>
            </div>
          </div>
        </div>
      </ResponseScrollArea>
    </div>

    <DialogResizer :min-width="390"></DialogResizer>
  </Dialog>
</template>

<script setup lang="ts">
import DialogResizer from 'components/DialogResizer.vue'
import ResponseInput from 'components/ResponseInput.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import ResponseScrollArea from 'components/ResponseScrollArea.vue'
import ModelContent from 'components/ModelContent.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useModelSearch } from 'hooks/download'
import { ref } from 'vue'
import { previewUrlToFile } from 'utils/common'
import { useLoading } from 'hooks/loading'
import { request } from 'hooks/request'
import { useToast } from 'hooks/toast'
import { useConfig } from 'hooks/config'

const visible = defineModel<boolean>('visible')

const { isMobile } = useConfig()
const { toast } = useToast()
const loading = useLoading()

const modelUrl = ref<string>()

const { current, data, search } = useModelSearch()

const searchModelsByUrl = async () => {
  if (modelUrl.value) {
    await search(modelUrl.value)
  }
}

const clearContent = () => {
  modelUrl.value = undefined
  data.value = []
}

const createDownTask = async (data: VersionModel) => {
  const formData = new FormData()

  loading.show()
  // set base info
  formData.append('type', data.type)
  formData.append('pathIndex', data.pathIndex.toString())
  formData.append('fullname', data.fullname)
  // set preview
  const previewFile = await previewUrlToFile(data.preview as string).catch(
    () => {
      loading.hide()
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to download preview',
        life: 15000,
      })
      throw new Error('Failed to download preview')
    },
  )
  formData.append('previewFile', previewFile)
  // set description
  formData.append('description', data.description)
  // set model download info
  formData.append('downloadPlatform', data.downloadPlatform)
  formData.append('downloadUrl', data.downloadUrl)
  formData.append('sizeBytes', data.sizeBytes.toString())
  formData.append('hashes', JSON.stringify(data.hashes))

  await request('/model', {
    method: 'POST',
    body: formData,
  })
    .then(() => {
      visible.value = false
    })
    .catch((e) => {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: e.message ?? 'Failed to create download task',
        life: 15000,
      })
    })
    .finally(() => {
      loading.hide()
    })
}
</script>
