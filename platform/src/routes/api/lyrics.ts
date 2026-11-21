import { record } from '../../server/metrics'
import { createFileRoute } from '@tanstack/react-router'
import { allowLyrics, lyricsProvider, writeLyrics } from '../../server/lyrics'
import { MusicError } from '../../server/music'
import { json } from '../../server/store'
import { isLyricTone, parseSongDetails, STEER_LIMIT } from '../../story/vibes'
import type { LyricTone } from '../../story/vibes'

/** Write the words of a song from the sender's details, before any music is made. */
export const Route = createFileRoute('/api/lyrics')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let details
        let tone: LyricTone = 'smooth'
        // Set when an earlier draft of these words was refused by the music model.
        let fresh = false
        // What the sender asked to be different, in their own words, and the words as they stand.
        let steer = ''
        let current = ''
        try {
          const body = (await request.json()) as { details?: unknown; tone?: unknown; fresh?: unknown; steer?: unknown; current?: unknown }
          details = parseSongDetails(body.details)
          if (isLyricTone(body.tone)) tone = body.tone
          fresh = body.fresh === true
          if (typeof body.steer === 'string') steer = body.steer.replace(/\s+/g, ' ').trim().slice(0, STEER_LIMIT)
          if (typeof body.current === 'string') current = body.current.trim().slice(0, 5000)
        } catch {
          details = null
        }
        if (!details) return json({ error: 'Add their name before writing a song about them.' }, { status: 400 })
        if (lyricsProvider() === 'off') return json({ error: 'Songs aren’t switched on for this studio yet.' }, { status: 503 })
        const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
        const allowed = allowLyrics(client)
        if (!allowed.allowed) return json({ error: allowed.reason }, { status: 429 })
        try {
          const written = await writeLyrics(details, tone, fresh, { steer, current })
          record('lyrics')
          return json(written, { status: 201 })
        } catch (error) {
          if (error instanceof MusicError) return json({ error: error.message }, { status: error.status })
          throw error
        }
      },
    },
  },
})
