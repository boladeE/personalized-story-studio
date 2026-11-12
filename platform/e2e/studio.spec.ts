import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function open(page: Page, url: string) {
  await page.goto(url)
  await page.waitForSelector('html[data-ready="true"]', { timeout: 30_000 })
}

const audioState = (page: Page) => page.evaluate(() => window.__ltAudio?.state())

async function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return errors
}

// Tiny valid PNG (1x1) for upload tests.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test('sample intake builds a full story that plays with sound to the wish', async ({ page }) => {
  const errors = await trackErrors(page)
  await open(page, '/')
  await page.getByRole('link', { name: 'Start a birthday story' }).click()
  await expect(page.locator('.sb-count')).toHaveText('0 of 9 scenes ready')
  await expect(page.getByRole('button', { name: 'Build the story' })).toBeDisabled()
  await page.getByRole('button', { name: 'Fill with the sample' }).click()
  await expect(page.locator('.sb-count')).toHaveText('9 of 9 scenes ready')
  await page.getByRole('button', { name: 'Build the story' }).click()

  await expect(page).toHaveURL(/\/preview$/)
  await page.getByRole('button', { name: 'Admit one: Zara. Tap to begin' }).click()
  await expect.poll(async () => (await audioState(page))?.running).toBe(true)
  const t1 = (await audioState(page))!.currentTime
  await page.waitForTimeout(600)
  const s = (await audioState(page))!
  expect(s.currentTime).toBeGreaterThan(t1)
  expect(s.trackId).toBeTruthy()

  // Walk to the end with the keyboard.
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole('button', { name: 'Blow out the candle' }).isVisible()) break
    await page.keyboard.press('ArrowRight')
  }
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.getByRole('button', { name: 'Blow out the candle' }).click()
  await expect(page.getByRole('status')).toContainText('you can have my chips')
  expect(errors).toEqual([])
})

test('the sender’s own words and uploaded photo appear, and nothing is sent while drafting', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => r.method() !== 'GET' && requests.push(`${r.method()} ${r.url()}`))
  await open(page, '/create')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Add photos').setInputFiles({ name: 'kemi.png', mimeType: 'image/png', buffer: PNG })
  await page.getByLabel('Caption for photo 1').fill('Kemi at the market')
  await page.getByLabel('What do you love about how they are?').fill('You hum when you cook and pretend you don’t.')
  await page.getByLabel('Habit 1', { exact: true }).fill('Leaves one sip in every cup')
  await page.getByLabel('Habit 2', { exact: true }).fill('Says five minutes, means forty')
  await page.getByLabel('Habit 3', { exact: true }).fill('Names every plant in the house')
  await expect(page.locator('.sb-count')).toHaveText('5 of 9 scenes ready')
  await page.getByRole('button', { name: 'Build the story' }).click()

  await page.getByRole('button', { name: 'Admit one: Kemi. Tap to begin' }).click()
  const seen: string[] = []
  for (let i = 0; i < 20; i++) {
    seen.push(await page.locator('.gift-stage').innerText())
    if (await page.getByRole('button', { name: 'Next' }).isDisabled()) break
    await page.getByRole('button', { name: 'Next' }).click()
  }
  const all = seen.join('\n')
  for (const text of ['You hum when you cook', 'Leaves one sip in every cup', 'Says five minutes, means forty', 'Names every plant', 'Kemi at the market']) {
    expect(all).toContain(text)
  }
  await page.getByRole('button', { name: 'Scene 3: The main character' }).click()
  await expect(page.locator('.gift-stage img')).toHaveAttribute('src', /^blob:/)
  expect(requests).toEqual([])
})

test('shuffle rebuilds from the ticket with the same content, and edit keeps the draft', async ({ page }) => {
  await open(page, '/create')
  await page.getByRole('button', { name: 'Fill with the sample' }).click()
  await page.getByRole('button', { name: 'Build the story' }).click()
  const meta = page.locator('.preview-meta')
  const order = async () => page.locator('.chapter').evaluateAll((els) => els.map((e) => e.getAttribute('title')).join('|'))
  await page.getByRole('button', { name: /Tap to begin/ }).click()
  const versions = new Set<string>()
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: 'Shuffle' }).click()
    await expect(page.getByRole('button', { name: /Tap to begin/ })).toBeVisible()
    await page.getByRole('button', { name: /Tap to begin/ }).click()
    versions.add(`${await meta.innerText()}#${await order()}`)
    expect((await order()).split('|').sort()).toHaveLength(9)
  }
  expect(versions.size).toBeGreaterThan(1)
  await page.getByRole('link', { name: 'Edit details' }).click()
  await expect(page.getByLabel('Their name')).toHaveValue('Zara')
})

test('sound can be muted and the preview has an honest empty state', async ({ page }) => {
  await open(page, '/preview')
  await expect(page.getByRole('heading', { name: 'There’s no story to preview yet.' })).toBeVisible()
  await page.getByRole('link', { name: 'Play the sample' }).click()
  await expect(page.getByText('Fictional sample, AI-generated photos')).toBeVisible()
  await page.getByRole('button', { name: /Tap to begin/ }).click()
  await page.getByRole('button', { name: 'Sound on' }).click()
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'true')
  expect((await audioState(page))!.muted).toBe(true)
  await page.keyboard.press('m')
  expect((await audioState(page))!.muted).toBe(false)
})

for (const width of [360, 768, 1360]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await open(page, '/create')
    await page.getByRole('button', { name: 'Fill with the sample' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.getByRole('button', { name: 'Build the story' }).click()
    await page.getByRole('button', { name: /Tap to begin/ }).click()
    for (let i = 0; i < 25; i++) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      if (await page.getByRole('button', { name: 'Next' }).isDisabled()) break
      await page.getByRole('button', { name: 'Next' }).click()
    }
  })
}
