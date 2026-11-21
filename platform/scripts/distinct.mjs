// Is a template's layout its own? Compares where things sit on each page with every other template
// in public/templates. Colour and type are left out on purpose: a recolour is not a new template.
//   node scripts/distinct.mjs public/templates/<id>.json [...more]
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DIR = 'public/templates'
const LIMIT = 0.5
const PAGES = ['cover', 'name', 'card', 'line', 'photo', 'item', 'list', 'montage', 'voice', 'wish', 'reveal', 'credits']

const edges = (tracks) => {
  const total = tracks.reduce((a, b) => a + b, 0)
  let at = 0
  return [0, ...tracks.map((t) => (at += t / total))]
}
/** Where each item of a page sits on a wide screen, coarsely: a set of marks like "text:title@1,0 2x1". */
function marks(page) {
  if (!page?.grid?.wide || !Array.isArray(page.items)) return new Set()
  const xs = edges(page.grid.wide.cols)
  const ys = edges(page.grid.wide.rows)
  const out = new Set()
  for (const item of page.items) {
    const a = item.at?.wide
    if (!a || item.is === 'shape') continue
    const [x0, x1, y0, y1] = [xs[a[0] - 1], xs[a[0] + a[2] - 1], ys[a[1] - 1], ys[a[1] + a[3] - 1]]
    const third = (v) => Math.min(2, Math.floor(v * 3))
    const size = (v) => Math.max(1, Math.round(v * 3))
    const what = item.is === 'group' ? `group:${item.lines.map((l) => l.slot).join('+')}` : `${item.is}:${item.slot ?? item.arrange ?? item.look ?? ''}`
    const dress = item.is === 'photo' || item.is === 'photos' ? `/${item.frame}` : item.box ? '/box' : ''
    out.add(`${what}${dress}@${third((x0 + x1) / 2)},${third((y0 + y1) / 2)} ${size(x1 - x0)}x${size(y1 - y0)}`)
  }
  return out
}
const alike = (a, b) => {
  const scores = PAGES.filter((p) => a.pages?.[p] && b.pages?.[p]).map((p) => {
    const [x, y] = [marks(a.pages[p]), marks(b.pages[p])]
    const both = [...x].filter((m) => y.has(m)).length
    return both / Math.max(1, x.size + y.size - both)
  })
  return scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0
}

const others = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => ({ file: resolve(join(DIR, f)), data: JSON.parse(readFileSync(join(DIR, f), 'utf8')) }))
let failed = false
for (const file of process.argv.slice(2)) {
  const mine = JSON.parse(readFileSync(file, 'utf8'))
  const scores = others.filter((o) => o.file !== resolve(file) && o.data.id !== mine.id).map((o) => ({ id: o.data.id, score: alike(mine, o.data) })).sort((a, b) => b.score - a.score)
  const worst = scores[0]
  const bad = worst && worst.score >= LIMIT
  console.log(`${bad ? 'FAIL' : 'ok  '} ${file}: ${worst ? `closest is ${worst.id} (${Math.round(worst.score * 100)}% the same layout; the limit is ${LIMIT * 100}%)` : 'nothing to compare with'}`)
  failed ||= Boolean(bad)
}
process.exit(failed ? 1 : 0)
