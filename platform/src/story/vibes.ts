/** Song styles a sender can ask for. Prompts never include names or personal details. */
export const VIBES = [
  { id: 'afro-soul', name: 'Warm Afro-soul', prompt: 'warm Afro-soul with soft Rhodes keys, gentle talking drum and shakers, mid-tempo around 96 BPM' },
  { id: 'highlife', name: 'Highlife guitar', prompt: 'bright Nigerian highlife with interlocking clean guitars, light horns and an easy groove around 112 BPM' },
  { id: 'piano', name: 'Soft piano', prompt: 'tender solo piano with a light string pad, slow and warm, around 72 BPM' },
  { id: 'lofi-rnb', name: 'Lo-fi R&B', prompt: 'mellow lo-fi R&B with dusty drums, warm bass and soft electric piano, around 84 BPM' },
] as const

export type VibeId = (typeof VIBES)[number]['id']

export const vibeById = (id: string) => VIBES.find((v) => v.id === id)

export function songPrompt(vibe: (typeof VIBES)[number]) {
  return [
    `An original instrumental piece: ${vibe.prompt}.`,
    'It scores a short, affectionate birthday surprise: joyful but tender, with room for words on screen.',
    'No vocals, no lyrics, no spoken words. Do not imitate any existing song or artist.',
    'About two minutes long with a gentle intro and a clean ending.',
  ].join(' ')
}
