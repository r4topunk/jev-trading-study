// Phase 0b: every market side by side, the pooled test and the "Jev ≈ momentum" regime test, with the
// pre-registered rules from EXPERIMENT.md. Writes reports/markets.md.
//   node scripts/compare.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { type Analysis, analyze, f, pct, type Row, verdictOf } from '../src/analysis.ts'
import { iso } from '../src/bars.ts'
import { config } from '../src/config.ts'
import { MARKETS } from '../src/markets.ts'
import { auc, clusterBootstrap, mean, pearson, spearman } from '../src/metrics.ts'
import { buildState } from '../src/state.ts'

const alpha = 0.05 / MARKETS.length // Bonferroni over the pre-registered markets
const BLOCK_S = 30 * 86400
const MIN_CELL = 300

const as: Analysis[] = []
for (const m of MARKETS) {
  try {
    as.push(analyze(m, alpha))
  } catch (e) {
    console.log(`skip ${m.id}: ${(e as Error).message}`)
  }
}
const included = as.filter((a) => a.emptyShare <= config.maxEmptyMinuteShare)

// Per market
const marketRows = as.map((a) => {
  const P = a.P, v = verdictOf(a)
  const flow60 = P.rows.map((r) => buildState(a.m, a.bars, r.i).flow.m60.netUsd)
  const p = P.rows.map((r) => r.p)
  const pj = P.paper.jev.retPct, ph = P.paper.hold.retPct
  return `| ${a.m.symbol} | ${P.n} | ${pct(a.emptyShare)} | ${f(P.A)} [${f(P.aLo)}, ${f(P.aHi)}] | ${f(P.momAuc)} | ${f(P.mrAuc)} | ${f(P.bssClim)} | ${f(spearman(p, P.rows.map((r) => r.mom)), 2)} | ${f(spearman(p, flow60), 2)} | ${pj >= 0 ? '+' : ''}${pj.toFixed(1)}% / ${ph >= 0 ? '+' : ''}${ph.toFixed(1)}% | **${v.label}** | $${a.spend.toFixed(2)} |`
})

// Pooled over included markets, resampling whole timestamps: markets move together at the same t.
const pooled: (Row & { id: string })[] = included.flatMap((a) => a.P.rows.map((r) => ({ ...r, id: a.m.id })))
const byT = new Map<number, number[]>()
pooled.forEach((r, k) => (byT.get(r.t) ?? byT.set(r.t, []).get(r.t)!).push(k))
const y = pooled.map((r) => r.up), pp = pooled.map((r) => r.p), mom = pooled.map((r) => r.mom)
const pA = auc(pp, y), pMom = auc(mom, y), pMr = auc(mom.map((x) => -x), y)
const [pLo, pHi] = clusterBootstrap([...byT.values()], (idx) => auc(idx.map((k) => pp[k]!), idx.map((k) => y[k]!)), 0.05, 1000)
const pooledPass = pLo > 0.5 && pA > Math.max(pMom, pMr)
const pooledVerdict = pooledPass
  ? `**PASSA**: AUC agregada ${f(pA)} [${f(pLo)}, ${f(pHi)}], acima de momentum ${f(pMom)} e mean-reversion ${f(pMr)}.`
  : pHi < 0.5
    ? `**FALHA (invertido)**: AUC agregada ${f(pA)} [${f(pLo)}, ${f(pHi)}] abaixo de 0.5 (momentum ${f(pMom)}, mean-reversion ${f(pMr)}).`
    : `**FALHA**: AUC agregada ${f(pA)} [${f(pLo)}, ${f(pHi)}]${pLo <= 0.5 ? ' contém 0.5' : ''}${pA <= Math.max(pMom, pMr) ? `; não supera o melhor baseline grátis (${f(Math.max(pMom, pMr))})` : ''}.`

// Regime cells: market x 30-day block
const t0 = Math.min(...pooled.map((r) => r.t))
const cells: { id: string; block: number; n: number; jev: number; mom: number; up: number }[] = []
for (const a of included) {
  const groups = new Map<number, Row[]>()
  for (const r of a.P.rows) {
    const b = Math.floor((r.t - t0) / BLOCK_S)
    ;(groups.get(b) ?? groups.set(b, []).get(b)!).push(r)
  }
  for (const [block, rs] of groups) {
    if (rs.length < MIN_CELL) continue
    const yy = rs.map((r) => r.up)
    cells.push({ id: a.m.symbol, block, n: rs.length, jev: auc(rs.map((r) => r.p), yy), mom: auc(rs.map((r) => r.mom), yy), up: mean(yy.map(Number)) })
  }
}
const r = pearson(cells.map((c) => c.jev), cells.map((c) => c.mom))
const blockLabel = (b: number) => `${iso(t0 + b * BLOCK_S).slice(0, 10)} +30d`
const beatMom = cells.filter((c) => c.jev > c.mom).length
const spend = as.reduce((s, a) => s + a.spend, 0)

const md = `# Jev na Base: comparação entre mercados

Gerado ${new Date().toISOString().slice(0, 16)} UTC. ${as.length} mercados, ${included.length} dentro da regra de qualidade de dado.
Horizonte ${config.primaryHorizonMin}m, amostras sem sobreposição. IC por mercado a ${f((1 - alpha) * 100, 2)}% (Bonferroni, ${MARKETS.length} mercados).
Gasto Jev total $${spend.toFixed(2)}.

## Por mercado

| mercado | n | sem swap | AUC Jev [IC] | momentum | mean-rev | BSS | ρ(P, retorno 15m) | ρ(P, fluxo 60m) | paper Jev / hold | veredito | gasto |
|---|---|---|---|---|---|---|---|---|---|---|---|
${marketRows.join('\n')}

ρ = Spearman entre P(alta) do Jev e a feature: perto de 1 = o Jev segue a tendência / o fluxo.

## Agregado (${pooled.length} linhas, ${byT.size} timestamps)

${pooledVerdict}

IC 95% por bootstrap em cluster por timestamp.

## O "skill" do Jev é o do momentum? (mercado × bloco de 30 dias, n ≥ ${MIN_CELL})

Pearson entre a AUC do Jev e a AUC do momentum nas ${cells.length} células: **r = ${f(r, 2)}**
(${r > 0.5 ? 'acima de 0.5: o Jev acompanha o momentum de regime em regime' : 'abaixo de 0.5: o Jev não se explica só pelo momentum'}).
O Jev bateu o momentum em ${beatMom} de ${cells.length} células.

| mercado | bloco | n | alta% | AUC Jev | AUC momentum | Jev − momentum |
|---|---|---|---|---|---|---|
${cells.sort((a, b) => a.id.localeCompare(b.id) || a.block - b.block).map((c) => `| ${c.id} | ${blockLabel(c.block)} | ${c.n} | ${pct(c.up)} | ${f(c.jev)} | ${f(c.mom)} | ${c.jev - c.mom >= 0 ? '+' : ''}${f(c.jev - c.mom)} |`).join('\n')}

Relatório completo de cada mercado: \`reports/<mercado>-backtest.md\`.
`

mkdirSync(config.reportsDir, { recursive: true })
writeFileSync(`${config.reportsDir}markets.md`, md)
console.log(md)
console.log('→ reports/markets.md')
