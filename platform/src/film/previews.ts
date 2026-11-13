import type { Intake, LookId, Mood, Photo } from '../story/types'
import type { StillContent } from './Still'
import type { Shot } from './timeline'

/**
 * A still for each step of the writing flow: the scene that step feeds, filled
 * with whatever the sender has typed so far. Fixed wording is one of the film's
 * own template lines; nothing personal is made up. When a step is still empty
 * the still is a "ghost" that says what will go there.
 */

export type StepId = 'who' | 'photos' | 'spotlight' | 'memories' | 'habits' | 'reasons' | 'letter' | 'wish' | 'look'

export interface StepFocus {
  memory: number
  habit: number
  reason: number
}

export interface StepPreview {
  look: LookId
  content: StillContent
  /** True while the still shows guidance, not the sender's own words. */
  ghost: boolean
}

type Body<K extends Shot['kind']> = Omit<Extract<Shot, { kind: K }>, 'id' | 'index' | 'scene' | 'sceneName' | 'mood' | 'trackId' | 'start' | 'duration' | 'enter' | 'exit' | 'text' | 'hold'> & { text?: string }

function shot<K extends Shot['kind']>(id: string, mood: Mood, body: Body<K>, enter: Shot['enter'] = 'type'): StillContent {
  const made = { text: '', ...body, id, index: 0, scene: 0, sceneName: '', mood, trackId: '', start: 0, duration: 8, enter, exit: 'fade' } as unknown as Shot
  return { kind: 'shot', shot: made }
}

/** The row to show: the one being edited if it has words, otherwise the last one that does. */
function pick(values: string[], focus: number): { text: string; index: number } {
  const at = Math.min(Math.max(focus, 0), values.length - 1)
  if (values[at]?.trim()) return { text: values[at].trim(), index: at }
  for (let i = values.length - 1; i >= 0; i--) if (values[i].trim()) return { text: values[i].trim(), index: i }
  return { text: '', index: Math.max(at, 0) }
}

export const previewLook = (intake: Intake): LookId => (intake.look === 'surprise' ? 'screening' : intake.look)

export function previewFor(step: StepId, intake: Intake, focus: StepFocus, look: LookId = previewLook(intake)): StepPreview {
  const r = intake.recipient.trim()
  const s = intake.sender.trim()
  const photos = intake.photos
  const first: Photo | undefined = photos[0]

  switch (step) {
    case 'who':
      return { look, ghost: !r, content: { kind: 'ticket', recipient: r || 'Their name' } }

    case 'photos':
      if (!photos.length) {
        return { look, ghost: true, content: shot<'line'>('roll-empty', 'warm', { kind: 'line', kicker: 'The camera roll', title: 'Your photos land here.' }) }
      }
      return {
        look,
        ghost: false,
        content: shot<'montage'>(`roll-${Math.min(photos.length, 6)}`, 'playful', { kind: 'montage', kicker: 'The camera roll', title: 'Look at all this.', photos: photos.slice(0, 6) }, 'cut'),
      }

    case 'spotlight': {
      const body = intake.spotlight.trim()
      const words = { kicker: 'The main character', title: r ? `There’s ${r}.` : 'Look who it is.', body: body || 'What you love about how they are goes here.' }
      return {
        look,
        ghost: !body,
        content: first
          ? shot<'photo'>(`spot-${first.id}`, 'warm', { kind: 'photo', photo: first, layout: 'left', ...words })
          : shot<'line'>('spot', 'warm', { kind: 'line', ...words }),
      }
    }

    case 'memories': {
      const index = Math.min(Math.max(focus.memory, 0), Math.max(intake.memories.length - 1, 0))
      const memory = intake.memories[index]
      const title = memory?.title.trim() ?? ''
      const story = memory?.story.trim() ?? ''
      const photo = photos.find((p) => p.id === memory?.photoId) ?? (photos.length ? photos[index % photos.length] : undefined)
      const words = {
        kicker: `${index + 1} of ${Math.max(intake.memories.length, 2)}`,
        title: title || 'A short title.',
        body: story || 'What happened, the way you’d tell a friend.',
      }
      return {
        look,
        ghost: !title && !story,
        content: photo
          ? shot<'photo'>(`memory-${memory?.id}-${photo.id}`, 'tender', { kind: 'photo', photo, layout: index % 2 ? 'right' : 'left', ...words })
          : shot<'line'>(`memory-${memory?.id}`, 'tender', { kind: 'line', ...words }),
      }
    }

    case 'habits': {
      const { text, index } = pick(intake.habits, focus.habit)
      const total = Math.max(intake.habits.filter((h) => h.trim()).length, 3)
      return {
        look,
        ghost: !text,
        content: shot<'flag'>(`flag-${index}`, 'playful', { kind: 'flag', label: 'Red flag', text: text || 'Their funniest habit goes here', n: index + 1, total }, 'cut'),
      }
    }

    case 'reasons': {
      const { text, index } = pick(intake.reasons, focus.reason)
      const total = Math.max(intake.reasons.filter((v) => v.trim()).length, 3)
      return {
        look,
        ghost: !text,
        content: shot<'reason'>(`reason-${index}`, 'tender', { kind: 'reason', text: text || 'One reason goes here.', n: Math.min(index + 1, total), total }),
      }
    }

    case 'letter': {
      const paragraphs = intake.letter.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)
      return {
        look,
        ghost: !paragraphs.length,
        content: shot<'letter'>('letter', 'tender', {
          kind: 'letter',
          greeting: r ? `Dear ${r},` : 'Dear you,',
          paragraphs: paragraphs.length ? paragraphs : ['Your letter goes here, set like a real one.'],
          signoff: s || 'Your name',
        }),
      }
    }

    case 'wish': {
      const words = intake.wish.trim()
      const fallback = r && s ? `Happy birthday, ${r}. Love, ${s}.` : 'Your last line goes here.'
      return { look, ghost: !words && !(r && s), content: shot<'reveal'>('wish', 'glow', { kind: 'reveal', words: words || fallback }) }
    }

    case 'look':
      return { look, ghost: !r, content: shot<'name'>(`name-${look}`, 'warm', { kind: 'name', name: r || 'Their name', sub: 'Today is about you.' }) }
  }
}
