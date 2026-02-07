<template>
  <div class="flex flex-col gap-8 p-4 w-96">
    <div class="flex items-center justify-between">
      <span>{{ $t('multiThreadDownload') }}</span>
      <ToggleSwitch v-model="multiThreadEnabled" />
    </div>
    <div class="flex items-center justify-between">
      <span>{{ $t('threadCount') }}</span>
      <InputNumber v-model="threadCount" :min="1" :max="32" showButtons :step="1" class="w-32" />
    </div>
    <div class="flex justify-end gap-2 mt-4">
       <Button :label="$t('save')" @click="save" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import InputNumber from 'primevue/inputnumber'
import { app } from 'scripts/comfyAPI'
import { useDialog } from 'hooks/dialog'
import { useToast } from 'hooks/toast'

const { close } = useDialog()
const { toast } = useToast()

const multiThreadEnabled = ref(true)
const threadCount = ref(4)

onMounted(() => {
  multiThreadEnabled.value = app.ui.settings.getSettingValue('ModelManager.Download.MultiThreadEnabled', true)
  threadCount.value = app.ui.settings.getSettingValue('ModelManager.Download.ThreadCount', 4)
})

const save = () => {
  app.ui.settings.setSettingValue('ModelManager.Download.MultiThreadEnabled', multiThreadEnabled.value)
  app.ui.settings.setSettingValue('ModelManager.Download.ThreadCount', threadCount.value)
  toast.add({ severity: 'success', summary: 'Settings Saved', life: 2000 })
  close()
}
</script>
