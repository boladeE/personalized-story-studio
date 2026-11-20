import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Photo } from '../story/types'
import { Choice, FlagIcon, Letter, Type, vars } from './shots'
import type { ShotActions } from './shots'
import type { Shot } from './timeline'

/**
 * The Scrapbook: the same shots as any film, drawn as pages of a handmade
 * album. Photos are prints held down with tape, corners and clips; the
 * sender's short lines are handwriting; longer words are typed on slips of
 * paper. Between shots the page turns, and a list builds on the page it is on.
 *
 * As everywhere in the film, visible words are hidden from screen readers:
 * the film announces each shot's text once through its own live region.
 */

type Of<K extends Shot['kind']> = Extract<Shot, { kind: K }>

/** A size step for words that must fit a fixed piece of paper. */
export function fit(text: string, steps: number[]): string {
  const at = steps.findIndex((max) => text.length <= max)
  return `fit-${at < 0 ? steps.length : at}`
}

/**
 * Shrinks a page's words and photo, a step at a time, until they fit the page.
 * Most pages fit as designed; this is for a long story on a small screen.
 * The stylesheet multiplies its sizes by `--fit`.
 */
function useFit<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const page = el?.closest<HTMLElement>('.shot')
    if (!el || !page) return
    let live = true
    const fitNow = () => {
      if (!live) return
      const style = getComputedStyle(page)
      const room = page.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      const parts = Array.from(el.children) as HTMLElement[]
      // Layout boxes, so a print that is still dropping in or sits at a tilt doesn't count as overflow.
      const needed = () => Math.max(...parts.map((c) => c.offsetTop + c.offsetHeight)) - Math.min(...parts.map((c) => c.offsetTop))
      let fit = 1
      el.style.setProperty('--fit', '1')
      while (parts.length && fit > 0.56 && needed() > room + 1) {
        fit -= 0.06
        el.style.setProperty('--fit', fit.toFixed(2))
      }
    }
    fitNow()
    const watch = new ResizeObserver(fitNow)
    watch.observe(page)
    void document.fonts?.ready.then(fitNow)
    return () => {
      live = false
      watch.disconnect()
    }
  }, [key])
  return ref
}

const TILT = [-3, 2, -1.5, 3.5, -2.5, 1.5, -3.5, 2.5, -1, 3]
const tilt = (i: number) => TILT[((i % TILT.length) + TILT.length) % TILT.length]

function Tape({ className = '' }: { className?: string }) {
  return <i className={`sb-tape ${className}`} />
}

/** A pen stroke that draws itself under a line. */
function Scribble({ at = 1.2, className = '' }: { at?: number; className?: string }) {
  return (
    <svg className={`sb-scribble ${className}`} viewBox="0 0 300 22" preserveAspectRatio="none" style={vars({ '--at': `${at}s` })}>
      <path d="M5 13 C 52 3, 96 20, 148 10 S 236 5, 295 12" pathLength={1} />
    </svg>
  )
}

function Clip() {
  return (
    <svg className="sb-clip" viewBox="0 0 24 60">
      <path d="M7 44 V14 a5 5 0 0 1 10 0 V48 a8 8 0 0 1 -16 0 V16" />
    </svg>
  )
}

function Img({ photo }: { photo: Photo }) {
  return <img src={photo.src} alt="" draggable={false} />
}

