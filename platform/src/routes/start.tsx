import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useDraft } from '../components/draft'
import { usePhotos } from '../components/photos'
import { canGenerate } from '../story/generate'
import { applyNotes, keepTheirWords, NOTES_LIMIT, sortLocally } from '../story/notes'
import { occasionOf, OCCASIONS } from '../story/occasions'
import { RELATIONSHIPS } from '../story/relationships'
import { newSeed } from '../story/rng'
import { isOccasion } from '../story/types'
import type { Occasion } from '../story/types'
import { LIMITS } from '../story/validate'
import { vibeById, VIBES, VOICES } from '../story/vibes'

/**
 * The short way to make a film: three taps, two names, some photos and one
 * box of the sender's own words. The studio sorts the words into scenes and
 * the film plays at the end; everything else can be added from the preview.
 */

type StepId = 'who' | 'names' | 'occasion' | 'photos' | 'about' | 'song'
const ALL: StepId[] = ['who', 'names', 'occasion', 'photos', 'about', 'song']
const ENOUGH = 30

export const Route = createFileRoute('/start')({
  // `occasion` arrives from the home page's tickets; it is written into the draft and then dropped from the address.
  validateSearch: (search: Record<string, unknown>): { step?: StepId; occasion?: Occasion } => {
    const step = search.step as StepId
    return { ...(ALL.includes(step) ? { step } : {}), ...(isOccasion(search.occasion) ? { occasion: search.occasion } : {}) }
  },
  head: () => ({ meta: [{ title: 'Start a film - Little Things Digital' }] }),
  component: Start,
})

