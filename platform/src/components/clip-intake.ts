/**
 * Taking in a video clip the sender picked. Like photos, a clip stays on the
 * sender's device until the film is sent. Nothing is converted: a clip this
 * browser can play is kept as it is, with its first frame drawn as a picture
 * to show wherever the clip can't play.
 */

export const CLIP_LIMITS = {
  /** Clips are for a few seconds of someone, not a whole video. */
  seconds: 30,
  bytes: 25 * 1024 * 1024,
  /** How many clips one film holds. */
  count: 3,
} as const

export const isClip = (file: File) => /^video\//i.test(file.type) || /\.(mp4|m4v|mov|webm)$/i.test(file.name)

export type ReadClip = { ok: true; poster: Blob; aspect: number } | { ok: false; why: 'unplayable' | 'long' }

/** Read a clip: check this browser plays it and that it is short, and draw its first frame. */
export function readClip(file: Blob): Promise<ReadClip> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let done = false
    const finish = (result: ReadClip) => {
      if (done) return
      done = true
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const timer = setTimeout(() => finish({ ok: false, why: 'unplayable' }), 12_000)
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onerror = () => finish({ ok: false, why: 'unplayable' })
    video.onloadeddata = () => {
      if (!video.videoWidth || !video.videoHeight) return finish({ ok: false, why: 'unplayable' })
      if (Number.isFinite(video.duration) && video.duration > CLIP_LIMITS.seconds + 0.5) return finish({ ok: false, why: 'long' })
      // A moment in, so the first frame isn't a black one.
      video.currentTime = Math.min(0.15, (video.duration || 1) / 2)
    }
    video.onseeked = () => {
      try {
        const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish({ ok: false, why: 'unplayable' })
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const aspect = video.videoWidth / video.videoHeight
        canvas.toBlob((poster) => finish(poster ? { ok: true, poster, aspect } : { ok: false, why: 'unplayable' }), 'image/jpeg', 0.88)
      } catch {
        finish({ ok: false, why: 'unplayable' })
      }
    }
    video.src = url
  })
}
