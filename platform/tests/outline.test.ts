import { describe, expect, it } from 'vitest'
import { buildFilm } from '../src/film/timeline'
import { generateStory, moveScene, nextDesign, sceneBoard, toggleScene } from '../src/story/generate'
import { blankChapter, chapterName, cleanOutline, notesOf, outlineByWords, outlineOf } from '../src/story/outline'
import { emptyIntake, SAMPLE_FIXED, SAMPLE_INTAKE } from '../src/story/sample'
import type { Chapter, Intake } from '../src/story/types'
import { parseIntake } from '../src/story/validate'
import { cleanDirection, songChoiceLine } from '../src/story/direction'
import { songDetails, surpriseVibe, surpriseVoice, VIBES } from '../src/story/vibes'
import { WORLDS } from '../src/story/worlds'

process.env.MUSIC_PROVIDER = 'demo'
const { checkOutline, outlineBrief, outlineFilm } = await import('../src/server/outline')

const NOTE =
  'She winks at me. She hums when she cooks. She sings the wrong words to every song. We met in a coffee queue and she let me go first. The night the power went out we played cards till two. I love that she remembers the small things I mention once.'
const BRIEF = { text: NOTE, sender: 'Tobi', recipient: 'Maya', answered: [], occasion: 'anniversary' as const, photos: 0, letter: false }

/** What a model might answer for the note above. */
const ANSWER = {
  scenes: [
    { name: 'The wink', layout: 'line', mood: 'playful', lines: ['She winks at me.'] },
    { name: 'Kitchen concerts', layout: 'list', mood: 'playful', lines: ['She hums when she cooks.', 'She sings the wrong words to every song.'] },
    { name: 'The coffee queue', layout: 'moment', mood: 'tender', lines: ['We met in a coffee queue and she let me go first.'] },
    { name: 'The night the power went out', layout: 'moment', mood: 'tender', lines: ['The night the power went out we played cards till two.'] },
    { name: 'The small things', layout: 'line', mood: 'tender', lines: ['I love that she remembers the small things I mention once.'] },
  ],
  wish: '',
  world: 'mixtape',
  look: 'garden',
  because: 'teasing',
}
const OUTLINE = cleanOutline(ANSWER.scenes, { source: NOTE })
const maya = (over: Partial<Intake> = {}): Intake => ({ ...emptyIntake(), sender: 'Tobi', recipient: 'Maya', wish: 'Stay.', outline: OUTLINE, ...over })
const types = (intake: Intake, seed = 5) => generateStory(intake, seed).scenes.map((s) => s.type)
const said = (intake: Intake, seed = 5) => buildFilm(generateStory(intake, seed)).shots.map((s) => s.text).join(' | ')

