// Check a template's data without drawing it: node scripts/check-template.mjs public/templates/<id>.json
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { checkTemplate } = await server.ssrLoadModule('/src/template/check.ts')
let failed = false
for (const file of process.argv.slice(2)) {
  const { ok, problems } = checkTemplate(JSON.parse(readFileSync(file, 'utf8')))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${file}`)
  for (const p of problems) console.log(`     ${p}`)
  failed ||= !ok
}
await server.close()
process.exit(failed ? 1 : 0)
