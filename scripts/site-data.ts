// Exports everything the study page (docs/) draws: per-market skill, calibration, what Jev reads, paper equity,
// the regime test, the flipped test, sample decisions, and the audit / follow-up numbers. Writes docs/data/study.json.
//   node scripts/site-data.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { type Analysis, analyze, type Row } from '../src/analysis.ts'
import { config } from '../src/config.ts'
import { market, MARKETS, sideCostBps } from '../src/markets.ts'
import { auc, clusterBootstrap, logistic, mean, pearson, rng, spearman } from '../src/metrics.ts'
import { buildState, questionsFor } from '../src/state.ts'

const IDS = ['eth', 'cbbtc', 'sol', 'virtual']
const r3 = (x: number) => Math.round(x * 1000) / 1000
const r1 = (x: number) => Math.round(x * 10) / 10

const as: Analysis[] = IDS.map((id) => analyze(market(id), 'backtest', 0.05))

/** Long/flat equity per step, sampled every 6 hours: Jev net, Jev gross, buy & hold. */
function equity(a: Analysis) {
  const rows = a.P.rows, side = sideCostBps(a.m)
  const run = (long: (r: Row) => boolean, costs: boolean) => {
    let eq = 1, pos = false
    const out: number[] = []
    const swap = () => costs && (eq *= 1 - side / 1e4)
    rows.forEach((r, k) => {
      if (long(r) !== pos) (swap(), (pos = long(r)))
      if (pos) eq *= 1 + r.ret
      if (rows[k + 1]?.t !== r.t + config.primaryHorizonMin * 60 && pos) (swap(), (pos = false))
      out.push(eq)
    })
    return out
  }
  const jev = run((r) => r.p > 0.5, true), gross = run((r) => r.p > 0.5, false), hold = run(() => true, true)
  const idx = rows.map((r, k) => k).filter((k) => k === rows.length - 1 || Math.floor(rows[k]!.t / 21600) !== Math.floor(rows[k + 1]!.t / 21600))
  return { t: idx.map((k) => rows[k]!.t), jev: idx.map((k) => r3(jev[k]!)), gross: idx.map((k) => r3(gross[k]!)), hold: idx.map((k) => r3(hold[k]!)) }
}

const FEATURES: [string, (s: ReturnType<typeof buildState>) => number][] = [
  ['returnsBps.m1', (s) => s.returnsBps.m1],
  ['returnsBps.m15', (s) => s.returnsBps.m15],
  ['returnsBps.m60', (s) => s.returnsBps.m60],
  ['returnsBps.m240', (s) => s.returnsBps.m240],
  ['flow.m15.buyShare', (s) => s.flow.m15.buyShare],
  ['flow.m60.netUsd', (s) => s.flow.m60.netUsd],
  ['volatilityBps.m60', (s) => s.volatilityBps.m60],
  ['activity.volume15VsAvg4h', (s) => s.activity.volume15VsAvg4h],
]

const markets = as.map((a) => {
  const P = a.P
  const states = P.rows.map((r) => buildState(a.m, a.bars, r.i))
  const cal = [0, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 1.0001]
  return {
    id: a.m.id, symbol: a.m.symbol, venue: a.m.venue, pool: a.m.pool, quote: a.m.quote,
    from: a.ds[0]!.t, to: a.ds.at(-1)!.t, decisions: a.ds.length, emptyShare: r3(a.emptyShare), sideCostBps: sideCostBps(a.m),
    horizons: a.S.map((s) => ({ h: s.h, n: s.n, auc: r3(s.A), lo: r3(s.aLo), hi: r3(s.aHi), mom: r3(s.momAuc), mr: r3(s.mrAuc), coin: r3(s.coinAuc), hit: r3(s.hit), chance: r3(s.chance), bss: r3(s.bssClim), breakEven: r3(Math.min(1, s.breakEven)), absRetBps: r1(s.absRet) })),
    calib: cal.slice(0, -1).map((lo, k) => {
      const rs = P.rows.filter((r) => r.p >= lo && r.p < cal[k + 1]!)
      return { lo, hi: Math.min(1, cal[k + 1]!), n: rs.length, p: rs.length ? r3(mean(rs.map((r) => r.p))) : null, obs: rs.length ? r3(mean(rs.map((r) => Number(r.up)))) : null }
    }),
    features: FEATURES.map(([k, get]) => ({ k, rho: r3(spearman(P.rows.map((r) => r.p), states.map(get))), auc: r3(auc(states.map(get), P.rows.map((r) => r.up))) })),
    equity: equity(a),
    paper15: { jev: r1(P.paper.jev.retPct), gross: r1(P.paper.jevGross.retPct), hold: r1(P.paper.hold.retPct), trades: P.paper.jev.trades },
  }
})

// Pooled over markets, cluster bootstrap by timestamp (markets move together).
const pooledRows = as.flatMap((a) => a.P.rows)
const byT = new Map<number, number[]>()
pooledRows.forEach((r, k) => (byT.get(r.t) ?? byT.set(r.t, []).get(r.t)!).push(k))
const y = pooledRows.map((r) => r.up), pp = pooledRows.map((r) => r.p), mom = pooledRows.map((r) => r.mom)
const [pLo, pHi] = clusterBootstrap([...byT.values()], (idx) => auc(idx.map((k) => pp[k]!), idx.map((k) => y[k]!)), 0.05, 1000)
const pooled = { n: pooledRows.length, auc: r3(auc(pp, y)), lo: r3(pLo), hi: r3(pHi), mom: r3(auc(mom, y)), mr: r3(auc(mom.map((x) => -x), y)) }