export function PageBody({ shot, actions, leaving }: { shot: Shot; actions: ShotActions; leaving: boolean }) {
  switch (shot.kind) {
    case 'name':
      return <TitlePage shot={shot} />
    case 'card':
      return (
        <div className="sb-divider" aria-hidden="true">
          <p className="sb-tab sb-typed">{shot.number}</p>
          <div className="sb-band">
            <Type as="h2" text={shot.title} className="sb-hand" by="char" delay={0.55} step={48} />
          </div>
        </div>
      )
    case 'line':
      if (shot.items?.length && shot.sceneType === 'redFlags') {
        return shot.design === 'checklist' ? <Checklist items={shot.items} shown={shot.items.length} name={shot.sceneName} verdict={shot.title} /> : <Stickies items={shot.items} shown={shot.items.length} name={shot.sceneName} stamp={shot.title} />
      }
      return <LinePage shot={shot} />
    case 'photo':
      return <PhotoPage shot={shot} />
    case 'flag':
      return shot.design === 'checklist' ? <Checklist items={shot.all} shown={shot.n} name={shot.sceneName} fresh /> : <Stickies items={shot.all} shown={shot.n} name={shot.sceneName} fresh />
    case 'reason':
      return shot.design === 'cards' ? <ReasonCards shot={shot} /> : <Bunting shot={shot} />
    case 'montage':
      return shot.design === 'strip' ? <ContactSheet shot={shot} /> : <Pile shot={shot} />
    case 'letter':
      return (
        <div className="sb-letter" aria-hidden="true">
          <span className="sb-envelope">
            <i />
          </span>
          <Letter shot={shot} />
        </div>
      )
    case 'wish':
      if (shot.choices) return <Choice shot={shot} actions={actions} leaving={leaving} head="sb-hand sb-head" sub="sb-typed sb-aside" />
      return (
        <div className={`wish sb-wish${leaving ? ' is-blown' : ''}`}>
          {shot.prop === 'seal' ? (
            <div className="note" aria-hidden="true">
              <span className="halo" />
              <span className="note-back" />
              <span className="note-flap" />
              <span className="note-seal" data-flame="" />
            </div>
          ) : (
            <div className="sb-cake" aria-hidden="true">
              <div className="candle">
                <span className="halo" />
                <span className="smoke" />
                <span className="flame" data-flame="">
                  <i />
                </span>
                <span className="wick" />
                <span className="stick" />
              </div>
              <svg viewBox="0 0 220 120" className="sb-cake-art">
                <path pathLength={1} d="M22 60 C 20 44, 40 40, 110 40 S 200 44, 198 60 V 100 C 198 112, 22 112, 22 100 Z" />
                <path pathLength={1} d="M22 62 C 40 82, 56 56, 74 72 S 104 86, 122 70 S 158 56, 172 74 S 192 76, 198 62" />
                <path pathLength={1} d="M8 108 C 60 120, 160 120, 212 108" />
              </svg>
            </div>
          )}
          <div className="words center" aria-hidden="true">
            <Type as="h2" text={shot.title} className="sb-hand sb-head" by="char" delay={0.9} step={40} />
            <p className="sb-typed sb-aside sb-in" style={vars({ '--at': '2s' })}>
              {shot.body}
            </p>
          </div>
          {!leaving && (
            <button
              type="button"
              className="blow"
              onClick={(e) => actions.onBlow(e.currentTarget.closest('.wish')?.querySelector('[data-flame]')?.getBoundingClientRect() ?? null)}
            >
              {shot.action}
            </button>
          )}
        </div>
      )
    case 'reveal':
      return (
        <div className="sb-reveal" aria-hidden="true">
          <Type as="h2" text={shot.words} className={`reveal sb-hand${shot.words.length > 60 ? ' is-long' : ''}`} by="char" delay={0.5} step={46} />
          <Scribble at={0.8 + shot.words.length * 0.046} />
        </div>
      )
    case 'credits':
      return (
        <div className="credits sb-credits">
          <dl className="roll sb-libcard" aria-hidden="true">
            {shot.lines.map((line, i) => (
              <div key={line.role} style={vars({ '--i': i })}>
                <dt className="sb-typed">{line.role}</dt>
                <dd className="sb-hand">{line.name}</dd>
              </div>
            ))}
          </dl>
          <p className="credits-last sb-hand" aria-hidden="true" style={vars({ '--i': shot.lines.length })}>
            {shot.last}
          </p>
          {shot.note && (
            <p className="credits-note sb-typed" style={vars({ '--i': shot.lines.length + 1 })}>
              {shot.note}
            </p>
          )}
          {!leaving && (
            <div className="credits-next" style={vars({ '--i': shot.lines.length + 1 })}>
              {actions.ending}
              <button type="button" className={`again${actions.ending ? ' is-quiet' : ''}`} onClick={actions.onReplay}>
                Watch it again
              </button>
            </div>
          )}
        </div>
      )
  }
}

/** A line written across the page. A long passage under it (a memory with no photo) goes on a typed slip. */
function LinePage({ shot }: { shot: Of<'line'> }) {
  const ref = useFit<HTMLDivElement>(shot.id)
  const long = (shot.body?.length ?? 0) > 200
  return (
    <div ref={ref} className={`sb-line${long ? ' is-long' : ''}`} aria-hidden="true">
      {shot.kicker && <p className="sb-label sb-typed sb-in">{shot.kicker}</p>}
      <Type as="h2" text={shot.title} className={`sb-hand sb-head${shot.title.length > 44 || long ? ' is-long' : ''}`} by="char" delay={0.6} step={38} />
      <Scribble at={0.8 + shot.title.length * 0.038} />
      {shot.body && (
        <p className={`sb-typed ${long ? 'sb-slip' : 'sb-aside'} sb-in`} style={vars({ '--at': `${(1.1 + shot.title.length * 0.038).toFixed(2)}s` })}>
          {long && <Tape className="is-top" />}
          {shot.body}
        </p>
      )}
    </div>
  )
}

