/**
 * Taking in a video clip the sender picked. Like photos, a clip stays on the
 * sender's device until the film is sent. Nothing is converted: a clip this
 * browser can play is kept as it is, with its first frame drawn as a picture
 * to show wherever the clip can't play.
 */

export const CLIP_LIMITS = {
  /** Clips are for a short moment of someone, not a whole video. */
  seconds: 60,
  /** A phone's own video of that length, as the phone hands it over. */
  bytes: 50 * 1024 * 1024,
  /** How many clips one film holds. */
  count: 3,
} as const

export const isClip = (file: File) => /^video\//i.test(file.type) || /\.(mp4|m4v|mov|webm)$/i.test(file.name)

export type ReadClip = { ok: true; poster: Blob; aspect: number } | { ok: false; why: 'unplayable' | 'long' }

/** A plain dark picture the shape of the clip, for a phone that will play a clip but won't hand over a frame of it. */
function plainPoster(aspect: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = aspect >= 1 ? 800 : Math.round(800 * aspect)
  canvas.height = aspect >= 1 ? Math.round(800 / aspect) : 800
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.fillStyle = '#14261f'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
}

/**
 * Read a clip: check this browser plays it and that it is short, and draw a frame of it.
 *
 * iPhones don't load any of a video until it is played, so waiting for its first frame waited
 * forever there and every clip was refused. The clip is now judged by what the phone does report
 * (its size and length), then played silently for a moment to get a frame; if no frame comes, the
 * clip is still taken, with a plain picture standing in for it.
 */
export function readClip(file: Blob): Promise<ReadClip> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    let done = false
    let known = false
    const finish = (result: ReadClip) => {
      if (done) return
      done = true
      clearTimeout(timer)
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      URL.revokeObjectURL(url)
      resolve(result)
    }
    const aspect = () => video.videoWidth / video.videoHeight
    const withoutFrame = () => void plainPoster(aspect()).then((poster) => finish(poster ? { ok: true, poster, aspect: aspect() } : { ok: false, why: 'unplayable' }))
    // Once the phone has said what the clip is, it is taken even if no frame can be drawn in time.
    const timer = setTimeout(() => (known ? withoutFrame() : finish({ ok: false, why: 'unplayable' })), 15_000)
    const draw = () => {
      if (done || !video.videoWidth) return
      try {
        const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) return withoutFrame()
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((poster) => (poster ? finish({ ok: true, poster, aspect: aspect() }) : withoutFrame()), 'image/jpeg', 0.88)
      } catch {
        withoutFrame()
      }
    }
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.preload = 'auto'
    // In the page, out of sight: some phones won't play a video that isn't.
    Object.assign(video.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', opacity: '0', pointerEvents: 'none' })
    document.body.appendChild(video)
    video.onerror = () => finish({ ok: false, why: 'unplayable' })
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) return
      if (Number.isFinite(video.duration) && video.duration > CLIP_LIMITS.seconds + 0.5) return finish({ ok: false, why: 'long' })
      known = true
      // Played silently for a moment: the only way some phones will show a frame.
      void video.play().then(
        () => setTimeout(draw, 350),
        () => {
          video.currentTime = Math.min(0.15, (video.duration || 1) / 2)
        },
      )
    }
    video.onseeked = () => draw()
    video.src = url
    video.load()
  })
}
