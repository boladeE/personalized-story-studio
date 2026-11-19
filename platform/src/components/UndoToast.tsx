import { useEffect } from 'react'
import type { ReactNode } from 'react'

/**
 * Says what was just removed and offers to put it back. Removing something is
 * never confirmed first: it happens at once and can be undone here for a few
 * seconds. `onDone` is called when the offer runs out, so whatever was kept
 * for the undo can be let go.
 */
export function UndoToast({ children, onUndo, onDone, seconds = 9, token, floating = false }: { children: ReactNode; onUndo: () => void; onDone: () => void; seconds?: number; token: unknown; /** Pinned to the top of the window, for a change made from the header. Otherwise it sits where it is placed. */ floating?: boolean }) {
  // A new removal restarts the clock.
  useEffect(() => {
    const id = window.setTimeout(onDone, seconds * 1000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, seconds])
  return (
    <div className={`undo-toast${floating ? ' is-floating' : ''}`} role="status">
      <span>{children}</span>
      <button type="button" onClick={onUndo}>
        Undo
      </button>
    </div>
  )
}
