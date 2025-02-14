export type ContainerSize = { width: number; height: number }
export type ContainerPosition = { left: number; top: number }

export interface BaseModel {
  id: number | string
  basename: string
  extension: string
  sizeBytes: number
  type: string
  subFolder: string
  pathIndex: number
  preview: string | string[]
  description: string
  metadata: Record<string, string>
}

export interface Model extends BaseModel {
  createdAt: number
  updatedAt: number
}

export interface VersionModel extends BaseModel {
  shortname: string
  downloadPlatform: string
  downloadUrl: string
  hashes?: Record<string, string>
}

export type WithResolved<T> = Omit<T, 'preview'> & {
  preview: string | undefined
}

export type PassThrough<T = void> = T | object | undefined

export interface SelectOptions {
  label: string
  value: any
  icon?: string
  command: () => void
}

export interface SelectFile extends File {
  objectURL: string
}

export interface SelectEvent {
  files: SelectFile[]
  originalEvent: Event
}

export interface DownloadTaskOptions {
  taskId: string
  type: string
  fullname: string
  preview: string
  status: 'pause' | 'waiting' | 'doing'
  progress: number
  downloadedSize: number
  totalSize: number
  bps: number
  error?: string
}

export interface DownloadTask
  extends Omit<
    DownloadTaskOptions,
    'downloadedSize' | 'totalSize' | 'bps' | 'error'
  > {
  downloadProgress: string
  downloadSpeed: string
  pauseTask: () => void
  resumeTask: () => void
  deleteTask: () => void
}

export type CustomEventListener = (event: CustomEvent) => void
