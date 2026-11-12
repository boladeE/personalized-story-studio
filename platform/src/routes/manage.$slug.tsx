import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { StudioHeader } from '../components/StudioHeader'

export const Route = createFileRoute('/manage/$slug')({
  head: () => ({ meta: [{ title: 'Your gift - Little Things Digital' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: Manage,
})

interface Summary {
  slug: string
  createdAt: string
  sender: string
  recipient: string
  question: string
  scenes: number
  song: string | null
  payment: string
}

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; summary: Summary; key: string } | { kind: 'deleted' }

function Manage() {
  const { slug } = Route.useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [copied, setCopied] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const key = new URLSearchParams(window.location.hash.slice(1)).get('k') ?? ''
    if (!key) return setState({ kind: 'missing' })
    fetch(`/api/manage/${slug}`, { headers: { 'x-manage-key': key } })
      .then(async (r) => (r.ok ? setState({ kind: 'ready', summary: (await r.json()) as Summary, key }) : setState({ kind: 'missing' })))
      .catch(() => setState({ kind: 'missing' }))
  }, [slug])

  if (state.kind === 'loading') {
    return (
      <>
        <StudioHeader />
        <main className="studio-page narrow" aria-busy="true">
          <p className="lede">Opening your gift…</p>
        </main>
      </>
    )
  }
  if (state.kind === 'missing' || state.kind === 'deleted') {
    return (
      <>
        <StudioHeader />
        <main className="studio-page narrow">
          <h1 className="studio-title">{state.kind === 'deleted' ? 'The gift has been deleted.' : 'We can’t find that gift.'}</h1>
          <p className="lede">
            {state.kind === 'deleted'
              ? 'Its link no longer opens, and its photos and words are gone from the studio.'
              : 'The link may be incomplete, or the gift was deleted. Use the full link you saved when you sent it.'}
          </p>
          <a className="button primary" href="/create">
            Make a new story
          </a>
        </main>
      </>
    )
  }

  const { summary, key } = state
  const url = `${window.location.origin}/g/${summary.slug}`
  const message = `I made you something for your birthday. Open it somewhere quiet, with the sound on: ${url}`
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
    } catch {
      setCopied('')
      setError('Copying didn’t work here. Select the text and copy it yourself.')
    }
  }
  const remove = async () => {
    const response = await fetch(`/api/gift/${summary.slug}`, { method: 'DELETE', headers: { 'x-manage-key': key } })
    if (response.status === 204) setState({ kind: 'deleted' })
    else setError('The gift couldn’t be deleted. Try again.')
  }

  return (
    <>
      <StudioHeader />
      <main className="studio-page narrow manage">
        <h1 className="studio-title">{summary.recipient}’s gift is ready.</h1>
        <p className="lede">Send them the link. When they open it, they’ll be asked: “{summary.question}”</p>

        <div className="share-box">
          <label htmlFor="gift-link">Their private link</label>
          <div className="share-row">
            <input id="gift-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="button small primary" onClick={() => copy(url, 'link')}>
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <label htmlFor="gift-message">A message to send with it</label>
          <textarea id="gift-message" readOnly rows={3} value={message} onFocus={(e) => e.currentTarget.select()} />
          <div className="actions">
            <button type="button" className="button small ghost" onClick={() => copy(message, 'message')}>
              {copied === 'message' ? 'Copied' : 'Copy message'}
            </button>
            <a className="button small ghost" href={`/g/${summary.slug}`} target="_blank" rel="noreferrer">
              Open it like {summary.recipient} will
            </a>
          </div>
          <p className="visually-hidden" role="status">
            {copied ? `${copied === 'link' ? 'Link' : 'Message'} copied` : ''}
          </p>
        </div>

        <section className="intake-section">
          <div className="section-head">
            <h2>Keep this page</h2>
          </div>
          <p>
            Bookmark it. This page’s address is the only way to manage or delete the gift, and the studio can’t send it to you again.
          </p>
          {summary.payment === 'test' && <p className="notice">Made in the test version: nothing was charged.</p>}
        </section>

        <section className="intake-section">
          <div className="section-head">
            <h2>Delete the gift</h2>
            <p>Removes the link, the photos and the words for good.</p>
          </div>
          {confirming ? (
            <div className="actions">
              <button type="button" className="button small danger" onClick={remove}>
                Yes, delete it permanently
              </button>
              <button type="button" className="button small ghost" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="text-button" onClick={() => setConfirming(true)}>
              Delete this gift
            </button>
          )}
        </section>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </main>
    </>
  )
}
