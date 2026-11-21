import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Media } from '../film/Media'
import { Letter } from '../film/shots'
import type { ShotActions } from '../film/shots'
import type { Shot } from '../film/timeline'
import type { Photo } from '../story/types'
import { itemsFor } from './check'
import { FONTS, TOKENS, VOICES } from './types'
import type { Area, Box, Grid, Ground, GroupItem, Item, Page, PageKind, Palette, Template, TextItem, Token, Voice } from './types'

/**
 * The engine: draws one page of a film from a template. A page is a grid, and
 * each item sits in an area of it, once for a wide screen and once for a phone
 * held upright. Words are shrunk to fit the area they are given, so a design
 * holds whatever a sender writes. Everything a template can ask for is drawn
 * here and dressed in src/styles/template.css.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number>
const c = (token: Token) => `var(--c-${token})`

/** What one page shows: its words by slot, and whatever else its kind carries. */
export interface PageData {
  kind: PageKind
  words: Record<string, string | undefined>
  photo?: Photo
  photos?: Photo[]
  list?: { items: string[]; shown: number }
  pips?: { n: number; total: number }
  wave?: number[]
  letter?: Extract<Shot, { kind: 'letter' }>
  wish?: Extract<Shot, { kind: 'wish' }>
  credits?: Extract<Shot, { kind: 'credits' }>
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** A shot of the film as the page a template draws it on. */
export function pageOf(shot: Shot, template: Template, picked?: string): PageData {
  switch (shot.kind) {
    case 'name':
      return { kind: 'name', words: { kicker: shot.kicker, name: shot.name, sub: shot.sub, body: shot.body } }
    case 'card':
      return { kind: 'card', words: { number: shot.number, title: shot.title, sub: shot.sub } }
    case 'line':
      return { kind: 'line', words: { kicker: shot.kicker, title: shot.title, body: shot.body } }
    case 'photo':
      return { kind: 'photo', words: { kicker: shot.kicker, title: shot.title, body: shot.body }, photo: shot.photo }
    case 'flag':
    case 'reason': {
      const label = shot.kind === 'flag' ? shot.label : (shot.label ?? shot.sceneName)
      const words = { label, n: pad2(shot.n), total: pad2(shot.total), count: `${shot.n} of ${shot.total}` }
      const pips = { n: shot.n, total: shot.total }
      if (template.pages.list) return { kind: 'list', words, pips, list: { items: shot.all, shown: shot.n } }
      return { kind: shot.kind === 'flag' && template.pages.itemLoud ? 'itemLoud' : 'item', words: { ...words, text: shot.text }, pips }
    }
    case 'montage':
      return { kind: 'montage', words: { kicker: shot.kicker, title: shot.title }, photos: shot.photos }
    case 'voice':
      return { kind: 'voice', words: { who: shot.who, count: shot.total > 1 ? `${shot.n} of ${shot.total}` : undefined }, wave: shot.peaks, photo: shot.photo, ...(shot.total > 1 ? { pips: { n: shot.n, total: shot.total } } : {}) }
    case 'letter':
      return { kind: 'letter', words: {}, letter: shot }
    case 'wish':
      return { kind: 'wish', words: { title: shot.title, body: shot.body }, wish: shot }
    case 'reveal':
      return { kind: 'reveal', words: { words: shot.words, pick: shot.names && picked ? `${picked} it is.` : undefined } }
    case 'credits':
      return { kind: 'credits', words: { last: shot.last, note: shot.note }, credits: shot }
  }
}

/** The page before the film starts. */
export const coverOf = (recipient: string, occasion: string | undefined, sender: string | undefined, hint: string): PageData => ({ kind: 'cover', words: { recipient, occasion, sender: sender?.trim() ? `From ${sender.trim()}` : undefined, hint } })

/* ---------- colour and type as CSS ---------- */

const FALLBACK = { serif: 'Georgia, serif', sans: 'system-ui, sans-serif', mono: 'ui-monospace, monospace', hand: 'cursive' }

const voiceVars = (id: string, v: Voice): Vars => ({
  [`--v-${id}-f`]: `'${FONTS[v.font].name}', ${FALLBACK[FONTS[v.font].kind]}`,
  [`--v-${id}-w`]: parseInt(v.face, 10),
  [`--v-${id}-s`]: v.face.endsWith('i') ? 'italic' : 'normal',
  [`--v-${id}-t`]: v.upper ? 'uppercase' : 'none',
  [`--v-${id}-k`]: `${v.track ?? 0}em`,
  [`--v-${id}-l`]: v.lead ?? (id === 'display' ? 1.02 : id === 'body' ? 1.42 : 1.2),
})

const groundVars = (g: Ground): Vars => ({ '--g-fill': c(g.fill), '--g-ink': c(g.ink ?? 'ink'), '--g-strength': g.strength ?? 0.12 })

/** Everything a film in this template sets on its root: its colours, its three voices, its ground and its pace. */
export function templateVars(template: Template, palette: Palette): Vars {
  const vars: Vars = {}
  for (const token of TOKENS) vars[`--c-${token}`] = palette[token]
  for (const id of VOICES) Object.assign(vars, voiceVars(id, template.voices[id]))
  Object.assign(vars, groundVars(template.ground))
  const [base, step] = template.motion.pace === 'calm' ? [0.35, 0.24] : template.motion.pace === 'quick' ? [0.04, 0.08] : [0.18, 0.15]
  vars['--in-base'] = `${base}s`
  vars['--in-step'] = `${step}s`
  return vars
}

const loaded = new Map<string, Promise<unknown>>()
/** Fetch the faces a template is set in. They are the studio's own files, so nothing is asked of anyone else. */
export function loadFonts(template: Template): Promise<unknown> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve()
  return Promise.all(
    VOICES.map((id) => {
      const v = template.voices[id]
      const key = `${v.font}-${v.face}`
      if (!loaded.has(key)) {
        const face = new FontFace(FONTS[v.font].name, `url(/fonts/t/${key}.woff2)`, { weight: String(parseInt(v.face, 10)), style: v.face.endsWith('i') ? 'italic' : 'normal', display: 'swap' })
        document.fonts.add(face)
        loaded.set(key, face.load().catch(() => null))
      }
      return loaded.get(key)
    }),
  )
}

