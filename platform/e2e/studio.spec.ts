import { expect, test } from '@playwright/test'
import { audioState, filmState, open, startFilm, trackErrors, walk } from './helpers'

// Tiny valid PNG (1x1) for upload tests.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test('the sample becomes a film that plays by itself, with sound, to the wish and the credits', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  await open(page, '/')
  await page.getByRole('link', { name: 'Start a birthday story' }).first().click()
  await expect(page.locator('.reel-count')).toHaveText('0 of 9 scenes ready')
  await expect(page.getByRole('button', { name: 'Build the story' })).toBeDisabled()
  await page.getByRole('button', { name: 'Fill with the sample' }).click()
  await expect(page.locator('.reel-count')).toHaveText('9 of 9 scenes ready')
  await page.getByRole('button', { name: 'Build the story' }).click()
  await expect(page).toHaveURL(/\/preview$/)

  // The ticket tears, a leader counts in, then the film runs on its own clock.
  await page.getByRole('button', { name: 'Admit one: Zara. Tap to begin' }).click()
  await expect(page.locator('.film')).toHaveAttribute('data-phase', 'leader')
  await expect(page.locator('.leader-count')).toHaveText('3')
  await expect(page.locator('.film')).toHaveAttribute('data-phase', 'playing', { timeout: 10_000 })
  await expect.poll(async () => (await audioState(page))?.running).toBe(true)
  const t1 = (await audioState(page))!.currentTime
  const first = await filmState(page)
  expect(first.text).toBe('For Zara. From Tobi.')

  // No input: it moves to the next shot by itself, and their name is drawn in.
  await expect.poll(async () => (await filmState(page)).kind, { timeout: 15_000 }).toBe('name')
  await expect(page.locator('.shot.is-current .name')).toHaveClass(/is-solid/, { timeout: 8_000 })
  const s = (await audioState(page))!
  expect(s.currentTime).toBeGreaterThan(t1)
  expect(s.trackId).toBeTruthy()

  // Pause holds the picture and the music; play continues.
  await page.getByRole('button', { name: 'Pause' }).click()
  const held = (await filmState(page)).time
  await expect.poll(async () => (await audioState(page))?.suspended).toBe(true)
  await page.waitForTimeout(700)
  expect((await filmState(page)).time).toBe(held)
  await page.getByRole('button', { name: 'Play' }).click()
  await expect.poll(async () => (await filmState(page)).time).toBeGreaterThan(held)

  // Skip ahead to the candle. The film waits there.
  const shots = await walk(page, (shot) => shot.kind === 'wish')
  expect(shots.map((x) => x.kind)).toEqual(expect.arrayContaining(['card', 'photo', 'flag', 'reason', 'montage', 'letter', 'wish']))
  const blow = page.getByRole('button', { name: 'Blow out the candle' })
  await expect(blow).toBeVisible()
  await page.waitForTimeout(6500)
  expect((await filmState(page)).kind).toBe('wish')
  await blow.click()
  await expect(page.getByRole('status')).toContainText('you can have my chips')
  await expect(page.locator('.shot.is-current .reveal')).toHaveClass(/is-solid/, { timeout: 8_000 })

  // Credits, then it can be watched again.
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('status')).toContainText('Starring: Zara')
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.getByRole('button', { name: 'Watch it again' }).click()
  await expect.poll(async () => (await filmState(page)).shot).toBe(0)
  expect(errors).toEqual([])
})

test('the sender’s own words and uploaded photo appear, and nothing is sent while drafting', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => r.method() !== 'GET' && requests.push(`${r.method()} ${r.url()}`))
  await open(page, '/create')
  // One question at a time, and the scene beside it fills in as they type.
  const scene = page.locator('.projection')
  await expect(scene.locator('.film')).toHaveClass(/is-ghost/)
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await expect(scene.locator('.ticket-name')).toHaveText('Kemi')
  await expect(scene.locator('.film')).not.toHaveClass(/is-ghost/)
  await page.getByRole('button', { name: 'Next: photos' }).click()
  await page.getByLabel('Add photos').setInputFiles({ name: 'kemi.png', mimeType: 'image/png', buffer: PNG })
  await page.getByLabel('Caption for photo 1').fill('Kemi at the market')
  await page.getByRole('button', { name: 'Next: main character' }).click()
  await page.getByRole('textbox', { name: 'What do you love about how Kemi is?' }).fill('You hum when you cook and pretend you don’t.')
  await expect(scene.locator('.shot')).toContainText('You hum when you cook')
  await expect(scene.locator('.shot img')).toHaveAttribute('src', /^blob:/)

  // The strip of frames jumps anywhere; Enter moves down a list.
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Red flags' }).click()
  await expect(page.locator('.scene-line')).toHaveText('Not in the film yet: Red flags. Add 3 more habits.')
  await page.getByLabel('Habit 1', { exact: true }).fill('Leaves one sip in every cup')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Says five minutes, means forty')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Names every plant in the house')
  await expect(page.getByLabel('Habit 2', { exact: true })).toHaveValue('Says five minutes, means forty')
  await expect(page.getByLabel('Habit 3', { exact: true })).toHaveValue('Names every plant in the house')
  await expect(scene.locator('.shot')).toContainText('Names every plant in the house')
  await expect(page.locator('.scene-line')).toHaveText('In the film: Red flags.')
  await expect(page.locator('.reel-count')).toHaveText('5 of 9 scenes ready')
  await page.getByRole('button', { name: 'Build the story' }).click()

  await page.getByRole('button', { name: 'Admit one: Kemi. Tap to begin' }).click()
  await page.waitForFunction(() => window.__ltFilm?.phase() === 'playing', undefined, { timeout: 15_000 })
  const all = (await walk(page)).map((s) => s.text).join('\n')
  for (const text of ['You hum when you cook', 'Leaves one sip in every cup', 'Says five minutes, means forty', 'Names every plant', 'Kemi at the market', 'For Kemi. From Ada.']) {
    expect(all).toContain(text)
  }
  await page.getByRole('button', { name: 'Scene 2: The main character' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.locator('.shot.is-current img')).toHaveAttribute('src', /^blob:/)
  expect(requests).toEqual([])
})

