---
title: "Ancinhos de mercado"
description: "Taxas de tomada de benchmarking para vários mercados"
pubDate: 2019-04-27
category: Technology
tags: ['marketplace']
heroImage: '../../../blog/2019_04_27_rake/t_1.webp'
locale: 'pt-BR'
sourceSlug: 'rake'
sourceHash: 'd41c4ceb6c388ccc2108108bee3cc93c0fe9a951ea418a505e2e79c4508dcce7'
---

Sou fascinado por marketplaces e efeitos de rede\, já que grande parte da internet é construída sobre empresas que têm sucesso neles\, por exemplo\, os efeitos de rede do Facebook\, o marketplace de terceiros da Amazon\, o marketplace de anúncios do Google\.

Este post detalha minhas impressões sobre uma análise fundamental do fator de rake do mercado que vi Josh Breinlinger escrever [here.](http://acrowdedspace.com/post/172383900012/marketplace-rake-factors 'rake factors')

Gostei do artigo do Josh sobre fatores de rake porque foi o primeiro que vi tentando construir razões fundamentais para o motivo de um rake ser definido em uma certa porcentagem\, em vez de apenas \'porque os comparáveis estão nesse rake\'\. Alguns \(muitos\?\) mercados realmente são precificados apenas com base em comparáveis\, mas ainda gosto de ter uma estrutura\.

Tive pensamentos adicionais\:

- Existem alguns marketplaces que parecem ser exceções a esse arcabouço \(o que Josh admite não ser definitivo\)
  - Por exemplo\, o mercado de fotografia de banco sempre me intrigou desde que alguém mencionou\. \[O ancinho lá pode ser \>50\%\,\] \(\(https://microstockinsider.com/microstock_commission_rates \'comissões de fotografia\'\) um valor incrível para um serviço que tem tantos concorrentes\, taxas transparentes e custos marginais mínimos no lado da plataforma\.
  - Por exemplo\, os rakes dos marketplaces de comércio eletrônico chineses são muito baixos quando comparados aos marketplaces dos EUA\, por exemplo\, taobao \~4\% vs ebay \~9\%
- Acho que adicionar outro fator de \+3\% para \'atividade promocional\' na plataforma pode ser útil
  \_ Por exemplo\, a rev do marketplace de comércio eletrônico da China mencionada acima vem principalmente de atividades de marketing\, e o custo médio é de \~4\% 
  \_ Por exemplo\, como booking\.com permite que anunciantes se tornem membros preferenciais com melhor posicionamento para 300bps
  \_ Por exemplo\, programa de fidelidade do hotel em média \~3\% do rev em custos aumentados para o hotel
  \_ Por exemplo\, o anclete de entrega de comida da Seamless costumava passar de 12\,5\% para 20\%\, uma diferença de 7\,5\% \(que é
  acima de 3\%\, mas o restaurante médio pagaria 15\% e não o rake de 12\,5\%\, o que implica uma diferença menor\) \\\* Eu chutaria que o Ubereats cobraria alguns pontos percentuais por [promotional placement of restaurants](https://techcrunch.com/2018/12/10/uber-ads/ 'uber ads') também
- Acho que empresas que entram no mercado com a intenção de baixar o preço dos concorrentes também fixam sua taxa de aquisição 5\%\-10\% menor que a do incumbente vigente
  - Por exemplo\, como booking\.com conseguiu taxas 10\% ou mais menores para superar seu concorrente e [won the market that way](https://skift.com/2012/06/25/how-booking-com-conquered-world/ 'OTA history')
  - Por exemplo\, as taxas da Seatgeek parecem ser 5\%\+ menores que as da incumbente\, com base no meu próprio benchmarking
  - Por exemplo\, as agências chinesas menores de transporte online \(OTAs\) supostamente têm \~10\% de rake contra \~15\% de rake das OTAs principais
- Não vi muitos ancinhos \>20\% que se sustentem ao longo do tempo\. De forma semelhante ao que Bill Gurley fala sobre [a rake too far](http://abovethecrowd.com/2013/04/18/a-rake-too-far-optimal-platformpricing-strategy/ 'optimal pricing strategy')\, há algo nesse limiar que faz as taxas de aceitação diminuírem com o tempo\. Minha hipótese é que isso começa a consumir demais o COGS do cliente para que a situação permaneça inalterada por \>5 anos
  - Por exemplo\, por muito tempo\, os rakes no iOS e na Google Play Store eram de 30\%\. Depois começaram a introduzir rakes mais baixos para assinaturas
  - Por exemplo\, a Steam costumava ter um rake de 30\%\, e recentemente mudou para ser menor para publishers maiores\. Isso não é coincidência\, já que a Epic Games e o Discord estão lançando suas próprias lojas de rake de 10\%\+
- As taxas de aceitação devem ser influenciadas pelas margens operacionais dos vendedores na plataforma\, embora eu ainda esteja trabalhando em como enquadrar isso\.
  - Por exemplo\, plataformas de entrega de comida não podem cobrar muito mais que 30\% sem que os restaurantes percam dinheiro\, dado a baixa margem dos restaurantes
  - Por exemplo\, as taxas de aceitação de passagens aéreas nos EUA são basicamente 0\% desde que as companhias aéreas se consolidaram e têm margens pequenas\.
- Onde no framework colocamos plataformas que cobram tanto do vendedor quanto do comprador\? Pessoalmente\, não gosto delas como consumidor\, mas parece que ainda não há pressão para mudar esse modelo de negócio
  - Ruzwana no Twitter mencionou que talvez [more infrequent, episodic transactions can support buyer fees, but not frequent, regular transaction cases](https://twitter.com/daveambrose/status/694921246799073280)
  - Airbnb\, mercado de bilhetes e mercados de férias para cães são mais episódicos e podem cobrar taxas de compra
  - As plataformas de entrega de comida\, porém\, não parecem se encaixar exatamente nesse contexto\. Geralmente são transações regulares que cobram taxas adicionais de compra pelo pedido\, o que parece ser um obstáculo para o crescimento\.

Também fiz uma comparação entre taxas de rake previstas e reais de acordo com o framework dele\, e parecem estar alinhadas com a teoria\. Ressalva é que usei algum julgamento ao aplicar os critérios\, e as taxas reais de aceitação são aproximadas com base em benchmarking que eu mesmo fiz\.

- Booking\.com taxa de aceitação de acordo com seu framework deve ser 20\% \+ 10\% taxas opacas \+ 5\% controle de qualidade \+ 5\% prevenção de fraudes – 10\% itens de alto preço – 10\% usuários se encontram pessoalmente \(isso se qualifica\?\) \= 20\% vs 14\% de rake real
  - Outros principais OTAs\: a Expedia tem cerca de 13\-18\% de rake real\, o Ctrip tem cerca de 10\-15\% de rake real no estoque do hotel
  - **Concorrentes chineses menores\, como Meituan\, estão entre 8\-10\%\, e Tongcheng entre 6\-9\%**
- A taxa de aceitação prevista no Etsy é de 20\% \- 5\% taxas transparentes \- 5\% de cuidado com o comprador \= 10\% vs 5\% real
- A taxa de aceitação prevista pelo Farfetch é 20\% \+ 10\% trabalho na plataforma \+ 5\% controle de qualidade \+ 5\% prevenção de fraudes – 5\% taxas transparentes – 5\% itens de alto preço \= 30\% vs 33\% reais
- Taxa de cobrança em Taobao 20\% – 5\% taxas transparentes – 5\% comprador cuidado \= **10\% vs 4\% reais**
- Taxa de captação de Tmall\: 20\% \+ 10\% trabalho na plataforma \+ 5\% controle de qualidade – 5\% taxas transparentes – 5\% comprador\, cuidado \= **25\% vs 3\% reais**
- JD\.com taxa de aceitação 20\% \+ 5\% controle de qualidade – 5\% taxas transparentes – 5\% comprador cuidado \= **15\% vs 2\-8\% reais**
- _Taobao\, Tmall\, JD parecem não se encaixar nesse quadro\. Meu palpite é que isso tem a ver com o mercado chinês e como o Taobao foi inicialmente criado como uma plataforma sem taxas para competir contra a EachNet\. Então o ponto de partida foi com uma captura de 0\% em vez de 20\%_
- Taxa de tomada do mercado livre 20\% \+ 5\% controle de qualidade – 5\% taxas transparentes – 5\% comprador atento \= 15\% vs 17\% real
- Taxa de cobrança Stubhub\/Seatgeek 20\% \+ 10\% taxas opacas \+ 5\% controle de qualidade \+ 5\% prevenção de fraude \- 5\% itens de alto preço \= 35\% vs 40\% \+ reais

Se eu estiver errado em alguma das opções acima ou se você tiver respostas\, fique à vontade para me avisar e eu corrigirei o post conforme necessário\.
