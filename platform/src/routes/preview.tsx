import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Film } from '../film/Film'
import { StudioHeader } from '../components/StudioHeader'
import { useDraft } from '../components/draft'
import { canGenerate, generateStory, LOOKS } from '../story/generate'
import { newSeed } from '../story/rng'
import { SAMPLE_INTAKE, SAMPLE_LYRICS, SAMPLE_NOTE, SAMPLE_SOUNDTRACK } from '../story/sample'
import type { Intake, LookId, Story } from '../story/types'

export const Route = createFileRoute('/preview')({
  validateSearch: (search: Record<string, unknown>): { sample?: 1 } =>
    search.sample === 1 || search.sample === '1' ? { sample: 1 } : {},
  head: () => ({ meta: [{ title: 'Story preview - Little Things Digital' }] }),
  component: Preview,
})

function Preview() {
  const { sample } = Route.useSearch()
  const { intake, setIntake, seed, setSeed, song } = useDraft()
  const [panelOpen, setPanelOpen] = useState(false)
  // The sample plays its own song unless the viewer switches to the score or makes another.
  const [sampleSong, setSampleSong] = useState(true)
  // The sample opens in the lightest look; a visitor can try the other two from the panel.
  const [sampleLook, setSampleLook] = useState<LookId>('paper')
  const useSample = sample === 1 || !canGenerate(intake)
  const source = useMemo(() => (useSample ? { ...SAMPLE_INTAKE, look: sampleLook } : intake), [useSample, sampleLook, intake])
  const story = useMemo<Story | null>(() => {
    if (!canGenerate(source)) return null
    // The sample says its people are invented in its own end credits, not in the header.
    const built: Story = useSample ? { ...generateStory(source, seed), note: SAMPLE_NOTE } : generateStory(source, seed)
    if (song) return { ...built, soundtrack: { kind: 'song', src: song.src, label: song.label } }
    return useSample && sampleSong ? { ...built, soundtrack: SAMPLE_SOUNDTRACK } : built
  }, [source, seed, song, useSample, sampleSong])

  if (!story || (useSample && sample !== 1)) {
    return (
      <>
        <StudioHeader />
        <main className="studio-page narrow empty">
          <h1 className="studio-title">There’s no film to preview yet.</h1>
          <p className="lede">Add both names and whatever details you have, then build it.</p>
          <div className="actions">
            <Link to="/create" className="button primary">
              Start a film
            </Link>
            <Link to="/preview" search={{ sample: 1 }} className="button ghost">
              Play the sample
            </Link>
          </div>
        </main>
      </>
    )
  }

  return (
    <div className="preview-shell">
      <StudioHeader>
        {!useSample && (
          <Link to="/create" className="button small ghost">
            Edit<span className="wide-only">&nbsp;details</span>
          </Link>
        )}
        {!useSample && (
          <Link to="/song" className="button small ghost">
            {song ? 'Song' : 'Add a song'}
          </Link>
        )}
        <button
          type="button"
          className="button small ghost"
          aria-expanded={panelOpen}
          aria-controls="adjust-panel"
          onClick={() => setPanelOpen((o) => !o)}
        >
          Look &amp; music
        </button>
        <button type="button" className="button small ghost" onClick={() => setSeed(newSeed())}>
          Shuffle
        </button>
        {useSample ? (
          <Link to="/create" className="button small primary">
            Start yours
          </Link>
        ) : (
          <Link to="/send" className="button small primary">
            Send<span className="wide-only">&nbsp;this gift</span>
          </Link>
        )}
      </StudioHeader>
      <div className="preview-body">
        {panelOpen && (
          <AdjustPanel
            intake={source}
            sampleSong={useSample ? sampleSong : null}
            onSampleSong={setSampleSong}
            look={story.look}
            onLook={(look) => (useSample ? setSampleLook(look) : setIntake((c) => ({ ...c, look })))}
            onClose={() => setPanelOpen(false)}
          />
        )}
        <Film story={story} />
      </div>
    </div>
  )
}

function AdjustPanel({
  intake,
  sampleSong,
  onSampleSong,
  look,
  onLook,
  onClose,
}: {
  /** The details the film is built from (the sender's own, or the sample). */
  intake: Intake
  /** Whether the sample's own song is playing; null when this isn't the sample. */
  sampleSong: boolean | null
  onSampleSong: (on: boolean) => void
  look: LookId
  onLook: (look: LookId) => void
  onClose: () => void
}) {
  const { song, setSong, takes } = useDraft()
  const recipient = intake.recipient.trim()
  return (
    <section id="adjust-panel" className="adjust-panel" aria-label="Look & music">
      <fieldset className="adjust-group">
        <legend>Look</legend>
        <div className="adjust-options">
          {LOOKS.map((l) => (
            <label key={l.id} className="look-option" data-look={l.id}>
              <input type="radio" name="preview-look" checked={look === l.id} onChange={() => onLook(l.id)} />
              <span className="swatch" aria-hidden="true" />
              {l.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="adjust-group">
        <legend>Soundtrack</legend>
        <div className="adjust-options">
          <label className="choice">
            <input
              type="radio"
              name="soundtrack"
              checked={!song && !sampleSong}
              onChange={() => {
                setSong(null)
                onSampleSong(false)
              }}
            />
            Studio score
          </label>
          {sampleSong !== null && (
            <label className="choice">
              <input
                type="radio"
                name="soundtrack"
                checked={!song && sampleSong}
                onChange={() => {
                  setSong(null)
                  onSampleSong(true)
                }}
              />
              {SAMPLE_SOUNDTRACK.label}
            </label>
          )}
          {takes.map((take, i) => (
            <label key={take.id} className="choice">
              <input type="radio" name="soundtrack" checked={song?.id === take.id} onChange={() => setSong(take)} />
              “{take.label}”{takes.length > 1 ? `, take ${i + 1}` : ''}
            </label>
          ))}
        </div>
        {sampleSong === null ? (
          <div className="song-maker">
            <Link to="/song" className="button small primary">
              {takes.length ? 'Change the song' : `Write ${recipient}’s song`}
            </Link>
          </div>
        ) : (
          <p className="fine">Start your own story and the studio writes a song like this about your person.</p>
        )}
        {(song?.lyrics || (!song && sampleSong)) && (
          <details className="song-lyrics">
            <summary>Read the lyrics</summary>
            <p>{song?.lyrics || SAMPLE_LYRICS}</p>
          </details>
        )}
        <p className="fine">Tap the ticket again to hear a change.</p>
      </fieldset>
      <button type="button" className="text-button" onClick={onClose}>
        Done
      </button>
    </section>
  )
}
