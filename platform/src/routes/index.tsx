import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Film } from '../film/Film'
import { generateStory } from '../story/generate'
import { SAMPLE_INTAKE, SAMPLE_NOTE, SAMPLE_SOUNDTRACK } from '../story/sample'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Little Things Digital - a film about someone you love' },
      {
        name: 'description',
        content: 'Turn your photos, memories and the little things about someone into a private film with its own song, sent as one link.',
      },
    ],
  }),
  component: Home,
})

/** The three things a sender does. The page says nothing else about how a film is made. */
const STEPS = [
  { name: 'Tell us about them', text: 'A few photos and a few sentences, however they come out.' },
  { name: 'Watch it come together', text: 'A film with scenes of its own, and a song written for them.' },
  { name: 'Send it privately', text: 'One link, opened with a question only they can answer.' },
]

/**
 * The home page, on one screen: what this is, the sample film to watch, and one way in. Everything
 * else a visitor might ask is a link away (`/questions`), and the occasion is chosen inside the flow.
 */
function Home() {
  // The page shows the product itself: the fictional sample, ready to play.
  const sample = useMemo(() => ({ ...generateStory({ ...SAMPLE_INTAKE, look: 'garden', world: 'scrapbook' }, 20261113), soundtrack: SAMPLE_SOUNDTRACK, note: SAMPLE_NOTE }), [])
  return (
    <div className="home-shell home-one">
      <header className="studio-header home-header">
        <Link to="/" className="wordmark" aria-label="Little Things Digital, home">
          little things <span>digital</span>
        </Link>
        <Link to="/start" className="button small primary">
          Start a film
        </Link>
      </header>

      <main className="one-main">
        <section className="one-hero">
          <div className="one-pitch">
            <h1 className="studio-title">The little things about someone you love, turned into a film.</h1>
            <p className="lede">Give us a few photos and a few sentences about them. You get a private film with its own song, to send as one link.</p>
            <Link to="/start" className="button primary">
              Start a film
            </Link>
          </div>
          <figure className="one-film">
            <div className="one-screen">
              <Film story={sample} embedded />
            </div>
            <figcaption>A sample film. {SAMPLE_INTAKE.recipient} and {SAMPLE_INTAKE.sender} are fictional. Tap it to play.</figcaption>
          </figure>
        </section>

        <ol className="one-steps" aria-label="How it works">
          {STEPS.map((step, i) => (
            <li key={step.name}>
              <span className="one-step-n" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h2>{step.name}</h2>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </main>

      <footer className="home-footer one-footer">
        <div>
          <span className="wordmark">
            little things <span>digital</span>
          </span>
          <Link to="/questions">Questions</Link>
        </div>
      </footer>
    </div>
  )
}