describe('outlining a film from what its sender wrote', () => {
  it('keeps the scenes a model wrote, under the names it gave them, with only the sender’s words inside', () => {
    expect(OUTLINE.map((c) => [c.id, c.name, c.layout])).toEqual([
      ['s1', 'The wink', 'line'],
      ['s2', 'Kitchen concerts', 'list'],
      ['s3', 'The coffee queue', 'moment'],
      ['s4', 'The night the power went out', 'moment'],
      ['s5', 'The small things', 'line'],
    ])
    const invented = cleanOutline([{ name: 'Her laugh', layout: 'line', mood: 'tender', lines: ['Her laugh fills every room.'] }, ...ANSWER.scenes], { source: NOTE })
    expect(invented.map((c) => c.name)).not.toContain('Her laugh')
    expect(invented).toHaveLength(5)
  })

  it('refuses the stock names that made every film the same, unless the sender used those words', () => {
    const stock = cleanOutline([{ name: 'Red flags', layout: 'list', mood: 'playful', lines: ['She hums when she cooks.', 'She winks at me.'] }, { name: 'Reasons', layout: 'line', mood: 'tender', lines: ['We played cards till two.'] }], { source: NOTE })
    expect(stock.map((c) => c.name)).toEqual(['', ''])
    // Unnamed, a scene goes by the opening of its own words.
    expect(stock.map(chapterName)).toEqual(['She hums when she…', 'We played cards till…'])
    const theirs = 'Her red flags: she hums. She winks.'
    expect(cleanOutline([{ name: 'Red flags', layout: 'list', mood: 'playful', lines: ['she hums.', 'She winks.'] }], { source: theirs })[0].name).toBe('Red flags')
  })

  it('gives each scene the shape its words can fill, uses a line once, and has no scene of photos without photos', () => {
    const shaped = cleanOutline(
      [
        { name: 'A', layout: 'list', mood: 'warm', lines: ['She winks at me.'] },
        { name: 'B', layout: 'line', mood: 'warm', lines: ['She winks at me.', 'She hums when she cooks.', 'We met in a coffee queue and she let me go first.'] },
        { name: 'C', layout: 'photos', mood: 'warm', lines: [] },
        { name: 'D', layout: 'line', mood: 'sad', lines: [NOTE.slice(0, 170)] },
        { name: 'E', layout: 'list', mood: 'warm', lines: [] },
      ],
      { source: NOTE },
    )
    expect(shaped.map((c) => [c.name, c.layout, c.lines.length, c.mood])).toEqual([
      ['A', 'line', 1, 'warm'],
      ['B', 'list', 2, 'warm'],
      ['D', 'moment', 1, 'warm'],
    ])
    expect(cleanOutline([{ name: 'C', layout: 'photos', mood: 'warm', lines: [] }, { name: 'Again', layout: 'photos', mood: 'warm', lines: [] }], { photos: 3 })).toHaveLength(1)
    expect(cleanOutline(Array.from({ length: 20 }, (_, i) => ({ name: `N${i}`, layout: 'line', mood: 'warm', lines: [`Line ${i}`] })))).toHaveLength(8)
    expect(cleanOutline('nonsense')).toEqual([])
  })

  it('checks a model’s whole answer, and has none when nothing in it is the sender’s', () => {
    const checked = checkOutline({ ...ANSWER, wish: 'Forever yours.' }, BRIEF)!
    expect(checked.outline).toEqual(OUTLINE)
    expect(checked.wish).toBe('')
    expect(checked.direction).toMatchObject({ world: 'mixtape', look: 'garden', because: 'teasing' })
    // A kind of film the studio doesn't direct is replaced by the rule's choice.
    expect(checkOutline({ ...ANSWER, world: 'screening' }, BRIEF)!.direction.world).not.toBe('screening')
    expect(checkOutline({ scenes: [{ name: 'Made up', layout: 'line', mood: 'warm', lines: ['Entirely invented sentence here.'] }] }, BRIEF)).toBeNull()
    expect(checkOutline(null, BRIEF)).toBeNull()
  })

  it('tells the model there is no standard set of scenes, and to name each from its own words', () => {
    const brief = outlineBrief({ ...BRIEF, photos: 4, letter: true })
    expect(brief).toContain('There is no standard set of scenes to fill')
    expect(brief).toContain('Never use a stock label')
    expect(brief).toContain('Use only Tobi\'s own words, copied as written')
    expect(brief).toContain('Photos given: 4.')
    expect(brief).toContain(`The note:\n${NOTE}`)
    expect(outlineBrief(BRIEF)).toContain('Do not use `photos`')
  })

  it('outlines by rule when the model is off: each moment its own scene, and what sits together a list', async () => {
    const { outline, by, direction } = await outlineFilm(BRIEF)
    expect(by).toBe('rule')
    expect(outline).toEqual(outlineByWords(NOTE, [], 'Maya'))
    expect(outline.map((c) => [c.name, c.layout, c.lines.length])).toEqual([
      ['The way Maya is', 'list', 3],
      ['', 'moment', 1],
      ['', 'moment', 1],
      ['', 'line', 1],
    ])
    expect(outline[1].lines).toEqual(['We met in a coffee queue and she let me go first.'])
    expect(outline[2].lines).toEqual(['The night the power went out we played cards till two.'])
    expect(direction).toMatchObject({ designs: {}, order: [] })
    // A few words before something that happened name it, and the sentences that carry it on stay with it.
    const moving = outlineByWords('Moving day. The lift broke, and you carried the sofa up five floors. Then we ate noodles on the floor. You never finish your tea.', [], 'Zara')
    expect(moving.map((c) => [c.name, c.layout])).toEqual([
      ['Moving day', 'moment'],
      ['', 'line'],
    ])
    expect(moving[0].lines).toEqual(['The lift broke, and you carried the sofa up five floors. Then we ate noodles on the floor.'])
    // An answer joins the part of the note it was about.
    const answered = outlineByWords(NOTE, [{ quote: 'She hums when she cooks.', question: 'What does she hum?', answer: 'Always the same advert.' }], 'Maya')
    expect(answered[0].lines[1]).toBe('She hums when she cooks. Always the same advert.')
    // An unnamed moment is titled by its own first sentence, said once.
    expect(said(maya({ outline }))).toContain('| We met in a coffee queue and she let me go first. |')
  })
})

