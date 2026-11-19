import { createFileRoute } from '@tanstack/react-router'
import { allowLyrics, lyricsProvider, writeLyrics } from '../../server/lyrics'
import { MusicError } from '../../server/music'
import { json } from '../../server/store'
import { isLyricTone, parseSongDetails } from '../../story/vibes'
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
        try {
          const body = (await request.json()) as { details?: unknown; tone?: unknown; fresh?: unknown }
          details = parseSongDetails(body.details)
          if (isLyricTone(body.tone)) tone = body.tone
          fresh = body.fresh === true
        } catch {
          details = null
        }
        if (!details) return json({ error: 'Add their name before writing a song about them.' }, { status: 400 })
        if (lyricsProvider() === 'off') return json({ error: 'Songs aren’t switched on for this studio yet.' }, { status: 503 })
        const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
        const allowed = allowLyrics(client)
        if (!allowed.allowed) return json({ error: allowed.reason }, { status: 429 })
        try {
          return json(await writeLyrics(details, tone, fresh), { status: 201 })
        } catch (error) {
          if (error instanceof MusicError) return json({ error: error.message }, { status: error.status })
          throw error
        }
      },
    },
  },
})
