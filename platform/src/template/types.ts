/**
 * A template: one way a film can look, written as data and drawn by one engine
 * (src/template/Page.tsx). It says how each kind of page is laid out, what it is
 * set in, what it is drawn on and how things arrive. It holds no words and no
 * photos: those are the film's.
 *
 * The studio wants two people's films to be very unlikely to look alike, so a
 * film's look is three things that vary on their own: its template (layout and
 * surface), its colours (one of the template's palettes, turned toward the
 * film's own photos) and its type. Templates are written in batches and each
 * is drawn on test films and checked before it is kept (scripts/gate.mjs).
 */

/** A colour of the film's palette, by the job it does. */
export const TOKENS = ['bg', 'surface', 'ink', 'soft', 'accent', 'accent2', 'onSurface', 'onAccent'] as const
export type Token = (typeof TOKENS)[number]

/**
 * A palette. `ink` and `soft` are read on `bg`; `onSurface` on `surface` (a card, a band, a print's
 * border); `onAccent` on `accent`. `accent2` is for shapes and second marks, never small text.
 */
export type Palette = Record<Token, string>

/** A typeface the studio serves itself (public/fonts/t). */
export const FONTS = {
  playfair: { name: 'Playfair Display', faces: ['500i', '700'], kind: 'serif' },
  fraunces: { name: 'Fraunces', faces: ['600'], kind: 'serif' },
  dmserif: { name: 'DM Serif Display', faces: ['400'], kind: 'serif' },
  cormorant: { name: 'Cormorant Garamond', faces: ['500', '600i'], kind: 'serif' },
  instrument: { name: 'Instrument Serif', faces: ['400', '400i'], kind: 'serif' },
  abril: { name: 'Abril Fatface', faces: ['400'], kind: 'serif' },
  baskerville: { name: 'Libre Baskerville', faces: ['400', '400i', '700'], kind: 'serif' },
  gloock: { name: 'Gloock', faces: ['400'], kind: 'serif' },
  youngserif: { name: 'Young Serif', faces: ['400'], kind: 'serif' },
  archivo: { name: 'Archivo', faces: ['400', '800'], kind: 'sans' },
  spacegrotesk: { name: 'Space Grotesk', faces: ['400', '700'], kind: 'sans' },
  dmsans: { name: 'DM Sans', faces: ['400', '600'], kind: 'sans' },
  syne: { name: 'Syne', faces: ['700', '800'], kind: 'sans' },
  anton: { name: 'Anton', faces: ['400'], kind: 'sans' },
  bebas: { name: 'Bebas Neue', faces: ['400'], kind: 'sans' },
  oswald: { name: 'Oswald', faces: ['500'], kind: 'sans' },
  unbounded: { name: 'Unbounded', faces: ['700'], kind: 'sans' },
  fredoka: { name: 'Fredoka', faces: ['600'], kind: 'sans' },
  rubik: { name: 'Rubik', faces: ['500', '800'], kind: 'sans' },
  bowlby: { name: 'Bowlby One', faces: ['400'], kind: 'sans' },
  outfit: { name: 'Outfit', faces: ['400', '700'], kind: 'sans' },
  specialelite: { name: 'Special Elite', faces: ['400'], kind: 'mono' },
  plexmono: { name: 'IBM Plex Mono', faces: ['400', '500'], kind: 'mono' },
  zilla: { name: 'Zilla Slab', faces: ['500', '700'], kind: 'serif' },
  alfa: { name: 'Alfa Slab One', faces: ['400'], kind: 'serif' },
  spacemono: { name: 'Space Mono', faces: ['400', '700'], kind: 'mono' },
  kalam: { name: 'Kalam', faces: ['400', '700'], kind: 'hand' },
  marker: { name: 'Permanent Marker', faces: ['400'], kind: 'hand' },
  shadows: { name: 'Shadows Into Light', faces: ['400'], kind: 'hand' },
  reenie: { name: 'Reenie Beanie', faces: ['400'], kind: 'hand' },
  gloria: { name: 'Gloria Hallelujah', faces: ['400'], kind: 'hand' },
  homemade: { name: 'Homemade Apple', faces: ['400'], kind: 'hand' },
  patrick: { name: 'Patrick Hand', faces: ['400'], kind: 'hand' },
} as const satisfies Record<string, { name: string; faces: readonly string[]; kind: 'serif' | 'sans' | 'mono' | 'hand' }>
export type FontId = keyof typeof FONTS

