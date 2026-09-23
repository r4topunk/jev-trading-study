// Markets under test. Selection rule (EXPERIMENT.md, phase 0b), fixed before any Jev call on them:
// Uniswap v3 or Aerodrome Slipstream pool (same Swap event), quoted in USDC or WETH, >= 90 days old, no
// stablecoins, ETH derivatives or tokenized stocks, one pool per token, top 6 by 24h USD volume on
// GeckoTerminal 2026-09-23. Tokens, decimals and fee read on-chain the same day.

export type Market = {
  id: string
  symbol: string
  pool: `0x${string}`
  venue: string
  /** Which pool token is the asset; the other one is the quote. */
  target: 0 | 1
  decimals: [number, number]
  quote: 'USDC' | 'WETH'
  /** Pool fee at selection time. Slipstream fees are dynamic, so this is an approximation. */
  feeBps: number
  /** Assumed price impact per paper swap of ~$10k. */
  slippageBps: number
}

export const MARKETS: Market[] = [
  { id: 'eth', symbol: 'ETH', pool: '0xd0b53D9277642d899DF5C87A3966A349A798F224', venue: 'Uniswap v3 0.05%', target: 0, decimals: [18, 6], quote: 'USDC', feeBps: 5, slippageBps: 1 },
  { id: 'cbbtc', symbol: 'cbBTC', pool: '0x7c7420dd105e2779316423ba3e973f434315efa9', venue: 'Aerodrome Slipstream', target: 1, decimals: [18, 8], quote: 'WETH', feeBps: 0.85, slippageBps: 2 },
  { id: 'sol', symbol: 'SOL', pool: '0x1131db5977242a03ebead1acd18f80a9a29e5922', venue: 'Aerodrome Slipstream', target: 0, decimals: [9, 6], quote: 'USDC', feeBps: 3.5, slippageBps: 5 },
  { id: 'zen', symbol: 'ZEN', pool: '0x0392b12a1ceb0cd13af5ea448cf5586ea609852d', venue: 'Aerodrome Slipstream', target: 1, decimals: [18, 18], quote: 'WETH', feeBps: 15, slippageBps: 10 },
  { id: 'vvv', symbol: 'VVV', pool: '0xa135b59fe221c0c8d441294f97f96fbc37bc9fbe', venue: 'Aerodrome Slipstream', target: 1, decimals: [18, 18], quote: 'WETH', feeBps: 27, slippageBps: 10 },
  { id: 'cbxrp', symbol: 'cbXRP', pool: '0xb90fe999be6869af0afc557dccfbe169ea3403d6', venue: 'Aerodrome Slipstream', target: 1, decimals: [18, 6], quote: 'WETH', feeBps: 5, slippageBps: 10 },
  { id: 'virtual', symbol: 'VIRTUAL', pool: '0x3f0296bf652e19bca772ec3df08b32732f93014a', venue: 'Aerodrome Slipstream', target: 0, decimals: [18, 18], quote: 'WETH', feeBps: 1, slippageBps: 10 },
]

export const ETH = MARKETS[0]!

export function market(id: string): Market {
  const m = MARKETS.find((x) => x.id === id)
  if (!m) throw new Error(`unknown market ${id}; one of ${MARKETS.map((x) => x.id).join(', ')}`)
  return m
}

/** ETH keeps the exact phase 0 wording, so its prompt hash and its 30 days of decisions stay valid. */
export const pairLabel = (m: Market) => (m.quote === 'USDC' ? `${m.symbol}/USDC` : `${m.symbol}/USD`)
export const marketText = (m: Market) =>
  m.quote === 'USDC'
    ? `${m.symbol}/USDC spot on the ${m.venue} pool on Base.`
    : `${m.symbol} spot on Base, priced in USD. It trades on the ${m.venue} ${m.symbol}/WETH pool.`

/** One paper swap: pool fee + impact, plus the WETH/USDC hop when the pool is quoted in WETH. */
export const sideCostBps = (m: Market) => m.feeBps + m.slippageBps + (m.quote === 'WETH' ? ETH.feeBps + ETH.slippageBps : 0)
