# Arbitragem semântica Limitless (Base) × Polymarket

> Pesquisa **somente leitura**, começada em 2026-09-23. Sem conta, sem carteira, sem ordem.

## TL;DR

- **Tese:** o mesmo evento é listado nas duas plataformas com preços diferentes. Comprar YES num lado e NO no outro
  por menos de $1 paga $1 na resolução, qualquer que seja o resultado. O edge é aritmético; o Jev só julga se os dois
  mercados são o mesmo evento e se as regras liquidam igual.
- **Por que a Limitless:** é o maior mercado de previsão da Base, mas com ~0.5% do volume do setor. Liquidez fragmentada
  tende a gerar preço defasado. Ela copia regras da Kalshi, então há sobreposição de eventos.

```sh
node arb/scan.ts                  # 1 snapshot: mercados, pares candidatos, Jev, books, arbitragem → arb/reports/scan-<ts>.md
node arb/scan.ts --p 0.9 --k 5    # mais exigente no Jev, mais candidatos por mercado
```

## Resultado do primeiro snapshot (2026-09-23 17:46 UTC)

| | Valor |
|---|---|
| Mercados binários | Limitless 1.140, Polymarket 58.528 |
| Pares candidatos julgados pelo Jev | 2.735 ($0.14 a preço de tabela) |
| Casados (relação e regras com P ≥ 0.8) | 78, todos corretos nos títulos. Conferi as regras de 5 pares com mais chance de pegadinha: **texto idêntico** |
| **Regras idênticas palavra por palavra (sem Jev)** | **640 de 1.140 (56%)**: a Limitless espelha o Polymarket |
| Diferença de preço entre as plataformas nos casados | mediana **0.1¢**, p90 0.9¢ |
| Custo do par no topo do book (melhor direção) | mediana 1.012, mínimo 0.989 |
| Oportunidades executáveis | 1: Lazio Serie A, lucro de $0.93 em $99 (0.9%) com 249 dias travados ≈ 1% ao ano |

**Leitura:** os preços da Limitless andam colados nos do Polymarket, provavelmente por market makers que espelham
o book. A arbitragem estática já é feita por eles, e o que sobra é o spread (~1.2¢). **O Jev não agrega aqui:** o
casamento é por texto idêntico. Hipótese de arbitragem semântica estática: **encerrada** para este par de venues.

Hipótese restante, não testada: deslocamentos **transitórios** durante eventos rápidos (jogo ao vivo, divulgação
de CPI), que exigem monitorar os books a cada ~30 s e executar rápido em duas chains.

## Uso

Somente leitura de endpoints públicos de dados de mercado. Operar em mercados de previsão depende da lei do seu país:
verifique antes. A Limitless bloqueia usuários dos EUA. Se o resolvedor de DNS local não alcançar algum endpoint,
`ARB_DNS=1.1.1.1,8.8.8.8` faz `arb/http.ts` resolver por esses servidores.

## Pipeline

| Etapa | Quem faz | Por quê |
|---|---|---|
| Normalizar cada mercado binário numa proposição (YES paga se X) | código | Grupos multi-outcome viram binários |
| Pares candidatos: TF-IDF nos títulos + fechamento em ±3 dias (esporte) ou ±60 dias | código | Datas e números no código: o Jev é ruim neles |
| Relação do par: `same` / `opposite` / `related` / `unrelated` | **Jev** (choice) | Julgamento semântico entre redações diferentes |
| As regras liquidam igual em cancelamento, empate, overtime, outra fonte, outro corte? | **Jev** (boolean) | É onde a arbitragem entre plataformas quebra |
| Custo das duas pernas andando nos dois books, após fees | código | Aritmética |

## Métricas e critérios (pré-registrados)

| Métrica | Passa | Encerra |
|---|---|---|
| Precisão do Jev nos pares que ele casa (≥ 50 rotulados) | ≥ 90% | < 90% |
| Oportunidades executáveis por semana: edge líquido ≥ 2%, profundidade ≥ $500 | ≥ 3 | < 3 |
| Edge sobrevive a regras idênticas (revisão humana do par antes de qualquer operação) | sim | — |

Um snapshot só é descritivo. A decisão pede uma semana de scans (por exemplo, a cada 30 min).

## UNKNOWN

- A fórmula de fee da Limitless: assumo 3% × min(p, 1−p) por perna.
- A fórmula exata de fee do Polymarket: assumo `feeSchedule.rate × min(p, 1−p)`, um teto.
- O capital fica travado até a resolução, e a Limitless liquida na Base (USDC) enquanto o Polymarket liquida na Polygon.
- Diferenças de fonte de resolução: a Limitless usa Chainlink TWAP 60s nos mercados cripto automáticos; o Polymarket usa outras fontes.
