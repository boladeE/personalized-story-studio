import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import type { Shot } from './timeline'

/**
 * What each kind of shot looks like. Words are split into spans so they can
 * arrive letter by letter, and so the particle layer can find every word.
 * The visible words are hidden from screen readers; the film announces each
 * shot's text once through its own live region.
 */

const vars = (v: Record<string, string | number>) => v as CSSProperties

export function Type({
  text,
  as: Tag = 'p',
  className = '',
  by = 'char',
  delay = 0,
  step,
  fx,
  fxOut,
  style,
}: {
  text: string
  style?: CSSProperties
  as?: ElementType
  className?: string
  /** Animate each letter, each word, or nothing (`still`, for words the particles draw). */
  by?: 'char' | 'word' | 'still'
  /** Seconds before the first letter. */
  delay?: number
  /** Milliseconds between letters or words. */
  step?: number
  fx?: 'gather'
  fxOut?: boolean
}) {
  let n = 0
  const tokens = text.split(/(\s+)/)
  return (
    <Tag
      className={`type type-${by} ${className}`}
      data-fx={fx}
      data-fx-out={fxOut ? '' : undefined}
      style={{ ...vars({ '--d': `${Math.round(delay * 1000)}ms`, ...(step ? { '--step': `${step}ms` } : {}) }), ...style }}
    >
      {tokens.map((token, t) => {
        if (!token.trim()) return token ? ' ' : null
        if (by === 'char') {
          return (
            <span key={t} className="w" data-w="">
              {Array.from(token).map((ch, c) => (
                <span key={c} className="ch" style={vars({ '--i': n++ })}>
                  {ch}
                </span>
              ))}
            </span>
          )
        }
        return (
          <span key={t} className="w" data-w="" style={vars({ '--i': n++ })}>
            {token}
          </span>
        )
      })}
    </Tag>
  )
}

const seconds = (text: string | undefined, perWord = 0.07) => (text ? text.split(/\s+/).length * perWord : 0)

export interface ShotActions {
  onBlow: (flame: DOMRect | null) => void
  onReplay: () => void
  waiting: boolean
  ended: boolean
}

export function ShotView({ shot, state, loud, actions }: { shot: Shot; state: 'current' | 'leaving'; loud: { bg: string; ink: string; accent: string } | null; actions: ShotActions }) {
  const style = vars({
    '--dur': `${shot.duration}s`,
    ...(loud ? { '--loud-bg': loud.bg, '--f-ink': loud.ink, '--f-soft': loud.ink, '--f-accent': loud.accent } : {}),
  })
  return (
    <section
      className={`shot shot-${shot.kind} is-${state}${loud ? ' is-loud' : ''} enter-${shot.enter} exit-${shot.exit}`}
      data-shot-kind={shot.kind}
      data-shot={shot.index}
      data-text={shot.text}
      style={style}
    >
      <ShotBody shot={shot} actions={actions} leaving={state === 'leaving'} />
    </section>
  )
}

