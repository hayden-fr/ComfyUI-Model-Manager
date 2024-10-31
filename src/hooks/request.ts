import { useLoading } from 'hooks/loading'
import { api } from 'scripts/comfyAPI'
import { onMounted, ref } from 'vue'

export const request = async (url: string, options?: RequestInit) => {
  return api
    .fetchApi(`/model-manager${url}`, options)
    .then((response) => response.json())
    .then((resData) => {
      if (resData.success) {
        return resData.data
      }
      throw new Error(resData.error)
    })
}

export interface RequestOptions<T> {
  method?: RequestInit['method']
  headers?: RequestInit['headers']
  defaultParams?: Record<string, any>
  defaultValue?: any
  postData?: (data: T) => T
  manual?: boolean
}

export const useRequest = <T = any>(
  url: string,
  options: RequestOptions<T> = {},
) => {
  const loading = useLoading()
  const postData = options.postData ?? ((data) => data)

  const data = ref<T>(options.defaultValue)
  const lastParams = ref()

  const fetch = async (
    params: Record<string, any> = options.defaultParams ?? {},
  ) => {
    loading.show()

    lastParams.value = params

    let requestUrl = url
    const requestOptions: RequestInit = {
      method: options.method,
      headers: options.headers,
    }
    const requestParams = { ...params }

    const templatePattern = /\{(.*?)\}/g
    const urlParamKeyMatches = requestUrl.matchAll(templatePattern)
    for (const urlParamKey of urlParamKeyMatches) {
      const [match, paramKey] = urlParamKey
      if (paramKey in requestParams) {
        const paramValue = requestParams[paramKey]
        delete requestParams[paramKey]
        requestUrl = requestUrl.replace(match, paramValue)
      }
    }

    if (!requestOptions.method) {
      requestOptions.method = 'GET'
    }

    if (requestOptions.method !== 'GET') {
      requestOptions.body = JSON.stringify(requestParams)
    }

    return request(requestUrl, requestOptions)
      .then((resData) => (data.value = postData(resData)))
      .finally(() => loading.hide())
  }

  onMounted(() => {
    if (!options.manual) {
      fetch()
    }
  })

  const refresh = async () => {
    return fetch(lastParams.value)
  }

  return { data, refresh, fetch }
}
