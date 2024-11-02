import { globalToast } from 'hooks/toast'
import { readonly } from 'vue'

class WebSocketEvent extends EventTarget {
  private socket: WebSocket | null

  constructor() {
    super()
    this.createSocket()
  }

  private createSocket(isReconnect?: boolean) {
    const api_host = location.host
    const api_base = location.pathname.split('/').slice(0, -1).join('/')

    let opened = false
    let existingSession = window.name
    if (existingSession) {
      existingSession = '?clientId=' + existingSession
    }

    this.socket = readonly(
      new WebSocket(
        `ws${window.location.protocol === 'https:' ? 's' : ''}://${api_host}${api_base}/model-manager/ws${existingSession}`,
      ),
    )

    this.socket.addEventListener('open', () => {
      opened = true
      if (isReconnect) {
        this.dispatchEvent(new CustomEvent('reconnected'))
      }
    })

    this.socket.addEventListener('error', () => {
      if (this.socket) this.socket.close()
    })

    this.socket.addEventListener('close', (event) => {
      setTimeout(() => {
        this.socket = null
        this.createSocket(true)
      }, 300)
      if (opened) {
        this.dispatchEvent(new CustomEvent('status', { detail: null }))
        this.dispatchEvent(new CustomEvent('reconnecting'))
      }
    })

    this.socket.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'error') {
          globalToast.value?.add({
            severity: 'error',
            summary: 'Error',
            detail: msg.data,
            life: 15000,
          })
        } else {
          this.dispatchEvent(new CustomEvent(msg.type, { detail: msg.data }))
        }
      } catch (error) {
        console.error(error)
      }
    })
  }

  addEventListener = (
    type: string,
    callback: CustomEventListener | null,
    options?: AddEventListenerOptions | boolean,
  ) => {
    super.addEventListener(type, callback, options)
  }

  send(type: string, data: any) {
    this.socket?.send(JSON.stringify({ type, detail: data }))
  }
}

export const socket = new WebSocketEvent()
