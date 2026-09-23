import { config } from './config.ts'

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
export const sd = (xs: number[]) => {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

export function quantile(xs: number[], q: number) {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]!
}

/** Seeded PRNG (mulberry32) so bootstraps and the coin-flip baseline are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Average ranks, ties shared. */
function ranks(xs: number[]) {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!)
  const r = new Array<number>(xs.length)
  for (let i = 0; i < idx.length; ) {
    let j = i
    while (j + 1 < idx.length && xs[idx[j + 1]!] === xs[idx[i]!]) j++
    for (let k = i; k <= j; k++) r[idx[k]!] = (i + j) / 2 + 1
    i = j + 1
  }
  return r
}

/** ROC AUC via Mann-Whitney U. 0.5 = no discrimination, threshold-free and immune to the up/down base rate. */
export function auc(scores: number[], labels: boolean[]) {
  const r = ranks(scores)
  let pos = 0, rankSum = 0
  for (let i = 0; i < labels.length; i++) if (labels[i]) (pos++, (rankSum += r[i]!))
  const neg = labels.length - pos
  return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : NaN
}

export function spearman(x: number[], y: number[]) {
  const rx = ranks(x), ry = ranks(y)
  const mx = mean(rx), my = mean(ry)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < x.length; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my)
    dx += (rx[i]! - mx) ** 2
    dy += (ry[i]! - my) ** 2
  }
  return num / Math.sqrt(dx * dy)
}

export const brier = (p: number[], y: boolean[]) => mean(p.map((pi, i) => (pi - (y[i] ? 1 : 0)) ** 2))

export const logloss = (p: number[], y: boolean[]) =>
  mean(p.map((pi, i) => {
    const q = Math.min(1 - 1e-6, Math.max(1e-6, pi))
    return -(y[i] ? Math.log(q) : Math.log(1 - q))
  }))

/** Percentile bootstrap, iid over (already non-overlapping) samples. `alpha` 0.05 gives a 95% interval. */
export function bootstrap(n: number, stat: (idx: number[]) => number, alpha = 0.05, B = 2000, seed = 7): [number, number] {
  const rand = rng(seed)
  const vals: number[] = []
  for (let b = 0; b < B; b++) {
    const idx = Array.from({ length: n }, () => Math.floor(rand() * n))
    const v = stat(idx)
    if (Number.isFinite(v)) vals.push(v)
  }
  return [quantile(vals, alpha / 2), quantile(vals, 1 - alpha / 2)]
}

/** Cluster bootstrap: resamples whole groups (e.g. every market's row at one timestamp), keeping their correlation. */
export function clusterBootstrap(groups: number[][], stat: (idx: number[]) => number, alpha = 0.05, B = 2000, seed = 11): [number, number] {
  const rand = rng(seed)
  const vals: number[] = []
  for (let b = 0; b < B; b++) {
    const idx: number[] = []
    for (let g = 0; g < groups.length; g++) idx.push(...groups[Math.floor(rand() * groups.length)]!)
    const v = stat(idx)
    if (Number.isFinite(v)) vals.push(v)
  }
  return [quantile(vals, alpha / 2), quantile(vals, 1 - alpha / 2)]
}

export function pearson(x: number[], y: number[]) {
  const mx = mean(x), my = mean(y)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < x.length; i++) {
    num += (x[i]! - mx) * (y[i]! - my)
    dx += (x[i]! - mx) ** 2
    dy += (y[i]! - my) ** 2
  }
  return num / Math.sqrt(dx * dy)
}

/** One-sided upper tail of the standard normal (Abramowitz-Stegun 7.1.26, |err| < 1.5e-7). */
export function normalSf(z: number) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x)
  return z >= 0 ? erfc / 2 : 1 - erfc / 2
}

type Step = { ret: number; long: boolean; contiguous: boolean }

/**
 * Base spot, long or flat (a DEX swap cannot short). Each step holds for one horizon. Every position change
 * is one swap: fee + slippage on the notional plus gas. A gap in the decisions forces a close; the book is
 * flat at the end so every strategy pays for its exit.
 */
export function longFlat(steps: Step[], sideBps: number, withCosts = true) {
  let eq = config.paperUsd, peak = eq, maxDd = 0, trades = 0, costs = 0, pos = false
  const swap = () => {
    trades++
    if (!withCosts) return
    const c = (eq * sideBps) / 1e4 + config.gasUsd
    eq -= c
    costs += c
  }
  for (const s of steps) {
    if (s.long !== pos) (swap(), (pos = s.long))
    if (pos) eq *= 1 + s.ret
    peak = Math.max(peak, eq)
    maxDd = Math.max(maxDd, 1 - eq / peak)
    if (!s.contiguous && pos) (swap(), (pos = false))
  }
  if (pos) swap()
  return { retPct: (eq / config.paperUsd - 1) * 100, trades, costPct: (costs / config.paperUsd) * 100, maxDdPct: maxDd * 100 }
}

/** L2-regularised logistic regression by gradient descent on standardised features; returns P(y = 1 | x). */
export function logistic(X: number[][], y: number[]) {
  const d = X[0]!.length, mu = Array(d).fill(0), sg = Array(d).fill(0)
  for (let j = 0; j < d; j++) { mu[j] = mean(X.map((x) => x[j]!)); sg[j] = Math.sqrt(mean(X.map((x) => (x[j]! - mu[j]) ** 2))) || 1 }
  const Z = (x: number[]) => x.map((v, j) => (v - mu[j]) / sg[j])
  const Xs = X.map(Z); let w = Array(d + 1).fill(0)
  for (let it = 0; it < 300; it++) {
    const g = Array(d + 1).fill(0)
    Xs.forEach((x, i) => { const p = 1 / (1 + Math.exp(-(w[d] + x.reduce((a, v, j) => a + v * w[j], 0)))); const e = p - y[i]!; x.forEach((v, j) => (g[j] += e * v)); g[d] += e })
    w = w.map((wj, j) => wj - (0.5 * g[j]) / Xs.length - (j < d ? 1e-3 * wj : 0))
  }
  return (x: number[]) => { const z = Z(x); return 1 / (1 + Math.exp(-(w[d] + z.reduce((a, v, j) => a + v * w[j], 0)))) }
}
