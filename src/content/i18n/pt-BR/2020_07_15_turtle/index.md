---
title: "São tartarugas até o fim do caminho"
description: "Por que a maioria das empresas, mesmo na área de tecnologia, é ruim em inovar"
pubDate: 2020-07-15
category: Technology
tags: ['business', 'startups']
heroImage: '../../../blog/2020_07_15_turtle/t_3.webp'
locale: 'pt-BR'
sourceSlug: 'turtle'
sourceHash: '350a3fc3117a588d40ffda1e362a4272b665ee57cf4be889be526c4129f66586'
---

## Mensagem

As empresas não são incentivadas a correr riscos\, prejudicando a inovação dentro da empresa e aumentando a probabilidade de uma startup vencer contra elas\.

## Tartaruga vs Lebre

Vou dar como certo que todos conhecem o [tortoise vs hare fable.](http://read.gov/aesop/025.html 'aesop') Lebre corre com tartaruga\, adormece\, perde e passa o resto da vida vivendo envergonhado antes de escrever uma revelação explosiva sobre como foi [all a shell game](https://en.wikipedia.org/wiki/Shell_game 'shell') [^1]\.

[Drawing on this post by Farnam Street](https://fs.blog/2016/07/james-march-the-trouble-with-genius/ 'FS')\, vamos estender a analogia ainda mais com um pouco de matemática\. Sei como isso assusta metade dos leitores imediatamente\, mas não vamos surtar ainda\. Vindo de alguém que recentemente perdeu 15 minutos em um problema de matemática porque adicionei 1 \+ 1 errado\, vou manter a matemática simples\, nem que seja só para mim [^2]\.

Vamos ter uma pista de corrida de 1 km\. Vamos supor que a tartaruga leva 100 minutos para correr 1 km\, e a lebre leva 20 minutos para correr 1 km\. No entanto\, o horário de sono da lebre foi bagunçado por causa da covid e há 95\% de chance de ela dormir em cada bloco separado de 20 minutos\. Em outras palavras\, há 5\% de chance de ela estar acordada nos minutos 0\-20\, e depois mais 5\% de chance de estar acordada nos minutos 20\-40\, e mais 5\% de chance de estar acordada nos minutos 40\-60\, etc\.

![post](../../../blog/2020_07_15_turtle/t_1.webp)

Qual a chance da lebre vencer a tartaruga\?

Para quem lembra da probabilidade do ensino médio\, podemos calcular isso com um [binomial distribution formula.](https://online.stat.psu.edu/stat414/lesson/10/10.3 'binom') A fórmula é a seguinte\:

![post](../../../blog/2020_07_15_turtle/t_2.webp)

Mas isso parece assustador com sinais de soma e pontos de exclamação\, e eu prometi manter a matemática simples\. Uma forma de apontar o cálculo é observar que há 5 \"blocos de 20 minutos\" para a lebre adormecer ou ficar acordada\, já que a lebre é 5 vezes mais rápida que a tartaruga\. Desde que a lebre esteja acordada uma vez\, ela vence\. Então\, a única vez que a lebre perde é quando dorme todas essas vezes\. Esse é um cálculo muito mais fácil\, já que isso é apenas 95\% vezes 5 vezes a si mesma\, ou 0\,95 vezes o poder de 5 [^3]\.

Isso nos dá 77\%\, o que implica que\, sob nossas suposições\, a lebre perde 77\% das vezes para a tartaruga e vence apenas 23\% das vezes\.

Agora\, vamos mudar um pouco nossa forma de enquadrar\. Se fizéssemos 100 corridas\, qual a chance de termos pelo menos uma corrida em que a lebre vença\?

Só existe um caso em que nenhuma lebre vence\, que é quando todas as corridas são vencidas por tartarugas\. Assumindo que a máfia das tartarugas não manipulou o jogo novamente\, a chance disso acontecer é que 77\% vezes ela mesma é 100 vezes\, o que arredondea para 0\%\.

Em outras palavras\, é quase garantido que pelo menos uma vez uma lebre vença\.

![post](../../../blog/2020_07_15_turtle/t_3.webp)

Coloquei a matemática em uma planilha do Google [here](https://docs.google.com/spreadsheets/d/1-_LV1ewb0D4DsERENaM_xp0oy8pHH7xWmAvNX8H9bdE/edit?usp=sharing 'sheet') que você pode brincar [^4]\. Você também pode ver no gráfico abaixo que nem são necessárias tantas corridas para que as chances de pelo menos uma lebre vencer se aproximem de 100\%\. Lembre\-se\, essa é uma lebre vencendo\, não a maioria das lebres vencendo\.

![post](../../../blog/2020_07_15_turtle/t_4.webp)

A matemática é menos importante do que a lição\, porém\. **O que inferimos é que\, mesmo quando as chances de algo acontecer sozinho são baixas\, um jogo repetido provavelmente garantirá que o evento aconteça uma vez\.** Assim como é improvável que você ganhe na loteria\, é provável que haja pelo menos um vencedor da loteria\.

## Tartaruga vs tecnologia

Vamos relacionar isso à tecnologia\. A indústria de tecnologia se orgulha da inovação\, mas precisamos notar que é a soma dos fracassos acumulados que impulsiona o progresso\. Se você pensar nas startups como as lebres nesse cenário\, e nos grandes incumbentes como a tartaruga\, há pouca chance de qualquer startup vencer contra um incumbente\, mas uma grande chance de que pelo menos uma vence\.

Há vários exemplos de grandes empresas simplesmente deixando cair em enormes oportunidades de receita\. Para algo recente\, pense em como tanto Microsoft quanto Google perderam US\$ 70 bilhões em valor [(mkt cap of Zoom)](https://finance.yahoo.com/quote/ZM/ 'ZM') Tendo um produto de videoconferência ok\, mas não excelente\. Para algo mais antigo\, pense em como [Xerox invented the mouse, graphical user interface, and the PC, but failed to follow up on them](https://www.forbes.com/sites/tendayiviki/2017/07/01/as-xerox-parc-turns-forty-seven-the-lesson-learned-is-that-business-models-matter/#eaf579075482 'xerox')\.

Existem alguns motivos pelos quais a maioria das empresas é ruim nisso\. Primeiramente\, **As pessoas são avessas ao risco\,** No sentido de que eles não estão dispostos a tolerar a enorme quantidade de fracassos necessários para que novas ideias funcionem\. O sucesso dos projetos é determinado individualmente\, não no nível da empresa\. \"Você pode apoiar este projeto onde o resultado mais provável é um completo desperdício de recursos\?\" não é o melhor slogan de vendas\.

O problema disso é que o gênio é volátil\. Se você quer resultados insanos\, às vezes vai precisar de pessoas malucas\. Seja por sorte\, habilidade ou uma combinação dos dois \(mais provável\)\, a gama de resultados de projetos mais malucos será distribuída por uma faixa maior de possibilidades\. Para cada iPhone\, há cem [cheetos lip balm](https://www.usatoday.com/story/money/2018/07/11/50-worst-product-flops-of-all-time/36734837/ 'cheetos') Tipo de projetos que nunca decolem\.

Já que a maioria das pessoas também pensa em termos de [outcomes rather than process,](https://www.schroders.com/id/uk/the-value-perspective/blog/all-blogs/outcomes-and-timeframes--with-annie-duke-part-3/?t=true 'annie') O julgamento dos projetos é binário\. Eles são ou um sucesso\, ou um fracasso\. E ninguém quer ser associado a fracassos\, mesmo quando a recompensa potencial é alta\, já que o valor esperado é baixo\. Queremos a gênia apenas depois que ela for identificada\, e não estamos dispostos a suportar as perdas antes\.

Em segundo lugar e relacionado a isso\, **Falta alinhamento de incentivos** Em empresas maiores\, para que pequenos projetos tenham sucesso\. Na maioria das vezes\, as pessoas em grandes empresas buscam não ser demitidas\, em vez de se destacar\. Por bons motivos\, já que o valor gerado em uma empresa grande vai principalmente para a empresa e não para você\. Em contraste\, as pessoas em empresas menores buscam não fazer a empresa falir [^5]\. Há um grau maior de alinhamento de incentivos para pessoas em startups do que em empresas maiores\, resultando em uma média maior de esforço por pessoa\.

As empresas poderiam resolver isso\? Possivelmente\, mas incentivar e gerenciar pessoas é uma área notoriamente complicada\. Você provavelmente poderia tentar pagar pessoas acima do mercado\, dar a elas [15 percent time for special projects](https://www.fastcompany.com/1663137/how-3m-gave-everyone-days-off-and-created-an-innovation-dynamo '15')\, ou oferecer algum programa de recompensas e reconhecimento para incentivar seus funcionários\. No entanto\, o funcionário médio provavelmente ainda estaria mais preocupado com seus planos pós\-trabalho na Netflix do que com seu projeto especial que provavelmente vai fracassar\. Provavelmente haveria algum valor que funcionaria\, mas esse custo adicional provavelmente seria demais para a maioria das empresas justificar [^6]

Por fim\, **As empresas gostam de \"focar\"\.** Normalmente\, essa é uma palavra da moda para cortes de custos e reorganizações\, como quando [Ruth Porat took over as Google CFO.](https://www.bizjournals.com/sanjose/news/2015/07/15/google-reins-in-hiring-and-spending.html 'Ruth') Você pode ver situações semelhantes acontecendo agora com as demissões da covid\, com a maioria das empresas dizendo que precisa \"priorizar implacavelmente\" por qualquer motivo favorável à relações públicas\. Quando as coisas estão ruins\, a gerência divide as coisas entre o que é bom e o essencial\, e a maioria dos projetos inovadores acaba no lixo\.

Mesmo em uma boa situação econômica\, projetos são frequentemente rejeitados porque são \"pequenos demais para fazer diferença\" ou \"não vão escalar\"\. Você consegue imaginar tentar apresentar o AirBNB à Marriott\? Você teria dificuldade não só em justificar como o tamanho do mercado poderia ser grande o suficiente para fazer sentido para gastar tempo\, mas também por que canibalizar sua própria receita é uma boa ideia\.

Inovação não é fácil\, e fica ainda mais difícil porque a maioria dos lugares avalia resultados e não processa\. Se você é uma startup que pretende revolucionar um setor\, descubra qual é o [base rate](https://en.wikipedia.org/wiki/Base_rate 'base') de sucesso é\, e esteja preparado para o fracasso\. Muito fracasso\. Se você é uma empresa que espera continuar relevante\, perceba que quase todas as suas estruturas de incentivos são feitas para a média\. E **No longo prazo\, média significa irrelevância\.**

[^1]: Também conhecido como o \#Me [Tu](https://www.echineselearning.com/blog/chinese-character-tu-rabbit-beginner 'tu') movimento\.

[^2]: Ok\, então foi 1 \- 1 e eu errei a placa na minha cabeça\, então não foi tão ruim assim\. Não\, não estou ficando na defensiva com isso\.

[^3]: Escolhi os números aqui especificamente para manter o exemplo simples\. Eu estava procurando algo onde a lebre perdesse a maior parte do tempo e tivesse apenas alguns intervalos\.

[^4]: Já fiz o cálculo de probabilidade de algumas formas\, com a fórmula fatorial mostrada e com a função binomdista do Google Sheet\, só para mostrar que são equivalentes

[^5]: Provavelmente não é tão ruim para os funcionários das startups hoje em dia quando a empresa falha\, já que há muitas vagas disponíveis\, especialmente para engenheiros de software\. Dito isso\, ainda é ruim ser demitido\, e há uma chance maior disso acontecer com uma startup\.

[^6]: Por exemplo\, vamos imaginar um cenário extremo em que os funcionários recebem 50\% da receita ou 50\% da economia de custos que obtêm para o negócio\. Vamos ignorar as dificuldades de medição por enquanto\, mas isso provavelmente já é motivador suficiente em grandes empresas onde pequenas mudanças podem economizar milhões de dólares\. O problema vem do fato de que o funcionário ganhou dinheiro\, mas a empresa não\.
