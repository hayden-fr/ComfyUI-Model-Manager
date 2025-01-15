<template>
  <ResponseScroll class="h-full">
    <div class="px-8">
      <ModelContent
        v-model:editable="editable"
        :model="modelContent"
        @submit="handleSave"
        @reset="handleCancel"
      >
        <template #action="{ metadata }">
          <template v-if="editable">
            <Button :label="$t('cancel')" type="reset"></Button>
            <Button :label="$t('save')" type="submit"></Button>
          </template>
          <template v-else>
            <Button
              v-show="metadata.modelPage"
              icon="pi pi-eye"
              @click="openModelPage(metadata.modelPage)"
            ></Button>
            <Button icon="pi pi-plus" @click.stop="addModelNode"></Button>
            <Button icon="pi pi-copy" @click.stop="copyModelNode"></Button>
            <Button
              v-show="model.preview"
              icon="pi pi-file-import"
              @click.stop="loadPreviewWorkflow"
            ></Button>
            <Button
              icon="pi pi-pen-to-square"
              @click="editable = true"
            ></Button>
            <Button
              severity="danger"
              icon="pi pi-trash"
              @click="handleDelete"
            ></Button>
          </template>
        </template>
      </ModelContent>
    </div>
  </ResponseScroll>
</template>

<script setup lang="ts">
import ModelContent from 'components/ModelContent.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import { useModelNodeAction, useModels } from 'hooks/model'
import { useRequest } from 'hooks/request'
import Button from 'primevue/button'
import { BaseModel, Model, WithResolved } from 'types/typings'
import { computed, ref } from 'vue'

interface Props {
  model: Model
}
const props = defineProps<Props>()

const { remove, update } = useModels()

const editable = ref(false)

const modelDetailUrl = `/model/${props.model.type}/${props.model.pathIndex}/${props.model.fullname}`
const { data: extraInfo } = useRequest(modelDetailUrl, {
  method: 'GET',
})

const modelContent = computed(() => {
  return Object.assign({}, props.model, extraInfo.value)
})

const handleCancel = () => {
  editable.value = false
}

const handleSave = async (data: WithResolved<BaseModel>) => {
  await update(modelContent.value, data)
  editable.value = false
}

const handleDelete = async () => {
  await remove(props.model)
}

const openModelPage = (url: string) => {
  window.open(url, '_blank')
}

const { addModelNode, copyModelNode, loadPreviewWorkflow } = useModelNodeAction(
  props.model,
)
</script>
