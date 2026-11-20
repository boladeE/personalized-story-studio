import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useDraft } from '../components/draft'
import { UndoToast } from '../components/UndoToast'
import { Working } from '../components/Working'
import { usePhotos } from '../components/photos'
import { cleanDirection, directLocally, DIRECTED_WORLDS } from '../story/direction'
import type { DirectionPlan } from '../story/direction'
import { cleanAnswers, cleanFollowups, FOLLOWUP_LIMITS, followupsLocally, withAnswers } from '../story/followups'
import { canGenerate, LOOKS } from '../story/generate'
import { closeToTheirWords, NOTES_LIMIT } from '../story/notes'
import { cleanOutline, notesOf, outlineByWords } from '../story/outline'
import { OCCASIONS, occasionFor, occasionOf } from '../story/occasions'
import { RELATIONSHIPS } from '../story/relationships'
import { newSeed } from '../story/rng'
import { isOccasion } from '../story/types'
import type { Chapter, Occasion, Photo } from '../story/types'
import { LIMITS } from '../story/validate'
import { vibeById, VIBES, VOICES } from '../story/vibes'

/**
 * The short way to make a film: three taps, two names, some photos and one
 * box of the sender's own words. The studio reads the words and asks up to
 * three short questions about them, writes the film's own scenes from them, directs the
 * film and plays it at the end; everything else can be added from the preview.
 */

type StepId = 'who' | 'names' | 'occasion' | 'photos' | 'about' | 'more' | 'song'
const ALL: StepId[] = ['who', 'names', 'occasion', 'photos', 'about', 'more', 'song']
const ENOUGH = 30

/**
 * Small copies of the photos, for the director to place each scene beside the one that shows it.
 * They are sent with the note when the film is made, and not kept in the studio's request log.
 */
