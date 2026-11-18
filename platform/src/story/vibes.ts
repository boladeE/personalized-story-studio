import type { Intake } from './types'

/** Song styles a sender can ask for. */
export const VIBES = [
  {
    id: 'afro-soul',
    name: 'Warm Afro-soul',
    feel: 'Soft keys and talking drum, unhurried',
    prompt: 'warm Afro-soul with soft Rhodes keys, gentle talking drum and shakers, mid-tempo around 96 BPM',
  },
  {
    id: 'highlife',
    name: 'Highlife guitar',
    feel: 'Bright guitars, light horns, an easy sway',
    prompt: 'bright Nigerian highlife with interlocking clean guitars, light horns and an easy groove around 112 BPM',
  },
  {
    id: 'piano',
    name: 'Soft piano',
    feel: 'Piano and strings, slow and tender',
    prompt: 'tender solo piano with a light string pad, slow and warm, around 72 BPM',
  },
  {
    id: 'lofi-rnb',
    name: 'Lo-fi R&B',
    feel: 'Dusty drums and warm bass, late-night mood',
    prompt: 'mellow lo-fi R&B with dusty drums, warm bass and soft electric piano, around 84 BPM',
  },
] as const

export type Vibe = (typeof VIBES)[number]
export type VibeId = Vibe['id']

export const vibeById = (id: string) => VIBES.find((v) => v.id === id)

/** A short instrumental taste of each style, so a tune can be picked by ear. */
export const tunePreview = (id: VibeId) => `/tunes/${id}.mp3`

/** Instrumental: nothing about the people is sent to the music model. */
export function songPrompt(vibe: Vibe) {
  return [
    `An original instrumental piece: ${vibe.prompt}.`,
    'It scores a short, affectionate birthday surprise: joyful but tender, with room for words on screen.',
    'No vocals, no lyrics, no spoken words. Do not imitate any existing song or artist.',
    'About two minutes long with a gentle intro and a clean ending.',
  ].join(' ')
}

/* ---------- A sung song about the person ---------- */

/**
 * What a sung song is written from. Every line is the sender's own; this is
 * the only personal text that leaves the studio for the music model. The
 * letter and photo captions are never included.
 */
export interface SongDetails {
  recipient: string
  sender: string
  reasons: string[]
  habits: string[]
  moments: string[]
  wish: string
}

export const SONG_LIMITS = { name: 60, line: 200, moment: 320, wish: 400, reasons: 3, habits: 3, moments: 2 } as const

/** One line, no control characters or double quotes, capped. */
function tidy(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f\u007f"“”]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim()
}

function lines(value: unknown, count: number, max: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => tidy(v, max))
    .filter(Boolean)
    .slice(0, count)
}

/** Clean and cap details that arrive from the browser. Null without a name to sing. */
export function parseSongDetails(raw: unknown): SongDetails | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const recipient = tidy(r.recipient, SONG_LIMITS.name)
  if (!recipient) return null
  return {
    recipient,
    sender: tidy(r.sender, SONG_LIMITS.name),
    reasons: lines(r.reasons, SONG_LIMITS.reasons, SONG_LIMITS.line),
    habits: lines(r.habits, SONG_LIMITS.habits, SONG_LIMITS.line),
    moments: lines(r.moments, SONG_LIMITS.moments, SONG_LIMITS.moment),
    wish: tidy(r.wish, SONG_LIMITS.wish),
  }
}

/** The parts of an intake a song is written from. */
export function songDetails(intake: Intake): SongDetails | null {
  return parseSongDetails({
    recipient: intake.recipient,
    sender: intake.sender,
    reasons: intake.reasons,
    habits: intake.habits,
    moments: intake.memories.map((m) => [m.title.trim(), m.story.trim()].filter(Boolean).join(' ')),
    wish: intake.wish,
  })
}

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join('\n')

/** A sung birthday song for one person, written only from the sender's details. */
export function sungPrompt(vibe: Vibe, d: SongDetails) {
  const singer = d.sender ? `The singer is ${d.sender}, singing directly to ${d.recipient}.` : `The singer sings directly to ${d.recipient}.`
  const gift = d.sender ? `It is a birthday gift from ${d.sender} to ${d.recipient}.` : `It is a birthday gift for ${d.recipient}.`
  const parts = [
    `An original birthday song with a sung lead vocal: ${vibe.prompt}.`,
    `${gift} ${singer} Sing the name "${d.recipient}" clearly in every chorus, and say "happy birthday".`,
    'Write the lyrics only from the true details below, in plain, affectionate, slightly teasing everyday English. Do not add places, events, nicknames or facts that are not listed.',
  ]
  if (d.reasons.length) parts.push(`What ${d.sender || 'the singer'} loves about ${d.recipient}:\n${bullets(d.reasons)}`)
  if (d.habits.length) parts.push(`${d.recipient}'s funny habits:\n${bullets(d.habits)}`)
  if (d.moments.length) parts.push(`Moments they shared:\n${bullets(d.moments)}`)
  if (d.wish) parts.push(`The birthday wish for ${d.recipient}: ${d.wish}`)
  if (!d.reasons.length && !d.habits.length && !d.moments.length && !d.wish) {
    parts.push('No other details were given, so keep the lyrics to warm birthday wishes and the name.')
  }
  parts.push(
    'Keep the vocal clear and in front so every word is easy to hear. Structure: short intro, verse, chorus, verse, chorus, brief outro. About two minutes, with a clean ending. Do not imitate any existing song or artist.',
  )
  return parts.join('\n')
}

