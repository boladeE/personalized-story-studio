import type { Frame, Intake, Memory, Mood, Photo, PhotoLayout } from './types'
import type { Rng } from './rng'

/**
 * The scene library. Each scene type is a designed beat: it declares what it
 * needs from the sender and how to turn that into frames. Fixed wording here is
 * template copy written by people; anything personal comes from the intake.
 */

export interface BuildContext {
  intake: Intake
  rng: Rng
  /** Hands out photos so the same photo is not repeated when others are available. */
  takePhoto(): Photo | undefined
  photoById(id: string): Photo | undefined
  unusedPhotos(): Photo[]
}

export interface SceneDef {
  type: string
  name: string
  mood: Mood
  /** Shown on the storyboard while the sender fills in details. */
  description: string
  /** null when the intake can fill this scene, otherwise what is still missing. */
  missing(intake: Intake): string | null
  build(ctx: BuildContext): Frame[]
}

export const clean = (values: string[]) => values.map((v) => v.trim()).filter(Boolean)
export const completeMemories = (intake: Intake): Memory[] =>
  intake.memories.filter((m) => m.title.trim() && m.story.trim())

const fill = (text: string, intake: Intake) =>
  text.replaceAll('{r}', intake.recipient.trim()).replaceAll('{s}', intake.sender.trim())

const say = (ctx: BuildContext, options: string[]) => fill(ctx.rng.pick(options), ctx.intake)

function countMissing(have: number, need: number, singular: string, plural: string) {
  const left = need - have
  return left <= 0 ? null : `Add ${left} more ${left === 1 ? singular : plural}`
}

const ticket: SceneDef = {
  type: 'ticket',
  name: 'The invitation',
  mood: 'warm',
  description: 'A ticket with their name on it. Tearing it starts the film and the music.',
  missing: (i) => (i.recipient.trim() ? null : 'Add their name'),
  build: ({ intake }) => [{ kind: 'ticket', recipient: intake.recipient.trim(), occasion: 'Your birthday' }],
}

const hello: SceneDef = {
  type: 'hello',
  name: 'Before we begin',
  mood: 'warm',
  description: 'A short opening card from you to them.',
  missing: (i) => (i.sender.trim() && i.recipient.trim() ? null : 'Add both names'),
  build: (ctx) => [
    {
      kind: 'title',
      kicker: fill('For {r}. From {s}.', ctx.intake),
      title: say(ctx, ['Today is about you.', 'Get comfortable.', 'Happy birthday, {r}.']),
      body: say(ctx, [
        'A few things I have been meaning to say properly.',
        'Sit back. This one plays by itself.',
        'Some of my favourite little things, all in one place.',
      ]),
    },
  ],
}

const spotlight: SceneDef = {
  type: 'spotlight',
  name: 'The main character',
  mood: 'warm',
  description: 'Their best photo, and the thing you love most about how they are.',
  missing: (i) => {
    if (!i.spotlight.trim() && !i.photos.length) return 'Add a photo and what you love about how they are'
    if (!i.photos.length) return 'Add a photo'
    if (!i.spotlight.trim()) return 'Write what you love about how they are'
    return null
  },
  build: (ctx) => {
    const photo = ctx.takePhoto()
    if (!photo) return []
    return [
      {
        kind: 'photo',
        photo,
        kicker: say(ctx, ['The main character', 'Exhibit A', 'The birthday person']),
        title: say(ctx, ['There’s {r}.', 'Look who it is.', '{r}, everybody.']),
        body: ctx.intake.spotlight.trim(),
        layout: ctx.rng.pick<PhotoLayout>(['left', 'right']),
      },
    ]
  },
}

const memoryLane: SceneDef = {
  type: 'memoryLane',
  name: 'Memory lane',
  mood: 'tender',
  description: 'Your memories, one at a time, each with its own photo.',
  missing: (i) => countMissing(completeMemories(i).length, 2, 'memory', 'memories'),
  build: (ctx) => {
    const memories = completeMemories(ctx.intake).slice(0, 5)
    const frames: Frame[] = [
      {
        kind: 'title',
        kicker: 'Memory lane',
        title: say(ctx, ['Remember when?', 'A few of our moments.', 'How we got here.']),
      },
    ]
    let side: PhotoLayout = ctx.rng.pick(['left', 'right'])
    memories.forEach((memory, index) => {
      const photo = (memory.photoId && ctx.photoById(memory.photoId)) || ctx.takePhoto()
      const kicker = `${index + 1} of ${memories.length}`
      if (!photo) {
        frames.push({ kind: 'title', kicker, title: memory.title.trim(), body: memory.story.trim() })
        return
      }
      const layout: PhotoLayout = ctx.rng.next() < 0.25 ? 'wide' : side
      side = side === 'left' ? 'right' : 'left'
      frames.push({ kind: 'photo', photo, kicker, title: memory.title.trim(), body: memory.story.trim(), layout })
    })
    return frames
  },
}

