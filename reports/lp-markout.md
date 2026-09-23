# Economia de LP nos pools da Base: fee vs. seleção adversa

Gerado 2026-09-23T17:57 UTC. Amostra: 2026-09-20, 2026-09-21, 2026-09-22 (dias UTC completos), 273406 swaps.
Reproduzir (lê os dados em cache): `node scripts/lp-markout.ts --dates 2026-09-20,2026-09-21,2026-09-22 --markets eth,cbbtc,sol,virtual`.

**Economia no nível do pool**: todos os LPs e todos os ranges somados, como se o pool fosse um único LP. Não é o P&L de uma
estratégia de range específica (concentração, rebalanceamento, gas e JIT mudam a parcela de cada um).

## Veredito

Hipótese: a reversão à média de ~15 min nos pools é impacto desfeito por arbitragem, e isso seria receita para o LP.

- **LPs têm lucro líquido?** Margem do pool (fee paga pelo taker + markout 60 s): ETH +0.4 bps [+0.0, +0.9] (positiva); cbBTC -0.2 bps [-0.4, -0.1] (negativa); SOL -0.6 bps [-0.8, -0.3] (negativa); VIRTUAL -1.7 bps [-1.9, -1.5] (negativa).
  Para os LPs de fato (depois da fee de protocolo / gauge e somando emissões AERO): ETH -0.8, cbBTC -0.4, SOL +0.4, VIRTUAL -1.1 bps.
  Onde está a perda: parcela do markout de 60 s que já está no instante do fill (0 s): ETH 101%, cbBTC 106%, SOL 101%, VIRTUAL 79%.
  O que a CEX faz depois do fill (markout 900 s − 0 s, a favor do LP se positivo): ETH +0.6 (ruído ±0.2), cbBTC +0.1 (ruído ±0.1), SOL +0.2 (ruído ±0.2), VIRTUAL -0.5 (ruído ±0.3) bps.
- **Seleção adversa em rajadas?** O pior 1% dos minutos (43 de 4320) leva 18%–31% do markout;
  40%–67% desses minutos têm outro a ≤ 5 min (acaso ~9%), 86%–95% caem nos 5% de minutos
  de maior movimento na Binance e 33%–88% coincidem com o pior minuto de outro pool.
  Gate perfeito que pula esses minutos (limite superior, bps): ETH +0.4 → +1.4 (já positivo; nulo +0.4); cbBTC -0.2 → +0.1 (sim; nulo +0.1); SOL -0.6 → +0.0 (sim; nulo +0.3); VIRTUAL -1.7 → -1.2 (não; nulo +0.3).
  "Nulo" = ganho do mesmo gate com os swaps embaralhados entre minutos (só cauda de swaps grandes, sem rajada).
  Para os LPs de fato: ETH -0.8 → +0.1, cbBTC -0.4 → -0.1, SOL +0.4 → +1.1, VIRTUAL -1.1 → -0.6.
- **Ressalvas principais**: 3 dias só; o gate é ex post (escolhe os minutos pelo resultado); a parcela de fee dos LPs e as
  emissões são leituras a cada 3 h / por dia, e as emissões valem o que o AERO valer na venda; referência = último trade da
  Binance (não o mid), com ±2 s de incerteza no horário do swap, que pesa em 0/5 s e não em 60/300 s.

## Como ler

- O LP é a contraparte de cada swap. P&L do LP no horizonte Δ = Σ (variação do saldo do pool em cada token) × preço Binance em t+Δ.
- **fee** = taxa efetivamente paga × valor do input em t. **markout(Δ)** = P&L(Δ) − fee: negativo = seleção adversa.
  0 s é a vantagem do fill contra a CEX no instante do bloco; 5 a 900 s somam o movimento da CEX depois do fill.
- **margem líquida** = fee + markout, em bps do volume USD (valor do input). IC 95% por bootstrap de blocos de 1 hora.
- Por que a reversão à média não é receita do LP: numa ida-e-volta no CFMM o LP termina com o mesmo inventário. O impacto que o
  fluxo de ruído paga é recapturado por quem desfaz o preço (o arbitrador), não pelo LP; o LP fica só com as fees das duas pernas
  e paga o LVR quando a CEX se move primeiro e o pool é arbitrado contra preço velho. Esse LVR aparece já no markout 0 s; o que
  o LP ganha ou perde depois, segurando o inventário, é a diferença entre 0 s e os horizontes longos.

## Por pool (bps do volume)

