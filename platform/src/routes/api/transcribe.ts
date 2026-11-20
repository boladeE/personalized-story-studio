import { createFileRoute } from '@tanstack/react-router'
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
        if (!allowSort(client)) return json({ error: 'That’s a lot of recordings in an hour. Type it for now.' }, { status: 429 })
        const bytes = new Uint8Array(await request.arrayBuffer())
        const type = sniffAudio(bytes)
        if (!bytes.byteLength || bytes.byteLength > MAX_AUDIO || !type) return json({ error: 'That recording couldn’t be read.' }, { status: 415 })
        try {
          return json({ text: await transcribe(bytes, type) })
        } catch (error) {
          if (error instanceof MusicError) return json({ error: error.message }, { status: error.status })
          throw error
        }
      },
    },
  },
})
