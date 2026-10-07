---
title: "Ter fé no Critério Kelly para investimentos anjo"
description: "Uso da matemática para estimar o tamanho ideal do portfólio"
pubDate: 2020-12-02
category: Risk & Decision Making
tags: ['investing', 'risk', 'math']
heroImage: '../../../blog/2020_12_02_kelly/kel_7.webp'
featured: true
locale: 'pt-BR'
sourceSlug: 'kelly'
sourceHash: '360b60f1699a1f7679aa8e710a2d62b9ff39faaf7b217118a06c5a13e2b226cb'
---

## Concluições

1. O critério de Kelly é uma forma matemática de dimensionar seu portfólio\, embora tenha cuidado com suas suposições
2. HASH\.ai é facilitar simulações baseadas em agentes\; Eu tento modelar as taxas de falha de início

## 1\. Critério Kelly para o tamanho do portfólio

Sarah é uma aspirante a investidora anjo\. Seus amigos Nicholas\, Alyson e Chase têm uma ideia mágica de negócio envolvendo extermínio de pragas\, e Sarah acha que vai ser um grande sucesso\.

Sarah estava prestes a investir três economias de uma vida inteira nesse negócio\, quando seu outro grupo de amigos [^1] Seth\, Marc\, Emma e Amber apresentam a ela uma ideia igualmente empolgante envolvendo coelhinhos\.

