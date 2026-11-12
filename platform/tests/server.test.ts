import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'lt-gifts-'))

const store = await import('../src/server/store')
const music = await import('../src/server/music')
const { parseIntake } = await import('../src/story/validate')
const { SAMPLE_INTAKE } = await import('../src/story/sample')

describe('gift lock', () => {
  it('accepts the answer however it is typed, and nothing else', () => {
    const stored = store.hashAnswer('Mr Biscuit')
    for (const typed of ['mr biscuit', '  MR   BISCUIT ', '“Mr Biscuit!”', 'mr biscuit.']) expect(store.checkAnswer(typed, stored)).toBe(true)
    for (const typed of ['mr biscuits', 'biscuit', '', 'mrbiscuit']) expect(store.checkAnswer(typed, stored)).toBe(false)
    expect(stored.hash).not.toContain('biscuit')
  })

  it('unlock tokens are tied to one gift, expire, and resist tampering', () => {
    const now = Date.now()
    const token = store.signUnlock('abcdefghjkmn', now)
    expect(store.verifyUnlock('abcdefghjkmn', token, now)).toBe(true)
    expect(store.verifyUnlock('zzzzzzzzzzzz', token, now)).toBe(false)
    expect(store.verifyUnlock('abcdefghjkmn', token, now + 31 * 86_400_000)).toBe(false)
    const [exp, mac] = token.split('.')
    expect(store.verifyUnlock('abcdefghjkmn', `${Number(exp) + 1}.${mac}`, now)).toBe(false)
    expect(store.verifyUnlock('abcdefghjkmn', undefined, now)).toBe(false)
  })

  it('limits guesses per gift', () => {
    const key = 'limit-test'
    for (let i = 0; i < 10; i++) expect(store.takeAttempt(key).allowed).toBe(true)
    expect(store.takeAttempt(key).allowed).toBe(false)
    expect(store.takeAttempt(key, Date.now() + 16 * 60_000).allowed).toBe(true)
  })

  it('makes unguessable link ids and rejects path tricks', () => {
    const slugs = new Set(Array.from({ length: 500 }, store.newSlug))
    expect(slugs.size).toBe(500)
    for (const slug of slugs) expect(store.isSlug(slug)).toBe(true)
    expect(store.isSlug('../../etc')).toBe(false)
    expect(store.isMediaId('../gift.json')).toBe(false)
  })

  it('identifies images and audio by content', () => {
    expect(store.sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(store.sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull()
    expect(store.sniffAudio(music.demoSong('piano', 1))).toBe('audio/wav')
  })
})

describe('intake validation', () => {
  it('accepts the sample and rejects bad shapes', () => {
    expect(parseIntake(SAMPLE_INTAKE).ok).toBe(true)
    expect(parseIntake({ ...SAMPLE_INTAKE, sender: ' ' })).toEqual({ ok: false, error: 'Both names are needed' })
    expect(parseIntake({ ...SAMPLE_INTAKE, letter: 'x'.repeat(7000) }).ok).toBe(false)
    expect(parseIntake({ ...SAMPLE_INTAKE, look: 'neon' }).ok).toBe(false)
    expect(parseIntake({ ...SAMPLE_INTAKE, photos: [{ id: '../x', caption: '' }] }).ok).toBe(false)
    expect(parseIntake({ ...SAMPLE_INTAKE, memories: [{ id: 'm1', title: 'a', story: 'b', photoId: 'p-missing' }] }).ok).toBe(false)
  })

  it('drops photo sources sent by the browser', () => {
    const parsed = parseIntake(SAMPLE_INTAKE)
    expect(parsed.ok && parsed.intake.photos.every((p) => p.src === '')).toBe(true)
  })
})

describe('AI music', () => {
  it('joins streamed audio chunks from OpenRouter', async () => {
    const bytes = music.demoSong('highlife', 1)
    const b64 = Buffer.from(bytes).toString('base64')
    const parts = [b64.slice(0, 1000), b64.slice(1000)]
    const sse = [
      ': OPENROUTER PROCESSING\n\n',
      `data: ${JSON.stringify({ choices: [{ delta: { audio: { data: parts[0] } } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: '' } }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: { audio: { data: parts[1] } } }] })}`,
      '\n\ndata: [DONE]\n\n',
    ]
    // Split mid-line to make sure partial lines are buffered.
    const text = sse.join('')
    const chunks = [text.slice(0, 333), text.slice(333, 1500), text.slice(1500)]
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((c) => controller.enqueue(new TextEncoder().encode(c)))
        controller.close()
      },
    })
    expect(Buffer.from(await music.collectAudio(stream)).equals(Buffer.from(bytes))).toBe(true)
  })

  it('reads the song from a Gemini Interactions response', () => {
    const bytes = music.demoSong('piano', 1)
    const body = {
      steps: [
        { type: 'thought', content: [] },
        { type: 'model_output', content: [{ type: 'text', text: '[Intro]' }, { type: 'audio', data: Buffer.from(bytes).toString('base64') }] },
      ],
    }
    expect(Buffer.from(music.audioFromInteraction(body)!).equals(Buffer.from(bytes))).toBe(true)
    expect(music.audioFromInteraction({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'hi' }] }] })).toBeNull()
    expect(music.audioFromInteraction(null)).toBeNull()
  })

  it('prefers Lyria 3.5 on Gemini, is off without a key, and caps songs per client', () => {
    const before = { ...process.env }
    delete process.env.OPENROUTER_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.MUSIC_PROVIDER
    expect(music.musicProvider()).toBe('off')
    process.env.OPENROUTER_API_KEY = 'test'
    expect(music.musicProvider()).toBe('openrouter')
    process.env.GEMINI_API_KEY = 'test'
    expect(music.musicProvider()).toBe('gemini')
    process.env.MUSIC_PROVIDER = 'openrouter'
    expect(music.musicProvider()).toBe('openrouter')
    process.env = before
    for (let i = 0; i < 6; i++) expect(music.allowSong('client-a').allowed).toBe(true)
    expect(music.allowSong('client-a').allowed).toBe(false)
    expect(music.allowSong('client-b').allowed).toBe(true)
  })
})
