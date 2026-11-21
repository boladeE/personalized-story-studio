import { contrast, paletteProblems } from './color'
import { CUTS, ENTERS, FONTS, FRAMES, OPTIONAL_PAGES, PAGE_KINDS, PAGES, SHAPES, TEXTURES, TOKENS, VOICES } from './types'
import type { Area, Box, Grid, Ground, Item, Page, PageKind, Palette, Template, Token } from './types'

/**
 * Whether something is a template the engine can draw, checked from the data
 * alone: its shape, that every page has what it must show, and that words are
 * set in a colour that can be read on what is behind them. What only shows
 * once it is drawn (words too long for their box, things on top of each other)
 * is checked on the test page (scripts/gate.mjs).
 */

export const TAGS = ['tender', 'playful', 'bold', 'quiet', 'warm', 'elegant', 'handmade', 'modern', 'retro', 'photos', 'words'] as const
const ARRANGE = ['grid', 'strip', 'pile', 'fan', 'mosaic', 'wall', 'stack']
const MARKS = ['none', 'underline', 'highlight', 'rule-above', 'rule-below', 'quotes']
const ALIGN = ['start', 'center', 'end']

/** Which pages each widget may be on. */
const HOME: Record<string, PageKind[]> = {
  photo: ['photo', 'voice'],
  photos: ['montage'],
  wave: ['voice'],
  pips: ['item', 'itemLoud', 'list', 'voice'],
  list: ['list'],
  letter: ['letter'],
  ending: ['wish'],
  credits: ['credits'],
}
/** The widget a page cannot do without. */
const MUST: Partial<Record<PageKind, string>> = { photo: 'photo', montage: 'photos', voice: 'wave', letter: 'letter', wish: 'ending', credits: 'credits', list: 'list' }

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {})
const isNum = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
const isToken = (v: unknown): v is Token => TOKENS.includes(v as Token)
const oneOf = (v: unknown, all: readonly string[]) => typeof v === 'string' && all.includes(v)

export interface Checked {
  ok: boolean
  problems: string[]
  template: Template | null
}

