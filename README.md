# Jev on Base: a trading study

**Interactive write-up (EN/PT): https://r4topunk.github.io/jev-trading-study/** · Português: [README.pt.md](README.pt.md)

Viral posts show [Jev](https://vercel.com/docs/ai-gateway/modalities/evaluation) (`typesafe-ai/jev`, a fast calibrated
decision model) trading crypto every block. None of them measure whether its calls are right. This repository does:
a pre-registered paper test on four Base markets over 90 days, every decision scored against what the price did next.
No wallet, no private key, no orders.

## Result

Jev's probability that the price rises in 15 minutes separates rises from falls **worse than a coin flip**.

| Market | Decisions scored (15 min) | AUC | 95% interval |
|---|---|---|---|
| ETH | 8,624 | 0.465 | 0.452 – 0.477 |
| cbBTC | 8,624 | 0.466 | 0.454 – 0.477 |
| SOL | 8,624 | 0.475 | 0.463 – 0.487 |
| VIRTUAL | 8,624 | 0.490 | 0.479 – 0.502 |
| **All four** | 34,496 | **0.475** | 0.468 – 0.482 |

- **What it does:** Jev follows the trend. Its P(up) has rank correlation ~0.75 with the past 15–60 minutes of
  price and flow. Base pool prices mean-revert over that horizon, so following the trend loses. Across 12
  market-months, Jev's AUC tracks momentum's (r = 0.72).
- **Audits:**
  - A positive control (leaking the real outcome) scores AUC 1.000.
  - Scoring against Binance instead of the pool gives 0.453.
  - Two independent projects found the same pattern.
- **Flipped:** it is a weaker copy of a free logistic regression. It stays far from the hit rate that taker
  costs on Base require: 88% on ETH, 94% on SOL, and more than 100% on cbBTC and VIRTUAL.
- **Around it:**
  - Limitless mirrors Polymarket within 0.1¢.
  - LP fees roughly equal adverse selection.
  - CEX-DEX arbitrage is real money, but an oligopoly that closes gaps within one block.

The protocol, all results and the audit are in [EXPERIMENT.md](EXPERIMENT.md) (Portuguese) and [reports/](reports).

## Run it

Node ≥ 23.6 (runs `.ts` directly), pnpm, and a Vercel AI Gateway key in `VERCEL_AI_GATEWAY`.

```sh
pnpm install
node scripts/backfill.ts --days 90                                        # Swap logs → 1-min bars, all markets (~25 min on the public RPC)
node scripts/backtest.ts --market eth --days 90 --every 15 --max-usd 0.8  # replay through Jev, resumable, budget-capped
node scripts/report.ts --market eth                                       # → reports/eth-backtest.md
node scripts/compare.ts                                                   # → reports/markets.md: per market, pooled, regimes
node scripts/drift.ts --market eth                                        # did the model change? (10 canaries, no cache)
node scripts/audit/positive.ts                                            # positive control (200 Jev calls)
node scripts/audit/cex.ts                                                 # re-score against Binance (no Jev calls)
node scripts/audit/flip.ts                                                # flipped Jev vs free models, out of sample
node scripts/lp-markout.ts                                                # LP economics: fees vs markout (no Jev)
node scripts/cexdex.ts                                                    # CEX-DEX arbitrage: size, concentration, speed
node arb/scan.ts                                                          # Limitless × Polymarket, read-only
node scripts/site-data.ts                                                 # → docs/data/study.json for the page
```

Markets live in [`src/markets.ts`](src/markets.ts); adding a pool is one line. The public Base RPC works but caps
`eth_getLogs` at 2,000 blocks and rate-limits. Set `BASE_RPC_URL` to a dedicated endpoint to go faster.

## Layout

| Path | What |
|---|---|
| `src/markets.ts` | Pools, token orientation, decimals, fees, selection rule |
| `src/base.ts`, `src/bars.ts` | Base RPC, Swap decoding, resumable one-minute bars |
| `src/state.ts` | What Jev sees (relative numbers only) and the questions; prompt version = hash of the questions |
| `src/jev.ts`, `src/decisions.ts` | Gateway client with cache and retries; one call per decision |
| `src/analysis.ts`, `src/metrics.ts` | AUC, Brier, bootstrap (plain and clustered), long/flat simulator, pre-registered verdict |
| `scripts/`, `scripts/audit/` | Backfill, backtest, live, reports, drift, audits, LP, CEX-DEX, site data |
| `arb/` | Read-only cross-venue prediction-market scanner |
| `docs/` | The GitHub Pages site: plain HTML, CSS and JS, no build step |

## Caveats

- **Research, not financial advice.** Paper results only.
- **Jev's version cannot be pinned**, and repeated calls on the same input vary by up to ±0.04.
- **Costs are gateway list prices** (`marketCost`). During the study the gateway reported `cost: "0"`.
- **Prediction markets:** trading on them depends on local law. `arb/` only reads public data, and `ARB_DNS` is optional.

MIT licensed.