/* ---------- Lyrics the studio writes first, and the sender can edit ---------- */

export const LYRIC_LIMITS = { lines: 44, line: 110, title: 60 } as const

const SECTION_NAMES = ['intro', 'verse', 'pre-chorus', 'chorus', 'bridge', 'outro'] as const
const sectionTag = (line: string) => {
  const inner = /^\[(.+)\]$/.exec(line)?.[1]
  if (!inner) return null
  const name = inner.toLowerCase().replace(/[\s\d]+$/, '').replace(/\s+/g, '-')
  if (!(SECTION_NAMES as readonly string[]).includes(name)) return ''
  return `[${name.charAt(0).toUpperCase()}${name.slice(1)}]`
}

/**
 * Google's music model refuses a request that quotes an existing song, and
 * the old birthday song's opening line is the one a birthday lyric trips on.
 */
const REFUSED_LINE = /happy\s+birthday\s+to\s+(you|ya)/i
export const hasRefusedLine = (lyrics: string) => REFUSED_LINE.test(lyrics)

/**
 * Clean lyrics that arrive from the browser or the writing model: one sung
 * line per row, `[Verse]`-style tags on their own rows, capped in size.
 */
export function tidyLyrics(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const out: string[] = []
  let sung = 0
  for (const row of raw.replace(/\r/g, '').split('\n')) {
    const line = row.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('')
      continue
    }
    const tag = sectionTag(line)
    if (tag === '') continue
    if (tag) {
      if (out.length && out[out.length - 1] !== '') out.push('')
      out.push(tag)
      continue
    }
    if (sung >= LYRIC_LIMITS.lines) break
    const words = line.replace(/[[\]]/g, '').slice(0, LYRIC_LIMITS.line).trim()
    if (!words) continue
    out.push(words)
    sung++
  }
  while (out.length && (out[out.length - 1] === '' || /^\[.+\]$/.test(out[out.length - 1]))) out.pop()
  return sung ? out.join('\n') : ''
}

export const tidyTitle = (raw: unknown) => tidy(raw, LYRIC_LIMITS.title).replace(/[[\]]/g, '')

/** How the words are written: a told story with jokes, or an understated track built on a feeling. */
export const LYRIC_TONES = ['smooth', 'story'] as const
export type LyricTone = (typeof LYRIC_TONES)[number]
export const isLyricTone = (value: unknown): value is LyricTone => (LYRIC_TONES as readonly unknown[]).includes(value)

/**
 * Worked examples for the lyric writer, about two invented friends. They show
 * the standard far better than rules alone do. Both use the same details, so
 * the difference between the tones is plain.
 */
const EXAMPLE_DETAILS = `Details: Maya to her friend Sam. Loves: "You pick up on the first ring, even at 2 a.m."; "You tell me the truth when everyone else is being nice". Habits: "Says 'five minutes' and shows up an hour later"; "Borrows my charger and it never comes home". Moment: "The night my car died on the bridge. You came with soup in a flask and jump leads you didn't know how to use." Wish: "A year that finally gives you back what you give everyone else."`

const STORY_EXAMPLE = `An example of the standard, written for two other people. Study how it turns details into lines; do not reuse its hook, its rhymes or any of its wording.

${EXAMPLE_DETAILS}

First Ring

[Verse 1]
My car died on the bridge that night
I called you some time after two
You came with soup in a flask
And jump leads you could not use

[Pre-Chorus]
Other people let the phone ring out
With you I never have to wonder

[Chorus]
First ring, every time, Sam (Sam)
Even when it's two in the morning
First ring, every time, Sam
Happy birthday, this time I'm calling

[Verse 2]
You say you're five minutes away
Then you walk in an hour late
You borrow my charger for the night
It hasn't come home to this day

[Pre-Chorus]
Other people let the phone ring out
With you I never have to wonder

[Chorus]
First ring, every time, Sam (Sam)
Even when it's two in the morning
First ring, every time, Sam
Happy birthday, this time I'm calling

[Bridge]
You tell me the truth when they're kind
So here is one truth from me
I want a year that gives you back
What you hand out to everyone else

[Chorus]
First ring, every time, Sam (Sam)
Even when it's two in the morning
First ring, every time, Sam
Happy birthday, keep the charger

[Outro]
First ring, every time, Sam

Why it works: the hook is Maya's own phrase; verse 1 is one night told in order and ends on the funny detail; verse 2 saves the joke for its last line; the bridge stops joking; the last chorus line pays off the charger. Nothing in it is invented.`

