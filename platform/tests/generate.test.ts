import { describe, expect, it } from 'vitest'
import { canGenerate, generateStory, moveScene, nextDesign, sceneBoard, sceneStatus, toggleScene } from '../src/story/generate'
import { designsFor, WORLDS } from '../src/story/worlds'
import { SCENES } from '../src/story/library'
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
    const intake = { ...minimal(), habits: ['one', '', ''], reasons: ['a', 'b', ''] }
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

  it('draws the kind of film and each scene’s design from the seed, and keeps what the sender chose', () => {
    const stories = Array.from({ length: 40 }, (_, seed) => generateStory(SAMPLE_INTAKE, seed))
    expect(new Set(stories.map((s) => s.world))).toEqual(new Set(WORLDS.map((w) => w.id)))
    for (const story of stories) {
      for (const scene of story.scenes) {
        const options = designsFor(story.world, scene.type).map((d) => d.id)
        if (options.length) expect(options).toContain(scene.design)
        else expect(scene.design).toBeUndefined()
      }
    }
    // Many different films from the same words and photos.
    const cuts = new Set(stories.map((s) => [s.world, ...s.scenes.map((sc) => `${sc.type}:${sc.design ?? ''}`)].join()))
    expect(cuts.size).toBeGreaterThan(15)
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const chosen = generateStory({ ...SAMPLE_INTAKE, world: 'scrapbook', cut: { designs: { redFlags: 'checklist', reasons: 'nonsense' } } }, seed)
      expect(chosen.world).toBe('scrapbook')
      expect(chosen.scenes.find((s) => s.type === 'redFlags')!.design).toBe('checklist')
      // A design this kind of film doesn't have is ignored, not broken.
      expect(['bunting', 'cards']).toContain(chosen.scenes.find((s) => s.type === 'reasons')!.design)
    }
  })

  it('choosing the kind of film or a design changes nothing else', () => {
    const strip = (s: Story) => ({ ...s, world: undefined, scenes: s.scenes.map((sc) => ({ ...sc, design: undefined })) })
    for (const seed of [3, 8, 21]) {
      const base = generateStory({ ...SAMPLE_INTAKE, world: 'screening' }, seed)
      const album = generateStory({ ...SAMPLE_INTAKE, world: 'scrapbook', cut: { designs: { cameraRoll: 'strip' } } }, seed)
      expect(strip(album)).toEqual(strip(base))
    }
  })

  it('lets the sender move a scene, leave one out and put it back', () => {
    const intake: Intake = { ...SAMPLE_INTAKE, world: 'scrapbook' }
    const story = generateStory(intake, 5)
    const middle = (s: Story) => types(s).filter((t) => !['ticket', 'hello', 'wish'].includes(t))
    const before = middle(story)
    expect(types(story)[0]).toBe('ticket')

    const moved = generateStory({ ...intake, cut: moveScene(story, undefined, before[2], -1) }, 5)
    expect(middle(moved)).toEqual([before[0], before[2], before[1], ...before.slice(3)])
    expect(types(moved).slice(0, 2)).toEqual(['ticket', 'hello'])
    expect(types(moved).at(-1)).toBe('wish')
    // The scene itself is the same scene: same words, same photos.
    expect(moved.scenes.find((s) => s.type === before[2])!.frames).toEqual(story.scenes.find((s) => s.type === before[2])!.frames)
    // The first scene can't move earlier, and the opening and ending can't be moved or dropped.
    expect(middle(generateStory({ ...intake, cut: moveScene(story, undefined, before[0], -1) }, 5))).toEqual(before)
    expect(types(generateStory({ ...intake, cut: { off: ['hello', 'wish', 'ticket'], order: ['wish', 'hello'] } }, 5))).toEqual(types(story))

    const without = toggleScene(undefined, 'cameraRoll', false)
    const shorter = generateStory({ ...intake, cut: without }, 5)
    expect(types(shorter)).toEqual(types(story).filter((t) => t !== 'cameraRoll'))
    expect(sceneBoard({ ...intake, cut: without }, shorter).find((r) => r.type === 'cameraRoll')).toMatchObject({ state: 'off' })
    expect(types(generateStory({ ...intake, cut: toggleScene(without, 'cameraRoll', true) }, 5))).toEqual(types(story))
  })

  it('puts a scene the sender fills in later after the one it normally follows', () => {
    const early: Intake = { ...SAMPLE_INTAKE, world: 'screening', letter: '', cut: { order: ['reasons', 'spotlight', 'memoryLane', 'redFlags', 'cameraRoll'] } }
    const later = generateStory({ ...early, letter: SAMPLE_INTAKE.letter }, 9)
    expect(types(later).slice(-2)).toEqual(['letter', 'wish'])
    expect(types(later).slice(2, 4)).toEqual(['reasons', 'spotlight'])
  })

  it('steps a scene through its designs and lists the film for the editor', () => {
    const intake: Intake = { ...SAMPLE_INTAKE, world: 'scrapbook' }
    const story = generateStory(intake, 2)
    const first = story.scenes.find((s) => s.type === 'memoryLane')!.design
    const cut = nextDesign(story, undefined, 'memoryLane')
    const second = generateStory({ ...intake, cut }, 2)
    expect(second.scenes.find((s) => s.type === 'memoryLane')!.design).not.toBe(first)
    expect(generateStory({ ...intake, cut: nextDesign(second, cut, 'memoryLane') }, 2).scenes.find((s) => s.type === 'memoryLane')!.design).toBe(first)
    // A scene with one design has nothing to step through.
    expect(nextDesign(story, undefined, 'letter')).toEqual({})

    const board = sceneBoard(intake, story)
    expect(board.map((r) => r.type)).toEqual(types(story).filter((t) => t !== 'ticket'))
    expect(board.find((r) => r.type === 'hello')).toMatchObject({ fixed: true, state: 'in' })
    expect(board.find((r) => r.type === 'memoryLane')!.designs.map((d) => d.id)).toEqual(['taped', 'clipped'])
    const thin = { ...minimal(), world: 'scrapbook' as const }
    expect(sceneBoard(thin, generateStory(thin, 2)).find((r) => r.type === 'letter')).toMatchObject({ state: 'missing', missing: 'Write a short letter (a few sentences)' })
  })

})
