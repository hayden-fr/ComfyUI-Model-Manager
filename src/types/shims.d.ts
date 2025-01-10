export {}

declare module 'vue' {
  interface ComponentCustomProperties {
    vResize: (typeof import('hooks/resize'))['resizeDirective']
    vContainer: (typeof import('hooks/container'))['containerDirective']
  }
}

declare module 'hooks/store' {
  interface StoreProvider {}
}
