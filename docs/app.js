// Jev on Base: study page. Plain SVG charts, no dependencies. Data: data/study.json (scripts/site-data.ts).
const REPO = 'https://github.com/r4topunk/jev-trading-study'

const STR = {
  en: {
    'nav.code': 'Code and data',
    'hero.title': 'We gave an AI trader 40,000 calls on Base. It did worse than a coin flip.',
    'hero.lede': 'Viral posts show Jev, a fast decision model, trading crypto every block. None of them checked whether its calls are right. We did: pre-registered, 90 days, four markets on Base, every decision scored against what the price did next.',
    'hero.cap': "How well Jev's probability that the price rises in 15 minutes separates rises from falls (AUC). 0.5 is a coin flip. Bars are 95% intervals.",
    'hero.facts': '<strong>{n}</strong> decisions across ETH, cbBTC, SOL and VIRTUAL, from {from} to {to}. All four together: AUC <strong>{auc}</strong>, 95% interval {lo} to {hi}.',
    'hero.all': 'All four',
    'axis.coin': 'coin flip',
    'axis.worse': 'worse than chance',
    'axis.better': 'better',
    'ui.table': 'Data table',
    'ui.market': 'Market',
    'ui.how': 'How we measured it',
    'claims.title': 'What the viral posts actually claim',
    'claims.lede': 'The posts sell speed and cost. We went looking for the profit.',
    'claims.h1': 'Source', 'claims.h2': 'What it shows', 'claims.h3': 'Profit shown',
    'claims.rows': [
      ['Jarrod Watts, jev-trader (Monad, Kuru)', 'A real order every 300 ms block', 'None. Its spec says "the model is not trying to be profitable". The live backend is a dry run.', 'none'],
      ['RohOnChain on X, two posts', 'Calibrated buy or sell calls in 81 to 100 ms', 'None', 'none'],
      ['Bitcoin.com article', '70 to 500 ms per call, $0.042 per million tokens', 'None', 'none'],
      ['jev-trade.com (Hyperliquid, 5 coins)', 'Real fills every tick', '−$187.63 in about 50 hours, on testnet', 'loss'],
      ['TradeRank.ai', 'Model competition, paper', '−0.02%, 15th of 17', 'loss'],
    ],
    'q1.title': 'Does Jev know where the price is going?',
    'q1.verdict': 'No. In every market and horizon its probabilities rank outcomes about as well as chance, and usually a little worse. Free rules do as well or better.',
    'q1.hTitle': 'Skill by horizon',
    'q1.hCap': 'Jev against two free rules: momentum bets the last move continues, mean reversion bets it reverses.',
    'q1.cTitle': 'Calibration at 15 minutes',
    'q1.cCap': 'When Jev said about {p}, the price rose {o} of the time. A calibrated model sits on the diagonal.',
    'series.jev': 'Jev', 'series.jevCi': 'Jev, 95% interval', 'series.mom': 'Momentum', 'series.mr': 'Mean reversion', 'series.lin': 'Free linear model', 'series.flip': 'Jev, flipped',
    'series.net': 'Jev, after costs', 'series.gross': 'Jev, before costs', 'series.hold': 'Buy and hold',
    'axis.auc': 'AUC', 'axis.said': 'Jev said: probability of a rise', 'axis.rose': 'Actually rose', 'axis.jevAuc': 'Jev AUC', 'axis.momAuc': 'Momentum AUC',
    'h.label': '{h} min',
    'sample.title': 'One decision, as Jev saw it',
    'sample.next': 'Show another decision',
    'sample.state': 'State sent to Jev',
    'sample.answer': "Jev's answer: probability the price is higher after",
    'sample.question': 'The 15-minute question',
    'sample.out': '{m}, {when} UTC. Over the next 15 minutes the price {dir} {bps} bps. Jev had put a rise at {p}.',
    'sample.rose': 'rose', 'sample.fell': 'fell',
    'how': [
      'Data: every Swap event of the pools, read from Base mainnet and folded into one-minute bars. Prices in USD; pools quoted in WETH are converted with the ETH/USDC pool of the same minute.',
      'State: returns, a 60-minute price path, volatility and taker buy and sell flow, all relative to the current price. No dates and no price levels, so the model cannot recognise the period.',
      'Questions: four yes-or-no questions per call, "Will the price be higher after 1, 5, 15 and 60 minutes?". One call per decision time, never batched, so no call can see the future.',
      'Scoring: AUC of the probability against the outcome on non-overlapping samples, with bootstrap intervals. Pooled results resample whole timestamps, because markets move together.',
      'Pre-registration: horizon, metric and pass rule were written before the runs. The 15-minute AUC had to be above 0.5, beat momentum and mean reversion, and beat the base rate on Brier score. It failed all three.',
      'Markets: ETH, cbBTC, SOL and VIRTUAL, the most traded eligible pools. ZEN, VVV and cbXRP were dropped by a rule set in advance: more than 25% of minutes without a single swap.',
    ],
    'q2.title': 'Then what is it doing?',
    'q2.verdict': 'Following the trend. Its probability of a rise tracks the last 15 to 60 minutes of price and order flow. On Base, pool prices tend to reverse over that horizon, so following the trend loses.',
    'q2.fTitle': 'What Jev follows in {m}',
    'q2.fCap': "Rank correlation between Jev's probability and each input. Near 1: Jev moves with that input.",
    'q2.rTitle': 'Jev tracks momentum, month after month',
    'q2.rCap': 'Each dot is one market in one 30-day block. Correlation r = {r}. Jev beat momentum in {b} of {n}.',
    'q2.note': 'The 90 days were a strong rally: ETH +70%, SOL +73%, cbBTC +42%, VIRTUAL +36%. Momentum over 15 minutes still lost in 11 of 12 market-months. A trend follower loses on this horizon whichever way the month goes.',
    'feat': { 'returnsBps.m1': 'Return, last minute', 'returnsBps.m15': 'Return, last 15 min', 'returnsBps.m60': 'Return, last hour', 'returnsBps.m240': 'Return, last 4 hours', 'flow.m15.buyShare': 'Buyer share of flow, 15 min', 'flow.m60.netUsd': 'Net taker flow, last hour', 'volatilityBps.m60': 'Volatility, last hour', 'activity.volume15VsAvg4h': 'Volume vs 4-hour average' },
    'q3.title': 'Did we get something wrong?',
    'q3.verdict': 'We tried to. The pipeline finds skill when it exists, the result survives a change of price source, and two independent projects found the same pattern.',
    'checks': [
      ['ok', 'Positive control', 'Leak the real 15-minute outcome into the state and the same pipeline scores AUC 1.000.', '1.000'],
      ['ok', 'Order-flow sign', 'Buy flow lines up with the same-minute price move, rank correlation 0.998 on ETH. The inputs mean what they say.', '0.998'],
      ['ok', 'Another price source', 'Scored against Binance ETH instead of the Base pool, Jev falls to 0.453. The result is not an artifact of AMM prices.', '0.453'],
      ['ok', 'Model noise', 'Jev gives slightly different answers to the same input, up to ±0.04. Noise pulls AUC toward 0.5; it cannot push it below.', '±0.04'],
      ['ref', 'jev-alpha-bench, stocks', 'Daily news and candles for Nasdaq-100 stocks. Negative information coefficient, and Jev follows the last move (ρ ≈ 0.65).', 'IC −0.02', 'https://github.com/Gaurav-Gosain/jev-alpha-bench'],
      ['ref', 'btc-jev-signal, Bitcoin', 'Live forward test with Kraken prices and the Binance order book. 47.8% hits at 15 minutes.', 'AUC 0.467', 'https://github.com/WebGrga/btc-jev-signal'],
      ['ref', 'trade-jev, Nasdaq futures', 'Ten-level order book every 15 seconds. Acting on every answer lost $128,590; the +$20,795 headline was the best of 1,920 settings tried on the same days.', '−$128,590', 'https://github.com/justinhe16/trade-jev'],
    ],
    'q4.title': 'What if you trade it anyway, or do the opposite?',
    'q4.verdict': 'Trading it loses to holding. Flipping it gives a weaker copy of a free linear model, still far from paying for its trades.',
    'q4.eTitle': 'Paper trading {m}: every 15-minute call',
    'q4.eCap': 'Long when Jev gave a rise better than even odds, in USDC otherwise. Each switch pays {c} bps plus gas. After 90 days: Jev {j}, before costs {g}, holding {h}.',
    'q4.fTitle': 'Out of sample: the last 45 days',
    'q4.fCap': 'Every model was fit or tuned on the first 45 days and scored on the last 45.',
    'q4.bTitle': 'The gap no prompt can close',
    'q4.bCap': 'Each trade on a Base pool pays the pool fee, price impact and gas both ways. Given how far prices move in 15 minutes, breaking even takes the hit rate marked on each row. Flipping Jev reaches the length of the bar.',
    'q4.have': 'Flipped Jev hits', 'q4.need': 'needed', 'q4.impossible': 'cannot break even',
    'q5.title': 'Is there money around it without predicting anything?',
    'q5.verdict': 'Yes, but it belongs to specialists who were already there. We checked three places and Jev adds nothing to any of them.',
    'fu': [
      { h: 'Arbitrage between prediction markets', big: '0.1¢', p: 'Median price gap between Limitless (on Base) and Polymarket for the same market. 56% of Limitless markets copy Polymarket rules word for word, so matching them needs no model. The one open trade paid 0.9% over 249 days.', src: 'arb/ARB.md' },
      { h: 'Providing liquidity', big: 'Fees ≈ losses', p: 'What LPs keep per unit of volume after arbitrage and protocol fees, in basis points. The price reversal we found is collected by arbitrageurs at the moment of the swap, not by LPs.', src: 'reports/lp-markout.md' },
      { h: 'Arbitrage between exchanges', big: '$3,524/day', p: 'Gross gap captured in one ETH pool on one day, before hedging fees and gas. The top three bots take 81 to 90% of it, and a profitable gap closes within one block.', src: 'reports/cexdex.md' },
    ],
    'fu.top3': 'Top 3 bots',
    'next.title': 'Where Jev might still help',
    'next.p1': 'Jev is cheap and quick at judging text. That turns into an edge only where text is the bottleneck, nobody else is reading it fast, and the price is slow to react. In liquid crypto those three rarely meet. The candidates left are narrow: long-tail tokens reacting to unstructured posts, filtering rugs at launch, and reading prediction-market rules. None is tested here.',
    'next.p2': 'Test the window before the model. For example, first measure how long a pool takes to reprice after a listing announcement. If it is one block, bots already own it and no classifier will help.',
    'repro.title': 'Run it yourself',
    'repro.p': 'Everything is in the repository: the pre-registered protocol, the code, and the reports. You need Node 23.6 or later and a Vercel AI Gateway key. The public Base RPC works, just slowly.',
    'links': [['Protocol and results (Portuguese)', 'EXPERIMENT.md'], ['Cross-market report', 'reports/markets.md'], ['LP economics', 'reports/lp-markout.md'], ['Arbitrage between exchanges', 'reports/cexdex.md'], ['Prediction-market arbitrage scan', 'arb/ARB.md']],
    'foot.p1': 'Research, not financial advice. Nothing here trades or holds funds.',
    'foot.p2': 'Data: Base mainnet swaps (Uniswap v3, Aerodrome Slipstream), Binance klines, Limitless and Polymarket public APIs. Jev through the Vercel AI Gateway. September 2026.',
    'foot.by': 'By',
    't.market': 'Market', 't.h': 'Horizon', 't.n': 'n', 't.bin': 'Jev said', 't.obs': 'Rose', 't.feature': 'Input', 't.rho': 'ρ', 't.aucAlone': 'AUC alone', 't.block': 'Block',
  },
  pt: {
    'nav.code': 'Código e dados',
    'hero.title': 'Demos 40 mil decisões a um trader de IA na Base. Ele foi pior que cara ou coroa.',
    'hero.lede': 'Posts virais mostram o Jev, um modelo de decisão rápido, operando crypto a cada bloco. Nenhum deles checou se as decisões acertam. Nós checamos: pré-registrado, 90 dias, quatro mercados na Base, cada decisão comparada com o que o preço fez depois.',
    'hero.cap': 'O quanto a probabilidade do Jev de o preço subir em 15 minutos separa altas de quedas (AUC). 0,5 é cara ou coroa. As barras são intervalos de 95%.',
    'hero.facts': '<strong>{n}</strong> decisões em ETH, cbBTC, SOL e VIRTUAL, de {from} a {to}. Os quatro juntos: AUC <strong>{auc}</strong>, intervalo de 95% de {lo} a {hi}.',
    'hero.all': 'Os quatro',
    'axis.coin': 'cara ou coroa',
    'axis.worse': 'pior que o acaso',
    'axis.better': 'melhor',
    'ui.table': 'Tabela de dados',
    'ui.market': 'Mercado',
    'ui.how': 'Como medimos',
    'claims.title': 'O que os posts virais realmente afirmam',
    'claims.lede': 'Os posts vendem velocidade e custo. Nós fomos atrás do lucro.',
    'claims.h1': 'Fonte', 'claims.h2': 'O que mostra', 'claims.h3': 'Lucro mostrado',
    'claims.rows': [
      ['Jarrod Watts, jev-trader (Monad, Kuru)', 'Uma ordem real a cada bloco de 300 ms', 'Nenhum. A spec diz "the model is not trying to be profitable". O backend ao vivo é dry run.', 'none'],
      ['RohOnChain no X, dois posts', 'Decisões calibradas de compra ou venda em 81 a 100 ms', 'Nenhum', 'none'],
      ['Artigo do Bitcoin.com', '70 a 500 ms por chamada, US$ 0,042 por milhão de tokens', 'Nenhum', 'none'],
      ['jev-trade.com (Hyperliquid, 5 moedas)', 'Execuções reais a cada tick', '−US$ 187,63 em cerca de 50 horas, na testnet', 'loss'],
      ['TradeRank.ai', 'Competição de modelos, paper', '−0,02%, 15º de 17', 'loss'],
    ],
    'q1.title': 'O Jev sabe para onde o preço vai?',
    'q1.verdict': 'Não. Em todo mercado e horizonte, as probabilidades dele ordenam os resultados quase como o acaso, e em geral um pouco pior. Regras grátis fazem igual ou melhor.',
    'q1.hTitle': 'Skill por horizonte',
    'q1.hCap': 'O Jev contra duas regras grátis: momentum aposta que o último movimento continua, mean reversion aposta que ele volta.',
    'q1.cTitle': 'Calibração em 15 minutos',
    'q1.cCap': 'Quando o Jev disse cerca de {p}, o preço subiu {o} das vezes. Um modelo calibrado fica na diagonal.',
    'series.jev': 'Jev', 'series.jevCi': 'Jev, intervalo de 95%', 'series.mom': 'Momentum', 'series.mr': 'Mean reversion', 'series.lin': 'Modelo linear grátis', 'series.flip': 'Jev invertido',
    'series.net': 'Jev, após custos', 'series.gross': 'Jev, antes dos custos', 'series.hold': 'Comprar e segurar',
    'axis.auc': 'AUC', 'axis.said': 'O Jev disse: probabilidade de alta', 'axis.rose': 'Subiu de fato', 'axis.jevAuc': 'AUC do Jev', 'axis.momAuc': 'AUC do momentum',
    'h.label': '{h} min',
    'sample.title': 'Uma decisão, como o Jev viu',
    'sample.next': 'Mostrar outra decisão',
    'sample.state': 'Estado enviado ao Jev',
    'sample.answer': 'Resposta do Jev: probabilidade de o preço estar mais alto depois de',
    'sample.question': 'A pergunta de 15 minutos',
    'sample.out': '{m}, {when} UTC. Nos 15 minutos seguintes o preço {dir} {bps} bps. O Jev tinha dado {p} de chance de alta.',
    'sample.rose': 'subiu', 'sample.fell': 'caiu',
    'how': [
      'Dados: todo evento Swap dos pools, lido da mainnet da Base e agregado em barras de um minuto. Preços em USD; pools cotados em WETH são convertidos pelo pool ETH/USDC do mesmo minuto.',
      'Estado: retornos, um caminho de preço de 60 minutos, volatilidade e fluxo comprador e vendedor, tudo relativo ao preço atual. Sem datas e sem nível de preço, para o modelo não reconhecer o período.',
      'Perguntas: quatro perguntas de sim ou não por chamada, "O preço vai estar mais alto depois de 1, 5, 15 e 60 minutos?". Uma chamada por decisão, nunca agrupadas, para nenhuma chamada enxergar o futuro.',
      'Métrica: AUC da probabilidade contra o resultado, em amostras sem sobreposição, com intervalos por bootstrap. O agregado reamostra timestamps inteiros, porque os mercados andam juntos.',
      'Pré-registro: horizonte, métrica e regra de aprovação foram escritos antes de rodar. A AUC de 15 minutos precisava ficar acima de 0,5, vencer momentum e mean reversion e vencer a taxa base no Brier. Falhou nos três.',
      'Mercados: ETH, cbBTC, SOL e VIRTUAL, os pools elegíveis mais negociados. ZEN, VVV e cbXRP saíram por uma regra fixada antes: mais de 25% dos minutos sem nenhum swap.',
    ],
    'q2.title': 'Então o que ele está fazendo?',
    'q2.verdict': 'Seguindo a tendência. A probabilidade de alta dele acompanha os últimos 15 a 60 minutos de preço e fluxo. Na Base, o preço dos pools tende a voltar nesse horizonte, então seguir a tendência perde.',
    'q2.fTitle': 'O que o Jev segue em {m}',
    'q2.fCap': 'Correlação de postos entre a probabilidade do Jev e cada entrada. Perto de 1: o Jev anda junto com aquela entrada.',
    'q2.rTitle': 'O Jev acompanha o momentum, mês após mês',
    'q2.rCap': 'Cada ponto é um mercado em um bloco de 30 dias. Correlação r = {r}. O Jev venceu o momentum em {b} de {n}.',
    'q2.note': 'Os 90 dias foram de alta forte: ETH +70%, SOL +73%, cbBTC +42%, VIRTUAL +36%. Mesmo assim, o momentum de 15 minutos perdeu em 11 de 12 mercado-meses. Nesse horizonte, quem segue tendência perde, qualquer que seja a direção do mês.',
    'feat': { 'returnsBps.m1': 'Retorno, último minuto', 'returnsBps.m15': 'Retorno, últimos 15 min', 'returnsBps.m60': 'Retorno, última hora', 'returnsBps.m240': 'Retorno, últimas 4 horas', 'flow.m15.buyShare': 'Fatia compradora do fluxo, 15 min', 'flow.m60.netUsd': 'Fluxo líquido, última hora', 'volatilityBps.m60': 'Volatilidade, última hora', 'activity.volume15VsAvg4h': 'Volume vs média de 4 horas' },
    'q3.title': 'Será que erramos alguma coisa?',
    'q3.verdict': 'Tentamos achar o erro. O pipeline detecta skill quando ela existe, o resultado sobrevive à troca da fonte de preço, e dois projetos independentes acharam o mesmo padrão.',
    'checks': [
      ['ok', 'Controle positivo', 'Vazando o resultado real de 15 minutos no estado, o mesmo pipeline marca AUC 1,000.', '1,000'],
      ['ok', 'Sinal do fluxo', 'O fluxo comprador acompanha o movimento do preço no mesmo minuto, correlação de postos 0,998 no ETH. As entradas significam o que dizem.', '0,998'],
      ['ok', 'Outra fonte de preço', 'Medido contra o ETH da Binance em vez do pool da Base, o Jev cai para 0,453. O resultado não é artefato do preço de AMM.', '0,453'],
      ['ok', 'Ruído do modelo', 'O Jev responde um pouco diferente para a mesma entrada, até ±0,04. Ruído puxa a AUC para 0,5; não consegue empurrar para baixo.', '±0,04'],
      ['ref', 'jev-alpha-bench, ações', 'Notícias e candles diários de ações da Nasdaq-100. Coeficiente de informação negativo, e o Jev segue o último movimento (ρ ≈ 0,65).', 'IC −0,02', 'https://github.com/Gaurav-Gosain/jev-alpha-bench'],
      ['ref', 'btc-jev-signal, Bitcoin', 'Teste ao vivo com preço da Kraken e o book da Binance. 47,8% de acerto em 15 minutos.', 'AUC 0,467', 'https://github.com/WebGrga/btc-jev-signal'],
      ['ref', 'trade-jev, futuros da Nasdaq', 'Book de dez níveis a cada 15 segundos. Seguir toda resposta perdeu US$ 128.590; o destaque de +US$ 20.795 foi a melhor de 1.920 configurações testadas nos mesmos dias.', '−US$ 128.590', 'https://github.com/justinhe16/trade-jev'],
    ],
    'q4.title': 'E se operar mesmo assim, ou fazer o contrário?',
    'q4.verdict': 'Operar perde para segurar. Inverter dá uma cópia mais fraca de um modelo linear grátis, ainda longe de pagar os custos.',
    'q4.eTitle': 'Paper trading em {m}: toda decisão de 15 minutos',
    'q4.eCap': 'Comprado quando o Jev deu mais de 50% de chance de alta, em USDC caso contrário. Cada troca paga {c} bps mais gás. Em 90 dias: Jev {j}, antes dos custos {g}, segurando {h}.',
    'q4.fTitle': 'Fora da amostra: os últimos 45 dias',
    'q4.fCap': 'Cada modelo foi ajustado nos primeiros 45 dias e avaliado nos últimos 45.',
    'q4.bTitle': 'A distância que nenhum prompt fecha',
    'q4.bCap': 'Cada operação num pool da Base paga fee, impacto de preço e gás na ida e na volta. Pelo tamanho dos movimentos em 15 minutos, empatar exige o acerto marcado em cada linha. O Jev invertido chega até o fim da barra.',
    'q4.have': 'Jev invertido acerta', 'q4.need': 'necessário', 'q4.impossible': 'impossível empatar',
    'q5.title': 'Existe dinheiro em volta, sem prever nada?',
    'q5.verdict': 'Sim, mas ele pertence a especialistas que já estavam lá. Olhamos três lugares, e o Jev não agrega em nenhum.',
    'fu': [
      { h: 'Arbitragem entre mercados de previsão', big: '0,1¢', p: 'Diferença mediana de preço entre Limitless (na Base) e Polymarket no mesmo mercado. 56% dos mercados da Limitless copiam as regras do Polymarket palavra por palavra, então casá-los não precisa de modelo. A única operação aberta rendia 0,9% em 249 dias.', src: 'arb/ARB.md' },
      { h: 'Prover liquidez', big: 'Fees ≈ perdas', p: 'O que o LP guarda por unidade de volume depois da arbitragem e das taxas do protocolo, em pontos-base. A reversão de preço que achamos fica com os arbitradores no instante do swap, não com os LPs.', src: 'reports/lp-markout.md' },
      { h: 'Arbitragem entre exchanges', big: 'US$ 3.524/dia', p: 'Diferença bruta capturada em um pool de ETH em um dia, antes das fees de hedge e do gás. Os três maiores bots levam de 81 a 90%, e um gap lucrativo fecha em um bloco.', src: 'reports/cexdex.md' },
    ],
    'fu.top3': 'Top 3 bots',
    'next.title': 'Onde o Jev ainda pode ajudar',
    'next.p1': 'O Jev é barato e rápido para julgar texto. Isso só vira edge onde o texto é o gargalo, ninguém mais está lendo rápido e o preço demora a reagir. Em crypto líquido, as três coisas raramente se encontram. Os candidatos que sobram são estreitos: tokens de cauda longa reagindo a posts sem formato, filtro de rug em lançamentos e leitura de regras de mercados de previsão. Nenhum foi testado aqui.',
    'next.p2': 'Teste a janela antes do modelo. Por exemplo, meça primeiro quanto tempo um pool leva para reprecificar depois de um anúncio de listagem. Se for um bloco, os bots já dominam e nenhum classificador ajuda.',
    'repro.title': 'Rode você mesmo',
    'repro.p': 'Está tudo no repositório: o protocolo pré-registrado, o código e os relatórios. Você precisa de Node 23.6 ou mais novo e de uma chave do Vercel AI Gateway. O RPC público da Base funciona, só que devagar.',
    'links': [['Protocolo e resultados', 'EXPERIMENT.md'], ['Relatório entre mercados', 'reports/markets.md'], ['Economia de LP', 'reports/lp-markout.md'], ['Arbitragem entre exchanges', 'reports/cexdex.md'], ['Scan de arbitragem em mercados de previsão', 'arb/ARB.md']],
    'foot.p1': 'Pesquisa, não recomendação financeira. Nada aqui opera ou guarda fundos.',
    'foot.p2': 'Dados: swaps da mainnet da Base (Uniswap v3, Aerodrome Slipstream), klines da Binance, APIs públicas da Limitless e do Polymarket. Jev pelo Vercel AI Gateway. Setembro de 2026.',
    'foot.by': 'Por',
    't.market': 'Mercado', 't.h': 'Horizonte', 't.n': 'n', 't.bin': 'O Jev disse', 't.obs': 'Subiu', 't.feature': 'Entrada', 't.rho': 'ρ', 't.aucAlone': 'AUC sozinha', 't.block': 'Bloco',
  },
}

