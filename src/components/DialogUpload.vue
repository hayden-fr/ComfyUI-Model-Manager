<template>
  <div class="h-full px-4">
    <!-- <div v-show="batchScanningStep === 0" class="h-full">
      <div class="flex h-full items-center px-8">
        <div class="h-20 w-full opacity-60">
          <ProgressBar mode="indeterminate" style="height: 6px"></ProgressBar>
        </div>
      </div>
    </div> -->

    <Stepper v-model:value="stepValue" class="flex h-full flex-col" linear>
      <StepList>
        <Step :value="1">{{ $t('selectModelType') }}</Step>
        <Step :value="2">{{ $t('selectSubdirectory') }}</Step>
        <Step :value="3">{{ $t('chooseFile') }}</Step>
      </StepList>
      <StepPanels class="flex-1 overflow-hidden">
        <StepPanel :value="1" class="h-full">
          <div class="flex h-full flex-col overflow-hidden">
            <ResponseScroll>
              <div class="flex flex-wrap gap-4">
                <Button
                  v-for="item in typeOptions"
                  :key="item.value"
                  :label="item.label"
                  @click="item.command"
                ></Button>
              </div>
            </ResponseScroll>
          </div>
        </StepPanel>
        <StepPanel :value="2" class="h-full">
          <div class="flex h-full flex-col overflow-hidden">
            <ResponseScroll class="flex-1">
              <Tree
                class="h-full"
                v-model:selection-keys="selectedKey"
                :value="pathOptions"
                selectionMode="single"
                :pt:nodeLabel:class="'text-ellipsis overflow-hidden'"
              ></Tree>
            </ResponseScroll>

            <div class="flex justify-between pt-6">
              <Button
                :label="$t('back')"
                severity="secondary"
                icon="pi pi-arrow-left"
                @click="handleBackTypeSelect"
              ></Button>
              <Button
                :label="$t('next')"
                icon="pi pi-arrow-right"
                icon-pos="right"
                :disabled="!enabledUpload"
                @click="handleConfirmSubdir"
              ></Button>
            </div>
          </div>
        </StepPanel>
        <StepPanel :value="3" class="h-full">
          <div class="flex h-full flex-col items-center justify-center">
            <template v-if="showUploadProgress">
              <div class="w-4/5">
                <ProgressBar
                  :value="uploadProgress"
                  :pt:value:style="{ transition: 'width .1s linear' }"
                ></ProgressBar>
              </div>
            </template>

            <template v-else>
              <div class="overflow-hidden break-words py-8">
                <div class="overflow-hidden px-8">
                  <div class="text-center">
                    <div class="pb-2">
                      {{ $t('selectedSpecialPath') }}
                    </div>
                    <div class="leading-5 opacity-60">
                      {{ selectedModelFolder }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-center gap-4">
                <Button
                  v-for="item in uploadActions"
                  :key="item.value"
                  :label="item.label"
                  :icon="item.icon"
                  @click="item.command.call(item)"
                ></Button>
              </div>
            </template>

            <div class="h-1/4"></div>
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
</template>

<script setup lang="ts">
import ResponseScroll from 'components/ResponseScroll.vue'
import { configSetting } from 'hooks/config'
import { useModelFolder, useModels } from 'hooks/model'
import { request } from 'hooks/request'
import { useToast } from 'hooks/toast'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import Step from 'primevue/step'
import StepList from 'primevue/steplist'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import Tree from 'primevue/tree'
import { api, app } from 'scripts/comfyAPI'
import { computed, onMounted, onUnmounted, ref, toValue } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { toast } = useToast()

const stepValue = ref(1)

const { folders } = useModels()

const currentType = ref<string>()
const typeOptions = computed(() => {
  const excludeScanTypes = app.ui?.settings.getSettingValue<string>(
    configSetting.excludeScanTypes,
  )
  const customBlackList =
    excludeScanTypes
      ?.split(',')
      .map((type) => type.trim())
      .filter(Boolean) ?? []
  return Object.keys(folders.value)
    .filter((folder) => !customBlackList.includes(folder))
    .map((type) => {
      return {
        label: type,
        value: type,
        command: () => {
          currentType.value = type
          stepValue.value++
        },
      }
    })
})

const { pathOptions } = useModelFolder({ type: currentType })

const selectedModelFolder = ref<string>()
const selectedKey = computed({
  get: () => {
    const key = selectedModelFolder.value
    return key ? { [key]: true } : {}
  },
  set: (val) => {
    const key = Object.keys(val)[0]
    selectedModelFolder.value = key
  },
})

const enabledUpload = computed(() => {
  return !!selectedModelFolder.value
})

const handleBackTypeSelect = () => {
  selectedModelFolder.value = undefined
  currentType.value = undefined
  stepValue.value--
}

const handleConfirmSubdir = () => {
  stepValue.value++
}

const uploadTotalSize = ref<number>()
const uploadSize = ref<number>()
const uploadProgress = computed(() => {
  const total = toValue(uploadTotalSize)
  const size = toValue(uploadSize)
  if (typeof total === 'number' && typeof size === 'number') {
    return Math.floor((size / total) * 100)
  }
  return undefined
})
const showUploadProgress = computed(() => {
  return typeof uploadProgress.value !== 'undefined'
})

const uploadActions = ref([
  {
    value: 'back',
    label: t('back'),
    icon: 'pi pi-arrow-left',
    command: () => {
      stepValue.value--
    },
  },
  {
    value: 'full',
    label: t('chooseFile'),
    command: () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = supportedExtensions.value.join(',')
      input.onchange = async () => {
        const files = input.files
        const file = files?.item(0)
        if (!file) {
          return
        }

        try {
          uploadTotalSize.value = file.size
          uploadSize.value = 0
          const body = new FormData()
          body.append('folder', toValue(selectedModelFolder)!)
          body.append('file', file)

          await request('/upload', {
            method: 'POST',
            body: body,
          })
        } catch (error) {
          toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.message,
            life: 5000,
          })
        }
      }
      input.click()
    },
  },
])

const supportedExtensions = ref([])

const fetchSupportedExtensions = async () => {
  try {
    const result = await request('/supported-extensions')
    supportedExtensions.value = result ?? []
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.message,
      life: 5000,
    })
  }
}

const update_process = (event: CustomEvent) => {
  const detail = event.detail
  uploadSize.value = detail.uploaded_size
}

onMounted(() => {
  fetchSupportedExtensions()

  api.addEventListener('update_upload_progress', update_process)
})

onUnmounted(() => {
  api.removeEventListener('update_upload_progress', update_process)
})
</script>
