import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { emptyIntake } from '../story/sample'
import type { Intake } from '../story/types'

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
}

const DraftContext = createContext<DraftValue | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [intake, setIntakeState] = useState<Intake>(emptyIntake)
  const [seed, setSeed] = useState(1)
  const [song, setSong] = useState<DraftSong | null>(null)
  const [takes, setTakes] = useState<DraftSong[]>([])
  const [words, setWords] = useState<DraftWords | null>(null)
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
    }),
    [intake, seed, song, takes, words],
  )
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useDraft() {
  const value = useContext(DraftContext)
  if (!value) throw new Error('useDraft must be used inside DraftProvider')
  return value
}
