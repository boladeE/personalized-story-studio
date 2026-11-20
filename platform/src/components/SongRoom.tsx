import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { SAMPLE_LYRICS, SAMPLE_SOUNDTRACK } from '../story/sample'
import type { Intake } from '../story/types'
import { hasRefusedLine, LYRIC_LIMITS, lyricParts, songDetails, surpriseVoice, tunePreview, vibeById, VIBES, VOICES } from '../story/vibes'
import type { LyricTone, VibeId } from '../story/vibes'
import { DEFAULT_VIBE, useDraft } from './draft'
import type { DraftWords } from './draft'
import { Working } from './Working'

/**
 * The film's song, in the editor: hear it, read its words, and have it made
 * differently. Three ways to change it, each of which records it again: the
 * same words sung afresh, another tune, or other words. The film keeps the
 * song it has until the new recording is ready.
 */

type Change = 'again' | 'sound' | 'words'

export function SongRoom({ intake, sample }: { intake: Intake; sample: boolean }) {
  const { song, setSong, takes, words, setWords, job, plan, setPlan, songs, startSong, remakeSong, dismissJob } = useDraft()
  // Who sings: what the sender chose, or what the studio chose for them.
  const voiceNow = plan.voice === 'surprise' ? surpriseVoice(intake) : plan.voice
  const recipient = intake.recipient.trim()
  const details = sample ? null : songDetails(intake)
  const [open, setOpen] = useState<Change | null>(null)
  const [vibe, setVibe] = useState<VibeId>((song?.vibe as VibeId | undefined) ?? DEFAULT_VIBE)
  const [wordless, setWordless] = useState(false)
  // Smooth: a spare track built on one feeling. Story: a told memory with the jokes left in.
  const [tone, setTone] = useState<LyricTone>('smooth')
  const [rewriting, setRewriting] = useState(false)
  // The words on the sheet have been changed here and not sung yet, so another tune sings them too.
  const [edited, setEdited] = useState(false)
  // Opened from the editor, the way back is the browser's own.
  const fromEditor = useRouterState({ select: (state) => Boolean((state.location.state as { fromEditor?: boolean } | undefined)?.fromEditor) })
  const [error, setError] = useState('')
  const [tasting, setTasting] = useState<VibeId | null>(null)
  const taste = useRef<HTMLAudioElement | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const sheet = useRef<HTMLTextAreaElement>(null)
  const sheetBox = useRef<HTMLElement>(null)
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

  const track = sample ? { src: SAMPLE_SOUNDTRACK.src, label: SAMPLE_SOUNDTRACK.label, lyrics: SAMPLE_LYRICS, sung: true } : song
  const busy = job.state === 'writing' || job.state === 'singing'
  const editing = open === 'words' && !busy

  // The sheet grows with the words, so no line is hidden behind a scrollbar.
  const draft = words?.lyrics
  useLayoutEffect(() => {
    const fit = () => {
      const el = sheet.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [draft, editing])

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

  const toggle = (change: Change) => {
    setError('')
    if (job.state === 'failed') dismissJob()
    if (open === change) return setOpen(null)
    setOpen(change)
    if (change !== 'sound') stopTaste()
    if (change === 'words') {
      // The sheet starts from the words being sung now.
      if (!words && song?.lyrics) setWords({ title: song.label, lyrics: song.lyrics })
      // On a phone the sheet is further down the page.
      window.setTimeout(() => {
        sheetBox.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        sheet.current?.focus({ preventScroll: true })
      }, 60)
    }
  }

  /** The words on the recording that is playing, to sing again or to a new tune. */
  const sungNow: DraftWords | null = song?.sung === false ? null : song?.lyrics ? { title: song.label, lyrics: song.lyrics } : words
  const record = (tune: VibeId, sing: DraftWords | null) => {
    stopTaste()
    audio.current?.pause()
    setError('')
    setOpen(null)
    setEdited(false)
    remakeSong(intake, plan, { vibe: tune, words: sing })
  }
  const write = (next: DraftWords) => {
    setEdited(true)
    setWords(next)
  }
  const sameTune = (song?.vibe as VibeId | undefined) ?? DEFAULT_VIBE

  const rewrite = async () => {
    if (!details) return
    setRewriting(true)
    setError('')
    try {
      const response = await fetch('/api/lyrics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ details, tone, fresh: true }) })
      const body = (await response.json()) as { title?: string; lyrics?: string; error?: string }
      if (!response.ok || !body.lyrics) throw new Error(body.error ?? 'The words didn’t come through.')
      write({ title: body.title ?? '', lyrics: body.lyrics })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The words didn’t come through.')
    } finally {
      setRewriting(false)
    }
  }

  const refused = words ? hasRefusedLine(words.lyrics) : false
  const sungLines = words ? words.lyrics.split('\n').filter((line) => line.trim() && !/^\[.+\]$/.test(line.trim())).length : 0
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
                <span>The song in this film</span>
                <h1>{track ? track.label : `${recipient}’s song`}</h1>
                {track && <span>{track.sung === false ? `Made for ${recipient}, without singing` : `Written and sung for ${sample ? 'this film' : recipient}`}</span>}
              </div>
            </div>

            {track && <Player audio={audio} src={track.src} onPlay={stopTaste} />}

            {!sample && takes.length > 1 && (
              <fieldset className="takes">
                <legend>{takes.length} recordings. The one you pick plays in the film.</legend>
                <div className="takes-row">
                  {takes.map((take, i) => (
                    <label key={take.id} className="take">
                      <input type="radio" name="take" checked={song?.id === take.id} onChange={() => setSong(take)} />
                      <span>
                        Take {i + 1}, {vibeById(take.vibe ?? '')?.name ?? take.label}
                        {take.sung === false ? ', no singing' : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {!sample && job.state === 'writing' && (
              <Working seconds={26}>
                <b>Writing {recipient}’s song.</b> About a minute and a half until it can be heard.
              </Working>
            )}
            {!sample && job.state === 'singing' && (
              <Working seconds={85}>
                {job.again ? (
                  <>
                    <b>The new recording is being sung.</b> About a minute and a half. The film keeps this song until it is ready.
                  </>
                ) : (
                  <>
                    <b>{recipient}’s song is being sung.</b> About a minute more.
                  </>
                )}
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

          {sample ? (
            <section className="remake" aria-label="Your own song">
              <p className="remake-note">Start your own and the studio writes a song like this about your person.</p>
              <Link to="/start" className="button primary">
                Start yours
              </Link>
            </section>
          ) : (
            song &&
            songs !== false && (
              <section className="remake" aria-label="Change the song">
                <h2>Want it different?</h2>

                <div className="remake-item">
                  <button type="button" className="remake-choice" aria-expanded={open === 'again'} aria-controls="remake-again" disabled={busy} onClick={() => toggle('again')}>
                    <AgainIcon />
                    <span>
                      <b>Sing it again</b>
                      <small>The same words, recorded fresh.</small>
                    </span>
                  </button>
                  {open === 'again' && !busy && (
                    <div id="remake-again" className="remake-more">
                      <p>A new recording of the same words to the same tune. The one you have now is kept, so you can go back to it.</p>
                      <button type="button" className="button primary" onClick={() => record(sameTune, sungNow)}>
                        Record it again
                      </button>
                    </div>
                  )}
                </div>

                <div className="remake-item">
                  <button type="button" className="remake-choice" aria-expanded={open === 'sound'} aria-controls="remake-sound" disabled={busy} onClick={() => toggle('sound')}>
                    <SoundIcon />
                    <span>
                      <b>Change the sound</b>
                      <small>Pick another tune. Hear a sample before you choose.</small>
                    </span>
                  </button>
                  {open === 'sound' && !busy && (
                    <div id="remake-sound" className="remake-more">
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
                      <p className="fine">Each sample is 16 seconds of the style. Your song gets its own melody.</p>
                      {!wordless && (
                        <fieldset className="tone song-voice">
                          <legend>Who sings it</legend>
                          {VOICES.filter((v) => v.id !== 'surprise').map((v) => (
                            <label key={v.id} className="choice">
                              <input type="radio" name="song-voice" checked={voiceNow === v.id} onChange={() => setPlan({ ...plan, voice: v.id })} />
                              {v.name}
                            </label>
                          ))}
                        </fieldset>
                      )}
                      <label className="choice wordless">
                        <input type="checkbox" checked={wordless} onChange={(e) => setWordless(e.target.checked)} />
                        Music only, no singing
                      </label>
                      {edited && !wordless && <p className="fine">It will sing the words as you changed them on the sheet.</p>}
                      <button type="button" className="button primary" disabled={!wordless && !(edited ? words : sungNow)} onClick={() => record(vibe, wordless ? null : edited ? words : sungNow)}>
                        Make it with this tune
                      </button>
                    </div>
                  )}
                </div>

                <div className="remake-item">
                  <button type="button" className="remake-choice" aria-expanded={open === 'words'} aria-controls="lyric-sheet" disabled={busy} onClick={() => toggle('words')}>
                    <WordsIcon />
                    <span>
                      <b>Rewrite the words</b>
                      <small>Change lines yourself, or have them written again.</small>
                    </span>
                  </button>
                  {editing && (
                    <div className="remake-more">
                      <p>The words are open on the sheet. Change what isn’t right, then have them sung.</p>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
                <p className="fine">Each of these makes a new recording, which takes about a minute and a half. The film keeps this song until the new one is ready.</p>
                <p className="fine">
                  The words are drafted and the song is sung by Google’s AI models, using the names and the reasons, habits, memories and last line you wrote. Your letter and photos are never sent.
                </p>
                {demo && <p className="fine">Test mode: placeholder words and a short tone stand in for the real thing.</p>}
              </section>
            )
          )}
        </div>

        <section ref={sheetBox} id="lyric-sheet" className={`lyric-sheet${editing ? ' is-open' : ''}`} aria-labelledby="lyric-heading">
          <h2 id="lyric-heading">The words</h2>
          {editing ? (
            words ? (
              <>
                <input className="sheet-title" aria-label="Song title" value={words.title} maxLength={LYRIC_LIMITS.title} disabled={rewriting} onChange={(e) => write({ ...words, title: e.target.value })} />
                <textarea className="sheet-words" aria-label="Lyrics" aria-describedby="sheet-help" ref={sheet} value={words.lyrics} rows={10} spellCheck disabled={rewriting} onChange={(e) => write({ ...words, lyrics: e.target.value })} />
                {refused && (
                  <p className="field-error" role="alert">
                    “Happy birthday to you” is a line from another song, and the music service won’t sing it. Try “Happy birthday, {recipient}”.
                  </p>
                )}
                <p id="sheet-help" className="fine">
                  One sung line per row. [Verse], [Chorus] and [Bridge] name the parts and aren’t sung.{vibe !== sameTune ? ` They will be sung to the tune you picked, ${vibeById(vibe)?.name}.` : ''}
                </p>
                <div className="sheet-actions">
                  <button type="button" className="button primary" disabled={rewriting || sungLines === 0 || refused} onClick={() => record(vibe, words)}>
                    Sing these words
                  </button>
                  <button type="button" className="text-button" onClick={() => setOpen(null)}>
                    Close without singing
                  </button>
                </div>
                <fieldset className="tone">
                  <legend>Or have them written again</legend>
                  <label className="choice">
                    <input type="radio" name="tone" checked={tone === 'smooth'} disabled={rewriting} onChange={() => setTone('smooth')} />
                    Smooth: a few details, mostly feeling
                  </label>
                  <label className="choice">
                    <input type="radio" name="tone" checked={tone === 'story'} disabled={rewriting} onChange={() => setTone('story')} />
                    Story: a memory told, with the jokes left in
                  </label>
                  <button type="button" className="chip-button" onClick={rewrite} disabled={rewriting}>
                    {rewriting ? 'Writing…' : 'Write a different version'}
                  </button>
                </fieldset>
                {rewriting && (
                  <Working seconds={24}>
                    <b>Writing a new version.</b> About 20 seconds.
                  </Working>
                )}
              </>
            ) : (
              <div className="sheet-actions">
                <p className="fine">This recording has no words yet. The studio can write them from what you told it about {recipient}.</p>
                <button type="button" className="chip-button" onClick={rewrite} disabled={rewriting}>
                  {rewriting ? 'Writing…' : `Write ${recipient}’s words`}
                </button>
              </div>
            )
          ) : parts.length ? (
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
          ) : (
            <p className="fine">{track?.sung === false ? 'This recording has no singing, so there are no words to read.' : 'The words appear here once the song is written.'}</p>
          )}
        </section>
      </div>
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
const SoundIcon = () => (
  <svg {...icon}>
    <path d="M4 8h10M18 8h2M4 16h2M10 16h10" />
    <circle cx="16" cy="8" r="2" />
    <circle cx="8" cy="16" r="2" />
  </svg>
)
const WordsIcon = () => (
  <svg {...icon}>
    <path d="M4 20h4l11-11-4-4L4 16z" />
    <path d="m13 7 4 4" />
  </svg>
)
