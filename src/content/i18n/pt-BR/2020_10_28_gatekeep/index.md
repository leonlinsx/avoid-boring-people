---
title: "Quem guarda os guardiões"
description: "O guardião dos porteiros se guarda o próprio portão?"
pubDate: 2020-10-28
category: Culture
tags: ['finance', 'behaviour']
heroImage: './g_5.webp'
locale: 'pt-BR'
sourceSlug: 'gatekeep'
sourceHash: 'a726c7c131fb27b670f7a03994bb2d6dc9f6d19bb210d87084183e4dabde1729'
---

## Concluições

1. O gatekeeping geralmente é feito para preservar o status individual em vez do status de grupo\, e deve ser evitado
2. As espirais de custo de capital e de iliquidez estão ligadas em um ciclo de retroalimentação

## 1\. Controle de acesso para status de grupo vs individual

Você já viu isso antes\.

Um iniciante\, com olhos brilhantes e entusiasmado\, virá procurando conselhos sobre como começar em uma disciplina\.

![post](./g_1.webp)

E uma série de especialistas vai [emerge from the depths](https://youtu.be/Y2fwe0rnHak?t=118 'balrog') dizer que não é possível\, que deveriam voltar e passar anos aprendendo os pré\-requisitos\, e que deveriam se envergonhar por fazer essa pergunta em primeiro lugar\. _\"Que cara de cara algumas pessoas acham que poderiam evitar pagar suas dívidas\.\"_

Alguns \"especialistas\" até encontram motivos para reclamar quando outros lançam cursos para ajudar iniciantes a fazer exatamente isso\.

![post](./g_2.webp)

Encontramos gatekeeping o tempo todo\, e isso é feito principalmente para preservar status\. Existem algumas formas válidas de gatekeeping\, e vou falar disso em breve\. Mas quase sempre é feito para excluir pessoas e ser maldoso\. Engraçado que os gatekeeping nunca parecem perceber que eles também poderiam ser excluídos\.

Por exemplo\, você pode dizer que não pode começar aprendizado de máquina a menos que aprenda cálculo\, estatística e álgebra linear\, assim como o comentário acima\.

![post](./g_3.webp)

E você também pode dizer que não pode começar álgebra linear a menos que aprenda teoria dos grupos\, como [matrices are a ring](https://www.youtube.com/watch?v=_RTHvweHlhE 'ring')\, e [when to work with linear groups or not](https://www.youtube.com/watch?v=AJTRwhSZJWw 'group') [^1]

![post](./g_4.webp)

E você poderia ainda mais fazer gatekeeping e dizer que o que foi dito acima depende de [set theory](https://plato.stanford.edu/entries/set-theory/ 'set')\, [Peano axioms](https://en.wikipedia.org/wiki/Peano_axioms 'Peano')\, e [philosophy](https://plato.stanford.edu/entries/philosophy-mathematics/ 'philo')\. Fico me perguntando quanto disso o comentarista passou a graduação estudando\.

Se quiséssemos\, poderíamos guardar qualquer lugar\.

**Também nunca chegaríamos a lugar nenhum\, já que nunca começaríamos\.**

Existem formas válidas de gatekeeping\. Se você exclui alguém porque seria prejudicial à comunidade\, isso é razoável\. Por exemplo\, se você está montando um grupo de videogames e recebe um pedido de associação de alguém que quer banir jogos\, provavelmente não faz sentido aceitá\-la\.

Mais frequentemente\, porém\, o gatekeeping é uma tentativa de indivíduos do \"grupo interno\" de manter seu status\, como se eles perdessem à medida que mais pessoas soubessem o que sabem\. Isso vem de um lugar de insegurança\; de pessoas com medo de deixar os outros perceberem que o que fazem pode ser feito por outros também\. Como escrevi no mês passado\, isso é como descontar a loteria\, e provavelmente uma má ideia\. Por exemplo\, os pintores impressionistas eram todos bloqueados quando começaram\, mas olhe para a influência deles na arte hoje [^2]\.

Agora\, note que os guardiões não estão totalmente errados\. **Na verdade\, suas sugestões muitas vezes fazem sentido\.** Por exemplo\, seria extremamente útil conhecer álgebra linear enquanto estuda aprendizado de máquina\. E se você quer se tornar um especialista\, precisa dominar toda a matemática necessária [^3]\. Mas impedir artificialmente as pessoas de começarem uma disciplina não ajuda ninguém\. Uma resposta melhor teria sido\: \"Sim\, aqui estão alguns cursos mais simples para começar\, volte e revisite os fundamentos depois\.\" Permita em vez de desativar\.

![post](./g_5.webp)

Se você tem tendência para o gatekeeping\, eu recomendaria pensar se está ajudando a comunidade ou se ajudando a si mesmo [^4]\. Se você se auto\-selecionou para ler este boletim\, pode fazer melhor\.

Os campos são grandes o suficiente para que quanto mais pessoas os persigam\, melhor\. Raramente\, se é que alguma vez\, é um jogo de soma zero\, e mais um [infinite game](https://fs.blog/2020/02/finite-and-infinite-games-two-ways-to-play-the-game-of-life/ 'infinite')\. Ao sermos mente aberta e aceitar iniciantes\, podemos crescer toda a torta e ter mais para nós mesmos\. É assim que podemos impulsionar o progresso individualmente\; assim temos o melhor dos dois mundos e comemos tudo\.

Abra mais portões\, e [be kind.](https://www.youtube.com/watch?v=xnouj9Yz-Gs&feature=youtu.be&t=23 'who')

## 2\. Espirais de liquidez

Você também já viu isso antes\.

Um mercado está funcionando\, fazendo o que faz\: balancear o mercado e combinar compradores e vendedores\. Quando de repente ocorre um choque\, o mercado congela e ele se torna \"ilíquido\"\.

Por exemplo\, [how flour was in short supply a while back](https://www.theatlantic.com/health/archive/2020/05/why-theres-no-flour-during-coronavirus/611527/ 'flour') [^5]\.

Ou como a crise de 2008 causou corridas às instituições bancárias\, levando algumas à falência\.

E lembre\-se do início deste ano\, quando discutimos que a liquidez era a causa das crises\, não o capital\.

Hoje vamos analisar os destaques do artigo ["Market Liquidity and Funding Liquidity"](https://www.nber.org/system/files/working_papers/w12939/w12939.pdf 'Markus') por Markus Brunnermeier e Lasse Pedersen\. O artigo é longo e majoritariamente matemático [^6]\, mas ainda podemos revisar as conclusões\.

Markus e Lasse analisam o que causa essas espirais de iliquidez\, descobrindo que o custo do capital [^7] Funciona em um ciclo de retroalimentação com liquidez\. Mais difícil conseguir fundos\, menor liquidez\, maior volatilidade\.

Eles primeiro analisam os requisitos de margem [^8]\, e observe como eles mudam em resposta a crises\. Como esperado\, as margens \(assumindo o papel dos custos aqui\) tornam\-se menos líquidas quando há mais incerteza\, e tornam\-se mais líquidas quando há menos incerteza\.

![post](./g_6.webp)

Outra forma de reduzir a liquidez é diminuir o capital dos participantes\:

> Importante\, qualquer seleção de equilíbrio tem a propriedade de que pequenas perdas dos especuladores podem levar a uma queda descontínua da liquidez do mercado\. Esse \"secamento repentino\" ou fragilidade da liquidez do mercado se deve ao fato de que\, com altos níveis de capital especulador\, os mercados devem estar em equilíbrio líquido e\, se o capital dos especuladores for suficientemente reduzido\, o mercado deve eventualmente mudar para um equilíbrio de baixa liquidez e alta margem

O que pode levar a espirais de iliquidez de duas formas\:

![post](./g_7.webp)

> Primeiro\, surge uma \"espiral de margem\" se as margens estiverem aumentando na iliquidez do mercado porque a redução da riqueza dos especuladores diminui a liquidez do mercado\, levando a margens mais altas\, apertando ainda mais a restrição de financiamento dos especuladores\, e assim por diante

> Segundo\, surge uma \"espiral de perdas\" se os especuladores mantêm uma grande posição inicial que está negativamente correlacionada com o choque de demanda dos clientes

A primeira parece autoexplicativa\; o que a segunda significa é que\, se você for um vendedor forçado\, o preço vai cair muito e você vai ter que vender mais\.

Isso os leva a conclusões tanto para investidores quanto para bancos centrais\:

Para os investidores\, eles levantam a importância de ter uma margem de segurança\, o que parece óbvio\:

> Por fim\, o risco isolado de que a restrição de financiamento se torne vinculativa limita a oferta de liquidez de mercado pelos especuladores\. Nossa análise mostra que a política ideal de gestão de risco \(de financiamento\) dos especuladores é manter uma \"proteção de segurança\"\.

Mais interessante é o que eles concluem sobre bancos centrais e política monetária\.

> Os bancos centrais podem ajudar a mitigar problemas de liquidez de mercado controlando a liquidez do financiamento\. Se um banco central é melhor do que os financiadores típicos dos especuladores em distinguir choques de liquidez de choques fundamentais\, então o banco central pode transmitir essa informação e incentivar os financiadores a flexibilizarem suas necessidades de financiamento

> Os bancos centrais também podem melhorar a liquidez do mercado ao fortalecer as condições de financiamento dos especuladores durante uma crise de liquidez\, ou simplesmente declarando a intenção de fornecer financiamento extra em tempos de crise

**Que é o que você está vendo nos mercados de hoje\.** Note que há três ações separadas que um banco central pode fazer aqui\: 1\) transmitir informações\, 2\) fornecer financiamento\, 3\) simplesmente _diga_ eles podem fornecer financiamento\; podem nem precisar disso no final\. Na crise atual\, [markets recovered after (3), even though the actual funding provided was small.](https://www.ft.com/content/a1fba7cd-5329-46e6-82a8-57149e409f6c 'fed')

Até o Fed percebeu que não deve ser o guardião de último recurso\.

## Outros

1. [A brief history of graphics (youtube video)](https://www.youtube.com/watch?v=QyjyWUrHsFc&list=WL&index=8 'gfx')
2. ["Colour blindness is an inaccurate term"](https://commandcenter.blogspot.com/2020/09/color-blindness-is-inaccurate-term.html 'colour')\. Como pessoa daltônica\, foi legal ler isso\, especialmente porque trazia informações novas
3. ["The long tail turns out toe be a major cause of the economic challenges of building AI businesses"](https://a16z.com/2020/08/12/taming-the-tail-adventures-in-improving-ai-economics/ 'a16z')
4. [Intro to abstract algebra and group theory by Socratica (youtube series)](https://www.youtube.com/watch?v=IP7nW_hKB7I 'aa')\. Recomendado\, adequado para iniciantes\.
5. ["Fusion reactor very likely to work"](https://futurism.com/mit-researchers-fusion-reactor-very-likely-work 'fusion')

[^1]: Como não conhecia teoria dos grupos até este ano\, diria que é a coisa mais fascinante que aprendi sobre o ano inteiro\. Isso realmente me ajudou a entender por que definimos \"coisas\" e \"operações\" de álgebra da forma como definimos\. Por que a multiplicação de matrizes não é comutativa\, por exemplo\?

[^2]: Impressionistas receberam seu nome primeiro [from critics ridiculing them for their "unfinished" artwork that were mere "impressions"](https://smarthistory.org/how-the-impressionists-got-their-name/ 'art')

[^3]: Para ser claro \- concordo que\, para se tornar bom em aprendizado de máquina\, você vai querer ser bom em cálculo\, estatística\, álgebra linear etc\. O comentarista está certo nesse aspecto\. Discordo que devamos limitar as pessoas por anos porque elas não aprenderam tudo o que é necessário

[^4]: Já pulei discussões sobre questões de segurança\, por exemplo\, você _Deveria_ Bloqueie alguém de fazer free solo se nunca escalou nada antes\. Confio que o leitor terá bom senso aqui\; espero que não seja pedir demais

[^5]: Você vai notar que eu não usei papel higiênico como exemplo\. Isso porque tenho uma opinião forte contra um artigo popular do meio TP que viralizou há um tempo\, e que acredito ser em sua maioria impreciso\. Estou planejando escrever sobre isso e sobre esse tipo de artigo do tipo \"aqui vai uma explicação contraintuitiva\" que não são contraintuitivos\, mas simplesmente errados\; ainda não tive tempo para isso\.

[^6]: Além disso\, para ser totalmente transparente\, não entendo totalmente a matemática do artigo\. Particularmente\, há uma conclusão de retorno distorcido por especuladores que eu não entendo muito bem\.

[^7]: Para leitores que não sabem o que significa custo de capital\, pensem nisso como o custo do financiamento\. Já escrevi sobre isso mais anteriormente [here](/writing/capital 'sub')

[^8]: \"Quando um trader — por exemplo\, um dealer\, hedge fund ou banco de investimento — compra um título\, ele pode usar o título como garantia e tomar empréstimos contra ele\, mas não pode pegar o preço inteiro emprestado\. A diferença entre o preço do título e o valor da garantia\, denotada como a margem\, deve ser financiada com o próprio capital do trader\"
