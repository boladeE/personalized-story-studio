import { describe, expect, it } from 'vitest'
import { cleanDirection, cleanStoredDirection, directionLine, directLocally, DIRECTED_WORLDS } from '../src/story/direction'
import type { DirectionBrief } from '../src/story/direction'
import { generateStory } from '../src/story/generate'
import { emptyNotes } from '../src/story/notes'
import { SAMPLE_INTAKE } from '../src/story/sample'
import type { Direction } from '../src/story/types'
import { parseIntake } from '../src/story/validate'

process.env.MUSIC_PROVIDER = 'demo'
const { completeDirection, direct, directBrief } = await import('../src/server/direct')

const brief = (over: Partial<DirectionBrief['notes']> = {}, rest: Partial<DirectionBrief> = {}): DirectionBrief => ({
  occasion: 'birthday',
  recipient: 'Zara',
  photos: 2,
  letter: false,
  notes: { ...emptyNotes(), ...over },
  ...rest,
})
const TEASING = brief({ habits: ['Steals the duvet', 'Never finishes her tea', 'Says five minutes'], reasons: ['You remember the small things'], memories: [{ title: 'One drink', story: 'We were meant to stay for one drink.' }] })
const MOMENTS = brief({ memories: [{ title: 'One drink', story: 'We were meant to stay for one drink.' }, { title: 'Moving day', story: 'The lift broke.' }], reasons: ['You carry the heavy end', 'You listen'] })

describe('directing a film by rule', () => {
  it('makes a note that teases into a mixtape, with the jokes before the sincere scenes', () => {
    const plan = directLocally(TEASING)
    expect(plan).toMatchObject({ world: 'mixtape', because: 'teasing', look: 'screening' })
    expect(plan.designs).toMatchObject({ redFlags: 'shout', reasons: 'nowplaying' })
    expect(plan.order.indexOf('redFlags')).toBeLessThan(plan.order.indexOf('reasons'))
  })

  it('makes a note told in moments into a scrapbook', () => {
    expect(directLocally(MOMENTS)).toMatchObject({ world: 'scrapbook', because: 'memories' })
    expect(directLocally(brief({ reasons: ['a', 'b', 'c'] }, { photos: 6 }))).toMatchObject({ world: 'scrapbook', because: 'photos', designs: { cameraRoll: 'strip' } })
  })

  it('lets a long list build on one screen', () => {
    const many = directLocally(brief({ habits: ['a', 'b', 'c', 'd', 'e'], reasons: ['a', 'b', 'c', 'd'] }))
    expect(many.designs).toMatchObject({ redFlags: 'tracklist', reasons: 'liner' })
  })

  it('still directs when there is almost nothing to go on, and only ever as a kind of film it directs', () => {
    const plan = directLocally(brief())
    expect(plan.because).toBe('short')
    for (const b of [brief(), TEASING, MOMENTS]) expect(DIRECTED_WORLDS).toContain(directLocally(b).world)
  })

  it('says why in a sentence the studio wrote, not a model', () => {
    expect(directionLine({ world: 'mixtape', because: 'teasing' }, 'Zara')).toBe('The studio made it a mixtape, because so much of what you wrote is the way Zara is, habits and all.')
    expect(directionLine({ world: 'scrapbook', because: 'memories' }, 'Zara')).toBe('The studio made it a scrapbook, because you told it in moments worth keeping.')
  })
})

