import { cleanDirection, directLocally, DIRECTED_WORLDS } from '../story/direction'
import type { DirectionPlan } from '../story/direction'
import { withAnswers } from '../story/followups'
import type { Answered } from '../story/followups'
import { closeToTheirWords } from '../story/notes'
import { occasionOf } from '../story/occasions'
import { cleanOutline, notesOf, NO_PHOTO, outlineByWords, OUTLINE_LIMITS } from '../story/outline'
import { DIRECTION_REASONS } from '../story/types'
import type { Chapter, Occasion, Relationship } from '../story/types'
import { LIMITS } from '../story/validate'
import { VIBES } from '../story/vibes'
import { NOT_STORED, sortProvider } from './sort'

/**
 * Outlining a film. A Google text model reads what the sender wrote and
 * decides what this film's scenes are: which there are, what each is called,
 * which of the sender's words go in each, and in what order they play. It also
 * chooses the kind of film and its colours. The scenes are this note's and no
 * other's: nothing here offers the model a list of scenes to fill.
 *
 * The model may name a scene and may edit what the sender wrote so it reads
 * well on screen (people write, and dictate, the way they talk); it may not
 * say anything they did not. Each line of its answer is checked for staying
 * close to the sender's own words, and when the model is off, slow or wrong
 * the film is outlined by rule from the note as written, so a film is always made.
 */

export interface OutlineBrief {
  text: string
  sender: string
  recipient: string
  answered: Answered[]
  occasion: Occasion
  /** An occasion of the sender's own, when none of the studio's fits. */
  occasionName?: string
  relationship?: Relationship
  photos: number
  letter: boolean
  /**
   * The sender's photos, small, in order, with their ids, unless the studio has turned this off
   * (`DIRECTOR_SEES_PHOTOS=0`). With them each scene is put
   * beside the photo that shows it (`placePhotos`); without them photos are dealt out blind.
   */
  peeks?: Array<{ id: string; jpeg: string }>
}

/** Whether the director is shown the sender's photos. On (the owner's decision of 2026-11-20) unless the studio turns it off. */
export const directorSeesPhotos = () => process.env.DIRECTOR_SEES_PHOTOS !== '0'

export interface Outlined {
  outline: Chapter[]
  wish: string
  /** The film's first words, written for it. Absent when the film was outlined by rule. */
  opening?: { title: string; body: string }
  direction: DirectionPlan
  by: 'model' | 'rule'
}

const SCHEMA = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          layout: { type: 'string', enum: ['line', 'list', 'moment', 'photos'] },
          mood: { type: 'string', enum: ['playful', 'tender', 'warm'] },
          lines: { type: 'array', items: { type: 'string' } },
          intro: { type: 'string' },
        },
        required: ['name', 'intro', 'layout', 'mood', 'lines'],
      },
    },
    wish: { type: 'string' },
    about: { type: 'string' },
    opening_line: { type: 'string' },
    opening_sub: { type: 'string' },
    world: { type: 'string', enum: DIRECTED_WORLDS },
    look: { type: 'string', enum: ['screening', 'garden', 'paper'] },
    because: { type: 'string', enum: [...DIRECTION_REASONS] },
    tune: { type: 'string', enum: VIBES.map((v) => v.id) },
    voice: { type: 'string', enum: ['woman', 'man'] },
  },
  required: ['about', 'opening_line', 'opening_sub', 'scenes', 'wish', 'world', 'look', 'because', 'tune', 'voice'],
}

