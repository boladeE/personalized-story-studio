import { Link, createFileRoute } from '@tanstack/react-router'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Film } from '../film/Film'
import type { FilmHandle, Phase } from '../film/Film'
import { StudioHeader } from '../components/StudioHeader'
import { useDraft } from '../components/draft'
import { LookPanel, SceneNav, ScenePanel, SongBar } from '../components/editor'
import type { CutChange } from '../components/editor'
import { hasWords, SCENE_FIELDS } from '../components/SceneWords'
import { SongRoom } from '../components/SongRoom'
import type { SongJob } from '../components/draft'
import { Still } from '../film/Still'
import { scenePosters } from '../film/previews'
import { buildFilm } from '../film/timeline'
import type { Shot } from '../film/timeline'
import { songChoiceLine, directionLine } from '../story/direction'
import { canGenerate, generateStory, sceneBoard } from '../story/generate'
import { blankChapter, outlineOf } from '../story/outline'
import { newSeed } from '../story/rng'
import { SAMPLE_INTAKE, SAMPLE_NOTE, SAMPLE_SOUNDTRACK } from '../story/sample'
import { isWorld } from '../story/types'
import type { Cut, Intake, LookId, Story, WorldId } from '../story/types'

export const Route = createFileRoute('/preview')({
  validateSearch: (search: Record<string, unknown>): { sample?: 1; style?: WorldId; edit?: 1; song?: 1 } => ({
    ...(search.sample === 1 || search.sample === '1' ? { sample: 1 as const } : {}),
    // The film is watched first. Editing it is a second mode of the same page, so Back leaves it.
    ...(search.edit === 1 || search.edit === '1' ? { edit: 1 as const } : {}),
    // The song has a room of its own inside the editor.
    ...(search.song === 1 || search.song === '1' ? { song: 1 as const } : {}),
    // The sample can be opened as any kind of film, so a link can show one off.
    ...(isWorld(search.style) ? { style: search.style } : {}),
  }),
  head: () => ({ meta: [{ title: 'Story preview - Little Things Digital' }] }),
  component: Preview,
})

/** Something the sender did in the editor: what to say about it, and how to take it back. */
interface Change {
  label: string
  undo: () => void
}

