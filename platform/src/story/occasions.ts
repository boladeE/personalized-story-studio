import type { EndingProp, Occasion } from './types'
import { OCCASION_IDS } from './types'

/**
 * Everything an occasion changes: the ticket, the film's first and last
 * beats, a few lines of template copy, the questions the writing flow asks,
 * and what the song is told it is for. The scenes themselves are shared.
 *
 * `{r}` is the recipient's name and `{s}` the sender's.
 */

export interface Ending {
  prop: EndingProp
  /** The scene's name on the storyboard. */
  scene: string
  /** The step's name in the writing flow. */
  step: string
  description: string
  titles: string[]
  bodies: string[]
  /** The button the viewer presses. */
  action: string
  /** The last line when the sender leaves it empty. */
  fallback: string
  question: (them: string) => string
  /** Completes "Your last line, shown once …". */
  shown: string
}

export interface OccasionDef {
  id: Occasion
  /** On menus and the home page. */
  name: string
  /** One line under the name on the home page. */
  blurb: string
  /** The corner of the ticket. */
  ticket: string
  /** What the film says under their name as it opens. */
  opening: string[]
  /** One of the labels the spotlight scene can carry. */
  star: string
  /** How the red flags scene signs off, where the default would read as romantic. */
  verdicts?: string[]
  /** A different question and heading for the reasons scene. */
  reasons?: { question: (them: string) => string; hint: string; titles: string[] }
  ending: Ending
  /** The message suggested for sending the link. */
  share: string
  song: {
    /** "a {adjective} song", "a {adjective} gift". */
    adjective: string
    /** The greeting the song may say once or twice; null when there is no occasion to name. */
    greeting: string | null
    /** Finishes "Write the lyrics of a short song …". */
    purpose: (singer: string, who: string) => string
    /** Labels the sender's last line among the details. */
    wish: (singer: string, who: string) => string
  }
}

const CANDLE: Omit<Ending, 'fallback'> = {
  prop: 'candle',
  scene: 'Make a wish',
  step: 'The wish',
  description: 'A candle to blow out, and your last line.',
  titles: ['Make a wish.', 'One more thing.', 'Close your eyes.'],
  bodies: ['Don’t tell me. Just close your eyes for a second.', 'Take a breath. Then blow.', 'Whatever it is, I hope it finds you.'],
  action: 'Blow out the candle',
  question: (them) => (them ? `What should ${them} read after blowing out the candle?` : 'What should they read after blowing out the candle?'),
  shown: 'the candle is out',
}

const SEAL: Omit<Ending, 'fallback'> = {
  prop: 'seal',
  scene: 'One last thing',
  step: 'Last line',
  description: 'A sealed note to open, and your last line.',
  titles: ['One last thing.', 'Before you go.', 'I saved this for last.'],
  bodies: ['It’s sealed. Open it when you’re ready.', 'I wrote this part down so I’d get it right.', 'Take a breath first.'],
  action: 'Open the note',
  question: (them) => (them ? `What should ${them} read when the note opens?` : 'What should they read when the note opens?'),
  shown: 'the note is open',
}

const lastWords = (singer: string, who: string) => `The last thing ${singer} wants ${who} to hear`
/** How the red flags scene signs off when the film isn't for a partner. */
export const FAMILY_VERDICTS = ['Flags noted. Wouldn’t change a thing.', 'Still my favourite person.', 'Would ignore them all again.']

