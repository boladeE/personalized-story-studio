import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useId, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { StudioHeader } from '../components/StudioHeader'
import { useDraft } from '../components/draft'
import { canGenerate, LOOKS, sceneStatus } from '../story/generate'
import { newSeed } from '../story/rng'
import { emptyIntake, SAMPLE_INTAKE } from '../story/sample'
import type { Intake, LookId, Memory } from '../story/types'

export const Route = createFileRoute('/create')({
  head: () => ({ meta: [{ title: 'Start a birthday story - Little Things Digital' }] }),
  component: Create,
})

const MAX_PHOTOS = 12
const MAX_PHOTO_BYTES = 15 * 1024 * 1024

function Create() {
  const { intake, setIntake, setSeed } = useDraft()
  const navigate = useNavigate()
  const [photoError, setPhotoError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Intake>(key: K, value: Intake[K]) => setIntake((c) => ({ ...c, [key]: value }))
  const status = sceneStatus(intake)
  const ready = canGenerate(intake)

  const releasePhotos = (photos: Intake['photos']) =>
    photos.forEach((p) => p.src.startsWith('blob:') && URL.revokeObjectURL(p.src))

  const addPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const room = MAX_PHOTOS - intake.photos.length
    const images = files.filter((f) => f.type.startsWith('image/') && f.size <= MAX_PHOTO_BYTES)
    const skipped = files.length - images.length
    const accepted = images.slice(0, Math.max(0, room))
    const problems = [
      skipped && `${skipped} file${skipped === 1 ? ' was' : 's were'} skipped (images up to 15 MB only).`,
      images.length > accepted.length && `Only ${MAX_PHOTOS} photos fit in one story.`,
    ].filter(Boolean)
    setPhotoError(problems.join(' '))
    if (!accepted.length) return
    setIntake((c) => ({
      ...c,
      photos: [
        ...c.photos,
        ...accepted.map((file) => ({ id: `p-${crypto.randomUUID()}`, src: URL.createObjectURL(file), caption: '' })),
      ],
    }))
  }

  const removePhoto = (id: string) => {
    setIntake((c) => {
      releasePhotos(c.photos.filter((p) => p.id === id))
      return {
        ...c,
        photos: c.photos.filter((p) => p.id !== id),
        memories: c.memories.map((m) => (m.photoId === id ? { ...m, photoId: '' } : m)),
      }
    })
  }

  const updateMemory = (id: string, patch: Partial<Memory>) =>
    set('memories', intake.memories.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  const build = () => {
    setSeed(newSeed())
    void navigate({ to: '/preview' })
  }

  return (
    <>
      <StudioHeader>
        <button
          type="button"
          className="button small ghost"
          onClick={() => {
            releasePhotos(intake.photos)
            setIntake(() => structuredClone(SAMPLE_INTAKE))
            setPhotoError('')
          }}
        >
          Fill with the sample
        </button>
        <button
          type="button"
          className="button small ghost"
          onClick={() => {
            releasePhotos(intake.photos)
            setIntake(emptyIntake)
            setPhotoError('')
          }}
        >
          Clear
        </button>
      </StudioHeader>
      <main className="studio-page create">
        <form
          className="intake"
          onSubmit={(e) => {
            e.preventDefault()
            if (ready) build()
          }}
        >
          <div className="intake-intro">
            <h1 className="studio-title">A birthday story</h1>
            <p className="lede">
              Fill in what you have. You don’t need to write anything polished: short, specific and true works best.
            </p>
            <p className="fine">This draft stays in this browser tab until you send it. Nothing is uploaded before then, and reloading clears it.</p>
          </div>

          <Section title="Who it’s for">
            <div className="two">
              <Field label="Your name" hint="How they’d sign off a message from you">
                {(id) => <input id={id} value={intake.sender} onChange={(e) => set('sender', e.target.value)} autoComplete="given-name" required />}
              </Field>
              <Field label="Their name" hint="Or the nickname you actually use">
                {(id) => <input id={id} value={intake.recipient} onChange={(e) => set('recipient', e.target.value)} required />}
              </Field>
            </div>
          </Section>

          <Section title="Photos" hint={`Up to ${MAX_PHOTOS}. A caption turns a photo into a small joke or memory.`}>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={addPhotos} aria-label="Add photos" />
            <ul className="photo-grid">
              {intake.photos.map((photo, i) => (
                <li key={photo.id} className="photo-tile">
                  <img src={photo.src} alt={`Photo ${i + 1}`} />
                  <label className="visually-hidden" htmlFor={`cap-${photo.id}`}>
                    Caption for photo {i + 1}
                  </label>
                  <input
                    id={`cap-${photo.id}`}
                    placeholder="Caption (optional)"
                    value={photo.caption}
                    onChange={(e) =>
                      set('photos', intake.photos.map((p) => (p.id === photo.id ? { ...p, caption: e.target.value } : p)))
                    }
                  />
                  <button type="button" className="remove" onClick={() => removePhoto(photo.id)} aria-label={`Remove photo ${i + 1}`}>
                    Remove
                  </button>
                </li>
              ))}
              {intake.photos.length < MAX_PHOTOS && (
                <li>
                  <button type="button" className="add-photos" onClick={() => fileInput.current?.click()}>
                    Add photos
                  </button>
                </li>
              )}
            </ul>
            {photoError && (
              <p className="field-error" role="alert">
                {photoError}
              </p>
            )}
          </Section>

          <Section title="The main character">
            <Field label="What do you love about how they are?" hint="One or two sentences. The way they laugh, what they always say.">
              {(id) => <textarea id={id} rows={3} value={intake.spotlight} onChange={(e) => set('spotlight', e.target.value)} />}
            </Field>
          </Section>

          <Section title="Memories" hint="Give each one a short title, like you’d tell it to a friend.">
            {intake.memories.map((memory, i) => (
              <fieldset key={memory.id} className="memory">
                <legend>Memory {i + 1}</legend>
                <Field label="Title">
                  {(id) => (
                    <input id={id} placeholder="The night you called me a cheat" value={memory.title} onChange={(e) => updateMemory(memory.id, { title: e.target.value })} />
                  )}
                </Field>
                <Field label="What happened">
                  {(id) => <textarea id={id} rows={3} value={memory.story} onChange={(e) => updateMemory(memory.id, { story: e.target.value })} />}
                </Field>
                <div className="memory-row">
                  <Field label="Photo">
                    {(id) => (
                      <select id={id} value={memory.photoId} onChange={(e) => updateMemory(memory.id, { photoId: e.target.value })}>
                        <option value="">Let the studio choose</option>
                        {intake.photos.map((p, n) => (
                          <option key={p.id} value={p.id}>
                            Photo {n + 1}
                            {p.caption ? `: ${p.caption}` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  {intake.memories.length > 1 && (
                    <button type="button" className="text-button" onClick={() => set('memories', intake.memories.filter((m) => m.id !== memory.id))}>
                      Remove memory
                    </button>
                  )}
                </div>
              </fieldset>
            ))}
            {intake.memories.length < 5 && (
              <button
                type="button"
                className="text-button"
                onClick={() => set('memories', [...intake.memories, { id: `m-${crypto.randomUUID()}`, title: '', story: '', photoId: '' }])}
              >
                Add a memory
              </button>
            )}
          </Section>

          <Section title="Their funniest habits" hint="These become the red flags. Three or more.">
            <ListEditor label="Habit" values={intake.habits} max={7} placeholder="Says “I’m not hungry,” then eats my chips" onChange={(v) => set('habits', v)} />
          </Section>

          <Section title="Reasons you love them" hint="Three or more. Small and specific beats big and general.">
            <ListEditor label="Reason" values={intake.reasons} max={10} placeholder="You remember the things I mention once" onChange={(v) => set('reasons', v)} />
          </Section>

          <Section title="A letter" hint="Optional. Leave a blank line between paragraphs.">
            <Field label="Your letter">
              {(id) => <textarea id={id} rows={7} value={intake.letter} onChange={(e) => set('letter', e.target.value)} />}
            </Field>
          </Section>

          <Section title="The last line" hint="What they see after blowing out the candle.">
            <Field label="Your birthday wish for them">
              {(id) => <textarea id={id} rows={2} value={intake.wish} onChange={(e) => set('wish', e.target.value)} />}
            </Field>
          </Section>

          <Section title="Look">
            <div className="looks" role="radiogroup" aria-label="Look">
              {[{ id: 'surprise' as const, name: 'Surprise me' }, ...LOOKS].map((look) => (
                <label key={look.id} className="look-option" data-look={look.id}>
                  <input type="radio" name="look" value={look.id} checked={intake.look === look.id} onChange={() => set('look', look.id as LookId | 'surprise')} />
                  <span className="swatch" aria-hidden="true" />
                  {look.name}
                </label>
              ))}
            </div>
          </Section>
          <div className="mobile-build">
            <span aria-hidden="true">
              {status.filter((s) => !s.missing).length} of {status.length} scenes ready
            </span>
            <button type="submit" className="button primary small" disabled={!ready}>
              Build the story
            </button>
          </div>
        </form>

        <aside className="storyboard" aria-labelledby="storyboard-title">
          <h2 id="storyboard-title">Your story so far</h2>
          <ol className="storyboard-list">
            {status.map((scene) => (
              <li key={scene.type} className={scene.missing ? 'is-waiting' : 'is-ready'}>
                <span className="sb-name">{scene.name}</span>
                <span className="sb-state">{scene.missing ? scene.missing : scene.description}</span>
              </li>
            ))}
          </ol>
          <p className="sb-count" aria-live="polite">
            {status.filter((s) => !s.missing).length} of {status.length} scenes ready
          </p>
          <button type="button" className="button primary block" disabled={!ready} onClick={build}>
            Build the story
          </button>
          {!ready && <p className="fine">Add your name and theirs to build.</p>}
        </aside>
      </main>
    </>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className="intake-section" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id}>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <span className="hint">{hint}</span>}
      {children(id)}
    </div>
  )
}

function ListEditor({
  label,
  values,
  max,
  placeholder,
  onChange,
}: {
  label: string
  values: string[]
  max: number
  placeholder: string
  onChange: (values: string[]) => void
}) {
  return (
    <div className="list-editor">
      {values.map((value, i) => (
        <div key={i} className="list-row">
          <label className="visually-hidden" htmlFor={`${label}-${i}`}>
            {label} {i + 1}
          </label>
          <input
            id={`${label}-${i}`}
            value={value}
            placeholder={i === 0 ? placeholder : ''}
            onChange={(e) => onChange(values.map((v, n) => (n === i ? e.target.value : v)))}
          />
          {values.length > 1 && (
            <button type="button" className="remove" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(values.filter((_, n) => n !== i))}>
              Remove
            </button>
          )}
        </div>
      ))}
      {values.length < max && (
        <button type="button" className="text-button" onClick={() => onChange([...values, ''])}>
          Add another
        </button>
      )}
    </div>
  )
}
