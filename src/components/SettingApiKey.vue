<template>
  <div class="p-4">
    <InputText
      class="w-full"
      v-model="content"
      placeholder="Set New API Key"
      autocomplete="off"
    ></InputText>
    <div class="mt-4 flex items-center justify-between">
      <div>
        <span v-show="showError" class="text-red-400">
          API Key Not Allow Empty
        </span>
      </div>
      <Button label="Save" autofocus @click="saveKeybinding"></Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDialog } from 'hooks/dialog'
import { request } from 'hooks/request'
import { useToast } from 'hooks/toast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { ref, toValue } from 'vue'

interface Props {
  keyField: string
  setter: (val: string) => void
}

const props = defineProps<Props>()

const { close } = useDialog()
const { toast } = useToast()

const content = ref<string>()
const showError = ref<boolean>(false)

const saveKeybinding = async () => {
  const value = toValue(content)
  if (!value) {
    showError.value = true
    return
  }

  showError.value = false
  const key = toValue(props.keyField)

  try {
    const encodeValue = value ? btoa(value) : null
    await request('/download/setting', {
      method: 'POST',
      body: JSON.stringify({ key, value: encodeValue }),
    })
    const desString = value ? value.slice(0, 4) + '****' + value.slice(-4) : ''
    props.setter(desString)
    close()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error.message,
      life: 3000,
    })
  }
}
</script>
