import { inject, InjectionKey, provide } from 'vue'

const providerHooks = new Map<string, any>()
const storeEvent = {} as StoreProvider

export const useStoreProvider = () => {
  // const storeEvent = {}

  for (const [key, useHook] of providerHooks) {
    storeEvent[key] = useHook()
  }

  return storeEvent
}

const storeKeys = new Map<string, symbol>()

const getStoreKey = (key: string) => {
  let storeKey = storeKeys.get(key)
  if (!storeKey) {
    storeKey = Symbol(key)
    storeKeys.set(key, storeKey)
  }
  return storeKey
}

/**
 * Using vue provide and inject to implement a simple store
 */
export const defineStore = <T = any>(
  key: string,
  useInitial: (event: StoreProvider) => T,
) => {
  const storeKey = getStoreKey(key) as InjectionKey<T>

  if (providerHooks.has(key) && !import.meta.hot) {
    console.warn(`[defineStore] key: ${key} already exists.`)
  } else {
    providerHooks.set(key, () => {
      const result = useInitial(storeEvent)
      provide(storeKey, result ?? storeEvent[key])
      return result
    })
  }

  const useStore = () => {
    return inject(storeKey)!
  }

  return useStore
}
