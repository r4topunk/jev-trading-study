# Experimento: o Jev prevê o preço do ETH na Base?

> Protocolo pré-registrado. Escrito em 2026-09-23, **antes** de rodar o backtest completo.
> Mudar pergunta, estado, horizonte ou critério depois de ver os dados = experimento novo, com versão de prompt nova.

## TL;DR

- **Pergunta:** a P(alta) do Jev para ETH/USDC na Base discrimina melhor que o acaso e que baselines grátis?
- **Métrica primária:** AUC de P(alta em 15 min), amostras sem sobreposição.
- **Passa se:** IC 95% da AUC > 0.5 **e** AUC > momentum e mean-reversion **e** Brier melhor que a climatologia.
- **Sem dinheiro real.** Leitura on-chain, decisões logadas, P&L simulado com custo realista de swap.
- **Custo:** ~$0.66 de Jev por 30 dias de backtest; ~$0.02/dia no forward.

```sh
node scripts/backfill.ts --days 30                    # barras de 1 min a partir dos logs Swap dos pools
node scripts/backtest.ts --market eth --days 30       # fase 0: replay histórico no Jev
node scripts/report.ts --market eth                   # veredito
node scripts/drift.ts --market eth                    # o modelo mudou desde o backtest?
```

## Resultado da fase 0 (2026-09-23)

**FALHA, sinal invertido.** 8.592 decisões, 2026-08-24 → 2026-09-23, $0.66 de Jev, 0 erros, paridade 8.592/8.592.
Relatório completo: [reports/phase0-eth-30d.md](reports/phase0-eth-30d.md).

| h | n indep. | AUC Jev [IC 95%] | momentum | mean-rev | BSS clima |
|---|---|---|---|---|---|
| 1m | 8.592 | 0.486 [0.474, 0.497] | **0.602** | 0.398 | −0.019 |
| 5m | 8.591 | 0.487 [0.474, 0.499] | 0.523 | 0.477 | −0.033 |
| **15m** | 2.863 | **0.462 [0.439, 0.482]** | 0.479 | 0.521 | −0.070 |
| 60m | 715 | 0.446 [0.405, 0.488] | 0.451 | 0.549 | −0.089 |

- O Jev é um **seguidor de tendência/fluxo**: P(alta 15m) tem Spearman 0.73 com o retorno de 15 min e 0.78 com o
  fluxo líquido de 60 min. No período, o ETH na Base reverteu à média em 15–60 min, então segui-lo perdeu.
- Não adiciona informação além do momentum: dentro de cada tercil de momentum, AUC 0.44 / 0.48 / 0.43.
- Calibração invertida: P ≈ 0.36 → 54% de alta observada; P ≈ 0.61 → 45%.
- O único padrão real nos dados (momentum de 1 min no preço do DEX, AUC 0.60, que é o AMM atrasado em relação à CEX)
  o Jev ignorou (Spearman 0.08 com `returnsBps.m1`). Esse padrão também não paga 12 bps.
- Paper 15m long/flat: Jev −42% líquido (+5.8% bruto) contra buy & hold +7.7%. Empatar exigiria 86% de acerto.
- Jev invertido teria AUC 0.538 contra 0.521 do mean-reversion grátis. Pela regra, isso é hipótese nova, e mesmo
  passando continuaria muito longe dos 86% de acerto que pagam o custo.

**Decisão pela regra pré-registrada:** encerrar o Jev como preditor de preço a partir de features numéricas.
A fase 1 não roda.

## Fase 0b: mais histórico e outros tokens da Base (pré-registrada em 2026-09-23, antes de rodar)

Motivo: a fase 0 cobriu 1 mercado e 1 regime. A 0b pergunta se a falha é do ETH naquele mês ou do Jev.

| Item | Valor |
|---|---|
| Mercados | ETH (já tinha 30 dias) + cbBTC, SOL, ZEN, VVV, cbXRP, VIRTUAL (`src/markets.ts`) |
| Regra de seleção | Uniswap v3 ou Aerodrome Slipstream; cotado em USDC ou WETH; pool ≥ 90 dias; sem stable, derivado de ETH ou ação tokenizada; 1 pool por token; top 6 por volume 24h (GeckoTerminal, 2026-09-23) |
| Qualidade de dado | Mercado com > 25% de minutos sem swap no período sai (checado no backfill, antes do Jev) |
| Período | 90 dias iguais para todos: 2026-06-25 → 2026-09-23 |
| Cadência | 1 decisão a cada 15 min: mesmas amostras independentes em 15m, 1/3 do custo. Os 30 dias antigos do ETH (5 min) entram pelo subconjunto alinhado |
| Preço | USD. Pool cotado em WETH é convertido pelo close ETH/USDC do mesmo minuto |
| Prompt | Estrutura idêntica; só muda o símbolo e a descrição do pool. ETH mantém o hash `619f3715ca0cfab4` |
| Orçamento | $5 de Jev; estimativa ~$4.45 (57.600 decisões) |