export function outlineBrief(brief: OutlineBrief) {
  const who = brief.recipient || 'the person'
  const from = brief.sender || 'the sender'
  return [
    `${from} is making a short film as a gift for ${who}, and wrote the note below. Outline the film: decide what its scenes are. The scenes come from this note and from nothing else. There is no standard set of scenes to fill; a different note would give a different film.`,
    `The occasion: ${brief.occasionName?.trim() || occasionOf(brief.occasion).name}.${brief.relationship ? ` ${who} is ${from}'s ${brief.relationship}.` : ''} Photos given: ${brief.photos}. The film already has its own opening and ending${brief.letter ? ', and a letter' : ''}; do not outline those.`,
    [
      'Direct it as one film, not a list of extracts:',
      `- about: first decide, in one plain sentence, what this film is saying to ${who}. Everything else serves that sentence. If a part of the note does not serve it, leave it out.`,
      `- opening_line and opening_sub: the film's first words, shown under ${who}'s name. \`opening_line\` is two to six words; \`opening_sub\` is one sentence of at most fourteen words. They are in ${from}'s voice, they say what this film is, and they are made from this note alone. Never a stock opener such as "Get comfortable", "Sit back", "This one is for you" or "A few things I have been meaning to say".`,
      '- The scenes then follow one another like a film: each leads to the next, and the order builds to the scene that matters most.',
    ].join('\n'),
    [
      'The scenes:',
      '- A scene is one thing: one moment that happened, one habit or saying that deserves a screen to itself, or a run of things that are alike. Group what belongs together and keep apart what does not.',
      `- name: what this scene is called, in one to four words. Take it from the scene's own words, or say plainly what they are about ("The coffee queue", "Voice notes", "Sunday calls"). It is a title, never a sentence, and never says what the scene will say. Never use a stock label such as "Memories", "Memory lane", "Reasons", "Reasons I love you", "Red flags", "Habits", "Quirks", "Little things" or "Highlights" unless the note itself uses those words. Never put a name, a place or a fact in a title that is not in the note. No two scenes share a name. A name never just repeats its scene's own sentence. Name the point of the scene, what it shows about them, not a detail that happens to be in it: a scene about how she quietly looks after everyone is not called "Washing dishes" because dishes are mentioned.`,
      `- intro: one short line, at most ten words, shown with the name on the scene's title card before the scene plays. In ${from}'s voice, it leads the viewer in and joins this scene to the film ("Then there is the way you laugh."). It never repeats the scene's own lines and never adds a fact.`,
      '- layout: `line` is a single sentence on a screen of its own (`lines` has exactly one item, at most 140 characters). `list` is two to seven short lines that are alike, shown one after another (one per item). `moment` is something told: a thing that happened, or a longer thought about who they are. \`lines\` holds its pages, one to three, each one or two whole sentences (about 130 characters at most) that read well alone. A page is never a piece of a sentence: do not cut one sentence across two pages, and if the telling is a single sentence it is a single page; the first is shown beside a photo when there is one, and each page after it has a screen to itself. Several paragraphs about one thing are one scene of several pages, not several scenes and not one crowded page.' +
        (brief.photos ? ` \`photos\` is a scene of ${from}'s photos, at most one, with a name and no lines; include it when there are more photos than moments.` : ' Do not use `photos`: there are none.'),
      `- mood: playful when the scene teases ${who} or is funny, tender when it is sincere or loving, warm otherwise.`,
      `- Put the scenes in the order the film should play. Open with what is most like ${who}. Playful scenes usually come before tender ones, and the film ends on the scene that means the most.`,
      '- No scene is more than three pages, and two short thoughts that belong together share a page. A film is not a run of text screens.',
      '- Every scene must be worth a screen. Do not make a scene out of a few words that only repeat what another scene says, and do not pad a scene to fill it.',
      `- Between two and ${OUTLINE_LIMITS.scenes - 1} scenes. A short note makes a short film: never stretch it, and never use a line twice. Leaving something out is fine.`,
    ].join('\n'),
    [
      'The words inside the scenes:',
      `- ${from} wrote this the way people talk, and may have dictated it. Edit it the way a good film editor would: cut rambling, false starts, filler and repetition; mend grammar and spelling; break a long run-on thought into short sentences; and make each line fit a screen. ${who} must still hear ${from} in every line.`,
      `- Keep what makes it theirs exactly as written: their phrases and jokes, anything in quotation marks, their names for people and things, their slang. If a sentence is already good, leave it alone.`,
      `- ${who} is the one watching. Every line is ${from} speaking to ${who}: "you", "your". If the note talks about ${who} ("she is kind", "${who} is my sister"), turn it to face them ("you are kind", "you are my sister"). Never "he", "she" or "they" for ${who}, and never their name as if they were not there.`,
      '- Never add a fact, a name, a place, a feeling, a joke or a compliment that is not in the note. Never make it more romantic, more formal or more poetic than they wrote it. Every line must be something they said, said more cleanly; never something new.',
    ].join('\n'),
    `wish: the film's last line, shown alone after everything else. Always give one. Use the note's closing line, hope or promise if it has one; if it has none, take the most heartfelt sentence in the note ("I love you so much", "I thank God for you"), facing ${who}, and do not also use that sentence in a scene. It is ${from}'s words, tidied; never a line of your own.`,
    [
      'Then choose how the film is made:',
      '- world: `scrapbook` is a handmade album (taped photos, sticky notes, handwriting): warm, nostalgic, unhurried; best when the note is told in moments, or is tender. `mixtape` is a tape made for one person (tall capitals on flat colour, cuts on the beat): loud, playful, confident; best when the note teases, is funny, or is short.',
      '- look: its colours. `screening` is the dark one, `garden` the warm one, `paper` the light one.',
      '- because: the main reason for the world you chose: teasing (the note is mostly habits and jokes), memories (it is told in moments), photos (many photos and few words), tender (it is mostly sincere), short (there is very little to go on).',
    ].join('\n'),
    [
      `And the song. One song is written and sung for this film, in ${from}'s words to ${who}. Choose what it should sound like, for this note in particular: two notes that differ should not get the same song by habit.`,
      `- tune: ${VIBES.map((v) => `\`${v.id}\` (${v.name}: ${v.feel.charAt(0).toLowerCase()}${v.feel.slice(1)})`).join('; ')}. Go by how the note feels and moves: how fast it talks, whether it jokes or aches, whether it is a late-night thought or a celebration.`,
      `- voice: \`woman\` or \`man\`, the voice singing as ${from}. If the note itself makes clear who is speaking, match that. If it does not, choose the voice that suits the tune and the feeling; do not guess from a name.`,
    ].join('\n'),
    `The note:\n${brief.text}`,
    ...(brief.answered.length
      ? [
          [
            `${from} was then asked about parts of the note, and answered. The answers are ${from}'s own words too: use them like the rest of the note, and keep each answer with the part it is about (in the same scene, straight after it). The questions are not ${from}'s words and must never appear.`,
            ...brief.answered.map((a) => `- About "${a.quote}", asked "${a.question}", ${from} answered: ${a.answer}`),
          ].join('\n'),
        ]
      : []),
  ].join('\n\n')
}

