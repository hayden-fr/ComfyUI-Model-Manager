<template>
  <div class="h-full px-4">
    <Stepper v-model:value="stepValue" class="flex h-full flex-col" linear>
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
                :disabled="!enabledScan"
                @click="handleScanModelInformation"
              ></Button>
            </div>
          </div>
        </StepPanel>
        <StepPanel value="3" class="h-full">
          <div class="">
            <div class="flex justify-center py-8">
              <div v-show="currentType === allType">
                <span>
                  {{
                    $t(
                      currentType === allType
                        ? 'selectedAllPaths'
                        : 'selectedPaths',
                    )
                  }}
                </span>
                <span>{{ selectedModelFolder }}</span>
              </div>
            </div>

            <div class="flex h-full items-center justify-center gap-4">
              <Button
                v-for="item in scanActions"
                :key="item.value"
                :label="item.label"
                :icon="item.icon"
                @click="item.command"
              ></Button>
            </div>
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
import Button from 'primevue/button'
import Step from 'primevue/step'
import StepList from 'primevue/steplist'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import Tree from 'primevue/tree'
import { app } from 'scripts/comfyAPI'
import { computed, ref } from 'vue'
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
}

const handleScanModelInformation = () => {
  stepValue.value = '3'
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
    value: 'miss',
    label: t('scanMissInformation'),
    command: () => {
      console.log('scanActions')
    },
  },
  {
    value: 'full',
    label: t('scanFullInformation'),
    command: () => {
      console.log('scanActions')
    },
  },
])
</script>
