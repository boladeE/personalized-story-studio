import { describe, expect, it } from 'vitest'
import { previewFor } from '../src/film/previews'
import { buildFilm } from '../src/film/timeline'
import { generateStory, sceneStatus } from '../src/story/generate'
import { occasionOf, OCCASIONS } from '../src/story/occasions'
import { emptyIntake, SAMPLE_FIXED } from '../src/story/sample'
import { OCCASION_IDS } from '../src/story/types'
import type { Intake, Occasion } from '../src/story/types'
import { parseIntake } from '../src/story/validate'
import { lyricsBrief, lyricsPrompt, parseSongDetails, songDetails, songPrompt, sungPrompt, VIBES } from '../src/story/vibes'
import { demoLyrics } from '../src/server/lyrics'

const sampleFor = (occasion: Occasion): Intake => ({ ...SAMPLE_FIXED, occasion })
const others = OCCASION_IDS.filter((id) => id !== 'birthday')

describe('occasions', () => {
  it('defines every occasion once, in the order they are offered', () => {
    expect(OCCASIONS.map((o) => o.id)).toEqual([...OCCASION_IDS])
    for (const o of OCCASIONS) {
      expect(o.name && o.blurb && o.ticket && o.share && o.ending.action).toBeTruthy()
      expect(o.opening.length).toBeGreaterThan(1)
      expect(o.ending.fallback).toContain('{r}')
    }
    // Anything unknown is a birthday, which is what gifts made before occasions were.
    expect(occasionOf(undefined).id).toBe('birthday')
    expect(occasionOf('carnival').id).toBe('birthday')
  })

  it('puts the occasion on the ticket and ends on a candle only for a birthday', () => {
    for (const id of OCCASION_IDS) {
      const def = occasionOf(id)
      const story = generateStory({ ...emptyIntake(), occasion: id, sender: 'Ada', recipient: 'Kemi' }, 5)
      expect(story.occasion).toBe(id)
      expect(story.scenes[0].frames[0]).toMatchObject({ kind: 'ticket', occasion: def.ticket })
      const last = story.scenes.at(-1)!
      expect(last.name).toBe(def.ending.scene)
      expect(last.frames[0]).toMatchObject({
        kind: 'wish',
        prop: id === 'birthday' ? 'candle' : 'seal',
        action: def.ending.action,
        reveal: def.ending.fallback.replace('{r}', 'Kemi').replace('{s}', 'Ada'),
      })
      const wish = buildFilm(story).shots.find((s) => s.kind === 'wish')
      expect(wish).toMatchObject({ prop: def.ending.prop, action: def.ending.action })
    }
  })

  it('never mentions a birthday in a film made for something else, whatever the shuffle', () => {
    for (const id of others) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const film = buildFilm(generateStory(sampleFor(id), seed))
        const said = film.shots.map((s) => s.text).join(' ')
        // ("Candle" alone is the name of one of the studio's score tracks, so it can appear in the credits.)
        expect(said, `${id}, seed ${seed}`).not.toMatch(/birthday|the candle|make a wish/i)
        expect(said).not.toMatch(/\{[rs]\}/)
      }
      expect(JSON.stringify(sceneStatus(sampleFor(id)))).not.toMatch(/candle/i)
    }
  })

  it('shows the occasion in the writing flow’s previews', () => {
    const focus = { memory: 0, habit: 0, reason: 0 }
    const intake = { ...emptyIntake(), occasion: 'thank-you' as const, sender: 'Ada', recipient: 'Kemi' }
    expect(previewFor('who', intake, focus).content).toMatchObject({ kind: 'ticket', occasion: 'A thank-you' })
    expect(JSON.stringify(previewFor('wish', intake, focus).content)).toContain('Thank you, Kemi. Love, Ada.')
    expect(JSON.stringify(previewFor('look', intake, focus).content)).toContain('Thank you, Kemi.')
  })

  it('a gift stored before occasions existed still ends on its candle', () => {
    const story = generateStory(SAMPLE_FIXED, 9)
    const old = structuredClone(story)
    for (const scene of old.scenes) for (const frame of scene.frames) if (frame.kind === 'wish') (delete frame.prop, delete frame.action)
    expect(buildFilm(old).shots.find((s) => s.kind === 'wish')).toMatchObject({ prop: 'candle', action: 'Blow out the candle' })
  })

  it('validates the occasion that arrives from the browser', () => {
    for (const id of OCCASION_IDS) {
      const parsed = parseIntake(sampleFor(id))
      expect(parsed.ok && parsed.intake.occasion).toBe(id)
    }
    expect(parseIntake({ ...SAMPLE_FIXED, occasion: 'carnival' })).toEqual({ ok: false, error: 'Unknown occasion' })
    expect(parseIntake({ ...SAMPLE_FIXED, occasion: undefined }).ok).toBe(false)
  })
})

describe('songs for an occasion', () => {
  it('carries the occasion with the song details, and treats a missing one as a birthday', () => {
    expect(songDetails(sampleFor('anniversary'))?.occasion).toBe('anniversary')
    expect(parseSongDetails({ recipient: 'Zara' })?.occasion).toBe('birthday')
    expect(parseSongDetails({ recipient: 'Zara', occasion: 'carnival' })?.occasion).toBe('birthday')
  })

  it('briefs the writer for the occasion, and tells it the worked example is a birthday', () => {
    for (const id of others) {
      const d = songDetails(sampleFor(id))!
      const { greeting } = occasionOf(id).song
      for (const tone of ['smooth', 'story'] as const) {
        const brief = lyricsBrief(d, tone)
        expect(brief, `${id} ${tone}`).toContain('The example was written for a birthday. This song is not')
        expect(brief).not.toContain('The birthday wish')
        expect(brief).not.toContain('is the birthday line')
        expect(brief).not.toMatch(/song for Zara's birthday|short birthday song/)
        if (greeting) expect(brief).toContain(`"${greeting}"`)
        else expect(brief).toContain('no greeting line')
      }
    }
    // The birthday brief is the one that was tuned by ear; it carries no such note.
    expect(lyricsBrief(songDetails(SAMPLE_FIXED)!, 'smooth')).not.toContain('The example was written for a birthday')
  })

  it('tells the music model what it is singing or scoring', () => {
    const d = songDetails(sampleFor('anniversary'))!
    expect(sungPrompt(VIBES[0], d)).toContain('It is an anniversary gift from Tobi to Zara.')
    expect(sungPrompt(VIBES[0], d)).toContain('say "happy anniversary"')
    expect(sungPrompt(VIBES[0], songDetails(sampleFor('just-because'))!)).not.toMatch(/birthday|, and say/)
    expect(songPrompt(VIBES[0], 'thank-you')).toContain('thank-you surprise')
    expect(songPrompt(VIBES[0])).toContain('birthday surprise')
    for (const id of others) {
      const details = songDetails(sampleFor(id))!
      expect(`${sungPrompt(VIBES[1], details)} ${lyricsPrompt(VIBES[1], details, 'la')} ${songPrompt(VIBES[1], id)}`, id).not.toMatch(/birthday/i)
    }
  })

  it('writes placeholder words for the occasion too', () => {
    expect(demoLyrics(songDetails(sampleFor('missing-you'))!).lyrics).toContain('I miss you, Zara')
    expect(demoLyrics(songDetails(sampleFor('just-because'))!).lyrics).toContain('This one is for Zara')
    expect(demoLyrics(songDetails(SAMPLE_FIXED)!).lyrics).toContain('Happy birthday, Zara')
  })
})
