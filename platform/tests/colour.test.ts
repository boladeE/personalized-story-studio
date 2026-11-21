import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrast, OWN_COLOURS, owned, tinted } from '../src/template/color'
import { TOKENS } from '../src/template/types'
import type { Palette } from '../src/template/types'

const palettes: Array<{ id: string; palette: Palette }> = readdirSync('public/templates')
  .filter((f) => f.endsWith('.json') && f !== 'index.json' && f !== 'catalogue.json')
  .flatMap((f) => {
    const t = JSON.parse(readFileSync(`public/templates/${f}`, 'utf8')) as { id: string; palettes: Palette[] }
    return t.palettes.map((palette, i) => ({ id: `${t.id} ${i}`, palette }))
  })

/** The least any two colours of a palette lost in contrast when it was turned, as a share of what they had. */
function kept(before: Palette, after: Palette) {
  let least = 1
  for (const a of TOKENS) for (const b of TOKENS) if (a < b) least = Math.min(least, contrast(after[a], after[b]) / contrast(before[a], before[b]))
  return least
}

describe('a film’s own colours', () => {
  it('reads as well in any colour a sender chooses as the design did in its own', () => {
    expect(palettes.length).toBeGreaterThan(60)
    const picks = [...OWN_COLOURS.map((c) => c.hex), '#000000', '#ffffff', '#ffff00', '#0000ff', '#7cfc00', '#3b2f2f']
    for (const { id, palette } of palettes) for (const own of picks) expect(kept(palette, owned(palette, own)), `${id} in ${own}`).toBeGreaterThan(0.93)
  })

  it('reads as well turned toward any photos’ hues', () => {
    for (const { id, palette } of palettes) for (let hue = 5; hue < 360; hue += 35) expect(kept(palette, tinted(palette, [hue, (hue + 150) % 360])), `${id} at ${hue}`).toBeGreaterThan(0.93)
  })

  it('takes the chosen colour’s family, and almost no colour at all for a grey', () => {
    const { palette } = palettes[0]
    expect(owned(palette, '#d6336c')).not.toEqual(owned(palette, '#1c7ed6'))
    expect(owned(palette, '#d6336c')).toEqual(owned(palette, '#d6336c'))
    const grey = owned(palette, '#7a7a7a')
    for (const token of TOKENS) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(grey[token].slice(i, i + 2), 16))
      expect(Math.max(r, g, b) - Math.min(r, g, b), token).toBeLessThan(40)
    }
  })
})
