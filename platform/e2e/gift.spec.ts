import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { audioState, chooseStyle, closeEditor, filmState, open, openEditor, pickScene, startFilm, trackErrors, walk } from './helpers'

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
  const film = page.locator('.preview-body > .film')
  await expect(film).toHaveAttribute('data-world', 'scrapbook')
  await openEditor(page)
  await pickScene(page, 'Memory lane')
  await page.getByRole('button', { name: 'Another design for Memory lane' }).click()
  const memoryDesign = (await page.locator('.scene-panel .scene-design').textContent()) === 'Clipped cards' ? 'clipped' : 'taped'
  await pickScene(page, 'The camera roll')
  await page.getByRole('button', { name: 'Leave out The camera roll' }).click()
  await expect(page.locator('.song-status')).toHaveCount(0, { timeout: live ? 260_000 : 15_000 })
  await page.getByRole('button', { name: /^Look/ }).click()
  await page.getByRole('radio', { name: 'White card' }).check()
  await expect(film).toHaveAttribute('data-look', 'paper')

  // The song can be rewritten and sung again. Its words are the ones the studio wrote for the first take.
  await page.getByRole('link', { name: 'Hear it or change it' }).click()
  await expect(page.getByText(/studio score/i)).toHaveCount(0)
  // The words are on their paper, open to be typed on. With nothing changed, the one button offers the same song again.
  const sheet = page.getByLabel('Lyrics')
  const recordIt = page.locator('.song-record')
  await expect(recordIt).toContainText('Record it again')
  await expect(recordIt).toContainText('same words, voice and tune')
  await expect(sheet).toHaveValue(/Zara/, { timeout: live ? 90_000 : 5_000 })
  await expect(page.getByLabel('Song title')).not.toHaveValue('')

  // The sender changes the words. A line from the old birthday song is caught before any music is made.
  const written = await sheet.inputValue()
  await sheet.fill(`${written}\nHappy birthday to you`)
  await expect(page.getByRole('alert')).toContainText('line from another song')
  await expect(recordIt).toBeDisabled()
  await sheet.fill(`${written}\nAnd yes, you can have my chips`)
  await expect(page.getByRole('alert')).toHaveCount(0)
  // The button now says what it will record.
  await expect(recordIt).toContainText('Make a new recording')
  await expect(recordIt).toContainText('with your new words')

  // Pick a tune by ear. The changed words stay on the paper, and the new tune sings them.
  await page.locator('.song-tune').click()
  const sample = page.waitForResponse((r) => r.url().endsWith('/tunes/highlife.mp3'))
  await page.getByRole('button', { name: 'Hear Highlife guitar' }).click()
  expect((await sample).status()).toBeLessThan(300)
  await page.getByRole('button', { name: 'Stop Highlife guitar' }).click()
  await page.getByRole('radio', { name: /^Highlife guitar/ }).check()

  // Hear it sung: the approved words go to the music model as they are.
  const songRequest = page.waitForRequest((r) => r.url().endsWith('/api/music') && r.method() === 'POST')
  await expect(recordIt).toContainText('with your new words, Highlife guitar')
  await recordIt.click()
  const asked = (await songRequest).postDataJSON() as { vibe: string; details?: Record<string, unknown>; lyrics?: string }
  expect(asked.vibe).toBe('highlife')
  expect(asked.details).toMatchObject({ recipient: 'Zara', sender: 'Tobi' })
  expect(asked.lyrics).toContain('And yes, you can have my chips')
  expect(JSON.stringify(asked)).not.toContain('holding everything together')
  await expect(page.getByRole('group', { name: 'Recordings' })).toContainText('2 of 2', { timeout: live ? 260_000 : 5_000 })
  await expect(page.locator('#song-tune-now')).toHaveText('Highlife guitar')
  // The new recording is the film's song, its words are the ones on the paper, and there is nothing new left to record.
  await expect(sheet).toHaveValue(/And yes, you can have my chips/)
  await expect(recordIt).toContainText('Record it again')
  await closeEditor(page)
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId).toBe('song')
  await openEditor(page, 'Song')
  await expect(page.getByLabel('Lyrics')).toHaveValue(/And yes, you can have my chips/)
  await closeEditor(page)

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

