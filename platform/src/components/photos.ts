import { useState } from 'react'
import type { Photo } from '../story/types'
import { LIMITS } from '../story/validate'
import { useDraft } from './draft'
import { readablePhoto } from './photo-intake'

const MAX_PHOTO_BYTES = 15 * 1024 * 1024

/** Free the local preview URLs of photos that are leaving the draft. */
export const releasePhotos = (photos: Photo[]) => photos.forEach((p) => p.src.startsWith('blob:') && URL.revokeObjectURL(p.src))

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
    const sized = files.filter((f) => f.size <= MAX_PHOTO_BYTES)
    const tooBig = files.length - sized.length
    // Only read as many as can still go in.
    const wanted = sized.slice(0, Math.max(0, room))
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
    ].filter(Boolean)
    setError(problems.join(' '))
    if (!read.length) return
    setIntake((c) => ({
      ...c,
      // Checked again here, in case photos were added while these were being read.
      photos: [...c.photos, ...read.slice(0, Math.max(0, LIMITS.photos - c.photos.length)).map((photo) => ({ id: `p-${crypto.randomUUID()}`, src: URL.createObjectURL(photo), caption: '' }))],
    }))
  }

  const remove = (id: string) => {
    setIntake((c) => {
      releasePhotos(c.photos.filter((p) => p.id === id))
      return {
        ...c,
        photos: c.photos.filter((p) => p.id !== id),
        memories: c.memories.map((m) => (m.photoId === id ? { ...m, photoId: '' } : m)),
      }
    })
  }

  return { add, remove, error, setError, reading, room: LIMITS.photos - intake.photos.length }
}
