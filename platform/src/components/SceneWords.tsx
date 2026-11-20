import { useRef } from 'react'
import { occasionOf } from '../story/occasions'
import { endingOf } from '../story/types'
import type { Intake, Memory } from '../story/types'
import { LIMITS } from '../story/validate'
import { Cross, Field, GrowingText, ListEditor, oneLine } from './fields'
import { usePhotos } from './photos'
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
        accept="image/*,.heic,.heif"
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
            <img src={photo.src} alt={`Photo ${i + 1}`} />
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
              <b>Add photos</b>
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