function ShotBody({ shot, actions, leaving }: { shot: Shot; actions: ShotActions; leaving: boolean }) {
  switch (shot.kind) {
    case 'line': {
      const titleAt = shot.kicker ? 0.35 : 0.1
      return (
        <div className="words center" aria-hidden="true">
          {shot.kicker && <Type text={shot.kicker} className="kicker" by="word" step={70} />}
          <Type as="h2" text={shot.title} className={`headline${shot.title.length > 44 ? ' is-long' : ''}`} delay={titleAt} by={shot.enter === 'cut' ? 'word' : 'char'} fxOut={shot.exit === 'dissolve'} />
          {shot.body && <Type text={shot.body} className="sub" by="word" delay={titleAt + 0.5 + seconds(shot.title, 0.12)} step={55} />}
        </div>
      )
    }
    case 'name': {
      const size = Math.min(23, 150 / Math.max(4, shot.name.length))
      return (
        <div className="words center" aria-hidden="true">
          <Type as="h2" text={shot.name} className="name fx-wait" by="still" fx="gather" fxOut style={{ fontSize: `min(${size.toFixed(1)}cqw, 34cqh)` }} />
          <span className="name-rule" />
          <Type text={shot.sub} className="name-sub" by="char" delay={2.5} step={32} />
        </div>
      )
    }
    case 'card':
      return (
        <div className="words center" aria-hidden="true">
          <Type text={shot.number} className="card-number" by="char" step={40} />
          <Type as="h2" text={shot.title} className="card-title" by="char" delay={0.45} step={38} />
          <span className="card-rule" />
        </div>
      )
    case 'photo':
      return (
        <div className={`photo layout-${shot.layout}`} aria-hidden="true">
          <figure className="plate">
            <div className="plate-img">
              <img src={shot.photo.src} alt="" draggable={false} />
            </div>
            {shot.photo.caption && <figcaption>{shot.photo.caption}</figcaption>}
          </figure>
          <div className="words">
            <Type text={shot.kicker} className="kicker" by="word" delay={0.5} step={70} />
            <Type as="h2" text={shot.title} className={`headline${shot.title.length > 30 ? ' is-long' : ''}`} delay={0.75} />
            {shot.body && <Type text={shot.body} className="sub" by="word" delay={1.35 + seconds(shot.title, 0.1)} step={60} />}
          </div>
        </div>
      )
    case 'flag':
      return (
        <div className="flag" aria-hidden="true">
          <p className="flag-count">
            <b>{String(shot.n).padStart(2, '0')}</b>
            <span>of {String(shot.total).padStart(2, '0')}</span>
          </p>
          <div className="flag-main">
            <p className="flag-label">
              <FlagIcon />
              {shot.label}
            </p>
            <Type text={shot.text} className={`slam${shot.text.length > 60 ? ' is-long' : ''}`} by="word" delay={0.12} step={85} />
          </div>
        </div>
      )
    case 'reason':
      return (
        <div className="reason" aria-hidden="true">
          <span className="reason-num">{shot.n}</span>
          <div className="words center">
            <Type as="h2" text={shot.text} className={`headline${shot.text.length > 44 ? ' is-long' : ''}`} delay={0.35} />
            <p className="pips">
              {Array.from({ length: shot.total }, (_, i) => (
                <i key={i} className={i < shot.n ? 'on' : ''} />
              ))}
            </p>
          </div>
        </div>
      )
    case 'montage': {
      const count = shot.photos.length
      const spots = SPREADS[count] ?? SPREADS[6]
      return (
        <div className="montage" aria-hidden="true">
          <div className="montage-head">
            <Type text={shot.kicker} className="kicker" by="word" step={70} />
            <Type as="h2" text={shot.title} className="slam" by="word" delay={0.15} step={90} />
          </div>
          <ul className="deal" data-count={count}>
            {shot.photos.map((photo, i) => (
              <li key={photo.id} style={vars({ '--i': i, '--x': `${spots[i][0]}%`, '--y': `${spots[i][1]}%`, '--r': `${spots[i][2]}deg`, '--from': `${i % 2 ? 40 : -40}deg` })}>
                <img src={photo.src} alt="" draggable={false} />
                {photo.caption && <span>{photo.caption}</span>}
              </li>
            ))}
          </ul>
        </div>
      )
    }
    case 'letter':
      return <Letter shot={shot} />
    case 'wish':
      return (
        <div className={`wish${leaving ? ' is-blown' : ''}`}>
          <div className="candle" aria-hidden="true">
            <span className="halo" />
            <span className="smoke" />
            <span className="flame" data-flame="">
              <i />
            </span>
            <span className="wick" />
            <span className="stick" />
          </div>
          <div className="words center" aria-hidden="true">
            <Type as="h2" text={shot.title} className="headline" delay={0.9} />
            <Type text={shot.body} className="sub" by="word" delay={1.9} step={60} />
          </div>
          {!leaving && (
            <button
              type="button"
              className="blow"
              onClick={(e) => actions.onBlow(e.currentTarget.closest('.wish')?.querySelector('[data-flame]')?.getBoundingClientRect() ?? null)}
            >
              Blow out the candle
            </button>
          )}
        </div>
      )
    case 'reveal':
      return (
        <div className="words center" aria-hidden="true">
          <Type as="h2" text={shot.words} className={`reveal fx-wait${shot.words.length > 60 ? ' is-long' : ''}`} by="still" fx="gather" />
        </div>
      )
    case 'credits':
      return (
        <div className="credits">
          <dl className="roll" aria-hidden="true">
            {shot.lines.map((line, i) => (
              <div key={line.role} style={vars({ '--i': i })}>
                <dt>{line.role}</dt>
                <dd>{line.name}</dd>
              </div>
            ))}
          </dl>
          <p className="credits-last" aria-hidden="true" style={vars({ '--i': shot.lines.length })}>
            {shot.last}
          </p>
          {!leaving && (
            <button type="button" className="again" style={vars({ '--i': shot.lines.length + 1 })} onClick={actions.onReplay}>
              Watch it again
            </button>
          )}
        </div>
      )
  }
}

