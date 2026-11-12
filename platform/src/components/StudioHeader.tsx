import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function StudioHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="studio-header">
      <Link to="/" className="wordmark" aria-label="Little Things Digital studio, home">
        little things <span>digital</span>
      </Link>
      <span className="studio-tag">Studio</span>
      <div className="studio-header-extra">{children}</div>
    </header>
  )
}