/** The inside cover: who it is from and for, their name in pen, and the opening line. */
function TitlePage({ shot }: { shot: Of<'name'> }) {
  const size = Math.min(26, 170 / Math.max(4, shot.name.length))
  const named = 1 + shot.name.length * 0.09
  return (
    <div className="sb-titlepage" aria-hidden="true">
      {shot.kicker && (
        <p className="sb-label sb-typed sb-in" style={vars({ '--at': '0.5s' })}>
          {shot.kicker}
        </p>
      )}
      <Type as="h2" text={shot.name} className="sb-hand sb-name" by="char" delay={1} step={90} style={{ fontSize: `min(${size.toFixed(1)}cqw, 34cqh)` }} />
      <Scribble at={named + 0.1} className="is-wide" />
      <Type text={shot.sub} className="sb-hand sb-sub" by="char" delay={named + 0.7} step={34} />
      {shot.body && (
        <p className="sb-typed sb-aside sb-in" style={vars({ '--at': `${(named + 1.2 + shot.sub.length * 0.034).toFixed(2)}s` })}>
          {shot.body}
        </p>
      )}
      <svg className="sb-seal sb-in" viewBox="0 0 120 120" style={vars({ '--at': `${(named + 1.6).toFixed(2)}s` })}>
        <defs>
          <path id="sb-seal-ring" d="M60 60 m-43 0 a43 43 0 1 1 86 0 a43 43 0 1 1 -86 0" />
        </defs>
        <circle cx="60" cy="60" r="56" />
        <circle cx="60" cy="60" r="31" />
        <text>
          <textPath href="#sb-seal-ring" textLength="262">
            MADE BY HAND • FOR ONE PERSON ONLY •
          </textPath>
        </text>
        <path className="sb-seal-heart" d="M60 73 C 44 61, 46 47, 55 47 C 58 47, 60 50, 60 52 C 60 50, 62 47, 65 47 C 74 47, 76 61, 60 73 Z" />
      </svg>
    </div>
  )
}

