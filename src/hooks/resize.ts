import { throttle } from 'lodash'
import { Directive } from 'vue'

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
