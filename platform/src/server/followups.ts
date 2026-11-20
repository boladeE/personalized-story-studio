import { cleanFollowups, followupsLocally } from '../story/followups'
import type { Followup } from '../story/followups'
import { sortProvider } from './sort'

/**
 * Follow-up questions for a sender's note. A Google text model reads the note
 * and asks up to three short questions, each about a part of it, that would
 * draw out one more concrete detail. Every question is checked to hang on
 * words the sender wrote; when the model is off, slow or wrong, plainer
 * questions are asked by rule, so the sender is never left waiting.
 */

const SCHEMA = {
  type: 'object',
  properties: {
    questions: { type: 'array', items: { type: 'object', properties: { quote: { type: 'string' }, question: { type: 'string' } }, required: ['quote', 'question'] } },
  },
  required: ['questions'],
}

export function followupBrief(text: string, sender: string, recipient: string) {
  const who = recipient || 'the person'
  const from = sender || 'the sender'
  return [
    `${from} wrote the note below about ${who}. It will be made into a short film as a gift for ${who}. Ask ${from} up to three short follow-up questions. Each answer should add one concrete detail the film can use: what was said, what happened next, a small example.`,
    [
      'Rules:',
      '- Each question is about one part of the note. `quote` is that part, copied exactly as written, up to 20 words.',
      `- \`question\` speaks to ${from} directly, in plain everyday words, in under 14 words. Use ${who}'s name or the pronoun the note uses.`,
      '- Ask for something specific and easy to answer in a line: the exact words someone said, the next thing that happened, one example. Never a yes-or-no question. Never "how did that make you feel".',
      '- Ask only about what is in the note. Do not suggest answers, add facts or guess at anything. Nothing intimate, medical or painful.',
      '- Pick the parts where one more detail would make the film funnier or more touching. Fewer good questions beat three weak ones; an empty list is fine for a note that needs nothing.',
    ].join('\n'),
    `The note:\n${text}`,
  ].join('\n\n')
}

async function askModel(text: string, sender: string, recipient: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.FOLLOWUP_TIMEOUT_MS ?? 12_000))
  try {
    const model = process.env.GEMINI_FOLLOWUP_MODEL ?? process.env.GEMINI_SORT_MODEL ?? 'gemini-3.8-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: followupBrief(text, sender, recipient) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.5, thinkingConfig: { thinkingLevel: 'low' } },
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

export async function followups(text: string, sender: string, recipient: string): Promise<{ questions: Followup[]; by: 'model' | 'rule' }> {
  if (sortProvider() === 'gemini') {
    try {
      // A model that asks nothing has decided the note needs nothing: that is an answer, not a failure.
      return { questions: cleanFollowups(await askModel(text, sender, recipient), text), by: 'model' }
    } catch (error) {
      console.error('[followups] model failed; asking by rule', error)
    }
  }
  return { questions: followupsLocally(text, recipient), by: 'rule' }
}
