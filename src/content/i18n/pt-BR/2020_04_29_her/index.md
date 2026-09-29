---
title: "A gente a quería, mas em vez disso pegamos o Tinder"
description: "A armadilha da margem das empresas de IA, conceitos de investimento em valor e tradeoffs"
pubDate: 2020-04-29
category: Technology
tags: ['AI', 'business', 'investing']
heroImage: './her_1.webp'
locale: 'pt-BR'
sourceSlug: 'her'
sourceHash: '140929fc05bda4f1a76315eefef59e45e7cb3db132f6b4504e8865ffe9865199'
---

## Concluições

1. Empresas de IA parecem mais empresas de serviços do que de software\, o que implica que deveriam negociar com avaliações mais baixas
2. A única pessoa em quem Charlie Munger investe diz que investir não é sobre ser inteligente\, mas sobre pensar como um proprietário
3. Tente entender melhor os tradeoffs na tomada de decisão

## IA como um negócio de serviço

Já escrevi sobre aprendizado de máquina \(ML\) e inteligência artificial \(IA\) antes [^1]\. Scott Locklin detalha os problemas enfrentados pelas startups de ML [here](https://scottlocklin.wordpress.com/2020/02/21/andreessen-horowitz-craps-on-ai-startups-from-a-great-height/ 'Scott') [^2]\, respondendo principalmente a um post relacionado ao A16Z [here.](https://a16z.com/2020/02/16/the-new-business-of-ai-and-how-its-different-from-traditional-software/ 'a16z')

Seus principais pontos são\:

1. ML custa muito para ganhos marginais

2. Startups de ML geralmente não têm fosso ou especial significativo

3. Startups de ML são principalmente empresas de serviços\, não de software

Essas são visões mais negativas do que consensuais\, então vamos ver por que ele acha que isso acontece\. Vou citar tanto Scott quanto o post a16z de Martin Casado e Matt Bornstein\.

### Custo

> Juntas\, essas forças de operação e computação em nuvem contribuem para os 25\% ou mais da receita que as empresas de IA frequentemente gastam em recursos em nuvem\. Em casos extremos\, startups que lidam com tarefas particularmente complexas descobriram que o processamento manual de dados é mais barato do que executar um modelo treinado de \"ML\\\]\. \- a16z

> A estrutura de precificação do \"cloud\" é projetada para extrair o máximo de sangue de pessoas com grandes necessidades de dados ou computação\. \- Scott

25\% do rev é gasto apenas em operações em nuvem [^3] Muito\? Para contextualizar esse número\, vamos olhar para o custo total de bens \(COGS\) da Salesforce\, uma empresa de software de primeira linha\. [Their 8K](https://s23.q4cdn.com/574569502/files/doc_financials/2020/q4/CRM-Q4-FY20-Earnings-Press-Release-w-financials.pdf '8K') mostra um COGS total de 25\%\, o que inclui todos os outros custos que a Salesforce classificaria nessa categoria [^4]\, não apenas custos de nuvem\. Para ter a mesma margem de uma Salesforce\, as empresas de IA não precisariam ter outro COGS além dos custos em nuvem\.

> Dados anedóticos mostram que muitas empresas gastam até 10\-15\% da receita no processo de limpeza manual de dados e manutenção de precisão dos dados – geralmente sem contar os recursos centrais de engenharia – e sugerem que o trabalho contínuo de desenvolvimento excede correções de bugs e adições de recursos típicas \- A16Z

Acontece que empresas de IA têm outros COGS\, gastando até 15\% em processos manuais de dados\. A grande mídia foca nas previsões do aprendizado de máquina\, [but data scientists spend more of their time on data collection and cleaning.](/writing/time 'ABP') Isso não vai desaparecer\, ou seja\, **a maioria das empresas de IA é imediatamente 15\% menos lucrativa que uma empresa de software\.** Isso também antes de qualquer outro COGS envolvido\, o que implica que as margens brutas finais são ainda menores\.

O apelo de investir em empresas de software é que os custos marginais são baixos\, então uma alta porcentagem da receita incremental é convertida em lucro\. Empresas de IA precisam reduzir esse percentual de COGS ou esperar algum benefício de escala para serem tão atraentes\. Isso é provável\?

> o poder computacional dos chips de GPU não tem exatamente crescido rápido \- Scott

A IA exige [graphics processing units (GPUs) to do the computing.](https://www.nvidia.com/en-us/deep-learning-ai/solutions/ 'GPU') No entanto\, os recursos necessários cresceram enormemente em comparação ao crescimento do poder computacional\; A Lei de Moore não se aplica ao lado da computação de IA\. Não devemos esperar que os 25\% de COGS acima caiam significativamente tão cedo\.

> Como a faixa de valores possíveis de entrada é tão grande\, cada nova implantação de cliente provavelmente gerará dados que nunca foram vistos antes \- a16z

> a maioria das pessoas ainda não percebeu que processos orientados a ML quase nunca escalam como uma aplicação mais simples \- Scott

Compare vender Microsoft Office com vender uma oferta de consultoria para uma empresa\. No primeiro caso\, você pode doar a mesma cópia do Office que vende para todas as outras empresas\. No segundo\, você terá que criar novos materiais adaptados para aquele cliente [^5]\, o que significa que você sempre terá custos incrementais ao obter mais receita\.

Se a IA for mais parecida com o segundo caso\, isso significa que não devemos esperar que os outros 15\% \(e qualquer outro COGS\) também caiam\. [That low margin still takes a lot of work to get. ](https://avc.com/2020/04/not-all-gross-margin-is-the-same/ 'AVC') **Além de as empresas de IA serem menos lucrativas\, devemos esperar que esse perfil de margem dure um tempo**

### Moat

Esse aumento de custo vale a pena\? Nem a a16z nem a Scott parecem pensar assim\:

> No mundo da IA\, a diferenciação técnica é mais difícil de alcançar\. \\\[\.\.\.\\\] Os dados são o núcleo de um sistema de IA\, mas frequentemente pertencem aos clientes\, estão em domínio público ou\, com o tempo\, se tornam uma mercadoria\. \- a16z

> Eu sei que\, do ponto de vista dos negócios\, algo bobo como Naive Bayes ou um modelo linear pode resolver o problema do cliente tão bem quanto a mais recente atrocidade da rede neural de gigawatts\. \\\[\.\.\.\\\] As pessoas não pagam um caro maior em relação a soluções internas ad\-hoc de ciência de dados a menos que representem resultados realmente revolucionários\. \- Scott

Se o produto de uma empresa não for significativamente melhor\, ela precisa se destacar em vendas e marketing para se diferenciar\. **Isso implica custos ainda maiores em comparação com uma empresa de software típica\,** que já é muito vendido\. Isso faz você se perguntar se o hype em torno do aprendizado de máquina é justificado ou se é usado para justificar a sobrevivência de uma empresa\.

Não tenho certeza de qual é o limite para \"mudar o jogo\"\, porém\. Um dos meus leitores respondeu após o post da Vicki Boykis que sugeria que ele considerava significativa uma melhora de 10\-15\% na precisão [^6]\. Acho que vai depender da empresa\.

Se o produto em si é uma mercadoria\, talvez o mercado total seja grande\?

> Muitas empresas estão descobrindo que a tarefa mínima viável para modelos de IA é mais restrita do que esperavam\. \- a16z

> mas o taco de hóquei necessário para o apoio de VC\, e o exército de Ph\.D\.s necessários para fazê\-lo funcionar\, não se misturam muito bem com esses domínios limitados\, que têm um mercado limitado\. \- Scott

É comum pensar que você pode simplesmente jogar aprendizado de máquina em qualquer problema e ele magicamente funciona para esse problema e para qualquer outro problema semelhante\. Infelizmente\, por enquanto parece que muitos problemas ainda não serão melhorados jogando IA nele\. Queríamos [Her](<https://en.wikipedia.org/wiki/Her_(film)> 'Her')\, em vez disso\, pegamos o Tinder\.

Se a IA tem casos de uso limitados\, o mercado total endereçável para vender seu produto de IA é muito menor do que você imaginava\. Considerando os VCs [size of market as a key factor for investment,](https://bettereveryday.vc/how-to-prove-your-market-is-big-enough-to-vcs-d04059d93380 'size') isso parece ser um problema quando as empresas de IA precisarem demonstrar crescimento no futuro\.

### Empresas de serviços vs empresas de software

> a maioria dos sistemas de IA hoje não é exatamente software\, no sentido tradicional\. E negócios de IA\, como resultado\, não se parecem exatamente com negócios de software\. Eles envolvem suporte humano contínuo e custos variáveis de materiais\. Frequentemente não escalam tão facilmente quanto gostaríamos\. E uma forte defensabilidade – crítica para o modelo de software \"construir uma vez \/ vender várias vezes\" – não parece ser gratuita\. \- a16z

> Empresas de serviços não são valorizadas como as empresas de software\. Os VCs adoram negócios de software\; trabalham duro no início para resolver um problema\, imprimem dinheiro para sempre\. É por isso que recebem avaliações de receita 10\-20x\. Empresas de serviços\? Por que investir em uma empresa de serviços\? O crescimento delas é inerentemente limitado por custos de mão de obra e problemas estranhos e abordáveis de mercado\. \- Scott

![post](./her_1.webp)

Empresas geralmente são avaliadas com base em um múltiplo de algum indicador financeiro\, como receita\, EBITDA ou lucro líquido\. Empresas de software geralmente são avaliadas em um múltiplo mais alto do que empresas de serviços\, devido aos motivos mencionados acima\. [Higher gross margins matter, as described by Two Sigma](https://twosigmaventures.com/blog/article/why-gross-margins-matter/ 'Two')

Tanto a16z quanto Scott estão insinuando que **uma empresa de IA é mais parecida com uma empresa de serviços e\, portanto\, deveria receber um múltiplo de avaliação menor do que uma empresa de software\.** Mesmo que você ache que elas terão um múltiplo maior do que o 2x da receita que os serviços recebem\, as empresas de IA não deveriam receber a receita 10x que as empresas tradicionais de software recebem\, e que essas empresas de IA já arrecadaram antes\.

Isso provavelmente será um problema para empresas de IA que aumentaram em avaliações altas e agora têm dificuldade para aumentar sua próxima rodada devido a mais pessoas perceberem os problemas acima\. Eu esperaria\, com 60\% de certeza\, que comecemos a ver avaliações menores do que o esperado para rodadas privadas de empresas de IA em estágio avançado\.

## A prática do investimento em valor por Li Lu

O parceiro de Warren Buffett\, Charlie Munger\, deu dinheiro para um estranho concorrer [only once in his life.](https://qz.com/work/1551328/the-only-person-besides-warren-buffett-who-charlie-munger-trusts-with-his-money/ 'Munger') Esse estranho é [Li Lu of Himalaya Capital.](http://himalayacapital.com/ 'Himalaya')

Fundada em 1998\, a Himalaya é uma empresa de investimento em valor\, focada em empresas da Ásia com ênfase na China\. Típico desse estilo de investimento\, eles parecem ser proprietários de longo prazo de empresas de qualidade que se acumulam ao longo do tempo [^7]\. [They've historically taken a 0% management fee, and 25% carry after a 6% return hurdle.](https://www8.gsb.columbia.edu/valueinvesting/sites/valueinvesting/files/files/Graham%20%26%20Doddsville%20-%20Issue%2018%20-%20Spring%202013_0.pdf 'Graham') Isso é incomum no setor de investimentos e demonstra o quanto eles estão confiantes em gerar retornos anuais [^8]\.

Como Li Lu é focado na China\, há menos entrevistas com ele do que com outros investidores famosos\. Graham de Longriver recentemente [translated a 9,000 word speech outlining Li Lu's investment philosophy,](https://www.longriverinv.com/blog/the-practice-of-value-investing-by-li-lu 'Longriver') que vou resumir abaixo [^9]\.

Li Lu discutiu quatro conceitos básicos de investimento de valor\: a diferença entre investir e especular\, círculos de competência\, temperamento do investidor e o que a pessoa comum pode fazer para aumentar a riqueza\. Descobri que a maioria desses pode ser incluída dentro de seus quatro conceitos\, que são\:

1. Ações representam participação parcial de um negócio

2. O mercado é um guia\, e cabe a você aceitá\-lo ou rejeitá\-lo

3. Investir é sobre probabilidade e uma margem de segurança

4. Construa um círculo de competência e mantenha\-se dentro dele

### Li Lu\: Ações representam participação parcial

O conceito de comprar uma ação como compra de propriedade na empresa é comum entre os seguidores do estilo de investimento de valor de Buffett\. Em vez de ver uma ação como um número\, Li Lu a vê como uma responsabilidade\. Isso contrasta com fundos hedge long\/short\, que negociam mais com catalisadores de sentimento e preço\, ou fundos quantitativos que negociam sabe\-se lá o quê [^10]\.

> as pessoas não tentavam mais prever os resultados futuros da Companhia das Índias Orientais\; elas simplesmente tentavam adivinhar o comportamento de outras pessoas que compravam e vendiam as ações\.

Li Lu discute a história do mercado de ações\, que foi criado inicialmente para permitir que as empresas captassem capital para financiar seu crescimento\. Depois\, aproveitou a natureza de jogo da humanidade\, para se tornar não apenas uma aposta no futuro da empresa\, mas uma aposta no que você acha que os outros pensam sobre o futuro da empresa\. Isso é semelhante ao [Keynesian beauty contest](https://en.wikipedia.org/wiki/Keynesian_beauty_contest 'contest') conceito\.

> Essa é a maior diferença entre investir e especular\: no final\, o resultado líquido de toda especulação é zero\. Claro\, haverá algumas pessoas que ganham por um pouco mais\; e outras \\\[que são tomadas como bobos\\\] sem nenhuma chance de enriquecer\. Mas com o tempo\, toda especulação termina em um resultado de soma zero\. Portanto\, devido ao foco no comportamento de curto prazo\, os especuladores não têm absolutamente nenhuma influência sobre o crescimento econômico ou os lucros da empresa\.

Ele faz uma distinção entre investir e especular\, colocando investidores quem prevê desempenho da empresa na primeira categoria\, e quem prevê como outros reagem na segunda categoria como especuladores\. Investidores se importam com os fundamentos da empresa e o longo prazo\, especuladores se importam com o sentimento e o curto prazo\. Na visão dele\, a maioria dos fundos de investimento atualmente seria classificada como especuladora\.

Discordo de Li Lu sobre a influência dos especuladores\, e acredito que especuladores podem influenciar o comportamento da empresa\, seja por meio de investimentos ativistas ou reuniões mais regulares de conferências de investidores\. Vemos empresas tomarem decisões o tempo todo que foram diretamente devido à pressão dos acionistas\, como [fire CEOs,](https://www.nytimes.com/2020/01/10/business/boeing-dennis-muilenburg-severance.html 'CEO') [divest businesses,](https://faculty.wharton.upenn.edu/wp-content/uploads/2005/11/Activist-Impelled.pdf 'Divest') ou [sell the company.](https://corpgov.law.harvard.edu/2019/10/11/recent-trends-in-shareholder-activism/ 'Sell')

Isso não diminui o ponto geral dele\, que **especular\, como ele define\, é soma zero\.** Quando você supera uma empresa por questões não relacionadas ao crescimento fundamental da empresa\, alguém do outro lado dessa negociação tem um desempenho inferior\. Se você tem retornos melhores que o mercado\, outra pessoa está tendo um dia pior\.

### Li Lu\: O mercado é um guia

> Mas\, na maior parte do tempo\, você pode simplesmente ignorá\-lo\. Mas quando o Sr\. Mercado fica extremamente agitado – seja animado ou deprimido – você pode usá\-lo para comprar e vender\.

Ele discute [the popular anecdote of Mr Market,](https://fs.blog/2013/11/mr-market/ 'Market') O que destaca como o mercado de ações pode ser visto como algo que grita um preço para você o tempo todo\. Cabe a você decidir quando comprar e vender\, e é melhor ignorar o preço de mercado na maior parte do tempo\. Você não tem pressa\; a atividade é o inimigo\.

> Quando você está na escola e ouve falar de investimento em valor\, acha que não deveria ser nada demais colocar em prática\. Mas assim que você começa a trabalhar\, percebe que existem pessoas reais do outro lado de toda transação\. \\\[\.\.\.\\\] elas são superiores a você em todos os aspectos e não se parecem nem um pouco com o Sr\. Mercado do Graham\. Então\, depois de um tempo\, depois de ser constantemente repreendido pelo seu chefe\, você vai sentir que o Sr\. Mercado e essas pessoas são todos melhores que você\. Você vai começar a ter dúvidas\.

Investir em valor é muito mais difícil na prática\, já que você faz menos operações\. Uma coisa é dizer que você é uma pessoa disciplinada\; outra é resistir a comprar opções na sua conta Robinhood quando você ouve que seus amigos ganharam \$10 mil em um dia só observando [r/wallstreetbets.](https://www.dailydot.com/debug/wall-street-bets-reddit-jartek/ 'Reddit') Quando todos ao seu redor ganham dinheiro rapidamente\, é quase impossível seguir uma estratégia menos empolgante\.

Isso fica mais fácil quando você adota a mentalidade do proprietário mencionada acima\. Se você comprasse ações com a mesma atitude que usou ao comprar uma casa\, seria mais diligente e equilibrado na hora de comprar\.

### Li Lu\: Probabilidade e margem de segurança

> A coisa mais importante em investir é prever o futuro\, mas o futuro é inerentemente imprevisível\. Investir\, portanto\, é sobre probabilidade e uma margem de segurança\.

Investir ser sobre probabilidade é um conceito com o qual a maioria dos profissionais concordaria\, independentemente do estilo\. Mesmo os melhores investidores têm uma taxa de acerto na faixa de 50\-60\%\, o que significa que eles estão errados muitas vezes [^11]\. Em vez de apostar 100\% em um único nome\, eles pensam em termos de investir em um portfólio de nomes\, avaliando cada posição de acordo com as chances de sucesso de cada empresa\.

O conceito de margem de segurança não é tão universal\, e é mais típico de investidores de valor\. Essa é a ideia de que\, para cada investimento que você faz\, deve fazê\-lo a um preço que ainda ofereça uma margem de proteção suficiente caso haja quedas inesperadas\. Se você conseguir encontrar margem de segurança suficiente em um investimento\, vale a pena considerar\. Se você não consegue margem de segurança suficiente\, não deve investir\.

### Li Lu\: Círculo de competência

Li Lu conta uma longa história sobre como começou a investir depois de ouvir Buffett falar [^12]\. Ele começou a ler mais textos de Buffett\, pesquisar empresas e visitá\-las no local sempre que podia\, mesmo quando tudo o que podia fazer era conversar com o segurança\. Ao fazer isso\, descobriu quatro lições para desenvolver um círculo de competência\:

> A primeira lição foi que ações representam participação parcial em um negócio

> O segundo ponto é que\, quando você começa a olhar para as coisas do ponto de vista dos proprietários\, seu entendimento sobre negócios será completamente diferente

> Quando analistas entram na nossa empresa\, a primeira coisa que fazemos é enviá\-los para estudar algumas empresas\. Pedimos que assumam que um tio que nunca conheceram antes faleceu e deixou o negócio para eles\. O que eles devem fazer\? Eles de repente herdam esse ativo\, mas não têm ideia do que é\. Você deve convocar uma reunião do conselho e participar da discussão\. Esse é o modelo mental que pedimos para eles usarem quando conduzem sua pesquisa\.

Popularizado por Buffett\, a ideia de um círculo de competência é que você deve desenvolver um entendimento profundo de uma indústria ou questão\. Você também deve entender onde estão os limites do seu conhecimento e não se sobrecarregar\.

Essas duas primeiras lições são semelhantes ao ponto anterior sobre ver as participações acionárias como participação parcial\. Independentemente do tamanho da sua participação na empresa\, Li Lu está dizendo que você deve se ver como um acionista integral\. Essa mentalidade vai te motivar a continuar querendo saber o máximo possível sobre a empresa e entender quais decisões são boas ou ruins para o futuro da empresa\. Gastar tanto tempo em um único nome naturalmente limita a quantidade de empresas que você pode analisar\, o que vai estreitar seu círculo de competência\.

> O terceiro ponto é que o conhecimento é realmente cumulativo\, mas você deve sempre manter a honestidade intelectual

Concordo novamente que isso é importante\, mas difícil de fazer\. Quando foi a última vez que você mudou de ideia sobre um assunto não trivial\?

> A última coisa é deixar sua paixão ser sua guia\. Não ouça o que os outros pensam de você\. Eles não têm nada a ver com você\. Aceite que seu círculo de competência será pequeno e não se preocupe com o resto\. Ganhar dinheiro não depende de quanto você sabe\; depende se o que você sabe é certo ou errado\. Se o que você sabe está certo\, você não vai perder dinheiro\.

Isso contrasta com o funcionamento prático de muitos outros fundos de investimento\, onde geralmente querem que analistas de investimento aumentem sua cobertura de nomes e setores de indústria ao longo do tempo\. É difícil dizer aos sócios limitados do seu fundo \(aqueles que lhe dão o capital para você investir\) que você não está fazendo nenhuma mudança na carteira e que você gosta dos nomes em que já está\. Se continuar assim por tempo suficiente\, eles vão se perguntar por que estão te pagando para não fazer nada\. Portanto\, para muitos fundos há um incentivo para negociar ativamente com nomes\, e quanto maior o conjunto de nomes você conhece\, melhor\. Isso funciona para alguns lugares\, e não é o estilo de Li Lu\.

### Li Lu\: Reflexões finais sobre investimento em valor

> essa profissão não exige que você seja especialmente inteligente\, nem que tenha um QI alto ou as melhores credenciais acadêmicas

Li Lu descreve atributos que fazem um investidor bem\-sucedido\, que são\:

1. A pessoa deve ser independente e não se importar com as avaliações dos outros

2. A pessoa deve ser objetiva e sempre disposta a aprender

3. A pessoa deve ter tanto extrema paciência quanto extrema determinação quando surgem grandes oportunidades

4. A pessoa deve se interessar por como os negócios funcionam

Levando em mente os conceitos centrais do investimento de valor acima\, essas características do investidor fazem sentido\. Para um fundo típico de longo ou vendido\, eles se preocupariam menos com \(3\)\. Um fundo quantitativo típico provavelmente se preocuparia menos com \(4\)\.

> O maior tabu para investidores é ser como Newton e ser seduzido pelo mercado\: comprar no pico mais quente do mercado e vender em seu momento mais deprimido\. Se você não participar da especulação e se ater estritamente a investir no que entende\, não vai perder dinheiro\.

> O melhor e mais importante é ter tempo suficiente para se compor\. Nossa sugestão para a pessoa comum é fazer apenas o que você entende e ficar longe de todo o resto\.

Dado seu histórico como investidor de valor de longo prazo\, não é surpresa que ele defenda o crescimento de riqueza lentamente por meio da capitalização ao longo do prazo\. Nem todos têm paciência suficiente para fazer isso\, porém\.

Investir em valor é uma forma de ganhar dinheiro\, e existem muitas outras formas que têm sido bem\-sucedidas por diferentes períodos de tempo\. [Renaisssance seems to print money,](https://en.wikipedia.org/wiki/Renaissance_Technologies 'Ren') por exemplo\, e eles não fazem nada remotamente relacionado ao investimento em valor discutido acima\. Se você decidir continuar com investimento em valor\, o histórico da Li Lu fala por si só\. Pense como um proprietário\, evite negociar só por negociar e saiba no que você é bom\.

## Concessões

[Efficiency vs Resilience.](https://en.wikipedia.org/wiki/O-ring_theory_of_economic_development 'O ring')

[Optionality vs Certainty.](https://nesslabs.com/optionality-fallacy 'Option')

Escrever seu post da newsletter conforme o horário marcado no fim de semana versus maratonar Peaky Blinders meio bêbado e depois ter que ficar acordado até tarde em um dia de semana [^13]\.

Na vida\, enfrentamos trocas o tempo todo\.

**Se alguém diz que não há troca por algo\, ou é ingênuo ou está tentando te vender algo\.** De qualquer forma\, provavelmente é melhor evitá\-los\.

Empresas funcionam eficientemente e não têm redundâncias\. Isso economiza custos\, até que as coisas quebrem\. Mas também não é possível ter backups para tudo\, já que será exorbitantemente caro\.

Deixar opções abre\, você tem flexibilidade\. Isso funciona até você perceber que viveu sua vida com todas as opções e nunca se contentou com nada\. Mas também não deve decidir um caminho sem ter um plano B\.

Em todas as decisões importantes que tomamos\, devemos\:

1. Aprenda quais são as trocas explícitas e implícitas\, e

2. Melhorar nosso processo para escolher entre eles

No primeiro\, escreva explicitamente o que você está abrindo mão\, como com um [decision journal,](https://fs.blog/2014/02/decision-journal/ 'FS') pode ser útil\. Fazer também pode [premortems](/writing/premortem 'pre')\. O ato de pensar completamente no cenário geralmente vai destacar preocupações das quais você só tinha vaga noção\.

Outra forma seria buscar conselhos de outras pessoas\, especialmente daqueles que tiveram que tomar decisões semelhantes em contextos semelhantes\. Eles poderão sinalizar preocupações ou arrependimentos importantes que tiveram\. Esse tipo de conselho é muito variável por natureza\, e pode variar de útil a realmente prejudicial\. O que pode ser arriscado para alguém pode ser seguro para outro\.

No segundo\, cabe a você decidir qual framework quer usar\. Posso falar sobre [optimal stopping theory](https://www.americanscientist.org/article/knowing-when-to-stop 'optimal')\, [game theory](https://plato.stanford.edu/entries/game-theory/ 'game')\, ou planejamento de cenários\, mas a maioria das pessoas vai encontrar algo que funcione para si\. Desde que você tenha uma estrutura e mantenha um registro\, deve ficar tudo bem\.

Melhorar tanto no Step 1 quanto no Step 2 levará a uma tomada de decisão melhor\.

Passei a acreditar que\, no curto prazo\, é mais fácil melhorar a etapa 1\, então estou trabalhando para acelerar esse processo mais rapidamente mantendo a eficácia\. É mais difícil melhorar a etapa 2\, que será um projeto de longo prazo para acompanhar e avaliar decisões ao longo do tempo\. O processo de melhorar ambas as etapas também vai te levar a entender melhor o que você valoriza\.

Enfrentamos trocas o tempo todo\, só não gostamos de pensar nelas\. Infelizmente\, esquecer delas não faz com que desapareçam\. Explicar explicitamente o que você está abrindo mão durante uma decisão importante ajudará a reduzir o arrependimento no futuro\.

## Outros

1. [A tale of two talebs.](https://medium.com/@allenfarrington/a-tale-of-two-talebs-1775dff3302b 'Taleb') Recomendo muito\, goste ou odeie Nassim Taleb\.
2. \"são as famílias de baixa renda que mais sofrerão com a Covid\-19\, e como tendem a gastar a maior parte de sua renda\, o impacto em suas rendas reduzirá a participação do PIB no consumo\.\" [Michael Pettis twitter thread on how imbalances in the economy will be resolved.](https://twitter.com/michaelxpettis/status/1253217553083707393 'Pettis')
3. ["While Microsoft made $100M it shrunk the \[encyclopedia\] market by over $600M. For every dollar of revenue Microsoft made, it took away six dollars of revenue from their competitors."](https://redeye.firstround.com/2006/04/shrink_a_market.html 'MSFT') Crédito [Brett Bivens](https://venturedesktop.substack.com/ 'Brett')
4. \"Long Bets foi fundada em 2002 como uma forma de fomentar previsões mais responsáveis sobre o futuro\.\" Este é o mesmo grupo que administrou a aposta Warren Buffett vs Hedge Fund\. [This post looks at predictions for 2020](https://medium.com/the-long-now-foundation/our-long-bets-and-predictions-about-02020-736cf08efcd6 '2020')
5. ["Can the teardrops that fall after reading bad science writing generate renewable electricity? Yes, they can."](https://eighteenthelephant.com/2020/02/12/can-the-teardrops-that-fall-after-reading-bad-science-writing-generate-renewable-electricity-yes-they-can/ 'teardrops')

[^1]: As pessoas diriam [machine learning is a subset of AI](https://towardsdatascience.com/clearing-the-confusion-ai-vs-machine-learning-vs-deep-learning-differences-fce69b21d5eb 'ML')\, vou usar os termos de forma intercambiável aqui por conveniência\, já que parece que os princípios se aplicam em ambas as áreas\; Scott os separaria\. \"A intenção do ML é permitir que as máquinas aprendam sozinhas usando os dados fornecidos e façam previsões precisas\.\"

[^2]: Crédito [Daniel McCarthy on twitter](https://twitter.com/d_mccar/status/1237738926086987777?s=20 'Daniel')

[^3]: As operações na nuvem aqui incluem treinamento do modelo de IA\, inferência de modelos\, transferência de dados

[^4]: PDF pág\. 6 sobre o 8K do quarto trimestre do ano fiscal de 2020\. Também note que\, para simplificar\, fiz o COGS wholeco\, que inclui o negócio de serviços profissionais menos lucrativo\. Se você pegar o COGS só por assinatura\, eles têm margens brutas de 80\%\.

[^5]: Ou talvez você só encontre e substitua o nome da empresa e os logos no deck\, quem sou eu para julgar\.

[^6]: Foi parte de uma resposta mais longa sobre como equilibrar tecnologia e negócios que merece um post próprio\, e farei isso no futuro\. A conclusão dele foi escolher entre 3 abordagens\: 1\) A tecnologia pode ditar os negócios se demonstrar melhorias em métricas acordadas 2\) Começar menos sexy\, mas preparar com o tempo 3\) Criar um espaço específico para experimentar\, como a regra dos 20\% do Google

[^7]: \"Abraçamos os princípios de investimento em valor de Benjamin Graham\, Warren Buffett e Charles Munger\, e hoje focamos principalmente em empresas de capital aberto na Ásia\, com ênfase na China\. Buscamos alcançar retornos superiores sendo proprietários de longo prazo de empresas de alta qualidade\, com substancial \"fosso econômico\"\, grande potencial de crescimento e administradas por pessoas de confiança\. Algumas de nossas participações datam da nossa fundação\, há vinte anos\.\"

[^8]: A maioria das empresas de investimento cobra uma taxa de administração sobre os ativos investidos com eles\, e depois uma taxa de desempenho sobre os retornos dos ativos\. Uma estrutura típica de taxas é \"2 e 20\"\, ou seja\, uma taxa de administração de 2\% e uma taxa de desempenho de 20\%\. Se você colocar \$1000 e crescer para \$1200\, assumindo que a taxa de administração é descontada dos valores do período final\, a taxa de administração seria de \$24 \(2\% \_ \_ \$1200 \- \$1000\)\)\. Compare isso com o modelo de honorários da Li Lu\, que só cobra taxas de desempenho após os primeiros 6\% de retorno\. Aqui não haveria taxa de administração\, e a taxa de desempenho seria de \$47 \(25\% \_ \(\$1200 \- \$1000 \- \(6\% \_ \$200\)\)\. É um segredo aberto que muitas empresas de investimento vivem das taxas fixas de gestão do crescimento de seus ativos sob gestão\, e não do desempenho\. O modelo de Li Lu seria mais benéfico para ele se ele acreditasse que pode gerar altos retornos\, e menos benéfico se tivesse um desempenho ruim\.

[^9]: Acredito que seja o mesmo discurso [previously translated on gurufocus,](https://www.gurufocus.com/news/997607/notes-from-li-lus-latest-speech-at-peking-university 'guru') e a versão do Graham parece mais completa\. Eu verifiquei \(muito\) brevemente a tradução e parece precisa\, mas obviamente não posso garantir totalmente a peça\. O original é [here](https://xueqiu.com/6026781624/137223946 'original')

[^10]: Um fundo de hedge long\/short é um estilo popular de fundo de investimento que compra \(compra\) em algumas empresas e protege isso vendendo \(vendendo\) outras\. Um fundo quantitativo é outro estilo popular que usa principalmente algoritmos para tomar decisões de investimento\. Sim\, provavelmente eles usam ML\.\.\.

[^11]: Não consigo encontrar a fonte dessa estatística\, e sabe\-se que até os melhores investidores acertam 50\-60\% das vezes\. Eles vencem estimando suas apostas adequadamente e fazendo seus vencedores contarem

[^12]: \"No passado\, minha compreensão do mercado de ações era basicamente que ele era cheio de vilões\. Mas o Sr\. Almoço Grátis \\\[Buffett\\\] não era nada parecido com eles\. Ele era muito inteligente e o que dizia era inteligente e perspicaz\. Eu conseguia entender seus princípios assim que os ouvia\. E sentia que o que ele fazia era algo que eu também podia fazer\.\" Estranhamente\, não há menção a Buffett em [this 1998 profile of Li Lu](https://observer.com/1998/05/tiananmen-square-to-wall-street-li-lu-hits-the-new-york-jackpot/amp/ 'Li Lu')\, então talvez a história seja marketing\?

[^13]: O autor gostaria de enfatizar que estes são exemplos hipotéticos\, abstratos\.
