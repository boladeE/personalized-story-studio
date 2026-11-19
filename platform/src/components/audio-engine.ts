/**
 * Browser-only sound for the film. It must be started from a real user gesture
 * (the ticket tap). The only music it plays is the film's own song, made for
 * it: there is no built-in music, and a film without a song is silent.
 */

export interface AudioState {
  running: boolean
  muted: boolean
  /** `song` while the film's song is playing, otherwise null. */
  trackId: 'song' | null
  currentTime: number
  song: string | null
  /** How the song is playing: streamed as it downloads, or decoded whole first (the fallback). */
  songMode: 'stream' | 'buffer' | null
  /** Seconds into the song, when it is streamed. */
  songTime: number | null
  suspended: boolean
}

interface SongVoice {
  src: string
  gain: GainNode
  /** Streamed through a media element... */
  el?: HTMLAudioElement
  /** ...or, when that fails, a fully decoded buffer. */
  source?: AudioBufferSourceNode
}

interface SongStream {
  src: string
  el: HTMLAudioElement
  /** A media element can be wired into Web Audio only once, so the node is kept with it. */
  node: MediaElementAudioSourceNode | null
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private songBus: GainNode | null = null
  private song: SongVoice | null = null
  private songLoading: string | null = null
  private stream: SongStream | null = null
  private songBytes: { src: string; data: Promise<ArrayBuffer> } | null = null
  private songBuffer: { src: string; ctx: AudioContext; data: Promise<AudioBuffer> } | null = null
  private muted = false

