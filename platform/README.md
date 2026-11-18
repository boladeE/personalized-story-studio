# Little Things Digital platform (branch `platform_v1`)

End to end, birthday only: a sender builds a story, adjusts it, locks it with a question, and gets a private link. The recipient answers the question and plays the gift. The sender can delete it. Payment isn't connected: gifts are created in test mode and nothing is charged.

    npm install
    cp .env.example .env.local   # optional: add GEMINI_API_KEY for AI songs (Lyria 3.5)
    npm run dev                  # http://localhost:3000
    npm test                     # unit tests (Vitest)
    npm run test:e2e             # browser tests (Playwright, /usr/bin/google-chrome; songs use the demo provider)
    npm run build && npm start   # production server (srvx), reads .env.local if present
    E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e   # run the browser tests against a running server

## Flow

1. `/`: the studio home. The hero is the real film player showing the fictional sample, with a sung song the studio made for the fictional Zara (`public/sample/zara-song.mp3`, Lyria 3.5). The sample is marked "A fictional sample" under the player, and both sample films end with a small line under the credits saying Zara and Tobi are fictional and their photos and song were made for the sample. The preview header carries only controls.
2. `/create`: one question per screen (`?step=`), with a still of the scene it feeds beside it, filled with the sender's words as they type (`src/film/Still.tsx`, `src/film/previews.ts`). A strip of frames shows which scenes have enough to be in the film and jumps to any step. The draft stays in the tab (photos are `blob:` URLs) until it is sent.
3. `/preview`: the generated film. Shuffle is a new seed. "Look & music" changes the look without reshuffling, switches between the studio score and any song takes, and links to the song page.
4. `/song`: the song. The studio writes the words from the sender's name, reasons, habits, memories and wish (`POST /api/lyrics`, a Google text model, about 6 seconds); the sender edits them on a ruled sheet, picks one of four tunes after hearing a 16-second sample of each (`public/tunes/`), and hears it sung (`POST /api/music` with `lyrics`, about a minute). Each version is kept as a take for the sitting and the film plays the chosen one. "Music only" makes an instrumental and sends nothing personal. The page says once, plainly, that Google's AI models write and sing it and what is sent.
5. `/send`: question and answer for the lock, then "Create the private link". Photos are redrawn as JPEGs (max 2000px, no EXIF or GPS) in the browser before upload.
6. `/manage/<id>#k=<key>`: the sender's page with the link, a message to copy, and delete. The key stays in the URL fragment, so it isn't sent in requests or referrers. Only its hash is stored.
7. `/g/<id>`: the recipient. Nothing about the gift shows until the answer is right. Answers ignore case, spacing and edge punctuation, and are stored as scrypt hashes. A correct answer sets an HttpOnly signed cookie for 30 days. Photos and the song are served only with that cookie. Guesses are limited to 10 per gift per 15 minutes.

## The film (`src/film/`)

The gift is a film that plays by itself, not a slideshow.

- `timeline.ts`: turns a story into timed shots. Lengths come from reading time, snapped to whole bars of the scene's music so cuts land on the beat. Plain data, so it can later drive an MP4 render.
- `Film.tsx`: the player. Tapping the ticket tears it, a film leader counts 3-2-1, then a clock runs the shots. The film waits at the candle and at the end. There is a player bar (back, pause, next, scrubber with scene marks, sound, full screen) and keyboard control (Space, arrows, M, F). It pauses when the tab is hidden.
- `shots.tsx`: what each shot looks like: lines typed letter by letter, the name drawn from dust, scene cards, framed photos with a slow push, flat-colour red flags that slam in on the beat, prints dealt for the camera roll, a letter that scrolls as it is read, the candle, the wish and rolling credits.
- `backdrop.ts`: WebGL smoke behind everything. It drifts between palettes per mood and swells with the beat. Falls back to a CSS gradient.
- `particles.ts`: dust, words that gather from or scatter into dust, candle sparks and confetti.
- `looks.ts`: the three looks as palettes.
- Reduced motion: no countdown, particles or smoke movement; shots still change with simple fades.
- Styles: `src/styles/film.css` (sized in container units, so the film scales to its box) and `src/styles/room.css` (the dark studio theme).

