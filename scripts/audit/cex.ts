// Same Jev decisions (made from Base pool states), outcomes from Binance ETHUSDT 1m closes instead of the pool.
// Is the "inverted" result an artifact of AMM pool prices? No Jev calls.
//   node scripts/audit/cex.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { config } from '../../src/config.ts'
import { loadBars } from '../../src/bars.ts'
import { loadDecisions } from '../../src/decisions.ts'
import { market } from '../../src/markets.ts'
import { auc, bootstrap } from '../../src/metrics.ts'
import { promptVersion } from '../../src/state.ts'
const m = market('eth'), bars = loadBars(m), at = new Map(bars.map((b, i) => [b.t, i]))
const FILE = `${config.dataDir}cex/ETHUSDT-1m.json`
if (!existsSync(FILE)) {
  const out: Record<number, number> = {}
  for (let s = bars[0]!.t * 1000; s < bars.at(-1)!.t * 1000; ) {
    const k = (await (await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=ETHUSDT&interval=1m&startTime=${s}&limit=1000`)).json()) as any[]
    if (!k.length) break
    for (const r of k) out[r[0] / 1000] = Number(r[4])
    s = k.at(-1)[0] + 60_000
  }
  mkdirSync(`${config.dataDir}cex`, { recursive: true })
  writeFileSync(FILE, JSON.stringify(out))
}
const cex: Record<string, number> = JSON.parse(readFileSync(FILE, 'utf8'))
const ds = loadDecisions(m).filter((d) => !d.err && d.prompt === promptVersion(m))
for (const h of [1, 5, 15, 60]) {
  const p: number[] = [], upC: boolean[] = [], upD: boolean[] = [], momC: number[] = [], momD: number[] = []
  let last = -Infinity
  for (const d of ds) {
    if (d.t < last + h * 60) continue
    const i = at.get(d.t - 60); const t = d.t - 60
    const c0 = cex[t], c1 = cex[t + h * 60], cm = cex[t - h * 60]
    if (i === undefined || i + h >= bars.length || !c0 || !c1 || !cm) continue
    p.push(d.p[h]!); upC.push(c1 > c0); upD.push(bars[i + h]!.c > bars[i]!.c)
    momC.push(c0 / cm - 1); momD.push(bars[i]!.c / bars[i - h]!.c - 1); last = d.t
  }
  const ci = bootstrap(p.length, (idx) => auc(idx.map((k) => p[k]!), idx.map((k) => upC[k]!)), 0.05, 1000)
  console.log(`${String(h).padStart(2)}m n=${p.length}  Jev AUC vs CEX ${auc(p, upC).toFixed(3)} [${ci.map((x) => x.toFixed(3)).join(', ')}]  vs pool ${auc(p, upD).toFixed(3)}  | CEX momentum on CEX ${auc(momC, upC).toFixed(3)}  pool momentum on pool ${auc(momD, upD).toFixed(3)}`)
}