let lang = (() => {
  const q = new URLSearchParams(location.search).get('lang')
  if (q === 'pt' || q === 'en') return q
  try { const s = localStorage.getItem('lang'); if (s === 'pt' || s === 'en') return s } catch {}
  return (navigator.language || 'en').toLowerCase().startsWith('pt') ? 'pt' : 'en'
})()
let market = 'eth'
let sampleIdx = 0
let D = null
let animated = false

const t = (k) => STR[lang][k] ?? STR.en[k] ?? k
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')
const loc = () => (lang === 'pt' ? 'pt-BR' : 'en-US')
const num = (x, d = 3) => new Intl.NumberFormat(loc(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(x)
const pct = (x, d = 0) => new Intl.NumberFormat(loc(), { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(x)
const signedPct = (x) => { const v = new Intl.NumberFormat(loc(), { maximumFractionDigits: 0 }).format(Math.abs(x)); return v === '0' ? '0%' : `${x > 0 ? '+' : '−'}${v}%` }
const date = (s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => new Intl.DateTimeFormat(loc(), { ...opts, timeZone: 'UTC' }).format(new Date(s * 1000))
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const mk = () => D.markets.find((m) => m.id === market)

// ---------- tiny SVG kit ----------
const NS = 'http://www.w3.org/2000/svg'
function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v)
  if (parent) parent.appendChild(n)
  return n
}
function txt(parent, x, y, s, attrs = {}) {
  const n = el('text', { x, y, ...attrs }, parent)
  n.textContent = s
  return n
}
function scale(d0, d1, r0, r1) {
  const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
  f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0)
  return f
}
function ticks(a, b, step) {
  const out = []
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step)
  return out
}
function makeSvg(host, h) {
  host.textContent = ''
  const w = Math.max(280, host.clientWidth)
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h }, host)
  return { svg, w, h }
}

