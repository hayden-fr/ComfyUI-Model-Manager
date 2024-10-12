import { ref } from 'vue'

export const useBoolean = (defaultValue?: boolean) => {
  const target = ref(defaultValue ?? false)

  const toggle = (value?: any) => {
    target.value = typeof value === 'boolean' ? value : !target.value
  }

  return [target, toggle] as const
}
