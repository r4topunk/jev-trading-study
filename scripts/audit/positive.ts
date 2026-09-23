// Positive control: leak the realised 15m move into the state. If labels, joins and AUC are right, AUC → ~1.
//   node scripts/audit/positive.ts   (200 Jev calls)
import { loadBars } from '../../src/bars.ts'
import { evaluate } from '../../src/jev.ts'
import { market } from '../../src/markets.ts'
import { auc } from '../../src/metrics.ts'
import { buildState, questionsFor } from '../../src/state.ts'
const m = market('eth'), bars = loadBars(m)
const q = questionsFor(m).up15 as any
const question = { up15: { ...q, instructions: { ...q.instructions, inputs: q.instructions.inputs + ' `leak.priceChangeNext15mBps` is the realised price change over the next 15 minutes.' } } }
const idx = Array.from({ length: 200 }, (_, k) => 300 + k * 600)
const out: { p: number; up: boolean }[] = []
let next = 0
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < idx.length) {
    const i = idx[next++]!
    const fut = (bars[i + 15]!.c / bars[i]!.c - 1) * 1e4
    const r = await evaluate({ ...buildState(m, bars, i), leak: { priceChangeNext15mBps: Math.round(fut * 10) / 10 } }, question, { cache: false })
    out.push({ p: r.answers.up15!.probability!, up: bars[i + 15]!.c > bars[i]!.c })
  }
}))
console.log(`positive control: n=${out.length}  AUC=${auc(out.map((o) => o.p), out.map((o) => o.up)).toFixed(3)}  (expect ~1.0)`)
