import { SCENES, SKELETONS } from './library'
import type { BuildContext } from './library'
import { tracksForMood, TRACKS } from './music'
import { createRng } from './rng'
import type { Intake, LookId, Photo, Story } from './types'

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
  return SKELETONS[intake.occasion].flatMap((slot) =>
    slot.candidates.map((type) => {
      const def = SCENES[type]
      return { type, name: def.name, description: def.description, missing: def.missing(intake) }
    }),
  )
}

export const canGenerate = (intake: Intake) => Boolean(intake.sender.trim() && intake.recipient.trim())

/**
 * Build a story. The same intake and seed always give the same story; a new
 * seed (Shuffle) varies order, wording variants, layouts, look and music.
 */
export function generateStory(intake: Intake, seed: number): Story {
  if (!canGenerate(intake)) throw new Error('Both names are needed to build a story')
  const rng = createRng(seed)
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
  const trackForMood = new Map<string, string>()
  const scenes: Story['scenes'] = []

  for (const slot of SKELETONS[intake.occasion]) {
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
      scenes.push({ id: `${type}-${scenes.length}`, type, name: def.name, mood: def.mood, trackId: trackForMood.get(def.mood)!, frames })
    }
  }

  return { occasion: intake.occasion, seed, look, sender: intake.sender.trim(), recipient: intake.recipient.trim(), scenes }
}
