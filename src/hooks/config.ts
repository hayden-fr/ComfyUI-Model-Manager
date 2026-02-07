import SettingApiKey from 'components/SettingApiKey.vue'
import SettingCardSize from 'components/SettingCardSize.vue'
import { request } from 'hooks/request'
import { defineStore } from 'hooks/store'
import { useToast } from 'hooks/toast'
import { $el, app } from 'scripts/comfyAPI'
import { computed, onMounted, onUnmounted, readonly, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

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
    apiKeyInfo: ref<Record<string, string>>({}),
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
  const { t } = useI18n()
  const { confirm } = useToast()

  const iconButton = (opt: {
    icon: string
    onClick: () => void | Promise<void>
  }) => {
    return $el(
      'span.h-4.cursor-pointer',
      { onclick: opt.onClick },
      $el(`i.${opt.icon.replace(/\s/g, '.')}`),
    )
  }

  const setApiKey = async (key: string, setter: (val: string) => void) => {
    store.dialog.open({
      key: `setting.api_key.${key}`,
      title: t(`setting.api_key.${key}`),
      content: SettingApiKey,
      modal: true,
      defaultSize: {
        width: 500,
        height: 200,
      },
      contentProps: {
        keyField: key,
        setter: setter,
      },
    })
  }

  const removeApiKey = async (key: string) => {
    await new Promise((resolve, reject) => {
      confirm.require({
        message: t('deleteAsk'),
        header: 'Danger',
        icon: 'pi pi-info-circle',
        accept: () => resolve(true),
        reject: reject,
      })
    })
    await request('/download/setting', {
      method: 'POST',
      body: JSON.stringify({ key, value: null }),
    })
  }

  const renderApiKey = (key: string) => {
    return () => {
      const apiKey = store.config.apiKeyInfo.value[key] || 'None'
      const apiKeyDisplayEl = $el('div.text-sm.text-gray-500.flex-1', {
        textContent: apiKey,
      })

      const setter = (val: string) => {
        store.config.apiKeyInfo.value[key] = val
        apiKeyDisplayEl.textContent = val || 'None'
      }
      return $el('div.flex.gap-4', [
        apiKeyDisplayEl,
        iconButton({
          icon: 'pi pi-pencil text-blue-400',
          onClick: () => {
            setApiKey(key, setter)
          },
        }),
        iconButton({
          icon: 'pi pi-trash text-red-400',
          onClick: async () => {
            const value = store.config.apiKeyInfo.value[key]
            if (value) {
              await removeApiKey(key)
              setter('')
            }
          },
        }),
      ])
    }
  }

  onMounted(() => {
    // API keys
    app.ui?.settings.addSetting({
      id: 'ModelManager.APIKey.HuggingFace',
      category: [t('modelManager'), t('setting.apiKey'), 'HuggingFace'],
      name: 'HuggingFace API Key',
      defaultValue: undefined,
      type: renderApiKey('huggingface'),
    })

    app.ui?.settings.addSetting({
      id: 'ModelManager.APIKey.Civitai',
      category: [t('modelManager'), t('setting.apiKey'), 'Civitai'],
      name: 'Civitai API Key',
      defaultValue: undefined,
      type: renderApiKey('civitai'),
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

    app.ui?.settings.addSetting({
      id: 'ModelManager.DownloadSettings.MultiThreadEnabled',
      category: [
        t('modelManager'),
        t('setting.downloadSettings'),
        'MultiThreadEnabled',
      ],
      name: t('setting.multiThreadDownload'),
      defaultValue: true,
      type: 'boolean',
    })

    app.ui?.settings.addSetting({
      id: 'ModelManager.DownloadSettings.ThreadCount',
      category: [
        t('modelManager'),
        t('setting.downloadSettings'),
        'ThreadCount',
      ],
      name: t('setting.threadCount'),
      defaultValue: 4,
      type: 'number',
      attrs: {
        min: 1,
        max: 32,
        step: 1,
      },
    })

    app.ui?.settings.addSetting({
      id: 'ModelManager.DownloadSettings.Timeout',
      category: [t('modelManager'), t('setting.downloadSettings'), 'Timeout'],
      name: t('setting.timeout'),
      defaultValue: 15,
      type: 'number',
      attrs: {
        min: 1,
        max: 120,
        step: 1,
      },
    })
  })
}
