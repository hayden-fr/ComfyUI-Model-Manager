import { useRequest } from 'hooks/request'
import { defineStore } from 'hooks/store'
import { app } from 'scripts/comfyAPI'
import { onMounted, onUnmounted, ref } from 'vue'

export const useConfig = defineStore('config', () => {
  const mobileDeviceBreakPoint = 759
  const isMobile = ref(window.innerWidth < mobileDeviceBreakPoint)

  type ModelFolder = Record<string, string[]>
  const { data: modelFolders, refresh: refreshModelFolders } =
    useRequest<ModelFolder>('/base-folders')

  const checkDeviceType = () => {
    isMobile.value = window.innerWidth < mobileDeviceBreakPoint
  }

  onMounted(() => {
    window.addEventListener('resize', checkDeviceType)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkDeviceType)
  })

  const refresh = async () => {
    return Promise.all([refreshModelFolders()])
  }

  const config = {
    isMobile,
    gutter: 16,
    cardWidth: 240,
    aspect: 7 / 9,
    modelFolders,
    refresh,
  }

  useAddConfigSettings()

  return config
})

type Config = ReturnType<typeof useConfig>

declare module 'hooks/store' {
  interface StoreProvider {
    config: Config
  }
}

function useAddConfigSettings() {
  onMounted(() => {
    // API keys
    app.ui?.settings.addSetting({
      id: 'ModelManager.APIKey.HuggingFace',
      name: 'HuggingFace API Key',
      type: 'text',
      defaultValue: undefined,
    })

    app.ui?.settings.addSetting({
      id: 'ModelManager.APIKey.Civitai',
      name: 'Civitai API Key',
      type: 'text',
      defaultValue: undefined,
    })
  })
}
