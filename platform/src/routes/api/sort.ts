import { createFileRoute } from '@tanstack/react-router'
import { directorSeesPhotos, outlineByRule, outlineFilm } from '../../server/outline'
import { record } from '../../server/metrics'
import { allowSort } from '../../server/sort'
import { json } from '../../server/store'
import { cleanAnswers } from '../../story/followups'
import type { Answered } from '../../story/followups'
import { NOTES_LIMIT } from '../../story/notes'
import { isOccasion, isRelationship } from '../../story/types'
import type { Occasion, Relationship } from '../../story/types'
import { LIMITS, MAX_VOICES } from '../../story/validate'

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
        let occasionName = ''
        let peeks: Array<{ id: string; jpeg: string }> = []
        let voices: Array<{ id: string; who: string; said: string }> = []
        try {
          const body = (await request.json()) as { text?: unknown; sender?: unknown; recipient?: unknown; occasion?: unknown; occasionName?: unknown; peeks?: unknown; voices?: unknown; relationship?: unknown; photos?: unknown; letter?: unknown; answers?: unknown }
          answers = cleanAnswers(body.answers)
          if (isOccasion(body.occasion)) occasion = body.occasion
          occasionName = typeof body.occasionName === 'string' ? body.occasionName.trim().slice(0, LIMITS.occasionName) : ''
          if (isRelationship(body.relationship)) relationship = body.relationship
          photos = typeof body.photos === 'number' && body.photos > 0 ? Math.min(Math.floor(body.photos), LIMITS.photos) : 0
          letter = body.letter === true
          // Who speaks in each voice note and what they say, so the director can name the part of the film they are heard in.
          if (Array.isArray(body.voices)) {
            voices = body.voices
              .slice(0, MAX_VOICES)
              .map((v) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {}))
              .filter((v): v is { id: string; said: string; who?: unknown } => typeof v.id === 'string' && /^[a-z0-9-]{1,32}$/i.test(v.id))
              .map((v) => ({ id: v.id, who: typeof v.who === 'string' ? v.who.replace(/\s+/g, ' ').trim().slice(0, LIMITS.name) : '', said: typeof v.said === 'string' ? v.said.replace(/\s+/g, ' ').trim().slice(0, 600) : '' }))
          }
          // Small copies of the photos, used only when the studio lets its director see them.
          if (directorSeesPhotos() && Array.isArray(body.peeks)) {
            peeks = body.peeks
              .slice(0, LIMITS.photos)
              .map((p) => (p && typeof p === 'object' ? (p as Record<string, unknown>) : {}))
              .filter((p): p is { id: string; jpeg: string } => typeof p.id === 'string' && /^[a-z0-9-]{1,64}$/i.test(p.id) && typeof p.jpeg === 'string' && p.jpeg.length < 220_000 && /^[A-Za-z0-9+/=]+$/.test(p.jpeg))
          }
          text = typeof body.text === 'string' ? body.text.trim() : ''
          sender = typeof body.sender === 'string' ? body.sender.trim().slice(0, LIMITS.name) : ''
          recipient = typeof body.recipient === 'string' ? body.recipient.trim().slice(0, LIMITS.name) : ''
        } catch {
          text = ''
        }
        if (!text) return json({ error: 'Write a little about them first.' }, { status: 400 })
        if (text.length > NOTES_LIMIT) return json({ error: `That’s more than fits (up to ${NOTES_LIMIT} characters).` }, { status: 400 })
        const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
        const brief = { text, sender, recipient, answered: answers, occasion, ...(occasionName ? { occasionName } : {}), relationship, photos, letter, ...(peeks.length ? { peeks } : {}), ...(voices.length ? { voices } : {}) }
        // Past the hourly cap the film is still outlined, by rule on this server.
        const made = allowSort(client) ? await outlineFilm(brief) : outlineByRule(brief)
        record('film', made.by)
        return json(made)
      },
    },
  },
})
