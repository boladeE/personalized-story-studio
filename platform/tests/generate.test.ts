import { describe, expect, it } from 'vitest'
import { canGenerate, generateStory, sceneStatus } from '../src/story/generate'
import { SCENES } from '../src/story/library'
import { trackById } from '../src/story/music'
import { emptyIntake, SAMPLE_INTAKE } from '../src/story/sample'
import type { Frame, Intake, Story } from '../src/story/types'

const minimal = (): Intake => ({ ...emptyIntake(), sender: 'Ada', recipient: 'Kemi' })
const types = (story: Story) => story.scenes.map((s) => s.type)
const frameText = (f: Frame): string => JSON.stringify(f)

describe('generateStory', () => {
  it('rebuilds the identical story from the same intake and seed', () => {
    expect(generateStory(SAMPLE_INTAKE, 42)).toEqual(generateStory(SAMPLE_INTAKE, 42))
  })

  it('needs both names', () => {
    expect(canGenerate(emptyIntake())).toBe(false)
    expect(() => generateStory(emptyIntake(), 1)).toThrow()
  })

  it('builds a short but complete story from names alone', () => {
    const story = generateStory(minimal(), 7)
    expect(types(story)).toEqual(['ticket', 'hello', 'wish'])
    const wish = story.scenes.at(-1)!.frames[0]
    expect(wish).toMatchObject({ kind: 'wish', reveal: 'Happy birthday, Kemi. Love, Ada.' })
  })

  it('uses every scene the sample can fill, opening with the ticket and closing with the wish', () => {
    const story = generateStory(SAMPLE_INTAKE, 3)
    expect(types(story)[0]).toBe('ticket')
    expect(types(story).at(-1)).toBe('wish')
    expect(new Set(types(story))).toEqual(new Set(Object.keys(SCENES)))
  })

  it('only includes scenes whose needs are met', () => {
    const intake = { ...minimal(), habits: ['one', 'two', ''], reasons: ['a', 'b', 'c'] }
    const story = generateStory(intake, 11)
    expect(types(story)).toContain('reasons')
    expect(types(story)).not.toContain('redFlags')
    expect(sceneStatus(intake).find((s) => s.type === 'redFlags')?.missing).toBe('Add 1 more habit')
  })

  it('puts the sender’s words into the story verbatim', () => {
    const text = generateStory(SAMPLE_INTAKE, 5).scenes.flatMap((s) => s.frames.map(frameText)).join('\n')
    for (const value of [SAMPLE_INTAKE.spotlight, ...SAMPLE_INTAKE.habits, ...SAMPLE_INTAKE.reasons, SAMPLE_INTAKE.wish]) {
      expect(text).toContain(JSON.stringify(value).slice(1, -1))
    }
    for (const memory of SAMPLE_INTAKE.memories) expect(text).toContain(JSON.stringify(memory.story).slice(1, -1))
  })

  it('honours the photo chosen for each memory', () => {
    const lane = generateStory(SAMPLE_INTAKE, 9).scenes.find((s) => s.type === 'memoryLane')!
    const photos = lane.frames.flatMap((f) => (f.kind === 'photo' ? [f.photo.id] : []))
    expect(photos).toEqual(SAMPLE_INTAKE.memories.map((m) => m.photoId))
  })

  it('does not reuse a memory’s photo for the spotlight', () => {
    for (let seed = 0; seed < 40; seed++) {
      const spot = generateStory(SAMPLE_INTAKE, seed).scenes.find((s) => s.type === 'spotlight')!.frames[0]
      expect(spot.kind).toBe('photo')
      if (spot.kind === 'photo') expect(SAMPLE_INTAKE.memories.map((m) => m.photoId)).not.toContain(spot.photo.id)
    }
  })

  it('varies with the seed (Shuffle) while keeping the same content', () => {
    const stories = Array.from({ length: 30 }, (_, seed) => generateStory(SAMPLE_INTAKE, seed))
    expect(new Set(stories.map((s) => types(s).join())).size).toBeGreaterThan(1)
    expect(new Set(stories.map((s) => s.look)).size).toBe(3)
    expect(new Set(stories.map((s) => types(s).slice().sort().join())).size).toBe(1)
  })

  it('respects a chosen look', () => {
    expect(generateStory({ ...SAMPLE_INTAKE, look: 'paper' }, 1).look).toBe('paper')
  })

  it('gives every scene a real track, and scenes of one mood share it', () => {
    const story = generateStory(SAMPLE_INTAKE, 12)
    const byMood = new Map<string, Set<string>>()
    for (const scene of story.scenes) {
      expect(trackById(scene.trackId)).toBeDefined()
      byMood.set(scene.mood, (byMood.get(scene.mood) ?? new Set()).add(scene.trackId))
    }
    for (const tracks of byMood.values()) expect(tracks.size).toBe(1)
  })
})
