import { createFileRoute } from '@tanstack/react-router'
import { json, loadGift, safeEqualHex, sha256 } from '../../server/store'

/** What the sender's manage page needs. Requires the private manage key. */
export const Route = createFileRoute('/api/manage/$slug')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const gift = await loadGift(params.slug)
        const key = request.headers.get('x-manage-key') ?? ''
        if (!gift || !key || !safeEqualHex(sha256(key), gift.manageKeyHash)) return json({ error: 'not-found' }, { status: 404 })
        return json({
          slug: gift.slug,
          createdAt: gift.createdAt,
          sender: gift.story.sender,
          recipient: gift.story.recipient,
          question: gift.question,
          scenes: gift.story.scenes.length,
          look: gift.story.look,
          song: gift.story.soundtrack?.label ?? null,
          payment: gift.payment.status,
        })
      },
    },
  },
})
