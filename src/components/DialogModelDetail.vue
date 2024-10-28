<template>
  <Dialog
    v-model:visible="visible"
    :header="filename"
    :maximizable="!isMobile"
    maximizeIcon="pi pi-arrow-up-right-and-arrow-down-left-from-center"
    minimizeIcon="pi pi-arrow-down-left-and-arrow-up-right-to-center"
    pt:title:class="whitespace-nowrap text-ellipsis overflow-hidden"
    pt:root:class="max-h-full"
    pt:content:class="px-0"
    @after-hide="handleCancel"
  >
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
    <DialogResizer :min-width="390"></DialogResizer>
  </Dialog>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ModelContent from 'components/ModelContent.vue'
import DialogResizer from 'components/DialogResizer.vue'
import ResponseScroll from 'components/ResponseScroll.vue'
import { useConfig } from 'hooks/config'
import { computed, ref, watchEffect } from 'vue'
import { useModelNodeAction, useModels } from 'hooks/model'
import { useRequest } from 'hooks/request'

const visible = defineModel<boolean>('visible')
interface Props {
  model: Model
}
const props = defineProps<Props>()

const { isMobile } = useConfig()
const { remove, update } = useModels()

const editable = ref(false)

const { data: extraInfo, refresh: fetchExtraInfo } = useRequest(
  `/model/${props.model.type}/${props.model.pathIndex}/${props.model.fullname}`,
  {
    method: 'GET',
    manual: true,
  },
)

const modelContent = computed(() => {
  return Object.assign({}, props.model, extraInfo.value)
})

watchEffect(() => {
  if (visible.value === true) {
    fetchExtraInfo()
  }
})

const filename = computed(() => {
  const basename = props.model.fullname.split('/').pop()!
  return basename.replace(props.model.extension, '')
})

const handleCancel = () => {
  editable.value = false
}

const handleSave = async (data: BaseModel) => {
  editable.value = false
  await update(props.model, data)
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
