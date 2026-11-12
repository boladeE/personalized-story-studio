import { Link, createFileRoute } from '@tanstack/react-router'
import { StudioHeader } from '../components/StudioHeader'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <>
      <StudioHeader />
      <main className="studio-page home">
        <section className="home-hero">
          <h1 className="studio-title">Tell us the little things. We’ll build the birthday story.</h1>
          <p className="lede">
            Names, a few photos, the memories and the habits only you would notice. The studio arranges them into scenes
            with their own music. Don’t like the arrangement? Shuffle it.
          </p>
          <div className="actions">
            <Link to="/create" className="button primary">
              Start a birthday story
            </Link>
            <Link to="/preview" search={{ sample: 1 }} className="button ghost">
              Play the sample
            </Link>
          </div>
          <p className="fine">Drafts stay in this browser tab. Nothing is uploaded or saved.</p>
        </section>
        <ol className="home-steps">
          <li>
            <h2>Tell</h2>
            <p>Fill in what you have. Each scene shows what it still needs, so you know what’s worth adding.</p>
          </li>
          <li>
            <h2>Build</h2>
            <p>The studio picks the scenes your details can fill and puts your own words and photos into them.</p>
          </li>
          <li>
            <h2>Shuffle</h2>
            <p>Every shuffle changes the order, layouts, look and music. Your words never change.</p>
          </li>
        </ol>
      </main>
    </>
  )
}
