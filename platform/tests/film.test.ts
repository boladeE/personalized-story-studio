import { describe, expect, it } from 'vitest'
import { buildFilm, DEFAULT_BPM, shotAt } from '../src/film/timeline'
import { generateStory } from '../src/story/generate'
import { emptyIntake, SAMPLE_INTAKE, SAMPLE_NOTE } from '../src/story/sample'

const screening = { ...SAMPLE_INTAKE, world: 'screening' as const }
const story = generateStory(screening, 7)
const film = buildFilm(story)

describe('film timeline', () => {
  it('is one continuous run of shots with no gaps', () => {
    let clock = 0
    for (const shot of film.shots) {
      expect(shot.start).toBeCloseTo(clock, 6)
      expect(shot.duration).toBeGreaterThan(1.2)
      clock += shot.duration
    }
    expect(film.duration).toBeCloseTo(clock, 6)
    expect(film.duration).toBeGreaterThan(90)
    expect(film.duration).toBeLessThan(420)
  })

  it('cuts on whole beats of one steady pulse', () => {
    for (const shot of film.shots) {
      const beat = 60 / DEFAULT_BPM
      const beats = shot.duration / beat
      expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-6)
      expect(Math.round(beats) % 2).toBe(0)
    }
  })

  it('says everything the sender wrote, word for word', () => {
    const all = film.shots.map((s) => s.text).join('\n')
    const said = [
      SAMPLE_INTAKE.spotlight,
      SAMPLE_INTAKE.wish,
      ...SAMPLE_INTAKE.habits,
      ...SAMPLE_INTAKE.reasons,
      ...SAMPLE_INTAKE.memories.flatMap((m) => [m.title, m.story]),
      ...SAMPLE_INTAKE.letter.split(/\n+/),
    ]
    for (const text of said.map((t) => t.trim()).filter(Boolean)) expect(all).toContain(text)
  })

  it('opens on a dedication that becomes their name', () => {
    const [first, second] = film.shots
    expect(first.kind).toBe('line')
    expect(first.exit).toBe('dissolve')
    expect(second.kind).toBe('name')
    expect(second.enter).toBe('assemble')
    expect(second.kind === 'name' && second.name).toBe('Zara')
  })

  it('waits at the candle, then reveals the wish and rolls credits', () => {
    const kinds = film.shots.map((s) => s.kind)
    const wish = kinds.indexOf('wish')
    expect(kinds.slice(wish)).toEqual(['wish', 'reveal', 'credits'])
    expect(film.shots[wish].hold).toBe(true)
    expect(film.shots.at(-1)!.hold).toBe(true)
    const credits = film.shots.at(-1)!
    expect(credits.text).toContain('Starring: Zara')
    expect(credits.text).toContain('Written by: Tobi')
    // A sender's own film carries no notice; the sample says under its credits that its people are invented.
    expect(credits.text).not.toContain('fictional')
    const sample = buildFilm({ ...generateStory(screening, 7), note: SAMPLE_NOTE }).shots.at(-1)!
    expect(sample.kind).toBe('credits')
    expect(sample.text).toContain('Zara and Tobi are fictional')
    expect(SAMPLE_NOTE).not.toMatch(/\bAI\b/)
  })

  it('gives every chapter a numbered card and a place on the scrubber', () => {
    expect(film.scenes.map((s) => s.name)).not.toContain('The invitation')
    expect(film.scenes).toHaveLength(story.scenes.length - 1)
    const cards = film.shots.filter((s) => s.kind === 'card')
    expect(cards.map((c) => c.kind === 'card' && c.number)).toEqual(['Scene one', 'Scene two', 'Scene three', 'Scene four', 'Scene five', 'Scene six'])
    for (const scene of film.scenes) expect(shotAt(film, scene.start).scene).toBe(scene.scene)
  })

  it('finds the shot for any moment', () => {
    expect(shotAt(film, 0).index).toBe(0)
    expect(shotAt(film, film.duration + 5).index).toBe(film.shots.length - 1)
    const third = film.shots[2]
    expect(shotAt(film, third.start + third.duration / 2).index).toBe(2)
  })

  it('still makes a short film from two names alone', () => {
    const tiny = buildFilm(generateStory({ ...emptyIntake(), sender: 'Ada', recipient: 'Kemi', world: 'screening' }, 3))
    expect(tiny.shots.map((s) => s.kind)).toEqual(['line', 'name', 'line', 'wish', 'reveal', 'credits'])
  })
})