const DEFS: OccasionDef[] = [
  {
    id: 'birthday',
    name: 'Birthday',
    blurb: 'Ends with a candle to blow out.',
    ticket: 'Your birthday',
    opening: ['Today is about you.', 'Get comfortable.', 'Happy birthday, {r}.'],
    star: 'The birthday person',
    ending: { ...CANDLE, fallback: 'Happy birthday, {r}. Love, {s}.' },
    share: 'I made you something for your birthday.',
    song: {
      adjective: 'birthday',
      greeting: 'happy birthday',
      purpose: (_singer, who) => `for ${who}'s birthday`,
      wish: () => 'The birthday wish',
    },
  },
  {
    id: 'anniversary',
    name: 'Anniversary',
    blurb: 'How you got here, one memory at a time.',
    ticket: 'Our anniversary',
    opening: ['Happy anniversary, {r}.', 'Here’s to us.', 'Another year of you.'],
    star: 'My favourite person',
    ending: { ...SEAL, fallback: 'Happy anniversary, {r}. Love, {s}.' },
    share: 'I made you something for our anniversary.',
    song: {
      adjective: 'anniversary',
      greeting: 'happy anniversary',
      purpose: (singer, who) => `for ${singer} and ${who}'s anniversary`,
      wish: lastWords,
    },
  },
  {
    id: 'valentine',
    name: 'Valentine’s Day',
    blurb: 'The reasons it’s them, read out one by one.',
    ticket: 'Valentine’s Day',
    opening: ['Happy Valentine’s Day, {r}.', 'This one is for you.', 'Get comfortable.'],
    star: 'My Valentine',
    ending: { ...SEAL, fallback: 'Happy Valentine’s Day, {r}. Love, {s}.' },
    share: 'I made you something for Valentine’s Day.',
    song: {
      adjective: "Valentine's Day",
      greeting: "happy Valentine's Day",
      purpose: (_singer, who) => `for ${who}, for Valentine's Day`,
      wish: lastWords,
    },
  },
  {
    id: 'just-because',
    name: 'Just because',
    blurb: 'No date needed. An ordinary Tuesday will do.',
    ticket: 'Just because',
    opening: ['No occasion. Just you.', 'This one is for you.', 'Get comfortable.'],
    star: 'My favourite person',
    ending: { ...SEAL, fallback: 'No reason, {r}. Just you. Love, {s}.' },
    share: 'I made you something, just because.',
    song: {
      adjective: 'just-because',
      greeting: null,
      purpose: (singer, who) => `for ${who}, for no occasion except that ${singer} wanted to`,
      wish: lastWords,
    },
  },
  {
    id: 'mothers-day',
    name: 'Mother’s Day',
    blurb: 'Everything she did that you noticed.',
    ticket: 'Mother’s Day',
    opening: ['Happy Mother’s Day, {r}.', 'Today is about you.', 'Get comfortable.'],
    star: 'The woman herself',
    verdicts: FAMILY_VERDICTS,
    ending: { ...SEAL, fallback: 'Happy Mother’s Day, {r}. Love, {s}.' },
    share: 'I made you something for Mother’s Day.',
    song: {
      adjective: "Mother's Day",
      greeting: "happy Mother's Day",
      purpose: (_singer, who) => `for ${who}, for Mother's Day`,
      wish: lastWords,
    },
  },
  {
    id: 'fathers-day',
    name: 'Father’s Day',
    blurb: 'The things he’d never say about himself.',
    ticket: 'Father’s Day',
    opening: ['Happy Father’s Day, {r}.', 'Today is about you.', 'Get comfortable.'],
    star: 'The man himself',
    verdicts: FAMILY_VERDICTS,
    ending: { ...SEAL, fallback: 'Happy Father’s Day, {r}. Love, {s}.' },
    share: 'I made you something for Father’s Day.',
    song: {
      adjective: "Father's Day",
      greeting: "happy Father's Day",
      purpose: (_singer, who) => `for ${who}, for Father's Day`,
      wish: lastWords,
    },
  },
  {
    id: 'thank-you',
    name: 'Thank you',
    blurb: 'For the thing you never thanked them for properly.',
    ticket: 'A thank-you',
    opening: ['Thank you, {r}.', 'I never said this properly.', 'Get comfortable.'],
    star: 'The reason for all this',
    verdicts: FAMILY_VERDICTS,
    reasons: {
      question: (them) => (them ? `What are you thanking ${them} for?` : 'What are you thanking them for?'),
      hint: 'Shown one at a time. Two or more. The small, specific things count most.',
      titles: ['What I’m thanking you for.', 'In no particular order.', 'Just a few of them.'],
    },
    ending: { ...SEAL, fallback: 'Thank you, {r}. Love, {s}.' },
    share: 'I made you something to say thank you.',
    song: {
      adjective: 'thank-you',
      greeting: 'thank you',
      purpose: (_singer, who) => `to thank ${who}`,
      wish: lastWords,
    },
  },
  {
    id: 'congratulations',
    name: 'Congratulations',
    blurb: 'A graduation, a new job, a finish line. On the record.',
    ticket: 'You did it',
    opening: ['You did it, {r}.', 'Congratulations, {r}.', 'Look at you.'],
    star: 'The one who did it',
    verdicts: FAMILY_VERDICTS,
    reasons: {
      question: (them) => (them ? `What makes you proud of ${them}?` : 'What makes you proud of them?'),
      hint: 'Shown one at a time. Two or more. What you watched them do counts more than the result.',
      titles: ['Why I’m proud of you.', 'In no particular order.', 'Just a few reasons.'],
    },
    ending: { ...SEAL, fallback: 'Congratulations, {r}. Love, {s}.' },
    share: 'I made you something to say congratulations.',
    song: {
      adjective: 'congratulations',
      greeting: 'congratulations',
      purpose: (_singer, who) => `to congratulate ${who}`,
      wish: lastWords,
    },
  },
  {
    id: 'missing-you',
    name: 'Missing you',
    blurb: 'For someone who is a long way away.',
    ticket: 'Until I see you',
    opening: ['I miss you, {r}.', 'Wish you were here.', 'Until I see you.'],
    star: 'The one I miss',
    reasons: {
      question: (them) => (them ? `What do you miss about ${them}?` : 'What do you miss about them?'),
      hint: 'Shown one at a time. Two or more. The everyday things are the ones that land.',
      titles: ['What I miss.', 'In no particular order.', 'Just a few things.'],
    },
    ending: { ...SEAL, fallback: 'I miss you, {r}. Love, {s}.' },
    share: 'I made you something because I miss you.',
    song: {
      adjective: 'missing-you',
      greeting: 'I miss you',
      purpose: (_singer, who) => `for ${who}, who is far away and missed`,
      wish: lastWords,
    },
  },
]

const BY_ID = new Map(DEFS.map((def) => [def.id, def]))

/** Every occasion, in the order they are offered. */
export const OCCASIONS: OccasionDef[] = OCCASION_IDS.map((id) => BY_ID.get(id)!)

/** Falls back to the birthday for anything unknown, which is what older gifts are. */
export const occasionOf = (id: unknown): OccasionDef => BY_ID.get(id as Occasion) ?? BY_ID.get('birthday')!