/* ---------- the pieces ---------- */

const boxStyle = (box: Box | undefined): Vars =>
  box
    ? {
        background: c(box.fill),
        padding: `calc(var(--u) * ${box.pad ?? 1.2})`,
        borderRadius: box.radius === 99 ? '999px' : `calc(var(--u) * ${box.radius ?? 0})`,
        ...(box.border ? { border: `calc(var(--u) * ${box.border.width}) solid ${c(box.border.color)}` } : {}),
        ...(box.shadow === 'hard' ? { boxShadow: `calc(var(--u) * 0.55) calc(var(--u) * 0.55) 0 ${c(box.shadowColor ?? 'ink')}` } : box.shadow === 'soft' ? { boxShadow: '0 calc(var(--u) * 0.8) calc(var(--u) * 2.4) rgba(0, 0, 0, 0.28)' } : {}),
      }
    : {}

const areaOf = ([col, row, cols, rows]: Area) => `${row} / ${col} / ${row + rows} / ${col + cols}`
const tracks = (list: number[]) => list.map((n) => `minmax(0, ${n}fr)`).join(' ')
const gridVars = (way: 'w' | 't', g: Grid): Vars => ({
  [`--cols-${way}`]: tracks(g.cols),
  [`--rows-${way}`]: tracks(g.rows),
  [`--gap-${way}`]: `calc(var(--u) * ${g.gap ?? 1.5})`,
  [`--pad-${way}`]: `calc(var(--u) * ${(g.pad ?? [5, 6])[0]}) calc(var(--u) * ${(g.pad ?? [5, 6])[1]})`,
})

type Line = Omit<TextItem, 'at' | 'is' | 'valign' | 'rotate' | 'only'>