async function askModel(brief: OutlineBrief, model: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        ...NOT_STORED,
        contents: [{ role: 'user', parts: [{ text: outlineBrief(brief) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, thinkingConfig: { thinkingLevel: process.env.GEMINI_OUTLINE_THINKING ?? 'low' } },
      }),
    })
    if (!response.ok) throw new Error(`Gemini ${response.status}: ${(await response.text().catch(() => '')).slice(0, 200)}`)
    const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> }
    const reply = (body.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => typeof p.text === 'string' && !p.thought)
      .map((p) => p.text)
      .join('')
    return JSON.parse(reply)
  } finally {
    clearTimeout(timer)
  }
}

/** A model's answer, checked: only scenes the studio can draw, only the sender's words in them. Null when nothing usable is left. */
export function checkOutline(raw: unknown, brief: OutlineBrief): Omit<Outlined, 'by'> | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const written = withAnswers(brief.text, brief.answered)
  const outline = cleanOutline(r.scenes, { source: written, photos: brief.photos, proper: [brief.recipient, brief.sender] })
  if (!outline.some((c) => c.layout !== 'photos')) return null
  const said = typeof r.wish === 'string' ? r.wish.replace(/\s+/g, ' ').trim().slice(0, LIMITS.wish) : ''
  const wish = said && closeToTheirWords(said, written) ? said : ''
  const facts = { occasion: brief.occasion, relationship: brief.relationship, recipient: brief.recipient, photos: brief.photos, letter: brief.letter }
  const chosen = cleanDirection({ world: r.world, look: r.look, because: r.because, tune: r.tune, voice: r.voice }, DIRECTED_WORLDS)
  // The song the model chose stands even when its kind of film is not one the studio directs.
  const song = cleanDirection({ world: 'mixtape', tune: r.tune, voice: r.voice })
  const sung = { ...(song?.tune ? { tune: song.tune } : {}), ...(song?.voice ? { voice: song.voice } : {}) }
  const short = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '')
  const opening = short(r.opening_line, 60) ? { title: short(r.opening_line, 60), body: short(r.opening_sub, 140) } : undefined
  return { outline, wish, ...(opening ? { opening } : {}), direction: chosen ?? { ...directLocally({ ...facts, notes: notesOf(outline, wish) }), designs: {}, order: [], ...sung } }
}

