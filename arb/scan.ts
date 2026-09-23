// Read-only cross-venue scan: Limitless (Base) vs Polymarket. Finds the same binary outcome listed on both,
// has Jev judge the semantic match and the settlement rules, then prices a two-leg hedge in both order books.
// No account, no orders. Writes arb/data/scan-<ts>.json, arb/data/pairs-<ts>.csv and arb/reports/scan-<ts>.md.
//   node arb/scan.ts [--k 3] [--min-score 0.3] [--p 0.8]
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { evaluate } from '../src/jev.ts'
import { arbitrage, candidates, PAIR_QUESTIONS, pairState } from './match.ts'
import { book, limitless, polymarket, type Book, type Prop } from './venues.ts'

const { values } = parseArgs({ options: { k: { type: 'string', default: '3' }, 'min-score': { type: 'string', default: '0.3' }, p: { type: 'string', default: '0.8' } } })
const K = Number(values.k), MIN = Number(values['min-score']), P = Number(values.p)
const DIR = new URL('./', import.meta.url).pathname
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
mkdirSync(`${DIR}data`, { recursive: true })
mkdirSync(`${DIR}reports`, { recursive: true })

async function pool<T, R>(items: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await f(items[i]!)
    }
  }))
  return out
}

const t0 = Date.now()
const [lm, pm] = await Promise.all([limitless(), polymarket()])
writeFileSync(`${DIR}data/markets-${stamp}.json`, JSON.stringify({ limitless: lm, polymarket: pm }))
console.log(`markets: limitless ${lm.length} binary, polymarket ${pm.length} binary  (${((Date.now() - t0) / 1000).toFixed(0)}s)`)

const pairs = candidates(lm, pm, K, MIN)
console.log(`candidate pairs: ${pairs.length} (top ${K}, cosine >= ${MIN}, close dates) for ${new Set(pairs.map((x) => x.a.id)).size} limitless markets`)

let spent = 0
const judged = await pool(pairs, 6, async ({ a, b, score }) => {
  try {
    const r = await evaluate(pairState(a, b), PAIR_QUESTIONS)
    spent += r.costUsd
    const rel = r.answers.relation as any
    return { a, b, score, relation: rel.choice as string, pRel: rel.probabilities[rel.choice] as number, probs: rel.probabilities, rulesAgree: r.answers.rulesAgree!.probability!, err: undefined as string | undefined }
  } catch (e) {
    return { a, b, score, relation: 'error', pRel: 0, probs: {}, rulesAgree: 0, err: (e as Error).message }
  }
})
const byRel = judged.reduce<Record<string, number>>((acc, j) => ((acc[j.relation] = (acc[j.relation] ?? 0) + 1), acc), {})
console.log(`jev: ${judged.length} pairs, $${spent.toFixed(4)} list price  relations ${JSON.stringify(byRel)}`)

const matched = judged.filter((j) => (j.relation === 'same' || j.relation === 'opposite') && j.pRel >= P && j.rulesAgree >= P)
const mid = (bk: Book) => (bk.bids[0] && bk.asks[0] ? (bk.bids[0][0] + bk.asks[0][0]) / 2 : NaN)
const now = Date.now() / 1000
const priced = await pool(matched, 4, async (j) => {
  try {
    const [ba, bb] = await Promise.all([book(j.a), book(j.b)])
    const x = arbitrage(j.a, ba, j.b, bb, j.relation as 'same' | 'opposite')
    const midB = j.relation === 'same' ? mid(bb) : 1 - mid(bb)
    const days = Math.max(1 / 24, (Math.max(j.a.end, j.b.end) - now) / 86400)
    const edge = x.spend ? x.profit / x.spend : 0
    return { ...j, midA: mid(ba), midB, gap: mid(ba) - midB, ...x, days, edge, apr: (edge * 365) / days, bookErr: undefined as string | undefined }
  } catch (e) {
    return { ...j, midA: NaN, midB: NaN, gap: NaN, legs: '', topCost: NaN, shares: 0, spend: 0, profit: 0, days: NaN, edge: 0, apr: 0, bookErr: (e as Error).message }
  }
})

