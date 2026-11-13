import { trackById } from '../story/music'
import type { Mood, Photo, PhotoLayout, Story } from '../story/types'

/**
 * A story becomes a film: an ordered list of timed shots that plays by itself.
 *
 * Shot lengths come from how long the words take to read, then snap to whole
 * bars of the scene's music so cuts land on the beat. Everything here is plain
 * data, so the same timeline can later drive an MP4 render.
 */

interface ShotBase {
  id: string
  index: number
  /** Index into story.scenes. */
  scene: number
  sceneName: string
  mood: Mood
  trackId: string
  start: number
  duration: number
  /** The film waits here for the viewer (the candle, or the end). */
  hold?: boolean
  /** How the shot's main words arrive and leave. */
  enter: 'type' | 'assemble' | 'cut'
  exit: 'fade' | 'dissolve' | 'cut'
  /** Everything said in this shot, for screen readers and tests. */
  text: string
}

export type Shot = ShotBase &
  (
    | { kind: 'line'; kicker?: string; title: string; body?: string }
    | { kind: 'name'; name: string; sub: string }
    | { kind: 'card'; number: string; title: string }
    | { kind: 'photo'; photo: Photo; kicker: string; title: string; body?: string; layout: PhotoLayout }
    | { kind: 'flag'; label: string; text: string; n: number; total: number }
    | { kind: 'reason'; text: string; n: number; total: number }
    | { kind: 'montage'; kicker: string; title: string; photos: Photo[] }
    | { kind: 'letter'; greeting: string; paragraphs: string[]; signoff: string }
    | { kind: 'wish'; title: string; body: string }
    | { kind: 'reveal'; words: string }
    | { kind: 'credits'; lines: Array<{ role: string; name: string }>; last: string }
  )

export interface FilmScene {
  /** Index into story.scenes. */
  scene: number
  name: string
  start: number
}

export interface Film {
  shots: Shot[]
  scenes: FilmScene[]
  duration: number
}

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type Draft = DistOmit<Shot, 'id' | 'index' | 'start' | 'duration' | 'scene' | 'sceneName' | 'mood' | 'trackId' | 'text'> & { seconds: number; text?: string }

const ORDINALS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const words = (...parts: Array<string | undefined>) => parts.join(' ').split(/\s+/).filter(Boolean).length
/** Seconds a line needs on screen: time to arrive, then roughly three words a second. */
const read = (count: number, floor = 2.8) => Math.max(floor, 1.5 + count * 0.36)

export const DEFAULT_BPM = 88

