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
    kind: document.querySelector<HTMLElement>('.shot.is-current')?.dataset.shotKind,
    text: document.querySelector<HTMLElement>('.shot.is-current')?.dataset.text ?? '',
  }))

/** Tear the ticket and wait for the countdown to finish. */
export async function startFilm(page: Page) {
  await page.getByRole('button', { name: /Tap to begin/ }).click()
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