function Preview() {
  const search = Route.useSearch()
  const { sample, style } = search
  const editing = search.edit === 1
  // The song's room is part of the editor.
  const room = editing && search.song === 1
  const { intake, setIntake, seed, setSeed, song, job, songs, plan, startSong, playJobSong, dismissJob } = useDraft()
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
  // While a field has the cursor the film is rebuilt a moment behind the typing, so the typing stays quick. Every other change shows at once.
  const [typing, setTyping] = useState(false)
  const behind = useDeferredValue(source)
  const built = typing ? behind : source
  /** The scene whose words are being changed, and what that part of the draft was before. */
  const [writing, setWriting] = useState<{ type: string; fields: Array<keyof Intake>; before: Partial<Intake> } | null>(null)
  /** The line of the scene being written, so the still shows that part of it. */
  const [line, setLine] = useState<{ type: string; at: number }>()
  /** What was done in the editor, oldest first, so Undo takes it back one step at a time. */
  const [changes, setChanges] = useState<Change[]>([])
  /** The last thing that happened, said beside Undo. */
  const [note, setNote] = useState('')
  const story = useMemo<Story | null>(() => {
    if (!canGenerate(built)) return null
    // The sample says its people are invented in its own end credits, not in the header.
    const made: Story = useSample ? { ...generateStory(built, seed), note: SAMPLE_NOTE } : generateStory(built, seed)
    if (song) return { ...made, soundtrack: { kind: 'song', src: song.src, label: song.label } }
    // The sample plays the song that was made for it.
    return useSample ? { ...made, soundtrack: SAMPLE_SOUNDTRACK } : made
  }, [built, seed, song, useSample])

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
  const rows = useMemo(() => (story ? sceneBoard(built, story) : []), [built, story])
  const [picked, setPicked] = useState<string>()
  /** What the panel beside the still holds: the chosen scene, or the look of the whole film. */
  const [side, setSide] = useState<'scene' | 'look'>('scene')
  useEffect(() => {
    setChanges([])
    setNote('')
    setWriting(null)
    setTyping(false)
    setLine(undefined)
    setSide('scene')
    if (!editing) return setPicked(undefined)
    setPicked((was) => was ?? (at.phase === 'playing' && rows.some((r) => r.type === at.scene) ? at.scene : (rows.find((r) => r.state === 'in' && !r.fixed) ?? rows[0])?.type))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])
  // The song is heard by itself in its room, so the film goes quiet first.
  useEffect(() => {
    if (!room) return
    film.current?.rewind()
    setTyping(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room])
  const selected = rows.find((r) => r.type === picked) ?? rows.find((r) => r.state === 'in' && !r.fixed) ?? rows[0]
  const shots = useMemo(() => (story && editing ? buildFilm(story).shots : []), [story, editing])
  const posters = useMemo(() => (story && editing ? scenePosters(story, shots) : new Map<string, Shot>()), [story, editing, shots])

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

  /** The words written since the scene's fields were first touched, as one change that can be taken back. */
  const typed = (): Change | null => {
    if (!writing) return null
    const { before, type, fields } = writing
    // Photos have their own way back, offered as each one is removed.
    if (fields.includes('photos') || fields.every((field) => JSON.stringify(intake[field]) === JSON.stringify(before[field]))) return null
    const name = rows.find((r) => r.type === type)?.name ?? 'The scene'
    return { label: `${name} changed.`, undo: () => setIntake((c) => ({ ...c, ...before })) }
  }
  /** Keep what was just done (and any words written before it) so it can be undone. */
  const record = (change?: Change) => {
    const added = [typed(), change].filter((c): c is Change => Boolean(c))
    if (writing) setWriting(null)
    if (!added.length) return
    setChanges((list) => [...list, ...added].slice(-40))
    setNote(added[added.length - 1].label)
  }
  const undo = () => {
    // Words still being written are the newest change; before them, whatever was last kept.
    const words = typed()
    const last = words ?? changes[changes.length - 1]
    if (!last) return
    setWriting(null)
    if (!words) setChanges((list) => list.slice(0, -1))
    last.undo()
    setNote(`${last.label} Undone.`)
  }
  const canUndo = changes.length > 0 || Boolean(typed())

  const applyCut = (cut: Cut | undefined, cueType?: string) => {
    if (useSample) setSampleCut(cut)
    else setIntake((c) => ({ ...c, cut }))
    if (cueType) setCue({ type: cueType, key: Date.now() })
  }
  const changeCut: CutChange = (cut, cueType, change) => {
    const before = source.cut
    applyCut(cut, cueType)
    record(change ? { label: change.label, undo: () => applyCut(before, change.cue) } : undefined)
  }
  const applyLook = (look: Intake['look']) => (useSample ? setSampleLook(look as LookId) : setIntake((c) => ({ ...c, look })))
  const applyWorld = (next: Intake['world']) => (useSample ? setSampleWorld(isWorld(next) ? next : 'screening') : setIntake((c) => ({ ...c, world: next })))
  /** A scene's words, changed beside the still. What they were before the first change is kept for Undo. */
  const writeWords: typeof setIntake = (update) => {
    const fields = selected ? fieldsOf(selected, Boolean(intake.outline)) : []
    if (selected && fields.length && writing?.type !== selected.type) {
      record()
      setWriting({ type: selected.type, fields, before: Object.fromEntries(fields.map((field) => [field, intake[field]])) })
    }
    setIntake(update)
  }
  /** A scene of the sender's own, added after the film's others and opened for writing. */
  const addScene = () => {
    const before = intake.outline
    const fresh = blankChapter((outlineOf(intake) ?? []).map((c) => c.id))
    setIntake((c) => ({ ...c, outline: [...(outlineOf(c) ?? []), fresh] }))
    record({ label: 'A new scene was added.', undo: () => setIntake((c) => ({ ...c, outline: before })) })
    setPicked(fresh.id)
    setLine(undefined)
    setSide('scene')
  }
  const select = (type: string) => {
    record()
    setPicked(type)
    setLine(undefined)
    setSide('scene')
    // A film that is playing goes to the scene. One that isn't shows a still of it, and makes no sound until asked.
    if (at.phase === 'playing' && rows.find((r) => r.type === type)?.state === 'in') film.current?.playFrom(type)
  }
  const shuffle = () => {
    const before = seed
    setSeed(newSeed())
    record({ label: 'The film has another version.', undo: () => setSeed(before) })
  }

  // While editing, the stage is the film only while it plays. Otherwise it is a still of the chosen scene.
  // While the look is open it is always a scene that is in the film, so a change of look can be seen.
  const shown = side === 'scene' || selected?.state === 'in' ? selected : (rows.find((r) => r.state === 'in' && !r.fixed) ?? rows[0])
  const playing = at.phase === 'playing'
  const still = editing && !room && !playing && shown
  // The still is the part of the scene being written.
  const stageShot = (() => {
    if (!shown) return undefined
    // While a scene's name or lead-in is being written, the still is its title card.
    const card = line && line.type === shown.type && line.at === -1 ? shots.find((s) => s.sceneType === shown.type && s.kind === 'card') : undefined
    if (card) return card
    const needle = line && line.type === shown.type ? writingNow(built, line.type, line.at) : ''
    return (needle.length > 2 ? shots.find((s) => s.sceneType === shown.type && s.kind !== 'card' && s.text.includes(needle)) : undefined) ?? posters.get(shown.type)
  })()
  const inFilm = rows.filter((r) => r.state === 'in')
  // What the studio says about how it directed this version, while its choices still stand.
  const direction = !useSample && intake.direction?.seed === seed && intake.direction.world === world ? directionLine(intake.direction, story.recipient) : ''
  const status = !useSample && job.state !== 'idle' && !room

  return (
    <div className={`preview-shell${editing ? ' is-editing' : ''}${room ? ' is-song' : ''}`}>
      <StudioHeader tag={editing ? 'Editing' : undefined}>
        {editing ? (
          <>
            {!room && (
              <>
                <span className="edit-note" role="status">
                  {note}
                </span>
                <button type="button" className="button small ghost undo-button" disabled={!canUndo} onClick={undo}>
                  Undo
                </button>
              </>
            )}
            <Link to="/preview" search={(was) => ({ ...was, edit: undefined, song: undefined })} replace className="button small primary">
              Done
            </Link>
          </>
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
        {status && <SongStatus job={job} name={story.recipient} kept={Boolean(song)} onPlay={playJobSong} onRetry={() => startSong(intake, plan, true)} onDismiss={dismissJob} />}
        {direction && making && !editing && (
          <p className="direction-note">
            {direction} {intake.direction && songChoiceLine(intake.direction, { tune: plan.vibe === 'surprise', voice: plan.voice === 'surprise' })}
          </p>
        )}
      </div>
      <div className="preview-body">
        <Film
          story={story}
          cue={cue}
          locked={locked}
          handle={film}
          onState={setAt}
          covered={Boolean(still) || room}
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
            {shown.state === 'in' && stageShot ? (
              <div className="stage-still-frame">
                <Still look={story.look} world={world} content={{ kind: 'shot', shot: stageShot }} />
              </div>
            ) : (
              <p className="stage-still-empty">
                <b>{shown.name}</b>
                <span>{shown.state === 'off' ? 'Left out of the film. Put it back and it appears here.' : `Not in the film yet. ${shown.missing}.`}</span>
              </p>
            )}
          </div>
        )}
        {editing && !room && shown && (
          <p className="stage-foot">
            {playing ? (
              <button type="button" className="button small ghost" onClick={() => film.current?.rewind()}>
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="button small primary"
                disabled={Boolean(locked) || shown.state !== 'in'}
                onClick={() => {
                  record()
                  film.current?.playFrom(shown.type)
                }}
              >
                <span className="glyph-play" aria-hidden="true" />
                Play from here
              </button>
            )}
            <span>
              {locked ??
                (playing ? (
                  `Playing ${rows.find((r) => r.type === at.scene)?.name ?? 'the film'}.`
                ) : shown.state === 'in' ? (
                  <>
                    Scene {inFilm.indexOf(shown) + 1} of {inFilm.length}.{!useSample && fieldsOf(shown, Boolean(intake.outline)).length > 0 && side === 'scene' && <span className="wide-only"> What you type shows here as you write.</span>}
                  </>
                ) : (
                  ''
                ))}
            </span>
          </p>
        )}
      </div>
      {editing && !room && selected && (
        <>
          <SceneNav
            story={story}
            rows={rows}
            posters={posters}
            selected={selected.type}
            playing={playing ? at.scene : undefined}
            onSelect={select}
            lookOpen={side === 'look'}
            onLook={() => {
              record()
              setSide((was) => (was === 'look' ? 'scene' : 'look'))
            }}
            onShuffle={shuffle}
            onAdd={!useSample && intake.outline ? addScene : undefined}
          />
          {side === 'look' ? (
            <LookPanel
              story={story}
              back={selected.name}
              note={direction}
              onClose={() => setSide('scene')}
              onLook={(look) => {
                const before = source.look
                applyLook(look)
                record({ label: 'The colours changed.', undo: () => applyLook(before) })
              }}
              onWorld={(next) => {
                const before = source.world
                applyWorld(next)
                record({ label: 'The kind of film changed.', undo: () => applyWorld(before) })
              }}
            />
          ) : (
            <ScenePanel
              intake={source}
              story={story}
              own={!useSample}
              row={selected}
              rows={rows}
              setIntake={writeWords}
              onLine={(index) => setLine({ type: selected.type, at: index })}
              onTyping={(now) => {
                setTyping(now)
                // The film stops for the still, which follows the words.
                if (now && window.__ltFilm?.phase() === 'playing') film.current?.rewind()
              }}
              onCut={changeCut}
            />
          )}
          <SongBar sample={useSample} recipient={story.recipient} song={song} job={job} songs={songs} />
        </>
      )}
      {room && <SongRoom intake={source} sample={useSample} />}
    </div>
  )
}

const SONG_STEPS = ['The words', 'The voice', 'On your film']

/**
 * The song being made for the film: what is happening and how far along it is.
 * The bars are an estimate from how long each step usually takes, not a
 * measured percentage.
 */
function SongStatus({ job, name, kept, onPlay, onRetry, onDismiss }: { job: SongJob; name: string; /** The film already has a song, so this is another recording of it. */ kept: boolean; onPlay: () => void; onRetry: () => void; onDismiss: () => void }) {
  if (job.state === 'idle') return null
  if (job.state === 'failed' && job.again && kept) {
    return (
      <section className="song-status is-failed" role="status">
        <p className="song-status-words">
          <b>The new recording didn’t come through.</b>
          <span>{job.error} The film keeps the song it has.</span>
        </p>
        <button type="button" className="button small ghost" onClick={onDismiss}>
          OK
        </button>
      </section>
    )
  }
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
  const again = 'again' in job && Boolean(job.again)
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
        {job.state === 'singing' && !job.again && (
          <>
            <b>The words are written. {name}’s song is being sung.</b>
            <span>About a minute more, then the film is ready to play.</span>
          </>
        )}
        {job.state === 'singing' && job.again && (
          <>
            <b>A new recording of {name}’s song is being sung.</b>
            <span>About a minute and a half. The film keeps the song it has until then.</span>
          </>
        )}
        {job.state === 'ready' && (
          <>
            <b>{name}’s song is ready.</b>
            <span>The film goes back to the start and plays with it.</span>
          </>
        )}
      </p>
      {!again && (
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
      )}
      {job.state === 'ready' && (
        <button type="button" className="button small primary" onClick={onPlay}>
          Play the film with it
        </button>
      )}
    </section>
  )
}

/**
 * The parts of the draft a scene's words are written in: one of the older scenes' own fields, the film's
 * outline (and its photos, for the scene that shows them), or, for the opening of a film with its own
 * scenes, the names and the occasion.
 */
const fieldsOf = (row: { type: string; layout?: string }, outlined: boolean): Array<keyof Intake> =>
  hasWords(row.type) ? [SCENE_FIELDS[row.type]] : row.layout === 'photos' ? ['photos'] : row.layout ? ['outline'] : outlined && row.type === 'hello' ? ['recipient', 'sender', 'occasion', 'occasionName', 'opening'] : []

/** The words on the line being written, to find the shot of the scene that shows them. */
function writingNow(intake: Intake, type: string, at: number): string {
  const chapter = intake.outline?.find((c) => c.id === type)
  // A page of a told scene may be turned over mid-way, so its opening words find it.
  if (chapter) return (chapter.lines[at] ?? '').trim().split(/(?<=[.!?…])\s+/)[0].slice(0, 60)
  if (type === 'redFlags') return (intake.habits[at] ?? '').trim()
  if (type === 'reasons') return (intake.reasons[at] ?? '').trim()
  if (type === 'memoryLane') return (intake.memories[at]?.title ?? '').trim()
  return ''
}
