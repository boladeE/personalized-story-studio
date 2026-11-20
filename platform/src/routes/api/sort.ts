import { createFileRoute } from '@tanstack/react-router'
import { direct } from '../../server/direct'
import { allowSort, sortNotes } from '../../server/sort'
import { json } from '../../server/store'
import { directLocally } from '../../story/direction'
import { NOTES_LIMIT, sortLocally } from '../../story/notes'
import { isOccasion, isRelationship } from '../../story/types'
import type { Occasion, Relationship } from '../../story/types'
import { LIMITS } from '../../story/validate'

/**
 * Sort what a sender wrote about someone into the film's scenes, and direct the film from it: the kind of
 * film, its colours, each scene's design and their order. Only their own words come back; the direction
 * names only things the studio has. The letter and the photos are never sent, only whether there are any.
 */
export const Route = createFileRoute('/api/sort')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let text = ''
        let sender = ''
        let recipient = ''
        let occasion: Occasion = 'birthday'
        let relationship: Relationship | undefined
        let photos = 0
        let letter = false
        try {
          const body = (await request.json()) as { text?: unknown; sender?: unknown; recipient?: unknown; occasion?: unknown; relationship?: unknown; photos?: unknown; letter?: unknown }
          if (isOccasion(body.occasion)) occasion = body.occasion
          if (isRelationship(body.relationship)) relationship = body.relationship
          photos = typeof body.photos === 'number' && body.photos > 0 ? Math.min(Math.floor(body.photos), LIMITS.photos) : 0
          letter = body.letter === true
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
        const brief = (notes: ReturnType<typeof sortLocally>) => ({ occasion, relationship, recipient, notes, photos, letter })
        if (!allowSort(client)) {
          const notes = sortLocally(text)
          return json({ notes, by: 'rule', direction: directLocally(brief(notes)), directedBy: 'rule' })
        }
        const sorted = await sortNotes(text, sender, recipient)
        const directed = await direct(brief(sorted.notes))
        return json({ ...sorted, direction: directed.direction, directedBy: directed.by })
      },
    },
  },
})
