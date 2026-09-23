// Scores Jev's decisions on one market against what the price actually did, next to free baselines, and
// applies the pre-registered verdict from EXPERIMENT.md. Writes reports/<market>-<mode>.md.
//   node scripts/report.ts --market eth --mode backtest
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { analyze, f, pct, verdictOf } from '../src/analysis.ts'
import { iso } from '../src/bars.ts'
import { config } from '../src/config.ts'
import type { Mode } from '../src/decisions.ts'
import { market, sideCostBps } from '../src/markets.ts'
import { auc, mean, quantile, spearman } from '../src/metrics.ts'
import { buildState, type State } from '../src/state.ts'

const { values } = parseArgs({ options: { mode: { type: 'string', default: 'backtest' }, market: { type: 'string', default: 'eth' } } })
const m = market(values.market!)
const a = analyze(m, values.mode as Mode)
const { S, P, ds } = a
const v = verdictOf(a)
const money = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}%`

const cal = [0, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 1.0001]
const calRows = cal.slice(0, -1).map((lo, k) => {
  const hi = cal[k + 1]!
  const rs = P.rows.filter((r) => r.p >= lo && r.p < hi)
  return `| ${lo.toFixed(2)}–${Math.min(1, hi).toFixed(2)} | ${rs.length} | ${f(mean(rs.map((r) => r.p)), 2)} | ${rs.length ? pct(mean(rs.map((r) => Number(r.up)))) : '--'} |`
})

// Which inputs does Jev follow? A high |Spearman| with P(up) means it leans on that feature; if the feature on
// its own has AUC < 0.5 in the period, following it loses.
const FEATURES: [string, (s: State) => number][] = [
  ['returnsBps.m1', (s) => s.returnsBps.m1],
  ['returnsBps.m15', (s) => s.returnsBps.m15],
  ['returnsBps.m60', (s) => s.returnsBps.m60],
  ['returnsBps.m240', (s) => s.returnsBps.m240],
  ['flow.m15.buyShare', (s) => s.flow.m15.buyShare],
  ['flow.m60.netUsd', (s) => s.flow.m60.netUsd],
  ['volatilityBps.m60', (s) => s.volatilityBps.m60],
  ['activity.volume15VsAvg4h', (s) => s.activity.volume15VsAvg4h],
]
const pStates = P.rows.map((r) => buildState(m, a.bars, r.i))
const diagRows = FEATURES.map(([k, get]) => {
  const xs = pStates.map(get)
  return `| \`${k}\` | ${f(spearman(P.rows.map((r) => r.p), xs))} | ${f(auc(xs, P.rows.map((r) => r.up)))} |`
})

