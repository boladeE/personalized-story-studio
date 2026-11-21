import { buildFilm } from '../film/timeline'
import type { Shot } from '../film/timeline'
import { generateStory } from '../story/generate'
import type { Intake } from '../story/types'

/**
 * The test films every template is drawn on before it is kept: one with little
 * to say and one with a great deal, so a design is seen at both ends of what a
 * sender might write. Their people are invented.
 */

const photo = (n: string) => ({ id: `p-${n}`, src: `/sample/sarah-${n}.jpg`, caption: '' })
const base = { spotlight: '', memories: [], habits: [], reasons: [], look: 'surprise' as const, world: 'mixtape' as const }

const SHORT: Intake = {
  ...base,
  occasion: 'birthday',
  relationship: 'partner',
  sender: 'Sam',
  recipient: 'Jo',
  photos: [photo('walk'), photo('soup'), photo('book')],
  letter: '',
  wish: 'Stay.',
  opening: { title: 'Thirty looks good', body: 'Three things, quickly.' },
  voices: [{ id: 'v-a', src: '/sample/sarah-song.mp3', seconds: 8, who: 'Mum', photoId: 'p-book' }],
  outline: [
    { id: 'tea', name: 'Tea', layout: 'line', mood: 'warm', intro: 'First.', lines: ['You never finish it.'], photoId: 'none' },
    { id: 'walk', name: 'The walk', layout: 'moment', mood: 'tender', intro: 'Then.', lines: ['We walked home.'], photoId: 'p-walk' },
    { id: 'you', name: 'You', layout: 'list', mood: 'playful', intro: 'Also.', lines: ['You hum.', 'You win.'] },
    { id: 'us', name: 'Us', layout: 'photos', mood: 'warm', lines: [] },
    { id: 'voices', name: 'From Mum', layout: 'voices', mood: 'tender', intro: 'Listen.', lines: [] },
  ],
}

const LONG: Intake = {
  ...base,
  occasion: 'anniversary',
  relationship: 'partner',
  sender: 'Christopher',
  recipient: 'Oluwaseun-Adebayo',
  photos: ['walk', 'soup', 'book', 'balcony', 'platform', 'desk'].map(photo).map((p, i) => (i === 3 ? { ...p, caption: 'The balcony, the first week we moved in' } : p)),
  letter:
    'I have been trying to write this for three weeks and every version came out sounding like somebody else.\n\nSo here is the plain one. You make ordinary days feel like they were planned. You remember what I said in passing in March and bring it up in November as if it had been important.\n\nI did not know a person could be this patient with someone who loses their keys twice a week.\n\nWhatever the next ten years look like, I would like to spend them being surprised by you.\n\nThank you for every single one so far.',
  wish: 'I don’t want a bigger life than this one. I want exactly this one, for as long as we are given, with you in it.',
  ending: { kind: 'invitation', invite: 'Dinner on Saturday, at the place where we had our first proper argument?', choices: ['Yes, obviously', 'Only if you are paying'] },
  opening: { title: 'Seven years of you being right about almost everything', body: 'From the last page of every book to the days you simply stayed, here is some of what I have been meaning to say properly.' },
  voices: [
    { id: 'v-a', src: '/sample/sarah-song.mp3', seconds: 42 },
    { id: 'v-b', src: '/sample/sarah-song.mp3', seconds: 20, who: 'Grandmother Josephine', photoId: 'p-desk' },
    { id: 'v-c', src: '/sample/sarah-song.mp3', seconds: 14, who: 'Dad' },
  ],
  outline: [
    { id: 'march', name: 'That long, strange day in March', layout: 'line', mood: 'tender', intro: 'And the moment that showed me exactly who you are.', lines: ['When I got the bad news in March, you didn’t try to fix it. You just took the day off and stayed.'], photoId: 'none' },
    {
      id: 'walk',
      name: 'The night we missed the last train',
      layout: 'moment',
      mood: 'tender',
      intro: 'Then there is the night neither of us wanted to end.',
      lines: ['The night we missed the last train, you bought us two terrible coffees from the only place still open and we walked home for three hours.', 'I remember hoping, the whole way, that the walk would somehow never end and that we would keep finding longer ways round.'],
      photoId: 'p-walk',
    },
    {
      id: 'habits',
      name: 'Things that are completely you',
      layout: 'list',
      mood: 'playful',
      intro: 'Starting with the things that could only ever be you.',
      lines: ['You read the last page of every book first and then act surprised at the ending.', 'You leave me voice notes when I’m in the next room.', 'You hum when you’re concentrating and you don’t know you do it.', 'You apologise to furniture.', 'You have never once finished a cup of tea.', 'You narrate the cat’s inner life in a voice.', 'You keep every train ticket.'],
    },
    { id: 'why', name: 'Why it is you', layout: 'list', mood: 'tender', intro: 'And the reasons, since you asked.', lines: ['You stay.', 'You notice when I have gone quiet and you never make it into a thing.', 'You make my mother laugh, which nobody else has managed since about 2009.', 'You are kind when nobody is watching.', 'You are braver than you think.'] },
    { id: 'soup', name: 'My mother’s soup', layout: 'line', mood: 'warm', intro: 'And then you got it right.', lines: ['You learned my mother’s soup from one phone call and got it right the second time.'], photoId: 'p-soup' },
    { id: 'us', name: 'A few moments we caught along the way', layout: 'photos', mood: 'warm', intro: 'Some of the ones that made it onto a camera.', lines: [] },
    { id: 'voices', name: 'From all of us who love you', layout: 'voices', mood: 'tender', intro: 'A few people asked if they could say something too.', lines: [] },
  ],
}

export interface LabShot {
  /** What this is a test of, for the report. */
  label: string
  shot: Shot
}

export interface LabFilm {
  id: 'short' | 'long'
  recipient: string
  sender: string
  occasion: string
  shots: LabShot[]
}

function film(id: LabFilm['id'], intake: Intake): LabFilm {
  const story = generateStory(intake, 11)
  const shots = buildFilm(story).shots
  const picked: LabShot[] = []
  const first = (kind: Shot['kind'], label = kind as string, when: (s: Shot) => boolean = () => true) => {
    const found = shots.find((s) => s.kind === kind && when(s))
    if (found) picked.push({ label, shot: found })
  }
  first('name')
  first('card')
  first('line')
  first('photo')
  first('flag', 'list item, first', (s) => s.kind === 'flag' && s.n === 1)
  first('flag', 'list item, last', (s) => s.kind === 'flag' && s.n === s.total && s.total > 1)
  first('reason', 'calm item, first', (s) => s.kind === 'reason' && s.n === 1)
  first('reason', 'calm item, last', (s) => s.kind === 'reason' && s.n === s.total && s.total > 1)
  first('montage')
  first('voice', 'voice with photo', (s) => s.kind === 'voice' && Boolean(s.photo))
  first('voice', 'voice without photo', (s) => s.kind === 'voice' && !s.photo)
  first('letter')
  first('wish')
  first('reveal')
  first('credits')
  const ticket = story.scenes.flatMap((s) => s.frames).find((f) => f.kind === 'ticket')
  return { id, recipient: story.recipient, sender: story.sender, occasion: ticket?.kind === 'ticket' ? ticket.occasion : '', shots: picked }
}

export const labFilms = (): LabFilm[] => [film('short', SHORT), film('long', LONG)]
