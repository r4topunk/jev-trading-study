# Jev na Base: comparação entre mercados (backtest)

Gerado 2026-09-23T16:43 UTC. 4 mercados, 4 dentro da regra de qualidade de dado.
Horizonte 15m, amostras sem sobreposição. IC por mercado a 99.29% (Bonferroni, 7 mercados).
Gasto Jev total $3.14.

## Por mercado

| mercado | n | sem swap | AUC Jev [IC] | momentum | mean-rev | BSS | ρ(P, retorno 15m) | ρ(P, fluxo 60m) | paper Jev / hold | veredito | gasto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ETH | 8624 | 2.3% | 0.465 [0.448, 0.480] | 0.478 | 0.522 | -0.071 | 0.73 | 0.78 | -79.2% / +71.0% | **FALHA (invertido)** | $1.11 |
| cbBTC | 8624 | 4.4% | 0.466 [0.449, 0.482] | 0.477 | 0.523 | -0.044 | 0.40 | 0.56 | -93.2% / +42.1% | **FALHA (invertido)** | $0.68 |
| SOL | 8624 | 15.0% | 0.475 [0.459, 0.491] | 0.483 | 0.517 | -0.058 | 0.78 | 0.78 | -93.4% / +73.1% | **FALHA (invertido)** | $0.66 |
| VIRTUAL | 8624 | 3.3% | 0.490 [0.474, 0.506] | 0.497 | 0.503 | -0.050 | 0.81 | 0.70 | -99.8% / +37.1% | **FALHA** | $0.69 |

ρ = Spearman entre P(alta) do Jev e a feature: perto de 1 = o Jev segue a tendência / o fluxo.

## Agregado (34496 linhas, 8624 timestamps)

**FALHA (invertido)**: AUC agregada 0.475 [0.468, 0.482] abaixo de 0.5 (momentum 0.485, mean-reversion 0.515).

IC 95% por bootstrap em cluster por timestamp.

## O "skill" do Jev é o do momentum? (mercado × bloco de 30 dias, n ≥ 300)

Pearson entre a AUC do Jev e a AUC do momentum nas 12 células: **r = 0.72**
(acima de 0.5: o Jev acompanha o momentum de regime em regime).
O Jev bateu o momentum em 2 de 12 células.

| mercado | bloco | n | alta% | AUC Jev | AUC momentum | Jev − momentum |
|---|---|---|---|---|---|---|
| cbBTC | 2026-06-25 +30d | 2880 | 50.9% | 0.479 | 0.469 | +0.011 |
| cbBTC | 2026-07-25 +30d | 2880 | 49.7% | 0.434 | 0.475 | -0.041 |
| cbBTC | 2026-08-24 +30d | 2864 | 50.6% | 0.485 | 0.487 | -0.002 |
| ETH | 2026-06-25 +30d | 2880 | 51.1% | 0.442 | 0.459 | -0.018 |
| ETH | 2026-07-25 +30d | 2880 | 50.1% | 0.485 | 0.496 | -0.011 |
| ETH | 2026-08-24 +30d | 2864 | 50.7% | 0.466 | 0.482 | -0.017 |
| SOL | 2026-06-25 +30d | 2880 | 49.5% | 0.466 | 0.469 | -0.003 |
| SOL | 2026-07-25 +30d | 2880 | 50.4% | 0.482 | 0.485 | -0.003 |
| SOL | 2026-08-24 +30d | 2864 | 50.2% | 0.477 | 0.493 | -0.016 |
| VIRTUAL | 2026-06-25 +30d | 2880 | 49.1% | 0.486 | 0.477 | +0.009 |
| VIRTUAL | 2026-07-25 +30d | 2880 | 49.2% | 0.504 | 0.517 | -0.013 |
| VIRTUAL | 2026-08-24 +30d | 2864 | 49.7% | 0.480 | 0.496 | -0.016 |

Relatório completo de cada mercado: `reports/<mercado>-backtest.md`.
