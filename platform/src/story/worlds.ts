import type { LookId, WorldId } from './types'

/**
 * Worlds: the different kinds of film the studio can make from the same words
 * and photos. A world is a design family (its own opening, pages, type and
 * motion) and, for each scene type, one or more designs. The story engine only
 * records which world and which designs a film uses; what they look like lives
 * with the film (src/film).
 */

export interface DesignDef {
  id: string
  name: string
  /** A list design that shouts: it suits a playful list. The others suit a tender one. */
  loud?: true
}

export interface WorldDef {
  id: WorldId
  name: string
  /** One line for the sender choosing between worlds. */
  blurb: string
  /** What the three colourways are called here. */
  looks: Record<LookId, string>
  /**
   * The designs each kind of scene can be drawn in, by a fixed scene's type or an outlined scene's
   * layout (`list`, `moment`, `photos`). A kind that isn't listed has a single design.
   */
  designs: Record<string, DesignDef[]>
}

const loud = (id: string, name: string): DesignDef => ({ id, name, loud: true })

export const WORLDS: WorldDef[] = [
  {
    id: 'screening',
    name: 'The Screening',
    blurb: 'A private cinema: a ticket, a countdown, and their name in lights.',
    looks: { screening: 'Wine', garden: 'Garden', paper: 'Paper' },
    designs: {
      redFlags: [
        { id: 'slam', name: 'Loud cards' },
        { id: 'docket', name: 'Charge sheet' },
      ],
      reasons: [
        { id: 'numeral', name: 'Big numbers' },
        { id: 'ledger', name: 'Running list' },
      ],
      list: [loud('slam', 'Loud cards'), loud('docket', 'Roll call'), { id: 'numeral', name: 'Big numbers' }, { id: 'ledger', name: 'Running list' }],
    },
  },
  {
    id: 'scrapbook',
    name: 'The Scrapbook',
    blurb: 'A handmade album: taped photos, sticky notes and your handwriting.',
    looks: { screening: 'Black pages', garden: 'Kraft', paper: 'White card' },
    designs: {
      spotlight: [
        { id: 'polaroid', name: 'Polaroid' },
        { id: 'corners', name: 'Photo corners' },
      ],
      memoryLane: [
        { id: 'taped', name: 'Taped prints' },
        { id: 'clipped', name: 'Clipped cards' },
      ],
      redFlags: [
        { id: 'stickies', name: 'Sticky notes' },
        { id: 'checklist', name: 'Checklist' },
      ],
      reasons: [
        { id: 'bunting', name: 'Tags on a string' },
        { id: 'cards', name: 'Index cards' },
      ],
      cameraRoll: [
        { id: 'pile', name: 'Loose prints' },
        { id: 'strip', name: 'Contact sheet' },
      ],
      list: [loud('stickies', 'Sticky notes'), loud('checklist', 'Checklist'), { id: 'bunting', name: 'Tags on a string' }, { id: 'cards', name: 'Index cards' }],
      moment: [
        { id: 'taped', name: 'Taped print' },
        { id: 'polaroid', name: 'Polaroid' },
        { id: 'clipped', name: 'Clipped card' },
        { id: 'corners', name: 'Photo corners' },
      ],
      photos: [
        { id: 'pile', name: 'Loose prints' },
        { id: 'strip', name: 'Contact sheet' },
      ],
    },
  },
  {
    id: 'mixtape',
    name: 'The Mixtape',
    blurb: 'A tape made for one person: tracks, tall type, and their name on the label.',
    looks: { screening: 'Midnight', garden: 'Sunset', paper: 'Daylight' },
    designs: {
      spotlight: [
        { id: 'cover', name: 'Cover art' },
        { id: 'poster', name: 'Poster' },
      ],
      memoryLane: [
        { id: 'cover', name: 'Cover art' },
        { id: 'poster', name: 'Poster' },
      ],
      redFlags: [
        { id: 'shout', name: 'Loud tracks' },
        { id: 'tracklist', name: 'Track list' },
      ],
      reasons: [
        { id: 'nowplaying', name: 'Now playing' },
        { id: 'liner', name: 'Liner notes' },
      ],
      list: [loud('shout', 'Loud tracks'), loud('tracklist', 'Track list'), { id: 'nowplaying', name: 'Now playing' }, { id: 'liner', name: 'Liner notes' }],
      moment: [
        { id: 'cover', name: 'Cover art' },
        { id: 'poster', name: 'Poster' },
      ],
    },
  },
]

export const worldOf = (id: WorldId | undefined): WorldDef => WORLDS.find((w) => w.id === id) ?? WORLDS[0]

/** The designs a kind of scene (a fixed scene's type, or an outlined scene's layout) has in a world. Empty when it has only the one. */
export const designsFor = (world: WorldId | undefined, sceneType: string): DesignDef[] => worldOf(world).designs[sceneType] ?? []

/** What a scene's designs are listed under: its layout when it came from an outline, otherwise its type. */
export const designKey = (scene: { type: string; layout?: string }) => scene.layout ?? scene.type

export const designName = (world: WorldId | undefined, sceneType: string, design: string | undefined) =>
  designsFor(world, sceneType).find((d) => d.id === design)?.name
