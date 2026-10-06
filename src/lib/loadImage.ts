import type { SourceImage } from '../types'

export const SVG_TYPE = 'image/svg+xml'
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', SVG_TYPE]
export const MAX_FILE_BYTES = 40 * 1024 * 1024

/** Devuelve un mensaje de error si el archivo no se puede convertir, o null si es válido. */
export function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Formato no soportado. Usa una imagen JPG, PNG, WebP o SVG.'
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'La imagen es demasiado grande (máximo 40 MB).'
  }
  return null
}

const UNREADABLE = 'No se pudo leer la imagen. Puede que el archivo esté dañado.'

/** `createImageBitmap` no decodifica SVG en todos los navegadores; un <img> sí. */
function loadSvgElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(UNREADABLE))
    }
    img.src = url
  })
}

/**
 * Archivo → píxeles RGBA, respetando la orientación EXIF y limitando el lado mayor a `maxSize`.
 * Un SVG no tiene píxeles propios: se dibuja directamente a `maxSize` para que salga nítido.
 */
export async function loadImage(file: File, maxSize: number): Promise<SourceImage> {
  let source: ImageBitmap | HTMLImageElement
  let sourceWidth: number
  let sourceHeight: number
  let scale: number
  if (file.type === SVG_TYPE) {
    source = await loadSvgElement(file)
    // Un SVG sin tamaño ni viewBox no declara dimensiones: se trata como cuadrado
    sourceWidth = source.naturalWidth || maxSize
    sourceHeight = source.naturalHeight || maxSize
    scale = maxSize / Math.max(sourceWidth, sourceHeight)
  } else {
    try {
      source = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      throw new Error(UNREADABLE)
    }
    sourceWidth = source.width
    sourceHeight = source.height
    scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight))
  }
  const close = () => {
    if (source instanceof ImageBitmap) source.close()
  }

  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    close()
    throw new Error('El navegador no pudo procesar la imagen (sin memoria).')
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  close()

  try {
    const { data } = ctx.getImageData(0, 0, width, height)
    return { data: data as Uint8ClampedArray<ArrayBuffer>, width, height }
  } catch {
    // Algunos navegadores bloquean la lectura si el SVG incrusta contenido externo
    throw new Error('El navegador no permite leer este SVG (incluye contenido externo).')
  }
}
