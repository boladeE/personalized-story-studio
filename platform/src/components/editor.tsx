import { Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Still } from '../film/Still'
import type { Shot } from '../film/timeline'
import { LOOKS, moveScene, nextDesign, toggleScene } from '../story/generate'
import type { BoardRow } from '../story/generate'
import { SAMPLE_SOUNDTRACK } from '../story/sample'
import type { Cut, Intake, LookId, Story, WorldId } from '../story/types'
import { designName, WORLDS, worldOf } from '../story/worlds'
import type { DraftSong, SongJob } from './draft'
import { hasWords, sceneAsk, SceneWords } from './SceneWords'

/**
 * The editor around the film: the chosen scene's words, open beside the still
 * of it; the scenes in playing order under that; the look of the whole film;
 * and the song, in a bar of its own. Nothing here is needed to send a film.
 * Anything the sender doesn't touch stays the studio's choice.
 */

export type CutChange = (cut: Cut | undefined, cue?: string, change?: { label: string; cue?: string }) => void

/** The chosen scene: what it says, written right here, and what else can be done to it. */
export function ScenePanel({
  intake,
  story,
  own,
  row,
  rows,
  setIntake,
  onLine,
  onTyping,
  onCut,
}: {
  /** The details the film is built from (the sender's own, or the sample). */
  intake: Intake
  story: Story
  own: boolean
  row: BoardRow
  rows: BoardRow[]
  setIntake: (update: (current: Intake) => Intake) => void
  /** Which line of a list (or which memory) is being written. */
  onLine: (index: number) => void
  /** A field of the scene's words has, or has lost, the cursor. */
  onTyping: (typing: boolean) => void
  onCut: CutChange
}) {
  const world = story.world ?? 'screening'
  const cut = intake.cut
  const movable = rows.filter((r) => r.state === 'in' && !r.fixed).map((r) => r.type)
  const changed = Boolean(cut?.order?.length || cut?.off?.length || Object.keys(cut?.designs ?? {}).length)
  const at = movable.indexOf(row.type)
  const after = movable[at + 1] ?? 'wish'
  const words = hasWords(row.type) ? row.type : null
  const design = row.state === 'in' ? designName(world, row.type, row.design) : undefined
  const isField = (target: EventTarget) => target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type !== 'radio' && target.type !== 'file')

  return (
    <aside className={`scene-panel is-${row.state}`} aria-label={row.name}>
      <header className="scene-panel-head">
        <h1>{row.name}</h1>
        <p>
          {row.state === 'missing' && `Not in the film yet. ${row.missing}.`}
          {row.state === 'off' && 'Left out of the film.'}
          {row.state === 'in' && (own && words ? sceneAsk(words, intake) : row.fixed ? 'Always in the film.' : 'In the film.')}
        </p>
      </header>

      {own && words && row.state !== 'off' && (
        <div className="scene-words" onFocus={(e) => isField(e.target) && onTyping(true)} onBlur={(e) => isField(e.target) && onTyping(false)}>
          <SceneWords type={words} intake={intake} setIntake={setIntake} onWriting={onLine} />
        </div>
      )}
      {own && !words && (
        <p className="scene-panel-note">This scene is made from both names and the occasion. To change those, use “Edit every detail” below.</p>
      )}
      {!own && words && <p className="scene-panel-note">This is the sample’s film, so its words stay as they are. In your own film, this is where you change them.</p>}

      <div className="scene-actions">
        <p className="scene-actions-head">
          <b>This scene</b>
          {design && <span className="scene-design">{design}</span>}
        </p>
        <div className="scene-tools">
          {row.state === 'in' && row.designs.length > 1 && (
            <button type="button" className="chip-button" aria-label={`Another design for ${row.name}`} onClick={() => onCut(nextDesign(story, cut, row.type), row.type, { label: `${row.name} has another design.`, cue: row.type })}>
              Another design
            </button>
          )}
          {row.state === 'in' && !row.fixed && (
            <>
              <button type="button" className="chip-button" aria-label={`Move ${row.name} earlier`} disabled={at <= 0} onClick={() => onCut(moveScene(story, cut, row.type, -1), row.type, { label: `${row.name} moved earlier.`, cue: row.type })}>
                Move earlier
              </button>
              <button type="button" className="chip-button" aria-label={`Move ${row.name} later`} disabled={at === movable.length - 1} onClick={() => onCut(moveScene(story, cut, row.type, 1), row.type, { label: `${row.name} moved later.`, cue: row.type })}>
                Move later
              </button>
              <button type="button" className="chip-button" aria-label={`Leave out ${row.name}`} onClick={() => onCut(toggleScene(cut, row.type, false), after, { label: `${row.name} left out.`, cue: row.type })}>
                Leave out
              </button>
            </>
          )}
          {row.state === 'off' && (
            <button type="button" className="chip-button is-main" aria-label={`Put back ${row.name}`} onClick={() => onCut(toggleScene(cut, row.type, true), row.type, { label: `${row.name} put back.`, cue: 'hello' })}>
              Put it back
            </button>
          )}
          {row.state === 'in' && row.fixed && row.designs.length <= 1 && <span className="scene-fixed">It opens or closes the film, so it stays where it is.</span>}
        </div>
        {(changed || own) && (
          <p className="scene-more">
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
          </p>
        )}
      </div>
    </aside>
  )
}

