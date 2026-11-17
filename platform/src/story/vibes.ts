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

/** The brief for the model that writes the words. Only the sender's details go in. */
export function lyricsBrief(d: SongDetails) {
  const singer = d.sender || 'the singer'
  const parts = [
    `You are a songwriter. Write the lyrics of a short birthday song that ${singer} will give to ${d.recipient}. ${d.sender ? `${d.sender} sings` : 'The singer sings'} it to ${d.recipient} in the first person ("I", "you").`,
    'Use only the true details below. Do not invent places, events, nicknames or facts. You may leave details out.',
  ]
  if (d.reasons.length) parts.push(`What ${singer} loves about ${d.recipient}:\n${bullets(d.reasons)}`)
  if (d.habits.length) parts.push(`${d.recipient}'s funny habits:\n${bullets(d.habits)}`)
  if (d.moments.length) parts.push(`Moments they shared:\n${bullets(d.moments)}`)
  if (d.wish) parts.push(`The birthday wish: ${d.wish}`)
  if (!d.reasons.length && !d.habits.length && !d.moments.length && !d.wish) {
    parts.push('No other details were given, so keep to warm birthday wishes and the name. Do not make up a history for them.')
  }
  parts.push(
    [
      'Craft rules:',
      '- It must be easy to sing: short lines of 5 to 9 words, a steady rhythm from line to line, and end rhymes or near rhymes in pairs.',
      '- Never pad a line or add a detail to force a rhyme. A near rhyme, or no rhyme, is better than a made-up word or fact.',
      `- Plain, warm, slightly teasing everyday English. Keep ${singer}'s own phrases where they sing well. No stock phrases such as "shine so bright" or "one of a kind".`,
      '- Structure exactly: Verse (4 lines), Chorus (4 lines), Verse (4 lines), Chorus, Bridge (2 lines, from the wish), Chorus.',
      `- The chorus has the same words each time, wishes a happy birthday, and has the name "${d.recipient}" at least twice, at the end of a line where it can be held.`,
      '- Never write the exact phrase "happy birthday to you"; it belongs to another song. Say it another way, such as "happy birthday, ' + d.recipient + '".',
      `- Funny habits go in a verse. The teasing should make ${d.recipient} laugh, not wince.`,
      '- Give the song a title of two to four words taken from the lyrics.',
    ].join('\n'),
  )
  return parts.join('\n\n')
}

/** Ask the music model to sing words that are already written. */
export function lyricsPrompt(vibe: Vibe, d: SongDetails, lyrics: string) {
  return [
    `A birthday song with a sung lead vocal: ${vibe.prompt}.`,
    `Sing exactly the lyrics below, word for word and in this order. Do not add, drop or change any words. Pronounce the name "${d.recipient}" clearly.`,
    'Keep the vocal clear and in front so every word is easy to hear. Short instrumental intro and a clean ending. Do not imitate any existing song or artist.',
    `Lyrics:\n${lyrics}`,
  ].join('\n\n')
}
