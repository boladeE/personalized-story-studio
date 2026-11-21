// A small picture of each template for the design picker: public/templates/thumbs/<id>.jpg, one of its
// pages drawn on the long test film.   node scripts/thumbs.mjs public/templates/<id>.json [...more]
// Needs a dev server (port 3124, or --base) and ImageMagick's `magick`.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const at = args.indexOf('--base')
const base = at >= 0 ? args.splice(at, 2)[1] : 'http://127.0.0.1:3124'
mkdirSync('public/templates/thumbs', { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome' })
for (const file of args) {
  const template = JSON.parse(readFileSync(file, 'utf8'))
  const page = await browser.newPage({ viewport: { width: 1340, height: 900 } })
  await page.addInitScript((t) => (window.__labTemplate = t), template)
  await page.goto(`${base}/lab?size=wide`)
  await page.waitForFunction(() => window.__labReport?.ready, undefined, { timeout: 30000 })
  const frame = page.locator('[data-lab="long: photo"]')
  await frame.scrollIntoViewIfNeeded()
  const raw = `public/templates/thumbs/.${template.id}.png`
  await frame.screenshot({ path: raw })
  execFileSync('magick', [raw, '-resize', '480x300', '-quality', '72', `public/templates/thumbs/${template.id}.jpg`])
  rmSync(raw)
  await page.close()
  console.log(`${template.id}.jpg`)
}
await browser.close()
