// Sign check: taker net flow must move the same-minute price the same way. No Jev calls.
//   node scripts/audit/flow.ts
import { loadBars } from '../../src/bars.ts'
import { market } from '../../src/markets.ts'
import { pearson, spearman } from '../../src/metrics.ts'
for (const id of ['eth', 'cbbtc', 'sol', 'virtual']) {
  const b = loadBars(market(id))
  const net: number[] = [], ret: number[] = []
  for (let i = 1; i < b.length; i++) { if (!b[i]!.n) continue; net.push(b[i]!.buyUsd - b[i]!.sellUsd); ret.push((b[i]!.c / b[i - 1]!.c - 1) * 1e4) }
  console.log(`${id.padEnd(8)} same-minute Spearman(net taker flow, return) = ${spearman(net, ret).toFixed(3)}  (must be clearly > 0)  n=${net.length}`)
}
