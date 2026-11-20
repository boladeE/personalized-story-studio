import { describe, expect, it } from 'vitest'
import { buildFilm } from '../src/film/timeline'
import { generateStory, sceneStatus } from '../src/story/generate'
import { applyNotes, emptyNotes, isTheirWords, keepTheirWords, sortLocally } from '../src/story/notes'
import { isRomantic, RELATIONSHIPS } from '../src/story/relationships'
import { emptyIntake, SAMPLE_FIXED } from '../src/story/sample'
import { RELATIONSHIP_IDS } from '../src/story/types'
import type { Intake } from '../src/story/types'
import { parseIntake } from '../src/story/validate'
import { lyricParts, lyricsBrief, lyricsPrompt, parseSongDetails, songDetails, vibeById, VIBES } from '../src/story/vibes'

process.env.MUSIC_PROVIDER = 'demo'
const { sortProvider } = await import('../src/server/sort')

const NOTE =
  'We were meant to stay for one drink. Then the rain started and you moved your chair closer so I could hear you. You always steal the duvet, then ask why I am cold. You never finish your tea. I love you because you remember the small things I mention once.'
const base = (): Intake => ({ ...emptyIntake(), sender: 'Tobi', recipient: 'Zara' })

describe('sorting one box of words into scenes', () => {
  it('keeps a piece only when the sender wrote its words', () => {
    expect(isTheirWords('You always steal the duvet', NOTE)).toBe(true)
    expect(isTheirWords('you moved your chair closer', NOTE)).toBe(true)
    expect(isTheirWords('You light up every room', NOTE)).toBe(false)
    expect(isTheirWords('We danced in Paris all night', NOTE)).toBe(false)
    expect(isTheirWords('', NOTE)).toBe(false)
  })

  it('drops anything a sorter invents, and gives an invented title back to the sender’s own words', () => {
    const kept = keepTheirWords(
      {
        memories: [
          { title: 'A Magical Rainy Evening', story: 'We were meant to stay for one drink. Then the rain started and you moved your chair closer so I could hear you.' },
          { title: 'Paris', story: 'We danced in Paris until the sun came up.' },
        ],
        habits: ['You always steal the duvet, then ask why I am cold', 'You snore like a tractor', 'You never finish your tea'],
        reasons: ['you remember the small things I mention once', 'You are the most wonderful person alive'],
        spotlight: 'A radiant soul who brightens every day.',
        wish: 42,
      },
      NOTE,
    )
    expect(kept.memories).toEqual([{ title: 'We were meant to stay for one', story: 'We were meant to stay for one drink. Then the rain started and you moved your chair closer so I could hear you.' }])
    expect(kept.habits).toEqual(['You always steal the duvet, then ask why I am cold', 'You never finish your tea'])
    expect(kept.reasons).toEqual(['you remember the small things I mention once'])
    expect(kept.spotlight).toBe('')
    expect(kept.wish).toBe('')
    // A title that is also the story's opening isn't said twice.
    const lesson = 'The driving lesson: I stalled eleven times at the same junction and you just kept saying again.'
    expect(keepTheirWords({ memories: [{ title: 'The driving lesson', story: lesson }] }, lesson).memories).toEqual([
      { title: 'The driving lesson', story: 'I stalled eleven times at the same junction and you just kept saying again.' },
    ])
    expect(keepTheirWords(null, NOTE)).toEqual(emptyNotes())
    expect(keepTheirWords({ habits: 'not a list', memories: [null, 7] }, NOTE)).toEqual(emptyNotes())
  })

  it('sorts by rule when there is no model, using only the sender’s sentences', () => {
    expect(sortProvider()).toBe('local')
    const notes = sortLocally(NOTE)
    expect(notes.habits).toEqual(['You always steal the duvet, then ask why I am cold.', 'You never finish your tea.'])
    expect(notes.reasons).toEqual(['I love you because you remember the small things I mention once.'])
    expect(notes.memories).toHaveLength(1)
    expect(notes.memories[0].story).toContain('you moved your chair closer')
    for (const piece of [...notes.habits, ...notes.reasons, notes.memories[0].title, notes.memories[0].story]) expect(isTheirWords(piece, NOTE)).toBe(true)
  })

  it('pours sorted notes into a draft and leaves the letter, photos and names alone', () => {
    let n = 0
    const draft = { ...base(), letter: 'Dear Zara, a letter that is long enough to count as one.', photos: SAMPLE_FIXED.photos, wish: 'Kept.' }
    const poured = applyNotes(draft, sortLocally(NOTE), () => String(++n))
    expect(poured.memories).toEqual([{ id: 'm-1', title: 'We were meant to stay for one', story: expect.stringContaining('one drink'), photoId: '' }])
    expect(poured.habits).toEqual(['You always steal the duvet, then ask why I am cold.', 'You never finish your tea.', ''])
    // One reason is a reason short of its own scene, so it says how they are beside their photo instead of being lost.
    expect(poured.reasons).toEqual(['', '', ''])
    expect(poured.spotlight).toBe('I love you because you remember the small things I mention once.')
    expect(poured.letter).toBe(draft.letter)
    expect(poured.photos).toBe(draft.photos)
    expect(poured.wish).toBe('Kept.')
    // Nothing to sort leaves the form's empty rows in place.
    expect(applyNotes(base(), emptyNotes()).memories).toHaveLength(2)
  })

  it('makes a film from a few sentences: one memory and two habits are enough for their scenes', () => {
    const intake = applyNotes({ ...base(), photos: SAMPLE_FIXED.photos.slice(0, 3) }, sortLocally(NOTE))
    const story = generateStory(intake, 4)
    const types = story.scenes.map((s) => s.type)
    expect(types).toEqual(expect.arrayContaining(['ticket', 'hello', 'spotlight', 'memoryLane', 'redFlags', 'cameraRoll', 'wish']))
    expect(types).not.toContain('reasons')
    expect(sceneStatus(intake).find((s) => s.type === 'reasons')?.missing).toBe('Add 2 more reasons')
    // The lone reason still reaches the song.
    expect(songDetails(intake)?.reasons).toEqual(['I love you because you remember the small things I mention once.'])
    // A single memory is told by itself, not announced as "1 of 1" after a card promising several.
    const lane = story.scenes.find((s) => s.type === 'memoryLane')!
    expect(lane.frames).toHaveLength(1)
    expect(lane.frames[0]).toMatchObject({ kind: 'photo', kicker: 'Remember when?', title: 'We were meant to stay for one' })
    expect(buildFilm(story).shots.map((s) => s.text).join(' ')).not.toMatch(/1 of 1|A few of our moments/)
  })
})

