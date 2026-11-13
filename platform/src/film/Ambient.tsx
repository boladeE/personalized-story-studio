import { useEffect, useRef } from 'react'
import { Backdrop } from './backdrop'
import { Particles } from './particles'

/** Slow smoke and drifting dust behind a page. Decorative; still under reduced motion. */
export function Ambient({ colors, ink = '#f6e9d8', density = 1 }: { colors: { a: string; b: string; c: string }; ink?: string; density?: number }) {
  const haze = useRef<HTMLCanvasElement>(null)
  const dust = useRef<HTMLCanvasElement>(null)
  const { a, b, c } = colors
  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const backdrop = haze.current ? new Backdrop(haze.current) : null
    const particles = dust.current ? new Particles(dust.current) : null
    if (backdrop) {
      if (!backdrop.ok && haze.current) haze.current.style.display = 'none'
      backdrop.still = calm
      backdrop.set({ a, b, c }, { cut: true })
      backdrop.start()
    }
    if (particles) {
      particles.calm = calm
      particles.ink = ink
      particles.start()
      particles.dust(density)
    }
    const onResize = () => particles?.dust(density)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      backdrop?.stop()
      particles?.stop()
    }
  }, [a, b, c, ink, density])
  return (
    <div className="ambient" aria-hidden="true">
      <canvas ref={haze} />
      <canvas ref={dust} />
    </div>
  )
}
