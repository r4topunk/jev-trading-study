// Pool-level LP economics, swap by swap: the fee each taker paid against the markout of the fill on Binance 1 s
// klines, how much of the adverse part sits in a few swaps and minutes, and what a perfect gate that skips the
// worst minutes would keep. Every LP and range of the pool together, not a range strategy. No Jev calls.
// Raw data, reused on rerun: data/<market>/swaps-<date>.jsonl, data/<market>/pool-<date>.json, data/cex/.
// Writes reports/lp-markout.md.
//   node scripts/lp-markout.ts [--dates 2026-09-20,2026-09-21,2026-09-22] [--markets eth,cbbtc,sol,virtual]
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { parseAbi } from 'viem'
import { blockAt, type Clock, client, clock, getSwapLogs, tsOf, withRetry } from '../src/base.ts'
import { marketDir } from '../src/bars.ts'
import { config } from '../src/config.ts'
import { type Market, market } from '../src/markets.ts'
import { bootstrap, quantile, rng } from '../src/metrics.ts'

const { values } = parseArgs({ options: { dates: { type: 'string' }, markets: { type: 'string', default: 'eth,cbbtc,sol,virtual' } } })
const DAY = 86400
const dayOf = (t: number) => new Date(t * 1000).toISOString().slice(0, 10)
const startOf = (d: string) => Date.parse(`${d}T00:00:00Z`) / 1000
const today = Math.floor(Date.now() / 1000 / DAY) * DAY
// Default sample: the last three full UTC days. The report prints the dates, so a rerun reads the same files.
const dates = (values.dates?.split(',') ?? [3, 2, 1].map((k) => dayOf(today - k * DAY))).sort()
const ms = values.markets!.split(',').map(market)

/** Markout horizons in seconds. 0 is the fill's edge against the CEX; the others add the CEX move after it. */
const H = [0, 5, 60, 300, 900]
const I60 = H.indexOf(60)
/** Binance USDT pair that prices [token0, token1]: WETH at ETH, cbBTC at BTC, USDC at USDCUSDT. */
const REF: Record<string, [string, string]> = { eth: ['ETHUSDT', 'USDCUSDT'], cbbtc: ['ETHUSDT', 'BTCUSDT'], sol: ['SOLUSDT', 'USDCUSDT'], virtual: ['VIRTUALUSDT', 'ETHUSDT'] }
for (const m of ms) if (!REF[m.id]) throw new Error(`${m.id}: no CEX reference`)
const PRE = 60, POST = 1200 // klines kept around each day: as-of lookups and the longest horizon
const TOP = 0.01
const NEAR_MIN = 5 // minutes: two bad minutes this close belong to one burst
const OFFSETS = Array.from({ length: 27 }, (_, k) => k - 20)
const slip = (m: Market) => m.venue.startsWith('Aerodrome')

type Swap = { block: number; logIndex: number; ts: number; tx: string; amount0: string; amount1: string; sqrtPriceX96: string; liquidity: string; tick: number }
/** Who gets the fee that day and what else LPs earn: Uniswap protocol fee; Slipstream staked share, unstaked cut, AERO. */
type PoolDay = { feePips: number; protocolDiv: [number, number]; unstakedFee: number; stakedShare: number; aeroPerDay: number; aeroUsd: number }

const swapsFile = (m: Market, d: string) => `${marketDir(m)}swaps-${d}.jsonl`
const poolFile = (m: Market, d: string) => `${marketDir(m)}pool-${d}.json`
const cexFile = (sym: string, d: string) => `${config.dataDir}cex/${sym}-1s-${d}.jsonl`
const save = (file: string, body: string) => {
  mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true })
  writeFileSync(`${file}.tmp`, body)
  renameSync(`${file}.tmp`, file)
}
const readLines = <T>(file: string) => readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T)
const getJson = (url: string) =>
  withRetry(async () => {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`${r.status} ${url}: ${await r.text()}`)
    return (await r.json()) as (string | number)[][]
  })

let clk: Clock | undefined
/** The 2 s block clock is an assumption: check it on the first block of the sample before trusting it. */
async function checkedClock() {
  if (clk) return clk
  const c = await clock()
  const b = blockAt(c, startOf(dates[0]!))
  const real = Number((await withRetry(() => client.getBlock({ blockNumber: b }))).timestamp)
  if (real !== tsOf(c, b)) throw new Error(`block clock drifts: block ${b} is ${real}, model says ${tsOf(c, b)}`)
  return (clk = c)
}

