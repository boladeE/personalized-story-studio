import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { TemplateRef } from '../story/types'
import { checkTemplate } from './check'
import { luminance, mainHues, owned, tinted } from './color'
import { templateVars } from './Page'
import type { Palette, Template } from './types'

/**
 * Templates are files the site serves (public/templates). A film names the one
 * it uses; it is fetched once, checked, and kept. A template that can't be
 * fetched or doesn't check out is null, and the film falls back to one of the
 * studio's older kinds of film so it still plays.
 */

const fetched = new Map<string, Promise<Template | null>>()
const known = new Map<string, Template | null>()

export function fetchTemplate(id: string): Promise<Template | null> {
  if (!fetched.has(id)) {
    fetched.set(
      id,
      fetch(`/templates/${id}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((raw) => (raw ? checkTemplate(raw).template : null))
        .catch(() => null)
        .then((template) => {
          known.set(id, template)
          return template
        }),
    )
  }
  return fetched.get(id)!
}

/** The template with this id: undefined while it is being fetched, null when there is none to use. */
export function useTemplate(id: string | undefined): Template | null | undefined {
  const [, redraw] = useState(0)
  useEffect(() => {
    if (!id || known.has(id)) return
    let live = true
    void fetchTemplate(id).then(() => live && redraw((n) => n + 1))
    return () => {
      live = false
    }
  }, [id])
  if (!id) return null
  return known.has(id) ? known.get(id)! : undefined
}

/** The colours one film has in a template: the palette it drew, turned toward its own photos when the template allows. */
export function coloursOf(template: Template, ref: TemplateRef): Palette {
  const palette = template.palettes[Math.abs(ref.palette) % template.palettes.length]
  // A colour the sender chose is used in every design, even one that keeps its own colours otherwise.
  return ref.own ? owned(palette, ref.own) : tinted(palette, template.tint ? ref.hues : undefined)
}

/** Everything a film in a template sets on its root, including the few colours the studio's own controls and widgets read. */
export function filmVars(template: Template, colours: Palette): CSSProperties {
  return { ...templateVars(template, colours), '--f-ink': colours.ink, '--f-soft': colours.soft, '--f-accent': colours.accent, '--f-a': colours.bg, '--f-b': colours.surface, '--f-c': colours.accent2 } as CSSProperties
}
export const isLightGround = (colours: Palette) => luminance(colours.bg) > 0.35

let listed: Promise<string[]> | null = null
/** Every template a new film may be given. */
export function templateIds(): Promise<string[]> {
  listed ??= fetch('/templates/index.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => (Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []))
    .catch(() => [])
  return listed
}

let named: Promise<Array<{ id: string; name: string }>> | null = null
/** The same templates with what the studio calls each, for a sender choosing one by eye. */
export function templateCatalogue(): Promise<Array<{ id: string; name: string }>> {
  named ??= fetch('/templates/catalogue.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => (Array.isArray(list) ? list.filter((t): t is { id: string; name: string } => Boolean(t) && typeof t.id === 'string' && typeof t.name === 'string') : []))
    .catch(() => [])
  return named
}

/** A whole number from a seed and a salt, spread evenly: which template, which palette. */
const spread = (seed: number, salt: number) => {
  let x = (seed ^ salt) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return (x ^ (x >>> 16)) >>> 0
}

/** The two main hues of a film's photos, read from small copies of up to four of them. */
export async function photoHues(photos: Array<{ src: string }>): Promise<[number, number] | undefined> {
  if (typeof document === 'undefined' || !photos.length) return undefined
  const pixels: number[] = []
  for (const photo of photos.slice(0, 4)) {
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = photo.src
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 28
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) continue
      ctx.drawImage(img, 0, 0, 28, 28)
      pixels.push(...ctx.getImageData(0, 0, 28, 28).data)
    } catch {
      // A photo that can't be read is left out of the reckoning.
    }
  }
  return mainHues(pixels) ?? undefined
}

/**
 * The template, palette and colours for one version of a film. Templates are drawn evenly
 * by the seed, so no design is favoured: that is what keeps two films from looking alike.
 * Null when the studio has no templates to give.
 */
export async function drawTemplate(seed: number, photos: Array<{ src: string }>, not?: string): Promise<TemplateRef | null> {
  const ids = (await templateIds()).filter((id) => id !== not)
  if (!ids.length) return null
  const hues = await photoHues(photos)
  return { id: ids[spread(seed, 0x9e3779b9) % ids.length], palette: spread(seed, 0x7f4a7c15) % 12, ...(hues ? { hues } : {}) }
}
