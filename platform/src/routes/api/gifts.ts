import { createFileRoute } from '@tanstack/react-router'
import { generateStory } from '../../story/generate'
import { LIMITS, parseIntake } from '../../story/validate'
import { vibeById } from '../../story/vibes'
import { readSong } from '../../server/music'
import { hashAnswer, json, newManageKey, newSlug, saveGift, sha256, sniffAudio, sniffImage, sniffVideo } from '../../server/store'
import type { GiftRecord } from '../../server/store'

const MAX_BODY = 190 * 1024 * 1024
const MAX_PHOTO = 10 * 1024 * 1024
/** A little over what the browser lets in, for the form's own wrapping. */
const MAX_CLIP = 52 * 1024 * 1024
const MAX_CLIPS = 3
const MAX_VOICE = 4 * 1024 * 1024

/** Create a private gift from the sender's draft. Payment is not connected yet. */
export const Route = createFileRoute('/api/gifts')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const length = Number(request.headers.get('content-length') ?? 0)
        if (length > MAX_BODY) return json({ error: 'That’s too much to upload at once.' }, { status: 413 })

        let form: FormData
        let payload: Record<string, unknown>
        try {
          form = await request.formData()
          payload = JSON.parse(String(form.get('payload') ?? ''))
        } catch {
          return json({ error: 'The gift details didn’t arrive in one piece.' }, { status: 400 })
        }

        const parsed = parseIntake(payload.intake)
        if (!parsed.ok) return json({ error: parsed.error }, { status: 400 })
        const question = typeof payload.question === 'string' ? payload.question.trim() : ''
        const answer = typeof payload.answer === 'string' ? payload.answer.trim() : ''
        const seed = Number(payload.seed)
        if (question.length < 3 || question.length > LIMITS.question) return json({ error: 'Add a question for the lock screen.' }, { status: 400 })
        if (!answer || answer.length > LIMITS.answer) return json({ error: 'Add the answer that unlocks it.' }, { status: 400 })
        if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return json({ error: 'Invalid story version.' }, { status: 400 })

        const slug = newSlug()
        const files: Array<{ id: string; bytes: Uint8Array }> = []
        const media: Record<string, string> = {}
        let clips = 0
        for (const photo of parsed.intake.photos) {
          const file = form.get(`photo:${photo.id}`)
          if (!(file instanceof File)) return json({ error: 'A photo is missing from the upload.' }, { status: 400 })
          if (file.size > MAX_PHOTO) return json({ error: 'One of the photos is too large.' }, { status: 413 })
          const bytes = new Uint8Array(await file.arrayBuffer())
          const type = sniffImage(bytes)
          if (!type) return json({ error: 'Photos must be JPEG, PNG or WebP.' }, { status: 415 })
          files.push({ id: photo.id, bytes })
          media[photo.id] = type
          photo.src = `/api/media/${slug}/${photo.id}`
          // A clip rides beside its first frame, which is the photo above.
          const clip = form.get(`clip:${photo.id}`)
          delete photo.clip
          if (clip instanceof File) {
            if (++clips > MAX_CLIPS) return json({ error: `Up to ${MAX_CLIPS} clips fit in one film.` }, { status: 400 })
            if (clip.size > MAX_CLIP) return json({ error: 'One of the clips is too large.' }, { status: 413 })
            const clipBytes = new Uint8Array(await clip.arrayBuffer())
            const clipType = sniffVideo(clipBytes)
            if (!clipType) return json({ error: 'Clips must be MP4, MOV or WebM videos.' }, { status: 415 })
            files.push({ id: `${photo.id}-clip`, bytes: clipBytes })
            media[`${photo.id}-clip`] = clipType
            photo.clip = `/api/media/${slug}/${photo.id}-clip`
          }
        }

        // Each voice note travels beside the gift, like a photo. One whose sound did not arrive is left out.
        const heard: NonNullable<typeof parsed.intake.voices> = []
        for (const note of parsed.intake.voices ?? []) {
          const file = form.get(`voice:${note.id}`)
          if (!(file instanceof File) || file.size > MAX_VOICE) continue
          const bytes = new Uint8Array(await file.arrayBuffer())
          const type = sniffAudio(bytes)
          if (!type) return json({ error: 'A voice note couldn’t be read.' }, { status: 415 })
          files.push({ id: `${note.id}-voice`, bytes })
          media[`${note.id}-voice`] = type
          heard.push({ ...note, src: `/api/media/${slug}/${note.id}-voice` })
        }
        if (heard.length) parsed.intake.voices = heard
        else delete parsed.intake.voices

        let soundtrack: GiftRecord['story']['soundtrack']
        if (typeof payload.songId === 'string' && payload.songId) {
          const song = await readSong(payload.songId)
          if (!song) return json({ error: 'That song has expired. Make a new one, then send again.' }, { status: 400 })
          files.push({ id: 'song', bytes: song.bytes })
          media.song = song.meta.contentType
          soundtrack = { kind: 'song', src: `/api/media/${slug}/song`, label: song.meta.title || (vibeById(song.meta.vibe)?.name ?? 'Original song') }
        }

        const story = { ...generateStory(parsed.intake, seed), soundtrack }
        const manageKey = newManageKey()
        const record: GiftRecord = {
          slug,
          createdAt: new Date().toISOString(),
          question,
          answer: hashAnswer(answer),
          manageKeyHash: sha256(manageKey),
          intake: parsed.intake,
          story,
          media,
          payment: { status: 'test', note: 'Created before payments were connected; nothing was charged.' },
        }
        await saveGift(record, files)
        return json({ slug, manageKey, path: `/g/${slug}` }, { status: 201 })
      },
    },
  },
})
