import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { audioState, chooseStyle, filmState, open, startFilm, trackErrors, walk } from './helpers'
import { OCCASIONS } from '../src/story/occasions'

// Tiny valid PNG (1x1) for upload tests.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test('the sample becomes a film that plays by itself, with sound, to the wish and the credits', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  // The detailed form, where every scene is written by hand.
  await open(page, '/create')
  await expect(page.getByRole('radio', { name: 'Birthday' })).toBeChecked()
  await expect(page.locator('.reel-count')).toHaveText('0 of 9 scenes ready')
  await expect(page.getByRole('button', { name: 'Build the story' })).toBeDisabled()
  await page.getByRole('button', { name: 'Fill with the sample' }).click()
  await expect(page.locator('.reel-count')).toHaveText('9 of 9 scenes ready')
  await page.getByRole('button', { name: 'Build the story' }).click()
  await expect(page).toHaveURL(/\/preview$/)
  await chooseStyle(page, 'The Screening')

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
  await expect(page.locator('.scene-line')).toHaveText('Not in the film yet: Red flags. Add 2 more habits.')
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
  await chooseStyle(page, 'The Screening')

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
  const order = async () => page.locator('.film-controls .mark').evaluateAll((els) => els.map((e) => e.getAttribute('title')).join('|'))
  await startFilm(page)
  const versions = new Set<string>()
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Shuffle' }).click()
    await expect(page.locator('.film')).toHaveAttribute('data-phase', 'ticket')
    await startFilm(page)
    versions.add(await order())
    expect((await order()).split('|').sort()).toHaveLength(8)
  }
  expect(versions.size).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Scenes' }).click()
  await page.getByRole('link', { name: 'edit every detail' }).click()
  await expect(page.getByLabel('Their name')).toHaveValue('Zara')
})

