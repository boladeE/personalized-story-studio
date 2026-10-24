# For Zara v2 — a fictional birthday screening

A complete vanilla HTML/CSS/JavaScript, photo-led gift experience. This version deliberately uses an espresso cinema canvas, crimson admission ticket, locally hosted Bodoni Moda, photoreal imagery, restrained film grain and an original fictional Tobi-to-Zara narrative. The previous sibling `For Zara` is not modified.

## Preview

Run from this directory:

```sh
python3 -m http.server 8767 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8767/`. No build step, API key or package install is needed for the site.

Opening `index.html` directly also works for the story, local fonts, photos and local-file audio selection. Under `file://`, the site deliberately does **not** fetch `music.json`; it uses the same three bundled official track IDs as defaults. HTTP preview is preferred for YouTube referrer/origin support and editable music configuration.

## Experience

- 14 scenes including the ticket, with 12 named story chapters plus the personal opening.
- Ticket → skippable 2.1-second theatrical countdown → a read-at-your-own-pace story. No automatic scene advancement, forced playback or rushed timeline.
- Previous/Next, Left/Right arrows, Space for next, M for music, accessible named chapter dots.
- Native scrolling within long chapters, particularly the personal letter and mobile layouts. Nothing advances just because you are reading slowly.
- The original invented story includes Uno at a friend's games night, a rainy café date, the 11:07 “quick gist”, stolen chips, sunset by the water, a photo montage/lightbox, affectionate reviews, a tiny complaints department, a personal letter and birthday wishes.
- The final candle button extinguishes its small flame cue, records the wish for this page session and reveals a bonus love note. Revisiting the finale keeps the wish state until reload.
- Credits and photograph dialogs support Escape. The music panel is non-modal so navigation remains usable.
- Reduced-motion support, responsive photography crops and keyboard focus indicators. On narrow screens the landscape photographs become full-width, face-safe cinematic windows that fade into the story, rather than cropping both faces out of a tall background.

## Music: honest playback, not a hidden audio workaround

`music.json` is supplied separately with `tracks: [{id, title, artist, videoId, ...}]`. Only title, artist and a validated 11-character YouTube video ID are needed by the renderer. Text is inserted as text, not interpreted as HTML.

Defaults:

1. Roju — Chike — `19WTWVw15n0`
2. How Are You (My Friend) — Johnny Drille — `CSK5eApRGwQ`
3. Grow As We Go — Ben Platt — `aDeNQNtW1f8`

Music is **off** at first. Opening Music does not create an iframe. Choosing **Show YouTube player** creates a visible player in a small persistent dock; it does not disappear into a hidden audio element when the panel closes. Press play in the player. Close the dock or choose Stop all music to remove the embed.

Chapter navigation updates the intended track label even while music is off. When enabled, it changes the visible embed only when the intended video changes. It does not pretend to provide seamless, automatically audible playback: the next video may require another press of play. Playback requires internet and may be restricted by browser autoplay policy, country, owner embedding rules, referrers or network filtering. Both the panel and the dock include a direct YouTube fallback link. HTTP embeds include the origin and strict-origin-when-cross-origin referrer policy.

The local file input accepts a song the viewer is authorized to use. It creates an ObjectURL only; nothing is uploaded, copied into the site, or scene-switched. Playback uses the native audio control. Selecting local audio stops YouTube, and showing YouTube pauses local audio. Unplayable files display a clear error. ObjectURLs are revoked on replacement/page exit. No synthesized or bundled music is included.

## Assets / privacy

- All seven supplied images in `assets/` depict a fictional adult Nigerian couple, generated with Gemini. They are not the private reference's people or photos.
- Story names, memories, messages and writing are original fiction. No private customer biography or media is embedded.
- A subtle persistent fiction/AI-photo disclosure and full Credits are included.
- `assets/bodoni-regular.ttf`, `assets/bodoni-italic.ttf`: Bodoni Moda by Owen Earl / indestructible type*, SIL Open Font License. License included as `assets/Bodoni-OFL.txt`.
- No first-party analytics or front-end API keys. Opting into YouTube contacts a third party, which can use cookies and collect playback data.

## Browser tests

```sh
/home/sanmi/.hermes/cache/scratch/gift-demo-env/bin/python test_gift_v2.py
```

Tests start their own ephemeral localhost server and **headless** `/usr/bin/google-chrome`. They never open or modify the user's current browser.

Coverage includes admission/countdown skip, Next/Previous/keyboard, focused-button arrow regression, all 14 scenes at 320/390/768/1440 pixels without horizontal overflow, narrow photo crop windows, wish state/bonus note, all image assets loaded, gallery, credits, local ObjectURL file selection, keyboard-input protection, file:// no-fetch defaults, and opt-in visible YouTube track switching/stopping. The local-file test uses an empty MIME-labeled fixture to verify selection/privacy/UI, **not** to assert audible playback. Tests do not assert that a YouTube iframe loading means sound is playing.

## Test API

```js
window.giftV2.ready
window.giftV2.go(11) // zero-based scene index
window.giftV2.getState()
// {scene,total,name,wished,countdownActive,soundtrackEnabled,intendedTrack,localAudioSelected}
```

The API supports QA, not film export. No video has been exported and no rights to export the soundtrack are implied.
