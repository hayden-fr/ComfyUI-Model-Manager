import { defineStore } from 'hooks/store'
import { useBoolean } from 'hooks/utils'
import { ref, watch } from 'vue'

export const useDialogManager = defineStore('dialogManager', () => {
  const [visible, toggle] = useBoolean()

  const mounted = ref(false)
  const open = ref(false)

  watch(visible, (visible) => {
    open.value = visible
    mounted.value = true
  })

  const updateVisible = (val: boolean) => {
    visible.value = val
  }

  return { visible: mounted, open, updateVisible, toggle }
})

declare module 'hooks/store' {
  interface StoreProvider {
    dialogManager: ReturnType<typeof useDialogManager>
  }
}
