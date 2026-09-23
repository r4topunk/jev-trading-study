// Pulls Swap logs of the market pools into one-minute bars (data/<market>/bars.jsonl). One eth_getLogs per
// chunk serves every market. Resumable.
//   node scripts/backfill.ts --days 90 [--markets eth,cbbtc]
import { parseArgs } from 'node:util'
import { client, clock, tsOf, withRetry } from '../src/base.ts'
import { iso, loadBars, readBars, syncMarkets } from '../src/bars.ts'
import { config } from '../src/config.ts'
import { ETH, MARKETS, market } from '../src/markets.ts'

const { values } = parseArgs({ options: { days: { type: 'string', default: '90' }, markets: { type: 'string' } } })
const days = Number(values.days)
const ms = values.markets ? values.markets.split(',').map(market) : MARKETS
if (ms.some((m) => m.quote === 'WETH') && !ms.includes(ETH)) ms.unshift(ETH) // USD conversion needs ETH bars

const clk = await clock()
const toMin = Math.floor(tsOf(clk, clk.refBlock - 2n) / 60)
const fromMin = toMin - Math.round(days * 1440)

// The 2 s block clock is an assumption: check it against the real timestamp at the far end of the range.
const probe = clk.refBlock - BigInt(Math.round((days * 86400) / config.blockSeconds))
const real = Number((await withRetry(() => client.getBlock({ blockNumber: probe }))).timestamp)
if (Math.abs(real - tsOf(clk, probe)) > 2) throw new Error(`block clock drifts: block ${probe} is ${real}, model says ${tsOf(clk, probe)}`)

console.log(`backfill ${days}d: ${iso(fromMin * 60)} .. ${iso(toMin * 60)} UTC  markets ${ms.map((m) => m.id).join(', ')}`)
for (const m of ms) console.log(`  ${m.id.padEnd(8)} have ${readBars(m).length} bars`)
await syncMarkets(clk, ms, fromMin, toMin, true)

for (const m of ms) {
  const bars = loadBars(m).filter((b) => b.t >= fromMin * 60)
  const empty = bars.filter((b) => b.n === 0).length / bars.length
  const flag = empty > config.maxEmptyMinuteShare ? '  EXCLUDED (data quality)' : ''
  console.log(`${m.id.padEnd(8)} ${bars.length} bars  ${iso(bars[0]!.t)} .. ${iso(bars.at(-1)!.t)}  no-swap minutes ${(empty * 100).toFixed(1)}%${flag}`)
}
