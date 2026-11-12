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

1. `/create`: intake with a live storyboard. The draft stays in the tab (photos are `blob:` URLs) until it is sent.
2. `/preview`: the generated story. Shuffle is a new seed. "Look & music" changes the look without reshuffling and can make an original AI song.
3. `/send`: question and answer for the lock, then "Create the private link". Photos are redrawn as JPEGs (max 2000px, no EXIF or GPS) in the browser before upload.
4. `/manage/<id>#k=<key>`: the sender's page with the link, a message to copy, and delete. The key stays in the URL fragment, so it isn't sent in requests or referrers. Only its hash is stored.
5. `/g/<id>`: the recipient. Nothing about the gift shows until the answer is right. Answers ignore case, spacing and edge punctuation, and are stored as scrypt hashes. A correct answer sets an HttpOnly signed cookie for 30 days. Photos and the song are served only with that cookie. Guesses are limited to 10 per gift per 15 minutes.

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
- Other occasions, MP4 film export, accounts.
- Clean-up of unused draft songs, and backups of `DATA_DIR`.
- Railway: needs a service on this branch with a volume mounted at `DATA_DIR`, `SESSION_SECRET` set, build `npm run build` and start `npm start`.
