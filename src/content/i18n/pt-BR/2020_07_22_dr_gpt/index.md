---
title: "Doutor GPT-3"
description: "ou: Como Aprendi a Parar de Me Preocupar e Amar a Inteligência Artificial"
pubDate: 2020-07-22
category: Technology
tags: ['AI', 'computer science', 'math']
evergreen: false
heroImage: '../../../blog/2020_07_22_dr_gpt/gpt_28.webp'
featured: true
locale: 'pt-BR'
sourceSlug: 'dr_gpt'
sourceHash: '71b3312cf1cfb5110ced0c235342922bfdfe4e4d54e6798a85dde1d8941f3a6d'
---

## Mensagem

O GPT\-3 é um modelo impressionante de previsão de texto que se generaliza para muitos casos de uso\. Eu explico como ele funciona em um nível geral\, se o hype é merecido\, como detectar o GPT e se ele vai saquear nossos empregos\.

## Só humano\, afinal

Cerca de uma semana atrás\, Sharif Shameem compartilhou [this video on twitter
demonstrating the abilities of a new AI, GPT-3](https://twitter.com/sharifshameem/status/1282676454690451457)

E\. Twitter\. Assustada\. Fora de casa\.

Talvez percebendo que seus empregos confortáveis de [copying stack overflow answers](https://www.zdnet.com/article/the-most-copied-stackoverflow-java-code-snippet-contains-a-bug/ 'SO') ou [gossiping about startups](https://twitter.com/magdalenakala/status/1285597906892988417?s=20 'startup') estavam em risco [^1]\, programadores e VCs no Twitter começaram a inundar o feed com demonstrações do GPT\-3 e opiniões polémicas sobre essa mais nova inteligência artificial\. Elas ainda estão acontecendo\, se você quiser [take a look](https://twitter.com/hashtag/gpt3?lang=en 'gpt3')

Então\, aqui estou eu\, com minha própria opinião polêmica\, para lucrar com todo aquele público cativado pela IA\.

Ei\, cara\, eu sou só humano\.

O artigo está dividido em 5 seções\:

1. Explicação do que o GPT\-3 pode fazer\, por que é impressionante e por que as pessoas estão preocupadas
2. Visão um pouco técnica de como os modelos de linguagem funcionavam antes do GPT\-3
3. Visão um pouco técnica de como o GPT\-3 funciona
4. Como detectar texto escrito por GPT\-3
5. Implicações do GPT\-3

Vamos começar\.

## 1\. O GPT\-3 é impressionante porque pode criar saídas inteligíveis para uma grande variedade de casos de uso

[GPT-3](https://arxiv.org/pdf/2005.14165.pdf 'GPT') foi criado por [OpenAI](https://openai.com/about/ 'Open')\, uma empresa tentando \"garantir que a inteligência artificial geral beneficie toda a humanidade\"\, ou seja\, que os robôs não nos matem a todos\.

GPT\-3 é um modelo de linguagem geral\, ou seja\, recebe algumas palavras como entrada e produz mais palavras como saída\. **Pense nisso como um filme incrível [autocomplete function](https://en.wikipedia.org/wiki/Autocomplete#:~:text=Autocomplete%2C%20or%20word%20completion%2C%20is,to%20accept%20one%20of%20several. 'auto')\.** Por ser um modelo geral\, ele pode resolver muitos tipos diferentes de tarefas\. Você pode pedir para escrever um parágrafo sobre unicórnios\, traduzir uma frase\, gerar código de programação ou mais\.

Isso é interessante\, já que normalmente você esperaria que um algoritmo fizesse apenas o que foi treinado para fazer\. Você não digita no Excel e procura que ele te diga um poema\. Há muito tempo\, esperamos que os programas fizessem o que lhes foi pedido\, com pouca capacidade de realizar tarefas para as quais não foram projetados\.

Como é um modelo geral\, você também pensaria que o GPT\-3 seria pior em uma tarefa do que modelos especializados nessa tarefa\, por exemplo\, ao comparar os resultados de tradução do GPT com um algoritmo focado apenas em tradução\, o GPT não será tão bom\.

Surpreendentemente e de forma impressionante\, nem sempre é assim\. Abaixo está a tabela do [GPT paper](https://arxiv.org/pdf/2005.14165.pdf 'GPT') com os resultados de um teste de translação\. Para simplificar\, podemos simplesmente comparar a primeira linha representando um modelo \"Estado da Arte\" com a última linha que representa o modelo GPT com melhor desempenho [^2]\. Um número maior é melhor aqui\. Podemos ver isso para algumas tarefas de tradução \(especialmente para tradução\) _para_ Inglês\)\, **O GPT é tão bom\, se não melhor\, que os modelos de Estado da Arte\.**

![post](../../../blog/2020_07_22_dr_gpt/gpt_1.webp)

A OpenAI testou o GPT em uma grande variedade de outras tarefas\, como previsão de texto\, perguntas de curiosidades sem permitir que ele pesquisasse em um conjunto de dados separado\, ou determinar a qual palavra um pronome se refere [^3]\. Embora o GPT não ganhe em todos os casos\, ele obtém ótimos resultados na maioria deles\. **Se você pudesse escolher apenas um modelo\, provavelmente iria querer usar o GPT\.** É o [Simone Biles](https://www.nytimes.com/2019/10/13/sports/simone-biles-worlds.html 'Simone') da comunidade de IA\, sendo o melhor em muitos eventos e ótimo nos demais\.

Vamos dar uma olhada em alguns exemplos\.

Nesta primeira imagem abaixo\, o modelo recebe um prompt no topo e depois aparece com o restante do texto abaixo\. O texto continua por mais tempo\; Eu só cortei para exibição\. É incrível o que ele criou\, né\?

![post](../../../blog/2020_07_22_dr_gpt/gpt_2.webp)

Nesta segunda imagem\, vemos outro texto de exemplo gerado a partir do modelo\, desta vez mostrando que ele também pode produzir poesia\. Provavelmente é melhor do que o que eu escreveria sozinho\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_3.webp)

Incrível\, então todo o hype é justificado\? Foi algum momento decisivo\, quando a capacidade da IA ultrapassou algum limite artificial\? Twitter e Google Trends certamente parecem pensar assim\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_4.webp)

Bem\.\.\. sim e não\.

Aquelas duas imagens que acabei de mostrar\? Eu menti\, não são do GPT\-3\.

Na verdade\, eles são do GPT\-2\, o modelo mais antigo lançado em fevereiro de 2019\. Na verdade\, leitores antigos deste boletim podem se lembrar [this article](/writing/moloch 'Moloch') Escrevi na época\, destacando os resultados já admiráveis do modelo [^4]\. O texto gerado pelo modelo antigo já era incrível\.

Então\, o que mudou desta vez\? Será que os robôs acabaram de ganhar um departamento de marketing melhor\?

Parcialmente\, sim\. O GPT\-3 foi lançado em [the end of May](https://minimaxir.com/2020/07/gpt3-expectations/ 'GPT')\. Se você rolar para essa tendência de busca no Google e apertar bem os olhos\, vai notar aquele pequeno aumento no gráfico\, duas semanas antes de começar a disparar de verdade\. Esse era o interesse público no GPT\-3 antes do tweet viral\. Isso mostra que formatos de apresentação podem realmente fazer diferença e eu deveria parar de escrever para fazer vídeos no TikTok\.

Dito isso\, há melhorias impressionantes desta vez também\. O GPT\-3 oferece resultados melhores que o GPT\-2 e pode se generalizar para mais cenários\. Isso se deve em grande parte ao aumento de dados usados no treinamento e ao aumento dos parâmetros do modelo\.

Vou detalhar mais abaixo\, e a forma como esses modelos funcionam é que eles recebem dados\, treinam sobre eles e mudam os pesos dos modelos de acordo com o conjunto de treinamento\.

Já se sabe há um tempo que mais dados de treinamento geralmente ajudam [^5]\, e os resultados do GPT\-3 continuam mostrando que isso é verdadeiro\. GPT\-3 ingerido [~50x the amount of data](https://lambdalabs.com/blog/demystifying-gpt-3 'lambda') que a versão antiga tinha\, dando uma intuição sobre como ela consegue criar tantas referências relevantes para seus resultados [^6]\.

O GPT\-3 também tem [~100x the amount of parameters](https://minimaxir.com/2020/07/gpt3-expectations/ 'params') em seu modelo comparado à versão antiga\. Com parâmetros de 175 bilhões [isn't unheard of](https://twitter.com/iamtrask/status/1285301017878441988?s=20 'params')\, mas isso ajuda o GPT\-3 a obter ainda mais diferenciação em suas respostas [^7]\.

Max Woolf aponta outras duas coisas que foram melhoradas no GPT\-3\: [1) It allows for text generation twice as long, and 2) prompts to the model are even more helpful in steering the direction of text generated](https://minimaxir.com/2020/07/gpt3-expectations/ 'Max')\. O GPT\-3 pode aceitar zero\, um ou alguns \"prompts\" de respostas de exemplo quando você está dando a entrada\. Os prompts ajudam a orientar a compreensão de quais respostas dar\, e quanto mais prompts\, melhor\.

No geral\, Max estima que o GPT\-3 lhe deu resultados utilizáveis cerca de 5 vezes mais frequentemente do que o GPT\-2 mais antigo\. Em termos de hype\, o público em geral passou de 0 a 100\, enquanto as pessoas que assistem ao espaço passaram de 50 para 70\.

Isso permite resultados como [this, a plugin to pull GPT results to autofill google sheets](https://twitter.com/pavtalk/status/1285410751092416513?s=20 'twitter') \(demonstração de verdade desta vez\, eu prometo\)\:

Como o GPT generaliza bem\, há muita empolgação em torno do uso dele em qualquer área de \"trabalho do conhecimento\"\. De programação a bancos e medicina\, há pensamentos de que o GPT pode eventualmente dar respostas com a mesma qualidade que um profissional daria\. Na próxima vez que você for ao médico\, talvez seu diagnóstico venha do Dr\. GPT\.

Tudo isso parece ótimo\, quais são as preocupações\?

Max entra em mais detalhes [here](https://minimaxir.com/2020/07/gpt3-expectations/ 'expectations')\, apontando que\:

- O modelo demora a produzir resultados
- Houve muita seleção nos exemplos mostrados publicamente
- Todos estão trabalhando com o mesmo modelo treinado e não conseguimos ajustar
- Há um problema contínuo com viés sistemático no treinamento\, por exemplo\, recall [how Microsoft had to pull its chatbot after it turned racist](https://www.theverge.com/2016/3/24/11297050/tay-microsoft-chatbot-racist 'Tay')

Outra preocupação é o custo de treinar esse modelo\. Curiosamente\, [Yannic on youtube](https://www.youtube.com/watch?v=SY5PvZrJhLE&feature=youtu.be 'Yannic') Apontou que os pesquisadores cometeram um erro em parte da coleta de dados e só perceberam isso quando já haviam treinado o modelo\. Em vez de recomeçar\, eles tiveram que ajustar esse problema de outras formas\, já que **Era caro demais reeducar o modelo\.**

![post](../../../blog/2020_07_22_dr_gpt/gpt_5.webp)

Isso é loucura\. As pessoas esperam que os custos de treinamento de modelos diminuam\, à medida que o hardware acompanha os requisitos do algoritmo\. Se não isso acontecer\, só grandes empresas poderão personalizar modelos para seus próprios propósitos\.

Por fim\, há também a inquietação constante sobre como isso vai acabar com todos os nossos empregos e trazer o fim da humanidade\. Vou abordar esse assunto leve em minhas observações finais\.

Agora\, vamos analisar mais de perto como os modelos funcionam\.

## 2\. Visão geral do modelo seq2seq usado antes do GPT\-3

_Aviso\: As próximas duas seções ficam um pouco técnicas enquanto explico os modelos usados\. Fique à vontade para pular para a seção \"Como podemos detectar o GPT\-3\?\" se não estiver disposto a encarar o desafio\._

_Outro aviso\: não sou especialista em ML\, e os modelos envolvidos são complicados\. Vou me apoiar em [this talk](https://www.youtube.com/watch?v=S0KakHcj_rs 'talk') Além das outras explicações linkadas no final deste artigo\. Sinta\-se à vontade para responder com qualquer correção\._

**O GPT\-3 utiliza um modelo diferente** Comparado aos modelos tradicionais de previsão\. No entanto\, ainda é útil entender a intuição por trás dos modelos antigos antes de olhar para o GPT\-3\. Primeiro vou passar por um modelo antigo e depois pelo GPT\-3\.

Vamos começar pelo popular\, mais antigo [sequence to sequence model.](https://google.github.io/seq2seq/ 'seq') Isso é comumente abreviado como \"seq2seq\"\, mas para facilitar ainda mais a compreensão\, vou me referir a ele como \"modelo antigo\" e ao GPT\-3 como \"modelo novo\"\.

Suponha que tivéssemos uma frase e quiséssemos prever a próxima frase\. Passaríamos nossa frase pelo nosso algoritmo\, que é uma série de funções\, e então obteríamos a saída prevista\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_6.webp)

Cada palavra importa\, então precisamos dividir a frase de entrada e olhar para ela uma palavra de cada vez\. Por exemplo\, \"Had we but world enough and time\" tem conotações diferentes de \"Had we but world enough and limes\"

![post](../../../blog/2020_07_22_dr_gpt/gpt_7.webp)

Vamos desorganizar o diagrama e olhar apenas para a primeira palavra\. Passamos essa palavra por uma função e então obtemos uma saída temporária\. Sabemos que podemos representar palavras como números\, já que é assim que os computadores processam palavras [^8]\. Então pense nisso como a palavra sendo transformada em algum número\, fazendo cálculos nela\, e depois obtendo outro conjunto de números em seguida\. Por exemplo\, \(1\, 2\, 3\) vezes 2 é igual a \(2\, 4\, 6\)\.

Se você lembra da matemática do ensino médio\, isso é multiplicação matricial ou álgebra linear\. **Quase toda a matemática abaixo pode ser representada em alguma forma de multiplicação matricial também\, tanto para esta seção quanto para a próxima\.**

![post](../../../blog/2020_07_22_dr_gpt/gpt_8.webp)

A função usada é um [neural network, so it's more complicated than just multiplying by two.](https://towardsdatascience.com/learn-how-recurrent-neural-networks-work-84e975feaaf7 'neural') Vou dar um passo rápido sobre como esses métodos funcionam\, já que já falei sobre a intuição antes [here](/writing/ml 'ML')\, e isso vai complicar demais esse passeio\. Inscrições gratuitas\, me envie um e\-mail e eu encaminho\.

O que é mais importante entender aqui é que a palavra é transformada em outra coisa\. O modelo pode controlar tanto como a palavra é inicialmente transformada em números quanto qual função realizamos\. Por exemplo\, em vez de \(1\, 2\, 3\) vezes 2\, poderíamos ter \"Had\" transformado em \(2\, 3\, 4\)\, e então vezes 3 para igualar \(6\, 9\, 12\)

![post](../../../blog/2020_07_22_dr_gpt/gpt_9.webp)

Terminamos com a primeira palavra\, então vamos para a segunda\. O que é diferente aqui é que temos aquela saída temporária 1 da primeira palavra [^9]\. Vamos combinar isso junto com a segunda palavra\, aplicar nossa função novamente e obter uma nova saída temporária 2\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_10.webp)

Neste ponto\, você pode inferir para onde estamos indo para o restante da sequência\. Na verdade\, continuamos fazendo isso até chegar à última palavra da nossa entrada\. Usamos a saída temporária de uma palavra para ajudar a gerar a saída temporária da próxima de forma recorrente\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_11.webp)

Usando essa saída temporária\, aplicamos uma função diferente\, e isso nos dá duas coisas\. Recebemos a primeira palavra da nossa saída \(depois de traduzi\-la de volta dos números\)\, e depois outra saída temporária \(ainda em números\)\. No nosso exemplo\, temos a palavra \"isto\"\. Incrível\, finalmente um progresso tangível\!

![post](../../../blog/2020_07_22_dr_gpt/gpt_12.webp)

Agora temos uma saída temporária\, uma saída real e nossa nova função\. Como você deve ter imaginado\, podemos repetir esse mesmo passo para obter a próxima palavra prevista e outra saída temporária\. É um padrão recorrente novamente\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_13.webp)

E\, assim como no cenário de entrada anterior\, repita até o final da frase\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_14.webp)

E terminamos com o modelo antigo\! Isso foi muita coisa\, obviamente simplificado demais\, mas já entendemos o processo em um nível geral\. Para mais detalhes\, você pode conferir o artigo original [here](https://arxiv.org/abs/1409.3215 'paper')

Agora aqui está uma pergunta crítica que tanto testa nosso entendimento quanto sugere as melhorias no novo modelo\. No modelo antigo\, poderíamos resolver alguma parte do processo antes de termos resolvido as partes anteriores\? Por exemplo\, poderíamos obter a saída temporária para \"tempo\"\, sem resolver para \"nós\" primeiro\?

**Não\, já que tivemos que rodar tudo em sequência\.** Tanto a posição quanto o contexto das palavras importam\, então queremos processar tudo uma palavra de cada vez\. Não podemos pular nenhuma parte\, pois cada etapa depende da anterior\, de forma recorrente\. É também por isso que o modelo antigo é conhecido como um [recurrent neural network](http://karpathy.github.io/2015/05/21/rnn-effectiveness/ 'RNN')\. Por causa disso\, o cálculo da previsão também se torna lento quando nosso texto de entrada se torna grande\.

Entra o modelo de transformador\.

## 3\. O GPT\-3 utiliza um modelo de decodificador de transformador\, uma variação do modelo de transformador

GPT\-3 significa Transformador Pré\-Treinado Generativo 3\. O transformador no nome representa o [transformer model, using an "attention" mechanism.](http://jalammar.github.io/illustrated-transformer/ 'transformer') Tanto o GPT\-2 quanto o GPT\-3 usam o mesmo tipo de modelo\, então qualquer explicação que você encontrar sobre o primeiro também vai se generalizar [^10]\.

No entanto\, o que aprendi pouco antes de publicar este post foi que **Eles realmente usam [a variation of the transformer model.](https://s3-us-west-2.amazonaws.com/openai-assets/research-covers/language-unsupervised/language_understanding_paper.pdf 'variation')** Portanto\, vamos primeiro passar por uma versão simplificada do novo modelo\, o que significa \"atenção\" e depois ver como a versão do GPT\-3 é diferente\. Vou indicar quando vamos sair do transformador normal e usar os ajustes do GPT\-3\.

Para o novo modelo\, voltaremos ao início\, com nossas palavras de entrada e tentando obter o resultado delas\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_15.webp)

Agora\, porém\, queremos avaliar todas as palavras de entrada ao mesmo tempo\, em paralelo e não em sequência\. Isso vai nos poupar muito tempo calculando o resultado\, já que podemos usar matemática matricial para calcular isso de uma vez só\.

Convertemos nossas palavras de entrada em números novamente\, como sempre fazemos\. Desta vez\, porém\, passamos esses números por 3 funções diferentes\, obtendo 3 saídas temporárias para cada palavra\, a\, b e c\. Note que é só para simplificar que nossa palavra e saídas têm 3 números\; na prática\, eles têm centenas de números\. Vamos ver como essas 3 saídas são usadas em breve [^11]\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_16.webp)

Vamos desorganizar o diagrama e fazer esses cálculos para todas as palavras de entrada\. Agora temos a\, b e c para todas as nossas palavras de entrada\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_17.webp)

Agora aqui está o problema que enfrentamos quando não consideramos a entrada sequencialmente\; pesquisadores ficaram presos nisso por muito tempo antes do novo modelo\. Como mencionado anteriormente\, **Tanto a posição quanto o contexto das palavras importam\. Como podemos obter isso se não avaliamos sequencialmente\?**

Por exemplo\, pegue a frase \"O autor bebeu ainda mais café para terminar sua newsletter\, porque ainda não estava pronta\"\. Trocar a posição de \"café\" por \"newsletter\" não faria sentido\, então o computador precisa saber disso de alguma forma\. Além disso\, o \"isso\" aqui se refere à newsletter\, e o computador também precisa conhecer esse contexto\. No modelo antigo\, toda essa informação é mantida porque movemos uma palavra de cada vez\. No novo modelo\, precisamos de outro método para obter essa informação desde o início\.

Note no diagrama que calculamos todas essas saídas temporárias simultaneamente\, e nenhuma depende uma da outra\. O que faremos a seguir é pegar a primeira saída temporária da primeira palavra e aplicar uma função nessa saída com todas as segundas saídas temporárias de todas as palavras\. No diagrama\, representei os resultados dessas como a primeira saída temporária \"ponto\" e a segunda saída temporária\, por exemplo\, 1a\.2b

![post](../../../blog/2020_07_22_dr_gpt/gpt_18.webp)

Pegamos algo relacionado à primeira palavra e o vinculamos a algo que estava relacionado a todas as outras palavras\. Importante\, não precisamos fazer esses cálculos sequencialmente\, já que o resultado de um não flui para o outro\. Podemos repetir isso para o restante das palavras\. Aqui mostro o mesmo passo para a palavra 2\, só para clareza\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_19.webp)

Vamos voltar à primeira palavra\. Terminamos com as saídas a e b\, mas ainda temos c\. Para surpresa de ninguém\, aplicamos mais uma função em todas essas saídas temporárias de pontos e em todas as saídas c\. Depois disso\, usamos ainda outra função\, para transformar todas essas saídas separadas em uma única saída\. Por exemplo\, neste caso passamos de 7 saídas para 1 saída única 1z\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_20.webp)

Ok\, foi muito trabalho\. Juro\, isso faz sentido para quem criou\. O que acabamos de fazer foi passar por [the steps of calculating "attention" for our words](http://jalammar.github.io/illustrated-gpt2/ 'attention') [^12]\. A quantidade de \"atenção\" que a palavra A tem para outra palavra é quanto a palavra A deve focar nela e\, portanto\, quanto contexto ela deve receber\. Ao associar componentes das palavras com todas as outras palavras\, resolvemos o problema de contexto antes\. Vou pular a resolução da questão da posição por simplicidade\, pense nisso como se eles adicionassem mais números à palavra original com base na posição da palavra [^13]\.

Agora temos essa nova saída\, z\, que contém informações daquela palavra em particular\, assim como o contexto para outras palavras na entrada\. Rodamos isso por outra função \(uma rede neural feed forward\) para obter mais uma saída\, vamos chamá\-la de z\\\*\. Quase lá\.

**Vamos resumir todos os passos que acabamos de fazer e chamá\-los de etapa de \"codificação\"\.** Durante a \"codificação\"\, transformamos nossos números iniciais da palavra em novos números que incluem mais contexto das outras palavras ao redor\. Por exemplo\, \(1\, 2\, 3\) se torna \(5\, 7\, 0\)\. Lembrete de que cada palavra é\, na verdade\, centenas de números\, não apenas três\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_21.webp)

A saída z\\\* tem o mesmo número de elementos que quando transformamos a palavra em números pela primeira vez\. O novo modelo pega esse resultado e o alimenta repetidamente por todo o processo de codificação\. Pense nisso como múltiplas camadas de codificação\, por exemplo\, fazendo o processo 96 vezes\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_22.webp)

Depois de todo esse treinamento\, temos uma saída final da codificação\. Vamos chamá\-los de vf\. Note que o cálculo do vf de uma palavra ainda é independente do cálculo do vf de outra\. Essa paralelização nos poupou muito tempo\. Por exemplo\, posso calcular 7\_vf sem saber 1\_vf primeiro\.

Agora\, podemos usar essas saídas finais para começar a prever nossas palavras\. Passamos todas essas saídas finais por outra \"função de decodificação\" para obter nossa primeira palavra [^14]\. Existem diferenças entre como a função de decodificação funciona e a função de codificação\, mas os passos são suficientemente semelhantes para que não os percorramos novamente\. **Você pode pensar na função de decodificação como fazendo todas essas etapas de codificação\, mas também pegando a saída do processo da \"função de codificação\" [^15]\.**

Coloquei apenas um grande bloco para \"funções de decodificação\" aqui\, mas o novo modelo repete esse processo o mesmo número de vezes que o processo de codificação\. Por exemplo\, se ele tivesse 96 camadas de codificação\, teria 96 camadas de decodificação\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_23.webp)

Agora que temos nossa primeira palavra prevista\, vamos usá\-la junto com as saídas finais e passá\-las novamente pela função de decodificação\. Se você apertar os olhos\, isso parece muito com o processo da seção anterior do modelo antigo\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_24.webp)

E depois de repetir esse processo para todas as palavras\, você tem a frase final\. Finalmente\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_25.webp)

Certo\, então esse foi o _Geral_ modelo de transformador\. Agora vamos deixar tudo isso de lado e começar do zero para a versão do GPT\-3\.

Brincadeira\, não surte [^16]\.

O GPT\-3 combina o processo de codificação e decodificação\, para obter um [Transformer Decoder](https://arxiv.org/pdf/1801.10198.pdf 'TD')\. Eles combinam a sequência de entrada e a saída esperada em uma única \"frase\" e então a rodam pelas camadas de decodificação\. O GPT\-3 possui 96 dessas camadas de decodificação [^17]\. O modelo é usado para prever a próxima entrada e também a próxima saída\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_26.webp)

Se isso soa meio vago\, é porque é\. Não consigo encontrar nenhuma explicação online de como eles combinam os passos\, além do [original paper,](https://arxiv.org/pdf/1801.10198.pdf 'paper') [this post](http://jalammar.github.io/illustrated-gpt2/ 'Jay')\, e esse aleatório [github comment as confused as I am](https://github.com/openai/gpt-2/issues/157 'github')\. Parece que a forma como eles prevêem uma palavra de cada vez também implica que estamos de volta ao problema recursivo\, de processar o texto sequencialmente\. Talvez só colocar poder de processamento suficiente no problema tenha sido a solução\. Se alguém souber mais\, por favor me mande um e\-mail\.

Muitas pessoas postando online dizem que o GPT\-3 usa o modelo tradicional de transformador\, ou codificador\-decodificador de transformador\. Eles então explicam o modelo tradicional de transformador para descrever o que está acontecendo no GPT\-3\. **Sim\, todas essas pessoas estão erradas\,** assim como eu era até antes de ser corrigido\, pouco antes de postar isso\.

Se você ainda está comigo\, há mais duas características importantes do algoritmo que valem a pena mencionar\.

Primeiro\, lembra quando dividimos a palavra em 3 características diferentes\, a\, b e c\? O novo modelo faz isso 96 vezes desde o início [^18]\. Cada vez\, ele usa uma função diferente\, de modo que 96 tripletas diferentes são geradas\. Como são independentes\, ele executa todas essas pelas camadas de codificação\/decodificação ao mesmo tempo\, para todas as palavras de entrada\. Os resultados delas são fundidos ao obter essa saída da função de codificação\/decodificação\, z\. Isso é conhecido como ter \"múltiplas cabeças de atenção\"\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_27.webp)

Em segundo lugar\, toda vez que mencionei função nesta seção\, você pode pensar nela como um peso ou parâmetro em algum número\. **Quando você soma todos os pesos\, o novo modelo tem 175 bilhões deles\.** Não\, isso não é um erro de digitação\. Quando as pessoas se referem ao número de parâmetros que o GPT\-3 usa\, e como ele é muito maior que os modelos anteriores\, é a isso que elas estão se referindo\.

Por exemplo\, se cada palavra fosse representada como uma lista de 1000 números\, então você precisaria de tantos parâmetros só para passar por uma função em todo o processo descrito acima\. Você pode facilmente ver como ter um processo com 96 camadas e 96 alternativas dentro de cada camada leva a um número gigantesco de parâmetros necessários\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_28.webp)

Isso foi um desvio longo\, mas agora você tem mais intuição sobre o que o GPT\-3 está fazendo\. Ele recebe entradas de palavras\, realiza múltiplas iterações de transformações via matemática matricial e usa isso para prever ou traduzir palavras\.

Se isso foi um pouco confuso demais\, pense neste exemplo mais simples\. Imagine um [choose your own adventure game](https://en.wikipedia.org/wiki/Choose_Your_Own_Adventure 'choose your own')\, onde suas escolhas decidem como a história termina\. **O GPT\-3 é assim\, exceto que tem bilhões de opções disponíveis\, sobrepostas umas às outras\.** A menor diferença na formulação da sua escolha vai te levar por outro caminho\. E os caminhos possíveis são praticamente infinitos\.

Depois de resolver tudo isso\, a arquitetura do transformador do artigo original está abaixo para referência\. Você pode ver como partes dela correspondem ao diagrama simplificado que acabamos de pensar\, com algumas caixas que deixei de fora por simplicidade [^19]\. O GPT\-3 usa apenas o lado direito deste diagrama\. Se você tiver interesse em saber mais\, há referências adicionais no final deste artigo\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_29.webp)

## 4\. Como podemos detectar o GPT\-3\?

Sabemos que o GPT\-3 é bom\, e que algumas amostras da saída são difíceis de distinguir da escrita humana\. A questão natural\, então\, é perguntar se existem outras formas de detectar se o texto foi escrito por uma máquina\?

Acontece que existem maneiras surpreendentemente simples de fazer isso\.

Primeiramente\, [because of the hyperparameters used in GPT-3,](https://medium.com/analytics-vidhya/understanding-the-gpt-2-source-code-part-1-4481328ee10b 'temp') **A frequência das palavras geradas não seguirá as distribuições esperadas de humanos normais\.** Na captura de tela abaixo\, Gwern explica que isso faz com que palavras comuns aparecem ainda mais do que o esperado\, e palavras incomuns não aparecem de jeito nenhum\. A temperatura controla a aleatoriedade\, e o hiperparâmetro top\-k controla onde está o ponto de corte de frequência para as palavras principais escolhidas\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_30.webp)

Para quem não conhece a lei de Zipf\, já falei sobre isso anteriormente [here](/writing/zipf 'Zipf') Quando falo sobre procurar alienígenas \(sim\, alienígenas\. Legendas gratuitas me enviam e\-mail e eu encaminho\)\. Basicamente\, afirma que\, em uma grande amostra de texto\, a frequência de qualquer palavra é inversamente proporcional ao seu ranking\, quando classificada pela frequência de ocorrência\. Por exemplo\, a palavra mais comum é \~2 vezes mais frequente que a segunda palavra mais comum\.

Já tracei a lei do Zipf para minha newsletter antes\, e parece o gráfico superior\. Se o GPT\-3 escrevesse meus artigos\, você esperaria algo como o final \(com mais palavras\, claro\, o exemplo é só para fins ilustrativos\)\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_31.webp)

Em segundo lugar\, você pode usar outro modelo para verificar o texto\. A Vidhya de Análise fez um post há um tempo [how to detect computer generated articles.](https://www.analyticsvidhya.com/blog/2019/12/detect-fight-neural-fake-news-nlp/ 'Vidhya') Eles fornecem algumas ferramentas\, como um modelo de detector GPT\-2 ou [Grover,](https://grover.allenai.org/detect 'Grover') Isso pode pegar texto de exemplo e dizer se acreditam que foi gerado por máquina [^20]\. Essas ferramentas foram lançadas antes do GPT\-3 e ainda não foram calibradas para ele\, mas ainda funcionam bem\. Elas funcionam porque **Os modelos estão familiarizados com as peculiaridades que outros modelos usam para gerar texto\.**

Aqui está uma demonstração\. Fui para a primeira amostra no apêndice do [GPT 3 paper (page 49)](https://arxiv.org/pdf/2005.14165.pdf 'GPT')\, e copiou o poema gerado por máquina lá\. Colocando isso no site do Grover\, mostra que ele acha que foi gerado por máquina\. Provavelmente não teria adivinhado isso\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_32.webp)

Claro\, nenhum desses métodos é infalível\. Se você não tem uma amostra grande o suficiente de texto\, é difícil fazer análise de frequência ou verificar isso pelos modelos de verificação\. Se alguém te enviar um texto legal padrão só uma vez\, pode não haver dados suficientes para saber com certeza\. Fico me perguntando o quão insultante seria responder perguntando se eles eram um bot\.\.\.

Grover também recebe falsos positivos\, como afirmar erroneamente que o poema de Allen Ginsberg [Howl](https://www.poetryfoundation.org/poems/49303/howl 'Howl') foi escrito por uma máquina [^21]\. E também recebe falsos negativos\, pensando que o texto gerado pelo GPT\-3 foi criado por um humano\. [You can try playing around with it and see what works for you](https://grover.allenai.org/detect 'Grover')

Dito isso\, ter esses métodos ainda disponíveis me faz sentir menos receoso dos perigos do texto gerado por máquina falso\. Como ambas as ferramentas acima dependem de características estruturais dos modelos\, parece provável que\, enquanto os modelos tiverem hiperparâmetros para ajustar\, o texto gerado será identificável\.

No pior cenário\, todo mundo terá que instalar alguma extensão de navegador que escaneie a página e avise se achar que o texto é falso\. Talvez algo parecido com os bloqueadores de anúncios de hoje\? Nesse ponto\, será que devemos nos importar\?

## 5\. Estar vivo

O acesso à API GPT\-3 atualmente é [subject to a waitlist,](https://openai.com/blog/openai-api/ 'waitlist') já que a OpenAI quer ter cuidado com pessoas que fazem uso incorreto do modelo\. Se você se interessa pelo conceito\, existem algumas soluções alternativas\.

- A OpenAI lançou o código do GPT\-2 \(a versão mais antiga do GPT\-3\) [here](https://openai.com/blog/better-language-models/ '2')\, então você pode rodar isso sozinho se souber como configurar\.
- A equipe da Hugging Face desenvolveu uma interface mais amigável para o GPT\-2\, assim como para alguns outros modelos baseados em transformers\. Você pode conferir isso [here](https://transformer.huggingface.co/ 'transformer')
- [Aaron Tay](https://musingsaboutlibrarianship.blogspot.com 'Aaron') também postei que usando a versão premium \"Dragon\" de [AI Dungeon](https://play.aidungeon.io/ 'AI')\, um jogo gerador de texto usando GPT\, [supposedly gets you access to GPT-3 within the game](https://musingsaboutlibrarianship.blogspot.com/2020/07/playing-with-gpt-3-via-ai-dungeon.html 'AI')

Devemos esperar que mais pessoas tenham acesso a capacidades semelhantes ao GPT\-3\, e que os modelos de linguagem gerais continuem melhorando\. Os modelos podem não passar por [Turing Test](https://plato.stanford.edu/entries/turing-test/ 'Turing') ainda assim\, como [Kevn Lacker shows.](http://lacker.io/ai/2020/07/06/giving-gpt-3-a-turing-test.html 'Lacker') No entanto\, parece que chegamos mais perto a cada dia\. Vai se tornar cada vez mais difícil para os humanos saberem se algo foi feito por máquina\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_33.webp)

Os casos de uso finais do GPT provavelmente serão ainda mais criativos do que imaginamos\. [Tyler Cowen gives some thoughts here](https://marginalrevolution.com/marginalrevolution/2020/07/the-case-for-gpt-3.html 'Cowen') em diagnósticos e terapias médicas\, e provavelmente ainda estamos começando a entender o que pode ser possível fazer em larga escala com GPT ou modelos similares\. As demonstrações vão continuar nos surpreendendo\. Vamos nos perguntar o que significa ser inteligente\.

Ao mesmo tempo\, houve tweets de programadores dizendo que isso vai tirar empregos em bancos e consultoria\, de VCs sobre como isso vai tirar empregos de programação\, e de qualquer outro grupo que você possa imaginar tentar jogar em outra indústria\. Atualmente\, não acho esses argumentos convincentes\, mas continuo aberto a ser convencido\. Se conseguir ferramentas mais eficientes fosse um grande problema para o emprego\, o Excel teria acabado com metade de todos os empregos de escritório anos atrás\.

O que pode acontecer é que **Há uma recompensa ainda maior na especialização na carreira\.** O GPT pode fornecer o modelo para você conferir antes de preencher e editar onde necessário\. Os documentos e slides cansativos podem ser gerados sem muito esforço da sua parte\, e então você pode aplicar sua expertise para personalizá\-los para o projeto\. Banqueiros e consultores juniores podem finalmente conseguir fazer algo produtivo com seu tempo\, em vez de recriar o mesmo deck para outra empresa com os logos trocados [^22]\.

Pense assim\: É preciso mais ou menos experiência para você corrigir a lição de casa do seu filho\, conforme ele cresce\? Você começa corrigindo erros de ortografia\, mas acaba precisando aprender cálculo\.

Além disso\, as pessoas parecem achar que todos os nossos dados de entrada e saída serão limpos e facilmente utilizáveis\. Como [Vicki Boykis](https://vicki.substack.com/p/were-still-in-the-steam-powered-days 'Vicki') já apontou repetidamente que esse é geralmente o ponto de vista de alguém que nunca trabalhou com conjuntos de dados maiores antes\. Se você tivesse um modelo GPT personalizado para você\, provavelmente passaria a maior parte do tempo limpando os dados\. Se não tivesse\, provavelmente passaria a maior parte do tempo limpando a saída\.

De qualquer forma\, ainda há trabalho a ser feito\. Estamos seguros por enquanto\.

Eu proporia de forma controversa **O GPT\-3 nos diz mais sobre nós mesmos como seres humanos do que sobre computadores\.** Isso mostra que temos uma gama surpreendentemente ampla de tolerância à variação nos comandos que recebemos\, seja prosa\, poesia ou música\. Texto que um computador sinalizaria como gerado por máquina passaria em nossos testes instintivos\, implicando que somos os mais acomodativos dos dois\.

Talvez seja essa apreciação pela ambiguidade\, essa recepção ao estranho\, que separa nossos sinais sinapticos de bits e bytes\.

Ou talvez tenhamos que repensar o que isso significa\; de [being alive](https://www.youtube.com/watch?v=eBBPKedba5o 'alive')\.

_Este artigo não foi escrito pelo GPT\-3\. Agradecimentos a [Gwern](https://twitter.com/gwern?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor 'Gwern') e [Jay Alammar](https://twitter.com/JayAlammar?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor 'Jay') por responder perguntas no Twitter sobre o GPT\, e [Nathan](https://mobile.twitter.com/nbashaw 'Nathan') para edições\._

## Outros comentários interessantes

1. [Gwern showcases creative writing by OpenAI’s GPT-3 model, demonstrating poetry, dialogue, puns, literary parodies, and storytelling](https://www.gwern.net/GPT-3 'Gwern')
2. [Max Woolf on Tempering Expectations for GPT-3 and OpenAI’s API](https://minimaxir.com/2020/07/gpt3-expectations/ 'Max')
3. [Kevin Lacker on Giving GPT-3 a Turing Test](http://lacker.io/ai/2020/07/06/giving-gpt-3-a-turing-test.html 'Lacker')
4. [Michael Nielsen twitter thread](https://twitter.com/michael_nielsen/status/1284937254666768384?s=20 'Nielsen')
5. [Manuel Araoz on how OpenAI's GPT-3 may be the biggest thing since bitcoin](https://maraoz.com/2020/07/18/openai-gpt3/ 'Maraoz')
6. [Exxact with other GPT-3 applications, such as summaries, code, and spreadsheets](https://blog.exxactcorp.com/what-can-you-do-with-the-openai-gpt-3-language-model/ 'GPT')

## Explicações mais detalhadas

1. [Yannic's youtube video explaining the GPT 3 paper](https://www.youtube.com/watch?v=SY5PvZrJhLE&feature=youtu.be 'Yannic')\. Além do próprio artigo do GPT 3 ["Language Models are Few-Shot Learners"](https://arxiv.org/pdf/2005.14165.pdf 'GPT3')\. [Yannic's youtube video explaining the GPT 2 paper, which GPT 3 bases itself on.](https://www.youtube.com/watch?v=u1_qMdb0kYU 'Yannic') Além do próprio artigo do GPT 2 ["Language Models are Unsupervised Multitask Learners"](https://d4mucfpksywv.cloudfront.net/better-language-models/language_models_are_unsupervised_multitask_learners.pdf 'GPT2')
2. [Joseph Palermo](https://twitter.com/j_w_palermo 'Joseph') de Dessa [speaking at Insight on Transformers.](https://www.youtube.com/watch?v=S0KakHcj_rs 'youtube') Achei isso útil devido às perguntas feitas pelos membros da plateia\, tão perdidos quanto eu durante toda a apresentação\.
3. [Andrew Ng on attention models](https://www.youtube.com/watch?v=SysgYptB198 'Ng')
4. [How do Transformers Work in NLP? A Guide to the Latest State-of-the-Art Models](https://www.analyticsvidhya.com/blog/2019/06/understanding-transformers-nlp-state-of-the-art-models/ 'Vidhya')
5. [Jay Alammar on the illustrated transformer](http://jalammar.github.io/illustrated-transformer/ 'transformer')

[^1]: Brinco\, brincando\. De vez em quando eles jogam pingue\-pongue\.

[^2]: Aparentemente\, há problemas em comparar resultados diretamente\. Não conheço os detalhes\, mas parece estar relacionado à padronização dos dados preparados usados\. O artigo diz\: \"No entanto\, nossos cenários de um ou poucos planos não são estritamente comparáveis ao trabalho anterior não supervisionado\, pois utilizam uma pequena quantidade de exemplos pareados \(1 ou 64\)\. Isso corresponde a até uma ou duas páginas de dados de treinamento em contexto\.\"

[^3]: Contexto \- \"O conjunto de dados LAMBADA testa a modelagem de dependências de longo alcance em texto – o modelo é solicitado a prever a última palavra das frases que exigem a leitura de um parágrafo de contexto\"\; Curiosidades \- \"No TriviaQA\, alcançamos 64\,3\% na configuração zero\-shot\, 68\,0\% na one\-shot e 71\,2\% na pocas fotos\"\; Pronomes \- \"O Winograd Schemas Challenge é uma tarefa clássica em NLP que envolve determinar a qual palavra um pronome se refere\, quando o pronome é gramaticalmente ambíguo\, mas semanticamente inequívoco para um humano\"

[^4]: Um dos links está quebrado porque o Slate Star Codex deletou seu blog\; mas você pode encontrar algumas amostras de poesia do GPT\-2 preservadas [here](https://antinegationism.tumblr.com/post/182901133106/an-eternal-howl 'Moloch')\, e [Gwen's site](https://www.gwern.net/GPT-2 'Gwern') tem muitos outros\.

[^5]: [Banko and Brill showed way back in 2001 that more data can make a bad algorithm perform better than a good one.](https://dl.acm.org/doi/10.3115/1073012.1073017 'Banko')

[^6]: Páginas 8 e 9 do [GPT-3 paper](https://arxiv.org/pdf/2005.14165.pdf 'paper') discutir como eles usaram os conjuntos de dados CommonCrawl\, WebText\, Books e Wikipedia para treinamento\.

[^7]: Acredito que ele esteja se referindo a esse modelo de parâmetros de 160 bilhões [here](https://dl.acm.org/doi/abs/10.5555/3045118.3045359 'model')

[^8]: Não estamos exatamente convertendo as palavras para representação binária aqui\, se é isso que você estava pensando\. Em vez disso\, estamos [using a word embedding such as word2vec](https://towardsdatascience.com/learn-how-recurrent-neural-networks-work-84e975feaaf7 'word2') para gerar representações numéricas variadas das palavras que podem ser usadas nos algoritmos daqui para frente\. É verdade que\, no fim das contas\, tudo é convertido para binário\, mas isso não acontece neste ponto do processo\.

[^9]: Ok\, então tenho quase certeza de que a primeira função realmente tem um [bias unit](https://ayearofai.com/rohan-5-what-are-bias-units-828d942b4f52 'bias')\, então também exige outra entrada\. Mas isso complica demais a explicação principal do texto\, então estou deixando de fora\.

[^10]: Você pode verificar isso no [GPT-3 paper page 8,](https://arxiv.org/pdf/2005.14165.pdf 'paper') onde dizem \"Usamos o mesmo modelo e arquitetura do GPT\-2\, incluindo a inicialização modificada\, pré\-normalização e tokenização reversível descritas nele\, com exceção de que usamos padrões de atenção esparsos alternados densos e localmente faixados nas camadas do transformador\, semelhantes ao Transformador Esparso\"

[^11]: Esta é a parte do modelo de transformador onde [they embed the word, and then calculate smaller query, key, and value vectors by mapping the embedded word vector on to a pre-trained weighted matrix.](https://youtu.be/S0KakHcj_rs?t=1083 'youtube') Ainda não entendi totalmente o que a consulta\, a chave e os valores representam depois de assistir a toda essa leitura e vídeo\. Sugiro que você conferisse os recursos extras para mais detalhes e veja por conta própria\. Minha intuição atual é que é uma decomposição da palavra em algo que pode carregar o peso da palavra\, o peso quando comparado a outra\, e uma correspondência de busca\.

[^12]: O primeiro passo foi obter os vetores de consulta\, chave e valor\. Depois\, pegamos o produto escalar do vetor de consulta com os vetores\-chave de outras palavras para ver quanto foco colocar em outras palavras\. Depois\, dividimos pela raiz quadrada da dimensão dos vetores\-chave\. Depois fazemos um [softmax function](https://towardsdatascience.com/softmax-function-simplified-714068bf8156 'soft')\. Depois\, multiplicamos os resultados pelos vetores de valor\. E finalmente tomamos a soma de tudo isso\, para obter um vetor final para usar na próxima parte do processo\.

[^13]: Eles usam funções seno e cosseno\, veja [page 6 of the original paper](https://arxiv.org/pdf/1706.03762.pdf 'sin')\. Eles precisavam de algo periódico para que o modelo pudesse se estender por diferentes comprimentos de intervalo\.

[^14]: Tecnicamente\, existe outra camada linear de rede neural e camada softmax [after the decoding layers](http://jalammar.github.io/illustrated-transformer/ 'linear')\, mas deixaram de lado por simplicidade\.

[^15]: No decodificador\, as saídas só podem prestar atenção às palavras de saída que vêm antes\, em vez de toda a sequência de saída\. Isso é conhecido como \"mascaramento\"

[^16]: Embora essa tenha sido a sensação que tive quando percebi que o GPT não usa um modelo padrão de transformador\. Eu realmente achava que teria que recriar todos aqueles diagramas\.

[^17]: Per [page 8 of the paper (n layers)](https://arxiv.org/pdf/2005.14165.pdf 'gpt')

[^18]: Coincidentemente\, é igual ao número de camadas repetidas acima\, mas não precisa ser\. Página 8 do artigo também\.

[^19]:
    Ok\, isso parece assustador\, e passei muito tempo lendo e assistindo aos vídeos antes de entender o que estava acontecendo\. Para mapear isso ao modelo que percorremos\, vamos começar pela esquerda\. Temos entradas\, elas são incorporadas\. Até agora\, isso é igual a como nossas palavras foram convertidas em números no início\. Depois temos a \"codificação posicional\"\, que é a adição dos números de posição que eu pulei\. Então entramos nessa caixa que começa com \"atenção multi\-cabeça\" \- sabemos disso\, passamos por todo esse processo\. Tem essa caixa \"add \& norm\" que se refere a [layer normalisation](https://mlexplained.com/2018/11/30/an-overview-of-normalization-methods-in-deep-learning/ 'norm') que você pode pensar como escalar os números\. Depois\, isso vai para a caixa \"feed forward\"\, que é a rede neural mencionada para chegar a z\\\*\. Depois normalizamos novamente\. Essa caixa maior tem Nx do lado de fora\, indicando que repetimos isso N vezes conforme desejado\. À direita\, vemos as saídas\, fazemos o embedding e codificação\, e então entramos na caixa grande\. Os passos ali são semelhantes aos da esquerda\, exceto que fazemos atenção \"mascarada\" com múltiplas cabeças\, e também pegamos a saída da caixa esquerda\. Repita N vezes como desejar\. Isso passa por uma camada linear e uma função softmax para obter as probabilidades de saída de quais palavras produzir\. Ufa\. Novamente\, isso é para o modelo normal de transformador\. O GPT\-3 apenas usa o lado direito\.
    [^20]: A postagem também faz links para uma ferramenta de análise estatística\, [GLTR,](https://gltr.io/ 'GLTR') isso seria fazer algo semelhante à análise da lei de Zipf mencionada anteriormente\.
    [^21]: Para ser justo\, definitivamente parece o papel\.
    [^22]: Brincadeira\, sei que você também troca as cores do gráfico\.