## Server

- `src/routes/api/*`: plain Request/Response handlers (create, unlock, gift, media, manage, music, song).
- `src/server/store.ts`: one folder per gift under `DATA_DIR` (`gift.json` and `media/`). It can be swapped for Postgres and R2 later behind the same functions.
- `src/story/validate.ts`: server-side limits on every intake field. The server rebuilds the story from the intake and seed, so it never trusts a story sent by the browser.
- `src/server/music.ts`: Lyria 3.5 through the Gemini Interactions API (preferred), or legacy Lyria 3 Pro through OpenRouter (Lyria 3.5 isn't on OpenRouter yet). Songs carry Google's inaudible SynthID watermark. Sung prompts (`sungPrompt` in `src/story/vibes.ts`) carry the recipient's and sender's names and up to three reasons, three habits, two memories and the wish, cleaned and capped on the server; the letter and photos are never sent. Instrumental prompts carry nothing personal. When the request carries `lyrics` (the normal path from `/song`), `lyricsPrompt` tells Lyria to sing those words exactly; in the one real comparison made, all 22 lines came back word for word with nothing added. The approved words and the song's title are stored with it. Google refuses a request whose lyrics quote an existing song (HTTP 400, code `recitation`); the line "Happy birthday to you" does this, so it is caught in the page, in the endpoint (422) and in the writer's output. There are per-client and daily caps. `MUSIC_PROVIDER=demo` makes short local tones for tests.
- `src/components/audio-engine.ts`: a song is streamed through a media element wired into Web Audio, so it starts as soon as the first second has arrived (measured at 1.5 Mbit/s: the old download-then-decode left about 12 seconds of silence after the film began; streaming starts with the film). The element is played once, muted, inside the tap so gesture-only browsers allow it later; if streaming is refused, the whole file is decoded as before. Songs are served with byte ranges (`mediaResponse` in `src/server/store.ts`).
- `src/server/lyrics.ts`: writes the words with `gemini-pro-latest` (`GEMINI_LYRICS_MODEL`), low thinking, JSON output, about 15 to 25 seconds. The brief (`lyricsBrief` in `src/story/vibes.ts`) has two tones, chosen on the song page. `smooth` (the default) writes a spare track on one hook from the sender's own phrase, uses at most three details without explaining them, and keeps the name and "happy birthday" for the bridge and outro. `story` tells one moment in order, teases with the punchline last and puts the birthday in the chorus. Each carries a worked example about two invented friends, kept free of any one country's references. In side-by-side reads, Flash at the same speed invented details to reach rhymes, and higher thinking levels took two minutes without writing better. Same key as the music. Caps: `LYRICS_HOURLY_PER_CLIENT` (20) and `LYRICS_DAILY_LIMIT` (300). `MUSIC_PROVIDER=demo` returns placeholder words.
- Production needs `SESSION_SECRET` (32+ characters). Without it, the server refuses to unlock gifts.

## Not done yet

- Real payment (Paystack) and emailed receipts. Today the sender must bookmark the manage page.
- Lyria 3.5 through the Gemini API has made real songs (about two minutes, MP3, 40 to 55 seconds to make). The OpenRouter path has never been called with a real key. Gemini keys must now be bound to a service account in Google Cloud, and the project needs prepaid credit.
- AI writing and photo tagging, per-line edits, swapping photos, removing scenes.
- The film has only been watched in headless Chrome captures and one real Chrome window. It has not been checked on real phones, Safari or Firefox, and nobody has listened to it.
- AI songs don't have a beat map, so cuts follow a default tempo rather than the song.
- Sung songs: nobody has checked how Lyria pronounces Nigerian names. Written lyrics are a first draft: the writer still pads the odd line to make a rhyme, which is why the sender edits before the music is made. Takes live only in the tab; a reload loses them. Lyric writing needs `GEMINI_API_KEY` even when music goes through OpenRouter.
- Other occasions, MP4 film export, accounts.
- Clean-up of unused draft songs, and backups of `DATA_DIR`.
- Railway: needs a service on this branch with a volume mounted at `DATA_DIR`, `SESSION_SECRET` set, build `npm run build` and start `npm start`.
