import { LIMITS } from './validate'

/**
 * What a sender types in one box, sorted into the film's scenes. The sorting
 * only moves their words around: every piece must be made of words they
 * wrote, and anything that isn't is dropped before it reaches the film.
 */
export interface SortedNotes {
  spotlight: string
  memories: Array<{ title: string; story: string }>
  habits: string[]
  reasons: string[]
  wish: string
}

export const NOTES_LIMIT = 2500
export const emptyNotes = (): SortedNotes => ({ spotlight: '', memories: [], habits: [], reasons: [], wish: '' })

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
const oneLine = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '')

/** True when (nearly) every word of `piece` is one the sender wrote. Short joining words may differ. */
export function isTheirWords(piece: string, source: string): boolean {
  const have = new Set(words(source))
  const all = words(piece)
  if (!all.length) return false
  const weighty = all.filter((w) => w.length > 3)
  const strangers = weighty.filter((w) => !have.has(w)).length
  return strangers === 0 || (weighty.length >= 8 && strangers / weighty.length <= 0.1)
}

/** Clean whatever the sorter returned: right shapes, capped, and only the sender's words. */
export function keepTheirWords(raw: unknown, source: string): SortedNotes {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const lines = (value: unknown, count: number) =>
    (Array.isArray(value) ? value : [])
      .map((v) => oneLine(v, LIMITS.listItem))
      .filter((v) => v && isTheirWords(v, source))
      .filter((v, i, list) => list.indexOf(v) === i)
      .slice(0, count)
  const memories = (Array.isArray(r.memories) ? r.memories : [])
    .map((m) => {
      const memory = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>
      const story = oneLine(memory.story, LIMITS.memoryStory)
      let title = oneLine(memory.title, LIMITS.memoryTitle)
      // A title the sender didn't write is replaced by the opening of their own story.
      if (!title || !isTheirWords(title, source)) title = story.split(/(?<=[.!?])\s/)[0].split(' ').slice(0, 7).join(' ')
      // "The driving lesson" above "The driving lesson: I stalled…" says it twice; the story then starts after it.
      const opener = title.replace(/[.!?:,]+$/, '')
      const after = story.slice(opener.length)
      const rest = after.replace(/^[\s.:,;!?–—-]+/, '')
      if (opener && story.toLowerCase().startsWith(opener.toLowerCase()) && /^[.:,;!?–—-]/.test(after) && rest.length >= 20) return { title, story: rest.charAt(0).toUpperCase() + rest.slice(1) }
      return { title, story }
    })
    .filter((m) => m.story && m.title && isTheirWords(m.story, source))
    .slice(0, 3)
  const text = (value: unknown, max: number) => {
    const line = oneLine(value, max)
    return line && isTheirWords(line, source) ? line : ''
  }
  return { spotlight: text(r.spotlight, LIMITS.spotlight), memories, habits: lines(r.habits, LIMITS.habits), reasons: lines(r.reasons, LIMITS.reasons), wish: text(r.wish, LIMITS.wish) }
}

export const HABIT = /\b(always|never|every time|every single|keeps?|says?|steals?|sends?|calls?|forgets?|insists?|refuses?|orders?|replies|leaves?)\b/i
export const REASON = /\b(because|love|kind|patient|funny|listens?|remembers?|shows? up|believes?|proud|grateful|thank)/i

/**
 * Sorting without a model, for when it is switched off or doesn't answer:
 * habits and reasons are picked out by their tell-tale words, and what is
 * left is told as one memory. Cruder than the model, but nobody is left stuck.
 */
export function sortLocally(source: string): SortedNotes {
  const sentences = source
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const notes = emptyNotes()
  const rest: string[] = []
  for (const sentence of sentences) {
    if (sentence.length <= LIMITS.listItem && HABIT.test(sentence) && notes.habits.length < LIMITS.habits) notes.habits.push(sentence)
    else if (sentence.length <= LIMITS.listItem && REASON.test(sentence) && notes.reasons.length < LIMITS.reasons) notes.reasons.push(sentence)
    else rest.push(sentence)
  }
  if (rest.length) {
    const story = rest.join(' ').slice(0, LIMITS.memoryStory)
    notes.memories.push({ title: rest[0].replace(/[.!?]+$/, '').split(' ').slice(0, 7).join(' '), story })
  }
  return notes
}

/** How many of the film's scenes these notes can fill, for telling the sender what they got. */
export const notesCount = (n: SortedNotes) => n.memories.length + n.habits.length + n.reasons.length + (n.spotlight ? 1 : 0) + (n.wish ? 1 : 0)

/** Pour sorted notes into a draft. The letter, photos and captions are left as they are. */
export function applyNotes<T extends { memories: Array<{ id: string; title: string; story: string; photoId: string }>; habits: string[]; reasons: string[]; spotlight: string; wish: string }>(
  intake: T,
  notes: SortedNotes,
  newId: () => string = () => crypto.randomUUID(),
): T {
  const pad = (list: string[]) => (list.length >= 3 ? list : [...list, ...Array<string>(3 - list.length).fill('')])
  const blank = () => ({ id: `m-${newId()}`, title: '', story: '', photoId: '' })
  const memories = notes.memories.map((m) => ({ id: `m-${newId()}`, title: m.title, story: m.story, photoId: '' }))
  // A lone reason or habit is one short of its own scene. Rather than lose it, it says how they are
  // beside their photo, unless the sender's words already filled that line.
  const alone = (list: string[]) => (list.length === 1 && !notes.spotlight ? list : [])
  const spotlight = notes.spotlight || [...alone(notes.reasons), ...alone(notes.habits)].join(' ')
  const kept = (list: string[]) => (alone(list).length ? [] : list)
  return {
    ...intake,
    memories: memories.length ? memories : [blank(), blank()],
    habits: pad(kept(notes.habits)),
    reasons: pad(kept(notes.reasons)),
    spotlight,
    wish: notes.wish || intake.wish,
  }
}
