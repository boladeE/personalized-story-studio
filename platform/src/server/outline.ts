import { cleanDirection, directLocally, DIRECTED_WORLDS } from '../story/direction'
import type { DirectionPlan } from '../story/direction'
import { withAnswers } from '../story/followups'
import type { Answered } from '../story/followups'
import { closeToTheirWords } from '../story/notes'
import { occasionOf } from '../story/occasions'
import { cleanOutline, notesOf, outlineByWords, OUTLINE_LIMITS } from '../story/outline'
import { DIRECTION_REASONS } from '../story/types'
import type { Chapter, Occasion, Relationship } from '../story/types'
import { LIMITS } from '../story/validate'
import { VIBES } from '../story/vibes'
import { sortProvider } from './sort'

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
   * The sender's photos, small, in order, with their ids: given only when the studio is set to let the
   * director see them (`DIRECTOR_SEES_PHOTOS=1`) and the browser sent them. With them the director puts
   * each scene beside the photo that shows it; without them photos are dealt out blind.
   */
  peeks?: Array<{ id: string; jpeg: string }>
}

/** Whether the director may be shown the sender's photos. Off unless the studio's owner turns it on. */
export const directorSeesPhotos = () => process.env.DIRECTOR_SEES_PHOTOS === '1'

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
          photo: { type: 'integer' },
        },
        required: ['name', 'layout', 'mood', 'lines'],
      },
    },
    wish: { type: 'string' },
    world: { type: 'string', enum: DIRECTED_WORLDS },
    look: { type: 'string', enum: ['screening', 'garden', 'paper'] },
    because: { type: 'string', enum: [...DIRECTION_REASONS] },
    tune: { type: 'string', enum: VIBES.map((v) => v.id) },
    voice: { type: 'string', enum: ['woman', 'man'] },
  },
  required: ['scenes', 'wish', 'world', 'look', 'because', 'tune', 'voice'],
}

