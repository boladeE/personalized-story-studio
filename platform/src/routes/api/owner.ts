import { createFileRoute } from '@tanstack/react-router'
import { isOwner, studioStats } from '../../server/metrics'
import { json } from '../../server/store'

/** The studio's counts, for its owner only. */
export const Route = createFileRoute('/api/owner')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!process.env.OWNER_KEY) return json({ error: 'not-set-up' }, { status: 503 })
        if (!isOwner(request)) return json({ error: 'forbidden' }, { status: 403 })
        return json(await studioStats(), { headers: { 'cache-control': 'no-store' } })
      },
    },
  },
})
