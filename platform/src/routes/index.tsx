import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Film, FILM_HUSH, FILM_SOUND } from '../film/Film'
import { Still } from '../film/Still'
import { previewFor } from '../film/previews'
import type { StepFocus, StepId } from '../film/previews'
import { formatTime } from '../film/timeline'
import { generateStory } from '../story/generate'
import { OCCASIONS } from '../story/occasions'
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

/** What goes into a film, shown as stills from the sample. `focus` picks which memory, habit or reason is on screen. */
const SCENES: Array<{ step: StepId; name: string; gives: string; focus?: Partial<StepFocus> }> = [
  { step: 'who', name: 'The invitation', gives: 'A ticket with their name on it. They tap it, and the film and the music start.' },
  { step: 'spotlight', name: 'The main character', gives: 'Their best photo, and what you love about how they are.' },
  { step: 'memories', name: 'Memory lane', gives: 'Your memories, one at a time, each with its own photo.', focus: { memory: 1 } },
  { step: 'habits', name: 'Red flags', gives: 'Their funniest habits, filed as very serious red flags.', focus: { habit: 1 } },
  { step: 'reasons', name: 'Reasons', gives: 'Why it’s them, revealed one by one.' },
  { step: 'photos', name: 'The camera roll', gives: 'A spread of your photos with their captions.' },
  { step: 'letter', name: 'A letter', gives: 'Your own letter, set like a real one.' },
  { step: 'wish', name: 'The last line', gives: 'A candle to blow out or a note to open, then your final words.' },
]

