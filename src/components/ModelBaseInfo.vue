<template>
  <div class="flex flex-col gap-4">
    <div v-if="editable" class="flex flex-col gap-4">
      <ResponseSelect v-if="!baseInfo.type" v-model="type" :items="typeOptions">
        <template #prefix>
          <span>{{ $t('modelType') }}</span>
        </template>
      </ResponseSelect>

      <ResponseSelect class="w-full" v-model="pathIndex" :items="pathOptions">
      </ResponseSelect>

      <ResponseInput
        v-model.trim="basename"
        class="-mr-2 text-right"
        update-trigger="blur"
      >
        <template #suffix>
          <span class="pi-inputicon">
            {{ extension }}
          </span>
        </template>
      </ResponseInput>
    </div>

    <table class="w-full table-fixed border-collapse border">
      <colgroup>
        <col class="w-32" />
        <col />
      </colgroup>
      <tbody>
        <tr v-for="item in information" class="h-8 whitespace-nowrap border-b">
          <td class="border-r bg-gray-300 px-4 dark:bg-gray-800">
            {{ $t(`info.${item.key}`) }}
          </td>
          <td class="overflow-hidden text-ellipsis break-all px-4">
            {{ item.display }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import ResponseInput from 'components/ResponseInput.vue'
import ResponseSelect from 'components/ResponseSelect.vue'
import { useConfig } from 'hooks/config'
import { useModelBaseInfo } from 'hooks/model'
import { computed } from 'vue'

const editable = defineModel<boolean>('editable')

const { modelFolders } = useConfig()

const { baseInfo, pathIndex, basename, extension, type } = useModelBaseInfo()

const typeOptions = computed(() => {
  return Object.keys(modelFolders.value).map((curr) => {
    return {
      value: curr,
      label: curr,
      command: () => {
        type.value = curr
        pathIndex.value = 0
      },
    }
  })
})

const pathOptions = computed(() => {
  return (modelFolders.value[type.value] ?? []).map((folder, index) => {
    return {
      value: index,
      label: folder,
      command: () => {
        pathIndex.value = index
      },
    }
  })
})

const information = computed(() => {
  return Object.values(baseInfo.value).filter((row) => {
    if (editable.value) {
      const hiddenKeys = ['fullname', 'pathIndex']
      return !hiddenKeys.includes(row.key)
    }
    return true
  })
})
</script>
