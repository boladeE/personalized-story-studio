import type { Page } from '@playwright/test'

export async function open(page: Page, url: string) {
  await page.goto(url)
  await page.waitForSelector('html[data-ready="true"]', { timeout: 30_000 })
}

export const audioState = (page: Page) => page.evaluate(() => window.__ltAudio?.state())
export const filmState = (page: Page) =>
  page.evaluate(() => ({
    phase: window.__ltFilm?.phase(),
    shot: window.__ltFilm?.shot() ?? -1,
    time: window.__ltFilm?.time() ?? 0,
    // The film itself, not the stills of it in the editor.
    kind: document.querySelector<HTMLElement>('.film:not(.still) .shot.is-current')?.dataset.shotKind,
    text: document.querySelector<HTMLElement>('.film:not(.still) .shot.is-current')?.dataset.text ?? '',
  }))

/** The film is watched first. Its editor opens around it from Edit; `part` goes on to the look of the film, or to the song's room. */
/**
 * Have new films made as one of the studio's three older kinds (Screening, Scrapbook, Mixtape), by
 * telling the page there are no templates to draw from. For tests of those kinds and of choosing between them.
 */
export async function olderKinds(page: Page) {
  await page.route('**/templates/index.json', (route) => route.fulfill({ json: [] }))
}

export async function openEditor(page: Page, part?: 'Look' | 'Song') {
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  if (part === 'Look') await page.getByRole('button', { name: /^Look/ }).click()
  if (part === 'Song') await page.locator('.film-song-open').click()
}

/** The editor's Undo, beside Done. */
export const undoButton = (page: Page) => page.locator('.studio-header').getByRole('button', { name: 'Undo' })

export async function closeEditor(page: Page) {
  await page.getByRole('link', { name: 'Done', exact: true }).click()
}

/** A scene in the editor's row, by name. */
export const sceneTile = (page: Page, name: string) => page.locator('.scene-tile').filter({ has: page.getByRole('button', { name: new RegExp(`^${name}`) }) })

/** Choose a scene in the editor, so its changes are offered. */
export async function pickScene(page: Page, name: string) {
  await sceneTile(page, name).locator('> button').click()
}

/** Pick the kind of film. A new film's kind is drawn from its seed, so tests that need one choose it. */
export async function chooseStyle(page: Page, name: 'The Screening' | 'The Scrapbook' | 'The Mixtape') {
  await openEditor(page, 'Look')
  await page.getByRole('radio', { name: new RegExp(`^${name}`) }).check()
  await closeEditor(page)
}

/** Tear the ticket (or open the album) and wait for the film to start. */
export async function startFilm(page: Page) {
  await page.getByRole('button', { name: /Tap to (begin|open)/ }).click()
  await page.waitForFunction(() => window.__ltFilm?.phase() === 'playing', undefined, { timeout: 15_000 })
}

/** Step through the film with Next, collecting what each shot says, until `stop` or the end. */
export async function walk(page: Page, stop?: (shot: Awaited<ReturnType<typeof filmState>>) => boolean) {
  const seen: Array<Awaited<ReturnType<typeof filmState>>> = []
  for (let i = 0; i < 80; i++) {
    const state = await filmState(page)
    seen.push(state)
    if (stop?.(state)) break
    const next = page.getByRole('button', { name: 'Next' })
    if (await next.isDisabled()) break
    await next.click()
    await page.waitForFunction((from) => window.__ltFilm?.shot() !== from, state.shot)
  }
  return seen
}

export function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return errors
}
