import { expect, test } from '@playwright/test'
import { audioState, chooseStyle, filmState, open, startFilm } from './helpers'

test('end to end: build, write and make a song, lock, send, recipient unlocks and plays, sender deletes', async ({ page, browser, baseURL }) => {
  // Against a running server (E2E_BASE_URL) the song may be a real one, which takes about a minute to make.
  const live = Boolean(process.env.E2E_BASE_URL)
  test.setTimeout(live ? 600_000 : 90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // Sender builds a story from the sample details.
  await open(page, '/create')
  await page.getByRole('button', { name: 'Fill with the sample' }).click()
  // Building the film has its song made: the studio writes the words from the sender's details (never the letter).
  const wordsRequest = page.waitForRequest((r) => r.url().endsWith('/api/lyrics') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Build the story' }).click()
  const brief = (await wordsRequest).postDataJSON() as { details?: Record<string, unknown> }
  expect(brief.details).toMatchObject({ occasion: 'birthday', recipient: 'Zara', sender: 'Tobi' })
  expect(JSON.stringify(brief)).not.toContain('holding everything together')

  // Light edits: pick the kind of film, its colours and a scene's design. These travel with the gift.
  await chooseStyle(page, 'The Scrapbook')
  await expect(page.locator('.film')).toHaveAttribute('data-world', 'scrapbook')
  await page.getByRole('button', { name: 'Scenes' }).click()
  const memory = page.locator('.scene-row').filter({ hasText: 'Memory lane' })
  await page.getByRole('button', { name: 'Another design for Memory lane' }).click()
  const memoryDesign = (await memory.locator('small').textContent()) === 'Clipped cards' ? 'clipped' : 'taped'
  await page.getByRole('button', { name: 'Leave out The camera roll' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.locator('.song-status')).toHaveCount(0, { timeout: live ? 260_000 : 15_000 })
  await page.getByRole('button', { name: /^Style/ }).click()
  await page.getByRole('radio', { name: 'White card' }).check()
  await expect(page.locator('.film')).toHaveAttribute('data-look', 'paper')

  // The song can be rewritten and sung again. Its words are the ones the studio wrote for the first take.
  await page.getByRole('link', { name: 'Change the song' }).click()
  await expect(page.getByRole('heading', { name: 'Zara’s song' })).toBeVisible()
  await expect(page.getByText(/studio score/i)).toHaveCount(0)
  const sheet = page.getByLabel('Lyrics')
  await expect(sheet).toHaveValue(/Zara/, { timeout: live ? 90_000 : 5_000 })
  await expect(page.getByLabel('Song title')).not.toHaveValue('')

  // The sender changes the words. A line from the old birthday song is caught before any music is made.
  const written = await sheet.inputValue()
  await sheet.fill(`${written}\nHappy birthday to you`)
  await expect(page.getByRole('alert')).toContainText('line from another song')
  await expect(page.getByRole('button', { name: 'Make another take' })).toBeDisabled()
  await sheet.fill(`${written}\nAnd yes, you can have my chips`)
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Pick a tune by ear.
  const sample = page.waitForResponse((r) => r.url().endsWith('/tunes/highlife.mp3'))
  await page.getByRole('button', { name: 'Hear Highlife guitar' }).click()
  expect((await sample).status()).toBeLessThan(300)
  await page.getByRole('button', { name: 'Stop Highlife guitar' }).click()
  await page.getByRole('radio', { name: /^Highlife guitar/ }).check()

  // Hear it sung: the approved words go to the music model as they are.
  const songRequest = page.waitForRequest((r) => r.url().endsWith('/api/music') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Make another take' }).click()
  const asked = (await songRequest).postDataJSON() as { vibe: string; details?: Record<string, unknown>; lyrics?: string }
  expect(asked.vibe).toBe('highlife')
  expect(asked.details).toMatchObject({ recipient: 'Zara', sender: 'Tobi' })
  expect(asked.lyrics).toContain('And yes, you can have my chips')
  expect(JSON.stringify(asked)).not.toContain('holding everything together')
  await expect(page.getByRole('radio', { name: 'Take 2, Highlife guitar' })).toBeChecked({ timeout: live ? 260_000 : 5_000 })
  await expect(page.getByRole('button', { name: 'Make another take' })).toBeEnabled()
  await page.getByRole('link', { name: 'Play the film with this song' }).click()
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId).toBe('song')
  await page.getByRole('button', { name: /^Style/ }).click()
  await page.getByText('Read the lyrics').click()
  await expect(page.locator('.song-lyrics')).toContainText('And yes, you can have my chips')
  await page.getByRole('button', { name: 'Done' }).click()

  // Lock and send.
  await page.getByRole('link', { name: 'Send this gift' }).click()
  await expect(page.locator('.gift-summary')).toContainText('written for Zara')
  await expect(page.locator('.gift-summary')).toContainText('8 scenes, The Scrapbook, White card look')
  // What is wrong with the lock is said beside the field, as soon as it is known, and nothing is sent.
  const posts: string[] = []
  page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/gifts') && posts.push(r.url()))
  await page.getByRole('button', { name: 'Create the private link' }).click()
  await expect(page.locator('#lock-question-error')).toHaveText('Add a question.')
  await expect(page.locator('#lock-answer-error')).toHaveText('Add the answer that opens it.')
  await expect(page.getByLabel('A question only Zara can answer')).toBeFocused()
  await expect(page.getByLabel('A question only Zara can answer')).toHaveAttribute('aria-invalid', 'true')
  await page.getByLabel('A question only Zara can answer').fill('Did you call me a cheat?')
  await expect(page.locator('#lock-question-error')).toHaveCount(0)
  await page.getByLabel('The answer').fill('a cheat')
  await expect(page.locator('#lock-answer-error')).toHaveText('The question gives this answer away. Change one of them.')
  await page.getByRole('button', { name: 'Create the private link' }).click()
  await expect(page.getByLabel('The answer')).toBeFocused()
  expect(posts).toEqual([])
  await page.getByLabel('A question only Zara can answer').fill('What did you call me at games night?')
  await page.getByLabel('The answer').fill('A cheat')
  await page.getByRole('button', { name: 'Create the private link' }).click()
  // Against a live server the photos go over a real uplink, which can be slow.
  await expect(page.getByRole('heading', { name: 'Zara’s gift is ready.' })).toBeVisible({ timeout: live ? 180_000 : 30_000 })
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

  await expect(recipient.getByRole('button', { name: 'A book made for Zara. Tap to open' })).toBeVisible()
  await startFilm(recipient)
  await expect.poll(async () => (await audioState(recipient))?.trackId).toBe('song')
  const t1 = (await audioState(recipient))!.currentTime
  await recipient.waitForTimeout(500)
  expect((await audioState(recipient))!.currentTime).toBeGreaterThan(t1)
  expect((await audioState(recipient))!.song).toBe(`/api/media/${slug}/song`)
  // The locked song is streamed with the unlock cookie, not downloaded whole first.
  expect((await audioState(recipient))!.songMode).toBe('stream')
  await expect(recipient.locator('.film')).toHaveAttribute('data-look', 'paper')
  await expect(recipient.locator('.film')).toHaveAttribute('data-world', 'scrapbook')
  // The sender's cut came with it: no camera roll, and the memory design they picked.
  expect(await recipient.locator('.film-controls .mark').evaluateAll((els) => els.map((e) => e.getAttribute('title')))).not.toContain('The camera roll')

  // Walk to a photo and check it loaded from the private store.
  for (let i = 0; i < 30 && (await filmState(recipient)).kind !== 'photo'; i++) await recipient.keyboard.press('ArrowRight')
  const img = recipient.locator('.shot.is-current img').first()
  await expect(img).toHaveAttribute('src', new RegExp(`^/api/media/${slug}/`))
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

  // The memories are drawn in the design the sender picked.
  for (let i = 0; i < 12 && !['taped', 'clipped'].includes((await recipient.locator('.shot.is-current').getAttribute('data-design')) ?? ''); i++) await recipient.keyboard.press('ArrowRight')
  await expect(recipient.locator('.shot.is-current')).toHaveAttribute('data-design', memoryDesign)

  // Reloading keeps the gift open for the recipient.
  await open(recipient, link)
  await expect(recipient.getByRole('button', { name: /Tap to open/ })).toBeVisible()

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
