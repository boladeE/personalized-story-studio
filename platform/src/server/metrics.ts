import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { DATA_DIR, loadGift, safeEqualHex, sha256 } from './store'

/**
 * The owner's numbers: how many films, songs and gifts the studio has made.
 * Counts only. Nothing a sender wrote, uploaded or recorded is read out here,
 * and the log of events holds no more than what happened and when.
 */

const EVENTS = ['film', 'song', 'lyrics', 'spoken', 'questions'] as const
export type StudioEvent = (typeof EVENTS)[number]
const logFile = path.join(DATA_DIR, 'events.log')

/** Note that something was made. A count is never worth failing a request over. */
export function record(event: StudioEvent, detail = '') {
  void mkdir(DATA_DIR, { recursive: true })
    .then(() => appendFile(logFile, `${new Date().toISOString()} ${event} ${detail.replace(/[^a-z0-9-]/gi, '').slice(0, 24)}\n`))
    .catch(() => {})
}

/** True for the owner's key. Without `OWNER_KEY` set, nobody is the owner. */
export function isOwner(request: Request) {
  const expected = process.env.OWNER_KEY ?? ''
  const given = request.headers.get('x-owner-key') ?? ''
  return expected.length >= 12 && given.length > 0 && safeEqualHex(sha256(given), sha256(expected))
}

const tally = <K extends string>(keys: K[]) => {
  const counts = new Map<string, number>()
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
}

export async function studioStats(now = Date.now()) {
  const day = 86_400_000
  const since = (iso: string) => now - Date.parse(iso)
  // What was made, from the log (kept since 2026-11-20; nothing before that was counted).
  const lines = (await readFile(logFile, 'utf8').catch(() => '')).split('\n').filter(Boolean)
  const events = lines.map((line) => {
    const [at, event, detail = ''] = line.split(' ')
    return { at, event, detail }
  })
  const made = Object.fromEntries(
    EVENTS.map((event) => {
      const mine = events.filter((e) => e.event === event)
      return [event, { today: mine.filter((e) => since(e.at) < day).length, week: mine.filter((e) => since(e.at) < 7 * day).length, all: mine.length }]
    }),
  )
  // What was sent, from the gifts themselves.
  const slugs = await readdir(path.join(DATA_DIR, 'gifts')).catch(() => [] as string[])
  const gifts = (await Promise.all(slugs.map((slug) => loadGift(slug)))).filter((g): g is NonNullable<typeof g> => Boolean(g))
  const sent = {
    today: gifts.filter((g) => since(g.createdAt) < day).length,
    week: gifts.filter((g) => since(g.createdAt) < 7 * day).length,
    all: gifts.length,
  }
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(now - (13 - i) * day).toISOString().slice(0, 10)
    return { date, films: events.filter((e) => e.event === 'film' && e.at.startsWith(date)).length, sent: gifts.filter((g) => g.createdAt.startsWith(date)).length }
  })
  return {
    made,
    sent,
    days,
    since: events[0]?.at ?? null,
    directedBy: tally(events.filter((e) => e.event === 'film').map((e) => e.detail || 'unknown')),
    styles: tally(gifts.map((g) => g.story.world ?? 'screening')),
    occasions: tally(gifts.map((g) => g.intake.occasionName?.trim() ? 'own occasion' : g.intake.occasion)),
    withSong: gifts.filter((g) => g.media.song).length,
    withPhotos: gifts.filter((g) => g.intake.photos.length > 0).length,
    withClips: gifts.filter((g) => Object.keys(g.media).some((id) => id.endsWith('-clip'))).length,
    withVoice: gifts.filter((g) => Object.keys(g.media).some((id) => id.endsWith('-voice'))).length,
  }
}
