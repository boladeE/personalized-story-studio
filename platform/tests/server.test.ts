import { mkdtempSync } from 'node:fs'
import { lockProblems } from '../src/story/lock'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'lt-gifts-'))

const store = await import('../src/server/store')
const music = await import('../src/server/music')
const lyrics = await import('../src/server/lyrics')
const vibes = await import('../src/story/vibes')
const { parseIntake } = await import('../src/story/validate')
const { SAMPLE_FIXED } = await import('../src/story/sample')

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

describe('media responses', () => {
  it('serves whole files and byte ranges, so a song can be streamed', async () => {
    const bytes = Uint8Array.from({ length: 1000 }, (_, i) => i % 256)
    const ask = (range?: string) => store.mediaResponse(new Request('http://x/song', { headers: range ? { range } : {} }), bytes, 'audio/mpeg')
    const whole = ask()
    expect(whole.status).toBe(200)
    expect(whole.headers.get('accept-ranges')).toBe('bytes')
    expect(whole.headers.get('content-length')).toBe('1000')
    const part = ask('bytes=100-199')
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 100-199/1000')
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(bytes.slice(100, 200))
    expect(ask('bytes=900-').headers.get('content-range')).toBe('bytes 900-999/1000')
    expect(ask('bytes=-50').headers.get('content-range')).toBe('bytes 950-999/1000')
    expect(ask('bytes=0-5000').headers.get('content-range')).toBe('bytes 0-999/1000')
    expect(ask('bytes=2000-').status).toBe(416)
    expect(ask('bytes=abc').status).toBe(200)
  })
})

describe('the lock on a gift', () => {
  it('says what is wrong with each field, in the sender’s terms', () => {
    expect(lockProblems('', '')).toEqual({ question: 'Add a question.', answer: 'Add the answer that opens it.' })
    expect(lockProblems(' a ', 'x').question).toBe('Make the question a little longer.')
    expect(lockProblems('What did you call me at games night?', 'A cheat')).toEqual({ question: '', answer: '' })
    // A question that contains its own answer is no lock at all.
    expect(lockProblems('Did you call me a cheat?', ' A Cheat ').answer).toBe('The question gives this answer away. Change one of them.')
    // One letter is too little to judge by.
    expect(lockProblems('Where did we meet?', 'e').answer).toBe('')
  })
})

