import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Still } from '../film/Still'
import type { Shot } from '../film/timeline'
import { LOOKS, moveScene, nextDesign, toggleScene } from '../story/generate'
import type { BoardRow } from '../story/generate'
import { SAMPLE_SOUNDTRACK } from '../story/sample'
import { outlineOf } from '../story/outline'
import type { Cut, Intake, LookId, Story, WorldId } from '../story/types'
import { WORLDS, worldOf } from '../story/worlds'
import { OWN_COLOURS } from '../template/color'
import { templateCatalogue, useTemplate } from '../template/load'
import type { DraftSong, SongJob } from './draft'
import { chapterAsk, ChapterWords, hasWords, OpeningWords, sceneAsk, SceneWords } from './SceneWords'

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
  // One of the film's own scenes: its name, its shape and its words are all the sender's to change.
  const chapter = row.layout ? (outlineOf(intake) ?? []).find((c) => c.id === row.type) : undefined
  const design = row.state === 'in' ? row.designs.find((d) => d.id === row.design)?.name : undefined
  // A film with its own scenes is changed here and nowhere else, so its opening holds the names and the occasion.
  const outlined = Boolean(intake.outline)
  const opening = outlined && row.type === 'hello'
  const isField = (target: EventTarget) => target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type !== 'radio' && target.type !== 'file')

  return (
    <aside className={`scene-panel is-${row.state}`} aria-label={row.name}>
      <header className="scene-panel-head">
        <h1>{row.name}</h1>
        <p>
          {row.state === 'missing' && `Not in the film yet. ${row.missing}.`}
          {row.state === 'off' && 'Left out of the film.'}
          {row.state === 'in' && (own && words ? sceneAsk(words, intake) : own && chapter ? chapterAsk(chapter.layout, intake) : own && opening ? 'Who it is for, who it is from and what it is for. The opening and the ending are written from these.' : row.fixed ? 'Always in the film.' : 'In the film.')}
        </p>
      </header>

      {own && words && row.state !== 'off' && (
        <div className="scene-words" onFocus={(e) => isField(e.target) && onTyping(true)} onBlur={(e) => isField(e.target) && onTyping(false)}>
          <SceneWords type={words} intake={intake} setIntake={setIntake} onWriting={onLine} />
        </div>
      )}
      {own && chapter && row.state !== 'off' && (
        <div className="scene-words" onFocus={(e) => isField(e.target) && onTyping(true)} onBlur={(e) => isField(e.target) && onTyping(false)}>
          <ChapterWords chapter={chapter} intake={intake} setIntake={setIntake} onWriting={onLine} />
        </div>
      )}
      {own && opening && (
        <div className="scene-words" onFocus={(e) => isField(e.target) && onTyping(true)} onBlur={(e) => isField(e.target) && onTyping(false)}>
          <OpeningWords intake={intake} setIntake={setIntake} />
        </div>
      )}
      {own && !words && !chapter && !opening && (
        <p className="scene-panel-note">This scene is made from both names and the occasion. To change those, use “Edit every detail” below.</p>
      )}
      {!own && (words || chapter) && <p className="scene-panel-note">This is the sample’s film, so its words stay as they are. In your own film, this is where you change them.</p>}

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
        {(changed || (own && !outlined) || (own && chapter && row.state !== 'in')) && (
          <p className="scene-more">
            {changed && (
              <button type="button" className="text-button" onClick={() => onCut(undefined, 'hello', { label: 'All scenes are back to the studio’s choices.', cue: 'hello' })}>
                Reset all scenes
              </button>
            )}
            {own && chapter && row.state !== 'in' && (
              <button type="button" className="text-button" onClick={() => setIntake((c) => ({ ...c, outline: (outlineOf(c) ?? []).filter((x) => x.id !== chapter.id) }))}>
                Remove this scene
              </button>
            )}
            {own && !outlined && (
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

/**
 * Choosing the film's design by eye: every template the studio has, each shown as one of its pages, and
 * the colours of the one in use. The still beside it shows the film's own scene in whichever is picked.
 */
export function DesignPanel({
  story,
  back,
  onClose,
  onPick,
  onColours,
  onOwn,
}: {
  story: Story
  /** The scene to go back to. */
  back: string
  onClose: () => void
  onPick: (id: string) => void
  onColours: (palette: number) => void
  /** A colour of the sender's own, or none for the film's usual ones. `more` is a further step of one drag in the colour picker: the same change, not another to undo. */
  onOwn: (own: string | undefined, more?: boolean) => void
}) {
  const [list, setList] = useState<Array<{ id: string; name: string }>>([])
  useEffect(() => {
    let live = true
    void templateCatalogue().then((all) => live && setList(all))
    return () => {
      live = false
    }
  }, [])
  const current = story.template
  const template = useTemplate(current?.id)
  const count = template?.palettes.length ?? 1
  const at = current ? Math.abs(current.palette) % count : 0
  const own = current?.own
  const named = OWN_COLOURS.find((c) => c.hex === own)
  // Without a colour of the sender's own, a film leans toward its photos, where the design allows and there are any.
  const usual = current?.hues && template?.tint ? 'From your photos' : 'As designed'
  // One drag in the colour picker is one change: only its first step is kept for undo.
  const dragging = useRef(false)
  const picker = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const input = picker.current
    if (!input) return
    const done = () => {
      dragging.current = false
    }
    input.addEventListener('change', done)
    input.addEventListener('blur', done)
    return () => {
      input.removeEventListener('change', done)
      input.removeEventListener('blur', done)
    }
  }, [])
  return (
    <aside className="scene-panel is-look is-design" aria-label="The design of the film">
      <header className="scene-panel-head">
        <h1>The design</h1>
      </header>
      <div className="design-colours">
        <div className="pager is-row" role="group" aria-label="Sets of colours">
          <span>
            Colours <small>{own ? (named?.name ?? 'Your own') : usual}</small>
          </span>
          {count > 1 && (
            <>
              <button type="button" aria-label="The colours before these" onClick={() => onColours((at + count - 1) % count)}>
                <PagerChevron />
              </button>
              <b>
                {at + 1} of {count}
              </b>
              <button type="button" className="is-next" aria-label="The next colours" onClick={() => onColours((at + 1) % count)}>
                <PagerChevron />
              </button>
            </>
          )}
        </div>
        <div className="colour-dots" role="group" aria-label="The film’s colour">
          <button type="button" className="colour-dot is-usual" aria-label={usual} title={usual} aria-pressed={!own} onClick={() => onOwn(undefined)}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="8.5" cy="10" r="1.6" />
              <path d="m4 17 5-4.5 3.5 3 3-2.5L20 17" />
            </svg>
          </button>
          {OWN_COLOURS.map((c) => (
            <button key={c.hex} type="button" className="colour-dot" style={{ '--dot': c.hex } as CSSProperties} aria-label={c.name} title={c.name} aria-pressed={own === c.hex} onClick={() => onOwn(c.hex)} />
          ))}
          <label className="colour-dot is-own" title="Your own colour" data-on={own && !named ? 'true' : undefined} style={own && !named ? ({ '--dot': own } as CSSProperties) : undefined}>
            <input
              ref={picker}
              type="color"
              aria-label="Your own colour"
              value={own ?? '#d6336c'}
              onChange={(event) => {
                onOwn(event.target.value.toLowerCase(), dragging.current)
                dragging.current = true
              }}
            />
          </label>
        </div>
      </div>
      <ul className="design-grid">
        {list.map((t) => (
          <li key={t.id}>
            <button type="button" aria-pressed={t.id === current?.id} onClick={() => onPick(t.id)}>
              <img src={`/templates/thumbs/${t.id}.jpg`} alt="" loading="lazy" width={320} height={200} />
              <span>{t.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="chip-button is-main scene-panel-close" onClick={onClose}>
        Back to {back}
      </button>
    </aside>
  )
}

const PagerChevron = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m15 5-7 7 7 7" />
  </svg>
)

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
  onAdd,
}: {
  /** Add a scene of the sender's own. Offered on a film that has its own scenes. */
  onAdd?: () => void
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
        {/* A film in a template picks its design from all of them; one of the older kinds picks its kind and colours. */}
        {story.template ? (
          <button type="button" className="chip-button" aria-expanded={lookOpen} onClick={onLook}>
            Design
          </button>
        ) : (
          <button type="button" className="chip-button look-button" aria-expanded={lookOpen} data-look={story.look} data-world={world} onClick={onLook}>
            <span className="swatch" aria-hidden="true" />
            Look<span className="wide-only">: {worldOf(world).name}, {worldOf(world).looks[story.look]}</span>
          </button>
        )}
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
                  <Still look={story.look} world={world} template={story.template} content={{ kind: 'shot', shot: poster }} />
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
        {onAdd && (
          <li className="scene-tile is-add">
            <span className="scene-thumb is-empty" aria-hidden="true">
              +
            </span>
            <button type="button" onClick={onAdd}>
              <span className="scene-tile-name">Add a scene</span>
            </button>
          </li>
        )}
      </ol>
    </nav>
  )
}

/** The film's song, always in view under the scenes: what it is, and the way to hear or change it. */
export function SongBar({ sample, recipient, song, job, songs }: { sample: boolean; recipient: string; song: DraftSong | null; job: SongJob; songs: boolean | null }) {
  const making = job.state === 'writing' || job.state === 'singing'
  const words = sample
    ? `“${SAMPLE_SOUNDTRACK.label}”`
    : song
      ? song.sung === false
        ? `“${song.label}”`
        : `“${song.label}”`
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
