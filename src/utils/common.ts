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
