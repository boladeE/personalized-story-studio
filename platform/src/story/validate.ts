import type { Intake, LookId } from './types'

/**
 * Server-side check of a sender's intake. Everything arrives from the browser,
 * so shapes and lengths are enforced here before a gift is stored.
 */

export const LIMITS = {
  name: 60,
  caption: 140,
  spotlight: 600,
  memoryTitle: 120,
  memoryStory: 1200,
  memories: 5,
  listItem: 200,
  habits: 7,
  reasons: 10,
  letter: 6000,
  wish: 400,
  photos: 12,
  question: 160,
  answer: 80,
} as const

const LOOK_IDS: Array<LookId | 'surprise'> = ['screening', 'garden', 'paper', 'surprise']
const ID_RE = /^[a-z0-9-]{1,64}$/i

class IntakeError extends Error {}

function text(value: unknown, max: number, field: string): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new IntakeError(`${field} must be text`)
  if (value.length > max) throw new IntakeError(`${field} is too long (max ${max} characters)`)
  return value
}

function list(value: unknown, field: string): unknown[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new IntakeError(`${field} must be a list`)
  return value
}

function id(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ID_RE.test(value)) throw new IntakeError(`${field} has an invalid id`)
  return value
}

export function parseIntake(raw: unknown): { ok: true; intake: Intake } | { ok: false; error: string } {
  try {
    if (!raw || typeof raw !== 'object') throw new IntakeError('Missing story details')
    const r = raw as Record<string, unknown>
    if (r.occasion !== 'birthday') throw new IntakeError('Only birthday stories are supported')

    const photos = list(r.photos, 'Photos').map((p, i) => {
      const photo = (p ?? {}) as Record<string, unknown>
      return { id: id(photo.id, `Photo ${i + 1}`), src: '', caption: text(photo.caption, LIMITS.caption, `Photo ${i + 1} caption`) }
    })
    if (photos.length > LIMITS.photos) throw new IntakeError(`Up to ${LIMITS.photos} photos`)
    if (new Set(photos.map((p) => p.id)).size !== photos.length) throw new IntakeError('Duplicate photo ids')
    const photoIds = new Set(photos.map((p) => p.id))

    const memories = list(r.memories, 'Memories').map((m, i) => {
      const memory = (m ?? {}) as Record<string, unknown>
      const photoId = text(memory.photoId, 64, `Memory ${i + 1} photo`)
      if (photoId && !photoIds.has(photoId)) throw new IntakeError(`Memory ${i + 1} points at a missing photo`)
      return {
        id: id(memory.id, `Memory ${i + 1}`),
        title: text(memory.title, LIMITS.memoryTitle, `Memory ${i + 1} title`),
        story: text(memory.story, LIMITS.memoryStory, `Memory ${i + 1}`),
        photoId,
      }
    })
    if (memories.length > LIMITS.memories) throw new IntakeError(`Up to ${LIMITS.memories} memories`)

    const strings = (value: unknown, max: number, field: string) => {
      const items = list(value, field).map((v, i) => text(v, LIMITS.listItem, `${field} ${i + 1}`))
      if (items.length > max) throw new IntakeError(`Up to ${max} ${field.toLowerCase()}`)
      return items
    }

    const look = r.look as LookId | 'surprise'
    if (!LOOK_IDS.includes(look)) throw new IntakeError('Unknown look')

    const intake: Intake = {
      occasion: 'birthday',
      sender: text(r.sender, LIMITS.name, 'Your name'),
      recipient: text(r.recipient, LIMITS.name, 'Their name'),
      photos,
      spotlight: text(r.spotlight, LIMITS.spotlight, 'The main character'),
      memories,
      habits: strings(r.habits, LIMITS.habits, 'Habits'),
      reasons: strings(r.reasons, LIMITS.reasons, 'Reasons'),
      letter: text(r.letter, LIMITS.letter, 'Letter'),
      wish: text(r.wish, LIMITS.wish, 'Wish'),
      look,
    }
    if (!intake.sender.trim() || !intake.recipient.trim()) throw new IntakeError('Both names are needed')
    return { ok: true, intake }
  } catch (error) {
    if (error instanceof IntakeError) return { ok: false, error: error.message }
    throw error
  }
}
