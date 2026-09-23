import type { Book, Prop } from './venues.ts'

const STOP = new Set('the a an of in on at to for by will be is are was and or vs v who what which win wins winner market resolve resolves yes no before after than from with this that 2025 2026 2027'.split(' '))
const tokens = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t))

/**
 * Cheap candidate generation before any Jev call: TF-IDF cosine on titles, restricted to markets that close
 * within a few days of each other (3 for sports, 60 otherwise). Dates and numbers stay in code: Jev is bad at them.
 */
export function candidates(left: Prop[], right: Prop[], k = 3, minScore = 0.3) {
  const docs = right.map((p) => tokens(`${p.title} ${p.yes}`))
  const df = new Map<string, number>()
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)
  const idf = (t: string) => Math.log((right.length + 1) / ((df.get(t) ?? 0) + 1))
  const vec = (ts: string[]) => {
    const v = new Map<string, number>()
    for (const t of ts) v.set(t, (v.get(t) ?? 0) + idf(t))
    const norm = Math.sqrt([...v.values()].reduce((a, x) => a + x * x, 0)) || 1
    return { v, norm }
  }
  const rv = docs.map(vec)
  const index = new Map<string, number[]>()
  docs.forEach((d, j) => new Set(d).forEach((t) => (index.get(t) ?? index.set(t, []).get(t)!).push(j)))

  const pairs: { a: Prop; b: Prop; score: number }[] = []
  for (const a of left) {
    const q = vec(tokens(`${a.title} ${a.yes}`))
    const acc = new Map<number, number>()
    for (const [t, w] of q.v) for (const j of index.get(t) ?? []) acc.set(j, (acc.get(j) ?? 0) + w * rv[j]!.v.get(t)!)
    const window = (a.sports ? 3 : 60) * 86400
    ;[...acc]
      .map(([j, dot]) => ({ j, score: dot / (q.norm * rv[j]!.norm) }))
      .filter(({ j, score }) => score >= minScore && Math.abs(right[j]!.end - a.end) <= window)
      .sort((x, y) => y.score - x.score)
      .slice(0, k)
      .forEach(({ j, score }) => pairs.push({ a, b: right[j]!, score }))
  }
  return pairs
}

const side = (p: Prop) => ({ venue: p.venue, question: p.title, yesPaysIf: p.yes, noPaysIf: p.no, closes: new Date(p.end * 1000).toISOString().slice(0, 16), rules: p.rules })
export const pairState = (a: Prop, b: Prop) => ({ a: side(a), b: side(b) })

/** Two judgments per pair, in one request. The relation is semantic; the arbitrage itself is arithmetic, in code. */
export const PAIR_QUESTIONS = {
  relation: {
    type: 'choice',
    instructions: 'How does the YES outcome of market `a` relate to the YES outcome of market `b`? Read `question`, `yesPaysIf`, `noPaysIf` and `rules` of both.',
    criteria: {
      same: 'Same real-world outcome: `a` YES pays exactly when `b` YES pays (same event, same participant or threshold, same period).',
      opposite: 'Swapped outcomes of the same event: `a` YES pays exactly when `b` NO pays, for example the two sides of one match.',
      related: 'Same event or topic but not equivalent: a different threshold, date, participant, map, round, scope or market type.',
      unrelated: 'Different events.',
    },
  },
  rulesAgree: {
    type: 'boolean',
    instructions:
      'Given both `rules`, would `a` and `b` settle consistently with each other in every realistic scenario, including cancellation, postponement, walkover, retirement, a draw, overtime, a different data source or a different cutoff time?',
    criteria: {
      true: 'Every realistic scenario settles them the same way (or exactly opposite, if they are swapped outcomes).',
      false: 'Some realistic scenario (cancellation, a draw, another source, another cutoff) settles them inconsistently, or the rules are too vague to tell.',
    },
  },
}

type Leg = { venue: string; buy: 'YES' | 'NO'; levels: [number, number][]; feeRate: number }

/** Price levels to buy YES (the YES asks) or NO (1 - YES bids, same sizes). */
const levels = (b: Book, buy: 'YES' | 'NO'): [number, number][] => (buy === 'YES' ? b.asks : b.bids.map(([p, s]) => [1 - p, s] as [number, number]))
const fee = (rate: number, p: number) => rate * Math.min(p, 1 - p)

/**
 * Buys one leg on each venue so that exactly one pays $1 at settlement. Walks both books level by level while
 * the marginal pair still costs less than $1 after fees. Returns the best direction.
 */
export function arbitrage(a: Prop, ba: Book, b: Prop, bb: Book, relation: 'same' | 'opposite') {
  const dirs: [Leg, Leg][] =
    relation === 'same'
      ? [
          [{ venue: a.venue, buy: 'YES', levels: levels(ba, 'YES'), feeRate: a.feeRate }, { venue: b.venue, buy: 'NO', levels: levels(bb, 'NO'), feeRate: b.feeRate }],
          [{ venue: a.venue, buy: 'NO', levels: levels(ba, 'NO'), feeRate: a.feeRate }, { venue: b.venue, buy: 'YES', levels: levels(bb, 'YES'), feeRate: b.feeRate }],
        ]
      : [
          [{ venue: a.venue, buy: 'YES', levels: levels(ba, 'YES'), feeRate: a.feeRate }, { venue: b.venue, buy: 'YES', levels: levels(bb, 'YES'), feeRate: b.feeRate }],
          [{ venue: a.venue, buy: 'NO', levels: levels(ba, 'NO'), feeRate: a.feeRate }, { venue: b.venue, buy: 'NO', levels: levels(bb, 'NO'), feeRate: b.feeRate }],
        ]
  let best = { legs: '', topCost: Infinity, shares: 0, spend: 0, profit: 0 }
  for (const [l1, l2] of dirs) {
    const top = (l1.levels[0]?.[0] ?? 1) + (l2.levels[0]?.[0] ?? 1)
    const q1 = l1.levels.map((x) => [...x] as [number, number]), q2 = l2.levels.map((x) => [...x] as [number, number])
    let shares = 0, spend = 0
    while (q1.length && q2.length) {
      const [p1, s1] = q1[0]!, [p2, s2] = q2[0]!
      const unit = p1 + p2 + fee(l1.feeRate, p1) + fee(l2.feeRate, p2)
      if (unit >= 1) break
      const s = Math.min(s1, s2)
      shares += s
      spend += s * unit
      q1[0]![1] -= s
      q2[0]![1] -= s
      if (q1[0]![1] <= 1e-9) q1.shift()
      if (q2[0]![1] <= 1e-9) q2.shift()
    }
    const cand = { legs: `${l1.venue} ${l1.buy} + ${l2.venue} ${l2.buy}`, topCost: top, shares, spend, profit: shares - spend }
    if (cand.profit > best.profit || (best.profit === 0 && cand.topCost < best.topCost)) best = cand
  }
  return best
}
