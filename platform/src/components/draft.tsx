import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { emptyIntake } from '../story/sample'
import type { Intake } from '../story/types'
import { songDetails, VIBES } from '../story/vibes'
import type { VibeId, Voice } from '../story/vibes'

/**
 * The sender's draft lives only in memory for this browser tab until they
 * choose to send it. A reload clears it. Photos are local object URLs.
 */
export interface DraftSong {
  id: string
  src: string
  label: string
  /** Sung about the recipient, or an instrumental. */
  sung?: boolean
  /** The sung words: the ones the sender approved, or what the music model reports. */
  lyrics?: string
  /** The tune it was made in. */
  vibe?: string
}

/** The words of the song, written by the studio and open to the sender's edits. */
export interface DraftWords {
  title: string
  lyrics: string
}

const MAX_TAKES = 6

/** What the short flow asks about the song. `surprise` lets the studio pick; `none` keeps the studio score. */
export interface SongPlan {
  vibe: VibeId | 'surprise' | 'none'
  voice: Voice
}

/** The style used when the sender leaves it to the studio: the one behind the sample's song. */
export const DEFAULT_VIBE: VibeId = VIBES[0].id

/** A song being written and sung in the background while the sender watches the film. */
export type SongJob =
  | { state: 'idle' }
  | { state: 'writing' }
  | { state: 'singing' }
  | { state: 'ready'; song: DraftSong }
  | { state: 'failed'; error: string }

interface DraftValue {
  intake: Intake
  setIntake: (update: (current: Intake) => Intake) => void
  seed: number
  setSeed: (seed: number) => void
  /** The song the film plays; null for the studio score. */
  song: DraftSong | null
  setSong: (song: DraftSong | null) => void
  /** Every version of the song made in this sitting, oldest first. */
  takes: DraftSong[]
  /** Keep a new take and play it in the film. */
  addTake: (song: DraftSong) => void
  words: DraftWords | null
  setWords: (words: DraftWords | null) => void
  /** What the sender wrote in the short flow's one box, and the text that was last sorted into scenes. */
  about: string
  setAbout: (about: string) => void
  sortedFrom: string
  setSortedFrom: (text: string) => void
  /** True once an occasion was chosen on the home page, so the short flow doesn't ask again. */
  occasionGiven: boolean
  setOccasionGiven: (given: boolean) => void
  plan: SongPlan
  setPlan: (plan: SongPlan) => void
  job: SongJob
  /** Write and sing a song for this intake without holding the sender up. */
  startSong: (intake: Intake, plan: SongPlan) => void
  /** Put the finished song on the film. */
  playJobSong: () => void
}

const DraftContext = createContext<DraftValue | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [intake, setIntakeState] = useState<Intake>(emptyIntake)
  const [seed, setSeed] = useState(1)
  const [song, setSong] = useState<DraftSong | null>(null)
  const [takes, setTakes] = useState<DraftSong[]>([])
  const [words, setWords] = useState<DraftWords | null>(null)
  const [about, setAbout] = useState('')
  const [sortedFrom, setSortedFrom] = useState('')
  const [occasionGiven, setOccasionGiven] = useState(false)
  const [plan, setPlan] = useState<SongPlan>({ vibe: 'surprise', voice: 'surprise' })
  const [job, setJob] = useState<SongJob>({ state: 'idle' })
  const run = useRef(0)

  const startSong = useCallback((forIntake: Intake, forPlan: SongPlan) => {
    const details = songDetails(forIntake)
    if (!details || forPlan.vibe === 'none') return
    const mine = ++run.current
    const current = () => mine === run.current
    const post = async (url: string, payload: unknown) => {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'The song didn’t come through.')
      return body
    }
    setJob({ state: 'writing' })
    void (async () => {
      try {
        const written = await post('/api/lyrics', { details, tone: 'smooth' })
        if (!current()) return
        const lyrics = String(written.lyrics ?? '')
        const title = String(written.title ?? '')
        setWords({ title, lyrics })
        setJob({ state: 'singing' })
        const vibe = forPlan.vibe === 'surprise' ? DEFAULT_VIBE : forPlan.vibe
        const made = await post('/api/music', { vibe, details, lyrics, title, voice: forPlan.voice })
        if (!current()) return
        const song: DraftSong = { id: String(made.id), src: String(made.src), label: String(made.label ?? 'Original song'), sung: Boolean(made.sung), lyrics: String(made.lyrics ?? lyrics), vibe }
        setTakes((list) => [...list, song].slice(-MAX_TAKES))
        setJob({ state: 'ready', song })
      } catch (error) {
        if (current()) setJob({ state: 'failed', error: error instanceof Error ? error.message : 'The song didn’t come through.' })
      }
    })()
  }, [])
  const value = useMemo<DraftValue>(
    () => ({
      intake,
      setIntake: (update) => setIntakeState(update),
      seed,
      setSeed,
      song,
      setSong,
      takes,
      addTake: (take) => {
        setTakes((current) => [...current, take].slice(-MAX_TAKES))
        setSong(take)
      },
      words,
      setWords,
      about,
      setAbout,
      sortedFrom,
      setSortedFrom,
      occasionGiven,
      setOccasionGiven,
      plan,
      setPlan,
      job,
      startSong,
      playJobSong: () => {
        if (job.state !== 'ready') return
        setSong(job.song)
        setJob({ state: 'idle' })
      },
    }),
    [intake, seed, song, takes, words, about, sortedFrom, occasionGiven, plan, job, startSong],
  )
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useDraft() {
  const value = useContext(DraftContext)
  if (!value) throw new Error('useDraft must be used inside DraftProvider')
  return value
}
