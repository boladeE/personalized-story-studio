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

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: 'What do I need to start?',
    a: 'Two names, a few photos and a few sentences about them. That is enough for a film and a song. A letter, captions, more memories and a last line are all optional, and you can add them after you have watched it.',
  },
  {
    q: 'How do they receive it?',
    a: 'You get one private link and send it however you like. It opens in the browser on a phone or a computer, with nothing to install, and plays by itself once they tap the ticket.',
  },
  {
    q: 'Who can see it?',
    a: 'Only someone who has the link and can answer the question you set. You also get a separate link for yourself: from there you can delete the gift at any time, and its photos and words are deleted with it.',
  },
  {
    q: 'Who writes and sings the song?',
    a: 'The words are drafted from the details you give, and the song is sung by Google’s AI music models. You read the words first and can rewrite any line before it is made. Your letter and photos are never used for the song.',
  },
  {
    q: 'My occasion isn’t on the list.',
    a: 'Start with “Just because”. Nothing in that film names an occasion, so it fits whatever you need it for.',
  },
  {
    q: 'What does it cost?',
    a: 'Payment isn’t connected yet. While the studio is being tested, making and sending a film costs nothing.',
  },
]

/**
 * The home page, on one screen: what this is, the sample film to watch, and one way in. Everything
 * else a visitor might ask is in the questions below that first screen, and the occasion is chosen inside the flow.
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
        <div className="one-first">
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
        </div>

        <section id="questions" className="one-questions" aria-labelledby="questions-title">
          <h2 id="questions-title">Questions</h2>
          <div className="question-list">
            {QUESTIONS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="home-footer one-footer">
        <div>
          <span className="wordmark">
            little things <span>digital</span>
          </span>
          <a href="#questions">Questions</a>
        </div>
      </footer>
    </div>
  )
}
