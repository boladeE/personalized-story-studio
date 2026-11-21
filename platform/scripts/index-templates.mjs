// Write the lists of templates a new film may be given: public/templates/index.json (their ids) and
// catalogue.json (ids with names, for a sender choosing one by eye).
// Only list templates that have passed the gate:  node scripts/index-templates.mjs public/templates/a.json public/templates/b.json
import { readFileSync, writeFileSync } from 'node:fs'
const all = process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, 'utf8'))).filter((t) => t.id).sort((a, b) => a.name.localeCompare(b.name))
writeFileSync('public/templates/index.json', `${JSON.stringify(all.map((t) => t.id).sort())}\n`)
writeFileSync('public/templates/catalogue.json', `${JSON.stringify(all.map((t) => ({ id: t.id, name: t.name })))}\n`)
console.log(`${all.length} templates listed`)
