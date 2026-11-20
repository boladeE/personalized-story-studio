/**
 * What the studio's text-model calls share: which provider is on, and how
 * often one visitor may ask. The calls themselves are in outline.ts (a film's
 * scenes) and followups.ts (questions about what was written).
 */

const perClient = new Map<string, number[]>()

export function allowSort(clientKey: string, now = Date.now()) {
  const hourly = Number(process.env.SORT_HOURLY_PER_CLIENT ?? 30)
  const recent = (perClient.get(clientKey) ?? []).filter((t) => t > now - 3_600_000)
  if (recent.length >= hourly) return false
  recent.push(now)
  perClient.set(clientKey, recent)
  return true
}

/**
 * Sent with every request to Google. Senders write and upload private things, so nothing they give
 * the studio is kept in its request log (which is otherwise on: checked in AI Studio on 2026-11-20,
 * with and without this). Google still holds requests for 55 days for abuse monitoring, as its terms say.
 */
export const NOT_STORED = { store: false } as const

/** `demo` keeps tests and local work off the network. */
export const sortProvider = (): 'gemini' | 'local' =>
  process.env.MUSIC_PROVIDER !== 'demo' && process.env.SORT_PROVIDER !== 'local' && process.env.GEMINI_API_KEY ? 'gemini' : 'local'