test('a video clip plays silently in the film, is a still in the editor, and travels with the gift', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  const clip = readFileSync(new URL('./fixtures/clip.mp4', import.meta.url))
  await open(page, '/start')
  await page.getByRole('button', { name: 'Friend', exact: true }).click()
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByLabel('Your name').press('Enter')
  // An occasion of the sender's own goes on the ticket in their words.
  await page.getByRole('button', { name: 'Something else' }).click()
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.getByLabel('What’s it for?').fill('Your first day')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.locator('.maker-occasion')).toHaveText('Your first day')

  // A clip goes in beside the photos, marked as one. A file that is no video is named, not taken.
  await page.getByLabel('Add photos', { exact: true }).setInputFiles([
    { name: 'wave.mp4', mimeType: 'video/mp4', buffer: clip },
    { name: 'broken.mov', mimeType: 'video/quicktime', buffer: Buffer.from('not a video at all') },
  ])
  await expect(page.locator('.start-photos .clip-mark')).toHaveCount(1)
  await expect(page.getByRole('alert')).toContainText('couldn’t be played by this browser')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('About Kemi').fill('Moving day. The lift broke, and you carried the sofa up five floors arguing about the angle. You never finish your tea.')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip these' }).click()
  await page.getByRole('button', { name: 'Make the film' }).click()
  await expect(page).toHaveURL(/\/preview$/)
  await expect(page.locator('.song-status')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('.film').first()).toContainText('Your first day')

  // In the film the clip plays where a photo would: moving, looping, and silent under the song.
  const playing = async (film: typeof page) => {
    await startFilm(film)
    await walk(film, (shot) => shot.kind === 'photo')
    const video = film.locator('.film:not(.still) .shot.is-current video')
    await expect(video).toHaveCount(1)
    expect(await video.evaluate((v: HTMLVideoElement) => [v.muted, v.loop, v.playsInline])).toEqual([true, true, true])
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2)
    expect(await video.evaluate((v: HTMLVideoElement) => v.getBoundingClientRect().width)).toBeGreaterThan(80)
    return video
  }
  await playing(page)
  // In the editor's stills it is its first frame, not a second film playing.
  await openEditor(page)
  await page.getByRole('button', { name: 'Stop' }).click()
  await pickScene(page, 'Moving day')
  await expect(page.locator('.stage-still-frame .shot img')).toHaveCount(1)
  await expect(page.locator('.stage-still-frame video, .scene-strip video')).toHaveCount(0)
  await closeEditor(page)

  // Sent, it is stored with the gift and plays for the recipient from behind the lock.
  await page.getByRole('link', { name: 'Send this gift' }).click()
  await page.getByLabel('A question only Kemi can answer').fill('What broke on moving day?')
  await page.getByLabel('The answer').fill('The lift')
  await page.getByRole('button', { name: 'Create the private link' }).click()
  const link = await page.getByLabel('Their private link').inputValue()
  const slug = link.split('/g/')[1]
  const recipient = await (await browser.newContext()).newPage()
  await open(recipient, link)
  await recipient.getByLabel('What broke on moving day?').fill('the lift')
  await recipient.getByRole('button', { name: 'Open it' }).click()
  const video = await playing(recipient)
  expect(await video.getAttribute('src')).toMatch(new RegExp(`^/api/media/${slug}/p-[a-z0-9-]+-clip$`))
  expect(await video.getAttribute('poster')).toMatch(new RegExp(`^/api/media/${slug}/p-`))
  // Like the photos, it can't be fetched without unlocking.
  const fresh = await (await browser.newContext()).newPage()
  expect((await fresh.request.get(new URL((await video.getAttribute('src'))!, link).href)).status()).toBe(401)
  expect(errors).toEqual([])
})

