import { ToastServiceMethods } from 'primevue/toastservice'
import { useConfirm as usePrimeConfirm } from 'primevue/useconfirm'
import { useToast as usePrimeToast } from 'primevue/usetoast'

export const globalToast = { value: null } as unknown as {
  value: ToastServiceMethods
}

export const useToast = () => {
  const toast = usePrimeToast()
  const confirm = usePrimeConfirm()

  globalToast.value = toast

  const wrapperToastError = <T extends Function>(callback: T): T => {
    const showToast = (error: Error) => {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message,
        life: 15000,
      })
    }

    const isAsync = callback.constructor.name === 'AsyncFunction'

    let wrapperExec: any

    if (isAsync) {
      wrapperExec = (...args: any[]) => callback(...args).catch(showToast)
    } else {
      wrapperExec = (...args: any[]) => {
        try {
          return callback(...args)
        } catch (error) {
          showToast(error)
        }
      }
    }

    return wrapperExec
  }

  return { toast, wrapperToastError, confirm }
}
