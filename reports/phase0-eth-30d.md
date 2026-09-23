> Registro histórico da fase 0 (ETH, 30 dias, 1 decisão a cada 5 min), gerado antes da fase 0b.
> O relatório atual do ETH, com 90 dias, é [eth-backtest.md](eth-backtest.md).

# Jev na Base: relatório backtest

Gerado 2026-09-23T15:12 UTC. Período 2026-08-24 18:55 .. 2026-09-23 14:50 UTC, 8592 decisões
(0 erros). Prompt `619f3715ca0cfab4`.
Gasto Jev $0.6636. Latência p50 440 ms, p95 616 ms.
Paridade de estado 8592/8592.

## Veredito pré-registrado (horizonte 15m)

**FALHA (sinal invertido)**: AUC 0.461 [0.440, 0.484] abaixo de 0.5. O Jev invertido teria AUC 0.539 (mean-reversion grátis: 0.521). Inverter o sinal é uma hipótese nova, que precisa de um teste novo pré-registrado.

## Skill por horizonte (amostras sem sobreposição)

| h | n | alta% | acerto | acaso | p | AUC [IC 95%] | momentum | mean-rev | moeda | BSS clim | IC Spearman |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1m | 8592 | 50.5% | 48.0% | 50.0% | 1.000 | 0.486 [0.474, 0.497] | 0.602 | 0.398 | 0.514 | -0.019 | -0.005 |
| 5m | 8592 | 49.9% | 48.7% | 50.0% | 0.991 | 0.487 [0.475, 0.499] | 0.523 | 0.477 | 0.499 | -0.033 | -0.018 |
| 15m | 2864 | 49.5% | 47.7% | 50.0% | 0.993 | 0.461 [0.440, 0.484] | 0.479 | 0.521 | 0.494 | -0.070 | -0.060 |
| 60m | 716 | 48.7% | 46.5% | 50.1% | 0.972 | 0.447 [0.404, 0.487] | 0.452 | 0.548 | 0.484 | -0.088 | -0.072 |

- **acaso**: acerto de um chute sem informação com o mesmo mix alta/baixa do Jev. **p**: unilateral, acerto > acaso.
- **AUC** é a métrica primária: 0.5 = não discrimina, não depende da taxa de alta do período.
- Horizontes que não são o primário são exploratórios: com 4 testes, só conta p < 0.0125 (Bonferroni).

## Forma das probabilidades

| h | p10 | p50 | p90 | indecisas (\|p−0.5\| < 0.05) | confiantes (\|p−0.5\| ≥ 0.1) | acerto nas confiantes | log loss vs clima |
|---|---|---|---|---|---|---|---|
| 1m | 0.41 | 0.51 | 0.56 | 53.9% | 367 | 46.3% | 0.703 vs 0.693 |
| 5m | 0.38 | 0.49 | 0.58 | 32.9% | 1684 | 49.9% | 0.710 vs 0.693 |
| 15m | 0.34 | 0.49 | 0.61 | 25.8% | 1162 | 45.5% | 0.729 vs 0.693 |
| 60m | 0.34 | 0.45 | 0.61 | 12.2% | 360 | 43.1% | 0.739 vs 0.693 |

## Calibração (15m)

| faixa de P(alta) | n | P média | alta observada |
|---|---|---|---|
| 0.00–0.30 | 23 | 0.28 | 52.2% |
| 0.30–0.40 | 834 | 0.36 | 54.2% |
| 0.40–0.45 | 287 | 0.42 | 49.1% |
| 0.45–0.50 | 348 | 0.47 | 47.4% |
| 0.50–0.55 | 392 | 0.52 | 50.0% |
| 0.55–0.60 | 512 | 0.57 | 46.7% |
| 0.60–0.70 | 468 | 0.61 | 45.5% |
| 0.70–1.00 | 0 | -- | -- |

## O que o Jev está lendo (15m)

| feature do estado | Spearman com P(alta) | AUC da feature sozinha |
|---|---|---|
| `returnsBps.m1` | 0.083 | 0.522 |
| `returnsBps.m15` | 0.732 | 0.479 |
| `returnsBps.m60` | 0.773 | 0.442 |
| `returnsBps.m240` | 0.425 | 0.477 |
| `flow.m15.buyShare` | 0.725 | 0.497 |
| `flow.m60.netUsd` | 0.778 | 0.443 |
| `volatilityBps.m60` | 0.014 | 0.495 |
| `activity.volume15VsAvg4h` | 0.054 | 0.505 |

|Spearman| alto = o Jev segue essa feature. Se ela sozinha tem AUC < 0.5 no período, segui-la perde.

## Paper trading long/flat na Base

Spot não permite short: comprado em ETH quando P(alta) > 0.5, em USDC caso contrário. Cada troca paga 6 bps
(fee 5 + impacto 1) + $0.01 de gás. Banca $10,000.

| h | Jev líquido | Jev bruto | trocas | momentum | mean-rev | moeda | buy & hold | acerto p/ empatar | edge bruto L/S por trade |
|---|---|---|---|---|---|---|---|---|---|
| 1m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 100.0% | 0.01 ± 0.14 bps |
| 5m | -74.03% | +6.45% | 2342 | -88.22% | -93.28% | -92.28% | +7.96% | 100.0% | 0.08 ± 0.31 bps |
| 15m | -42.30% | +5.80% | 1008 | -52.94% | -59.55% | -60.21% | +7.96% | 85.6% | 0.18 ± 0.96 bps |
| 60m | -23.22% | -3.86% | 374 | -22.85% | -11.71% | -12.98% | +7.96% | 67.8% | -2.39 ± 3.65 bps |

- **n/a**: com uma decisão a cada 5 min, um horizonte menor não forma uma carteira contínua.
- **acerto p/ empatar**: acerto necessário para cobrir 12 bps de ida e volta dado o movimento médio |r| do horizonte.
- O P&L não entra no veredito da fase 0, só a skill entra. O líquido mostra o peso do custo de taker: trocar a cada sinal custa mais que qualquer edge medido aqui.
