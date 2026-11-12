import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { StoryPlayer } from '../components/StoryPlayer'
import { StudioHeader } from '../components/StudioHeader'
import { useDraft } from '../components/draft'
import { canGenerate, generateStory, LOOKS } from '../story/generate'
import { newSeed } from '../story/rng'
import { SAMPLE_INTAKE } from '../story/sample'
import type { LookId, Story } from '../story/types'
import { VIBES } from '../story/vibes'

export const Route = createFileRoute('/preview')({
  validateSearch: (search: Record<string, unknown>): { sample?: 1 } =>
    search.sample === 1 || search.sample === '1' ? { sample: 1 } : {},
  head: () => ({ meta: [{ title: 'Story preview - Little Things Digital' }] }),
  component: Preview,
})

function Preview() {
  const { sample } = Route.useSearch()
  const { intake, setIntake, seed, setSeed, song } = useDraft()
  const [panelOpen, setPanelOpen] = useState(false)
  const useSample = sample === 1 || !canGenerate(intake)
  const source = useSample ? SAMPLE_INTAKE : intake
  const story = useMemo<Story | null>(() => {
    if (!canGenerate(source)) return null
    const built = generateStory(source, seed)
    return song ? { ...built, soundtrack: { kind: 'song', src: song.src, label: song.label } } : built
  }, [source, seed, song])

  if (!story || (useSample && sample !== 1)) {
    return (
      <>
        <StudioHeader />
        <main className="studio-page narrow empty">
          <h1 className="studio-title">There’s no story to preview yet.</h1>
          <p className="lede">Add both names and whatever details you have, then build it.</p>
          <div className="actions">
            <Link to="/create" className="button primary">
              Start a birthday story
            </Link>
            <Link to="/preview" search={{ sample: 1 }} className="button ghost">
              Play the sample
            </Link>
          </div>
        </main>
      </>
    )
  }

  const lookName = LOOKS.find((l) => l.id === story.look)?.name
  return (
    <div className="preview-shell">
      <StudioHeader>
        <span className="preview-meta">
          {story.recipient}’s birthday, {story.scenes.length} scenes, {lookName} look
        </span>
        {useSample && <span className="sample-note">Fictional sample, AI-generated photos</span>}
        {!useSample && (
          <Link to="/create" className="button small ghost">
            Edit<span className="wide-only">&nbsp;details</span>
          </Link>
        )}
        <button
          type="button"
          className="button small ghost"
          aria-expanded={panelOpen}
          aria-controls="adjust-panel"
          onClick={() => setPanelOpen((o) => !o)}
        >
          Look &amp; music
        </button>
        <button type="button" className="button small ghost" onClick={() => setSeed(newSeed())}>
          Shuffle
        </button>
        {useSample ? (
          <Link to="/create" className="button small primary">
            Start yours
          </Link>
        ) : (
          <Link to="/send" className="button small primary">
            Send<span className="wide-only">&nbsp;this gift</span>
          </Link>
        )}
      </StudioHeader>
      <div className="preview-body">
        {panelOpen && (
          <AdjustPanel
            look={story.look}
            canChangeLook={!useSample}
            onLook={(look) => setIntake((c) => ({ ...c, look }))}
            onClose={() => setPanelOpen(false)}
          />
        )}
        <StoryPlayer story={story} />
      </div>
    </div>
  )
}

type MusicStatus = { provider: 'openrouter' | 'demo' | 'off' } | null

function AdjustPanel({
  look,
  canChangeLook,
  onLook,
  onClose,
}: {
  look: LookId
  canChangeLook: boolean
  onLook: (look: LookId) => void
  onClose: () => void
}) {
  const { song, setSong } = useDraft()
  const [status, setStatus] = useState<MusicStatus>(null)
  const [vibe, setVibe] = useState<string>(VIBES[0].id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    fetch('/api/music')
      .then((r) => r.json() as Promise<MusicStatus>)
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus({ provider: 'off' }))
    return () => {
      live = false
    }
  }, [])

  const makeSong = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/music', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vibe }),
      })
      const body = (await response.json()) as { id?: string; src?: string; label?: string; error?: string }
      if (!response.ok || !body.id || !body.src) throw new Error(body.error ?? 'The song didn’t come through.')
      setSong({ id: body.id, src: body.src, label: body.label ?? 'Original song' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The song didn’t come through.')
    } finally {
      setBusy(false)
    }
  }

  const available = status && status.provider !== 'off'
  return (
    <section id="adjust-panel" className="adjust-panel" aria-label="Look & music">
      {canChangeLook && (
        <fieldset className="adjust-group">
          <legend>Look</legend>
          <div className="adjust-options">
            {LOOKS.map((l) => (
              <label key={l.id} className="look-option" data-look={l.id}>
                <input type="radio" name="preview-look" checked={look === l.id} onChange={() => onLook(l.id)} />
                <span className="swatch" aria-hidden="true" />
                {l.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="adjust-group">
        <legend>Soundtrack</legend>
        <div className="adjust-options">
          <label className="choice">
            <input type="radio" name="soundtrack" checked={!song} onChange={() => setSong(null)} />
            Studio score
          </label>
          {song && (
            <label className="choice">
              <input type="radio" name="soundtrack" checked readOnly />
              {song.label}, original AI song
            </label>
          )}
        </div>
        {status === null ? (
          <p className="fine">Checking the music studio…</p>
        ) : available ? (
          <div className="song-maker">
            <label className="visually-hidden" htmlFor="song-style">
              Song style
            </label>
            <select id="song-style" value={vibe} onChange={(e) => setVibe(e.target.value)} disabled={busy}>
              {VIBES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <button type="button" className="button small primary" onClick={makeSong} disabled={busy}>
              {busy ? 'Writing your song…' : song ? 'Make a different song' : 'Make an original song'}
            </button>
          </div>
        ) : (
          <p className="fine">Original AI songs aren’t switched on yet, so the studio score plays.</p>
        )}
        {busy && (
          <p className="fine" role="status">
            This usually takes under a minute. Keep this tab open.
          </p>
        )}
        {status?.provider === 'demo' && <p className="fine">Test mode: songs are short placeholder tones.</p>}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <p className="fine">Tap the ticket again to hear a change.</p>
      </fieldset>
      <button type="button" className="text-button" onClick={onClose}>
        Done
      </button>
    </section>
  )
}
