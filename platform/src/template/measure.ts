import { contrast } from './color'

/**
 * What can only be known once a page is drawn: whether its words fit, stay on
 * the page, keep clear of each other and can be read on what is behind them.
 * The test page (/lab) runs this over every page of a template; the gate
 * (scripts/gate.mjs) turns away a template with any problem.
 */

export interface Problem {
  page: string
  what: string
}

type Rgba = [number, number, number, number]

function parseColor(value: string): Rgba | null {
  const rgb = value.match(/^rgba?\(([^)]+)\)$/)
  if (rgb) {
    const [r, g, b, a = '1'] = rgb[1].split(/[\s,/]+/).filter(Boolean)
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  const srgb = value.match(/^color\(srgb ([^)]+)\)$/)
  if (srgb) {
    const [r, g, b, a = '1'] = srgb[1].split(/[\s/]+/).filter(Boolean)
    return [Number(r) * 255, Number(g) * 255, Number(b) * 255, Number(a)]
  }
  return null
}
const hex = ([r, g, b]: Rgba | [number, number, number]) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
const over = (top: Rgba, under: Rgba): Rgba => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1) as Rgba

const overlap = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
const area = (r: DOMRect) => r.width * r.height

/** The colour behind a point of the page, looking down through everything painted there. Null when a photo is what is there. */
function behind(page: HTMLElement, x: number, y: number, self: Element): Rgba | null {
  let stack: Rgba[] = []
  for (const el of document.elementsFromPoint(x, y)) {
    if (!page.contains(el) && el !== page && !el.contains(page)) continue
    if (el === self || self.contains(el) || (el.contains(self) && el.classList.contains('tp-ink'))) continue
    if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) return stack.length && stack.some((s) => s[3] >= 0.85) ? stack.reduceRight((under, top) => over(top, under), [128, 128, 128, 1] as Rgba) : null
    const style = getComputedStyle(el)
    let color = parseColor(style.backgroundColor)
    if (!color || color[3] === 0) continue
    color = [color[0], color[1], color[2], color[3] * Number(style.opacity || 1)]
    stack.push(color)
    if (color[3] >= 0.98) return stack.reduceRight((under, top) => over(top, under))
    if (el.contains(page)) break
  }
  stack = stack.length ? stack : [[255, 255, 255, 1]]
  return stack.reduceRight((under, top) => over(top, under), [255, 255, 255, 1] as Rgba)
}

