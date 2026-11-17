import { createFileRoute } from '@tanstack/react-router'
import { allowSong, generateSong, musicProvider, MusicError } from '../../server/music'
import { json } from '../../server/store'
import { parseSongDetails, vibeById } from '../../story/vibes'
import type { SongDetails } from '../../story/vibes'

export const Route = createFileRoute('/api/music')({
  server: {
    handlers: {
      GET: () => json({ provider: musicProvider() }),
      POST: async ({ request }) => {
        let vibe = ''
        // `details` asks for a song sung about the recipient; without it the song is instrumental.
        let details: SongDetails | null = null
        try {
          const body = (await request.json()) as { vibe?: unknown; details?: unknown }
          vibe = String(body.vibe ?? '')
          if (body.details !== undefined && body.details !== null) {
            details = parseSongDetails(body.details)
            if (!details) return json({ error: 'Add their name before making a song about them.' }, { status: 400 })
          }
        } catch {
          return json({ error: 'Pick a style first.' }, { status: 400 })
        }
        if (!vibeById(vibe)) return json({ error: 'Pick a style first.' }, { status: 400 })
        if (musicProvider() === 'off') return json({ error: 'AI songs aren’t switched on for this studio yet.' }, { status: 503 })
        const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
        const allowed = allowSong(client)
        if (!allowed.allowed) return json({ error: allowed.reason }, { status: 429 })
        try {
          const song = await generateSong(vibe, details)
          return json(
            { id: song.id, src: `/api/song/${song.id}`, label: vibeById(song.vibe)!.name, provider: song.provider, sung: Boolean(song.sung), lyrics: song.lyrics ?? '' },
            { status: 201 },
          )
        } catch (error) {
          if (error instanceof MusicError) return json({ error: error.message }, { status: error.status })
          throw error
        }
      },
    },
  },
})
