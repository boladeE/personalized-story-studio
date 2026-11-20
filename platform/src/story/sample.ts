import type { Intake, Soundtrack } from './types'

/** What the sample film says under its end credits, so nobody takes its people for real customers. */
export const SAMPLE_NOTE = 'Zara and Tobi are fictional. Their photos and song were made for this sample.'

/**
 * The fictional sample (Zara and Tobi, generated photos, reused from the v2 demo), told in the
 * studio's older fixed scenes. The detailed form fills itself in from this, and it stands for the
 * films made before a film had scenes of its own.
 */
export const SAMPLE_FIXED: Intake = {
  occasion: 'birthday',
  sender: 'Tobi',
  recipient: 'Zara',
  photos: [
    { id: 'p-laughing', src: '/sample/laughing.jpg', caption: 'Laughing at her own joke' },
    { id: 'p-selfie', src: '/sample/selfie.jpg', caption: 'The one you made me retake. Twice.' },
    { id: 'p-cafe', src: '/sample/cafe.jpg', caption: 'One drink. A whole afternoon.' },
    { id: 'p-dinner', src: '/sample/dinner.jpg', caption: 'My chips. Our chips.' },
    { id: 'p-beach', src: '/sample/beach.jpg', caption: 'Yes, there was sand in the car.' },
    { id: 'p-portrait', src: '/sample/portrait.jpg', caption: 'Golden hour, as usual' },
    { id: 'p-birthday', src: '/sample/birthday.jpg', caption: 'Last year’s cake' },
  ],
  spotlight:
    'You can spot my mood from one “hey.” You tell me to eat before giving me advice, and you laugh with your whole face when you forget I’m taking a picture.',
  memories: [
    {
      id: 'm1',
      title: 'You called me a cheat.',
      story: 'Games night. Cards. You said nobody could be that lucky, then made me shuffle again while you watched my hands.',
      photoId: 'p-selfie',
    },
    {
      id: 'm2',
      title: 'The rain can wait.',
      story: 'We were meant to stay for one drink. Then the rain started, and you moved your chair closer so I could hear your gist.',
      photoId: 'p-cafe',
    },
    {
      id: 'm3',
      title: 'That evening by the water.',
      story: 'Our shoes were full of sand. You kept saying “one more minute” every time the sky changed.',
      photoId: 'p-beach',
    },
  ],
  habits: [
    'Says “I’m not hungry,” then eats my chips',
    'Sends an eleven-minute voice note called “quick gist”',
    'Steals the duvet, then asks why I’m cold',
    'Says “I’m ready” while still choosing earrings',
  ],
  reasons: [
    'You remember the small things I mention once, in passing',
    'You know when I need advice and when I just need you to listen',
    'Ordinary days get suspiciously good when you’re around',
  ],
  letter:
    'I know I make a joke when I’m trying to say something properly. So let me try without one.\n\nYou don’t have to be the one holding everything together today. Let me look after you for a change.\n\nI’m glad you walked into that games night. I’m even glad you accused me of cheating.',
  wish: 'More afternoons that run late. More of your hand in mine on the way home. And yes, you can have my chips.',
  look: 'surprise',
}

/**
 * The sample as the studio makes films now: the same words and photos, in scenes that exist
 * because of what Tobi wrote about Zara. No other film has these scenes.
 */
export const SAMPLE_INTAKE: Intake = {
  ...SAMPLE_FIXED,
  outline: [
    { id: 'face', name: 'Your whole face', layout: 'moment', mood: 'warm', lines: ['You laugh with your whole face when you forget I’m taking a picture.'], photoId: 'p-laughing' },
    { id: 'hey', name: 'One word', layout: 'line', mood: 'warm', lines: ['You can spot my mood from one “hey.”'] },
    { id: 'says', name: 'Things you say', layout: 'list', mood: 'playful', lines: [...SAMPLE_FIXED.habits] },
    {
      id: 'games',
      name: 'Games night',
      layout: 'moment',
      mood: 'playful',
      lines: ['You called me a cheat. You said nobody could be that lucky, then made me shuffle again while you watched my hands.'],
      photoId: 'p-selfie',
    },
    {
      id: 'rain',
      name: 'The rain can wait',
      layout: 'moment',
      mood: 'tender',
      lines: ['We were meant to stay for one drink. Then the rain started, and you moved your chair closer so I could hear your gist.'],
      photoId: 'p-cafe',
    },
    { id: 'water', name: 'One more minute', layout: 'moment', mood: 'tender', lines: ['That evening by the water, our shoes were full of sand. You kept saying “one more minute” every time the sky changed.'], photoId: 'p-beach' },
    { id: 'small', name: 'The small things', layout: 'list', mood: 'tender', lines: [...SAMPLE_FIXED.reasons] },
    { id: 'roll', name: 'Caught on camera', layout: 'photos', mood: 'warm', lines: [] },
  ],
}

/**
 * The sample's song: a real song the studio made for the fictional Zara from
 * the details above (Lyria 3.5, Afrobeats, sung). The lyrics are the words the
 * studio's writer produced and the music model was given to sing. `v` changes
 * when the file does, so returning visitors don't hear a cached older song.
 */
export const SAMPLE_SOUNDTRACK: Soundtrack = { kind: 'song', src: '/sample/zara-song.mp3?v=2', label: 'Zara’s song' }

export const SAMPLE_LYRICS = `Meant to stay for one
Then the weather turned
You moved your chair close
Just to share the gist

Ordinary days get good
When you're around

The rain can wait
Let it fall outside
The rain can wait
I'm in no rush

You steal the duvet
Ask why I'm cold
You remember the small things
I mention once

Ordinary days get good
When you're around

The rain can wait
Let it fall outside
The rain can wait
I'm in no rush

More afternoons running late
More of your hand in mine
Happy birthday, Zara

The rain can wait
Let it fall outside
The rain can wait
I'm in no rush

The rain can wait (happy birthday, Zara)`

export const emptyIntake = (): Intake => ({
  occasion: 'birthday',
  sender: '',
  recipient: '',
  photos: [],
  spotlight: '',
  memories: [
    { id: 'm1', title: '', story: '', photoId: '' },
    { id: 'm2', title: '', story: '', photoId: '' },
  ],
  habits: ['', '', ''],
  reasons: ['', '', ''],
  letter: '',
  wish: '',
  look: 'surprise',
})