describe('music', () => {
  it('has no built-in music: a film carries a song made for it, or nothing', () => {
    // Nothing in a story or its film names any other music.
    const plain = JSON.stringify([story, film])
    expect(plain).not.toMatch(/trackId|score/i)
    const silent = film.shots.at(-1)!
    expect(silent.kind === 'credits' && silent.lines.map((l) => l.role)).not.toContain('Music')
    // With its song, the credits name it, and the film is cut exactly the same.
    const withSong = buildFilm({ ...story, soundtrack: { kind: 'song', src: '/song.mp3', label: 'Zara’s song' } })
    const sung = withSong.shots.at(-1)!
    expect(sung.kind === 'credits' && sung.lines).toContainEqual({ role: 'Music', name: 'Zara’s song' })
    expect(withSong.shots.slice(0, -1).map((s) => [s.kind, s.start, s.duration])).toEqual(film.shots.slice(0, -1).map((s) => [s.kind, s.start, s.duration]))
  })
})

describe('the same story as a scrapbook', () => {
  const album = buildFilm(generateStory({ ...SAMPLE_INTAKE, world: 'scrapbook', cut: { designs: { reasons: 'bunting', redFlags: 'stickies' } } }, 7))

  it('says everything the Screening says, word for word', () => {
    const all = album.shots.map((s) => s.text).join('\n')
    const said = [SAMPLE_INTAKE.spotlight, SAMPLE_INTAKE.wish, ...SAMPLE_INTAKE.habits, ...SAMPLE_INTAKE.reasons, ...SAMPLE_INTAKE.memories.flatMap((m) => [m.title, m.story]), ...SAMPLE_INTAKE.letter.split(/\n+/)]
    for (const text of said) expect(all).toContain(text.trim())
    expect(all).toContain('For Zara. From Tobi.')
  })

  it('opens on one title page and never cuts hard', () => {
    const [first, second] = album.shots
    expect(first).toMatchObject({ kind: 'name', name: 'Zara', kicker: 'For Zara. From Tobi.' })
    expect(second.kind).toBe('card')
    expect(album.shots.filter((s) => s.kind === 'line' && s.enter === 'cut')).toEqual([])
  })

  it('keeps the page while a list builds, then turns it', () => {
    const reasons = album.shots.filter((s) => s.kind === 'reason')
    expect(reasons.map((s) => s.exit)).toEqual(['cut', 'cut', 'fade'])
    expect(reasons.every((s) => s.kind === 'reason' && s.all.length === 3 && s.design === 'bunting')).toBe(true)
    const flags = album.shots.filter((s) => s.kind === 'flag')
    expect(flags.every((s) => s.exit === 'cut' && s.sceneType === 'redFlags')).toBe(true)
    // The verdict lands on the page the flags are on, so it knows what they were.
    const verdict = album.shots[flags.at(-1)!.index + 1]
    expect(verdict.kind === 'line' && verdict.items).toEqual(SAMPLE_INTAKE.habits)
  })

  it('still cuts on whole beats and waits at the candle', () => {
    for (const shot of album.shots) {
      const beats = shot.duration / (60 / DEFAULT_BPM)
      expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-6)
    }
    expect(album.shots.map((s) => s.kind).slice(-3)).toEqual(['wish', 'reveal', 'credits'])
  })
})
