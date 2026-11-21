import { useRef, useState } from 'react'
import { OCCASIONS, occasionOf } from '../story/occasions'
import { NO_PHOTO, OUTLINE_LIMITS, outlineOf, withChapter } from '../story/outline'
import { endingOf } from '../story/types'
import type { Chapter, Intake, Memory, SceneLayout } from '../story/types'
import { LIMITS } from '../story/validate'
import { Cross, Field, GrowingText, ListEditor, oneLine } from './fields'
import { usePhotos } from './photos'
import { clock, MAX_VOICE_NOTES, useVoiceNotes } from './VoiceNotes'
import { UndoToast } from './UndoToast'
import { Working } from './Working'

/**
 * What a scene is made from, for changing it in the editor under the film:
 * the same fields as that scene's step of the detailed form, without leaving
 * the film. Every change goes straight into the draft.
 */

/** The part of the draft each scene is written in. Scenes that are not here (the opening, the names) have no words of their own. */
export const SCENE_FIELDS = {
  spotlight: 'spotlight',
  memoryLane: 'memories',
  redFlags: 'habits',
  reasons: 'reasons',
  cameraRoll: 'photos',
  letter: 'letter',
  wish: 'wish',
} as const satisfies Record<string, keyof Intake>

export type WordScene = keyof typeof SCENE_FIELDS
export const hasWords = (type: string): type is WordScene => type in SCENE_FIELDS

/** What the scene asks of the sender, in a line. */
export function sceneAsk(type: WordScene, intake: Intake): string {
  const them = intake.recipient.trim() || 'them'
  const occasion = occasionOf(intake.occasion)
  switch (type) {
    case 'spotlight':
      return `What you love about how ${them} is, in a sentence or two.`
    case 'memoryLane':
      return 'A short title for each moment, then what happened, the way you’d tell a friend.'
    case 'redFlags':
      return 'Their funniest habits, presented as very serious red flags. Two or more.'
    case 'reasons':
      return occasion.reasons?.hint ?? 'The reasons, shown one at a time. Two or more.'
    case 'cameraRoll':
      return `Up to ${LIMITS.photos} photos. Three or more gives the film its camera roll.`
    case 'letter':
      return 'A few sentences is plenty. Leave a blank line between paragraphs.'
    case 'wish': {
      const chosen = endingOf(intake)
      return `Your last line, shown once ${chosen?.kind === 'question' ? `${them} has answered` : chosen?.kind === 'invitation' ? `${them} has picked` : occasion.ending.shown}.`
    }
  }
}

export function SceneWords({
  type,
  intake,
  setIntake,
  onWriting,
}: {
  type: WordScene
  intake: Intake
  setIntake: (update: (current: Intake) => Intake) => void
  /** Which line of a list (or which memory) is being written, so the still above can show that part of the scene. */
  onWriting: (index: number) => void
}) {
  const set = <K extends keyof Intake>(key: K, value: Intake[K]) => setIntake((c) => ({ ...c, [key]: value }))
  const them = intake.recipient.trim() || 'them'

  switch (type) {
    case 'spotlight':
      return (
        <Field label={`What you love about how ${them} is`}>
          {(id) => <textarea id={id} rows={3} maxLength={LIMITS.spotlight} value={intake.spotlight} onChange={(e) => set('spotlight', e.target.value)} />}
        </Field>
      )

    case 'memoryLane':
      return <Memories intake={intake} set={set} onWriting={onWriting} />

    case 'redFlags':
      // A list always has a line to write on.
      return <ListEditor label="Habit" values={intake.habits.length ? intake.habits : ['']} max={LIMITS.habits} onChange={(v) => set('habits', v)} onActive={onWriting} />

    case 'reasons':
      return <ListEditor label="Reason" values={intake.reasons.length ? intake.reasons : ['']} max={LIMITS.reasons} onChange={(v) => set('reasons', v)} onActive={onWriting} />

    case 'cameraRoll':
      return <Roll intake={intake} set={set} />

    case 'letter':
      return (
        <Field label={`Your letter to ${them}`}>
          {(id) => <textarea id={id} className="letter-pad" rows={5} maxLength={LIMITS.letter} value={intake.letter} onChange={(e) => set('letter', e.target.value)} />}
        </Field>
      )

    case 'wish': {
      const ending = intake.ending
      return (
        <>
          {/* An ending the sender chose is theirs to reword here. Choosing a different kind of ending is done where the film is started. */}
          {ending?.kind === 'question' && (
            <Field label="Your question">{(id) => <input id={id} maxLength={LIMITS.ask} value={ending.ask} onChange={(e) => set('ending', { kind: 'question', ask: e.target.value })} />}</Field>
          )}
          {ending?.kind === 'invitation' && (
            <>
              <Field label="Your invitation">{(id) => <input id={id} maxLength={LIMITS.ask} value={ending.invite} onChange={(e) => set('ending', { ...ending, invite: e.target.value })} />}</Field>
              <Field label="One thing to pick">
                {(id) => <input id={id} maxLength={LIMITS.choice} value={ending.choices[0]} onChange={(e) => set('ending', { ...ending, choices: [e.target.value, ending.choices[1]] })} />}
              </Field>
              <Field label="The other">
                {(id) => <input id={id} maxLength={LIMITS.choice} value={ending.choices[1]} onChange={(e) => set('ending', { ...ending, choices: [ending.choices[0], e.target.value] })} />}
              </Field>
            </>
          )}
          <Field label="Your last line">
            {(id) => <textarea id={id} rows={2} maxLength={LIMITS.wish} value={intake.wish} onChange={(e) => set('wish', e.target.value)} />}
          </Field>
        </>
      )
    }
  }
}

