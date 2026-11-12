/**
 * Before a gift is sent, each photo is redrawn as a JPEG of at most 2000px.
 * This keeps uploads small and drops hidden metadata such as GPS location.
 */
const MAX_EDGE = 2000

export async function preparePhoto(src: string): Promise<Blob> {
  const original = await (await fetch(src)).blob()
  const bitmap = await createImageBitmap(original, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser can’t prepare photos')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Photo could not be prepared'))), 'image/jpeg', 0.86),
  )
}
