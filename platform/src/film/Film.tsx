import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { AudioEngine } from '../components/audio-engine'
import { trackById } from '../story/music'
import type { Story } from '../story/types'
import { Backdrop } from './backdrop'
import { isLight, loudFor, paletteFor, tableFor } from './looks'
import { Particles } from './particles'
import { Icon, ShotView } from './shots'
import { buildFilm, formatTime, shotAt } from './timeline'
import type { Shot } from './timeline'

declare global {
  interface Window {
    __ltAudio?: AudioEngine
    __ltFilm?: { time: () => number; duration: number; shot: () => number; phase: () => string }
  }
}

type Phase = 'ticket' | 'leader' | 'playing' | 'ended'

/** The gift, as a film that plays by itself once the ticket is torn. */
export function Film({ story, embedded = false }: { story: Story; embedded?: boolean }) {
  const film = useMemo(() => buildFilm(story), [story])
  const [phase, setPhase] = useState<Phase>('ticket')
  const [count, setCount] = useState(0)
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState<Shot | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [idle, setIdle] = useState(false)
  const [nowPlaying, setNowPlaying] = useState<{ title: string; by: string; key: number } | null>(null)
  const [flash, setFlash] = useState(0)

  const root = useRef<HTMLDivElement>(null)
  const hazeCanvas = useRef<HTMLCanvasElement>(null)
  const dustCanvas = useRef<HTMLCanvasElement>(null)
  const seek = useRef<HTMLInputElement>(null)
  const timeLabel = useRef<HTMLSpanElement>(null)
  const engine = useRef<AudioEngine | null>(null)
  const backdrop = useRef<Backdrop | null>(null)
  const particles = useRef<Particles | null>(null)
  const clock = useRef({ t: 0, index: 0, wishDone: false, track: '' })
  const live = useRef({ phase, paused })
  live.current = { phase, paused }
  const timers = useRef<number[]>([])
  const idleTimer = useRef(0)
  const calm = useRef(false)

  const shot = film.shots[Math.min(index, film.shots.length - 1)]
  const wishIndex = useMemo(() => film.shots.findIndex((s) => s.kind === 'wish'), [film])
  const light = isLight(story.look)
  const palette = paletteFor(story.look, shot.mood)
  const loudOf = useCallback(
    (s: Shot) => {
      if (s.mood !== 'playful') return null
      if (s.kind === 'flag') return loudFor(story.look, s.n - 1)
      // Prints need a dark table under them.
      if (s.kind === 'montage') return tableFor(story.look)
      if (s.kind === 'card' || s.kind === 'line') return loudFor(story.look, s.index)
      return null
    },
    [story.look],
  )

  /* ---------- engines ---------- */

  useEffect(() => {
    calm.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const audio = new AudioEngine()
    engine.current = audio
    window.__ltAudio = audio
    const haze = hazeCanvas.current ? new Backdrop(hazeCanvas.current) : null
    const dust = dustCanvas.current ? new Particles(dustCanvas.current) : null
    backdrop.current = haze
    particles.current = dust
    if (haze) {
      haze.still = calm.current
      haze.start()
      if (!haze.ok && hazeCanvas.current) hazeCanvas.current.style.display = 'none'
    }
    if (dust) {
      dust.calm = calm.current
      dust.start()
      dust.dust()
    }
    const onResize = () => dust?.dust()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      haze?.stop()
      dust?.stop()
      audio.close()
      if (window.__ltAudio === audio) delete window.__ltAudio
    }
  }, [])

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms))
  }

  // A new story (Shuffle, a new look or song) goes back to the ticket.
  useEffect(() => {
    clearTimers()
    clock.current = { t: 0, index: 0, wishDone: false, track: '' }
    setPhase('ticket')
    setIndex(0)
    setLeaving(null)
    setPaused(false)
    setWaiting(false)
    setCount(0)
    setNowPlaying(null)
    engine.current?.stop()
    void engine.current?.setPaused(false)
    particles.current?.clear()
    return clearTimers
  }, [film])

  useEffect(() => {
    window.__ltFilm = { time: () => clock.current.t, duration: film.duration, shot: () => clock.current.index, phase: () => live.current.phase }
    return () => {
      delete window.__ltFilm
    }
  }, [film])

  /* ---------- colour ---------- */

  useEffect(() => {
    const haze = backdrop.current
    const dust = particles.current
    const before = phase === 'ticket' || phase === 'leader'
    haze?.set(before ? paletteFor(story.look, 'warm') : palette, { cut: before })
    if (dust) {
      dust.light = light
      dust.ink = palette.ink
    }
  }, [palette, phase, story.look, light])

  /* ---------- music ---------- */

  const startMusic = useCallback(
    (s: Shot, restart: boolean) => {
      const audio = engine.current
      if (!audio) return
      if (story.soundtrack) {
        if (clock.current.track !== 'song') {
          clock.current.track = 'song'
          void audio.playSong(story.soundtrack.src)
          setNowPlaying({ title: story.soundtrack.label, by: 'An original song for this film', key: Date.now() })
        }
        return
      }
      const changed = clock.current.track !== s.trackId
      if (!changed && !restart) return
      clock.current.track = s.trackId
      audio.play(s.trackId, restart)
      if (changed) setNowPlaying({ title: trackById(s.trackId)?.title ?? 'Score', by: 'Little Things studio score', key: Date.now() })
    },
    [story.soundtrack],
  )

  /* ---------- the clock ---------- */

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'ended') return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const beat = engine.current?.beat()
      const pulse = beat && !calm.current ? (1 - beat.phase) ** 3 : 0
      if (backdrop.current) backdrop.current.pulse = pulse
      if (particles.current) particles.current.pulse = pulse
      root.current?.style.setProperty('--beat', pulse.toFixed(3))
      if (live.current.paused || live.current.phase !== 'playing') return

      const c = clock.current
      const current = film.shots[c.index]
      const end = current.start + current.duration
      let t = c.t + dt
      if (current.hold && t >= end) {
        if (current.kind === 'wish' && !c.wishDone) {
          t = end - 0.001
          setWaiting(true)
        } else if (current.index === film.shots.length - 1) {
          t = end
          setPhase('ended')
        }
      }
      c.t = t
      const next = shotAt(film, t)
      if (next.index !== c.index) {
        c.index = next.index
        setLeaving(current)
        setIndex(next.index)
      }
      if (seek.current && document.activeElement !== seek.current) seek.current.value = String(t)
      if (timeLabel.current) timeLabel.current.textContent = `${formatTime(t)} / ${formatTime(film.duration)}`
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, film])

  // What happens as one shot hands over to the next.
  useLayoutEffect(() => {
    if (phase !== 'playing') return
    const stage = root.current
    const dust = particles.current
    if (!stage) return
    startMusic(shot, false)
    const gone = stage.querySelector<HTMLElement>('.shot.is-leaving [data-fx-out]')
    if (gone && leaving?.exit === 'dissolve' && dust && !calm.current) {
      dust.scatter(gone)
      gone.classList.add('is-gone')
    }
    const arriving = stage.querySelector<HTMLElement>('.shot.is-current [data-fx="gather"]')
    if (arriving) {
      if (dust && !calm.current) requestAnimationFrame(() => dust.gather(arriving, () => arriving.classList.add('is-solid')))
      else arriving.classList.add('is-solid')
    }
    if (shot.kind === 'reveal') dust?.confetti([palette.accent, palette.ink, '#c22a59', '#f2c26b'], 7)
    if (shot.enter === 'cut' && !calm.current) setFlash((n) => n + 1)
    if (!leaving) return
    const id = window.setTimeout(() => setLeaving((l) => (l === leaving ? null : l)), leaving.kind === 'wish' ? 2400 : 1100)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, film])

  /* ---------- controls ---------- */

  const jump = useCallback(
    (to: number) => {
      const target = film.shots[Math.max(0, Math.min(film.shots.length - 1, to))]
      const c = clock.current
      c.t = target.start
      c.index = target.index
      c.wishDone = wishIndex >= 0 && target.index > wishIndex
      particles.current?.clear()
      setLeaving(null)
      setWaiting(false)
      setIndex(target.index)
      setPhase('playing')
      startMusic(target, true)
    },
    [film, wishIndex, startMusic],
  )

  const begin = useCallback(async () => {
    if (live.current.phase !== 'ticket') return
    const ok = (await engine.current?.start()) ?? false
    setAudioBlocked(!ok)
    const play = () => {
      clock.current = { t: 0, index: 0, wishDone: false, track: '' }
      setLeaving(null)
      setIndex(0)
      setPhase('playing')
      setFlash((n) => n + 1)
    }
    if (calm.current) return play()
    setPhase('leader')
    // The ticket tears, then a film leader counts in.
    const beat = 780
    ;[3, 2, 1].forEach((n, i) =>
      later(1250 + i * beat, () => {
        setCount(n)
        engine.current?.blip(n === 1 ? 880 : 440, n === 1 ? 0.22 : 0.1)
      }),
    )
    later(1250 + 3 * beat, play)
  }, [])

  const blow = useCallback(
    (flame: DOMRect | null) => {
      const c = clock.current
      const wish = film.shots[wishIndex]
      if (!wish || c.wishDone) return
      c.wishDone = true
      c.t = wish.start + wish.duration
      setWaiting(false)
      const box = dustCanvas.current?.getBoundingClientRect()
      if (flame && box) particles.current?.burst(flame.left + flame.width / 2 - box.left, flame.top + flame.height / 2 - box.top, [palette.accent, '#fff4d6', '#f2c26b'])
    },
    [film, wishIndex, palette.accent],
  )

  const togglePause = useCallback(() => {
    if (live.current.phase !== 'playing') return
    setPaused((p) => {
      void engine.current?.setPaused(!p)
      backdrop.current?.setPaused(!p)
      particles.current?.setPaused(!p)
      return !p
    })
  }, [])

  // A hidden tab stops drawing, so hold the film and the music until it's back.
  const autoPaused = useRef(false)
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (live.current.phase === 'playing' && !live.current.paused) {
          autoPaused.current = true
          togglePause()
        }
      } else if (autoPaused.current) {
        autoPaused.current = false
        if (live.current.paused) togglePause()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [togglePause])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      engine.current?.setMuted(!m)
      return !m
    })
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void root.current?.requestFullscreen?.().catch(() => {})
  }, [])

  const wake = useCallback(() => {
    setIdle(false)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIdle(true), 3200)
  }, [])
  useEffect(() => () => window.clearTimeout(idleTimer.current), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      // Inside another page, only take the keyboard while the film has focus.
      if (embedded && !root.current?.contains(target)) return
      if (target.closest('input:not([type="range"]), textarea, select, [contenteditable="true"]')) return
      if ((event.code === 'Space' || event.key === 'Enter') && target.closest('button, a')) return
      const key = event.key.toLowerCase()
      if (live.current.phase === 'ticket') {
        if (event.code === 'Space' || event.key === 'ArrowRight' || event.key === 'Enter') {
          event.preventDefault()
          void begin()
        }
        return
      }
      if (live.current.phase === 'leader') return
      if (event.code === 'Space') {
        event.preventDefault()
        togglePause()
      } else if (event.key === 'ArrowRight' && !target.closest('input')) {
        event.preventDefault()
        jump(clock.current.index + 1)
      } else if (event.key === 'ArrowLeft' && !target.closest('input')) {
        event.preventDefault()
        jump(clock.current.index - 1)
      } else if (key === 'm') toggleMute()
      else if (key === 'f') toggleFullscreen()
      else return
      wake()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [begin, jump, togglePause, toggleMute, toggleFullscreen, wake, embedded])

  const started = phase === 'playing' || phase === 'ended'
  const loud = loudOf(shot)
  const atEnd = index === film.shots.length - 1
  const style = {
    '--f-a': palette.a,
    '--f-b': palette.b,
    '--f-c': palette.c,
    '--f-ink': palette.ink,
    '--f-soft': palette.soft,
    '--f-accent': palette.accent,
  } as CSSProperties
  const actions = { onBlow: blow, onReplay: () => jump(0), waiting, ended: phase === 'ended' }
  const glow = started && shot.kind === 'photo' ? shot.photo.src : null

  return (
    <div
      ref={root}
      className={`film${paused ? ' is-paused' : ''}${idle && phase === 'playing' && !paused && !waiting ? ' is-idle' : ''}${light ? ' is-light' : ''}`}
      data-look={story.look}
      data-phase={phase}
      data-mood={shot.mood}
      data-kind={started ? shot.kind : 'ticket'}
      style={style}
      onPointerMove={wake}
      onPointerDown={wake}
    >
      <canvas ref={hazeCanvas} className="film-haze" aria-hidden="true" />
      <div className="film-glow" aria-hidden="true">
        {glow && <img key={glow} src={glow} alt="" />}
      </div>

      <div className="film-frame">
        {started && leaving && leaving.index !== shot.index && <ShotView key={leaving.id} shot={leaving} state="leaving" loud={loudOf(leaving)} actions={actions} />}
        {started && <ShotView key={shot.id} shot={shot} state="current" loud={loud} actions={actions} />}
      </div>

      <canvas ref={dustCanvas} className="film-dust" aria-hidden="true" />
      <div className="film-vignette" aria-hidden="true" />
      <div className="film-grain" aria-hidden="true" />
      <div className="film-bar top" aria-hidden="true" />
      <div className="film-bar bottom" aria-hidden="true" />
      {flash > 0 && <div key={flash} className="film-flash" aria-hidden="true" />}

      {nowPlaying && started && (
        <p key={nowPlaying.key} className="film-now" aria-hidden="true">
          <span className="note">♪</span>
          <span>
            <b>{nowPlaying.title}</b>
            <i>{nowPlaying.by}</i>
          </span>
        </p>
      )}

      {!started && <Opening recipient={story.recipient} torn={phase === 'leader'} count={count} onBegin={begin} />}

      <p className="visually-hidden" role="status" aria-live="polite">
        {started ? shot.text : ''}
      </p>

      {started && (
        <div className="film-controls" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Back" onClick={() => jump(index - 1)} disabled={index === 0}>
            <Icon name="back" />
          </button>
          <button type="button" className="play" aria-label={paused ? 'Play' : 'Pause'} onClick={togglePause} disabled={phase === 'ended'}>
            <Icon name={paused ? 'play' : 'pause'} />
          </button>
          <button type="button" aria-label="Next" onClick={() => jump(index + 1)} disabled={atEnd}>
            <Icon name="next" />
          </button>
          <div className="seek">
            <input
              ref={seek}
              type="range"
              min={0}
              max={film.duration}
              step={0.1}
              defaultValue={0}
              aria-label="Film position"
              aria-valuetext={`${shot.sceneName}, ${formatTime(shot.start)} of ${formatTime(film.duration)}`}
              onChange={(e) => jump(shotAt(film, Number(e.target.value)).index)}
            />
            <div className="marks">
              {film.scenes.map((scene, i) => (
                <button
                  key={scene.scene}
                  type="button"
                  className="mark"
                  style={{ left: `${(scene.start / film.duration) * 100}%` }}
                  aria-label={`Scene ${i + 1}: ${scene.name}`}
                  title={scene.name}
                  aria-current={scene.scene === shot.scene ? 'step' : undefined}
                  onClick={() => jump(film.shots.findIndex((s) => s.scene === scene.scene))}
                />
              ))}
            </div>
          </div>
          <span ref={timeLabel} className="time">
            0:00 / {formatTime(film.duration)}
          </span>
          <button type="button" className="sound-toggle" aria-pressed={muted} aria-label={muted ? 'Sound off' : audioBlocked ? 'No sound' : 'Sound on'} title={audioBlocked ? 'This browser blocked sound' : undefined} onClick={toggleMute}>
            <Icon name={muted || audioBlocked ? 'mute' : 'sound'} />
          </button>
          <button type="button" aria-label="Full screen" onClick={toggleFullscreen}>
            <Icon name="full" />
          </button>
        </div>
      )}
    </div>
  )
}

