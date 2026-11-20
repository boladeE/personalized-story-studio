import { useEffect, useRef, useState } from 'react'

/**
 * Recording the sender's voice in the browser: for a voice note that plays in
 * the film, or to say what they would otherwise type. The recording stays on
 * the device until it is used.
 */
export interface Recording {
  blob: Blob
  seconds: number
}

export function useRecorder(maxSeconds: number) {
  const [state, setState] = useState<'idle' | 'recording' | 'denied'>('idle')
  const [seconds, setSeconds] = useState(0)
  const live = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; started: number; timer: number; done?: (r: Recording | null) => void } | null>(null)

  const finish = () => {
    const now = live.current
    if (!now) return
    live.current = null
    window.clearInterval(now.timer)
    now.stream.getTracks().forEach((t) => t.stop())
    const length = (performance.now() - now.started) / 1000
    const blob = new Blob(now.chunks, { type: now.recorder.mimeType || 'audio/webm' })
    setState('idle')
    now.done?.(blob.size > 0 && length > 0.4 ? { blob, seconds: Math.min(maxSeconds, length) } : null)
  }

  /** Start recording. Resolves with the recording once it is stopped, or null if there is none. */
  const start = (): Promise<Recording | null> =>
    new Promise((resolve) => {
      if (live.current || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return resolve(null)
      navigator.mediaDevices.getUserMedia({ audio: true }).then(
        (stream) => {
          const recorder = new MediaRecorder(stream)
          const chunks: Blob[] = []
          recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
          recorder.onstop = finish
          const started = performance.now()
          const timer = window.setInterval(() => {
            const gone = (performance.now() - started) / 1000
            setSeconds(gone)
            if (gone >= maxSeconds) recorder.state === 'recording' && recorder.stop()
          }, 200)
          live.current = { recorder, stream, chunks, started, timer, done: resolve }
          setSeconds(0)
          setState('recording')
          recorder.start()
        },
        () => {
          setState('denied')
          resolve(null)
        },
      )
    })

  const stop = () => {
    if (live.current?.recorder.state === 'recording') live.current.recorder.stop()
  }

  useEffect(() => () => stop(), [])
  return { state, seconds, start, stop }
}
