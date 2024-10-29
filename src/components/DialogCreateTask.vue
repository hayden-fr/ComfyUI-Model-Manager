<template>
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

    <ResponseScroll class="-mx-5 h-full">
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
    </ResponseScroll>
  </div>
</template>

<script setup lang="ts">
import ModelContent from 'components/ModelContent.vue'
import ResponseInput from 'components/ResponseInput.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import Button from 'primevue/button'
import { useConfig } from 'hooks/config'
import { useDialog } from 'hooks/dialog'
import { useModelSearch } from 'hooks/download'
import { useLoading } from 'hooks/loading'
import { request } from 'hooks/request'
import { useToast } from 'hooks/toast'
import { previewUrlToFile } from 'utils/common'
import { ref } from 'vue'

const { isMobile } = useConfig()
const { toast } = useToast()
const loading = useLoading()
const dialog = useDialog()

const modelUrl = ref<string>()

const { current, data, search } = useModelSearch()

const searchModelsByUrl = async () => {
  if (modelUrl.value) {
    await search(modelUrl.value)
  }
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
      dialog.close({ key: 'model-manager-create-task' })
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
