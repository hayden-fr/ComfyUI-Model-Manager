import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { app } from 'scripts/comfyAPI'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import './style.css'

const ComfyUIPreset = definePreset(Aura, {
  semantic: {
    primary: Aura['primitive'].blue,
  },
})

function createVueApp(rootContainer: string | HTMLElement) {
  const app = createApp(App)
  app.directive('tooltip', Tooltip)
  app
    .use(PrimeVue, {
      theme: {
        preset: ComfyUIPreset,
        options: {
          prefix: 'p',
          cssLayer: {
            name: 'primevue',
            order: 'tailwind-base, primevue, tailwind-utilities',
          },
          // This is a workaround for the issue with the dark mode selector
          // https://github.com/primefaces/primevue/issues/5515
          darkModeSelector: '.model-manager-dark',
        },
      },
    })
    .use(ToastService)
    .use(ConfirmationService)
    .use(i18n)
    .mount(rootContainer)
}

app.registerExtension({
  name: 'Comfy.ModelManager',
  setup() {
    const container = document.createElement('div')
    container.id = 'comfyui-model-manager'
    document.body.appendChild(container)

    // Sync dark mode class
    const updateDarkMode = () => {
      const body = document.body
      const isDark =
        body.classList.contains('dark-theme') ||
        body.classList.contains('dark') ||
        body.classList.contains('Dark')
      if (isDark) {
        document.documentElement.classList.add('model-manager-dark')
      } else {
        document.documentElement.classList.remove('model-manager-dark')
      }
    }

    const observer = new MutationObserver(updateDarkMode)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    })
    updateDarkMode()

    createVueApp(container)
  },
})
