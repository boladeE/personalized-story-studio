import type { Intake } from './types'

/** Song styles a sender can ask for. */
export const VIBES = [
  { id: 'afro-soul', name: 'Warm Afro-soul', prompt: 'warm Afro-soul with soft Rhodes keys, gentle talking drum and shakers, mid-tempo around 96 BPM' },
  { id: 'highlife', name: 'Highlife guitar', prompt: 'bright Nigerian highlife with interlocking clean guitars, light horns and an easy groove around 112 BPM' },
  { id: 'piano', name: 'Soft piano', prompt: 'tender solo piano with a light string pad, slow and warm, around 72 BPM' },
  { id: 'lofi-rnb', name: 'Lo-fi R&B', prompt: 'mellow lo-fi R&B with dusty drums, warm bass and soft electric piano, around 84 BPM' },
] as const

export type Vibe = (typeof VIBES)[number]
export type VibeId = Vibe['id']

export const vibeById = (id: string) => VIBES.find((v) => v.id === id)

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
