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

    <!-- Direct file URL indicator with folder selection -->
    <div v-if="isDirectFile && modelUrl" class="flex flex-col gap-2">
      <div
        class="flex items-center gap-2 rounded bg-green-50 p-2 text-sm text-green-600"
      >
        <i class="pi pi-check-circle"></i>
        <span>Direct file download detected</span>
      </div>

      <!-- Model Type/Folder Selection for direct downloads -->
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium">{{ $t('modelType') }}:</label>
        <ResponseSelect
          v-model="selectedModelType"
          :items="modelTypeOptions"
          :type="'drop'"
          class="flex-1"
        />
      </div>
    </div>

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
            :key="`${currentModel.id}-${currentModel.currentFileId}`"
            :model="currentModel"
            :editable="true"
            @submit="createDownTask"
          >
            <template #action>
              <div v-if="currentModel.files" class="flex-1">
                <ResponseSelect
                  :model-value="currentModel.currentFileId"
                  :items="currentModel.selectionFiles"
                  :type="isMobile ? 'drop' : 'button'"
                >
                </ResponseSelect>
              </div>
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
import {
  getFilenameFromUrl,
  getModelTypeFromFilename,
  isDirectFileUrl,
  previewUrlToFile,
} from 'utils/common'
import { computed, ref, watch } from 'vue'

const { isMobile } = useConfig()
const { toast } = useToast()
const loading = useLoading()
const dialog = useDialog()

const modelUrl = ref<string>()

// Model type selection for direct downloads
const selectedModelType = ref<string>('checkpoints')

const modelTypeOptions = computed(() => [
  {
    label: 'Checkpoints',
    value: 'checkpoints',
    command: () => {
      selectedModelType.value = 'checkpoints'
    },
  },
  {
    label: 'LoRA',
    value: 'loras',
    command: () => {
      selectedModelType.value = 'loras'
    },
  },
  {
    label: 'ControlNet',
    value: 'controlnet',
    command: () => {
      selectedModelType.value = 'controlnet'
    },
  },
  {
    label: 'VAE',
    value: 'vae',
    command: () => {
      selectedModelType.value = 'vae'
    },
  },
  {
    label: 'Embeddings',
    value: 'embeddings',
    command: () => {
      selectedModelType.value = 'embeddings'
    },
  },
  {
    label: 'Upscale Models',
    value: 'upscale_models',
    command: () => {
      selectedModelType.value = 'upscale_models'
    },
  },
  {
    label: 'Diffusers',
    value: 'diffusers',
    command: () => {
      selectedModelType.value = 'diffusers'
    },
  },
  {
    label: 'CLIP',
    value: 'clip',
    command: () => {
      selectedModelType.value = 'clip'
    },
  },
  {
    label: 'CLIP Vision',
    value: 'clip_vision',
    command: () => {
      selectedModelType.value = 'clip_vision'
    },
  },
  {
    label: 'UNet/Diffusion Models',
    value: 'diffusion_models',
    command: () => {
      selectedModelType.value = 'diffusion_models'
    },
  },
  {
    label: 'Style Models',
    value: 'style_models',
    command: () => {
      selectedModelType.value = 'style_models'
    },
  },
  {
    label: 'Hypernetworks',
    value: 'hypernetworks',
    command: () => {
      selectedModelType.value = 'hypernetworks'
    },
  },
  {
    label: 'GLIGEN',
    value: 'gligen',
    command: () => {
      selectedModelType.value = 'gligen'
    },
  },
  {
    label: 'PhotoMaker',
    value: 'photomaker',
    command: () => {
      selectedModelType.value = 'photomaker'
    },
  },
  {
    label: 'VAE Approx',
    value: 'vae_approx',
    command: () => {
      selectedModelType.value = 'vae_approx'
    },
  },
  {
    label: 'Classifiers',
    value: 'classifiers',
    command: () => {
      selectedModelType.value = 'classifiers'
    },
  },
])

const isDirectFile = computed(() =>
  modelUrl.value ? isDirectFileUrl(modelUrl.value) : false,
)

const { current, currentModel, data, search } = useModelSearch()

const searchModelsByUrl = async () => {
  if (modelUrl.value) {
    const modelType = isDirectFile.value ? selectedModelType.value : undefined
    await search(modelUrl.value, modelType)
  }
}

// Watch for direct file URL changes and set intelligent default
watch(modelUrl, (newUrl) => {
  if (newUrl && isDirectFileUrl(newUrl)) {
    const filename = getFilenameFromUrl(newUrl)
    const suggestedType = getModelTypeFromFilename(filename)
    selectedModelType.value = suggestedType
  }
})

// Watch for model type changes on direct files and refresh the model
watch(selectedModelType, async () => {
  if (isDirectFile.value && modelUrl.value) {
    await search(modelUrl.value, selectedModelType.value)
  }
})

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
