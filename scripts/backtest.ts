// Replays history through Jev, one request per decision time (never batch timestamps: a neighbour's window
// would leak the future). Resumable and cached; stops at the budget.
//   node scripts/backtest.ts --market eth --days 90 --every 15 --max-usd 0.7
import { parseArgs } from 'node:util'
import { iso, loadBars } from '../src/bars.ts'
import { config } from '../src/config.ts'
import { appendDecision, decide, isDecisionBar, loadDecisions } from '../src/decisions.ts'
import { market } from '../src/markets.ts'
import { buildState, questionsFor } from '../src/state.ts'

const { values } = parseArgs({
  options: {
    market: { type: 'string', default: 'eth' },
    days: { type: 'string' },
    every: { type: 'string', default: String(config.decisionEveryMin) },
    limit: { type: 'string' },
    'max-usd': { type: 'string', default: '1' },
  },
})
const m = market(values.market!)
const maxUsd = Number(values['max-usd'])
const every = Number(values.every)

const bars = loadBars(m)
if (!bars.length) throw new Error(`${m.id}: no bars, run backfill first`)
const prior = loadDecisions(m, 'backtest').filter((d) => !d.err)
const done = new Set(prior.map((d) => d.t))
const paid = prior.filter((d) => !d.cached && d.costUsd)
const since = values.days ? bars.at(-1)!.t - Number(values.days) * 86400 : -Infinity

let todo: number[] = []
for (let i = config.lookbackMin; i < bars.length; i++) {
  if (isDecisionBar(bars, i, every) && bars[i]!.t >= since && !done.has(bars[i]!.t + 60)) todo.push(i)
}
if (values.limit) todo = todo.slice(0, Number(values.limit))

// Measured cost per call once there is one; before that ~2.5 chars/token (numbers tokenize worse than prose).
const perCall = paid.length
  ? paid.reduce((a, d) => a + d.costUsd, 0) / paid.length
  : (JSON.stringify({ state: buildState(m, bars, todo[0] ?? config.lookbackMin), questions: questionsFor(m) }).length / 2.5) * 0.042e-6
console.log(`backtest ${m.id}: ${todo.length} decisions every ${every} min (${done.size} done)  est $${(perCall * todo.length).toFixed(3)}  budget $${maxUsd}`)
if (!todo.length) process.exit(0)
console.log(`  ${iso(bars[todo[0]!]!.t + 60)} .. ${iso(bars[todo.at(-1)!]!.t + 60)} UTC`)

let spent = 0, ok = 0, errs = 0, next = 0
const t0 = Date.now()
async function worker() {
  while (next < todo.length && spent < maxUsd) {
    const d = await decide(m, bars, todo[next++]!, 'backtest')
    appendDecision(m, d)
    spent += d.costUsd
    d.err ? errs++ : ok++
    if (d.err && errs <= 5) console.log(`  err ${iso(d.t)}: ${d.err}`)
    if ((ok + errs) % 500 === 0) {
      const rate = (ok + errs) / ((Date.now() - t0) / 1000)
      console.log(`  ${ok + errs}/${todo.length}  $${spent.toFixed(4)}  ${rate.toFixed(1)}/s  eta ${((todo.length - ok - errs) / rate).toFixed(0)}s`)
    }
  }
}
await Promise.all(Array.from({ length: config.jev.concurrency }, worker))
console.log(`done ${m.id}: ${ok} ok, ${errs} errors, $${spent.toFixed(4)}${spent >= maxUsd ? '  (budget reached, rerun to continue)' : ''}`)
