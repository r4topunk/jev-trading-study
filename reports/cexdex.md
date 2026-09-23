# Arbitragem CEX-DEX na Base: quanto é, quem leva, quão rápido

Gerado 2026-09-23T19:03 UTC. Preço de referência: Binance, 1 s, no segundo anterior ao bloco,
convertido de USDT para USDC. Lucro por swap = preço executado (fee do pool incluída) contra essa referência.
"Remetente" = `sender` do evento Swap (o contrato que chamou o pool: um bot ou um router).

## ETH (Uniswap v3 0.05%, fee 5 bps), 2026-09-21

| | Valor |
|---|---|
| Swaps no dia / volume | 38,420 / $30,483,622 |
| Swaps com lucro contra a Binance **após a fee do pool** | 10,599 (27.6%), volume $16,195,059 |
| Lucro desses swaps, antes do hedge e do gás | **$3,524/dia**, mediana 0.96 bps por swap |
| Depois de 1 bp de hedge (tier VIP) | $2,250/dia |
| Depois de 7.5 bps de hedge (conta varejo) | $304/dia |
| Os mesmos swaps 5 s depois | $3,600 (quanto do lucro persiste) |
| Remetentes distintos com lucro | 117 |
| Fatia do lucro dos top 1 / 3 / 10 remetentes | 67.6% / 80.6% / 97.5% |
| Gaps acima de 6 bps (fee + 1) no dia | 2362; ficam abertos mediana 2 s, p90 4 s (1 bloco = 2 s) |

## SOL (Aerodrome Slipstream, fee 3.5 bps), 2026-09-21

| | Valor |
|---|---|
| Swaps no dia / volume | 15,718 / $7,471,733 |
| Swaps com lucro contra a Binance **após a fee do pool** | 8,546 (54.4%), volume $4,751,883 |
| Lucro desses swaps, antes do hedge e do gás | **$1,038/dia**, mediana 1.28 bps por swap |
| Depois de 1 bp de hedge (tier VIP) | $650/dia |
| Depois de 7.5 bps de hedge (conta varejo) | $69/dia |
| Os mesmos swaps 5 s depois | $1,137 (quanto do lucro persiste) |
| Remetentes distintos com lucro | 49 |
| Fatia do lucro dos top 1 / 3 / 10 remetentes | 47.6% / 90.4% / 99.1% |
| Gaps acima de 4.5 bps (fee + 1) no dia | 4513; ficam abertos mediana 2 s, p90 4 s (1 bloco = 2 s) |

**Não entra na conta:** o priority fee que os bots pagam ao sequencer para ficar na frente, as transações que
falharam (spam de arbitragem é comum na Base e só aparece como custo), o custo de capital e o inventário nas duas
pontas, e o risco de o hedge na CEX sair pior que o preço de 1 s.