describe('a film with its own scenes', () => {
  it('is made of its opening, its own scenes in their order, and its ending', () => {
    expect(types(maya())).toEqual(['ticket', 'hello', 's1', 's2', 's3', 's4', 's5', 'wish'])
    expect(generateStory(maya(), 5).scenes.slice(2, 7).map((s) => s.name)).toEqual(OUTLINE.map((c) => c.name))
    expect(types(maya({ letter: 'Dear Maya, a letter that is long enough to count as one.' }))).toEqual(['ticket', 'hello', 's1', 's2', 's3', 's4', 's5', 'letter', 'wish'])
  })

  it('never calls anything a red flag, a reason or memory lane, in any kind of film', () => {
    for (const world of WORLDS) {
      for (const seed of [1, 2, 3, 4]) {
        const text = said(maya({ world: world.id }), seed)
        expect(text).not.toMatch(/red flag|reason|memory lane|main character|investigation|verdict/i)
        for (const line of OUTLINE.flatMap((c) => c.lines)) expect(text).toContain(line)
      }
    }
  })

  it('shows a line under its scene’s name, announces only its lists, and labels a list with its own name', () => {
    const film = buildFilm(generateStory(maya({ world: 'mixtape' }), 5))
    const wink = film.shots.find((s) => s.text.includes('She winks at me.'))!
    expect(wink).toMatchObject({ kind: 'line', kicker: 'The wink', title: 'She winks at me.', sceneName: 'The wink' })
    expect(film.shots.filter((s) => s.kind === 'card').map((s) => s.kind === 'card' && s.title)).toEqual(['Kitchen concerts'])
    const hums = film.shots.filter((s) => s.sceneName === 'Kitchen concerts' && s.kind === 'flag')
    expect(hums.map((s) => s.kind === 'flag' && [s.label, s.n, s.total])).toEqual([
      ['Kitchen concerts', 1, 2],
      ['Kitchen concerts', 2, 2],
    ])
    // A tender list is drawn the calm way, still under its own name.
    const calm = buildFilm(generateStory(maya({ outline: [{ ...OUTLINE[1], mood: 'tender' }] }), 5)).shots.filter((s) => s.kind === 'reason')
    expect(calm.map((s) => s.kind === 'reason' && s.label)).toEqual(['Kitchen concerts', 'Kitchen concerts'])
  })

  it('tells each moment beside a photo, and shows the photos left over in a scene of their own', () => {
    const photos = SAMPLE_FIXED.photos.slice(0, 4)
    const story = generateStory(maya({ photos, outline: [{ ...OUTLINE[2], photoId: photos[1].id }, OUTLINE[3], OUTLINE[0]] }), 5)
    const frames = story.scenes.flatMap((s) => s.frames)
    const told = frames.filter((f) => f.kind === 'photo')
    // A telling that opens with its scene's name is the title itself, said once.
    expect(told.map((f) => f.kind === 'photo' && [f.title, f.body])).toEqual([
      ['The coffee queue', 'We met in a coffee queue and she let me go first.'],
      ['The night the power went out we played cards till two.', undefined],
    ])
    expect(told[0].kind === 'photo' && told[0].photo.id).toBe(photos[1].id)
    const rest = frames.find((f) => f.kind === 'montage')!
    expect(rest.kind === 'montage' && rest.title).toBe('Maya, in pictures')
    expect(rest.kind === 'montage' && rest.photos.map((p) => p.id).sort()).toEqual(photos.map((p) => p.id).filter((id) => !told.some((f) => f.kind === 'photo' && f.photo.id === id)).sort())
    // That scene is the outline's own when it has one, under its own name, wherever it was put.
    const named = generateStory(maya({ photos, outline: [{ id: 'pics', name: 'Us, lately', layout: 'photos', mood: 'warm', lines: [] }, OUTLINE[0]] }), 5)
    expect(named.scenes.map((s) => s.name)).toContain('Us, lately')
    expect(outlineOf(maya())).toBe(OUTLINE)
  })

  it('draws two lists that follow each other differently, and a design the sender picks stays', () => {
    const lists = [OUTLINE[1], { ...OUTLINE[1], id: 's9', name: 'More of them', lines: ['One.', 'Two.'] }]
    for (const world of WORLDS) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const [a, b] = generateStory(maya({ world: world.id, outline: lists }), seed).scenes.filter((s) => s.layout === 'list')
        expect(a.design).toBeTruthy()
        expect(a.design).not.toBe(b.design)
      }
    }
    const story = generateStory(maya({ world: 'scrapbook' }), 5)
    const cut = nextDesign(story, undefined, 's2')
    const next = generateStory(maya({ world: 'scrapbook', cut }), 5)
    expect(next.scenes.find((s) => s.type === 's2')?.design).not.toBe(story.scenes.find((s) => s.type === 's2')?.design)
    expect(cut.designs?.s2).toBe(next.scenes.find((s) => s.type === 's2')?.design)
  })

  it('lets the sender move a scene, leave one out, add one and see what one still needs', () => {
    const story = generateStory(maya(), 5)
    expect(types(maya({ cut: moveScene(story, undefined, 's1', 1) }))).toEqual(['ticket', 'hello', 's2', 's1', 's3', 's4', 's5', 'wish'])
    expect(types(maya({ cut: toggleScene(undefined, 's3', false) }))).not.toContain('s3')
    const fresh = blankChapter(OUTLINE.map((c) => c.id))
    const added = maya({ outline: [...OUTLINE, fresh] })
    expect(types(added)).not.toContain(fresh.id)
    const rows = sceneBoard(added, generateStory(added, 5))
    expect(rows.find((r) => r.type === fresh.id)).toMatchObject({ name: 'New scene', state: 'missing', missing: 'Add its words', layout: 'line' })
    expect(rows.find((r) => r.type === 's2')).toMatchObject({ name: 'Kitchen concerts', state: 'in', fixed: false, layout: 'list' })
    expect(rows.find((r) => r.type === 's2')!.designs.length).toBe(4)
    expect(rows.find((r) => r.type === 'letter')).toMatchObject({ state: 'missing' })
    // Written, it plays.
    const written: Chapter = { ...fresh, name: 'Her tea', lines: ['She never finishes her tea.'] }
    expect(said(maya({ outline: [...OUTLINE, written] }))).toContain('Her tea. She never finishes her tea.')
  })

  it('travels with the gift, and is what its song is written from', () => {
    const kept = parseIntake(maya())
    expect(kept.ok && kept.intake.outline).toEqual(OUTLINE)
    expect(parseIntake(maya({ outline: [{ ...OUTLINE[0], layout: 'hologram' as never }] })).ok).toBe(false)
    expect(parseIntake(maya({ outline: [OUTLINE[0], OUTLINE[0]] })).ok).toBe(false)
    expect(parseIntake(maya({ outline: [{ ...OUTLINE[0], lines: ['x'.repeat(500)] }] })).ok).toBe(false)
    const song = songDetails(maya())!
    expect(song.habits).toEqual(['She winks at me.', 'She hums when she cooks.', 'She sings the wrong words to every song.'])
    expect(song.moments).toHaveLength(2)
    expect(song.reasons).toEqual(['I love that she remembers the small things I mention once.'])
    expect(notesOf(OUTLINE).memories.map((m) => m.title)).toEqual(['The coffee queue', 'The night the power went out'])
    // A scene left out of the film is left out of the song.
    expect(songDetails(maya({ cut: { off: ['s1'] } }))!.habits).not.toContain('She winks at me.')
  })
})

