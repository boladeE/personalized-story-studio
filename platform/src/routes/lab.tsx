import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { checkTemplate } from '../template/check'
import { tinted } from '../template/color'
import { labFilms } from '../template/fixtures'
import { measure } from '../template/measure'
import type { Problem } from '../template/measure'
import { coverOf, loadFonts, pageOf, TemplatePage, templateVars } from '../template/Page'
import type { PageData } from '../template/Page'
import type { Template } from '../template/types'

declare global {
  interface Window {
    /** A template handed to the test page by the gate, before it is saved anywhere. */
    __labTemplate?: unknown
    /** What the test page found, once everything has been drawn and measured. */
    __labReport?: { ready: boolean; problems: Problem[]; invalid: string[] }
  }
}

/**
 * The test page for templates: every page of one template, drawn on the two
 * test films, wide or as a phone, at rest. The gate opens this, reads what it
 * measured and takes the pictures a person looks through. It is not linked from
 * anywhere a sender goes.
 */
export const Route = createFileRoute('/lab')({
  validateSearch: (search: Record<string, unknown>): { t?: string; size?: 'wide' | 'tall'; palette?: number; hue?: number } => ({
    ...(typeof search.t === 'string' && /^[a-z][a-z0-9-]{2,39}$/.test(search.t) ? { t: search.t } : {}),
    ...(search.size === 'tall' ? { size: 'tall' as const } : {}),
    ...(Number.isInteger(Number(search.palette)) && Number(search.palette) > 0 ? { palette: Number(search.palette) } : {}),
    ...(search.hue !== undefined && Number(search.hue) >= 0 && Number(search.hue) < 360 ? { hue: Number(search.hue) } : {}),
  }),
  component: Lab,
})

const noop = { onBlow: () => {}, onReplay: () => {}, waiting: false, ended: false }

function Lab() {
  const { t, size = 'wide', palette = 0, hue } = Route.useSearch()
  const [raw, setRaw] = useState<unknown>(null)
  const [failed, setFailed] = useState('')
  useEffect(() => {
    if (window.__labTemplate) return setRaw(window.__labTemplate)
    if (!t) return setFailed('Name a template: /lab?t=its-id')
    fetch(`/templates/${t}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('missing'))))
      .then(setRaw, () => setFailed(`There is no template called ${t}.`))
  }, [t])
  const checked = useMemo(() => (raw ? checkTemplate(raw) : null), [raw])
  const films = useMemo(() => labFilms(), [])
  const template = checked?.template ?? null

  useEffect(() => {
    if (!checked) return
    if (!template) {
      window.__labReport = { ready: true, problems: [], invalid: checked.problems }
      return
    }
    let live = true
    const settle = async () => {
      await loadFonts(template)
      await document.fonts.ready
      await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((done) => ((img.onload = done), (img.onerror = done))))))
      // Two frames: one for the fit to run on the loaded faces, one for layout to rest.
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      await new Promise((done) => setTimeout(done, 250))
      if (live) window.__labReport = { ready: true, problems: measure(), invalid: [] }
    }
    void settle()
    return () => {
      live = false
    }
  }, [checked, template, size])

  if (failed) return <p style={{ padding: 24 }}>{failed}</p>
  if (!checked) return null
  if (!template)
    return (
      <ul style={{ padding: 24 }}>
        {checked.problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    )

  const colours = tinted(template.palettes[palette % template.palettes.length], hue === undefined ? undefined : [hue, (hue + 150) % 360])
  const [w, h] = size === 'tall' ? [390, 780] : [1280, 800]
  const vars = { ...templateVars(template, colours), '--f-ink': colours.ink, '--f-soft': colours.soft, '--f-accent': colours.accent, '--f-a': colours.bg, '--f-b': colours.surface, '--f-c': colours.accent2, '--bar': '0px', width: w, height: h } as CSSProperties
  const frames: Array<{ key: string; data: PageData }> = films.flatMap((film) => [
    { key: `${film.id}: cover`, data: coverOf(film.recipient, film.occasion, film.sender, 'Tap to begin') },
    ...film.shots.map(({ label, shot }) => ({ key: `${film.id}: ${label}`, data: pageOf(shot, template, 'Yes, obviously') })),
  ])
  return (
    <main className="tp-lab" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16, background: '#8a8a86' }}>
      {frames.map(({ key, data }) => (
        <figure key={key} style={{ margin: 0 }}>
          <figcaption style={{ font: '12px/1.6 system-ui', color: '#111' }}>{key}</figcaption>
          <div className="film tp-film" data-lab={key} data-cut={template.motion.cut} style={vars}>
            <section className="shot is-current">
              <TemplatePage template={template} data={data} actions={noop} />
            </section>
          </div>
        </figure>
      ))}
    </main>
  )
}