| pool | swaps | volume | fee | markout 0 s | 5 s | 60 s | 300 s | 900 s | 0 s / 60 s | líquido 5 s | líquido 60 s [IC] | líquido 300 s [IC] |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ETH | 82645 | $69.31M | 5.00 | -4.62 | -4.72 | -4.56 | -4.16 | -3.97 | 101% | +0.28 | **+0.44** [+0.0, +0.9] | +0.84 [+0.2, +1.5] |
| cbBTC | 105183 | $166.19M | 0.89 | -1.17 | -1.16 | -1.10 | -1.15 | -1.11 | 106% | -0.27 | **-0.22** [-0.4, -0.1] | -0.27 [-0.5, -0.0] |
| SOL | 38819 | $22.89M | 3.50 | -4.11 | -4.33 | -4.07 | -4.09 | -3.87 | 101% | -0.83 | **-0.56** [-0.8, -0.3] | -0.59 [-1.2, -0.0] |
| VIRTUAL | 46759 | $8.57M | 1.29 | -2.38 | -2.78 | -3.01 | -2.99 | -2.86 | 79% | -1.49 | **-1.72** [-1.9, -1.5] | -1.70 [-2.2, -1.3] |

## Para os LPs de fato (bps do volume)

A fee acima é a que o taker paga. Nem toda fica com o LP: no Uniswap v3 da Base o protocolo leva 1/4 (`feeProtocol`);
no Slipstream a fee da liquidez em stake no gauge vai para os votantes de veAERO (os LPs em stake recebem AERO em troca) e a
liquidez fora do gauge perde `unstakedFee` da sua parte. A seleção adversa cai sobre toda a liquidez ativa. Parcela em stake:
média de 8 leituras por dia (a cada 3 h); emissão = `rewardRate` do gauge ao meio-dia × VWAP diário de AEROUSDT na Binance.

| pool | fee paga | parcela que fica com LPs | fee p/ LPs | emissões AERO | markout 60 s | líquido LPs 60 s | líquido LPs 300 s | 60 s sem pior 1% min |
|---|---|---|---|---|---|---|---|---|
| ETH | 5.00 | 75% (protocolo 1/4) | 3.75 | — | -4.56 | **-0.81** | -0.41 | +0.14 |
| cbBTC | 0.89 | 16% fora do gauge × 90% | 0.13 | 0.58 ($3.2k/dia) | -1.10 | **-0.39** | -0.44 | -0.07 |
| SOL | 3.50 | 14% fora do gauge × 90% | 0.43 | 4.00 ($3.1k/dia) | -4.07 | **+0.37** | +0.34 | +1.09 |
| VIRTUAL | 1.29 | 18% fora do gauge × 90% | 0.21 | 1.67 ($476/dia) | -3.01 | **-1.13** | -1.11 | -0.61 |

## Concentração (markout 60 s)

Participação no markout total do pool (pode passar de 100%: o resto dos swaps é positivo para o LP). Swaps ordenados por |markout|;
minutos ordenados do pior para o melhor markout. Gate perfeito = tirar do pool (fee, markout e volume) o pior 1% dos minutos da
amostra, escolhido depois de ver o resultado. Nulo = média de 20 embaralhamentos dos swaps entre minutos: o ganho que o gate
teria só por causa dos swaps grandes, se eles não se juntassem no tempo. Ganho − nulo = o que vem de rajadas.

| pool | markout 60 s total | top 1% swaps | top 5% swaps | pior 1% minutos | líquido 60 s | sem pior 1% min | ganho | ganho no nulo | vira o sinal? |
|---|---|---|---|---|---|---|---|---|---|
| ETH | -$31.6k | 25% | 53% | 26% | +0.44 | **+1.39** | +0.95 | +0.41 | já positivo |
| cbBTC | -$18.3k | 32% | 52% | 31% | -0.22 | **+0.07** | +0.28 | +0.15 | **sim** |
| SOL | -$9.3k | 17% | 38% | 18% | -0.56 | **+0.03** | +0.60 | +0.25 | **sim** |
| VIRTUAL | -$2.6k | 16% | 43% | 19% | -1.72 | **-1.24** | +0.48 | +0.34 | não |

## Rajadas

Vizinho = outro minuto do pior 1% a ≤ 5 min. Acaso = mesma conta com 43 minutos sorteados (1000 sorteios); p = fração dos
sorteios com agrupamento ≥ o observado. Episódio = piores minutos a ≤ 5 min um do outro. Vol CEX = minuto entre os 5% maiores
|retornos| de 1 min do par na Binance (acaso = 5%). Outro pool = a ±2 min de um pior minuto de outro pool.

| pool | com vizinho | acaso | p | episódios | maior episódio (% do markout) | em minuto de vol CEX | coincide com outro pool |
|---|---|---|---|---|---|---|---|
| ETH | 49% | 9% | 0.001 | 31 | 3% | 88% | 88% (acaso ~10%) |
| cbBTC | 67% | 9% | 0.001 | 24 | 6% | 86% | 72% (acaso ~9%) |
| SOL | 40% | 9% | 0.002 | 34 | 2% | 88% | 60% (acaso ~9%) |
| VIRTUAL | 47% | 9% | 0.001 | 31 | 4% | 95% | 33% (acaso ~8%) |

