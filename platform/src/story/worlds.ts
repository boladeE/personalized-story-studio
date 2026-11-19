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
}

export interface WorldDef {
  id: WorldId
  name: string
  /** One line for the sender choosing between worlds. */
  blurb: string
  /** What the three colourways are called here. */
  looks: Record<LookId, string>
  /** The designs each scene type can be drawn in. A scene type that isn't listed has a single design. */
  designs: Record<string, DesignDef[]>
}

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
    },
  },
]

export const worldOf = (id: WorldId | undefined): WorldDef => WORLDS.find((w) => w.id === id) ?? WORLDS[0]

/** The designs a scene type has in a world. Empty when it has only the one. */
export const designsFor = (world: WorldId | undefined, sceneType: string): DesignDef[] => worldOf(world).designs[sceneType] ?? []

export const designName = (world: WorldId | undefined, sceneType: string, design: string | undefined) =>
  designsFor(world, sceneType).find((d) => d.id === design)?.name
