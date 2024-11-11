<template>
  <div
    class="rounded-lg border border-gray-500 p-4 text-gray-500"
    @dragenter.stop.prevent
    @dragover.stop.prevent
    @dragleave.stop.prevent
    @drop.stop.prevent="handleDropFile"
    @click="handleClick"
  >
    <slot name="default">
      <div class="flex h-full flex-col items-center justify-center gap-2">
        <i class="pi pi-cloud-upload text-2xl"></i>
        <p class="m-0 select-none overflow-hidden text-ellipsis">
          {{ $t('uploadFile') }}
        </p>
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { SelectEvent, SelectFile } from 'types/typings'

const emits = defineEmits<{
  select: [event: SelectEvent]
}>()

const covertFileList = (fileList: FileList) => {
  const files: SelectFile[] = []
  for (const file of fileList) {
    const selectFile = file as SelectFile
    selectFile.objectURL = URL.createObjectURL(file)
    files.push(selectFile)
  }
  return files
}

const handleDropFile = (event: DragEvent) => {
  const files = event.dataTransfer?.files

  if (files) {
    emits('select', { originalEvent: event, files: covertFileList(files) })
  }
}

const handleClick = (event: MouseEvent) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const files = input.files
    if (files) {
      emits('select', { originalEvent: event, files: covertFileList(files) })
    }
  }
  input.click()
}
</script>