**Qualidade de dado, aplicada no backfill (antes de qualquer chamada ao Jev nesses mercados):**

| Mercado | Minutos sem swap (90d) | Status |
|---|---|---|
| ETH | 2.3% | entra |
| cbBTC | 4.4% | entra |
| SOL | 15.0% | entra |
| VIRTUAL | 3.3% | entra |
| ZEN | 53.6% | **excluído** |
| VVV | 58.4% | **excluído** |
| cbXRP | 48.3% | **excluído** |

Os três pools excluídos eram finos no início do período (~1 swap/min). Sem reposição, conforme a regra. Os preços em
USD de cbBTC, SOL e VIRTUAL batem com o GeckoTerminal (< 0.5%), o que confere orientação token0/token1 e a conversão WETH→USD.

**Critérios (horizonte 15m):**

```
por mercado (7 testes):  IC(AUC) a 1 − 0.05/7 (Bonferroni) > 0.5  e  AUC > max(mom, meanrev)  e  BSS > 0  → PASSA
agregado:                AUC de todas as linhas, IC por bootstrap em cluster por timestamp (mercados andam juntos)
                         IC > 0.5  e  AUC > max(mom, meanrev) agregados                                  → PASSA
hipótese "Jev ≈ momentum": por (mercado × bloco de 30 dias), correlação de Pearson entre a AUC do Jev e a do
                         momentum. r > 0.5 → o "skill" do Jev é o do momentum naquele regime
```

### Resultado da fase 0b (2026-09-23)

**FALHA em todos os mercados; agregado invertido.** 31.680 decisões novas (+8.592 da fase 0), 90 dias, 4 mercados,
$2.48 a preço de tabela (débito real ~$0: o gateway devolve `cost: "0"`). Relatório: [reports/markets.md](reports/markets.md).

| Mercado | n (15m) | AUC Jev [IC 99.3%] | momentum | mean-rev | ρ(P, retorno 15m) | Veredito |
|---|---|---|---|---|---|---|
| ETH | 8.624 | 0.465 [0.448, 0.480] | 0.478 | 0.522 | 0.73 | FALHA (invertido) |
| cbBTC | 8.624 | 0.466 [0.449, 0.482] | 0.477 | 0.523 | 0.40 | FALHA (invertido) |
| SOL | 8.624 | 0.475 [0.459, 0.491] | 0.483 | 0.517 | 0.78 | FALHA (invertido) |
| VIRTUAL | 8.624 | 0.490 [0.474, 0.506] | 0.497 | 0.503 | 0.81 | FALHA |
| **Agregado** | 34.496 | **0.475 [0.468, 0.482]** | 0.485 | 0.515 | | **FALHA (invertido)** |

- **O Jev é momentum com ruído.** Nas 12 células (mercado × bloco de 30 dias), a AUC do Jev acompanha a do momentum
  com r = 0.72, e o Jev só bateu o momentum em 2 de 12.
- **Não é o regime.** Os 90 dias foram de alta forte (ETH +70%, SOL +73%, cbBTC +42%, VIRTUAL +36%), e mesmo assim o
  momentum de 15m perdeu em 11 de 12 células: o preço de pool na Base reverte em 15 min (o impacto de swaps grandes é
  desfeito por arbitragem). Um seguidor de tendência perde nesse horizonte independente da direção do mês.
- **Paper 15m:** Jev −79% a −99.8% líquido em 90 dias contra buy & hold +36% a +73%. Cerca de 1 troca por passo,
  a 12–28 bps de ida e volta, come tudo.
- Excluídos pela regra de dado: ZEN, VVV, cbXRP (sem reposição).

**Decisão:** a hipótese "o Jev prevê direção de preço a partir de features numéricas de mercado" está encerrada para
tokens líquidos da Base. Não repetir com outro prompt no mesmo dataset.

### Auditoria: estamos fazendo algo errado? (2026-09-23)

