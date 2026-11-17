import { hasRefusedLine, lyricsBrief, tidyLyrics, tidyTitle } from '../story/vibes'
import type { SongDetails } from '../story/vibes'
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

export async function writeLyrics(details: SongDetails): Promise<WrittenLyrics> {
  const provider = lyricsProvider()
  if (provider === 'off') throw new MusicError('Songs aren’t switched on for this studio yet.', 503)
  if (provider === 'demo') return demoLyrics(details)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.LYRICS_TIMEOUT_MS ?? 60_000))
  try {
    const model = process.env.GEMINI_LYRICS_MODEL ?? 'gemini-3.8-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: lyricsBrief(details) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          temperature: 0.9,
          // Without this the model thinks for over a minute about a 22-line song.
          thinkingConfig: { thinkingLevel: 'low' },
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
    rows.push(`[${String(section.label ?? 'Verse')}]`, ...section.lines.map((line) => String(line)), '')
  }
  // The brief forbids the old song's opening line; if it slips through, the music model would refuse the lot.
  const lyrics = tidyLyrics(rows.join('\n').replace(/happy\s+birthday\s+to\s+(you|ya)/gi, (m) => (m[0] === 'H' ? 'Happy, happy birthday' : 'happy, happy birthday')))
  if (!lyrics || hasRefusedLine(lyrics)) return null
  return { title: tidyTitle(parsed.title), lyrics }
}

/** Placeholder words for development and tests: only the names, nothing made up. */
export function demoLyrics(d: SongDetails): WrittenLyrics {
  const chorus = ['[Chorus]', `Happy birthday, ${d.recipient}`, 'This little song is yours', `Happy birthday, ${d.recipient}`, 'Sung in placeholder words']
  return {
    title: `For ${d.recipient}`,
    lyrics: tidyLyrics(
      [
        '[Verse]',
        'These are test words for the studio',
        'They stand in for the real thing',
        ...(d.sender ? [`${d.sender} wrote the details down`] : ['Somebody wrote the details down']),
        'And here is where the song would sing',
        '',
        ...chorus,
      ].join('\n'),
    ),
  }
}
