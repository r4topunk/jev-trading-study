// Who earns the CEX-DEX gap on Base, how much, and how fast. Taker P&L of every swap against the Binance price
// just before its block (pool fee included), who sent the profitable ones, and how long a gap stays open.
// Reads the swaps and 1 s klines cached by lp-markout.ts; fetches sender/recipient for one day. No Jev.
//   node scripts/cexdex.ts [--day 2026-09-21]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { blockAt, clock, getSwapLogs } from '../src/base.ts'
import { config } from '../src/config.ts'
import { market } from '../src/markets.ts'
import { quantile } from '../src/metrics.ts'

const { values } = parseArgs({ options: { day: { type: 'string', default: '2026-09-21' } } })
const day = values.day!
const t0 = Date.parse(`${day}T00:00:00Z`) / 1000
const MARKETS = [
  { m: market('eth'), cex: 'ETHUSDT', dec: [18, 6] },
  { m: market('sol'), cex: 'SOLUSDT', dec: [9, 6] },
]
// Hedge fee on the CEX per side, bps: a top VIP / market-maker tier vs a retail account (Binance spot 7.5 with BNB).
const HEDGE = { vip: 1, retail: 7.5 }

const lines = (f: string) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const closes = (sym: string) => new Map<number, number>(lines(`${config.dataDir}cex/${sym}-1s-${day}.jsonl`).map((k: number[]) => [k[0]!, k[4]!]))
const usdc = closes('USDCUSDT')
const at = (s: Map<number, number>, t: number) => {
  for (let k = 0; k < 10; k++) if (s.has(t - k)) return s.get(t - k)!
  return undefined
}

const clk = await clock()
const out: string[] = []
const f = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '--')
const usd = (x: number) => `$${Math.round(x).toLocaleString('en-US')}`

