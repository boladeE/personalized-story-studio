/**
 * The story format: Story -> Scenes -> Frames.
 *
 * Scene types are designed by people (see library.ts). The generator only
 * chooses which scenes to use, in what order and with which variants, and pours
 * the sender's own words and photos into them. It never invents facts.
 */

export type Occasion = 'birthday'

export type LookId = 'screening' | 'garden' | 'paper'

export interface Photo {
  id: string
  src: string
  caption: string
}

export interface Memory {
  id: string
  title: string
  story: string
  photoId: string
}

/** Everything the sender tells us. All strings come from the sender. */
export interface Intake {
  occasion: Occasion
  sender: string
  recipient: string
  photos: Photo[]
  spotlight: string
  memories: Memory[]
  habits: string[]
  reasons: string[]
  letter: string
  wish: string
  look: LookId | 'surprise'
}

export type PhotoLayout = 'left' | 'right' | 'wide'

export type Frame =
  | { kind: 'ticket'; recipient: string; occasion: string }
  | { kind: 'title'; kicker: string; title: string; body?: string }
  | { kind: 'photo'; photo: Photo; kicker: string; title: string; body?: string; layout: PhotoLayout }
  | { kind: 'item'; kicker: string; text: string; index: number; total: number; marker: 'flag' | 'reason' }
  | { kind: 'montage'; kicker: string; title: string; photos: Photo[] }
  | { kind: 'letter'; title: string; paragraphs: string[]; signoff: string }
  | { kind: 'wish'; title: string; body: string; reveal: string }

export type Mood = 'warm' | 'playful' | 'tender' | 'glow'

export interface Scene {
  id: string
  type: string
  name: string
  mood: Mood
  trackId: string
  frames: Frame[]
}

/** An uploaded or generated song that replaces the built-in score for the whole story. */
export interface Soundtrack {
  kind: 'song'
  src: string
  label: string
}

export interface Story {
  soundtrack?: Soundtrack
  occasion: Occasion
  seed: number
  look: LookId
  sender: string
  recipient: string
  scenes: Scene[]
}