const SMOOTH_EXAMPLE = `An example of the standard, written for two other people. Study what it leaves out; do not reuse its hook or any of its wording.

${EXAMPLE_DETAILS}

First Ring

[Verse 1]
Two a.m., car won't start
Out on the bridge in the dark
I only had to call one time
You were already on your way

[Pre-Chorus]
Some people let it ring
Not you, not you

[Chorus]
First ring, you're there (first ring)
First ring, every time
First ring, you're there
You never let it ring twice

[Verse 2]
You tell me straight when they go soft
You say five minutes, I add an hour
Still you're the one I wait up for
Sam, keep the charger, it's yours now

[Pre-Chorus]
Some people let it ring
Not you, not you

[Chorus]
First ring, you're there (first ring)
First ring, every time
First ring, you're there
You never let it ring twice

[Bridge]
This year I want it coming back to you
Everything you give, coming back to you
Happy birthday, Sam
It's all coming back to you

[Chorus]
First ring, you're there (first ring)
First ring, every time
First ring, you're there
You never let it ring twice

[Outro]
First ring (happy birthday, Sam)

Why it works: it sounds like a track, not a card. The whole song stands on one phrase of Maya's. Only three details are used and none is explained: the breakdown is two lines, the lateness is half a line, the charger is a throwaway. The soup, the jump leads and the birthday itself are held back; the name comes twice and "happy birthday" only at the turn and the very end. Nothing in it is invented.`

/**
 * The brief for the model that writes the words. Only the sender's details go
 * in. It is long on purpose: left alone, the writer lists the details as
 * fragments and pads the chorus with greeting-card filler.
 */
