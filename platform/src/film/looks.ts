import type { LookId, Mood } from '../story/types'

/**
 * Colour for the film. Each look has a smoky palette per mood (the backdrop
 * drifts between them as scenes change) and a set of loud flat colours that
 * the playful scenes cut between on the beat.
 */
export interface Palette {
  /** Deep base, mid haze and hot highlight of the backdrop. */
  a: string
  b: string
  c: string
  ink: string
  soft: string
  accent: string
}

export interface Loud {
  bg: string
  ink: string
  accent: string
}

type Moods = Record<Exclude<Mood, 'playful'>, Palette>

const LOOKS: Record<LookId, { moods: Moods; loud: Loud[]; light: boolean }> = {
  screening: {
    light: false,
    moods: {
      warm: { a: '#14070d', b: '#4e1a2c', c: '#c9743e', ink: '#f6e9d8', soft: 'rgba(246,233,216,.76)', accent: '#f2c26b' },
      tender: { a: '#120812', b: '#3d1c33', c: '#b05a6e', ink: '#f6e9d8', soft: 'rgba(246,233,216,.76)', accent: '#f3a9b8' },
      glow: { a: '#150a05', b: '#5a2f12', c: '#f2c26b', ink: '#fdf3df', soft: 'rgba(253,243,223,.8)', accent: '#f2c26b' },
    },
    loud: [
      { bg: '#c22a59', ink: '#fff4e6', accent: '#f2c26b' },
      { bg: '#f2c26b', ink: '#2a0f19', accent: '#c22a59' },
      { bg: '#2a0f19', ink: '#f2c26b', accent: '#fff4e6' },
      { bg: '#f6e9d8', ink: '#c22a59', accent: '#2a0f19' },
    ],
  },
  garden: {
    light: false,
    moods: {
      warm: { a: '#06150f', b: '#123a2e', c: '#6fae7c', ink: '#eef0e7', soft: 'rgba(238,240,231,.78)', accent: '#f08bab' },
      tender: { a: '#07181a', b: '#1d4a4a', c: '#f08bab', ink: '#eef0e7', soft: 'rgba(238,240,231,.78)', accent: '#f08bab' },
      glow: { a: '#0c1707', b: '#2f4a1d', c: '#f2c26b', ink: '#f7f6e6', soft: 'rgba(247,246,230,.8)', accent: '#f2c26b' },
    },
    loud: [
      { bg: '#f08bab', ink: '#0b281f', accent: '#fffdf8' },
      { bg: '#123a2e', ink: '#f2c26b', accent: '#f08bab' },
      { bg: '#f2c26b', ink: '#0b281f', accent: '#c22a59' },
      { bg: '#eef0e7', ink: '#c22a59', accent: '#123a2e' },
    ],
  },
  paper: {
    light: true,
    moods: {
      warm: { a: '#e9e1d2', b: '#f7f2e8', c: '#f1c7a4', ink: '#1d2a24', soft: 'rgba(29,42,36,.74)', accent: '#c22a59' },
      tender: { a: '#e6dfe6', b: '#f5f0f3', c: '#e8b4c4', ink: '#1d2a24', soft: 'rgba(29,42,36,.74)', accent: '#9c1d46' },
      glow: { a: '#efe0b8', b: '#faf2da', c: '#f2c26b', ink: '#2a1a1e', soft: 'rgba(42,26,30,.76)', accent: '#c22a59' },
    },
    loud: [
      { bg: '#c22a59', ink: '#fffdf8', accent: '#f2c26b' },
      { bg: '#1d2a24', ink: '#f2c26b', accent: '#fffdf8' },
      { bg: '#f2c26b', ink: '#1d2a24', accent: '#c22a59' },
      { bg: '#fffdf8', ink: '#c22a59', accent: '#1d2a24' },
    ],
  },
}

export const paletteFor = (look: LookId, mood: Mood): Palette => LOOKS[look].moods[mood === 'playful' ? 'warm' : mood]
export const loudFor = (look: LookId, n: number): Loud => LOOKS[look].loud[((n % 4) + 4) % 4]
/** The dark loud colour of a look: the table the camera-roll prints are dealt onto. */
export const tableFor = (look: LookId): Loud => LOOKS[look].loud[look === 'screening' ? 2 : 1]
export const isLight = (look: LookId) => LOOKS[look].light

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
