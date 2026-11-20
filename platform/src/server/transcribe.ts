import { MusicError } from './music'
import { NOT_STORED, sortProvider } from './sort'

/**
 * Writing down what a sender said, so they can talk about someone where they
 * would otherwise type. A Google model transcribes the recording; nothing is
 * added or tidied here (the director does that when the film is made), and the
 * recording is not kept.
 */
export async function transcribe(audio: Uint8Array, mimeType: string, names: string[] = []): Promise<string> {
  if (sortProvider() !== 'gemini') throw new MusicError('Speaking isn’t switched on for this studio yet. Type it for now.', 503)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(process.env.TRANSCRIBE_TIMEOUT_MS ?? 45_000))
  try {
    const model = process.env.GEMINI_TRANSCRIBE_MODEL ?? 'gemini-3.8-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({
        ...NOT_STORED,
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Write down exactly what this person says, in the language they speak it, with ordinary punctuation. Keep their own words, slang and names as said. Leave out "um" and "uh". Add nothing, explain nothing, and do not describe sounds. If nothing is said, reply with an empty line.' + (names.length ? ` Names they are likely to say, spelled this way: ${names.join(', ')}.` : '') },
              { inlineData: { mimeType, data: Buffer.from(audio).toString('base64') } },
            ],
          },
        ],
        generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
      }),
    })
    if (!response.ok) {
      console.error(`[transcribe] Gemini ${response.status}: ${(await response.text().catch(() => '')).slice(0, 200)}`)
      throw new MusicError('That couldn’t be written down just now. Try again, or type it.', 502)
    }
    const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> }
    return (body.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => typeof p.text === 'string' && !p.thought)
      .map((p) => p.text)
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
  } catch (error) {
    if (error instanceof MusicError) throw error
    console.error('[transcribe] request failed', error)
    throw new MusicError('That took too long to write down. Try a shorter recording, or type it.', 504)
  } finally {
    clearTimeout(timer)
  }
}
