import { defineStore } from 'hooks/store'
import { Ref, ref } from 'vue'

class GlobalLoading {
  loading: Ref<boolean>

  loadingStack = 0

  bind(loading: Ref<boolean>) {
    this.loading = loading
  }

  show() {
    this.loadingStack++
    this.loading.value = true
  }

  hide() {
    this.loadingStack--
    if (this.loadingStack <= 0) this.loading.value = false
  }
}

export const globalLoading = new GlobalLoading()

export const useGlobalLoading = defineStore('loading', () => {
  const loading = ref(false)

  globalLoading.bind(loading)

  return { loading }
})

declare module 'hooks/store' {
  interface StoreProvider {
    loading: ReturnType<typeof useGlobalLoading>
  }
}

export const useLoading = () => {
  const timer = ref<NodeJS.Timeout>()

  const show = () => {
    timer.value = setTimeout(() => {
      timer.value = undefined
      globalLoading.show()
    }, 200)
  }

  const hide = () => {
    if (timer.value) {
      clearTimeout(timer.value)
      timer.value = undefined
    } else {
      globalLoading.hide()
    }
  }

  return { show, hide }
}
