import { createFileRoute } from '@tanstack/react-router'
import { readSong } from '../../server/music'
import { json } from '../../server/store'

/** A generated song while it's still a draft. Ids are random and unlisted; songs carry no personal details. */
export const Route = createFileRoute('/api/song/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const song = await readSong(params.id)
        if (!song) return json({ error: 'not-found' }, { status: 404 })
        return new Response(new Uint8Array(song.bytes), {
          headers: { 'content-type': song.meta.contentType, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' },
        })
      },
    },
  },
})
