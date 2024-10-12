<template>
  <Dialog
    :visible="visible"
    @update:visible="updateVisible"
    :maximizable="!isMobile"
    maximizeIcon="pi pi-arrow-up-right-and-arrow-down-left-from-center"
    minimizeIcon="pi pi-arrow-down-left-and-arrow-up-right-to-center"
    :pt:mask:class="['group', { open }]"
    pt:root:class="max-h-full group-[:not(.open)]:!hidden"
    pt:content:class="px-0"
  >
    <template #header>
      <div class="flex flex-1 items-center justify-between pr-2">
        <span class="p-dialog-title select-none">{{ $t('modelManager') }}</span>
        <div class="p-dialog-header-actions">
          <Button
            icon="pi pi-refresh"
            severity="secondary"
            text
            rounded
            @click="refreshModels"
          ></Button>
          <Button
            icon="pi pi-download"
            severity="secondary"
            text
            rounded
            @click="download.toggle"
          ></Button>
        </div>
      </div>
    </template>

    <div
      class="flex h-full flex-col gap-4 overflow-hidden @container/content"
      :style="{
        ['--card-width']: `${cardWidth}px`,
        ['--gutter']: `${gutter}px`,
      }"
    >
      <div
        :class="[
          'grid grid-cols-1 justify-center gap-4 px-8',
          '@lg/content:grid-cols-[repeat(auto-fit,var(--card-width))]',
          '@lg/content:gap-[var(--gutter)]',
          '@lg/content:px-4',
        ]"
      >
        <div class="col-span-full @container/toolbar">
          <div :class="['flex flex-col gap-4', '@2xl/toolbar:flex-row']">
            <ResponseInput
              v-model="searchContent"
              :placeholder="$t('searchModels')"
              :allow-clear="true"
              suffix-icon="pi pi-search"
            ></ResponseInput>

            <div
              class="flex items-center justify-between gap-4 overflow-hidden"
            >
              <ResponseSelect
                v-model="currentType"
                :items="typeOptions"
                :type="isMobile ? 'drop' : 'button'"
              ></ResponseSelect>
              <ResponseSelect
                v-model="sortOrder"
                :items="sortOrderOptions"
              ></ResponseSelect>
            </div>
          </div>
        </div>
      </div>

      <ResponseScrollArea class="h-full">
        <div
          :class="[
            '-mt-8 grid grid-cols-1 justify-center gap-8 px-8',
            '@lg/content:grid-cols-[repeat(auto-fit,var(--card-width))]',
            '@lg/content:gap-[var(--gutter)]',
            '@lg/content:-mt-[var(--gutter)]',
            '@lg/content:px-4',
          ]"
        >
          <div class="col-span-full"></div>
          <div v-for="model in list" v-show="model.visible" :key="model.id">
            <DialogModelCard
              :key="`${model.type}:${model.pathIndex}:${model.fullname}`"
              :model="model"
            ></DialogModelCard>
          </div>
        </div>

        <div v-show="noneDisplayModel" class="flex justify-center pt-20">
          <div class="select-none text-lg font-bold">No models found</div>
        </div>
      </ResponseScrollArea>
    </div>

    <DialogResizer
      :min-width="cardWidth * 2 + gutter + 42"
      :min-height="cardWidth * aspect * 0.5 + 162"
    ></DialogResizer>
  </Dialog>
</template>

<script setup lang="ts" name="manager-dialog">
import { useConfig } from 'hooks/config'
import { useDialogManager } from 'hooks/manager'
import { useModels } from 'hooks/model'
import DialogResizer from 'components/DialogResizer.vue'
import DialogModelCard from 'components/DialogModelCard.vue'
import ResponseInput from 'components/ResponseInput.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import ResponseScrollArea from 'components/ResponseScrollArea.vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useToast } from 'hooks/toast'
import { useDownload } from 'hooks/download'
import { useI18n } from 'vue-i18n'

const { isMobile, cardWidth, gutter, aspect, refreshSetting } = useConfig()

const download = useDownload()

const { visible, updateVisible, open } = useDialogManager()
const { data, refresh } = useModels()
const { toast } = useToast()
const { t } = useI18n()

const searchContent = ref<string>()

const currentType = ref('all')
const typeOptions = ref(
  [
    { label: 'ALL', value: 'all' },
    { label: 'Checkpoint', value: 'checkpoints' },
    { label: 'embedding', value: 'embeddings' },
    { label: 'Hypernetwork', value: 'hypernetworks' },
    { label: 'Lora', value: 'loras' },
    { label: 'VAE', value: 'vae' },
    { label: 'VAE approx', value: 'vae_approx' },
    { label: 'Controlnet', value: 'controlnet' },
    { label: 'Clip', value: 'clip' },
    { label: 'Clip Vision', value: 'clip_vision' },
    { label: 'Diffusers', value: 'diffusers' },
    { label: 'Gligen', value: 'gligen' },
    { label: 'Photomaker', value: 'photomaker' },
    { label: 'Style Models', value: 'style_models' },
    { label: 'Unet', value: 'unet' },
  ].map((item) => {
    return {
      ...item,
      command: () => {
        currentType.value = item.value
      },
    }
  }),
)

const sortOrder = ref('name')
const sortOrderOptions = ref(
  ['name', 'size', 'created', 'modified'].map((key) => {
    return {
      label: t(`sort.${key}`),
      value: key,
      icon: key === 'name' ? 'pi pi-sort-alpha-down' : 'pi pi-sort-amount-down',
      command: () => {
        sortOrder.value = key
      },
    }
  }),
)

const list = computed(() => {
  const filterList = data.value.map((model) => {
    const showAllModel = currentType.value === 'all'

    const matchType = showAllModel || model.type === currentType.value
    const matchName = model.fullname
      .toLowerCase()
      .includes(searchContent.value?.toLowerCase() || '')

    model.visible = matchType && matchName

    return model
  })

  let sortStrategy = (a: Model, b: Model) => 0
  switch (sortOrder.value) {
    case 'name':
      sortStrategy = (a, b) => a.fullname.localeCompare(b.fullname)
      break
    case 'size':
      sortStrategy = (a, b) => b.sizeBytes - a.sizeBytes
      break
    case 'created':
      sortStrategy = (a, b) => b.createdAt - a.createdAt
      break
    case 'modified':
      sortStrategy = (a, b) => b.updatedAt - a.updatedAt
      break
    default:
      break
  }

  return filterList.sort(sortStrategy)
})

const noneDisplayModel = computed(() => {
  return !list.value.some((model) => model.visible)
})

const refreshModels = async () => {
  await Promise.all([refresh(), refreshSetting()])
  toast.add({
    severity: 'success',
    summary: 'Refreshed Models',
    life: 2000,
  })
}
</script>