/** Everything wrong with the pages drawn inside `root`. Each page is a `.tp` in a frame marked `data-lab`. */
export function measure(root: ParentNode = document): Problem[] {
  const problems: Problem[] = []
  // Shapes are not there to be touched, so a point passes through them; while measuring they must be found.
  document.documentElement.classList.add('tp-measuring')
  for (const frame of Array.from(root.querySelectorAll<HTMLElement>('[data-lab]'))) {
    const page = frame.querySelector<HTMLElement>('.tp')
    const name = frame.dataset.lab ?? ''
    const bad = (what: string) => void problems.push({ page: name, what })
    if (!page) {
      bad('nothing was drawn')
      continue
    }
    // What lies under a point can only be asked of what is on screen.
    frame.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
    const box = frame.getBoundingClientRect()
    const tall = box.height > box.width
    const least = tall ? 11 : 13

    for (const el of Array.from(page.querySelectorAll<HTMLElement>('.tp-fit[data-over="1"]'))) bad(`${el.dataset.slot ?? el.className.split(' ')[0]}: the words do not fit their area even at their smallest`)
    for (const el of Array.from(page.querySelectorAll<HTMLElement>('.tp-fit[data-broke="1"]'))) bad(`${el.dataset.slot ?? el.className.split(' ')[0]}: a word had to be broken in two to fit (give it more room, a smaller size, or a \`sizeTall\`)`)

    // Every run of words, with the cell it belongs to.
    // A run's box: as wide as its words, and as tall as its lines (type set tight is drawn taller than its line, so the line is what counts).
    const boxOf = (el: HTMLElement): DOMRect => {
      const own = el.getBoundingClientRect()
      const block = el.closest<HTMLElement>('.tp-words')
      if (!block || block === el) return own
      const outer = block.getBoundingClientRect()
      const style = getComputedStyle(block)
      const top = Math.max(own.top, outer.top + parseFloat(style.paddingTop))
      const bottom = Math.min(own.bottom, outer.bottom - parseFloat(style.paddingBottom))
      return new DOMRect(own.left, top, own.width, Math.max(0, bottom - top))
    }
    const runs = Array.from(page.querySelectorAll<HTMLElement>('.tp-ink, .tp-list li > span, .tp-credits dd, .tp-credits dt')).map((el) => ({ el, rect: boxOf(el), cell: el.closest('.tp-cell'), slot: el.closest<HTMLElement>('[data-slot]')?.dataset.slot ?? el.tagName.toLowerCase() }))
    const photos = Array.from(page.querySelectorAll<HTMLElement>('.tp-ph')).map((el) => el.getBoundingClientRect())
    const inLetter = (el: Element) => Boolean(el.closest('.tp-letter'))

    for (const run of runs) {
      if (!run.rect.width || !run.rect.height) continue
      if (!inLetter(run.el) && (run.rect.left < box.left - 2 || run.rect.right > box.right + 2 || run.rect.top < box.top - 2 || run.rect.bottom > box.bottom + 2)) bad(`${run.slot}: the words run off the page`)
      const style = getComputedStyle(run.el)
      const size = parseFloat(style.fontSize)
      if (size < least) bad(`${run.slot}: ${size.toFixed(1)}px is too small to read (${least}px at least)`)
      const ink = parseColor(style.color)
      // Read at three points along the words, since a design may put them half on one thing and half on another.
      const points = [0.04, 0.2, 0.5, 0.8, 0.96].map((f) => [run.rect.left + run.rect.width * f, run.rect.top + run.rect.height * 0.5])
      let worst = 99
      let onPhoto = false
      for (const [x, y] of points) {
        if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue
        // Words that are clipped away or covered at this point are not being read there.
        const top = document.elementFromPoint(x, y)
        if (!top || !(top === run.el || run.el.contains(top) || top.contains(run.el))) continue
        const under = behind(page, x, y, run.el)
        if (!under) onPhoto = true
        else if (ink) worst = Math.min(worst, contrast(hex(over(ink, under)), hex(under)))
      }
      if (onPhoto && !inLetter(run.el)) bad(`${run.slot}: the words lie on a photo with nothing behind them`)
      const need = size >= 28 ? 3 : 4.5
      if (worst < need) bad(`${run.slot}: ${worst.toFixed(1)}:1 against what is behind it (needs ${need}:1)`)
    }

    // Words from different items must keep clear of each other.
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const [a, b] = [runs[i], runs[j]]
        if (a.cell === b.cell || !area(a.rect) || !area(b.rect)) continue
        if (overlap(a.rect, b.rect) > 0.12 * Math.min(area(a.rect), area(b.rect))) bad(`${a.slot} and ${b.slot}: the words lie over each other`)
      }
    }

    const kind = page.dataset.page
    const seen = photos.map((r) => overlap(r, box))
    if ((kind === 'photo' || kind === 'montage') && Math.max(0, ...seen) < 0.07 * area(box)) bad('the photo is too small to see (less than 7% of the page)')
    photos.forEach((r, i) => {
      if (area(r) && seen[i] < 0.55 * area(r)) bad('a photo is mostly off the page')
    })
    const wave = page.querySelector<HTMLElement>('.tp-wave')?.getBoundingClientRect()
    if (kind === 'voice' && (!wave || wave.width < 0.22 * box.width || wave.height < 14)) bad('the voice’s bar is too small to see')
    for (const button of Array.from(page.querySelectorAll<HTMLElement>('.tp-button, .tp-again'))) {
      const r = button.getBoundingClientRect()
      if (r.height < 43 || r.width < 43) bad('a button is smaller than a fingertip (44px)')
      if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) bad('a button runs off the page')
    }
  }
  document.documentElement.classList.remove('tp-measuring')
  return problems
}
