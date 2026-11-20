import { useState } from 'react'
import type { Photo } from '../story/types'
import { LIMITS } from '../story/validate'
import { useDraft } from './draft'
import { CLIP_LIMITS, isClip, readClip } from './clip-intake'
import { readablePhoto } from './photo-intake'

const MAX_PHOTO_BYTES = 15 * 1024 * 1024

/** Free the local preview URLs of photos that are leaving the draft. */
export const releasePhotos = (photos: Photo[]) =>
  photos.forEach((p) => {
    if (p.src.startsWith('blob:')) URL.revokeObjectURL(p.src)
    if (p.clip?.startsWith('blob:')) URL.revokeObjectURL(p.clip)
  })

/**
 * Adding and removing the draft's photos. They stay on the sender's device as
 * local preview URLs until the film is sent.
 */
export function usePhotos() {
  const { intake, setIntake } = useDraft()
  const [error, setError] = useState('')
  /** How many photos are being read right now. An iPhone photo takes a second or two to convert. */
  const [reading, setReading] = useState(0)

  const add = async (files: File[]) => {
    const room = LIMITS.photos - intake.photos.length
    // Clips first: a few seconds of video that sit where a photo would.
    const videos = files.filter(isClip)
    files = files.filter((f) => !isClip(f))
    const clipRoom = Math.max(0, Math.min(CLIP_LIMITS.count - intake.photos.filter((p) => p.clip).length, room))
    const clipNotes: string[] = []
    const clips: Photo[] = []
    if (videos.length) setReading(videos.length)
    for (const file of videos) {
      if (clips.length >= clipRoom) clipNotes.push(`Only ${CLIP_LIMITS.count} videos fit in one film.`)
      else if (file.size > CLIP_LIMITS.bytes) clipNotes.push('A video is over 50 MB and was skipped. Try a shorter one.')
      else {
        const read = await readClip(file)
        if (read.ok) clips.push({ id: `p-${crypto.randomUUID()}`, src: URL.createObjectURL(read.poster), caption: '', clip: URL.createObjectURL(file), aspect: read.aspect })
        else clipNotes.push(read.why === 'long' ? 'A video is longer than a minute and was skipped.' : 'A video couldn’t be played by this browser and was skipped.')
      }
      setReading((n) => Math.max(0, n - 1))
    }
    if (clips.length) setIntake((c) => ({ ...c, photos: [...c.photos, ...clips.slice(0, Math.max(0, LIMITS.photos - c.photos.length))] }))
    const sized = files.filter((f) => f.size <= MAX_PHOTO_BYTES)
    const tooBig = files.length - sized.length
    // Only read as many as can still go in.
    const wanted = sized.slice(0, Math.max(0, room - clips.length))
    const over = sized.length - wanted.length
    setError('')
    setReading(wanted.length)
    const read: Blob[] = []
    let unread = 0
    // One at a time: converting several large photos at once can run a phone out of memory.
    for (const file of wanted) {
      const photo = await readablePhoto(file)
      if (photo) read.push(photo)
      else unread++
      setReading((n) => Math.max(0, n - 1))
    }
    setReading(0)
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
    const problems = [
      tooBig && `${plural(tooBig, 'photo is', 'photos are')} over 15 MB and ${tooBig === 1 ? 'was' : 'were'} skipped.`,
      unread && `${plural(unread, 'file', 'files')} couldn’t be read as ${unread === 1 ? 'a photo' : 'photos'}.`,
      over > 0 && `Only ${LIMITS.photos} photos fit in one story.`,
      ...new Set(clipNotes),
    ].filter(Boolean)
    setError(problems.join(' '))
    if (!read.length) return
    setIntake((c) => ({
      ...c,
      // Checked again here, in case photos were added while these were being read.
      photos: [...c.photos, ...read.slice(0, Math.max(0, LIMITS.photos - c.photos.length)).map((photo) => ({ id: `p-${crypto.randomUUID()}`, src: URL.createObjectURL(photo), caption: '' }))],
    }))
  }

  /** The photo last removed, kept (with its place and the memories it belonged to) until the undo offer runs out. */
  const [removed, setRemoved] = useState<{ photo: Photo; at: number; memories: string[] } | null>(null)

  /** Let go of a removed photo for good. */
  const forget = () =>
    setRemoved((was) => {
      if (was) releasePhotos([was.photo])
      return null
    })

  const remove = (id: string) => {
    const at = intake.photos.findIndex((p) => p.id === id)
    if (at < 0) return
    // Only the latest removal can be undone; an earlier one is let go now.
    if (removed) releasePhotos([removed.photo])
    setRemoved({ photo: intake.photos[at], at, memories: intake.memories.filter((m) => m.photoId === id).map((m) => m.id) })
    setIntake((c) => ({
      ...c,
      photos: c.photos.filter((p) => p.id !== id),
      memories: c.memories.map((m) => (m.photoId === id ? { ...m, photoId: '' } : m)),
    }))
  }

  /** Put the removed photo back where it was, with the memories it was chosen for. */
  const restore = () => {
    if (!removed) return
    const { photo, at, memories } = removed
    setRemoved(null)
    setIntake((c) => {
      if (c.photos.length >= LIMITS.photos || c.photos.some((p) => p.id === photo.id)) return c
      const photos = [...c.photos]
      photos.splice(Math.min(at, photos.length), 0, photo)
      return { ...c, photos, memories: c.memories.map((m) => (memories.includes(m.id) && !m.photoId ? { ...m, photoId: photo.id } : m)) }
    })
  }

  return { add, remove, removed, restore, forget, error, setError, reading, room: LIMITS.photos - intake.photos.length }
}
