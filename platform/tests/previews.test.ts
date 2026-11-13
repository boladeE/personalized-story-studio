import { describe, expect, it } from 'vitest'
import { previewFor } from '../src/film/previews'
import { emptyIntake, SAMPLE_INTAKE } from '../src/story/sample'

const focus = { memory: 0, habit: 0, reason: 0 }
const shotOf = (p: ReturnType<typeof previewFor>) => (p.content.kind === 'shot' ? p.content.shot : null)

describe('scene previews while writing', () => {
  it('shows guidance, not made-up content, while a step is empty', () => {
    const empty = emptyIntake()
    for (const step of ['who', 'photos', 'spotlight', 'memories', 'habits', 'reasons', 'letter', 'wish', 'look'] as const) {
      expect(previewFor(step, empty, focus).ghost, step).toBe(true)
    }
  })

  it('puts the sender’s own words in the scene', () => {
    const habits = shotOf(previewFor('habits', SAMPLE_INTAKE, { ...focus, habit: 1 }))
    expect(habits).toMatchObject({ kind: 'flag', text: SAMPLE_INTAKE.habits[1], n: 2, total: 4 })
    const memory = shotOf(previewFor('memories', SAMPLE_INTAKE, { ...focus, memory: 2 }))
    expect(memory).toMatchObject({ kind: 'photo', title: 'That evening by the water.', photo: { id: 'p-beach' } })
    expect(previewFor('who', SAMPLE_INTAKE, focus)).toMatchObject({ ghost: false, content: { kind: 'ticket', recipient: 'Zara' } })
  })

  it('falls back to the last written row when the focused one is empty', () => {
    const intake = { ...emptyIntake(), reasons: ['You listen', '', ''] }
    expect(shotOf(previewFor('reasons', intake, { ...focus, reason: 2 }))).toMatchObject({ kind: 'reason', text: 'You listen', n: 1 })
  })

  it('uses the film’s own fallback for an empty wish once both names are known', () => {
    const intake = { ...emptyIntake(), sender: 'Ada', recipient: 'Kemi' }
    const wish = previewFor('wish', intake, focus)
    expect(wish.ghost).toBe(false)
    expect(shotOf(wish)).toMatchObject({ kind: 'reveal', words: 'Happy birthday, Kemi. Love, Ada.' })
  })
})