export function checkTemplate(raw: unknown): Checked {
  const problems: string[] = []
  const bad = (where: string, what: string) => void problems.push(`${where}: ${what}`)
  const t = obj(raw)

  if (typeof t.id !== 'string' || !/^[a-z][a-z0-9-]{2,39}$/.test(t.id)) bad('id', 'lower-case letters, digits and hyphens, 3 to 40 long')
  if (typeof t.name !== 'string' || t.name.trim().length < 2 || t.name.length > 40) bad('name', 'a short name')
  if (typeof t.idea !== 'string' || t.idea.trim().length < 20 || t.idea.length > 220) bad('idea', 'one sentence, 20 to 220 characters')
  if (!Array.isArray(t.tags) || t.tags.length < 2 || t.tags.length > 5 || !t.tags.every((tag) => oneOf(tag, TAGS))) bad('tags', `two to five of ${TAGS.join(', ')}`)
  if (typeof t.tint !== 'boolean') bad('tint', 'true or false')

  const palettes = Array.isArray(t.palettes) ? t.palettes : []
  if (palettes.length < 1 || palettes.length > 4) bad('palettes', 'one to four palettes')
  palettes.forEach((p, i) => paletteProblems(obj(p)).forEach((what) => bad(`palettes[${i}]`, what)))
  const usable = palettes.filter((p) => !paletteProblems(obj(p)).length) as Palette[]

  const voices = obj(t.voices)
  for (const id of VOICES) {
    const v = obj(voices[id])
    const font = FONTS[v.font as keyof typeof FONTS]
    if (!font) bad(`voices.${id}.font`, `one of ${Object.keys(FONTS).join(', ')}`)
    else if (!(font.faces as readonly string[]).includes(String(v.face))) bad(`voices.${id}.face`, `${font.name} comes in ${font.faces.join(', ')}`)
    if (v.track !== undefined && !isNum(v.track, -0.05, 0.3)) bad(`voices.${id}.track`, '-0.05 to 0.3')
    if (v.lead !== undefined && !isNum(v.lead, 0.85, 1.7)) bad(`voices.${id}.lead`, '0.85 to 1.7')
  }

  const ground = (where: string, g: Raw) => {
    if (!isToken(g.fill)) bad(`${where}.fill`, 'a colour token')
    if (g.texture !== undefined && !oneOf(g.texture, TEXTURES)) bad(`${where}.texture`, `one of ${TEXTURES.join(', ')}`)
    if (g.ink !== undefined && !isToken(g.ink)) bad(`${where}.ink`, 'a colour token')
    if (g.strength !== undefined && !isNum(g.strength, 0.03, 0.5)) bad(`${where}.strength`, '0.03 to 0.5')
  }
  const box = (where: string, b: Raw) => {
    if (!isToken(b.fill)) bad(`${where}.fill`, 'a colour token')
    if (b.pad !== undefined && !isNum(b.pad, 0, 6)) bad(`${where}.pad`, '0 to 6')
    if (b.radius !== undefined && !isNum(b.radius, 0, 6) && b.radius !== 99) bad(`${where}.radius`, '0 to 6, or 99')
    if (b.border !== undefined && (!isToken(obj(b.border).color) || !isNum(obj(b.border).width, 0.05, 1))) bad(`${where}.border`, 'a colour token and a width of 0.05 to 1')
    if (b.shadow !== undefined && !oneOf(b.shadow, ['soft', 'hard', 'none'])) bad(`${where}.shadow`, 'soft, hard or none')
    if (b.shadowColor !== undefined && !isToken(b.shadowColor)) bad(`${where}.shadowColor`, 'a colour token')
    if (b.stretch !== undefined && typeof b.stretch !== 'boolean') bad(`${where}.stretch`, 'true or false')
  }

  ground('ground', obj(t.ground))
  const sheet = t.sheet === undefined ? null : obj(t.sheet)
  if (sheet) {
    const inset = sheet.inset
    if (!Array.isArray(inset) || inset.length !== 2 || !inset.every((n) => isNum(n, 0, 8))) bad('sheet.inset', 'two numbers, 0 to 8')
    box('sheet.box', obj(sheet.box))
    if (sheet.ground !== undefined) ground('sheet.ground', obj(sheet.ground))
  }
  const motion = obj(t.motion)
  if (!oneOf(motion.cut, CUTS)) bad('motion.cut', `one of ${CUTS.join(', ')}`)
  if (!oneOf(motion.pace, ['calm', 'even', 'quick'])) bad('motion.pace', 'calm, even or quick')

  /** What words not on a box of their own are read against. */
  const under: Token = sheet && isToken(obj(sheet.box).fill) ? (obj(sheet.box).fill as Token) : isToken(obj(t.ground).fill) ? (obj(t.ground).fill as Token) : 'bg'
  const readable = (where: string, color: unknown, behind: Token, size: number) => {
    if (!isToken(color)) return
    if (color === behind) return bad(where, `${color} words on ${behind} can't be seen`)
    const least = size >= 4 ? 3 : 4.5
    for (const [i, p] of usable.entries()) {
      const ratio = contrast(p[color], p[behind])
      if (ratio < least) bad(where, `${color} on ${behind} is ${ratio.toFixed(1)}:1 in palette ${i} (needs ${least}:1 at this size)`)
    }
  }

  const pages = obj(t.pages)
  for (const key of Object.keys(pages)) if (!PAGE_KINDS.includes(key as PageKind)) bad(`pages.${key}`, 'not a kind of page')
  if (pages.item === undefined && pages.list === undefined) bad('pages', 'needs `item` (a list one line at a time) or `list` (a list that builds)')
  for (const kind of PAGE_KINDS) {
    if (pages[kind] === undefined) {
      if (!OPTIONAL_PAGES.includes(kind)) bad(`pages.${kind}`, 'missing')
      continue
    }
    const page = obj(pages[kind])
    const at = `pages.${kind}`
    const grids = obj(page.grid)
    const sizes: Record<'wide' | 'tall', [number, number]> = { wide: [0, 0], tall: [0, 0] }
    for (const way of ['wide', 'tall'] as const) {
      const g = obj(grids[way])
      for (const axis of ['cols', 'rows'] as const) {
        const tracks = g[axis]
        if (!Array.isArray(tracks) || tracks.length < 1 || tracks.length > 12 || !tracks.every((n) => isNum(n, 0.1, 20))) bad(`${at}.grid.${way}.${axis}`, 'one to twelve numbers, 0.1 to 20')
        else sizes[way][axis === 'cols' ? 0 : 1] = tracks.length
      }
      if (g.gap !== undefined && !isNum(g.gap, 0, 6)) bad(`${at}.grid.${way}.gap`, '0 to 6')
      if (g.pad !== undefined && (!Array.isArray(g.pad) || g.pad.length !== 2 || !g.pad.every((n) => isNum(n, 0, 14)))) bad(`${at}.grid.${way}.pad`, 'two numbers, 0 to 14')
    }
    if (page.ground !== undefined) ground(`${at}.ground`, obj(page.ground))
    const pageUnder: Token = page.ground !== undefined && isToken(obj(page.ground).fill) && !sheet ? (obj(page.ground).fill as Token) : under

    const items = Array.isArray(page.items) ? page.items : []
    if (items.length < 1 || items.length > 16) bad(`${at}.items`, 'one to sixteen items')
    const shown = new Set<string>()
    // Words shown only with a photo, or only without one: shown in both, they are always there.
    const withPhoto = new Set<string>()
    const without = new Set<string>()
    const widgets = new Set<string>()
    const allowedSlots = PAGES[kind].slots as readonly string[]

    items.forEach((rawItem, n) => {
      const item = obj(rawItem)
      const here = `${at}.items[${n}]`
      const place = obj(item.at)
      for (const way of ['wide', 'tall'] as const) {
        const a = place[way]
        const [cols, rows] = sizes[way]
        if (!Array.isArray(a) || a.length !== 4 || !a.every((v) => Number.isInteger(v) && v >= 1)) bad(`${here}.at.${way}`, 'column, row, columns spanned, rows spanned (whole numbers from 1)')
        else if (cols && rows && ((a as Area)[0] + (a as Area)[2] - 1 > cols || (a as Area)[1] + (a as Area)[3] - 1 > rows)) bad(`${here}.at.${way}`, `runs off its grid (${cols} columns, ${rows} rows)`)
      }
      if (item.rotate !== undefined && !isNum(item.rotate, -8, 8)) bad(`${here}.rotate`, '-8 to 8')
      if (item.enter !== undefined && !oneOf(item.enter, ENTERS)) bad(`${here}.enter`, `one of ${ENTERS.join(', ')}`)
      if (item.only !== undefined && !oneOf(item.only, ['photo', 'noPhoto'])) bad(`${here}.only`, 'photo or noPhoto')

      const words = (where: string, line: Raw, behind: Token) => {
        if (typeof line.slot !== 'string' || !allowedSlots.includes(line.slot)) bad(`${where}.slot`, `a ${kind} page has ${allowedSlots.join(', ') || 'no words'}`)
        else if (item.only === 'photo') withPhoto.add(line.slot)
        else if (item.only === 'noPhoto') without.add(line.slot)
        else shown.add(line.slot)
        if (!oneOf(line.voice, VOICES)) bad(`${where}.voice`, 'display, body or label')
        if (!isNum(line.size, 1.1, 22)) bad(`${where}.size`, '1.1 to 22')
        if (line.min !== undefined && !isNum(line.min, 0.4, 1)) bad(`${where}.min`, '0.4 to 1')
        if (!isToken(line.color)) bad(`${where}.color`, 'a colour token')
        if (line.align !== undefined && !oneOf(line.align, ALIGN)) bad(`${where}.align`, 'start, center or end')
        if (line.mark !== undefined && !oneOf(line.mark, MARKS)) bad(`${where}.mark`, `one of ${MARKS.join(', ')}`)
        if (line.markColor !== undefined && !isToken(line.markColor)) bad(`${where}.markColor`, 'a colour token')
        const own = line.box === undefined ? null : obj(line.box)
        if (own) box(`${where}.box`, own)
        readable(`${where}.color`, line.color, own && isToken(own.fill) ? own.fill : behind, isNum(line.size, 0, 99) ? line.size : 2)
      }

      switch (item.is) {
        case 'text':
          if (item.valign !== undefined && !oneOf(item.valign, ALIGN)) bad(`${here}.valign`, 'start, center or end')
          words(here, item, pageUnder)
          break
        case 'group': {
          const lines = Array.isArray(item.lines) ? item.lines : []
          if (lines.length < 1 || lines.length > 5) bad(`${here}.lines`, 'one to five lines')
          const own = item.box === undefined ? null : obj(item.box)
          if (own) box(`${here}.box`, own)
          if (item.gap !== undefined && !isNum(item.gap, 0, 6)) bad(`${here}.gap`, '0 to 6')
          if (item.align !== undefined && !oneOf(item.align, ALIGN)) bad(`${here}.align`, 'start, center or end')
          if (item.valign !== undefined && !oneOf(item.valign, ALIGN)) bad(`${here}.valign`, 'start, center or end')
          lines.forEach((line, i) => words(`${here}.lines[${i}]`, obj(line), own && isToken(own.fill) ? own.fill : pageUnder))
          break
        }
        case 'photo':
        case 'photos':
          if (!oneOf(item.frame, FRAMES)) bad(`${here}.frame`, `one of ${FRAMES.join(', ')}`)
          if (item.color !== undefined && !isToken(item.color)) bad(`${here}.color`, 'a colour token')
          if (item.tone !== undefined && !oneOf(item.tone, ['none', 'mono', 'warm', 'cool', 'faded'])) bad(`${here}.tone`, 'none, mono, warm, cool or faded')
          if (item.is === 'photo' && !oneOf(item.fit, ['cover', 'contain'])) bad(`${here}.fit`, 'cover or contain')
          if (item.is === 'photos' && !oneOf(item.arrange, ARRANGE)) bad(`${here}.arrange`, `one of ${ARRANGE.join(', ')}`)
          if (item.is === 'photo' && item.caption !== undefined) {
            const c = obj(item.caption)
            if (!oneOf(c.voice, VOICES) || !isNum(c.size, 1.1, 4) || !isToken(c.color)) bad(`${here}.caption`, 'a voice, a size of 1.1 to 4 and a colour token')
          }
          break
        case 'shape':
          if (!oneOf(item.shape, SHAPES)) bad(`${here}.shape`, `one of ${SHAPES.join(', ')}`)
          if (!isToken(item.color)) bad(`${here}.color`, 'a colour token')
          if (item.opacity !== undefined && !isNum(item.opacity, 0.05, 1)) bad(`${here}.opacity`, '0.05 to 1')
          if (item.scale !== undefined && !isNum(item.scale, 0.1, 1.6)) bad(`${here}.scale`, '0.1 to 1.6')
          if (item.weight !== undefined && !isNum(item.weight, 0.05, 3)) bad(`${here}.weight`, '0.05 to 3')
          break
        case 'wave':
          if (!oneOf(item.look, ['bars', 'blocks', 'line', 'dots', 'mirror'])) bad(`${here}.look`, 'bars, blocks, line, dots or mirror')
          if (!isToken(item.color) || !isToken(item.lit)) bad(here, 'color and lit are colour tokens')
          break
        case 'pips':
          if (!oneOf(item.look, ['dots', 'squares', 'ticks', 'bars', 'diamonds'])) bad(`${here}.look`, 'dots, squares, ticks, bars or diamonds')
          if (!isToken(item.color) || !isToken(item.lit)) bad(here, 'color and lit are colour tokens')
          break
        case 'list': {
          if (!oneOf(item.voice, VOICES) || !isNum(item.size, 1.4, 8)) bad(here, 'a voice and a size of 1.4 to 8')
          if (!isToken(item.color) || !isToken(item.lit)) bad(here, 'color and lit are colour tokens')
          if (!oneOf(item.marker, ['number', 'dot', 'check', 'dash', 'none', 'box'])) bad(`${here}.marker`, 'number, dot, check, dash, box or none')
          const own = item.box === undefined ? null : obj(item.box)
          if (own) box(`${here}.box`, own)
          const behind = own && isToken(own.fill) ? own.fill : pageUnder
          readable(`${here}.color`, item.color, behind, 2)
          readable(`${here}.lit`, item.lit, behind, 2)
          break
        }
        case 'letter': {
          if (!oneOf(item.voice, VOICES) || !isNum(item.size, 1.4, 4)) bad(here, 'a voice and a size of 1.4 to 4')
          if (!isToken(item.color)) bad(`${here}.color`, 'a colour token')
          const own = item.sheet === undefined ? null : obj(item.sheet)
          if (own) box(`${here}.sheet`, own)
          readable(`${here}.color`, item.color, own && isToken(own.fill) ? own.fill : pageUnder, 2)
          break
        }
        case 'ending': {
          const b = obj(item.button)
          if (!oneOf(b.voice, VOICES) || !isToken(b.color)) bad(`${here}.button`, 'a voice, a colour token and a box')
          box(`${here}.button.box`, obj(b.box))
          if (isToken(obj(b.box).fill)) readable(`${here}.button.color`, b.color, obj(b.box).fill as Token, 2)
          break
        }
        case 'credits':
          if (!oneOf(item.look, ['roll', 'table', 'stack'])) bad(`${here}.look`, 'roll, table or stack')
          if (!oneOf(item.voice, VOICES) || !isNum(item.size, 1.4, 5)) bad(here, 'a voice and a size of 1.4 to 5')
          if (!isToken(item.color) || !isToken(item.roleColor)) bad(here, 'color and roleColor are colour tokens')
          readable(`${here}.color`, item.color, pageUnder, 2)
          readable(`${here}.roleColor`, item.roleColor, pageUnder, 2)
          break
        default:
          bad(`${here}.is`, 'text, group, photo, photos, shape, wave, pips, list, letter, ending or credits')
      }
      if (typeof item.is === 'string' && HOME[item.is]) {
        if (!HOME[item.is].includes(kind)) bad(`${here}.is`, `a ${item.is} belongs on ${HOME[item.is].join(' or ')}, not ${kind}`)
        widgets.add(item.is)
      }
    })

    for (const slot of withPhoto) if (without.has(slot)) shown.add(slot)
    for (const slot of PAGES[kind].needs) if (!shown.has(slot)) bad(at, `must show "${slot}" (in an item that is always there)`)
    const must = MUST[kind]
    if (must && !widgets.has(must)) bad(at, `must have a ${must}`)
    if (kind === 'cover' && items.some((i) => ['photo', 'photos', 'letter', 'ending', 'credits', 'list', 'wave', 'pips'].includes(String(obj(i).is)))) bad(at, 'a cover has only words and shapes')
  }

  return { ok: !problems.length, problems, template: problems.length ? null : (raw as Template) }
}

/** A template's item with the places it never appears taken out: what a page shows for a shot with or without a photo. */
export const itemsFor = (page: Page, hasPhoto: boolean): Item[] =>
  page.items.filter((item) => (item.only === 'photo' ? hasPhoto : item.only === 'noPhoto' ? !hasPhoto : item.is === 'photo' ? hasPhoto : true))

export type { Box, Grid, Ground }
