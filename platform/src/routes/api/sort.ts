import { createFileRoute } from '@tanstack/react-router'
import { allowSort, sortNotes } from '../../server/sort'
import { json } from '../../server/store'
import { NOTES_LIMIT, sortLocally } from '../../story/notes'
import { LIMITS } from '../../story/validate'

/** Sort what a sender wrote about someone into the film's scenes. Only their own words come back. */
export const Route = createFileRoute('/api/sort')({
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
        // Past the hourly cap the words are still sorted, by rule on this server.
        if (!allowSort(client)) return json({ notes: sortLocally(text), by: 'rule' })
        return json(await sortNotes(text, sender, recipient))
      },
    },
  },
})