/** Words, split so they can arrive a letter or a word at a time. */
function Said({ text, enter }: { text: string; enter?: string }) {
  if (enter !== 'letters' && enter !== 'words') return <>{text}</>
  let n = 0
  return (
    <>
      {text.split(/(\s+)/).map((part, i) =>
        !part.trim() ? (
          part ? ' ' : null
        ) : enter === 'words' ? (
          <span key={i} className="tp-w" style={{ '--i': n++ } as Vars}>
            {part}
          </span>
        ) : (
          <span key={i} className="tp-wd">
            {Array.from(part).map((ch, k) => (
              <span key={k} className="tp-w" style={{ '--i': n++ } as Vars}>
                {ch}
              </span>
            ))}
          </span>
        ),
      )}
    </>
  )
}

function Words({ line, text, grouped }: { line: Line; text: string; grouped?: boolean }) {
  const mark = line.mark && line.mark !== 'none' ? ` tp-mark-${line.mark}` : ''
  const style: Vars = {
    '--size': line.size,
    color: c(line.color),
    textAlign: line.align === 'end' ? 'right' : line.align === 'center' ? 'center' : line.align === 'start' ? 'left' : undefined,
    '--mark': c(line.markColor ?? 'accent'),
    ...boxStyle(line.box),
  }
  return (
    <p className={`tp-words tp-v-${line.voice}${mark}${line.box ? ' has-box' : ''}${line.box?.stretch && !grouped ? ' is-stretch' : ''}${grouped ? '' : ' tp-fit'}`} data-slot={line.slot} data-min={line.min ?? 0.5} style={style}>
      <span className="tp-ink">
        <Said text={text} enter={line.enter} />
      </span>
    </p>
  )
}

const TONES = { none: undefined, mono: 'grayscale(1) contrast(1.05)', warm: 'sepia(0.35) saturate(1.15)', cool: 'saturate(0.8) hue-rotate(-10deg) brightness(1.03)', faded: 'saturate(0.6) contrast(0.92) brightness(1.06)' }

function Framed({ photo, frame, color, tone, fit, caption }: { photo: Photo; frame: string; color?: Token; tone?: keyof typeof TONES; fit: 'cover' | 'contain'; caption?: ReactNode }) {
  const [ratio, setRatio] = useState(photo.aspect ?? 1.5)
  return (
    <figure className={`tp-photo tp-frame-${frame} is-${fit}`} style={{ '--ar': ratio, '--fr': c(color ?? 'surface'), '--tone': tone ? TONES[tone] : undefined } as Vars}>
      <span className="tp-ph">
        <Media photo={photo} onSize={(w, h) => h && setRatio(w / h)} />
      </span>
      {caption}
    </figure>
  )
}

/** Where each photo of a loose arrangement lies: left, top, turn (percent, percent, degrees), by how many there are. */
const PILE: Record<number, Array<[number, number, number]>> = {
  1: [[50, 50, -2]],
  2: [[34, 48, -5], [66, 52, 4]],
  3: [[26, 46, -6], [52, 56, 3], [76, 44, 7]],
  4: [[26, 34, -6], [70, 30, 5], [32, 70, 4], [72, 68, -4]],
  5: [[22, 34, -7], [52, 28, 3], [80, 36, 6], [34, 70, 5], [68, 70, -5]],
  6: [[22, 30, -6], [50, 26, 4], [78, 32, -3], [24, 70, 5], [52, 72, -5], [80, 68, 6]],
}

function Shape({ item }: { item: Extract<Item, { is: 'shape' }> }) {
  return <i className={`tp-shape tp-shape-${item.shape}`} style={{ '--sc': item.scale ?? 1, '--sw': item.weight ?? 0.3, color: c(item.color), opacity: item.opacity ?? 1 } as Vars} />
}

