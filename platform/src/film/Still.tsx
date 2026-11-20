import { Stilled } from './Media'
import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { LookId, WorldId } from '../story/types'
import { TicketArt } from './Film'
import { isLight, loudFor, paletteFor, tableFor, worldClass } from './looks'
import { CassetteArt } from './mixtape'
import { CoverArt } from './scrapbook'
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

export type StillContent = { kind: 'ticket'; recipient: string; occasion?: string } | { kind: 'shot'; shot: Shot }

export function Still({ look, content, ghost = false, world = 'screening' }: { look: LookId; content: StillContent; ghost?: boolean; world?: WorldId }) {
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => {
      el.style.setProperty('--still-scale', String(el.clientWidth / WIDTH))
      // Until it has been measured the frame is the wrong size, so the stylesheet keeps it hidden.
      el.dataset.fit = ''
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const shot = content.kind === 'shot' ? content.shot : null
  const mood = shot?.mood ?? 'warm'
  const album = world === 'scrapbook'
  const flat = world !== 'screening'
  const palette = paletteFor(look, mood, world)
  const loud = flat || !shot || shot.mood !== 'playful' ? null : shot.kind === 'flag' ? loudFor(look, shot.design === 'docket' ? 0 : shot.n - 1) : shot.kind === 'montage' ? tableFor(look) : null
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
        className={`film still${worldClass(world)}${isLight(look, world) ? ' is-light' : ''}${ghost ? ' is-ghost' : ''}`}
        data-look={look}
        data-world={world}
        data-phase={shot ? 'playing' : 'ticket'}
        data-mood={mood}
        data-kind={shot ? shot.kind : 'ticket'}
        style={style}
      >
        <div className="film-glow">{glow && <img key={glow} src={glow} alt="" />}</div>
        <div className="film-frame">
          {/* A still never plays a clip: it shows its first frame. */}
          <Stilled.Provider value={true}>{shot && <ShotView key={shot.id} shot={shot} state="current" loud={loud} actions={noop} world={world} />}</Stilled.Provider>
        </div>
        <div className="film-vignette" />
        <div className="film-grain" />
        <div className="film-bar top" />
        <div className="film-bar bottom" />
        {content.kind === 'ticket' && (
          <div className={`opening${album ? ' sb-opening' : world === 'mixtape' ? ' mx-opening' : ''}`}>
            {album ? (
              <CoverArt recipient={content.recipient} occasion={content.occasion} />
            ) : world === 'mixtape' ? (
              <CassetteArt recipient={content.recipient} occasion={content.occasion} />
            ) : (
              <TicketArt recipient={content.recipient} occasion={content.occasion} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