| Teste | Resultado | Leitura |
|---|---|---|
| Controle positivo: retorno futuro de 15m vazado no estado, 200 chamadas | AUC **1.000** | Rótulos, junção e AUC detectam skill quando ela existe |
| Sinal do fluxo: Spearman(fluxo líquido, retorno do mesmo minuto) | ETH 0.998, SOL 0.952, VIRTUAL 0.773, cbBTC 0.187* | Compra/venda com o sinal certo. *cbBTC em USD é dominado pelo ETH |
| Mesmas decisões do ETH, resultado medido na Binance ETHUSDT | AUC 15m **0.453** [0.441, 0.464]; momentum da CEX 0.466 | O "invertido" não é artefato do AMM: a CEX também reverteu em 15m |
| Replicação independente: `Gaurav-Gosain/jev-alpha-bench` (ações, diário) | IC −0.02, ρ(P, retorno passado) ≈ 0.65 | Mesmo padrão: segue o momentum, erra |
| Replicação independente: `WebGrga/btc-jev-signal` (BTC, Kraken + book da Binance, forward) | 15m 47.8% de acerto, AUC 0.467, ρ(P, retorno 15m passado) 0.65 | Mesmo padrão com book e features mais ricas |
| `justinhe16/trade-jev` (NQ, book de 10 níveis, 15s–5min) | Agir em toda resposta: −$128.590; o +$20.795 é o melhor de 1.920 settings in-sample | Book não gera skill |
| `dijiclick/jev-perp-bot` (perps, walk-forward) | −17 bps/trade fora da amostra | Nada vence o custo |
| Desk ao vivo aowang (Hyperliquid **testnet**) | −$187.63 em ~50h, −$87.5 antes das fees | Maker na entrada, e perde mesmo assim |
| TradeRank.ai | −0.02%, 15º de 17 | Paper, n = 11 |
| Posts (Jarrod, RohOnChain, bitcoin.com) | Afirmam latência e custo, **nenhum PnL** | O "resultado positivo" não existe nas fontes |

Única célula não testada com evidência positiva fraca: horizonte de segundos a 5 min num order book (desk aowang,
AUC ~0.58 em 2.8h, rótulos sobrepostos, testnet com `oraclePx` no estado, um possível vazamento).
Também não testado por ninguém com o Jev real: estado descrito em palavras em vez de números.

## O que o post viral realmente mostra

| Afirmação | Evidência | O que ela **não** prova |
|---|---|---|
| Jev decide a cada bloco de 300 ms | Bot do Jarrod Watts, open source | Que a decisão tenha informação |
| Jev custa menos que o gás | SPEC.md do repo: "Jev inference for an hour ≈ $0.20" | Nada sobre P&L |
| "the model is not trying to be profitable" | Rodapé do SPEC.md do jev-trader, literal | É a posição do próprio autor |
| "Non-goals: no backtests" | SPEC.md | Nunca foi medida skill |

O bot do Jarrod é **maker** (limit post-only num order book, ganha o spread). Na Base o equivalente líquido é AMM,
onde você é **taker** e paga fee em todo swap. A barra econômica aqui é bem mais alta.

Prior honesto: a doc do Jev lista "arithmetic, numeric comparison" em *Not for*, e retorno de ETH em 5–60 min é
quase ruído branco. Minha expectativa é que o resultado seja **sem skill**. O experimento existe para trocar essa
opinião por um número, a ~$1.

## Hipóteses

- **H0:** P(alta) do Jev não carrega informação sobre o sinal do retorno futuro (AUC = 0.5).
- **H1:** AUC > 0.5, e maior que o que momentum/mean-reversion simples já dão de graça.

## Desenho

| Item | Valor | Por quê |
|---|---|---|
| Mercado | Uniswap v3 WETH/USDC 0.05%, Base (`0xd0b5…F224`) | Pool mais líquido da Base; ~54 swaps/min |
| Fonte | Logs `Swap` via RPC → barras de 1 min (mid pós-swap, volume, fluxo comprador/vendedor) | Mesma fonte no backtest e no forward: paridade exata |
| Cadência | 1 decisão a cada 5 min | 1 request por decisão; nunca agrupar timestamps (vazaria o futuro) |
| Horizontes | 1, 5, **15**, 60 min: 4 booleanos no mesmo request | Perguntas extras são quase grátis |
| Estado | Só números relativos (bps, USD de fluxo). Sem data, hora ou preço absoluto | O modelo não pode reconhecer o período histórico |
| Pergunta | "Will the ETH price be higher than it is now after h more minutes?" com `criteria.true/false` | P(alta) pura; custo fica no código, não no prompt |
| Rótulo | `close(t+h) > close(t)` | Empate conta como "não subiu" (igual ao `criteria.false`) |

O prompt não diz qual sinal é o mais forte (o do Jarrod diz "taker flow is the strongest signal", o que empurra o
modelo para momentum). Aqui o Jev tem que chegar lá sozinho.

## Métricas

