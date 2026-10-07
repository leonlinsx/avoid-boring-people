---
title: "Guerra das palavras"
description: "Usando a lei de Zipf e a entropia da informação na busca por alienígenas"
pubDate: 2020-06-24
category: Technology
tags: ['information']
heroImage: '../../../blog/2020_06_24_zipf/z_3.webp'
locale: 'pt-BR'
sourceSlug: 'zipf'
sourceHash: '973192c22790935d832c5e18991ced9ee6c8da9f91d41215baf5d37cb9c8863a'
---

## Mensagem

A lei de Zipf e a entropia de informação de Shannon podem nos ajudar a encontrar vida alienígena

## Como podemos encontrar vida alienígena\?

Já conversamos sobre [how machine learning companies use data to recognise text](/writing/ml 'ML') e como [investors use data to pick companies.](/writing/data 'invest')

Nesta semana\, vamos falar sobre como cientistas estão usando dados para procurar alienígenas\. Parte do conteúdo abaixo será inspirado em [Laurance Doyle's talk with the Long Now group.](http://longnow.org/seminars/02020/apr/29/interspecies-communication-and-search-extraterrestrial-intelligence/ 'Long')

### Enquadrando o problema

O Instituto de Busca por Inteligência Extraterrestre \(SETI\) é o mais famoso dos institutos de pesquisa que procuram vida alienígena\. Sua missão é ["to explore, understand and explain the origin and nature of life in the universe and the evolution of intelligence."](https://www.seti.org/about-us/mission 'mission')

Como podemos sequer abordar um problema assim\?

Bem\, se estamos tentando encontrar vida alienígena\, ela precisa existir em algum outro planeta\. Então sabemos que tentar encontrar planetas é um possível ponto de partida\.

Pela ciência elementar\, também sabemos que planetas se formam ao redor de estrelas\. Portanto\, sabemos que tentar encontrar estrelas que possam sustentar planetas também é um ponto relevante\.

Sabemos que a maioria dos planetas tem ambientes hostis\. Então vamos restringir essa lista apenas aos planetas que acreditamos que podem sustentar vida [^1]\.

Desses planetas\, nem todos terão vida realmente aparecida\, então vamos considerar a proporção que realmente aparece\.

Podemos achar que estamos bem aqui e que temos recursos suficientes para começar a procurar\. Ainda assim\, há alguns recursos que podemos adicionar para restringir a precisão da busca\.

Quando estamos olhando para planetas\, queremos encontrar algum sinal vindo do planeta\, pois isso será uma prova muito mais forte de que o planeta tem vida\. Imagine que você está olhando para uma casa em vez de uma casa onde alguém está tocando música\. É muito mais fácil concluir que há um ser vivo no segundo cenário\.

Então\, vamos restringir os planetas onde a vida realmente aparece aos planetas onde espécies \"inteligentes\" aparecem\.

E dessas \"espécies inteligentes\"\, vamos pegar apenas aquelas que acabam desenvolvendo tecnologia de comunicação\.

Por fim\, mesmo que a espécie desenvolvesse comunicações\, se não estiverem mais vivas para enviar essas comunicações\, nunca as receberíamos\. Então precisamos considerar também quanto tempo essas civilizações vivem\.

Foi muita coisa\. Mas agora temos todos os principais fatores que precisamos para enquadrar nosso problema e procurar o número de civilizações alienígenas inteligentes que podem enviar sinais\.

Juntando tudo isso\, o que fizemos foi criar o [Drake equation](https://en.wikipedia.org/wiki/Drake_equation#:~:text=The%20Drake%20equation%20is%20a%20statement%20that%20stimulates%20intellectual%20curiosity,a%20part%20of%20that%20universe. 'Drake')\, uma forma famosa de estimar vida inteligente [^2]\. Repare como todos os pontos que acabamos de abordar são multiplicados juntos para tentar estimar quantos alienígenas inteligentes existem por aí\:

![post](../../../blog/2020_06_24_zipf/z_1.webp)

### Estreitando o escopo

São muitas variáveis\, então vamos focar em uma parte dessa equação hoje\, a fração de espécies \"inteligentes\"\.

Precisamos encontrar uma forma de distinguir sinais \"inteligentes\" de sinais \"não inteligentes\"\. Por exemplo\, eu gostaria de diferenciar entre cantar no microfone e cantar no microfone [audio feedback](https://en.wikipedia.org/wiki/Audio_feedback 'audio')\.

Seria útil se tivéssemos exemplos de comunicação alienígena\, ou soubéssemos o que estamos procurando\. Obviamente\, não temos a primeira opção [^3]\, mas existem maneiras de restringir ainda mais a questão\. O que queremos encontrar são características que um sinal inteligente pode ter em contraste com ruído aleatório\.

Uma forma de fazer isso é observando a vida inteligente não humana ao nosso redor\. [We use Antarctica as a proxy for Mars,](https://www.cnn.com/2015/12/09/health/white-mars-antarctica-concordia/index.html 'Mars') e pode usar animais como proxy para línguas alienígenas\.

Se tivéssemos regras que acreditamos que as comunicações inteligentes devem seguir\, poderíamos testar essas regras contra comunicações com animais e ver como funcionam\. Isso nos permitirá saber se precisamos ampliar ou restringir nossos critérios de busca\.

Acontece que existem duas regras principais na teoria da linguagem \- a Lei de Zipf e a entropia da teoria da informação de Shannon\. Vamos analisar cada uma por sua vez\.

### A lei de Zipf sobre a frequência das palavras

O que a lei de Zipf propõe é que\, para cada idioma\, a frequência de ocorrência de uma palavra é inversamente proporcional à classificação da palavra\, se você ordenasse todas as palavras pela frequência de ocorrência\. Por exemplo\, se \"the\" for a palavra mais comum\, ela tem posto \#1\. Se \"I\" for a segunda palavra mais comum\, ela tem posto \#2\. A palavra de ordem \#1\, \"the\"\, ocorrerá duas vezes mais vezes na língua do que a palavra de ordem \#2\, \"I\"\. Ela ocorrerá três vezes mais vezes na língua do que a palavra \#3 em curso\, e assim por diante\.

Com tal lei\, podemos testá\-la em textos de exemplo desse idioma\. Por exemplo\, alguém plotou a frequência das palavras em Romeu e Julieta\:

![post](../../../blog/2020_06_24_zipf/z_2.webp)

Não satisfeito em depender de algum desconhecido da internet\, fui analisar meus próprios posts de newsletter\. Com um código simples em Python [^4]\, extraí o texto de todas as minhas postagens no substack\, puxei as 50 palavras mais populares que usei e as tracei em um gráfico em relação à frequência delas\. A relação não é perfeita\, mas está bem próxima do que a lei de Zipf prevê\. Como você pode imaginar\, \"the\"\, \"to\"\, \"a\"\, \"e\"\, \"of\" ocorrem com frequência\.

![post](../../../blog/2020_06_24_zipf/z_3.webp)

Ótimo\, agora temos uma lei\. Podemos testar isso contra animais como golfinhos e baleias\, e ver se ainda se mantém\. [Researchers did that,](https://www.seti.org/animal-communications-information-theory-and-search-extraterrestrial-intelligence-seti#:~:text=We%20also%20found%20that%20bottlenose,Zipf's%20Law%20distribution%20of%20signals.&text=In%20other%20words%2C%20baby%20bottlenose,start%20to%20whistle%20like%20adults. 'dolphin') e descobri que eles têm\! [^5] Em outras palavras\, é provável que a lei de Zipf também se aplique a línguas alienígenas\. Ao aplicá\-la a sinais vindos do espaço sideral\, podemos filtrar parte do ruído\.

### Teoria da informação de Shannon sobre a previsão da próxima palavra

Teoria da informação de Shannon [^6] propõe que conhecer as palavras antes de outra vai te dar alguma pista sobre qual é essa palavra\. Em outras palavras\, as palavras de uma frase vão depender de cada uma\. Por exemplo\, você provavelmente entende a frase anterior muito bem\, mesmo que eu tenha omitido a última palavra \"outro\"\.

Sabendo que há alguma relação entre as palavras\, [we can also derive a way to score the language based on those relationships.](https://langev.com/pdf/plotkin00languageEvolution.pdf 'shannon') Estou ignorando a matemática aqui porque eu mesmo não entendo\, mas o principal que podemos entender é que as línguas têm uma pontuação\.

Ao plotar essas pontuações\, podemos ver em qual faixa a maioria das línguas se enquadra\. Podemos fazer o mesmo processo de antes\, pontuando golfinhos e baleias\, e vendo como suas línguas também se comportam\:

![post](../../../blog/2020_06_24_zipf/z_4.webp)

Como você pode ver\, existe uma faixa em que a maioria das línguas se enquadra\. Se aplicarmos o mesmo sistema de pontuação aos sinais\, também podemos filtrar aqueles que provavelmente não são idiomas\.

### Encontrar alienígenas não é tão diferente de aprendizado de máquina

Começamos com um objetivo amplo – querer encontrar alienígenas\.

Em seguida\, apresentamos o problema e criamos os vários componentes que poderiam ser úteis de analisar\.

Reduzimos a apenas uma parte do problema e buscamos maneiras de aumentar a precisão da nossa busca\. Criamos dois critérios principais a partir de línguas humanas e depois os validamos com outras línguas não humanas\. Daqui para frente\, podemos usar uma abordagem semelhante para restringir os sinais que queremos estudar ainda mais\.

Caso você achasse que tudo isso era hipotético\, a abordagem acima é [exactly what one team at SETI is using to analyse signals.](https://www.seti.org/animal-communications-information-theory-and-search-extraterrestrial-intelligence-seti#:~:text=We%20also%20found%20that%20bottlenose,Zipf's%20Law%20distribution%20of%20signals.&text=In%20other%20words%2C%20baby%20bottlenose,start%20to%20whistle%20like%20adults. 'SETI')

Como você pode ver\, o processo em si pode ser semelhante a outros problemas de análise de dados\. Primeiro\, você começa com um objetivo\. Depois\, você define o que pode precisar\. Depois\, você cria um algoritmo\. Por fim\, você testa para ver se ele se sustenta\. Resolver problemas em uma área não é tão diferente de resolver problemas em outra\.

[^1]: Definindo o que é habitável e o que não é [is difficult of course,](https://en.wikipedia.org/wiki/Circumstellar_habitable_zone 'zone') já que o que funciona para nós pode não funcionar para vida alienígena\. Algumas pessoas podem acreditar em vida baseada em silício em vez de carbono \(o que somos\)\, porém [there are difficulties with that assumption](https://astronomy.stackexchange.com/questions/20858/why-do-aliens-have-to-be-carbon-based-lifeforms 'carbon')

[^2]: Note que \"a utilidade da equação de Drake não está na resolução\, mas sim na contemplação de todos os vários conceitos que os cientistas devem incorporar ao considerar a questão da vida em outro lugar\, e dá à questão da vida em outro lugar uma base para análise científica\"

[^3]: A menos que você saiba de algo que eu não saiba\, nesse caso estou interessado em saber mais\.\.\.

[^4]: Por simples\, quero dizer que levou \<30 minutos para escrever\, e depois 3 horas para eu diagnosticar\. O código é [here](https://github.com/leonlinsx/ABP-code/blob/master/Python-projects/File%20extractor.py 'git') Se você tem interesse em adaptá\-lo para seus próprios propósitos\.

[^5]: Também testaram contra bebês balbuciando\, tanto humanos quanto filhotes de golfinho\. Eles descobriram que nenhum desses segue a lei de Zipf\.

[^6]: Sim\, é isso _o_ [Claude Shannon, the guy who essentially taught us how to create electronic communications](https://www.itsoc.org/about/shannon 'Shannon')
