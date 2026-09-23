import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import type { Bar } from './base.ts'
import { marketDir } from './bars.ts'
import { evaluate, sha } from './jev.ts'
import { config } from './config.ts'
import type { Market } from './markets.ts'
import { buildState, promptVersion, questionsFor } from './state.ts'

/** One Jev call at decision time `t`. `p[h]` is P(price higher after h minutes). Outcomes are joined later from bars. */
export type Decision = {
  t: number
  prompt: string
  stateHash: string
  px: number
  p: Record<string, number>
  tokens: number
  costUsd: number
  latencyMs: number
  cached: boolean
  err?: string
}

const file = (m: Market) => `${marketDir(m)}decisions-backtest.jsonl`

export function loadDecisions(m: Market): Decision[] {
  if (!existsSync(file(m))) return []
  const byT = new Map<number, Decision>()
  for (const line of readFileSync(file(m), 'utf8').split('\n')) {
    if (!line) continue
    const d = JSON.parse(line) as Decision
    if (!d.err || !byT.has(d.t)) byT.set(d.t, d) // a later success replaces an earlier error
  }
  return [...byT.values()].sort((a, b) => a.t - b.t)
}

export function appendDecision(m: Market, d: Decision) {
  mkdirSync(marketDir(m), { recursive: true })
  appendFileSync(file(m), JSON.stringify(d) + '\n')
}

/** Is bars[i] the last closed minute before a decision time on this cadence? */
export const isDecisionBar = (bars: Bar[], i: number, everyMin = config.decisionEveryMin) => ((bars[i]!.t + 60) / 60) % everyMin === 0

export async function decide(m: Market, bars: Bar[], i: number, opts: { cache?: boolean } = {}): Promise<Decision> {
  const state = buildState(m, bars, i)
  const base = { t: bars[i]!.t + 60, prompt: promptVersion(m), stateHash: sha(state), px: bars[i]!.c }
  try {
    const r = await evaluate(state, questionsFor(m), opts)
    const p: Record<string, number> = {}
    for (const h of config.horizonsMin) {
      const prob = r.answers[`up${h}`]?.probability
      if (typeof prob !== 'number') throw new Error(`no probability for up${h}: ${JSON.stringify(r.answers).slice(0, 200)}`)
      p[h] = prob
    }
    return { ...base, p, tokens: r.inputTokens, costUsd: r.cached ? 0 : r.costUsd, latencyMs: r.latencyMs, cached: r.cached }
  } catch (e) {
    return { ...base, p: {}, tokens: 0, costUsd: 0, latencyMs: 0, cached: false, err: String((e as Error).message ?? e) }
  }
}
