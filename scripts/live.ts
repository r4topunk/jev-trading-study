// Forward paper run: follows one pool block by block, asks Jev at every decision time, logs to
// data/<market>/decisions-live.jsonl. No orders, no keys. Outcomes and paper P&L come from `report --mode live`.
//   node scripts/live.ts [--market eth]
import { parseArgs } from 'node:util'
import { clock, tsOf } from '../src/base.ts'
import { iso, loadBars, syncMarkets } from '../src/bars.ts'
import { config } from '../src/config.ts'
import { appendDecision, decide, isDecisionBar, loadDecisions } from '../src/decisions.ts'
import { ETH, market } from '../src/markets.ts'

const POLL_MS = 4000
const STALE_S = 60 // a decision time we reach later than this (restart, RPC stall) is skipped, never back-filled

const { values } = parseArgs({ options: { market: { type: 'string', default: 'eth' } } })
const m = market(values.market!)
const sync = m.quote === 'WETH' ? [m, ETH] : [m] // USD conversion needs ETH bars

let bars = loadBars(m)
const decided = new Set(loadDecisions(m, 'live').map((d) => d.t))
let spent = 0
console.log(`live: ${m.symbol} pool ${m.pool}  every ${config.decisionEveryMin} min  horizons ${config.horizonsMin.join('/')} min`)

for (;;) {
  try {
    const clk = await clock()
    const toMin = Math.floor(tsOf(clk, clk.refBlock - 2n) / 60)
    const fromMin = bars.length ? undefined : toMin - config.lookbackMin - 5
    const behind = bars.length ? toMin - bars.at(-1)!.t / 60 : Infinity
    const fresh = await syncMarkets(clk, sync, fromMin, toMin, behind > 120)
    if ([...fresh.values()].some((x) => x.length)) bars = loadBars(m)

    const i = bars.length - 1
    const T = bars[i]!.t + 60
    if (i >= config.lookbackMin && isDecisionBar(bars, i) && !decided.has(T)) {
      decided.add(T)
      const late = Date.now() / 1000 - T
      if (late > STALE_S) {
        console.log(`${iso(T)}  skipped, reached ${late.toFixed(0)}s late`)
      } else {
        const d = await decide(m, bars, i, 'live', { cache: false })
        d.lagMs = Math.round(Date.now() - T * 1000)
        appendDecision(m, d)
        spent += d.costUsd
        const ps = config.horizonsMin.map((h) => `${h}m ${d.p[h]?.toFixed(2) ?? '--'}`).join('  ')
        console.log(`${iso(T)}  px ${d.px.toPrecision(6)}  P(up) ${ps}  lag ${(d.lagMs / 1000).toFixed(1)}s  $${spent.toFixed(4)}${d.err ? `  ERR ${d.err}` : ''}`)
      }
    }
  } catch (e) {
    console.log(`${new Date().toISOString()}  loop error: ${(e as Error).message}`)
  }
  await new Promise((r) => setTimeout(r, POLL_MS))
}
