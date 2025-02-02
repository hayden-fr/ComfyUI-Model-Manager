import { throttle } from 'lodash'
import { type Ref, onUnmounted, ref, toRef, watch } from 'vue'

export const useContainerResize = (
  el: HTMLElement | null | Ref<HTMLElement | null>,
) => {
  const observer = ref<ResizeObserver | null>(null)

  const width = ref(0)
  const height = ref(0)

  watch(
    toRef(el),
    (el) => {
      if (el) {
        const onResize = throttle((entries: ResizeObserverEntry[]) => {
          const entry = entries[0]
          width.value = entry.contentRect.width
          height.value = entry.contentRect.height
        }, 64)

        observer.value = new ResizeObserver(onResize)
        observer.value.observe(el)
      }
    },
    { immediate: true },
  )

  const stop = () => {
    if (observer.value) {
      observer.value.disconnect()
    }
  }

  onUnmounted(() => {
    stop()
  })

  return {
    width,
    height,
    stop,
  }
}
