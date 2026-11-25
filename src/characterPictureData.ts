import { newId } from './db'
import type { CharacterPicture } from './types'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_PICTURE_BYTES = 500 * 1024
const MAX_DIMENSION = 1280

export async function processCharacterPicture(file: File): Promise<CharacterPicture> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, or WebP picture.')
  }
  if (file.size > MAX_FILE_BYTES) throw new Error('Picture exceeds 20 MB.')

  const bitmap = await createImageBitmap(file)
  try {
    let scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not process this picture.')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/webp', Math.max(0.48, 0.82 - attempt * 0.07))
      const encodedBytes = Math.ceil(dataUrl.length * 0.75)
      if (encodedBytes <= MAX_PICTURE_BYTES) {
        return { id: newId(), name: file.name.replace(/\.[^.]+$/, '').trim() || 'Picture', dataUrl }
      }
      scale *= 0.75
    }
    throw new Error('Could not reduce picture below 500 KB. Try a smaller image.')
  } finally {
    bitmap.close()
  }
}
