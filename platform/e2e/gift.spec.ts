import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function open(page: Page, url: string) {
  await page.goto(url)
  await page.waitForSelector('html[data-ready="true"]', { timeout: 30_000 })
}
const audioState = (page: Page) => page.evaluate(() => window.__ltAudio?.state())

test('end to end: build, add an AI song, lock, send, recipient unlocks and plays, sender deletes', async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // Sender builds a story from the sample details.
  await open(page, '/create')
  await page.getByRole('button', { name: 'Fill with the sample' }).click()
  await page.getByRole('button', { name: 'Build the story' }).click()

  // Light edits: pick a look and make an original song (demo provider in tests).
  await page.getByRole('button', { name: 'Look & music' }).click()
  await page.getByRole('radio', { name: 'Paper' }).check()
  await expect(page.locator('.gift')).toHaveAttribute('data-look', 'paper')
  await page.getByLabel('Song style').selectOption('highlife')
  await page.getByRole('button', { name: 'Make an original song' }).click()
  await expect(page.getByRole('radio', { name: 'Highlife guitar, original AI song' })).toBeChecked()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: /Tap to begin/ }).click()
  await expect.poll(async () => (await audioState(page))?.trackId).toBe('song')

  // Lock and send.
  await page.getByRole('link', { name: 'Send this gift' }).click()
  await expect(page.locator('.gift-summary')).toContainText('Highlife guitar, original AI song')
  await expect(page.locator('.gift-summary')).toContainText('Paper look')
  await page.getByLabel('A question only Zara can answer').fill('What did you call me at games night?')
  await page.getByLabel('The answer').fill('A cheat')
  await page.getByRole('button', { name: 'Create the private link' }).click()
  await expect(page.getByRole('heading', { name: 'Zara’s gift is ready.' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Made in the test version: nothing was charged.')).toBeVisible()
  const link = await page.getByLabel('Their private link').inputValue()
  expect(link).toMatch(new RegExp(`^${baseURL}/g/[a-z0-9]{12}$`))
  const manageUrl = page.url()
  expect(manageUrl).toContain('#k=')

  // The recipient, in a separate browser with no cookies.
  const recipientContext = await browser.newContext()
  const recipient = await recipientContext.newPage()
  await open(recipient, link)
  await expect(recipient.getByText('What did you call me at games night?')).toBeVisible()
  await expect(recipient.locator('body')).not.toContainText('Zara')
  await expect(recipient.locator('body')).not.toContainText('Tobi')

  // Photos can't be fetched before unlocking.
  const story = await page.request.get(link.replace('/g/', '/api/gift/'))
  expect(story.status()).toBe(401)
  const slug = link.split('/g/')[1]
  expect((await recipient.request.get(`/api/media/${slug}/p-cafe`)).status()).toBe(401)

  await recipient.getByLabel('What did you call me at games night?').fill('a thief')
  await recipient.getByRole('button', { name: 'Open it' }).click()
  await expect(recipient.getByRole('alert')).toHaveText('That’s not it. Try again.')
  await recipient.getByLabel('What did you call me at games night?').fill('  a CHEAT ')
  await recipient.getByRole('button', { name: 'Open it' }).click()

  await recipient.getByRole('button', { name: 'Admit one: Zara. Tap to begin' }).click()
  await expect.poll(async () => (await audioState(recipient))?.trackId).toBe('song')
  const t1 = (await audioState(recipient))!.currentTime
  await recipient.waitForTimeout(500)
  expect((await audioState(recipient))!.currentTime).toBeGreaterThan(t1)
  expect((await audioState(recipient))!.song).toBe(`/api/media/${slug}/song`)
  await expect(recipient.locator('.gift')).toHaveAttribute('data-look', 'paper')

  // Walk to a photo and check it loaded from the private store.
  for (let i = 0; i < 30 && !(await recipient.locator('.gift-stage img').first().isVisible()); i++) await recipient.keyboard.press('ArrowRight')
  const img = recipient.locator('.gift-stage img').first()
  await expect(img).toHaveAttribute('src', new RegExp(`^/api/media/${slug}/`))
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

  // Reloading keeps the gift open for the recipient.
  await open(recipient, link)
  await expect(recipient.getByRole('button', { name: /Tap to begin/ })).toBeVisible()

  // The sender deletes it; the link stops working.
  await page.getByRole('button', { name: 'Delete this gift' }).click()
  await page.getByRole('button', { name: 'Yes, delete it permanently' }).click()
  await expect(page.getByRole('heading', { name: 'The gift has been deleted.' })).toBeVisible()
  await open(recipient, link)
  await expect(recipient.getByRole('heading', { name: 'This gift isn’t here.' })).toBeVisible()
  expect((await recipient.request.get(`/api/media/${slug}/p-cafe`)).status()).toBe(404)

  await recipientContext.close()
  expect(errors).toEqual([])
})

test('the manage page needs its private key', async ({ page }) => {
  await open(page, '/manage/abcdefghjkmn')
  await expect(page.getByRole('heading', { name: 'We can’t find that gift.' })).toBeVisible()
})

test('send page has an empty state without a draft', async ({ page }) => {
  await open(page, '/send')
  await expect(page.getByRole('heading', { name: 'There’s nothing to send yet.' })).toBeVisible()
})