describe('who the film is for', () => {
  it('offers every relationship and knows which are romantic', () => {
    expect(RELATIONSHIPS.map((r) => r.id)).toEqual([...RELATIONSHIP_IDS])
    expect(isRomantic('wife')).toBe(true)
    expect(isRomantic('mother')).toBe(false)
    expect(isRomantic(undefined)).toBeUndefined()
  })

  it('travels with the intake and the song details, and is optional', () => {
    const parsed = parseIntake({ ...SAMPLE_FIXED, relationship: 'girlfriend' })
    expect(parsed.ok && parsed.intake.relationship).toBe('girlfriend')
    const unknown = parseIntake({ ...SAMPLE_FIXED, relationship: 'nemesis' })
    expect(unknown.ok && 'relationship' in unknown.intake).toBe(false)
    expect(songDetails({ ...SAMPLE_FIXED, relationship: 'friend' })?.relationship).toBe('friend')
    expect(parseSongDetails({ recipient: 'Zara', relationship: 'nemesis' })).not.toHaveProperty('relationship')
  })

  it('signs off the red flags without "staying anyway" when the film is not for a partner', () => {
    const verdicts = (intake: Intake) =>
      new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((seed) => generateStory(intake, seed).scenes.find((s) => s.type === 'redFlags')!.frames.at(-1)).map((f) => (f?.kind === 'title' ? f.title : '')))
    expect([...verdicts({ ...SAMPLE_FIXED, relationship: 'mother' })].join(' ')).not.toContain('Staying anyway')
    expect([...verdicts({ ...SAMPLE_FIXED, relationship: 'wife' })].join(' ')).toContain('Staying anyway')
    // Unknown is treated as before the question existed.
    expect([...verdicts(SAMPLE_FIXED)].join(' ')).toContain('Staying anyway')
  })

  it('tells the lyric writer who they are to each other, only when the sender said', () => {
    expect(lyricsBrief(songDetails({ ...SAMPLE_FIXED, relationship: 'wife' })!)).toContain("Zara is Tobi's wife.")
    expect(lyricsBrief(songDetails({ ...SAMPLE_FIXED, relationship: 'other' })!)).not.toMatch(/Zara is Tobi's/)
    expect(lyricsBrief(songDetails(SAMPLE_FIXED)!)).not.toMatch(/Zara is Tobi's/)
  })
})

describe('the song recipe', () => {
  const words = '[Verse]\nThe rain can wait'

  it('asks for the sample song’s recipe: a love song only for a partner, in the chosen voice', () => {
    const afrobeats = vibeById('afrobeats')!
    expect(VIBES[0]).toBe(afrobeats)
    const forWife = lyricsPrompt(afrobeats, songDetails({ ...SAMPLE_FIXED, relationship: 'wife' })!, words, 'man')
    expect(forWife.split('\n').slice(0, 5)).toEqual([
      'Afrobeats, Afropop love song. 100 BPM, in A major.',
      'Instruments: syncopated Afrobeats drum groove with shakers and rim clicks, warm rounded bass, bright plucked guitar riffs, soft synth pads.',
      'Mood: Romantic, relaxed, groovy, warm.',
      'Vocals: Male tenor, smooth and warm, with a relaxed melodic delivery. Stacked harmonies answering the hook in the chorus.',
      'Production: clean, modern, radio-ready mix. Lead vocal front and centre, every word clear.',
    ])
    const forMum = lyricsPrompt(afrobeats, songDetails({ ...SAMPLE_FIXED, relationship: 'mother' })!, words, 'woman')
    expect(forMum).toMatch(/^Afrobeats, Afropop song\. 100 BPM/)
    expect(forMum).toContain('Mood: Affectionate, relaxed, groovy, warm.')
    expect(forMum).toContain('Vocals: Female alto')
    expect(forMum).not.toMatch(/love song|Romantic/)
    // Not saying who they are, or leaving the voice open, asks for neither.
    const open = lyricsPrompt(afrobeats, songDetails(SAMPLE_FIXED)!, words)
    expect(open).not.toMatch(/love song|Romantic|Male|Female/)
    expect(open.endsWith(`Lyrics:\n${words}`)).toBe(true)
  })

  it('gives every style a full recipe and a tune to hear', () => {
    for (const vibe of VIBES) expect(vibe.genre && vibe.tempo && vibe.instruments && vibe.mood && vibe.prompt, vibe.id).toBeTruthy()
  })
})

describe('a song’s words, laid out to read', () => {
  it('splits them into their named parts, and never shows a part’s name as a sung line', () => {
    const parts = lyricParts('[Verse]\nWake up today\nSee you right there\n\n[Pre-chorus]\nDon’t have to speak\n[Chorus]\nYou give me joy\nYou give me joy\n')
    expect(parts.map((p) => p.label)).toEqual(['Verse', 'Pre-chorus', 'Chorus'])
    expect(parts[0].lines).toEqual(['Wake up today', 'See you right there'])
    expect(parts[2].lines).toEqual(['You give me joy', 'You give me joy'])
    expect(parts.flatMap((p) => p.lines).some((line) => line.includes('['))).toBe(false)
  })

  it('treats a blank line as the start of an unnamed part, and drops parts with nothing sung', () => {
    const parts = lyricParts('Meant to stay for one\nThen the weather turned\n\nThe rain can wait\n\n[Bridge]\n\n')
    expect(parts).toEqual([
      { label: '', lines: ['Meant to stay for one', 'Then the weather turned'] },
      { label: '', lines: ['The rain can wait'] },
    ])
    expect(lyricParts('')).toEqual([])
  })
})
