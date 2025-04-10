<template>
  <div class="h-full px-4">
    <div v-show="batchScanningStep === 0" class="h-full">
      <div class="flex h-full items-center px-8">
        <div class="h-20 w-full opacity-60">
          <ProgressBar mode="indeterminate" style="height: 6px"></ProgressBar>
        </div>
      </div>
    </div>

    <Stepper
      v-show="batchScanningStep === 1"
      v-model:value="stepValue"
      class="flex h-full flex-col"
      linear
    >
      <StepList>
        <Step value="1">{{ $t('selectModelType') }}</Step>
        <Step value="2">{{ $t('selectSubdirectory') }}</Step>
        <Step value="3">{{ $t('scanModelInformation') }}</Step>
      </StepList>
      <StepPanels class="flex-1 overflow-hidden">
        <StepPanel value="1" class="h-full">
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
        <StepPanel value="2" class="h-full">
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
                :disabled="!enabledScan"
                @click="handleConfirmSubdir"
              ></Button>
            </div>
          </div>
        </StepPanel>
        <StepPanel value="3" class="h-full">
          <div class="overflow-hidden break-words py-8">
            <div class="overflow-hidden px-8">
              <div v-show="currentType === allType" class="text-center">
                {{ $t('selectedAllPaths') }}
              </div>
              <div v-show="currentType !== allType" class="text-center">
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
              v-for="item in scanActions"
              :key="item.value"
              :label="item.label"
              :icon="item.icon"
              @click="item.command.call(item)"
            ></Button>
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>

    <div v-show="batchScanningStep === 2" class="h-full">
      <div class="flex h-full items-center px-8">
        <div class="h-20 w-full">
          <div v-show="scanProgress > -1">
            <ProgressBar :value="scanProgress">
              {{ scanCompleteCount }} / {{ scanTotalCount }}
            </ProgressBar>
          </div>

          <div v-show="scanProgress === -1" class="text-center">
            <Button
              severity="secondary"
              :label="$t('back')"
              icon="pi pi-arrow-left"
              @click="handleBackTypeSelect"
            ></Button>
            <span class="pl-2">{{ $t('noModelsInCurrentPath') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ResponseScroll from 'components/ResponseScroll.vue'
import { configSetting } from 'hooks/config'
import { useModelFolder, useModels } from 'hooks/model'
import { request } from 'hooks/request'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import Step from 'primevue/step'
import StepList from 'primevue/steplist'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import Tree from 'primevue/tree'
import { api, app } from 'scripts/comfyAPI'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const stepValue = ref('1')

const { folders } = useModels()

const allType = 'All'
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
        stepValue.value = currentType.value === allType ? '3' : '2'
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

const enabledScan = computed(() => {
  return currentType.value === allType || !!selectedModelFolder.value
})

const handleBackTypeSelect = () => {
  selectedModelFolder.value = undefined
  currentType.value = undefined
  stepValue.value = '1'
  batchScanningStep.value = 1
}

const handleConfirmSubdir = () => {
  stepValue.value = '3'
}

const batchScanningStep = ref(0)
const scanModelsList = ref<Record<string, boolean>>({})
const scanTotalCount = computed(() => {
  return Object.keys(scanModelsList.value).length
})
const scanCompleteCount = computed(() => {
  return Object.keys(scanModelsList.value).filter(
    (key) => scanModelsList.value[key],
  ).length
})
const scanProgress = computed(() => {
  if (scanTotalCount.value === 0) {
    return -1
  }
  const progress = scanCompleteCount.value / scanTotalCount.value
  return Number(progress.toFixed(4)) * 100
})

const handleScanModelInformation = async function () {
  batchScanningStep.value = 0
  const mode = this.value
  const path = selectedModelFolder.value

  try {
    const result = await request('/model-info/scan', {
      method: 'POST',
      body: JSON.stringify({ mode, path }),
    })
    scanModelsList.value = result?.models ?? {}
    batchScanningStep.value = 2
  } catch {
    batchScanningStep.value = 1
  }
}

const scanActions = ref([
  {
    value: 'back',
    label: t('back'),
    icon: 'pi pi-arrow-left',
    command: () => {
      stepValue.value = currentType.value === allType ? '1' : '2'
    },
  },
  {
    value: 'full',
    label: t('scanFullInformation'),
    command: handleScanModelInformation,
  },
  {
    value: 'diff',
    label: t('scanMissInformation'),
    command: handleScanModelInformation,
  },
])

const refreshTaskContent = async () => {
  const result = await request('/model-info/scan')
  const listContent = result?.models ?? {}
  scanModelsList.value = listContent
  batchScanningStep.value = Object.keys(listContent).length ? 2 : 1
}

onMounted(() => {
  refreshTaskContent()

  api.addEventListener('update_scan_information_task', (event) => {
    const content = event.detail
    scanModelsList.value = content.models
  })
})
</script>