| Métrica | Leitura | Papel |
|---|---|---|
| **AUC** + IC bootstrap 95% | 0.5 = não discrimina; imune à taxa de alta do período | **Primária** |
| AUC de momentum, mean-reversion, moeda | O que se obtém de graça, nas mesmas amostras | Barra a superar |
| Brier skill score vs climatologia | > 0 = probabilidades úteis | Critério |
| Acerto vs acaso pareado | Acaso = chute com o mesmo mix alta/baixa | Secundária |
| Log loss, IC Spearman, calibração por faixa | Forma e honestidade das probabilidades | Diagnóstico |
| P&L long/flat líquido | Spot na Base não permite short | Só na fase 1 |

Amostras sem sobreposição: em 15m, uma decisão a cada 15 min conta. Decisões sobrepostas inflariam a significância.

## Critérios (horizonte primário 15 min)

```
n < 500                                     → INCONCLUSIVO, rodar mais
IC(AUC) > 0.5  e  AUC > max(mom, meanrev)  e  BSS > 0   → PASSA
IC(AUC) < 0.5                                → FALHA (sinal invertido; inverter = hipótese nova)
senão                                        → FALHA, sem evidência de skill → encerrar
```

Horizontes 1, 5 e 60 min são exploratórios: com 4 testes, só contam com p < 0.0125 (Bonferroni). Um resultado bom
num horizonte secundário **não** passa a fase 0; vira hipótese pré-registrada da fase 1.

## Poder estatístico

| Fase | Amostras independentes em 15m | Erro-padrão da AUC | Menor efeito detectável |
|---|---|---|---|
| 0: backtest 30 dias | ~2.880 | ~0.011 | AUC ≈ 0.52–0.53 |
| 1: forward 14 dias | ~1.340 | ~0.016 | AUC ≈ 0.53–0.54 |

## Skill ≠ lucro

Cada swap paga 6 bps (fee 5 + impacto 1) + $0.01 de gás; ida e volta = 12 bps. Para empatar trocando a cada passo:

```
acerto_necessário = 0.5 + 12 bps / (2 × |movimento médio no horizonte|)
```

Com vol diária de ETH ~3%: 1m ≈ impossível, 5m ≈ 90%, 15m ≈ 75%, 60m ≈ 62%. O relatório calcula com o |r| real.
Uma AUC de 0.53 seria cientificamente interessante e economicamente inútil como taker.

## Controles contra auto-engano

| Risco | Controle |
|---|---|
| Vazamento do futuro no backtest | 1 request por timestamp; estado só com barras ≤ t; outcome juntado depois |
| Memorização do período | Sem datas, sem preço absoluto, só relativos |
| Backtest ≠ produção | Mesma função `buildState` nos dois modos; `stateHash` logado e rechecado no relatório (paridade) |
| Modelo muda no meio (sem pin de versão) | `drift.ts`: 10 estados canário sem cache; média \|Δp\| ≤ 0.02, máx ≤ 0.06 |
| Ruído do próprio modelo | Medido: **não é determinístico** nestes estados; o mesmo estado varia ±0.01–0.04 entre chamadas seguidas. Pequeno perto da faixa de P (0.34–0.61); atenua a AUC em direção a 0.5, não inverte |
| Prompt muda no meio | `PROMPT_VERSION` = hash das perguntas; o relatório não mistura versões |
| p-hacking de horizonte/limiar | Horizonte primário e limiar 0.5 fixados aqui |
| Tendência do período | AUC e acaso pareado não dependem da taxa de alta |
| Dados errados | Barras conferidas com GeckoTerminal: volume bate (razão 1.000); close difere ~5 bps = fee (eles usam preço de execução) |

## Fases

| Fase | O que | Duração | Sai para a próxima se |
|---|---|---|---|
| 0 | Backtest 30 dias | ~15 min, ~$0.66 | PASSA |
| 1 | Forward paper em tempo real (não rodou: a fase 0 falhou; o runner saiu do repo) | ≥ 14 dias, ~$0.30 | PASSA **e** P&L líquido > 0 **e** > buy & hold |
| 2 | Execução simulada com cotação real (QuoterV2) e tamanho | a definir | só se a fase 1 passar |

Fase 0 falhou → escrever o resultado e encerrar. Não "ajustar o prompt até dar certo" no mesmo dataset.

## UNKNOWN

- Se o Jev foi treinado em séries de preço (afeta o controle de memorização, não o forward).
- Se o `typesafe-ai/jev` muda durante o experimento; `drift.ts` detecta, mas não corrige.
- Se o resultado se repete em outro regime (mês com tendência, em vez de reversão). Um seguidor de tendência
  ganharia num mês assim, mas isso é momentum, que já sai de graça.
- Impacto real de swaps grandes: 1 bp é uma suposição para ~$10k neste pool.
- Um único regime de mercado em 30 dias; a fase 1 adiciona um segundo período.
