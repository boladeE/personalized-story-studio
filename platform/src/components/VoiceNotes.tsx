import { useEffect, useRef, useState } from 'react'
import type { Voiced } from '../story/types'
import { MAX_VOICES } from '../story/validate'
import { lengthOf, UPLOAD_BYTES, UPLOAD_SECONDS, useRecorder, VOICE_SECONDS } from './recorder'

export type Note = Voiced
export const MAX_VOICE_NOTES = MAX_VOICES

const newId = () => `v-${crypto.randomUUID().slice(0, 8)}`

/** How many bars a voice note is drawn as. */
const BARS = 44

/**
 * The shape of a recording: how loud it is across its length, as a row of bars. The film draws a
 * voice note as this, filling as it plays. Empty when this browser can't decode the recording; the
 * film then draws an even bar of its own.
 */
export async function peaksOf(blob: Blob): Promise<number[]> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return []
  const ctx = new Ctx()
  try {
    const data = await ctx.decodeAudioData(await blob.arrayBuffer())
    const samples = data.getChannelData(0)
    const size = Math.max(1, Math.floor(samples.length / BARS))
    const levels = Array.from({ length: BARS }, (_, bar) => {
      let sum = 0
      const from = bar * size
      const to = Math.min(samples.length, from + size)
      // Every eighth sample is plenty for a bar's height.
      for (let i = from; i < to; i += 8) sum += samples[i] * samples[i]
      return Math.sqrt(sum / Math.max(1, (to - from) / 8))
    })
    const top = Math.max(...levels, 0.0001)
    return levels.map((l) => Math.round(Math.max(0.08, Math.min(1, (l / top) ** 0.7)) * 100) / 100)
  } catch {
    return []
  } finally {
    void ctx.close().catch(() => {})
  }
}

/**
 * Adding voice notes to a film: recorded here, or brought from elsewhere (one a relative sent, say).
 * They sit in the same tray as the photos and videos, and the film plays them in a scene of their own.
 */
export function useVoiceNotes(notes: Note[], onChange: (notes: Note[]) => void) {
  const recorder = useRecorder(VOICE_SECONDS)
  const [problem, setProblem] = useState('')
  const room = MAX_VOICE_NOTES - notes.length
  const record = async () => {
    setProblem('')
    if (room <= 0) return setProblem(`Up to ${MAX_VOICE_NOTES} voice notes fit in one film.`)
    const made = await recorder.start()
    if (made) onChange([...notes, { src: URL.createObjectURL(made.blob), seconds: made.seconds, id: newId(), peaks: await peaksOf(made.blob) }].slice(0, MAX_VOICE_NOTES))
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
      added.push({ src, seconds, id: newId(), peaks: await peaksOf(file) })
    }
    if (added.length) onChange([...notes, ...added].slice(0, MAX_VOICE_NOTES))
  }
  const remove = (id: string) => onChange(notes.filter((n) => n.id !== id))
  const change = (id: string, patch: Partial<Note>) => onChange(notes.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  return {
    record,
    stop: recorder.stop,
    recording: recorder.state === 'recording',
    seconds: recorder.seconds,
    upload,
    remove,
    change,
    room,
    problem: problem || (recorder.state === 'denied' ? 'The microphone is blocked for this site. Allow it in the browser, then try again.' : ''),
  }
}

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

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
      <span className="clip-mark">{note.who?.trim() || 'Voice'}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove voice note ${n}`}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  )
}

/**
 * Who is speaking in each voice note: one short field a note. Left empty, the note is the sender's
 * own. This is how a film comes to hold a whole family's voices: each of theirs is named here.
 */
export function VoiceNames({ notes, onChange }: { notes: Note[]; onChange: (id: string, patch: Partial<Note>) => void }) {
  if (!notes.length) return null
  return (
    <fieldset className="voice-names">
      <legend>Who is speaking?</legend>
      <p className="voice-names-hint">Name anyone else who recorded one. Leave yours empty.</p>
      {notes.map((note, i) => (
        <label key={note.id} className="voice-name">
          <span>
            Voice note {i + 1} <small>{clock(note.seconds)}</small>
          </span>
          <input maxLength={40} value={note.who ?? ''} aria-label={`Who is speaking in voice note ${i + 1}`} onChange={(e) => onChange(note.id, { who: e.target.value.replace(/\s+/g, ' ').slice(0, 40) })} />
        </label>
      ))}
    </fieldset>
  )
}
