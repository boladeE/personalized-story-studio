import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { olderKinds, audioState, chooseStyle, closeEditor, filmState, open, openEditor, pickScene, sceneTile, startFilm, trackErrors, undoButton, walk } from './helpers'

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
  // The only music is the song that was made for this film.
  expect(s.trackId).toBe('song')

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

test('the sender’s own words and uploaded photo appear, and only the song’s words leave the device while drafting', async ({ page }) => {
  const requests: string[] = []
  const bodies: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'GET') return
    requests.push(`${r.method()} ${new URL(r.url()).pathname}`)
    bodies.push(r.postData() ?? '')
  })
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
  // Building the film has its song written and sung, from the names and words. No photo is sent for it.
  expect(requests).toEqual(['POST /api/lyrics', 'POST /api/music'])
  expect(bodies.join(' ')).toContain('Kemi')
  expect(bodies.join(' ')).not.toMatch(/blob:|image\/|Kemi at the market/)
})

test('another version rebuilds from the ticket with the same content, the last one can be had back, and edit keeps the draft', async ({ page }) => {
  test.setTimeout(120_000)
  await open(page, '/create')
  await page.getByRole('button', { name: 'Fill with the sample' }).click()
  await page.getByRole('button', { name: 'Build the story' }).click()
  const order = async () => page.locator('.film-controls .mark').evaluateAll((els) => els.map((e) => e.getAttribute('title')).join('|'))
  await startFilm(page)
  const versions = new Set<string>()
  // The film page itself offers two things: edit it, or send it.
  await expect(page.locator('.studio-header-extra').getByRole('link')).toHaveText(['Edit', /^Send/])
  await expect(page.locator('.studio-header-extra').getByRole('button')).toHaveCount(0)
  let last = ''
  for (let i = 0; i < 5; i++) {
    last = await order()
    await openEditor(page)
    await page.getByRole('button', { name: 'Try another version' }).click()
    await expect(page.locator('.preview-body > .film')).toHaveAttribute('data-phase', 'ticket')
    await closeEditor(page)
    await startFilm(page)
    versions.add(await order())
    expect((await order()).split('|').sort()).toHaveLength(8)
  }
  expect(versions.size).toBeGreaterThan(1)
  // A version that was drawn over can be had back.
  const kept = await order()
  await openEditor(page)
  await expect(undoButton(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Try another version' }).click()
  await expect(page.locator('.edit-note')).toHaveText('The film has another version.')
  await undoButton(page).click()
  await expect(undoButton(page)).toBeDisabled()
  await closeEditor(page)
  await startFilm(page)
  expect(await order()).toBe(kept)
  await openEditor(page)
  await page.getByRole('link', { name: 'Edit every detail' }).click()
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
  // The sample plays its own sung song.
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
  // It is streamed, not downloaded whole first, and the song itself is moving.
  expect((await audioState(page))!.songMode).toBe('stream')
  const heard = (await audioState(page))!.songTime!
  await expect.poll(async () => (await audioState(page))!.songTime!).toBeGreaterThan(heard + 0.5)
  // The editor names the film's song in a bar of its own, which leads to the song's room.
  await openEditor(page)
  await expect(page).toHaveURL(/edit=1/)
  await expect(page.locator('.film-song')).toContainText('“This One, With You”, written and sung for this film')
  await page.getByRole('link', { name: 'Hear it' }).click()
  await expect(page).toHaveURL(/song=1/)
  // There is one piece of music, the song made for the film, and nothing else to switch to.
  const songRoom = page.locator('.songroom')
  await expect(songRoom.getByRole('heading', { level: 1 })).toHaveText('This One, With You')
  await expect(songRoom).not.toContainText(/score|studio’s music/i)
  await expect(songRoom.locator('.pager')).toHaveCount(0)
  // Its words are laid out to read, and the sample's can't be changed.
  await expect(songRoom.locator('.song-lyrics .lyric-part').first()).toContainText('The last train pulled away')
  await expect(songRoom.getByRole('button', { name: 'Rewrite' })).toHaveCount(0)
  await expect(songRoom.getByRole('button', { name: /Record it again|Make a new recording/ })).toHaveCount(0)
  // The song plays by itself here, from one button: the film is quiet, and the song's own time moves.
  await expect.poll(async () => (await audioState(page))?.trackId ?? null).toBeNull()
  const songTime = () => page.locator('.player audio').evaluate((el: HTMLAudioElement) => el.currentTime)
  await page.getByRole('button', { name: 'Play the song' }).click()
  await expect.poll(songTime, { timeout: 15_000 }).toBeGreaterThan(0.4)
  await page.getByRole('button', { name: 'Pause the song' }).click()
  const paused = await songTime()
  await page.waitForTimeout(400)
  expect(await songTime()).toBe(paused)
  await expect(page.getByRole('button', { name: 'Play the song' })).toBeVisible()
  // Back to the scenes, where the look of the whole film is one button away.
  await page.getByRole('link', { name: 'Back to the scenes' }).click()
  await expect(page).not.toHaveURL(/song=1/)
  await expect(page).toHaveURL(/edit=1/)
  await page.getByRole('button', { name: /^Look/ }).click()
  await expect(page.getByRole('radio', { name: /^The Screening/ })).toBeChecked()
  // A visitor can try the other looks on the sample too.
  await page.getByRole('radio', { name: 'Garden' }).check()
  await expect(page.locator('.preview-body > .film')).toHaveAttribute('data-look', 'garden')
  await page.getByRole('radio', { name: 'Paper' }).check()
  // Back leaves the editor, as Done does.
  await page.goBack()
  await expect(page).not.toHaveURL(/edit=1/)
  await expect(page.locator('.scene-nav')).toHaveCount(0)
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
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
  await expect(page.locator('.shot.is-current .name')).toHaveText('Sarah')
  await context.close()
})

for (const [width, height] of [[360, 740], [768, 900], [1360, 800]]) {
  test(`nothing spills off screen at ${width}px`, async ({ page }) => {
    test.setTimeout(600_000)
    await page.setViewportSize({ width, height })
    // Every screen of the short flow.
    for (const step of ['who', 'names', 'occasion', 'photos', 'about', 'song']) {
      await open(page, `/start?step=${step}`)
      await expect(page.locator('.start-page h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `the ${step} screen of the short flow is wider than the screen`).toBeLessThanOrEqual(width)
    }
    // The home page, top to bottom.
    await open(page, '/')
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the home page is wider than the screen').toBeLessThanOrEqual(width)
    expect(await offScreen(page, '.home-header > *, .one-pitch > *, .one-steps li, .one-footer a')).toBe(0)
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
    // Every shot of every kind of film. Each "again" steps every scene on to its next design and plays it through once more.
    const passes = async (list: Array<'The Screening' | 'The Scrapbook' | 'The Mixtape' | 'again'>) => {
    for (const pass of list) {
    if (pass === 'again') {
      // The editor fits too: every scene's words and changes, the look, the row's head and the song's bar.
      await openEditor(page)
      const tiles = page.locator('.scene-tile.is-in > button')
      for (let i = 0; i < (await tiles.count()); i++) {
        await tiles.nth(i).click()
        expect(await offScreen(page, '.scene-panel :is(button, a, input, textarea, label, p), .scene-nav-head > *, .film-song > *, .stage-foot > *'), 'part of the editor runs off the screen').toBe(0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth), 'a scene makes the editor wider than the screen').toBeLessThanOrEqual(width)
        const other = page.getByRole('button', { name: /^Another design/ })
        if (await other.count()) await other.click()
      }
      await page.getByRole('button', { name: /^Look/ }).click()
      expect(await offScreen(page, '.scene-panel :is(button, label, p)'), 'part of the look runs off the screen').toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the look makes the editor wider than the screen').toBeLessThanOrEqual(width)
      await page.getByRole('button', { name: /^Back to / }).click()
      await closeEditor(page)
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
        const spill = Array.from(document.querySelectorAll<HTMLElement>('.shot.is-current .type, .shot.is-current .sb-hand, .shot.is-current .sb-typed, .shot.is-current .mx-caps, .shot.is-current .mx-mono, .shot.is-current .mx-prose, .shot.is-current .blow, .shot.is-current .again'))
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
    }
    // The film built in the detailed form is told in the older fixed scenes, in both designs of each.
    await passes(['The Screening', 'The Scrapbook', 'again', 'The Mixtape', 'again'])
    // Writing a scene's words beside its still fits too: a list, the memories and the photos.
    await openEditor(page)
    // The film has been playing; a still of the chosen scene takes its place once it is stopped.
    if (await page.getByRole('button', { name: 'Stop' }).count()) await page.getByRole('button', { name: 'Stop' }).click()
    for (const scene of ['Red flags', 'Memory lane', 'The camera roll']) {
      await pickScene(page, scene)
      await expect(page.locator('.stage-still-frame .still-box[data-fit]')).toBeVisible()
      expect(await offScreen(page, '.scene-words :is(input, textarea, button, img, label)'), `a field of ${scene} runs off the screen`).toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `writing ${scene} makes the page wider than the screen`).toBeLessThanOrEqual(width)
      expect((await page.locator('.stage-still-frame').boundingBox())!.height, `the still of ${scene} keeps some room`).toBeGreaterThan(90)
    }
    // The song's room: the player, the words on their paper, the three controls over them, the tunes and the one
    // button all fit, and no sung line is hidden.
    await page.locator('.film-song-open').click()
    await expect(page.getByRole('button', { name: 'Play the song' })).toBeVisible()
    await expect(page.getByLabel('Lyrics')).toHaveValue(/Zara/)
    expect(await page.getByLabel('Lyrics').evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)
    expect(await offScreen(page, '.songroom :is(button, a, input, textarea, label, p, h1)'), 'part of the song’s room runs off the screen').toBe(0)
    await page.locator('.song-tune').click()
    expect(await offScreen(page, '.songroom :is(button, a, input, label, p, h1)'), 'part of the tunes runs off the screen').toBe(0)
    await page.locator('.song-tune').click()
    await page.getByLabel('Ask for different words').fill('funnier')
    await page.getByRole('button', { name: 'Rewrite' }).click()
    await expect(page.getByLabel('Lyrics')).toHaveValue(/You asked for funnier/)
    await expect(page.getByRole('group', { name: 'Versions of the words' })).toContainText('2 of 2')
    await page.getByRole('button', { name: /Make a new recording/ }).click()
    await expect(page.getByRole('group', { name: 'Recordings' })).toContainText('2 of 2')
    expect(await offScreen(page, '.songroom :is(button, a, input, textarea, label, p, h1)'), 'a second recording runs off the screen').toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the song’s room is wider than the screen').toBeLessThanOrEqual(width)

    // A film with scenes of its own (the sample): every kind of film, and all four designs of its lists and moments.
    await open(page, '/preview?sample=1')
    await passes(['The Scrapbook', 'again', 'again', 'again', 'The Mixtape', 'again', 'again', 'again', 'The Screening', 'again', 'again', 'again'])

    // And writing such a film's scenes: each one's name, shape and words, and a scene the sender adds.
    await open(page, '/start')
    await page.getByRole('button', { name: 'Friend', exact: true }).click()
    await page.getByLabel('Their name').fill('Kemi')
    await page.getByLabel('Your name').fill('Ada')
    await page.getByLabel('Your name').press('Enter')
    await page.getByRole('button', { name: 'Thank you' }).click()
    await page.getByRole('button', { name: 'Skip this' }).click()
    await page.getByLabel('About Kemi').fill(NOTE)
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Skip these' }).click()
    await page.getByRole('button', { name: 'Make the film' }).click()
    await expect(page).toHaveURL(/\/preview$/)
    await expect(page.locator('.song-status')).toHaveCount(0, { timeout: 15_000 })
    await openEditor(page)
    await page.getByRole('button', { name: 'Add a scene' }).click()
    await page.getByLabel('Scene name').fill('A scene with quite a long name to it')
    await page.getByRole('radio', { name: 'A list' }).check()
    await page.getByRole('textbox', { name: 'Line 1' }).fill('A line that is long enough to need wrapping on a small screen, more or less')
    const own = page.locator('.scene-tile:not(.is-add) > button')
    for (let i = 0; i < (await own.count()); i++) {
      await own.nth(i).click()
      expect(await offScreen(page, '.scene-panel :is(button, a, input, textarea, label, p, legend)'), 'part of a scene’s own words runs off the screen').toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), 'one of the film’s own scenes makes the editor wider than the screen').toBeLessThanOrEqual(width)
    }
  })
}

/** How many of these are on the page but run past its left or right edge. */
const offScreen = (page: Page, selector: string) =>
  page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll<HTMLElement>(sel))
        .filter((el) => el.offsetParent !== null && !el.closest('.pick, .scene-strip, .visually-hidden'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1)).length,
    selector,
  )

