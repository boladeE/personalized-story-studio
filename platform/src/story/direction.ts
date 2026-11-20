import type { SortedNotes } from './notes'
import { DIRECTION_REASONS } from './types'
import type { Direction, DirectionReason, LookId, Occasion, Relationship, WorldId } from './types'
import { designsFor, worldOf } from './worlds'

/**
 * Directing a film: choosing the kind of film, its colours, each scene's
 * design and the order they play in, from what the sender wrote. A text model
 * makes the choices on the server (src/server/direct.ts); the rules here make
 * them when the model is off, slow or wrong, so a film is always directed.
 * Either way a direction can only ever name things the studio has.
 */

/** What a director is told: the sender's sorted words and how much else there is. Never the letter or the photos themselves. */
export interface DirectionBrief {
  occasion: Occasion
  relationship?: Relationship
  recipient: string
  notes: SortedNotes
  photos: number
  letter: boolean
}

/** The kinds of film the studio directs new films as. The Screening is still there to switch to. */
export const DIRECTED_WORLDS: WorldId[] = ['scrapbook', 'mixtape']
const LOOK_IDS: LookId[] = ['screening', 'garden', 'paper']
/** The scenes that can be moved, in the studio's usual order. */
export const MIDDLE_SCENES = ['spotlight', 'memoryLane', 'redFlags', 'reasons', 'cameraRoll', 'letter']

export type DirectionPlan = Omit<Direction, 'seed'>

/** What the studio says about its choice. */
export function directionLine(plan: Pick<Direction, 'world' | 'because'>, them: string): string {
  const name = worldOf(plan.world).name.replace(/^The /, '').toLowerCase()
  const kind = `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`
  const who = them.trim() || 'them'
  const why: Record<DirectionReason, string> = {
    teasing: `because so much of what you wrote is the way ${who} is, habits and all`,
    memories: 'because you told it in moments worth keeping',
    photos: 'because you gave it plenty of photos',
    tender: `because what you wrote about ${who} is mostly tender`,
    short: 'because a few words carry better said loudly',
  }
  return `The studio made it ${kind}, ${why[plan.because]}.`
}

/** A direction by rule: steady, explainable choices from how much of each thing there is. */
export function directLocally(brief: DirectionBrief): DirectionPlan {
  const { notes } = brief
  const habits = notes.habits.length
  const reasons = notes.reasons.length
  const memories = notes.memories.length
  const said = habits + reasons + memories + (notes.spotlight ? 1 : 0)
  const because: DirectionReason = said <= 2 ? 'short' : habits >= 2 && habits >= memories ? 'teasing' : memories >= 2 ? 'memories' : brief.photos >= 4 ? 'photos' : 'tender'
  const world: WorldId = because === 'teasing' || because === 'short' ? 'mixtape' : 'scrapbook'
  const look: LookId = { teasing: 'screening', short: 'garden', memories: 'garden', photos: 'paper', tender: 'garden' }[because] as LookId
  const longStories = notes.memories.some((m) => m.story.length > 220)
  const want: Record<string, string> =
    world === 'mixtape'
      ? { spotlight: longStories ? 'cover' : 'poster', memoryLane: longStories ? 'cover' : 'poster', redFlags: habits >= 4 ? 'tracklist' : 'shout', reasons: reasons >= 4 ? 'liner' : 'nowplaying' }
      : { spotlight: 'polaroid', memoryLane: longStories ? 'clipped' : 'taped', redFlags: habits >= 4 ? 'checklist' : 'stickies', reasons: reasons >= 4 ? 'cards' : 'bunting', cameraRoll: brief.photos >= 5 ? 'strip' : 'pile' }
  // The jokes come before the sincere scenes, so the film ends on its warmest note.
  const order = because === 'teasing' || because === 'short' ? ['spotlight', 'redFlags', 'memoryLane', 'cameraRoll', 'reasons', 'letter'] : ['spotlight', 'memoryLane', 'cameraRoll', 'redFlags', 'reasons', 'letter']
  return { world, look, designs: want, order, because }
}

/**
 * Whatever a director (or a stored gift) says, made safe: a kind of film the
 * studio has, colours it has, designs that exist for that kind of film, and
 * only the scenes that can be moved. Anything else is dropped; a direction
 * with no usable kind of film is no direction.
 */
export function cleanDirection(raw: unknown, among: WorldId[] = ['screening', 'scrapbook', 'mixtape']): DirectionPlan | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const world = among.find((id) => id === r.world)
  if (!world) return null
  const look = LOOK_IDS.find((id) => id === r.look) ?? 'garden'
  const designs: Record<string, string> = {}
  if (r.designs && typeof r.designs === 'object' && !Array.isArray(r.designs)) {
    for (const [type, design] of Object.entries(r.designs as Record<string, unknown>)) {
      if (designsFor(world, type).some((d) => d.id === design)) designs[type] = design as string
    }
  }
  const order = (Array.isArray(r.order) ? r.order : []).filter((t, i, all): t is string => typeof t === 'string' && MIDDLE_SCENES.includes(t) && all.indexOf(t) === i)
  const because = DIRECTION_REASONS.find((id) => id === r.because) ?? 'tender'
  return { world, look, designs, order, because }
}

/** A stored direction, with the seed it was made for. */
export function cleanStoredDirection(raw: unknown): Direction | null {
  const plan = cleanDirection(raw)
  const seed = (raw as { seed?: unknown } | null)?.seed
  return plan && typeof seed === 'number' && Number.isSafeInteger(seed) ? { ...plan, seed } : null
}
