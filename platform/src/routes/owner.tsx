import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { StudioHeader } from '../components/StudioHeader'

export const Route = createFileRoute('/owner')({
  head: () => ({ meta: [{ title: 'Studio numbers - Little Things Digital' }, { name: 'robots', content: 'noindex' }] }),
  component: Owner,
})

type Span = { today: number; week: number; all: number }
interface Stats {
  made: Record<'film' | 'song' | 'lyrics' | 'spoken' | 'questions', Span>
  sent: Span
  days: Array<{ date: string; films: number; sent: number }>
  since: string | null
  directedBy: Array<{ name: string; count: number }>
  styles: Array<{ name: string; count: number }>
  occasions: Array<{ name: string; count: number }>
  withSong: number
  withPhotos: number
  withClips: number
  withVoice: number
}

const KEY = 'lt-owner-key'

/** The owner's page: how much the studio has made and sent. Counts only; nobody's words or photos. */
function Owner() {
  const [key, setKey] = useState('')
  const [typed, setTyped] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    try {
      setKey(window.sessionStorage.getItem(KEY) ?? '')
    } catch {
      // Without storage the key is simply asked for each visit.
    }
  }, [])
  useEffect(() => {
    if (!key) return
    let live = true
    fetch('/api/owner', { headers: { 'x-owner-key': key } })
      .then(async (response) => {
        if (!live) return
        if (response.status === 503) return setProblem('The owner’s key hasn’t been set for this studio yet (OWNER_KEY).')
        if (!response.ok) {
          try {
            window.sessionStorage.removeItem(KEY)
          } catch {
            // Nothing to forget.
          }
          setKey('')
          return setProblem('That key isn’t right.')
        }
        setProblem('')
        setStats((await response.json()) as Stats)
      })
      .catch(() => live && setProblem('The numbers couldn’t be loaded. Try again.'))
    return () => {
      live = false
    }
  }, [key])

  if (!stats) {
    return (
      <>
        <StudioHeader />
        <main className="studio-page narrow">
          <h1 className="studio-title">Studio numbers</h1>
          <form
            className="owner-key"
            onSubmit={(e) => {
              e.preventDefault()
              try {
                window.sessionStorage.setItem(KEY, typed)
              } catch {
                // It still works for this visit.
              }
              setKey(typed)
            }}
          >
            <label>
              <span>Owner’s key</span>
              <input type="password" value={typed} autoComplete="current-password" onChange={(e) => setTyped(e.target.value)} />
            </label>
            <button type="submit" className="button primary" disabled={!typed}>
              Show the numbers
            </button>
          </form>
          {problem && (
            <p className="field-error" role="alert">
              {problem}
            </p>
          )}
        </main>
      </>
    )
  }

  const rows: Array<[string, Span]> = [
    ['Films made', stats.made.film],
    ['Songs made', stats.made.song],
    ['Gifts sent', stats.sent],
    ['Notes spoken', stats.made.spoken],
  ]
  const most = Math.max(1, ...stats.days.map((d) => Math.max(d.films, d.sent)))
  const list = (title: string, items: Array<{ name: string; count: number }>) => (
    <section className="owner-list">
      <h2>{title}</h2>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <b>{item.count}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing yet.</p>
      )}
    </section>
  )
  return (
    <>
      <StudioHeader />
      <main className="studio-page owner">
        <h1 className="studio-title">Studio numbers</h1>
        <p className="lede">
          Counts only. Films and songs have been counted since {stats.since ? new Date(stats.since).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'today'}; gifts sent are counted from the
          start.
        </p>
        <table className="owner-table">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">Today</th>
              <th scope="col">7 days</th>
              <th scope="col">All</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, span]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{span.today}</td>
                <td>{span.week}</td>
                <td>{span.all}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="owner-days" aria-label="The last 14 days">
          <h2>The last 14 days</h2>
          <ol>
            {stats.days.map((d) => (
              <li key={d.date} title={`${d.date}: ${d.films} made, ${d.sent} sent`}>
                <span className="owner-bars">
                  <i className="is-made" style={{ height: `${(d.films / most) * 100}%` }} />
                  <i className="is-sent" style={{ height: `${(d.sent / most) * 100}%` }} />
                </span>
                <small>{d.date.slice(8)}</small>
              </li>
            ))}
          </ol>
          <p className="fine">
            <i className="owner-key-made" /> films made <i className="owner-key-sent" /> gifts sent
          </p>
        </section>

        <div className="owner-lists">
          {list('Gifts sent, by kind of film', stats.styles)}
          {list('Gifts sent, by occasion', stats.occasions)}
          {list('Films made, written by', stats.directedBy)}
          {list('Gifts sent that include', [
            { name: 'a song', count: stats.withSong },
            { name: 'photos', count: stats.withPhotos },
            { name: 'video clips', count: stats.withClips },
            { name: 'a voice note', count: stats.withVoice },
          ])}
        </div>
      </main>
    </>
  )
}