/** One of a template's three voices: what it is set in and how. `face` is a weight, with `i` for italic ("500i"). */
export interface Voice {
  font: FontId
  face: string
  upper?: boolean
  /** Letter-spacing in em, -0.05 to 0.3. */
  track?: number
  /** Line height, 0.85 to 1.7. */
  lead?: number
}

/** The three voices a page's words are set in: big words, running words and small labels. */
export const VOICES = ['display', 'body', 'label'] as const
export type VoiceId = (typeof VOICES)[number]

/** What a page is drawn on. */
export const TEXTURES = ['none', 'grain', 'paper', 'lines', 'grid', 'dots', 'halftone', 'linen', 'stripes', 'weave'] as const
export type Texture = (typeof TEXTURES)[number]

export interface Ground {
  fill: Token
  texture?: Texture
  /** The colour the texture is drawn in, and how strongly (0.03 to 0.5). */
  ink?: Token
  strength?: number
}

/** How something arrives on its page. Everything rests in place once it has. */
export const ENTERS = ['none', 'fade', 'rise', 'fall', 'left', 'right', 'pop', 'wipe', 'letters', 'words', 'drop', 'develop', 'unfold'] as const
export type Enter = (typeof ENTERS)[number]

/** A filled box behind words or around a picture. */
export interface Box {
  fill: Token
  /** Padding in units, 0 to 6. */
  pad?: number
  /** Corner radius in units, 0 to 6; 99 is a pill. */
  radius?: number
  border?: { color: Token; width: number }
  /** A hard offset shadow in a colour, or a soft dark one. */
  shadow?: 'soft' | 'hard' | 'none'
  shadowColor?: Token
  /** Fill the whole area it is placed in (a panel of colour with words on it), not only the room the words take. */
  stretch?: boolean
}

/** Where an item sits in its page's grid: column, row, columns spanned, rows spanned (from 1). */
export type Area = [number, number, number, number]

interface Placed {
  /** Its place on a wide screen and on a phone held upright. Items may overlap; later ones are drawn on top. */
  at: { wide: Area; tall: Area }
  /** Degrees, -8 to 8 (a shape may be turned any amount, -180 to 180). */
  rotate?: number
  enter?: Enter
  /** Left out when the page has nothing for it (no photo, no second line). Items that need a slot are left out anyway. */
  only?: 'photo' | 'noPhoto'
}

/** Words. `slot` names which of the page's words these are (see PAGES). */
export interface TextItem extends Placed {
  is: 'text'
  slot: string
  voice: VoiceId
  /** Size in units (a unit is about 1% of a wide frame's width, about 2.1% of a phone's). 1.1 to 22. */
  size: number
  /** A different size on a phone held upright, when the one size does not serve both. */
  sizeTall?: number
  /** The smallest it may be shrunk to when the words are long, as a share of `size`. 0.4 to 1. */
  min?: number
  color: Token
  align?: 'start' | 'center' | 'end'
  valign?: 'start' | 'center' | 'end'
  box?: Box
  /** `glow` lights the words in their own colour, like a sign. */
  mark?: 'none' | 'underline' | 'highlight' | 'rule-above' | 'rule-below' | 'quotes' | 'glow'
  markColor?: Token
}

/** Several lines of words stacked in one area and fitted together: a label, a headline and a sentence, say. */
export interface GroupItem extends Placed {
  is: 'group'
  lines: Array<Omit<TextItem, 'at' | 'is' | 'valign' | 'rotate' | 'only'>>
  /** Space between lines in units. */
  gap?: number
  align?: 'start' | 'center' | 'end'
  valign?: 'start' | 'center' | 'end'
  box?: Box
}

export const FRAMES = ['none', 'outline', 'border', 'polaroid', 'tape', 'corners', 'arch', 'circle', 'round', 'stamp', 'hard-shadow', 'soft-shadow', 'slide', 'ticket'] as const
export type Frame = (typeof FRAMES)[number]