export function lyricsBrief(d: SongDetails, tone: LyricTone = 'smooth') {
  const singer = d.sender || 'the singer'
  const who = d.recipient
  const facts: string[] = []
  if (d.reasons.length) facts.push(`What ${singer} loves about ${who}:\n${bullets(d.reasons)}`)
  if (d.habits.length) facts.push(`${who}'s funny habits:\n${bullets(d.habits)}`)
  if (d.moments.length) facts.push(`Moments they shared:\n${bullets(d.moments)}`)
  if (d.wish) facts.push(`The birthday wish: ${d.wish}`)
  if (!facts.length) facts.push('No other details were given.')
  const truth = `Everything true you have to work with is below, in ${singer}'s own words. Do not add places, events, people, nicknames or facts. The details also show what kind of love this is (partner, parent, child, sibling, friend): write for that, and never make it romantic unless the details are. Write in the same kind of English ${singer} uses.`
  const banned = '- No greeting-card words: blessings, journey, treasure, special, shine, celebrate, amazing, wonderful, forever, dreams.'
  const contractions = "- Use contractions the way people speak: you're, I'm, don't, it's."
  const check = 'Before you answer, say every line aloud in your head. Rewrite any line that nobody would say, that exists only to rhyme, or that states something not in the details'

  if (tone === 'smooth') {
    return [
      `Write the lyrics of a short song for ${who}'s birthday. ${singer} is giving it to ${who} and sings it straight to ${who} ("I", "you"). It should sound like a track an artist would release that happens to be about ${who}: understated, warm, a little cool. Not a jingle, not a greeting card, not a comedy song. If a stranger would wince at a line, it does not belong.`,
      truth,
      facts.join('\n\n'),
      [
        'Plan before you write. Do not show the plan.',
        `1. The hook: two to four words, taken from the one phrase or feeling in the details that only ${singer} would say about ${who}. The whole song stands on it and repeats it.`,
        '2. Choose at most three details. Leave the rest out, however good they are. A song that mentions everything sounds like a list.',
        '3. Never explain a detail. Give it as a picture or a passing remark, in a line or two, and move on. The feeling does the rest.',
        `If there is almost nothing to go on, write an even sparer song around the hook and the name; do not invent a history.`,
      ].join('\n'),
      [
        'How it must be written:',
        '- Short lines, mostly 3 to 7 syllables. Space and repetition are good. A fragment is fine when it is how people talk ("Two a.m., car won\'t start").',
        `- Keep ${singer}'s own words where they sit well; they are what ${who} will recognise.`,
        contractions,
        '- No set-up-and-punchline jokes. One light, throwaway wink is enough for the whole song.',
        `- The name "${who}" at most twice in the whole song, never in the hook line.`,
        '- "Happy birthday" appears only in the bridge and the outro. Never the exact phrase "happy birthday to you", which belongs to another song.',
        banned,
        '- Rhyme is optional. Never bend a line or add a word to get one.',
      ].join('\n'),
      [
        'Form, exactly:',
        '[Verse 1] 4 lines',
        '[Pre-Chorus] 2 short lines',
        '[Chorus] 4 short lines built on the hook, the same every time',
        '[Verse 2] 4 lines',
        '[Pre-Chorus] the same 2 lines',
        '[Chorus]',
        '[Bridge] 3 or 4 lines carrying the wish; this is where "happy birthday" and the name come in',
        '[Chorus]',
        '[Outro] the hook once, with (happy birthday, ' + who + ') as a backing vocal',
        'Backing vocals go in parentheses at the end of a line, at most three in the whole song.',
        'Title: the hook.',
      ].join('\n'),
      SMOOTH_EXAMPLE,
      `${check}, and any line that explains instead of showing.`,
    ].join('\n\n')
  }

  return [
    `Write the lyrics of a short birthday song. ${singer} is giving it to ${who} and sings it straight to ${who} ("I", "you"). ${who} should recognise their own life in it, laugh once, and be moved once.`,
    truth,
    facts.join('\n\n'),
    [
      'Plan before you write. Do not show the plan.',
      `1. The hook: the one phrase or feeling in the details that only ${singer} would say about ${who}. The chorus is built on it.`,
      '2. Verse 1 tells one shared moment as a tiny story, in the order it happened: where we were, what you did, how it ended. One moment only.',
      '3. Verse 2 teases: one or two habits, set up plainly, with the funniest part kept for the last line.',
      '4. The bridge turns sincere and carries the wish.',
      `If there are no moments, verse 1 uses what ${singer} loves. If there are no habits, verse 2 uses another reason or moment. If there is almost nothing, write a shorter, warm song around the name and the little you have; do not pad it with invented history.`,
    ].join('\n'),
    [
      'How every line must be written:',
      `- A whole, natural sentence or clause that ${singer} could say out loud to ${who}. No telegraphic fragments, no dropped words, no word order twisted to reach a rhyme.`,
      `- Keep ${singer}'s own words wherever they fit the rhythm. They are what ${who} will recognise.`,
      contractions,
      '- Every verse line holds something you could photograph: a thing, a place, an action.',
      banned,
      '- No filler to fill out a line: "I think", "it\'s true", "you see", "oh so", "each and every", "right here", "today" tacked on the end.',
      '- 6 to 9 syllables a line. Within a verse, lines 1 and 3 match each other in length and stress, and so do lines 2 and 4, so the tune can repeat.',
      '- In each verse rhyme only lines 2 and 4, on the last stressed syllable. A near rhyme is good. If a rhyme would need a filler phrase, a bent sentence or a new fact, leave the lines unrhymed.',
    ].join('\n'),
    [
      'Form, exactly:',
      '[Verse 1] 4 lines',
      '[Pre-Chorus] 2 lines that lift toward the hook',
      `[Chorus] 4 lines. Lines 1 and 3 are the same hook line and end on the name "${who}". One line is the birthday line: it says "happy birthday" and ties it to the hook or the wish, not to a stock phrase such as "have a great day". Never write the exact phrase "happy birthday to you", which belongs to another song. Plain enough to sing back after one hearing.`,
      '[Verse 2] 4 lines',
      '[Pre-Chorus] the same 2 lines',
      '[Chorus] the same 4 lines',
      '[Bridge] 2 to 4 lines',
      '[Chorus] the same 4 lines, except the last line may change to land one last joke or promise from the details',
      '[Outro] the hook line once',
      `Backing vocals go in parentheses at the end of a line, in the chorus and outro only, at most three in the whole song, such as (${who}, ${who}).`,
      'Title: the hook, two to four words.',
    ].join('\n'),
    STORY_EXAMPLE,
    `${check}, and any verse line that could be sung to someone else.`,
  ].join('\n\n')
}

/** Ask the music model to sing words that are already written. */
export function lyricsPrompt(vibe: Vibe, d: SongDetails, lyrics: string) {
  return [
    `A birthday song with a sung lead vocal: ${vibe.prompt}.`,
    `Sing exactly the lyrics below, word for word and in this order. Do not add, drop or change any words. Words in parentheses are backing vocals. Pronounce the name "${d.recipient}" clearly.`,
    'Keep the vocal clear and in front so every word is easy to hear. Short instrumental intro and a clean ending. Do not imitate any existing song or artist.',
    `Lyrics:\n${lyrics}`,
  ].join('\n\n')
}
