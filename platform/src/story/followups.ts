import { emptyNotes, isTheirWords, sortLocally } from './notes'
import type { SortedNotes } from './notes'
import { LIMITS } from './validate'

/**
 * Follow-up questions: after the sender has written about someone, the studio
 * asks up to three short questions, each hung on something they wrote, to draw
 * out one more detail. A text model writes the questions on the server
 * (src/server/followups.ts); the rules here ask plainer ones when it is off,
 * slow or wrong. The questions never appear in the film. The answers are the
 * sender's own words, and go into the film the way the rest of their note does.
 */

export interface Followup {
  /** The part of the sender's note the question is about, as they wrote it. */
  quote: string
  question: string
}
export interface Answered extends Followup {
  answer: string
}

export const FOLLOWUP_LIMITS = { count: 3, quote: 200, question: 120, answer: 300 } as const

const oneLine = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '')
const sentencesOf = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

/** Whatever a model returned, made safe: up to three questions, each about words the sender really wrote. */
export function cleanFollowups(raw: unknown, source: string): Followup[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { questions?: unknown } | null)?.questions) ? (raw as { questions: unknown[] }).questions : []
  const kept: Followup[] = []
  for (const item of list) {
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const quote = oneLine(r.quote, FOLLOWUP_LIMITS.quote).replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    let question = oneLine(r.question, FOLLOWUP_LIMITS.question)
    if (!quote || !question || quote.split(' ').length < 3 || !isTheirWords(quote, source)) continue
    if (!question.endsWith('?')) question = `${question.replace(/[.!]+$/, '')}?`
    if (kept.some((k) => k.quote === quote || k.question === question)) continue
    kept.push({ quote, question })
    if (kept.length === FOLLOWUP_LIMITS.count) break
  }
  return kept
}

const HABIT = /\b(always|never|every time|every single|keeps?|says?|steals?|sends?|calls?|forgets?|insists?|refuses?|orders?|replies|leaves?)\b/i
const REASON = /\b(because|love|kind|patient|funny|listens?|remembers?|shows? up|believes?|proud|grateful|thank)/i

/** Questions by rule: one about a habit, one about a moment, one about a reason, in the order the note has them. */
export function followupsLocally(source: string, them: string): Followup[] {
  const who = them.trim() || 'they'
  const asked = new Set<string>()
  const out: Followup[] = []
  for (const sentence of sentencesOf(source)) {
    if (sentence.split(' ').length < 4 || sentence.length > FOLLOWUP_LIMITS.quote) continue
    const kind = HABIT.test(sentence) ? 'habit' : REASON.test(sentence) ? 'reason' : 'moment'
    if (asked.has(kind)) continue
    asked.add(kind)
    const question = kind === 'habit' ? `What does ${who} say when you bring it up?` : kind === 'reason' ? 'What is one time you noticed that?' : 'What happened next?'
    out.push({ quote: sentence, question })
    if (out.length === FOLLOWUP_LIMITS.count) break
  }
  return out
}

/** The answers worth keeping: tidied, capped, and only those that say something. */
export function cleanAnswers(raw: unknown): Answered[] {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => {
      const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      return { quote: oneLine(r.quote, FOLLOWUP_LIMITS.quote), question: oneLine(r.question, FOLLOWUP_LIMITS.question), answer: oneLine(r.answer, FOLLOWUP_LIMITS.answer) }
    })
    .filter((a) => a.quote && a.answer)
    .slice(0, FOLLOWUP_LIMITS.count)
}

/** Everything the sender wrote: their note, then their answers. What "their own words" is checked against. */
export const withAnswers = (about: string, answered: Answered[]) => [about.trim(), ...answered.map((a) => a.answer.trim()).filter(Boolean)].join('\n')

export const overlap = (a: string, b: string) => {
  const words = (t: string) => new Set((t.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 3))
  const [x, y] = [words(a), words(b)]
  let shared = 0
  for (const w of x) if (y.has(w)) shared++
  return x.size ? shared / x.size : 0
}

/**
 * Sorting by rule, with answers: the note is sorted as before, then each
 * answer joins the part of the note its question was about, so it is read in
 * the same breath. An answer with no home becomes part of the first memory.
 */
export function sortLocallyWithAnswers(about: string, answered: Answered[]): SortedNotes {
  const notes = about.trim() ? sortLocally(about) : emptyNotes()
  for (const { quote, answer } of answered) {
    const said = answer.trim()
    if (!said) continue
    const joinTo = (list: string[]) => {
      const at = list.findIndex((item) => overlap(quote, item) >= 0.6)
      if (at < 0 || `${list[at]} ${said}`.length > LIMITS.listItem) return false
      list[at] = `${list[at]} ${said}`
      return true
    }
    if (joinTo(notes.habits) || joinTo(notes.reasons)) continue
    const memory = notes.memories.find((m) => overlap(quote, `${m.title} ${m.story}`) >= 0.6) ?? notes.memories[0]
    if (memory && `${memory.story} ${said}`.length <= LIMITS.memoryStory) memory.story = `${memory.story} ${said}`
    else if (!memory) notes.memories.push({ title: quote.replace(/[.!?]+$/, '').split(' ').slice(0, 7).join(' '), story: said })
  }
  return notes
}
