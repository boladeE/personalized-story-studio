import { createFileRoute } from '@tanstack/react-router'
import { readSong } from '../../server/music'
import { json, mediaResponse } from '../../server/store'

/** A generated song while it's still a draft. Ids are random and unlisted; songs carry no personal details. */
export const Route = createFileRoute('/api/song/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const song = await readSong(params.id)
        if (!song) return json({ error: 'not-found' }, { status: 404 })
        return mediaResponse(request, song.bytes, song.meta.contentType)
      },
    },
  },
})