/** The outline by rule: the note read a sentence at a time, each moment a scene. */
export function outlineByRule(brief: OutlineBrief): Outlined {
  const outline = outlineByWords(brief.text, brief.answered, brief.recipient)
  const direction = directLocally({ occasion: brief.occasion, relationship: brief.relationship, recipient: brief.recipient, photos: brief.photos, letter: brief.letter, notes: notesOf(outline) })
  return { outline, wish: '', direction: { ...direction, designs: {}, order: [] }, by: 'rule' }
}

const PLACE_SCHEMA = {
  type: 'object',
  properties: { placements: { type: 'array', items: { type: 'object', properties: { scene: { type: 'integer' }, photo: { type: 'integer' } }, required: ['scene', 'photo'] } } },
  required: ['placements'],
}

/** What the model placing photos is told: the scenes as written, and nothing it may add to them. */
export function placeBrief(outline: Chapter[], count: number) {
  return [
    `Below are the scenes of a short film made as a gift, numbered, and then the sender's ${count} photos, numbered in order. Say which photo belongs beside which scene.`,
    [
      'Rules:',
      '- Match a scene to the photo that shows what it says: the same place, the same moment, the same thing happening. A scene about a feeling can take a photo where the person simply looks like themselves.',
      '- A photo goes beside one scene only, and a scene takes one photo. Place every photo that has a scene it fits: a photo of a car journey belongs with the road trip, a photo of a kitchen with the cooking. Leave a scene out only when no photo has anything to do with it: a wrong photo is worse than none. Photos left over are shown together elsewhere.',
      '- You only place photos. You write nothing.',
    ].join('\n'),
    `The scenes:\n${outline.map((c, i) => `${i + 1}. ${c.name || '(unnamed)'}: ${c.lines.join(' ')}`).join('\n')}`,
  ].join('\n\n')
}

/** A model's placements laid over an outline: only scenes of words, real photos, each photo once. */
export function applyPlacements(outline: Chapter[], peeks: Array<{ id: string }>, raw: unknown): Chapter[] {
  const used = new Set(outline.map((c) => c.photoId).filter(Boolean))
  const placed = new Map<number, string>()
  for (const item of Array.isArray((raw as { placements?: unknown } | null)?.placements) ? (raw as { placements: unknown[] }).placements : []) {
    const p = (item && typeof item === 'object' ? item : {}) as { scene?: unknown; photo?: unknown }
    const scene = outline[Number(p.scene) - 1]
    const photo = peeks[Number(p.photo) - 1]
    if (!scene || !photo || scene.photoId || placed.has(Number(p.scene) - 1) || used.has(photo.id) || scene.layout === 'list' || scene.layout === 'photos') continue
    used.add(photo.id)
    placed.set(Number(p.scene) - 1, photo.id)
  }
  // A scene of words that was given no photo goes without one: dealt out blind, it could get the wrong one.
  return outline.map((c, i) => (placed.has(i) ? { ...c, photoId: placed.get(i) } : c.photoId || c.layout === 'list' || c.layout === 'photos' ? c : { ...c, photoId: NO_PHOTO }))
}

