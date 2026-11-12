import { createFileRoute } from '@tanstack/react-router'
import { allowSong, generateSong, musicProvider, MusicError } from '../../server/music'
import { json } from '../../server/store'
import { vibeById } from '../../story/vibes'

export const Route = createFileRoute('/api/music')({
  server: {
    handlers: {
      GET: () => json({ provider: musicProvider() }),
      POST: async ({ request }) => {
        let vibe = ''
        try {
          vibe = String(((await request.json()) as { vibe?: unknown }).vibe ?? '')
        } catch {
          return json({ error: 'Pick a style first.' }, { status: 400 })
        }
        if (!vibeById(vibe)) return json({ error: 'Pick a style first.' }, { status: 400 })
        if (musicProvider() === 'off') return json({ error: 'AI songs aren’t switched on for this studio yet.' }, { status: 503 })
        const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
        const allowed = allowSong(client)
        if (!allowed.allowed) return json({ error: allowed.reason }, { status: 429 })
        try {
          const song = await generateSong(vibe)
          return json({ id: song.id, src: `/api/song/${song.id}`, label: vibeById(song.vibe)!.name, provider: song.provider }, { status: 201 })
        } catch (error) {
          if (error instanceof MusicError) return json({ error: error.message }, { status: error.status })
          throw error
        }
      },
    },
  },
})
