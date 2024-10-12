interface BaseModel {
  id: number | string
  fullname: string
  basename: string
  extension: string
  sizeBytes: number
  type: string
  pathIndex: number
  preview: string | string[]
  description: string
  metadata: Record<string, string>
}

interface Model extends BaseModel {
  createdAt: number
  updatedAt: number
}

interface VersionModel extends BaseModel {
  shortname: string
  downloadPlatform: string
  downloadUrl: string
  hashes?: Record<string, string>
}

type PassThrough<T = void> = T | object | undefined

interface SelectOptions {
  label: string
  value: any
  icon?: string
  command: () => void
}

interface SelectFile extends File {
  objectURL: string
}

interface SelectEvent {
  files: SelectFile[]
  originalEvent: Event
}

interface DownloadTaskOptions {
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

interface DownloadTask
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

type CustomEventListener = (event: CustomEvent) => void