/** A photo with words beside it: the main character and each memory, in the design the scene was given. */
function PhotoPage({ shot }: { shot: Of<'photo'> }) {
  const design = shot.design ?? (shot.sceneType === 'spotlight' ? 'polaroid' : 'taped')
  const ref = useFit<HTMLDivElement>(`${shot.id}-${design}`)
  const { photo } = shot
  const long = (shot.body?.length ?? 0) > 520 ? ' is-epic' : (shot.body?.length ?? 0) > 230 ? ' is-long' : ''
  const head = <Type as="h2" text={shot.title} className={`sb-hand sb-head${shot.title.length > 30 ? ' is-long' : ''}`} by="char" delay={0.95} step={38} />
  const after = 1.3 + shot.title.length * 0.038
  const lean = shot.layout === 'right' ? 2.4 : -2.8

  if (design === 'clipped') {
    return (
      <div ref={ref} className={`sb-photo is-clipped layout-${shot.layout}${long}`} aria-hidden="true">
        <div className="sb-indexcard sb-in" style={vars({ '--at': '0.45s', '--r': `${-lean / 3}deg` })}>
          <figure className="sb-print sb-drop" style={vars({ '--at': '0.8s', '--r': `${lean * 1.4}deg` })}>
            <Img photo={photo} />
            <Clip />
          </figure>
          <p className="sb-typed sb-count">{shot.kicker}</p>
          {head}
          {shot.body && (
            <p className="sb-typed sb-card-body sb-in" style={vars({ '--at': `${after.toFixed(2)}s` })}>
              {shot.body}
            </p>
          )}
          {photo.caption && (
            <p className="sb-hand sb-card-caption sb-in" style={vars({ '--at': `${(after + 0.4).toFixed(2)}s` })}>
              {photo.caption}
            </p>
          )}
        </div>
      </div>
    )
  }

  let print: ReactNode
  if (design === 'polaroid') {
    print = (
      <figure className="sb-polaroid sb-drop" style={vars({ '--r': `${lean}deg` })}>
        <Tape className="is-top" />
        <div className="sb-polaroid-img">
          <Img photo={photo} />
        </div>
        <figcaption className="sb-hand">{photo.caption}</figcaption>
      </figure>
    )
  } else if (design === 'corners') {
    print = (
      <figure className="sb-mounted sb-drop" style={vars({ '--r': `${lean / 4}deg` })}>
        <div className="sb-mount">
          <Img photo={photo} />
          <i className="sb-corner tl" />
          <i className="sb-corner tr" />
          <i className="sb-corner bl" />
          <i className="sb-corner br" />
        </div>
        {photo.caption && <figcaption className="sb-typed sb-caption-strip">{photo.caption}</figcaption>}
      </figure>
    )
  } else {
    print = (
      <figure className="sb-taped sb-drop" style={vars({ '--r': `${lean}deg` })}>
        <div className="sb-print">
          <Img photo={photo} />
        </div>
        <Tape className="is-tl" />
        <Tape className="is-br" />
        {photo.caption && <figcaption className="sb-hand">{photo.caption}</figcaption>}
      </figure>
    )
  }

  return (
    <div ref={ref} className={`sb-photo is-${design} layout-${shot.layout}${long}`} aria-hidden="true">
      {print}
      <div className="sb-words">
        <p className={`sb-typed ${design === 'taped' ? 'sb-count' : 'sb-label'} sb-in`} style={vars({ '--at': '0.75s' })}>
          {shot.kicker}
        </p>
        {head}
        {design === 'corners' && (
          <svg className="sb-arrow" viewBox="0 0 120 50" style={vars({ '--at': `${after.toFixed(2)}s` })}>
            <path pathLength={1} d="M114 12 C 84 40, 46 44, 10 26" />
            <path pathLength={1} d="M26 16 L 9 26 L 25 39" />
          </svg>
        )}
        {shot.body && (
          <p className={`sb-typed ${design === 'corners' ? 'sb-ruled' : 'sb-slip'} sb-in`} style={vars({ '--at': `${after.toFixed(2)}s` })}>
            {design !== 'corners' && <Tape className="is-top" />}
            {shot.body}
          </p>
        )}
      </div>
    </div>
  )
}

/** How many notes across and down, on a wide page and on a tall one. */
const GRID: Record<number, [number, number, number, number]> = {
  1: [1, 1, 1, 1],
  2: [2, 1, 1, 2],
  3: [3, 1, 2, 2],
  4: [4, 1, 2, 2],
  5: [3, 2, 2, 3],
  6: [3, 2, 2, 3],
  7: [4, 2, 2, 4],
}

/** The red flags as sticky notes slapped onto the page one at a time, and a rubber stamp for the verdict. */
function Stickies({ items, shown, name, fresh = false, stamp }: { items: string[]; shown: number; name: string; fresh?: boolean; stamp?: string }) {
  const [cols, rows, tallCols, tallRows] = GRID[Math.min(items.length, 7)] ?? GRID[7]
  return (
    <div className="sb-flags is-stickies" aria-hidden="true">
      <p className="sb-flags-head">
        <FlagIcon />
        <span className="sb-hand">{name}</span>
        <span className="sb-typed">
          {shown} of {items.length}
        </span>
      </p>
      <ul className="sb-stickies" style={vars({ '--cols': cols, '--rows': rows, '--cols-tall': tallCols, '--rows-tall': tallRows })}>
        {items.slice(0, shown).map((text, i) => (
          <li key={i} className={`${fit(text, [24, 50, 90, 140])}${fresh && i === shown - 1 ? ' is-new' : ''}`} style={vars({ '--r': `${tilt(i)}deg`, '--n': i % 5 })} data-tone={i % 5}>
            <span className="sb-hand">{text}</span>
          </li>
        ))}
      </ul>
      {stamp && <p className="sb-stamp">{stamp}</p>}
    </div>
  )
}

const PAD_SIZES = [
  [8.5, 43],
  [10.2, 52],
  [12.5, 64],
  [15.3, 78],
  [18.6, 95],
  [22.5, 115],
  [27, 138],
]

