import { app } from 'scripts/comfyAPI'
import { createI18n } from 'vue-i18n'

import en from './locales/en.json'
import zh from './locales/zh.json'

const messages = {
  en: en,
  zh: zh,
}

const getLocalLanguage = () => {
  const local =
    app.ui?.settings.getSettingValue<string>('Comfy.Locale') ||
    navigator.language.split('-')[0] ||
    'en'

  return local
}

export const i18n = createI18n({
  legacy: false,
  locale: getLocalLanguage(),
  fallbackLocale: 'en',
  messages,
})
