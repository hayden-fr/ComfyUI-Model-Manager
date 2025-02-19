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
          class="pi pi-search text-base opacity-60"
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
        <KeepAlive>
          <ModelContent
            v-if="currentModel"
            :key="currentModel.id"
            :model="currentModel"
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
        </KeepAlive>

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
import ResponseScroll from 'components/ResponseScroll.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import { useConfig } from 'hooks/config'
import { useDialog } from 'hooks/dialog'
import { useModelSearch } from 'hooks/download'
import { useLoading } from 'hooks/loading'
import { genModelFullName } from 'hooks/model'
import { request } from 'hooks/request'
import { useToast } from 'hooks/toast'
import Button from 'primevue/button'
import { VersionModel, WithResolved } from 'types/typings'
import { previewUrlToFile } from 'utils/common'
import { ref } from 'vue'

const { isMobile } = useConfig()
const { toast } = useToast()
const loading = useLoading()
const dialog = useDialog()

const modelUrl = ref<string>()

const { current, currentModel, data, search } = useModelSearch()

const searchModelsByUrl = async () => {
  if (modelUrl.value) {
    await search(modelUrl.value)
  }
}

const createDownTask = async (data: WithResolved<VersionModel>) => {
  loading.show()

  const formData = new FormData()
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      let value = data[key]

      // set preview file
      if (key === 'preview') {
        if (value) {
          const previewFile = await previewUrlToFile(value).catch(() => {
            loading.hide()
            toast.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to download preview',
              life: 5000,
            })
            throw new Error('Failed to download preview')
          })
          formData.append('previewFile', previewFile)
        } else {
          formData.append('previewFile', value)
        }
        continue
      }

      if (typeof value === 'object') {
        value = JSON.stringify(value)
      }

      if (typeof value === 'number') {
        value = value.toString()
      }

      formData.append(key, value)
    }
  }

  const fullname = genModelFullName(data as VersionModel)
  formData.append('fullname', fullname)

  await request('/model', {
    method: 'POST',
    body: formData,
  })
    .then(() => {
      dialog.close()
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
