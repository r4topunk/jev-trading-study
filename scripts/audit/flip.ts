// Is inverted Jev an edge? Train on the first 45 days, test on the last 45, 15m non-overlapping rows.
// Compare: flipped Jev, free mean-reversion (−past 15m return), and a logistic regression on the same state features.
//   node scripts/audit/flip.ts   (no Jev calls: reuses logged decisions)
import { analyze } from '../../src/analysis.ts'
import { MARKETS, sideCostBps } from '../../src/markets.ts'
import { auc, logistic, longFlat, mean } from '../../src/metrics.ts'
import { buildState } from '../../src/state.ts'

const ids = ['eth', 'cbbtc', 'sol', 'virtual']
const feats = (s: ReturnType<typeof buildState>) => [s.returnsBps.m1, s.returnsBps.m5, s.returnsBps.m15, s.returnsBps.m60, s.returnsBps.m240, s.flow.m15.buyShare, s.flow.m60.netUsd, s.volatilityBps.m60, s.activity.volume15VsAvg4h]


console.log('market   | TEST half (last 45d)   flipped-Jev AUC | mean-rev AUC | logistic(free) AUC || contrarian paper net (τ from train) vs hold')
for (const id of ids) {
  const m = MARKETS.find((x) => x.id === id)!
  const a = analyze(m, 'backtest')
  const rows = a.P.rows, mid = rows[0]!.t + (rows.at(-1)!.t - rows[0]!.t) / 2
  const tr = rows.filter((r) => r.t < mid), te = rows.filter((r) => r.t >= mid)
  const X = (rs: typeof rows) => rs.map((r) => feats(buildState(m, a.bars, r.i)))
  const model = logistic(X(tr), tr.map((r) => Number(r.up)))
  const yte = te.map((r) => r.up)
  const lr = X(te).map(model)
  // contrarian: long when Jev P(up) < τ; pick τ on the train half by net P&L
  const side = sideCostBps(m)
  const sim = (rs: typeof rows, tau: number) => longFlat(rs.map((r, k) => ({ ret: r.ret, long: r.p < tau, contiguous: rs[k + 1]?.t === r.t + 900 })), side)
  const taus = [0.3, 0.35, 0.4, 0.45, 0.5]
  const best = taus.map((t) => ({ t, r: sim(tr, t).retPct })).sort((x, y) => y.r - x.r)[0]!
  const test = sim(te, best.t), hold = longFlat(te.map((r, k) => ({ ret: r.ret, long: true, contiguous: te[k + 1]?.t === r.t + 900 })), side)
  console.log(`${id.padEnd(8)} | n=${te.length}  ${(1 - auc(te.map((r) => r.p), yte)).toFixed(3)}           | ${auc(te.map((r) => -r.mom), yte).toFixed(3)}        | ${auc(lr, yte).toFixed(3)}              || τ=${best.t}: ${test.retPct.toFixed(1)}% (${test.trades} swaps) vs hold ${hold.retPct.toFixed(1)}%`)
}