for (const { m, cex, dec } of MARKETS) {
  const swaps = lines(`${config.dataDir}${m.id}/swaps-${day}.jsonl`)
  const px = closes(cex)
  // sender/recipient are indexed topics the cached file does not keep: one extra pass over the day.
  const who = new Map<string, { sender: string; recipient: string }>()
  const whoFile = `${config.dataDir}${m.id}/who-${day}.json`
  if (existsSync(whoFile)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(whoFile, 'utf8')))) who.set(k, v as any)
  else {
    for (let b = blockAt(clk, t0); b < blockAt(clk, t0 + 86400); b += 1980n) {
      const end = b + 1979n < blockAt(clk, t0 + 86400) ? b + 1979n : blockAt(clk, t0 + 86400) - 1n
      for (const l of await getSwapLogs([m.pool], b, end)) who.set(`${l.blockNumber}:${l.logIndex}`, { sender: l.args.sender.toLowerCase(), recipient: l.args.recipient.toLowerCase() })
    }
    writeFileSync(whoFile, JSON.stringify(Object.fromEntries(who)))
  }

  type S = { ts: number; usd: number; pnl: number; pnl5: number; buy: boolean; who: string; mid: number }
  const rows: S[] = []
  for (const s of swaps) {
    const a0 = Number(s.amount0) / 10 ** dec[0]!, a1 = Number(s.amount1) / 10 ** dec[1]!
    if (!a0 || !a1) continue
    const exec = Math.abs(a1 / a0) // USDC per asset, pool fee included
    const c0 = at(px, s.ts - 1), c5 = at(px, s.ts + 5), u = at(usdc, s.ts - 1) ?? 1
    if (!c0 || !c5) continue
    const buy = a0 < 0 // the taker received the asset
    const ref = c0 / u, ref5 = c5 / u
    const pnl = (buy ? ref / exec - 1 : exec / ref - 1) * 1e4
    const pnl5 = (buy ? ref5 / exec - 1 : exec / ref5 - 1) * 1e4
    const w = who.get(`${s.block}:${s.logIndex}`)
    const mid = (Number(BigInt(s.sqrtPriceX96)) / 2 ** 96) ** 2 * 10 ** (dec[0]! - dec[1]!)
    rows.push({ ts: s.ts, usd: Math.abs(a1), pnl, pnl5, buy, who: w?.sender ?? 'unknown', mid })
  }

  const arb = rows.filter((r) => r.pnl > 0)
  const sum = (xs: S[], g: (r: S) => number) => xs.reduce((a, r) => a + g(r), 0)
  const profit = (xs: S[], hedgeBps: number) => sum(xs, (r) => (r.usd * Math.max(0, r.pnl - hedgeBps)) / 1e4)
  const gross = profit(arb, 0), vip = profit(arb, HEDGE.vip), retail = profit(arb, HEDGE.retail)
  const bySender = new Map<string, number>()
  for (const r of arb) bySender.set(r.who, (bySender.get(r.who) ?? 0) + (r.usd * r.pnl) / 1e4)
  const top = [...bySender].sort((a, b) => b[1] - a[1])
  const share = (k: number) => top.slice(0, k).reduce((a, [, v]) => a + v, 0) / gross

  // Gap duration: pool mid carried forward second by second against the CEX; when |gap| exceeds fee + 1 bp (worth
  // arbitraging), how many seconds until it is back inside that band. Arbitrage only pays up to the band edge.
  const byTs = new Map<number, number>()
  for (const r of rows) byTs.set(r.ts, r.mid)
  let mid = rows[0]!.mid, open = -1
  const durations: number[] = []
  const thr = m.feeBps + 1
  for (let t = t0; t < t0 + 86400; t++) {
    if (byTs.has(t)) mid = byTs.get(t)!
    const c = at(px, t), u = at(usdc, t) ?? 1
    if (!c) continue
    const gap = Math.abs(mid / (c / u) - 1) * 1e4
    if (open < 0 && gap > thr) open = t
    else if (open >= 0 && gap <= thr) (durations.push(t - open), (open = -1))
  }

  out.push(`## ${m.symbol} (${m.venue}, fee ${m.feeBps} bps), ${day}

| | Valor |
|---|---|
| Swaps no dia / volume | ${rows.length.toLocaleString('en-US')} / ${usd(sum(rows, (r) => r.usd))} |
| Swaps com lucro contra a Binance **após a fee do pool** | ${arb.length.toLocaleString('en-US')} (${f((arb.length / rows.length) * 100)}%), volume ${usd(sum(arb, (r) => r.usd))} |
| Lucro desses swaps, antes do hedge e do gás | **${usd(gross)}/dia**, mediana ${f(quantile(arb.map((r) => r.pnl), 0.5), 2)} bps por swap |
| Depois de ${HEDGE.vip} bp de hedge (tier VIP) | ${usd(vip)}/dia |
| Depois de ${HEDGE.retail} bps de hedge (conta varejo) | ${usd(retail)}/dia |
| Os mesmos swaps 5 s depois | ${usd(sum(arb, (r) => (r.usd * r.pnl5) / 1e4))} (quanto do lucro persiste) |
| Remetentes distintos com lucro | ${top.length} |
| Fatia do lucro dos top 1 / 3 / 10 remetentes | ${f(share(1) * 100)}% / ${f(share(3) * 100)}% / ${f(share(10) * 100)}% |
| Gaps acima de ${thr} bps (fee + 1) no dia | ${durations.length}; ficam abertos mediana ${durations.length ? quantile(durations, 0.5) : '--'} s, p90 ${durations.length ? quantile(durations, 0.9) : '--'} s (1 bloco = 2 s) |
`)
}

const md = `# Arbitragem CEX-DEX na Base: quanto é, quem leva, quão rápido

Gerado ${new Date().toISOString().slice(0, 16)} UTC. Preço de referência: Binance, 1 s, no segundo anterior ao bloco,
convertido de USDT para USDC. Lucro por swap = preço executado (fee do pool incluída) contra essa referência.
"Remetente" = \`sender\` do evento Swap (o contrato que chamou o pool: um bot ou um router).

${out.join('\n')}
**Não entra na conta:** o priority fee que os bots pagam ao sequencer para ficar na frente, as transações que
falharam (spam de arbitragem é comum na Base e só aparece como custo), o custo de capital e o inventário nas duas
pontas, e o risco de o hedge na CEX sair pior que o preço de 1 s.
`
writeFileSync(`${config.reportsDir}cexdex.md`, md)
console.log(md)
