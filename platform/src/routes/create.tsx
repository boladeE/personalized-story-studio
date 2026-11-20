import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { StudioHeader } from '../components/StudioHeader'
import { useDraft } from '../components/draft'
import { UndoToast } from '../components/UndoToast'
import { Working } from '../components/Working'
import { Cross, Field, GrowingText, ListEditor, oneLine } from '../components/fields'
import { releasePhotos, usePhotos } from '../components/photos'
import { Still } from '../film/Still'
import { previewFor, previewLook } from '../film/previews'
import type { StepFocus, StepId } from '../film/previews'
import { canGenerate, LOOKS, sceneStatus } from '../story/generate'
import type { SceneStatus } from '../story/generate'
import { occasionOf, OCCASIONS } from '../story/occasions'
import { newSeed } from '../story/rng'
import { emptyIntake, SAMPLE_FIXED } from '../story/sample'
import { isOccasion } from '../story/types'
import type { Intake, Memory, Occasion } from '../story/types'
import { LIMITS } from '../story/validate'

/**
 * Writing the story: one question on the page at a time, with the scene it
 * feeds shown beside it as the sender types. The strip of frames across the
 * top is both the progress and the way to jump around; nothing is locked.
 */

const STEPS: Array<{ id: StepId; name: string; scenes: string[] }> = [
  { id: 'who', name: 'Names', scenes: ['ticket', 'hello'] },
  { id: 'photos', name: 'Photos', scenes: ['cameraRoll'] },
  { id: 'spotlight', name: 'Main character', scenes: ['spotlight'] },
  { id: 'memories', name: 'Memories', scenes: ['memoryLane'] },
  { id: 'habits', name: 'Red flags', scenes: ['redFlags'] },
  { id: 'reasons', name: 'Reasons', scenes: ['reasons'] },
  { id: 'letter', name: 'Letter', scenes: ['letter'] },
  { id: 'wish', name: 'The wish', scenes: ['wish'] },
  { id: 'look', name: 'Look', scenes: [] },
]
const STEP_IDS = STEPS.map((s) => s.id)
/** The steps of the older fixed scenes. */
const OLDER_STEPS: StepId[] = ['spotlight', 'memories', 'habits', 'reasons']

export const Route = createFileRoute('/create')({
  // `occasion` arrives from the home page's tickets; it is written into the draft and then dropped from the address.
  validateSearch: (search: Record<string, unknown>): { step?: StepId; occasion?: Occasion } => {
    const step = search.step as StepId
    return { ...(STEP_IDS.includes(step) ? { step } : {}), ...(isOccasion(search.occasion) ? { occasion: search.occasion } : {}) }
  },
  head: () => ({ meta: [{ title: 'Start a film - Little Things Digital' }] }),
  component: Create,
})

const NUDGES = {
  memories: [
    'How did you two meet?',
    'Which day went wrong and turned into a good story?',
    'When did you last laugh until it hurt?',
    'Where were you the first time you thought, “this one”?',
    'Which trip, meal or journey home do you still bring up?',
  ],
  habits: [
    'What do they always say and never mean?',
    'What happens when food is involved?',
    'What are they like when they’re running late?',
    'What do they do with the duvet, the remote or your charger?',
    'What do their voice notes look like?',
  ],
  reasons: [
    'What do they notice that nobody else does?',
    'What changes when they walk into a room?',
    'What did they do for you that you never thanked them for?',
    'What do you miss first when they’re away?',
    'What are they like on your worst days?',
  ],
}