function Ending({ shot, actions, leaving, button }: { shot: Extract<Shot, { kind: 'wish' }>; actions: ShotActions; leaving: boolean; button: Extract<Item, { is: 'ending' }>['button'] }) {
  const dress: Vars = { ...boxStyle(button.box), color: c(button.color) }
  if (shot.choices)
    return (
      <div className={`tp-ending is-choice${leaving ? ' is-blown' : ''}`}>
        {!leaving &&
          shot.choices.map((choice) => (
            <button key={choice} type="button" className={`tp-button tp-v-${button.voice}`} style={dress} onClick={(e) => actions.onBlow(e.currentTarget.getBoundingClientRect(), choice)}>
              {choice}
            </button>
          ))}
      </div>
    )
  return (
    <div className={`wish tp-ending${leaving ? ' is-blown' : ''}`}>
      {shot.prop === 'seal' ? (
        <div className="note" aria-hidden="true">
          <span className="halo" />
          <span className="note-back" />
          <span className="note-flap" />
          <span className="note-seal" data-flame="" />
        </div>
      ) : (
        <div className="candle" aria-hidden="true">
          <span className="halo" />
          <span className="smoke" />
          <span className="flame" data-flame="">
            <i />
          </span>
          <span className="wick" />
          <span className="stick" />
        </div>
      )}
      {!leaving && (
        <button type="button" className={`tp-button tp-v-${button.voice}`} style={dress} onClick={(e) => actions.onBlow(e.currentTarget.closest('.tp-ending')?.querySelector('[data-flame]')?.getBoundingClientRect() ?? null)}>
          {shot.action}
        </button>
      )}
    </div>
  )
}

function Credits({ shot, item, actions, leaving }: { shot: Extract<Shot, { kind: 'credits' }>; item: Extract<Item, { is: 'credits' }>; actions?: ShotActions; leaving: boolean }) {
  return (
    <div className={`tp-credits is-${item.look} tp-v-${item.voice} tp-fit`} data-min="0.55" style={{ '--size': item.size, color: c(item.color), '--role': c(item.roleColor) } as Vars}>
      <dl aria-hidden="true">
        {shot.lines.map((line, i) => (
          <div key={line.role} style={{ '--i': i } as Vars}>
            <dt>{line.role}</dt>
            <dd>{line.name}</dd>
          </div>
        ))}
      </dl>
      {actions && !leaving && (
        <div className="tp-next">
          {actions.ending}
          <button type="button" className="tp-again" onClick={actions.onReplay}>
            Watch it again
          </button>
        </div>
      )}
    </div>
  )
}