Sarah percebe que tem múltiplas opções e não sabe o que fazer\. Ela vai consultar seu amigo mais velho Anthony\, que acompanha de perto o setor de investimentos\. Anthony diz que ela está no caminho certo – alocação de portfólio e pagamentos risco\/recompensa são a chave para se tornar uma investidora bem\-sucedida\. Ele também acrescenta que ela talvez queira ler sobre o [Kelly criterion,](https://www.princeton.edu/~wbialek/rome/refs/kelly_56.pdf 'Kelly') Uma fórmula para o tamanho das apostas\.

A fórmula Kelly foi desenvolvida por John Kelly no Bell Labs\. Ela requer algumas entradas e te devolve o **A porcentagem ideal do seu capital para apostar em algo\,** Assumindo que você queira maximizar retornos de longo prazo\. Postei uma derivação simplificada no apêndice\, e você também pode encontrá\-la [here](https://blogs.cfainstitute.org/investor/2018/06/14/the-kelly-criterion-you-dont-know-the-half-of-it/ 'derive') Ou no artigo original\.

![post](../../../blog/2020_12_02_kelly/kel_1.webp)

Eu sei que matemática é assustadora\, então vamos ilustrar com um exemplo\. Você quer saber quanto apostar em um cara ou coroa\, onde você ou dobra seu dinheiro ou perde a aposta\. Se você inserir os números\:

![post](../../../blog/2020_12_02_kelly/kel_2.webp)

Sim\, você leu certo\. Kelly diz que você deve evitar arriscar qualquer coisa\. Por quê\?

Como você não tem vantagem e o risco\/recompensa está dimensionado corretamente\, a melhor opção é não apostar\.

Agora\, imagine que o mesmo cara ou coroa paga 11x retorno \(1000\%\) na sua aposta\, com todo o resto permanecendo igual\. Se você inserir os números\:

![post](../../../blog/2020_12_02_kelly/kel_3.webp)

Kelly diz que você deve apostar 45\% do seu capital total\. Perceba que\, mesmo com odds tão atraentes\, você não está apostando todo o seu dinheiro [^2]\. Você também pode ver que\, em jogos onde pode perder toda a aposta\, você nunca aposta tudo a menos que acredite que tem 100\% de chance de ganhar\.

[Michael Mauboussin and Ed Thorp elaborate on the attractive features of the Kelly system:](http://www.capatcolumbia.com/MM%20LMCM%20reports/Size%20Matters.pdf 'Michael')

1. A chance de ruína é \"pequena\"\. Como o sistema Kelly é baseado em apostas proporcionais\, perder todo o seu capital é teoricamente impossível\, embora ainda haja picos de volatilidade
2. O sistema Kelly tem grandes chances de aumentar seu saldo mais rápido do que outros sistemas
3. Você tende a atingir um nível específico de ganhos no menor tempo médio possível

Como isso pode nos ajudar no lado do investimento anjo\? Teremos que fazer algumas suposições altamente simplificadoras [^3]\, mas Kelly pode nos ajudar a ter uma ideia de quanto alocar por investimento\.

Sabemos que Kelly recebe três inputs – nossa crença sobre qual é a probabilidade de ganhar\, a porcentagem de perda e a porcentagem de lucro\. [Correlation Ventures and Seth Levine](https://www.sethlevine.com/archives/2020/10/vc-fund-returns-are-more-skewed-than-you-think.html 'Seth') Tenho um gráfico interessante abaixo mostrando os retornos dos VCs ao longo do tempo\, e vou usar isso como base para minhas suposições\.

![post](../../../blog/2020_12_02_kelly/kel_4.webp)

Para simplificar\, vou considerar qualquer coisa que tenha retorno 10x \(900\%\) ou mais como vitória\, e todo o resto como uma derrota\. Pelo gráfico\, isso significa que ganhamos cerca de 5\% das vezes\. Vou simplificar ainda mais assumindo que perdemos 100\% da nossa aposta em uma perda\, e ganhamos esse lucro de 900\% com uma vitória\. Sob essas suposições iniciais\, obtemos\:

![post](../../../blog/2020_12_02_kelly/kel_5.webp)

Pois é\. Isso não é bom\. Sob nossas suposições atuais\, Kelly diz que investir em VC é um mau negócio\. Quando vi isso pela primeira vez\, fiquei surpreso e depois me perguntei como terminaria de escrever essa edição da newsletter [^4]\. A resposta que encontrei foi trapacear\. Muito\.

Em vez da taxa de vitória de 5\%\, digamos que investidores anjo entrem em um investimento acreditando que estão acima da média e que seus investimentos pelo menos vão render o dinheiro\. Eles acreditam que a probabilidade de vitória é maior que a taxa base\. Você não aposta em algo a menos que acredite que tem vantagem contra as probabilidades\.

Em outras palavras\, vamos ignorar toda essa parte \<1x no gráfico e assumir que nosso universo é apenas o resto\. Essa taxa de vitória de 5\% salta para cerca de 14\% [^5]\. Vamos manter todo o resto constante\. Sob essas novas premissas\, obtemos\:

![post](../../../blog/2020_12_02_kelly/kel_6.webp)

Pelo menos é algo com que podemos trabalhar\. Aguente as suposições por enquanto e voltaremos a elas depois\.

Para ver como podem ser nossos retornos\, vamos supor também que fazemos 100 desses investimentos seguidos\. Vamos rodar 1\.000 simulações de como um portfólio assim poderia ser\, ou seja\, imaginar 1\.000 universos onde investimos em 100 empresas sob as suposições acima\. [I'm using this Colab file here if you want to follow along](https://colab.research.google.com/drive/1YeMnl2QOQdCAGGxCDr2pfDk_HFgCh02D?usp=sharing 'Colab')

Não surpreendentemente\, nosso jogo manipulado mostra que estamos ganhando muito dinheiro\:

![post](../../../blog/2020_12_02_kelly/kel_7.webp)

Algumas coisas a serem observadas\, porém\. Veja as grandes quedas \(todas as quedas\) que acontecem\. Muitas carteiras perdem mais da metade do dinheiro até o final\. Os retornos apresentam picos enormes de volatilidade\.

Além disso\, corremos _mil_ simulações\. Embora os retornos grandes se destaquem no gráfico\, realmente não são muitos\. A maioria dos casos está toda esmagada perto da parte inferior\.

Para reduzir o risco\, muitas pessoas adotam a abordagem \"Fracionada de Kelly\"\, apostando uma porcentagem menor do valor recomendado pela Kelly\. Faremos isso aqui também\, simulando cenários em que apostamos apenas metade do recomendado \(2\%\)\.

Vamos analisar mais de perto a distribuição de retorno para ambos os casos\. É difícil de ver\, mas os gráficos de caixa mostram as faixas típicas de retorno do 25º percentil\, mediana e 75\. Começamos em \$100\:

![post](../../../blog/2020_12_02_kelly/kel_8.webp)

Se ignorarmos os casos atípicos\, podemos ver que o percentil 25 a 75 dos retornos para todas as simulações está em uma faixa muito menor\.

E se olharmos para a abordagem \"mais segura\"\, Half Kelly\, vemos que na maioria das vezes você tem retornos inferiores a 5x\.

![post](../../../blog/2020_12_02_kelly/kel_9.webp)

**A conclusão é que\, se você investe como anjo\, precisa de alta convicção\, provavelmente vai querer fazer muitos investimentos e investir apenas pequenas porcentagens do seu capital por vez\.** Mesmo assim\, a probabilidade do mítico retorno de 100x ainda é baixa\. Lembre\-se de que essa é a estratégia de aposta ideal\, e já manipulamos o jogo de várias formas\:

- Removemos uma grande parte dos perdedores
- Assumimos um resultado binomial
- Assumimos pagamentos fixos de ganhos e perdas
- Assumimos que as apostas ocorrem uma após a outra
- Achamos que poderíamos fazer muitas apostas

Nenhuma dessas é como é a vida real\; o que foi dito acima é uma grande simplificação\. Dito isso\, **podemos pelo menos usar a Kelly para reduzir o risco de ruína\.**

Se quiser investigar mais\, há um artigo de Vasily Nekrasov [here](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2259133 'paper') Esse tem um modelo muito melhor\, mas a matemática está além do meu entendimento\. O arquivo do Python Colab é [here](https://colab.research.google.com/drive/1YeMnl2QOQdCAGGxCDr2pfDk_HFgCh02D?usp=sharing 'colab') Se quiser brincar com as suposições da simulação base [^6]\.

### Para saber mais sobre o critério de Kelly\:

1. [The Kelly Criterion: Multiple Investment Opportunities by Christian Aichinger](https://greek0.net/blog/2018/04/17/kelly_criterion2/)
2. [The Kelly Criterion: You Don’t Know the Half of It by Alon Bochman](https://blogs.cfainstitute.org/investor/2018/06/14/the-kelly-criterion-you-dont-know-the-half-of-it/)
3. [Python Risk Management: Kelly Criterion by Lester Leong](https://towardsdatascience.com/python-risk-management-kelly-criterion-526e8fb6d6fd)
4. [Practical Implementation of the Kelly Criterion by Andrea Carta and Claudio Conversano](https://www.frontiersin.org/articles/10.3389/fams.2020.577050/full)
5. [What AngelList Data Says About Power-Law Returns In Venture Capital by AngelList](https://angel.co/blog/what-angellist-data-says-about-power-law-returns-in-venture-capital)

## 2\. Uso de HASH\.ai para simular taxas de sobrevivência da empresa

Vamos passar de um modelo cheio de suposições para outro modelo cheio de suposições\. Recentemente ouvi falar da empresa [HASH.ai](https://hash.ai/ 'hash')\, que permite \"construir simulações multiagente em minutos\.\" Com isso\, eles querem dizer criar múltiplos objetos que possam interagir entre si e então ver o que acontece\. Você pode ler mais sobre modelagem baseada em agentes [here](https://hash.ai/blog/what-is-agent-based-modeling 'hash')

![post](../../../blog/2020_12_02_kelly/kel_10.webp)

Queria brincar com a ferramenta [^7]\, simulando algumas das suposições que fizemos nas seções anteriores\. Alguns motivos pelos quais investir em VC é difícil são porque muitas empresas fracassam ou não crescem rápido o suficiente em relação às expectativas\. Vamos modelar algumas empresas crescendo em uma economia\.

Novamente\, vou simplificar as suposições\:

- Sabemos as taxas médias de sobrevivência das empresas anualmente\. Eu abuso da probabilidade para supor uma taxa diária de sobrevivência
- Com base nisso\, também deduzo uma taxa diária de falha
- Também conhecemos as taxas médias de crescimento da receita da empresa anualmente\. A partir disso\, infiro uma taxa de crescimento diária pouco eficiente

![post](../../../blog/2020_12_02_kelly/kel_11.webp)

Coloquei tudo isso em um projeto HASH\.ai\, modificando um dos templates deles\. Foi preciso muita ajustagem\, já que muitos arquivos estão em Javascript e\.\.\. Eu não sei Javascript\. Mas acho que consegui fazer funcionar na maior parte do tempo no final [^8]\.

O modelo simula empresas como caixas verdes\, crescendo em altura a cada dia\, com a altura representando o tamanho da empresa\. Em qualquer período\, há a chance de a empresa falhar\, representada pela caixa queimando em chamas [^9]\. Podemos ver quantas empresas sobrevivem por longos períodos\. Aqui está uma amostra\:

![post](../../../blog/2020_12_02_kelly/kel_12.webp)

Sob as suposições atuais\, houve muito mais sobreviventes do que eu imaginava\, embora tenha demorado muito até vermos empresas 100x\. Provavelmente daria para voltar e ajustar as suposições\.

HASH\.ai também permite que você faça gráficos de estatísticas ao longo do tempo\. Meu modelo atual mostra um estado constante de sobreviventes vs fracassos\.

![post](../../../blog/2020_12_02_kelly/kel_13.webp)

Novamente\, isso foi só por diversão\, e a maioria das suposições precisa ser ajustada\. O modelo final é [here](https://core.hash.ai/@leonlinsx/wildfires-regrowth-3/main 'model') Se quiser brincar com isso\. Gostaria de ver alguém criar um modelo mais sofisticado de crescimento de startups\.

## Outros

1. [Unit economics of vending machines](https://thehustle.co/the-economics-of-vending-machines/ 'econs')
2. [Online game networking explained](https://www.pcgamer.com/netcode-explained/ 'netcode')
3. [What we can learn from War and Peace and a napkin about risk.](https://refractor.substack.com/p/the-story-range? 'refractor')
4. [American PhDs are failing at start-ups](https://marginalrevolution.com/marginalrevolution/2020/12/american-ph-ds-are-failing-at-start-ups.html 'phd')
5. [This isn't Sparta](https://acoup.blog/2019/08/16/collections-this-isnt-sparta-part-i-spartan-school/ 'sparta')

## Apêndice

![post](../../../blog/2020_12_02_kelly/kel_14.webp)

[^1]: Sarah está arrasando no departamento de amigos

[^2]: Também há o ponto não relacionado de que\, se você vir probabilidades tão atraentes\, provavelmente está sendo enganado

[^3]: Quero enfatizar novamente o quanto estamos simplificando aqui\. Por exemplo\, a iliquidez dos investimentos anjo é um grande problema\, já que você não tem uma natureza de aposta repetida e contínua que rodamos mais tarde nas simulações\. Além disso\, um comentário à parte\: eu poderia facilmente ter errado qualquer uma das contas\, por favor me corrijam se virem erros\.

[^4]: Planeje com antecedência\, dizem\.\.\.

[^5]: 5\% dividido por \(100\% menos 64\%\)

[^6]: Você vai notar que pequenos ajustes na probabilidade de ganhar a partir de onde ela está atualmente alteram drasticamente a porcentagem de aposta sugerida e os retornos previstos

[^7]: Ênfase no jogo\. Meu modelo final é super instável\.

[^8]: Você vai notar referências a árvores\, incêndios e mais no código\, que é remanescente do modelo original que simulava incêndios florestais\.

[^9]: Acho que foi intencional\; não consegui descobrir como mudar muitos dos recursos\.