Três piores episódios por pool:

| pool | UTC | minutos | markout 60 s | % do total | movimento do par na CEX (bps) |
|---|---|---|---|---|---|
| ETH | 09-21 00:12–00:12 | 1 | -$993 | 3% | +77 |
| ETH | 09-20 02:53–03:01 | 4 | -$718 | 2% | -92 |
| ETH | 09-20 02:43–02:45 | 3 | -$554 | 2% | -42 |
| cbBTC | 09-21 00:12–00:13 | 2 | -$1.0k | 6% | +74 |
| cbBTC | 09-21 09:26–09:32 | 4 | -$687 | 4% | +44 |
| cbBTC | 09-21 20:18–20:26 | 5 | -$672 | 4% | +35 |
| SOL | 09-20 02:43–02:44 | 2 | -$156 | 2% | -89 |
| SOL | 09-21 01:26–01:31 | 2 | -$134 | 1% | -66 |
| SOL | 09-22 14:29–14:30 | 2 | -$97 | 1% | -48 |
| VIRTUAL | 09-22 19:56–20:03 | 5 | -$92 | 4% | +168 |
| VIRTUAL | 09-22 00:41–00:42 | 2 | -$35 | 1% | +88 |
| VIRTUAL | 09-22 20:20–20:22 | 3 | -$30 | 1% | +89 |

## Totais por dia (USD)

| pool | dia | swaps | volume | fee | markout 5 s | markout 60 s | markout 300 s | líquido 60 s |
|---|---|---|---|---|---|---|---|---|
| ETH | 2026-09-20 | 18958 | $18.73M | $9.4k | -$9.5k | -$9.8k | -$8.3k | -$455 |
| ETH | 2026-09-21 | 38420 | $30.49M | $15.2k | -$13.8k | -$14.2k | -$12.6k | $1.1k |
| ETH | 2026-09-22 | 25267 | $20.09M | $10.0k | -$9.4k | -$7.6k | -$7.8k | $2.4k |
| ETH | total | 82645 | $69.31M | $34.7k | -$32.7k | -$31.6k | -$28.8k | $3.0k |
| cbBTC | 2026-09-20 | 28017 | $46.42M | $4.0k | -$5.3k | -$4.8k | -$4.5k | -$819 |
| cbBTC | 2026-09-21 | 48628 | $74.36M | $6.5k | -$9.3k | -$9.7k | -$11.1k | -$3.2k |
| cbBTC | 2026-09-22 | 28538 | $45.41M | $4.2k | -$4.6k | -$3.8k | -$3.5k | $401 |
| cbBTC | total | 105183 | $166.19M | $14.7k | -$19.2k | -$18.3k | -$19.2k | -$3.6k |
| SOL | 2026-09-20 | 8993 | $6.44M | $2.3k | -$2.8k | -$3.0k | -$3.0k | -$753 |
| SOL | 2026-09-21 | 15718 | $7.47M | $2.6k | -$3.3k | -$3.0k | -$3.2k | -$423 |
| SOL | 2026-09-22 | 14108 | $8.98M | $3.1k | -$3.8k | -$3.3k | -$3.1k | -$114 |
| SOL | total | 38819 | $22.89M | $8.0k | -$9.9k | -$9.3k | -$9.4k | -$1.3k |
| VIRTUAL | 2026-09-20 | 11493 | $1.92M | $239 | -$487 | -$597 | -$679 | -$358 |
| VIRTUAL | 2026-09-21 | 17446 | $3.24M | $427 | -$902 | -$901 | -$868 | -$474 |
| VIRTUAL | 2026-09-22 | 17820 | $3.41M | $438 | -$994 | -$1.1k | -$1.0k | -$642 |
| VIRTUAL | total | 46759 | $8.57M | $1.1k | -$2.4k | -$2.6k | -$2.6k | -$1.5k |

## Checagens

Basis = preço do pool depois do swap ÷ preço implícito na Binance no mesmo segundo − 1 (por swap, sem peso). O offset é o
deslocamento da referência da CEX (em s) que minimiza a mediana do |basis|: negativo = o pool acompanha a CEX com atraso.
Placebo = movimento da CEX depois de cada fill com sinal sorteado, média ± desvio entre 20 sementes: tem que dar ~0, e o desvio
é o piso de ruído. "real" = o mesmo movimento com o sinal verdadeiro (markout Δ − markout 0 s). Segundos CEX = segundos sem kline preenchidos
com o fechamento anterior (token0/token1).

