import type { Bar } from './base.ts'
import { loadBars } from './bars.ts'
import { config } from './config.ts'
import { type Decision, loadDecisions } from './decisions.ts'
import { sha } from './jev.ts'
import { type Market, sideCostBps } from './markets.ts'
import { auc, bootstrap, brier, logloss, longFlat, mean, normalSf, quantile, rng, sd, spearman } from './metrics.ts'
import { buildState, promptVersion } from './state.ts'

export type Row = { t: number; i: number; p: number; up: boolean; ret: number; mom: number; coin: number }

/** Non-overlapping sample for horizon h: each kept decision is at least h minutes after the previous one. */
function rowsFor(bars: Bar[], at: Map<number, number>, ds: Decision[], h: number): Row[] {
  const out: Row[] = []
  let lastT = -Infinity
  for (const d of ds) {
    if (d.t < lastT + h * 60) continue
    const i = at.get(d.t - 60)
    if (i === undefined || i < h || i + h >= bars.length || typeof d.p[h] !== 'number') continue
    const px0 = bars[i]!.c, px1 = bars[i + h]!.c
    out.push({ t: d.t, i, p: d.p[h]!, up: px1 > px0, ret: px1 / px0 - 1, mom: px0 / bars[i - h]!.c - 1, coin: rng(d.t ^ (h * 7919))() })
    lastT = d.t
  }
  return out
}

function score(m: Market, bars: Bar[], at: Map<number, number>, ds: Decision[], h: number, alpha: number) {
  const rows = rowsFor(bars, at, ds, h)
  const n = rows.length
  const p = rows.map((r) => r.p), y = rows.map((r) => r.up)
  const u = mean(y.map(Number))
  const decided = rows.filter((r) => r.p !== 0.5)
  const nd = decided.length
  const hit = mean(decided.map((r) => Number(r.p > 0.5 === r.up)))
  const q = mean(decided.map((r) => Number(r.p > 0.5)))
  const ud = mean(decided.map((r) => Number(r.up)))
  const chance = q * ud + (1 - q) * (1 - ud) // hit rate of a guesser with the same up/down mix, but no information
  const A = auc(p, y)
  const B0 = h === config.primaryHorizonMin ? 2000 : 500 // exploratory horizons get a cheaper interval
  const [aLo, aHi] = bootstrap(n, (idx) => auc(idx.map((k) => p[k]!), idx.map((k) => y[k]!)), alpha, B0)
  const B = brier(p, y)
  const edge = rows.map((r) => Math.sign(r.p - 0.5) * r.ret * 1e4)
  const absRet = mean(rows.map((r) => Math.abs(r.ret) * 1e4))
  const conf = rows.filter((r) => Math.abs(r.p - 0.5) >= 0.1)
  const side = sideCostBps(m)
  const steps = (long: (r: Row) => boolean) => rows.map((r, k) => ({ ret: r.ret, long: long(r), contiguous: rows[k + 1]?.t === r.t + h * 60 }))
  return {
    h, n, u, nd, hit, chance, A, aLo, aHi,
    /** Share of steps followed directly by the next one; below ~95% the long/flat book is mostly forced closes. */
    contiguity: mean(rows.map((r, k) => Number(rows[k + 1]?.t === r.t + h * 60))),
    pval: normalSf((hit - chance) / Math.sqrt((chance * (1 - chance)) / nd)),
    momAuc: auc(rows.map((r) => r.mom), y),
    mrAuc: auc(rows.map((r) => -r.mom), y),
    coinAuc: auc(rows.map((r) => r.coin), y),
    bssClim: 1 - B / (u * (1 - u)),
    ll: logloss(p, y), llClim: -(u * Math.log(u) + (1 - u) * Math.log(1 - u)),
    ic: spearman(p, rows.map((r) => r.ret)),
    edge: mean(edge), edgeSe: sd(edge) / Math.sqrt(n),
    absRet, breakEven: 0.5 + (2 * side) / (2 * absRet),
    pq: [quantile(p, 0.1), quantile(p, 0.5), quantile(p, 0.9)], undecided: mean(p.map((x) => Number(Math.abs(x - 0.5) < 0.05))),
    confN: conf.length, confHit: mean(conf.map((r) => Number(r.p > 0.5 === r.up))),
    paper: {
      jev: longFlat(steps((r) => r.p > 0.5), side),
      jevGross: longFlat(steps((r) => r.p > 0.5), side, false),
      mom: longFlat(steps((r) => r.mom > 0), side),
      mr: longFlat(steps((r) => r.mom < 0), side),
      coin: longFlat(steps((r) => r.coin > 0.5), side),
      hold: longFlat(steps(() => true), side),
    },
    rows,
  }
}