describe('what a director may say', () => {
  it('keeps only kinds of film, colours, designs and scenes the studio has', () => {
    const plan = cleanDirection({ world: 'mixtape', look: 'neon', designs: { redFlags: 'tracklist', reasons: 'bunting', nonsense: 'x' }, order: ['letter', 'wish', 'letter', 'redFlags', 7], because: 'vibes', extra: '<script>' })
    expect(plan).toEqual({ world: 'mixtape', look: 'garden', designs: { redFlags: 'tracklist' }, order: ['letter', 'redFlags'], because: 'tender' })
  })

  it('is no direction at all without a kind of film it knows', () => {
    expect(cleanDirection({ world: 'hologram' })).toBeNull()
    expect(cleanDirection(null)).toBeNull()
    expect(cleanDirection({ world: 'screening' }, DIRECTED_WORLDS)).toBeNull()
  })

  it('fills in what a model left out from the rules, so every scene has a design and a place', () => {
    const plan = completeDirection({ world: 'mixtape', look: 'paper', designs: { redFlags: 'tracklist' }, order: ['reasons'], because: 'teasing' }, TEASING)!
    expect(plan.designs).toMatchObject({ redFlags: 'tracklist', reasons: 'nowplaying', spotlight: 'poster' })
    expect([...plan.order].sort()).toEqual(['cameraRoll', 'letter', 'memoryLane', 'reasons', 'redFlags', 'spotlight'])
    // A model that picks a different kind of film from the rule still gets every scene designed for the film it picked.
    const other = completeDirection({ world: 'scrapbook', look: 'garden', designs: { spotlight: 'polaroid' }, order: [], because: 'tender' }, TEASING)!
    expect(other.designs).toEqual({ spotlight: 'polaroid', memoryLane: 'taped', redFlags: 'stickies', reasons: 'bunting', cameraRoll: 'pile' })
    expect(completeDirection({ world: 'screening' }, TEASING)).toBeNull()
  })

  it('keeps the introduction first and the letter last, wherever a model puts them', () => {
    const plan = completeDirection({ world: 'scrapbook', look: 'garden', designs: {}, order: ['redFlags', 'letter', 'memoryLane', 'reasons', 'spotlight', 'cameraRoll'], because: 'tender' }, TEASING)!
    expect(plan.order).toEqual(['spotlight', 'redFlags', 'memoryLane', 'reasons', 'cameraRoll', 'letter'])
  })

  it('tells the model what the studio has and what was written, and never a letter or a photo', () => {
    const text = directBrief({ ...TEASING, letter: true, photos: 5 })
    expect(text).toContain('mixtape ("The Mixtape")')
    expect(text).toContain('tracklist ("Track list")')
    expect(text).toContain('Steals the duvet')
    expect(text).toContain('Photos: 5. A letter: yes.')
    expect(text).not.toContain('screening ("The Screening")')
  })

  it('directs by rule when the model is off', async () => {
    const { direction, by } = await direct(TEASING)
    expect(by).toBe('rule')
    expect(direction).toEqual(directLocally(TEASING))
  })
})

describe('a directed film', () => {
  const direction: Direction = { seed: 11, world: 'mixtape', look: 'garden', designs: { redFlags: 'tracklist', reasons: 'liner' }, order: ['letter', 'redFlags', 'reasons', 'memoryLane', 'cameraRoll', 'spotlight'], because: 'teasing' }
  const intake = { ...SAMPLE_INTAKE, look: 'surprise' as const, world: undefined, direction }
  const middle = (seed: number, from = intake) => generateStory(from, seed).scenes.map((s) => s.type).filter((t) => !['ticket', 'hello', 'wish'].includes(t))

  it('is made the way the studio directed, for the version it directed', () => {
    const story = generateStory(intake, 11)
    expect(story).toMatchObject({ world: 'mixtape', look: 'garden' })
    expect(story.scenes.find((s) => s.type === 'redFlags')?.design).toBe('tracklist')
    expect(story.scenes.find((s) => s.type === 'reasons')?.design).toBe('liner')
    expect(middle(11)).toEqual(direction.order)
  })

  it('says the same words whichever way it is directed', () => {
    const said = (seed: number, from: typeof intake | typeof SAMPLE_INTAKE) => generateStory(from, seed).scenes.flatMap((s) => s.frames.flatMap((f) => ('text' in f ? [f.text] : [])))
    expect(said(11, intake).sort()).toEqual(said(11, { ...SAMPLE_INTAKE, look: 'surprise' }).sort())
  })

  it('is drawn afresh for another version', () => {
    const drawn = (seed: number) => generateStory({ ...SAMPLE_INTAKE, look: 'surprise', world: undefined }, seed)
    for (const seed of [3, 12, 99]) {
      expect(generateStory(intake, seed).world).toBe(drawn(seed).world)
      expect(generateStory(intake, seed).look).toBe(drawn(seed).look)
    }
  })

  it('gives way to anything the sender chooses', () => {
    expect(generateStory({ ...intake, world: 'scrapbook' }, 11).world).toBe('scrapbook')
    expect(generateStory({ ...intake, look: 'paper' }, 11).look).toBe('paper')
    expect(generateStory({ ...intake, cut: { designs: { redFlags: 'shout' } } }, 11).scenes.find((s) => s.type === 'redFlags')?.design).toBe('shout')
    expect(middle(11, { ...intake, cut: { order: ['reasons', 'redFlags'] } }).slice(0, 2)).not.toEqual(direction.order.slice(0, 2))
  })

  it('travels with the gift, and anything in it the studio does not know is dropped', () => {
    const stored = parseIntake({ ...SAMPLE_INTAKE, direction: { ...direction, designs: { ...direction.designs, redFlags: 'laser' }, note: 'x' } })
    expect(stored.ok && stored.intake.direction).toEqual({ ...direction, designs: { reasons: 'liner' } })
    const bad = parseIntake({ ...SAMPLE_INTAKE, direction: { world: 'hologram', seed: 1 } })
    expect(bad.ok && 'direction' in bad.intake).toBe(false)
    expect(cleanStoredDirection({ ...direction, seed: 'soon' })).toBeNull()
  })
})
