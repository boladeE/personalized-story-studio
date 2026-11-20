import { overlap } from './followups'
import type { Answered } from './followups'
import { closeToTheirWords, HABIT, isTheirWords, REASON } from './notes'
import type { SortedNotes } from './notes'
import { SCENE_LAYOUTS } from './types'
import type { Chapter, Intake, Mood, SceneLayout } from './types'
import { LIMITS } from './validate'

/**
 * A film's outline: the scenes it has because of what its sender wrote. A text
 * model reads the note and decides what the scenes are, names each one and
 * places the sender's words in them (src/server/outline.ts); the rules here
 * check that answer, and write a plainer outline when the model is off, slow
 * or wrong. Either way the words inside a scene are the sender's own. Only a
 * scene's name can be the studio's, and the sender can change it.
 */

export const OUTLINE_LIMITS = {
  scenes: 8,
  name: 40,
  /** The most lines a list shows. */
  lines: 7,
  /** A single line longer than this is told as a passage, not shouted. */
  line: 140,
  /** The most pages a told scene keeps. */
  pages: 3,
  /** What fits beside a photo on a scene's first page, and on each page after it. */
  firstPage: 230,
  page: 130,
} as const

const MOODS: Mood[] = ['warm', 'playful', 'tender']
const ID_RE = /^[a-z][a-z0-9-]{0,31}$/i

/** In place of a photo's id: this scene is shown without one. */
export const NO_PHOTO = 'none'

export const newSceneId = () => `s${Math.random().toString(36).slice(2, 9)}`

const oneLine = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '')
/** The opening of a line, for calling a scene by until it has a name. Cut short, it says so. */
const firstWords = (text: string, count: number) => {
  const all = text.replace(/[.!?…]+$/, '').split(/\s+/).filter(Boolean)
  const kept = all.slice(0, count).join(' ').replace(/[,;:–—-]+$/, '')
  return all.length > count ? `${kept}…` : kept
}

/** The lines of a scene that say something and are shown: a `line` shows only its first. */
export const chapterLines = (chapter: Chapter) => {
  const said = chapter.lines.map((l) => l.trim()).filter(Boolean)
  return chapter.layout === 'line' ? said.slice(0, 1) : chapter.layout === 'photos' ? [] : said
}

/** What a scene is called: its name, or the opening of its own words until it has one. */
export function chapterName(chapter: Chapter): string {
  return chapter.name.trim() || firstWords(chapterLines(chapter)[0] ?? '', 4) || (chapter.layout === 'photos' ? 'Photos' : 'New scene')
}

/** Null when the scene can play, otherwise what it still needs. */
export function chapterMissing(chapter: Chapter, intake: Pick<Intake, 'photos'>): string | null {
  if (chapter.layout === 'photos') return intake.photos.length ? null : 'Add a photo'
  return chapterLines(chapter).length ? null : 'Add its words'
}

/**
 * Names that would make every film the same. A scene is only called one of
 * these when the sender's own words say so.
 */
const STOCK_NAMES = /^(the\s+)?(red flags?|reasons?( i love you| why)?|memor(y|ies)( lane)?|habits?|quirks?|little things|main character|things i love( about (you|him|her|them))?|why i love (you|him|her|them)|moments?|highlights?)$/i

/** Give each line to one layout: a scene's shape follows from how much it says. */
function shape(layout: SceneLayout, lines: string[]): { layout: SceneLayout; lines: string[] } {
  if (layout === 'photos') return { layout, lines: [] }
  // A told scene keeps its pages: each is a screen of its own.
  if (layout === 'moment') return { layout, lines: lines.slice(0, OUTLINE_LIMITS.pages) }
  if (lines.length > 1) return { layout: 'list', lines: lines.slice(0, OUTLINE_LIMITS.lines) }
  if ((lines[0]?.length ?? 0) > OUTLINE_LIMITS.line) return { layout: 'moment', lines }
  return { layout: 'line', lines }
}

/**
 * Whatever outlined the film, made safe: scenes of a shape the studio can
 * draw, capped, each with a name and an id. With `source`, a line is kept only
 * when it stays close to words the sender wrote (the studio may tidy them, not
 * invent them), and each line is used once. `photos` is how many photos the sender gave: with none, a scene of
 * photos is dropped.
 */
