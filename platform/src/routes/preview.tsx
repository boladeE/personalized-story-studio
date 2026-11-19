import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Film } from '../film/Film'
import type { FilmHandle, Phase } from '../film/Film'
import { StudioHeader } from '../components/StudioHeader'
import { useDraft } from '../components/draft'
import type { SongJob } from '../components/draft'
import { Still } from '../film/Still'
import { scenePosters } from '../film/previews'
import type { Shot } from '../film/timeline'
import { canGenerate, generateStory, LOOKS, moveScene, nextDesign, sceneBoard, toggleScene } from '../story/generate'
import type { BoardRow } from '../story/generate'
import { newSeed } from '../story/rng'
import { SAMPLE_INTAKE, SAMPLE_LYRICS, SAMPLE_NOTE, SAMPLE_SOUNDTRACK } from '../story/sample'
import { isWorld } from '../story/types'
import type { Cut, Intake, LookId, Story, WorldId } from '../story/types'
import { designName, WORLDS, worldOf } from '../story/worlds'

export const Route = createFileRoute('/preview')({
  validateSearch: (search: Record<string, unknown>): { sample?: 1; style?: WorldId; edit?: 1 } => ({
    ...(search.sample === 1 || search.sample === '1' ? { sample: 1 as const } : {}),
    // The film is watched first. Editing it is a second mode of the same page, so Back leaves it.
    ...(search.edit === 1 || search.edit === '1' ? { edit: 1 as const } : {}),
    // The sample can be opened as any kind of film, so a link can show one off.
    ...(isWorld(search.style) ? { style: search.style } : {}),
  }),
  head: () => ({ meta: [{ title: 'Story preview - Little Things Digital' }] }),
  component: Preview,
})

