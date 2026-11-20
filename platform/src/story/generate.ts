import { sceneLabel, SCENES, SKELETONS } from './library'
import type { BuildContext } from './library'
import { chapterLines, chapterMissing, chapterName, outlineOf, pagesOf } from './outline'
import { createRng } from './rng'
import type { Chapter, Cut, Frame, Intake, LookId, Photo, PhotoLayout, Scene, SceneLayout, Story, WorldId } from './types'
import { designKey, designsFor, WORLDS } from './worlds'
import type { DesignDef } from './worlds'

export const LOOKS: Array<{ id: LookId; name: string }> = [
  { id: 'screening', name: 'Screening' },
  { id: 'garden', name: 'Garden' },
  { id: 'paper', name: 'Paper' },
]

export interface SceneStatus {
  type: string
  name: string
  description: string
  missing: string | null
}

/** Which scenes this intake can fill, in the studio's order. Drives the storyboard. */
export function sceneStatus(intake: Intake): SceneStatus[] {
  const outline = outlineOf(intake)
  if (outline) {
    const fixed = (type: string) => ({ type, ...sceneLabel(SCENES[type], intake), missing: SCENES[type].missing(intake) })
    return [fixed('ticket'), fixed('hello'), ...outline.map((c) => ({ type: c.id, name: chapterName(c), description: '', missing: chapterMissing(c, intake) })), fixed('letter'), fixed('wish')]
  }
  return skeletonFor(intake).flatMap((slot) =>
    slot.candidates.map((type) => {
      const def = SCENES[type]
      return { type, ...sceneLabel(def, intake), missing: def.missing(intake) }
    }),
  )
}

const skeletonFor = (intake: Intake) => SKELETONS[intake.occasion] ?? SKELETONS.birthday

export const canGenerate = (intake: Intake) => Boolean(intake.sender.trim() && intake.recipient.trim())

/** The opening and the ending hold the film together, so they can't be moved or left out. */
export const FIXED_SCENES = ['ticket', 'hello', 'wish']
const isFixed = (type: string) => FIXED_SCENES.includes(type)

/**
 * The sender's order laid over the studio's. Scenes the sender has placed keep
 * that order; a scene they have never placed (one filled in later) goes in
 * after the scene it would normally follow, or last if it normally comes last.
 */
function arrange(types: string[], cut: Cut | undefined): string[] {
  const off = new Set(cut?.off ?? [])
  const kept = types.filter((t) => isFixed(t) || !off.has(t))
  const wanted = (cut?.order ?? []).filter((t, i, all) => all.indexOf(t) === i && kept.includes(t) && !isFixed(t))
  if (!wanted.length) return kept
  const middle = [...wanted]
  kept.forEach((type, at) => {
    if (isFixed(type) || middle.includes(type)) return
    if (!kept.slice(at + 1).some((t) => wanted.includes(t))) return void middle.push(type)
    const before = kept.slice(0, at).reverse().find((t) => middle.includes(t))
    middle.splice(before ? middle.indexOf(before) + 1 : 0, 0, type)
  })
  let next = 0
  return kept.map((type) => (isFixed(type) ? type : middle[next++]))
}

const sameStart = (name: string, text: string) => text.toLowerCase().startsWith(name.toLowerCase().replace(/[.!?…]+$/, ''))

/** An outlined scene's frames: the sender's words, under the scene's own name, in its layout. */
function chapterFrames(chapter: Chapter, ctx: BuildContext, loud: boolean): Frame[] {
  const name = chapterName(chapter)
  const lines = chapterLines(chapter)
  switch (chapter.layout) {
    case 'line': {
      const [text] = lines
      if (!text) return []
      // With a photo to spare, the line is said beside it: a face says more than a page of type.
      const photo = (chapter.photoId && ctx.photoById(chapter.photoId)) || (ctx.unusedPhotos().length ? ctx.takePhoto() : undefined)
      if (photo) {
        const own = !chapter.name.trim() || sameStart(name, text)
        return [{ kind: 'photo', photo, layout: ctx.rng.pick<PhotoLayout>(['left', 'right']), kicker: '', ...(own && text.length <= 90 ? { title: text } : { title: name, body: text }) }]
      }
      // A line short enough to shout fills the screen under the scene's name; a longer one is read under it.
      if (text.length > 90) return [{ kind: 'title', kicker: '', title: name, body: text }]
      return [{ kind: 'title', kicker: sameStart(name, text) ? '' : name, title: text }]
    }
    case 'list':
      return lines.map<Frame>((text, index) => ({ kind: 'item', marker: loud ? 'loud' : 'calm', kicker: name, text, index, total: lines.length }))
    case 'moment': {
      // The first page is told beside the photo; each page after it has the screen to itself, under the scene's name.
      const [body, ...more] = pagesOf(chapter)
      if (!body) return []
      const turned = more.map<Frame>((page) => (page.length <= 150 ? { kind: 'title', kicker: name, title: page } : { kind: 'title', kicker: '', title: name, body: page }))
      const photo = (chapter.photoId && ctx.photoById(chapter.photoId)) || ctx.takePhoto()
      // A telling with no name of its own, or one that opens with its name, is titled by its first sentence, said once.
      const [opening, ...after] = body.split(/(?<=[.!?])\s+/)
      const words = (!chapter.name.trim() || sameStart(name, body)) && opening.length <= 90 ? { kicker: '', title: opening, ...(after.length ? { body: after.join(' ') } : {}) } : { kicker: '', title: name, body }
      return [photo ? { kind: 'photo', photo, layout: ctx.rng.pick<PhotoLayout>(['left', 'right']), ...words } : { kind: 'title', ...words }, ...turned]
    }
    case 'photos': {
      const photos = ctx.unusedPhotos().slice(0, 6)
      return photos.length ? [{ kind: 'montage', kicker: '', title: name, photos }] : []
    }
  }
}

