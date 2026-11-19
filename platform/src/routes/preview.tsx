import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Film } from '../film/Film'
import { StudioHeader } from '../components/StudioHeader'
import { useDraft } from '../components/draft'
import { Still } from '../film/Still'
import { scenePosters } from '../film/previews'
import { canGenerate, generateStory, LOOKS, moveScene, nextDesign, sceneBoard, toggleScene } from '../story/generate'
import { newSeed } from '../story/rng'
import { SAMPLE_INTAKE, SAMPLE_LYRICS, SAMPLE_NOTE, SAMPLE_SOUNDTRACK } from '../story/sample'
import { isWorld } from '../story/types'
import type { Cut, Intake, LookId, Story, WorldId } from '../story/types'
import { designName, WORLDS, worldOf } from '../story/worlds'

export const Route = createFileRoute('/preview')({
  validateSearch: (search: Record<string, unknown>): { sample?: 1; style?: WorldId } => ({
    ...(search.sample === 1 || search.sample === '1' ? { sample: 1 as const } : {}),
    // The sample can be opened as any kind of film, so a link can show one off.
    ...(isWorld(search.style) ? { style: search.style } : {}),
  }),
  head: () => ({ meta: [{ title: 'Story preview - Little Things Digital' }] }),
  component: Preview,
})

