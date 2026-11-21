// The gate: draw templates on the test films and say what is wrong with each.
//   node scripts/gate.mjs public/templates/<id>.json [...more] [--shots <dir>] [--base http://127.0.0.1:3124]
// A dev server must be running (npm run dev, or the port given with --base). Exit code 1 when any template fails.
import { readFileSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(name)
  if (at < 0) return fallback
  const [, value] = args.splice(at, 2)
  return value
}
const base = flag('--base', 'http://127.0.0.1:3124')
const shots = flag('--shots', '')
const files = args
if (!files.length) {
  console.error('Name at least one template file.')
  process.exit(2)
}
if (shots) mkdirSync(shots, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome' })
let failed = 0
for (const file of files) {
  let template
  try {
    template = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    console.log(`FAIL ${file}\n     not JSON: ${error.message}`)
    failed++
    continue
  }
  const id = template.id ?? basename(file, '.json')
  const found = []
  const palettes = Array.isArray(template.palettes) ? template.palettes.length : 1
  // Wide and upright, in each of its palettes, and once more turned toward a film's own colours.
  const runs = [
    ...Array.from({ length: palettes }, (_, p) => [{ size: 'wide', palette: p }, { size: 'tall', palette: p }]).flat(),
    ...(template.tint ? [{ size: 'wide', palette: 0, hue: 205 }, { size: 'tall', palette: 0, hue: 25 }] : []),
  ]
  for (const run of runs) {
    const page = await browser.newPage({ viewport: run.size === 'tall' ? { width: 1700, height: 900 } : { width: 1340, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript((t) => (window.__labTemplate = t), template)
    const query = new URLSearchParams({ size: run.size, palette: String(run.palette), ...(run.hue === undefined ? {} : { hue: String(run.hue) }) })
    await page.goto(`${base}/lab?${query}`)
    try {
      await page.waitForFunction(() => window.__labReport?.ready, undefined, { timeout: 30000 })
    } catch {
      found.push(`${run.size}: the test page never finished drawing${errors.length ? ` (${errors[0]})` : ''}`)
      await page.close()
      continue
    }
    const report = await page.evaluate(() => window.__labReport)
    const tag = `${run.size}, palette ${run.palette}${run.hue === undefined ? '' : `, turned to hue ${run.hue}`}`
    for (const p of report.invalid) found.push(p)
    for (const p of report.problems) found.push(`[${tag}] ${p.page}: ${p.what}`)
    for (const e of errors) found.push(`[${tag}] the page threw: ${e}`)
    if (shots && !report.invalid.length) {
      // Shrunk for the picture only: everything above was measured at full size. A transform, because
      // `zoom` leaves a template's inner sheet undrawn.
      const scale = run.size === 'tall' ? 0.5 : 0.31
      const height = await page.evaluate((z) => {
        const main = document.querySelector('main')
        main.style.width = `${1340 / z}px`
        main.style.transformOrigin = '0 0'
        main.style.transform = `scale(${z})`
        window.scrollTo(0, 0)
        return Math.ceil(main.getBoundingClientRect().height)
      }, scale)
      await page.setViewportSize({ width: 1340, height: Math.min(height, 9000) })
      await page.waitForTimeout(400)
      await page.screenshot({ path: join(shots, `${id}-${run.size}-p${run.palette}${run.hue === undefined ? '' : `-h${run.hue}`}.jpg`), type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: 1340, height: Math.min(height, 9000) } })
    }
    await page.close()
    if (report.invalid.length) break
  }
  const unique = [...new Set(found)]
  console.log(`${unique.length ? 'FAIL' : 'ok  '} ${file}${unique.length ? ` (${unique.length})` : ''}`)
  for (const p of unique.slice(0, 60)) console.log(`     ${p}`)
  if (unique.length > 60) console.log(`     ... and ${unique.length - 60} more`)
  if (unique.length) failed++
}
await browser.close()
process.exit(failed ? 1 : 0)
