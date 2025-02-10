<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 px-4">
      <DataTable :value="sizeList">
        <Column field="name" :header="$t('name')">
          <template #body="{ data, field }">
            {{ $t(data[field]) }}
          </template>
        </Column>
        <Column field="width" :header="$t('width')" class="min-w-36">
          <template #body="{ data, field }">
            <span class="flex items-center gap-4">
              <Slider
                v-model="data[field]"
                class="flex-1"
                v-bind="sizeStint"
              ></Slider>
              <span>{{ data[field] }}</span>
            </span>
          </template>
        </Column>
        <Column field="height" :header="$t('height')" class="min-w-36">
          <template #body="{ data, field }">
            <span class="flex items-center gap-4">
              <Slider
                v-model="data[field]"
                class="flex-1"
                v-bind="sizeStint"
              ></Slider>
              <span>{{ data[field] }}</span>
            </span>
          </template>
        </Column>
      </DataTable>
    </div>
    <div class="flex justify-between px-4">
      <div></div>
      <div class="flex gap-2">
        <Button
          icon="pi pi-refresh"
          :label="$t('reset')"
          @click="handleReset"
        ></Button>
        <Button :label="$t('cancel')" @click="handleCancelEditor"></Button>
        <Button :label="$t('save')" @click="handleSaveSizeMap"></Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useConfig } from 'hooks/config'
import { useDialog } from 'hooks/dialog'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Slider from 'primevue/slider'
import { onMounted, ref } from 'vue'

const { cardSizeMap, defaultCardSizeMap } = useConfig()
const dialog = useDialog()

const sizeList = ref()

const sizeStint = {
  step: 10,
  min: 80,
  max: 320,
}

const resolveSizeMap = (sizeMap: Record<string, string>) => {
  return Object.entries(sizeMap).map(([key, value]) => {
    const [width, height] = value.split('x')
    return {
      id: key,
      name: key,
      width: parseInt(width),
      height: parseInt(height),
    }
  })
}

const resolveSizeList = (
  sizeList: { name: string; width: number; height: number }[],
) => {
  return Object.fromEntries(
    sizeList.map(({ name, width, height }) => {
      return [name, [width, height].join('x')]
    }),
  )
}

onMounted(() => {
  sizeList.value = resolveSizeMap(cardSizeMap.value)
})

const handleReset = () => {
  sizeList.value = resolveSizeMap(defaultCardSizeMap)
}

const handleCancelEditor = () => {
  sizeList.value = resolveSizeMap(cardSizeMap.value)
  dialog.close()
}

const handleSaveSizeMap = () => {
  cardSizeMap.value = resolveSizeList(sizeList.value)
  dialog.close()
}
</script>
