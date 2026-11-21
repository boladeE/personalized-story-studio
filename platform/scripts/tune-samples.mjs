// Make the 16-second sample a sender hears before choosing a tune: public/tunes/<id>.mp3.
//   node scripts/tune-samples.mjs <id> [...more]
// Needs GEMINI_API_KEY (read from .env.local, never printed) and ffmpeg. Each one is a real instrumental from
// the music model, about a minute and a half to make, cut to 16 seconds from where the tune has got going.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

for (const line of existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split('\n') : []) {
  const at = line.indexOf('=')
  if (at > 0 && !line.trim().startsWith('#') && process.env[line.slice(0, at).trim()] === undefined) process.env[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^["']|["']$/g, '')
}
process.env.MUSIC_PROVIDER = 'gemini'
const work = mkdtempSync(join(tmpdir(), 'tunes-'))
process.env.DATA_DIR = work

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { generateSong, readSong } = await server.ssrLoadModule('/src/server/music.ts')
const one = async (id) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const made = await generateSong(id)
      const song = await readSong(made.id)
      const raw = join(work, `${id}.bin`)
      writeFileSync(raw, song.bytes)
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '14', '-t', '16', '-i', raw, '-af', 'afade=t=in:st=0:d=0.35,afade=t=out:st=14.8:d=1.2', '-ac', '2', '-ar', '44100', '-b:a', '96k', `public/tunes/${id}.mp3`])
      console.log(`made ${id}`)
      return
    } catch (error) {
      console.log(`${id}: attempt ${attempt} failed: ${String(error.message ?? error).slice(0, 160)}`)
    }
  }
  console.log(`gave up on ${id}`)
}
// Three at a time.
const ids = process.argv.slice(2)
await Promise.all([0, 1, 2].map(async (lane) => {
  for (let i = lane; i < ids.length; i += 3) await one(ids[i])
}))
await server.close()