function Preview() {
  const { sample, style, edit } = Route.useSearch()
  const editing = edit === 1
  const { intake, setIntake, seed, setSeed, song, job, songs, plan, startSong, playJobSong } = useDraft()
  // The scene the sender last changed: the film carries on from there.
  const [cue, setCue] = useState<{ type: string; key: number }>()
  // Where the film is: whether it is playing, and on which scene.
  const [at, setAt] = useState<{ phase: Phase; scene: string }>({ phase: 'ticket', scene: '' })
  const film = useRef<FilmHandle | null>(null)
  // The sample opens in the lightest look; a visitor can try the other two while editing it.
  const [sampleLook, setSampleLook] = useState<LookId>('paper')
  // A visitor can try the other kinds of film and rearrange the sample's scenes, too.
  const [sampleWorld, setSampleWorld] = useState<WorldId>(style ?? 'screening')
  const [sampleCut, setSampleCut] = useState<Cut>()
  const useSample = sample === 1 || !canGenerate(intake)
  const source = useMemo<Intake>(
    () => (useSample ? { ...SAMPLE_INTAKE, look: sampleLook, world: sampleWorld, cut: sampleCut } : intake),
    [useSample, sampleLook, sampleWorld, sampleCut, intake],
  )
  /** The last change made in the scene editor, so one tap takes it back. */
  const [lastChange, setLastChange] = useState<SceneChange | null>(null)
  const setCut = (cut: Cut | undefined, cueType?: string, change?: Omit<SceneChange, 'before'>) => {
    setLastChange(change ? { ...change, before: source.cut } : null)
    if (useSample) setSampleCut(cut)
    else setIntake((c) => ({ ...c, cut }))
    if (cueType) setCue({ type: cueType, key: Date.now() })
  }
  /** The version before the last "Try another version", so it can be had back. */
  const [lastSeed, setLastSeed] = useState<number | null>(null)
  const story = useMemo<Story | null>(() => {
    if (!canGenerate(source)) return null
    // The sample says its people are invented in its own end credits, not in the header.
    const built: Story = useSample ? { ...generateStory(source, seed), note: SAMPLE_NOTE } : generateStory(source, seed)
    if (song) return { ...built, soundtrack: { kind: 'song', src: song.src, label: song.label } }
    // The sample plays the song that was made for it.
    return useSample ? { ...built, soundtrack: SAMPLE_SOUNDTRACK } : built
  }, [source, seed, song, useSample])

  // Every film has its own song and no other music. A film that reaches here without one (built from
  // the detailed form) has it made now.
  const own = !useSample && canGenerate(intake)
  useEffect(() => {
    if (own && songs && !song && job.state === 'idle') startSong(intake, plan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own, songs, song, job.state])
  // The finished song goes straight onto the film, which has been waiting for it.
  useEffect(() => {
    if (job.state === 'ready' && own && window.__ltFilm?.phase() !== 'playing') playJobSong()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.state, own])
  // The film is held at its opening until its song exists: it is never played without it.
  const making = own && !song && (job.state === 'writing' || job.state === 'singing' || (job.state === 'idle' && songs !== false))
  const locked = making ? `It starts when ${intake.recipient.trim()}’s song is ready.` : undefined

  // The scene being edited. Opening the editor picks the scene on screen, or the first one that can be changed.
  const rows = useMemo(() => (story ? sceneBoard(source, story) : []), [source, story])
  const [picked, setPicked] = useState<string>()
  const [tab, setTab] = useState<DeskTab>('scenes')
  useEffect(() => {
    if (!editing) {
      setTab('scenes')
      return setPicked(undefined)
    }
    setLastChange(null)
    setPicked((was) => was ?? (at.phase === 'playing' && rows.some((r) => r.type === at.scene) ? at.scene : (rows.find((r) => r.state === 'in' && !r.fixed) ?? rows[0])?.type))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])
  const selected = rows.find((r) => r.type === picked) ?? rows.find((r) => r.state === 'in' && !r.fixed) ?? rows[0]
  const posters = useMemo(() => (story && editing ? scenePosters(story) : new Map<string, Shot>()), [story, editing])

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

  const world = story.world ?? 'screening'
  const select = (type: string) => {
    setPicked(type)
    setLastChange(null)
    // A film that is playing goes to the scene. One that isn't shows a still of it, and makes no sound until asked.
    if (at.phase === 'playing' && rows.find((r) => r.type === type)?.state === 'in') film.current?.playFrom(type)
  }
  const shuffle = () => {
    setLastSeed(seed)
    setLastChange(null)
    setSeed(newSeed())
  }
  // While editing, the stage is the film only while it plays. Otherwise it is a still of the chosen scene.
  // On the other tabs it is always a scene that is in the film, so a change of look can be seen.
  const shown = tab === 'scenes' || selected?.state === 'in' ? selected : (rows.find((r) => r.state === 'in' && !r.fixed) ?? rows[0])
  const still = editing && at.phase !== 'playing' && shown
  const status = !useSample && job.state !== 'idle'

  return (
    <div className={`preview-shell${editing ? ' is-editing' : ''}`}>
      <StudioHeader tag={editing ? 'Editing' : undefined}>
        {editing ? (
          <Link to="/preview" search={(was) => ({ ...was, edit: undefined })} replace className="button small primary">
            Done
          </Link>
        ) : (
          <>
            <Link to="/preview" search={(was) => ({ ...was, edit: 1 as const })} className="button small ghost">
              Edit
            </Link>
            {useSample ? (
              <Link to="/start" className="button small primary">
                Start yours
              </Link>
            ) : (
              <Link to="/send" className="button small primary">
                Send<span className="wide-only">&nbsp;this gift</span>
              </Link>
            )}
          </>
        )}
      </StudioHeader>
      <div className="preview-notes">
        {status && <SongStatus job={job} name={story.recipient} onPlay={playJobSong} onRetry={() => startSong(intake, plan, true)} />}
      </div>
      <div className="preview-body">
        <Film
          story={story}
          cue={cue}
          locked={locked}
          handle={film}
          onState={setAt}
          covered={Boolean(still)}
          // The film has played through: the next step is offered where the sender is looking.
          ending={
            editing ? undefined : useSample ? (
              <Link to="/start" className="again">
                Start yours
              </Link>
            ) : (
              <>
                <Link to="/send" className="again">
                  Send this gift
                </Link>
                <Link to="/preview" search={(was) => ({ ...was, edit: 1 as const })} className="again is-quiet">
                  Change something
                </Link>
              </>
            )
          }
        />
        {still && (
          <div className="stage-still">
            {shown.state === 'in' && posters.get(shown.type) ? (
              <>
                <div className="stage-still-frame">
                  <Still look={story.look} world={world} content={{ kind: 'shot', shot: posters.get(shown.type)! }} />
                </div>
                <p className="stage-still-foot">
                  <button type="button" className="button small primary" disabled={Boolean(locked)} onClick={() => film.current?.playFrom(shown.type)}>
                    Play from here
                  </button>
                  <span>{locked ?? `A still from ${shown.name}. The film adds the motion and the song.`}</span>
                </p>
              </>
            ) : (
              <p className="stage-still-empty">
                <b>{shown.name}</b>
                <span>{shown.state === 'off' ? 'Left out of the film. Put it back and it appears here.' : `Not in the film yet. ${shown.missing}.`}</span>
              </p>
            )}
          </div>
        )}
      </div>
      {editing && selected && (
        <EditDesk
          intake={source}
          story={story}
          own={!useSample}
          tab={tab}
          onTab={setTab}
          rows={rows}
          posters={posters}
          selected={selected}
          playing={at.phase === 'playing' ? at.scene : undefined}
          onSelect={select}
          onCut={setCut}
          lastChange={lastChange}
          onUndo={() => lastChange && setCut(lastChange.before, lastChange.cue)}
          onLook={(look) => (useSample ? setSampleLook(look) : setIntake((c) => ({ ...c, look })))}
          onWorld={(next) => (useSample ? setSampleWorld(next) : setIntake((c) => ({ ...c, world: next })))}
          onShuffle={shuffle}
          onUnshuffle={
            lastSeed === null
              ? undefined
              : () => {
                  setSeed(lastSeed)
                  setLastSeed(null)
                }
          }
        />
      )}
    </div>
  )
}

const SONG_STEPS = ['The words', 'The voice', 'On your film']

/**
 * The song being made for the film: what is happening and how far along it is.
 * The bars are an estimate from how long each step usually takes, not a
 * measured percentage.
 */
function SongStatus({ job, name, onPlay, onRetry }: { job: SongJob; name: string; onPlay: () => void; onRetry: () => void }) {
  if (job.state === 'idle') return null
  if (job.state === 'failed') {
    return (
      <section className="song-status is-failed" role="status">
        <p className="song-status-words">
          <b>{name}’s song didn’t come through.</b>
          <span>{job.error} Until it is made, the film has no music.</span>
        </p>
        <button type="button" className="button small ghost" onClick={onRetry}>
          Try again
        </button>
      </section>
    )
  }
  const stage = job.state === 'writing' ? 0 : job.state === 'singing' ? 1 : 2
  return (
    <section className={`song-status is-${job.state}`} role="status">
      <span className="song-levels" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <p className="song-status-words">
        {job.state === 'writing' && (
          <>
            <b>Writing {name}’s song</b>
            <span>The film starts when its song is ready, in about a minute and a half.</span>
          </>
        )}
        {job.state === 'singing' && (
          <>
            <b>The words are written. {name}’s song is being sung.</b>
            <span>About a minute more, then the film is ready to play.</span>
          </>
        )}
        {job.state === 'ready' && (
          <>
            <b>{name}’s song is ready.</b>
            <span>The film goes back to the start and plays with it.</span>
          </>
        )}
      </p>
      <ol className="song-steps" aria-hidden="true">
        {SONG_STEPS.map((label, i) => (
          <li key={label} className={i < stage ? 'is-done' : i === stage ? 'is-now' : ''}>
            <span className="song-step-bar">
              <i />
            </span>
            {label}
          </li>
        ))}
      </ol>
      {job.state === 'ready' && (
        <button type="button" className="button small primary" onClick={onPlay}>
          Play the film with it
        </button>
      )}
    </section>
  )
}

/** Each scene, and the step of the detailed form that feeds it. */
const SCENE_STEPS: Record<string, string> = { spotlight: 'spotlight', memoryLane: 'memories', redFlags: 'habits', reasons: 'reasons', cameraRoll: 'photos', letter: 'letter', wish: 'wish' }

/** What the sender just did to a scene: what to say about it, the cut before it, and where the film should carry on if it is undone. */
interface SceneChange {
  label: string
  before: Cut | undefined
  cue?: string
}

type DeskTab = 'scenes' | 'look' | 'song'
const DESK_TABS: Array<{ id: DeskTab; name: string }> = [
  { id: 'scenes', name: 'Scenes' },
  { id: 'look', name: 'Look' },
  { id: 'song', name: 'Song' },
]

/**
 * The editor, under the film: its scenes in a row (tap one to change it), the
 * look of the whole film, and its song. Nothing here is needed to send a film;
 * anything the sender doesn't touch stays the studio's choice.
 */
function EditDesk({
  intake,
  story,
  own,
  tab,
  onTab: setTab,
  rows,
  posters,
  selected,
  playing,
  onSelect,
  onCut,
  lastChange,
  onUndo,
  onLook,
  onWorld,
  onShuffle,
  onUnshuffle,
}: {
  /** The details the film is built from (the sender's own, or the sample). */
  intake: Intake
  story: Story
  own: boolean
  tab: DeskTab
  onTab: (tab: DeskTab) => void
  rows: BoardRow[]
  posters: Map<string, Shot>
  selected: BoardRow
  /** The scene the film is on, while it plays. */
  playing?: string
  onSelect: (type: string) => void
  onCut: (cut: Cut | undefined, cue?: string, change?: Omit<SceneChange, 'before'>) => void
  lastChange: SceneChange | null
  onUndo: () => void
  onLook: (look: LookId) => void
  onWorld: (world: WorldId) => void
  onShuffle: () => void
  onUnshuffle?: () => void
}) {
  const tabs = useRef<HTMLDivElement>(null)
  const step = (by: number) => {
    const next = DESK_TABS[(DESK_TABS.findIndex((t) => t.id === tab) + by + DESK_TABS.length) % DESK_TABS.length]
    setTab(next.id)
    tabs.current?.querySelector<HTMLElement>(`#desk-tab-${next.id}`)?.focus()
  }
  return (
    <section className="edit-desk" aria-label="Edit the film">
      <div
        ref={tabs}
        className="desk-tabs"
        role="tablist"
        aria-label="What to change"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
          // The arrow keys belong to the tabs here, not to the film above them.
          e.stopPropagation()
          step(e.key === 'ArrowRight' ? 1 : -1)
        }}
      >
        {DESK_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`desk-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="desk-panel" tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <div id="desk-panel" className={`desk-panel is-${tab}`} role="tabpanel" aria-labelledby={`desk-tab-${tab}`}>
        {tab === 'scenes' && <ScenesTab intake={intake} story={story} own={own} rows={rows} posters={posters} selected={selected} playing={playing} onSelect={onSelect} onCut={onCut} lastChange={lastChange} onUndo={onUndo} />}
        {tab === 'look' && <LookTab story={story} onLook={onLook} onWorld={onWorld} onShuffle={onShuffle} onUnshuffle={onUnshuffle} />}
        {tab === 'song' && <SongTab intake={intake} sample={!own} />}
      </div>
    </section>
  )
}

/** The film's scenes in order, then what was left out, then what could still go in. One is chosen; its changes sit right under the row. */
function ScenesTab({
  intake,
  story,
  own,
  rows,
  posters,
  selected,
  playing,
  onSelect,
  onCut,
  lastChange,
  onUndo,
}: {
  intake: Intake
  story: Story
  own: boolean
  rows: BoardRow[]
  posters: Map<string, Shot>
  selected: BoardRow
  playing?: string
  onSelect: (type: string) => void
  onCut: (cut: Cut | undefined, cue?: string, change?: Omit<SceneChange, 'before'>) => void
  lastChange: SceneChange | null
  onUndo: () => void
}) {
  const world = story.world ?? 'screening'
  const cut = intake.cut
  const movable = rows.filter((r) => r.state === 'in' && !r.fixed).map((r) => r.type)
  const changed = Boolean(cut?.order?.length || cut?.off?.length || Object.keys(cut?.designs ?? {}).length)
  const row = selected
  const at = movable.indexOf(row.type)
  const after = movable[at + 1] ?? 'wish'
  const strip = useRef<HTMLOListElement>(null)
  // The chosen scene stays in view as the row scrolls or its order changes.
  useEffect(() => {
    strip.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [row.type, rows])
  return (
    <>
      <ol ref={strip} className="scene-strip">
        {rows.map((r) => {
          const poster = posters.get(r.type)
          return (
            <li key={r.type} className={`scene-tile is-${r.state}${playing === r.type ? ' is-playing' : ''}`}>
              {/* The still holds the film's own buttons, so it sits beside the tile's button, which covers the whole tile. */}
              {r.state === 'in' && poster ? (
                <span className="scene-thumb">
                  <Still look={story.look} world={world} content={{ kind: 'shot', shot: poster }} />
                </span>
              ) : (
                <span className="scene-thumb is-empty" aria-hidden="true">
                  {r.state === 'missing' ? '+' : ''}
                </span>
              )}
              <button type="button" aria-pressed={r.type === row.type} onClick={() => onSelect(r.type)}>
                <span className="scene-tile-name">{r.name}</span>
                {r.state !== 'in' && <span className="visually-hidden">{r.state === 'off' ? ', left out' : ', not in the film yet'}</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <div className="scene-card">
        {lastChange ? (
          <p className="scene-undo" role="status">
            <span>{lastChange.label}</span>
            <button type="button" onClick={onUndo}>
              Undo
            </button>
          </p>
        ) : (
          <p className="scene-what">
            <b>{row.name}</b>
            <small>
              {row.state === 'missing' && `Not in the film yet. ${row.missing}.`}
              {row.state === 'off' && 'Left out of the film.'}
              {row.state === 'in' && (designName(world, row.type, row.design) ?? (row.fixed ? 'Always in the film.' : 'In the film.'))}
            </small>
          </p>
        )}
        <span className="scene-tools">
          {own && SCENE_STEPS[row.type] && (
            <Link to="/create" search={{ step: SCENE_STEPS[row.type] as never }} className="chip-button is-main" aria-label={`${row.state === 'missing' ? 'Add' : row.type === 'cameraRoll' ? 'Change the photos in' : 'Edit the words in'} ${row.name}`}>
              {row.state === 'missing' ? 'Add it' : row.type === 'cameraRoll' ? 'Change photos' : 'Edit words'}
            </Link>
          )}
          {row.state === 'in' && row.designs.length > 1 && (
            <button type="button" className="chip-button" aria-label={`Another design for ${row.name}`} onClick={() => onCut(nextDesign(story, cut, row.type), row.type, { label: `${row.name} has another design.`, cue: row.type })}>
              Another design
            </button>
          )}
          {row.state === 'in' && !row.fixed && (
            <>
              <button type="button" className="chip-button is-icon" aria-label={`Move ${row.name} earlier`} disabled={at <= 0} onClick={() => onCut(moveScene(story, cut, row.type, -1), row.type, { label: `${row.name} moved earlier.`, cue: row.type })}>
                ←
              </button>
              <button type="button" className="chip-button is-icon" aria-label={`Move ${row.name} later`} disabled={at === movable.length - 1} onClick={() => onCut(moveScene(story, cut, row.type, 1), row.type, { label: `${row.name} moved later.`, cue: row.type })}>
                →
              </button>
              <button type="button" className="chip-button" aria-label={`Leave out ${row.name}`} onClick={() => onCut(toggleScene(cut, row.type, false), after, { label: `${row.name} left out.`, cue: row.type })}>
                Leave out
              </button>
            </>
          )}
          {row.state === 'off' && (
            <button type="button" className="chip-button" aria-label={`Put back ${row.name}`} onClick={() => onCut(toggleScene(cut, row.type, true), row.type, { label: `${row.name} put back.`, cue: 'hello' })}>
              Put back
            </button>
          )}
        </span>
        {(changed || own) && (
          <span className="scene-more">
            {changed && (
              <button type="button" className="text-button" onClick={() => onCut(undefined, 'hello', { label: 'All scenes are back to the studio’s choices.', cue: 'hello' })}>
                Reset all scenes
              </button>
            )}
            {own && (
              <Link to="/create" className="text-button">
                Edit every detail
              </Link>
            )}
          </span>
        )}
      </div>
    </>
  )
}

/** The whole film's look: its kind, its colours, and a fresh draw of the studio's choices. */
function LookTab({ story, onLook, onWorld, onShuffle, onUnshuffle }: { story: Story; onLook: (look: LookId) => void; onWorld: (world: WorldId) => void; onShuffle: () => void; onUnshuffle?: () => void }) {
  const world = story.world ?? 'screening'
  return (
    <>
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
              <input type="radio" name="preview-look" checked={story.look === l.id} onChange={() => onLook(l.id)} />
              <span className="swatch" aria-hidden="true" />
              {worldOf(world).looks[l.id]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="adjust-group">
        <p className="adjust-legend">A different take</p>
        <p className="fine">The same words and photos, with the studio’s lines and designs drawn again.</p>
        <div className="adjust-options">
          <button type="button" className="chip-button" onClick={onShuffle}>
            Try another version
          </button>
          {onUnshuffle && (
            <button type="button" className="text-button" onClick={onUnshuffle}>
              Back to the last version
            </button>
          )}
        </div>
      </div>
    </>
  )
}

/** The film's song: which take is on it, its words, and the way to change it. */
function SongTab({ intake, sample }: { intake: Intake; sample: boolean }) {
  const { song, setSong, takes } = useDraft()
  const recipient = intake.recipient.trim()
  const lyrics = sample ? SAMPLE_LYRICS : song?.lyrics
  return (
    <>
      <div className="adjust-group">
        <p className="adjust-legend">On this film</p>
        {sample ? (
          <>
            <p className="song-now">“{SAMPLE_SOUNDTRACK.label}”, written and sung for this film.</p>
            <p className="fine">Start your own and the studio writes a song like this about your person.</p>
          </>
        ) : (
          <>
            {takes.length > 1 ? (
              <div className="adjust-options">
                {takes.map((take, i) => (
                  <label key={take.id} className="choice">
                    <input type="radio" name="soundtrack" checked={song?.id === take.id} onChange={() => setSong(take)} />
                    “{take.label}”, take {i + 1}
                  </label>
                ))}
              </div>
            ) : (
              <p className="song-now">{song ? `“${song.label}”, written and sung for ${recipient}.` : `${recipient}’s song hasn’t been made yet.`}</p>
            )}
            <div className="song-maker">
              <Link to="/song" className="chip-button is-main">
                {takes.length ? 'Change the song' : `Write ${recipient}’s song`}
              </Link>
            </div>
          </>
        )}
      </div>
      {lyrics && (
        <div className="adjust-group song-words">
          <p className="adjust-legend">Its words</p>
          <p className="song-lyrics">{lyrics}</p>
        </div>
      )}
    </>
  )
}
