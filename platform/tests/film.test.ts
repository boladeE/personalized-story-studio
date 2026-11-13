import { describe, expect, it } from 'vitest'
import { buildFilm, shotAt } from '../src/film/timeline'
import { generateStory } from '../src/story/generate'
import { trackById } from '../src/story/music'
import { emptyIntake, SAMPLE_INTAKE } from '../src/story/sample'

const story = generateStory(SAMPLE_INTAKE, 7)
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

  it('cuts on whole beats of each scene’s music', () => {
    for (const shot of film.shots) {
      const beat = 60 / trackById(shot.trackId)!.bpm
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
    const tiny = buildFilm(generateStory({ ...emptyIntake(), sender: 'Ada', recipient: 'Kemi' }, 3))
    expect(tiny.shots.map((s) => s.kind)).toEqual(['line', 'name', 'line', 'wish', 'reveal', 'credits'])
  })
})
