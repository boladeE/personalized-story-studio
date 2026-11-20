import { createFileRoute } from '@tanstack/react-router'
import { outlineByRule, outlineFilm } from '../../server/outline'
import { allowSort } from '../../server/sort'
import { json } from '../../server/store'
import { cleanAnswers } from '../../story/followups'
import type { Answered } from '../../story/followups'
import { NOTES_LIMIT } from '../../story/notes'
import { isOccasion, isRelationship } from '../../story/types'
import type { Occasion, Relationship } from '../../story/types'
import { LIMITS } from '../../story/validate'

/**
 * Outline a film from what a sender wrote about someone: the scenes this film has, what each is called,
 * which of their words go in each, and the kind of film and colours that suit it. Only their own words
 * come back inside the scenes. The letter and the photos are never sent, only whether there are any.
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
        let answers: Answered[] = []
        try {
          const body = (await request.json()) as { text?: unknown; sender?: unknown; recipient?: unknown; occasion?: unknown; relationship?: unknown; photos?: unknown; letter?: unknown; answers?: unknown }
          answers = cleanAnswers(body.answers)
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
        const brief = { text, sender, recipient, answered: answers, occasion, relationship, photos, letter }
        // Past the hourly cap the film is still outlined, by rule on this server.
        return json(allowSort(client) ? await outlineFilm(brief) : outlineByRule(brief))
      },
    },
  },
})