test('sound can be muted and the preview has an honest empty state', async ({ page }) => {
  await open(page, '/preview')
  await expect(page.getByRole('heading', { name: 'There’s no film to preview yet.' })).toBeVisible()
  await page.getByRole('link', { name: 'Play the sample' }).click()
  // The header carries only the controls: no scene count and no notice crowding it.
  await expect(page.locator('.studio-header')).not.toContainText(/scenes|Fictional|AI/)
  // The sample opens in the light look, under a light header.
  await expect(page.locator('.film')).toHaveAttribute('data-look', 'paper')
  expect(await page.locator('.studio-header').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(238, 240, 231)')
  await startFilm(page)
  // The sample plays its own sung song; the score is one choice away.
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
  // It is streamed, not downloaded whole first, and the song itself is moving.
  expect((await audioState(page))!.songMode).toBe('stream')
  const heard = (await audioState(page))!.songTime!
  await expect.poll(async () => (await audioState(page))!.songTime!).toBeGreaterThan(heard + 0.5)
  await page.getByRole('button', { name: /^Style/ }).click()
  await expect(page.getByRole('radio', { name: /^The Screening/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Zara’s song', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: 'Studio score' }).check()
  // A visitor can try the other looks on the sample too.
  await page.getByRole('radio', { name: 'Garden' }).check()
  await expect(page.locator('.film')).toHaveAttribute('data-look', 'garden')
  await page.getByRole('radio', { name: 'Paper' }).check()
  await page.getByRole('button', { name: 'Done' }).click()
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId).not.toBe('song')
  expect((await audioState(page))!.trackId).toBeTruthy()
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
    test.setTimeout(180_000)
    await page.setViewportSize({ width, height })
    // Every screen of the short flow.
    for (const step of ['who', 'names', 'occasion', 'photos', 'about', 'song']) {
      await open(page, `/start?step=${step}`)
      await expect(page.locator('.start-page h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `the ${step} screen of the short flow is wider than the screen`).toBeLessThanOrEqual(width)
    }
    // The home page, top to bottom.
    await open(page, '/')
    await expect(page.locator('.contact-sheet .still-box[data-fit]')).toHaveCount(8)
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the home page is wider than the screen').toBeLessThanOrEqual(width)
    const cramped = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.rack .stub, .home-nav a, .home-header .button'))
        .filter((el) => el.offsetParent !== null)
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.left < -1 || r.right > window.innerWidth + 1).length,
    )
    expect(cramped, 'a ticket or header link runs off the home page').toBe(0)
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
    // Every shot of both kinds of film, in both designs of each scene.
    for (const pass of ['The Screening', 'The Scrapbook', 'The Scrapbook again'] as const) {
    if (pass === 'The Scrapbook again') {
      await page.getByRole('button', { name: 'Scenes' }).click()
      const others = page.getByRole('button', { name: /^Another design/ })
      for (let i = 0; i < (await others.count()); i++) await others.nth(i).click()
      await page.getByRole('button', { name: 'Done' }).click()
      // The film is already running and carries on from the last scene changed, so wind it back to the start.
      await page.getByRole('slider', { name: 'Film position' }).fill('0')
      await expect.poll(async () => (await filmState(page)).shot).toBe(0)
    } else {
      await chooseStyle(page, pass)
      await startFilm(page)
    }
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(350)
      const fit = await page.evaluate(() => {
        const frame = document.querySelector('.film-frame')!.getBoundingClientRect()
        const spill = Array.from(document.querySelectorAll<HTMLElement>('.shot.is-current .type, .shot.is-current .sb-hand, .shot.is-current .sb-typed, .shot.is-current .blow, .shot.is-current .again'))
          // Something still waiting to arrive is not on screen yet.
          .filter((el) => el.checkVisibility({ checkOpacity: true }))
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.left < frame.left - 1 || r.right > frame.right + 1))
        // A photo that has collapsed to a sliver, or a caption squeezed to one word a line, is as broken as text off screen.
        const crushed = Array.from(document.querySelectorAll<HTMLElement>('.shot.is-current img, .shot.is-current figcaption'))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) => (el.tagName === 'IMG' ? r.width < 80 || r.height < 80 : (el.textContent ?? '').length > 12 && r.width < 110))
        return {
          page: document.documentElement.scrollWidth,
          spill: spill.length,
          crushed: crushed.length,
          kind: document.querySelector<HTMLElement>('.shot.is-current')?.dataset.shotKind,
          text: document.querySelector<HTMLElement>('.shot.is-current')?.dataset.text?.slice(0, 40),
        }
      })
      expect(fit.page).toBeLessThanOrEqual(width)
      expect(fit.spill, `text off screen in a ${fit.kind} shot (${pass}): ${fit.text}`).toBe(0)
      expect(fit.crushed, `a photo or caption has collapsed in a ${fit.kind} shot: ${fit.text}`).toBe(0)
      const next = page.getByRole('button', { name: 'Next' })
      if (await next.isDisabled()) break
      await next.click()
    }
    }
    // The song page: the written sheet, the tunes and a take all fit, and no sung line is hidden.
    await page.getByRole('link', { name: 'Add a song' }).click()
    await page.getByRole('button', { name: 'Write Zara’s song' }).click()
    await expect(page.getByLabel('Lyrics')).toHaveValue(/Zara/)
    await page.getByRole('button', { name: 'Make the song' }).click()
    await expect(page.getByRole('radio', { name: /^Take 1/ })).toBeChecked()
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the song page is wider than the screen').toBeLessThanOrEqual(width)
    expect(await page.getByLabel('Lyrics').evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)
  })
}

const NOTE =
  'Moving day. The lift broke, and you carried the sofa up five floors arguing about the angle. You always steal the duvet, then ask why I am cold. You never finish your tea. I love you because you remember the small things I mention once.'

