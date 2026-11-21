import { NOT_STORED } from './sort'
import { occasionOf } from '../story/occasions'
import { hasRefusedLine, lyricsBrief, tidyLyrics, tidyTitle } from '../story/vibes'
import type { LyricTone, SongDetails } from '../story/vibes'
import { MusicError, musicProvider } from './music'

/**
 * Writing the words of a song before any music is made, so the sender can
 * read and change them first. Uses a Google text model on the same key as the
 * music; `demo` returns fixed placeholder words for development and tests.
 */

export type LyricsProvider = 'gemini' | 'demo' | 'off'

export function lyricsProvider(): LyricsProvider {
  const music = musicProvider()
  if (music === 'demo' || music === 'off') return music
  return process.env.GEMINI_API_KEY ? 'gemini' : 'off'
}

export interface WrittenLyrics {
  title: string
  lyrics: string
}

/* ---------- Spend guards (in memory; reset on restart) ---------- */

const perClient = new Map<string, number[]>()
let daily = { day: '', count: 0 }

export function allowLyrics(clientKey: string, now = Date.now()) {
  const hourly = Number(process.env.LYRICS_HOURLY_PER_CLIENT ?? 20)
  const dailyCap = Number(process.env.LYRICS_DAILY_LIMIT ?? 300)
  const day = new Date(now).toISOString().slice(0, 10)
  if (daily.day !== day) daily = { day, count: 0 }
  if (daily.count >= dailyCap) return { allowed: false, reason: 'The studio has written its songs for today. Try again tomorrow.' }
  const recent = (perClient.get(clientKey) ?? []).filter((t) => t > now - 3_600_000)
  if (recent.length >= hourly) return { allowed: false, reason: 'That’s a lot of rewrites in an hour. Edit the words yourself, or give it a little while.' }
  recent.push(now)
  perClient.set(clientKey, recent)
  daily.count++
  return { allowed: true as const }
}

/* ---------- Writing ---------- */

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, lines: { type: 'array', items: { type: 'string' } } },
        required: ['label', 'lines'],
      },
    },
  },
  required: ['title', 'sections'],
}

/** What the writer is told when its last draft was refused for coming too close to an existing song. */
export const FRESH_NOTE =
  'An earlier draft of this song was refused because a line was too close to the words of an existing, published song. Write it again with wording of your own. Do not use any phrase that is the title or a well-known line of an existing song (for example "thank you for being a friend", "you are the sunshine of my life", "I will always love you"), and keep the hook to plain words taken from the details above.'

/**
 * What the writer is told when the sender has asked for the words to be different. What they ask is
 * theirs to ask: a thing they name there ("mention the tacos") is one of their details. The words as
 * they stand go with it, so "keep the chorus" and "funnier" both mean something.
 */
export function steerNote(steer: string, current: string) {
  return [
    ...(current ? [`Here are the words of this song as they stand:\n\n${current}`] : []),
    steer
      ? `The sender has read them and asks for this: "${steer}". Write the song again so that it does what they ask. What they say there is theirs: a thing, a person or a moment they name is one of their details and may be sung. Keep whatever they ask you to keep, word for word; change the rest as much as it takes. Everything else in this brief still holds.`
      : 'The sender has read them and wants a different version. Write the song again: a new hook, new lines, another way into the same details. Do not hand back these words lightly changed.',
  ].join('\n\n')
}

export async function writeLyrics(details: SongDetails, tone: LyricTone = 'smooth', fresh = false, again: { steer?: string; current?: string } = {}): Promise<WrittenLyrics> {
  const provider = lyricsProvider()
  if (provider === 'off') throw new MusicError('Songs aren’t switched on for this studio yet.', 503)
  if (provider === 'demo') return demoLyrics(details, again.steer)
  const asked = again.steer || again.current ? steerNote(again.steer ?? '', again.current ?? '') : ''

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.LYRICS_TIMEOUT_MS ?? 90_000))
  try {
    // Neon writes well and keeps to the sender's facts. Carbon, tried beside it on 2026-11-20, was more vivid but put things
    // in the song that were never said (a wrench, a dry pipe). At medium thinking Neon is a little better and takes a minute.
    const model = process.env.GEMINI_LYRICS_MODEL ?? 'gemini-4-neon'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        ...NOT_STORED,
        contents: [{ role: 'user', parts: [{ text: [lyricsBrief(details, tone), ...(fresh ? [FRESH_NOTE] : []), ...(asked ? [asked] : [])].join('\n\n') }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          thinkingConfig: { thinkingLevel: process.env.GEMINI_LYRICS_THINKING ?? 'low' },
        },
      }),
    })
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300)
      console.error(`[lyrics] Gemini ${response.status}: ${detail}`)
      throw new MusicError('The words couldn’t be written right now. Try again in a minute.', 502)
    }
    const written = lyricsFromGenerate(await response.json())
    if (!written) throw new MusicError('The writer came back with nothing usable. Try again.', 502)
    return written
  } catch (error) {
    if (error instanceof MusicError) throw error
    console.error('[lyrics] request failed', error)
    throw new MusicError('The writer took too long or couldn’t be reached.', 504)
  } finally {
    clearTimeout(timer)
  }
}

/** Title and tagged lyrics from a Gemini `generateContent` JSON reply. Null when there is nothing to sing. */
export function lyricsFromGenerate(body: unknown): WrittenLyrics | null {
  const parts = (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> })?.candidates?.[0]?.content?.parts ?? []
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
  let parsed: { title?: unknown; sections?: unknown }
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(parsed.sections)) return null
  const rows: string[] = []
  for (const section of parsed.sections as Array<{ label?: unknown; lines?: unknown }>) {
    if (!Array.isArray(section?.lines)) continue
    // The label arrives as "Verse 1" or, from some models, already bracketed as "[Verse 1]".
    const label = String(section.label ?? 'Verse').replace(/[[\]]/g, '').trim() || 'Verse'
    rows.push(`[${label}]`, ...section.lines.map((line) => String(line)), '')
  }
  // The brief forbids the old song's opening line; if it slips through, the music model would refuse the lot.
  const lyrics = tidyLyrics(rows.join('\n').replace(/happy\s+birthday\s+to\s+(you|ya)/gi, (m) => (m[0] === 'H' ? 'Happy, happy birthday' : 'happy, happy birthday')))
  if (!lyrics || hasRefusedLine(lyrics)) return null
  return { title: tidyTitle(parsed.title), lyrics }
}

/** Placeholder words for development and tests: only the names, nothing made up. */
/** Test words. What a sender asked for is sung back in the verse, so a test can tell it arrived. */
export function demoLyrics(d: SongDetails, steer = ''): WrittenLyrics {
  const greeting = occasionOf(d.occasion).song.greeting
  const line = greeting ? `${greeting.charAt(0).toUpperCase()}${greeting.slice(1)}, ${d.recipient}` : `This one is for ${d.recipient}`
  const chorus = ['[Chorus]', line, 'This little song is yours', line, 'Sung in placeholder words']
  return {
    title: `For ${d.recipient}`,
    lyrics: tidyLyrics(
      [
        '[Verse]',
        'These are test words for the studio',
        'They stand in for the real thing',
        ...(d.sender ? [`${d.sender} wrote the details down`] : ['Somebody wrote the details down']),
        ...(steer ? [`You asked for ${steer}`] : ['And here is where the song would sing']),
        '',
        ...chorus,
      ].join('\n'),
    ),
  }
}
