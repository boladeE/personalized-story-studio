/**
 * The story format: Story -> Scenes -> Frames.
 *
 * Scene types are designed by people (see library.ts). The generator only
 * chooses which scenes to use, in what order and with which variants, and pours
 * the sender's own words and photos into them. It never invents facts.
 */

/** What a film can be made for. The wording each one changes lives in occasions.ts. */
export const OCCASION_IDS = ['birthday', 'anniversary', 'valentine', 'just-because', 'mothers-day', 'fathers-day', 'thank-you', 'congratulations', 'missing-you'] as const
export type Occasion = (typeof OCCASION_IDS)[number]
export const isOccasion = (value: unknown): value is Occasion => (OCCASION_IDS as readonly unknown[]).includes(value)

/** Who the film is for, to the person making it. Optional: gifts made before this was asked carry none. */
export const RELATIONSHIP_IDS = ['wife', 'husband', 'girlfriend', 'boyfriend', 'partner', 'mother', 'father', 'daughter', 'son', 'sibling', 'grandparent', 'friend', 'other'] as const
export type Relationship = (typeof RELATIONSHIP_IDS)[number]
export const isRelationship = (value: unknown): value is Relationship => (RELATIONSHIP_IDS as readonly unknown[]).includes(value)

export type LookId = 'screening' | 'garden' | 'paper'

/** The kind of film: a design family with its own opening, pages and scene designs. See worlds.ts. */
export const WORLD_IDS = ['screening', 'scrapbook', 'mixtape'] as const
export type WorldId = (typeof WORLD_IDS)[number]
export const isWorld = (value: unknown): value is WorldId => (WORLD_IDS as readonly unknown[]).includes(value)

/**
 * The sender's own cut of the film: which scenes are left out, the order of the
 * rest, and the design picked for a scene. Anything not set here is the studio's choice.
 */
export interface Cut {
  /** Scene types in the sender's order. */
  order?: string[]
  /** Scene types left out of the film. */
  off?: string[]
  /** The design chosen for a scene type. */
  designs?: Record<string, string>
}

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

/** Why the studio chose a kind of film: one of a fixed set of reasons it can say to the sender. */
export const DIRECTION_REASONS = ['teasing', 'memories', 'photos', 'tender', 'short'] as const
export type DirectionReason = (typeof DIRECTION_REASONS)[number]

/**
 * The studio's direction for a film, made from what the sender wrote: the kind
 * of film, its colours, each scene's design and the order they play in. It
 * holds for the version (seed) it was made for; another version is drawn
 * afresh. Anything the sender chooses for themselves always wins.
 */
export interface Direction {
  seed: number
  world: WorldId
  look: LookId
  designs: Record<string, string>
  /** The scenes between the opening and the ending, in playing order. */
  order: string[]
  because: DirectionReason
}

/** Everything the sender tells us. All strings come from the sender. */
export interface Intake {
  occasion: Occasion
  relationship?: Relationship
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
  /** Unset or `surprise` lets the seed choose. */
  world?: WorldId | 'surprise'
  cut?: Cut
  /** The studio's own choices for the first version of the film. See Direction. */
  direction?: Direction
}

export type EndingProp = 'candle' | 'seal'

export type PhotoLayout = 'left' | 'right' | 'wide'

export type Frame =
  | { kind: 'ticket'; recipient: string; occasion: string }
  | { kind: 'title'; kicker: string; title: string; body?: string }
  | { kind: 'photo'; photo: Photo; kicker: string; title: string; body?: string; layout: PhotoLayout }
  | { kind: 'item'; kicker: string; text: string; index: number; total: number; marker: 'flag' | 'reason' }
  | { kind: 'montage'; kicker: string; title: string; photos: Photo[] }
  | { kind: 'letter'; title: string; paragraphs: string[]; signoff: string }
  /** The film's last beat: something to do (blow out a candle, open a note), then the sender's last line. */
  | { kind: 'wish'; title: string; body: string; reveal: string; prop?: EndingProp; action?: string }

export type Mood = 'warm' | 'playful' | 'tender' | 'glow'

export interface Scene {
  id: string
  type: string
  name: string
  mood: Mood
  /** Which of the world's designs this scene is drawn in. Gifts stored before designs existed carry none. */
  design?: string
  frames: Frame[]
}

/** The song made for a film: the only music it has. */
export interface Soundtrack {
  kind: 'song'
  src: string
  label: string
}

export interface Story {
  soundtrack?: Soundtrack
  /** A small line under the end credits, such as the sample's notice that its people are invented. */
  note?: string
  occasion: Occasion
  seed: number
  look: LookId
  /** Gifts stored before worlds existed are Screenings. */
  world?: WorldId
  sender: string
  recipient: string
  scenes: Scene[]
}
