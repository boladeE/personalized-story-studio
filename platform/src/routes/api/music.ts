import { createFileRoute } from '@tanstack/react-router'
import { lyricsProvider } from '../../server/lyrics'
import { allowSong, generateSong, musicProvider, MusicError, REFUSED_WORDS } from '../../server/music'
import type { SongWords } from '../../server/music'
import { json } from '../../server/store'
import { hasRefusedLine, isVoice, parseSongDetails, tidyLyrics, tidyTitle, vibeById } from '../../story/vibes'
import type { SongDetails, Voice } from '../../story/vibes'
import { isOccasion } from '../../story/types'
import type { Occasion } from '../../story/types'

export const Route = createFileRoute('/api/music')({
  server: {
    handlers: {
      GET: () => json({ provider: musicProvider(), lyrics: lyricsProvider() !== 'off' }),
      POST: async ({ request }) => {
        let vibe = ''
        // `details` asks for a song sung about the recipient; without it the song is instrumental.
        let details: SongDetails | null = null
        // `lyrics` are words already written for this song; the model sings them as they are.
        let words: SongWords | null = null
        // What an instrumental is scored for; a sung song carries its occasion in `details`.
        let occasion: Occasion = 'birthday'
        let voice: Voice = 'surprise'
        try {
          const body = (await request.json()) as { vibe?: unknown; details?: unknown; lyrics?: unknown; title?: unknown; occasion?: unknown; voice?: unknown }
          vibe = String(body.vibe ?? '')
          if (isOccasion(body.occasion)) occasion = body.occasion
          if (isVoice(body.voice)) voice = body.voice
          if (body.details !== undefined && body.details !== null) {
            details = parseSongDetails(body.details)
            if (!details) return json({ error: 'Add their name before making a song about them.' }, { status: 400 })
            const lyrics = tidyLyrics(body.lyrics)
            if (lyrics) words = { lyrics, title: tidyTitle(body.title) || undefined }
          }
        } catch {
          return json({ error: 'Pick a style first.' }, { status: 400 })
        }
        if (!vibeById(vibe)) return json({ error: 'Pick a style first.' }, { status: 400 })
        if (words && hasRefusedLine(words.lyrics)) return json({ error: REFUSED_WORDS }, { status: 422 })
        if (musicProvider() === 'off') return json({ error: 'Songs aren’t switched on for this studio yet.' }, { status: 503 })
        const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
        const allowed = allowSong(client)
        if (!allowed.allowed) return json({ error: allowed.reason }, { status: 429 })
        try {
          const song = await generateSong(vibe, details, words, occasion, voice)
          return json(
            {
              id: song.id,
              src: `/api/song/${song.id}`,
              label: song.title || vibeById(song.vibe)!.name,
              vibe: song.vibe,
              provider: song.provider,
              sung: Boolean(song.sung),
              lyrics: song.lyrics ?? '',
            },
            { status: 201 },
          )
        } catch (error) {
          if (error instanceof MusicError) return json({ error: error.message }, { status: error.status })
          throw error
        }
      },
    },
  },
})
