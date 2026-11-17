import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'lt-gifts-'))

const store = await import('../src/server/store')
const music = await import('../src/server/music')
const lyrics = await import('../src/server/lyrics')
const vibes = await import('../src/story/vibes')
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

  it('reads the sung words Lyria reports, by section', () => {
    const text = '[[A0]]\n[[B1]]\n[:] You say you are not hungry.\n[:] Then you eat my chips.\n[[C2]]\n[:] Happy birthday, Zara.\n[[D3]]'
    const body = { steps: [{ type: 'model_output', content: [{ type: 'text', text }] }, { type: 'model_output', content: [{ type: 'audio', data: 'AAAA' }] }] }
    expect(music.lyricsFromInteraction(body)).toBe('You say you are not hungry.\nThen you eat my chips.\n\nHappy birthday, Zara.')
    expect(music.lyricsFromInteraction({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '[[A0]]\n[[B1]]' }] }] })).toBe('')
    expect(music.lyricsFromInteraction(null)).toBe('')
  })

  it('writes a sung song only from the sender’s details, and an instrumental from none of them', () => {
    const vibe = vibes.vibeById('highlife')!
    const details = vibes.songDetails(SAMPLE_INTAKE)!
    expect(details).toMatchObject({ recipient: 'Zara', sender: 'Tobi' })
    expect(details.reasons).toHaveLength(3)
    expect(details.habits).toHaveLength(3)
    expect(details.moments).toHaveLength(2)
    const sung = vibes.sungPrompt(vibe, details)
    expect(sung).toContain('Sing the name "Zara"')
    expect(sung).toContain('eats my chips')
    expect(sung).toContain('You called me a cheat.')
    expect(sung).toContain('Do not add places, events, nicknames or facts')
    // The letter and photo captions stay in the studio.
    expect(sung).not.toContain('holding everything together')
    expect(sung).not.toContain('Golden hour')
    const plain = vibes.songPrompt(vibe)
    expect(plain).toContain('No vocals')
    expect(plain).not.toMatch(/Zara|Tobi/)
  })

  it('cleans song details from the browser and needs a name', () => {
    expect(vibes.parseSongDetails({ recipient: '  ', habits: ['x'] })).toBeNull()
    expect(vibes.parseSongDetails('Zara')).toBeNull()
    const parsed = vibes.parseSongDetails({
      recipient: ' Kemi "K"\nAde ',
      sender: 7,
      habits: ['a', '', 'b', 'c', 'd'],
      reasons: 'not a list',
      moments: ['x'.repeat(1000)],
      wish: 'line one\nline two',
      letter: 'private',
    })!
    expect(parsed.recipient).toBe('Kemi K Ade')
    expect(parsed.sender).toBe('')
    expect(parsed.habits).toEqual(['a', 'b', 'c'])
    expect(parsed.reasons).toEqual([])
    expect(parsed.moments[0]).toHaveLength(vibes.SONG_LIMITS.moment)
    expect(parsed.wish).toBe('line one line two')
    expect(Object.keys(parsed)).not.toContain('letter')
    expect(vibes.sungPrompt(vibes.vibeById('piano')!, vibes.parseSongDetails({ recipient: 'Kemi' })!)).toContain('keep the lyrics to warm birthday wishes')
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

  it('cleans lyrics: one sung line per row, known section tags only, capped', () => {
    const tidy = vibes.tidyLyrics('[verse 1]\r\n  You steal   the duvet \n\n\n[Guitar solo]\n[CHORUS]\nHappy birthday, [Zara]\u0007\n[Bridge]\n')
    expect(tidy).toBe('[Verse]\nYou steal the duvet\n\n[Chorus]\nHappy birthday, Zara')
    expect(vibes.tidyLyrics('[Verse]\n\n[Chorus]')).toBe('')
    expect(vibes.tidyLyrics(42)).toBe('')
    const long = vibes.tidyLyrics(Array.from({ length: 80 }, (_, i) => `line ${i} ${'x'.repeat(200)}`).join('\n'))
    expect(long.split('\n')).toHaveLength(vibes.LYRIC_LIMITS.lines)
    expect(Math.max(...long.split('\n').map((l) => l.length))).toBeLessThanOrEqual(vibes.LYRIC_LIMITS.line)
  })

  it('briefs the lyric writer only from the sender’s details and steers it off the old birthday song', () => {
    const details = vibes.songDetails(SAMPLE_INTAKE)!
    const brief = vibes.lyricsBrief(details)
    expect(brief).toContain('Tobi')
    expect(brief).toContain('eats my chips')
    expect(brief).toContain('Never write the exact phrase "happy birthday to you"')
    expect(brief).not.toContain('holding everything together')
    expect(brief).not.toContain('Golden hour')
    expect(vibes.lyricsBrief(vibes.parseSongDetails({ recipient: 'Kemi' })!)).toContain('Do not make up a history')
  })

  it('asks the music model to sing the approved words exactly', () => {
    const details = vibes.songDetails(SAMPLE_INTAKE)!
    const words = '[Verse]\nYou steal the duvet, ask why I’m cold\n\n[Chorus]\nHappy birthday, Zara'
    const prompt = vibes.lyricsPrompt(vibes.vibeById('highlife')!, details, words)
    expect(prompt).toContain('word for word')
    expect(prompt).toContain('highlife')
    expect(prompt.endsWith(`Lyrics:\n${words}`)).toBe(true)
    expect(prompt).not.toContain('eleven-minute')
  })

  it('reads written lyrics from the text model and never passes on a line the music model refuses', () => {
    const reply = (value: unknown) => ({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: JSON.stringify(value) }] } }] })
    const written = lyrics.lyricsFromGenerate(
      reply({ title: 'Suspiciously "Good"', sections: [{ label: 'Verse 1', lines: ['One drink, then the rain'] }, { label: 'Chorus', lines: ['Happy birthday to you, Zara'] }] }),
    )!
    expect(written.title).toBe('Suspiciously Good')
    expect(written.lyrics).toBe('[Verse]\nOne drink, then the rain\n\n[Chorus]\nHappy, happy birthday, Zara')
    expect(vibes.hasRefusedLine(written.lyrics)).toBe(false)
    expect(vibes.hasRefusedLine('happy  Birthday to YOU')).toBe(true)
    expect(lyrics.lyricsFromGenerate(reply({ title: 'x', sections: [] }))).toBeNull()
    expect(lyrics.lyricsFromGenerate({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })).toBeNull()
    expect(music.isRecitationRefusal(400, '{"error":{"code":"recitation"}}')).toBe(true)
    expect(music.isRecitationRefusal(500, 'recitation')).toBe(false)
  })

  it('keeps the approved words and title with a song made from them', async () => {
    const before = { ...process.env }
    process.env.MUSIC_PROVIDER = 'demo'
    const details = vibes.songDetails(SAMPLE_INTAKE)!
    expect(lyrics.lyricsProvider()).toBe('demo')
    const words = await lyrics.writeLyrics(details)
    expect(words.lyrics).toContain('Happy birthday, Zara')
    expect(vibes.hasRefusedLine(words.lyrics)).toBe(false)
    const song = await music.generateSong('piano', details, { lyrics: words.lyrics, title: words.title })
    const stored = (await music.readSong(song.id))!
    expect(stored.meta.lyrics).toBe(words.lyrics)
    expect(stored.meta.title).toBe('For Zara')
    expect(stored.meta.sung).toBe(true)
    const plain = await music.generateSong('piano')
    expect((await music.readSong(plain.id))!.meta.title).toBeUndefined()
    delete process.env.MUSIC_PROVIDER
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENROUTER_API_KEY
    expect(lyrics.lyricsProvider()).toBe('off')
    process.env.OPENROUTER_API_KEY = 'test'
    expect(lyrics.lyricsProvider()).toBe('off')
    process.env = before
    for (let i = 0; i < 20; i++) expect(lyrics.allowLyrics('writer-a').allowed).toBe(true)
    expect(lyrics.allowLyrics('writer-a').allowed).toBe(false)
  })
})