describe('the sample', () => {
  it('is told in scenes of its own, in every kind of film', () => {
    const story = generateStory(SAMPLE_INTAKE, 3)
    expect(story.scenes.map((s) => s.name)).toEqual(['The invitation', 'Before we begin', 'Your whole face', 'One word', 'Things you say', 'Games night', 'The rain can wait', 'One more minute', 'The small things', 'Caught on camera', 'A letter', 'Make a wish'])
    for (const world of WORLDS) expect(said({ ...SAMPLE_INTAKE, world: world.id }, 3)).not.toMatch(/red flag|reason \d|memory lane|main character/i)
    // Every photo is seen once: four beside their moments, the rest in the last scene.
    const shown = story.scenes.flatMap((s) => s.frames).flatMap((f) => (f.kind === 'photo' ? [f.photo.id] : f.kind === 'montage' ? f.photos.map((p) => p.id) : []))
    expect([...shown].sort()).toEqual(SAMPLE_INTAKE.photos.map((p) => p.id).sort())
  })
})

describe('“Surprise me” for the song', () => {
  const directed = (because: 'teasing' | 'tender', seed: number) => maya({ direction: { seed, world: 'mixtape', look: 'garden', designs: {}, order: [], because } })
  it('picks a style that suits the film, not the same one for every film, and keeps it when the song is tried again', () => {
    const lively = new Set(Array.from({ length: 12 }, (_, seed) => surpriseVibe(directed('teasing', seed))))
    const gentle = new Set(Array.from({ length: 12 }, (_, seed) => surpriseVibe(directed('tender', seed))))
    expect([...lively].sort()).toEqual(['afrobeats', 'highlife', 'lofi-rnb'])
    expect([...gentle].sort()).toEqual(['afro-soul', 'lofi-rnb', 'piano'])
    expect(surpriseVibe(directed('teasing', 41))).toBe(surpriseVibe(directed('teasing', 41)))
    // A film that was never directed still gets a style of its own, from its two names.
    const undirected = new Set(['Zara', 'Kemi', 'Maya', 'Rin', 'Ada', 'Tobi', 'Leo', 'Sam'].map((recipient) => surpriseVibe({ sender: 'Tola', recipient })))
    expect(undirected.size).toBeGreaterThan(1)
    for (const id of undirected) expect(VIBES.map((v) => v.id)).toContain(id)
  })

  it('takes the director’s tune and voice when a model directed the film, and only ones the studio has', () => {
    const checked = checkOutline({ ...ANSWER, tune: 'piano', voice: 'woman' }, BRIEF)!
    expect(checked.direction).toMatchObject({ world: 'mixtape', tune: 'piano', voice: 'woman' })
    const film = maya({ direction: { ...checked.direction, seed: 3 } })
    expect(surpriseVibe(film)).toBe('piano')
    expect(surpriseVoice(film)).toBe('woman')
    // The song it chose stands even when the kind of film it named is not one the studio directs.
    expect(checkOutline({ ...ANSWER, world: 'screening', tune: 'highlife', voice: 'man' }, BRIEF)!.direction).toMatchObject({ tune: 'highlife', voice: 'man' })
    // Anything else is dropped, and the studio draws the style and leaves the voice to the singer.
    const loose = cleanDirection({ world: 'mixtape', tune: 'polka', voice: 'choir' })!
    expect(loose.tune).toBeUndefined()
    expect(loose.voice).toBeUndefined()
    expect(surpriseVoice(maya({ direction: { ...loose, seed: 3 } }))).toBe('surprise')
    expect(VIBES.map((v) => v.id)).toContain(surpriseVibe(maya({ direction: { ...loose, seed: 3 } })))
    // It travels with the gift.
    const kept = parseIntake(film)
    expect(kept.ok && kept.intake.direction).toMatchObject({ tune: 'piano', voice: 'woman' })
    // The model is asked for both, and told not to guess a voice from a name.
    expect(outlineBrief(BRIEF)).toContain('`piano` (Soft piano: piano and strings, slow and tender)')
    expect(outlineBrief(BRIEF)).toContain('do not guess from a name')
  })

  it('says what it chose for the song, only for the parts the sender left to it', () => {
    const chosen = { tune: 'highlife', voice: 'man' as const }
    expect(songChoiceLine(chosen, { tune: true, voice: true })).toBe('For the song it chose Highlife guitar, in a man’s voice.')
    expect(songChoiceLine(chosen, { tune: true, voice: false })).toBe('For the song it chose Highlife guitar.')
    expect(songChoiceLine(chosen, { tune: false, voice: true })).toBe('For the song it chose a man’s voice.')
    expect(songChoiceLine(chosen, { tune: false, voice: false })).toBe('')
    expect(songChoiceLine({}, { tune: true, voice: true })).toBe('')
  })
})
