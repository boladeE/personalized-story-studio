import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Frame, Story } from '../story/types'
import { AudioEngine } from './audio-engine'

interface Position {
  scene: number
  frame: number
}

declare global {
  interface Window {
    __ltAudio?: AudioEngine
  }
}

export function StoryPlayer({ story }: { story: Story }) {
  const positions = useMemo<Position[]>(
    () => story.scenes.flatMap((scene, s) => scene.frames.map((_, f) => ({ scene: s, frame: f }))),
    [story],
  )
  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [muted, setMuted] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const engine = useRef<AudioEngine | null>(null)
  const stage = useRef<HTMLDivElement>(null)

  const pos = positions[Math.min(index, positions.length - 1)]
  const scene = story.scenes[pos.scene]
  const frame = scene.frames[pos.frame]

  // A new story (Shuffle) starts again from the ticket.
  useEffect(() => {
    setIndex(0)
    setStarted(false)
    engine.current?.stop()
  }, [story])

  useEffect(() => {
    engine.current = new AudioEngine()
    window.__ltAudio = engine.current
    return () => {
      engine.current?.close()
      if (window.__ltAudio === engine.current) delete window.__ltAudio
    }
  }, [])

  const songSrc = story.soundtrack?.src
  useEffect(() => {
    if (!started) return
    if (songSrc) void engine.current?.playSong(songSrc)
    else engine.current?.play(scene.trackId)
  }, [started, scene.trackId, songSrc])

  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(positions.length - 1, next)))
      stage.current?.focus({ preventScroll: true })
    },
    [positions.length],
  )

  const begin = useCallback(async () => {
    const ok = (await engine.current?.start()) ?? false
    setAudioBlocked(!ok)
    setStarted(true)
    go(1)
  }, [go])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      engine.current?.setMuted(!m)
      return !m
    })
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.code === 'Space' && target.closest('button, a')) return
      if (event.key === 'ArrowRight' || event.code === 'Space') {
        event.preventDefault()
        if (index === 0) void begin()
        else go(index + 1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(index - 1)
      } else if (event.key.toLowerCase() === 'm' && started) {
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, begin, go, started, toggleMute])

  const sceneStarts = story.scenes.map((_, s) => positions.findIndex((p) => p.scene === s))
  const atEnd = index === positions.length - 1

  return (
    <div className="gift" data-look={story.look} data-kind={frame.kind}>
      <div
        className="gift-stage"
        ref={stage}
        tabIndex={-1}
        aria-label={`${scene.name}, part ${pos.frame + 1} of ${scene.frames.length}`}
      >
        <FrameView key={`${story.seed}-${index}`} frame={frame} onBegin={begin} />
      </div>
      {index > 0 && (
        <div className="gift-transport">
          <nav className="chapters" aria-label="Scenes">
            {story.scenes.map((s, i) => (
              <button
                key={s.id}
                className="chapter"
                aria-label={`Scene ${i + 1}: ${s.name}`}
                title={s.name}
                aria-current={i === pos.scene ? 'step' : undefined}
                onClick={() => go(sceneStarts[i])}
              />
            ))}
          </nav>
          <div className="transport-buttons">
            <button className="sound-toggle" aria-pressed={muted} onClick={toggleMute} title={audioBlocked ? 'This browser blocked sound' : undefined}>
              {muted ? 'Sound off' : audioBlocked ? 'No sound' : 'Sound on'}
            </button>
            <button onClick={() => go(index - 1)} aria-label="Previous">
              Back
            </button>
            <button onClick={() => go(index + 1)} disabled={atEnd} aria-label="Next">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FrameView({ frame, onBegin }: { frame: Frame; onBegin: () => void }) {
  switch (frame.kind) {
    case 'ticket':
      return (
        <div className="f-ticket">
          <button className="ticket" onClick={onBegin} aria-label={`Admit one: ${frame.recipient}. Tap to begin`}>
            <span className="ticket-main">
              <span className="ticket-label">A very private screening</span>
              <span className="ticket-admit">Admit one</span>
              <span className="ticket-name">{frame.recipient}</span>
              <span className="ticket-occasion">{frame.occasion}</span>
            </span>
            <span className="ticket-stub">Tap to begin</span>
          </button>
          <p className="ticket-hint">Sound on, if you can. No rushing.</p>
        </div>
      )
    case 'title':
      return (
        <div className="f-title">
          <p className="kicker">{frame.kicker}</p>
          <h2 className="gift-heading">{frame.title}</h2>
          {frame.body && <p className="gift-body">{frame.body}</p>}
        </div>
      )
    case 'photo':
      return (
        <div className={`f-photo layout-${frame.layout}`}>
          <figure className="print">
            <img src={frame.photo.src} alt={frame.photo.caption || 'A photo from the sender'} />
            {frame.photo.caption && <figcaption>{frame.photo.caption}</figcaption>}
          </figure>
          <div className="f-photo-text">
            <p className="kicker">{frame.kicker}</p>
            <h2 className="gift-heading">{frame.title}</h2>
            {frame.body && <p className="gift-body">{frame.body}</p>}
          </div>
        </div>
      )
    case 'item':
      return (
        <div className={`f-item marker-${frame.marker}`}>
          <p className="kicker">
            {frame.marker === 'flag' && <FlagIcon />}
            {frame.kicker}
            <span className="item-count">
              {frame.index + 1} of {frame.total}
            </span>
          </p>
          <p className="item-text">{frame.text}</p>
        </div>
      )
    case 'montage':
      return (
        <div className="f-montage">
          <div className="montage-head">
            <p className="kicker">{frame.kicker}</p>
            <h2 className="gift-heading">{frame.title}</h2>
          </div>
          <ul className="montage-grid" style={{ '--cols': frame.photos.length === 4 ? 2 : Math.min(3, frame.photos.length) } as CSSProperties}>
            {frame.photos.map((photo, i) => (
              <li key={photo.id} className="print" style={{ '--tilt': `${[-3, 2, -1.5, 3, -2, 1][i % 6]}deg` } as CSSProperties}>
                <img src={photo.src} alt={photo.caption || 'A photo from the sender'} />
                {photo.caption && <span>{photo.caption}</span>}
              </li>
            ))}
          </ul>
        </div>
      )
    case 'letter':
      return (
        <div className="f-letter">
          <article className="letter-sheet">
            <h2 className="letter-greeting">{frame.title}</h2>
            {frame.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p className="letter-sign">{frame.signoff}</p>
          </article>
        </div>
      )
    case 'wish':
      return <WishFrame frame={frame} />
  }
}

function WishFrame({ frame }: { frame: Extract<Frame, { kind: 'wish' }> }) {
  const [blown, setBlown] = useState(false)
  return (
    <div className={`f-wish${blown ? ' is-blown' : ''}`}>
      <div className="candle" aria-hidden="true">
        <span className="flame" />
        <span className="wick" />
        <span className="stick" />
      </div>
      <h2 className="gift-heading">{frame.title}</h2>
      <p className="gift-body">{frame.body}</p>
      {blown ? (
        <p className="wish-reveal" role="status">
          {frame.reveal}
        </p>
      ) : (
        <button className="wish-button" onClick={() => setBlown(true)}>
          Blow out the candle
        </button>
      )}
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
