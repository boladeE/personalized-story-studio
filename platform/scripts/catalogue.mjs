// One picture of each template for looking through the collection: eight of its pages in a row.
//   node scripts/catalogue.mjs <out dir> public/templates/<id>.json [...more]
// Needs a dev server (port 3124, or --base) and ImageMagick's `magick`.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const at = args.indexOf('--base')
const base = at >= 0 ? args.splice(at, 2)[1] : 'http://127.0.0.1:3124'
const [out, ...files] = args
mkdirSync(out, { recursive: true })
const WIDE = ['short: cover', 'long: name', 'long: card', 'long: photo', 'long: list item, last', 'long: montage', 'long: voice with photo', 'long: reveal']
const TALL = ['long: cover', 'long: photo', 'short: list item, last', 'long: voice without photo']

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome' })
for (const file of files) {
  const template = JSON.parse(readFileSync(file, 'utf8'))
  const tmp = join(out, `.tmp-${template.id}`)
  mkdirSync(tmp, { recursive: true })
  const shots = []
  for (const [size, wanted, zoom] of [['wide', WIDE, 0.3], ['tall', TALL, 0.3]]) {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
    await page.addInitScript((t) => (window.__labTemplate = t), template)
    await page.goto(`${base}/lab?size=${size}`)
    await page.waitForFunction(() => window.__labReport?.ready, undefined, { timeout: 30000 })
    // Shrunk with a transform: `zoom` leaves a template's inner sheet undrawn.
    await page.evaluate((z) => {
      const main = document.querySelector('main')
      main.style.width = `${1500 / z}px`
      main.style.transformOrigin = '0 0'
      main.style.transform = `scale(${z})`
    }, zoom)
    await page.waitForTimeout(300)
    for (const [i, key] of wanted.entries()) {
      const frame = page.locator(`[data-lab="${key}"]`)
      if (!(await frame.count())) continue
      const path = join(tmp, `${size}-${String(i).padStart(2, '0')}.png`)
      await frame.screenshot({ path })
      shots.push(path)
    }
    await page.close()
  }
  const wide = shots.filter((s) => s.includes('wide-'))
  const tall = shots.filter((s) => s.includes('tall-'))
  // Two rows of four wide pages, with the four upright pages standing beside them.
  execFileSync('magick', ['montage', ...wide, '-tile', '4x', '-geometry', '+4+4', '-background', '#1b1b1b', join(tmp, 'wide.png')])
  execFileSync('magick', ['montage', ...tall, '-tile', '4x', '-geometry', '+4+4', '-background', '#1b1b1b', join(tmp, 'tall.png')])
  execFileSync('magick', [join(tmp, 'wide.png'), join(tmp, 'tall.png'), '-background', '#1b1b1b', '-gravity', 'center', '+append', '-quality', '78', join(out, `${template.id}.jpg`)])
  rmSync(tmp, { recursive: true, force: true })
  console.log(`${template.id}.jpg`)
}
await browser.close()