  /** Call inside the click handler that begins the story. */
  async start(): Promise<boolean> {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return false
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.7
      const reverb = this.ctx.createConvolver()
      reverb.buffer = this.impulse(2.2)
      const wet = this.ctx.createGain()
      wet.gain.value = 0.3
      this.master.connect(this.ctx.destination)
      this.master.connect(reverb).connect(wet).connect(this.ctx.destination)
      // The song goes straight to the speakers; the reverb is only for the countdown's tones.
      this.songBus = this.ctx.createGain()
      this.songBus.gain.value = this.muted ? 0 : 0.9
      this.songBus.connect(this.ctx.destination)
    }
    // Still inside the tap: let the song's element play once, silently, so browsers
    // that only allow sound from a gesture will let it start when the film does.
    this.unlockStream()
    try {
      await this.ctx.resume()
    } catch {
      return false
    }
    return this.ctx.state === 'running'
  }

  /** Freeze or continue everything, in step with the film's pause. */
  async setPaused(paused: boolean) {
    if (!this.ctx) return
    try {
      if (paused) {
        this.song?.el?.pause()
        await this.ctx.suspend()
      } else {
        await this.ctx.resume()
        await this.song?.el?.play()
      }
    } catch {
      // A closed context can't be paused; nothing to do.
    }
  }

  /** A short tone, used for the film leader's countdown. */
  blip(frequency: number, length = 0.12) {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    env.gain.setValueAtTime(0, now)
    env.gain.linearRampToValueAtTime(0.16, now + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, now + length)
    osc.connect(env).connect(this.master)
    osc.start(now)
    osc.stop(now + length + 0.05)
  }

  /**
   * Get a song ready before the film begins. With `download` it starts
   * buffering straight away (the ticket is on screen); without, nothing is
   * fetched until the tap, so visitors who never press play pay nothing.
   * Makes no sound and needs no AudioContext.
   */
  preloadSong(src: string, download = true) {
    if (this.stream?.src !== src) {
      this.dropStream()
      const el = new Audio()
      el.loop = true
      el.preload = download ? 'auto' : 'none'
      el.src = src
      this.stream = { src, el, node: null }
    }
    if (download && this.stream.el.preload !== 'auto') {
      this.stream.el.preload = 'auto'
      this.stream.el.load()
    }
  }

  /** Make sure the song is downloading. Call after `start()`, e.g. while the leader counts in. */
  prepareSong(src: string) {
    this.preloadSong(src, true)
  }

  private unlockStream() {
    const stream = this.stream
    if (!stream || this.song?.el === stream.el) return
    const { el } = stream
    el.preload = 'auto'
    el.muted = true
    el.play()
      .then(() => {
        // If the film has already asked for the song, leave it playing.
        if (this.song?.el !== el && this.songLoading !== stream.src) {
          el.pause()
          el.currentTime = 0
        }
      })
      .catch(() => {})
      .finally(() => {
        el.muted = false
      })
  }

  private dropStream() {
    const stream = this.stream
    if (!stream) return
    this.stream = null
    stream.el.pause()
    stream.node?.disconnect()
    stream.el.removeAttribute('src')
    stream.el.load()
  }

  /**
   * Play a whole-story song (generated or supplied), looping, in place of the
   * score. It is streamed, so it starts as soon as the first second has
   * arrived; if the browser refuses that, the whole file is decoded instead.
   */
  async playSong(src: string): Promise<boolean> {
    if (!this.ctx || !this.songBus) return false
    if (this.song?.src === src || this.songLoading === src) return true
    this.songLoading = src
    try {
      const streamed = await this.streamSong(src)
      if (streamed !== 'failed') return streamed === 'playing'
      return await this.bufferSong(src)
    } finally {
      if (this.songLoading === src) this.songLoading = null
    }
  }

  private async streamSong(src: string): Promise<'playing' | 'cancelled' | 'failed'> {
    const ctx = this.ctx
    const bus = this.songBus
    if (!ctx || !bus) return 'cancelled'
    let gain: GainNode | null = null
    try {
      this.preloadSong(src, true)
      const stream = this.stream!
      const { el } = stream
      stream.node ??= ctx.createMediaElementSource(el)
      gain = ctx.createGain()
      gain.gain.value = 0
      stream.node.connect(gain).connect(bus)
      el.muted = false
      if (el.currentTime > 0) el.currentTime = 0
      await el.play()
      if (this.songLoading !== src || this.ctx !== ctx || this.stream !== stream) {
        if (this.stream === stream && this.song?.el !== el) el.pause()
        gain.disconnect()
        return 'cancelled'
      }
      this.stopSong(0.6)
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(1, now + 0.6)
      this.song = { src, gain, el }
      return 'playing'
    } catch (error) {
      console.warn('[audio] song could not be streamed; decoding it instead', error)
      gain?.disconnect()
      if (this.stream?.src === src) this.dropStream()
      return this.songLoading === src && this.ctx === ctx ? 'failed' : 'cancelled'
    }
  }

  private fetchSong(src: string) {
    if (this.songBytes?.src === src) return
    const data = fetch(src, { credentials: 'same-origin' }).then((response) => {
      if (!response.ok) throw new Error(`Song request failed: ${response.status}`)
      return response.arrayBuffer()
    })
    data.catch(() => {})
    this.songBytes = { src, data }
    this.songBuffer = null
  }

  private decoded(src: string, ctx: AudioContext): Promise<AudioBuffer> {
    if (this.songBuffer?.src === src && this.songBuffer.ctx === ctx) return this.songBuffer.data
    this.fetchSong(src)
    // Decoding detaches the bytes it is given, so decode a copy and keep the download.
    const data = this.songBytes!.data.then((bytes) => ctx.decodeAudioData(bytes.slice(0)))
    data.catch(() => {})
    this.songBuffer = { src, ctx, data }
    return data
  }

  private async bufferSong(src: string): Promise<boolean> {
    const ctx = this.ctx
    if (!ctx || !this.songBus) return false
    try {
      const buffer = await this.decoded(src, ctx)
      if (this.songLoading !== src || this.ctx !== ctx || !this.songBus) return false
      this.stopSong(1.2)
      const gain = ctx.createGain()
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(gain).connect(this.songBus)
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(1, now + 1.2)
      source.start(now)
      this.song = { src, source, gain }
      return true
    } catch (error) {
      console.warn('[audio] song could not play', error)
      // Forget the failed download so another attempt starts clean.
      if (this.songBytes?.src === src) {
        this.songBytes = null
        this.songBuffer = null
      }
      return false
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const [node, level] of [
      [this.master, 0.7],
      [this.songBus, 0.9],
    ] as const) {
      if (!node) continue
      node.gain.cancelScheduledValues(now)
      node.gain.setValueAtTime(node.gain.value, now)
      node.gain.linearRampToValueAtTime(muted ? 0 : level, now + 0.25)
    }
  }

  stop() {
    this.songLoading = null
    this.stopSong(0.4)
  }

  private stopSong(fade: number) {
    const song = this.song
    if (!song || !this.ctx) return
    this.song = null
    const now = this.ctx.currentTime
    song.gain.gain.cancelScheduledValues(now)
    song.gain.gain.setValueAtTime(song.gain.gain.value, now)
    song.gain.gain.linearRampToValueAtTime(0, now + fade)
    song.source?.stop(now + fade + 0.05)
    const { el, gain } = song
    if (el) {
      setTimeout(() => {
        // The same element may already be playing the song again from the top.
        if (this.song?.el !== el && this.songLoading !== song.src) el.pause()
        gain.disconnect()
      }, (fade + 0.05) * 1000)
    }
  }

  close() {
    this.stop()
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    this.songBus = null
    this.dropStream()
    this.songBytes = null
    this.songBuffer = null
    setTimeout(() => void ctx?.close(), 600)
  }

  state(): AudioState {
    return {
      running: this.ctx?.state === 'running',
      muted: this.muted,
      trackId: this.song ? 'song' : null,
      currentTime: this.ctx?.currentTime ?? 0,
      song: this.song?.src ?? null,
      songMode: this.song ? (this.song.el ? 'stream' : 'buffer') : null,
      songTime: this.song?.el?.currentTime ?? null,
      suspended: this.ctx?.state === 'suspended',
    }
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
    }
    return buffer
  }
}
