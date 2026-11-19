import { sceneLabel, SCENES, SKELETONS } from './library'
import type { BuildContext } from './library'
import { tracksForMood, TRACKS } from './music'
import { createRng } from './rng'
import type { Cut, Intake, LookId, Photo, Scene, Story, WorldId } from './types'
import { designsFor, WORLDS } from './worlds'
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

/** Which scenes this intake can fill, in skeleton order. Drives the storyboard. */
export function sceneStatus(intake: Intake): SceneStatus[] {
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

/**
 * Build a story. The same intake and seed always give the same story; a new
 * seed (Shuffle) varies the kind of film, each scene's design, order, wording
 * variants, layouts, colours and music. Anything the sender has chosen stays put.
 */
export function generateStory(intake: Intake, seed: number): Story {
  if (!canGenerate(intake)) throw new Error('Both names are needed to build a story')
  const rng = createRng(seed)
  // The kind of film and its designs are drawn from their own stream, so adding
  // a design never changes which words or photos a seed picks.
  const direct = createRng((seed ^ 0x5bd1e995) >>> 0)
  const used = new Set<string>()
  const reserved = new Set(intake.memories.map((m) => m.photoId).filter(Boolean))

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

  // Always draw the look, so switching it later doesn't reshuffle anything else.
  const drawnLook = rng.pick(LOOKS).id
  const look: LookId = intake.look === 'surprise' ? drawnLook : intake.look
  const drawnWorld = direct.pick(WORLDS).id
  const world: WorldId = intake.world && intake.world !== 'surprise' ? intake.world : drawnWorld
  // Every scene type draws a design whether or not it is used, so one choice never moves another.
  const designs = new Map<string, string>()
  for (const type of Object.keys(SCENES)) {
    const options = designsFor(world, type)
    const drawn = direct.next()
    if (!options.length) continue
    const chosen = intake.cut?.designs?.[type]
    designs.set(type, options.some((d) => d.id === chosen) ? chosen! : options[Math.floor(drawn * options.length)].id)
  }

  const trackForMood = new Map<string, string>()
  // Scenes are built in the studio's order, so moving or dropping one doesn't change the others.
  const built = new Map<string, Omit<Scene, 'id'>>()
  const order: string[] = []

  for (const slot of skeletonFor(intake)) {
    const fillable = slot.candidates.filter((type) => SCENES[type].missing(intake) === null)
    const ordered = slot.shuffle ? rng.shuffle(fillable) : fillable
    for (const type of ordered) {
      const def = SCENES[type]
      const frames = def.build(ctx)
      if (!frames.length) continue
      if (!trackForMood.has(def.mood)) {
        const options = tracksForMood(def.mood)
        trackForMood.set(def.mood, (options.length ? rng.pick(options) : TRACKS[0]).id)
      }
      order.push(type)
      built.set(type, { type, name: sceneLabel(def, intake).name, mood: def.mood, trackId: trackForMood.get(def.mood)!, ...(designs.has(type) ? { design: designs.get(type) } : {}), frames })
    }
  }

  const scenes = arrange(order, intake.cut).map((type, index) => ({ id: `${type}-${index}`, ...built.get(type)! }))
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
  design?: string
  designs: DesignDef[]
}

/** The film as the sender edits it: its scenes in order, then what was left out, then what could still go in. */
export function sceneBoard(intake: Intake, story: Story): BoardRow[] {
  const status = sceneStatus(intake).filter((s) => s.type !== 'ticket')
  const label = (type: string) => status.find((s) => s.type === type)?.name ?? type
  const inFilm = story.scenes.filter((s) => s.type !== 'ticket')
  const rows: BoardRow[] = inFilm.map((scene) => ({
    type: scene.type,
    name: scene.name,
    state: 'in',
    missing: null,
    fixed: isFixed(scene.type),
    design: scene.design,
    designs: designsFor(story.world, scene.type),
  }))
  const shown = new Set(inFilm.map((s) => s.type))
  for (const s of status) {
    if (shown.has(s.type)) continue
    rows.push({ type: s.type, name: label(s.type), state: s.missing ? 'missing' : 'off', missing: s.missing, fixed: false, designs: [] })
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
  const options = designsFor(story.world, type)
  const scene = story.scenes.find((s) => s.type === type)
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
