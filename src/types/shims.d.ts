export {}

declare module 'vue' {
  interface ComponentCustomProperties {
    vResize: (typeof import('hooks/resize'))['resizeDirective']
  }
}

declare module 'hooks/store' {
  interface StoreProvider {}
}
