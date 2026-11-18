import { useState } from 'react'
import type { Photo } from '../story/types'
import { LIMITS } from '../story/validate'
import { useDraft } from './draft'

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

  const add = (files: File[]) => {
    const room = LIMITS.photos - intake.photos.length
    const images = files.filter((f) => f.type.startsWith('image/') && f.size <= MAX_PHOTO_BYTES)
    const skipped = files.length - images.length
    const accepted = images.slice(0, Math.max(0, room))
    const problems = [
      skipped && `${skipped} file${skipped === 1 ? ' was' : 's were'} skipped (images up to 15 MB only).`,
      images.length > accepted.length && `Only ${LIMITS.photos} photos fit in one story.`,
    ].filter(Boolean)
    setError(problems.join(' '))
    if (!accepted.length) return
    setIntake((c) => ({
      ...c,
      photos: [...c.photos, ...accepted.map((file) => ({ id: `p-${crypto.randomUUID()}`, src: URL.createObjectURL(file), caption: '' }))],
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

  return { add, remove, error, setError, room: LIMITS.photos - intake.photos.length }
}
