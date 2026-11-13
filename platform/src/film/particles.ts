/**
 * One canvas of small lights over the film: drifting dust, words that gather
 * from dust or blow away into it, sparks when the candle goes out, and
 * confetti. Everything is drawn in CSS pixels relative to the canvas.
 */

interface Mote {
  kind: 'dust' | 'gather' | 'scatter' | 'spark' | 'confetti'
  x: number
  y: number
  vx: number
  vy: number
  /** Home position for words. */
  hx: number
  hy: number
  /** Where a gathering mote started. */
  sx: number
  sy: number
  size: number
  age: number
  delay: number
  life: number
  seed: number
  color: string
}

const TARGET_POINTS = 2600
const ease = (u: number) => 1 - (1 - u) ** 3

export class Particles {
  private ctx: CanvasRenderingContext2D | null
  private motes: Mote[] = []
  private frame = 0
  private last = 0
  private paused = false
  private width = 0
  private height = 0
  private rain = { until: 0, colors: [] as string[], carry: 0 }
  private clock = 0
  ink = '#f6e9d8'
  /** Light looks draw ink on paper; dark looks add light. */
  light = false
  calm = false
  pulse = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')
  }

  start() {
    if (!this.ctx || this.frame) return
    this.last = performance.now()
    const tick = (now: number) => {
      this.frame = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      if (!this.paused) this.step(dt)
      this.draw()
    }
    this.frame = requestAnimationFrame(tick)
  }

  stop() {
    cancelAnimationFrame(this.frame)
    this.frame = 0
  }

  setPaused(paused: boolean) {
    this.paused = paused
  }

  /** Remove words, sparks and confetti (after a jump in the film). Dust stays. */
  clear() {
    this.motes = this.motes.filter((m) => m.kind === 'dust')
    this.rain.until = 0
  }

  /** Ambient dust, scaled to the screen. */
  dust(density = 1) {
    this.motes = this.motes.filter((m) => m.kind !== 'dust')
    if (this.calm) return
    this.measure()
    const count = Math.round(Math.min(90, (this.width * this.height) / 16000) * density)
    for (let i = 0; i < count; i++) {
      const depth = Math.random()
      this.motes.push(this.mote('dust', Math.random() * this.width, Math.random() * this.height, {
        vx: (Math.random() - 0.5) * 6,
        vy: -(3 + depth * 10),
        size: 0.6 + depth * depth * 2.6,
        life: Infinity,
      }))
    }
  }

  /** Dust gathers into the words inside `el`, then `onSolid` should show the real text. */
  gather(el: HTMLElement, onSolid: () => void, seconds = 1.9) {
    const points = this.calm ? [] : this.sample(el)
    if (!points.length) return onSolid()
    const { minX, span } = bounds(points)
    for (const [hx, hy] of points) {
      const side = Math.random() < 0.5 ? -1 : 1
      const sx = hx + side * (140 + Math.random() * 320)
      const sy = hy + (Math.random() - 0.5) * 220 - 30
      this.motes.push(this.mote('gather', sx, sy, {
        hx, hy, sx, sy,
        delay: ((hx - minX) / span) * seconds * 0.42 + Math.random() * 0.28,
        life: seconds + 0.45,
        size: 0.9 + Math.random() * 1.1,
      }))
    }
    this.after(seconds, onSolid)
  }

  /** The words inside `el` blow away. Hide the element right after calling. */
  scatter(el: HTMLElement) {
    if (this.calm) return
    const points = this.sample(el)
    if (!points.length) return
    const { minX, span } = bounds(points)
    for (const [hx, hy] of points) {
      this.motes.push(this.mote('scatter', hx, hy, {
        hx, hy,
        vx: 50 + Math.random() * 190,
        vy: -(10 + Math.random() * 70),
        delay: ((hx - minX) / span) * 0.55 + Math.random() * 0.18,
        life: 1 + Math.random() * 0.9,
        size: 0.9 + Math.random() * 1.1,
      }))
    }
  }

  /** Sparks from a point, for the candle. */
  burst(x: number, y: number, colors: string[], count = 150) {
    if (this.calm) return
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5
      const speed = 90 + Math.random() * 460
      this.motes.push(this.mote('spark', x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.7 + Math.random() * 1.1,
        size: 1 + Math.random() * 2,
        color: colors[i % colors.length],
      }))
    }
  }

  /** Confetti falls for a while. */
  confetti(colors: string[], seconds = 6) {
    if (this.calm) return
    this.rain = { until: this.clock + seconds, colors, carry: 0 }
  }

  private timers: Array<{ at: number; run: () => void }> = []
  private after(seconds: number, run: () => void) {
    this.timers.push({ at: this.clock + seconds, run })
  }

  private mote(kind: Mote['kind'], x: number, y: number, extra: Partial<Mote>): Mote {
    return { kind, x, y, vx: 0, vy: 0, hx: x, hy: y, sx: x, sy: y, size: 1, age: 0, delay: 0, life: 1, seed: Math.random() * 1000, color: '', ...extra }
  }

  private measure() {
    const rect = this.canvas.getBoundingClientRect()
    this.width = rect.width
    this.height = rect.height
    return rect
  }

  /** Points on the glyphs of every `[data-w]` word inside `el`, in canvas coordinates. */
  private sample(el: HTMLElement): Array<[number, number]> {
    const origin = this.measure()
    const wordEls = Array.from(el.querySelectorAll<HTMLElement>('[data-w]'))
    if (!wordEls.length) return []
    const rects = wordEls.map((w) => w.getBoundingClientRect())
    const left = Math.min(...rects.map((r) => r.left))
    const top = Math.min(...rects.map((r) => r.top))
    const width = Math.ceil(Math.max(...rects.map((r) => r.right)) - left) + 8
    const height = Math.ceil(Math.max(...rects.map((r) => r.bottom)) - top) + 8
    if (width < 4 || height < 4 || width * height > 4_000_000) return []
    const off = document.createElement('canvas')
    off.width = width
    off.height = height
    const g = off.getContext('2d', { willReadFrequently: true })
    if (!g) return []
    g.fillStyle = '#000'
    g.textBaseline = 'middle'
    wordEls.forEach((word, i) => {
      const style = getComputedStyle(word)
      g.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      if ('fontStretch' in g) (g as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = style.fontStretch.endsWith('%') ? stretchName(parseFloat(style.fontStretch)) : 'normal'
      if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing
      g.fillText(word.textContent ?? '', rects[i].left - left + 4, rects[i].top - top + 4 + rects[i].height / 2)
    })
    const data = g.getImageData(0, 0, width, height).data
    let filled = 0
    for (let i = 3; i < data.length; i += 16) if (data[i] > 120) filled += 4
    const step = Math.max(1.5, Math.min(6, Math.sqrt(filled / TARGET_POINTS)))
    const points: Array<[number, number]> = []
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const px = Math.min(width - 1, Math.round(x + (Math.random() - 0.5) * step))
        const py = Math.min(height - 1, Math.round(y + (Math.random() - 0.5) * step))
        if (data[(py * width + px) * 4 + 3] > 120) points.push([left - origin.left + px - 4, top - origin.top + py - 4])
      }
    }
    return points
  }

  private step(dt: number) {
    this.clock += dt
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.clock)
      this.timers = this.timers.filter((t) => t.at > this.clock)
      due.forEach((t) => t.run())
    }
    if (this.clock < this.rain.until) {
      this.rain.carry += dt * Math.min(46, this.width / 14)
      while (this.rain.carry >= 1) {
        this.rain.carry--
        this.motes.push(this.mote('confetti', Math.random() * this.width, -12, {
          vx: (Math.random() - 0.5) * 50,
          vy: 70 + Math.random() * 130,
          life: 9,
          size: 4 + Math.random() * 5,
          color: this.rain.colors[Math.floor(Math.random() * this.rain.colors.length)],
        }))
      }
    }
    const t = this.clock
    for (const m of this.motes) {
      if (m.delay > 0) {
        m.delay -= dt
        continue
      }
      m.age += dt
      switch (m.kind) {
        case 'dust':
          m.x += (m.vx + Math.sin(t * 0.4 + m.seed) * 5) * dt
          m.y += m.vy * dt
          if (m.y < -6) { m.y = this.height + 6; m.x = Math.random() * this.width }
          if (m.x < -6) m.x = this.width + 6
          if (m.x > this.width + 6) m.x = -6
          break
        case 'gather': {
          const travel = Math.min(1, m.age / 1.05)
          const k = ease(travel)
          const wobble = (1 - k) * 46
          m.x = m.sx + (m.hx - m.sx) * k + Math.sin(t * 2.2 + m.seed) * wobble
          m.y = m.sy + (m.hy - m.sy) * k + Math.cos(t * 1.7 + m.seed * 1.3) * wobble * 0.6
          break
        }
        case 'scatter':
          m.vx += Math.sin(t * 2 + m.seed) * 60 * dt
          m.vy += (Math.cos(t * 1.6 + m.seed) * 50 - 14) * dt
          m.x += m.vx * dt
          m.y += m.vy * dt
          break
        case 'spark':
          m.vy += 520 * dt
          m.vx *= 1 - 1.4 * dt
          m.vy *= 1 - 0.6 * dt
          m.x += m.vx * dt
          m.y += m.vy * dt
          break
        case 'confetti':
          m.x += (m.vx + Math.sin(t * 2.4 + m.seed) * 36) * dt
          m.y += m.vy * dt
          break
      }
    }
    this.motes = this.motes.filter((m) => m.age < m.life && m.y < this.height + 40)
  }

  private draw() {
    const g = this.ctx
    if (!g) return
    const rect = this.measure()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.round(rect.width * dpr)
    const h = Math.round(rect.height * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, rect.width, rect.height)
    g.globalCompositeOperation = this.light ? 'source-over' : 'lighter'
    const t = this.clock
    for (const m of this.motes) {
      if (m.delay > 0 && m.kind !== 'scatter') continue
      let alpha = 1
      let size = m.size
      switch (m.kind) {
        case 'dust':
          alpha = (0.1 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.9 + m.seed))) * (1 + this.pulse * 0.6) * (this.light ? 0.5 : 1)
          break
        case 'gather': {
          const fadeIn = Math.min(1, m.age / 0.3)
          const fadeOut = Math.min(1, Math.max(0, (m.life - m.age) / 0.45))
          alpha = fadeIn * fadeOut * (0.72 + 0.28 * Math.sin(t * 9 + m.seed))
          break
        }
        case 'scatter':
          alpha = m.delay > 0 ? 0.9 : Math.max(0, 1 - m.age / m.life) * 0.9
          size = m.size * (m.delay > 0 ? 1 : 1 - (m.age / m.life) * 0.5)
          break
        case 'spark':
          alpha = Math.max(0, 1 - m.age / m.life)
          break
        case 'confetti':
          alpha = Math.min(1, (m.life - m.age) / 1.5)
          break
      }
      if (alpha <= 0.01) continue
      g.globalAlpha = Math.min(1, alpha)
      g.fillStyle = m.color || this.ink
      if (m.kind === 'confetti') {
        g.globalCompositeOperation = 'source-over'
        g.save()
        g.translate(m.x, m.y)
        g.rotate(t * 3 + m.seed)
        g.scale(1, Math.cos(t * 5 + m.seed))
        g.fillRect(-size / 2, -size * 0.8, size, size * 1.6)
        g.restore()
        g.globalCompositeOperation = this.light ? 'source-over' : 'lighter'
      } else if (size <= 1.6) {
        g.fillRect(m.x - size / 2, m.y - size / 2, size, size)
      } else {
        g.beginPath()
        g.arc(m.x, m.y, size / 2, 0, Math.PI * 2)
        g.fill()
      }
    }
    g.globalAlpha = 1
  }
}

function bounds(points: Array<[number, number]>) {
  let minX = Infinity
  let maxX = -Infinity
  for (const [x] of points) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  return { minX, span: Math.max(1, maxX - minX) }
}

function stretchName(percent: number) {
  if (percent <= 78) return 'condensed'
  if (percent <= 90) return 'semi-condensed'
  if (percent >= 112) return 'expanded'
  return 'normal'
}
