import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { SAMPLE_LYRICS, SAMPLE_SOUNDTRACK } from '../story/sample'
import type { Intake } from '../story/types'
import { hasRefusedLine, LYRIC_LIMITS, lyricParts, songDetails, STEER_LIMIT, surpriseVoice, tunePreview, vibeById, VIBES, VOICES } from '../story/vibes'
import type { VibeId } from '../story/vibes'
import { DEFAULT_VIBE, useDraft } from './draft'
import type { DraftWords } from './draft'
import { Working } from './Working'

/**
 * The film's song, in the editor. The words are on ruled paper and can always be
 * typed on; over them are the three things a sender can change (the words, the
 * voice, the tune) and under them one button that records it. Nothing is lost:
 * the recordings made so far and the versions of the words can both be paged
 * through. The film keeps the song it has until a new recording is ready.
 */

const same = (a: DraftWords | null, b: DraftWords | null) => Boolean(a && b) && a!.title.trim() === b!.title.trim() && a!.lyrics.trim() === b!.lyrics.trim()
const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1)

export function SongRoom({ intake, sample }: { intake: Intake; sample: boolean }) {
  const { song, setSong, takes, words, setWords, job, plan, setPlan, songs, startSong, remakeSong, dismissJob } = useDraft()
  const recipient = intake.recipient.trim()
  const details = sample ? null : songDetails(intake)
  const track = sample ? { src: SAMPLE_SOUNDTRACK.src, label: SAMPLE_SOUNDTRACK.label, lyrics: SAMPLE_LYRICS, sung: true } : song
  const busy = job.state === 'writing' || job.state === 'singing'
  // Opened from the editor, the way back is the browser's own.
  const fromEditor = useRouterState({ select: (state) => Boolean((state.location.state as { fromEditor?: boolean } | undefined)?.fromEditor) })

  // What the recording that is playing was made with.
  const sungWords: DraftWords | null = song && song.sung !== false && song.lyrics ? { title: song.label, lyrics: song.lyrics } : null
  const sameTune = (song?.vibe as VibeId | undefined) ?? DEFAULT_VIBE
  // Who sings: what the sender chose, or what the studio chose for them.
  const voiceNow = plan.voice === 'surprise' ? surpriseVoice(intake) : plan.voice
  const [baseVoice, setBaseVoice] = useState(song?.voice ?? voiceNow)

  // What the next recording would be made with.
  const [vibe, setVibe] = useState<VibeId>(sameTune)
  const [wordless, setWordless] = useState(false)
  // Every version of the words in this sitting: the ones being sung, each rewrite, and the sender's own changes to any of them.
  const [versions, setVersions] = useState<DraftWords[]>(() => (sungWords && words && !same(sungWords, words) ? [sungWords, words] : words ? [words] : sungWords ? [sungWords] : []))
  const [at, setAt] = useState(() => Math.max(0, (sungWords && words && !same(sungWords, words) ? 2 : 1) - 1))
  const sheet = versions[at] ?? null
  const [steer, setSteer] = useState('')
  const [rewriting, setRewriting] = useState(false)
  const [tunes, setTunes] = useState(false)
  // The line that says the paper can be typed on goes once it has been.
  const [typed, setTyped] = useState(false)
  const [error, setError] = useState('')
  const [tasting, setTasting] = useState<VibeId | null>(null)
  const taste = useRef<HTMLAudioElement | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const paper = useRef<HTMLTextAreaElement>(null)
  // Test mode says so: its words and its tone are stand-ins.
  const [demo, setDemo] = useState(false)
  useEffect(() => {
    let live = true
    if (!sample)
      fetch('/api/music')
        .then((r) => r.json() as Promise<{ provider?: string }>)
        .then((s) => live && setDemo(s.provider === 'demo'))
        .catch(() => {})
    return () => {
      live = false
      taste.current?.pause()
    }
  }, [sample])

  // Another recording (a new one, or one paged to) brings its own words, voice and tune to the controls.
  const songId = song?.id
  const shown = useRef(songId)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the recording changes, with what that recording holds
  useEffect(() => {
    if (shown.current === songId) return
    shown.current = songId
    setVibe(sameTune)
    setWordless(false)
    setBaseVoice(song?.voice ?? voiceNow)
    if (song?.voice && song.voice !== voiceNow) setPlan({ ...plan, voice: song.voice })
    if (!sungWords) return
    const found = versions.findIndex((v) => same(v, sungWords))
    if (found >= 0) return setAt(found)
    setVersions([...versions, sungWords])
    setAt(versions.length)
  }, [songId])

  // The words on the paper are the draft's: they go with the sender back to the scenes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the draft's setter is stable
  useEffect(() => {
    if (!sample && sheet && !same(sheet, words)) setWords(sheet)
  }, [sheet, sample])

  // The paper grows with the words, so no line is hidden behind a scrollbar.
  const lines = sheet?.lyrics
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured again whenever the words change
  useLayoutEffect(() => {
    const fit = () => {
      const el = paper.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [lines, at])

  const stopTaste = () => {
    taste.current?.pause()
    setTasting(null)
  }
  const hear = (id: VibeId) => {
    if (tasting === id) return stopTaste()
    taste.current?.pause()
    audio.current?.pause()
    const sound = new Audio(tunePreview(id))
    sound.addEventListener('ended', () => setTasting((now) => (now === id ? null : now)))
    taste.current = sound
    setTasting(id)
    sound.play().catch(() => setTasting(null))
  }

  const write = (next: DraftWords) => {
    setTyped(true)
    setVersions((all) => all.map((v, i) => (i === at ? next : v)))
  }

  /** New words from the studio: steered by what the sender asked for, or simply another version. */
  const rewrite = async () => {
    if (!details || rewriting) return
    setRewriting(true)
    setError('')
    if (job.state === 'failed') dismissJob()
    try {
      const asked = steer.trim()
      const response = await fetch('/api/lyrics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ details, tone: 'smooth', fresh: true, ...(asked ? { steer: asked } : {}), ...(sheet ? { current: sheet.lyrics } : {}) }) })
      const body = (await response.json()) as { title?: string; lyrics?: string; error?: string }
      if (!response.ok || !body.lyrics) throw new Error(body.error ?? 'The words didn’t come through.')
      const fresh = { title: body.title ?? sheet?.title ?? '', lyrics: body.lyrics }
      // The same words again (it happens) are the version that already holds them.
      const held = versions.findIndex((v) => same(v, fresh))
      if (held >= 0) setAt(held)
      else {
        setVersions([...versions, fresh])
        setAt(versions.length)
      }
      setWordless(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The words didn’t come through.')
    } finally {
      setRewriting(false)
    }
  }

  // What has changed since the recording that is playing.
  const wordsChanged = !wordless && Boolean(sheet) && !same(sheet, sungWords)
  const silenced = wordless && song?.sung !== false
  // A voice picked where the studio had chosen for itself is a change too.
  const voiceChanged = !wordless && voiceNow !== 'surprise' && voiceNow !== baseVoice
  const tuneChanged = vibe !== sameTune
  const changed = wordsChanged || silenced || voiceChanged || tuneChanged
  const voiceName = VOICES.find((v) => v.id === voiceNow)?.name ?? ''
  const what = [silenced ? 'music only, no singing' : wordsChanged ? 'your new words' : '', voiceChanged ? lower(voiceName) : '', tuneChanged ? (vibeById(vibe)?.name ?? '') : ''].filter(Boolean)
  const with_ = changed ? `${wordsChanged ? 'with ' : ''}${what.join(', ')}` : song?.sung === false ? 'the same tune' : 'same words, voice and tune'

  const refused = sheet && !wordless ? hasRefusedLine(sheet.lyrics) : false
  const sungLines = sheet ? sheet.lyrics.split('\n').filter((line) => line.trim() && !/^\[.+\]$/.test(line.trim())).length : 0
  const canRecord = Boolean(details) && !busy && !rewriting && (wordless || (sungLines > 0 && !refused))
  const record = () => {
    if (!canRecord) return
    stopTaste()
    audio.current?.pause()
    setError('')
    setTunes(false)
    remakeSong(intake, plan, { vibe, words: wordless ? null : sheet })
  }

  const takeAt = takes.findIndex((take) => take.id === song?.id)
  const parts = track?.lyrics ? lyricParts(track.lyrics) : []
  const back = (
    <Link
      to="/preview"
      search={(was) => ({ ...was, song: undefined })}
      replace
      className="songroom-back"
      onClick={(e) => {
        if (!fromEditor) return
        e.preventDefault()
        window.history.back()
      }}
    >
      <Chevron />
      Back to the scenes
    </Link>
  )

  return (
    <main className="songroom">
      {back}
      <div className="songroom-columns">
        <div className="songroom-side">
          <section className="listen" aria-label="Listen">
            <div className="listen-head">
              <span className={`record${busy ? ' is-turning' : ''}`} aria-hidden="true">
                <i />
              </span>
              <div className="listen-name">
                <h1>{track ? track.label : `${recipient}’s song`}</h1>
              </div>
            </div>

            {track && <Player audio={audio} src={track.src} onPlay={stopTaste} />}

            {!sample && takes.length > 1 && (
              <div className="pager on-dark" role="group" aria-label="Recordings">
                <span>Recording</span>
                <button type="button" aria-label="The recording before this one" disabled={takeAt <= 0} onClick={() => setSong(takes[takeAt - 1])}>
                  <Chevron />
                </button>
                <b>
                  {takeAt + 1} of {takes.length}
                </b>
                <button type="button" className="is-next" aria-label="The next recording" disabled={takeAt < 0 || takeAt >= takes.length - 1} onClick={() => setSong(takes[takeAt + 1])}>
                  <Chevron />
                </button>
              </div>
            )}

            {!sample && job.state === 'writing' && (
              <Working seconds={26}>
                <b>Writing {recipient}’s song.</b> About a minute and a half.
              </Working>
            )}
            {!sample && job.state === 'singing' && !job.again && (
              <Working seconds={85}>
                <b>{recipient}’s song is being sung.</b> About a minute more.
              </Working>
            )}
            {!sample && job.state === 'failed' && (
              <div className="listen-failed" role="alert">
                <p>
                  <b>{job.again ? 'The new recording didn’t come through.' : `${recipient}’s song didn’t come through.`}</b> {job.error}
                  {job.again && song ? ' The film keeps the song it has.' : ''}
                </p>
                {!job.again && (
                  <button type="button" className="chip-button" onClick={() => startSong(intake, plan, true)}>
                    Try again
                  </button>
                )}
              </div>
            )}
            {!sample && !track && job.state === 'idle' && <p className="listen-note">{songs === false ? 'Songs aren’t switched on in this studio yet, so films play without music for now.' : 'Opening the music room…'}</p>}
          </section>

          {sample && (
            <section className="remake" aria-label="Your own song">
              <p className="remake-note">Start your own and the studio writes a song like this about your person.</p>
              <Link to="/start" className="button primary">
                Start yours
              </Link>
            </section>
          )}
        </div>

        <section className={`lyric-sheet${sample ? '' : ' is-paper'}`} aria-label="The words">
          {!sample && song && songs !== false && (
            <div className="song-controls">
              <div className="song-control is-words">
                <label htmlFor="song-steer">Ask for different words</label>
                <div className="song-steer">
                  <input id="song-steer" type="text" value={steer} maxLength={STEER_LIMIT} disabled={rewriting || busy} onChange={(e) => setSteer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void rewrite()} />
                  <button type="button" className="song-rewrite" disabled={rewriting || busy || !details} onClick={() => void rewrite()}>
                    <AgainIcon />
                    {rewriting ? 'Writing…' : 'Rewrite'}
                  </button>
                </div>
              </div>
              <div className="song-control">
                <span id="song-voice-label">Voice</span>
                <div className="segmented" role="group" aria-labelledby="song-voice-label">
                  {VOICES.filter((v) => v.id !== 'surprise').map((v) => (
                    <button key={v.id} type="button" aria-pressed={!wordless && voiceNow === v.id} aria-label={v.name} disabled={wordless || busy} onClick={() => setPlan({ ...plan, voice: v.id })}>
                      {v.id === 'woman' ? 'Woman' : 'Man'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="song-control">
                <span id="song-tune-label">Tune</span>
                <button type="button" className="song-tune" aria-labelledby="song-tune-label song-tune-now" aria-expanded={tunes} aria-controls="song-tunes" disabled={busy} onClick={() => (tunes ? (stopTaste(), setTunes(false)) : setTunes(true))}>
                  <span id="song-tune-now">{vibeById(vibe)?.name ?? 'Choose'}</span>
                  <Chevron />
                </button>
              </div>
            </div>
          )}

          {!sample && tunes && !busy && (
            <div id="song-tunes" className="song-tunes">
              <fieldset className="tunes">
                <legend className="visually-hidden">The tune</legend>
                {VIBES.map((v) => (
                  <div key={v.id} className="tune" data-picked={vibe === v.id || undefined}>
                    <label>
                      <input type="radio" name="tune" checked={vibe === v.id} onChange={() => setVibe(v.id)} />
                      <span>
                        <b>{v.name}</b>
                        <small>{v.feel}</small>
                      </span>
                    </label>
                    <button type="button" className="tune-play" aria-pressed={tasting === v.id} aria-label={`${tasting === v.id ? 'Stop' : 'Hear'} ${v.name}`} onClick={() => hear(v.id)}>
                      <span aria-hidden="true" className={tasting === v.id ? 'glyph-stop' : 'glyph-play'} />
                    </button>
                  </div>
                ))}
              </fieldset>
              <label className="choice wordless">
                <input type="checkbox" checked={wordless} onChange={(e) => setWordless(e.target.checked)} />
                Music only, no singing
              </label>
            </div>
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          {sample ? (
            <div className="song-lyrics">
              {parts.map((part, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one song, in order
                <div key={i} className={`lyric-part${/chorus/i.test(part.label) && !/pre/i.test(part.label) ? ' is-chorus' : ''}`}>
                  {part.label && <h3>{part.label}</h3>}
                  <p>
                    {part.lines.map((line, n) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: lines repeat in a chorus
                      <span key={n}>{line}</span>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          ) : sheet ? (
            <div className={`song-paper${wordless ? ' is-muted' : ''}`} aria-busy={rewriting}>
              <div className="song-paper-head">
                <input className="sheet-title" aria-label="Song title" value={sheet.title} maxLength={LYRIC_LIMITS.title} disabled={rewriting} onChange={(e) => write({ ...sheet, title: e.target.value })} />
                {versions.length > 1 && (
                  <div className="pager" role="group" aria-label="Versions of the words">
                    <button type="button" aria-label="The words before these" disabled={at <= 0 || rewriting} onClick={() => setAt(at - 1)}>
                      <Chevron />
                    </button>
                    <b>
                      {at + 1} of {versions.length}
                    </b>
                    <button type="button" className="is-next" aria-label="The words after these" disabled={at >= versions.length - 1 || rewriting} onClick={() => setAt(at + 1)}>
                      <Chevron />
                    </button>
                  </div>
                )}
              </div>
              {!typed && (
                <p className="song-cue">
                  <WordsIcon />
                  <span className="for-touch">Tap any line to change it</span>
                  <span className="for-mouse">Click any line to change it</span>
                </p>
              )}
              <textarea className="sheet-words" aria-label="Lyrics" ref={paper} value={sheet.lyrics} rows={10} spellCheck disabled={rewriting} onChange={(e) => write({ ...sheet, lyrics: e.target.value })} />
              {refused && (
                <p className="field-error" role="alert">
                  “Happy birthday to you” is a line from another song, and the music service won’t sing it. Try “Happy birthday, {recipient}”.
                </p>
              )}
              {demo && <p className="fine">Test mode: placeholder words and a short tone stand in for the real thing.</p>}
            </div>
          ) : (
            <div className="song-paper is-empty">
              {track?.sung === false ? (
                <button type="button" className="chip-button" onClick={() => void rewrite()} disabled={rewriting || !details}>
                  {rewriting ? 'Writing…' : `Write ${recipient}’s words`}
                </button>
              ) : (
                <p className="fine">The words appear here once the song is written.</p>
              )}
            </div>
          )}
        </section>
      </div>

      {!sample && song && songs !== false && (
        <div className="song-go">
          <button type="button" className={`song-record${changed ? ' is-new' : ''}${job.state === 'singing' && job.again ? ' is-busy' : ''}`} disabled={!canRecord} onClick={record}>
            {job.state === 'singing' && job.again ? <Spinner /> : changed ? <MicIcon /> : <AgainIcon />}
            <span>
              <b>{job.state === 'singing' && job.again ? 'Recording…' : changed ? 'Make a new recording' : 'Record it again'}</b>
              <small>{job.state === 'singing' && job.again ? 'about a minute and a half' : with_}</small>
            </span>
          </button>
        </div>
      )}
    </main>
  )
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/** The song by itself: one button to play or pause it, and a line to move along it. */
function Player({ audio, src, onPlay }: { audio: RefObject<HTMLAudioElement | null>; src: string; onPlay: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [length, setLength] = useState(0)
  // Another recording starts from its beginning, and waits to be asked.
  useEffect(() => {
    setPlaying(false)
    setTime(0)
    setLength(0)
  }, [src])
  // Leaving the room stops the song.
  useEffect(() => {
    const el = audio.current
    return () => el?.pause()
  }, [audio])
  const toggle = () => {
    const el = audio.current
    if (!el) return
    if (el.paused) {
      onPlay()
      el.play().catch(() => setPlaying(false))
    } else el.pause()
  }
  const span = length || 1
  return (
    <div className="player">
      {/* biome-ignore lint/a11y/useMediaCaption: the song's words are on this page */}
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setLength(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
      />
      <button type="button" className="player-play" aria-label={playing ? 'Pause the song' : 'Play the song'} onClick={toggle}>
        <span aria-hidden="true" className={playing ? 'glyph-pause' : 'glyph-play'} />
      </button>
      <div className="player-line">
        <input
          type="range"
          aria-label="Place in the song"
          min={0}
          max={span}
          step={0.1}
          value={Math.min(time, span)}
          disabled={!length}
          style={{ '--at': `${(Math.min(time, span) / span) * 100}%` } as CSSProperties}
          onChange={(e) => {
            const to = Number(e.target.value)
            if (audio.current) audio.current.currentTime = to
            setTime(to)
          }}
        />
        <span className="player-times">
          <span>{clock(time)}</span>
          <span>{length ? clock(length) : ''}</span>
        </span>
      </div>
    </div>
  )
}

const icon = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

const Chevron = () => (
  <svg {...icon} width={16} height={16} strokeWidth={2.4}>
    <path d="m15 5-7 7 7 7" />
  </svg>
)
const AgainIcon = () => (
  <svg {...icon}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </svg>
)
const MicIcon = () => (
  <svg {...icon}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </svg>
)
const Spinner = () => (
  <svg {...icon} className="song-spinner">
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
)
const WordsIcon = () => (
  <svg {...icon}>
    <path d="M4 20h4l11-11-4-4L4 16z" />
    <path d="m13 7 4 4" />
  </svg>
)
