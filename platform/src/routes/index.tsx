import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { StudioHeader } from '../components/StudioHeader'
import { Ambient } from '../film/Ambient'
import { Film } from '../film/Film'
import { generateStory } from '../story/generate'
import { SAMPLE_INTAKE } from '../story/sample'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  // The hero is the product itself: the fictional sample, ready to play.
  const sample = useMemo(() => generateStory({ ...SAMPLE_INTAKE, look: 'screening' }, 20261113), [])
  return (
    <>
      <StudioHeader />
      <main className="studio-page home">
        <Ambient colors={{ a: '#07140f', b: '#123a2e', c: '#6fae7c' }} density={0.7} />
        <section className="home-hero">
          <div>
            <h1 className="studio-title">Tell us the little things. We’ll turn them into a film.</h1>
            <p className="lede">
              A private film for one person, made from your photos, your memories and the habits only you would notice. It
              plays by itself, to music, behind a question only they can answer.
            </p>
            <div className="actions">
              <Link to="/create" className="button primary">
                Start a birthday story
              </Link>
              <Link to="/preview" search={{ sample: 1 }} className="button ghost">
                Play the sample
              </Link>
            </div>
            <p className="fine">Your draft stays in this browser tab until you choose to send it.</p>
          </div>
          <div className="screen-wrap">
            <div className="screen">
              <Film story={sample} embedded />
            </div>
            <p className="screen-note">
              <span>Tap the ticket. Sound on.</span>
              <span>Fictional sample, AI-generated photos</span>
            </p>
          </div>
        </section>
        <ol className="home-steps">
          <li>
            <h2>Tell</h2>
            <p>Fill in what you have. Each scene shows what it still needs, so you know what’s worth adding.</p>
          </li>
          <li>
            <h2>Build</h2>
            <p>The studio cuts your words and photos into scenes, timed to their own music.</p>
          </li>
          <li>
            <h2>Send</h2>
            <p>Shuffle until it feels right, lock it with a question, and share one private link.</p>
          </li>
        </ol>
      </main>
    </>
  )
}
