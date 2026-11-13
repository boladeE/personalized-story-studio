import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { Ambient } from '../film/Ambient'
import { Film } from '../film/Film'
import { Type } from '../film/shots'
import type { Story } from '../story/types'

/** What the recipient opens. Nothing about the gift is shown until the answer is right. */
export const Route = createFileRoute('/g/$slug')({
  head: () => ({ meta: [{ title: 'A private gift' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: Gift,
})

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'locked'; question: string } | { kind: 'open'; story: Story }

function Gift() {
  const { slug } = Route.useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/gift/${slug}`)
      const body = (await response.json()) as { story?: Story; question?: string }
      if (response.ok && body.story) setState({ kind: 'open', story: body.story })
      else if (response.status === 401 && body.question) setState({ kind: 'locked', question: body.question })
      else setState({ kind: 'missing' })
    } catch {
      setState({ kind: 'missing' })
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  if (state.kind === 'open') {
    return (
      <div className="recipient-shell">
        <Film story={state.story} />
      </div>
    )
  }
  return (
    <div className="gate">
      <Ambient colors={{ a: '#14070d', b: '#4e1a2c', c: '#c9743e' }} />
      <main className="gate-card">
        {state.kind === 'loading' && <p className="gate-kicker">One moment…</p>}
        {state.kind === 'missing' && (
          <>
            <p className="gate-kicker">Little Things</p>
            <h1 className="gate-title">This gift isn’t here.</h1>
            <p className="gate-body">The link may be incomplete, or the gift was taken down. Ask the person who sent it.</p>
          </>
        )}
        {state.kind === 'locked' && <Lock slug={slug} question={state.question} onOpen={load} />}
      </main>
    </div>
  )
}

function Lock({ slug, question, onOpen }: { slug: string; question: string; onOpen: () => Promise<void> }) {
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/unlock/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
      if (response.ok) return await onOpen()
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? 'That didn’t work. Try again.')
    } catch {
      setError('We couldn’t reach the studio. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="gate-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy && answer.trim()) void submit()
      }}
    >
      <p className="gate-kicker">Someone made you something.</p>
      <Type as="h1" text="First, a question only you can answer." className="gate-title" delay={0.4} />
      <label htmlFor="gate-answer" className="gate-question">
        {question}
      </label>
      <input id="gate-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} autoComplete="off" autoFocus />
      <button type="submit" disabled={busy || !answer.trim()}>
        {busy ? 'Checking…' : 'Open it'}
      </button>
      {error && (
        <p className="gate-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