export function buildFilm(story: Story): Film {
  const shots: Shot[] = []
  const scenes: FilmScene[] = []
  let clock = 0
  let numbered = 0
  let opened = false

  story.scenes.forEach((scene, sceneIndex) => {
    if (scene.type === 'ticket') return
    const bpm = story.soundtrack ? DEFAULT_BPM : (trackById(scene.trackId)?.bpm ?? DEFAULT_BPM)
    const beat = 60 / bpm
    const playful = scene.mood === 'playful'
    const drafts: Draft[] = []

    // Chapters between the opening and the candle get a numbered title card.
    const isChapter = scene.type !== 'hello' && scene.type !== 'wish'
    if (isChapter) {
      drafts.push({ kind: 'card', number: `Scene ${ORDINALS[numbered] ?? numbered + 1}`, title: scene.name, seconds: 3, enter: 'type', exit: 'fade' })
      numbered++
    }

    scene.frames.forEach((frame, frameIndex) => {
      switch (frame.kind) {
        case 'ticket':
          break
        case 'title': {
          if (!opened) {
            // The film's first words: a dedication that turns to dust and re-forms as their name.
            opened = true
            drafts.push({ kind: 'line', title: frame.kicker, seconds: 4, enter: 'type', exit: 'dissolve' })
            drafts.push({ kind: 'name', name: story.recipient, sub: frame.title, seconds: 5.2, enter: 'assemble', exit: 'dissolve' })
            if (frame.body) drafts.push({ kind: 'line', title: frame.body, seconds: read(words(frame.body)) + 0.4, enter: 'type', exit: 'fade' })
            break
          }
          // A scene's opening line repeats the card's label, so drop the label.
          const kicker = isChapter && frameIndex === 0 ? undefined : frame.kicker
          drafts.push({
            kind: 'line',
            kicker,
            title: frame.title,
            body: frame.body,
            seconds: read(words(kicker, frame.title, frame.body)) + 0.5,
            enter: playful ? 'cut' : 'type',
            exit: playful ? 'cut' : 'fade',
          })
          break
        }
        case 'photo':
          drafts.push({
            kind: 'photo',
            photo: frame.photo,
            kicker: frame.kicker,
            title: frame.title,
            body: frame.body,
            layout: frame.layout,
            seconds: read(words(frame.title, frame.body, frame.photo.caption)) + 2.4,
            enter: 'type',
            exit: 'fade',
            text: [frame.kicker, frame.title, frame.body, frame.photo.caption].filter(Boolean).join('. '),
          })
          break
        case 'item':
          if (frame.marker === 'flag') {
            drafts.push({ kind: 'flag', label: frame.kicker, text: frame.text, n: frame.index + 1, total: frame.total, seconds: read(words(frame.text), 2.4) + 0.6, enter: 'cut', exit: 'cut' })
          } else {
            drafts.push({ kind: 'reason', text: frame.text, n: frame.index + 1, total: frame.total, seconds: read(words(frame.text)) + 0.8, enter: 'type', exit: 'fade' })
          }
          break
        case 'montage':
          drafts.push({
            kind: 'montage',
            kicker: frame.kicker,
            title: frame.title,
            photos: frame.photos,
            seconds: 3 + frame.photos.length * 1.5,
            enter: 'cut',
            exit: 'fade',
            text: [frame.kicker, frame.title, ...frame.photos.map((p) => p.caption)].filter(Boolean).join('. '),
          })
          break
        case 'letter':
          drafts.push({
            kind: 'letter',
            greeting: frame.title,
            paragraphs: frame.paragraphs,
            signoff: frame.signoff,
            seconds: 5 + words(...frame.paragraphs) * 0.34,
            enter: 'type',
            exit: 'fade',
            text: [frame.title, ...frame.paragraphs, frame.signoff].join(' '),
          })
          break
        case 'wish':
          drafts.push({ kind: 'wish', title: frame.title, body: frame.body, seconds: 5, hold: true, enter: 'type', exit: 'fade' })
          drafts.push({ kind: 'reveal', words: frame.reveal, seconds: read(words(frame.reveal)) + 3, enter: 'assemble', exit: 'fade' })
          break
      }
    })

    if (scene.type === 'wish') {
      const tracks = story.soundtrack
        ? story.soundtrack.label
        : [...new Set(story.scenes.map((s) => trackById(s.trackId)?.title).filter(Boolean))].join(', ')
      const hasPhotos = story.scenes.some((s) => s.frames.some((f) => f.kind === 'photo' || f.kind === 'montage'))
      const lines = [
        { role: 'Starring', name: story.recipient },
        { role: 'Written by', name: story.sender },
        ...(hasPhotos ? [{ role: 'Photographs', name: `${story.sender}’s camera roll` }] : []),
        { role: 'Music', name: tracks },
      ]
      drafts.push({ kind: 'credits', lines, last: `For ${story.recipient}, with love.`, seconds: 4 + lines.length * 1.7, hold: true, enter: 'type', exit: 'fade' })
    }

    if (!drafts.length) return
    scenes.push({ scene: sceneIndex, name: scene.name, start: clock })
    for (const draft of drafts) {
      const { seconds, text, ...rest } = draft
      // Whole bars for most shots; the playful scenes cut twice as fast.
      const unit = beat * (playful && (rest.kind === 'flag' || rest.kind === 'line') ? 2 : 4)
      const duration = Math.ceil(seconds / unit - 1e-6) * unit
      const index = shots.length
      shots.push({
        ...rest,
        id: `${scene.id}-${index}`,
        index,
        scene: sceneIndex,
        sceneName: scene.name,
        mood: scene.mood,
        trackId: scene.trackId,
        start: clock,
        duration,
        text: text ?? spoken(rest),
      } as Shot)
      clock += duration
    }
  })

  return { shots, scenes, duration: clock }
}

function spoken(shot: Record<string, unknown>): string {
  const pick = (...keys: string[]) => keys.map((k) => shot[k]).filter((v): v is string => typeof v === 'string' && v.length > 0)
  switch (shot.kind) {
    case 'name':
      return pick('name', 'sub').join('. ')
    case 'card':
      return pick('number', 'title').join(': ')
    case 'flag':
      return `${shot.label} ${shot.n} of ${shot.total}. ${shot.text}`
    case 'reason':
      return `Reason ${shot.n} of ${shot.total}. ${shot.text}`
    case 'reveal':
      return String(shot.words)
    case 'credits':
      return [...(shot.lines as Array<{ role: string; name: string }>).map((l) => `${l.role}: ${l.name}`), String(shot.last)].join('. ')
    default:
      return pick('kicker', 'title', 'body').join('. ')
  }
}

/** The shot on screen at film time `t`. */
export function shotAt(film: Film, t: number): Shot {
  let found = film.shots[0]
  for (const shot of film.shots) {
    if (shot.start <= t + 1e-6) found = shot
    else break
  }
  return found
}

export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
