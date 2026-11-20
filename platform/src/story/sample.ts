import type { Intake, Soundtrack } from './types'

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
 * The sample as the studio makes films now: Sarah and Michael, an invented couple. It is a real
 * output of the studio, kept as it came: Michael's note was put through the short flow on
 * 2026-11-20 with six generated photos, and these are the scenes, opening, lead-ins and last line
 * the director wrote, the photos where it placed them (one added by hand, for March), and the song
 * made for it. Nothing in it is a real person's.
 */
export const SAMPLE_INTAKE: Intake = {
  occasion: 'anniversary',
  relationship: 'partner',
  sender: 'Michael',
  recipient: 'Sarah',
  photos: [
    { id: 'p-book', src: '/sample/sarah-book.jpg', caption: '' },
    { id: 'p-walk', src: '/sample/sarah-walk.jpg', caption: '' },
    { id: 'p-soup', src: '/sample/sarah-soup.jpg', caption: '' },
    { id: 'p-balcony', src: '/sample/sarah-balcony.jpg', caption: '' },
    { id: 'p-platform', src: '/sample/sarah-platform.jpg', caption: '' },
    { id: 'p-desk', src: '/sample/sarah-desk.jpg', caption: '' },
  ],
  spotlight: '',
  memories: [],
  habits: [],
  reasons: [],
  letter: '',
  wish: 'I don’t want a bigger life. I want this one, with you.',
  look: 'surprise',
  opening: { title: 'This life, with you', body: 'From the last page of every book to the days you just stayed.' },
  outline: [
    {
      id: 'you',
      name: 'Just like you',
      layout: 'list',
      mood: 'playful',
      intro: 'First, the things that are completely you.',
      lines: ['You read the last page of every book first and then act surprised at the ending.', 'You leave me voice notes when I’m in the next room.', 'You hum when you’re concentrating and you don’t know you do it.'],
    },
    {
      id: 'walk',
      name: 'The three-hour walk',
      layout: 'moment',
      mood: 'warm',
      intro: 'Then there is the night we walked.',
      lines: ['The night we missed the last train, you bought us two terrible coffees and we walked home for three hours.', 'I remember hoping the walk wouldn’t end.'],
      photoId: 'p-walk',
    },
    { id: 'soup', name: 'My mother’s soup', layout: 'line', mood: 'warm', intro: 'And then you got it right.', lines: ['You learned my mother’s soup from one phone call and got it right the second time.'], photoId: 'p-soup' },
    { id: 'us', name: 'Just us', layout: 'photos', mood: 'warm', intro: 'A few moments from along the way.', lines: [] },
    {
      id: 'march',
      name: 'That day in March',
      layout: 'moment',
      mood: 'tender',
      intro: 'Then there was March.',
      lines: ['When I got the bad news in March, you didn’t try to fix it. You just took the day off and stayed.'],
      photoId: 'p-balcony',
    },
  ],
}

/** What the sample film says under its end credits, so nobody takes its people for real customers. */
export const SAMPLE_NOTE = 'Sarah and Michael are fictional. Their photos and song were made for this sample.'

/**
 * The sample's song: a real song the studio made for the fictional Sarah from Michael's note
 * (Lyria 3.5, lo-fi R&B, a man's voice, both chosen by the director). The lyrics are the words the
 * studio's writer produced and the music model was given to sing. `v` changes when the file does,
 * so returning visitors don't hear a cached older song.
 */
export const SAMPLE_SOUNDTRACK: Soundtrack = { kind: 'song', src: '/sample/sarah-song.mp3?v=1', label: 'This One, With You' }

export const SAMPLE_LYRICS = `The last train pulled away
Two bad cups in our hands
Three hours back on foot
I kept slowing down

Don't need anything more
Not when you're here

This one, with you
Right where we are
This one, with you
It's all I'm asking for

Back in March, you stayed home
Just sat with me all day
Now my phone lights up
Voice note from one room over

Don't need anything more
Not when you're here

This one, with you
Right where we are
This one, with you
It's all I'm asking for

Keep the bigger life
I'm good right here
Happy anniversary, Sarah
You're all I need

This one, with you
Right where we are
This one, with you
It's all I'm asking for

This one, with you (happy anniversary, Sarah)`

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
