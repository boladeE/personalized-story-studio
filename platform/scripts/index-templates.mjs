// Write public/templates/index.json: the ids of the templates a new film may be given.
// Only list templates that have passed the gate:  node scripts/index-templates.mjs public/templates/a.json public/templates/b.json
import { readFileSync, writeFileSync } from 'node:fs'
const ids = process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, 'utf8')).id).filter(Boolean).sort()
writeFileSync('public/templates/index.json', `${JSON.stringify(ids, null, 0)}\n`)
console.log(`${ids.length} templates listed`)
