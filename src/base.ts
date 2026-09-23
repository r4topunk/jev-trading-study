import { createPublicClient, type GetLogsReturnType, http, parseAbiItem } from 'viem'
import { base } from 'viem/chains'
import { config } from './config.ts'
import type { Market } from './markets.ts'

/**
 * One minute of swaps. `t` is the unix second the minute starts; `c` is the pool price after its last swap.
 * On disk, prices and volumes are in the pool's quote token (USDC or WETH); loadBars converts to USD.
 */
export type Bar = { t: number; o: number; h: number; l: number; c: number; n: number; volUsd: number; buyUsd: number; sellUsd: number }

// Uniswap v3 and Aerodrome Slipstream emit the same event.
const SWAP = parseAbiItem(
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
)

export const client = createPublicClient({
  chain: base,
  transport: http(config.rpcUrl, { retryCount: 6, retryDelay: 750, timeout: 60_000 }),
})

/** Base blocks are exactly 2 s apart, so one reference block maps every block number to its timestamp. */
export type Clock = { refBlock: bigint; refTs: number }

export async function clock(): Promise<Clock> {
  const b = await withRetry(() => client.getBlock({ blockTag: 'latest' }))
  return { refBlock: b.number, refTs: Number(b.timestamp) }
}

export const tsOf = (c: Clock, block: bigint) => c.refTs - Number(c.refBlock - block) * config.blockSeconds

/** First block whose timestamp is >= ts. */
export const blockAt = (c: Clock, ts: number) => c.refBlock - BigInt(Math.floor((c.refTs - ts) / config.blockSeconds))

const tooLarge = (e: unknown) => /response too large|exceeded the size limit|-32020/.test(String((e as Error)?.message ?? e) + String((e as { code?: number })?.code ?? ''))

/** The public RPC answers `-32016 over rate limit` inside a 200, which viem does not retry. */
export async function withRetry<T>(f: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await f()
    } catch (e) {
      if (attempt >= 7 || tooLarge(e)) throw e
      await new Promise((r) => setTimeout(r, Math.min(16_000, 1000 * 2 ** attempt) + Math.random() * 500))
    }
  }
}

/** The RPC caps the response size too (`-32020`): split by pool first, then halve the block range. */
export async function getSwapLogs(pools: `0x${string}`[], fromBlock: bigint, toBlock: bigint): Promise<SwapLog[]> {
  try {
    return await withRetry(() => client.getLogs({ address: pools, event: SWAP, fromBlock, toBlock, strict: true }))
  } catch (e) {
    if (!tooLarge(e)) throw e
    if (pools.length > 1) {
      const half = Math.ceil(pools.length / 2)
      return [...(await getSwapLogs(pools.slice(0, half), fromBlock, toBlock)), ...(await getSwapLogs(pools.slice(half), fromBlock, toBlock))]
    }
    if (toBlock <= fromBlock) throw e
    const mid = (fromBlock + toBlock) / 2n
    return [...(await getSwapLogs(pools, fromBlock, mid)), ...(await getSwapLogs(pools, mid + 1n, toBlock))]
  }
}

type SwapLog = GetLogsReturnType<typeof SWAP, [typeof SWAP], true>[number]

/** Asset price in quote units from sqrtPriceX96 = sqrt(token1/token0) in raw units. */
function priceOf(m: Market, sqrtPriceX96: bigint) {
  const p01 = (Number(sqrtPriceX96) / 2 ** 96) ** 2 * 10 ** (m.decimals[0] - m.decimals[1])
  return m.target === 0 ? p01 : 1 / p01
}

/**
 * Swaps of several pools in minutes [fromMin, toMin), one eth_getLogs for all of them, folded into one bar
 * per pool per minute that had at least one swap.
 */
export async function fetchSwapBars(c: Clock, markets: Market[], fromMin: number, toMin: number): Promise<Map<string, Bar[]>> {
  const byPool = new Map(markets.map((m) => [m.pool.toLowerCase(), m]))
  const logs = await getSwapLogs(markets.map((m) => m.pool), blockAt(c, fromMin * 60), blockAt(c, toMin * 60) - 1n)
  const bars = new Map(markets.map((m) => [m.id, new Map<number, Bar>()]))
  for (const log of logs) {
    const m = byPool.get(log.address.toLowerCase())
    if (!m) continue
    const t = Math.floor(tsOf(c, log.blockNumber) / 60) * 60
    const { amount0, amount1, sqrtPriceX96 } = log.args
    const px = priceOf(m, sqrtPriceX96)
    const [amtTarget, amtQuote] = m.target === 0 ? [amount0, amount1] : [amount1, amount0]
    const q = Math.abs(Number(amtQuote)) / 10 ** m.decimals[m.target === 0 ? 1 : 0]
    const mb = bars.get(m.id)!
    let b = mb.get(t)
    if (!b) mb.set(t, (b = { t, o: px, h: px, l: px, c: px, n: 0, volUsd: 0, buyUsd: 0, sellUsd: 0 }))
    b.h = Math.max(b.h, px)
    b.l = Math.min(b.l, px)
    b.c = px
    b.n++
    b.volUsd += q
    // The pool paid the asset out: the taker bought it.
    if (amtTarget < 0n) b.buyUsd += q
    else b.sellUsd += q
  }
  return new Map([...bars].map(([id, mb]) => [id, [...mb.values()]]))
}
