import { useEffect, useRef, useState } from 'react'
import type { VoiceNote } from '../story/types'
import { lengthOf, UPLOAD_BYTES, UPLOAD_SECONDS, useRecorder, VOICE_SECONDS } from './recorder'

export type Note = VoiceNote & { id: string }
export const MAX_VOICE_NOTES = 3

const newId = () => `v-${crypto.randomUUID().slice(0, 8)}`

/**
 * Adding voice notes while the film is being made: recorded here or brought from elsewhere. They sit
 * in the same tray as the photos and videos, and the studio puts each one on the scene it belongs to.
 */
export function useVoiceNotes(notes: Note[], onChange: (notes: Note[]) => void) {
  const recorder = useRecorder(VOICE_SECONDS)
  const [problem, setProblem] = useState('')
  const room = MAX_VOICE_NOTES - notes.length
  const record = async () => {
    setProblem('')
    if (room <= 0) return setProblem(`Up to ${MAX_VOICE_NOTES} voice notes fit in one film.`)
    const made = await recorder.start()
    if (made) onChange([...notes, { src: URL.createObjectURL(made.blob), seconds: made.seconds, id: newId() }].slice(0, MAX_VOICE_NOTES))
  }
  const upload = async (files: File[]) => {
    setProblem('')
    if (files.length > room) setProblem(`Up to ${MAX_VOICE_NOTES} voice notes fit in one film.`)
    const added: Note[] = []
    for (const file of files.slice(0, Math.max(0, room))) {
      if (file.size > UPLOAD_BYTES) {
        setProblem('A recording is over 4 MB and was skipped. A voice note of up to a minute fits.')
        continue
      }
      const src = URL.createObjectURL(file)
      const seconds = await lengthOf(src)
      if (seconds === null || seconds > UPLOAD_SECONDS + 0.5) {
        URL.revokeObjectURL(src)
        setProblem(seconds === null ? 'This browser can’t play one of those recordings. Try an MP3 or M4A, or record it here.' : 'A recording is longer than a minute and was skipped.')
        continue
      }
      added.push({ src, seconds, id: newId() })
    }
    if (added.length) onChange([...notes, ...added].slice(0, MAX_VOICE_NOTES))
  }
  const remove = (id: string) => onChange(notes.filter((n) => n.id !== id))
  return {
    record,
    stop: recorder.stop,
    recording: recorder.state === 'recording',
    seconds: recorder.seconds,
    upload,
    remove,
    room,
    problem: problem || (recorder.state === 'denied' ? 'The microphone is blocked for this site. Allow it in the browser, then try again.' : ''),
  }
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

/** A voice note as a tile among the photos: tap to hear it, and its length. */
export function VoiceTile({ note, n, onRemove }: { note: Note; n: number; onRemove: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => () => audio.current?.pause(), [])
  const toggle = () => {
    const el = (audio.current ??= Object.assign(new Audio(note.src), { onended: () => setPlaying(false), onpause: () => setPlaying(false), onplay: () => setPlaying(true) }))
    if (el.paused) void el.play().catch(() => setPlaying(false))
    else el.pause()
  }
  return (
    <li className={`voice-tile${playing ? ' is-playing' : ''}`}>
      <button type="button" className="voice-tile-play" onClick={toggle}>
        <span className="voice-tile-bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="visually-hidden">
          {playing ? 'Pause' : 'Play'} voice note {n},{' '}
        </span>
        <b>{clock(note.seconds)}</b>
      </button>
      <span className="clip-mark">Voice</span>
      <button type="button" onClick={onRemove} aria-label={`Remove voice note ${n}`}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  )
}