type Setter = <K extends keyof Intake>(key: K, value: Intake[K]) => void


/**
 * The film's voice notes, where they are changed: who is speaking in each, the photo shown while
 * they speak, the order they are heard in, and adding or removing one. A note may be the sender's
 * own or one somebody else recorded for the film.
 */
function VoicesEditor({ intake, set }: { intake: Intake; set: Setter }) {
  const notes = intake.voices ?? []
  const voiceNotes = useVoiceNotes(notes, (voices) => set('voices', voices))
  const picker = useRef<HTMLInputElement>(null)
  const move = (at: number, by: -1 | 1) => {
    const next = [...notes]
    ;[next[at], next[at + by]] = [next[at + by], next[at]]
    set('voices', next)
  }
  return (
    <div className="voices-editor">
      {notes.map((note, i) => (
        <fieldset key={note.id} className="voice-row">
          <legend>
            Voice note {i + 1} <small>{clock(note.seconds)}</small>
          </legend>
          <audio controls src={note.src} aria-label={`Voice note ${i + 1}`} />
          <Field label="Who is speaking (leave empty if it is you)">
            {(id) => <input id={id} maxLength={40} value={note.who ?? ''} onChange={(e) => voiceNotes.change(note.id, { who: oneLine(e.target.value) })} />}
          </Field>
          {intake.photos.length > 0 && (
            <fieldset className="photo-pick">
              <legend>Photo shown while they speak</legend>
              <div className="photo-pick-row">
                <label className="pick pick-auto">
                  <input type="radio" name={`voice-photo-${note.id}`} checked={!note.photoId} onChange={() => voiceNotes.change(note.id, { photoId: undefined })} />
                  <span>No photo</span>
                </label>
                {intake.photos.map((p, n) => (
                  <label key={p.id} className="pick">
                    <input type="radio" name={`voice-photo-${note.id}`} checked={note.photoId === p.id} onChange={() => voiceNotes.change(note.id, { photoId: p.id })} />
                    <img src={p.src} alt="" />
                    <span className="visually-hidden">
                      Photo {n + 1}
                      {p.caption ? `: ${p.caption}` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="voice-row-tools">
            {i > 0 && (
              <button type="button" className="text-button" onClick={() => move(i, -1)}>
                Play it earlier
              </button>
            )}
            {i < notes.length - 1 && (
              <button type="button" className="text-button" onClick={() => move(i, 1)}>
                Play it later
              </button>
            )}
            <button type="button" className="text-button" onClick={() => voiceNotes.remove(note.id)}>
              Remove it
            </button>
          </div>
        </fieldset>
      ))}
      <input
        ref={picker}
        type="file"
        accept="audio/*,.m4a,.mp3,.ogg,.opus,.wav,.aac"
        multiple
        hidden
        aria-label="Upload voice notes"
        onChange={(e) => {
          void voiceNotes.upload(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <div className="voice-row-add">
        {voiceNotes.recording ? (
          <button type="button" className="chip-button is-main" onClick={voiceNotes.stop}>
            Stop recording ({Math.floor(voiceNotes.seconds)}s)
          </button>
        ) : (
          <button type="button" className="chip-button" disabled={voiceNotes.room <= 0} onClick={() => void voiceNotes.record()}>
            Record a voice note
          </button>
        )}
        <button type="button" className="chip-button" disabled={voiceNotes.room <= 0} onClick={() => picker.current?.click()}>
          Upload a voice note
        </button>
      </div>
      <small role="status">{voiceNotes.problem || `Up to ${MAX_VOICE_NOTES} voice notes, each up to a minute. Each plays on a page of its own, with the song turned down under it.`}</small>
    </div>
  )
}

/** What a scene of the film's own asks of the sender, in a line. */
export function chapterAsk(layout: SceneLayout, intake: Intake): string {
  const them = intake.recipient.trim() || 'them'
  switch (layout) {
    case 'line':
      return 'What this scene says. A blank line starts a new page.'
    case 'list':
      return 'Each line gets its turn on screen. Two or more.'
    case 'moment':
      return 'What this scene says. A blank line starts a new page.'
    case 'photos':
      return `The photos of ${them} that no other scene shows.`
    case 'voices':
      return `Voice notes for ${them}: yours, and anyone else’s. Each is heard on a page of its own.`
  }
}

/**
 * How a scene of words is shown, as the sender sees it: words (one page or several), or a list.
 * Whether words are a single line or a told scene of pages follows from how much is written.
 */
const SHAPES: Array<{ id: 'words' | 'list'; name: string }> = [
  { id: 'words', name: 'Words' },
  { id: 'list', name: 'A list' },
]
/** One short page is a line; anything more is told over pages. */
const wordsLayout = (pages: string[]): 'line' | 'moment' => {
  const said = pages.map((p) => p.trim()).filter(Boolean)
  return said.length <= 1 && (said[0]?.length ?? 0) <= OUTLINE_LIMITS.line ? 'line' : 'moment'
}

/**
 * The opening of a film with its own scenes: the two names and the occasion, which the ticket, the
 * opening line and the ending are all written from. This is the only place they are changed.
 */
export function OpeningWords({ intake, setIntake }: { intake: Intake; setIntake: (update: (current: Intake) => Intake) => void }) {
  const set: Setter = (key, value) => setIntake((c) => ({ ...c, [key]: value }))
  // A film needs both names, so a name being retyped is held here until there is one to use.
  const [names, setNames] = useState({ recipient: intake.recipient, sender: intake.sender })
  const [own, setOwn] = useState(Boolean(intake.occasionName))
  const name = (key: 'recipient' | 'sender', value: string) => {
    setNames((was) => ({ ...was, [key]: value }))
    if (value.trim()) set(key, value)
  }
  return (
    <>
      <Field label="Their name">{(id) => <input id={id} maxLength={LIMITS.name} value={names.recipient} onChange={(e) => name('recipient', e.target.value)} />}</Field>
      <Field label="Your name">{(id) => <input id={id} maxLength={LIMITS.name} value={names.sender} onChange={(e) => name('sender', e.target.value)} />}</Field>
      <Field label="The occasion">
        {(id) => (
          <select
            id={id}
            value={own ? 'own' : intake.occasion}
            onChange={(e) => {
              const picked = e.target.value
              setOwn(picked === 'own')
              if (picked === 'own') setIntake((c) => ({ ...c, occasion: 'just-because' }))
              else setIntake((c) => ({ ...c, occasion: picked as Intake['occasion'], occasionName: undefined }))
            }}
          >
            {OCCASIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
            <option value="own">Something else</option>
          </select>
        )}
      </Field>
      <Field label="Opening line">
        {(id) => <input id={id} maxLength={60} value={intake.opening?.title ?? ''} onChange={(e) => set('opening', { title: e.target.value, body: intake.opening?.body ?? '' })} />}
      </Field>
      <Field label="And under it">
        {(id) => <input id={id} maxLength={140} value={intake.opening?.body ?? ''} onChange={(e) => set('opening', { title: intake.opening?.title ?? '', body: e.target.value })} />}
      </Field>
      {own && <Field label="What it’s for">{(id) => <input id={id} maxLength={LIMITS.occasionName} value={intake.occasionName ?? ''} onChange={(e) => set('occasionName', e.target.value)} />}</Field>}
    </>
  )
}

/** The page of a told scene the cursor is on: pages are parted by a blank line. */
const pageAt = (el: HTMLTextAreaElement) => el.value.slice(0, el.selectionStart).split('\n\n').length - 1

/**
 * One of the film's own scenes, for changing beside the still: what it is
 * called, how it is shown, and its words. A scene the studio wrote from the
 * sender's note and a scene the sender adds are changed the same way.
 */
export function ChapterWords({
  chapter,
  intake,
  setIntake,
  onWriting,
}: {
  chapter: Chapter
  intake: Intake
  setIntake: (update: (current: Intake) => Intake) => void
  onWriting: (index: number) => void
}) {
  const set: Setter = (key, value) => setIntake((c) => ({ ...c, [key]: value }))
  const change = (patch: Partial<Chapter>) => setIntake((c) => ({ ...c, outline: withChapter(outlineOf(c) ?? [], chapter.id, patch) }))
  const lines = chapter.lines.length ? chapter.lines : ['']
  const photoPick = (
    <>
          {intake.photos.length > 0 && (
            <fieldset className="photo-pick">
              <legend>Photo for this scene</legend>
              <div className="photo-pick-row">
                <label className="pick pick-auto">
                  <input type="radio" name={`scene-photo-${chapter.id}`} checked={!chapter.photoId} onChange={() => change({ photoId: undefined })} />
                  <span>Let the studio choose</span>
                </label>
                <label className="pick pick-auto">
                  <input type="radio" name={`scene-photo-${chapter.id}`} checked={chapter.photoId === NO_PHOTO} onChange={() => change({ photoId: NO_PHOTO })} />
                  <span>No photo</span>
                </label>
                {intake.photos.map((p, n) => (
                  <label key={p.id} className="pick">
                    <input type="radio" name={`scene-photo-${chapter.id}`} checked={chapter.photoId === p.id} onChange={() => change({ photoId: p.id })} />
                    <img src={p.src} alt="" />
                    <span className="visually-hidden">
                      Photo {n + 1}
                      {p.caption ? `: ${p.caption}` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
    </>
  )
  return (
    <>
      <Field label="Scene name">{(id) => <input id={id} maxLength={OUTLINE_LIMITS.name} value={chapter.name} onFocus={() => onWriting(-1)} onChange={(e) => change({ name: oneLine(e.target.value) })} />}</Field>
      <Field label="Line that leads into it">{(id) => <input id={id} maxLength={90} value={chapter.intro ?? ''} onFocus={() => onWriting(-1)} onChange={(e) => change({ intro: oneLine(e.target.value) })} />}</Field>
      {chapter.layout !== 'photos' && chapter.layout !== 'voices' && (
        <fieldset className="scene-shape">
          <legend>Shown as</legend>
          <div className="scene-shape-row">
            {SHAPES.map((shape) => (
              <label key={shape.id} className="scene-shape-option">
                <input
                  type="radio"
                  name={`shape-${chapter.id}`}
                  checked={shape.id === 'list' ? chapter.layout === 'list' : chapter.layout !== 'list'}
                  onChange={() => change({ layout: shape.id === 'list' ? 'list' : wordsLayout(chapter.lines) })}
                />
                {shape.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {chapter.layout === 'list' && <ListEditor label="Line" values={lines} max={OUTLINE_LIMITS.lines} onChange={(v) => change({ lines: v })} onActive={onWriting} />}
      {(chapter.layout === 'moment' || chapter.layout === 'line') && (
        <>
          <Field label="What it says">
            {(id) => (
              <textarea
                id={id}
                rows={5}
                maxLength={LIMITS.memoryStory}
                value={lines.join('\n\n')}
                onSelect={(e) => onWriting(pageAt(e.currentTarget))}
                onChange={(e) => {
                  onWriting(pageAt(e.currentTarget))
                  const pages = e.target.value.split('\n\n')
                  change({ lines: pages, layout: wordsLayout(pages) })
                }}
              />
            )}
          </Field>
          {photoPick}
        </>
      )}
      {chapter.layout === 'voices' && <VoicesEditor intake={intake} set={set} />}
      {chapter.layout === 'photos' && <Roll intake={intake} set={set} />}
    </>
  )
}

function Memories({ intake, set, onWriting }: { intake: Intake; set: Setter; onWriting: (index: number) => void }) {
  const update = (id: string, patch: Partial<Memory>) => set('memories', intake.memories.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  return (
    <div className="words-memories">
      {intake.memories.map((memory, i) => (
        <fieldset key={memory.id} className="words-memory">
          <legend>Memory {i + 1}</legend>
          <Field label="Title">{(id) => <input id={id} maxLength={LIMITS.memoryTitle} value={memory.title} onFocus={() => onWriting(i)} onChange={(e) => update(memory.id, { title: e.target.value })} />}</Field>
          <Field label="What happened">
            {(id) => <textarea id={id} rows={3} maxLength={LIMITS.memoryStory} value={memory.story} onFocus={() => onWriting(i)} onChange={(e) => update(memory.id, { story: e.target.value })} />}
          </Field>
          {intake.photos.length > 0 && (
            <fieldset className="photo-pick">
              <legend>Photo for this memory</legend>
              <div className="photo-pick-row">
                <label className="pick pick-auto">
                  <input type="radio" name={`words-photo-${memory.id}`} checked={!memory.photoId} onChange={() => update(memory.id, { photoId: '' })} />
                  <span>Let the studio choose</span>
                </label>
                {intake.photos.map((p, n) => (
                  <label key={p.id} className="pick">
                    <input type="radio" name={`words-photo-${memory.id}`} checked={memory.photoId === p.id} onChange={() => update(memory.id, { photoId: p.id })} />
                    <img src={p.src} alt="" />
                    <span className="visually-hidden">
                      Photo {n + 1}
                      {p.caption ? `: ${p.caption}` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {intake.memories.length > 1 && (
            <button type="button" className="text-button" onClick={() => set('memories', intake.memories.filter((m) => m.id !== memory.id))}>
              Remove memory {i + 1}
            </button>
          )}
        </fieldset>
      ))}
      {intake.memories.length < LIMITS.memories && (
        <button type="button" className="chip-button" onClick={() => set('memories', [...intake.memories, { id: `m-${crypto.randomUUID()}`, title: '', story: '', photoId: '' }])}>
          Add a memory
        </button>
      )}
    </div>
  )
}

/** The photos themselves: add, caption and remove. A removed photo can be had back. */
function Roll({ intake, set }: { intake: Intake; set: Setter }) {
  const { add, remove, removed, restore, forget, error, reading } = usePhotos()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="words-roll">
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif,video/mp4,video/quicktime,video/webm,.mov"
        multiple
        hidden
        aria-label="Add photos"
        onChange={(e) => {
          void add(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      {/* Above the photos, so it is seen on a phone where the row it came from has closed up. */}
      {removed && (
        <UndoToast token={removed.photo.id} onUndo={restore} onDone={forget}>
          Photo removed.
        </UndoToast>
      )}
      <ul className="roll-edit">
        {intake.photos.map((photo, i) => (
          <li key={photo.id}>
            <span className="roll-thumb">
              <img src={photo.src} alt={`Photo ${i + 1}`} />
              {photo.clip && <span className="clip-mark">Clip</span>}
            </span>
            <GrowingText
              aria-label={`Caption for photo ${i + 1}`}
              maxLength={LIMITS.caption}
              value={photo.caption}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              onChange={(e) => set('photos', intake.photos.map((p) => (p.id === photo.id ? { ...p, caption: oneLine(e.target.value) } : p)))}
            />
            <button type="button" className="icon-remove" onClick={() => remove(photo.id)} aria-label={`Remove photo ${i + 1}`}>
              <Cross />
            </button>
          </li>
        ))}
        {intake.photos.length < LIMITS.photos && (
          <li className="roll-add">
            <button type="button" onClick={() => input.current?.click()}>
              <b>Add photos or clips</b>
              <span>{intake.photos.length ? `${LIMITS.photos - intake.photos.length} more fit` : 'From this device'}</span>
            </button>
          </li>
        )}
      </ul>
      {reading > 0 && <Working className="photo-reading">Reading {reading === 1 ? 'a photo' : `${reading} photos`}…</Working>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