const NOTE =
  'Moving day. The lift broke, and you carried the sofa up five floors arguing about the angle. You always steal the duvet, then ask why I am cold. You never finish your tea. I love you because you remember the small things I mention once.'

test('the home page is one screen, and a link with an occasion starts a short flow that makes a film for it', async ({ page }) => {
  await olderKinds(page)
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  await open(page, '/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('turned into a film')
  // The first screen is the pitch, the sample, three steps and one way in.
  await expect(page.locator('.one-steps li')).toHaveCount(3)
  await expect(page.locator('.one-screen .film')).toHaveAttribute('data-world', 'scrapbook')
  // The questions are below that first screen, folded shut.
  await expect(page.locator('#questions .question-list details')).toHaveCount(6)

  // A link can still carry the occasion: it is written into the draft and leaves the address, and the flow doesn't ask for it again.
  await open(page, '/start?occasion=thank-you')
  await expect(page).toHaveURL(/\/start$/)
  await expect(page.locator('.start-step')).toHaveText('Step 1 of 6')
  await page.getByRole('button', { name: 'Friend', exact: true }).click()
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add photos, videos and voice notes.')
  await page.getByRole('button', { name: 'Skip this' }).click()
  await page.getByLabel('About Kemi').fill(NOTE)
  await page.getByRole('button', { name: 'Next' }).click()
  // The studio's questions about the note can all be skipped.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A little more about Kemi?')
  await page.getByRole('button', { name: 'Skip these' }).click()
  // There is no way to make a film without its song: the only way on is to make it.
  await expect(page.getByText(/studio’s own music|Skip the song/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Make the film' }).click()

  // The film says what it is for on the ticket, tells the sender's own words, and ends on a sealed note, not a candle.
  await expect(page).toHaveURL(/\/preview$/)
  await chooseStyle(page, 'The Screening')
  await expect(page.locator('.film .ticket-foot')).toContainText('A thank-you')
  await expect(page.locator('.song-status')).toHaveCount(0, { timeout: 15_000 })
  await startFilm(page)
  const shots = await walk(page, (shot) => shot.kind === 'wish')
  const said = shots.map((s) => s.text).join(' ')
  expect(said).not.toMatch(/birthday/i)
  expect(said).toContain('you carried the sofa up five floors')
  expect(said).toContain('You always steal the duvet, then ask why I am cold.')
  // Nothing the sender wrote is filed under a stock label.
  expect(said).not.toMatch(/red flag|staying anyway|reason \d|memory lane/i)
  await expect(page.locator('.shot.is-current .note')).toBeVisible()
  await expect(page.locator('.shot.is-current .candle')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open the note' }).click()
  await expect(page.locator('.film').getByRole('status')).toContainText('Thank you, Kemi. Love, Ada.')

  // The names and the occasion are changed in the editor, on the opening scene. There is no other form to go to.
  await openEditor(page)
  await pickScene(page, 'Before we begin')
  await expect(page.getByRole('link', { name: 'Edit every detail' })).toHaveCount(0)
  await expect(page.getByLabel('Their name')).toHaveValue('Kemi')
  await expect(page.getByLabel('The occasion')).toHaveValue('thank-you')
  await page.getByLabel('The occasion').selectOption('birthday')
  await expect(page.getByLabel('The occasion')).toHaveValue('birthday')
  // Clearing a name to retype it doesn't lose the film.
  await page.getByLabel('Their name').fill('')
  await expect(page.locator('.scene-strip')).toBeVisible()
  await page.getByLabel('Their name').fill('Keke')
  await expect(page.locator('.stage-still-frame .shot')).toHaveAttribute('data-text', /Keke/)
  await undoButton(page).click()
  await expect(page.locator('.stage-still-frame .shot')).toHaveAttribute('data-text', /Kemi/)
  expect(errors).toEqual([])
})

test('the short flow writes the film’s own scenes from the sender’s words, plays it at once and brings the song in behind it', async ({ page }) => {
  await olderKinds(page)
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  await open(page, '/')
  await page.getByRole('link', { name: 'Start a film' }).first().click()
  await expect(page.locator('.start-step')).toHaveText('Step 1 of 7')
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()

  // Three of the seven steps are answered by a tap that moves straight on.
  await page.getByRole('button', { name: 'Girlfriend' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What do you call each other?')
  await page.getByLabel('Their name').fill('Zara')
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.getByLabel('Your name').fill('Tobi')
  await page.getByLabel('Your name').press('Enter')
  await page.getByRole('button', { name: 'Anniversary' }).click()

  await expect(page.locator('.start-step')).toHaveText('Step 4 of 7')
  await page.getByLabel('Add photos', { exact: true }).setInputFiles(['one', 'two', 'three'].map((name) => ({ name: `${name}.png`, mimeType: 'image/png', buffer: PNG })))
  await expect(page.locator('.start-photos img')).toHaveCount(3)
  // Removing a photo happens at once and can be taken back.
  const third = await page.locator('.start-photos img').nth(2).getAttribute('src')
  await page.getByRole('button', { name: 'Remove photo 3' }).click()
  await expect(page.locator('.start-photos img')).toHaveCount(2)
  await expect(page.locator('.undo-toast')).toContainText('Photo removed.')
  await page.locator('.undo-toast').getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.start-photos img')).toHaveCount(3)
  await expect(page.locator('.start-photos img').nth(2)).toHaveAttribute('src', third!)
  await expect.poll(() => page.locator('.start-photos img').nth(2).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await expect(page.locator('.undo-toast')).toHaveCount(0)
  await page.getByRole('button', { name: 'Remove photo 3' }).click()
  await expect(page.locator('.start-photos img')).toHaveCount(2)
  await page.getByRole('button', { name: 'Next' }).click()

  // One box. Too little can't go on; a few sentences can.
  await page.getByLabel('About Zara').fill('She is great.')
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.getByLabel('About Zara').fill(NOTE)
  const askRequest = page.waitForRequest((r) => r.url().endsWith('/api/followups'))
  await page.getByRole('button', { name: 'Next' }).click()

  // The studio reads the note and asks up to three short questions, each quoting what was written. Nothing else is sent.
  expect((await askRequest).postDataJSON()).toEqual({ text: NOTE, sender: 'Tobi', recipient: 'Zara' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A little more about Zara?')
  const questions = page.locator('.start-more li')
  await expect(questions).toHaveCount(3)
  await expect(questions.nth(1).locator('.more-quote')).toContainText('“You always steal the duvet, then ask why I am cold.”')
  // They can all be skipped; answering one adds the sender's own words to that part of the film.
  await expect(page.getByRole('button', { name: 'Skip these' })).toBeEnabled()
  await page.getByLabel('What does Zara say when you bring it up?').fill('“You run hot anyway.” Every time.')
  // The questions fit a phone.
  await page.setViewportSize({ width: 360, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('button', { name: 'Surprise me' })).toHaveCount(2)
  await page.getByRole('button', { name: 'A woman’s voice' }).click()

  // Making the film sends the words to be outlined into scenes and directed, with how many photos there are and whether there is a letter
  // (never the photos or the letter themselves). Then the song is asked for behind it.
  const sortRequest = page.waitForRequest((r) => r.url().endsWith('/api/sort'))
  const lyricsRequest = page.waitForRequest((r) => r.url().endsWith('/api/lyrics'))
  const songRequest = page.waitForRequest((r) => r.url().endsWith('/api/music') && r.method() === 'POST')
  await page.getByRole('button', { name: 'Make the film' }).click()
  const sent = (await sortRequest).postDataJSON() as Record<string, unknown>
  expect(sent).toMatchObject({ text: NOTE, sender: 'Tobi', recipient: 'Zara', occasion: 'anniversary', relationship: 'girlfriend', letter: false })
  expect(Object.keys(sent).sort()).toEqual(['answers', 'letter', 'occasion', 'peeks', 'photos', 'recipient', 'relationship', 'sender', 'text', 'voices'])
  // Small copies of the two photos go with it, for placing each scene beside the photo that shows it.
  expect((sent.peeks as Array<{ id: string; jpeg: string }>).map((p) => typeof p.jpeg)).toEqual(['string', 'string'])
  expect(sent.answers).toEqual([{ quote: 'You always steal the duvet, then ask why I am cold.', question: 'What does Zara say when you bring it up?', answer: '“You run hot anyway.” Every time.' }])
  expect(typeof sent.photos).toBe('number')
  await expect(page).toHaveURL(/\/preview$/)
  // The studio directed the film from the words: this note teases, so it is a mixtape.
  await expect(page.locator('.preview-body > .film')).toHaveAttribute('data-world', 'mixtape')
  const brief = (await lyricsRequest).postDataJSON() as { details: Record<string, unknown> }
  expect(brief.details).toMatchObject({ occasion: 'anniversary', relationship: 'girlfriend', recipient: 'Zara', sender: 'Tobi' })
  // The answer sits with the habit it was about, in the song's brief (which drops quote marks) and in the film.
  expect(brief.details.habits).toEqual(['You always steal the duvet, then ask why I am cold. You run hot anyway. Every time.', 'You never finish your tea.'])
  const asked = (await songRequest).postDataJSON() as Record<string, unknown>
  // "Surprise me" is the studio's pick for this film: a lively style for a note that teases, not the same one every time.
  expect(asked).toMatchObject({ voice: 'woman' })
  expect(['afrobeats', 'highlife', 'lofi-rnb']).toContain(asked.vibe)
  expect(String(asked.lyrics)).toContain('Zara')

  // The song lands on the film by itself while the opening is still up. What the studio said about its direction was for the wait.
  await expect(page.locator('.film .opening')).toContainText('Our anniversary')
  await expect(page.locator('.song-status')).toHaveCount(0, { timeout: 15_000 })
  await expect(page.locator('.direction-note')).toHaveCount(0)
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
  const said = (await walk(page, (shot) => shot.kind === 'wish')).map((s) => s.text).join(' ')
  expect(said).toContain('you carried the sofa up five floors')
  expect(said).toContain('You never finish your tea.')
  expect(said).toContain('“You run hot anyway.” Every time.')
  expect(said).not.toContain('bring it up')
  // It ends the way its occasion does: nobody is asked to choose an ending.
  await expect(page.getByRole('button', { name: 'Open the note' })).toBeVisible()

  // The editor says why the studio made it this kind of film, for as long as that choice stands.
  await openEditor(page, 'Look')
  await expect(page.getByRole('radio', { name: /^The Mixtape/ })).toBeChecked()
  await expect(page.locator('.scene-panel-note')).toHaveText('The studio made it a mixtape, because so much of what you wrote is the way Zara is, habits and all.')
  await page.getByRole('radio', { name: /^The Scrapbook/ }).check()
  await expect(page.locator('.scene-panel-note')).toHaveCount(0)
  await undoButton(page).click()
  await expect(page.locator('.scene-panel-note')).toBeVisible()
  await page.getByRole('button', { name: /^Back to / }).click()
  // The film's scenes are its own: each moment a scene called by its own words, with no stock scenes waiting to be filled.
  // Both photos sit beside scenes (the moment, and the single line), so none are left for the scene of photos.
  await expect(page.locator('.scene-tile-name')).toHaveText(['Before we begin', 'Moving day', 'The way Zara is', 'I love you because…', 'One last thing', 'Zara, in pictures', 'Voice notes', 'A letter', 'Add a scene'])
  await expect(sceneTile(page, 'Moving day')).toHaveClass(/is-in/)
  await expect(sceneTile(page, 'A letter')).toHaveClass(/is-missing/)
  await pickScene(page, 'The way Zara is')
  await expect(page.getByRole('radio', { name: 'A list' })).toBeChecked()
  await expect(page.getByRole('textbox', { name: 'Line 1' })).toHaveValue('You always steal the duvet, then ask why I am cold. “You run hot anyway.” Every time.')
  await pickScene(page, 'Moving day')

  // Its name and words are open right there, beside the still of it: nothing to find first. The film is still while they are written.
  await expect(page.locator('.scene-panel').getByRole('heading', { level: 1 })).toHaveText('Moving day')
  await expect(page).toHaveURL(/\/preview\?edit=1$/)
  await expect(page.getByRole('radio', { name: 'Words' })).toBeChecked()
  await page.getByLabel('Scene name').click()
  const film = page.locator('.preview-body > .film')
  await expect(film).toHaveAttribute('data-phase', 'ticket')
  expect((await audioState(page))?.trackId ?? null).toBeNull()
  await expect(page.getByLabel('Scene name')).toHaveValue('Moving day')
  await expect(page.getByLabel('What it says')).toHaveValue('The lift broke, and you carried the sofa up five floors arguing about the angle.')
  await page.getByLabel('Scene name').fill('The day the lift broke')
  // A still of the scene follows what is written, and so does its place in the row.
  const still = page.locator('.stage-still-frame .shot')
  await expect(still).toHaveAttribute('data-text', /The day the lift broke/)
  await expect(sceneTile(page, 'The day the lift broke')).toHaveClass(/is-in/)
  // The change can be taken back in one tap, from beside Done.
  await undoButton(page).click()
  await expect(page.locator('.edit-note')).toHaveText('The day the lift broke changed. Undone.')
  await expect(page.getByLabel('Scene name')).toHaveValue('Moving day')
  await expect(still).toHaveAttribute('data-text', /Moving day/)
  await expect(undoButton(page)).toBeDisabled()
  await page.getByLabel('Scene name').fill('The day the lift broke')
  // And the film plays the new words, with its song.
  await page.getByRole('button', { name: 'Play from here' }).click()
  await expect(film).toHaveAttribute('data-phase', 'playing')
  const told = (await walk(page, (shot) => shot.text.includes('The day the lift broke'))).at(-1)!
  expect(told.text).toContain('The day the lift broke')
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')

  // A scene of the sender's own is added in the same place, shaped as they like, and joins the film once it has words.
  await page.getByRole('button', { name: 'Add a scene' }).click()
  // Adding it keeps what was written before, as a step Undo can take back.
  await expect(page.locator('.edit-note')).toHaveText('A new scene was added.')
  await expect(page.locator('.scene-panel').getByRole('heading', { level: 1 })).toHaveText('New scene')
  await page.getByLabel('Scene name').fill('Her tea')
  // Where the still will be says what the scene still needs.
  await expect(page.locator('.stage-still-empty')).toContainText('Add its words.')
  await page.getByLabel('What it says').fill('Two sips, then it goes cold.')
  await expect(still).toHaveAttribute('data-text', 'Two sips, then it goes cold.')
  await expect(sceneTile(page, 'Her tea')).toHaveClass(/is-in/)
  await page.getByRole('radio', { name: 'A list' }).check()
  await page.getByRole('textbox', { name: 'Line 1' }).press('Enter')
  await page.getByRole('textbox', { name: 'Line 2' }).fill('Then she makes another')
  await expect(still).toHaveAttribute('data-text', /Then she makes another/)
  // Left out and removed, it is gone; Undo brings it back.
  await page.getByRole('button', { name: 'Leave out Her tea' }).click()
  await pickScene(page, 'Her tea')
  await page.getByRole('button', { name: 'Remove this scene' }).click()
  await expect(sceneTile(page, 'Her tea')).toHaveCount(0)

  // A told scene runs over pages: a blank line starts a new one, and the still follows the page being written.
  await pickScene(page, 'The day the lift broke')
  await page.getByLabel('What it says').fill('The lift broke, and you carried the sofa up five floors.\n\nYou argued about the angle the whole way.')
  await expect(still).toHaveAttribute('data-text', 'The day the lift broke. You argued about the angle the whole way.')
  // Everything is changed here: there is no second form.
  await expect(page.getByRole('link', { name: 'Edit every detail' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('the sample plays as a mixtape: a tape to press play on, tracks for scenes, and the song with it', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = trackErrors(page)
  await open(page, '/preview?sample=1&style=mixtape')
  const film = page.locator('.preview-body > .film')
  await expect(film).toHaveAttribute('data-world', 'mixtape')
  // The opening is the tape itself, with their name on its label.
  await expect(film.locator('.mx-tape-name')).toHaveText('Sarah')
  await expect(page.getByRole('button', { name: 'A mixtape made for Sarah. Tap to begin' })).toBeVisible()
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
  // Track one is the dedication, their name and the opening line together.
  const first = await filmState(page)
  expect(first.kind).toBe('name')
  expect(first.text).toContain('For Sarah. From Michael.')
  // The scenes after it are the sample's own, the whole story is told, and each list is announced as a numbered track.
  const shots = await walk(page, (shot) => shot.kind === 'wish')
  const said = shots.map((s) => s.text).join(' ')
  for (const line of ['You leave me voice notes when I’m in the next room.', 'we walked home for three hours', 'You just took the day off and stayed.']) expect(said).toContain(line)
  // Every scene is introduced by a card with its own name.
  expect(shots.filter((s) => s.kind === 'card').map((s) => s.text)).toEqual([
    'Scene one: Just like you. First, the things that are completely you.',
    'Scene two: The three-hour walk. Then there is the night we walked.',
    'Scene three: My mother’s soup. And then you got it right.',
    'Scene four: Just us. A few moments from along the way.',
    'Scene five: That day in March. Then there was March.',
  ])
  expect(said).not.toMatch(/red flag|memory lane|main character/i)
  await expect(film.locator('.shot.is-current .mx-wish')).toBeVisible()
  // Its colours have their own names, and switching them changes nothing else.
  await openEditor(page, 'Look')
  await expect(page.getByRole('radio', { name: /^The Mixtape/ })).toBeChecked()
  await page.getByRole('radio', { name: 'Sunset' }).check()
  await expect(film).toHaveAttribute('data-look', 'garden')
  await page.getByRole('radio', { name: 'Midnight' }).check()
  await expect(film).toHaveAttribute('data-look', 'screening')
  await closeEditor(page)
  expect(errors).toEqual([])
})

test('the sample plays as a scrapbook, and its scenes can be redesigned, moved, left out and put back', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  await open(page, '/preview?sample=1&style=scrapbook')
  const film = page.locator('.preview-body > .film')
  await expect(film).toHaveAttribute('data-world', 'scrapbook')

  // It opens as a closed album with their name on it, not a ticket.
  await expect(page.locator('.film .ticket')).toHaveCount(0)
  await expect(page.locator('.film .sb-plate')).toContainText('Sarah')
  await page.getByRole('button', { name: 'A book made for Sarah. Tap to open' }).click()
  await expect(film).toHaveAttribute('data-phase', 'playing', { timeout: 10_000 })
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
  // One title page carries the dedication, the name and the opening line.
  const first = await filmState(page)
  expect(first.kind).toBe('name')
  expect(first.text).toContain('For Sarah. From Michael. Sarah.')
  const marks = () => page.locator('.film-controls .mark').evaluateAll((els) => els.map((e) => e.getAttribute('title')))
  const before = await marks()
  expect(before).toHaveLength(7)

  // Another design for a scene: the film carries on from that scene, with the song still playing.
  // The editor opens on the scene that is playing. Choosing another takes the film to it.
  await openEditor(page)
  await expect(page.locator('.scene-tile.is-in')).toHaveCount(7)
  await expect(page.locator('.scene-tile .still-box')).toHaveCount(7)
  await expect(sceneTile(page, 'Before we begin').getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  await pickScene(page, 'Just like you')
  await expect(sceneTile(page, 'Just like you')).toHaveClass(/is-playing/)
  await expect(film.locator('.shot.is-current')).toHaveAttribute('data-text', /Just like you/)
  const design = page.locator('.scene-panel .scene-design')
  const was = (await design.textContent())!
  expect(['Sticky notes', 'Checklist']).toContain(was)
  const songTime = (await audioState(page))!.songTime!
  await page.getByRole('button', { name: 'Another design for Just like you' }).click()
  // What changed is said beside Undo, and the scene names its new design.
  await expect(page.locator('.edit-note')).toHaveText('Just like you has another design.')
  // A list steps through all four of the album's ways to draw one.
  await expect(design).toHaveText(was === 'Checklist' ? 'Tags on a string' : 'Checklist')
  await expect(film).toHaveAttribute('data-phase', 'playing')
  await expect(film.locator('.shot.is-current')).toHaveAttribute('data-text', /Just like you/)
  expect((await filmState(page)).kind).toBe('card')
  await expect.poll(async () => (await audioState(page))!.songTime!).toBeGreaterThan(songTime)
  // Step on to its first line: it is drawn in the design just chosen, under the scene's own name where the design shows one.
  for (let i = 0; i < 4 && (await filmState(page)).kind === 'card'; i++) await page.keyboard.press('ArrowRight')
  await expect(film.locator('.shot.is-current')).toHaveAttribute('data-design', was === 'Checklist' ? 'bunting' : 'checklist')
  if (was === 'Checklist') await expect(film.locator('.shot.is-current .sb-bigtag')).toBeVisible()
  else {
    await expect(film.locator('.shot.is-current .sb-pad li')).toHaveCount(1)
    await expect(film.locator('.shot.is-current .sb-pad h3')).toHaveText('Just like you')
    await expect(film.locator('.shot.is-current .sb-pad h3 svg')).toHaveCount(0)
  }

  // Move a scene earlier, leave one out, put it back, then undo everything.
  // The opening is fixed, so the scenes that can move start after it.
  const second = before[2]!
  await pickScene(page, second)
  await page.getByRole('button', { name: `Move ${second} earlier` }).click()
  expect((await marks()).slice(0, 3)).toEqual([before[0], second, before[1]])
  await pickScene(page, 'Just us')
  await page.getByRole('button', { name: 'Leave out Just us' }).click()
  expect(await marks()).not.toContain('Just us')
  expect(await marks()).toHaveLength(6)
  await expect(sceneTile(page, 'Just us')).toHaveClass(/is-off/)
  // One tap takes the last change back, and the film carries on from that scene.
  await expect(page.locator('.edit-note')).toHaveText('Just us left out.')
  await undoButton(page).click()
  expect(await marks()).toHaveLength(7)
  await expect(film.locator('.shot.is-current')).toHaveAttribute('data-text', /Just us/)
  await expect(page.locator('.edit-note')).toHaveText('Just us left out. Undone.')
  await page.getByRole('button', { name: 'Leave out Just us' }).click()
  expect(await marks()).toHaveLength(6)
  await page.getByRole('button', { name: 'Put back Just us' }).click()
  expect(await marks()).toHaveLength(7)
  await expect(film).toHaveAttribute('data-phase', 'playing')
  await page.getByRole('button', { name: 'Reset all scenes' }).click()
  expect(await marks()).toEqual(before)
  await closeEditor(page)

  // It still ends on the sealed note and the sender's last line, then the credits.
  const shots = await walk(page, (shot) => shot.kind === 'wish')
  expect(shots.map((s) => s.text).join(' ')).toContain('You leave me voice notes when I’m in the next room.')
  await expect(film.locator('.shot.is-current .note')).toBeVisible()
  await page.getByRole('button', { name: 'Open the note' }).click()
  await expect(page.locator('.film').getByRole('status')).toContainText('I want this one, with you.')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(film.locator('.shot.is-current .sb-libcard')).toContainText('Starring')
  await expect(film.locator('.shot.is-current')).toContainText('Sarah and Michael are fictional')

  // And back to the Screening, which opens on its ticket again.
  await chooseStyle(page, 'The Screening')
  await expect(film).toHaveAttribute('data-world', 'screening')
  await expect(page.getByRole('button', { name: 'Admit one: Sarah. Tap to begin' })).toBeVisible()
  expect(errors).toEqual([])
})

for (const [width, height] of [[1360, 800], [360, 740]]) {
  test(`the film waits for its song, and shows that it is being made (${width}px)`, async ({ page }) => {
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
    await page.getByRole('button', { name: 'Skip this' }).click()
    await page.getByLabel('About Kemi').fill(NOTE)
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Skip these' }).click()
    await page.getByRole('button', { name: 'Make the film' }).click()
    await expect(page).toHaveURL(/\/preview$/)

    // The notice says what is happening; it is a strip, and the film's opening is on screen under it.
    const status = page.locator('.song-status')
    const film = page.locator('.preview-body > .film')
    await expect(status).toContainText('Writing Kemi’s song')
    await expect(status).toContainText('The film starts when its song is ready')
    await expect(status).not.toContainText(/studio’s music|score/i)
    await expect(status.locator('.song-steps li')).toHaveText(['The words', 'The voice', 'On your film'])
    const room = async () => ({ status: (await status.boundingBox())!.height, film: (await film.boundingBox())!.height })
    const writing = await room()
    expect(writing.film, 'the film has most of the screen while the song is written').toBeGreaterThan(height * 0.5)
    expect(writing.status).toBeLessThan(height * 0.25)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)

    // The film cannot be started without its song: the opening says why, and a tap or a key does nothing.
    const held = page.locator('.film .ticket-hit')
    await expect(held).toBeDisabled()
    await expect(held).toHaveAccessibleName(/It starts when Kemi’s song is ready\.$/)
    await expect(page.locator('.film .opening-hint')).toHaveText('It starts when Kemi’s song is ready.')
    await film.click({ position: { x: 40, y: 40 }, force: true })
    await page.keyboard.press('Space')
    await expect(film).toHaveAttribute('data-phase', 'ticket')
    expect((await audioState(page))?.running ?? false).toBe(false)

    // The wait can be spent in the editor: a scene is shown as a still, and it still cannot be played.
    await openEditor(page)
    const still = page.locator('.stage-still-frame')
    await expect(still.locator('.still-box[data-fit]')).toBeVisible()
    expect((await still.boundingBox())!.height, 'the still of the chosen scene has room').toBeGreaterThan(110)
    await expect(page.getByRole('button', { name: 'Play from here' })).toBeDisabled()
    await expect(page.locator('.stage-foot')).toContainText('It starts when Kemi’s song is ready.')
    await expect(page.locator('.film-song')).toContainText('Kemi’s song is being made')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await closeEditor(page)

    await expect(status).toContainText('Kemi’s song is being sung', { timeout: 10_000 })
    await expect(status.locator('.song-steps li.is-done')).toHaveCount(1)
    expect((await room()).film).toBeGreaterThan(height * 0.5)
    await expect(held).toBeDisabled()

    // The finished song goes onto the film by itself, the notice leaves, and only then can it be played.
    await expect(status).toHaveCount(0, { timeout: 15_000 })
    expect((await film.boundingBox())!.height).toBeGreaterThan(writing.film)
    // From the editor, a scene plays from the tap that asks for it, with the song and no opening.
    await openEditor(page)
    await pickScene(page, 'The way Kemi is')
    await expect(film).toHaveAttribute('data-phase', 'ticket')
    await page.getByRole('button', { name: 'Play from here' }).click()
    await expect(film).toHaveAttribute('data-phase', 'playing')
    await expect(film.locator('.shot.is-current')).toHaveAttribute('data-text', /The way Kemi is/)
    await expect(page.locator('.stage-still')).toHaveCount(0)
    await expect(sceneTile(page, 'The way Kemi is')).toHaveClass(/is-playing/)
    await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
    await closeEditor(page)
    await expect(film).toHaveAttribute('data-phase', 'playing')
    // The credits name the song as the film's music.
    const end = (await walk(page)).at(-1)!
    expect(end.kind).toBe('credits')
    expect(end.text).toMatch(/Music: /)
    // The film has played through: sending it, changing it and watching it again are offered where it ends.
    // (`.tp-next` when the film is drawn in a template, `.credits-next` in the older kinds.)
    const next = film.locator('.shot.is-current').locator('.credits-next, .tp-next')
    await expect(next.getByRole('link', { name: 'Send this gift' })).toHaveAttribute('href', '/send')
    await expect(next.getByRole('button', { name: 'Watch it again' })).toBeVisible()
    for (const box of await next.locator('a, button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(width)
    }
    await next.getByRole('link', { name: 'Change something' }).click()
    await expect(page).toHaveURL(/edit=1/)
    await expect(page.locator('.scene-nav')).toBeVisible()
  })
}

test('a song that fails leaves the film silent, never with other music, and can be tried again', async ({ page }) => {
  let fail = true
  await page.route('**/api/music', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    if (fail) return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'The music service didn’t answer.' }) })
    await new Promise((done) => setTimeout(done, 1500))
    await route.continue()
  })
  await open(page, '/start')
  await page.getByRole('button', { name: 'Friend', exact: true }).click()
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByLabel('Your name').press('Enter')
  await page.getByRole('button', { name: 'Thank you' }).click()
  await page.getByRole('button', { name: 'Skip this' }).click()
  await page.getByLabel('About Kemi').fill(NOTE)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip these' }).click()
  await page.getByRole('button', { name: 'Make the film' }).click()
  await expect(page).toHaveURL(/\/preview$/)
  const status = page.locator('.song-status')
  const film = page.locator('.preview-body > .film')
  await expect(status).toContainText('Kemi’s song didn’t come through.', { timeout: 15_000 })
  await expect(status).toContainText('The music service didn’t answer. Until it is made, the film has no music.')
  // It can be watched, in silence: nothing stands in for the song.
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.running).toBe(true)
  await page.waitForTimeout(1500)
  expect((await audioState(page))!.trackId).toBeNull()
  await expect(page.locator('.film-now')).toHaveCount(0)
  const end = (await walk(page)).at(-1)!
  expect(end.kind).toBe('credits')
  expect(end.text).not.toMatch(/Music/)
  // The send page says so too.
  await page.getByRole('banner').getByRole('link', { name: /^Send/ }).click()
  await expect(page.locator('.gift-summary')).toContainText('No song yet, so this film would play without music.')
  await page.getByRole('link', { name: 'Back to the preview' }).click()

  // Trying again makes it, and the film takes it up.
  fail = false
  await page.locator('.song-status').getByRole('button', { name: 'Try again' }).click()
  await expect(page.locator('.song-status')).toContainText('Kemi’s song is being sung')
  await expect(page.locator('.song-status')).toHaveCount(0, { timeout: 15_000 })
  await startFilm(page)
  await expect.poll(async () => (await audioState(page))?.trackId, { timeout: 15_000 }).toBe('song')
})

test('words the music model refuses are written again and sung, without troubling the sender', async ({ page }) => {
  // The model refuses lyrics that come too close to an existing song. The first draft is refused here.
  let sung = 0
  await page.route('**/api/music', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    // Each attempt takes a moment, as a real one does, so the notice can be watched throughout.
    await new Promise((done) => setTimeout(done, 1200))
    if (++sung === 1) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'A line is too close to another song.' }) })
    await route.continue()
  })
  const drafts: Array<Record<string, unknown>> = []
  page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/lyrics') && drafts.push(r.postDataJSON() as Record<string, unknown>))
  await open(page, '/start')
  await page.getByRole('button', { name: 'Friend', exact: true }).click()
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByLabel('Your name').press('Enter')
  await page.getByRole('button', { name: 'Thank you' }).click()
  await page.getByRole('button', { name: 'Skip this' }).click()
  await page.getByLabel('About Kemi').fill(NOTE)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip these' }).click()
  await page.getByRole('button', { name: 'Make the film' }).click()
  await expect(page).toHaveURL(/\/preview$/)
  // It never reaches the sender as a failure: the notice stays on "being made" until the song is there.
  const status = page.locator('.song-status')
  await expect(status).toBeVisible()
  const seen = new Set<string>()
  await expect
    .poll(
      async () => {
        // Asked of the page directly: a locator would wait for a notice that has already gone.
        const state = await page.evaluate(() => document.querySelector('.song-status')?.className ?? null)
        if (state) seen.add(state)
        return state
      },
      { timeout: 20_000, intervals: [100] },
    )
    .toBeNull()
  expect([...seen].join(' ')).not.toContain('is-failed')
  expect(sung).toBe(2)
  expect(drafts.map((d) => d.fresh)).toEqual([false, true])
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
  await expect(page.getByLabel('Add photos', { exact: true })).toHaveAttribute('accept', 'image/*,.heic,.heif,video/mp4,video/quicktime,video/webm,.mov')

  await page.getByLabel('Add photos', { exact: true }).setInputFiles([
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
  await page.getByRole('button', { name: 'Skip these' }).click()
  await page.getByRole('button', { name: 'Make the film' }).click()
  await expect(page).toHaveURL(/\/preview$/)
  await startFilm(page)
  await walk(page, (shot) => shot.kind === 'photo')
  const shown = page.locator('.preview-body > .film .shot.is-current img').first()
  await expect.poll(() => shown.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('the opening can be skipped, and clearing a draft can be undone', async ({ page }) => {
  await open(page, '/preview?sample=1')
  const film = page.locator('.preview-body > .film')
  await page.getByRole('button', { name: 'Admit one: Sarah. Tap to begin' }).click()
  await expect(film).toHaveAttribute('data-phase', 'leader')
  await expect(page.locator('.opening-skip')).toHaveText('Tap to skip')
  // A second tap goes straight to the film, well before the countdown would have finished.
  await page.waitForTimeout(600)
  const tapped = Date.now()
  await page.getByRole('button', { name: 'Skip the opening' }).click()
  await expect(film).toHaveAttribute('data-phase', 'playing', { timeout: 1500 })
  expect(Date.now() - tapped).toBeLessThan(1500)
  expect((await filmState(page)).shot).toBe(0)
  await expect.poll(async () => (await audioState(page))?.running).toBe(true)

  // The whole draft can be cleared by one button, so that button can be taken back.
  await open(page, '/create')
  await page.getByRole('button', { name: 'Fill with the sample' }).click()
  await expect(page.locator('.undo-toast')).toContainText('Filled with the sample.')
  await expect(page.getByLabel('Their name')).toHaveValue('Zara')
  await page.getByLabel('Their name').fill('Zara-Rose')
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByLabel('Their name')).toHaveValue('')
  await expect(page.locator('.undo-toast')).toContainText('Draft cleared.')
  await page.locator('.undo-toast').getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByLabel('Their name')).toHaveValue('Zara-Rose')
  await expect(page.locator('.reel-count')).toHaveText('9 of 9 scenes ready')
  await expect(page.locator('.undo-toast')).toHaveCount(0)
})

test('a new film is drawn in one of the studio’s templates, and another version is another design', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  await open(page, '/start')
  await page.getByRole('button', { name: 'Friend', exact: true }).click()
  await page.getByLabel('Their name').fill('Kemi')
  await page.getByLabel('Your name').fill('Ada')
  await page.getByLabel('Your name').press('Enter')
  await page.getByRole('button', { name: 'Thank you' }).click()
  await page.getByRole('button', { name: 'Skip this' }).click()
  await page.getByLabel('About Kemi').fill('Moving day. The lift broke, and you carried the sofa up five floors arguing about the angle. You never finish your tea. You always text to check I got home.')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip these' }).click()
  await page.getByRole('button', { name: 'Make the film' }).click()
  await expect(page).toHaveURL(/\/preview$/)
  await expect(page.locator('.song-status')).toHaveCount(0, { timeout: 15_000 })

  // The film is a template's: its cover is a page of that design, with their name, and the whole of it starts the film.
  const film = page.locator('.preview-body > .film')
  await expect(film).toHaveClass(/tp-film/)
  const first = await film.getAttribute('data-template')
  expect(first).toMatch(/^[a-z][a-z0-9-]+$/)
  await expect(film.locator('.tp-opening [data-slot="recipient"]')).toHaveText('Kemi', { ignoreCase: true })
  // It is one the studio lists, and it carries the film's colours.
  const listed = (await (await page.request.get('/templates/index.json')).json()) as string[]
  expect(listed).toContain(first)
  expect(await film.evaluate((el) => getComputedStyle(el).getPropertyValue('--c-bg'))).toMatch(/^#[0-9a-f]{6}$/)

  // It plays through to the ending, every page drawn by the template, with no words left not fitting.
  await startFilm(page)
  await expect(film.locator('.shot.is-current .tp')).toHaveAttribute('data-page', 'name')
  const seen = await walk(page, (shot) => shot.kind === 'wish')
  expect(new Set(seen.map((s) => s.kind))).toEqual(new Set(['name', 'card', 'line', 'photo', 'flag', 'reason', 'montage', 'wish'].filter((k) => seen.some((s) => s.kind === k))))
  await expect(film.locator('.shot.is-current .tp')).toHaveAttribute('data-page', 'wish')
  await expect(film.locator('.tp-fit[data-over="1"]')).toHaveCount(0)
  await film.locator('.tp-button').first().click()
  await expect.poll(async () => (await filmState(page)).kind, { timeout: 15_000 }).toBe('reveal')

  // In the editor the scenes are stills of the same design; there is no kind of film to pick, and another version is another design.
  await openEditor(page)
  await expect(page.locator('.scene-strip .film.still').first()).toHaveAttribute('data-template', first!)
  await expect(page.getByRole('button', { name: /^Look/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Try another version' }).click()
  await expect.poll(() => page.locator('.scene-strip .film.still').first().getAttribute('data-template')).not.toBe(first)
  expect(listed).toContain(await page.locator('.scene-strip .film.still').first().getAttribute('data-template'))
  // Undo brings the first design back.
  await undoButton(page).click()
  await expect(page.locator('.scene-strip .film.still').first()).toHaveAttribute('data-template', first!)
  expect(errors).toEqual([])
})
