import { Media } from './Media'
import { useLayoutEffect, useRef } from 'react'
import type { Photo } from '../story/types'
import { fit } from './scrapbook'
import { Choice, FlagIcon, Letter, Type, vars, VoicePage } from './shots'
import type { ShotActions } from './shots'
import type { Shot } from './timeline'

/**
 * The Mixtape: the same shots as any film, drawn as a tape made for one
 * person. Every scene is a track. Words are set in tall capitals on flat
 * colour, the small print is typewritten like a cassette's inlay card, photos
 * are cover art, and lists are track listings. Things arrive the way a deck
 * works: they snap in, wipe across and cut on the beat.
 *
 * As everywhere in the film, visible words are hidden from screen readers:
 * the film announces each shot's text once through its own live region.
 */

type Of<K extends Shot['kind']> = Extract<Shot, { kind: K }>

const ORDINALS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const pad = (n: number) => String(n).padStart(2, '0')
/** "Scene three" is track 03 on a tape. */
const trackNo = (number: string) => pad(Math.max(0, ORDINALS.indexOf(number.replace(/^scene\s+/i, '').toLowerCase())) + 1)

/**
 * Shrinks a track's type, a step at a time, until its words fit their box:
 * neither taller than the frame nor a single word wider than its column.
 * Measured from layout boxes, so nothing still sliding in counts as overflow.
 * The stylesheet multiplies its sizes by `--fit`.
 */
function useShrink<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let live = true
    const tooTall = () => {
      const parts = (Array.from(el.children) as HTMLElement[]).filter((c) => getComputedStyle(c).position !== 'absolute')
      if (!parts.length) return false
      return Math.max(...parts.map((c) => c.offsetTop + c.offsetHeight)) - Math.min(...parts.map((c) => c.offsetTop)) > el.clientHeight + 1
    }
    const tooWide = () =>
      Array.from(el.querySelectorAll<HTMLElement>('.w')).some((word) => {
        const column = word.closest<HTMLElement>('.type')?.parentElement ?? el
        return word.offsetWidth > column.clientWidth + 1
      })
    const run = () => {
      if (!live) return
      let size = 1
      el.style.setProperty('--fit', '1')
      while (size > 0.42 && (tooTall() || tooWide())) {
        size -= 0.05
        el.style.setProperty('--fit', size.toFixed(2))
      }
    }
    run()
    const watch = new ResizeObserver(run)
    watch.observe(el)
    void document.fonts?.ready.then(run)
    return () => {
      live = false
      watch.disconnect()
    }
  }, [key])
  return ref
}

const Img = Media

/** Level meters, bouncing. */
function Meter({ bars = 14 }: { bars?: number }) {
  return (
    <span className="mx-meter">
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} style={vars({ '--i': i })} />
      ))}
    </span>
  )
}

