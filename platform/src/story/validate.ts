import { cleanStoredDirection } from './direction'
import { isOccasion, isRelationship, isWorld } from './types'
import { SCENE_LAYOUTS } from './types'
import type { Chapter, Cut, EndingChoice, Intake, LookId, Mood } from './types'

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
  /** The sender's own ending: their question or invitation, and each thing to pick from. */
  ask: 140,
  occasionName: 40,
  choice: 40,
  question: 160,
  answer: 80,
} as const

const LOOK_IDS: Array<LookId | 'surprise'> = ['screening', 'garden', 'paper', 'surprise']
const ID_RE = /^[a-z0-9-]{1,64}$/i
const NAME_RE = /^[a-z][a-z0-9-]{0,31}$/i
const MAX_CUT = 24

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

/** The sender's cut: short lists of scene and design names. Unknown names are harmless; the engine ignores them. */
function parseCut(raw: unknown): Cut | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new IntakeError('The scene choices are not valid')
  const r = raw as Record<string, unknown>
  const names = (value: unknown) => {
    const items = list(value, 'Scene choices')
    if (items.length > MAX_CUT || !items.every((v) => typeof v === 'string' && NAME_RE.test(v))) throw new IntakeError('The scene choices are not valid')
    return items as string[]
  }
  const cut: Cut = {}
  if (r.order !== undefined) cut.order = names(r.order)
  if (r.off !== undefined) cut.off = names(r.off)
  if (r.designs !== undefined) {
    if (!r.designs || typeof r.designs !== 'object' || Array.isArray(r.designs)) throw new IntakeError('The scene choices are not valid')
    const entries = Object.entries(r.designs as Record<string, unknown>)
    if (entries.length > MAX_CUT || !entries.every(([k, v]) => NAME_RE.test(k) && typeof v === 'string' && NAME_RE.test(v))) throw new IntakeError('The scene choices are not valid')
    cut.designs = Object.fromEntries(entries) as Record<string, string>
  }
  return cut
}