| pool | basis mediano | mediana \|basis\| | p99 \|basis\| | melhor offset (mediana) | placebo 5 s | placebo 60 s | placebo 300 s | placebo 900 s | segundos CEX faltando | swaps descartados |
|---|---|---|---|---|---|---|---|---|---|---|
| ETH | -0.1 | 4.2 | 9.6 | -11 s (2.4) | +0.00 ± 0.05 (real -0.10) | +0.00 ± 0.14 (real +0.06) | -0.02 ± 0.21 (real +0.46) | +0.09 ± 0.22 (real +0.65) | 0/0 | 0 |
| cbBTC | -0.2 | 1.1 | 5.8 | -3 s (0.8) | +0.00 ± 0.01 (real +0.01) | +0.00 ± 0.04 (real +0.07) | +0.01 ± 0.05 (real +0.01) | +0.01 ± 0.11 (real +0.06) | 0/0 | 0 |
| SOL | -0.4 | 3.3 | 9.8 | -4 s (1.6) | +0.01 ± 0.02 (real -0.22) | -0.00 ± 0.07 (real +0.04) | -0.04 ± 0.16 (real +0.01) | -0.04 ± 0.20 (real +0.24) | 0/0 | 0 |
| VIRTUAL | -0.2 | 2.1 | 11.5 | -2 s (1.7) | -0.01 ± 0.03 (real -0.40) | -0.01 ± 0.13 (real -0.63) | +0.03 ± 0.24 (real -0.61) | +0.01 ± 0.33 (real -0.47) | 0/0 | 0 |

Fee derivada swap a swap: com a mesma liquidez antes e depois do swap (nenhum tick cruzado), a taxa sai exata de
Δ√P × L contra o input bruto. Swaps sem leitura exata herdam a última taxa lida no mesmo pool.

| pool | venue | fee em markets.ts | fee() ao meio-dia (média) | fee derivada (swaps exatos) | p10–p90 por swap | volume com leitura exata | fee usada (média ponderada) |
|---|---|---|---|---|---|---|---|
| ETH | Uniswap v3 0.05% | 5.00 | 5.00 | 5.00 | 5.00–5.00 | 76% | 5.00 |
| cbBTC | Aerodrome Slipstream | 0.85 | 0.85 | 0.89 | 0.85–0.86 | 64% | 0.89 |
| SOL | Aerodrome Slipstream | 3.50 | 3.50 | 3.51 | 3.50–3.50 | 59% | 3.50 |
| VIRTUAL | Aerodrome Slipstream | 1.00 | 2.24 | 1.28 | 1.00–4.00 | 95% | 1.29 |

## Premissas

- Referência de preço: fechamento do kline de 1 s da Binance que termina no segundo t (último trade, não o mid).
  WETH = ETHUSDT, cbBTC = BTCUSDT, SOL = SOLUSDT, VIRTUAL = VIRTUALUSDT, USDC = USDCUSDT: tudo em USDT ≈ USD.
- Horário do swap = timestamp do bloco (blocos da Base a cada 2 s, relógio checado no primeiro bloco da amostra).
- Volume = valor do input na CEX em t. Fee = taxa derivada × volume. Swaps sem input positivo em exatamente um token são descartados.
- Parcelas de fee e emissões lidas on-chain (histórico) em horários fixos, não swap a swap; `rewardRate` constante na época.
- Placebo, bootstrap, sorteios e embaralhamentos com sementes fixas (mulberry32): rodar de novo dá os mesmos números.
- Gate para os LPs de fato: fora do pool nos minutos pulados, o LP também perde a fração de tempo das emissões (43/4320).

## UNKNOWN

- Em que momento dentro do bloco o swap executou (flashblocks de 200 ms): ±2 s mexem no markout 0 s e 5 s, não em 60/300 s.
- Quanto do markout 0 s é bid-ask bounce da Binance: o fechamento é o último trade, que num arbitrador CEX-DEX tende a estar
  do lado que ele mesmo agrediu. Não há book histórico por segundo nesta API.
- Se cbBTC, o SOL bridged da Base e WETH valem exatamente BTC, SOL e ETH: o basis mediano acima mede o viés; um basis constante
  só entra no markout na proporção do fluxo líquido (não do volume).
- Qual venue lidera o preço do VIRTUAL (token nativo da Base): se a Binance segue a Base, parte do markout adverso de 5–60 s
  contra a Binance é a referência atrasada, não fluxo informado contra o LP.
- Representatividade: 3 dias, sem calendário de notícias; não sei se os piores episódios coincidem com eventos macro/listagens.
- Valor real das emissões para um LP: preço de venda do AERO, parcela do gauge que um LP novo capturaria, custo de gas e de
  rebalancear um range concentrado, competição com JIT.
- Um gate que funcione em tempo real: aqui só o limite superior ex post; o agrupamento em rajadas diz se um gate reativo
  (pausar depois de um minuto ruim) teria chance, não quanto ele ganharia.
