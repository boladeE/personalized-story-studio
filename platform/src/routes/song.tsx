import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Working } from '../components/Working'
import { StudioHeader } from '../components/StudioHeader'
import { useDraft } from '../components/draft'
import { canGenerate } from '../story/generate'
import { hasRefusedLine, LYRIC_LIMITS, songDetails, tunePreview, vibeById, VIBES } from '../story/vibes'
import type { LyricTone, VibeId } from '../story/vibes'

export const Route = createFileRoute('/song')({
  head: () => ({ meta: [{ title: 'Their song - Little Things Digital' }] }),
  component: SongRoom,
})

type MusicStatus = { provider: 'gemini' | 'openrouter' | 'demo' | 'off'; lyrics: boolean } | null

/**
 * The song: the studio writes the words from the sender's details, the sender
 * changes what isn't right, picks a tune by ear, and hears it sung. Each
 * version is kept as a take so a miss costs nothing but another minute.
 */
function SongRoom() {
  const { intake, song, setSong, takes, addTake, words, setWords } = useDraft()
  const details = canGenerate(intake) ? songDetails(intake) : null
  const [status, setStatus] = useState<MusicStatus>(null)
  const [vibe, setVibe] = useState<VibeId>((takes[takes.length - 1]?.vibe as VibeId) ?? VIBES[0].id)
  const [wordless, setWordless] = useState(false)
  // Smooth: a spare track built on one feeling. Story: a told memory with the jokes left in.
  const [tone, setTone] = useState<LyricTone>('smooth')
  const [writing, setWriting] = useState(false)
  const [making, setMaking] = useState(false)
  const [error, setError] = useState('')
  const [tasting, setTasting] = useState<VibeId | null>(null)
  const taste = useRef<HTMLAudioElement | null>(null)
  const sheet = useRef<HTMLTextAreaElement | null>(null)

  // The sheet grows with the words, so no line is hidden behind a scrollbar.
  const lyricsText = words?.lyrics
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
  }, [lyricsText, status])

  useEffect(() => {
    let live = true
    fetch('/api/music')
      .then((r) => r.json() as Promise<MusicStatus>)
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus({ provider: 'off', lyrics: false }))
    return () => {
      live = false
      taste.current?.pause()
    }
  }, [])

  if (!details) {
    return (
      <>
        <StudioHeader />
        <main className="studio-page narrow empty">
          <h1 className="studio-title">There’s no one to sing about yet.</h1>
          <p className="lede">Add both names and a few details first. The song is written from them.</p>
          <Link to="/start" className="button primary">
            Start a film
          </Link>
        </main>
      </>
    )
  }

  const stopTaste = () => {
    taste.current?.pause()
    setTasting(null)
  }
  const hear = (id: VibeId) => {
    if (tasting === id) return stopTaste()
    taste.current?.pause()
    const audio = new Audio(tunePreview(id))
    audio.addEventListener('ended', () => setTasting((now) => (now === id ? null : now)))
    taste.current = audio
    setTasting(id)
    audio.play().catch(() => setTasting(null))
  }

  const write = async () => {
    setWriting(true)
    setError('')
    try {
      const response = await fetch('/api/lyrics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ details, tone }) })
      const body = (await response.json()) as { title?: string; lyrics?: string; error?: string }
      if (!response.ok || !body.lyrics) throw new Error(body.error ?? 'The words didn’t come through.')
      setWords({ title: body.title ?? '', lyrics: body.lyrics })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The words didn’t come through.')
    } finally {
      setWriting(false)
    }
  }

  const make = async () => {
    stopTaste()
    setMaking(true)
    setError('')
    try {
      const sung = !wordless && words?.lyrics.trim()
      const response = await fetch('/api/music', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sung ? { vibe, details, lyrics: words!.lyrics, title: words!.title } : { vibe, occasion: intake.occasion }),
      })
      const body = (await response.json()) as { id?: string; src?: string; label?: string; sung?: boolean; lyrics?: string; error?: string }
      if (!response.ok || !body.id || !body.src) throw new Error(body.error ?? 'The song didn’t come through.')
      addTake({ id: body.id, src: body.src, label: body.label ?? 'Original song', sung: body.sung, lyrics: body.lyrics, vibe })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The song didn’t come through.')
    } finally {
      setMaking(false)
    }
  }

  const available = status !== null && status.provider !== 'off' && status.lyrics
  const refused = words ? hasRefusedLine(words.lyrics) : false
  const sungLines = words ? words.lyrics.split('\n').filter((line) => line.trim() && !/^\[.+\]$/.test(line.trim())).length : 0
  const canMake = available && !making && !writing && (wordless || (sungLines > 0 && !refused))
  const busy = writing || making
  const tonePicker = (
    <fieldset className="tone">
      <legend>How it’s written</legend>
      <label className="choice">
        <input type="radio" name="tone" checked={tone === 'smooth'} disabled={busy} onChange={() => setTone('smooth')} />
        Smooth: a few details, mostly feeling
      </label>
      <label className="choice">
        <input type="radio" name="tone" checked={tone === 'story'} disabled={busy} onChange={() => setTone('story')} />
        Story: a memory told, with the jokes left in
      </label>
    </fieldset>
  )

  return (
    <>
      <StudioHeader>
        <Link to="/preview" className={`button small ${song ? 'primary' : 'ghost'}`}>
          {song ? 'Play the film with this song' : 'Back to the film'}
        </Link>
      </StudioHeader>
      <main className="studio-page song-room">
        <h1 className="studio-title">{details.recipient}’s song</h1>
        <p className="lede">
          We write the words from what you told us about {details.recipient}. Change anything that isn’t right, pick a tune, then hear it sung.
        </p>

        {status === null ? (
          <p className="fine">Opening the music room…</p>
        ) : !available ? (
          <p className="notice">Songs aren’t switched on in this studio yet, so films play without music for now.</p>
        ) : (
          <div className="song-columns">
            <section className="song-sheet" aria-labelledby="sheet-heading" data-muted={wordless || undefined}>
              <h2 id="sheet-heading" className="visually-hidden">
                The words
              </h2>
              {words ? (
                <>
                  <input
                    className="sheet-title"
                    aria-label="Song title"
                    value={words.title}
                    maxLength={LYRIC_LIMITS.title}
                    disabled={busy}
                    onChange={(e) => setWords({ ...words, title: e.target.value })}
                  />
                  <textarea
                    className="sheet-words"
                    aria-label="Lyrics"
                    aria-describedby="sheet-help"
                    ref={sheet}
                    value={words.lyrics}
                    rows={12}
                    spellCheck
                    disabled={busy}
                    onChange={(e) => setWords({ ...words, lyrics: e.target.value })}
                  />
                  {refused && (
                    <p className="field-error" role="alert">
                      “Happy birthday to you” is a line from another song, and the music service won’t sing it. Try “Happy birthday, {details.recipient}”.
                    </p>
                  )}
                  <div className="sheet-foot">
                    <p id="sheet-help" className="fine">
                      One sung line per row. [Verse], [Chorus] and [Bridge] name the parts and aren’t sung.
                    </p>
                    <button type="button" className="text-button" onClick={write} disabled={busy}>
                      {writing ? 'Writing…' : 'Write a different version'}
                    </button>
                  </div>
                  {writing && (
                    <Working seconds={24}>
                      <b>Writing a new version.</b> About 20 seconds.
                    </Working>
                  )}
                  {tonePicker}
                </>
              ) : (
                <div className="sheet-empty">
                  <p>
                    The words come from the reasons, habits, memories and last line you wrote for {details.recipient}. Nothing is made up, and you can
                    change every line before it’s sung.
                  </p>
                  {tonePicker}
                  <button type="button" className={`button primary${writing ? ' is-busy' : ''}`} onClick={write} disabled={busy}>
                    {writing ? 'Writing the words…' : `Write ${details.recipient}’s song`}
                  </button>
                  {writing && (
                    <Working seconds={24}>
                      <b>Writing {details.recipient}’s song.</b> About 20 seconds.
                    </Working>
                  )}
                </div>
              )}
            </section>

            <section className="song-desk" aria-label="Tune and takes">
              <fieldset className="tunes">
                <legend>The tune</legend>
                {VIBES.map((v) => (
                  <div key={v.id} className="tune" data-picked={vibe === v.id || undefined}>
                    <label>
                      <input type="radio" name="tune" checked={vibe === v.id} disabled={making} onChange={() => setVibe(v.id)} />
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
                <p className="fine">Each sample is 16 seconds of the style. Your song gets its own melody.</p>
              </fieldset>

              <label className="choice wordless">
                <input type="checkbox" checked={wordless} disabled={making} onChange={(e) => setWordless(e.target.checked)} />
                Music only, no singing
              </label>

              <button type="button" className={`button primary block${making ? ' is-busy' : ''}`} onClick={make} disabled={!canMake}>
                {making ? 'Making the song…' : takes.length ? 'Make another take' : 'Make the song'}
              </button>
              {making && (
                <Working seconds={80}>
                  <b>{details.recipient}’s song is being sung.</b> About a minute. Keep this tab open.
                </Working>
              )}
              {!words && !wordless && <p className="fine">Write the words first, or tick “Music only”.</p>}
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}

              {takes.length > 0 && (
                <fieldset className="takes">
                  <legend>Takes</legend>
                  <ol>
                    {takes.map((take, i) => (
                      <li key={take.id} data-picked={song?.id === take.id || undefined}>
                        <label className="choice">
                          <input type="radio" name="take" checked={song?.id === take.id} onChange={() => setSong(take)} />
                          Take {i + 1}, {vibeById(take.vibe ?? '')?.name ?? take.label}
                          {take.sung === false ? ', no singing' : ''}
                        </label>
                        {/* biome-ignore lint/a11y/useMediaCaption: the lyrics are on this page */}
                        <audio controls preload="none" src={take.src} aria-label={`Take ${i + 1}`} />
                      </li>
                    ))}
                  </ol>
                  <p className="fine">The film plays the take you choose here.</p>
                </fieldset>
              )}

              <p className="fine">
                The words are drafted and the song is sung by Google’s AI models, using the names and the reasons, habits, memories and last line you
                wrote. Your letter and photos are never sent.
              </p>
              {status.provider === 'demo' && <p className="fine">Test mode: placeholder words and a short tone stand in for the real thing.</p>}
            </section>
          </div>
        )}
      </main>
    </>
  )
}
