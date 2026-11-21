import { createFileRoute } from '@tanstack/react-router'
import { record } from '../../server/metrics'
import { MusicError } from '../../server/music'
import { allowSort } from '../../server/sort'
import { json, sniffAudio } from '../../server/store'
import { transcribe } from '../../server/transcribe'

const MAX_AUDIO = 6 * 1024 * 1024

/** Write down what a sender said about someone. The recording is used once and not kept. */
export const Route = createFileRoute('/api/transcribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (Number(request.headers.get('content-length') ?? 0) > MAX_AUDIO) return json({ error: 'That recording is too long. Try a shorter one.' }, { status: 413 })
        const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
        // A voice note for the film is written down only so the director knows what it adds. When that can't
        // be done the film is made without knowing, so `note=1` gets an empty answer and not an error.
        const note = new URL(request.url).searchParams.get('note') === '1'
        if (!allowSort(client)) return note ? json({ text: '' }) : json({ error: 'That’s a lot of recordings in an hour. Type it for now.' }, { status: 429 })
        const bytes = new Uint8Array(await request.arrayBuffer())
        const type = sniffAudio(bytes)
        if (!bytes.byteLength || bytes.byteLength > MAX_AUDIO || !type) return json({ error: 'That recording couldn’t be read.' }, { status: 415 })
        try {
          // The two names, so they are written the way the sender spells them.
          const names = (new URL(request.url).searchParams.get('names') ?? '').split(',').map((n) => n.replace(/[^\p{L}\p{N} '’.-]/gu, '').trim().slice(0, 60)).filter(Boolean).slice(0, 2)
          const text = await transcribe(bytes, type, names)
          if (!note) record('spoken')
          return json({ text })
        } catch (error) {
          if (note) return json({ text: '' })
          if (error instanceof MusicError) return json({ error: error.message }, { status: error.status })
          throw error
        }
      },
    },
  },
})
