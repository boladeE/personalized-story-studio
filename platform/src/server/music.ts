import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { songPrompt, vibeById } from '../story/vibes'
import { sniffAudio, songsDir } from './store'

/**
 * AI soundtrack generation.
 *
 * gemini (GEMINI_API_KEY): Google Lyria 3.5, the current model, via the Gemini
 *   Interactions API. Preferred.
 * openrouter (OPENROUTER_API_KEY): Lyria 3 Pro (legacy) via OpenRouter's
 *   streaming audio output. Lyria 3.5 isn't on OpenRouter yet.
 * demo: a locally synthesised test tone, for development and tests.
 * off: the studio keeps its built-in score.
 * MUSIC_PROVIDER forces one; otherwise the first configured key wins.
 */

export type ProviderName = 'gemini' | 'openrouter' | 'demo' | 'off'

export function musicProvider(): ProviderName {
  const chosen = process.env.MUSIC_PROVIDER
  if (chosen === 'demo' || chosen === 'off') return chosen
  if (chosen === 'gemini') return process.env.GEMINI_API_KEY ? 'gemini' : 'off'
  if (chosen === 'openrouter') return process.env.OPENROUTER_API_KEY ? 'openrouter' : 'off'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  if (process.env.OPENROUTER_API_KEY) return 'openrouter'
  return 'off'
}

const SONG_ID_RE = /^s[a-f0-9]{24}$/
export const isSongId = (id: string) => SONG_ID_RE.test(id)

/* ---------- Spend guards (in memory; reset on restart) ---------- */

const perClient = new Map<string, number[]>()
let daily = { day: '', count: 0 }

export function allowSong(clientKey: string, now = Date.now()) {
  const hourly = Number(process.env.MUSIC_HOURLY_PER_CLIENT ?? 6)
  const dailyCap = Number(process.env.MUSIC_DAILY_LIMIT ?? 30)
  const day = new Date(now).toISOString().slice(0, 10)
  if (daily.day !== day) daily = { day, count: 0 }
  if (daily.count >= dailyCap) return { allowed: false, reason: 'The studio has made its songs for today. Try again tomorrow.' }
  const recent = (perClient.get(clientKey) ?? []).filter((t) => t > now - 3_600_000)
  if (recent.length >= hourly) return { allowed: false, reason: 'That’s a lot of songs in an hour. Give it a little while.' }
  recent.push(now)
  perClient.set(clientKey, recent)
  daily.count++
  return { allowed: true as const }
}

/* ---------- Generation ---------- */

export interface SongFile {
  id: string
  contentType: string
  vibe: string
  provider: ProviderName
}

export async function generateSong(vibeId: string): Promise<SongFile> {
  const vibe = vibeById(vibeId)
  if (!vibe) throw new MusicError('Unknown style', 400)
  const provider = musicProvider()
  if (provider === 'off') throw new MusicError('AI songs aren’t switched on for this studio yet.', 503)

  const bytes =
    provider === 'demo' ? demoSong(vibe.id) : provider === 'gemini' ? await geminiSong(songPrompt(vibe)) : await openRouterSong(songPrompt(vibe))
  const contentType = sniffAudio(bytes)
  if (!contentType) throw new MusicError('The music service sent back something that isn’t audio.', 502)

  const id = `s${randomBytes(12).toString('hex')}`
  await mkdir(songsDir, { recursive: true })
  await writeFile(path.join(songsDir, id), bytes)
  const meta: SongFile = { id, contentType, vibe: vibe.id, provider }
  await writeFile(path.join(songsDir, `${id}.json`), JSON.stringify({ ...meta, createdAt: new Date().toISOString() }))
  return meta
}

export async function readSong(id: string) {
  if (!isSongId(id)) return null
  try {
    const meta = JSON.parse(await readFile(path.join(songsDir, `${id}.json`), 'utf8')) as SongFile
    const bytes = await readFile(path.join(songsDir, id))
    return { meta, bytes }
  } catch {
    return null
  }
}

