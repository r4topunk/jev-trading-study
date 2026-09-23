// Jev cannot be pinned to a version. This re-asks 10 logged backtest states with the cache off and
// compares: if the model moved, decisions from before and after cannot be pooled.
//   node scripts/drift.ts [--market eth]
import { parseArgs } from 'node:util'
import { loadBars } from '../src/bars.ts'
import { config } from '../src/config.ts'
import { decide, loadDecisions } from '../src/decisions.ts'
import { market } from '../src/markets.ts'
import { promptVersion } from '../src/state.ts'

// Not deterministic on these states: back-to-back calls on one state differ by up to ~0.04 (measured
// 2026-09-23, 4 states x 3 calls). Drift is a mean shift beyond that noise, not a single wobble.
const MEAN_TOL = 0.02
const MAX_TOL = 0.06

const { values } = parseArgs({ options: { market: { type: 'string', default: 'eth' } } })
const m = market(values.market!)
const bars = loadBars(m)
const at = new Map(bars.map((b, i) => [b.t, i]))
const logged = loadDecisions(m, 'backtest').filter((d) => !d.err && d.prompt === promptVersion(m) && at.has(d.t - 60))
if (!logged.length) throw new Error('no backtest decisions to compare against')
const canaries = Array.from({ length: 10 }, (_, k) => logged[Math.floor((k * logged.length) / 10)]!)

const deltas: number[] = []
for (const old of canaries) {
  const now = await decide(m, bars, at.get(old.t - 60)!, 'backtest', { cache: false })
  if (now.err) throw new Error(now.err)
  if (now.stateHash !== old.stateHash) throw new Error(`state changed for ${old.t}: bars were rebuilt`)
  for (const h of config.horizonsMin) deltas.push(Math.abs(now.p[h]! - old.p[h]!))
}
const meanD = deltas.reduce((a, b) => a + b, 0) / deltas.length, maxD = Math.max(...deltas)
const ok = meanD <= MEAN_TOL && maxD <= MAX_TOL
console.log(`drift ${m.id}: |Δp| over ${canaries.length} states × ${config.horizonsMin.length} horizons  mean ${meanD.toFixed(3)} (≤ ${MEAN_TOL})  max ${maxD.toFixed(3)} (≤ ${MAX_TOL})  ${ok ? 'OK' : 'MODEL MOVED'}`)
process.exit(ok ? 0 : 1)