// ---------- tooltip ----------
const tip = document.getElementById('tip')
function showTip(evt, rows, title) {
  tip.textContent = ''
  if (title) { const h = document.createElement('div'); h.textContent = title; h.style.opacity = '0.75'; h.style.marginBottom = '3px'; tip.appendChild(h) }
  for (const r of rows) {
    const line = document.createElement('div')
    if (r.color) { const k = document.createElement('span'); k.className = 'k'; k.style.background = r.color; line.appendChild(k) }
    const b = document.createElement('b'); b.textContent = r.value; line.appendChild(b)
    if (r.label) { const s = document.createElement('span'); s.textContent = `  ${r.label}`; line.appendChild(s) }
    tip.appendChild(line)
  }
  tip.hidden = false
  let x, y
  if (evt.clientX !== undefined && evt.type !== 'focus') { x = evt.clientX; y = evt.clientY } else { const b = evt.target.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top }
  const tw = tip.offsetWidth, th = tip.offsetHeight
  tip.style.left = `${Math.min(innerWidth - tw - 8, Math.max(8, x + 14))}px`
  tip.style.top = `${Math.max(8, y - th - 12)}px`
}
const hideTip = () => (tip.hidden = true)
function hover(node, rows, title, label) {
  node.setAttribute('tabindex', '0')
  node.setAttribute('role', 'img')
  node.setAttribute('aria-label', label ?? `${title ?? ''} ${rows.map((r) => `${r.label ?? ''} ${r.value}`).join(', ')}`)
  const on = (e) => showTip(e, rows, title)
  node.addEventListener('pointerenter', on)
  node.addEventListener('pointermove', on)
  node.addEventListener('pointerleave', hideTip)
  node.addEventListener('focus', on)
  node.addEventListener('blur', hideTip)
}

