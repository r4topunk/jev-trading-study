import type { Bar } from './base.ts'
import { config } from './config.ts'
import { sha } from './jev.ts'
import { type Market, marketText, pairLabel } from './markets.ts'

const r1 = (x: number) => Math.round(x * 10) / 10
const r2 = (x: number) => Math.round(x * 100) / 100
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const std = (xs: number[]) => {
  const m = sum(xs) / xs.length
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / xs.length)
}

/**
 * What Jev sees at decision time T = bars[i].t + 60 (bars[i] is the last closed minute).
 * Relative numbers only: no timestamps, no dates, no absolute price. A backtest over the past must not let
 * the model recognise the period, and every logged state must be rebuildable from the bars (the parity check).
 */
export function buildState(m: Market, bars: Bar[], i: number) {
  if (i < config.lookbackMin || bars[i]!.t - bars[i - config.lookbackMin]!.t !== config.lookbackMin * 60) {
    throw new Error(`not enough contiguous history before bar ${i}`)
  }
  const c = bars[i]!.c
  const bps = (x: number) => (x / c - 1) * 1e4
  const win = (k: number) => bars.slice(i - k + 1, i + 1)
  const ret = (k: number) => r1((c / bars[i - k]!.c - 1) * 1e4)
  const oneMin = (k: number) => bars.slice(i - k, i + 1).map((b, j, a) => (j ? (b.c / a[j - 1]!.c - 1) * 1e4 : 0)).slice(1)
  const flow = (k: number) => {
    const w = win(k)
    const buy = sum(w.map((b) => b.buyUsd)), sell = sum(w.map((b) => b.sellUsd))
    return { buyUsd: Math.round(buy), sellUsd: Math.round(sell), netUsd: Math.round(buy - sell), buyShare: buy + sell ? r2(buy / (buy + sell)) : 0.5 }
  }
  const w60 = win(60)
  const vol15 = sum(win(15).map((b) => b.volUsd)), vol240 = sum(win(240).map((b) => b.volUsd))
  return {
    pair: pairLabel(m),
    returnsBps: { m1: ret(1), m5: ret(5), m15: ret(15), m60: ret(60), m240: ret(240) },
    path60: w60.map((b) => Math.round(bps(b.c))).join(' '),
    volatilityBps: { m60: r2(std(oneMin(60))), m240: r2(std(oneMin(240))) },
    rangeBps60: r1(bps(Math.max(...w60.map((b) => b.h))) - bps(Math.min(...w60.map((b) => b.l)))),
    flow: { m15: flow(15), m60: flow(60) },
    activity: { swaps15: sum(win(15).map((b) => b.n)), volumeUsd15: Math.round(vol15), volume15VsAvg4h: vol240 ? r2(vol15 / (vol240 / 16)) : 0 },
  }
}

export type State = ReturnType<typeof buildState>

const inputs = (m: Market) =>
  'Every number is relative to the current price, which is the last one-minute close. ' +
  '`returnsBps.mK` is the price change over the last K minutes, in basis points. ' +
  '`path60` lists the last 60 one-minute closes in basis points from the current price, oldest first; its last value is now (0). ' +
  '`volatilityBps` is the standard deviation of one-minute returns over 60 and 240 minutes. `rangeBps60` is the high-low range of the last hour. ' +
  `\`flow.mK\` is taker swap volume in USD over the last K minutes: \`buyUsd\` bought ${m.symbol} from the pool, \`sellUsd\` sold ${m.symbol} into it. ` +
  '`activity` counts swaps and compares the last 15 minutes of volume with the four-hour average.'

const question = (m: Market, h: number) => ({
  type: 'boolean',
  instructions: {
    question: `Will the ${m.symbol} price be higher than it is now after ${h} more minute${h > 1 ? 's' : ''}?`,
    market: marketText(m),
    inputs: inputs(m),
  },
  criteria: {
    true: `The price ${h} minute${h > 1 ? 's' : ''} from now is above the current price.`,
    false: `The price ${h} minute${h > 1 ? 's' : ''} from now is at or below the current price.`,
  },
})

/** One boolean per horizon, all in one request: same state, answered independently. */
export const questionsFor = (m: Market) => Object.fromEntries(config.horizonsMin.map((h) => [`up${h}`, question(m, h)]))

/** Any change to the questions changes this, and the report refuses to pool decisions across versions. */
export const promptVersion = (m: Market) => sha(questionsFor(m))
