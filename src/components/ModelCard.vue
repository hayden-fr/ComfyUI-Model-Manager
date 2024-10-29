<template>
  <div
    class="group/card relative w-full cursor-pointer select-none preview-aspect"
    @click.stop="openDetailDialog"
  >
    <div class="h-full overflow-hidden rounded-lg">
      <div class="h-full bg-gray-500 duration-300 group-hover/card:scale-110">
        <img class="h-full w-full object-cover" :src="preview" />
      </div>
    </div>

    <div
      data-draggable-overlay
      class="absolute left-0 top-0 h-full w-full"
      draggable="true"
      @dragend.stop="dragToAddModelNode"
    ></div>

    <div class="pointer-events-none absolute left-0 top-0 h-full w-full p-4">
      <div class="relative h-full w-full text-white">
        <div class="absolute bottom-0 left-0">
          <div class="drop-shadow-[0px_2px_2px_rgba(0,0,0,0.75)]">
            <div class="line-clamp-3 break-all text-2xl font-bold @lg:text-lg">
              {{ model.basename }}
            </div>
          </div>
        </div>

        <div class="absolute left-0 top-0 w-full">
          <div class="flex flex-row items-start justify-between">
            <div class="flex items-center rounded-full bg-black/30 px-3 py-2">
              <div class="font-bold @lg:text-xs">
                {{ displayType }}
              </div>
            </div>

            <div class="duration-300 group-hover/card:opacity-100">
              <div class="flex flex-col gap-4 *:pointer-events-auto">
                <Button
                  icon="pi pi-plus"
                  severity="secondary"
                  rounded
                  @click.stop="addModelNode"
                ></Button>
                <Button
                  icon="pi pi-copy"
                  severity="secondary"
                  rounded
                  @click.stop="copyModelNode"
                ></Button>
                <Button
                  v-show="model.preview"
                  icon="pi pi-file-import"
                  severity="secondary"
                  rounded
                  @click.stop="loadPreviewWorkflow"
                ></Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import DialogModelDetail from 'components/DialogModelDetail.vue'
import Button from 'primevue/button'
import { genModelKey, resolveModelType } from 'utils/model'
import { computed } from 'vue'
import { useModelNodeAction } from 'hooks/model'
import { useDialog } from 'hooks/dialog'

interface Props {
  model: Model
}

const props = defineProps<Props>()

const dialog = useDialog()

const openDetailDialog = () => {
  const basename = props.model.fullname.split('/').pop()!
  const filename = basename.replace(props.model.extension, '')

  dialog.open({
    key: genModelKey(props.model),
    title: filename,
    content: DialogModelDetail,
    contentProps: { model: props.model },
  })
}

const displayType = computed(() => resolveModelType(props.model.type).display)
const preview = computed(() =>
  Array.isArray(props.model.preview)
    ? props.model.preview[0]
    : props.model.preview,
)

const { addModelNode, dragToAddModelNode, copyModelNode, loadPreviewWorkflow } =
  useModelNodeAction(props.model)
</script>
