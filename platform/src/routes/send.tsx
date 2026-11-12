import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { StudioHeader } from '../components/StudioHeader'
import { useDraft } from '../components/draft'
import { preparePhoto } from '../components/photo-upload'
import { canGenerate, generateStory, LOOKS } from '../story/generate'
import { LIMITS } from '../story/validate'

export const Route = createFileRoute('/send')({
  head: () => ({ meta: [{ title: 'Send the gift - Little Things Digital' }] }),
  component: Send,
})

function Send() {
  const { intake, seed, song } = useDraft()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const ready = canGenerate(intake)
  const story = useMemo(() => (ready ? generateStory(intake, seed) : null), [ready, intake, seed])

  if (!story) {
    return (
      <>
        <StudioHeader />
        <main className="studio-page narrow empty">
          <h1 className="studio-title">There’s nothing to send yet.</h1>
          <p className="lede">Build a story first. When it feels right, you’ll send it from the preview.</p>
          <Link to="/create" className="button primary">
            Start a birthday story
          </Link>
        </main>
      </>
    )
  }

  const submit = async () => {
    setError('')
    try {
      const form = new FormData()
      for (const [i, photo] of intake.photos.entries()) {
        setProgress(`Preparing photo ${i + 1} of ${intake.photos.length}…`)
        try {
          form.append(`photo:${photo.id}`, await preparePhoto(photo.src), `${photo.id}.jpg`)
        } catch {
          throw new Error(`Photo ${i + 1} couldn’t be read. Remove it or try a JPEG or PNG.`)
        }
      }
      const payload = { intake: { ...intake, photos: intake.photos.map(({ id, caption }) => ({ id, caption })) }, seed, question, answer, songId: song?.id ?? null }
      form.append('payload', JSON.stringify(payload))
      setProgress('Creating the private link…')
      const response = await fetch('/api/gifts', { method: 'POST', body: form })
      const body = (await response.json().catch(() => ({}))) as { slug?: string; manageKey?: string; error?: string }
      if (!response.ok || !body.slug || !body.manageKey) throw new Error(body.error ?? 'Something went wrong. Nothing was sent; try again.')
      await navigate({ to: '/manage/$slug', params: { slug: body.slug }, hash: `k=${body.manageKey}` })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setProgress('')
    }
  }

  const lookName = LOOKS.find((l) => l.id === story.look)?.name
  const busy = Boolean(progress)
  return (
    <>
      <StudioHeader>
        <Link to="/preview" className="button small ghost">
          Back to the preview
        </Link>
      </StudioHeader>
      <main className="studio-page narrow send">
        <h1 className="studio-title">Lock it, then send it.</h1>
        <p className="lede">
          {story.recipient} opens the gift with a private link and the answer to a question only they would know.
        </p>

        <dl className="gift-summary">
          <div>
            <dt>For</dt>
            <dd>{story.recipient}</dd>
          </div>
          <div>
            <dt>From</dt>
            <dd>{story.sender}</dd>
          </div>
          <div>
            <dt>Story</dt>
            <dd>
              {story.scenes.length} scenes, {lookName} look
            </dd>
          </div>
          <div>
            <dt>Music</dt>
            <dd>{song ? `${song.label}, original AI song` : 'Studio score'}</dd>
          </div>
        </dl>

        <form
          className="send-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!busy) void submit()
          }}
        >
          <section className="intake-section">
            <div className="section-head">
              <h2>The lock</h2>
              <p>Pick something they’ll get right first time, but a stranger wouldn’t guess.</p>
            </div>
            <div className="field">
              <label htmlFor="lock-question">A question only {story.recipient} can answer</label>
              <input
                id="lock-question"
                value={question}
                maxLength={LIMITS.question}
                placeholder="What did we name the stray cat in Yaba?"
                onChange={(e) => setQuestion(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <div className="field">
              <label htmlFor="lock-answer">The answer</label>
              <span className="hint">Capitals and spaces don’t matter. One or two words works best.</span>
              <input id="lock-answer" value={answer} maxLength={LIMITS.answer} autoComplete="off" onChange={(e) => setAnswer(e.target.value)} required />
            </div>
          </section>

          <section className="intake-section">
            <div className="section-head">
              <h2>Payment</h2>
            </div>
            <p className="notice">Payment isn’t connected in this test version. Creating the link won’t charge anything.</p>
          </section>

          <p className="fine">
            Your photos and words are stored privately for this gift. Photos are resized and their location data removed before upload.
          </p>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? 'Working on it…' : 'Create the private link'}
          </button>
          {progress && (
            <p className="fine" role="status">
              {progress}
            </p>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </main>
    </>
  )
}
