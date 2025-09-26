import dayjs from 'dayjs'

export const bytesToSize = (
  bytes: number | string | undefined | null,
  decimals = 2,
) => {
  if (typeof bytes === 'undefined' || bytes === null) {
    bytes = 0
  }
  if (typeof bytes === 'string') {
    bytes = Number(bytes)
  }
  if (Number.isNaN(bytes)) {
    return 'Unknown'
  }
  if (bytes === 0) {
    return '0 Bytes'
  }
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export const formatDate = (date: number | string | Date) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

export const previewUrlToFile = async (url: string) => {
  return fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      const type = blob.type
      const extension = type.split('/')[1]
      const file = new File([blob], `preview.${extension}`, { type })
      return file
    })
}

// Model file extensions that are supported for direct download
export const MODEL_FILE_EXTENSIONS = [
  '.safetensors',
  '.ckpt',
  '.pt',
  '.pth',
  '.bin',
  '.onnx',
  '.tflite',
  '.pb',
  '.h5',
  '.pkl',
  '.pickle',
  '.json', // for configuration files
  '.yaml',
  '.yml',
]

/**
 * Checks if a URL points directly to a downloadable model file
 */
export const isDirectFileUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname.toLowerCase()

    // Check if the URL ends with a model file extension
    return MODEL_FILE_EXTENSIONS.some((ext) => pathname.endsWith(ext))
  } catch {
    return false
  }
}

/**
 * Extracts filename from a URL
 */
export const getFilenameFromUrl = (url: string): string => {
  if (!url || typeof url !== 'string') {
    return 'model.bin'
  }

  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || ''

    // If no filename with extension found, generate one
    if (!filename || !filename.includes('.')) {
      const extension =
        MODEL_FILE_EXTENSIONS.find((ext) =>
          pathname.toLowerCase().endsWith(ext),
        ) || '.bin'
      return `model${extension}`
    }

    return filename
  } catch {
    return 'model.bin'
  }
}

/**
 * Determines model type based on file extension (fallback only)
 * Note: This is now primarily used as a fallback when no manual selection is made
 */
export const getModelTypeFromFilename = (filename: string): string => {
  if (!filename || typeof filename !== 'string') {
    return 'checkpoints'
  }

  const extension = filename.toLowerCase().split('.').pop()

  switch (extension) {
    case 'safetensors':
    case 'ckpt':
    case 'pt':
    case 'pth':
      return 'checkpoints' // Default for these extensions, but user can override
    case 'bin':
      return 'diffusers'
    case 'onnx':
      return 'onnx'
    case 'tflite':
      return 'tflite'
    case 'pb':
      return 'tensorflow'
    case 'h5':
      return 'keras'
    case 'pkl':
    case 'pickle':
      return 'embeddings'
    default:
      return 'checkpoints'
  }
}