function Preview() {
  const { sample, style } = Route.useSearch()
  const { intake, setIntake, seed, setSeed, song, job, playJobSong } = useDraft()
  const [panel, setPanel] = useState<'none' | 'more' | 'look'>('none')
  // The scene the sender last changed: the film carries on from there.
  const [cue, setCue] = useState<{ type: string; key: number }>()
  const panelOpen = panel === 'look'
  const setPanelOpen = (open: boolean | ((was: boolean) => boolean)) => setPanel((was) => ((typeof open === 'function' ? open(was === 'look') : open) ? 'look' : 'none'))
  // The sample plays its own song unless the viewer switches to the score or makes another.
  const [sampleSong, setSampleSong] = useState(true)
  // The sample opens in the lightest look; a visitor can try the other two from the panel.
  const [sampleLook, setSampleLook] = useState<LookId>('paper')
  // A visitor can try the other kinds of film and rearrange the sample's scenes, too.
  const [sampleWorld, setSampleWorld] = useState<WorldId>(style ?? 'screening')
  const [sampleCut, setSampleCut] = useState<Cut>()
  const useSample = sample === 1 || !canGenerate(intake)
  const source = useMemo<Intake>(
    () => (useSample ? { ...SAMPLE_INTAKE, look: sampleLook, world: sampleWorld, cut: sampleCut } : intake),
    [useSample, sampleLook, sampleWorld, sampleCut, intake],
  )
  const setCut = (cut: Cut | undefined, cueType?: string) => {
    if (useSample) setSampleCut(cut)
    else setIntake((c) => ({ ...c, cut }))
    if (cueType) setCue({ type: cueType, key: Date.now() })
  }
  const story = useMemo<Story | null>(() => {
    if (!canGenerate(source)) return null
    // The sample says its people are invented in its own end credits, not in the header.
    const built: Story = useSample ? { ...generateStory(source, seed), note: SAMPLE_NOTE } : generateStory(source, seed)
    if (song) return { ...built, soundtrack: { kind: 'song', src: song.src, label: song.label } }
    return useSample && sampleSong ? { ...built, soundtrack: SAMPLE_SOUNDTRACK } : built
  }, [source, seed, song, useSample, sampleSong])

  // A song made in the background goes straight onto the film if it hasn't started; otherwise the sender chooses when.
  useEffect(() => {
    if (job.state === 'ready' && !useSample && window.__ltFilm?.phase() === 'ticket') playJobSong()
  }, [job.state, useSample])

  if (!story || (useSample && sample !== 1)) {
    return (
      <>
        <StudioHeader />
        <main className="studio-page narrow empty">
          <h1 className="studio-title">There’s no film to preview yet.</h1>
          <p className="lede">Add both names and whatever details you have, then build it.</p>
          <div className="actions">
            <Link to="/start" className="button primary">
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
        <button type="button" className="button small ghost" aria-expanded={panel === 'more'} aria-controls="scenes-panel" onClick={() => setPanel((was) => (was === 'more' ? 'none' : 'more'))}>
          Scenes
        </button>
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
          Style<span className="wide-only">&nbsp;&amp; music</span>
        </button>
        <button type="button" className="button small ghost" onClick={() => setSeed(newSeed())}>
          Shuffle
        </button>
        {useSample ? (
          <Link to="/start" className="button small primary">
            Start yours
          </Link>
        ) : (
          <Link to="/send" className="button small primary">
            Send<span className="wide-only">&nbsp;this gift</span>
          </Link>
        )}
      </StudioHeader>
      {!useSample && job.state !== 'idle' && (
        <p className={`song-status is-${job.state}`} role="status">
          {job.state === 'writing' && `Writing ${story.recipient}’s song…`}
          {job.state === 'singing' && `The words are written. ${story.recipient}’s song is being sung, about a minute more.`}
          {job.state === 'ready' && (
            <>
              {story.recipient}’s song is ready.{' '}
              <button type="button" className="text-button" onClick={playJobSong}>
                Play the film with it
              </button>
            </>
          )}
          {job.state === 'failed' && (
            <>
              The song didn’t come through. {job.error}{' '}
              <Link to="/song" className="text-button">
                Try again
              </Link>
            </>
          )}
        </p>
      )}
      <div className="preview-body">
        {panel === 'more' && <ScenesPanel intake={source} story={story} own={!useSample} onCut={setCut} onClose={() => setPanel('none')} />}
        {panelOpen && (
          <AdjustPanel
            intake={source}
            sampleSong={useSample ? sampleSong : null}
            onSampleSong={setSampleSong}
            look={story.look}
            onLook={(look) => (useSample ? setSampleLook(look) : setIntake((c) => ({ ...c, look })))}
            world={story.world ?? 'screening'}
            onWorld={(world) => (useSample ? setSampleWorld(world) : setIntake((c) => ({ ...c, world })))}
            onClose={() => setPanelOpen(false)}
          />
        )}
        <Film story={story} cue={cue} />
      </div>
    </div>
  )
}

/** Each scene, and the step of the detailed form that feeds it. */
const SCENE_STEPS: Record<string, string> = { spotlight: 'spotlight', memoryLane: 'memories', redFlags: 'habits', reasons: 'reasons', cameraRoll: 'photos', letter: 'letter', wish: 'wish' }

/**
 * The film, scene by scene: change a scene's design, move it or leave it out,
 * and see what could still go in. This is the sender's own cut; anything they
 * don't touch stays the studio's choice.
 */
function ScenesPanel({ intake, story, own, onCut, onClose }: { intake: Intake; story: Story; own: boolean; onCut: (cut: Cut | undefined, cue?: string) => void; onClose: () => void }) {
  const rows = sceneBoard(intake, story)
  const posters = useMemo(() => scenePosters(story), [story])
  const world = story.world ?? 'screening'
  const cut = intake.cut
  const movable = rows.filter((r) => r.state === 'in' && !r.fixed).map((r) => r.type)
  const changed = Boolean(cut?.order?.length || cut?.off?.length || Object.keys(cut?.designs ?? {}).length)
  return (
    <section id="scenes-panel" className="adjust-panel scenes-panel" aria-label="Scenes">
      <h2>Scenes</h2>
      <p className="fine">Give a scene another design, move it, or leave it out. Once the film is playing, it carries on from the scene you change.</p>
      <ol className="scene-list">
        {rows.map((row) => {
          const poster = posters.get(row.type)
          const at = movable.indexOf(row.type)
          const after = movable[at + 1] ?? 'wish'
          return (
            <li key={row.type} className={`scene-row is-${row.state}`}>
              {row.state === 'in' && poster ? (
                <span className="scene-thumb">
                  <Still look={story.look} world={world} content={{ kind: 'shot', shot: poster }} />
                </span>
              ) : (
                <span className="scene-thumb is-empty" aria-hidden="true" />
              )}
              <span className="scene-what">
                <b>{row.name}</b>
                <small>
                  {row.state === 'missing' && `${row.missing}.`}
                  {row.state === 'off' && 'Left out.'}
                  {row.state === 'in' && (designName(world, row.type, row.design) ?? (row.fixed ? 'Always in the film.' : 'In the film.'))}
                </small>
                <span className="scene-tools">
                  {row.state === 'in' && row.designs.length > 1 && (
                    <button type="button" className="chip-button" aria-label={`Another design for ${row.name}`} onClick={() => onCut(nextDesign(story, cut, row.type), row.type)}>
                      Another design
                    </button>
                  )}
                  {row.state === 'in' && !row.fixed && (
                    <>
                      <button type="button" className="chip-button is-icon" aria-label={`Move ${row.name} earlier`} disabled={at <= 0} onClick={() => onCut(moveScene(story, cut, row.type, -1), row.type)}>
                        ↑
                      </button>
                      <button type="button" className="chip-button is-icon" aria-label={`Move ${row.name} later`} disabled={at === movable.length - 1} onClick={() => onCut(moveScene(story, cut, row.type, 1), row.type)}>
                        ↓
                      </button>
                      <button type="button" className="chip-button" aria-label={`Leave out ${row.name}`} onClick={() => onCut(toggleScene(cut, row.type, false), after)}>
                        Leave out
                      </button>
                    </>
                  )}
                  {row.state === 'off' && (
                    <button type="button" className="chip-button" aria-label={`Put back ${row.name}`} onClick={() => onCut(toggleScene(cut, row.type, true), row.type)}>
                      Put back
                    </button>
                  )}
                  {own && SCENE_STEPS[row.type] && (
                    <Link to="/create" search={{ step: SCENE_STEPS[row.type] as never }} className="chip-button">
                      {row.state === 'missing' ? 'Add' : 'Edit words'}
                    </Link>
                  )}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      {changed && (
        <p className="fine">
          <button type="button" className="text-button" onClick={() => onCut(undefined, 'hello')}>
            Undo my changes to the scenes
          </button>
        </p>
      )}
      {own && (
        <p className="fine">
          <Link to="/start" search={{ step: 'about' }}>
            Change what you wrote
          </Link>{' '}
          or <Link to="/create">edit every detail</Link>.
        </p>
      )}
      <button type="button" className="text-button" onClick={onClose}>
        Done
      </button>
    </section>
  )
}

function AdjustPanel({
  intake,
  sampleSong,
  onSampleSong,
  look,
  onLook,
  world,
  onWorld,
  onClose,
}: {
  /** The details the film is built from (the sender's own, or the sample). */
  intake: Intake
  /** Whether the sample's own song is playing; null when this isn't the sample. */
  sampleSong: boolean | null
  onSampleSong: (on: boolean) => void
  look: LookId
  onLook: (look: LookId) => void
  world: WorldId
  onWorld: (world: WorldId) => void
  onClose: () => void
}) {
  const { song, setSong, takes } = useDraft()
  const recipient = intake.recipient.trim()
  return (
    <section id="adjust-panel" className="adjust-panel" aria-label="Style & music">
      <fieldset className="adjust-group">
        <legend>Kind of film</legend>
        <div className="world-options">
          {WORLDS.map((w) => (
            <label key={w.id} className="world-option">
              <input type="radio" name="preview-world" checked={world === w.id} onChange={() => onWorld(w.id)} />
              <span>
                <b>{w.name}</b>
                <small>{w.blurb}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="adjust-group">
        <legend>Colours</legend>
        <div className="adjust-options">
          {LOOKS.map((l) => (
            <label key={l.id} className="look-option" data-look={l.id} data-world={world}>
              <input type="radio" name="preview-look" checked={look === l.id} onChange={() => onLook(l.id)} />
              <span className="swatch" aria-hidden="true" />
              {worldOf(world).looks[l.id]}
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