/**
 * Build a story. The same intake and seed always give the same story; a new
 * seed (Shuffle) varies the kind of film, each scene's design, order, wording
 * variants, layouts and colours. Anything the sender has chosen stays put.
 */
export function generateStory(intake: Intake, seed: number): Story {
  if (!canGenerate(intake)) throw new Error('Both names are needed to build a story')
  const rng = createRng(seed)
  // The kind of film and its designs are drawn from their own stream, so adding
  // a design never changes which words or photos a seed picks.
  const direct = createRng((seed ^ 0x5bd1e995) >>> 0)
  const used = new Set<string>()
  // Photos the sender chose for a scene are kept for it.
  const reserved = new Set([...intake.memories.map((m) => m.photoId), ...(intake.outline ?? []).map((c) => c.photoId ?? '')].filter(Boolean))

  const ctx: BuildContext = {
    intake,
    rng,
    photoById: (id) => {
      const photo = intake.photos.find((p) => p.id === id)
      if (photo) used.add(photo.id)
      return photo
    },
    takePhoto: () => {
      const free = intake.photos.filter((p) => !used.has(p.id))
      const pool: Photo[] = free.filter((p) => !reserved.has(p.id))
      const choice = pool.length ? rng.pick(pool) : free.length ? rng.pick(free) : intake.photos.length ? rng.pick(intake.photos) : undefined
      if (choice) used.add(choice.id)
      return choice
    },
    unusedPhotos: () => intake.photos.filter((p) => !used.has(p.id)),
  }

  // The studio's direction holds for the version it was made for. Another version is drawn from the seed.
  const directed = intake.direction?.seed === seed ? intake.direction : undefined
  // Always draw the look, so switching it later doesn't reshuffle anything else.
  const drawnLook = rng.pick(LOOKS).id
  const look: LookId = intake.look === 'surprise' ? (directed?.look ?? drawnLook) : intake.look
  const drawnWorld = direct.pick(WORLDS).id
  const world: WorldId = intake.world && intake.world !== 'surprise' ? intake.world : (directed?.world ?? drawnWorld)
  // Every scene type draws a design whether or not it is used, so one choice never moves another.
  const designs = new Map<string, string>()
  for (const type of Object.keys(SCENES)) {
    const options = designsFor(world, type)
    const drawn = direct.next()
    if (!options.length) continue
    // The sender's choice, then the studio's direction (when it was for this kind of film), then the draw.
    const chosen = [intake.cut?.designs?.[type], directed?.world === world ? directed.designs[type] : undefined].find((id) => options.some((d) => d.id === id))
    designs.set(type, chosen ?? options[Math.floor(drawn * options.length)].id)
  }

  // Scenes are built in the studio's order, so moving or dropping one doesn't change the others.
  const built = new Map<string, Omit<Scene, 'id'>>()
  const order: string[] = []
  const fixed = (type: string) => {
    const def = SCENES[type]
    if (def.missing(intake) !== null) return
    const frames = def.build(ctx)
    if (!frames.length) return
    order.push(type)
    built.set(type, { type, name: sceneLabel(def, intake).name, mood: def.mood, frames })
  }

  const outline = outlineOf(intake)
  if (outline) {
    // The film's own scenes. Each draws its design in turn, and two scenes of a kind that follow
    // each other don't share one while another is free.
    const last = new Map<SceneLayout, string>()
    const drawn = new Map<string, string>()
    for (const chapter of outline) {
      const options = designsFor(world, chapter.layout)
      const roll = direct.next()
      if (!options.length) continue
      const suited = chapter.layout === 'list' ? options.filter((d) => Boolean(d.loud) === (chapter.mood === 'playful')) : options
      const at = Math.floor(roll * suited.length)
      const pick = suited[at].id === last.get(chapter.layout) ? suited[(at + 1) % suited.length] : suited[at]
      const own = options.find((d) => d.id === intake.cut?.designs?.[chapter.id])
      drawn.set(chapter.id, (own ?? pick).id)
      last.set(chapter.layout, (own ?? pick).id)
    }
    fixed('ticket')
    fixed('hello')
    // Told scenes take their photos first, then single lines take one each while there are photos to spare,
    // and the scene of photos shows whatever is left.
    const frames = new Map<string, Frame[]>()
    const loud = (c: Chapter) => {
      const design = designsFor(world, 'list').find((d) => d.id === drawn.get(c.id))
      return design ? Boolean(design.loud) : c.mood === 'playful'
    }
    for (const chapter of outline) if (chapter.layout === 'moment') frames.set(chapter.id, chapterFrames(chapter, ctx, false))
    for (const chapter of outline) if (chapter.layout === 'line' || chapter.layout === 'list') frames.set(chapter.id, chapterFrames(chapter, ctx, loud(chapter)))
    for (const chapter of outline) if (chapter.layout === 'photos') frames.set(chapter.id, chapterFrames(chapter, ctx, false))
    for (const chapter of outline) {
      const made = frames.get(chapter.id) ?? []
      if (!made.length) continue
      order.push(chapter.id)
      built.set(chapter.id, { type: chapter.id, name: chapterName(chapter), mood: chapter.mood, layout: chapter.layout, ...(drawn.has(chapter.id) ? { design: drawn.get(chapter.id) } : {}), frames: made })
    }
    fixed('letter')
    fixed('wish')
    const scenes = arrange(order, intake.cut).map((type, index) => ({ id: `${type}-${index}`, ...built.get(type)! }))
    return { occasion: intake.occasion, seed, look, world, sender: intake.sender.trim(), recipient: intake.recipient.trim(), scenes }
  }

  for (const slot of skeletonFor(intake)) {
    const fillable = slot.candidates.filter((type) => SCENES[type].missing(intake) === null)
    const ordered = slot.shuffle ? rng.shuffle(fillable) : fillable
    for (const type of ordered) {
      const def = SCENES[type]
      const frames = def.build(ctx)
      if (!frames.length) continue
      order.push(type)
      built.set(type, { type, name: sceneLabel(def, intake).name, mood: def.mood, ...(designs.has(type) ? { design: designs.get(type) } : {}), frames })
    }
  }

  const scenes = arrange(order, directed && !intake.cut?.order?.length ? { ...intake.cut, order: directed.order } : intake.cut).map((type, index) => ({ id: `${type}-${index}`, ...built.get(type)! }))
  return { occasion: intake.occasion, seed, look, world, sender: intake.sender.trim(), recipient: intake.recipient.trim(), scenes }
}

