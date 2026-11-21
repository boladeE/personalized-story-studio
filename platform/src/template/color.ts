import { TOKENS } from './types'
import type { Palette, Token } from './types'

/**
 * Colour for templates: how readable two colours are together, and turning a
 * template's palette toward the colours of one film's photos. Lightness is
 * what makes words readable, so a palette is turned by hue only and each pair
 * is checked again afterwards.
 */

type Rgb = [number, number, number]

export const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`

const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => linear(v / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The contrast ratio of two colours, 1 to 21. Small text wants 4.5; large text and marks want 3. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** A colour as lightness (0 to 1), chroma (0 to about 0.37) and hue (degrees), in OKLCH. */
export function toLch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => linear(v / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360]
}

function lchToRgb(L: number, C: number, H: number): Rgb {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((v) => gamma(v) * 255) as Rgb
}

/** A colour from lightness, chroma and hue. Chroma is eased down until the colour can be shown. */
export function fromLch(L: number, C: number, H: number): string {
  let c = C
  for (let i = 0; i < 24; i++) {
    const rgb = lchToRgb(L, c, H)
    if (rgb.every((v) => v >= -0.5 && v <= 255.5)) return toHex(rgb)
    c *= 0.9
  }
  return toHex(lchToRgb(L, 0, H))
}

/** The pairs of a palette that words are read in, and the least contrast each must have. */
export const READ_PAIRS: Array<[Token, Token, number]> = [
  ['ink', 'bg', 4.5],
  ['soft', 'bg', 4.5],
  ['accent', 'bg', 3],
  ['onSurface', 'surface', 4.5],
  ['onAccent', 'accent', 4.5],
]

/** What is wrong with a palette, in words. Empty when it can be used. */
export function paletteProblems(palette: Partial<Record<Token, unknown>>): string[] {
  const missing = TOKENS.filter((t) => !isHex(palette[t]))
  if (missing.length) return [`palette is missing ${missing.join(', ')} (six-digit hex colours)`]
  const p = palette as Palette
  return READ_PAIRS.flatMap(([text, under, least]) => {
    const ratio = contrast(p[text], p[under])
    return ratio < least ? [`${text} on ${under} is ${ratio.toFixed(1)}:1 (needs ${least}:1)`] : []
  })
}

/** Move a colour's lightness away from another's until the two reach a contrast, keeping its hue. */
function apart(color: string, from: string, least: number): string {
  if (contrast(color, from) >= least) return color
  const [L, C, H] = toLch(color)
  const lighter = luminance(color) >= luminance(from)
  for (let step = 1; step <= 40; step++) {
    const next = fromLch(Math.max(0, Math.min(1, L + (lighter ? 0.02 : -0.02) * step)), C, H)
    if (contrast(next, from) >= least) return next
  }
  return lighter ? '#ffffff' : '#000000'
}

/**
 * A film's own colours. `hues` are the two main hues of its photos (degrees).
 * The palette keeps every colour's lightness and strength, so the design keeps
 * its character; its grounds and words turn to the first hue and its accents to
 * the second. Pairs that are read are then nudged apart if turning cost them contrast.
 */
export function tinted(palette: Palette, hues: [number, number] | undefined): Palette {
  if (!hues) return palette
  const turn = (hex: string, hue: number) => {
    const [L, C] = toLch(hex)
    // A near-grey has no hue to speak of: give it a little, so the whole page leans the film's way.
    return fromLch(L, C < 0.012 ? 0.012 : C, hue)
  }
  const [main, second] = hues
  const out: Palette = {
    bg: turn(palette.bg, main),
    surface: turn(palette.surface, main),
    ink: turn(palette.ink, main),
    soft: turn(palette.soft, main),
    onSurface: turn(palette.onSurface, main),
    accent: turn(palette.accent, second),
    accent2: turn(palette.accent2, (second + 40) % 360),
    onAccent: turn(palette.onAccent, second),
  }
  for (const [text, under, least] of READ_PAIRS) out[text] = apart(out[text], out[under], least)
  return out
}

/**
 * The two main hues of a set of pixels (RGBA bytes, as a canvas gives them): the
 * strongest colour, and the strongest one well away from it. Null when the
 * pictures are close to grey.
 */
export function mainHues(pixels: Uint8ClampedArray | number[]): [number, number] | null {
  const bins = new Array<number>(36).fill(0)
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const [L, C, H] = toLch(toHex([pixels[i], pixels[i + 1], pixels[i + 2]]))
    // Colour that is neither nearly black, nearly white nor nearly grey counts, by how strong it is.
    if (C < 0.035 || L < 0.18 || L > 0.94) continue
    bins[Math.floor(H / 10) % 36] += C
  }
  const smooth = bins.map((v, i) => v + 0.5 * (bins[(i + 35) % 36] + bins[(i + 1) % 36]))
  const total = smooth.reduce((a, b) => a + b, 0)
  if (total < 1) return null
  const first = smooth.indexOf(Math.max(...smooth))
  const away = smooth.map((v, i) => (Math.min(Math.abs(i - first), 36 - Math.abs(i - first)) >= 6 ? v : 0))
  const second = Math.max(...away) > total * 0.04 ? away.indexOf(Math.max(...away)) : (first + 15) % 36
  return [first * 10 + 5, second * 10 + 5]
}
