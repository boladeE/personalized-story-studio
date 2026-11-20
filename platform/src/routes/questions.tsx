import { Link, createFileRoute } from '@tanstack/react-router'
import { StudioHeader } from '../components/StudioHeader'

export const Route = createFileRoute('/questions')({
  head: () => ({ meta: [{ title: 'Questions - Little Things Digital' }] }),
  component: Questions,
})

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

/** What a visitor might ask before starting, kept off the home page so that page stays one screen. */
function Questions() {
  return (
    <>
      <StudioHeader />
      <main className="studio-page narrow questions-page">
        <h1 className="studio-title">Questions</h1>
        <div className="question-list">
          {QUESTIONS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
        <div className="actions">
          <Link to="/start" className="button primary">
            Start a film
          </Link>
        </div>
      </main>
    </>
  )
}