function Piece({ item, data, actions, leaving }: { item: Item; data: PageData; actions?: ShotActions; leaving: boolean }): ReactNode {
  switch (item.is) {
    case 'text': {
      const text = data.words[item.slot]?.trim()
      return text ? <Words line={item} text={text} /> : null
    }
    case 'group': {
      const lines = item.lines.filter((l) => data.words[l.slot]?.trim())
      if (!lines.length) return null
      const least = Math.min(...lines.map((l) => l.min ?? 0.5))
      return (
        <div className={`tp-group tp-fit${item.box ? ' has-box' : ''}${item.box?.stretch ? ' is-stretch' : ''}`} data-min={least} style={{ '--gap': item.gap ?? 1, ...boxStyle(item.box), justifyContent: item.valign === 'start' ? 'flex-start' : item.valign === 'end' ? 'flex-end' : 'center', alignItems: item.align === 'center' ? 'center' : item.align === 'end' ? 'flex-end' : 'flex-start', textAlign: item.align === 'center' ? 'center' : item.align === 'end' ? 'right' : 'left' } as Vars}>
          {lines.map((line) => (
            <Words key={line.slot} line={{ ...line, align: line.align ?? item.align, enter: item.enter }} text={data.words[line.slot]!.trim()} grouped />
          ))}
        </div>
      )
    }
    case 'photo':
      return data.photo ? (
        <Framed
          photo={data.photo}
          frame={item.frame}
          color={item.color}
          tone={item.tone}
          fit={item.fit}
          caption={
            item.caption && data.photo.caption ? (
              <figcaption className={`tp-v-${item.caption.voice}`} style={{ '--size': item.caption.size, color: c(item.caption.color) } as Vars}>
                {data.photo.caption}
              </figcaption>
            ) : null
          }
        />
      ) : null
    case 'photos': {
      const photos = (data.photos ?? []).slice(0, 6)
      if (!photos.length) return null
      const spots = PILE[photos.length] ?? PILE[6]
      return (
        <div className={`tp-photos is-${item.arrange}`} data-count={photos.length}>
          {photos.map((photo, i) => (
            <div key={photo.id} className="tp-shot" style={{ '--i': i, '--n': photos.length, '--x': `${spots[i][0]}%`, '--y': `${spots[i][1]}%`, '--r': `${spots[i][2]}deg` } as Vars}>
              <Framed photo={photo} frame={item.frame} color={item.color} tone={item.tone} fit="cover" />
            </div>
          ))}
        </div>
      )
    }
    case 'shape':
      return <Shape item={item} />
    case 'wave': {
      const bars = (data.wave ?? []).map((h, i) => <i key={i} style={{ '--h': h } as Vars} />)
      return (
        <div className={`tp-wave is-${item.look}`} style={{ color: c(item.color), '--lit': c(item.lit) } as Vars}>
          <div className="tp-bars">{bars}</div>
          <div className="tp-bars tp-lit">{bars}</div>
        </div>
      )
    }
    case 'pips':
      return data.pips ? (
        <ol className={`tp-pips is-${item.look}`} style={{ color: c(item.color), '--lit': c(item.lit), justifyContent: item.align === 'start' ? 'flex-start' : item.align === 'end' ? 'flex-end' : 'center' } as Vars}>
          {Array.from({ length: data.pips.total }, (_, i) => (
            <li key={i} className={i + 1 < data.pips!.n ? 'is-done' : i + 1 === data.pips!.n ? 'is-now' : undefined} />
          ))}
        </ol>
      ) : null
    case 'list': {
      const list = data.list
      if (!list) return null
      return (
        <ol className={`tp-list tp-fit tp-v-${item.voice} is-${item.marker}${item.box ? ' has-box' : ''}`} data-min="0.45" style={{ '--size': item.size, '--gap': item.gap ?? 0.9, color: c(item.color), '--lit': c(item.lit), textAlign: item.align === 'center' ? 'center' : 'left', ...boxStyle(item.box) } as Vars}>
          {list.items.slice(0, list.shown).map((text, i) => (
            <li key={i} className={i === list.shown - 1 ? 'is-new' : undefined} data-n={pad2(i + 1)}>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      )
    }
    case 'letter':
      return data.letter ? (
        <div className={`tp-letter tp-v-${item.voice}${item.sheet ? ' has-box' : ''}`} style={{ '--size': item.size, color: c(item.color), ...boxStyle(item.sheet) } as Vars}>
          <Letter shot={data.letter} />
        </div>
      ) : null
    case 'ending':
      return data.wish && actions ? <Ending shot={data.wish} actions={actions} leaving={leaving} button={item.button} /> : null
    case 'credits':
      return data.credits ? <Credits shot={data.credits} item={item} actions={actions} leaving={leaving} /> : null
  }
}

/**
 * Shrink each fitted thing until it sits inside its area: neither taller nor
 * wider than the cell it was given. Measured from layout, so nothing still
 * arriving counts. Runs again when the frame changes size or a face arrives.
 */
function useFit(key: string) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    let live = true
    const run = () => {
      if (!live) return
      for (const cell of Array.from(root.querySelectorAll<HTMLElement>('.tp-cell'))) {
        const el = cell.querySelector<HTMLElement>(':scope > .tp-turn > .tp-fit')
        if (!el) continue
        const least = Number(el.dataset.min ?? 0.5)
        let fit = 1
        el.style.setProperty('--fit', '1')
        // A panel is as tall as its area whatever is in it, so what it holds is measured instead.
        const panel = el.classList.contains('is-stretch')
        const inside = () => Array.from(el.children).reduce((sum, child) => sum + (child as HTMLElement).offsetHeight, 0) + (el.children.length - 1) * parseFloat(getComputedStyle(el).rowGap || '0') + parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom)
        const over = () => (panel ? inside() > el.clientHeight + 1 : el.offsetHeight > cell.clientHeight + 1) || el.scrollWidth > el.clientWidth + 1 || el.scrollWidth > cell.clientWidth + 1 || el.offsetWidth > cell.clientWidth + 1
        // Words are shrunk before any one of them is broken in two: while it is fitted, a long word may not break.
        el.classList.add('tp-whole')
        while (fit > least && over()) {
          fit = Math.max(least, fit - 0.04)
          el.style.setProperty('--fit', fit.toFixed(2))
        }
        // A word still too long at its smallest is broken, as the last resort.
        if (over()) el.classList.remove('tp-whole')
        // Still too much: the gate reads this and turns the template away.
        el.dataset.over = over() ? '1' : ''
      }
    }
    run()
    const watch = new ResizeObserver(run)
    watch.observe(root)
    void document.fonts?.ready.then(run)
    document.fonts?.addEventListener?.('loadingdone', run)
    return () => {
      live = false
      watch.disconnect()
      document.fonts?.removeEventListener?.('loadingdone', run)
    }
  }, [key])
  return ref
}

const VALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' }

/** One page, drawn. `actions` are the film's (the ending's button, the credits' replay); a still passes none. */
export function TemplatePage({ template, data, actions, leaving = false }: { template: Template; data: PageData; actions?: ShotActions; leaving?: boolean }) {
  const page: Page | undefined = template.pages[data.kind] ?? (data.kind === 'itemLoud' ? template.pages.item : undefined)
  const ref = useFit(`${template.id}-${data.kind}-${JSON.stringify(data.words)}-${data.list?.shown ?? ''}`)
  useEffect(() => void loadFonts(template), [template])
  if (!page) return null
  const items = itemsFor(page, Boolean(data.photo))
  const ground: Vars = page.ground ? groundVars(page.ground) : {}
  const blurred = page.ground?.photo && data.photo
  const sheet = template.sheet
  const grid = (
    <div className="tp-grid" style={{ ...gridVars('w', page.grid.wide), ...gridVars('t', page.grid.tall) }}>
      {items.map((item, i) => {
        const piece = <Piece item={item} data={data} actions={actions} leaving={leaving} />
        if (!piece) return null
        const group = item as GroupItem
        const justify = item.is === 'text' || item.is === 'group' || item.is === 'list' || item.is === 'pips' ? (VALIGN[(group.align ?? 'start') as keyof typeof VALIGN] ?? 'flex-start') : 'center'
        const align = item.is === 'text' || item.is === 'group' ? VALIGN[(group.valign ?? 'center') as keyof typeof VALIGN] : 'center'
        return (
          <div key={i} className={`tp-cell tp-is-${item.is} tp-in-${item.enter ?? (item.is === 'shape' ? 'none' : 'fade')}`} data-is={item.is} style={{ '--aw': areaOf(item.at.wide), '--at': areaOf(item.at.tall), '--n': i, justifyContent: justify, alignItems: align } as Vars}>
            <div className="tp-turn" style={item.rotate ? { transform: `rotate(${item.rotate}deg)` } : undefined}>
              {piece}
            </div>
          </div>
        )
      })}
    </div>
  )
  return (
    <div ref={ref} className={`tp tp-page-${data.kind}${page.ground ? ' has-ground' : ''}`} data-page={data.kind} data-tx={(page.ground ?? template.ground).texture ?? 'none'} style={ground}>
      {blurred && (
        <div className="tp-blur" aria-hidden="true">
          <img src={data.photo!.src} alt="" />
        </div>
      )}
      {sheet ? (
        <div className="tp-sheet" data-tx={sheet.ground?.texture ?? 'none'} style={{ '--inset': `calc(var(--u) * ${sheet.inset[0]}) calc(var(--u) * ${sheet.inset[1]})`, ...boxStyle({ ...sheet.box, pad: 0 }), ...(sheet.ground ? groundVars(sheet.ground) : {}) } as Vars}>
          {grid}
        </div>
      ) : (
        grid
      )}
    </div>
  )
}
