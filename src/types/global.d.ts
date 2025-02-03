declare namespace ComfyAPI {
  namespace api {
    class ComfyApi {
      socket: WebSocket
      fetchApi: (route: string, options?: RequestInit) => Promise<Response>
      addEventListener: (
        type: string,
        callback: (event: CustomEvent) => void,
        options?: AddEventListenerOptions,
      ) => void
    }

    const api: ComfyApi
  }

  namespace app {
    interface ComfyExtension {
      /**
       * The name of the extension
       */
      name: string
      /**
       * Allows any initialisation, e.g. loading resources. Called after the canvas is created but before nodes are added
       * @param app The ComfyUI app instance
       */
      init?(app: ComfyApp): Promise<void> | void
      /**
       * Allows any additional setup, called after the application is fully set up and running
       * @param app The ComfyUI app instance
       */
      setup?(app: ComfyApp): Promise<void> | void
    }

    interface BaseSidebarTabExtension {
      id: string
      title: string
      icon?: string
      iconBadge?: string | (() => string | null)
      order?: number
      tooltip?: string
    }

    interface VueSidebarTabExtension extends BaseSidebarTabExtension {
      type: 'vue'
      component: import('vue').Component
    }

    interface CustomSidebarTabExtension extends BaseSidebarTabExtension {
      type: 'custom'
      render: (container: HTMLElement) => void
      destroy?: () => void
    }

    type SidebarTabExtension =
      | VueSidebarTabExtension
      | CustomSidebarTabExtension

    interface ExtensionManager {
      // Sidebar tabs
      registerSidebarTab(tab: SidebarTabExtension): void
      unregisterSidebarTab(id: string): void
      getSidebarTabs(): SidebarTabExtension[]

      // Toast
      toast: ToastManager
    }

    class ComfyApp {
      ui?: ui.ComfyUI
      menu?: index.ComfyAppMenu
      graph: lightGraph.LGraph
      canvas: lightGraph.LGraphCanvas
      extensionManager: ExtensionManager
      registerExtension: (extension: ComfyExtension) => void
      addNodeOnGraph: (
        nodeDef: lightGraph.ComfyNodeDef,
        options?: Record<string, any>,
      ) => lightGraph.LGraphNode
      getCanvasCenter: () => lightGraph.Vector2
      clientPosToCanvasPos: (pos: lightGraph.Vector2) => lightGraph.Vector2
      handleFile: (file: File) => void
    }

    const app: ComfyApp
  }

  namespace ui {
    type Props = {
      parent?: HTMLElement
      $?: (el: HTMLElement) => void
      dataset?: DOMStringMap
      style?: Partial<CSSStyleDeclaration>
      for?: string
      textContent?: string
      [key: string]: any
    }

    type Children = Element[] | Element | string | string[]

    type ElementType<K extends string> = K extends keyof HTMLElementTagNameMap
      ? HTMLElementTagNameMap[K]
      : HTMLElement

    const $el: <TTag extends string>(
      tag: TTag,
      propsOrChildren?: Children | Props,
      children?: Children,
    ) => ElementType<TTag>

    class ComfyUI {
      app: app.ComfyApp
      settings: ComfySettingsDialog
      menuHamburger?: HTMLDivElement
      menuContainer?: HTMLDivElement
      dialog: dialog.ComfyDialog
    }

    type SettingInputType =
      | 'boolean'
      | 'number'
      | 'slider'
      | 'combo'
      | 'text'
      | 'hidden'

    type SettingCustomRenderer = (
      name: string,
      setter: (v: any) => void,
      value: any,
      attrs: any,
    ) => HTMLElement

    interface SettingOption {
      text: string
      value?: string
    }

    interface SettingParams {
      id: string
      name: string
      type: SettingInputType | SettingCustomRenderer
      defaultValue: any
      onChange?: (newValue: any, oldValue?: any) => void
      attrs?: any
      tooltip?: string
      options?:
        | Array<string | SettingOption>
        | ((value: any) => SettingOption[])
      // By default category is id.split('.'). However, changing id to assign
      // new category has poor backward compatibility. Use this field to overwrite
      // default category from id.
      // Note: Like id, category value need to be unique.
      category?: string[]
      experimental?: boolean
      deprecated?: boolean
    }

    class ComfySettingsDialog extends dialog.ComfyDialog {
      addSetting: (params: SettingParams) => { value: any }
      getSettingValue: <T>(id: string, defaultValue?: T) => T
      setSettingValue: <T>(id: string, value: T) => void
    }
  }

  namespace index {
    class ComfyAppMenu {
      app: app.ComfyApp
      logo: HTMLElement
      actionsGroup: button.ComfyButtonGroup
      settingsGroup: button.ComfyButtonGroup
      viewGroup: button.ComfyButtonGroup
      mobileMenuButton: ComfyButton
      element: HTMLElement
    }
  }

  namespace button {
    type ComfyButtonProps = {
      icon?: string
      overIcon?: string
      iconSize?: number
      content?: string | HTMLElement
      tooltip?: string
      enabled?: boolean
      action?: (e: Event, btn: ComfyButton) => void
      classList?: ClassList
      visibilitySetting?: { id: keyof Settings; showValue: boolean }
      app?: app.ComfyApp
    }

    class ComfyButton {
      constructor(props: ComfyButtonProps): ComfyButton
    }

    class ComfyButtonGroup {
      insert(button: ComfyButton, index: number): void
      append(button: ComfyButton): void
      remove(indexOrButton: ComfyButton | number): void
      update(): void
      constructor(...buttons: (HTMLElement | ComfyButton)[]): ComfyButtonGroup
    }
  }

  namespace dialog {
    class ComfyDialog {
      constructor(type = 'div', buttons: HTMLElement[] = null)
      element: HTMLElement
      close(): void
      show(html: string | HTMLElement | HTMLElement[]): void
    }
  }
}

declare namespace lightGraph {
  class LGraphNode implements ComfyNodeDef {
    widgets: any[]
    pos: Vector2
  }

  class LGraphGroup {}

  class LGraph {
    /**
     * Adds a new node instance to this graph
     * @param node the instance of the node
     */
    add(node: LGraphNode | LGraphGroup, skip_compute_order?: boolean): void
    /**
     * Returns the top-most node in this position of the canvas
     * @param x the x coordinate in canvas space
     * @param y the y coordinate in canvas space
     * @param nodes_list a list with all the nodes to search from, by default is all the nodes in the graph
     * @return the node at this position or null
     */
    getNodeOnPos<T extends LGraphNode = LGraphNode>(
      x: number,
      y: number,
      node_list?: LGraphNode[],
      margin?: number,
    ): T | null
  }

  class LGraphCanvas {
    selected_nodes: Record<string, LGraphNode>
    canvas_mouse: Vector2
    selectNode: (node: LGraphNode) => void
    copyToClipboard: (nodes: LGraphNode[]) => void
  }

  const LiteGraph: {
    createNode: (
      type: string,
      title: string | null,
      options: object,
    ) => LGraphNode
  }

  type ComfyNodeDef = {
    input?: {
      required?: Record<string, any>
      optional?: Record<string, any>
      hidden?: Record<string, any>
    }
    output?: (string | any[])[]
    output_is_list?: boolean[]
    output_name?: string[]
    output_tooltips?: string[]
    name?: string
    display_name?: string
    description?: string
    category?: string
    output_node?: boolean
    python_module?: string
    deprecated?: boolean
    experimental?: boolean
  }

  type Vector2 = [number, number]
}

interface Window {
  comfyAPI: typeof ComfyAPI
  LiteGraph: typeof lightGraph.LiteGraph
}
