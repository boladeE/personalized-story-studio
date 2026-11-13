import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { LookId } from '../story/types'
import { TicketArt } from './Film'
import { isLight, loudFor, paletteFor, tableFor } from './looks'
import { ShotView } from './shots'
import type { Shot } from './timeline'

/**
 * One frame of the film, standing still: the same shot components and styles
 * the film uses, drawn at a fixed size and scaled to fit its box, so a small
 * preview is the real thing in miniature. No sound, smoke or particles.
 */

const WIDTH = 960
const HEIGHT = 600
const noop = { onBlow: () => {}, onReplay: () => {}, waiting: false, ended: false }

export type StillContent = { kind: 'ticket'; recipient: string } | { kind: 'shot'; shot: Shot }

export function Still({ look, content, ghost = false }: { look: LookId; content: StillContent; ghost?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => el.style.setProperty('--still-scale', String(el.clientWidth / WIDTH))
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const shot = content.kind === 'shot' ? content.shot : null
  const mood = shot?.mood ?? 'warm'
  const palette = paletteFor(look, mood)
  const loud = !shot || shot.mood !== 'playful' ? null : shot.kind === 'flag' ? loudFor(look, shot.n - 1) : shot.kind === 'montage' ? tableFor(look) : null
  const style = {
    '--f-a': palette.a,
    '--f-b': palette.b,
    '--f-c': palette.c,
    '--f-ink': palette.ink,
    '--f-soft': palette.soft,
    '--f-accent': palette.accent,
    width: WIDTH,
    height: HEIGHT,
  } as CSSProperties
  const glow = shot?.kind === 'photo' ? shot.photo.src : null

  return (
    <div ref={box} className="still-box" aria-hidden="true" inert>
      <div
        className={`film still${isLight(look) ? ' is-light' : ''}${ghost ? ' is-ghost' : ''}`}
        data-look={look}
        data-phase={shot ? 'playing' : 'ticket'}
        data-mood={mood}
        data-kind={shot ? shot.kind : 'ticket'}
        style={style}
      >
        <div className="film-glow">{glow && <img key={glow} src={glow} alt="" />}</div>
        <div className="film-frame">{shot && <ShotView key={shot.id} shot={shot} state="current" loud={loud} actions={noop} />}</div>
        <div className="film-vignette" />
        <div className="film-grain" />
        <div className="film-bar top" />
        <div className="film-bar bottom" />
        {content.kind === 'ticket' && (
          <div className="opening">
            <TicketArt recipient={content.recipient} />
          </div>
        )}
      </div>
    </div>
  )
}