writeFileSync(`${DIR}data/scan-${stamp}.json`, JSON.stringify({ judged: judged.map(({ a, b, ...r }) => ({ a: a.id, b: b.id, ...r })), priced: priced.map(({ a, b, ...r }) => ({ a: a.id, b: b.id, ...r })) }, null, 1))
const csvCell = (s: unknown) => `"${String(s).replace(/"/g, '""')}"`
writeFileSync(
  `${DIR}data/pairs-${stamp}.csv`,
  ['limitless,polymarket,cosine,relation,p_relation,rules_agree,label_correct']
    .concat(judged.filter((j) => j.relation === 'same' || j.relation === 'opposite').map((j) => [j.a.title + ' → ' + j.a.yes, j.b.title + ' → ' + j.b.yes, j.score.toFixed(2), j.relation, j.pRel.toFixed(2), j.rulesAgree.toFixed(2), ''].map(csvCell).join(',')))
    .join('\n'),
)

const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '--')
const opps = priced.filter((x) => x.profit > 0).sort((x, y) => y.profit - x.profit)
const md = `# Scan Limitless × Polymarket, ${new Date().toISOString().slice(0, 16)} UTC

Somente leitura. ${lm.length} mercados binários na Limitless, ${pm.length} no Polymarket. ${pairs.length} pares candidatos
(TF-IDF top ${K}, cosseno ≥ ${MIN}, fechamento próximo). Jev: ${judged.length} julgamentos, $${spent.toFixed(4)} a preço de tabela.
Relações: ${Object.entries(byRel).map(([k, v]) => `${k} ${v}`).join(', ')}. Casados (relação e regras com P ≥ ${P}): **${matched.length}**.
Oportunidades executáveis agora (lucro > 0 após fees nos dois books): **${opps.length}**.

## Pares casados

| Limitless (YES paga) | Polymarket (YES paga) | relação | P | regras | mid L | mid P (mapeado) | gap | custo topo | pernas |
|---|---|---|---|---|---|---|---|---|---|
${priced.sort((x, y) => Math.abs(y.gap || 0) - Math.abs(x.gap || 0)).map((x) => `| [${x.a.title} → ${x.a.yes}](${x.a.url}) | [${x.b.title} → ${x.b.yes}](${x.b.url}) | ${x.relation} | ${f(x.pRel, 2)} | ${f(x.rulesAgree, 2)} | ${f(x.midA)} | ${f(x.midB)} | ${f(x.gap)} | ${f(x.topCost)} | ${x.legs || x.bookErr || ''} |`).join('\n')}

## Oportunidades (custo do par < $1 após fees)

| par | pernas | shares | gasto | lucro | edge | dias | APR |
|---|---|---|---|---|---|---|---|
${opps.map((x) => `| ${x.a.title} ↔ ${x.b.title} | ${x.legs} | ${f(x.shares, 0)} | $${f(x.spend, 2)} | $${f(x.profit, 2)} | ${f(x.edge * 100, 1)}% | ${f(x.days, 1)} | ${f(x.apr * 100, 0)}% |`).join('\n') || '| nenhuma | | | | | | | |'}

- Fee assumida por perna: taxa × min(p, 1−p). Polymarket usa o \`feeSchedule.rate\` de cada mercado; Limitless 3% (UNKNOWN).
- "custo topo" = soma dos melhores preços das duas pernas, antes das fees. Abaixo de 1 = arbitragem bruta no topo do book.
- Rótulos para medir a precisão do Jev: \`arb/data/pairs-${stamp}.csv\`.
`
writeFileSync(`${DIR}reports/scan-${stamp}.md`, md)
console.log(`matched ${matched.length}, opportunities ${opps.length}  → arb/reports/scan-${stamp}.md  (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
