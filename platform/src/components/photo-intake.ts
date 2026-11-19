/**
 * Taking in a photo the sender picked. Phones save photos in formats not every
 * browser can show: an iPhone's are HEIC, which only Safari reads. Anything
 * the browser can't show as it is gets redrawn as a JPEG here, on the sender's
 * device, so drafts still never leave it.
 */

/** Longest edge of a photo that had to be redrawn. Sending prepares every photo again at 2000px. */
const MAX_EDGE = 2400

/** The first bytes of an HEIF file name what is inside it. These are the still-photo kinds. */
const HEIF_BRANDS = ['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1']

/** Formats every current browser shows without help. */
const PLAIN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

async function brand(file: Blob): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const text = String.fromCharCode(...head)
  return text.slice(4, 8) === 'ftyp' ? text.slice(8, 12) : ''
}

/** An iPhone photo, by its label, its name or its first bytes: files dragged from a computer often carry no type at all. */
export async function isHeic(file: File): Promise<boolean> {
  if (HEIF_BRANDS.includes(await brand(file))) return true
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

function toJpeg(bitmap: ImageBitmap): Promise<Blob> {
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no jpeg'))), 'image/jpeg', 0.9))
}

/**
 * The photo as something this browser can show: the file itself, or a JPEG
 * made from it. null when it isn't a photo, or can't be read.
 */
export async function readablePhoto(file: File): Promise<Blob | null> {
  const heic = await isHeic(file)
  if (!heic && PLAIN.includes(file.type)) return file
  if (!heic && !file.type.startsWith('image/')) return null
  // The browser may read it itself (Safari reads HEIC), which is quicker than the decoder.
  try {
    return await toJpeg(await createImageBitmap(file, { imageOrientation: 'from-image' }))
  } catch {
    if (!heic) return null
  }
  try {
    // The decoder is three megabytes, so it is only fetched when a HEIC photo needs it.
    const { heicTo } = await import('heic-to')
    return await toJpeg(await heicTo({ blob: file, type: 'bitmap' }))
  } catch {
    return null
  }
}