describe('intake validation', () => {
  it('accepts the sample and rejects bad shapes', () => {
    expect(parseIntake(SAMPLE_FIXED).ok).toBe(true)
    expect(parseIntake({ ...SAMPLE_FIXED, sender: ' ' })).toEqual({ ok: false, error: 'Both names are needed' })
    expect(parseIntake({ ...SAMPLE_FIXED, letter: 'x'.repeat(7000) }).ok).toBe(false)
    expect(parseIntake({ ...SAMPLE_FIXED, look: 'neon' }).ok).toBe(false)
    expect(parseIntake({ ...SAMPLE_FIXED, world: 'opera' })).toEqual({ ok: false, error: 'Unknown kind of film' })
    expect(parseIntake({ ...SAMPLE_FIXED, photos: [{ id: '../x', caption: '' }] }).ok).toBe(false)
    expect(parseIntake({ ...SAMPLE_FIXED, memories: [{ id: 'm1', title: 'a', story: 'b', photoId: 'p-missing' }] }).ok).toBe(false)
  })

  it('keeps the kind of film and the sender’s own cut, and refuses a malformed one', () => {
    const cut = { order: ['reasons', 'spotlight'], off: ['cameraRoll'], designs: { redFlags: 'checklist' } }
    const parsed = parseIntake({ ...SAMPLE_FIXED, world: 'scrapbook', cut })
    expect(parsed.ok && parsed.intake.world).toBe('scrapbook')
    expect(parsed.ok && parsed.intake.cut).toEqual(cut)
    // Gifts made before worlds carry neither.
    const plain = parseIntake(SAMPLE_FIXED)
    expect(plain.ok && 'world' in plain.intake).toBe(false)
    expect(plain.ok && 'cut' in plain.intake).toBe(false)
    for (const bad of [{ order: 'reasons' }, { off: [7] }, { designs: { redFlags: '<script>' } }, { order: Array(40).fill('reasons') }, ['reasons'], 'x']) {
      expect(parseIntake({ ...SAMPLE_FIXED, cut: bad }).ok, JSON.stringify(bad)).toBe(false)
    }
  })

  it('drops photo sources sent by the browser', () => {
    const parsed = parseIntake(SAMPLE_FIXED)
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
    // Lyria sometimes gives the second each line starts instead of a bare marker.
    const timed = { steps: [{ type: 'model_output', content: [{ type: 'text', text: '[[A0]]\n[[B1]]\n[12.9:] Eleven-minute voice note (quick gist)\n[19:] Said you weren’t hungry\n[[C2]]\n[47.1:] Another sweet year, Zara' }] }] }
    expect(music.lyricsFromInteraction(timed)).toBe('Eleven-minute voice note (quick gist)\nSaid you weren’t hungry\n\nAnother sweet year, Zara')
    expect(music.lyricsFromInteraction(null)).toBe('')
  })

  it('writes a sung song only from the sender’s details, and an instrumental from none of them', () => {
    const vibe = vibes.vibeById('highlife')!
    const details = vibes.songDetails(SAMPLE_FIXED)!
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

  it('briefs the lyric writer only from the sender’s details, in either tone, and steers it off the old birthday song', () => {
    const details = vibes.songDetails(SAMPLE_FIXED)!
    for (const tone of vibes.LYRIC_TONES) {
      const brief = vibes.lyricsBrief(details, tone)
      expect(brief).toContain('Tobi')
      expect(brief).toContain('eats my chips')
      expect(brief).toContain('exact phrase "happy birthday to you"')
      expect(brief).not.toContain('holding everything together')
      expect(brief).not.toContain('Golden hour')
      // The worked example is about other people and must not leak into a song as fact.
      expect(brief).toContain('written for two other people')
      expect(brief).toMatch(/do not reuse its hook/)
      const bare = vibes.lyricsBrief(vibes.parseSongDetails({ recipient: 'Kemi' })!, tone)
      expect(bare).toContain('No other details were given.')
      expect(bare).toMatch(/do not (pad it with invented|invent a) history/)
    }
    // Smooth is the default: few details, the name and the birthday held back.
    expect(vibes.lyricsBrief(details)).toBe(vibes.lyricsBrief(details, 'smooth'))
    expect(vibes.lyricsBrief(details, 'smooth')).toContain('Choose at most three details')
    expect(vibes.lyricsBrief(details, 'story')).toContain('Verse 2 teases')
    expect(vibes.isLyricTone('story')).toBe(true)
    expect(vibes.isLyricTone('loud')).toBe(false)
  })

  it('asks the music model to sing the approved words exactly', () => {
    const details = vibes.songDetails(SAMPLE_FIXED)!
    const words = '[Verse]\nYou steal the duvet, ask why I’m cold\n\n[Chorus]\nHappy birthday, Zara'
    const prompt = vibes.lyricsPrompt(vibes.vibeById('highlife')!, details, words)
    expect(prompt).toContain('exactly as written')
    expect(prompt).toContain('Do not add, drop or change any words')
    expect(prompt).toMatch(/^Highlife song\. 112 BPM\.\nInstruments: /)
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
    // Some models bracket the labels themselves; the parts must still be named, not dropped.
    const bracketed = lyrics.lyricsFromGenerate(reply({ title: 'x', sections: [{ label: '[Pre-Chorus]', lines: ['You know when to listen'] }, { label: '[Chorus]', lines: ['Suspiciously good, Zara (Zara)'] }] }))!
    expect(bracketed.lyrics).toBe('[Pre-chorus]\nYou know when to listen\n\n[Chorus]\nSuspiciously good, Zara (Zara)')
    expect(lyrics.lyricsFromGenerate(reply({ title: 'x', sections: [] }))).toBeNull()
    expect(lyrics.lyricsFromGenerate({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })).toBeNull()
    expect(music.isRecitationRefusal(400, '{"error":{"code":"recitation"}}')).toBe(true)
    expect(music.isRecitationRefusal(500, 'recitation')).toBe(false)
  })

  it('keeps the approved words and title with a song made from them', async () => {
    const before = { ...process.env }
    process.env.MUSIC_PROVIDER = 'demo'
    const details = vibes.songDetails(SAMPLE_FIXED)!
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

describe('telling a clip from a photo', () => {
  it('knows MP4, MOV and WebM by their first bytes, and that an iPhone photo is not a clip', async () => {
    const { sniffVideo } = await import('../src/server/store')
    const box = (brand: string) => new Uint8Array([0, 0, 0, 24, ...Buffer.from(`ftyp${brand}`), 0, 0, 0, 0])
    expect(sniffVideo(box('isom'))).toBe('video/mp4')
    expect(sniffVideo(box('qt  '))).toBe('video/quicktime')
    expect(sniffVideo(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('video/webm')
    expect(sniffVideo(box('heic'))).toBeNull()
    expect(sniffVideo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
  })
})