/** The page's photo (a photo page, or a voice's speaker). */
export interface PhotoItem extends Placed {
  is: 'photo'
  frame: Frame
  /** `cover` fills its area and may crop; `contain` shows the whole picture. */
  fit: 'cover' | 'contain'
  /** The frame's own colour (a border, tape, corners) and the colour behind a hard shadow. */
  color?: Token
  tone?: 'none' | 'mono' | 'warm' | 'cool' | 'faded'
  /** Its caption under it, when it has one. */
  caption?: { voice: VoiceId; size: number; color: Token }
}

/** A scene's photos together (up to six). */
export interface PhotosItem extends Placed {
  is: 'photos'
  arrange: 'grid' | 'strip' | 'pile' | 'fan' | 'mosaic' | 'wall' | 'stack'
  frame: Frame
  color?: Token
  tone?: PhotoItem['tone']
}

/** `rule` is a horizontal line and `vrule` a vertical one. */
export const SHAPES = ['rect', 'circle', 'ring', 'rule', 'vrule', 'arch', 'blob', 'stripes', 'dots', 'corner', 'star', 'sun', 'wave', 'cross', 'tape', 'burst'] as const
export type ShapeKind = (typeof SHAPES)[number]

/** Something drawn, under the words: a block of colour, a line, a mark. */
export interface ShapeItem extends Placed {
  is: 'shape'
  shape: ShapeKind
  color: Token
  /** 0.05 to 1. */
  opacity?: number
  /** Its size as a share of its area, 0.02 to 2.5 (above 1 it runs past its area). */
  scale?: number
  /** Where in its area it sits, when not the middle: `top-left`, `bottom`, `right` and so on. */
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** For a rule or a ring: its thickness in units. */
  weight?: number
}

/** A voice note, drawn. It fills as far as the voice has got. */
export interface WaveItem extends Placed {
  is: 'wave'
  look: 'bars' | 'blocks' | 'line' | 'dots' | 'mirror'
  color: Token
  lit: Token
}

/** A mark for each thing in a run (the voices in a scene, the lines of a list), showing how far along it is. */
export interface PipsItem extends Placed {
  is: 'pips'
  look: 'dots' | 'squares' | 'ticks' | 'bars' | 'diamonds'
  color: Token
  lit: Token
  align?: 'start' | 'center' | 'end'
}

/** A list that builds: every line so far, with the newest one marked. */
export interface ListItem extends Placed {
  is: 'list'
  voice: VoiceId
  size: number
  color: Token
  /** The newest line's colour. */
  lit: Token
  marker: 'number' | 'dot' | 'check' | 'dash' | 'none' | 'box'
  gap?: number
  align?: 'start' | 'center'
  /** Where the list sits in its area: from the top (so it grows downward as lines arrive), the middle, or the bottom. */
  valign?: 'start' | 'center' | 'end'
  sizeTall?: number
  box?: Box
}

/** The sender's letter, on a sheet. */
export interface LetterItem extends Placed {
  is: 'letter'
  voice: VoiceId
  size: number
  color: Token
  sheet?: Box
}

/** The film's last thing to do: a candle to blow out, a note to open, or the sender's question. The studio draws it; the template places it and dresses its button. */
export interface EndingItem extends Placed {
  is: 'ending'
  button: { voice: VoiceId; box: Box; color: Token }
}

/** The end credits and the buttons after them. */
export interface CreditsItem extends Placed {
  is: 'credits'
  look: 'roll' | 'table' | 'stack'
  voice: VoiceId
  size: number
  color: Token
  /** The colour of the roles ("Written by"). */
  roleColor: Token
}

export type Item = TextItem | GroupItem | PhotoItem | PhotosItem | ShapeItem | WaveItem | PipsItem | ListItem | LetterItem | EndingItem | CreditsItem

export interface Grid {
  /** Column and row sizes as shares of the space ("fr"). Up to 12 each. */
  cols: number[]
  rows: number[]
  /** Space between cells, and around the page (top/bottom, left/right), in units. */
  gap?: number
  pad?: [number, number]
}

/** One kind of page. */
export interface Page {
  grid: { wide: Grid; tall: Grid }
  items: Item[]
  /** A ground of its own, when it differs from the template's. `photo` uses the page's photo, out of focus and darkened or lightened toward `fill`. */
  ground?: Ground & { photo?: boolean }
}

