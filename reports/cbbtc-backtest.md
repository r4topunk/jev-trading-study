# Jev na Base: cbBTC, backtest

Gerado 2026-09-23T16:44 UTC. Pool Aerodrome Slipstream `0x7c7420dd105e2779316423ba3e973f434315efa9` (WETH). Período 2026-06-25 19:45 .. 2026-09-23 15:45 UTC,
8625 decisões a cada ~15 min (0 erros). Prompt `bd4011b9b6414258`.
Gasto Jev $0.6763. Latência p50 417 ms, p95 580 ms.
Paridade de estado 8625/8625. Minutos sem swap 4.4%.

## Veredito pré-registrado (horizonte 15m)

**FALHA (invertido)**: AUC 0.466 [0.454, 0.477] abaixo de 0.5. Invertido daria 0.534; mean-reversion grátis 0.523.

## Skill por horizonte (amostras sem sobreposição)

| h | n | alta% | acerto | acaso | p | AUC [IC 95.0%] | momentum | mean-rev | moeda | BSS clim | IC Spearman |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1m | 8625 | 49.6% | 48.7% | 50.0% | 0.993 | 0.478 [0.466, 0.491] | 0.528 | 0.472 | 0.499 | -0.016 | -0.035 |
| 5m | 8625 | 49.5% | 49.4% | 50.1% | 0.894 | 0.472 [0.460, 0.486] | 0.491 | 0.509 | 0.499 | -0.029 | -0.042 |
| 15m | 8624 | 50.4% | 47.4% | 49.9% | 1.000 | 0.466 [0.454, 0.477] | 0.477 | 0.523 | 0.485 | -0.044 | -0.049 |
| 60m | 2156 | 50.5% | 50.1% | 49.8% | 0.404 | 0.484 [0.461, 0.509] | 0.474 | 0.526 | 0.497 | -0.038 | -0.029 |

- **acaso**: acerto de um chute sem informação com o mesmo mix alta/baixa do Jev. **p**: unilateral, acerto > acaso.
- **AUC** é a métrica primária: 0.5 = não discrimina, não depende da taxa de alta do período.
- Horizontes que não são o primário são exploratórios: com 4 testes, só conta p < 0.0125 (Bonferroni).

## Forma das probabilidades

| h | p10 | p50 | p90 | indecisas (\|p−0.5\| < 0.05) | confiantes (\|p−0.5\| ≥ 0.1) | acerto nas confiantes | log loss vs clima |
|---|---|---|---|---|---|---|---|
| 1m | 0.42 | 0.48 | 0.54 | 68.8% | 128 | 44.5% | 0.701 vs 0.693 |
| 5m | 0.39 | 0.46 | 0.56 | 40.4% | 891 | 42.8% | 0.708 vs 0.693 |
| 15m | 0.37 | 0.45 | 0.56 | 38.6% | 1794 | 44.4% | 0.716 vs 0.693 |
| 60m | 0.36 | 0.45 | 0.57 | 37.2% | 511 | 44.8% | 0.713 vs 0.693 |

## Calibração (15m)

| faixa de P(alta) | n | P média | alta observada |
|---|---|---|---|
| 0.00–0.30 | 10 | 0.28 | 80.0% |
| 0.30–0.40 | 1763 | 0.37 | 55.3% |
| 0.40–0.45 | 2242 | 0.42 | 50.3% |
| 0.45–0.50 | 1838 | 0.47 | 51.1% |
| 0.50–0.55 | 1492 | 0.52 | 47.7% |
| 0.55–0.60 | 1209 | 0.57 | 46.2% |
| 0.60–0.70 | 70 | 0.60 | 37.1% |
| 0.70–1.00 | 0 | -- | -- |

## O que o Jev está lendo (15m)

| feature do estado | Spearman com P(alta) | AUC da feature sozinha |
|---|---|---|
| `returnsBps.m1` | 0.018 | 0.509 |
| `returnsBps.m15` | 0.400 | 0.477 |
| `returnsBps.m60` | 0.329 | 0.463 |
| `returnsBps.m240` | 0.258 | 0.477 |
| `flow.m15.buyShare` | 0.636 | 0.480 |
| `flow.m60.netUsd` | 0.561 | 0.496 |
| `volatilityBps.m60` | 0.048 | 0.501 |
| `activity.volume15VsAvg4h` | 0.021 | 0.503 |

|Spearman| alto = o Jev segue essa feature. Se ela sozinha tem AUC < 0.5 no período, segui-la perde.

## Paper trading long/flat na Base

Spot não permite short: comprado em cbBTC quando P(alta) > 0.5, em USDC caso contrário. Cada troca paga 8.85 bps
(fee 0.85 + impacto 2 + hop WETH/USDC 6) + $0.01 de gás. Banca $10,000.

| h | Jev líquido | Jev bruto | trocas | momentum | mean-rev | moeda | buy & hold | acerto p/ empatar | edge bruto L/S por trade |
|---|---|---|---|---|---|---|---|---|---|
| 1m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 100.0% | -0.02 ± 0.11 bps |
| 5m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 100.0% | 0.14 ± 0.24 bps |
| 15m | -93.25% | -2.84% | 2994 | -97.95% | -97.80% | -97.89% | +42.08% | 100.0% | -0.45 ± 0.40 bps |
| 60m | -42.93% | +20.21% | 840 | -58.69% | -53.00% | -56.08% | +42.08% | 85.4% | 0.06 ± 1.60 bps |

- **n/a**: menos de 95% dos passos são seguidos diretamente pelo próximo (cadência maior que o horizonte), então não forma carteira contínua.
- **acerto p/ empatar**: acerto necessário para cobrir 17.7 bps de ida e volta dado o movimento médio |r| do horizonte.
- O P&L não entra no veredito da fase 0, só a skill entra. O líquido mostra o peso do custo de taker: trocar a cada sinal custa mais que qualquer edge medido aqui.
