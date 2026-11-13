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

1. `/`: the studio home. The hero is the real film player showing the fictional sample.
2. `/create`: intake with a live storyboard. The draft stays in the tab (photos are `blob:` URLs) until it is sent.
3. `/preview`: the generated film. Shuffle is a new seed. "Look & music" changes the look without reshuffling and can make an original AI song.
4. `/send`: question and answer for the lock, then "Create the private link". Photos are redrawn as JPEGs (max 2000px, no EXIF or GPS) in the browser before upload.
5. `/manage/<id>#k=<key>`: the sender's page with the link, a message to copy, and delete. The key stays in the URL fragment, so it isn't sent in requests or referrers. Only its hash is stored.
6. `/g/<id>`: the recipient. Nothing about the gift shows until the answer is right. Answers ignore case, spacing and edge punctuation, and are stored as scrypt hashes. A correct answer sets an HttpOnly signed cookie for 30 days. Photos and the song are served only with that cookie. Guesses are limited to 10 per gift per 15 minutes.

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
- `src/server/music.ts`: Lyria 3.5 through the Gemini Interactions API (preferred), or legacy Lyria 3 Pro through OpenRouter (Lyria 3.5 isn't on OpenRouter yet). Songs carry Google's inaudible SynthID watermark. Prompts are instrumental-only and never include names. There are per-client and daily caps. `MUSIC_PROVIDER=demo` makes short local tones for tests.
- Production needs `SESSION_SECRET` (32+ characters). Without it, the server refuses to unlock gifts.

## Not done yet

- Real payment (Paystack) and emailed receipts. Today the sender must bookmark the manage page.
- Lyria has not been called with a real key. Both request shapes follow the providers' docs and the response parsers are unit-tested, but real responses are unverified.
- AI writing and photo tagging, per-line edits, swapping photos, removing scenes.
- The film has only been watched in headless Chrome captures and one real Chrome window. It has not been checked on real phones, Safari or Firefox, and nobody has listened to it.
- AI songs don't have a beat map, so cuts follow a default tempo rather than the song.
- Other occasions, MP4 film export, accounts.
- Clean-up of unused draft songs, and backups of `DATA_DIR`.
- Railway: needs a service on this branch with a volume mounted at `DATA_DIR`, `SESSION_SECRET` set, build `npm run build` and start `npm start`.