const STEPS = [
  { name: 'Tell', text: 'A few taps, a few photos and a few sentences about them, in your own words.' },
  { name: 'Watch', text: 'The studio sorts your words into scenes and the film plays straight away. Shuffle it, or add a letter and more scenes.' },
  { name: 'Hear their song', text: 'Pick a style and a voice. A song about them arrives in about a minute, and you can change any line.' },
  { name: 'Send', text: 'Lock it with a question only they can answer, then share one private link.' },
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

const FOCUS: StepFocus = { memory: 0, habit: 0, reason: 0 }

function Home() {
  // The hero is the product itself: the fictional sample, ready to play.
  const sample = useMemo(() => ({ ...generateStory({ ...SAMPLE_INTAKE, look: 'screening' }, 20261113), soundtrack: SAMPLE_SOUNDTRACK, note: SAMPLE_NOTE }), [])
  const rain = SAMPLE_INTAKE.memories[1]
  return (
    <div className="home-shell">
      <header className="studio-header home-header">
        <Link to="/" className="wordmark" aria-label="Little Things Digital, home">
          little things <span>digital</span>
        </Link>
        <nav className="home-nav" aria-label="On this page">
          <a href="#occasions">Occasions</a>
          <a href="#inside">What’s in it</a>
          <a href="#song">The song</a>
          <a href="#how">How it works</a>
          <a href="#questions">Questions</a>
        </nav>
        <Link to="/start" className="button small primary">
          Start a film
        </Link>
      </header>

      <main className="home">
        <section className="home-hero">
          <h1 className="studio-title">The little things about someone you love, turned into a film.</h1>
          <div className="hero-row">
            <p className="lede">
              Give us your photos, a few memories and the habits only you would notice. The studio cuts them into a private film with
              its own song, and you send it as one link.
            </p>
            <div className="hero-go">
              <div className="actions">
                <Link to="/start" className="button primary">
                  Start a film
                </Link>
                <Link to="/preview" search={{ sample: 1 }} className="button ghost">
                  Watch the sample
                </Link>
              </div>
              <p className="fine">A few taps and a few sentences. No account needed.</p>
            </div>
          </div>
          <div className="screen-wrap">
            <div className="marquee">
              <p className="marquee-sign">
                Now showing <b>{SAMPLE_INTAKE.recipient}’s birthday film</b>
              </p>
              <div className="screen">
                <Film story={sample} embedded />
              </div>
            </div>
            <p className="screen-note">
              <span>Tap the ticket. Sound on.</span>
              <span>A fictional sample</span>
            </p>
          </div>
        </section>

        <section id="occasions" className="home-section" aria-labelledby="occasions-title">
          <div className="section-intro">
            <h2 id="occasions-title">What’s the occasion?</h2>
            <p>Pick one to begin. The ticket, the opening and the ending are written for it.</p>
          </div>
          <ul className="rack">
            {OCCASIONS.map((o, i) => (
              <li key={o.id} data-stock={['hibiscus', 'palm', 'candle'][(i + Math.floor(i / 3)) % 3]}>
                <Link to="/start" search={{ occasion: o.id }} className="stub">
                  <span className="stub-body">
                    <span className="stub-admit">Admit one</span>
                    <span className="stub-name">{o.name}</span>
                    <span className="stub-line">{o.blurb}</span>
                  </span>
                  <span className="stub-tear" aria-hidden="true">
                    <span>Begin</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="inside" className="home-section band band-wine" aria-labelledby="inside-title">
          <div className="section-intro">
            <h2 id="inside-title">What goes into the film</h2>
            <p>Each scene is built from something you tell us. Skip one and the film simply leaves it out.</p>
          </div>
          <ol className="contact-sheet">
            {SCENES.map((scene) => (
              <li key={scene.step}>
                <div className="contact-frame">
                  <Still {...previewFor(scene.step, SAMPLE_INTAKE, { ...FOCUS, ...scene.focus }, 'screening')} />
                </div>
                <h3>{scene.name}</h3>
                <p>{scene.gives}</p>
              </li>
            ))}
          </ol>
          <p className="fine">Stills from the sample film.</p>
        </section>

        <section id="song" className="home-section band band-candle" aria-labelledby="song-title">
          <div className="section-intro">
            <h2 id="song-title">Then a song, written about them.</h2>
            <p>
              The studio writes the words from what you told it, in your own phrases. You read them, change any line, pick a tune and
              hear it sung. This is the one from the sample.
            </p>
          </div>
          <div className="song-pair">
            <figure className="song-source">
              <figcaption>What {SAMPLE_INTAKE.sender} wrote</figcaption>
              <blockquote>
                <p>{rain.title}</p>
                <p>{rain.story}</p>
              </blockquote>
            </figure>
            <figure className="song-sheet song-result">
              <figcaption>What {SAMPLE_INTAKE.recipient} hears</figcaption>
              <p className="sheet-title">The rain can wait</p>
              <p className="song-lines">
                Meant to stay for one
                <br />
                Then the weather turned
                <br />
                You moved your chair close
                <br />
                Just to share the gist
              </p>
              <p className="song-lines">
                The rain can wait
                <br />
                Let it fall outside
                <br />
                The rain can wait
                <br />
                I’m in no rush
              </p>
              <SongSample src={SAMPLE_SOUNDTRACK.src} label={SAMPLE_SOUNDTRACK.label} />
            </figure>
          </div>
        </section>

        <section id="how" className="home-section" aria-labelledby="how-title">
          <div className="section-intro">
            <h2 id="how-title">How it works</h2>
          </div>
          <ol className="home-steps">
            {STEPS.map((step) => (
              <li key={step.name}>
                <h3>{step.name}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="questions" className="home-section questions" aria-labelledby="questions-title">
          <div className="section-intro">
            <h2 id="questions-title">Questions</h2>
          </div>
          <div className="question-list">
            {QUESTIONS.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="home-close band band-palm" aria-labelledby="close-title">
          <h2 id="close-title">Someone you love has a day coming up.</h2>
          <div className="actions">
            <Link to="/start" className="button primary">
              Start a film
            </Link>
            <a href="#occasions" className="button ghost">
              Choose an occasion
            </a>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div>
          <span className="wordmark">
            little things <span>digital</span>
          </span>
          <p>{SAMPLE_NOTE}</p>
        </div>
      </footer>
    </div>
  )
}

/** The sample's song, playable on the page. It and the film take turns: starting one stops the other. */
function SongSample({ src, label }: { src: string; label: string }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [length, setLength] = useState(0)

  useEffect(() => {
    const stop = () => audio.current?.pause()
    window.addEventListener(FILM_SOUND, stop)
    return () => window.removeEventListener(FILM_SOUND, stop)
  }, [])

  const toggle = () => {
    const el = audio.current
    if (!el) return
    if (!el.paused) return el.pause()
    window.dispatchEvent(new Event(FILM_HUSH))
    void el.play().catch(() => setPlaying(false))
  }

  return (
    <div className="song-player">
      <audio
        ref={audio}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setTime(0)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setLength(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
      />
      <button type="button" className="song-play" onClick={toggle} aria-label={playing ? `Pause ${label}` : `Play ${label}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          {playing ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" /> : <path d="M7 4l13 8-13 8z" fill="currentColor" />}
        </svg>
      </button>
      <div className="song-meter">
        <b>{playing || time > 0 ? `${formatTime(time)}${length ? ` of ${formatTime(length)}` : ''}` : 'Play the song'}</b>
        <span className="song-bar" aria-hidden="true">
          <i style={{ width: `${length ? Math.min(100, (time / length) * 100) : 0}%` }} />
        </span>
      </div>
    </div>
  )
}
