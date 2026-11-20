import { cleanDirection, designsByRule, directLocally, DIRECTED_WORLDS, MIDDLE_SCENES } from '../story/direction'
import type { DirectionBrief, DirectionPlan } from '../story/direction'
import { occasionOf } from '../story/occasions'
import { DIRECTION_REASONS } from '../story/types'
import { worldOf } from '../story/worlds'
import { sortProvider } from './sort'

/**
 * The director. A Google text model reads what the sender wrote (already
 * sorted into scenes) and chooses how the film is made: which kind of film,
 * its colours, a design for each scene and the order they play in. It chooses
 * only from what the studio has; its answer is checked, and anything it left
 * out or got wrong is filled in by rule, so a film is always directed.
 * It writes nothing that appears in the film.
 */

const SCENE_NAMES: Record<string, string> = {
  spotlight: 'the main character (how they are, with a photo)',
  memoryLane: 'memories (each a moment, with a photo)',
  redFlags: 'their funny habits, as mock red flags',
  reasons: 'reasons the sender loves them',
  cameraRoll: 'the other photos',
  letter: 'the letter',
}

const WORLD_NOTES: Record<string, string> = {
  scrapbook: 'A handmade album: taped photos, sticky notes, handwriting. Warm, nostalgic, unhurried. Best when the note is told in moments and memories, or is tender.',
  mixtape: 'A tape made for one person: tall capitals on flat colour, tracks, cuts on the beat. Loud, playful, confident. Best when the note teases, lists habits, is funny, or is short.',
}

const SCHEMA = {
  type: 'object',
  properties: {
    world: { type: 'string', enum: DIRECTED_WORLDS },
    look: { type: 'string', enum: ['screening', 'garden', 'paper'] },
    designs: {
      type: 'object',
      properties: Object.fromEntries(['spotlight', 'memoryLane', 'redFlags', 'reasons', 'cameraRoll'].map((type) => [type, { type: 'string' }])),
      required: ['spotlight', 'memoryLane', 'redFlags', 'reasons'],
    },
    order: { type: 'array', items: { type: 'string', enum: MIDDLE_SCENES } },
    because: { type: 'string', enum: [...DIRECTION_REASONS] },
  },
  required: ['world', 'look', 'designs', 'order', 'because'],
}

export function directBrief(brief: DirectionBrief) {
  const who = brief.recipient || 'the person'
  const catalogue = DIRECTED_WORLDS.map((id) => {
    const world = worldOf(id)
    const looks = Object.entries(world.looks)
      .map(([look, name]) => `${look} ("${name}")`)
      .join(', ')
    const designs = Object.entries(world.designs)
      .map(([type, options]) => `  - ${type}: ${options.map((d) => `${d.id} ("${d.name}")`).join(' or ')}`)
      .join('\n')
    return `${id} ("${world.name}"): ${WORLD_NOTES[id]}\n  looks: ${looks}\n  designs:\n${designs}`
  }).join('\n\n')
  return [
    `You are directing a short personal film made as a gift for ${who}. The sender's words are already sorted into scenes. Choose how the film is made so it suits what they wrote. You choose only from the lists below and you write nothing that appears in the film.`,
    `The occasion: ${occasionOf(brief.occasion).name}.${brief.relationship ? ` The film is for the sender's ${brief.relationship}.` : ''} Photos: ${brief.photos}. A letter: ${brief.letter ? 'yes' : 'no'}.`,
    `The sender's words:\n${JSON.stringify(brief.notes, null, 1)}`,
    `The kinds of film:\n\n${catalogue}`,
    [
      'Decide:',
      '- world: the kind of film whose character suits the note.',
      '- look: one of that world\'s three looks.',
      '- designs: for each scene type that world lists, the design that suits the words. A list of four or more items reads better in a design that builds on one screen; a few items land harder one to a screen. A long story needs room beside its photo.',
      `- order: the scenes that can be moved (${MIDDLE_SCENES.map((t) => `${t} = ${SCENE_NAMES[t]}`).join('; ')}), in the order that tells this note best. The main character introduces them, so it comes first, and the letter comes last. Between those, films usually land better when the jokes come before the sincere scenes.`,
      `- because: the one word that is the main reason for the world you chose: teasing (the note is mostly habits and jokes), memories (it is told in moments), photos (there are many photos and few words), tender (it is mostly sincere), short (there is very little to go on).`,
    ].join('\n'),
  ].join('\n\n')
}

async function askModel(brief: DirectionBrief): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.DIRECT_TIMEOUT_MS ?? 15_000))
  try {
    const model = process.env.GEMINI_DIRECT_MODEL ?? process.env.GEMINI_SORT_MODEL ?? 'gemini-3.8-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: directBrief(brief) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.4, thinkingConfig: { thinkingLevel: 'low' } },
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

/**
 * A model's direction laid over the rule's: every scene has a design and every movable scene a place,
 * whatever the model left out. Two things are not the model's to move: the film introduces its main
 * character first, and the letter is the last thing before the ending.
 */
export function completeDirection(raw: unknown, brief: DirectionBrief): DirectionPlan | null {
  const chosen = cleanDirection(raw, DIRECTED_WORLDS)
  if (!chosen) return null
  const designs = { ...designsByRule(chosen.world, brief), ...chosen.designs }
  const all = [...chosen.order, ...directLocally(brief).order.filter((type) => !chosen.order.includes(type))]
  const between = all.filter((type) => type !== 'spotlight' && type !== 'letter')
  return { ...chosen, designs, order: ['spotlight', ...between, 'letter'] }
}

export async function direct(brief: DirectionBrief): Promise<{ direction: DirectionPlan; by: 'model' | 'rule' }> {
  if (sortProvider() === 'gemini') {
    try {
      const direction = completeDirection(await askModel(brief), brief)
      if (direction) return { direction, by: 'model' }
      console.error('[direct] the model named no kind of film the studio has; directing by rule')
    } catch (error) {
      console.error('[direct] model failed; directing by rule', error)
    }
  }
  return { direction: directLocally(brief), by: 'rule' }
}