async function photoPeeks(photos: Photo[]): Promise<Array<{ id: string; jpeg: string }>> {
  const peeks: Array<{ id: string; jpeg: string }> = []
  for (const photo of photos) {
    try {
      const bitmap = await createImageBitmap(await (await fetch(photo.src)).blob())
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      const jpeg = canvas.toDataURL('image/jpeg', 0.7).split(',')[1] ?? ''
      if (jpeg) peeks.push({ id: photo.id, jpeg })
    } catch {
      // A photo that can't be read here is simply placed blind.
    }
  }
  return peeks
}

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
  const { intake, setIntake, setSeed, about, setAbout, sortedFrom, setSortedFrom, followups, setFollowups, occasionGiven, setOccasionGiven, plan, setPlan, startSong, songs } = useDraft()
  const navigate = useNavigate()
  const { step: stepParam, occasion: asked } = Route.useSearch()
  const photos = usePhotos()
  const fileInput = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState('')
  const [dragging, setDragging] = useState(false)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!asked) return
    setIntake((c) => (c.occasion === asked ? c : { ...c, occasion: asked }))
    setOccasionGiven(true)
    void navigate({ to: '/start', search: stepParam ? { step: stepParam } : {}, replace: true })
  }, [asked])

  const skipOccasion = occasionGiven || Boolean(asked)
  const noteText = about.trim()
  // A note the studio has nothing to ask about has no step for questions (unless the sender is standing on it).
  const nothingToAsk = followups?.about === noteText && followups.asked.length === 0 && stepParam !== 'more'
  const steps = useMemo(
    () => ALL.filter((s) => !(s === 'occasion' && skipOccasion) && !(s === 'song' && songs === false) && !(s === 'more' && nothingToAsk)),
    [skipOccasion, songs, nothingToAsk],
  )
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

  // Arriving at the questions: the studio reads the note and asks about it. A note with nothing to ask about moves straight on.
  useEffect(() => {
    if (stepId !== 'more') return
    const onward = () => void navigate({ to: '/start', search: { step: steps[at + 1] ?? 'about' }, replace: true })
    if (noteText.length < ENOUGH) return void navigate({ to: '/start', search: { step: 'about' }, replace: true })
    if (followups?.about === noteText) {
      if (!followups.asked.length) onward()
      return
    }
    let live = true
    setAsking(true)
    fetch('/api/followups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: noteText, sender: me, recipient: them }) })
      .then(async (response) => {
        const body = (await response.json()) as { questions?: unknown }
        if (!response.ok) throw new Error('no questions')
        // Checked again here: every question must hang on words the sender wrote.
        return cleanFollowups(body.questions, noteText)
      })
      .catch(() => followupsLocally(noteText, them))
      .then((questions) => {
        if (!live) return
        setFollowups({ about: noteText, asked: questions.map((q) => ({ ...q, answer: '' })) })
        setAsking(false)
      })
    return () => {
      live = false
      setAsking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, noteText, followups?.about])
  const questions = followups?.about === noteText ? followups.asked : []
  const answer = (index: number, value: string) => followups && setFollowups({ ...followups, asked: followups.asked.map((q, i) => (i === index ? { ...q, answer: value } : q)) })

  // An occasion of the sender's own: named in their words, when none of the studio's fits.
  const [ownOccasion, setOwnOccasion] = useState(Boolean(intake.occasionName))

  /** Have the film's scenes written from the sender's words, build it, and start the song behind it. */
  const finish = async () => {
    if (!canGenerate(intake)) return go('names')
    let draft = intake
    const text = about.trim()
    const seed = newSeed()
    // What the sender answered is part of what they wrote.
    const answers = cleanAnswers(questions)
    const written = withAnswers(text, answers)
    if (text && written !== sortedFrom) {
      setBusy(`Writing ${name}’s scenes from your words…`)
      let outline: Chapter[] = []
      let wish = ''
      let directed: DirectionPlan | null = null
      const facts = { occasion: intake.occasion, occasionName: intake.occasionName?.trim() || undefined, relationship: intake.relationship, photos: intake.photos.length, letter: intake.letter.trim().length >= 40 }
      try {
        const response = await fetch('/api/sort', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, sender: me, recipient: them, ...facts, answers, peeks: await photoPeeks(intake.photos) }) })
        const body = (await response.json()) as { outline?: unknown; wish?: unknown; direction?: unknown }
        if (!response.ok) throw new Error('outline failed')
        // Checked again here: the studio may tidy the sender's words, but every line must stay close to what they wrote.
        outline = cleanOutline(body.outline, { source: written, photos: intake.photos.length, proper: [them, me] })
        if (!outline.some((c) => c.layout !== 'photos')) throw new Error('no scenes')
        wish = typeof body.wish === 'string' && closeToTheirWords(body.wish, written) ? body.wish.trim().slice(0, LIMITS.wish) : ''
        // And the direction can only name a kind of film and colours the studio has.
        directed = cleanDirection(body.direction, DIRECTED_WORLDS)
      } catch {
        outline = outlineByWords(text, answers, them)
      }
      directed ??= directLocally({ ...facts, recipient: them, notes: notesOf(outline, wish) })
      // The colours are drawn for each film. Left to the director they came out the same for every film of a kind.
      const look = LOOKS[seed % LOOKS.length].id
      // New scenes: any cut the sender made of the last ones no longer applies.
      draft = { ...intake, outline, wish: wish || intake.wish, cut: undefined, direction: { ...directed, look, designs: {}, order: [], seed } }
      setIntake(() => draft)
      setSortedFrom(written)
    } else if (intake.direction) {
      // The same words, built again: the studio's direction goes with the new version, in colours of its own.
      draft = { ...intake, direction: { ...intake.direction, look: LOOKS[seed % LOOKS.length].id, seed } }
      setIntake(() => draft)
    }
    setSeed(seed)
    // Every film gets its own song. If the check for the music service hasn't answered yet, try anyway:
    // a song that can't be made says so on the preview.
    if (songs !== false) startSong(draft, plan, true)
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
            <input value={intake.recipient} maxLength={LIMITS.name} onChange={(e) => setIntake((c) => ({ ...c, recipient: e.target.value }))} />
          </label>
          <label>
            <span>Your name</span>
            <input value={intake.sender} maxLength={LIMITS.name} autoComplete="given-name" onChange={(e) => setIntake((c) => ({ ...c, sender: e.target.value }))} />
          </label>
        </div>
      ),
    },
    occasion: {
      question: 'What’s the occasion?',
      hint: 'Pick one, or name your own.',
      canNext: !ownOccasion || Boolean(intake.occasionName?.trim()),
      body: (
        <>
          <div className="pills" role="group" aria-label="Occasion">
            {OCCASIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className="pill"
                aria-pressed={!ownOccasion && intake.occasion === o.id}
                onClick={() => {
                  setOwnOccasion(false)
                  setIntake((c) => ({ ...c, occasion: o.id, occasionName: undefined }))
                  next()
                }}
              >
                {o.name}
              </button>
            ))}
            <button type="button" className="pill" aria-pressed={ownOccasion} onClick={() => setOwnOccasion(true)}>
              Something else
            </button>
          </div>
          {ownOccasion && (
            <div className="start-fields">
              <label>
                <span>What’s it for?</span>
                <input
                  autoFocus
                  value={intake.occasionName ?? ''}
                  maxLength={LIMITS.occasionName}
                  onChange={(e) => setIntake((c) => ({ ...c, occasion: 'just-because', occasionName: e.target.value }))}
                />
              </label>
            </div>
          )}
        </>
      ),
    },
    photos: {
      question: `Add a few photos of ${name}.`,
      hint: 'Three or more is best, and up to three short video clips. Private: only you and the person you send it to will see them.',
      canNext: true,
      nextLabel: intake.photos.length ? undefined : 'Skip photos',
      body: (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,.heic,.heif,video/mp4,video/quicktime,video/webm,.mov"
            multiple
            hidden
            aria-label="Add photos"
            onChange={(e) => {
              void photos.add(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
          <ul className="start-photos">
            {intake.photos.map((photo, i) => (
              <li key={photo.id}>
                <img src={photo.src} alt={`Photo ${i + 1}`} />
                {photo.clip && <span className="clip-mark">Clip</span>}
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
                    void photos.add(Array.from(e.dataTransfer.files))
                  }}
                >
                  <b>{intake.photos.length ? 'Add more' : 'Add photos'}</b>
                  <span>{intake.photos.length ? `${photos.room} more fit` : 'Choose them, or drop them here'}</span>
                </button>
              </li>
            )}
          </ul>
          {photos.reading > 0 && <Working className="photo-reading">Reading {photos.reading === 1 ? 'a photo' : `${photos.reading} photos`}…</Working>}
          {photos.removed && (
            <UndoToast token={photos.removed.photo.id} onUndo={photos.restore} onDone={photos.forget}>
              Photo removed.
            </UndoToast>
          )}
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
      hint: 'Write it however it comes out.',
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

        </>
      ),
    },
    more: {
      question: `A little more about ${name}?`,
      hint: 'We read what you wrote. A line on any of these makes the film more theirs. Skip any you like.',
      canNext: !asking,
      nextLabel: questions.some((q) => q.answer.trim()) ? undefined : 'Skip these',
      body: asking ? (
        <Working className="start-busy">Reading what you wrote about {name}…</Working>
      ) : (
        <ol className="start-more">
          {questions.map((q, i) => (
            <li key={q.quote}>
              <p className="more-quote">
                <span>You wrote</span> “{q.quote}”
              </p>
              <label htmlFor={`more-${i}`}>{q.question}</label>
              <textarea id={`more-${i}`} rows={2} maxLength={FOLLOWUP_LIMITS.answer} value={q.answer} onChange={(e) => answer(i, e.target.value)} />
            </li>
          ))}
        </ol>
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
                {occasionKnown && <span className="maker-occasion">{occasionFor(intake).ticket}</span>}
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
            if (last) void finish()
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
          {busy && <Working className="start-busy">{busy}</Working>}
        </form>
      </main>
    </div>
  )
}
