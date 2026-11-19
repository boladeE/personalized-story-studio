import type { ReactNode } from 'react'

/**
 * A wait the sender can see: moving levels, what is happening, and a bar.
 * With `seconds`, the bar fills over about that long (an estimate of how long
 * the step usually takes, not a measured percentage) and never quite finishes
 * by itself. Without it, the bar just keeps moving.
 */
export function Working({ children, seconds, className = '' }: { children: ReactNode; seconds?: number; className?: string }) {
  return (
    <div className={`working ${className}`} role="status">
      <span className="working-levels" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="working-words">{children}</span>
      <span className={`working-bar${seconds ? '' : ' is-open'}`} aria-hidden="true">
        <i style={seconds ? { animationDuration: `${seconds}s` } : undefined} />
      </span>
    </div>
  )
}
