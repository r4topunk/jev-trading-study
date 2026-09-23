# Jev na Base: SOL, backtest

Gerado 2026-09-23T20:42 UTC. Pool Aerodrome Slipstream `0x1131db5977242a03ebead1acd18f80a9a29e5922` (USDC). Período 2026-06-25 19:45 .. 2026-09-23 15:45 UTC,
8625 decisões a cada ~15 min (0 erros). Prompt `91961615edc2e046`.
Gasto Jev $0.6617. Latência p50 419 ms, p95 589 ms.
Paridade de estado 8625/8625. Minutos sem swap 15.0%.

## Veredito pré-registrado (horizonte 15m)

**FALHA (invertido)**: AUC 0.475 [0.463, 0.487] abaixo de 0.5. Invertido daria 0.525; mean-reversion grátis 0.517.

## Skill por horizonte (amostras sem sobreposição)

| h | n | alta% | acerto | acaso | p | AUC [IC 95.0%] | momentum | mean-rev | moeda | BSS clim | IC Spearman |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1m | 8625 | 42.2% | 50.9% | 50.0% | 0.066 | 0.514 [0.502, 0.527] | 0.565 | 0.435 | 0.501 | -0.024 | 0.012 |
| 5m | 8625 | 49.4% | 48.5% | 50.0% | 0.997 | 0.483 [0.471, 0.496] | 0.493 | 0.507 | 0.500 | -0.034 | -0.021 |
| 15m | 8624 | 50.1% | 47.9% | 50.0% | 1.000 | 0.475 [0.463, 0.487] | 0.483 | 0.517 | 0.494 | -0.058 | -0.035 |
| 60m | 2156 | 50.9% | 47.4% | 49.9% | 0.987 | 0.463 [0.439, 0.487] | 0.457 | 0.543 | 0.502 | -0.073 | -0.063 |

- **acaso**: acerto de um chute sem informação com o mesmo mix alta/baixa do Jev. **p**: unilateral, acerto > acaso.
- **AUC** é a métrica primária: 0.5 = não discrimina, não depende da taxa de alta do período.
- Horizontes que não são o primário são exploratórios: com 4 testes, só conta p < 0.0125 (Bonferroni).

## Forma das probabilidades

| h | p10 | p50 | p90 | indecisas (\|p−0.5\| < 0.05) | confiantes (\|p−0.5\| ≥ 0.1) | acerto nas confiantes | log loss vs clima |
|---|---|---|---|---|---|---|---|
| 1m | 0.42 | 0.50 | 0.55 | 60.6% | 253 | 58.1% | 0.693 vs 0.681 |
| 5m | 0.38 | 0.49 | 0.58 | 33.8% | 1662 | 48.4% | 0.710 vs 0.693 |
| 15m | 0.35 | 0.48 | 0.60 | 24.9% | 3260 | 47.4% | 0.723 vs 0.693 |
| 60m | 0.34 | 0.47 | 0.60 | 19.4% | 874 | 43.5% | 0.731 vs 0.693 |

## Calibração (15m)

| faixa de P(alta) | n | P média | alta observada |
|---|---|---|---|
| 0.00–0.30 | 56 | 0.28 | 51.8% |
| 0.30–0.40 | 2555 | 0.36 | 53.0% |
| 0.40–0.45 | 1024 | 0.42 | 49.7% |
| 0.45–0.50 | 1011 | 0.47 | 51.3% |
| 0.50–0.55 | 1136 | 0.52 | 48.6% |
| 0.55–0.60 | 1746 | 0.57 | 47.5% |
| 0.60–0.70 | 1096 | 0.61 | 47.9% |
| 0.70–1.00 | 0 | -- | -- |

## O que o Jev está lendo (15m)

| feature do estado | Spearman com P(alta) | AUC da feature sozinha |
|---|---|---|
| `returnsBps.m1` | 0.098 | 0.519 |
| `returnsBps.m15` | 0.784 | 0.483 |
| `returnsBps.m60` | 0.720 | 0.466 |
| `returnsBps.m240` | 0.406 | 0.478 |
| `flow.m15.buyShare` | 0.787 | 0.490 |
| `flow.m60.netUsd` | 0.777 | 0.471 |
| `volatilityBps.m60` | 0.007 | 0.504 |
| `activity.volume15VsAvg4h` | 0.006 | 0.500 |

|Spearman| alto = o Jev segue essa feature. Se ela sozinha tem AUC < 0.5 no período, segui-la perde.

## Paper trading long/flat na Base

Spot não permite short: comprado em SOL quando P(alta) > 0.5, em USDC caso contrário. Cada troca paga 8.50 bps
(fee 3.5 + impacto 5) + $0.01 de gás. Banca $10,000.

| h | Jev líquido | Jev bruto | trocas | momentum | mean-rev | moeda | buy & hold | acerto p/ empatar | edge bruto L/S por trade |
|---|---|---|---|---|---|---|---|---|---|
| 1m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 100.0% | 0.05 ± 0.18 bps |
| 5m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 100.0% | -0.14 ± 0.38 bps |
| 15m | -93.41% | +24.75% | 3436 | -96.75% | -97.32% | -97.30% | +73.13% | 93.8% | -0.13 ± 0.62 bps |
| 60m | -53.99% | +13.30% | 1058 | -57.18% | -40.93% | -50.99% | +73.13% | 71.6% | -1.63 ± 2.57 bps |

- **n/a**: menos de 95% dos passos são seguidos diretamente pelo próximo (cadência maior que o horizonte), então não forma carteira contínua.
- **acerto p/ empatar**: acerto necessário para cobrir 17.0 bps de ida e volta dado o movimento médio |r| do horizonte.
- O P&L não entra no veredito da fase 0, só a skill entra. O líquido mostra o peso do custo de taker: trocar a cada sinal custa mais que qualquer edge medido aqui.