/** Where each print lands (centre x %, centre y %, tilt), by how many there are. */
const SPREADS: Record<number, Array<[number, number, number]>> = {
  1: [[50, 50, -3]],
  2: [[33, 50, -5], [67, 52, 4]],
  3: [[22, 52, -6], [50, 46, 3], [78, 54, -3]],
  4: [[20, 34, -5], [47, 62, 4], [70, 32, 6], [84, 68, -4]],
  5: [[16, 36, -6], [38, 66, 4], [55, 30, -3], [74, 64, 5], [88, 30, -5]],
  6: [[14, 32, -6], [32, 68, 5], [50, 30, 3], [56, 72, -4], [76, 34, 6], [86, 70, -5]],
}

function Letter({ shot }: { shot: Extract<Shot, { kind: 'letter' }> }) {
  const sheet = useRef<HTMLDivElement>(null)
  // The sheet scrolls by exactly as much as doesn't fit, over the life of the shot.
  useLayoutEffect(() => {
    const el = sheet.current
    if (!el) return
    const overflow = Math.max(0, el.scrollHeight - el.clientHeight)
    el.style.setProperty('--shift', `${-overflow}px`)
  }, [shot])
  let said = 0
  const total = shot.paragraphs.join(' ').split(/\s+/).length
  const span = Math.max(1, shot.duration - 6)
  return (
    <div className="letter" aria-hidden="true">
      <div className="sheet" ref={sheet}>
        <div className="sheet-in">
          <p className="greeting">{shot.greeting}</p>
          {shot.paragraphs.map((text, i) => {
            const at = 1.4 + (said / total) * span
            said += text.split(/\s+/).length
            return (
              <p key={i} className="para" style={vars({ '--at': `${at.toFixed(2)}s` })}>
                {text}
              </p>
            )
          })}
          <p className="signoff" style={vars({ '--at': `${(1.4 + span).toFixed(2)}s` })}>
            {shot.signoff}
          </p>
        </div>
      </div>
    </div>
  )
}

function FlagIcon() {
  return (
    <svg className="flag-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 1.5v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 2h9l-2.5 3.5L13 9H4z" fill="currentColor" />
    </svg>
  )
}

export function Icon({ name }: { name: 'play' | 'pause' | 'back' | 'next' | 'sound' | 'mute' | 'full' }): ReactNode {
  const paths: Record<string, ReactNode> = {
    play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" />,
    pause: <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor" />,
    back: <path d="M6 5h2.4v14H6zM20 5v14L9.5 12z" fill="currentColor" />,
    next: <path d="M15.6 5H18v14h-2.4zM4 5l10.5 7L4 19z" fill="currentColor" />,
    sound: (
      <>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        <path d="M15 9a4.2 4.2 0 0 1 0 6M17.6 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
    mute: (
      <>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
    full: <path d="M4.5 9.5v-5h5M14.5 4.5h5v5M19.5 14.5v5h-5M9.5 19.5h-5v-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