const side = sideCostBps(m)
const md = `# Jev na Base: ${m.symbol}, ${a.mode}

Gerado ${new Date().toISOString().slice(0, 16)} UTC. Pool ${m.venue} \`${m.pool}\` (${m.quote}). Período ${iso(ds[0]!.t)} .. ${iso(ds.at(-1)!.t)} UTC,
${ds.length} decisões a cada ~${a.cadenceMin} min (${a.errors} erros${a.otherPrompts ? `, ${a.otherPrompts} de outra versão de prompt ignoradas` : ''}). Prompt \`${a.version}\`.
Gasto Jev $${a.spend.toFixed(4)}. Latência p50 ${a.lat.length ? quantile(a.lat, 0.5) : '--'} ms, p95 ${a.lat.length ? quantile(a.lat, 0.95) : '--'} ms${a.lag.length ? `. Lag da decisão p50 ${(quantile(a.lag, 0.5) / 1000).toFixed(1)} s` : ''}.
Paridade de estado ${a.parityN - a.parityBad}/${a.parityN}. Minutos sem swap ${pct(a.emptyShare)}.

## Veredito pré-registrado (horizonte ${P.h}m)

**${v.label}**: ${v.text}

## Skill por horizonte (amostras sem sobreposição)

| h | n | alta% | acerto | acaso | p | AUC [IC ${f((1 - a.alpha) * 100, 1)}%] | momentum | mean-rev | moeda | BSS clim | IC Spearman |
|---|---|---|---|---|---|---|---|---|---|---|---|
${S.map((s) => `| ${s.h}m | ${s.n} | ${pct(s.u)} | ${pct(s.hit)} | ${pct(s.chance)} | ${f(s.pval)} | ${f(s.A)} [${f(s.aLo)}, ${f(s.aHi)}] | ${f(s.momAuc)} | ${f(s.mrAuc)} | ${f(s.coinAuc)} | ${f(s.bssClim)} | ${f(s.ic)} |`).join('\n')}

- **acaso**: acerto de um chute sem informação com o mesmo mix alta/baixa do Jev. **p**: unilateral, acerto > acaso.
- **AUC** é a métrica primária: 0.5 = não discrimina, não depende da taxa de alta do período.
- Horizontes que não são o primário são exploratórios: com ${config.horizonsMin.length} testes, só conta p < ${f(0.05 / config.horizonsMin.length, 4)} (Bonferroni).

## Forma das probabilidades

| h | p10 | p50 | p90 | indecisas (\\|p−0.5\\| < 0.05) | confiantes (\\|p−0.5\\| ≥ 0.1) | acerto nas confiantes | log loss vs clima |
|---|---|---|---|---|---|---|---|
${S.map((s) => `| ${s.h}m | ${f(s.pq[0]!, 2)} | ${f(s.pq[1]!, 2)} | ${f(s.pq[2]!, 2)} | ${pct(s.undecided)} | ${s.confN} | ${s.confN ? pct(s.confHit) : '--'} | ${f(s.ll)} vs ${f(s.llClim)} |`).join('\n')}

## Calibração (${P.h}m)

| faixa de P(alta) | n | P média | alta observada |
|---|---|---|---|
${calRows.join('\n')}

## O que o Jev está lendo (${P.h}m)

| feature do estado | Spearman com P(alta) | AUC da feature sozinha |
|---|---|---|
${diagRows.join('\n')}

|Spearman| alto = o Jev segue essa feature. Se ela sozinha tem AUC < 0.5 no período, segui-la perde.

## Paper trading long/flat na Base

Spot não permite short: comprado em ${m.symbol} quando P(alta) > 0.5, em USDC caso contrário. Cada troca paga ${f(side, 2)} bps
(fee ${m.feeBps} + impacto ${m.slippageBps}${m.quote === 'WETH' ? ' + hop WETH/USDC 6' : ''}) + $${config.gasUsd} de gás. Banca $${config.paperUsd.toLocaleString('en-US')}.

| h | Jev líquido | Jev bruto | trocas | momentum | mean-rev | moeda | buy & hold | acerto p/ empatar | edge bruto L/S por trade |
|---|---|---|---|---|---|---|---|---|---|
${S.map((s) => {
  const tail = `${pct(Math.min(1, s.breakEven))} | ${f(s.edge, 2)} ± ${f(1.96 * s.edgeSe, 2)} bps |`
  if (s.contiguity < 0.95) return `| ${s.h}m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | ${tail}`
  return `| ${s.h}m | ${money(s.paper.jev.retPct)} | ${money(s.paper.jevGross.retPct)} | ${s.paper.jev.trades} | ${money(s.paper.mom.retPct)} | ${money(s.paper.mr.retPct)} | ${money(s.paper.coin.retPct)} | ${money(s.paper.hold.retPct)} | ${tail}`
}).join('\n')}

- **n/a**: menos de 95% dos passos são seguidos diretamente pelo próximo (cadência maior que o horizonte), então não forma carteira contínua.
- **acerto p/ empatar**: acerto necessário para cobrir ${f(2 * side, 1)} bps de ida e volta dado o movimento médio |r| do horizonte.
- O P&L não entra no veredito da fase 0, só a skill entra. O líquido mostra o peso do custo de taker: trocar a cada sinal custa mais que qualquer edge medido aqui.
`

mkdirSync(config.reportsDir, { recursive: true })
writeFileSync(`${config.reportsDir}${m.id}-${a.mode}.md`, md)
console.log(md)
console.log(`→ reports/${m.id}-${a.mode}.md`)
