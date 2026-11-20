import { createFileRoute } from '@tanstack/react-router'
import { followups } from '../../server/followups'
import { allowSort } from '../../server/sort'
import { json } from '../../server/store'
import { followupsLocally } from '../../story/followups'
import { NOTES_LIMIT } from '../../story/notes'
import { LIMITS } from '../../story/validate'

/** Up to three short questions about what a sender wrote, each hung on their own words. */
export const Route = createFileRoute('/api/followups')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let text = ''
        let sender = ''
        let recipient = ''
        try {
          const body = (await request.json()) as { text?: unknown; sender?: unknown; recipient?: unknown }
          text = typeof body.text === 'string' ? body.text.trim() : ''
          sender = typeof body.sender === 'string' ? body.sender.trim().slice(0, LIMITS.name) : ''
          recipient = typeof body.recipient === 'string' ? body.recipient.trim().slice(0, LIMITS.name) : ''
        } catch {
          text = ''
        }
        if (!text) return json({ error: 'Write a little about them first.' }, { status: 400 })
        if (text.length > NOTES_LIMIT) return json({ error: `That’s more than fits (up to ${NOTES_LIMIT} characters).` }, { status: 400 })
        const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
        // Past the hourly cap the questions are still asked, by rule on this server.
        if (!allowSort(client)) return json({ questions: followupsLocally(text, recipient), by: 'rule' })
        return json(await followups(text, sender, recipient))
      },
    },
  },
})