test('shuffle rebuilds from the ticket with the same content, and edit keeps the draft', async ({ page }) => {
  test.setTimeout(120_000)
  await open(page, '/create')
  await page.getByRole('button', { name: 'Fill with the sample' }).click()
  await page.getByRole('button', { name: 'Build the story' }).click()
  const meta = page.locator('.preview-meta')
  const order = async () => page.locator('.film-controls .mark').evaluateAll((els) => els.map((e) => e.getAttribute('title')).join('|'))
  await startFilm(page)
  const versions = new Set<string>()
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Shuffle' }).click()
    await expect(page.locator('.film')).toHaveAttribute('data-phase', 'ticket')
    await startFilm(page)
    versions.add(`${await meta.innerText()}#${await order()}`)
    expect((await order()).split('|').sort()).toHaveLength(8)
  }
  expect(versions.size).toBeGreaterThan(1)
  await page.getByRole('link', { name: /^Edit/ }).click()
  await expect(page.getByLabel('Their name')).toHaveValue('Zara')
})

test('sound can be muted and the preview has an honest empty state', async ({ page }) => {
  await open(page, '/preview')
  await expect(page.getByRole('heading', { name: 'There’s no story to preview yet.' })).toBeVisible()
  await page.getByRole('link', { name: 'Play the sample' }).click()
  await expect(page.getByText('Fictional sample, AI-generated photos')).toBeVisible()
  await startFilm(page)
  await page.getByRole('button', { name: 'Sound on' }).click()
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'true')
  expect((await audioState(page))!.muted).toBe(true)
  await page.keyboard.press('m')
  expect((await audioState(page))!.muted).toBe(false)
})

test('with reduced motion the film skips the countdown and still plays', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await open(page, '/preview?sample=1')
  await page.getByRole('button', { name: /Tap to begin/ }).click()
  await expect(page.locator('.film')).toHaveAttribute('data-phase', 'playing', { timeout: 2_000 })
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.shot.is-current .name')).toHaveClass(/is-solid/)
  await expect(page.locator('.shot.is-current .name')).toHaveText('Zara')
  await context.close()
})

for (const [width, height] of [[360, 740], [768, 900], [1360, 800]]) {
  test(`nothing spills off screen at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height })
    await open(page, '/create')
    await page.getByRole('button', { name: 'Fill with the sample' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    // Every step of the form fits, then the film.
    for (const step of ['photos', 'main character', 'memories', 'red flags', 'reasons', 'letter', 'the wish', 'look']) {
      await page.getByRole('button', { name: /^Next/ }).click()
      await expect(page).toHaveURL(/step=/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `the ${step} step is wider than the screen`).toBeLessThanOrEqual(width)
    }
    await page.getByRole('button', { name: 'Build the story' }).click()
    await startFilm(page)
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(350)
      const fit = await page.evaluate(() => {
        const frame = document.querySelector('.film-frame')!.getBoundingClientRect()
        const spill = Array.from(document.querySelectorAll<HTMLElement>('.shot.is-current .type, .shot.is-current .blow, .shot.is-current .again'))
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.left < frame.left - 1 || r.right > frame.right + 1))
        return { page: document.documentElement.scrollWidth, spill: spill.length, kind: document.querySelector<HTMLElement>('.shot.is-current')?.dataset.shotKind }
      })
      expect(fit.page).toBeLessThanOrEqual(width)
      expect(fit.spill, `text off screen in a ${fit.kind} shot`).toBe(0)
      const next = page.getByRole('button', { name: 'Next' })
      if (await next.isDisabled()) break
      await next.click()
    }
  })
}
