import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { config } from './config.ts'

type EvalResult = {
  answers: Record<string, { type: string; probability?: number }>
  inputTokens: number
  costUsd: number
  latencyMs: number
  generationId?: string
  cached: boolean
}

const CACHE = `${config.dataDir}cache/jev/`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const sha = (x: unknown) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16)

/**
 * POST /v1/evaluate on the Vercel AI Gateway. The model is deterministic, so identical bodies are cached on
 * disk; pass cache: false to measure drift. Retries 429/5xx and network errors 5 times, backoff capped at 8 s.
 */
export async function evaluate(state: unknown, questions: unknown, opts: { cache?: boolean } = {}): Promise<EvalResult> {
  if (!config.jev.key) throw new Error('VERCEL_AI_GATEWAY is not set')
  const body = JSON.stringify({ model: config.jev.model, state, questions })
  const file = `${CACHE}${sha(body)}.json`
  if (opts.cache !== false && existsSync(file)) {
    return { ...(JSON.parse(readFileSync(file, 'utf8')) as Omit<EvalResult, 'cached'>), cached: true }
  }

  let lastErr: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await sleep(Math.min(8000, 500 * 2 ** attempt) + Math.random() * 250)
    const t0 = performance.now()
    let res: Response
    try {
      res = await fetch(config.jev.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${config.jev.key}`, 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(config.jev.timeoutMs),
      })
    } catch (e) {
      lastErr = e
      continue
    }
    const text = await res.text()
    if (!res.ok) {
      lastErr = new Error(`jev ${res.status}: ${text.slice(0, 300)}`)
      if (res.status === 429 || res.status >= 500) continue
      throw lastErr
    }
    const raw = JSON.parse(text)
    const out: Omit<EvalResult, 'cached'> = {
      answers: raw.answers,
      inputTokens: raw.usage?.inputTokens ?? 0,
      costUsd: Number(raw.providerMetadata?.gateway?.marketCost ?? 0),
      latencyMs: Math.round(performance.now() - t0),
      generationId: raw.providerMetadata?.gateway?.generationId,
    }
    mkdirSync(CACHE, { recursive: true })
    writeFileSync(file, JSON.stringify(out))
    return { ...out, cached: false }
  }
  throw lastErr
}
