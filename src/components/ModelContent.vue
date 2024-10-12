<template>
  <form
    class="@container"
    @submit.prevent="handleSubmit"
    @reset.prevent="handleReset"
  >
    <div class="mx-auto w-full max-w-[50rem]">
      <div class="relative flex flex-col gap-4 overflow-hidden @xl:flex-row">
        <ModelPreview
          class="shrink-0"
          v-model:editable="editable"
        ></ModelPreview>

        <div class="flex flex-col gap-4 overflow-hidden">
          <div class="flex items-center justify-end gap-4">
            <slot name="action" :metadata="formInstance.metadata.value"></slot>
          </div>

          <ModelBaseInfo v-model:editable="editable"></ModelBaseInfo>
        </div>
      </div>

      <Tabs value="0" class="mt-4">
        <TabList>
          <Tab value="0">Description</Tab>
          <Tab value="1">Metadata</Tab>
        </TabList>
        <TabPanels pt:root:class="p-0 py-4">
          <TabPanel value="0">
            <ModelDescription v-model:editable="editable"></ModelDescription>
          </TabPanel>
          <TabPanel value="1">
            <ModelMetadata></ModelMetadata>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  </form>
</template>

<script setup lang="ts">
import ModelPreview from 'components/ModelPreview.vue'
import ModelBaseInfo from 'components/ModelBaseInfo.vue'
import ModelDescription from 'components/ModelDescription.vue'
import ModelMetadata from 'components/ModelMetadata.vue'
import Tab from 'primevue/tab'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import {
  useModelBaseInfoEditor,
  useModelDescriptionEditor,
  useModelFormData,
  useModelMetadataEditor,
  useModelPreviewEditor,
} from 'hooks/model'
import { toRaw, watch } from 'vue'
import { cloneDeep } from 'lodash'

interface Props {
  model: BaseModel
}

const props = defineProps<Props>()
const editable = defineModel<boolean>('editable')

const emits = defineEmits<{
  submit: [formData: BaseModel]
  reset: []
}>()

const formInstance = useModelFormData(() => cloneDeep(toRaw(props.model)))

useModelBaseInfoEditor(formInstance)
useModelPreviewEditor(formInstance)
useModelDescriptionEditor(formInstance)
useModelMetadataEditor(formInstance)

const handleReset = () => {
  formInstance.reset()
  emits('reset')
}

const handleSubmit = async () => {
  const data = formInstance.submit()
  emits('submit', data)
}

watch(
  () => props.model,
  () => {
    handleReset()
  },
)
</script>
