import type { EndingProp, Mood, Photo, PhotoLayout, Story } from '../story/types'

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
  /** The scene's type and the design it is drawn in, so a world can draw the same shot differently. */
  sceneType: string
  design?: string
  mood: Mood
  start: number
  duration: number
  /** The film waits here for the viewer (the candle or the note, or the end). */
  hold?: boolean
  /** How the shot's main words arrive and leave. */
  enter: 'type' | 'assemble' | 'cut'
  exit: 'fade' | 'dissolve' | 'cut'
  /** Everything said in this shot, for screen readers and tests. */
  text: string
}

export type Shot = ShotBase &
  (
    /** `items`: what the scene has already listed, for a closing line that lands on top of the list. */
    | { kind: 'line'; kicker?: string; title: string; body?: string; items?: string[] }
    /** `kicker` and `body`: the dedication and opening line, when a world puts the whole opening on one page. */
    | { kind: 'name'; name: string; sub: string; kicker?: string; body?: string }
    | { kind: 'card'; number: string; title: string }
    | { kind: 'photo'; photo: Photo; kicker: string; title: string; body?: string; layout: PhotoLayout }
    /** `all`: every item in the scene, for designs that build a list up one at a time. */
    | { kind: 'flag'; label: string; text: string; n: number; total: number; all: string[] }
    /** `label`: the scene's own name, when the list is an outlined scene's and not the older "Reasons". */
    | { kind: 'reason'; text: string; n: number; total: number; all: string[]; label?: string }
    | { kind: 'montage'; kicker: string; title: string; photos: Photo[] }
    | { kind: 'letter'; greeting: string; paragraphs: string[]; signoff: string }
    /** `choices`: the answers the viewer picks from, when the ending is the sender's question or invitation. */
    | { kind: 'wish'; title: string; body: string; prop: EndingProp; action: string; choices?: string[] }
    /** `names`: the reveal says what the viewer picked, because it was one of two things. */
    | { kind: 'reveal'; words: string; names?: boolean }
    | { kind: 'credits'; lines: Array<{ role: string; name: string }>; last: string; note?: string }
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
type Draft = DistOmit<Shot, 'id' | 'index' | 'start' | 'duration' | 'scene' | 'sceneName' | 'sceneType' | 'design' | 'mood' | 'text'> & { seconds: number; text?: string }

const ORDINALS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const words = (...parts: Array<string | undefined>) => parts.join(' ').split(/\s+/).filter(Boolean).length
/** Seconds a line needs on screen: time to arrive, then a little over three words a second, so nothing sits read and waiting. */
const read = (count: number, floor = 2.8) => Math.max(floor, 1.5 + count * 0.3)

export const DEFAULT_BPM = 88

export function buildFilm(story: Story): Film {
  const shots: Shot[] = []
  const scenes: FilmScene[] = []
  let clock = 0
  let numbered = 0
  let opened = false
  const world = story.world ?? 'screening'
  // An album turns a page between shots; the Screening and the Mixtape cut hard on the beat.
  const album = world === 'scrapbook'
  // The album and the mixtape put the whole opening on one page.
  const onePage = album || world === 'mixtape'

  story.scenes.forEach((scene, sceneIndex) => {
    if (scene.type === 'ticket') return
    // A song made for the film has no beat map, so cuts keep one steady pulse.
    const beat = 60 / DEFAULT_BPM
    const playful = scene.mood === 'playful'
    const drafts: Draft[] = []
    const listed = scene.frames.flatMap((f) => (f.kind === 'item' ? [f.text] : []))
    // Designs that build a list keep the page and add to it, so there is no transition between items.
    const builds = album || ['docket', 'ledger', 'tracklist', 'liner'].includes(scene.design ?? '')
    let itemsSeen = 0

    // Scenes between the opening and the ending get a numbered title card. An outlined scene that is
    // a single screen carries its own name, so only its lists are announced.
    const isChapter = scene.type !== 'hello' && scene.type !== 'wish' && (!scene.layout || scene.layout === 'list')
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
            if (onePage) {
              // The album's title page (and the tape's first track) carries the dedication, their name and the opening line together.
              drafts.push({
                kind: 'name',
                name: story.recipient,
                sub: frame.title,
                kicker: frame.kicker,
                body: frame.body,
                seconds: 6.5 + read(words(frame.body), 0),
                enter: 'type',
                exit: 'fade',
                text: [frame.kicker, `${story.recipient}.`, frame.title, frame.body].filter(Boolean).join(' '),
              })
              break
            }
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
            // A line that closes a list (the verdict) knows what it lands on.
            ...(itemsSeen ? { items: listed } : {}),
            seconds: read(words(kicker, frame.title, frame.body)) + 0.5,
            enter: playful && !album ? 'cut' : 'type',
            exit: playful && !album ? 'cut' : 'fade',
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
            seconds: read(words(frame.title, frame.body, frame.photo.caption)) + 2,
            enter: 'type',
            exit: 'fade',
            text: [frame.kicker, frame.title, frame.body, frame.photo.caption].filter(Boolean).join('. '),
          })
          break
        case 'item': {
          itemsSeen++
          const last = frame.index === frame.total - 1
          if (frame.marker === 'flag' || frame.marker === 'loud') {
            drafts.push({ kind: 'flag', label: frame.kicker, text: frame.text, n: frame.index + 1, total: frame.total, all: listed, seconds: read(words(frame.text), 2.4) + 0.6, enter: 'cut', exit: 'cut' })
          } else {
            drafts.push({ kind: 'reason', text: frame.text, n: frame.index + 1, total: frame.total, all: listed, ...(frame.marker === 'calm' ? { label: frame.kicker } : {}), seconds: read(words(frame.text)) + 0.8, enter: 'type', exit: builds && !last ? 'cut' : 'fade' })
          }
          break
        }
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
          // Gifts stored before occasions existed are birthdays, and carry no prop of their own.
          drafts.push({ kind: 'wish', title: frame.title, body: frame.body, prop: frame.prop ?? 'candle', action: frame.action ?? 'Blow out the candle', ...(frame.choices ? { choices: frame.choices } : {}), seconds: 5, hold: true, enter: 'type', exit: 'fade' })
          drafts.push({ kind: 'reveal', words: frame.reveal, ...(frame.prop === 'invitation' ? { names: true } : {}), seconds: read(words(frame.reveal)) + 3, enter: 'assemble', exit: 'fade' })
          break
      }
    })

    if (scene.type === 'wish') {
      const hasPhotos = story.scenes.some((s) => s.frames.some((f) => f.kind === 'photo' || f.kind === 'montage'))
      const lines = [
        { role: 'Starring', name: story.recipient },
        { role: 'Written by', name: story.sender },
        ...(hasPhotos ? [{ role: 'Photographs', name: `${story.sender}’s camera roll` }] : []),
        // The only music a film has is its own song. Without one there is no music to credit.
        ...(story.soundtrack ? [{ role: 'Music', name: story.soundtrack.label }] : []),
      ]
      drafts.push({ kind: 'credits', lines, last: `For ${story.recipient}, with love.`, note: story.note, seconds: 4 + lines.length * 1.7, hold: true, enter: 'type', exit: 'fade' })
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
        sceneType: scene.type,
        ...(scene.design ? { design: scene.design } : {}),
        mood: scene.mood,
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
      return pick('kicker', 'name', 'sub', 'body').join('. ')
    case 'card':
      return pick('number', 'title').join(': ')
    case 'flag':
      return `${shot.label} ${shot.n} of ${shot.total}. ${shot.text}`
    case 'reason':
      return `${shot.label ?? 'Reason'} ${shot.n} of ${shot.total}. ${shot.text}`
    case 'reveal':
      return String(shot.words)
    case 'credits':
      return [...(shot.lines as Array<{ role: string; name: string }>).map((l) => `${l.role}: ${l.name}`), String(shot.last), ...(shot.note ? [String(shot.note)] : [])].join('. ')
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
