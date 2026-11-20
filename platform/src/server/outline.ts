import { cleanDirection, directLocally, DIRECTED_WORLDS } from '../story/direction'
import type { DirectionPlan } from '../story/direction'
import { withAnswers } from '../story/followups'
import type { Answered } from '../story/followups'
import { isTheirWords } from '../story/notes'
import { occasionOf } from '../story/occasions'
import { cleanOutline, notesOf, outlineByWords, OUTLINE_LIMITS } from '../story/outline'
import { DIRECTION_REASONS } from '../story/types'
import type { Chapter, Occasion, Relationship } from '../story/types'
import { LIMITS } from '../story/validate'
import { sortProvider } from './sort'

/**
 * Outlining a film. A Google text model reads what the sender wrote and
 * decides what this film's scenes are: which there are, what each is called,
 * which of the sender's words go in each, and in what order they play. It also
 * chooses the kind of film and its colours. The scenes are this note's and no
 * other's: nothing here offers the model a list of scenes to fill.
 *
 * The model may name a scene; it may not write what a scene says. Its answer
 * is checked line by line against the sender's text, and when it is off, slow
 * or wrong the film is outlined by rule, so a film is always made.
 */

export interface OutlineBrief {
  text: string
  sender: string
  recipient: string
  answered: Answered[]
  occasion: Occasion
  relationship?: Relationship
  photos: number
  letter: boolean
}

export interface Outlined {
  outline: Chapter[]
  wish: string
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
        },
        required: ['name', 'layout', 'mood', 'lines'],
      },
    },
    wish: { type: 'string' },
    world: { type: 'string', enum: DIRECTED_WORLDS },
    look: { type: 'string', enum: ['screening', 'garden', 'paper'] },
    because: { type: 'string', enum: [...DIRECTION_REASONS] },
  },
  required: ['scenes', 'wish', 'world', 'look', 'because'],
}

export function outlineBrief(brief: OutlineBrief) {
  const who = brief.recipient || 'the person'
  const from = brief.sender || 'the sender'
  return [
    `${from} is making a short film as a gift for ${who}, and wrote the note below. Outline the film: decide what its scenes are. The scenes come from this note and from nothing else. There is no standard set of scenes to fill; a different note would give a different film.`,
    `The occasion: ${occasionOf(brief.occasion).name}.${brief.relationship ? ` ${who} is ${from}'s ${brief.relationship}.` : ''} Photos given: ${brief.photos}. The film already has its own opening and ending${brief.letter ? ', and a letter' : ''}; do not outline those.`,
    [
      'The scenes:',
      '- A scene is one thing: one moment that happened, one habit or saying that deserves a screen to itself, or a run of things that are alike. Group what belongs together and keep apart what does not.',
      `- name: what this scene is called, in one to four words. Take it from the scene's own words, or say plainly what they are about ("The coffee queue", "Voice notes", "Sunday calls"). It is a title, never a sentence, and never says what the scene will say. Never use a stock label such as "Memories", "Memory lane", "Reasons", "Reasons I love you", "Red flags", "Habits", "Quirks", "Little things" or "Highlights" unless the note itself uses those words. Never put a name, a place or a fact in a title that is not in the note. No two scenes share a name.`,
      '- layout: `line` is a single sentence on a screen of its own (`lines` has exactly one item, at most 140 characters). `list` is two to seven short lines that are alike, shown one after another (one per item). `moment` is something that happened, told in one to three sentences (`lines` has one item: the whole telling); it is shown beside a photo when there is one.' +
        (brief.photos ? ` \`photos\` is a scene of ${from}'s photos, at most one, with a name and no lines; include it when there are more photos than moments.` : ' Do not use `photos`: there are none.'),
      `- mood: playful when the scene teases ${who} or is funny, tender when it is sincere or loving, warm otherwise.`,
      `- Put the scenes in the order the film should play. Open with what is most like ${who}. Playful scenes usually come before tender ones, and the film ends on the scene that means the most.`,
      `- Between two and ${OUTLINE_LIMITS.scenes - 1} scenes. A short note makes a short film: never stretch it, and never use a line twice. Leaving something out is fine.`,
    ].join('\n'),
    [
      'The words inside the scenes:',
      `- Use only ${from}'s own words, copied as written. You may cut a long sentence into shorter ones, drop a joining word such as "and" or "also", and fix a capital letter or a full stop. Nothing else.`,
      '- Never add a fact, a name, a place, a feeling, a joke or a compliment that is not in the note. Never reword to make it sound better. Never change who is speaking or "she" to "you".',
    ].join('\n'),
    `wish: a closing line, hope or promise for ${who}, if the note has one, in ${from}'s words. It is not part of any scene. Otherwise empty.`,
    [
      'Then choose how the film is made:',
      '- world: `scrapbook` is a handmade album (taped photos, sticky notes, handwriting): warm, nostalgic, unhurried; best when the note is told in moments, or is tender. `mixtape` is a tape made for one person (tall capitals on flat colour, cuts on the beat): loud, playful, confident; best when the note teases, is funny, or is short.',
      '- look: its colours. `screening` is the dark one, `garden` the warm one, `paper` the light one.',
      '- because: the main reason for the world you chose: teasing (the note is mostly habits and jokes), memories (it is told in moments), photos (many photos and few words), tender (it is mostly sincere), short (there is very little to go on).',
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

async function askModel(brief: OutlineBrief): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.SORT_TIMEOUT_MS ?? 60_000))
  try {
    // Neon keeps to the brief best of the models tried on 2026-11-20 (it alone kept the closing line out of the scenes
    // every time), at 12 to 18 seconds a note. Flash answers in 5 and Hydrogen in 10, with looser outlines.
    const model = process.env.GEMINI_OUTLINE_MODEL ?? 'gemini-4-neon'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
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
  const outline = cleanOutline(r.scenes, { source: written, photos: brief.photos })
  if (!outline.some((c) => c.layout !== 'photos')) return null
  const said = typeof r.wish === 'string' ? r.wish.replace(/\s+/g, ' ').trim().slice(0, LIMITS.wish) : ''
  const wish = said && isTheirWords(said, written) ? said : ''
  const facts = { occasion: brief.occasion, relationship: brief.relationship, recipient: brief.recipient, photos: brief.photos, letter: brief.letter }
  const chosen = cleanDirection({ world: r.world, look: r.look, because: r.because }, DIRECTED_WORLDS)
  return { outline, wish, direction: chosen ?? { ...directLocally({ ...facts, notes: notesOf(outline, wish) }), designs: {}, order: [] } }
}

/** The outline by rule: the note read a sentence at a time, each moment a scene. */
export function outlineByRule(brief: OutlineBrief): Outlined {
  const outline = outlineByWords(brief.text, brief.answered, brief.recipient)
  const direction = directLocally({ occasion: brief.occasion, relationship: brief.relationship, recipient: brief.recipient, photos: brief.photos, letter: brief.letter, notes: notesOf(outline) })
  return { outline, wish: '', direction: { ...direction, designs: {}, order: [] }, by: 'rule' }
}

export async function outlineFilm(brief: OutlineBrief): Promise<Outlined> {
  if (sortProvider() === 'gemini') {
    try {
      const checked = checkOutline(await askModel(brief), brief)
      if (checked) return { ...checked, by: 'model' }
      console.error('[outline] the model returned no scene made of the sender’s words; outlining by rule')
    } catch (error) {
      console.error('[outline] model failed; outlining by rule', error)
    }
  }
  return outlineByRule(brief)
}
