---
title: "Nem tudo é uso de informação privilegiada"
description: "As ferramentas que investidores profissionais utilizam"
pubDate: 2020-06-17
category: Investing
tags: ['data']
heroImage: '../../../blog/2020_06_17_data/data_9.webp'
locale: 'pt-BR'
sourceSlug: 'data'
sourceHash: 'b716115438b8c73071627a4fbd38849089af6c74f2ff19a81e3e14aa975d6a5d'
---

## Mensagem

É improvável que você tenha uma vantagem em informação como investidor de varejo em relação a um profissional\; você deve encontrar vantagem em outro lugar

## Uso de dados em investimentos

Na semana passada\, analisamos [how companies use machine learning to take data, process it, and come to a conclusion.](/writing/ml 'ML')

Esta semana\, vamos analisar um processo mais voltado para o ser humano\. Vamos explicar como analistas de uma empresa de investimentos obtêm dados\, os analisam e formam uma tese de investimento\. Com investidores [spending >$30bn on data](https://www.ft.com/content/222855de-4fbf-11e9-9c76-bf4a0ce37d49 'spend')\, para onde todo esse dinheiro vai\?

Vou fazer isso de forma tradicional [long/short fundamental hedge fund](https://en.wikipedia.org/wiki/Long/short_equity 'LS') ponto de vista\, em vez de uma empresa quantitativa [^1]\. Para conveniência\, também vou discutir isso sob a perspectiva de uma empresa americana\, embora o processo geral abaixo se aplique internacionalmente\.

Meu objetivo é que você\, como investidor de varejo\, tenha uma melhor compreensão da vantagem que os profissionais têm e do que isso implica na vantagem que você pode ter [^2]\.

### Dados públicos

Empresas de capital aberto [have to file financial statements regularly with the SEC.](https://www.sec.gov/edgar.shtml 'SEC') Esses estão disponíveis publicamente tanto nas páginas de relações com investidores da empresa quanto nas páginas de relações com investidores da empresa [SEC Edgar](https://www.sec.gov/edgar/searchedgar/companysearch.html 'Edgar') para você procurar\.

As empresas também realizam chamadas regulares de resultados para cada grande anúncio de resultados\, às quais qualquer pessoa pode acessar [^3]\. As transcrições das chamadas às vezes podem ser encontradas nas páginas de relações com investidores também\, ou em sites como [Seeking Alpha.](https://seekingalpha.com/earnings/earnings-call-transcripts 'SA') No entanto\, eles podem ser mais difíceis de localizar do que os demonstrativos financeiros\.

As empresas geralmente divulgam notícias por meio de [PR newswire](https://prnewswire.mediaroom.com/about-pr-newswire 'PR') além de postá\-las em seu próprio site\. Essas notícias podem ser os documentos financeiros mencionados acima ou eventos especiais\, como aquisições e mudanças de gestão\. As notícias são distribuídas via agência de relações públicas para outros sites de notícias\.

Além dos dados públicos mencionados acima\, um analista passaria um tempo consultando o Twitter\, pesquisando no Google ou lendo o reddit\. Eles compilam todas essas fontes primárias para formar uma opinião sobre investir ou não na empresa\.

Essa é uma parte do processo de pesquisa de investimentos\, a descoberta e o uso de informações públicas disponíveis que todos também podem fazer\. A partir do que foi dito acima\, você já tem dados suficientes para construir um modelo financeiro da empresa\, analisar tendências e formar uma tese de investimento\. Na verdade\, muitos investidores de varejo nunca vão além dessa parte e ainda assim se saem bem\. Como já mencionei antes\, existem muitas maneiras de ter sucesso no investimento\.

![post](../../../blog/2020_06_17_data/data_1.webp)

### Acesso a dados públicos

Então\, se isso é tudo o que é necessário\, por que tantas outras empresas existem para fornecer informações aos investidores\? Como a Bloomberg fabrica [$20k a year from a single subscription?](https://www.vox.com/2020-presidential-election/2019/12/11/21005008/michael-bloomberg-terminal-net-worth-2020 'Bloomberg')

Bem\, acontece que\:

1. Obter dados diretamente do SEC Edgar é um grande desafio
2. As pessoas sempre querem mais dados\, pois acreditam que mais dados é melhor
3. Há muitos outros dados privados que você pode comprar

Nesta seção vou discutir o primeiro ponto\, o da experiência do usuário\.

Digamos que você queira olhar rapidamente para a receita de uma empresa ao longo do tempo\. Se você fizesse do jeito tradicional no Edgar\, teria que procurar pela empresa\, resultando em uma página como esta\:

![post](../../../blog/2020_06_17_data/data_2.webp)

Você então teria que procurar cada arquivo que quisesse\, baixar todos e copiar os dados para uma planilha [^4]\. Depois de limpar os dados e adicionar linhas para fazer os cálculos ano a ano\, você finalmente obteria as tendências que queria\.

Isso foi muito trabalho por muito pouco retorno\, por isso existem empresas como Bloomberg\, FactSet e Thomson\. Eles coletam dados financeiros e os têm facilmente acessíveis dentro da plataforma\.

Todo aquele trabalho que você fez para encontrar a receita de uma empresa\? O FactSet tem isso disponível para todas as empresas abertas\:

![post](../../../blog/2020_06_17_data/data_3.webp)

Claro\, os dados armazenados nem sempre são perfeitos [^5]\. No entanto\, para todas as vezes em que você precisa de algo rápido para consultar\, plataformas que já fizeram todo o trabalho em um formato fácil de digerir são inestimáveis\. Você não precisa gastar horas extraindo dados quando eles estão disponíveis com apenas alguns toques de teclas\. Esse fator de conveniência é uma das razões pelas quais as plataformas podem cobrar uma base de assinantes fixa [^6]\, embora disruptores como [Koyfin](https://www.koyfin.com/ 'koy') estão tentando enfraquecê\-los\.

Também existem empresas como BamSEC e Last10K\, que facilitam a localização dos registros\. Por exemplo\, o BamSEC categoriza diferentes tipos de registros juntos\, mostra os títulos dos registros e permite que você encontre rapidamente edições anteriores dos registros\. Essas empresas não têm tantos recursos quanto as plataformas acima\, mas ainda assim economizam tempo para um analista\.

![post](../../../blog/2020_06_17_data/data_4.webp)

### Acesso a dados de pesquisa do lado da venda

Já falamos sobre a experiência do usuário\, agora vamos discutir os pontos sobre obter mais dados e pagar por eles\.

Além de fornecer dados financeiros agregados sobre empresas\, as plataformas Bloomberg etc também fornecem estimativas de pesquisa do lado da venda\.

Como lembrete\, esses pesquisadores são pessoas de bancos de investimento que publicam relatórios sobre a empresa\. Geralmente\, são essas as pessoas mencionadas quando as notícias dizem \"um analista rebaixou uma empresa para uma venda\" ou \"bancos aumentam a meta de preço de uma empresa\.\" Pesquisas do lado vendedor criam seus próprios modelos financeiros com estimativas para futuras contas financeiras da empresa\, supostamente usando o modelo para chegar a uma meta de preço [^7]\.

Muitos investidores gostam de ver esses números do lado da venda para ter uma ideia de onde está o consenso do mercado\. Por exemplo\, se a média das estimativas do lado da venda para a receita do próximo ano for de \$100\, mas você acha que será de \$1000\, você está prestes a se divertir muito ou muito mal\.

Se você é um investidor profissional\, sempre pode simplesmente enviar um e\-mail para os bancos para obter a pesquisa deles [^8]\. Se você realmente quisesse\, poderia compilar todos esses PDFs e Excel juntos e fazer o benchmark você mesmo\.

Obviamente\, ninguém realmente quer fazer isso [^9]\, então os pesquisadores fornecem esses dados às plataformas\, que então os mostram para a comunidade de investidores\. Se você quiser um resumo rápido de onde está o consenso do lado da venda\, isso também está disponível em alguns clichões\.

![post](../../../blog/2020_06_17_data/data_5.webp)

### Acesso à gestão da empresa

Muitos investidores avaliam empresas com base na qualidade de suas equipes de gestão\. Para facilitar isso\, tanto as empresas quanto as pesquisas do lado vendedor organizam conferências regulares para investidores\. A intenção dessas conferências é que a gestão encontre os investidores\, explique a estratégia da empresa aos novos investidores substituindo todos os que foram demitidos\, e responda a perguntas\.

Os investidores podem atualizar seus modelos financeiros ou visão sobre a empresa com base nessas reuniões com a gestão\. Por exemplo\, se uma equipe de gestão teve uma resposta ruim à sua pergunta\, você pode ter interesse em vender a descoberto na ação\.

\"Espera\, isso parece uso de informação privilegiada\"

Não\, não é\. Você acharia que a conferência anual de acionistas do Buffett\, [attracting 40k people yearly](https://www.investopedia.com/articles/investing/121715/how-attend-berkshire-hathaways-annual-meeting.asp 'Buffett')\, é uso de informação privilegiada\? Se não\, o que torna as conferências acima diferentes\? Só porque você não é convidado para uma festa\, não significa que seja ilegal\. Existem regras que regem o que a administração pode dizer\, mas essa prática já acontece há muito tempo\.

![post](../../../blog/2020_06_17_data/data_6.webp)

### Especialistas do setor

Investidores também têm interesse em conversar com funcionários dos setores que estão pesquisando\. Por exemplo\, se eu estiver tentando entender como a receita de publicidade no Facebook pode ser\, gostaria de conversar com grandes compradores de anúncios no Facebook\. Se eles estiverem mais otimistas em relação ao produto\, isso pode ser um sinal positivo\.

[Expert network firms like GLG, AlphaSights, Third Bridge](https://www.forbes.com/sites/jonyounger/2020/02/12/the-global-expert-network-business-is-growing-fast-meet-inex-one/#435336b2f257 'GLG') existem para ajudar investidores a encontrar essas pessoas\. Essas empresas são pagas para conectar investidores com especialistas do setor\; os consultores também são pagos pelo tempo deles\. Você se surpreenderia com quantos ex\-executivos fazem esse tipo de trabalho no tempo livre\.

\"Espera\, isso parece uso de informação privilegiada\"

Não\, não é\. Se você tivesse interesse em investir em uma empresa de saúde\, acharia que perguntar aos seus amigos médicos sobre a empresa é uso de informação privilegiada\? Se não\, por que o que foi dito acima deveria ser diferente\? Só porque você não pode pagar o intermediário\, não significa que seja ilegal [^10]\.

![post](../../../blog/2020_06_17_data/data_7.webp)

### Dados da indústria

Por fim\, investidores também estão usando \"dados alternativos\" para prever melhor os resultados das empresas\. Por exemplo\, se você estava interessado em saber o desempenho de um aplicativo móvel\, talvez se interessasse pelas estatísticas de downloads de aplicativos daquela empresa\. Se você se interessava por vendas em e\-commerce\, talvez se interessasse por dados de cartão de crédito de um setor\. Se você quisesse monitorar o peso dos caminhões para estimar se uma empresa estava fazendo mais vendas \(caminhões mais pesados\)\, existe uma empresa para isso [^11]\.

Tem um [large market of sellers for such data](https://alternativedata.org/data-providers/ 'mkt')\. Empresas como AppAnnie\, SensorTower e QuestMobile são bem conhecidas por fornecer dados de aplicativos\. Empresas como Earnest Research e Second Measure também são conhecidas por fornecer dados de cartão de crédito\.

\"Espera\, isso parece uso de informação privilegiada\"

Sair e contar clientes em uma loja seria ilegal\?

![post](../../../blog/2020_06_17_data/data_8.webp)

### O que isso significa para o investidor varejista

Analisamos tanto os dados públicos quanto privados que um investidor fundamental típico poderia usar\. O que isso significa para você como investidor de varejo\?

Se você acredita que sua vantagem de investimento foi ter mais informações sobre a empresa do que outras pessoas\, precisa acreditar de forma credível que seu processo de pesquisa foi mais exaustivo do que o anterior\. Alternativamente\, que seu processo de pesquisa foi diferente o suficiente e usando fontes diferentes que um profissional comum usaria\.

Vamos passar por alguns exemplos\.

Se você acredita que sua vantagem foi um artigo de jornal citando como a gestão estava animada com um novo produto\, teria que argumentar que a gestão ainda não discutia isso com investidores há muito tempo\.

Se você acredita que sua vantagem foi o dado de download do aplicativo que viu no Twitter\, teria que argumentar que os investidores ainda não tinham acesso a esses dados antes de você\.

Se você acredita que sua vantagem era aquele parente especialista do setor\, teria que argumentar que eles conhecem o setor melhor do que as pessoas com quem os profissionais estão conversando\.

Para deixar claro\, todos os cenários acima podem ser verdadeiros\. Talvez a gerência tenha mudado de ideia recentemente\, os investidores tenham visto\, mas não se importado\, com os dados do aplicativo\, ou os especialistas do setor não fossem tão especialistas assim\.

Meu ponto aqui não é dizer que é impossível\, mas que você deve estar ciente de qual é a concorrência e o que isso implica na vantagem que você precisa ter\.

Por exemplo\, se você encontrou uma pequena empresa que tem um conjunto de dados útil\, mas ainda não está vendendo para investidores\, isso pode ser uma fonte de vantagem\.

Se você contratasse pessoas para fazer trabalhos manuais de base [counting store traffic and taking pictures of receipts](https://www.qsrmagazine.com/fast-food/luckin-coffee-faces-fraud-allegations-anonymous-report 'luckin') Em vez de depender dos dados do cartão de crédito\, isso pode ser uma fonte de vantagem\.

Se você fizesse visitas anônimas às fábricas da empresa para ver o quão movimentadas estavam\, isso poderia ser uma fonte de diferença\.

O que você precisa fazer é encontrar as coisas que um profissional normal relutaria em fazer\. Em um mundo onde profissionais têm acesso a mais recursos do que você\, você precisa buscar vantagens nas áreas menos desejáveis\. Veja o gráfico abaixo e identifique as lacunas\.

![post](../../../blog/2020_06_17_data/data_9.webp)

[^1]: Não tenho experiência em uma empresa quantitativa\, então não posso falar sobre isso pessoalmente\. Eu conheço quants [pay for order flow though,](https://www.institutionalinvestor.com/article/b1m2p1cv68bx56/Twitter-Freaked-Out-Over-Robinhood-Selling-Its-Trade-Flow-But-the-App-and-Others-Have-Been-Doing-It-for-Years 'order') E isso provavelmente está incluído no número de 30 bilhões de dólares\. Separadamente\, note que uma firma de investimentos como um fundo de hedge é diferente de um banco de investimento\; a maioria dos analistas de investimentos faz trabalhos muito diferentes dos banqueiros de investimento\. [Sellside equity research is the role most similar to a hedge fund analyst, but researchers don't actually invest money.](/writing/time 'Sellside')

[^2]: Vantagem aqui se refere à vantagem relativa que você tem contra sua concorrência\. Discutimos [why this was important in investing last month.](/writing/relative_billionaire 'edge') Um agradecimento ao Barak Paz por me incentivar a escrever sobre isso baseado em uma conversa que tivemos\.

[^3]: Mas geralmente não faz perguntas\. Algumas empresas raras deixam o público fazer perguntas\; na maioria das vezes\, as perguntas vêm de pesquisas do lado vendedor \(não de analistas de investimento do lado comprador\)

[^4]: É ainda pior se você puxa dados de 8Ks em vez de 10Q\/Ks\. Repare que não há títulos porque a SEC gosta de ver você sofrer\.

[^5]: Grande parte do banco de investimento é realmente baixar os dados e depois fazer os ajustes necessários para \"refletir com precisão\" a empresa\. Aqui me referindo corretamente ao que seu chefe quiser mostrar\.

[^6]: Mas esse não é o único motivo\. A Bloomberg tem um senso de comunidade\, há uma situação de sinalização de status\, e desbloquear mensagens diretas é útil\. Byrne Hobart entra em mais detalhes sobre isso [here](https://marker.medium.com/why-its-hard-to-kill-the-bloomberg-terminal-61073482e496 'Byrne')

[^7]: Se eles têm um preço\-alvo em mente e depois ajustam os números para ajustar\, ou o contrário\, deixo você decidir\. Note que essa crítica pode se aplicar tanto a investidores do lado da venda quanto do lado da compra

[^8]: Investidores de varejo estão praticamente sem sorte aqui\. Normalmente\, você precisa ser cliente do banco e fazer operações por meio deles para que eles se importem\. Isso entra no modelo de negócios da pesquisa do lado da venda\, que está fora do escopo atualmente\.

[^9]: A menos que você seja um banqueiro de investimentos que recebe ordens do chefe\, caso em que você passa dias digitando manualmente números de um conjunto limitado de PDFs porque seu banco está limitado a pesquisas de outros bancos\. E aí você precisa ajustar orçamentos manualmente porque alguns números do lado da venda estão desatualizados ou usando suposições incorretas\. Sim\, isso acontece o tempo todo\. Sim\, é basicamente perda de tempo\. Trabalho glamouroso\, banco\.

[^10]: No entanto\, isso pode ficar ainda mais obscuro\. Black Edge\, um livro sobre o suposto uso de informação privilegiada na SAC\, discute aqui o potencial de abuso\. Esses chats deveriam ser monitorados pela conformidade\. Já houve ocasiões em que o investidor forma uma \"amizade\" com o especialista do setor e depois começa a pedir informações materiais não públicas\.

[^11]: Não consigo encontrar a empresa de imediato\, embora saiba que já li sobre isso em algum lugar\. Acho que eles usavam dados de câmeras para fotografar caminhões e ver o quão perto eles estavam da estrada\. Quanto mais perto\, mais pesado\, o que implica mais vendas\.
