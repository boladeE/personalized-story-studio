import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/** `tag` names the mode a page is in, beside the wordmark. */
export function StudioHeader({ children, tag = 'Studio' }: { children?: ReactNode; tag?: string }) {
  return (
    <header className="studio-header">
      <Link to="/" className="wordmark" aria-label="Little Things Digital studio, home">
        little things <span>digital</span>
      </Link>
      <span className="studio-tag">{tag}</span>
      <div className="studio-header-extra">{children}</div>
    </header>
  )
}
