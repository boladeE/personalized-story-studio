import type { Relationship } from './types'
import { RELATIONSHIP_IDS } from './types'

/**
 * Who the film is for. It is asked once, as a tap, and used to keep the
 * wording honest: a film for a mother should not sign off like one for a
 * partner, and the song is told what kind of love it is singing about.
 */
export interface RelationshipDef {
  id: Relationship
  /** On the button. */
  name: string
  /** "Zara is Tobi's {noun}", for the lyric writer. Empty when there is nothing useful to say. */
  noun: string
  romantic: boolean
}

const DEFS: RelationshipDef[] = [
  { id: 'wife', name: 'Wife', noun: 'wife', romantic: true },
  { id: 'husband', name: 'Husband', noun: 'husband', romantic: true },
  { id: 'girlfriend', name: 'Girlfriend', noun: 'girlfriend', romantic: true },
  { id: 'boyfriend', name: 'Boyfriend', noun: 'boyfriend', romantic: true },
  { id: 'partner', name: 'Partner', noun: 'partner', romantic: true },
  { id: 'mother', name: 'Mum', noun: 'mother', romantic: false },
  { id: 'father', name: 'Dad', noun: 'father', romantic: false },
  { id: 'daughter', name: 'Daughter', noun: 'daughter', romantic: false },
  { id: 'son', name: 'Son', noun: 'son', romantic: false },
  { id: 'sibling', name: 'Sibling', noun: 'sibling', romantic: false },
  { id: 'grandparent', name: 'Grandparent', noun: 'grandparent', romantic: false },
  { id: 'friend', name: 'Friend', noun: 'friend', romantic: false },
  { id: 'other', name: 'Someone else', noun: '', romantic: false },
]

const BY_ID = new Map(DEFS.map((def) => [def.id, def]))

export const RELATIONSHIPS: RelationshipDef[] = RELATIONSHIP_IDS.map((id) => BY_ID.get(id)!)

export const relationshipOf = (id: unknown): RelationshipDef | undefined => BY_ID.get(id as Relationship)

/** True, false, or undefined when the sender never said. */
export const isRomantic = (id: unknown): boolean | undefined => relationshipOf(id)?.romantic