function Create() {
  const { intake: draft, setIntake, setSeed } = useDraft()
  const navigate = useNavigate()
  const { step: stepParam, occasion: asked } = Route.useSearch()
  // An occasion picked on the home page shows at once, before it is saved to the draft below.
  const intake = useMemo(() => (asked && asked !== draft.occasion ? { ...draft, occasion: asked } : draft), [draft, asked])
  const occasion = occasionOf(intake.occasion)
  // A film with its own scenes has them changed beside the film, not here: this form keeps the steps every film has.
  const outlined = Boolean(draft.outline)
  const steps = useMemo(
    () => STEPS.filter((s) => !outlined || !OLDER_STEPS.includes(s.id)).map((s) => (s.id === 'wish' ? { ...s, name: occasion.ending.step } : s)),
    [occasion, outlined],
  )
  const at = Math.max(0, steps.findIndex((s) => s.id === (stepParam ?? 'who')))
  const step = steps[at]
  const stepId: StepId = step.id

  useEffect(() => {
    if (!asked) return
    setIntake((c) => (c.occasion === asked ? c : { ...c, occasion: asked }))
    void navigate({ to: '/create', search: stepParam ? { step: stepParam } : {}, replace: true })
  }, [asked])

  const [dragging, setDragging] = useState(false)
  const [focus, setFocus] = useState<StepFocus>({ memory: 0, habit: 0, reason: 0 })
  const fileInput = useRef<HTMLInputElement>(null)
  const question = useRef<HTMLHeadingElement>(null)
  const reel = useRef<HTMLOListElement>(null)
  const qid = useId()
  const hintId = useId()

  const set = <K extends keyof Intake>(key: K, value: Intake[K]) => setIntake((c) => ({ ...c, [key]: value }))
  const status = sceneStatus(intake)
  // A film with its own scenes has no "camera roll" by that name; its photos step is ready once it has a photo.
  const scene = (type: string): SceneStatus => status.find((s) => s.type === type) ?? { type, name: 'Photos', description: '', missing: intake.photos.length ? null : 'Add a photo' }
  const readyCount = status.filter((s) => !s.missing).length
  const ready = canGenerate(intake)
  const them = intake.recipient.trim()
  const me = intake.sender.trim()

  const go = (id: StepId) => void navigate({ to: '/create', search: { step: id } })
  const build = () => {
    setSeed(newSeed())
    void navigate({ to: '/preview' })
  }

  // A new step starts at its question, for the eye and for screen readers.
  const arrived = useRef(false)
  useEffect(() => {
    if (!arrived.current) {
      arrived.current = true
      return
    }
    window.scrollTo({ top: 0 })
    question.current?.focus({ preventScroll: true })
    // Keep the current frame in view when the strip is wider than the screen.
    const strip = reel.current
    const frame = strip?.querySelector<HTMLElement>('[aria-current="step"]')
    if (strip && frame) {
      const offset = frame.getBoundingClientRect().left - strip.getBoundingClientRect().left
      strip.scrollLeft += offset - (strip.clientWidth - frame.offsetWidth) / 2
    }
  }, [stepId])

  /* ---------- photos ---------- */

  const { add: addPhotos, remove: removePhoto, removed: removedPhoto, restore: restorePhoto, forget: forgetPhoto, error: photoError, setError: setPhotoError, reading: photosReading } = usePhotos()
  /** The draft as it was before Clear or Fill with the sample replaced it, kept until the undo offer runs out. */
  const [replaced, setReplaced] = useState<{ intake: Intake; label: string } | null>(null)

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    addPhotos(Array.from(event.dataTransfer.files))
  }

  // Replacing the whole draft happens at once and can be undone, so its photos are only let go when the offer runs out.
  const replaceDraft = (next: Intake, label: string) => {
    if (replaced) releasePhotos(replaced.intake.photos)
    forgetPhoto()
    setReplaced({ intake, label })
    setIntake(() => next)
    setPhotoError('')
    setFocus({ memory: 0, habit: 0, reason: 0 })
  }
  const undoReplace = () => {
    if (!replaced) return
    releasePhotos(intake.photos)
    setIntake(() => replaced.intake)
    setReplaced(null)
  }
  const forgetReplaced = () =>
    setReplaced((was) => {
      if (was) releasePhotos(was.intake.photos)
      return null
    })

  /* ---------- memories ---------- */

  const memoryAt = Math.min(focus.memory, intake.memories.length - 1)
  const memory = intake.memories[memoryAt]
  const updateMemory = (id: string, patch: Partial<Memory>) => set('memories', intake.memories.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  /* ---------- the page for each step ---------- */

  const name = them || 'them'
  const pages: Record<StepId, { question: string; hint?: ReactNode; body: ReactNode }> = {
    who: {
      question: 'Who is this film for?',
      hint: 'Use the name you actually call them. Sign off the way you would in a message.',
      body: (
        <>
          <p className="sentence">
            <span className="clause">
              <span>For</span>
              <SentenceInput label="Their name" value={intake.recipient} onChange={(v) => set('recipient', v)} />
            </span>
            <span className="clause">
              <span>from</span>
              <SentenceInput label="Your name" value={intake.sender} onChange={(v) => set('sender', v)} autoComplete="given-name" />
            </span>
          </p>
          <fieldset className="occasion-pick">
            <legend>What’s it for?</legend>
            <div className="occasion-chips">
              {OCCASIONS.map((o) => (
                <label key={o.id} className="chip">
                  <input type="radio" name="occasion" checked={intake.occasion === o.id} onChange={() => set('occasion', o.id)} />
                  <span>{o.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="fine">This draft stays in this browser tab until you send it, and reloading clears it. Your photos are not uploaded before then. When you build the film, your names and words go to the studio’s music service so its song can be written.</p>
        </>
      ),
    },
    photos: {
      question: `Add your photos of ${name}.`,
      hint: `Up to ${LIMITS.photos}. Three or more gives you the camera roll. A caption turns a photo into a small joke or memory.`,
      body: (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            hidden
            aria-label="Add photos"
            onChange={(e) => {
              void addPhotos(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <ul className="prints">
            {intake.photos.map((photo, i) => (
              <li key={photo.id} className="print">
                <img src={photo.src} alt={`Photo ${i + 1}`} />
                <label className="print-label" htmlFor={`cap-${photo.id}`}>
                  Caption<span className="visually-hidden"> for photo {i + 1}</span>
                </label>
                <GrowingText
                  id={`cap-${photo.id}`}
                  maxLength={LIMITS.caption}
                  value={photo.caption}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  onChange={(e) => set('photos', intake.photos.map((p) => (p.id === photo.id ? { ...p, caption: oneLine(e.target.value) } : p)))}
                />
                <button type="button" className="icon-remove" onClick={() => removePhoto(photo.id)} aria-label={`Remove photo ${i + 1}`}>
                  <Cross />
                </button>
              </li>
            ))}
            {intake.photos.length < LIMITS.photos && (
              <li className={intake.photos.length ? 'print-add' : 'print-add is-empty'}>
                <button
                  type="button"
                  className={`dropzone${dragging ? ' is-over' : ''}`}
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                >
                  <b>Add photos</b>
                  <span>{intake.photos.length ? `${LIMITS.photos - intake.photos.length} more fit` : 'Choose them, or drop them here'}</span>
                </button>
              </li>
            )}
          </ul>
          {removedPhoto && (
            <UndoToast token={removedPhoto.photo.id} onUndo={restorePhoto} onDone={forgetPhoto}>
              Photo removed.
            </UndoToast>
          )}
          {photosReading > 0 && <Working className="photo-reading">Reading {photosReading === 1 ? 'a photo' : `${photosReading} photos`}…</Working>}
          {photoError && (
            <p className="field-error" role="alert">
              {photoError}
            </p>
          )}
        </>
      ),
    },
    spotlight: {
      question: them ? `What do you love about how ${them} is?` : 'What do you love about how they are?',
      hint: 'One or two sentences. The way they laugh, what they always say, what they do without noticing.',
      body: (
        <textarea
          className="big"
          rows={5}
          aria-labelledby={qid}
          aria-describedby={hintId}
          maxLength={LIMITS.spotlight}
          value={intake.spotlight}
          onChange={(e) => set('spotlight', e.target.value)}
        />
      ),
    },
    memories: {
      question: `Which moments with ${name} do you keep going back to?`,
      hint: 'One is enough; more is better. Give each a short title, then tell it the way you’d tell a friend.',
      body: memory && (
        <>
          <div className="tabs" role="group" aria-label="Memories">
            {intake.memories.map((m, i) => (
              <button key={m.id} type="button" className="tab" aria-pressed={i === memoryAt} onClick={() => setFocus((f) => ({ ...f, memory: i }))}>
                <b>Memory {i + 1}</b>
                <span>{m.title.trim() || (m.story.trim() ? 'No title yet' : 'Empty')}</span>
              </button>
            ))}
            {intake.memories.length < LIMITS.memories && (
              <button
                type="button"
                className="tab tab-add"
                onClick={() => {
                  set('memories', [...intake.memories, { id: `m-${crypto.randomUUID()}`, title: '', story: '', photoId: '' }])
                  setFocus((f) => ({ ...f, memory: intake.memories.length }))
                }}
              >
                <b>Add a memory</b>
              </button>
            )}
          </div>
          <div className="memory-card" key={memory.id}>
            <Field label="Title">
              {(id) => (
                <input
                  id={id}
                  maxLength={LIMITS.memoryTitle}
                  value={memory.title}
                  onChange={(e) => updateMemory(memory.id, { title: e.target.value })}
                />
              )}
            </Field>
            <Field label="What happened">
              {(id) => (
                <textarea id={id} rows={4} maxLength={LIMITS.memoryStory} value={memory.story} onChange={(e) => updateMemory(memory.id, { story: e.target.value })} />
              )}
            </Field>
            {intake.photos.length > 0 && (
              <fieldset className="photo-pick">
                <legend>Photo for this memory</legend>
                <div className="photo-pick-row">
                  <label className="pick pick-auto">
                    <input type="radio" name={`photo-${memory.id}`} checked={!memory.photoId} onChange={() => updateMemory(memory.id, { photoId: '' })} />
                    <span>Let the studio choose</span>
                  </label>
                  {intake.photos.map((p, n) => (
                    <label key={p.id} className="pick">
                      <input type="radio" name={`photo-${memory.id}`} checked={memory.photoId === p.id} onChange={() => updateMemory(memory.id, { photoId: p.id })} />
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
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  set('memories', intake.memories.filter((m) => m.id !== memory.id))
                  setFocus((f) => ({ ...f, memory: Math.max(0, memoryAt - 1) }))
                }}
              >
                Remove memory
              </button>
            )}
          </div>
          <Nudge prompts={NUDGES.memories} />
        </>
      ),
    },
    habits: {
      question: them ? `What does ${them} do that deserves a red flag?` : 'What do they do that deserves a red flag?',
      hint: 'Their funniest habits, presented as very serious red flags. Two or more.',
      body: (
        <>
          <ListEditor
            label="Habit"
            values={intake.habits}
            max={LIMITS.habits}
            onChange={(v) => set('habits', v)}
            onActive={(i) => setFocus((f) => ({ ...f, habit: i }))}
          />
          <Nudge prompts={NUDGES.habits} />
        </>
      ),
    },
    reasons: {
      question: occasion.reasons?.question(them) ?? (them ? `Why ${them}?` : 'Why them?'),
      hint: occasion.reasons?.hint ?? 'The reasons you love them, shown one at a time. Two or more. Small and specific beats big and general.',
      body: (
        <>
          <ListEditor
            label="Reason"
            values={intake.reasons}
            max={LIMITS.reasons}
            onChange={(v) => set('reasons', v)}
            onActive={(i) => setFocus((f) => ({ ...f, reason: i }))}
          />
          <Nudge prompts={NUDGES.reasons} />
        </>
      ),
    },
    letter: {
      question: `Is there something you want to tell ${name} properly?`,
      hint: 'Optional. A few sentences is plenty. Leave a blank line between paragraphs.',
      body: (
        <>
          <textarea
            className="big letter-pad"
            rows={10}
            aria-labelledby={qid}
            aria-describedby={hintId}
            maxLength={LIMITS.letter}
            value={intake.letter}
            onChange={(e) => set('letter', e.target.value)}
          />
          <p className="fine count">{wordCount(intake.letter)}</p>
        </>
      ),
    },
    wish: {
      question: occasion.ending.question(them),
      hint:
        me && them
          ? `Your last line. Leave it empty and it will say “${occasion.ending.fallback.replaceAll('{r}', them).replaceAll('{s}', me)}”`
          : `Your last line, shown once ${occasion.ending.shown}.`,
      body: (
        <textarea className="big" rows={4} aria-labelledby={qid} aria-describedby={hintId} maxLength={LIMITS.wish} value={intake.wish} onChange={(e) => set('wish', e.target.value)} />
      ),
    },
    look: {
      question: 'Choose how it looks.',
      hint: 'You can change this again after you’ve watched it.',
      body: (
        <>
          <div className="look-cards" role="radiogroup" aria-labelledby={qid}>
            {LOOKS.map((look) => (
              <label key={look.id} className="look-card">
                <input type="radio" name="look" value={look.id} checked={intake.look === look.id} onChange={() => set('look', look.id)} />
                <span className="look-still">
                  <Still {...previewFor('look', intake, focus, look.id)} />
                </span>
                <b>{look.name}</b>
              </label>
            ))}
            <label className="look-card look-any">
              <input type="radio" name="look" value="surprise" checked={intake.look === 'surprise'} onChange={() => set('look', 'surprise')} />
              <span className="look-still" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <b>Surprise me</b>
            </label>
          </div>
          <div className="rundown">
            <h2>What’s in the film</h2>
            <ul>
              {status.map((s) => {
                const home = steps.find((x) => x.scenes.includes(s.type))
                return (
                  <li key={s.type} className={s.missing ? 'is-out' : 'is-in'}>
                    <b>{s.name}</b>
                    {s.missing ? (
                      <span>
                        Left out. {s.missing}.{' '}
                        {home && (
                          <button type="button" className="text-button" onClick={() => go(home.id)}>
                            Go to {home.name.toLowerCase()}
                          </button>
                        )}
                      </span>
                    ) : (
                      <span>{s.description}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      ),
    },
  }

  const page = pages[stepId]
  const preview = previewFor(stepId, intake, { ...focus, memory: memoryAt })
  const waiting = step.scenes.map(scene).find((s) => s.missing)
  const sceneNames = step.scenes.map((t) => scene(t).name)
  const sceneLine = !step.scenes.length
    ? intake.look === 'surprise'
      ? 'Surprise me picks one of the three looks when you build.'
      : `${LOOKS.find((l) => l.id === previewLook(intake))?.name} look.`
    : waiting
      ? `Not in the film yet: ${waiting.name}. ${waiting.missing}.`
      : `In the film: ${sceneNames.join(' and ')}.`
  const next = steps[at + 1]
  const last = !next

  return (
    <>
      <StudioHeader>
        <button type="button" className="button small ghost" onClick={() => replaceDraft({ ...structuredClone(SAMPLE_FIXED), occasion: intake.occasion }, 'Filled with the sample.')}>
          Fill with the sample
        </button>
        <button type="button" className="button small ghost" onClick={() => replaceDraft({ ...emptyIntake(), occasion: intake.occasion }, 'Draft cleared.')}>
          Clear
        </button>
      </StudioHeader>
      {replaced ? (
        <UndoToast floating token={replaced} onUndo={undoReplace} onDone={forgetReplaced} seconds={12}>
          {replaced.label}
        </UndoToast>
      ) : null}
      <main className="writer">
        <nav className="reel" aria-label="Steps">
          <ol ref={reel}>
            {steps.map((s, i) => {
              const done = s.scenes.length > 0 && s.scenes.every((t) => !scene(t).missing)
              return (
                <li key={s.id}>
                  <button type="button" className={`frame${done ? ' is-ready' : ''}`} aria-current={s.id === stepId ? 'step' : undefined} onClick={() => go(s.id)}>
                    <span className="frame-n" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="frame-name">{s.name}</span>
                    {done && <span className="visually-hidden">(ready)</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
        <div className="reel-end">
          <span className="reel-count" aria-live="polite">
            {readyCount} of {status.length} scenes ready
          </span>
          {!last && (
            <button type="button" className="button small ghost" disabled={!ready} onClick={build} title={ready ? undefined : 'Add your name and theirs first'}>
              Build the story
            </button>
          )}
        </div>

        <div className="writer-body">
          <form
            className="page"
            onSubmit={(e) => {
              e.preventDefault()
              if (next) go(next.id)
              else if (ready) build()
            }}
          >
            <div className="page-in" key={stepId}>
              <h1 id={qid} ref={question} tabIndex={-1} className="question">
                {page.question}
              </h1>
              {page.hint && (
                <p id={hintId} className="question-hint">
                  {page.hint}
                </p>
              )}
              {page.body}
            </div>
            <div className="page-nav">
              {at > 0 ? (
                <button type="button" className="button ghost" onClick={() => go(steps[at - 1].id)}>
                  Back
                </button>
              ) : (
                <span />
              )}
              {last && !ready && (
                <button type="button" className="text-button" onClick={() => go('who')}>
                  Add your name and theirs to build
                </button>
              )}
              <button type="submit" className="button primary" disabled={last && !ready} aria-label={next ? `Next: ${next.name.toLowerCase()}` : undefined}>
                {next ? (
                  <>
                    Next<span className="next-name">: {next.name.toLowerCase()}</span>
                  </>
                ) : (
                  'Build the story'
                )}
              </button>
            </div>
          </form>

          <aside className="projection" aria-label="How this scene looks">
            <div className="projection-screen">
              <Still {...preview} />
            </div>
            <p className={`scene-line${step.scenes.length && !waiting ? ' is-ready' : ''}`} aria-live="polite">
              {sceneLine}
            </p>
            <p className="fine">{preview.ghost ? 'Your words appear here as you type.' : 'A still from this scene. The film adds the motion and the music.'}</p>
          </aside>
        </div>
      </main>
    </>
  )
}

function wordCount(text: string) {
  const n = text.trim() ? text.trim().split(/\s+/).length : 0
  return n === 0 ? 'Nothing yet. Skip it and the film leaves the letter out.' : `${n} word${n === 1 ? '' : 's'}`
}

/** A name written into the sentence; it grows with what is typed. */
function SentenceInput({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete?: string }) {
  return (
    <input
      className="blank"
      aria-label={label}
      value={value}
      required
      maxLength={LIMITS.name}
      autoComplete={autoComplete ?? 'off'}
      autoCapitalize="words"
      // An empty blank is still a line long enough to read as somewhere to write.
      style={{ width: `${Math.max(value.length, 8) * 0.52 + 0.7}em` }}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** One question at a time to get the sender unstuck. It asks; it never writes for them. */
function Nudge({ prompts }: { prompts: string[] }) {
  const [n, setN] = useState(0)
  return (
    <p className="nudge">
      <span>Stuck? Ask yourself:</span>
      <em>{prompts[n % prompts.length]}</em>
      <button type="button" className="text-button" onClick={() => setN(n + 1)}>
        Another question
      </button>
    </p>
  )
}