/** One row of the scene editor: a scene in the film, one the sender took out, or one that still needs something. */
export interface BoardRow {
  type: string
  name: string
  state: 'in' | 'off' | 'missing'
  /** What a missing scene still needs. */
  missing: string | null
  /** Opening and ending: always in, always in place. */
  fixed: boolean
  /** Set on a scene of the film's outline. */
  layout?: SceneLayout
  design?: string
  designs: DesignDef[]
}

/** The film as the sender edits it: its scenes in order, then what was left out, then what could still go in. */
export function sceneBoard(intake: Intake, story: Story): BoardRow[] {
  const status = sceneStatus(intake).filter((s) => s.type !== 'ticket')
  const label = (type: string) => status.find((s) => s.type === type)?.name ?? type
  const layouts = new Map((outlineOf(intake) ?? []).map((c) => [c.id, c.layout]))
  const inFilm = story.scenes.filter((s) => s.type !== 'ticket')
  const rows: BoardRow[] = inFilm.map((scene) => ({
    type: scene.type,
    name: scene.name,
    state: 'in',
    missing: null,
    fixed: isFixed(scene.type),
    ...(scene.layout ? { layout: scene.layout } : {}),
    design: scene.design,
    designs: designsFor(story.world, designKey(scene)),
  }))
  const shown = new Set(inFilm.map((s) => s.type))
  for (const s of status) {
    if (shown.has(s.type)) continue
    rows.push({ type: s.type, name: label(s.type), state: s.missing ? 'missing' : 'off', missing: s.missing, fixed: false, ...(layouts.has(s.type) ? { layout: layouts.get(s.type) } : {}), designs: [] })
  }
  return rows
}

/** The cut after moving a scene one place earlier (-1) or later (1) in this story. */
export function moveScene(story: Story, cut: Cut | undefined, type: string, by: -1 | 1): Cut {
  const middle = story.scenes.map((s) => s.type).filter((t) => !isFixed(t))
  const from = middle.indexOf(type)
  const to = from + by
  if (from < 0 || to < 0 || to >= middle.length) return cut ?? {}
  ;[middle[from], middle[to]] = [middle[to], middle[from]]
  return { ...cut, order: middle }
}

/** The cut after switching a scene to the next of its designs. */
export function nextDesign(story: Story, cut: Cut | undefined, type: string): Cut {
  const scene = story.scenes.find((s) => s.type === type)
  const options = scene ? designsFor(story.world, designKey(scene)) : []
  if (options.length < 2 || !scene) return cut ?? {}
  const at = options.findIndex((d) => d.id === scene.design)
  return { ...cut, designs: { ...cut?.designs, [type]: options[(at + 1) % options.length].id } }
}

export function toggleScene(cut: Cut | undefined, type: string, on: boolean): Cut {
  const off = new Set(cut?.off ?? [])
  if (on) off.delete(type)
  else if (!isFixed(type)) off.add(type)
  return { ...cut, off: [...off] }
}
