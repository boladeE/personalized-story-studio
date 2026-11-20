import { describe, expect, it } from 'vitest'
import { cleanAnswers, cleanFollowups, followupsLocally, sortLocallyWithAnswers, withAnswers } from '../src/story/followups'
import { isTheirWords } from '../src/story/notes'

process.env.MUSIC_PROVIDER = 'demo'
const { followups, followupBrief } = await import('../src/server/followups')
const { outlineBrief, outlineFilm } = await import('../src/server/outline')
const asked = (answered: Parameters<typeof outlineBrief>[0]['answered'] = []) => ({ text: NOTE, sender: 'Tobi', recipient: 'Zara', answered, occasion: 'birthday' as const, photos: 0, letter: false })

const NOTE =
  'Moving day. The lift broke, and you carried the sofa up five floors arguing about the angle. You always steal the duvet, then ask why I am cold. You never finish your tea. I love you because you remember the small things I mention once.'

describe('the studio’s follow-up questions', () => {
  it('keeps only questions that hang on words the sender wrote', () => {
    const kept = cleanFollowups(
      {
        questions: [
          { quote: 'You always steal the duvet', question: 'What does she say when you complain' },
          { quote: 'You proposed in Paris', question: 'What did she say?' },
          { quote: 'tea', question: 'Which tea?' },
          { quote: '“You never finish your tea.”', question: 'Where do you find the cups?' },
          { quote: 'You always steal the duvet', question: 'Again?' },
          { quote: 'you carried the sofa up five floors', question: 'Who won the argument about the angle?' },
          { quote: 'you remember the small things I mention once', question: 'What is one small thing?' },
        ],
      },
      NOTE,
    )
    expect(kept).toEqual([
      { quote: 'You always steal the duvet', question: 'What does she say when you complain?' },
      { quote: 'You never finish your tea.', question: 'Where do you find the cups?' },
      { quote: 'you carried the sofa up five floors', question: 'Who won the argument about the angle?' },
    ])
    expect(cleanFollowups('nonsense', NOTE)).toEqual([])
  })

  it('asks plainer questions by rule: one about a habit, one about a moment, one about a reason', () => {
    expect(followupsLocally(NOTE, 'Zara')).toEqual([
      { quote: 'The lift broke, and you carried the sofa up five floors arguing about the angle.', question: 'What happened next?' },
      { quote: 'You always steal the duvet, then ask why I am cold.', question: 'What does Zara say when you bring it up?' },
      { quote: 'I love you because you remember the small things I mention once.', question: 'What is one time you noticed that?' },
    ])
    expect(followupsLocally('Great.', 'Zara')).toEqual([])
  })

  it('asks by rule when the model is off, and tells a model to ask only about the note', async () => {
    const { questions, by } = await followups(NOTE, 'Tobi', 'Zara')
    expect(by).toBe('rule')
    expect(questions).toHaveLength(3)
    const brief = followupBrief(NOTE, 'Tobi', 'Zara')
    expect(brief).toContain('copied exactly as written')
    expect(brief).toContain('Ask only about what is in the note')
    expect(brief).toContain(NOTE)
  })
})

describe('answers go into the film as the sender’s own words', () => {
  const answered = [
    { quote: 'You always steal the duvet, then ask why I am cold.', question: 'What does Zara say when you bring it up?', answer: '“You run hot anyway.” Every time.' },
    { quote: 'The lift broke, and you carried the sofa up five floors arguing about the angle.', question: 'What happened next?', answer: 'We ate noodles on the floor because the table was still in the van.' },
  ]

  it('keeps only answers that say something', () => {
    expect(cleanAnswers([...answered, { quote: 'x y z', question: 'q?', answer: '   ' }, { answer: 'no quote' }, 7])).toEqual(answered)
    expect(withAnswers(' a ', answered)).toBe(`a\n${answered[0].answer}\n${answered[1].answer}`)
  })

  it('joins each answer to the part of the note it was about', async () => {
    const notes = sortLocallyWithAnswers(NOTE, answered)
    expect(notes.habits[0]).toBe('You always steal the duvet, then ask why I am cold. “You run hot anyway.” Every time.')
    expect(notes.habits[1]).toBe('You never finish your tea.')
    expect(notes.memories[0].story).toContain('We ate noodles on the floor because the table was still in the van.')
    // With the model off, the server outlines the film from the same sorting: the answer is in the scene it was about.
    const { outline, by } = await outlineFilm(asked(answered))
    expect(by).toBe('rule')
    expect(outline.flatMap((c) => c.lines)).toContain(notes.habits[0])
  })

  it('never lets a question, or anything else the sender did not write, into the film', () => {
    const notes = sortLocallyWithAnswers(NOTE, answered)
    const written = withAnswers(NOTE, answered)
    const pieces = [...notes.habits, ...notes.reasons, ...notes.memories.flatMap((m) => [m.title, m.story])]
    for (const piece of pieces) expect(isTheirWords(piece, written)).toBe(true)
    expect(pieces.join(' ')).not.toContain('What happened next')
    expect(pieces.join(' ')).not.toContain('bring it up')
  })

  it('tells the outlining model the answers are the sender’s words and the questions are not', () => {
    const brief = outlineBrief(asked(answered))
    expect(brief).toContain('“You run hot anyway.” Every time.')
    expect(brief).toContain('must never appear')
    expect(outlineBrief(asked())).not.toContain('was then asked')
  })
})
