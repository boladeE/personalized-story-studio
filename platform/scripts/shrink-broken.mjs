// Repair one fault the gate finds: a word that had to be broken in two to fit. Each such word is given
// a smaller size on the screen shape where it broke, and the gate is run again, up to four times.
//   node scripts/shrink-broken.mjs public/templates/<id>.json [...more]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const gate = (file) => {
  try {
    return execFileSync('node', ['scripts/gate.mjs', file], { encoding: 'utf8' })
  } catch (error) {
    return String(error.stdout ?? '')
  }
}
for (const file of process.argv.slice(2)) {
  for (let round = 0; round < 4; round++) {
    const out = gate(file)
    const broken = [...out.matchAll(/\[(wide|tall)[^\]]*\] \w+: ([a-z ,]+): (\w+): a word had to be broken/g)].map((m) => ({ way: m[1], label: m[2], slot: m[3] }))
    if (!broken.length) {
      console.log(`${out.includes('FAIL') ? 'still failing for other reasons' : 'ok'}: ${file}${round ? ` (after ${round} round${round > 1 ? 's' : ''})` : ''}`)
      if (out.includes('FAIL')) console.log(out.split('\n').slice(0, 8).join('\n'))
      break
    }
    const template = JSON.parse(readFileSync(file, 'utf8'))
    const kindOf = (label) => (label === 'cover' ? ['cover'] : label.includes('item') ? ['item', 'itemLoud', 'list'] : label.startsWith('voice') ? ['voice'] : [label])
    const seen = new Set()
    for (const { way, label, slot } of broken) {
      for (const kind of kindOf(label)) {
        const lines = (template.pages[kind]?.items ?? []).flatMap((item) => (item.is === 'text' ? [item] : item.is === 'group' ? item.lines : [])).filter((line) => line.slot === slot)
        for (const line of lines) {
          const key = `${kind}/${slot}/${way}/${lines.indexOf(line)}`
          if (seen.has(key)) continue
          seen.add(key)
          if (way === 'tall') line.sizeTall = Math.max(1.4, Math.round((line.sizeTall ?? line.size) * 0.8 * 10) / 10)
          else line.size = Math.max(1.4, Math.round(line.size * 0.85 * 10) / 10)
        }
      }
    }
    writeFileSync(file, `${JSON.stringify(template, null, 2)}\n`)
    if (round === 3) console.log(`gave up: ${file}`)
  }
}
