# Jev na Base: ETH, backtest

Gerado 2026-09-23T20:41 UTC. Pool Uniswap v3 0.05% `0xd0b53D9277642d899DF5C87A3966A349A798F224` (USDC). Período 2026-06-25 19:45 .. 2026-09-23 15:45 UTC,
14353 decisões a cada ~5 min (0 erros). Prompt `619f3715ca0cfab4`.
Gasto Jev $1.1073. Latência p50 433 ms, p95 607 ms.
Paridade de estado 14353/14353. Minutos sem swap 2.3%.

## Veredito pré-registrado (horizonte 15m)

**FALHA (invertido)**: AUC 0.465 [0.452, 0.477] abaixo de 0.5. Invertido daria 0.535; mean-reversion grátis 0.522.

## Skill por horizonte (amostras sem sobreposição)

| h | n | alta% | acerto | acaso | p | AUC [IC 95.0%] | momentum | mean-rev | moeda | BSS clim | IC Spearman |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1m | 14353 | 50.8% | 48.7% | 50.1% | 0.999 | 0.491 [0.482, 0.500] | 0.603 | 0.397 | 0.509 | -0.018 | -0.003 |
| 5m | 14353 | 50.0% | 48.5% | 50.0% | 1.000 | 0.485 [0.476, 0.495] | 0.518 | 0.482 | 0.500 | -0.035 | -0.022 |
| 15m | 8624 | 50.6% | 47.5% | 50.0% | 1.000 | 0.465 [0.452, 0.477] | 0.478 | 0.522 | 0.488 | -0.071 | -0.053 |
| 60m | 2156 | 50.2% | 46.5% | 50.0% | 0.999 | 0.462 [0.438, 0.488] | 0.464 | 0.536 | 0.500 | -0.083 | -0.053 |

- **acaso**: acerto de um chute sem informação com o mesmo mix alta/baixa do Jev. **p**: unilateral, acerto > acaso.
- **AUC** é a métrica primária: 0.5 = não discrimina, não depende da taxa de alta do período.
- Horizontes que não são o primário são exploratórios: com 4 testes, só conta p < 0.0125 (Bonferroni).

## Forma das probabilidades

| h | p10 | p50 | p90 | indecisas (\|p−0.5\| < 0.05) | confiantes (\|p−0.5\| ≥ 0.1) | acerto nas confiantes | log loss vs clima |
|---|---|---|---|---|---|---|---|
| 1m | 0.41 | 0.51 | 0.56 | 52.7% | 754 | 48.8% | 0.702 vs 0.693 |
| 5m | 0.37 | 0.49 | 0.58 | 32.2% | 2944 | 49.3% | 0.711 vs 0.693 |
| 15m | 0.34 | 0.49 | 0.61 | 24.6% | 3629 | 46.0% | 0.730 vs 0.693 |
| 60m | 0.33 | 0.47 | 0.61 | 12.9% | 1029 | 46.0% | 0.736 vs 0.693 |

## Calibração (15m)

| faixa de P(alta) | n | P média | alta observada |
|---|---|---|---|
| 0.00–0.30 | 144 | 0.27 | 47.9% |
| 0.30–0.40 | 2412 | 0.35 | 54.8% |
| 0.40–0.45 | 831 | 0.42 | 53.5% |
| 0.45–0.50 | 1037 | 0.47 | 49.2% |
| 0.50–0.55 | 1081 | 0.52 | 50.0% |
| 0.55–0.60 | 1552 | 0.57 | 48.3% |
| 0.60–0.70 | 1566 | 0.61 | 46.7% |
| 0.70–1.00 | 1 | 0.70 | 0.0% |

## O que o Jev está lendo (15m)

| feature do estado | Spearman com P(alta) | AUC da feature sozinha |
|---|---|---|
| `returnsBps.m1` | 0.075 | 0.542 |
| `returnsBps.m15` | 0.726 | 0.478 |
| `returnsBps.m60` | 0.771 | 0.455 |
| `returnsBps.m240` | 0.391 | 0.471 |
| `flow.m15.buyShare` | 0.710 | 0.493 |
| `flow.m60.netUsd` | 0.776 | 0.455 |
| `volatilityBps.m60` | 0.027 | 0.500 |
| `activity.volume15VsAvg4h` | 0.036 | 0.507 |

|Spearman| alto = o Jev segue essa feature. Se ela sozinha tem AUC < 0.5 no período, segui-la perde.

## Paper trading long/flat na Base

Spot não permite short: comprado em ETH quando P(alta) > 0.5, em USDC caso contrário. Cada troca paga 6.00 bps
(fee 5 + impacto 1) + $0.01 de gás. Banca $10,000.

| h | Jev líquido | Jev bruto | trocas | momentum | mean-rev | moeda | buy & hold | acerto p/ empatar | edge bruto L/S por trade |
|---|---|---|---|---|---|---|---|---|---|
| 1m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 100.0% | 0.02 ± 0.11 bps |
| 5m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 100.0% | 0.07 ± 0.24 bps |
| 15m | -79.18% | +31.48% | 3058 | -89.52% | -91.74% | -92.28% | +71.01% | 87.5% | 0.02 ± 0.54 bps |
| 60m | -31.20% | +34.92% | 1120 | -31.51% | -37.38% | -37.17% | +71.01% | 68.4% | 0.38 ± 2.23 bps |

- **n/a**: menos de 95% dos passos são seguidos diretamente pelo próximo (cadência maior que o horizonte), então não forma carteira contínua.
- **acerto p/ empatar**: acerto necessário para cobrir 12.0 bps de ida e volta dado o movimento médio |r| do horizonte.
- O P&L não entra no veredito da fase 0, só a skill entra. O líquido mostra o peso do custo de taker: trocar a cada sinal custa mais que qualquer edge medido aqui.
