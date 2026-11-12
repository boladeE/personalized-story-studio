import { createFileRoute } from '@tanstack/react-router'
import { deleteGift, isUnlocked, json, loadGift, safeEqualHex, sha256 } from '../../server/store'

/** The recipient's story, only after the right answer. The sender can delete it. */
export const Route = createFileRoute('/api/gift/$slug')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const gift = await loadGift(params.slug)
        if (!gift) return json({ error: 'not-found' }, { status: 404 })
        if (!isUnlocked(gift.slug, request)) return json({ locked: true, question: gift.question }, { status: 401 })
        return json({ story: gift.story })
      },
      DELETE: async ({ request, params }) => {
        const gift = await loadGift(params.slug)
        if (!gift) return json({ error: 'not-found' }, { status: 404 })
        const key = request.headers.get('x-manage-key') ?? ''
        if (!key || !safeEqualHex(sha256(key), gift.manageKeyHash)) return json({ error: 'forbidden' }, { status: 403 })
        await deleteGift(gift.slug)
        return new Response(null, { status: 204 })
      },
    },
  },
})
