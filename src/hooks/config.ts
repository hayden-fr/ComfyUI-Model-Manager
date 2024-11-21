import { request, useRequest } from 'hooks/request'
import { defineStore } from 'hooks/store'
import { $el, app, ComfyDialog } from 'scripts/comfyAPI'
import { onMounted, onUnmounted, ref } from 'vue'
import { useToast } from './toast'

export const useConfig = defineStore('config', (store) => {
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

  useAddConfigSettings(store)

  return config
})

type Config = ReturnType<typeof useConfig>

declare module 'hooks/store' {
  interface StoreProvider {
    config: Config
  }
}

function useAddConfigSettings(store: import('hooks/store').StoreProvider) {
  const { toast } = useToast()

  const confirm = (opts: {
    message?: string
    accept?: () => void
    reject?: () => void
  }) => {
    const dialog = new ComfyDialog('div', [])

    dialog.show(
      $el('div', [
        $el('p', { textContent: opts.message }),
        $el('div.flex.gap-4', [
          $el('button.flex-1', {
            textContent: 'Cancel',
            onclick: () => {
              opts.reject?.()
              dialog.close()
              document.body.removeChild(dialog.element)
            },
          }),
          $el('button.flex-1', {
            textContent: 'Continue',
            onclick: () => {
              opts.accept?.()
              dialog.close()
              document.body.removeChild(dialog.element)
            },
          }),
        ]),
      ]),
    )
  }

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

    // Migrate
    app.ui?.settings.addSetting({
      id: 'ModelManager.Migrate.Migrate',
      name: 'Migrate information from cdb-boop/main',
      defaultValue: '',
      type: () => {
        return $el('button.p-button.p-component.p-button-secondary', {
          textContent: 'Migrate',
          onclick: () => {
            confirm({
              message: [
                'This operation will delete old files and override current files if it exists.',
                // 'This may take a while and generate MANY server requests!',
                'Continue?',
              ].join('\n'),
              accept: () => {
                store.loading.loading.value = true
                request('/migrate', {
                  method: 'POST',
                })
                  .then(() => {
                    toast.add({
                      severity: 'success',
                      summary: 'Complete migration',
                      life: 2000,
                    })
                    store.models.refresh()
                  })
                  .catch((err) => {
                    toast.add({
                      severity: 'error',
                      summary: 'Error',
                      detail: err.message ?? 'Failed to migrate information',
                      life: 15000,
                    })
                  })
                  .finally(() => {
                    store.loading.loading.value = false
                  })
              },
            })
          },
        })
      },
    })

    // Scan information
    app.ui?.settings.addSetting({
      id: 'ModelManager.ScanFiles.Full',
      name: "Override all models' information and preview",
      defaultValue: '',
      type: () => {
        return $el('button.p-button.p-component.p-button-secondary', {
          textContent: 'Full Scan',
          onclick: () => {
            confirm({
              message: [
                'This operation will override current files.',
                'This may take a while and generate MANY server requests!',
                'USE AT YOUR OWN RISK! Continue?',
              ].join('\n'),
              accept: () => {
                store.loading.loading.value = true
                request('/model-info/scan', {
                  method: 'POST',
                  body: JSON.stringify({ scanMode: 'full' }),
                })
                  .then(() => {
                    toast.add({
                      severity: 'success',
                      summary: 'Complete download information',
                      life: 2000,
                    })
                    store.models.refresh()
                  })
                  .catch((err) => {
                    toast.add({
                      severity: 'error',
                      summary: 'Error',
                      detail: err.message ?? 'Failed to download information',
                      life: 15000,
                    })
                  })
                  .finally(() => {
                    store.loading.loading.value = false
                  })
              },
            })
          },
        })
      },
    })

    app.ui?.settings.addSetting({
      id: 'ModelManager.ScanFiles.Incremental',
      name: 'Download missing information or preview',
      defaultValue: '',
      type: () => {
        return $el('button.p-button.p-component.p-button-secondary', {
          textContent: 'Diff Scan',
          onclick: () => {
            confirm({
              message: [
                'Download missing information or preview.',
                'This may take a while and generate MANY server requests!',
                'USE AT YOUR OWN RISK! Continue?',
              ].join('\n'),
              accept: () => {
                store.loading.loading.value = true
                request('/model-info/scan', {
                  method: 'POST',
                  body: JSON.stringify({ scanMode: 'diff' }),
                })
                  .then(() => {
                    toast.add({
                      severity: 'success',
                      summary: 'Complete download information',
                      life: 2000,
                    })
                    store.models.refresh()
                  })
                  .catch((err) => {
                    toast.add({
                      severity: 'error',
                      summary: 'Error',
                      detail: err.message ?? 'Failed to download information',
                      life: 15000,
                    })
                  })
                  .finally(() => {
                    store.loading.loading.value = false
                  })
              },
            })
          },
        })
      },
    })
  })
}