/** The red flags as a list on a legal pad, each one ticked off, with the verdict written underneath and circled. */
function Checklist({ items, shown, name, fresh = false, verdict }: { items: string[]; shown: number; name: string; fresh?: boolean; verdict?: string }) {
  // The biggest handwriting whose lines still fit the pad: its height holds about [lines], each about [letters] wide.
  const density = PAD_SIZES.findIndex(([lines, letters]) => 3.8 + items.reduce((sum, text) => sum + Math.ceil(text.length / letters), 0) <= lines)
  // If the list still outgrows the pad (a narrow screen), it moves up by whole lines so the newest is always in view.
  const sheet = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = sheet.current
    const inner = el?.firstElementChild as HTMLElement | null
    if (!el || !inner) return
    const settle = () => {
      const line = parseFloat(getComputedStyle(inner).getPropertyValue('--lh-px')) || parseFloat(getComputedStyle(inner.querySelector('li') ?? inner).lineHeight) || 24
      const over = Math.max(0, inner.offsetHeight - el.clientHeight)
      inner.style.transform = over ? `translateY(${-Math.ceil(over / line) * line}px)` : ''
    }
    settle()
    const watch = new ResizeObserver(settle)
    watch.observe(el)
    void document.fonts?.ready.then(settle)
    return () => watch.disconnect()
  }, [shown, verdict, items])
  return (
    <div className="sb-flags is-checklist" aria-hidden="true">
      <div className={`sb-pad fit-${density < 0 ? PAD_SIZES.length - 1 : density}`}>
        <i className="sb-binder" />
        <h3 className="sb-hand">
          <FlagIcon />
          {name}
        </h3>
        <div className="sb-pad-list" ref={sheet}>
          <div>
        <ol>
          {items.slice(0, shown).map((text, i) => (
            <li key={i} className={fresh && i === shown - 1 ? 'is-new' : ''}>
              <i className="sb-box">
                <svg viewBox="0 0 24 24">
                  <path pathLength={1} d="M3 13 L 9 20 L 22 2" />
                </svg>
              </i>
              <span className="sb-hand">{text}</span>
            </li>
          ))}
        </ol>
        {verdict && (
          <p className="sb-verdict sb-hand">
            <span>{verdict}</span>
            <svg viewBox="0 0 300 80" preserveAspectRatio="none">
              <path pathLength={1} d="M150 6 C 60 4, 6 22, 8 42 C 10 66, 90 76, 160 74 C 240 72, 294 60, 292 38 C 290 14, 210 2, 128 8" />
            </svg>
          </p>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** The reasons as luggage tags: each is written on a big tag, then joins the others on a string across the page. */
function Bunting({ shot }: { shot: Of<'reason'> }) {
  const hung = shot.n - 1
  return (
    <div className="sb-reasons is-bunting" aria-hidden="true">
      <div className="sb-string">
        <svg viewBox="0 0 100 20" preserveAspectRatio="none">
          <path d="M0 1 Q 50 26 100 1" />
        </svg>
        {Array.from({ length: hung }, (_, i) => {
          const t = (i + 1) / (shot.total + 1)
          return (
            <i key={i} className={i === hung - 1 ? 'is-new' : ''} style={vars({ '--x': `${(t * 100).toFixed(2)}%`, '--sag': (4 * t * (1 - t)).toFixed(3), '--r': `${tilt(i + 2) * 1.6}deg` })}>
              {i + 1}
            </i>
          )
        })}
      </div>
      <div className={`sb-bigtag sb-drop ${fit(shot.text, [40, 80, 130])}`} style={vars({ '--r': `${tilt(shot.n) / 2}deg`, '--at': '0.15s' })}>
        <div>
          <i className="sb-hole" />
          <b className="sb-typed">
            No. {shot.n} of {shot.total}
          </b>
          <Type text={shot.text} className="sb-hand" by="char" delay={0.6} step={34} />
        </div>
      </div>
    </div>
  )
}

/** The reasons as index cards dealt onto a pile, the newest on top. */
function ReasonCards({ shot }: { shot: Of<'reason'> }) {
  const under = Math.min(shot.n - 1, 3)
  return (
    <div className="sb-reasons is-cards" aria-hidden="true">
      <div className="sb-cardpile">
        {Array.from({ length: under }, (_, i) => (
          <i key={i} className="sb-indexcard is-under" style={vars({ '--r': `${tilt(shot.n - under + i) * 1.5}deg` })} />
        ))}
        <div className={`sb-indexcard is-top sb-drop ${fit(shot.text, [40, 80, 130])}`} style={vars({ '--r': `${tilt(shot.n) * 0.6}deg`, '--at': '0.1s' })}>
          <b className="sb-hand sb-circled">{shot.n}</b>
          <Type text={shot.text} className="sb-hand" by="char" delay={0.55} step={34} />
          <span className="sb-typed sb-of">
            {shot.n} of {shot.total}
          </span>
        </div>
      </div>
    </div>
  )
}

function MontageHead({ shot }: { shot: Of<'montage'> }) {
  return (
    <div className="sb-montage-head">
      <p className="sb-label sb-typed sb-in" style={vars({ '--at': '0.45s' })}>
        {shot.kicker}
      </p>
      <Type as="h2" text={shot.title} className="sb-hand" by="char" delay={0.6} step={40} />
    </div>
  )
}

/** Where each print is stuck down (centre x %, centre y %, tilt). In an album they sit apart, so every caption can be read. */
const LAID: Record<number, Array<[number, number, number]>> = {
  1: [[50, 50, -3]],
  2: [[31, 50, -4], [69, 52, 3]],
  3: [[19, 52, -5], [50, 47, 3], [81, 53, -3]],
  4: [[14, 51, -5], [38, 46, 3], [62, 53, -2], [86, 48, 5]],
  5: [[17, 26, -5], [50, 24, 3], [83, 27, -3], [33, 76, 4], [67, 74, -4]],
  6: [[17, 26, -5], [50, 24, 3], [83, 27, -3], [18, 75, 4], [51, 77, -3], [84, 74, 5]],
}

/** The camera roll as loose prints, taped down one after another. */
function Pile({ shot }: { shot: Of<'montage'> }) {
  const count = shot.photos.length
  const spots = LAID[count] ?? LAID[6]
  return (
    <div className="sb-montage is-pile" aria-hidden="true">
      <MontageHead shot={shot} />
      <ul className="sb-pile" data-count={count}>
        {shot.photos.map((photo, i) => (
          <li key={photo.id} className={fit(photo.caption, [38, 80])} style={vars({ '--i': i, '--x': `${spots[i][0]}%`, '--y': `${spots[i][1]}%`, '--r': `${spots[i][2]}deg` })}>
            {i % 2 === 0 && <Tape className="is-top" />}
            <Img photo={photo} />
            {photo.caption && <span className="sb-hand">{photo.caption}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The camera roll as a contact sheet: every frame on black, marked up in grease pencil. */
function ContactSheet({ shot }: { shot: Of<'montage'> }) {
  const count = shot.photos.length
  const cols = count <= 4 ? count : 3
  return (
    <div className="sb-montage is-strip" aria-hidden="true">
      <MontageHead shot={shot} />
      <div className="sb-sheetwrap">
        <ul className="sb-contact sb-in" data-count={count} style={vars({ '--cols': cols, '--rows': Math.ceil(count / cols), '--cols-tall': Math.min(cols, 2), '--rows-tall': Math.ceil(count / Math.min(cols, 2)), '--at': '0.5s' })}>
          {shot.photos.map((photo, i) => (
            <li key={photo.id} style={vars({ '--i': i })}>
              <b className="sb-typed">{String(i + 4).padStart(2, '0')}A</b>
              <div className="sb-frame">
                <Img photo={photo} />
                {i === 0 && (
                  <svg viewBox="0 0 100 70" preserveAspectRatio="none">
                    <path pathLength={1} d="M52 4 C 20 2, 3 16, 4 36 C 5 58, 30 67, 54 66 C 80 65, 97 52, 96 32 C 95 12, 70 1, 40 6" />
                  </svg>
                )}
              </div>
              {photo.caption && <span className="sb-hand">{photo.caption}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** The closed album, as it sits on the desk before the film starts. */
export function CoverArt({ recipient, occasion = 'Your birthday' }: { recipient: string; occasion?: string }) {
  return (
    <div className="sb-book-float" aria-hidden="true">
      <div className="sb-book">
        <span className="sb-book-pages" />
        <span className="sb-book-cover">
          <span className="sb-plate">
            <span className="sb-typed">Made by hand for</span>
            <span className={`sb-hand sb-plate-name${recipient.length > 12 ? ' is-long' : ''}`}>{recipient}</span>
            <span className="sb-typed">{occasion}</span>
          </span>
          <span className="sb-book-hint sb-typed">Tap to open</span>
        </span>
      </div>
    </div>
  )
}
