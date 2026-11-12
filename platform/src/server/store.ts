import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Intake, Story } from '../story/types'

/**
 * Gift storage for this milestone: one folder per gift on local disk
 * (DATA_DIR, a Railway volume in production). Swappable for Postgres + R2 later
 * without touching routes, because everything goes through these functions.
 */

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? '.data')
const giftsDir = path.join(DATA_DIR, 'gifts')
export const songsDir = path.join(DATA_DIR, 'songs')

const SLUG_RE = /^[a-z0-9]{12}$/
const MEDIA_RE = /^[a-z0-9-]{1,64}$/i
export const isSlug = (value: string) => SLUG_RE.test(value)
export const isMediaId = (value: string) => MEDIA_RE.test(value)

export interface GiftRecord {
  slug: string
  createdAt: string
  question: string
  answer: { salt: string; hash: string }
  manageKeyHash: string
  intake: Intake
  story: Story
  media: Record<string, string> // media id -> content type
  payment: { status: 'test'; note: string }
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export function newSlug() {
  const bytes = randomBytes(12)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}
export const newManageKey = () => randomBytes(24).toString('base64url')
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** Answers are compared loosely: case, spacing and punctuation at the edges don't matter. */
export function normalizeAnswer(answer: string) {
  return answer
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s ]+/g, ' ')
    .replace(/^[\s"'“”‘’.,!?]+|[\s"'“”‘’.,!?]+$/g, '')
}

export function hashAnswer(answer: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(normalizeAnswer(answer), salt, 32).toString('hex')
  return { salt, hash }
}

export function checkAnswer(answer: string, stored: GiftRecord['answer']) {
  const hash = scryptSync(normalizeAnswer(answer), stored.salt, 32)
  const expected = Buffer.from(stored.hash, 'hex')
  return hash.length === expected.length && timingSafeEqual(hash, expected)
}

export function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right)
}

/* ---------- Unlock cookie ---------- */

let devSecretWarned = false
function secret() {
  const value = process.env.SESSION_SECRET
  if (value && value.length >= 32) return value
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET (32+ characters) must be set in production')
  if (!devSecretWarned) {
    devSecretWarned = true
    console.warn('[gifts] SESSION_SECRET not set; using an insecure development secret.')
  }
  return 'development-only-secret-not-for-production-use'
}

const COOKIE_DAYS = 30
export const cookieName = (slug: string) => `lt_gift_${slug}`

export function signUnlock(slug: string, now = Date.now()) {
  const expires = now + COOKIE_DAYS * 86_400_000
  const mac = createHmac('sha256', secret()).update(`${slug}.${expires}`).digest('base64url')
  return `${expires}.${mac}`
}

export function verifyUnlock(slug: string, token: string | undefined, now = Date.now()) {
  if (!token) return false
  const [expiresText, mac] = token.split('.')
  const expires = Number(expiresText)
  if (!Number.isFinite(expires) || expires < now || !mac) return false
  const expected = createHmac('sha256', secret()).update(`${slug}.${expires}`).digest()
  const given = Buffer.from(mac, 'base64url')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export function unlockCookie(slug: string, request: Request) {
  // Behind Railway's proxy the app sees http; the original scheme is in x-forwarded-proto.
  const https = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https'
  const secure = https ? '; Secure' : ''
  return `${cookieName(slug)}=${signUnlock(slug)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_DAYS * 86_400}${secure}`
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return undefined
}

export const isUnlocked = (slug: string, request: Request) => verifyUnlock(slug, readCookie(request, cookieName(slug)))

/* ---------- Unlock attempt limits (per gift, in memory) ---------- */

const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60_000

export function takeAttempt(key: string, now = Date.now()) {
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 }
  }
  if (entry.count >= MAX_ATTEMPTS) return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  entry.count++
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count }
}
export const clearAttempts = (key: string) => attempts.delete(key)

/* ---------- Files ---------- */

const giftPath = (slug: string) => {
  if (!isSlug(slug)) throw new Error('Bad gift id')
  return path.join(giftsDir, slug)
}

export async function saveGift(record: GiftRecord, files: Array<{ id: string; bytes: Uint8Array }>) {
  const dir = giftPath(record.slug)
  await mkdir(path.join(dir, 'media'), { recursive: true })
  for (const file of files) {
    if (!isMediaId(file.id)) throw new Error('Bad media id')
    await writeFile(path.join(dir, 'media', file.id), file.bytes)
  }
  await writeFile(path.join(dir, 'gift.json'), JSON.stringify(record))
}

export async function loadGift(slug: string): Promise<GiftRecord | null> {
  if (!isSlug(slug)) return null
  try {
    return JSON.parse(await readFile(path.join(giftPath(slug), 'gift.json'), 'utf8')) as GiftRecord
  } catch {
    return null
  }
}

export async function readMedia(slug: string, id: string) {
  if (!isSlug(slug) || !isMediaId(id)) return null
  try {
    return await readFile(path.join(giftPath(slug), 'media', id))
  } catch {
    return null
  }
}

export async function deleteGift(slug: string) {
  await rm(giftPath(slug), { recursive: true, force: true })
}

/* ---------- Upload checks ---------- */

/** Identify an image by its first bytes rather than trusting the browser's label. */
export function sniffImage(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  return null
}

export function sniffAudio(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav'
  if (ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (ascii(0, 4) === 'OggS') return 'audio/ogg'
  if (ascii(0, 4) === 'fLaC') return 'audio/flac'
  if (ascii(4, 8) === 'ftyp') return 'audio/mp4'
  return null
}

export function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(body), { ...init, headers })
}
