import type { ImageAttachment } from '../types'

export async function fileToImageAttachment(file: File): Promise<ImageAttachment> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return {
    mimeType: file.type || 'image/png',
    data: btoa(binary),
  }
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}