/** The ticket. Tapping it pushes in, tears it down the perforation and counts the film in. */
function Opening({ recipient, torn, count, onBegin }: { recipient: string; torn: boolean; count: number; onBegin: () => void }) {
  const tilt = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || torn) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width - 0.5
    const y = (event.clientY - box.top) / box.height - 0.5
    event.currentTarget.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`)
    event.currentTarget.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`)
  }
  return (
    <div className={`opening${torn ? ' is-torn' : ''}`} onPointerMove={tilt}>
      <div className="leader" aria-hidden="true">
        <span className="leader-ring" />
        <span className="leader-cross" />
        {count > 0 && <span key={count} className="leader-sweep" />}
        {count > 0 && (
          <b key={`n${count}`} className="leader-count">
            {count}
          </b>
        )}
      </div>
      <button type="button" className="ticket-hit" onClick={onBegin} disabled={torn} aria-label={`Admit one: ${recipient}. Tap to begin`} />
      <div className="ticket-float" aria-hidden="true">
        <div className="ticket">
          <span className="ticket-body">
            <span className="ticket-label">A very private screening</span>
            <span className="ticket-admit">Admit one</span>
            <span className="ticket-name">{recipient}</span>
            <span className="ticket-foot">
              <span>Front row, centre</span>
              <span>Your birthday</span>
            </span>
          </span>
          <span className="ticket-stub">
            <span>Tap to begin</span>
          </span>
        </div>
      </div>
      <p className="opening-hint">Sound on, if you can. It plays by itself.</p>
    </div>
  )
}
