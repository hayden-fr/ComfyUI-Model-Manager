import SettingCardSize from 'components/SettingCardSize.vue'
import { request } from 'hooks/request'
import { defineStore } from 'hooks/store'
import { $el, app, ComfyDialog } from 'scripts/comfyAPI'
import { computed, onMounted, onUnmounted, readonly, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from './toast'

export const useConfig = defineStore('config', (store) => {
  const { t } = useI18n()

  const mobileDeviceBreakPoint = 759
  const isMobile = ref(window.innerWidth < mobileDeviceBreakPoint)

  const checkDeviceType = () => {
    isMobile.value = window.innerWidth < mobileDeviceBreakPoint
  }

  onMounted(() => {
    window.addEventListener('resize', checkDeviceType)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkDeviceType)
  })

  const flatLayout = ref(false)

  const defaultCardSizeMap = readonly({
    'size.extraLarge': '240x320',
    'size.large': '180x240',
    'size.medium': '120x160',
    'size.small': '80x120',
  })

  const cardSizeMap = ref<Record<string, string>>({ ...defaultCardSizeMap })
  const cardSizeFlag = ref('size.extraLarge')
  const cardSize = computed(() => {
    const size = cardSizeMap.value[cardSizeFlag.value]
    const [width = '120', height = '240'] = size.split('x')
    return {
      width: parseInt(width),
      height: parseInt(height),
    }
  })

  const config = {
    isMobile,
    gutter: 16,
    defaultCardSizeMap: defaultCardSizeMap,
    cardSizeMap: cardSizeMap,
    cardSizeFlag: cardSizeFlag,
    cardSize: cardSize,
    cardWidth: 240,
    aspect: 7 / 9,
    dialog: {
      showCardSizeSetting: () => {
        store.dialog.open({
          key: 'setting.cardSize',
          title: t('setting.cardSize'),
          content: SettingCardSize,
          defaultSize: {
            width: 500,
            height: 390,
          },
        })
      },
    },
    flat: flatLayout,
  }

  watch(cardSizeFlag, (val) => {
    app.ui?.settings.setSettingValue('ModelManager.UI.CardSize', val)
  })

  watch(cardSizeMap, (val) => {
    app.ui?.settings.setSettingValue(
      'ModelManager.UI.CardSizeMap',
      JSON.stringify(val),
    )
  })

  useAddConfigSettings(store)

  return config
})

type Config = ReturnType<typeof useConfig>

declare module 'hooks/store' {
  interface StoreProvider {
    config: Config
  }
}

export const configSetting = {
  excludeScanTypes: 'ModelManager.Scan.excludeScanTypes',
}

function useAddConfigSettings(store: import('hooks/store').StoreProvider) {
  const { toast } = useToast()
  const { t } = useI18n()

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
      category: [t('modelManager'), t('setting.apiKey'), 'HuggingFace'],
      name: 'HuggingFace API Key',
      type: 'text',
      defaultValue: undefined,
    })

    app.ui?.settings.addSetting({
      id: 'ModelManager.APIKey.Civitai',
      category: [t('modelManager'), t('setting.apiKey'), 'Civitai'],
      name: 'Civitai API Key',
      type: 'text',
      defaultValue: undefined,
    })

    const defaultCardSize = store.config.defaultCardSizeMap

    app.ui?.settings.addSetting({
      id: 'ModelManager.UI.CardSize',
      category: [t('modelManager'), t('setting.ui'), 'CardSize'],
      name: t('setting.cardSize'),
      defaultValue: 'size.extraLarge',
      type: 'hidden',
      onChange: (val) => {
        store.config.cardSizeFlag.value = val
      },
    })

    app.ui?.settings.addSetting({
      id: 'ModelManager.UI.CardSizeMap',
      category: [t('modelManager'), t('setting.ui'), 'CardSizeMap'],
      name: t('setting.cardSize'),
      defaultValue: JSON.stringify(defaultCardSize),
      type: 'hidden',
      onChange(value) {
        store.config.cardSizeMap.value = JSON.parse(value)
      },
    })

    app.ui?.settings.addSetting({
      id: 'ModelManager.UI.Flat',
      category: [t('modelManager'), t('setting.ui'), 'Flat'],
      name: t('setting.useFlatUI'),
      type: 'boolean',
      defaultValue: false,
      onChange(value) {
        store.dialog.closeAll()
        store.config.flat.value = value
      },
    })

    // Scan information
    app.ui?.settings.addSetting({
      id: 'ModelManager.ScanFiles.Full',
      category: [t('modelManager'), t('setting.scan'), 'Full'],
      name: t('setting.scanAll'),
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
      category: [t('modelManager'), t('setting.scan'), 'Incremental'],
      name: t('setting.scanMissing'),
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

    app.ui?.settings.addSetting({
      id: configSetting.excludeScanTypes,
      category: [t('modelManager'), t('setting.scan'), 'ExcludeScanTypes'],
      name: t('setting.excludeScanTypes'),
      defaultValue: undefined,
      type: 'text',
    })

    app.ui?.settings.addSetting({
      id: 'ModelManager.Scan.IncludeHiddenFiles',
      category: [t('modelManager'), t('setting.scan'), 'IncludeHiddenFiles'],
      name: t('setting.includeHiddenFiles'),
      defaultValue: false,
      type: 'boolean',
    })
  })
}
