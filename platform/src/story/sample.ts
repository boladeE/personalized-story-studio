import type { Intake } from './types'

/** Fictional sample intake (Zara and Tobi, AI-generated photos), reused from the v2 demo. */
export const SAMPLE_INTAKE: Intake = {
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
      story: 'Games night. Uno. You said nobody could be that lucky, then made me shuffle again while you watched my hands.',
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