export class MusicError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function geminiSong(prompt: string): Promise<Uint8Array> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.MUSIC_TIMEOUT_MS ?? 240_000))
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY ?? '',
        'api-revision': '2026-05-20',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: process.env.GEMINI_MUSIC_MODEL ?? 'lyria-3.5', input: prompt }),
    })
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300)
      console.error(`[music] Gemini ${response.status}: ${detail}`)
      throw new MusicError('The music service couldn’t make a song right now. Try again in a minute.', 502)
    }
    const audio = audioFromInteraction(await response.json())
    if (!audio) throw new MusicError('The music service finished without sending a song.', 502)
    return audio
  } catch (error) {
    if (error instanceof MusicError) throw error
    console.error('[music] request failed', error)
    throw new MusicError('The music service took too long or couldn’t be reached.', 504)
  } finally {
    clearTimeout(timer)
  }
}

/** The last audio block from a Gemini Interactions response (`steps[].content[]`). */
export function audioFromInteraction(body: unknown): Uint8Array | null {
  const steps = (body as { steps?: Array<{ type?: string; content?: Array<{ type?: string; data?: string }> }> })?.steps ?? []
  let data: string | undefined
  for (const step of steps) {
    if (step.type !== 'model_output') continue
    for (const block of step.content ?? []) if (block.type === 'audio' && block.data) data = block.data
  }
  return data ? Uint8Array.from(Buffer.from(data, 'base64')) : null
}

async function openRouterSong(prompt: string): Promise<Uint8Array> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.MUSIC_TIMEOUT_MS ?? 240_000))
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        'x-title': 'Little Things Studio',
      },
      body: JSON.stringify({
        model: process.env.MUSIC_MODEL ?? 'google/lyria-3-pro-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['text', 'audio'],
        stream: true,
      }),
    })
    if (!response.ok || !response.body) {
      const detail = (await response.text().catch(() => '')).slice(0, 300)
      console.error(`[music] OpenRouter ${response.status}: ${detail}`)
      throw new MusicError('The music service couldn’t make a song right now. Try again in a minute.', 502)
    }
    const audio = await collectAudio(response.body)
    if (!audio.length) throw new MusicError('The music service finished without sending a song.', 502)
    return audio
  } catch (error) {
    if (error instanceof MusicError) throw error
    console.error('[music] request failed', error)
    throw new MusicError('The music service took too long or couldn’t be reached.', 504)
  } finally {
    clearTimeout(timer)
  }
}

/** Read an OpenRouter SSE stream and join the base64 `delta.audio.data` chunks. */
export async function collectAudio(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let buffer = ''
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') return
    let event: { choices?: Array<{ delta?: { audio?: { data?: string } }; message?: { audio?: { data?: string } } }>; error?: { message?: string } }
    try {
      event = JSON.parse(data)
    } catch {
      return
    }
    if (event.error) throw new MusicError('The music service reported an error.', 502)
    const choice = event.choices?.[0]
    const piece = choice?.delta?.audio?.data ?? choice?.message?.audio?.data
    if (piece) chunks.push(piece)
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(handle)
  }
  if (buffer) handle(buffer)
  return Uint8Array.from(Buffer.from(chunks.join(''), 'base64'))
}

/* ---------- Demo provider: a short synthesised WAV ---------- */

export function demoSong(vibeId: string, seconds = 12): Uint8Array {
  const rate = 22_050
  const samples = rate * seconds
  const pcm = new Int16Array(samples)
  const roots = { 'afro-soul': 57, highlife: 60, piano: 55, 'lofi-rnb': 53 } as Record<string, number>
  const root = roots[vibeId] ?? 57
  const progression = [0, 7, 9, 5]
  const beat = 60 / 96 / 2
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
  for (let i = 0; i < samples; i++) {
    const t = i / rate
    const step = Math.floor(t / beat)
    const chordRoot = root + progression[Math.floor(step / 8) % progression.length]
    const note = chordRoot + [0, 4, 7, 12][step % 4]
    const local = t - step * beat
    const env = Math.exp(-local * 6)
    const pad = Math.sin(2 * Math.PI * hz(chordRoot - 12) * t) * 0.12
    const value = Math.sin(2 * Math.PI * hz(note) * t) * env * 0.3 + pad
    const fade = Math.min(1, t / 0.5, (seconds - t) / 0.8)
    pcm[i] = Math.max(-1, Math.min(1, value * fade)) * 32_767
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.byteLength, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.byteLength, 40)
  return Uint8Array.from(Buffer.concat([header, Buffer.from(pcm.buffer)]))
}