/** Everything a report needs for one market. `alpha` sets the AUC interval (Bonferroni across markets). */
export function analyze(m: Market, alpha = 0.05) {
  const bars = loadBars(m)
  const at = new Map(bars.map((b, i) => [b.t, i]))
  const all = loadDecisions(m)
  const version = promptVersion(m)
  const ds = all.filter((d) => !d.err && d.prompt === version && at.has(d.t - 60))
  if (!ds.length) throw new Error(`${m.id}: no decisions for prompt ${version}`)

  // Parity: rebuilding each state from the final bars must give the hash that was sent to Jev.
  let parityBad = 0, parityN = 0
  for (const d of ds) {
    const i = at.get(d.t - 60)!
    if (i < config.lookbackMin) continue
    parityN++
    if (sha(buildState(m, bars, i)) !== d.stateHash) parityBad++
  }
  const gaps = ds.slice(1).map((d, k) => (d.t - ds[k]!.t) / 60)
  const S = config.horizonsMin.map((h) => score(m, bars, at, ds, h, alpha))
  const lat = ds.filter((d) => !d.cached && d.latencyMs).map((d) => d.latencyMs)
  const span = bars.filter((b) => b.t >= ds[0]!.t - config.lookbackMin * 60 && b.t <= ds.at(-1)!.t)
  return {
    m, bars, ds, version, alpha,
    errors: all.filter((d) => d.err).length,
    otherPrompts: all.filter((d) => !d.err && d.prompt !== version).length,
    parityN, parityBad,
    cadenceMin: gaps.length ? quantile(gaps, 0.5) : config.decisionEveryMin,
    emptyShare: mean(span.map((b) => Number(b.n === 0))),
    spend: ds.reduce((a, d) => a + d.costUsd, 0),
    lat, S,
    P: S.find((s) => s.h === config.primaryHorizonMin)!,
  }
}

export type Analysis = ReturnType<typeof analyze>

export const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '--')
export const pct = (x: number) => `${(x * 100).toFixed(1)}%`

/** The pre-registered rule, applied to the primary horizon. */
export function verdictOf(a: Analysis): { label: string; text: string } {
  const P = a.P
  const ci = `AUC ${f(P.A)} [${f(P.aLo)}, ${f(P.aHi)}]`
  const best = Math.max(P.momAuc, P.mrAuc)
  if (a.emptyShare > config.maxEmptyMinuteShare) return { label: 'EXCLUÍDO', text: `${pct(a.emptyShare)} dos minutos sem swap (máximo ${pct(config.maxEmptyMinuteShare)}).` }
  if (P.n < 500) return { label: 'INCONCLUSIVO', text: `só ${P.n} amostras independentes em ${P.h}m (mínimo 500).` }
  if (P.aLo > 0.5 && P.A > best && P.bssClim > 0)
    return { label: 'PASSA', text: `${ci} acima de 0.5, acima de momentum (${f(P.momAuc)}) e mean-reversion (${f(P.mrAuc)}), BSS ${f(P.bssClim)}.` }
  if (P.aHi < 0.5) return { label: 'FALHA (invertido)', text: `${ci} abaixo de 0.5. Invertido daria ${f(1 - P.A)}; mean-reversion grátis ${f(P.mrAuc)}.` }
  const why = [`${ci} contém 0.5`]
  if (P.A <= best) why.push(`não supera o melhor baseline grátis (${f(best)})`)
  if (P.bssClim <= 0) why.push(`Brier pior que a climatologia (BSS ${f(P.bssClim)})`)
  return { label: 'FALHA', text: `sem evidência de skill: ${why.join('; ')}.` }
}