/** The whole film's look, in the panel beside the still: its kind and its colours. */
export function LookPanel({ story, back, note, onClose, onLook, onWorld }: { story: Story; /** The scene to go back to. */ back: string; /** What the studio says about its own choice of film, while that choice stands. */ note?: string; onClose: () => void; onLook: (look: LookId) => void; onWorld: (world: WorldId) => void }) {
  const world = story.world ?? 'screening'
  return (
    <aside className="scene-panel is-look" aria-label="The look of the film">
      <header className="scene-panel-head">
        <h1>The look</h1>
        <p>For the whole film. The still shows each change as you make it.</p>
      </header>
      {note && <p className="scene-panel-note">{note}</p>}
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
      <button type="button" className="chip-button is-main scene-panel-close" onClick={onClose}>
        Back to {back}
      </button>
    </aside>
  )
}

/** The film's scenes, left to right in the order they play, then what was left out and what could still go in. */
export function SceneNav({
  story,
  rows,
  posters,
  selected,
  playing,
  onSelect,
  lookOpen,
  onLook,
  onShuffle,
}: {
  story: Story
  rows: BoardRow[]
  posters: Map<string, Shot>
  selected: string
  /** The scene the film is on, while it plays. */
  playing?: string
  onSelect: (type: string) => void
  lookOpen: boolean
  onLook: () => void
  onShuffle: () => void
}) {
  const world = story.world ?? 'screening'
  const strip = useRef<HTMLOListElement>(null)
  // The chosen scene stays in view as the row scrolls or its order changes.
  useEffect(() => {
    strip.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selected, rows])
  return (
    <nav className="scene-nav" aria-label="Scenes">
      <div className="scene-nav-head">
        <b>Scenes</b>
        <span className="scene-nav-hint">In playing order. Pick one to change it.</span>
        <button type="button" className="chip-button look-button" aria-expanded={lookOpen} data-look={story.look} data-world={world} onClick={onLook}>
          <span className="swatch" aria-hidden="true" />
          Look<span className="wide-only">: {worldOf(world).name}, {worldOf(world).looks[story.look]}</span>
        </button>
        <button type="button" className="chip-button" onClick={onShuffle}>
          Try another version
        </button>
      </div>
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
              <button type="button" aria-pressed={r.type === selected} onClick={() => onSelect(r.type)}>
                <span className="scene-tile-name">{r.name}</span>
                {r.state !== 'in' && <span className="visually-hidden">{r.state === 'off' ? ', left out' : ', not in the film yet'}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** The film's song, always in view under the scenes: what it is, and the way to hear or change it. */
export function SongBar({ sample, recipient, song, job, songs }: { sample: boolean; recipient: string; song: DraftSong | null; job: SongJob; songs: boolean | null }) {
  const making = job.state === 'writing' || job.state === 'singing'
  const words = sample
    ? `“${SAMPLE_SOUNDTRACK.label}”, written and sung for this film`
    : song
      ? song.sung === false
        ? `“${song.label}”, made for ${recipient}`
        : `“${song.label}”, written and sung for ${recipient}`
      : job.state === 'failed'
        ? `${recipient}’s song didn’t come through`
        : making || songs !== false
          ? `${recipient}’s song is being made`
          : 'No song yet'
  return (
    <footer className="film-song" aria-label="The film’s song">
      <span className="film-song-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l11-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
        </svg>
      </span>
      <p className="film-song-words">
        <span>The song in this film</span>
        <b>{words}</b>
      </p>
      <Link to="/preview" search={(was) => ({ ...was, edit: 1 as const, song: 1 as const })} state={{ fromEditor: true } as never} className="film-song-open">
        <span>
          {sample ? (
            'Hear it'
          ) : song ? (
            <>
              Hear<span className="wide-only"> it</span> or change<span className="wide-only"> it</span>
            </>
          ) : (
            'Open the song'
          )}
        </span>
      </Link>
    </footer>
  )
}