/**
 * Put each scene beside the photo that shows it. A separate, quick look by a fast model once the
 * scenes are written: shown the photos, the model that writes the scenes took a minute. If this
 * fails or is slow the photos are dealt out blind, as they are when the director may not see them.
 */
async function placePhotos(outline: Chapter[], peeks: NonNullable<OutlineBrief['peeks']>): Promise<Chapter[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.PLACE_TIMEOUT_MS ?? 20_000))
  try {
    const model = process.env.GEMINI_PLACE_MODEL ?? 'gemini-3.8-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        ...NOT_STORED,
        contents: [{ role: 'user', parts: [{ text: placeBrief(outline, peeks.length) }, ...peeks.flatMap((peek, i) => [{ text: `Photo ${i + 1}:` }, { inlineData: { mimeType: 'image/jpeg', data: peek.jpeg } }])] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: PLACE_SCHEMA, thinkingConfig: { thinkingLevel: 'low' } },
      }),
    })
    if (!response.ok) throw new Error(`Gemini ${response.status}: ${(await response.text().catch(() => '')).slice(0, 200)}`)
    const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> }
    const reply = (body.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => typeof p.text === 'string' && !p.thought)
      .map((p) => p.text)
      .join('')
    return applyPlacements(outline, peeks, JSON.parse(reply))
  } catch (error) {
    console.error('[place] photos placed blind', error)
    return outline
  } finally {
    clearTimeout(timer)
  }
}

export async function outlineFilm(brief: OutlineBrief): Promise<Outlined> {
  const made = await outlineWords(brief)
  if (!brief.peeks?.length || sortProvider() !== 'gemini') return made
  return { ...made, outline: await placePhotos(made.outline, brief.peeks) }
}

/**
 * Two models outline the film at once. Neon keeps to the brief best of the models tried on 2026-11-20
 * (it alone kept the closing line out of the scenes every time), but answers in anything from 12
 * seconds to over a minute. Flash answers in about 5, a little more loosely. The sender gets Neon's
 * outline if it arrives within `OUTLINE_WAIT_MS`, and Flash's if not: never a minute's wait, and never
 * the rule's plain outline just because one model was slow.
 */
async function outlineWords(brief: OutlineBrief): Promise<Outlined> {
  if (sortProvider() === 'gemini') {
    const wait = Number(process.env.OUTLINE_WAIT_MS ?? 25_000)
    const backup = askModel(brief, process.env.GEMINI_OUTLINE_BACKUP_MODEL ?? 'gemini-3.8-flash', wait + 10_000).then(
      (raw) => checkOutline(raw, brief),
      (error) => (console.error('[outline] backup model failed', error), null),
    )
    try {
      const checked = checkOutline(await askModel(brief, process.env.GEMINI_OUTLINE_MODEL ?? 'gemini-4-neon', wait), brief)
      if (checked) return { ...checked, by: 'model' }
      console.error('[outline] the first model returned no scene made of the sender’s words; using the backup')
    } catch (error) {
      console.error('[outline] first model failed or was slow; using the backup', error)
    }
    try {
      const checked = await backup
      if (checked) return { ...checked, by: 'model' }
      console.error('[outline] the model returned no scene made of the sender’s words; outlining by rule')
    } catch (error) {
      console.error('[outline] model failed; outlining by rule', error)
    }
  }
  return outlineByRule(brief)
}