// Regime cells: market x 30-day block.
const t0 = Math.min(...pooledRows.map((r) => r.t))
const cells = as.flatMap((a) => {
  const g = new Map<number, Row[]>()
  for (const r of a.P.rows) (g.get(Math.floor((r.t - t0) / (30 * 86400))) ?? g.set(Math.floor((r.t - t0) / (30 * 86400)), []).get(Math.floor((r.t - t0) / (30 * 86400)))!).push(r)
  return [...g].filter(([, rs]) => rs.length >= 300).map(([b, rs]) => ({ m: a.m.symbol, from: t0 + b * 30 * 86400, n: rs.length, jev: r3(auc(rs.map((r) => r.p), rs.map((r) => r.up))), mom: r3(auc(rs.map((r) => r.mom), rs.map((r) => r.up))) }))
})
const regime = { r: r3(pearson(cells.map((c) => c.jev), cells.map((c) => c.mom))), beat: cells.filter((c) => c.jev > c.mom).length, cells }

// Flipped Jev vs free models, out of sample (train first half, test second half), 15m.
const feats = (s: ReturnType<typeof buildState>) => FEATURES.map(([, get]) => get(s))
const flip = as.map((a) => {
  const rows = a.P.rows, mid = rows[0]!.t + (rows.at(-1)!.t - rows[0]!.t) / 2
  const tr = rows.filter((r) => r.t < mid), te = rows.filter((r) => r.t >= mid)
  const X = (rs: Row[]) => rs.map((r) => feats(buildState(a.m, a.bars, r.i)))
  const model = logistic(X(tr), tr.map((r) => Number(r.up)))
  const yte = te.map((r) => r.up)
  return { m: a.m.symbol, n: te.length, flipped: r3(1 - auc(te.map((r) => r.p), yte)), logistic: r3(auc(X(te).map(model), yte)), meanrev: r3(auc(te.map((r) => -r.mom), yte)) }
})

// Sample decisions for the "what Jev sees" panel: seeded, 4 per market, primary horizon outcome attached.
const rand = rng(2026)
const samples = as.flatMap((a) =>
  Array.from({ length: 4 }, () => {
    const r = a.P.rows[Math.floor(rand() * a.P.rows.length)]!
    const d = a.ds.find((x) => x.t === r.t)!
    return { m: a.m.symbol, t: r.t, state: buildState(a.m, a.bars, r.i), p: d.p, up15: r.up, ret15Bps: r1(r.ret * 1e4) }
  }),
)
const question15 = questionsFor(market('eth')).up15

// Flow sign check (computed) and the audit numbers produced by scripts/audit/*.ts and the follow-up reports.
const flowSign = as.map((a) => {
  const net: number[] = [], ret: number[] = []
  for (let i = 1; i < a.bars.length; i++) if (a.bars[i]!.n) (net.push(a.bars[i]!.buyUsd - a.bars[i]!.sellUsd), ret.push(a.bars[i]!.c / a.bars[i - 1]!.c - 1))
  return { m: a.m.symbol, rho: r3(spearman(net, ret)) }
})

const study = {
  generated: new Date().toISOString().slice(0, 10),
  promptEth: as[0]!.version,
  totals: { decisions: as.reduce((s, a) => s + a.ds.length, 0), markets: as.length, days: 90, listUsd: Math.round(as.reduce((s, a) => s + a.spend, 0) * 100) / 100, excluded: MARKETS.filter((m) => !IDS.includes(m.id)).map((m) => m.symbol) },
  markets, pooled, regime, flip, samples, question15,
  audit: {
    positiveControl: { auc: 1.0, n: 200, source: 'scripts/audit/positive.ts' },
    flowSign,
    cex: { auc: 0.453, lo: 0.441, hi: 0.464, cexMomentum: 0.466, poolAuc: 0.465, source: 'scripts/audit/cex.ts' },
    nondeterminism: { maxDelta: 0.04, source: 'scripts/drift.ts' },
  },
  followups: {
    arb: { limitless: 1140, polymarket: 58528, judged: 2735, matched: 78, identicalRules: 640, gapMedianCents: 0.1, gapP90Cents: 0.9, pairCostMedian: 1.012, opportunities: 1, bestEdgePct: 0.9, bestDays: 249, source: 'arb/ARB.md' },
    lp: [
      { m: 'ETH', fee: 5.0, markout: -4.56, net: 0.44, netLp: -0.81 },
      { m: 'cbBTC', fee: 0.89, markout: -1.1, net: -0.22, netLp: -0.39 },
      { m: 'SOL', fee: 3.5, markout: -4.07, net: -0.56, netLp: 0.37 },
      { m: 'VIRTUAL', fee: 1.29, markout: -3.01, net: -1.72, netLp: -1.13 },
    ],
    cexdex: [
      { m: 'ETH', volumeUsd: 30483622, grossUsd: 3524, vipUsd: 2250, retailUsd: 304, top1: 0.676, top3: 0.806, top10: 0.975, gapMedianS: 2, gapP90S: 4 },
      { m: 'SOL', volumeUsd: 7471733, grossUsd: 1038, vipUsd: 650, retailUsd: 69, top1: 0.476, top3: 0.904, top10: 0.991, gapMedianS: 2, gapP90S: 4 },
    ],
  },
}

mkdirSync(new URL('../docs/data/', import.meta.url).pathname, { recursive: true })
const out = new URL('../docs/data/study.json', import.meta.url).pathname
writeFileSync(out, JSON.stringify(study))
console.log(`→ docs/data/study.json  ${(JSON.stringify(study).length / 1024).toFixed(0)} KB  pooled AUC ${pooled.auc} [${pooled.lo}, ${pooled.hi}]  regime r ${regime.r}`)
