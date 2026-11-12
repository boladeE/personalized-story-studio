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
}

interface DraftValue {
  intake: Intake
  setIntake: (update: (current: Intake) => Intake) => void
  seed: number
  setSeed: (seed: number) => void
  song: DraftSong | null
  setSong: (song: DraftSong | null) => void
}

const DraftContext = createContext<DraftValue | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [intake, setIntakeState] = useState<Intake>(emptyIntake)
  const [seed, setSeed] = useState(1)
  const [song, setSong] = useState<DraftSong | null>(null)
  const value = useMemo<DraftValue>(
    () => ({ intake, setIntake: (update) => setIntakeState(update), seed, setSeed, song, setSong }),
    [intake, seed, song],
  )
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useDraft() {
  const value = useContext(DraftContext)
  if (!value) throw new Error('useDraft must be used inside DraftProvider')
  return value
}
