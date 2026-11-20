/**
 * The story format: Story -> Scenes -> Frames.
 *
 * A film's scenes are written for that film from what its sender wrote (its
 * outline: see Chapter and outline.ts). Only the opening, the letter and the
 * ending are the same kind of scene in every film. Whatever names the scenes,
 * the words in them are the sender's own; the studio never invents facts.
 *
 * Films made before outlines, and films made in the detailed form, are told in
 * the studio's older fixed scenes (library.ts).
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
  /** The picture. For a clip, its first frame. */
  src: string
  caption: string
  /** A short video that plays, silent and looping, where the picture would sit. */
  clip?: string
  /** A clip's width over its height, so its place is the right shape before it loads. */
  aspect?: number
}

export interface Memory {
  id: string
  title: string
  story: string
  photoId: string
}

/** A recording of the sender speaking, and how long it runs. */
export interface VoiceNote {
  src: string
  seconds: number
}

/** How a scene written for one film is laid out. These few layouts are the only fixed thing about such a scene. */
export const SCENE_LAYOUTS = ['line', 'list', 'moment', 'photos'] as const
export type SceneLayout = (typeof SCENE_LAYOUTS)[number]

/**
 * One scene of a film's outline: a scene that exists because of what this
 * sender wrote, with a name of its own. `lines` are the sender's words:
 * a `line` shows the first by itself, a `list` shows each in turn, a `moment`
 * tells them as one passage beside a photo, and `photos` has none (it shows
 * the photos no other scene used).
 */
export interface Chapter {
  id: string
  name: string
  layout: SceneLayout
  mood: Mood
  lines: string[]
  /** A short line on the scene's title card that leads the viewer into it. */
  intro?: string
  /** The sender's own voice, recorded for this scene. It plays over the scene, with the song turned down under it. */
  voice?: VoiceNote
  /** Which of the voice notes added while the film was being made the director put on this scene. Replaced by `voice` once the film is built. */
  voiceId?: string
  /** The photo a moment is told beside, if the sender picked one. */
  photoId?: string
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
  /** The song the director would have for this film: its style and who sings it. Used when the sender left either to the studio. */
  tune?: string
  voice?: 'woman' | 'man'
}

/** Everything the sender tells us. All strings come from the sender. */
export interface Intake {
  occasion: Occasion
  /**
   * An occasion of the sender's own ("Graduation", "Your first day"), when none of the studio's fits.
   * The film is then built as a "just because" film that names this on its ticket and in its song.
   */
  occasionName?: string
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
  /** How the sender wants the film to end. Unset, it ends the way its occasion does (a candle or a sealed note). */
  ending?: EndingChoice
  /**
   * The film's own scenes, between the opening and the letter. When set, they are the film:
   * `spotlight`, `memories`, `habits` and `reasons` above are not used.
   */
  outline?: Chapter[]
  /** Voice notes the sender added while making the film. The director puts each on a scene, where it becomes that scene's `voice`. */
  voices?: Array<VoiceNote & { id: string }>
  /** The film's first words under their name, written for this film. Unset, the occasion's stock opening is used. */
  opening?: { title: string; body: string }
}

/**
 * An ending the viewer answers: the sender asks a question, or invites them to
 * something with two things to pick from. Either way the film waits for the
 * answer, then shows the sender's last line.
 */
export type EndingChoice = { kind: 'question'; ask: string } | { kind: 'invitation'; invite: string; choices: [string, string] }

/** The sender's ending, if it is complete enough to play. */
export function endingOf(intake: { ending?: EndingChoice }): EndingChoice | null {
  const e = intake.ending
  if (e?.kind === 'question') return e.ask.trim() ? { kind: 'question', ask: e.ask.trim() } : null
  if (e?.kind === 'invitation') {
    const [a, b] = [e.choices[0].trim(), e.choices[1].trim()]
    return e.invite.trim() && a && b ? { kind: 'invitation', invite: e.invite.trim(), choices: [a, b] } : null
  }
  return null
}

export type EndingProp = 'candle' | 'seal' | 'question' | 'invitation'

export type PhotoLayout = 'left' | 'right' | 'wide'

export type Frame =
  | { kind: 'ticket'; recipient: string; occasion: string }
  | { kind: 'title'; kicker: string; title: string; body?: string }
  | { kind: 'photo'; photo: Photo; kicker: string; title: string; body?: string; layout: PhotoLayout }
  /** `flag` and `reason` are the older fixed scenes' items. `loud` and `calm` are an outlined scene's, drawn the same two ways under the scene's own name. */
  | { kind: 'item'; kicker: string; text: string; index: number; total: number; marker: 'flag' | 'reason' | 'loud' | 'calm' }
  | { kind: 'montage'; kicker: string; title: string; photos: Photo[] }
  | { kind: 'letter'; title: string; paragraphs: string[]; signoff: string }
  /** The film's last beat: something to do (blow out a candle, open a note), then the sender's last line. */
  | { kind: 'wish'; title: string; body: string; reveal: string; prop?: EndingProp; action?: string; choices?: string[] }

export type Mood = 'warm' | 'playful' | 'tender' | 'glow'

export interface Scene {
  id: string
  /** A fixed scene's kind (`hello`, `letter`, `wish`, …), or an outlined scene's own id. */
  type: string
  name: string
  mood: Mood
  /** Set on a scene that came from the film's outline. */
  layout?: SceneLayout
  /** The line under the scene's name on its title card. */
  intro?: string
  /** The sender's voice, played over this scene. */
  voice?: VoiceNote
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
