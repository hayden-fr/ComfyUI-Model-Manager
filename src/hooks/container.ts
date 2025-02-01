import { useContainerResize } from 'hooks/resize'
import { type InjectionKey, type Ref, inject, provide, toRef } from 'vue'

const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)

const containerKey = Symbol('container') as InjectionKey<
  Ref<HTMLElement | null>
>

export const useContainerQueries = (
  el?: HTMLElement | null | Ref<HTMLElement | null>,
) => {
  const container = inject(containerKey, el ? toRef(el) : toRef(document.body))

  provide(containerKey, container)

  const { width } = useContainerResize(container)

  /**
   * @param size unit rem
   */
  const generator = (size: number) => {
    return (content: any, defaultContent: any = undefined) => {
      return width.value > size * rem ? content : defaultContent
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