test('voice notes are heard in a scene of their own, a page a voice, and travel with the gift', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  const note = readFileSync(new URL('./fixtures/voice.ogg', import.meta.url))
  await open(page, '/start')
  await page.getByRole('button', { name: 'Friend', exact: true }).click()
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByLabel('Your name').press('Enter')
  await page.getByRole('button', { name: 'Thank you' }).click()

  // Two voice notes go in the tray: the sender's own, and one somebody else recorded, named here.
  await page.getByLabel('Upload voice notes').setInputFiles([
    { name: 'mine.ogg', mimeType: 'audio/ogg', buffer: note },
    { name: 'dad.ogg', mimeType: 'audio/ogg', buffer: note },
  ])
  await expect(page.locator('.voice-tile')).toHaveCount(2)
  await page.getByLabel('Who is speaking in voice note 2').fill('Dad')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('About Kemi').fill('Moving day. The lift broke, and you carried the sofa up five floors arguing about the angle. You never finish your tea.')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip these' }).click()
  await page.getByRole('button', { name: 'Make the film' }).click()
  await expect(page).toHaveURL(/\/preview$/)
  await expect(page.locator('.song-status')).toHaveCount(0, { timeout: 15_000 })

  // The film has a scene for them, named by who speaks, where each can be changed.
  await openEditor(page)
  await expect(page.locator('.scene-tile-name').filter({ hasText: 'From all of us' })).toHaveCount(1)
  await pickScene(page, 'From all of us')
  await expect(page.locator('.voice-row')).toHaveCount(2)
  await expect(page.locator('.voice-row').nth(1).getByLabel(/Who is speaking/)).toHaveValue('Dad')
  await closeEditor(page)

  // Each voice has its own page: the name, and a bar that fills as the recording plays.
  const heard = async (film: typeof page) => {
    await startFilm(film)
    for (const who of ['Ada', 'Dad']) {
      await walk(film, (shot) => shot.kind === 'voice' && shot.text.startsWith(who))
      const current = film.locator('.film:not(.still) .shot.is-current')
      // Drawn by whichever template the film was given: the name is its `who`.
      await expect(current.locator('[data-slot="who"]').first()).toHaveText(who, { ignoreCase: true })
      await expect.poll(() => film.evaluate(() => Number(document.documentElement.dataset.voice ?? 0)), { timeout: 15_000 }).toBeGreaterThan(1)
      expect(await film.evaluate(() => Number(getComputedStyle(document.documentElement).getPropertyValue('--voice-at')))).toBeGreaterThan(0.05)
    }
  }
  await heard(page)

  // Sent, the recordings are stored with the gift and play for the recipient from behind the lock.
  await page.getByRole('link', { name: 'Send this gift' }).click()
  await page.getByLabel('A question only Kemi can answer').fill('What broke on moving day?')
  await page.getByLabel('The answer').fill('The lift')
  await page.getByRole('button', { name: 'Create the private link' }).click()
  const link = await page.getByLabel('Their private link').inputValue()
  const slug = link.split('/g/')[1]
  const recipient = await (await browser.newContext()).newPage()
  const fetched: string[] = []
  recipient.on('request', (r) => r.url().endsWith('-voice') && fetched.push(new URL(r.url()).pathname))
  await open(recipient, link)
  await recipient.getByLabel('What broke on moving day?').fill('the lift')
  await recipient.getByRole('button', { name: 'Open it' }).click()
  await heard(recipient)
  expect(new Set(fetched).size).toBe(2)
  for (const path of fetched) expect(path).toMatch(new RegExp(`^/api/media/${slug}/v-[a-z0-9]+-voice$`))
  const fresh = await (await browser.newContext()).newPage()
  expect((await fresh.request.get(new URL(fetched[0], link).href)).status()).toBe(401)
  expect(errors).toEqual([])
})
