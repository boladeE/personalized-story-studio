import { useRef, useState } from 'react'
import type { VoiceNote } from '../story/types'
import { lengthOf, UPLOAD_BYTES, UPLOAD_SECONDS, useRecorder, VOICE_SECONDS } from './recorder'

type Note = VoiceNote & { id: string }
export const MAX_VOICE_NOTES = 3

/**
 * Voice notes added while the film is being made, beside the photos and videos: recorded here or
 * brought from elsewhere. The studio puts each one on the scene it belongs to.
 */
export function VoiceNotes({ notes, onChange }: { notes: Note[]; onChange: (notes: Note[]) => void }) {
  const recorder = useRecorder(VOICE_SECONDS)
  const [problem, setProblem] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  const room = MAX_VOICE_NOTES - notes.length
  const add = (note: VoiceNote) => onChange([...notes, { ...note, id: `v-${crypto.randomUUID().slice(0, 8)}` }].slice(0, MAX_VOICE_NOTES))
  const record = async () => {
    setProblem('')
    const made = await recorder.start()
    if (made) add({ src: URL.createObjectURL(made.blob), seconds: made.seconds })
  }
  const upload = async (files: File[]) => {
    setProblem('')
    const added: Note[] = []
    for (const file of files.slice(0, room)) {
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
      added.push({ src, seconds, id: `v-${crypto.randomUUID().slice(0, 8)}` })
    }
    if (added.length) onChange([...notes, ...added].slice(0, MAX_VOICE_NOTES))
  }
  return (
    <section className="voice-notes" aria-label="Voice notes">
      <h2>Voice notes</h2>
      <p>Say something in your own voice, or add a voice note you already have. Up to three.</p>
      {notes.length > 0 && (
        <ul>
          {notes.map((note, i) => (
            <li key={note.id}>
              <audio controls src={note.src} aria-label={`Voice note ${i + 1}`} />
              <button type="button" className="text-button" onClick={() => onChange(notes.filter((n) => n.id !== note.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={picker}
        type="file"
        accept="audio/*,.m4a,.mp3,.ogg,.opus,.wav,.aac"
        multiple
        hidden
        aria-label="Upload voice notes"
        onChange={(e) => {
          void upload(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      {room > 0 && (
        <div className="voice-notes-add">
          {recorder.state === 'recording' ? (
            <button type="button" className="button small primary" onClick={recorder.stop}>
              Stop ({Math.floor(recorder.seconds)}s)
            </button>
          ) : (
            <button type="button" className="button small ghost" onClick={() => void record()}>
              Record one
            </button>
          )}
          <button type="button" className="button small ghost" onClick={() => picker.current?.click()}>
            Upload one
          </button>
        </div>
      )}
      <small role="status">{problem || (recorder.state === 'denied' ? 'The microphone is blocked for this site. Allow it in the browser, then try again.' : '')}</small>
    </section>
  )
}