/** The sender's own ending, if they chose one: a question, or an invitation with two things to pick from. */
function parseEnding(raw: unknown): EndingChoice | null {
  if (raw === undefined || raw === null) return null
  const r = (typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (r.kind === 'question') return { kind: 'question', ask: text(r.ask, LIMITS.ask, 'Your question') }
  if (r.kind === 'invitation') {
    const choices = Array.isArray(r.choices) ? r.choices : []
    if (choices.length !== 2) throw new IntakeError('An invitation needs two things to pick from')
    return { kind: 'invitation', invite: text(r.invite, LIMITS.ask, 'Your invitation'), choices: [text(choices[0], LIMITS.choice, 'The first choice'), text(choices[1], LIMITS.choice, 'The second choice')] }
  }
  throw new IntakeError('Unknown ending')
}

const MAX_SCENES = 12
/** How many voice notes one film holds. */
export const MAX_VOICES = 6
const MOODS: Mood[] = ['warm', 'playful', 'tender', 'glow']

/** A film's own scenes, as the sender left them: shapes and lengths only. A scene with nothing in it yet is harmless. */
function parseOutline(raw: unknown): Chapter[] | undefined {
  if (raw === undefined || raw === null) return undefined
  const items = list(raw, 'Scenes')
  if (items.length > MAX_SCENES) throw new IntakeError(`Up to ${MAX_SCENES} scenes`)
  const ids = new Set<string>()
  return items.map((item, i) => {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const layout = SCENE_LAYOUTS.find((l) => l === r.layout)
    const mood = MOODS.find((m) => m === r.mood)
    if (typeof r.id !== 'string' || !NAME_RE.test(r.id) || ids.has(r.id) || !layout || !mood) throw new IntakeError(`Scene ${i + 1} is not valid`)
    ids.add(r.id)
    const lines = list(r.lines, `Scene ${i + 1}`)
    if (lines.length > 12) throw new IntakeError(`Scene ${i + 1} has too many lines`)
    return {
      id: r.id,
      name: text(r.name, 60, `Scene ${i + 1}’s name`),
      layout,
      mood,
      lines: lines.map((l) => text(l, layout === 'moment' ? LIMITS.memoryStory : LIMITS.listItem, `Scene ${i + 1}`)),
      ...(typeof r.intro === 'string' && r.intro.trim() ? { intro: text(r.intro, 120, `Scene ${i + 1}’s intro`) } : {}),
      ...(r.photoId ? { photoId: id(r.photoId, `Scene ${i + 1}’s photo`) } : {}),
    }
  })
}

export function parseIntake(raw: unknown): { ok: true; intake: Intake } | { ok: false; error: string } {
  try {
    if (!raw || typeof raw !== 'object') throw new IntakeError('Missing story details')
    const r = raw as Record<string, unknown>
    if (!isOccasion(r.occasion)) throw new IntakeError('Unknown occasion')

    const photos = list(r.photos, 'Photos').map((p, i) => {
      const photo = (p ?? {}) as Record<string, unknown>
      const aspect = typeof photo.aspect === 'number' && photo.aspect > 0.2 && photo.aspect < 5 ? photo.aspect : undefined
      return { id: id(photo.id, `Photo ${i + 1}`), src: '', caption: text(photo.caption, LIMITS.caption, `Photo ${i + 1} caption`), ...(aspect ? { aspect } : {}) }
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
    if (r.world !== undefined && r.world !== 'surprise' && !isWorld(r.world)) throw new IntakeError('Unknown kind of film')
    const cut = parseCut(r.cut)
    const direction = r.direction === undefined ? null : cleanStoredDirection(r.direction)
    const ending = parseEnding(r.ending)
    const outline = parseOutline(r.outline)
    const t = r.template && typeof r.template === 'object' ? (r.template as Record<string, unknown>) : null
    const hues = t && Array.isArray(t.hues) && t.hues.length === 2 && t.hues.every((h) => typeof h === 'number' && h >= 0 && h < 360) ? ([t.hues[0], t.hues[1]] as [number, number]) : undefined
    const template = t && typeof t.id === 'string' && /^[a-z][a-z0-9-]{2,39}$/.test(t.id) ? { id: t.id, palette: Number.isInteger(t.palette) && (t.palette as number) >= 0 && (t.palette as number) < 1000 ? (t.palette as number) : 0, ...(hues ? { hues } : {}), ...(t && typeof t.own === 'string' && /^#[0-9a-f]{6}$/i.test(t.own) ? { own: t.own.toLowerCase() } : {}) } : null
    // A voice note's sound arrives beside the gift; here it is who speaks, how long, and the shape of it.
    const voices = list(r.voices ?? [], 'Voice notes').map((v, i) => {
      const note = (v ?? {}) as Record<string, unknown>
      const photoId = typeof note.photoId === 'string' && photoIds.has(note.photoId) ? note.photoId : ''
      const peaks = Array.isArray(note.peaks) ? note.peaks.slice(0, 64).map((p) => (typeof p === 'number' && p >= 0 && p <= 1 ? Math.round(p * 100) / 100 : 0.3)) : []
      if (typeof note.seconds !== 'number' || !(note.seconds > 0)) throw new IntakeError(`Voice note ${i + 1} is not valid`)
      return { id: id(note.id, `Voice note ${i + 1}`), src: '', seconds: Math.max(0.5, Math.min(61, note.seconds)), ...(typeof note.who === 'string' && note.who.trim() ? { who: text(note.who, LIMITS.name, `Voice note ${i + 1}’s name`) } : {}), ...(photoId ? { photoId } : {}), ...(peaks.length ? { peaks } : {}) }
    })
    if (voices.length > MAX_VOICES) throw new IntakeError(`Up to ${MAX_VOICES} voice notes`)
    if (new Set(voices.map((v) => v.id)).size !== voices.length) throw new IntakeError('Duplicate voice notes')

    const intake: Intake = {
      occasion: r.occasion,
      ...(isRelationship(r.relationship) ? { relationship: r.relationship } : {}),
      ...(typeof r.occasionName === 'string' && r.occasionName.trim() ? { occasionName: text(r.occasionName, LIMITS.occasionName, 'The occasion') } : {}),
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
      ...(r.world !== undefined ? { world: r.world as Intake['world'] } : {}),
      ...(cut ? { cut } : {}),
      // The studio's own choices travel with the gift; anything in them it doesn't recognise is dropped.
      ...(direction ? { direction } : {}),
      ...(ending ? { ending } : {}),
      ...(outline ? { outline } : {}),
      ...(voices.length ? { voices } : {}),
      ...(template ? { template } : {}),
      ...(r.opening && typeof r.opening === 'object' && typeof (r.opening as { title?: unknown }).title === 'string'
        ? { opening: { title: text((r.opening as { title: string }).title, 80, 'The opening line'), body: text((r.opening as { body?: unknown }).body, 180, 'The opening') } }
        : {}),
    }
    if (!intake.sender.trim() || !intake.recipient.trim()) throw new IntakeError('Both names are needed')
    return { ok: true, intake }
  } catch (error) {
    if (error instanceof IntakeError) return { ok: false, error: error.message }
    throw error
  }
}
