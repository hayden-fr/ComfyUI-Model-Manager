import { defineResizeCallback } from 'hooks/resize'
import { computed, Directive, inject, InjectionKey, provide, ref } from 'vue'

const globalContainerSize = ref<Record<symbol, number>>({})

const containerNameKey = Symbol('containerName') as InjectionKey<symbol>

export const containerDirective: Directive<HTMLElement, symbol> = {
  mounted: (el, binding) => {
    const containerName = binding.value || Symbol('container')
    const resizeCallback = defineResizeCallback((entries) => {
      const entry = entries[0]
      globalContainerSize.value[containerName] = entry.contentRect.width
    })
    const observer = new ResizeObserver(resizeCallback)
    observer.observe(el)
    el['_containerObserver'] = observer
  },
  unmounted: (el) => {
    const observer = el['_containerObserver']
    observer.disconnect()
  },
}

const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)

export const useContainerQueries = (containerName?: symbol) => {
  const parentContainer = inject(containerNameKey, Symbol('unknown'))

  const name = containerName ?? parentContainer

  provide(containerNameKey, name)

  const currentContainerSize = computed(() => {
    return globalContainerSize.value[name] ?? 0
  })

  /**
   * @param size unit rem
   */
  const generator = (size: number) => {
    return (content: any, defaultContent: any = undefined) => {
      return currentContainerSize.value > size * rem ? content : defaultContent
    }
  }

  return {
    $xs: generator(20),
    $sm: generator(24),
    $md: generator(28),
    $lg: generator(32),
    $xl: generator(36),
    $2xl: generator(42),
    $3xl: generator(48),
    $4xl: generator(54),
    $5xl: generator(60),
    $6xl: generator(66),
    $7xl: generator(72),
  }
}
