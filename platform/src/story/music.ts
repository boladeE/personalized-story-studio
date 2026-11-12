import type { Mood } from './types'

/**
 * Placeholder soundtrack: short original loops written for this project and
 * played by a small Web Audio synth (see src/components/audio-engine.ts).
 * They are stand-ins until real licensed or commissioned music arrives; the
 * story format only stores a track id per scene, so swapping them is cheap.
 */
export interface SynthTrack {
  id: string
  title: string
  mood: Mood
  bpm: number
  /** One chord per bar, as MIDI note numbers. */
  chords: number[][]
  /** Arpeggio: indexes into the current chord, one per eighth note. -1 rests. */
  arp: number[]
  /** Optional lead line: [midi or null for rest, length in beats]. Loops with the chords. */
  melody: Array<[number | null, number]>
  wave: OscillatorType
}

const D = 62, F = 65, A = 57, Bb = 58

export const TRACKS: SynthTrack[] = [
  {
    id: 'first-light',
    title: 'First light',
    mood: 'warm',
    bpm: 84,
    chords: [
      [D, D + 4, D + 7], [D - 3, D, D + 4], [D - 5, D - 1, D + 2], [D - 3, D + 1, D + 4],
    ],
    arp: [0, 1, 2, 1, 0, 2, 1, 2],
    melody: [
      [D + 16, 1.5], [D + 14, 0.5], [D + 12, 2], [D + 12, 1], [D + 11, 1], [D + 9, 2],
      [D + 7, 1.5], [D + 9, 0.5], [D + 11, 2], [D + 9, 1], [null, 1], [D + 13, 2],
    ],
    wave: 'triangle',
  },
  {
    id: 'side-eye',
    title: 'Side eye',
    mood: 'playful',
    bpm: 108,
    chords: [
      [F, F + 4, F + 7], [F - 5, F - 1, F + 2], [F + 2, F + 5, F + 9], [F - 7, F - 3, F],
    ],
    arp: [0, -1, 2, 1, -1, 2, 0, 1],
    melody: [
      [F + 12, 0.5], [null, 0.5], [F + 12, 0.5], [F + 14, 0.5], [F + 16, 1], [F + 12, 1],
      [F + 11, 0.5], [null, 0.5], [F + 9, 1], [F + 7, 2],
      [F + 9, 0.5], [F + 11, 0.5], [F + 12, 1], [F + 14, 1], [F + 12, 1],
      [F + 9, 1], [F + 7, 0.5], [F + 5, 0.5], [F + 7, 2],
    ],
    wave: 'square',
  },
  {
    id: 'quiet-hours',
    title: 'Quiet hours',
    mood: 'tender',
    bpm: 66,
    chords: [
      [A, A + 3, A + 7], [A - 4, A, A + 3], [A + 3, A + 7, A + 10], [A - 2, A + 2, A + 5],
    ],
    arp: [0, 2, 1, 2, 0, 2, 1, 2],
    melody: [
      [A + 19, 2], [A + 17, 1], [A + 15, 1], [A + 15, 3], [null, 1],
      [A + 14, 2], [A + 15, 1], [A + 17, 1], [A + 12, 3], [null, 1],
    ],
    wave: 'sine',
  },
  {
    id: 'candle',
    title: 'Candle',
    mood: 'glow',
    bpm: 76,
    chords: [
      [Bb, Bb + 4, Bb + 7], [Bb + 2, Bb + 5, Bb + 9], [Bb + 5, Bb + 9, Bb + 12], [Bb + 5, Bb + 8, Bb + 12],
    ],
    arp: [0, 1, 2, 0, 2, 1, 2, 1],
    melody: [
      [Bb + 24, 1], [Bb + 26, 1], [Bb + 28, 2], [Bb + 26, 1], [Bb + 24, 1], [Bb + 21, 2],
      [Bb + 19, 1], [Bb + 21, 1], [Bb + 24, 2], [Bb + 22, 2], [null, 2],
    ],
    wave: 'triangle',
  },
]

export const trackById = (id: string) => TRACKS.find((t) => t.id === id)
export const tracksForMood = (mood: Mood) => TRACKS.filter((t) => t.mood === mood)