function table(host, head, rows) {
  host.textContent = ''
  const tb = document.createElement('table')
  const tr = document.createElement('tr')
  for (const h of head) { const th = document.createElement('th'); th.textContent = h; tr.appendChild(th) }
  const thead = document.createElement('thead'); thead.appendChild(tr); tb.appendChild(thead)
  const body = document.createElement('tbody')
  for (const r of rows) {
    const row = document.createElement('tr')
    for (const c of r) { const td = document.createElement('td'); td.textContent = c; row.appendChild(td) }
    body.appendChild(row)
  }
  tb.appendChild(body)
  host.appendChild(tb)
}

function legend(host, items) {
  const L = document.createElement('div')
  L.className = 'legend'
  for (const it of items) {
    const s = document.createElement('span')
    const i = document.createElement('i')
    if (it.line) i.className = 'line'
    i.style.background = it.color
    s.appendChild(i)
    s.appendChild(document.createTextNode(it.label))
    L.appendChild(s)
  }
  host.prepend(L)
}

// ---------- charts ----------
function heroChart() {
  const host = document.getElementById('hero-chart')
  const rows = [...D.markets.map((m) => ({ name: m.symbol, ...m.horizons.find((h) => h.h === 15) })), { name: t('hero.all'), ...D.pooled, all: true }]
  const wide = host.clientWidth >= 640
  const rowH = wide ? 52 : 42, top = 30, bottom = 44
  const { svg, w } = makeSvg(host, top + rows.length * rowH + bottom)
  const left = wide ? 130 : 84, right = wide ? 70 : 16
  const x = scale(0.43, 0.55, left, w - right)
  const g = el('g', { class: 'grid' }, svg)
  for (const v of ticks(0.44, 0.54, 0.02)) {
    el('line', { x1: x(v), x2: x(v), y1: top - 8, y2: top + rows.length * rowH }, g)
    txt(svg, x(v), top + rows.length * rowH + 18, num(v, 2), { 'text-anchor': 'middle', class: 'tick' })
  }
  el('line', { x1: x(0.5), x2: x(0.5), y1: top - 14, y2: top + rows.length * rowH + 4, class: 'coin-line' }, svg)
  txt(svg, x(0.5), top - 18, t('axis.coin'), { 'text-anchor': 'middle', class: 'coin-label' })
  txt(svg, x(0.5) - 8, top + rows.length * rowH + 36, `← ${t('axis.worse')}`, { 'text-anchor': 'end', class: 'coin-label' })
  txt(svg, x(0.5) + 8, top + rows.length * rowH + 36, `${t('axis.better')} →`, { 'text-anchor': 'start', class: 'coin-label' })
  const jev = css('--jev'), surface = css('--surface')
  const marks = []
  rows.forEach((r, i) => {
    const cy = top + i * rowH + rowH / 2
    txt(svg, left - 14, cy + 5, r.name, { 'text-anchor': 'end', class: 'row-label', 'font-size': wide ? 15 : 13, 'font-weight': r.all ? 800 : 600 })
    const ci = el('line', { x1: x(0.5), x2: x(0.5), y1: cy, y2: cy, stroke: jev, 'stroke-width': r.all ? 5 : 3, 'stroke-linecap': 'round', class: 'mark' }, svg)
    const dot = el('circle', { cx: x(0.5), cy, r: (r.all ? 8 : 6.5) * (wide ? 1 : 0.85), fill: jev, stroke: surface, 'stroke-width': 2, class: 'mark' }, svg)
    const lab = txt(svg, w - right + 10, cy + 5, num(r.auc), { class: 'val-label', opacity: 0, 'font-size': 14, 'font-weight': r.all ? 800 : 500 })
    if (!wide) lab.setAttribute('display', 'none')
    const hit = el('rect', { x: left, y: cy - rowH / 2, width: w - left - right, height: rowH, class: 'hit' }, svg)
    hover(hit, [{ value: num(r.auc), label: 'AUC', color: jev }, { value: `${num(r.lo)} – ${num(r.hi)}`, label: '95%' }, ...(r.n ? [{ value: r.n.toLocaleString(loc()), label: 'n' }] : [])], r.name)
    marks.push({ r, ci, dot, lab })
  })
  const place = (k) => marks.forEach(({ r, ci, dot, lab }) => {
    const c = 0.5 + (r.auc - 0.5) * k
    dot.setAttribute('cx', x(c))
    ci.setAttribute('x1', x(c + (r.lo - r.auc) * k))
    ci.setAttribute('x2', x(c + (r.hi - r.auc) * k))
    lab.setAttribute('opacity', k)
  })
  if (animated || reduced()) return place(1)
  animated = true
  const t0 = performance.now(), dur = 1100
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - (1 - p) ** 3
    place(e)
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function horizonChart() {
  const host = document.getElementById('h-chart')
  const m = mk()
  const rows = m.horizons
  const rowH = 58, top = 22, bottom = 40
  const { svg, w } = makeSvg(host, top + rows.length * rowH + bottom)
  const left = 58, right = 14
  const vals = rows.flatMap((r) => [r.lo, r.hi, r.mom, r.mr])
  const lo = Math.min(0.44, Math.floor(Math.min(...vals) * 50) / 50), hi = Math.max(0.56, Math.ceil(Math.max(...vals) * 50) / 50)
  const x = scale(lo, hi, left, w - right)
  const g = el('g', { class: 'grid' }, svg)
  for (const v of ticks(lo, hi, 0.04)) {
    el('line', { x1: x(v), x2: x(v), y1: top, y2: top + rows.length * rowH }, g)
    txt(svg, x(v), top + rows.length * rowH + 18, num(v, 2), { 'text-anchor': 'middle', class: 'tick' })
  }
  txt(svg, (left + w - right) / 2, top + rows.length * rowH + 36, t('axis.auc'), { 'text-anchor': 'middle', class: 'coin-label' })
  el('line', { x1: x(0.5), x2: x(0.5), y1: top - 6, y2: top + rows.length * rowH, class: 'coin-line' }, svg)
  txt(svg, x(0.5), top - 10, t('axis.coin'), { 'text-anchor': 'middle', class: 'coin-label' })
  const C = { jev: css('--jev'), mom: css('--mom'), mr: css('--mr') }, surface = css('--surface')
  rows.forEach((r, i) => {
    const cy = top + i * rowH + rowH / 2
    txt(svg, left - 12, cy + 4, fill(t('h.label'), { h: r.h }), { 'text-anchor': 'end', class: 'row-label' })
    const pts = [
      { key: 'mom', v: r.mom, dy: -14, label: t('series.mom') },
      { key: 'jev', v: r.auc, dy: 0, label: t('series.jev') },
      { key: 'mr', v: r.mr, dy: 14, label: t('series.mr') },
    ]
    el('line', { x1: x(r.lo), x2: x(r.hi), y1: cy, y2: cy, stroke: C.jev, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg)
    for (const p of pts) el('circle', { cx: x(p.v), cy: cy + p.dy, r: 5, fill: C[p.key], stroke: surface, 'stroke-width': 2 }, svg)
    const hit = el('rect', { x: left, y: cy - rowH / 2, width: w - left - right, height: rowH, class: 'hit' }, svg)
    hover(hit, [
      { value: `${num(r.auc)} (${num(r.lo)} – ${num(r.hi)})`, label: t('series.jev'), color: C.jev },
      { value: num(r.mom), label: t('series.mom'), color: C.mom },
      { value: num(r.mr), label: t('series.mr'), color: C.mr },
      { value: r.n.toLocaleString(loc()), label: 'n' },
    ], `${m.symbol}, ${fill(t('h.label'), { h: r.h })}`)
  })
  legend(host, [{ label: t('series.jevCi'), color: C.jev }, { label: t('series.mom'), color: C.mom }, { label: t('series.mr'), color: C.mr }])
  table(document.getElementById('h-table'), [t('t.h'), 'Jev', '95%', t('series.mom'), t('series.mr'), t('t.n')], rows.map((r) => [fill(t('h.label'), { h: r.h }), num(r.auc), `${num(r.lo)} – ${num(r.hi)}`, num(r.mom), num(r.mr), r.n.toLocaleString(loc())]))
}

function calibChart() {
  const host = document.getElementById('c-chart')
  const m = mk()
  const bins = m.calib.filter((b) => b.n >= 30)
  const { svg, w, h } = makeSvg(host, 300)
  const left = 46, right = 14, top = 14, bottom = 44
  const x = scale(0.25, 0.75, left, w - right), y = scale(0.3, 0.7, h - bottom, top)
  const g = el('g', { class: 'grid' }, svg)
  for (const v of ticks(0.3, 0.7, 0.1)) {
    el('line', { x1: left, x2: w - right, y1: y(v), y2: y(v) }, g)
    txt(svg, left - 8, y(v) + 4, pct(v), { 'text-anchor': 'end', class: 'tick' })
  }
  for (const v of ticks(0.3, 0.7, 0.1)) txt(svg, x(v), h - bottom + 18, pct(v), { 'text-anchor': 'middle', class: 'tick' })
  txt(svg, (left + w - right) / 2, h - 6, t('axis.said'), { 'text-anchor': 'middle', class: 'coin-label' })
  txt(svg, left, top - 2, t('axis.rose'), { class: 'coin-label' })
  el('line', { x1: x(0.3), y1: y(0.3), x2: x(0.7), y2: y(0.7), class: 'coin-line' }, svg)
  const jev = css('--jev'), surface = css('--surface')
  el('polyline', { points: bins.map((b) => `${x(b.p)},${y(b.obs)}`).join(' '), fill: 'none', stroke: jev, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg)
  for (const b of bins) {
    el('circle', { cx: x(b.p), cy: y(b.obs), r: 5, fill: jev, stroke: surface, 'stroke-width': 2 }, svg)
    const hit = el('circle', { cx: x(b.p), cy: y(b.obs), r: 14, class: 'hit' }, svg)
    hover(hit, [{ value: pct(b.obs, 1), label: t('t.obs'), color: jev }, { value: pct(b.p, 1), label: t('t.bin') }, { value: b.n.toLocaleString(loc()), label: 'n' }], m.symbol)
  }
  const top1 = [...bins].filter((b) => b.n >= 100).sort((a, b) => b.p - a.p)[0]
  document.getElementById('c-cap').textContent = top1 ? fill(t('q1.cCap'), { p: pct(top1.p), o: pct(top1.obs) }) : ''
  table(document.getElementById('c-table'), [t('t.bin'), t('t.obs'), t('t.n')], m.calib.filter((b) => b.n).map((b) => [`${pct(b.lo)}–${pct(b.hi)} (${pct(b.p, 1)})`, pct(b.obs, 1), b.n.toLocaleString(loc())]))
}

function featureChart() {
  const host = document.getElementById('f-chart')
  const m = mk()
  document.getElementById('f-title').textContent = fill(t('q2.fTitle'), { m: m.symbol })
  const rows = m.features
  // Narrow screens: the label sits above its bar instead of beside it.
  const narrow = host.clientWidth < 460
  const rowH = narrow ? 42 : 30, top = 8, bottom = 30
  const { svg, w } = makeSvg(host, top + rows.length * rowH + bottom)
  const left = narrow ? 4 : Math.min(210, w * 0.46), right = 44
  const x = scale(-0.2, 1, left, w - right)
  const barY = (i) => top + i * rowH + (narrow ? 28 : rowH / 2)
  const g = el('g', { class: 'grid' }, svg)
  for (const v of [0, 0.5, 1]) {
    el('line', { x1: x(v), x2: x(v), y1: top, y2: top + rows.length * rowH }, g)
    txt(svg, x(v), top + rows.length * rowH + 18, num(v, 1), { 'text-anchor': 'middle', class: 'tick' })
  }
  el('line', { x1: x(0), x2: x(0), y1: top, y2: top + rows.length * rowH, class: 'baseline' }, svg)
  const jev = css('--jev')
  const names = t('feat')
  rows.forEach((r, i) => {
    const cy = barY(i)
    const name = names[r.k] ?? r.k
    if (narrow) txt(svg, left, top + i * rowH + 13, name, { class: 'row-label', 'font-weight': 500 })
    else txt(svg, left - 10, cy + 4, name, { 'text-anchor': 'end', class: 'row-label', 'font-weight': 500 })
    const x0 = x(Math.min(0, r.rho)), x1 = x(Math.max(0, r.rho)), bw = Math.max(1, x1 - x0), bh = narrow ? 10 : 12
    const rr = Math.min(4, bw / 2)
    // 4px rounded data end, square at the baseline
    const d = r.rho >= 0
      ? `M${x0},${cy - bh / 2} H${x1 - rr} Q${x1},${cy - bh / 2} ${x1},${cy - bh / 2 + rr} V${cy + bh / 2 - rr} Q${x1},${cy + bh / 2} ${x1 - rr},${cy + bh / 2} H${x0} Z`
      : `M${x1},${cy - bh / 2} H${x0 + rr} Q${x0},${cy - bh / 2} ${x0},${cy - bh / 2 + rr} V${cy + bh / 2 - rr} Q${x0},${cy + bh / 2} ${x0 + rr},${cy + bh / 2} H${x1} Z`
    el('path', { d, fill: jev }, svg)
    txt(svg, (r.rho >= 0 ? x1 : x0) + (r.rho >= 0 ? 6 : -6), cy + 4, num(r.rho, 2), { class: 'val-label', 'text-anchor': r.rho >= 0 ? 'start' : 'end' })
    const hit = el('rect', { x: 0, y: top + i * rowH, width: w, height: rowH, class: 'hit' }, svg)
    hover(hit, [{ value: num(r.rho, 2), label: t('t.rho'), color: jev }, { value: num(r.auc), label: t('t.aucAlone') }], name)
  })
  table(document.getElementById('f-table'), [t('t.feature'), t('t.rho'), t('t.aucAlone')], rows.map((r) => [names[r.k] ?? r.k, num(r.rho, 2), num(r.auc)]))
}

function regimeChart() {
  const host = document.getElementById('r-chart')
  const cells = D.regime.cells
  const { svg, w, h } = makeSvg(host, 300)
  const left = 46, right = 14, top = 22, bottom = 44
  const x = scale(0.44, 0.53, left, w - right), y = scale(0.42, 0.52, h - bottom, top)
  const g = el('g', { class: 'grid' }, svg)
  for (const v of ticks(0.44, 0.52, 0.02)) {
    el('line', { x1: x(v), x2: x(v), y1: top, y2: h - bottom }, g)
    txt(svg, x(v), h - bottom + 18, num(v, 2), { 'text-anchor': 'middle', class: 'tick' })
  }
  for (const v of ticks(0.42, 0.52, 0.02)) {
    el('line', { x1: left, x2: w - right, y1: y(v), y2: y(v) }, g)
    txt(svg, left - 8, y(v) + 4, num(v, 2), { 'text-anchor': 'end', class: 'tick' })
  }
  txt(svg, (left + w - right) / 2, h - 6, t('axis.momAuc'), { 'text-anchor': 'middle', class: 'coin-label' })
  txt(svg, left, top - 8, t('axis.jevAuc'), { class: 'coin-label' })
  el('line', { x1: x(0.5), x2: x(0.5), y1: top, y2: h - bottom, class: 'coin-line' }, svg)
  el('line', { x1: left, x2: w - right, y1: y(0.5), y2: y(0.5), class: 'coin-line' }, svg)
  el('line', { x1: x(0.44), y1: y(0.44), x2: x(0.52), y2: y(0.52), stroke: css('--axis'), 'stroke-width': 1 }, svg)
  const jev = css('--jev'), surface = css('--surface')
  txt(svg, w - right - 4, top + 12, `r = ${num(D.regime.r, 2)}`, { 'text-anchor': 'end', class: 'row-label' })
  for (const c of cells) {
    el('circle', { cx: x(c.mom), cy: y(c.jev), r: 5.5, fill: jev, stroke: surface, 'stroke-width': 2 }, svg)
    const hit = el('circle', { cx: x(c.mom), cy: y(c.jev), r: 13, class: 'hit' }, svg)
    hover(hit, [{ value: num(c.jev), label: t('series.jev'), color: jev }, { value: num(c.mom), label: t('series.mom') }, { value: c.n.toLocaleString(loc()), label: 'n' }], `${c.m}, ${date(c.from, { day: 'numeric', month: 'short' })} +30d`)
  }
  document.getElementById('r-cap').textContent = fill(t('q2.rCap'), { r: num(D.regime.r, 2), b: D.regime.beat, n: cells.length })
  table(document.getElementById('r-table'), [t('t.market'), t('t.block'), t('series.jev'), t('series.mom'), 'n'], cells.map((c) => [c.m, date(c.from, { day: 'numeric', month: 'short' }), num(c.jev), num(c.mom), c.n.toLocaleString(loc())]))
}

function equityChart() {
  const host = document.getElementById('e-chart')
  const m = mk()
  const E = m.equity
  document.getElementById('e-title').textContent = fill(t('q4.eTitle'), { m: m.symbol })
  document.getElementById('e-cap').textContent = fill(t('q4.eCap'), { c: num(m.sideCostBps, 1), j: signedPct((E.jev.at(-1) - 1) * 100), g: signedPct((E.gross.at(-1) - 1) * 100), h: signedPct((E.hold.at(-1) - 1) * 100) })
  const { svg, w, h } = makeSvg(host, 300)
  const left = 50, right = 58, top = 14, bottom = 30
  const x = scale(E.t[0], E.t.at(-1), left, w - right)
  const ymax = Math.max(1.2, ...E.hold, ...E.gross) * 1.05
  const y = scale(0, ymax, h - bottom, top)
  const g = el('g', { class: 'grid' }, svg)
  for (const v of ticks(0, ymax, 0.5)) {
    el('line', { x1: left, x2: w - right, y1: y(v), y2: y(v) }, g)
    txt(svg, left - 8, y(v) + 4, signedPct((v - 1) * 100), { 'text-anchor': 'end', class: 'tick' })
  }
  el('line', { x1: left, x2: w - right, y1: y(1), y2: y(1), class: 'baseline' }, svg)
  const months = []
  for (let i = 0; i < E.t.length; i++) { const d = new Date(E.t[i] * 1000); if (d.getUTCDate() === 1 && d.getUTCHours() < 6) months.push(E.t[i]) }
  for (const s of months) txt(svg, x(s), h - bottom + 18, date(s, { month: 'short' }), { 'text-anchor': 'middle', class: 'tick' })
  const S = [
    { k: 'hold', color: css('--coin'), label: t('series.hold') },
    { k: 'gross', color: css('--jev-soft'), label: t('series.gross') },
    { k: 'jev', color: css('--jev'), label: t('series.net') },
  ]
  for (const s of S) {
    el('polyline', { points: E[s.k].map((v, i) => `${x(E.t[i])},${y(v)}`).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg)
    const last = E[s.k].at(-1)
    el('circle', { cx: x(E.t.at(-1)), cy: y(last), r: 4, fill: s.color, stroke: css('--surface'), 'stroke-width': 2 }, svg)
    txt(svg, x(E.t.at(-1)) + 8, y(last) + 4, signedPct((last - 1) * 100), { class: 'val-label' })
  }
  const cross = el('line', { y1: top, y2: h - bottom, stroke: css('--axis'), 'stroke-width': 1, visibility: 'hidden' }, svg)
  const hit = el('rect', { x: left, y: top, width: w - left - right, height: h - top - bottom, class: 'hit' }, svg)
  const onMove = (e) => {
    const b = svg.getBoundingClientRect()
    const px = ((e.clientX - b.left) / b.width) * w
    const ts = x.inv(px)
    let i = 0
    while (i < E.t.length - 1 && E.t[i + 1] <= ts) i++
    cross.setAttribute('x1', x(E.t[i])); cross.setAttribute('x2', x(E.t[i])); cross.setAttribute('visibility', 'visible')
    showTip(e, [...S].reverse().map((s) => ({ value: signedPct((E[s.k][i] - 1) * 100), label: s.label, color: s.color })), date(E.t[i]))
  }
  hit.addEventListener('pointermove', onMove)
  hit.addEventListener('pointerenter', onMove)
  hit.addEventListener('pointerleave', () => { hideTip(); cross.setAttribute('visibility', 'hidden') })
  hit.setAttribute('aria-label', document.getElementById('e-cap').textContent)
  legend(host, [...S].reverse().map((s) => ({ label: s.label, color: s.color, line: true })))
}

function flipChart() {
  const host = document.getElementById('x-chart')
  const rows = D.flip
  const rowH = 50, top = 22, bottom = 40
  const { svg, w } = makeSvg(host, top + rows.length * rowH + bottom)
  const left = 70, right = 14
  const x = scale(0.49, 0.56, left, w - right)
  const g = el('g', { class: 'grid' }, svg)
  for (const v of ticks(0.49, 0.56, 0.01)) {
    el('line', { x1: x(v), x2: x(v), y1: top, y2: top + rows.length * rowH }, g)
    if (Math.round(v * 100) % 2 === 0) txt(svg, x(v), top + rows.length * rowH + 18, num(v, 2), { 'text-anchor': 'middle', class: 'tick' })
  }
  txt(svg, (left + w - right) / 2, top + rows.length * rowH + 36, t('axis.auc'), { 'text-anchor': 'middle', class: 'coin-label' })
  el('line', { x1: x(0.5), x2: x(0.5), y1: top - 6, y2: top + rows.length * rowH, class: 'coin-line' }, svg)
  txt(svg, x(0.5), top - 10, t('axis.coin'), { 'text-anchor': 'middle', class: 'coin-label' })
  const C = { flipped: css('--jev'), logistic: css('--lin'), meanrev: css('--mr') }, surface = css('--surface')
  const lab = { flipped: t('series.flip'), logistic: t('series.lin'), meanrev: t('series.mr') }
  rows.forEach((r, i) => {
    const cy = top + i * rowH + rowH / 2
    txt(svg, left - 12, cy + 4, r.m, { 'text-anchor': 'end', class: 'row-label' })
    ;[['logistic', -11], ['flipped', 0], ['meanrev', 11]].forEach(([k, dy]) => el('circle', { cx: x(Math.max(0.49, r[k])), cy: cy + dy, r: 5, fill: C[k], stroke: surface, 'stroke-width': 2 }, svg))
    const hit = el('rect', { x: left, y: cy - rowH / 2, width: w - left - right, height: rowH, class: 'hit' }, svg)
    hover(hit, ['flipped', 'logistic', 'meanrev'].map((k) => ({ value: num(r[k]), label: lab[k], color: C[k] })), r.m)
  })
  legend(host, [{ label: lab.flipped, color: C.flipped }, { label: lab.logistic, color: C.logistic }, { label: lab.meanrev, color: C.meanrev }])
  table(document.getElementById('x-table'), [t('t.market'), lab.flipped, lab.logistic, lab.meanrev, 'n'], rows.map((r) => [r.m, num(r.flipped), num(r.logistic), num(r.meanrev), r.n.toLocaleString(loc())]))
}

function breakEvenChart() {
  const host = document.getElementById('b-chart')
  const rows = D.markets.map((m) => { const h = m.horizons.find((x) => x.h === 15); return { m: m.symbol, have: 1 - h.hit, need: h.breakEven } })
  const narrow = host.clientWidth < 560
  const rowH = narrow ? 50 : 38, top = 8, bottom = 30
  const { svg, w } = makeSvg(host, top + rows.length * rowH + bottom)
  const left = narrow ? 64 : 70, right = narrow ? 14 : 170
  const x = scale(0.5, 1, left, w - right)
  const g = el('g', { class: 'grid' }, svg)
  for (const v of ticks(0.5, 1, narrow ? 0.25 : 0.1)) {
    el('line', { x1: x(v), x2: x(v), y1: top, y2: top + rows.length * rowH }, g)
    txt(svg, x(v), top + rows.length * rowH + 18, pct(v), { 'text-anchor': 'middle', class: 'tick' })
  }
  const jev = css('--jev'), ink = css('--ink')
  rows.forEach((r, i) => {
    const cy = top + i * rowH + (narrow ? 16 : rowH / 2), bh = 12
    txt(svg, left - 12, cy + 4, r.m, { 'text-anchor': 'end', class: 'row-label' })
    const x0 = x(0.5), x1 = x(r.have), rr = Math.min(4, (x1 - x0) / 2)
    el('path', { d: `M${x0},${cy - bh / 2} H${x1 - rr} Q${x1},${cy - bh / 2} ${x1},${cy - bh / 2 + rr} V${cy + bh / 2 - rr} Q${x1},${cy + bh / 2} ${x1 - rr},${cy + bh / 2} H${x0} Z`, fill: jev }, svg)
    const xn = x(Math.min(1, r.need))
    const needLabel = r.need >= 1 ? t('q4.impossible') : `${t('q4.need')} ${pct(r.need)}`
    el('line', { x1: xn, x2: xn, y1: cy - 11, y2: cy + 11, stroke: ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, svg)
    if (narrow) txt(svg, xn, cy + 26, needLabel, { class: 'val-label', 'text-anchor': 'end' })
    else txt(svg, xn + 8, cy + 4, needLabel, { class: 'val-label' })
    const hit = el('rect', { x: left, y: top + i * rowH, width: w - left, height: rowH, class: 'hit' }, svg)
    hover(hit, [{ value: pct(r.have, 1), label: t('q4.have'), color: jev }, { value: r.need >= 1 ? t('q4.impossible') : pct(r.need, 1), label: t('q4.need') }], r.m)
  })
  legend(host, [{ label: t('q4.have'), color: jev }, { label: t('q4.need'), color: ink, line: true }])
}

function followups() {
  const host = document.getElementById('followups')
  host.textContent = ''
  const F = t('fu'), lp = D.followups.lp, cx = D.followups.cexdex
  F.forEach((f, i) => {
    const box = document.createElement('div'); box.className = 'fu'
    const h = document.createElement('h3'); h.textContent = f.h; box.appendChild(h)
    const big = document.createElement('div'); big.className = 'big'; big.textContent = f.big; box.appendChild(big)
    const p = document.createElement('p'); p.textContent = f.p; box.appendChild(p)
    if (i === 1 || i === 2) {
      const mb = document.createElement('div'); mb.className = 'minibars'
      const items = i === 1 ? lp.map((r) => ({ m: r.m, v: r.netLp, lab: `${r.netLp >= 0 ? '+' : '−'}${num(Math.abs(r.netLp), 2)}`, lo: -2, hi: 2 })) : cx.map((r) => ({ m: r.m, v: r.top3, lab: pct(r.top3), lo: 0, hi: 1 }))
      for (const it of items) {
        const row = document.createElement('div'); row.className = 'mb'
        const a = document.createElement('span'); a.textContent = it.m; row.appendChild(a)
        const tr = document.createElement('span'); tr.className = 'track'
        const xs = (v) => ((v - it.lo) / (it.hi - it.lo)) * 100
        if (it.lo < 0) { const z = document.createElement('span'); z.className = 'zero'; tr.appendChild(z) }
        const fl = document.createElement('span'); fl.className = 'fill'
        const from = it.lo < 0 ? Math.min(xs(0), xs(it.v)) : 0, to = it.lo < 0 ? Math.max(xs(0), xs(it.v)) : xs(it.v)
        fl.style.left = `${from}%`; fl.style.width = `${Math.max(1, to - from)}%`; fl.style.background = css('--jev')
        tr.appendChild(fl); row.appendChild(tr)
        const b = document.createElement('span'); b.textContent = i === 1 ? `${it.lab} bps` : it.lab; b.style.textAlign = 'right'; row.appendChild(b)
        mb.appendChild(row)
      }
      if (i === 2) { const c = document.createElement('p'); c.className = 'src'; c.textContent = t('fu.top3'); box.appendChild(c) }
      box.appendChild(mb)
    }
    const src = document.createElement('a'); src.className = 'src'; src.href = `${REPO}/blob/main/${f.src}`; src.textContent = f.src; box.appendChild(src)
    host.appendChild(box)
  })
}

// ---------- static sections ----------
function claims() {
  const tb = document.querySelector('#claims-table tbody')
  tb.textContent = ''
  for (const [a, b, c, cls] of t('claims.rows')) {
    const tr = document.createElement('tr')
    for (const [v, k] of [[a], [b], [c, cls]]) { const td = document.createElement('td'); td.textContent = v; if (k) td.className = k; tr.appendChild(td) }
    tb.appendChild(tr)
  }
}
function checks() {
  const ul = document.getElementById('checks')
  ul.textContent = ''
  for (const [kind, title, body, n, href] of t('checks')) {
    const li = document.createElement('li')
    const ic = document.createElement('span'); ic.className = kind === 'ok' ? 'ok' : 'ref'; if (kind === 'ok') ic.textContent = '✓'; ic.setAttribute('aria-hidden', 'true'); li.appendChild(ic)
    const mid = document.createElement('div')
    const b = document.createElement(href ? 'a' : 'b'); b.textContent = title; if (href) { b.href = href; b.style.fontWeight = '700' } mid.appendChild(b)
    const p = document.createElement('p'); p.textContent = body; mid.appendChild(p)
    li.appendChild(mid)
    const v = document.createElement('span'); v.className = 'num'; v.textContent = n; li.appendChild(v)
    ul.appendChild(li)
  }
}
function how() {
  const ul = document.getElementById('how-list'); ul.textContent = ''
  for (const s of t('how')) { const li = document.createElement('li'); li.textContent = s; ul.appendChild(li) }
}
function links() {
  const ul = document.getElementById('links'); ul.textContent = ''
  for (const [label, path] of t('links')) { const li = document.createElement('li'); const a = document.createElement('a'); a.href = `${REPO}/blob/main/${path}`; a.textContent = label; li.appendChild(a); ul.appendChild(li) }
}
function heroFacts() {
  const f = D.markets.reduce((a, m) => Math.min(a, m.from), Infinity), to = D.markets.reduce((a, m) => Math.max(a, m.to), 0)
  // Only our own constant strings go through innerHTML; the values are formatted numbers and dates.
  document.getElementById('hero-facts').innerHTML = fill(t('hero.facts'), { n: D.totals.decisions.toLocaleString(loc()), from: date(f), to: date(to), auc: num(D.pooled.auc), lo: num(D.pooled.lo), hi: num(D.pooled.hi) })
  const rows = [...D.markets.map((m) => ({ name: m.symbol, ...m.horizons.find((h) => h.h === 15) })), { name: t('hero.all'), ...D.pooled }]
  table(document.getElementById('hero-table'), [t('t.market'), 'AUC', '95%', 'n'], rows.map((r) => [r.name, num(r.auc), `${num(r.lo)} – ${num(r.hi)}`, r.n.toLocaleString(loc())]))
}
function sample() {
  const s = D.samples[sampleIdx % D.samples.length]
  document.getElementById('sample-state').textContent = JSON.stringify(s.state, null, 2)
  document.getElementById('sample-q').textContent = JSON.stringify(D.question15, null, 2)
  const host = document.getElementById('sample-p'); host.textContent = ''
  for (const h of ['1', '5', '15', '60']) {
    const row = document.createElement('div'); row.className = 'prow'
    const a = document.createElement('span'); a.textContent = fill(t('h.label'), { h }); row.appendChild(a)
    const tr = document.createElement('span'); tr.className = 'ptrack'
    const fl = document.createElement('span'); fl.className = 'pfill'; fl.style.width = `${s.p[h] * 100}%`; tr.appendChild(fl)
    const mid = document.createElement('span'); mid.className = 'pmid'; tr.appendChild(mid)
    row.appendChild(tr)
    const v = document.createElement('span'); v.textContent = pct(s.p[h]); v.style.textAlign = 'right'; row.appendChild(v)
    host.appendChild(row)
  }
  document.getElementById('sample-out').textContent = fill(t('sample.out'), {
    m: s.m, when: date(s.t, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    dir: s.ret15Bps > 0 ? t('sample.rose') : t('sample.fell'), bps: num(Math.abs(s.ret15Bps), 1), p: pct(s.p['15']),
  })
}

function marketSeg() {
  const seg = document.getElementById('market-seg')
  seg.textContent = ''
  for (const m of D.markets) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = m.symbol
    b.setAttribute('aria-pressed', String(m.id === market))
    b.addEventListener('click', () => { market = m.id; marketSeg(); scoped() })
    seg.appendChild(b)
  }
}
function scoped() { horizonChart(); calibChart(); featureChart(); equityChart() }

function applyLang() {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'
  for (const n of document.querySelectorAll('[data-i18n]')) { const v = t(n.dataset.i18n); if (typeof v === 'string') n.textContent = v }
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang))
  document.title = lang === 'pt' ? 'Jev na Base: um estudo de trading' : 'Jev on Base: a trading study'
}

function renderAll() {
  applyLang()
  heroChart(); heroFacts(); claims(); marketSeg(); scoped(); regimeChart(); flipChart(); breakEvenChart(); checks(); how(); followups(); links(); sample()
}

document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang
  try { localStorage.setItem('lang', lang) } catch {}
  renderAll()
}))
document.getElementById('sample-next').addEventListener('click', () => { sampleIdx++; sample() })
let rt
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (D) renderAll() }, 150) })
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => D && renderAll())

D = await (await fetch('data/study.json')).json()
renderAll()
