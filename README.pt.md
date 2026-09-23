# Jev na Base: estudo de trading (PT)

English: [README.md](README.md). Página interativa: https://r4topunk.github.io/jev-trading-study/

Mede se o Jev (`typesafe-ai/jev`) prevê a direção do preço em quatro mercados da Base (ETH, cbBTC, SOL, VIRTUAL). Sem carteira, sem chave
privada, sem ordem: lê os swaps on-chain, pergunta ao Jev, loga, e compara com o que o preço fez.
Protocolo, critérios e riscos: [EXPERIMENT.md](EXPERIMENT.md).

## TL;DR

```sh
pnpm install
node scripts/backfill.ts --days 90                                   # todos os mercados de src/markets.ts, ~25 min no RPC público
node scripts/backtest.ts --market eth --days 90 --every 15 --max-usd 0.8   # ~$0.67 por mercado (preço de tabela), retomável
node scripts/report.ts --market eth                                  # → reports/eth-backtest.md
node scripts/compare.ts                                              # → reports/markets.md (por mercado, agregado, regimes)
node scripts/drift.ts --market eth                                   # modelo mudou? (10 canários, sem cache)
node scripts/live.ts --market eth                                    # forward paper
node scripts/lp-markout.ts                                           # economia de LP: fee vs. markout na Binance 1 s → reports/lp-markout.md
```

Mercados: `eth`, `cbbtc`, `sol`, `virtual` (e `zen`, `vvv`, `cbxrp`, excluídos por qualidade de dado).
Dados por mercado em `data/<mercado>/`.

Requisitos: Node ≥ 23.6 (roda `.ts` direto) e uma chave do Vercel AI Gateway em `VERCEL_AI_GATEWAY`.

## Fluxo

```
Base RPC ──eth_getLogs(Swap)──▶ bars.jsonl (1 min: mid, volume, fluxo compra/venda)
                                   │
                  buildState(bars, i)  ← só números relativos, sem data nem preço absoluto
                                   │
                    Jev /v1/evaluate: 4 booleanos P(alta em 1/5/15/60 min)
                                   │
                    decisions-{backtest,live}.jsonl
                                   │
      report.ts: junta outcome das barras → AUC, Brier, calibração, baselines, paper long/flat → veredito
```

## Arquivos

| Caminho | O quê |
|---|---|
| `src/config.ts` | Horizontes, cadência, regra de dado. Os valores pré-registrados estão marcados |
| `src/markets.ts` | Pools, orientação token0/token1, decimais, fee, regra de seleção |
| `src/analysis.ts` | Métricas por mercado e veredito pré-registrado (usado por report e compare) |
| `src/base.ts` | viem, decode do `Swap`, relógio de bloco (2 s), barras por minuto |
| `src/bars.ts` | `bars.jsonl`: carga, sync retomável que preenche buracos |
| `src/state.ts` | Estado e perguntas do Jev; `PROMPT_VERSION` = hash das perguntas |
| `src/jev.ts` | Client HTTP do gateway: cache em disco, retry, custo |
| `src/decisions.ts` | Uma decisão = uma chamada; formato do log |
| `src/metrics.ts` | AUC, Brier, bootstrap, simulador long/flat com custo |
| `scripts/*.ts` | backfill, backtest, live, report, compare, drift, lp-markout, cexdex, site-data |
| `scripts/audit/*.ts` | controle positivo, sinal do fluxo, resultado medido na Binance, Jev invertido |
| `arb/` | Scanner só de leitura Limitless × Polymarket |
| `docs/` | Site do GitHub Pages (HTML, CSS e JS puros, sem build) |

## Ambiente

| Variável | Padrão | Nota |
|---|---|---|
| `VERCEL_AI_GATEWAY` | (nenhum) | Única credencial |
| `BASE_RPC_URL` | `https://mainnet.base.org` | Público: 2.000 blocos por `getLogs` e rate limit. Alchemy/QuickNode aceleram o backfill |
| `RPC_CONCURRENCY` | 2 | Suba com RPC dedicado |
| `JEV_CONCURRENCY` | 6 | Requests simultâneos no backtest |

## Observabilidade

- Cada decisão guarda `stateHash`, `prompt`, `tokens`, `costUsd`, `latencyMs` e, no live, `lagMs`.
- O relatório mostra paridade de estado, gasto, latência p50/p95 e erros.
