import { trackById } from '../story/music'
import type { SynthTrack } from '../story/music'

/**
 * Browser-only soundtrack engine. It must be started from a real user gesture
 * (the ticket tap), after which scenes can switch tracks with a crossfade.
 * A scene that keeps the same track does not restart it.
 */

const LOOKAHEAD = 0.3
const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

class TrackVoice {
  readonly output: GainNode
  private timer: ReturnType<typeof setInterval> | undefined
  private nextEighth = 0
  private eighthIndex = 0
  private melodyIndex = 0
  private nextMelodyTime = 0
  private readonly eighth: number
  /** Audio-clock time of this track's first beat. */
  startedAt = 0

  constructor(private ctx: AudioContext, readonly track: SynthTrack, destination: AudioNode) {
    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.output.connect(destination)
    this.eighth = 60 / track.bpm / 2
  }

  start(fade: number) {
    const now = this.ctx.currentTime
    this.output.gain.setValueAtTime(0, now)
    this.output.gain.linearRampToValueAtTime(1, now + fade)
    this.nextEighth = now + 0.05
    this.startedAt = this.nextEighth
    this.nextMelodyTime = this.nextEighth
    this.timer = setInterval(() => this.schedule(), 60)
    this.schedule()
  }

  stop(fade: number) {
    const now = this.ctx.currentTime
    this.output.gain.cancelScheduledValues(now)
    this.output.gain.setValueAtTime(this.output.gain.value, now)
    this.output.gain.linearRampToValueAtTime(0, now + fade)
    setTimeout(() => {
      clearInterval(this.timer)
      this.output.disconnect()
    }, (fade + LOOKAHEAD) * 1000 + 100)
  }

  private schedule() {
    const { track, ctx } = this
    const horizon = ctx.currentTime + LOOKAHEAD
    while (this.nextEighth < horizon) {
      const barLength = 8
      const bar = Math.floor(this.eighthIndex / barLength) % track.chords.length
      const chord = track.chords[bar]
      if (this.eighthIndex % barLength === 0) {
        chord.forEach((note) => this.note(note - 12, this.nextEighth, this.eighth * barLength, 'sine', 0.045, 0.35))
      }
      const step = track.arp[this.eighthIndex % track.arp.length]
      if (step >= 0) this.note(chord[step % chord.length], this.nextEighth, this.eighth * 0.9, track.wave, track.wave === 'square' ? 0.018 : 0.05, 0.01)
      this.nextEighth += this.eighth
      this.eighthIndex++
    }
    while (this.nextMelodyTime < horizon) {
      const [note, beats] = track.melody[this.melodyIndex % track.melody.length]
      const length = beats * this.eighth * 2
      if (note !== null) this.note(note, this.nextMelodyTime, length * 0.95, 'triangle', 0.06, 0.02)
      this.nextMelodyTime += length
      this.melodyIndex++
    }
  }

  private note(midi: number, at: number, length: number, wave: OscillatorType, level: number, attack: number) {
    const { ctx } = this
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    osc.type = wave
    osc.frequency.value = midiToHz(midi)
    filter.type = 'lowpass'
    filter.frequency.value = 2400
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(level, at + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(length, attack + 0.05))
    osc.connect(filter).connect(env).connect(this.output)
    osc.start(at)
    osc.stop(at + length + 0.1)
  }
}

export interface AudioState {
  running: boolean
  muted: boolean
  trackId: string | null
  currentTime: number
  song: string | null
  suspended: boolean
}

export interface Beat {
  /** 0 at the start of a beat, rising to 1 just before the next. */
  phase: number
  /** Beats since the current track began. */
  count: number
  bpm: number
}

interface SongVoice {
  src: string
  source: AudioBufferSourceNode
  gain: GainNode
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private songBus: GainNode | null = null
  private voice: TrackVoice | null = null
  private song: SongVoice | null = null
  private songLoading: string | null = null
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
      // Finished songs skip the reverb used to soften the built-in score.
      this.songBus = this.ctx.createGain()
      this.songBus.gain.value = this.muted ? 0 : 0.9
      this.songBus.connect(this.ctx.destination)
    }
    try {
      await this.ctx.resume()
    } catch {
      return false
    }
    return this.ctx.state === 'running'
  }

  /** `restart` begins the track again so film cuts stay on its bars after a jump. */
  play(trackId: string, restart = false) {
    if (!this.ctx || !this.master) return
    if (this.voice?.track.id === trackId && !restart) return
    const track = trackById(trackId)
    if (!track) return
    this.stopSong(1.6)
    const fade = restart ? 0.5 : 1.6
    this.voice?.stop(fade)
    this.voice = new TrackVoice(this.ctx, track, this.master)
    this.voice.start(fade)
  }

  /** Where we are in the music, for visuals that move with it. Null when no synth track is playing. */
  beat(): Beat | null {
    if (!this.ctx || !this.voice || this.ctx.state !== 'running') return null
    const length = 60 / this.voice.track.bpm
    const beats = (this.ctx.currentTime - this.voice.startedAt) / length
    if (beats < 0) return null
    return { phase: beats % 1, count: Math.floor(beats), bpm: this.voice.track.bpm }
  }

  /** Freeze or continue everything, in step with the film's pause. */
  async setPaused(paused: boolean) {
    if (!this.ctx) return
    try {
      if (paused) await this.ctx.suspend()
      else await this.ctx.resume()
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

  /** Play a whole-story song (generated or supplied), looping, in place of the score. */
  async playSong(src: string): Promise<boolean> {
    if (!this.ctx || !this.songBus) return false
    if (this.song?.src === src || this.songLoading === src) return true
    this.songLoading = src
    try {
      const response = await fetch(src, { credentials: 'same-origin' })
      if (!response.ok) throw new Error(`Song request failed: ${response.status}`)
      const ctx = this.ctx
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer())
      if (this.songLoading !== src || this.ctx !== ctx || !this.songBus) return false
      this.voice?.stop(1.2)
      this.voice = null
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
      return false
    } finally {
      if (this.songLoading === src) this.songLoading = null
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
    this.voice?.stop(0.4)
    this.voice = null
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
    song.source.stop(now + fade + 0.05)
  }

  close() {
    this.stop()
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    this.songBus = null
    setTimeout(() => void ctx?.close(), 600)
  }

  state(): AudioState {
    return {
      running: this.ctx?.state === 'running',
      muted: this.muted,
      trackId: this.song ? 'song' : (this.voice?.track.id ?? null),
      currentTime: this.ctx?.currentTime ?? 0,
      song: this.song?.src ?? null,
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
