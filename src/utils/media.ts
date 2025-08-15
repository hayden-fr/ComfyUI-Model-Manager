/**
 * Media file utility functions
 */

const VIDEO_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.flv',
  '.wmv',
  '.m4v',
  '.ogv',
]

const VIDEO_HOST_PATTERNS = [
  '/video', // Civitai video URLs often end with /video
  'type=video', // URLs with video type parameter
  'format=video', // URLs with video format parameter
  'video.civitai.com', // Civitai video domain
]

/**
 * Detect if a URL points to a video based on extension or URL patterns
 * @param url - The URL to check
 * @param localContentType - Optional MIME type for local files
 */
export const isVideoUrl = (url: string, localContentType?: string): boolean => {
  if (!url) return false

  // For local files with known MIME type
  if (localContentType && localContentType.startsWith('video/')) {
    return true
  }

  const urlLower = url.toLowerCase()

  // First check if URL ends with a video extension
  for (const ext of VIDEO_EXTENSIONS) {
    if (urlLower.endsWith(ext)) {
      return true
    }
  }

  // Check if URL contains a video extension anywhere (for complex URLs like Civitai)
  if (VIDEO_EXTENSIONS.some((ext) => urlLower.includes(ext))) {
    return true
  }

  // Check for specific video hosting patterns
  return VIDEO_HOST_PATTERNS.some((pattern) => urlLower.includes(pattern))
}
