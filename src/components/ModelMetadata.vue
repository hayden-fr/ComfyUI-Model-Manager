<template>
  <table v-if="dataSource.length" class="w-full border-collapse border">
    <tbody>
      <tr v-for="item in dataSource" class="h-8 border-b">
        <td class="border-r bg-gray-300 px-4 dark:bg-gray-800">
          {{ item.key }}
        </td>
        <td class="break-all px-4">{{ item.value }}</td>
      </tr>
    </tbody>
  </table>

  <div v-else class="flex flex-col items-center gap-2 py-5">
    <i class="pi pi-info-circle text-lg"></i>
    <div>no metadata</div>
  </div>
</template>

<script setup lang="ts">
import { useModelMetadata } from 'hooks/model'
import { computed } from 'vue'

const { metadata } = useModelMetadata()

const dataSource = computed(() => {
  const dataSource: { key: string; value: any }[] = []

  for (const key in metadata.value) {
    if (Object.prototype.hasOwnProperty.call(metadata.value, key)) {
      const value = metadata.value[key]
      dataSource.push({ key, value })
    }
  }

  return dataSource
})
</script>
