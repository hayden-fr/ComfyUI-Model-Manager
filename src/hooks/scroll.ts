import { throttle } from 'lodash'
import { computed, onUnmounted, ref, toRef, watch, type Ref } from 'vue'

export interface UseScrollOption {
  throttle?: number
  onScroll?: (e: Event) => void
}

export const useContainerScroll = (
  el: HTMLElement | null | Ref<HTMLElement | null>,
  options?: UseScrollOption,
) => {
  const scrollLeft = ref(0)
  const scrollTop = ref(0)

  const container = toRef(el)

  const onScroll = throttle((e: Event) => {
    options?.onScroll?.(e)

    if (container.value) {
      scrollLeft.value = container.value.scrollLeft
      scrollTop.value = container.value.scrollTop
    }
  }, options?.throttle || 100)

  watch(
    container,
    (el) => {
      if (el) {
        el.addEventListener('scroll', onScroll)
      }
    },
    { immediate: true },
  )

  const x = computed({
    get: () => scrollLeft,
    set: (val) => {
      container.value?.scrollTo({ left: val.value })
    },
  })

  const y = computed({
    get: () => scrollTop,
    set: (val) => {
      container.value?.scrollTo({ top: val.value })
    },
  })

  onUnmounted(() => {
    if (container.value) {
      container.value.removeEventListener('scroll', onScroll)
    }
  })

  return { x, y }
}