function Start() {
  const { intake, setIntake, setSeed, about, setAbout, sortedFrom, setSortedFrom, occasionGiven, setOccasionGiven, plan, setPlan, startSong } = useDraft()
  const navigate = useNavigate()
  const { step: stepParam, occasion: asked } = Route.useSearch()
  const photos = usePhotos()
  const fileInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  // Songs need the studio's music service; without it the step is left out.
  const [songs, setSongs] = useState<boolean | null>(null)
  const [busy, setBusy] = useState('')
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/music')
      .then((r) => r.json() as Promise<{ provider: string; lyrics: boolean }>)
      .then((s) => live && setSongs(s.provider !== 'off' && s.lyrics))
      .catch(() => live && setSongs(false))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!asked) return
    setIntake((c) => (c.occasion === asked ? c : { ...c, occasion: asked }))
    setOccasionGiven(true)
    void navigate({ to: '/start', search: stepParam ? { step: stepParam } : {}, replace: true })
  }, [asked])

  const skipOccasion = occasionGiven || Boolean(asked)
  const steps = useMemo(() => ALL.filter((s) => !(s === 'occasion' && skipOccasion) && !(s === 'song' && songs === false)), [skipOccasion, songs])
  const stepId: StepId = stepParam && steps.includes(stepParam) ? stepParam : steps[0]
  const at = steps.indexOf(stepId)
  const last = at === steps.length - 1
  const them = intake.recipient.trim()
  const me = intake.sender.trim()
  const name = them || 'them'

  const go = (id: StepId) => void navigate({ to: '/start', search: { step: id } })
  const next = () => go(steps[Math.min(at + 1, steps.length - 1)])

  // A new step starts at its question, for the eye and for screen readers.
  const arrived = useRef(false)
  useEffect(() => {
    if (!arrived.current) {
      arrived.current = true
      return
    }
    window.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [stepId])

  /** Sort the sender's words into scenes, build the film, and start the song behind it. */
  const finish = async (withSong: boolean) => {
    if (!canGenerate(intake)) return go('names')
    let draft = intake
    const text = about.trim()
    if (text && text !== sortedFrom) {
      setBusy(`Sorting your words into ${name}’s scenes…`)
      let notes
      try {
        const response = await fetch('/api/sort', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, sender: me, recipient: them }) })
        const body = (await response.json()) as { notes?: unknown }
        if (!response.ok || !body.notes) throw new Error('sort failed')
        // Checked again here: only the sender's own words go into the film.
        notes = keepTheirWords(body.notes, text)
      } catch {
        notes = sortLocally(text)
      }
      draft = applyNotes(intake, notes)
      setIntake(() => draft)
      setSortedFrom(text)
    }
    setSeed(newSeed())
    // If the check for the music service hasn't answered yet, try anyway: a song that can't be made says so on the preview.
    if (withSong && songs !== false) startSong(draft, plan)
    await navigate({ to: '/preview' })
  }

  const pages: Record<StepId, { question: string; hint?: ReactNode; body: ReactNode; canNext: boolean; nextLabel?: string }> = {
    who: {
      question: 'Who is it for?',
      hint: 'Pick one. A few taps and a few sentences, and their film plays at the end.',
      canNext: Boolean(intake.relationship),
      body: (
        <div className="pills" role="group" aria-label="Who is it for?">
          {RELATIONSHIPS.map((r) => (
            <button
              key={r.id}
              type="button"
              className="pill"
              aria-pressed={intake.relationship === r.id}
              onClick={() => {
                setIntake((c) => ({ ...c, relationship: r.id }))
                next()
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      ),
    },
    names: {
      question: 'What do you call each other?',
      hint: 'The names go on the ticket and in the credits. Use the ones you’d really say.',
      canNext: Boolean(them && me),
      body: (
        <div className="start-fields">
          <label>
            <span>Their name</span>
            <input value={intake.recipient} maxLength={LIMITS.name} placeholder={intake.relationship === 'mother' ? 'Mum' : intake.relationship === 'father' ? 'Dad' : 'Their first name'} onChange={(e) => setIntake((c) => ({ ...c, recipient: e.target.value }))} />
          </label>
          <label>
            <span>Your name</span>
            <input value={intake.sender} maxLength={LIMITS.name} placeholder="How you’d sign a card" autoComplete="given-name" onChange={(e) => setIntake((c) => ({ ...c, sender: e.target.value }))} />
          </label>
        </div>
      ),
    },
    occasion: {
      question: 'What’s the occasion?',
      hint: 'The ticket, the opening and the ending are written for it.',
      canNext: true,
      body: (
        <div className="pills" role="group" aria-label="Occasion">
          {OCCASIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className="pill"
              aria-pressed={intake.occasion === o.id}
              onClick={() => {
                setIntake((c) => ({ ...c, occasion: o.id }))
                next()
              }}
            >
              {o.name}
            </button>
          ))}
        </div>
      ),
    },
    photos: {
      question: `Add a few photos of ${name}.`,
      hint: 'Three or more is best. They stay on this device until you send the film, and you can caption them later.',
      canNext: true,
      nextLabel: intake.photos.length ? undefined : 'Skip photos',
      body: (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            aria-label="Add photos"
            onChange={(e) => {
              photos.add(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <ul className="start-photos">
            {intake.photos.map((photo, i) => (
              <li key={photo.id}>
                <img src={photo.src} alt={`Photo ${i + 1}`} />
                <button type="button" onClick={() => photos.remove(photo.id)} aria-label={`Remove photo ${i + 1}`}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
            {photos.room > 0 && (
              <li className={intake.photos.length ? 'start-add' : 'start-add is-empty'}>
                <button
                  type="button"
                  className={dragging ? 'is-over' : undefined}
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    photos.add(Array.from(e.dataTransfer.files))
                  }}
                >
                  <b>{intake.photos.length ? 'Add more' : 'Add photos'}</b>
                  <span>{intake.photos.length ? `${photos.room} more fit` : 'Choose them, or drop them here'}</span>
                </button>
              </li>
            )}
          </ul>
          {photos.error && (
            <p className="field-error" role="alert">
              {photos.error}
            </p>
          )}
        </>
      ),
    },
    about: {
      question: `Tell us about ${name}.`,
      hint: 'A few sentences in your own words. We sort them into the film’s scenes; nothing is added.',
      canNext: about.trim().length >= ENOUGH,
      body: (
        <>
          <ul className="start-prompts" aria-label="Things you could write about">
            <li>A moment you keep going back to</li>
            <li>Something they always do</li>
            <li>Why it’s them</li>
          </ul>
          <textarea className="start-about" rows={7} aria-label={`About ${name}`} maxLength={NOTES_LIMIT} value={about} onChange={(e) => setAbout(e.target.value)} />
          <p className="fine start-count" aria-live="polite">
            {about.trim().length === 0
              ? 'The more specific, the better the film.'
              : about.trim().length < ENOUGH
                ? 'A sentence or two more and there’s enough for a film.'
                : 'That’s enough for a film. Add more if it comes to you.'}
          </p>
          <p className="fine">Your words are sorted into scenes by one of Google’s AI models. It only moves your words; it doesn’t write any.</p>
        </>
      ),
    },
    song: {
      question: `Pick the sound of ${name}’s song.`,
      hint: 'We write a song about them from what you wrote, and it plays with the film. It takes about a minute to arrive.',
      canNext: true,
      body: (
        <>
          <fieldset className="start-choice">
            <legend>Style</legend>
            <div className="pills">
              <button type="button" className="pill" aria-pressed={plan.vibe === 'surprise'} onClick={() => setPlan({ ...plan, vibe: 'surprise' })}>
                Surprise me
              </button>
              {VIBES.map((v) => (
                <button key={v.id} type="button" className="pill" aria-pressed={plan.vibe === v.id} onClick={() => setPlan({ ...plan, vibe: v.id })}>
                  {v.name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="start-choice">
            <legend>Voice</legend>
            <div className="pills">
              {VOICES.map((v) => (
                <button key={v.id} type="button" className="pill" aria-pressed={plan.voice === v.id} onClick={() => setPlan({ ...plan, voice: v.id })}>
                  {v.name}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="fine">
            The song is written and sung by Google’s AI models, from the names and what you wrote about {name}. Your photos are never sent to them.
          </p>
        </>
      ),
    },
  }

  const page = pages[stepId]
  const working = Boolean(busy)
  // The counter shows the film's ticket being made out, and what has been handed over so far.
  const occasionKnown = skipOccasion || at > steps.indexOf('occasion')
  const note = about.trim()
  const songKnown = stepId === 'song' && songs !== false
  const songLine = [plan.vibe === 'surprise' ? 'The studio’s choice' : vibeById(plan.vibe)?.name, plan.voice === 'surprise' ? null : VOICES.find((v) => v.id === plan.voice)?.name.toLowerCase()].filter(Boolean).join(', ')
  return (
    <div className="start-shell">
      <aside className="start-counter" aria-label="The film so far">
        <Link to="/" className="wordmark" aria-label="Little Things Digital, home">
          little things <span>digital</span>
        </Link>
        <div className="maker">
          <div className="maker-ticket">
            <span className="maker-body">
              <span className="maker-label">A very private screening</span>
              <span className="maker-admit">Admit one</span>
              <span key={them ? 'named' : 'blank'} className={`maker-name${them ? '' : ' is-blank'}`}>
                {them || 'their name'}
              </span>
              <span className="maker-foot">
                <span key={me ? 'signed' : 'unsigned'} className={me ? undefined : 'is-blank'}>
                  {me ? `From ${me}` : 'From you'}
                </span>
                {occasionKnown && <span className="maker-occasion">{occasionOf(intake.occasion).ticket}</span>}
              </span>
            </span>
            <span className="maker-stub">
              <span className="start-step">
                Step {at + 1} of {steps.length}
              </span>
            </span>
          </div>
          {(intake.photos.length > 0 || note || songKnown) && (
            <ul className="gathered" aria-hidden="true">
              {intake.photos.length > 0 && (
                <li className="gathered-prints">
                  {intake.photos.slice(0, 5).map((photo) => (
                    <img key={photo.id} src={photo.src} alt="" />
                  ))}
                  {intake.photos.length > 5 && <b>+{intake.photos.length - 5}</b>}
                </li>
              )}
              {note && <li className="gathered-note">“{note.length > 120 ? `${note.slice(0, 120).trimEnd()}…` : note}”</li>}
              {songKnown && <li className="gathered-song">{songLine}</li>}
            </ul>
          )}
        </div>
      </aside>
      <main className="start-main">
        <div className="start-bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={at + 1} aria-label="Progress">
          <i style={{ width: `${((at + 1) / steps.length) * 100}%` }} />
        </div>
        <form
          className="start-page"
          key={stepId}
          onSubmit={(e) => {
            e.preventDefault()
            if (working || !page.canNext) return
            if (last) void finish(stepId === 'song')
            else next()
          }}
        >
          <h1 ref={heading} tabIndex={-1}>
            {page.question}
          </h1>
          {page.hint && <p className="start-hint">{page.hint}</p>}
          {page.body}
          <div className="start-nav">
            {at > 0 ? (
              <button type="button" className="button ghost" disabled={working} onClick={() => go(steps[at - 1])}>
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="button primary" disabled={working || !page.canNext}>
              {working ? 'Making the film…' : last ? 'Make the film' : (page.nextLabel ?? 'Next')}
            </button>
          </div>
          {last && stepId === 'song' && !working && (
            <button type="button" className="text-button start-skip" onClick={() => void finish(false)}>
              Skip the song and use the studio’s own music
            </button>
          )}
          {busy && (
            <p className="fine start-busy" role="status">
              {busy}
            </p>
          )}
        </form>
        {stepId === 'who' && (
          <p className="start-other">
            Prefer to write every scene yourself? <Link to="/create">Use the detailed form.</Link>
          </p>
        )}
      </main>
    </div>
  )
}