test('the home page offers every occasion, and a ticket starts a short flow that makes a film for it', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  await open(page, '/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('turned into a film')
  const tickets = page.locator('.rack a')
  await expect(tickets).toHaveCount(OCCASIONS.length)
  for (const occasion of OCCASIONS) await expect(tickets.filter({ hasText: occasion.name })).toHaveAttribute('href', `/start?occasion=${occasion.id}`)

  // The occasion is written into the draft and leaves the address; the flow doesn't ask for it again.
  await tickets.filter({ hasText: 'Thank you' }).click()
  await expect(page).toHaveURL(/\/start$/)
  await expect(page.locator('.start-step')).toHaveText('Step 1 of 5')
  await page.getByRole('button', { name: 'Friend', exact: true }).click()
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add a few photos of Kemi.')
  await page.getByRole('button', { name: 'Skip photos' }).click()
  await page.getByLabel('About Kemi').fill(NOTE)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip the song and use the studio’s own music' }).click()

  // The film says what it is for on the ticket, tells the sender's own words, and ends on a sealed note, not a candle.
  await expect(page).toHaveURL(/\/preview$/)
  await chooseStyle(page, 'The Screening')
  await expect(page.locator('.film .ticket-foot')).toContainText('A thank-you')
  await expect(page.locator('.song-status')).toHaveCount(0)
  await startFilm(page)
  const shots = await walk(page, (shot) => shot.kind === 'wish')
  const said = shots.map((s) => s.text).join(' ')
  expect(said).not.toMatch(/birthday/i)
  expect(said).toContain('you carried the sofa up five floors')
  expect(said).toContain('You always steal the duvet, then ask why I am cold.')
  // A friend's red flags don't end on "Staying anyway".
  expect(said).not.toContain('Staying anyway')
  await expect(page.locator('.shot.is-current .note')).toBeVisible()
  await expect(page.locator('.shot.is-current .candle')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open the note' }).click()
  await expect(page.locator('.film').getByRole('status')).toContainText('Thank you, Kemi. Love, Ada.')

  // The detailed form is one step away, with the same draft, and asks its questions for the occasion.
  await page.getByRole('button', { name: 'Scenes' }).click()
  await page.getByRole('link', { name: 'edit every detail' }).click()
  await expect(page.getByRole('radio', { name: 'Thank you' })).toBeChecked()
  await expect(page.locator('.projection .ticket-foot')).toContainText('A thank-you')
  await page.getByRole('button', { name: 'Reasons' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What are you thanking Kemi for?')
  await page.getByRole('button', { name: 'Last line' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What should Kemi read when the note opens?')
  await expect(page.locator('.question-hint')).toContainText('Thank you, Kemi. Love, Ada.')
  await page.getByRole('button', { name: 'Names' }).click()
  await page.getByRole('radio', { name: 'Birthday' }).check()
  await expect(page.locator('.projection .ticket-foot')).toContainText('Your birthday')
  await expect(page.getByRole('button', { name: 'The wish' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the short flow sorts the sender’s words, plays the film at once and brings the song in behind it', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  await open(page, '/')
  await page.getByRole('link', { name: 'Start a film' }).first().click()
  await expect(page.locator('.start-step')).toHaveText('Step 1 of 6')
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()

  // Three of the six steps are answered by a tap that moves straight on.
  await page.getByRole('button', { name: 'Girlfriend' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What do you call each other?')
  await page.getByLabel('Their name').fill('Zara')
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.getByLabel('Your name').fill('Tobi')
  await page.getByLabel('Your name').press('Enter')
  await page.getByRole('button', { name: 'Anniversary' }).click()
  await expect(page.locator('.start-step')).toHaveText('Step 4 of 6')
  await page.locator('input[type=file]').setInputFiles(['one', 'two', 'three'].map((name) => ({ name: `${name}.png`, mimeType: 'image/png', buffer: PNG })))
  await expect(page.locator('.start-photos img')).toHaveCount(3)
  await page.getByRole('button', { name: 'Remove photo 3' }).click()
  await expect(page.locator('.start-photos img')).toHaveCount(2)
  await page.getByRole('button', { name: 'Next' }).click()

  // One box. Too little can't go on; a few sentences can.
  await page.getByLabel('About Zara').fill('She is great.')
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.getByLabel('About Zara').fill(NOTE)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('button', { name: 'Surprise me' })).toHaveCount(2)
  await page.getByRole('button', { name: 'A woman’s voice' }).click()

  // Making the film sends the words to be sorted (and nothing else), then the song is asked for behind it.
  const sortRequest = page.waitForRequest((r) => r.url().endsWith('/api/sort'))
  const lyricsRequest = page.waitForRequest((r) => r.url().endsWith('/api/lyrics'))
  const songRequest = page.waitForRequest((r) => r.url().endsWith('/api/music') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Make the film' }).click()
  expect((await sortRequest).postDataJSON()).toEqual({ text: NOTE, sender: 'Tobi', recipient: 'Zara' })
  await expect(page).toHaveURL(/\/preview$/)
  const brief = (await lyricsRequest).postDataJSON() as { details: Record<string, unknown> }
  expect(brief.details).toMatchObject({ occasion: 'anniversary', relationship: 'girlfriend', recipient: 'Zara', sender: 'Tobi' })
  expect(brief.details.habits).toEqual(['You always steal the duvet, then ask why I am cold.', 'You never finish your tea.'])
  const asked = (await songRequest).postDataJSON() as Record<string, unknown>
  expect(asked).toMatchObject({ vibe: 'afrobeats', voice: 'woman' })
  expect(String(asked.lyrics)).toContain('Zara')

  // The song lands on the film by itself while the opening is still up, whichever kind of film was drawn.
  await expect(page.locator('.film .opening')).toContainText('Our anniversary')
  await expect(page.locator('.song-status')).toHaveCount(0, { timeout: 15_000 })
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
  const said = (await walk(page, (shot) => shot.kind === 'wish')).map((s) => s.text).join(' ')
  expect(said).toContain('you carried the sofa up five floors')
  expect(said).toContain('You never finish your tea.')
  await expect(page.getByRole('button', { name: 'Open the note' })).toBeVisible()

  // What is in the film and what else could go in is listed beside it, each a step of the detailed form.
  await page.getByRole('button', { name: 'Scenes' }).click()
  const more = page.locator('.scene-row')
  await expect(more.filter({ hasText: 'Memory lane' })).toHaveClass(/is-in/)
  await expect(more.filter({ hasText: 'Reasons' })).toContainText('Add 2 more reasons.')
  await expect(more.filter({ hasText: 'The main character' })).toHaveClass(/is-in/)
  await expect(more.filter({ hasText: 'Memory lane' }).getByRole('link', { name: 'Edit words' })).toHaveAttribute('href', '/create?step=memories')
  await more.filter({ hasText: 'A letter' }).getByRole('link', { name: 'Add' }).click()
  await expect(page).toHaveURL(/\/create\?step=letter$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Is there something you want to tell Zara properly?')
  expect(errors).toEqual([])
})

test('on the home page the sample’s song and the film take turns', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page, '/')
  const song = () =>
    page.evaluate(() => {
      const audio = document.querySelector<HTMLAudioElement>('.song-player audio')!
      return { paused: audio.paused, time: audio.currentTime }
    })
  // The song plays from a real tap, and its clock moves.
  await page.getByRole('button', { name: 'Play Zara’s song' }).click()
  await expect.poll(async () => (await song()).time, { timeout: 15_000 }).toBeGreaterThan(0.3)
  await expect(page.getByRole('button', { name: 'Pause Zara’s song' })).toBeVisible()

  // Starting the film stops the song.
  await page.getByRole('button', { name: /Tap to begin/ }).click()
  await expect.poll(async () => (await song()).paused).toBe(true)
  await page.waitForFunction(() => window.__ltFilm?.phase() === 'playing', undefined, { timeout: 15_000 })
  await expect.poll(async () => (await audioState(page))?.running).toBe(true)

  // Playing the song again holds the film and its sound.
  await page.getByRole('button', { name: 'Play Zara’s song' }).click()
  await expect(page.locator('.screen .film')).toHaveClass(/is-paused/)
  await expect.poll(async () => (await audioState(page))?.suspended).toBe(true)
  await expect.poll(async () => (await song()).paused).toBe(false)
  expect(errors).toEqual([])
})

test('the sample plays as a scrapbook, and its scenes can be redesigned, moved, left out and put back', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  await open(page, '/')
  // The home page shows both kinds of film and links to the sample in each.
  const kinds = page.locator('#kinds .kind')
  await expect(kinds).toHaveCount(2)
  await kinds.filter({ hasText: 'The Scrapbook' }).click()
  await expect(page).toHaveURL(/\/preview\?sample=1&style=scrapbook$/)
  const film = page.locator('.preview-body > .film')
  await expect(film).toHaveAttribute('data-world', 'scrapbook')

  // It opens as a closed album with their name on it, not a ticket.
  await expect(page.locator('.film .ticket')).toHaveCount(0)
  await expect(page.locator('.film .sb-plate')).toContainText('Zara')
  await page.getByRole('button', { name: 'A book made for Zara. Tap to open' }).click()
  await expect(film).toHaveAttribute('data-phase', 'playing', { timeout: 10_000 })
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
  // One title page carries the dedication, the name and the opening line.
  const first = await filmState(page)
  expect(first.kind).toBe('name')
  expect(first.text).toContain('For Zara. From Tobi. Zara.')
  const marks = () => page.locator('.film-controls .mark').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  const before = await marks()
  expect(before).toHaveLength(8)

  // Another design for a scene: the film carries on from that scene, with the song still playing.
  await page.getByRole('button', { name: 'Scenes' }).click()
  const row = (name: string) => page.locator('.scene-row').filter({ has: page.getByText(name, { exact: true }) })
  await expect(page.locator('.scene-row.is-in')).toHaveCount(8)
  await expect(page.locator('.scene-row .still-box')).toHaveCount(8)
  const flags = row('Red flags')
  const was = (await flags.locator('small').textContent())!
  expect(['Sticky notes', 'Checklist']).toContain(was)
  const songTime = (await audioState(page))!.songTime!
  await page.getByRole('button', { name: 'Another design for Red flags' }).click()
  await expect(flags.locator('small')).toHaveText(was === 'Checklist' ? 'Sticky notes' : 'Checklist')
  await expect(film).toHaveAttribute('data-phase', 'playing')
  await expect(film.locator('.shot.is-current')).toHaveAttribute('data-text', /Red flags/)
  expect((await filmState(page)).kind).toBe('card')
  await expect.poll(async () => (await audioState(page))!.songTime!).toBeGreaterThan(songTime)
  // Step on to a flag: it is drawn in the design just chosen.
  for (let i = 0; i < 4 && (await filmState(page)).kind !== 'flag'; i++) await page.keyboard.press('ArrowRight')
  await expect(film.locator('.shot.is-current')).toHaveAttribute('data-design', was === 'Checklist' ? 'stickies' : 'checklist')
  await expect(film.locator(was === 'Checklist' ? '.shot.is-current .sb-stickies li' : '.shot.is-current .sb-pad li')).toHaveCount(1)

  // Move a scene earlier, leave one out, put it back, then undo everything.
  // The opening is fixed, so the scenes that can move start after it.
  const second = before[2]!
  await page.getByRole('button', { name: `Move ${second} earlier` }).click()
  expect((await marks()).slice(0, 3)).toEqual([before[0], second, before[1]])
  await page.getByRole('button', { name: 'Leave out The camera roll' }).click()
  expect(await marks()).not.toContain('The camera roll')
  expect(await marks()).toHaveLength(7)
  await expect(row('The camera roll')).toContainText('Left out.')
  await page.getByRole('button', { name: 'Put back The camera roll' }).click()
  expect(await marks()).toHaveLength(8)
  await expect(film).toHaveAttribute('data-phase', 'playing')
  await page.getByRole('button', { name: 'Undo my changes to the scenes' }).click()
  expect(await marks()).toEqual(before)
  await page.getByRole('button', { name: 'Done' }).click()

  // It still ends on the candle and the sender's last line, then the credits.
  const shots = await walk(page, (shot) => shot.kind === 'wish')
  expect(shots.map((s) => s.text).join(' ')).toContain('Sends an eleven-minute voice note called “quick gist”')
  await expect(film.locator('.shot.is-current .sb-cake')).toBeVisible()
  await page.getByRole('button', { name: 'Blow out the candle' }).click()
  await expect(page.locator('.film').getByRole('status')).toContainText('And yes, you can have my chips.')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(film.locator('.shot.is-current .sb-libcard')).toContainText('Starring')
  await expect(film.locator('.shot.is-current')).toContainText('Zara and Tobi are fictional')

  // And back to the Screening, which opens on its ticket again.
  await chooseStyle(page, 'The Screening')
  await expect(film).toHaveAttribute('data-world', 'screening')
  await expect(page.getByRole('button', { name: 'Admit one: Zara. Tap to begin' })).toBeVisible()
  expect(errors).toEqual([])
})

for (const [width, height] of [[1360, 800], [360, 740]]) {
  test(`while the song is being made the film is on screen and can be watched (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    // Hold the song back, the way a real one takes a minute or more.
    const hold = (ms: number) => async (route: import('@playwright/test').Route) => {
      if (route.request().method() === 'POST') await new Promise((done) => setTimeout(done, ms))
      await route.continue()
    }
    await page.route('**/api/lyrics', hold(2500))
    await page.route('**/api/music', hold(3500))
    await open(page, '/start')
    await page.getByRole('button', { name: 'Wife', exact: true }).click()
    await page.getByLabel('Their name').fill('Kemi')
    await page.getByLabel('Your name').fill('Ada')
    await page.getByLabel('Your name').press('Enter')
    await page.getByRole('button', { name: 'Anniversary' }).click()
    await page.getByRole('button', { name: 'Skip photos' }).click()
    await page.getByLabel('About Kemi').fill(NOTE)
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Make the film' }).click()
    await expect(page).toHaveURL(/\/preview$/)

    // The notice says what is happening and that the film can be watched; it is a strip, not the page.
    const status = page.locator('.song-status')
    const film = page.locator('.preview-body > .film')
    await expect(status).toContainText('Writing Kemi’s song')
    await expect(status).toContainText('Your film is ready now')
    await expect(status.locator('.song-steps li')).toHaveText(['The words', 'The voice', 'On your film'])
    const room = async () => ({ status: (await status.boundingBox())!.height, film: (await film.boundingBox())!.height })
    const writing = await room()
    expect(writing.film, 'the film has most of the screen while the song is written').toBeGreaterThan(height * 0.5)
    expect(writing.status).toBeLessThan(height * 0.25)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.getByRole('button', { name: /Tap to (begin|open)/ })).toBeVisible()

    await expect(status).toContainText('Kemi’s song is being sung', { timeout: 10_000 })
    await expect(status.locator('.song-steps li.is-done')).toHaveCount(1)
    expect((await room()).film).toBeGreaterThan(height * 0.5)

    // Nobody tapped, so the finished song goes onto the film by itself and the notice leaves.
    await expect(status).toHaveCount(0, { timeout: 15_000 })
    expect((await film.boundingBox())!.height).toBeGreaterThan(writing.film)
    await startFilm(page)
    await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
  })
}

test('a song that lands after the film has started waits to be asked for', async ({ page }) => {
  await page.route('**/api/music', async (route) => {
    if (route.request().method() === 'POST') await new Promise((done) => setTimeout(done, 3000))
    await route.continue()
  })
  await open(page, '/start')
  await page.getByRole('button', { name: 'Friend', exact: true }).click()
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByLabel('Your name').press('Enter')
  await page.getByRole('button', { name: 'Thank you' }).click()
  await page.getByRole('button', { name: 'Skip photos' }).click()
  await page.getByLabel('About Kemi').fill(NOTE)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Make the film' }).click()
  await expect(page).toHaveURL(/\/preview$/)
  // Watching straight away plays the studio's music.
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId).toBeTruthy()
  expect((await audioState(page))!.trackId).not.toBe('song')
  const status = page.locator('.song-status')
  await expect(status).toContainText('Kemi’s song is ready.', { timeout: 15_000 })
  await expect(page.locator('.preview-body > .film')).toHaveAttribute('data-phase', 'playing')
  await status.getByRole('button', { name: 'Play the film with it' }).click()
  await expect(status).toHaveCount(0)
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
})

test('an iPhone photo (HEIC) is converted on the device, and files that are not photos are named', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  const sent: string[] = []
  page.on('request', (r) => r.method() !== 'GET' && sent.push(`${r.method()} ${new URL(r.url()).pathname}`))
  const heic = readFileSync(new URL('./fixtures/beach.heic', import.meta.url))
  await open(page, '/start')
  await page.getByRole('button', { name: 'Friend', exact: true }).click()
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByLabel('Your name').press('Enter')
  await page.getByRole('button', { name: 'Just because' }).click()
  // The picker offers HEIC files, which have no "image" type on most computers.
  await expect(page.locator('input[type=file]')).toHaveAttribute('accept', 'image/*,.heic,.heif')

  await page.locator('input[type=file]').setInputFiles([
    // Straight off an iPhone, as a computer sees it: no type, only the name.
    { name: 'IMG_0042.HEIC', mimeType: '', buffer: heic },
    // The same photo with nothing to go on but its first bytes.
    { name: 'from-airdrop', mimeType: 'application/octet-stream', buffer: heic },
    { name: 'plain.png', mimeType: 'image/png', buffer: PNG },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') },
    // Named like a photo, but not one.
    { name: 'broken.heic', mimeType: 'image/heic', buffer: Buffer.from('this is not a picture at all') },
  ])
  const thumbs = page.locator('.start-photos img')
  await expect(thumbs).toHaveCount(3, { timeout: 30_000 })
  await expect(page.locator('.photo-reading')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveText('2 files couldn’t be read as photos.')
  // Both iPhone photos became pictures this browser can draw, at their real size.
  const sizes = await thumbs.evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode().then(() => [(img as HTMLImageElement).naturalWidth, (img as HTMLImageElement).naturalHeight]))))
  expect(sizes).toEqual([[900, 514], [900, 514], [1, 1]])
  expect(await thumbs.first().getAttribute('src')).toMatch(/^blob:/)
  expect(await thumbs.first().evaluate(async (img) => (await (await fetch((img as HTMLImageElement).src)).blob()).type)).toBe('image/jpeg')
  // Nothing left the device to do it.
  expect(sent).toEqual([])

  // And it plays in the film like any other photo.
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('About Kemi').fill(NOTE)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip the song and use the studio’s own music' }).click()
  await expect(page).toHaveURL(/\/preview$/)
  await startFilm(page)
  await walk(page, (shot) => shot.kind === 'photo')
  const shown = page.locator('.preview-body > .film .shot.is-current img').first()
  await expect.poll(() => shown.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  expect(errors).toEqual([])
})