export function MixBody({ shot, actions, leaving }: { shot: Shot; actions: ShotActions; leaving: boolean }) {
  switch (shot.kind) {
    case 'name':
      return <TitleTrack shot={shot} />
    case 'card':
      return <TrackCard shot={shot} />
    case 'line':
      if (shot.items?.length && shot.sceneType === 'redFlags' && shot.design === 'tracklist') {
        return <TrackList id={shot.id} label={shot.sceneName} items={shot.items} shown={shot.items.length} side="B" stamp={shot.title} flag />
      }
      return <LineTrack shot={shot} />
    case 'photo':
      return <PhotoTrack shot={shot} />
    case 'voice':
      return <VoicePage shot={shot} />
    case 'flag':
      return shot.design === 'tracklist' ? <TrackList id={shot.id} label={shot.label} items={shot.all} shown={shot.n} side="B" fresh flag={shot.sceneType === 'redFlags'} /> : <Shout shot={shot} />
    case 'reason':
      return shot.design === 'liner' ? <TrackList id={shot.id} label={shot.label ?? 'Reasons'} items={shot.all} shown={shot.n} side="A" fresh /> : <NowPlaying shot={shot} />
    case 'montage':
      return <Covers shot={shot} />
    case 'letter':
      return (
        <div className="mx-letter" aria-hidden="true">
          <Letter shot={shot} />
        </div>
      )
    case 'wish':
      if (shot.choices) return <Choice shot={shot} actions={actions} leaving={leaving} head="mx-caps mx-head fit-1" sub="mx-mono mx-body" />
      return (
        <div className={`wish mx-wish${leaving ? ' is-blown' : ''}`}>
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
          <div className="words center" aria-hidden="true">
            <p className="mx-mono mx-tag mx-in" style={vars({ '--at': '0.5s' })}>
              Hidden track
            </p>
            <Type as="h2" text={shot.title} className="mx-caps mx-head fit-1" by="word" delay={0.8} step={110} />
            <p className="mx-mono mx-body mx-in" style={vars({ '--at': '1.9s' })}>
              {shot.body}
            </p>
          </div>
          {!leaving && (
            <button type="button" className="blow" onClick={(e) => actions.onBlow(e.currentTarget.closest('.wish')?.querySelector('[data-flame]')?.getBoundingClientRect() ?? null)}>
              {shot.action}
            </button>
          )}
        </div>
      )
    case 'reveal':
      return <Reveal shot={shot} />
    case 'credits':
      return (
        <div className="credits mx-credits">
          <p className="mx-mono mx-tag" aria-hidden="true">
            Credits
          </p>
          <dl className="roll" aria-hidden="true">
            {shot.lines.map((line, i) => (
              <div key={line.role} style={vars({ '--i': i })}>
                <dt className="mx-mono">{line.role}</dt>
                <dd className="mx-caps">{line.name}</dd>
              </div>
            ))}
          </dl>
          <p className="credits-last mx-caps" aria-hidden="true" style={vars({ '--i': shot.lines.length })}>
            {shot.last}
          </p>
          {shot.note && (
            <p className="credits-note mx-mono" style={vars({ '--i': shot.lines.length + 1 })}>
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

/** Track one: who it is from and for, their name as tall as the frame allows, and the opening line. */
function TitleTrack({ shot }: { shot: Of<'name'> }) {
  const ref = useShrink<HTMLDivElement>(shot.id)
  // Condensed capitals are about half as wide as they are tall.
  const size = Math.min(34, 168 / Math.max(3, shot.name.length))
  const named = 0.5 + shot.name.length * 0.07
  return (
    <div ref={ref} className="mx-scene mx-title" aria-hidden="true">
      <p className="mx-mono mx-tag mx-in" style={vars({ '--at': '0.2s' })}>
        Side A{shot.kicker ? ` · ${shot.kicker}` : ''}
      </p>
      <Type as="h2" text={shot.name} className="mx-caps mx-name" by="char" delay={0.45} step={70} style={{ fontSize: `calc(min(${size.toFixed(1)}cqw, 42cqh) * var(--fit, 1))` }} />
      <div className="mx-deck mx-in" style={vars({ '--at': `${named.toFixed(2)}s` })}>
        <i className="mx-reel" />
        <span className="mx-band" />
        <i className="mx-reel" />
      </div>
      <Type text={shot.sub} className="mx-caps mx-sub" by="word" delay={named + 0.25} step={100} />
      {shot.body && (
        <p className="mx-mono mx-body mx-in" style={vars({ '--at': `${(named + 0.9 + shot.sub.split(/\s+/).length * 0.1).toFixed(2)}s` })}>
          {shot.body}
        </p>
      )}
    </div>
  )
}

/** Between scenes: the track's number and its name, with the meters up. */
function TrackCard({ shot }: { shot: Of<'card'> }) {
  const ref = useShrink<HTMLDivElement>(shot.id)
  return (
    <div ref={ref} className="mx-scene mx-card" aria-hidden="true">
      <p className="mx-mono mx-trackno mx-in" style={vars({ '--at': '0.05s' })}>
        Track {trackNo(shot.number)}
      </p>
      <Type as="h2" text={shot.title} className={`mx-caps mx-head ${fit(shot.title, [14, 24, 36])}`} by="char" delay={0.2} step={32} />
      {shot.sub && (
        <p className="mx-prose mx-card-sub mx-in" style={vars({ '--at': `${(0.5 + shot.title.length * 0.032).toFixed(2)}s` })}>
          {shot.sub}
        </p>
      )}
      <Meter />
    </div>
  )
}

function LineTrack({ shot }: { shot: Of<'line'> }) {
  const ref = useShrink<HTMLDivElement>(shot.id)
  return (
    <div ref={ref} className="mx-scene mx-line" aria-hidden="true">
      {shot.kicker && (
        <p className="mx-mono mx-tag mx-in" style={vars({ '--at': '0.1s' })}>
          {shot.kicker}
        </p>
      )}
      <Type as="h2" text={shot.title} className={`mx-caps mx-head ${fit(shot.title, [20, 40, 72, 120])}`} by="word" delay={shot.kicker ? 0.3 : 0.1} step={80} />
      {shot.body && (
        <p className="mx-mono mx-body mx-in" style={vars({ '--at': `${(0.6 + shot.title.split(/\s+/).length * 0.08).toFixed(2)}s` })}>
          {shot.body}
        </p>
      )}
    </div>
  )
}

/** A photo as cover art, with its words beside it: the main character and each memory. */
function PhotoTrack({ shot }: { shot: Of<'photo'> }) {
  const design = shot.design === 'poster' ? 'poster' : 'cover'
  const ref = useShrink<HTMLDivElement>(`${shot.id}-${design}`)
  const { photo } = shot
  const length = shot.body?.length ?? 0
  const after = 0.7 + shot.title.length * 0.03
  return (
    <div className={`mx-photo is-${design} layout-${shot.layout}`} aria-hidden="true">
      <figure className="mx-cover" style={vars({ '--r': shot.layout === 'right' ? '2deg' : '-2.4deg' })}>
        <Img photo={photo} />
        {photo.caption && design === 'cover' && <figcaption className="mx-mono">{photo.caption}</figcaption>}
      </figure>
      <div ref={ref} className={`mx-scene mx-words${length > 420 ? ' is-epic' : length > 200 ? ' is-long' : ''}`}>
        {shot.kicker && (
          <p className="mx-mono mx-tag mx-in" style={vars({ '--at': '0.45s' })}>
            {shot.kicker}
          </p>
        )}
        {/* A whole sentence beside a photo is read, not shouted: set in tall capitals it shrank to nothing. */}
        {shot.title.length > 48 ? (
          <p className="mx-prose mx-lede mx-in" style={vars({ '--at': '0.6s' })}>
            {shot.title}
          </p>
        ) : (
          <Type as="h2" text={shot.title} className={`mx-caps mx-head ${fit(shot.title, [14, 26, 44, 70])}`} by="char" delay={0.6} step={30} />
        )}
        {shot.body && (
          <p className="mx-prose mx-in" style={vars({ '--at': `${after.toFixed(2)}s` })}>
            {shot.body}
          </p>
        )}
        {photo.caption && design === 'poster' && (
          <p className="mx-mono mx-caption mx-in" style={vars({ '--at': `${(after + 0.3).toFixed(2)}s` })}>
            {photo.caption}
          </p>
        )}
      </div>
    </div>
  )
}

/** A red flag at full volume: one to a screen, on a block of colour that changes with each. */
function Shout({ shot }: { shot: Of<'flag'> }) {
  const ref = useShrink<HTMLDivElement>(shot.id)
  return (
    <div ref={ref} className="mx-scene mx-shout" data-tone={(shot.n - 1) % 4} aria-hidden="true">
      <p className="mx-mono mx-tag">
        {shot.sceneType === 'redFlags' && <FlagIcon />}
        {shot.label} · {pad(shot.n)}/{pad(shot.total)}
      </p>
      <Type as="h2" text={shot.text} className={`mx-caps mx-head ${fit(shot.text, [20, 44, 76, 120])}`} by="word" delay={0.05} step={75} />
    </div>
  )
}

/** A list as a track listing that builds: every item so far, the newest picked out. */
function TrackList({ id, label, items, shown, side, fresh = false, flag = false, stamp }: { id: string; label: string; items: string[]; shown: number; side: string; fresh?: boolean; flag?: boolean; stamp?: string }) {
  const ref = useShrink<HTMLDivElement>(`${id}-${shown}`)
  const letters = items.reduce((sum, text) => sum + text.length, 0)
  return (
    <div ref={ref} className={`mx-scene mx-list ${fit('x'.repeat(letters), [150, 250, 360, 480])}`} aria-hidden="true">
      <p className="mx-mono mx-tag">
        {flag && <FlagIcon />}
        {label} · {shown} of {items.length}
      </p>
      <ol className="mx-tracks">
        {items.slice(0, shown).map((text, i) => (
          <li key={i} className={fresh && i === shown - 1 ? 'is-new' : ''}>
            <b className="mx-mono">
              {side}
              {i + 1}
            </b>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      {stamp && <p className="mx-caps mx-stamp">{stamp}</p>}
    </div>
  )
}

/** A reason, playing: its number behind it, and a line that runs for as long as it is on screen. */
function NowPlaying({ shot }: { shot: Of<'reason'> }) {
  const ref = useShrink<HTMLDivElement>(shot.id)
  return (
    <div ref={ref} className="mx-scene mx-now" aria-hidden="true">
      <b className="mx-caps mx-ghost">{pad(shot.n)}</b>
      <p className="mx-mono mx-tag mx-in" style={vars({ '--at': '0.05s' })}>
        Now playing · {shot.n} of {shot.total}
      </p>
      <Type as="h2" text={shot.text} className={`mx-reason ${fit(shot.text, [36, 70, 120])}`} by="word" delay={0.2} step={65} />
      <div className="mx-progress">
        <i />
      </div>
    </div>
  )
}

/** The camera roll as a rack of covers, dealt in one after another. */
function Covers({ shot }: { shot: Of<'montage'> }) {
  const count = shot.photos.length
  const cols = count <= 4 ? count : Math.ceil(count / 2)
  return (
    <div className="mx-montage" aria-hidden="true">
      <div className="mx-montage-head">
        {shot.kicker && (
          <p className="mx-mono mx-tag mx-in" style={vars({ '--at': '0.1s' })}>
            {shot.kicker}
          </p>
        )}
        <Type as="h2" text={shot.title} className={`mx-caps mx-head ${fit(shot.title, [12, 22, 34])}`} by="char" delay={0.2} step={30} />
      </div>
      <ul className="mx-covers" data-count={count} style={vars({ '--cols': cols, '--rows': Math.ceil(count / cols), '--cols-tall': Math.min(count, 2), '--rows-tall': Math.ceil(count / Math.min(count, 2)) })}>
        {shot.photos.map((photo, i) => (
          <li key={photo.id} style={vars({ '--i': i, '--r': `${[-2, 1.5, -1, 2.5, -1.5, 1][i % 6]}deg` })}>
            <Img photo={photo} />
            {photo.caption && <span className="mx-mono">{photo.caption}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The sender's last line, as loud as the tape gets. */
function Reveal({ shot }: { shot: Of<'reveal'> }) {
  const ref = useShrink<HTMLDivElement>(shot.id)
  return (
    <div ref={ref} className="mx-scene mx-reveal" aria-hidden="true">
      <Type as="h2" text={shot.words} className={`reveal mx-caps mx-head ${fit(shot.words, [24, 60, 110, 170])}`} by="word" delay={0.4} step={120} />
      <span className="mx-underline" style={vars({ '--at': `${(0.7 + shot.words.split(/\s+/).length * 0.12).toFixed(2)}s` })} />
    </div>
  )
}

/** The tape itself, as it sits before the film starts. */
export function CassetteArt({ recipient, occasion = 'Your birthday' }: { recipient: string; occasion?: string }) {
  return (
    <div className="mx-tape-float" aria-hidden="true">
      <div className="mx-tape">
        <div className="mx-tape-label">
          <span className="mx-mono">A mixtape for</span>
          <span className={`mx-tape-name${recipient.length > 11 ? ' is-long' : ''}`}>{recipient}</span>
          <span className="mx-mono">{occasion} · Side A</span>
        </div>
        <div className="mx-tape-window">
          <i className="mx-reel" />
          <span className="mx-band" />
          <i className="mx-reel" />
        </div>
        <div className="mx-tape-foot">
          <i />
          <i />
        </div>
      </div>
      <span className="mx-play mx-caps">
        <i />
        Press play
      </span>
    </div>
  )
}