/** One UTC day of raw swaps for the markets that lack it, one eth_getLogs per 1,980 blocks for all of them. */
async function fetchSwaps(need: Market[], d: string) {
  const c = await checkedClock()
  const from = blockAt(c, startOf(d)), to = blockAt(c, startOf(d) + DAY) - 1n
  const step = BigInt((config.chunkMinutes * 60) / config.blockSeconds)
  const chunks: [bigint, bigint][] = []
  for (let b = from; b <= to; b += step) chunks.push([b, b + step - 1n < to ? b + step - 1n : to])
  const byPool = new Map(need.map((m) => [m.pool.toLowerCase(), [] as Swap[]]))
  for (let k = 0; k < chunks.length; k += config.rpcConcurrency) {
    const logs = await Promise.all(chunks.slice(k, k + config.rpcConcurrency).map(([f, t]) => getSwapLogs(need.map((m) => m.pool), f, t)))
    for (const l of logs.flat()) {
      const { amount0, amount1, sqrtPriceX96, liquidity, tick } = l.args
      byPool.get(l.address.toLowerCase())?.push({
        block: Number(l.blockNumber), logIndex: l.logIndex, ts: tsOf(c, l.blockNumber), tx: l.transactionHash,
        amount0: String(amount0), amount1: String(amount1), sqrtPriceX96: String(sqrtPriceX96), liquidity: String(liquidity), tick,
      })
    }
    console.log(`  swaps ${d}  chunks ${Math.min(k + config.rpcConcurrency, chunks.length)}/${chunks.length}`)
  }
  for (const m of need) {
    const rows = byPool.get(m.pool.toLowerCase())!.sort((a, b) => a.block - b.block || a.logIndex - b.logIndex)
    save(swapsFile(m, d), rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  }
}

const POOL = parseAbi([
  'function fee() view returns (uint24)',
  'function liquidity() view returns (uint128)',
  'function stakedLiquidity() view returns (uint128)',
  'function unstakedFee() view returns (uint24)',
  'function gauge() view returns (address)',
  'function rewardRate() view returns (uint256)',
  'function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)',
])

async function fetchPoolDay(m: Market, d: string): Promise<PoolDay> {
  const c = await checkedClock()
  const noon = { address: m.pool, abi: POOL, blockNumber: blockAt(c, startOf(d) + DAY / 2) } as const
  const feePips = Number(await withRetry(() => client.readContract({ ...noon, functionName: 'fee' })))
  if (!slip(m)) {
    const fp = (await withRetry(() => client.readContract({ ...noon, functionName: 'slot0' })))[5]
    return { feePips, protocolDiv: [fp & 15, fp >> 4], unstakedFee: 0, stakedShare: 0, aeroPerDay: 0, aeroUsd: 0 }
  }
  const unstakedFee = Number(await withRetry(() => client.readContract({ ...noon, functionName: 'unstakedFee' })))
  const gauge = await withRetry(() => client.readContract({ ...noon, functionName: 'gauge' }))
  const rate = await withRetry(() => client.readContract({ ...noon, address: gauge, functionName: 'rewardRate' }))
  // Share of in-range liquidity that is staked: its fees go to veAERO voters, its LPs earn AERO instead.
  let staked = 0
  for (let h = 1.5; h < 24; h += 3) {
    const at = { address: m.pool, abi: POOL, blockNumber: blockAt(c, startOf(d) + h * 3600) } as const
    const L = await withRetry(() => client.readContract({ ...at, functionName: 'liquidity' }))
    const S = await withRetry(() => client.readContract({ ...at, functionName: 'stakedLiquidity' }))
    staked += Number(S) / Number(L) / 8
  }
  const k = (await getJson(`https://data-api.binance.vision/api/v3/klines?symbol=AEROUSDT&interval=1d&startTime=${startOf(d) * 1000}&limit=1`))[0]!
  return { feePips, protocolDiv: [0, 0], unstakedFee, stakedShare: staked, aeroPerDay: (Number(rate) * DAY) / 1e18, aeroUsd: Number(k[7]) / Number(k[5]) }
}

/** Binance 1 s klines [open time s, open, high, low, close, volume] for a day plus padding. */
async function fetchKlines(sym: string, d: string) {
  const from = startOf(d) - PRE, to = startOf(d) + DAY + POST
  if (to > Date.now() / 1000) throw new Error(`${d}: the day plus ${POST} s is not over yet`)
  const pages: number[] = []
  for (let s = from; s < to; s += 1000) pages.push(s)
  const rows: number[][] = []
  for (let k = 0; k < pages.length; k += 4) {
    const got = await Promise.all(pages.slice(k, k + 4).map((s) =>
      getJson(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=1s&startTime=${s * 1000}&endTime=${Math.min(s + 1000, to) * 1000 - 1}&limit=1000`)))
    for (const x of got.flat()) rows.push([Number(x[0]) / 1000, Number(x[1]), Number(x[2]), Number(x[3]), Number(x[4]), Number(x[5])])
  }
  console.log(`  ${sym} ${d}: ${rows.length} klines`)
  save(cexFile(sym, d), rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
}

// ---- data
for (const d of dates) {
  const need = ms.filter((m) => !existsSync(swapsFile(m, d)))
  if (need.length) await fetchSwaps(need, d)
  for (const m of ms) if (!existsSync(poolFile(m, d))) save(poolFile(m, d), JSON.stringify(await fetchPoolDay(m, d)) + '\n')
}
const syms = [...new Set(ms.flatMap((m) => REF[m.id]!))]
for (const s of syms) for (const d of dates) if (!existsSync(cexFile(s, d))) await fetchKlines(s, d)

// Close per second over the whole sample; seconds Binance skipped carry the previous close.
const base = startOf(dates[0]!) - PRE
const span = startOf(dates.at(-1)!) + DAY + POST - base
const cexGaps = new Map<string, number>()
const cex = new Map(syms.map((s) => {
  const px = new Float64Array(span).fill(NaN)
  for (const d of dates) for (const [t, , , , c] of readLines<number[]>(cexFile(s, d))) px[t! - base] = c!
  let gaps = 0
  for (const d of dates) for (let i = startOf(d) - PRE - base; i < startOf(d) + DAY + POST - base; i++) if (Number.isNaN(px[i])) gaps++
  for (let i = 1; i < span; i++) if (Number.isNaN(px[i])) px[i] = px[i - 1]!
  cexGaps.set(s, gaps)
  return [s, px]
}))
/** Price as of second T: the close of the kline that ends at T. */
const at = (px: Float64Array, T: number) => px[T - 1 - base]!

// ---- per swap
const Q96 = 2n ** 96n
/**
 * The fee the taker actually paid, as a fraction of the input, from the price move and the in-range liquidity.
 * Exact when the liquidity after the previous swap equals the liquidity after this one (no tick crossed); NaN
 * otherwise or when the fee is too few raw units to read. Slipstream fees are dynamic, so this beats fee().
 */
function impliedFee(prev: Swap | undefined, s: Swap) {
  if (!prev || prev.liquidity !== s.liquidity || s.liquidity === '0') return NaN
  const L = BigInt(s.liquidity), a = BigInt(prev.sqrtPriceX96), b = BigInt(s.sqrtPriceX96)
  const a0 = BigInt(s.amount0), a1 = BigInt(s.amount1)
  const [gross, net] = a1 > 0n && a0 <= 0n ? [a1, (L * (b - a)) / Q96] : a0 > 0n && a1 <= 0n ? [a0, (L * Q96 * (a - b)) / a / b] : [0n, 0n]
  if (gross - net < 50n) return NaN
  const f = Number(gross - net) / Number(gross)
  return f <= 0.01 ? f : NaN
}

type Fill = { ts: number; vol: number; fee: number; lpFee: number; exact: boolean; mk: number[]; drift: number[]; basis: number }

function fillsOf(m: Market) {
  const [s0, s1] = REF[m.id]!
  const p0 = cex.get(s0)!, p1 = cex.get(s1)!
  const pair = (T: number) => at(p0, T) / at(p1, T)
  const swaps = dates.flatMap((d) => readLines<Swap>(swapsFile(m, d)))
  const pd = new Map(dates.map((d) => [d, JSON.parse(readFileSync(poolFile(m, d), 'utf8')) as PoolDay]))
  const implied = swaps.map((s, k) => impliedFee(swaps[k - 1], s))
  // An unreadable fee carries the last readable one (the first readable one before any).
  let last = implied.find(Number.isFinite) ?? m.feeBps / 1e4
  const [d0, d1] = m.decimals
  const fills: Fill[] = []
  const absBasis = OFFSETS.map(() => [] as number[])
  let dropped = 0
  for (const [k, s] of swaps.entries()) {
    const f = Number.isFinite(implied[k]) ? (last = implied[k]!) : last
    const a0 = Number(s.amount0) / 10 ** d0, a1 = Number(s.amount1) / 10 ** d1
    if ((a0 > 0) === (a1 > 0)) {
      dropped++
      continue
    }
    // The LP is the counterparty: it holds the pool's deltas. Value them at the CEX at T.
    const value = (T: number) => a0 * at(p0, T) + a1 * at(p1, T)
    const vol = a0 > 0 ? a0 * at(p0, s.ts) : a1 * at(p1, s.ts)
    const fee = f * vol
    const p = pd.get(dayOf(s.ts))!
    const div = p.protocolDiv[a0 > 0 ? 0 : 1]
    const lpShare = slip(m) ? (1 - p.stakedShare) * (1 - p.unstakedFee / 1e6) : div ? 1 - 1 / div : 1
    const v0 = value(s.ts)
    const px = (Number(BigInt(s.sqrtPriceX96)) / 2 ** 96) ** 2 * 10 ** (d0 - d1)
    OFFSETS.forEach((o, j) => absBasis[j]!.push(Math.abs(px / pair(s.ts + o) - 1)))
    fills.push({
      ts: s.ts, vol, fee, lpFee: fee * lpShare, exact: Number.isFinite(implied[k]),
      mk: H.map((h) => value(s.ts + h) - fee),
      drift: H.map((h) => value(s.ts + h) - v0),
      basis: px / pair(s.ts) - 1,
    })
  }
  return { m, fills, dropped, absBasis, pd, pair, n: swaps.length }
}

// ---- aggregates
const sum = <T>(xs: T[], g: (x: T) => number) => xs.reduce((a, x) => a + g(x), 0)
const bps = (num: number, den: number) => (num / den) * 1e4
const N_MIN = dates.length * 1440
const sampleMinutes = dates.flatMap((d) => Array.from({ length: 1440 }, (_, k) => startOf(d) / 60 + k))
const nTop = Math.round(TOP * N_MIN)
type Minute = { t: number; vol: number; fee: number; lpFee: number; mk: number }

/** Share of `set` that has another member within `w` minutes. */
function nearShare(set: number[], w: number) {
  const s = [...set].sort((a, b) => a - b)
  return s.filter((x, k) => (k > 0 && x - s[k - 1]! <= w) || (k < s.length - 1 && s[k + 1]! - x <= w)).length / s.length
}

function analyze(x: ReturnType<typeof fillsOf>) {
  const { fills, pair } = x
  const vol = sum(fills, (f) => f.vol), fee = sum(fills, (f) => f.fee), lpFee = sum(fills, (f) => f.lpFee)
  const mk = H.map((_, j) => sum(fills, (f) => f.mk[j]!))
  // Placebo: each fill's CEX move over the horizon with a coin-flip sign, 20 seeds. Mean ~0; the spread is the noise floor.
  const pls = Array.from({ length: 20 }, (_, k) => {
    const rand = rng(k + 1)
    const acc = H.map(() => 0)
    for (const f of fills) {
      const sign = rand() < 0.5 ? -1 : 1
      for (let j = 0; j < H.length; j++) acc[j]! += sign * f.drift[j]!
    }
    return acc.map((v) => bps(v, vol))
  })
  const pl = H.map((_, j) => pls.reduce((a, p) => a + p[j]!, 0) / pls.length)
  const plSd = H.map((_, j) => Math.sqrt(pls.reduce((a, p) => a + (p[j]! - pl[j]!) ** 2, 0) / (pls.length - 1)))
  const exactVol = sum(fills.filter((f) => f.exact), (f) => f.vol)
  const exactFeeBps = bps(sum(fills.filter((f) => f.exact), (f) => f.fee), exactVol)
  const exactFees = fills.filter((f) => f.exact).map((f) => (f.fee / f.vol) * 1e4)
  const pdv = [...x.pd.values()]
  const avg = (g: (p: PoolDay) => number) => sum(pdv, g) / pdv.length
  const emis = sum(pdv, (p) => p.aeroPerDay * p.aeroUsd)

  // Hour blocks for the intervals: markouts within an hour are correlated, hours much less.
  const hours = new Map<number, Fill[]>()
  for (const f of fills) (hours.get(Math.floor(f.ts / 3600)) ?? hours.set(Math.floor(f.ts / 3600), []).get(Math.floor(f.ts / 3600))!).push(f)
  const hs = [...hours.values()].map((g) => ({ vol: sum(g, (f) => f.vol), fee: sum(g, (f) => f.fee), mk: H.map((_, j) => sum(g, (f) => f.mk[j]!)) }))
  const ci = (g: (h: (typeof hs)[number]) => number) => bootstrap(hs.length, (idx) => bps(sum(idx, (i) => g(hs[i]!)), sum(idx, (i) => hs[i]!.vol)), 0.05, 2000, 13)
  const netCi = H.map((_, j) => ci((h) => h.fee + h.mk[j]!))

  const days = dates.map((d) => {
    const g = fills.filter((f) => dayOf(f.ts) === d)
    return { d, n: g.length, vol: sum(g, (f) => f.vol), fee: sum(g, (f) => f.fee), mk: H.map((_, j) => sum(g, (f) => f.mk[j]!)) }
  })

  // Concentration at 60 s
  const byAbs = fills.map((f) => f.mk[I60]!).sort((a, b) => Math.abs(b) - Math.abs(a))
  const topSwaps = (q: number) => sum(byAbs.slice(0, Math.ceil(q * byAbs.length)), (v) => v) / mk[I60]!
  const worstMinutes = (minuteOf: (k: number) => number) => {
    const mins = new Map<number, Minute>()
    fills.forEach((f, k) => {
      const t = minuteOf(k)
      const b = mins.get(t) ?? mins.set(t, { t, vol: 0, fee: 0, lpFee: 0, mk: 0 }).get(t)!
      b.vol += f.vol
      b.fee += f.fee
      b.lpFee += f.lpFee
      b.mk += f.mk[I60]!
    })
    return [...mins.values()].sort((a, b) => a.mk - b.mk).slice(0, nTop)
  }
  const gate = (w: Minute[]) => bps(fee + mk[I60]! - sum(w, (b) => b.fee + b.mk), vol - sum(w, (b) => b.vol))
  const worst = worstMinutes((k) => Math.floor(fills[k]!.ts / 60))
  const net = bps(fee + mk[I60]!, vol)
  const gated = gate(worst)
  // An LP off the pool in those minutes also forgoes their share of the time-paid emissions.
  const lpGated = bps(lpFee - sum(worst, (b) => b.lpFee) + emis * (1 - nTop / N_MIN) + mk[I60]! - sum(worst, (b) => b.mk), vol - sum(worst, (b) => b.vol))
  // Null for the gate: the same swaps in shuffled minutes. What skipping the worst 1% buys from a few large swaps
  // alone, with no clustering in time.
  const r5 = rng(5)
  let nullGain = 0
  for (let r = 0; r < 20; r++) {
    const perm = fills.map((f) => Math.floor(f.ts / 60))
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(r5() * (i + 1))
      ;[perm[i], perm[j]] = [perm[j]!, perm[i]!]
    }
    nullGain += (gate(worstMinutes((k) => perm[k]!)) - net) / 20
  }

  // Bursts: do the worst minutes sit next to each other more than random minutes would?
  const W = worst.map((b) => b.t)
  const near = nearShare(W, NEAR_MIN)
  const rand = rng(7)
  let hits = 0, draws = 0
  for (let r = 0; r < 1000; r++) {
    const pool = [...sampleMinutes]
    for (let k = 0; k < nTop; k++) {
      const j = k + Math.floor(rand() * (pool.length - k))
      ;[pool[k], pool[j]] = [pool[j]!, pool[k]!]
    }
    const s = nearShare(pool.slice(0, nTop), NEAR_MIN)
    draws += s
    if (s >= near) hits++
  }
  const episodes: { start: number; end: number; mk: number; n: number }[] = []
  for (const t of [...W].sort((a, b) => a - b)) {
    const e = episodes.at(-1)
    if (e && t - e.end <= NEAR_MIN) {
      e.end = t
      e.n++
    } else episodes.push({ start: t, end: t, mk: 0, n: 1 })
  }
  for (const e of episodes) e.mk = sum(worst.filter((b) => b.t >= e.start && b.t <= e.end), (b) => b.mk)
  episodes.sort((a, b) => a.mk - b.mk)
  // Do they line up with CEX volatility? Share of worst minutes among the 5% largest one-minute CEX moves of the pair.
  const move = (t: number) => Math.abs(Math.log(pair((t + 1) * 60) / pair(t * 60)))
  const volThr = quantile(sampleMinutes.map(move), 0.95)
  const inVol = W.filter((t) => move(t) >= volThr).length / W.length

  const medAbs = x.absBasis.map((b) => quantile(b, 0.5))
  const bestOff = OFFSETS[medAbs.indexOf(Math.min(...medAbs))]!
  const basis = fills.map((f) => f.basis)

  return {
    ...x, vol, fee, lpFee, mk, pl, plSd, netCi, days, exactVol, exactFeeBps, feeP10: quantile(exactFees, 0.1), feeP90: quantile(exactFees, 0.9), emis,
    feeNow: avg((p) => p.feePips) / 100, staked: avg((p) => p.stakedShare), unstakedCut: avg((p) => p.unstakedFee) / 1e6, protocolDiv: pdv[0]!.protocolDiv,
    top1: topSwaps(0.01), top5: topSwaps(0.05), topMin: sum(worst, (b) => b.mk) / mk[I60]!, net, gated, lpGated, nullGain, W,
    near, nearChance: draws / 1000, nearP: (hits + 1) / 1001, episodes, inVol,
    basisMed: quantile(basis, 0.5), basisAbsMed: medAbs[OFFSETS.indexOf(0)]!, basisP99: quantile(basis.map(Math.abs), 0.99), bestOff, medAbs,
  }
}

const rs = ms.map((m) => analyze(fillsOf(m)))
// Market-wide or pool-specific? Share of a pool's worst minutes within 2 min of another pool's worst minute.
const coincide = rs.map((r) => {
  const others = new Set(rs.filter((o) => o !== r).flatMap((o) => o.W.flatMap((t) => [-2, -1, 0, 1, 2].map((k) => t + k))))
  return { obs: r.W.filter((t) => others.has(t)).length / r.W.length, chance: others.size / N_MIN }
})

// ---- report
const fx = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '--')
const sg = (x: number, d = 2) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(d)}` : '--')
const pc = (x: number, d = 0) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : '--')
const usd = (x: number) => {
  const a = Math.abs(x), s = x < 0 ? '-' : ''
  return a >= 1e6 ? `${s}$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${s}$${(a / 1e3).toFixed(1)}k` : `${s}$${a.toFixed(0)}`
}
const ci = ([lo, hi]: [number, number]) => `[${sg(lo, 1)}, ${sg(hi, 1)}]`
const hm = (t: number) => new Date(t * 60000).toISOString().slice(5, 16).replace('T', ' ')
const lpNet = (r: (typeof rs)[number], j: number) => bps(r.lpFee + r.emis + r.mk[j]!, r.vol)
const sign = (lo: number, hi: number) => (lo > 0 ? 'positiva' : hi < 0 ? 'negativa' : 'indistinguível de zero')
const flip = (before: number, after: number) => (before >= 0 ? 'já positivo' : after > 0 ? '**sim**' : 'não')
const range = (xs: number[], d = 0) => `${pc(Math.min(...xs), d)}–${pc(Math.max(...xs), d)}`
const I300 = H.indexOf(300)

const mainRows = rs.map((r) => {
  const b = (v: number) => sg(bps(v, r.vol))
  return `| ${r.m.symbol} | ${r.fills.length} | ${usd(r.vol)} | ${fx(bps(r.fee, r.vol))} | ${H.map((_, j) => b(r.mk[j]!)).join(' | ')} | ${pc(r.mk[0]! / r.mk[I60]!)} | ${b(r.fee + r.mk[1]!)} | **${b(r.fee + r.mk[I60]!)}** ${ci(r.netCi[I60]!)} | ${b(r.fee + r.mk[I300]!)} ${ci(r.netCi[I300]!)} |`
})
const lpRows = rs.map((r) => {
  const share = slip(r.m) ? `${pc(1 - r.staked)} fora do gauge × ${pc(1 - r.unstakedCut)}` : r.protocolDiv[0] ? `${pc(1 - 1 / r.protocolDiv[0])} (protocolo 1/${r.protocolDiv[0]})` : '100%'
  return `| ${r.m.symbol} | ${fx(bps(r.fee, r.vol))} | ${share} | ${fx(bps(r.lpFee, r.vol))} | ${slip(r.m) ? `${fx(bps(r.emis, r.vol))} (${usd(r.emis / dates.length)}/dia)` : '—'} | ${sg(bps(r.mk[I60]!, r.vol))} | **${sg(lpNet(r, I60))}** | ${sg(lpNet(r, I300))} | ${sg(r.lpGated)} |`
})
const concRows = rs.map((r) =>
  `| ${r.m.symbol} | ${usd(r.mk[I60]!)} | ${pc(r.top1)} | ${pc(r.top5)} | ${pc(r.topMin)} | ${sg(r.net)} | **${sg(r.gated)}** | ${sg(r.gated - r.net)} | ${sg(r.nullGain)} | ${flip(r.net, r.gated)} |`)
const burstRows = rs.map((r, k) =>
  `| ${r.m.symbol} | ${pc(r.near)} | ${pc(r.nearChance)} | ${fx(r.nearP, 3)} | ${r.episodes.length} | ${pc(r.episodes[0]!.mk / r.mk[I60]!)} | ${pc(r.inVol)} | ${pc(coincide[k]!.obs)} (acaso ~${pc(coincide[k]!.chance)}) |`)
const episodeRows = rs.flatMap((r) => r.episodes.slice(0, 3).map((e) =>
  `| ${r.m.symbol} | ${hm(e.start)}–${hm(e.end).slice(6)} | ${e.n} | ${usd(e.mk)} | ${pc(e.mk / r.mk[I60]!)} | ${sg(bps(r.pair((e.end + 1) * 60) - r.pair(e.start * 60), r.pair(e.start * 60)), 0)} |`))
const dayRows = rs.flatMap((r) => [...r.days, { d: 'total', n: r.fills.length, vol: r.vol, fee: r.fee, mk: r.mk }].map((d) =>
  `| ${r.m.symbol} | ${d.d} | ${d.n} | ${usd(d.vol)} | ${usd(d.fee)} | ${usd(d.mk[1]!)} | ${usd(d.mk[I60]!)} | ${usd(d.mk[I300]!)} | ${usd(d.fee + d.mk[I60]!)} |`))
const sanityRows = rs.map((r) => {
  const [s0, s1] = REF[r.m.id]!
  return `| ${r.m.symbol} | ${sg(r.basisMed * 1e4, 1)} | ${fx(r.basisAbsMed * 1e4, 1)} | ${fx(r.basisP99 * 1e4, 1)} | ${sg(r.bestOff, 0)} s (${fx(Math.min(...r.medAbs) * 1e4, 1)}) | ${H.slice(1).map((_, j) => `${sg(r.pl[j + 1]!)} ± ${fx(r.plSd[j + 1]!)} (real ${sg(bps(r.mk[j + 1]! - r.mk[0]!, r.vol))})`).join(' | ')} | ${cexGaps.get(s0)}/${cexGaps.get(s1)} | ${r.dropped} |`
})
const feeRows = rs.map((r) =>
  `| ${r.m.symbol} | ${r.m.venue} | ${fx(r.m.feeBps)} | ${fx(r.feeNow)} | ${fx(r.exactFeeBps)} | ${fx(r.feeP10)}–${fx(r.feeP90)} | ${pc(r.exactVol / r.vol)} | ${fx(bps(r.fee, r.vol))} |`)

const verdictLp = rs.map((r) => `${r.m.symbol} ${sg(bps(r.fee + r.mk[I60]!, r.vol), 1)} bps ${ci(r.netCi[I60]!)} (${sign(...r.netCi[I60]!)})`).join('; ')
const verdictLpReal = rs.map((r) => `${r.m.symbol} ${sg(lpNet(r, I60), 1)}`).join(', ')
const verdictWhere = rs.map((r) => `${r.m.symbol} ${pc(r.mk[0]! / r.mk[I60]!)}`).join(', ')
const verdictDrift = rs.map((r) => `${r.m.symbol} ${sg(bps(r.mk[H.length - 1]! - r.mk[0]!, r.vol), 1)} (ruído ±${fx(r.plSd[H.length - 1]!, 1)})`).join(', ')
const verdictGate = rs.map((r) => `${r.m.symbol} ${sg(r.net, 1)} → ${sg(r.gated, 1)} (${flip(r.net, r.gated).replaceAll('*', '')}; nulo ${sg(r.nullGain, 1)})`).join('; ')
const verdictGateLp = rs.map((r) => `${r.m.symbol} ${sg(lpNet(r, I60), 1)} → ${sg(r.lpGated, 1)}`).join(', ')
const cmd = `node scripts/lp-markout.ts --dates ${dates.join(',')} --markets ${ms.map((m) => m.id).join(',')}`

const md = `# Economia de LP nos pools da Base: fee vs. seleção adversa

Gerado ${new Date().toISOString().slice(0, 16)} UTC. Amostra: ${dates.join(', ')} (dias UTC completos), ${sum(rs, (r) => r.fills.length)} swaps.
Reproduzir (lê os dados em cache): \`${cmd}\`.

**Economia no nível do pool**: todos os LPs e todos os ranges somados, como se o pool fosse um único LP. Não é o P&L de uma
estratégia de range específica (concentração, rebalanceamento, gas e JIT mudam a parcela de cada um).

## Veredito

Hipótese: a reversão à média de ~15 min nos pools é impacto desfeito por arbitragem, e isso seria receita para o LP.

- **LPs têm lucro líquido?** Margem do pool (fee paga pelo taker + markout 60 s): ${verdictLp}.
  Para os LPs de fato (depois da fee de protocolo / gauge e somando emissões AERO): ${verdictLpReal} bps.
  Onde está a perda: parcela do markout de 60 s que já está no instante do fill (0 s): ${verdictWhere}.
  O que a CEX faz depois do fill (markout 900 s − 0 s, a favor do LP se positivo): ${verdictDrift} bps.
- **Seleção adversa em rajadas?** O pior 1% dos minutos (${nTop} de ${N_MIN}) leva ${range(rs.map((r) => r.topMin))} do markout;
  ${range(rs.map((r) => r.near))} desses minutos têm outro a ≤ ${NEAR_MIN} min (acaso ~${pc(rs[0]!.nearChance)}), ${range(rs.map((r) => r.inVol))} caem nos 5% de minutos
  de maior movimento na Binance e ${range(coincide.map((c) => c.obs))} coincidem com o pior minuto de outro pool.
  Gate perfeito que pula esses minutos (limite superior, bps): ${verdictGate}.
  "Nulo" = ganho do mesmo gate com os swaps embaralhados entre minutos (só cauda de swaps grandes, sem rajada).
  Para os LPs de fato: ${verdictGateLp}.
- **Ressalvas principais**: 3 dias só; o gate é ex post (escolhe os minutos pelo resultado); a parcela de fee dos LPs e as
  emissões são leituras a cada 3 h / por dia, e as emissões valem o que o AERO valer na venda; referência = último trade da
  Binance (não o mid), com ±2 s de incerteza no horário do swap, que pesa em 0/5 s e não em 60/300 s.

## Como ler

- O LP é a contraparte de cada swap. P&L do LP no horizonte Δ = Σ (variação do saldo do pool em cada token) × preço Binance em t+Δ.
- **fee** = taxa efetivamente paga × valor do input em t. **markout(Δ)** = P&L(Δ) − fee: negativo = seleção adversa.
  0 s é a vantagem do fill contra a CEX no instante do bloco; 5 a 900 s somam o movimento da CEX depois do fill.
- **margem líquida** = fee + markout, em bps do volume USD (valor do input). IC 95% por bootstrap de blocos de 1 hora.
- Por que a reversão à média não é receita do LP: numa ida-e-volta no CFMM o LP termina com o mesmo inventário. O impacto que o
  fluxo de ruído paga é recapturado por quem desfaz o preço (o arbitrador), não pelo LP; o LP fica só com as fees das duas pernas
  e paga o LVR quando a CEX se move primeiro e o pool é arbitrado contra preço velho. Esse LVR aparece já no markout 0 s; o que
  o LP ganha ou perde depois, segurando o inventário, é a diferença entre 0 s e os horizontes longos.

## Por pool (bps do volume)

| pool | swaps | volume | fee | markout 0 s | 5 s | 60 s | 300 s | 900 s | 0 s / 60 s | líquido 5 s | líquido 60 s [IC] | líquido 300 s [IC] |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${mainRows.join('\n')}

## Para os LPs de fato (bps do volume)

A fee acima é a que o taker paga. Nem toda fica com o LP: no Uniswap v3 da Base o protocolo leva 1/${rs.find((r) => !slip(r.m))?.protocolDiv[0] ?? '?'} (\`feeProtocol\`);
no Slipstream a fee da liquidez em stake no gauge vai para os votantes de veAERO (os LPs em stake recebem AERO em troca) e a
liquidez fora do gauge perde \`unstakedFee\` da sua parte. A seleção adversa cai sobre toda a liquidez ativa. Parcela em stake:
média de 8 leituras por dia (a cada 3 h); emissão = \`rewardRate\` do gauge ao meio-dia × VWAP diário de AEROUSDT na Binance.

| pool | fee paga | parcela que fica com LPs | fee p/ LPs | emissões AERO | markout 60 s | líquido LPs 60 s | líquido LPs 300 s | 60 s sem pior 1% min |
|---|---|---|---|---|---|---|---|---|
${lpRows.join('\n')}

## Concentração (markout 60 s)

Participação no markout total do pool (pode passar de 100%: o resto dos swaps é positivo para o LP). Swaps ordenados por |markout|;
minutos ordenados do pior para o melhor markout. Gate perfeito = tirar do pool (fee, markout e volume) o pior 1% dos minutos da
amostra, escolhido depois de ver o resultado. Nulo = média de 20 embaralhamentos dos swaps entre minutos: o ganho que o gate
teria só por causa dos swaps grandes, se eles não se juntassem no tempo. Ganho − nulo = o que vem de rajadas.

| pool | markout 60 s total | top 1% swaps | top 5% swaps | pior 1% minutos | líquido 60 s | sem pior 1% min | ganho | ganho no nulo | vira o sinal? |
|---|---|---|---|---|---|---|---|---|---|
${concRows.join('\n')}

## Rajadas

Vizinho = outro minuto do pior 1% a ≤ ${NEAR_MIN} min. Acaso = mesma conta com ${nTop} minutos sorteados (1000 sorteios); p = fração dos
sorteios com agrupamento ≥ o observado. Episódio = piores minutos a ≤ ${NEAR_MIN} min um do outro. Vol CEX = minuto entre os 5% maiores
|retornos| de 1 min do par na Binance (acaso = 5%). Outro pool = a ±2 min de um pior minuto de outro pool.

| pool | com vizinho | acaso | p | episódios | maior episódio (% do markout) | em minuto de vol CEX | coincide com outro pool |
|---|---|---|---|---|---|---|---|
${burstRows.join('\n')}

Três piores episódios por pool:

| pool | UTC | minutos | markout 60 s | % do total | movimento do par na CEX (bps) |
|---|---|---|---|---|---|
${episodeRows.join('\n')}

## Totais por dia (USD)

| pool | dia | swaps | volume | fee | markout 5 s | markout 60 s | markout 300 s | líquido 60 s |
|---|---|---|---|---|---|---|---|---|
${dayRows.join('\n')}

## Checagens

Basis = preço do pool depois do swap ÷ preço implícito na Binance no mesmo segundo − 1 (por swap, sem peso). O offset é o
deslocamento da referência da CEX (em s) que minimiza a mediana do |basis|: negativo = o pool acompanha a CEX com atraso.
Placebo = movimento da CEX depois de cada fill com sinal sorteado, média ± desvio entre 20 sementes: tem que dar ~0, e o desvio
é o piso de ruído. "real" = o mesmo movimento com o sinal verdadeiro (markout Δ − markout 0 s). Segundos CEX = segundos sem kline preenchidos
com o fechamento anterior (token0/token1).

| pool | basis mediano | mediana \\|basis\\| | p99 \\|basis\\| | melhor offset (mediana) | placebo 5 s | placebo 60 s | placebo 300 s | placebo 900 s | segundos CEX faltando | swaps descartados |
|---|---|---|---|---|---|---|---|---|---|---|
${sanityRows.join('\n')}

Fee derivada swap a swap: com a mesma liquidez antes e depois do swap (nenhum tick cruzado), a taxa sai exata de
Δ√P × L contra o input bruto. Swaps sem leitura exata herdam a última taxa lida no mesmo pool.

| pool | venue | fee em markets.ts | fee() ao meio-dia (média) | fee derivada (swaps exatos) | p10–p90 por swap | volume com leitura exata | fee usada (média ponderada) |
|---|---|---|---|---|---|---|---|
${feeRows.join('\n')}

## Premissas

- Referência de preço: fechamento do kline de 1 s da Binance que termina no segundo t (último trade, não o mid).
  WETH = ETHUSDT, cbBTC = BTCUSDT, SOL = SOLUSDT, VIRTUAL = VIRTUALUSDT, USDC = USDCUSDT: tudo em USDT ≈ USD.
- Horário do swap = timestamp do bloco (blocos da Base a cada 2 s, relógio checado no primeiro bloco da amostra).
- Volume = valor do input na CEX em t. Fee = taxa derivada × volume. Swaps sem input positivo em exatamente um token são descartados.
- Parcelas de fee e emissões lidas on-chain (histórico) em horários fixos, não swap a swap; \`rewardRate\` constante na época.
- Placebo, bootstrap, sorteios e embaralhamentos com sementes fixas (mulberry32): rodar de novo dá os mesmos números.
- Gate para os LPs de fato: fora do pool nos minutos pulados, o LP também perde a fração de tempo das emissões (${nTop}/${N_MIN}).

## UNKNOWN

- Em que momento dentro do bloco o swap executou (flashblocks de 200 ms): ±2 s mexem no markout 0 s e 5 s, não em 60/300 s.
- Quanto do markout 0 s é bid-ask bounce da Binance: o fechamento é o último trade, que num arbitrador CEX-DEX tende a estar
  do lado que ele mesmo agrediu. Não há book histórico por segundo nesta API.
- Se cbBTC, o SOL bridged da Base e WETH valem exatamente BTC, SOL e ETH: o basis mediano acima mede o viés; um basis constante
  só entra no markout na proporção do fluxo líquido (não do volume).
- Qual venue lidera o preço do VIRTUAL (token nativo da Base): se a Binance segue a Base, parte do markout adverso de 5–60 s
  contra a Binance é a referência atrasada, não fluxo informado contra o LP.
- Representatividade: 3 dias, sem calendário de notícias; não sei se os piores episódios coincidem com eventos macro/listagens.
- Valor real das emissões para um LP: preço de venda do AERO, parcela do gauge que um LP novo capturaria, custo de gas e de
  rebalancear um range concentrado, competição com JIT.
- Um gate que funcione em tempo real: aqui só o limite superior ex post; o agrupamento em rajadas diz se um gate reativo
  (pausar depois de um minuto ruim) teria chance, não quanto ele ganharia.
`

mkdirSync(config.reportsDir, { recursive: true })
writeFileSync(`${config.reportsDir}lp-markout.md`, md)
for (const r of rs) {
  console.log(`${r.m.id.padEnd(8)} swaps ${r.fills.length}  vol ${usd(r.vol)}  fee ${fx(bps(r.fee, r.vol))}  mk ${H.map((h, j) => `${h}s ${sg(bps(r.mk[j]!, r.vol))}`).join(' ')}  net60 ${sg(r.net)} ${ci(r.netCi[I60]!)}  gated ${sg(r.gated)}  lpNet60 ${sg(lpNet(r, I60))}`)
}
console.log(`wrote ${config.reportsDir}lp-markout.md`)
