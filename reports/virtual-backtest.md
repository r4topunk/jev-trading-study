# Jev na Base: VIRTUAL, backtest

Gerado 2026-09-23T20:42 UTC. Pool Aerodrome Slipstream `0x3f0296bf652e19bca772ec3df08b32732f93014a` (WETH). Período 2026-06-25 19:45 .. 2026-09-23 15:45 UTC,
8625 decisões a cada ~15 min (0 erros). Prompt `ac7f2d7af4d73f2d`.
Gasto Jev $0.6907. Latência p50 421 ms, p95 591 ms.
Paridade de estado 8625/8625. Minutos sem swap 3.3%.

## Veredito pré-registrado (horizonte 15m)

**FALHA**: sem evidência de skill: AUC 0.490 [0.479, 0.502] contém 0.5; não supera o melhor baseline grátis (0.503); Brier pior que a climatologia (BSS -0.050).

## Skill por horizonte (amostras sem sobreposição)

| h | n | alta% | acerto | acaso | p | AUC [IC 95.0%] | momentum | mean-rev | moeda | BSS clim | IC Spearman |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1m | 8625 | 49.9% | 50.0% | 50.0% | 0.482 | 0.505 [0.493, 0.517] | 0.513 | 0.487 | 0.504 | -0.011 | 0.005 |
| 5m | 8625 | 50.0% | 49.5% | 50.0% | 0.833 | 0.490 [0.478, 0.502] | 0.496 | 0.504 | 0.501 | -0.030 | -0.013 |
| 15m | 8624 | 49.3% | 49.3% | 50.1% | 0.944 | 0.490 [0.479, 0.502] | 0.497 | 0.503 | 0.495 | -0.050 | -0.015 |
| 60m | 2156 | 49.2% | 49.2% | 50.2% | 0.833 | 0.476 [0.451, 0.501] | 0.464 | 0.536 | 0.507 | -0.059 | -0.033 |

- **acaso**: acerto de um chute sem informação com o mesmo mix alta/baixa do Jev. **p**: unilateral, acerto > acaso.
- **AUC** é a métrica primária: 0.5 = não discrimina, não depende da taxa de alta do período.
- Horizontes que não são o primário são exploratórios: com 4 testes, só conta p < 0.0125 (Bonferroni).

## Forma das probabilidades

| h | p10 | p50 | p90 | indecisas (\|p−0.5\| < 0.05) | confiantes (\|p−0.5\| ≥ 0.1) | acerto nas confiantes | log loss vs clima |
|---|---|---|---|---|---|---|---|
| 1m | 0.41 | 0.49 | 0.55 | 58.9% | 488 | 52.5% | 0.699 vs 0.693 |
| 5m | 0.37 | 0.48 | 0.57 | 36.3% | 1682 | 48.2% | 0.708 vs 0.693 |
| 15m | 0.33 | 0.46 | 0.59 | 23.8% | 3136 | 49.5% | 0.719 vs 0.693 |
| 60m | 0.33 | 0.44 | 0.58 | 23.8% | 840 | 48.7% | 0.724 vs 0.693 |

## Calibração (15m)

| faixa de P(alta) | n | P média | alta observada |
|---|---|---|---|
| 0.00–0.30 | 139 | 0.28 | 54.7% |
| 0.30–0.40 | 2837 | 0.35 | 50.3% |
| 0.40–0.45 | 1139 | 0.42 | 47.8% |
| 0.45–0.50 | 933 | 0.47 | 51.3% |
| 0.50–0.55 | 1122 | 0.52 | 48.8% |
| 0.55–0.60 | 1974 | 0.57 | 47.9% |
| 0.60–0.70 | 480 | 0.60 | 48.5% |
| 0.70–1.00 | 0 | -- | -- |

## O que o Jev está lendo (15m)

| feature do estado | Spearman com P(alta) | AUC da feature sozinha |
|---|---|---|
| `returnsBps.m1` | 0.158 | 0.519 |
| `returnsBps.m15` | 0.809 | 0.497 |
| `returnsBps.m60` | 0.652 | 0.477 |
| `returnsBps.m240` | 0.332 | 0.480 |
| `flow.m15.buyShare` | 0.807 | 0.506 |
| `flow.m60.netUsd` | 0.695 | 0.494 |
| `volatilityBps.m60` | 0.066 | 0.509 |
| `activity.volume15VsAvg4h` | 0.105 | 0.506 |

|Spearman| alto = o Jev segue essa feature. Se ela sozinha tem AUC < 0.5 no período, segui-la perde.

## Paper trading long/flat na Base

Spot não permite short: comprado em VIRTUAL quando P(alta) > 0.5, em USDC caso contrário. Cada troca paga 17.00 bps
(fee 1 + impacto 10 + hop WETH/USDC 6) + $0.01 de gás. Banca $10,000.

| h | Jev líquido | Jev bruto | trocas | momentum | mean-rev | moeda | buy & hold | acerto p/ empatar | edge bruto L/S por trade |
|---|---|---|---|---|---|---|---|---|---|
| 1m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 100.0% | 0.14 ± 0.26 bps |
| 5m | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 100.0% | -0.12 ± 0.58 bps |
| 15m | -99.80% | +14.01% | 3568 | -99.97% | -100.00% | -99.99% | +37.05% | 100.0% | -0.19 ± 0.99 bps |
| 60m | -82.95% | -9.44% | 980 | -89.97% | -72.89% | -81.27% | +37.05% | 77.0% | -1.99 ± 3.86 bps |

- **n/a**: menos de 95% dos passos são seguidos diretamente pelo próximo (cadência maior que o horizonte), então não forma carteira contínua.
- **acerto p/ empatar**: acerto necessário para cobrir 34.0 bps de ida e volta dado o movimento médio |r| do horizonte.
- O P&L não entra no veredito da fase 0, só a skill entra. O líquido mostra o peso do custo de taker: trocar a cada sinal custa mais que qualquer edge medido aqui.
