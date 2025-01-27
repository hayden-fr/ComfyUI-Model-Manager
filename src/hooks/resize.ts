import { throttle } from 'lodash'
import { Directive, onUnmounted, ref, Ref, toRef, watch } from 'vue'

export const resizeDirective: Directive<HTMLElement, ResizeObserverCallback> = {
  mounted: (el, binding) => {
    const callback = binding.value ?? (() => {})
    const observer = new ResizeObserver(callback)
    observer.observe(el)
    el['observer'] = observer
  },
  unmounted: (el) => {
    const observer = el['observer']
    observer.disconnect()
  },
}

export const defineResizeCallback = (
  callback: ResizeObserverCallback,
  wait?: number,
) => {
  return throttle(callback, wait ?? 100)
}

export const useContainerResize = (
  el: HTMLElement | null | Ref<HTMLElement | null>,
) => {
  const observer = ref<ResizeObserver>()

  const width = ref(0)
  const height = ref(0)

  watch(
    toRef(el),
    (el) => {
      if (el) {
        const onResize = defineResizeCallback((entries) => {
          const entry = entries[0]
          width.value = entry.contentRect.width
          height.value = entry.contentRect.height
        })
        observer.value = new ResizeObserver(onResize)
        observer.value.observe(el)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    if (observer.value) {
      observer.value.disconnect()
    }
  })

  return { width, height }
}
