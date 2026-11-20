import { sortLocallyWithAnswers, withAnswers } from '../story/followups'
import type { Answered } from '../story/followups'
import { keepTheirWords, notesCount } from '../story/notes'
import type { SortedNotes } from '../story/notes'

/**
 * Sorting what a sender wrote in one box into the film's scenes. A Google
 * text model does the sorting; it is told to move words, not write them, and
 * its answer is checked against the sender's text before anything is kept.
 * When the model is off, slow or wrong, the sender's words are sorted by
 * rule on the server, so the film is always built.
 */

const perClient = new Map<string, number[]>()

export function allowSort(clientKey: string, now = Date.now()) {
  const hourly = Number(process.env.SORT_HOURLY_PER_CLIENT ?? 30)
  const recent = (perClient.get(clientKey) ?? []).filter((t) => t > now - 3_600_000)
  if (recent.length >= hourly) return false
  recent.push(now)
  perClient.set(clientKey, recent)
  return true
}

/** `demo` keeps tests and local work off the network. */
export const sortProvider = (): 'gemini' | 'local' =>
  process.env.MUSIC_PROVIDER !== 'demo' && process.env.SORT_PROVIDER !== 'local' && process.env.GEMINI_API_KEY ? 'gemini' : 'local'

const SCHEMA = {
  type: 'object',
  properties: {
    memories: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, story: { type: 'string' } }, required: ['title', 'story'] } },
    habits: { type: 'array', items: { type: 'string' } },
    reasons: { type: 'array', items: { type: 'string' } },
    spotlight: { type: 'string' },
    wish: { type: 'string' },
  },
  required: ['memories', 'habits', 'reasons', 'spotlight', 'wish'],
}

export function sortBrief(text: string, sender: string, recipient: string, answered: Answered[] = []) {
  const who = recipient || 'the person'
  const from = sender || 'the sender'
  return [
    `${from} wrote the note below about ${who}, for a short film made of scenes. Sort the note into the scenes. You are sorting, not writing.`,
    [
      'Rules:',
      `- Use only ${from}'s own words, copied as written. You may cut a long sentence into shorter ones, drop a joining word such as "and" or "also", and fix a capital letter or a full stop. Nothing else.`,
      '- Never add a fact, a name, a place, a feeling, a joke or a compliment that is not in the note. Never reword to make it sound better. Never change who is speaking or "she" to "you".',
      '- Each part of the note goes in one place only. Leaving something out is fine. An empty list or empty string is the right answer when the note has nothing for it.',
    ].join('\n'),
    [
      'The scenes:',
      '- memories: each separate moment or story that happened, up to 3. `title` is a short phrase of 2 to 7 words lifted from that moment\'s own words. `story` is the moment itself, in their words, one to three sentences.',
      `- habits: things ${who} does again and again, especially the funny ones. One per item, one short line each, up to 5.`,
      `- reasons: why ${from} loves or values ${who}; their qualities. One per item, up to 6.`,
      `- spotlight: one or two sentences that describe how ${who} is, if any are left after the above. Otherwise empty.`,
      `- wish: a closing line, hope or promise for ${who}, if the note has one. Otherwise empty.`,
    ].join('\n'),
    `The note:\n${text}`,
    ...(answered.length
      ? [
          [
            `${from} was then asked about parts of the note, and answered. The answers are ${from}'s own words too: sort them like the rest of the note, and keep each answer with the part it is about (the same habit, reason or memory, straight after it). The questions are not ${from}'s words and must never appear.`,
            ...answered.map((a) => `- About "${a.quote}", asked "${a.question}", ${from} answered: ${a.answer}`),
          ].join('\n'),
        ]
      : []),
  ].join('\n\n')
}

async function askModel(text: string, sender: string, recipient: string, answered: Answered[]): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.SORT_TIMEOUT_MS ?? 25_000))
  try {
    const model = process.env.GEMINI_SORT_MODEL ?? 'gemini-3.8-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: sortBrief(text, sender, recipient, answered) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1, thinkingConfig: { thinkingLevel: 'low' } },
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

export async function sortNotes(text: string, sender: string, recipient: string, answered: Answered[] = []): Promise<{ notes: SortedNotes; by: 'model' | 'rule' }> {
  if (sortProvider() === 'gemini') {
    try {
      const notes = keepTheirWords(await askModel(text, sender, recipient, answered), withAnswers(text, answered))
      if (notesCount(notes) > 0) return { notes, by: 'model' }
      console.error('[sort] the model returned nothing made of the sender’s words; sorting by rule')
    } catch (error) {
      console.error('[sort] model failed; sorting by rule', error)
    }
  }
  return { notes: sortLocallyWithAnswers(text, answered), by: 'rule' }
}
