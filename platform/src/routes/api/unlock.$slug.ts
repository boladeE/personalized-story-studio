import { createFileRoute } from '@tanstack/react-router'
import { checkAnswer, clearAttempts, json, loadGift, takeAttempt, unlockCookie } from '../../server/store'

export const Route = createFileRoute('/api/unlock/$slug')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const gift = await loadGift(params.slug)
        if (!gift) return json({ error: 'not-found' }, { status: 404 })
        const attempt = takeAttempt(gift.slug)
        if (!attempt.allowed) {
          return json(
            { error: 'Too many tries. Take a breath and try again in a few minutes.' },
            { status: 429, headers: { 'retry-after': String(attempt.retryAfter ?? 900) } },
          )
        }
        let answer = ''
        try {
          const body = (await request.json()) as { answer?: unknown }
          answer = typeof body.answer === 'string' ? body.answer.slice(0, 200) : ''
        } catch {
          // fall through with an empty answer
        }
        if (!answer.trim() || !checkAnswer(answer, gift.answer)) {
          return json({ error: 'That’s not it. Try again.', remaining: attempt.remaining }, { status: 401 })
        }
        clearAttempts(gift.slug)
        return json({ ok: true }, { headers: { 'set-cookie': unlockCookie(gift.slug, request) } })
      },
    },
  },
})
