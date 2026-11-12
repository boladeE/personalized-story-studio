import { createFileRoute } from '@tanstack/react-router'
import { isUnlocked, json, loadGift, readMedia } from '../../server/store'

/** Photos and songs inside a gift. Served only to someone who has unlocked it. */
export const Route = createFileRoute('/api/media/$slug/$file')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isUnlocked(params.slug, request)) return json({ error: 'locked' }, { status: 401 })
        const gift = await loadGift(params.slug)
        const type = gift?.media[params.file]
        const bytes = type ? await readMedia(params.slug, params.file) : null
        if (!gift || !type || !bytes) return json({ error: 'not-found' }, { status: 404 })
        return new Response(new Uint8Array(bytes), {
          headers: {
            'content-type': type,
            'content-length': String(bytes.byteLength),
            'cache-control': 'private, max-age=3600',
            'x-content-type-options': 'nosniff',
          },
        })
      },
    },
  },
})
