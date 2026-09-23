const env = (k: string) => process.env[k] || undefined

export const config = {
  rpcUrl: env('BASE_RPC_URL') ?? 'https://mainnet.base.org',
  blockSeconds: 2,
  // The public RPC caps eth_getLogs at 2,000 blocks; 66 minutes = 1,980 blocks.
  chunkMinutes: 66,
  rpcConcurrency: Number(env('RPC_CONCURRENCY') ?? 2),

  // Pre-registered in EXPERIMENT.md. Changing any of these starts a new experiment.
  lookbackMin: 240,
  /** Default backtest cadence. Phase 0b passes --every 15: same independent 15m samples, 1/3 of the cost. */
  decisionEveryMin: 5,
  horizonsMin: [1, 5, 15, 60],
  primaryHorizonMin: 15,
  /** A market with more minutes than this without a single swap is excluded (data quality, phase 0b). */
  maxEmptyMinuteShare: 0.25,

  gasUsd: 0.01,
  paperUsd: 10_000,

  jev: {
    url: env('JEV_URL') ?? 'https://ai-gateway.vercel.sh/v1/evaluate',
    model: env('JEV_MODEL') ?? 'typesafe-ai/jev',
    key: env('VERCEL_AI_GATEWAY') ?? env('AI_GATEWAY_API_KEY') ?? '',
    concurrency: Number(env('JEV_CONCURRENCY') ?? 6),
    timeoutMs: 15_000,
  },

  dataDir: new URL('../data/', import.meta.url).pathname,
  reportsDir: new URL('../reports/', import.meta.url).pathname,
}