const redFlags: SceneDef = {
  type: 'redFlags',
  name: 'Red flags',
  mood: 'playful',
  description: 'Their funniest habits, presented as very serious red flags.',
  missing: (i) => countMissing(clean(i.habits).length, 3, 'habit', 'habits'),
  build: (ctx) => {
    const habits = clean(ctx.intake.habits).slice(0, 7)
    return [
      {
        kind: 'title',
        kicker: 'An investigation',
        title: say(ctx, ['A few red flags about {r}.', 'Some concerns have been raised.', 'Before we go on: the red flags.']),
        body: say(ctx, ['For the record.', 'Documented with love.', 'Noted. Filed. Ignored.']),
      },
      ...habits.map<Frame>((text, index) => ({ kind: 'item', marker: 'flag', kicker: 'Red flag', text, index, total: habits.length })),
      {
        kind: 'title',
        kicker: 'The verdict',
        title: say(ctx, ['Flags noted. Staying anyway.', 'Still my favourite person.', 'Would ignore them all again.']),
      },
    ]
  },
}

const reasons: SceneDef = {
  type: 'reasons',
  name: 'Reasons',
  mood: 'tender',
  description: 'The reasons you love them, revealed one by one.',
  missing: (i) => countMissing(clean(i.reasons).length, 3, 'reason', 'reasons'),
  build: (ctx) => {
    const list = clean(ctx.intake.reasons).slice(0, 10)
    return [
      {
        kind: 'title',
        kicker: 'For the avoidance of doubt',
        title: say(ctx, ['Reasons, in no particular order.', 'Why it’s you.', 'Just a few reasons.']),
      },
      ...list.map<Frame>((text, index) => ({ kind: 'item', marker: 'reason', kicker: `Reason ${index + 1}`, text, index, total: list.length })),
    ]
  },
}

const cameraRoll: SceneDef = {
  type: 'cameraRoll',
  name: 'The camera roll',
  mood: 'playful',
  description: 'A spread of your photos with their captions.',
  missing: (i) => countMissing(i.photos.length, 3, 'photo', 'photos'),
  build: (ctx) => {
    const unused = ctx.unusedPhotos()
    const rest = ctx.intake.photos.filter((p) => !unused.includes(p))
    const photos = [...ctx.rng.shuffle(unused), ...ctx.rng.shuffle(rest)].slice(0, 6)
    return [
      {
        kind: 'montage',
        kicker: say(ctx, ['The camera roll', 'Evidence', 'From the archives']),
        title: say(ctx, ['Look at all this.', 'Proof.', 'The receipts.']),
        photos,
      },
    ]
  },
}

const letter: SceneDef = {
  type: 'letter',
  name: 'A letter',
  mood: 'tender',
  description: 'Your letter, set like a real one.',
  missing: (i) => (i.letter.trim().length >= 40 ? null : 'Write a short letter (a few sentences)'),
  build: (ctx) => [
    {
      kind: 'letter',
      title: say(ctx, ['{r},', 'Dear {r},', 'To {r},']),
      paragraphs: ctx.intake.letter.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean),
      signoff: ctx.intake.sender.trim(),
    },
  ],
}

const wish: SceneDef = {
  type: 'wish',
  name: 'Make a wish',
  mood: 'glow',
  description: 'A candle to blow out, and your last line.',
  missing: (i) => (i.sender.trim() && i.recipient.trim() ? null : 'Add both names'),
  build: (ctx) => [
    {
      kind: 'wish',
      title: say(ctx, ['Make a wish.', 'One more thing.', 'Close your eyes.']),
      body: say(ctx, [
        'Don’t tell me. Just close your eyes for a second.',
        'Take a breath. Then blow.',
        'Whatever it is, I hope it finds you.',
      ]),
      reveal: ctx.intake.wish.trim() || fill('Happy birthday, {r}. Love, {s}.', ctx.intake),
    },
  ],
}

export const SCENES: Record<string, SceneDef> = Object.fromEntries(
  [ticket, hello, spotlight, memoryLane, redFlags, reasons, cameraRoll, letter, wish].map((s) => [s.type, s]),
)

/** A story skeleton: ordered slots. Every fillable scene in a slot is used; `shuffle` varies their order. */
export interface Slot {
  candidates: string[]
  shuffle?: boolean
}

export const SKELETONS: Record<Intake['occasion'], Slot[]> = {
  birthday: [
    { candidates: ['ticket'] },
    { candidates: ['hello'] },
    { candidates: ['spotlight'] },
    { candidates: ['memoryLane'] },
    { candidates: ['redFlags', 'cameraRoll', 'reasons'], shuffle: true },
    { candidates: ['letter'] },
    { candidates: ['wish'] },
  ],
}
