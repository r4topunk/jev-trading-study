import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { type Bar, type Clock, fetchSwapBars } from './base.ts'
import { config } from './config.ts'
import { ETH, type Market } from './markets.ts'

export const marketDir = (m: Market) => `${config.dataDir}${m.id}/`
const barsFile = (m: Market) => `${marketDir(m)}bars.jsonl`

/** Raw bars (quote units), sorted and deduplicated, holes allowed (an interrupted backfill leaves them). */
export function readBars(m: Market): Bar[] {
  if (!existsSync(barsFile(m))) return []
  const byT = new Map<number, Bar>()
  for (const line of readFileSync(barsFile(m), 'utf8').split('\n')) {
    if (!line) continue
    const b = JSON.parse(line) as Bar
    byT.set(b.t, b)
  }
  return [...byT.values()].sort((a, b) => a.t - b.t)
}

let ethCache: Map<number, number> | undefined

/**
 * Bars in USD, every minute from the first swap on, contiguous: bars[i + k] is always k minutes after
 * bars[i]. A WETH-quoted pool is converted with the ETH/USDC close of the same minute.
 */
export function loadBars(m: Market): Bar[] {
  const bars = readBars(m)
  for (let i = 1; i < bars.length; i++) {
    if (bars[i]!.t - bars[i - 1]!.t !== 60) throw new Error(`${m.id}: bars have a hole after ${iso(bars[i - 1]!.t)}; rerun backfill`)
  }
  if (m.quote === 'USDC') return bars
  ethCache ??= new Map(loadBars(ETH).map((b) => [b.t, b.c]))
  const first = bars.findIndex((b) => ethCache!.has(b.t))
  const out: Bar[] = []
  for (const b of bars.slice(Math.max(0, first))) {
    const e = ethCache.get(b.t)
    if (e === undefined) break // ETH not synced this far yet: stop at the last minute both have
    out.push({ ...b, o: b.o * e, h: b.h * e, l: b.l * e, c: b.c * e, volUsd: b.volUsd * e, buyUsd: b.buyUsd * e, sellUsd: b.sellUsd * e })
  }
  return out
}

/**
 * Fills, for every market, the minutes of [fromMin, toMin) its file lacks: before its head, in its holes,
 * after its tail. One eth_getLogs per 66-minute chunk covers every market that still needs that chunk, so
 * adding markets does not add requests. Chunks are written in time order, one append per chunk, so a crash
 * resumes where it stopped. Minutes without a swap carry the previous close.
 * fromMin defaults to the earliest tail. Returns, per market, the bars appended after its old tail.
 */
export async function syncMarkets(clk: Clock, markets: Market[], fromMin: number | undefined, toMin: number, progress = false) {
  const st = markets.map((m) => {
    const have = readBars(m)
    return { m, closes: new Map(have.map((b) => [b.t, b.c])), tail: have.at(-1)?.t ?? -Infinity, appended: [] as Bar[] }
  })
  const start = fromMin ?? Math.min(...st.map((s) => (Number.isFinite(s.tail) ? s.tail / 60 + 1 : Infinity)))
  if (!Number.isFinite(start)) throw new Error('no bars yet: pass a start')
  for (const s of st) mkdirSync(marketDir(s.m), { recursive: true })

  const chunks: [number, number][] = []
  for (let m = start; m < toMin; m += config.chunkMinutes) chunks.push([m, Math.min(m + config.chunkMinutes, toMin)])
  const needs = (s: (typeof st)[number], f: number, t: number) => {
    for (let m = f; m < t; m++) if (!s.closes.has(m * 60)) return true
    return false
  }

  const t0 = Date.now()
  let fetched = 0
  for (let k = 0; k < chunks.length; k += config.rpcConcurrency) {
    const batch = chunks.slice(k, k + config.rpcConcurrency).map(([f, t]) => ({ f, t, who: st.filter((s) => needs(s, f, t)) }))
    const results = await Promise.all(batch.map((c) => (c.who.length ? fetchSwapBars(clk, c.who.map((s) => s.m), c.f, c.t) : null)))
    for (let j = 0; j < batch.length; j++) {
      const { f, t, who } = batch[j]!
      if (!who.length) continue
      fetched++
      for (const s of who) {
        const byT = new Map(results[j]!.get(s.m.id)!.map((x) => [x.t, x]))
        const out: Bar[] = []
        for (let m = f; m < t; m++) {
          if (s.closes.has(m * 60)) continue
          const x = byT.get(m * 60)
          const prev = s.closes.get((m - 1) * 60)
          if (!x && prev === undefined) continue // before this pool's first swap
          const bar = x ?? { t: m * 60, o: prev!, h: prev!, l: prev!, c: prev!, n: 0, volUsd: 0, buyUsd: 0, sellUsd: 0 }
          s.closes.set(bar.t, bar.c)
          out.push(bar)
        }
        if (out.length) appendFileSync(barsFile(s.m), out.map((x) => JSON.stringify(x)).join('\n') + '\n')
        s.appended.push(...out.filter((x) => x.t > s.tail))
      }
    }
    if (progress && fetched) {
      const done = Math.min(k + batch.length, chunks.length)
      const eta = (((Date.now() - t0) / done) * (chunks.length - done)) / 1000
      console.log(`  chunks ${done}/${chunks.length}  up to ${iso(batch.at(-1)!.t * 60)}  eta ${eta.toFixed(0)}s`)
    }
  }
  if (st.some((s) => s.m.id === ETH.id && s.appended.length)) ethCache = undefined
  return new Map(st.map((s) => [s.m.id, s.appended]))
}

export const iso = (t: number) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ')