export function cleanOutline(raw: unknown, { source, photos = 0, proper = [] }: { source?: string; photos?: number; /** Names that keep their capitals in a scene's name. */ proper?: string[] } = {}): Chapter[] {
  // A name is written as a sentence is: "On that sofa", not "On That Sofa". A word keeps its capital when the
  // sender wrote it with one, or it is one of the two names.
  const kept = new Set([...(source?.match(/\b[A-Z][\p{L}\p{N}'’]*/gu) ?? []), ...proper.flatMap((p) => p.split(/\s+/))].filter(Boolean))
  const sentenceCase = (name: string) =>
    name
      .split(' ')
      .map((w, i) => (source && i > 0 && /^[A-Z][a-z'’]+$/.test(w) && !kept.has(w) ? w.toLowerCase() : w))
      .join(' ')
  const seen = new Set<string>()
  const ids = new Set<string>()
  const names = new Set<string>()
  // A photo sits beside one scene.
  const photoIds = new Set<string>()
  const voiceIds = new Set<string>()
  const out: Chapter[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    if (out.length === OUTLINE_LIMITS.scenes) break
    const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const wanted = SCENE_LAYOUTS.find((l) => l === r.layout) ?? 'line'
    if (wanted === 'photos' && (!photos || out.some((c) => c.layout === 'photos'))) continue
    const kept = (Array.isArray(r.lines) ? r.lines : [])
      .map((l) => oneLine(l, wanted === 'moment' ? LIMITS.memoryStory : LIMITS.listItem))
      .filter((l) => l && (!source || closeToTheirWords(l, source)))
      .filter((l) => (seen.has(l.toLowerCase()) ? false : (seen.add(l.toLowerCase()), true)))
    const { layout, lines } = shape(wanted, kept)
    if (layout !== 'photos' && !lines.length) continue
    let name = sentenceCase(oneLine(r.name, OUTLINE_LIMITS.name).replace(/[.:;,]+$/, ''))
    // A stock label is the studio's old habit, not this film's scene. So is a name another scene already has.
    if ((STOCK_NAMES.test(name) && !(source && isTheirWords(name, source))) || names.has(name.toLowerCase())) name = ''
    if (name) names.add(name.toLowerCase())
    const given = typeof r.id === 'string' && ID_RE.test(r.id) && !ids.has(r.id) ? r.id : ''
    let id = given
    for (let n = out.length + 1; !id; n++) if (!ids.has(`s${n}`)) id = `s${n}`
    ids.add(id)
    const mood = MOODS.find((m) => m === r.mood) ?? 'warm'
    const intro = layout === 'photos' && !oneLine(r.intro, 90) ? '' : oneLine(r.intro, 90)
    const voiceId = layout !== 'photos' && typeof r.voiceId === 'string' && /^[a-z0-9-]{1,32}$/i.test(r.voiceId) && !voiceIds.has(r.voiceId) && (voiceIds.add(r.voiceId), true) ? r.voiceId : ''
    out.push({ id, name, layout, mood, lines, ...(intro ? { intro } : {}), ...(voiceId ? { voiceId } : {}), ...(typeof r.photoId === 'string' && /^[a-z0-9-]{1,64}$/i.test(r.photoId) && !photoIds.has(r.photoId) && (photoIds.add(r.photoId), true) ? { photoId: r.photoId } : {}) })
  }
  return out
}

/** Something that happened, as opposed to how someone is. */
const TOLD =
  /\b(we|was|were|went|met|had|did|said|told|came|got|took|made|gave|left|stayed|started|broke|drove|walked|ran|called|asked|ago)\b|\b\w{3,}ed\b|^(the|that|one|last|our first) (night|day|time|morning|evening|afternoon|week|year|summer|winter|trip)\b/i
/** A sentence that carries on the one before it. */
const CARRIES_ON = /^(then|and|but|so|after|later|until|by the|when|it|that|she|he|they|you|i)\b/i

/**
 * An outline by rule, for when the model is off, slow or wrong. The note is
 * read a sentence at a time: something that happened starts a moment and the
 * sentences that carry it on join it; things they do that sit together are a
 * list, and so are the things loved about them. Each answer to a follow-up
 * joins the part of the note it was about. Plainer than the model's, and its
 * names are plainer too, but each moment still gets a scene of its own.
 */
export function outlineByWords(text: string, answered: Answered[], them: string): Chapter[] {
  const who = them.trim() || 'them'
  // The rule changes no words, but it does write them as sentences: a capital to start, "I" for "i", a stop to end.
  const tidy = (s: string) => {
    const said = s.trim().replace(/\bi\b(?=['’ ]|$)/g, 'I')
    const capital = said.charAt(0).toUpperCase() + said.slice(1)
    return /[.!?…"”’')]$/.test(capital) ? capital : `${capital}.`
  }
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(tidy)
  type Kind = 'told' | 'does' | 'loved'
  const kindOf = (s: string): Kind => (HABIT.test(s) ? 'does' : REASON.test(s) ? 'loved' : TOLD.test(s) ? 'told' : 'does')
  const groups: Array<{ kind: Kind; lines: string[]; name: string }> = []
  let opener = ''
  sentences.forEach((sentence, i) => {
    const next = sentences[i + 1]
    // A few words by themselves before something that happened ("Moving day.") are what that moment is called.
    if (sentence.split(' ').length <= 3 && next && kindOf(next) === 'told' && !TOLD.test(sentence)) return void (opener = sentence.replace(/[.!?]+$/, ''))
    const kind = sentence.length > LIMITS.listItem ? 'told' : kindOf(sentence)
    const last = groups[groups.length - 1]
    if (last?.kind === kind && !opener && (kind !== 'told' || CARRIES_ON.test(sentence)) && (kind === 'told' || last.lines.length < OUTLINE_LIMITS.lines)) last.lines.push(sentence)
    else groups.push({ kind, lines: [sentence], name: opener })
    opener = ''
  })
  // Each answer is read in the same breath as what it was about.
  for (const { quote, answer } of answered) {
    if (!answer.trim()) continue
    const said = tidy(answer)
    const home = groups
      .flatMap((group) => group.lines.map((line, at) => ({ group, at, match: overlap(quote, line) })))
      .sort((a, b) => b.match - a.match)[0]
    if (home && home.match >= 0.6 && (home.group.kind === 'told' || `${home.group.lines[home.at]} ${said}`.length <= LIMITS.listItem)) home.group.lines[home.at] = `${home.group.lines[home.at]} ${said}`
    else groups.push({ kind: said.length > OUTLINE_LIMITS.line ? 'told' : 'does', lines: [said], name: '' })
  }
  let does = 0
  let loved = 0
  return cleanOutline(
    groups.map(({ kind, lines, name }) => {
      if (kind === 'told') return { name, layout: 'moment', mood: 'tender', lines: [lines.join(' ')] }
      // The first list of each kind has a plain name; any other goes by its own first words.
      const first = kind === 'does' ? does++ === 0 : loved++ === 0
      return { name: lines.length > 1 && first ? (kind === 'does' ? `The way ${who} is` : `About ${who}`) : '', layout: lines.length > 1 ? 'list' : 'line', mood: kind === 'does' ? 'playful' : 'tender', lines }
    }),
  )
}

/**
 * A told scene's words as the screens they fill: the first beside its photo, the rest a page each.
 * A passage too long for its screen is turned over at a sentence's end, so several paragraphs about
 * someone become several pages instead of one crowded one.
 */
export function pagesOf(chapter: Chapter): string[] {
  const pages: string[] = []
  for (const passage of chapterLines(chapter)) {
    let page = ''
    for (const sentence of passage.split(/(?<=[.!?…])\s+/)) {
      const room = pages.length ? OUTLINE_LIMITS.page : OUTLINE_LIMITS.firstPage
      if (page && `${page} ${sentence}`.length > room) {
        pages.push(page)
        page = sentence
      } else page = page ? `${page} ${sentence}` : sentence
    }
    if (page) pages.push(page)
  }
  return pages
}

/**
 * The scenes an outlined film is made of. One of them is always the photos: when the outline has
 * no such scene it is added last, so a photo the sender adds is always seen, and so there is a
 * place in the editor to add one. Null when the film has no outline and is told in the older fixed scenes.
 */
export function outlineOf(intake: Pick<Intake, 'outline' | 'photos' | 'recipient'>): Chapter[] | null {
  const outline = intake.outline
  if (!outline) return null
  if (outline.some((c) => c.layout === 'photos')) return outline
  return [...outline, { id: 'photos', name: `${intake.recipient.trim() || 'Them'}, in pictures`, layout: 'photos', mood: 'warm', lines: [] }]
}

/**
 * An outline's words as the older sorted notes, for the things still told that way: the rule that
 * picks a kind of film, and the song, which is written from what is loved, what they do and what happened.
 */
export function notesOf(outline: Chapter[], wish = ''): SortedNotes {
  const notes: SortedNotes = { spotlight: '', memories: [], habits: [], reasons: [], wish }
  for (const chapter of outline) {
    const lines = chapterLines(chapter)
    if (chapter.layout === 'moment') notes.memories.push({ title: chapterName(chapter), story: lines.join(' ') })
    else if (chapter.mood === 'playful') notes.habits.push(...lines)
    else notes.reasons.push(...lines)
  }
  return notes
}

/** The same outline with one scene changed. */
export const withChapter = (outline: Chapter[], id: string, patch: Partial<Chapter>): Chapter[] => outline.map((c) => (c.id === id ? { ...c, ...patch } : c))

/** A new, empty scene for the sender to write. */
export const blankChapter = (taken: string[]): Chapter => {
  let id = newSceneId()
  while (taken.includes(id)) id = newSceneId()
  return { id, name: '', layout: 'line', mood: 'warm', lines: [''] }
}

/**
 * Put the voice notes added while the film was being made onto its scenes: each where the director
 * placed it, and any it left out on the scenes of words nearest the end that have none, so nothing
 * the sender recorded goes unheard.
 */
export function withVoices(outline: Chapter[], voices: Array<{ id: string; src: string; seconds: number }>): Chapter[] {
  const left = [...voices]
  const placed = outline.map((chapter) => {
    const { voiceId, ...rest } = chapter
    const at = left.findIndex((v) => v.id === voiceId)
    if (at < 0) return rest
    const [note] = left.splice(at, 1)
    return { ...rest, voice: { src: note.src, seconds: note.seconds } }
  })
  for (let i = placed.length - 1; i >= 0 && left.length; i--) {
    if (placed[i].layout === 'photos' || placed[i].voice) continue
    const note = left.pop()!
    placed[i] = { ...placed[i], voice: { src: note.src, seconds: note.seconds } }
  }
  return placed
}