export function outlineBrief(brief: OutlineBrief) {
  const who = brief.recipient || 'the person'
  const from = brief.sender || 'the sender'
  return [
    `${from} is making a short film as a gift for ${who}, and wrote the note below. Outline the film: decide what its scenes are. The scenes come from this note and from nothing else. There is no standard set of scenes to fill; a different note would give a different film.`,
    `The occasion: ${brief.occasionName?.trim() || occasionOf(brief.occasion).name}.${brief.relationship ? ` ${who} is ${from}'s ${brief.relationship}.` : ''} Photos given: ${brief.photos}. The film already has its own opening and ending${brief.letter ? ', and a letter' : ''}; do not outline those.`,
    [
      'The scenes:',
      '- A scene is one thing: one moment that happened, one habit or saying that deserves a screen to itself, or a run of things that are alike. Group what belongs together and keep apart what does not.',
      `- name: what this scene is called, in one to four words. Take it from the scene's own words, or say plainly what they are about ("The coffee queue", "Voice notes", "Sunday calls"). It is a title, never a sentence, and never says what the scene will say. Never use a stock label such as "Memories", "Memory lane", "Reasons", "Reasons I love you", "Red flags", "Habits", "Quirks", "Little things" or "Highlights" unless the note itself uses those words. Never put a name, a place or a fact in a title that is not in the note. No two scenes share a name. A name never just repeats its scene's own sentence: for a scene of one short sentence, name its subject in two or three words.`,
      '- layout: `line` is a single sentence on a screen of its own (`lines` has exactly one item, at most 140 characters). `list` is two to seven short lines that are alike, shown one after another (one per item). `moment` is something told: a thing that happened, or a longer thought about who they are. \`lines\` holds its pages, one to five, each one or two whole sentences (about 130 characters at most) that read well alone. A page is never a piece of a sentence: do not cut one sentence across two pages, and if the telling is a single sentence it is a single page; the first is shown beside a photo when there is one, and each page after it has a screen to itself. Several paragraphs about one thing are one scene of several pages, not several scenes and not one crowded page.' +
        (brief.photos ? ` \`photos\` is a scene of ${from}'s photos, at most one, with a name and no lines; include it when there are more photos than moments.` : ' Do not use `photos`: there are none.'),
      `- mood: playful when the scene teases ${who} or is funny, tender when it is sincere or loving, warm otherwise.`,
      `- Put the scenes in the order the film should play. Open with what is most like ${who}. Playful scenes usually come before tender ones, and the film ends on the scene that means the most.`,
      '- Every scene must be worth a screen. Do not make a scene out of a few words that only repeat what another scene says, and do not pad a scene to fill it.',
      `- Between two and ${OUTLINE_LIMITS.scenes - 1} scenes. A short note makes a short film: never stretch it, and never use a line twice. Leaving something out is fine.`,
    ].join('\n'),
    [
      'The words inside the scenes:',
      `- ${from} wrote this the way people talk, and may have dictated it. Edit it the way a good film editor would: cut rambling, false starts, filler and repetition; mend grammar and spelling; break a long run-on thought into short sentences; and make each line fit a screen. ${who} must still hear ${from} in every line.`,
      `- Keep what makes it theirs exactly as written: their phrases and jokes, anything in quotation marks, their names for people and things, their slang. If a sentence is already good, leave it alone.`,
      `- Keep one way of speaking through the whole film. If the note wanders between talking to ${who} ("you") and about ${who} ("he", "she"), settle on the one the note uses most.`,
      '- Never add a fact, a name, a place, a feeling, a joke or a compliment that is not in the note. Never make it more romantic, more formal or more poetic than they wrote it. Every line must be something they said, said more cleanly; never something new.',
    ].join('\n'),
    ...(brief.peeks?.length
      ? [
          [
            `The photos: you are shown ${from}'s ${brief.peeks.length} photos, numbered in order. For each scene, \`photo\` is the number of the photo that belongs beside it, or 0 for none.`,
            '- Match a scene to the photo that shows what it says: the same place, the same moment, the same thing happening. A scene about a feeling can take a photo where they simply look like themselves.',
            '- Use a photo for one scene only. If nothing fits a scene, give it 0; a wrong photo is worse than none. A `list` and the `photos` scene take 0.',
            `- The photos only decide placement. Never describe a photo, and never put anything you see in one into the words: the words come only from ${from}'s note.`,
          ].join('\n'),
        ]
      : []),
    `wish: a closing line, hope or promise for ${who}, if the note has one, in ${from}'s words. It is not part of any scene. Otherwise empty.`,
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

async function askModel(brief: OutlineBrief): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.SORT_TIMEOUT_MS ?? 60_000))
  try {
    // Neon keeps to the brief best of the models tried on 2026-11-20 (it alone kept the closing line out of the scenes
    // every time), at 12 to 26 seconds a note. Flash answers in 5 and Hydrogen in 10, with looser outlines.
    const model = process.env.GEMINI_OUTLINE_MODEL ?? 'gemini-4-neon'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: outlineBrief(brief) }, ...(brief.peeks ?? []).flatMap((peek, i) => [{ text: `Photo ${i + 1}:` }, { inlineData: { mimeType: 'image/jpeg', data: peek.jpeg } }])],
          },
        ],
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
  // The director names a photo by its number; the film knows it by its id.
  const scenes = (Array.isArray(r.scenes) ? r.scenes : []).map((scene) => {
    const at = scene && typeof scene === 'object' ? Number((scene as { photo?: unknown }).photo) : 0
    const peek = Number.isInteger(at) && at > 0 ? brief.peeks?.[at - 1] : undefined
    return peek && (scene as { layout?: unknown }).layout !== 'list' && (scene as { layout?: unknown }).layout !== 'photos' ? { ...(scene as object), photoId: peek.id } : scene
  })
  const outline = cleanOutline(scenes, { source: written, photos: brief.photos })
  if (!outline.some((c) => c.layout !== 'photos')) return null
  const said = typeof r.wish === 'string' ? r.wish.replace(/\s+/g, ' ').trim().slice(0, LIMITS.wish) : ''
  const wish = said && closeToTheirWords(said, written) ? said : ''
  const facts = { occasion: brief.occasion, relationship: brief.relationship, recipient: brief.recipient, photos: brief.photos, letter: brief.letter }
  const chosen = cleanDirection({ world: r.world, look: r.look, because: r.because, tune: r.tune, voice: r.voice }, DIRECTED_WORLDS)
  // The song the model chose stands even when its kind of film is not one the studio directs.
  const song = cleanDirection({ world: 'mixtape', tune: r.tune, voice: r.voice })
  const sung = { ...(song?.tune ? { tune: song.tune } : {}), ...(song?.voice ? { voice: song.voice } : {}) }
  return { outline, wish, direction: chosen ?? { ...directLocally({ ...facts, notes: notesOf(outline, wish) }), designs: {}, order: [], ...sung } }
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