/**
 * The kinds of page a film is made of, and the words each can show (its slots).
 * `cover` is what waits before the film starts; the rest are the film's shots.
 */
export const PAGES = {
  /** Before the film: who it is for. The whole page is the button that starts it. */
  cover: { slots: ['recipient', 'occasion', 'sender', 'hint'], needs: ['recipient', 'hint'], widgets: [] },
  /** The film's first page: their name and its opening words. */
  name: { slots: ['kicker', 'name', 'sub', 'body'], needs: ['name', 'sub'], widgets: [] },
  /** A scene's title card: its number, its name and the line that leads into it. */
  card: { slots: ['number', 'title', 'sub'], needs: ['title'], widgets: [] },
  /** Words alone: a line, sometimes with a label over it and a sentence under it. */
  line: { slots: ['kicker', 'title', 'body'], needs: ['title'], widgets: [] },
  /** Words beside a photo. */
  photo: { slots: ['kicker', 'title', 'body'], needs: ['title'], widgets: ['photo'] },
  /** One line of a list by itself: the list's name, the line, and where it comes in the list. A template has this, or `list`, or both. */
  item: { slots: ['label', 'text', 'n', 'total', 'count'], needs: ['text'], widgets: ['pips'] },
  /** The same for a playful list, when the template shouts those. Optional: `item` is used without it. */
  itemLoud: { slots: ['label', 'text', 'n', 'total', 'count'], needs: ['text'], widgets: ['pips'] },
  /** A list that builds on one page. Optional: a template with it shows lists this way. */
  list: { slots: ['label', 'n', 'total', 'count'], needs: [], widgets: ['list'] },
  /** A scene's photos together. */
  montage: { slots: ['kicker', 'title'], needs: ['title'], widgets: ['photos'] },
  /** One voice note: who is speaking, the voice drawn, their photo if there is one. */
  voice: { slots: ['who', 'count'], needs: ['who'], widgets: ['wave', 'photo', 'pips'] },
  /** The sender's letter. */
  letter: { slots: [], needs: [], widgets: ['letter'] },
  /** The ending's question or instruction, and the thing to do. */
  wish: { slots: ['title', 'body'], needs: ['title'], widgets: ['ending'] },
  /** The sender's last line. */
  reveal: { slots: ['words', 'pick'], needs: ['words'], widgets: [] },
  /** The credits. */
  credits: { slots: ['last', 'note'], needs: [], widgets: ['credits'] },
} as const satisfies Record<string, { slots: readonly string[]; needs: readonly string[]; widgets: readonly string[] }>
export type PageKind = keyof typeof PAGES
export const PAGE_KINDS = Object.keys(PAGES) as PageKind[]
/** A template may leave these out. */
export const OPTIONAL_PAGES: PageKind[] = ['itemLoud', 'list', 'item']

/** How one page gives way to the next. */
export const CUTS = ['fade', 'cut', 'slide', 'rise', 'zoom', 'turn', 'wipe'] as const
export type Cut = (typeof CUTS)[number]

export interface Template {
  /** Lower-case letters, digits and hyphens. Never reused for a different design. */
  id: string
  /** What the studio calls it. Not shown to a film's viewer. */
  name: string
  /** One sentence: the idea of the design, for whoever looks through the collection. */
  idea: string
  /** What it suits. A film is given a template whose tags fit it. */
  tags: Array<'tender' | 'playful' | 'bold' | 'quiet' | 'warm' | 'elegant' | 'handmade' | 'modern' | 'retro' | 'photos' | 'words'>
  /** One to four palettes. A film takes one, then (when `tint` is on) turns its hues toward its own photos. */
  palettes: Palette[]
  tint: boolean
  voices: Record<VoiceId, Voice>
  ground: Ground
  /** A sheet inside the frame that the pages are drawn on (an album's page, a card): its inset in units and its dress. */
  sheet?: { inset: [number, number]; box: Box; ground?: Ground }
  motion: { cut: Cut; pace: 'calm' | 'even' | 'quick' }
  pages: Partial<Record<PageKind, Page>>
}
