---
title: "Valores P - você (e eu) estamos errando"
description: "O que realmente significa um valor p"
pubDate: 2019-09-04
category: Risk & Decision Making
tags: ['math']
heroImage: './p_1.webp'
locale: 'pt-BR'
sourceSlug: 'pvalue'
sourceHash: '4a1fb3af69e0e255c81d9e518a885d55d00cff57669f82853377e51b1475ee32'
---

A maioria de nós já estudou sobre valores p em uma aula de Estatística em algum momento\. A maioria de nós acha que entendeu o suficiente naquela época\; afinal\, passamos na disciplina\. A maioria de nós está muito errada\.

Devido ao uso indevido generalizado do valor p\, [some scientists are speaking out against the application of p values in research](https://www.nature.com/articles/d41586-019-00857-9 'against p values')\:

> Não estamos pedindo uma proibição dos valores P\. Nem dizendo que eles não podem ser usados como critério de decisão em certas aplicações especializadas \(como determinar se um processo de fabricação atende a algum padrão de controle de qualidade\)\. E também não estamos defendendo uma situação de \'vale tudo\'\, na qual evidências fracas de repente se tornam críveis\. Na verdade\, e em linha com muitos outros ao longo das décadas\, estamos pedindo a interrupção do uso dos valores P de forma convencional e dicotômica — para decidir se um resultado refuta ou apoia uma hipótese científica

Os autores estão pedindo para mudar a percepção dos valores p como a \'única coisa\' que determina se o resultado da pesquisa é aceito ou não\. Eles descrevem sua justificativa e também apresentam algumas alternativas\, que abordarei em breve\.

Mas\, primeiro\, para entender melhor o que eles defendem\, devemos refrescar a memória [what p values are](https://www.nature.com/articles/d41586-019-00874-8 'p values') [^1]\:

> uma medida de quão surpreendente é um resultado\, considerando as suposições sobre um experimento\, incluindo que não existe efeito\. Se um valor P está acima ou abaixo de um limiar arbitrário que demarca a \'significância estatística\' \(como 0\,05\) determina se as hipóteses são aceitas\, artigos são publicados e produtos são levados ao mercado\.

Então fazemos uma conta em torno dos nossos resultados\, obtemos um número X e então rejeitamos nossa hipótese nula se nosso número X for \<0\,05\, implicando credibilidade para nossa hipótese alternativa [^2]\. O processo em si parece mecânico\, mas até um pouco compreensível\. O problema vem de interpretar o que acabamos de fazer\. X é a probabilidade de você estar cometendo um erro ao rejeitar a hipótese nula\? X é a probabilidade de você estar errado ao aceitar a hipótese alternativa\? 1 \- X é a probabilidade de você estar certo\?

Nenhuma das interpretações acima está correta\, mostrando como estatísticas podem ser não intuitivas e por quê [not even scientists for meta-science can explain what p values mean intuitively](https://fivethirtyeight.com/features/not-even-scientists-can-easily-explain-p-values/? 'easily explain')\:

> Queremos saber se os resultados estão corretos\, mas um valor p não mede isso\. Ele não pode dizer a magnitude de um efeito\, a força da evidência ou a probabilidade de que a descoberta tenha sido resultado do acaso\.

> Então\, que informações você pode extrair de um valor\-p\? A explicação mais direta que encontrei veio de Stuart Buck\, vice\-presidente de integridade de pesquisa da Fundação Laura e John Arnold\. Imagine\, ele disse\, que você tem uma moeda que suspeita estar inclinada para cara\. \(Sua hipótese nula é então que a moeda é justa\.\) Você joga 100 vezes e tem mais cara do que coroa\. O valor\-p não vai dizer se a moeda é justa\, mas vai indicar a probabilidade de você conseguir pelo menos tantas caras quanto se a moeda fosse justa\. É só isso — nada mais\.

Importante\, seu valor p é a probabilidade de obter o resultado que você tem\, _sob a hipótese nula assumida_\. Se sua hipótese nula estivesse correta\, você só teria obtido o resultado que obteve em X\% dos experimentos\. Como X é um número baixo\, você assume que é improvável que a hipótese nula esteja correta e a rejeita\. Isso não indica a probabilidade de obter o resultado que você tem _quando não assumindo a hipótese nula_\.

Vamos supor que temos um experimento para ver se a altura média de um grupo de pessoas é 0\. Rejeitaríamos nossa hipótese nula com um valor p muito baixo\, já que obviamente a altura de todo mundo é \>0\. No entanto\, isso não nos diz nada sobre a chance de obter a altura média que calculamos nesse \'estado verdadeiro do mundo\'\. Isso apenas nos diz que havia uma baixa probabilidade de termos alcançado a altura média que tivemos\, _se a altura média fosse 0_ [^3]\.

Claramente\, os valores p são mais sutis do que o simples sim\/não que a maioria das pessoas \(eu incluso\) acreditava [^4]\. Os autores do primeiro texto continuam afirmando\:

> Vamos deixar claro o que deve parar\: nunca devemos concluir que não há \'diferença\' ou \'nenhuma associação\' só porque um valor P é maior que um limiar como 0\,05 ou\, de forma equivalente\, porque um intervalo de confiança inclui zero\. Também não devemos concluir que dois estudos conflitam porque um teve um resultado estatisticamente significativo e o outro não\.

> Pesquisas com centenas de artigos descobriram que resultados estatisticamente não significativos são interpretados como indicando \'nenhuma diferença\' ou \'nenhum efeito\' em cerca de metade dos casos

Resultados estatísticos não significativos não significam a mesma coisa que ausência de efeito\. Na verdade\, os autores preferem evitar o uso de \'estatisticamente significativo\'\:

> Concordamos e pedimos que todo o conceito de significância estatística seja abandonado\.

A razão deles para isso é que essa designação de significância sim\/não é uma falsa dicotomia\:

> O problema é mais humano e cognitivo do que estatístico\: o segmento dos resultados em \'estatisticamente significativo\' e \'estatisticamente não significativo\' faz as pessoas pensarem que os itens atribuídos dessa forma são categoricamente diferentes \\\[\.\.\.\\\] Uma razão para evitar essa \'dicotomania\' é que todas as estatísticas\, incluindo valores P e intervalos de confiança\, naturalmente variam de estudo para estudo\, e frequentemente o fazem de forma surpreendente\. Na verdade\, a variação aleatória sozinha pode facilmente levar a grandes disparidades nos valores P\, muito além de cair apenas para um dos lados do limite de 0\,05\.

Isso faz sentido para mim\, mas parece ser uma batalha difícil\. Ao lidar com decisões complicadas\, as pessoas querem heurísticas simples para usar\, e valores p oferecem uma forma fácil de justificar algo

Os autores também discutem alguns pontos a serem levados em mente ao usar intervalos de confiança [^5]\:

> Primeiro\, só porque o intervalo fornece os valores mais compatíveis com os dados\, dadas as suposições\, isso não significa que valores fora dele sejam incompatíveis\; eles são apenas menos compatíveis\.

> Segundo\, nem todos os valores internos são igualmente compatíveis com os dados\, dadas as suposições\.

> Terceiro\, assim como o limiar de 0\,05 de onde veio\, o padrão de 95\% usado para calcular intervalos é uma convenção arbitrária\.

> Por último\, e mais importante de tudo\, seja humilde\: as avaliações de compatibilidade dependem da correção das suposições estatísticas usadas para calcular o intervalo\.

E concluem com sua visão de como seria um mundo sem ênfase única nos valores p\:

> Como será a aposentadoria da significância estatística\? Esperamos que as seções de métodos e a tabulação de dados sejam mais detalhadas e nuançadas\. Os autores enfatizarão suas estimativas e a incerteza nelas — por exemplo\, discutindo explicitamente os limites inferior e superior de seus intervalos\. Eles não dependerão de testes de significância\. Quando os valores P forem reportados\, eles serão dados com precisão sensata \(por exemplo\, P \= 0\,021 ou P \= 0\,13\) — sem adornos como estrelas ou letras para denotar significância estatística e não como desigualdades binárias \(P \< 0\,05 ou P \> 0\,05\)\. As decisões para interpretar ou publicar resultados não serão baseadas em limiares estatísticos\. As pessoas passarão menos tempo com softwares estatísticos e mais tempo pensando\.

Como já escrevi antes\, [beliefs are tricky](/writing/why 'belief')\, mesmo que você seja um firme crente na Ciência\. A experimentação é uma parte fundamental de como o processo científico funciona\, e entender como interpretar resultados é um componente significativo disso\. O mal\-entendido dos valores p levou a equívocos sobre estudos quando relatados nas notícias\. Infelizmente\, não vejo isso mudando tão cedo\, já que é muito mais fácil interpretar valores p como algo sim\/não\. Não sei se a solução é reduzir a importância dos valores p\, mas estar mais atento ao uso incorreto deles é útil\.

[^1]: O artigo da descrição abaixo também resume os principais argumentos do artigo de opinião inicial de Valentin Amrhein\, Sander Greenland\, Blake McShane

[^2]: No meu rascunho inicial\, escrevi \"aceite nossa hipótese e rejeite\-a caso contrário\"\, que é a interpretação errada do que é um valor p\. Isso mostra como é fácil cometer um erro\, e agora estou um pouco paranoico achando que cometi outro neste post\.

[^3]:
    Alguns outros recursos que achei úteis para reler são [here](https://blog.minitab.com/blog/adventures-in-statistics-2/how-to-correctly-interpret-p-values 'interpret') e [here](https://blog.minitab.com/blog/adventures-in-statistics-2/understanding-hypothesis-tests-significance-levels-alpha-and-p-values-in-statistics? 'stats')\. Além de falar sobre por que o valor p não é o mesmo que a taxa de erro\, o site também tinha uma tabela interessante que mostrava como um valor p baixo pode resultar em uma alta taxa de erro\:

    | Valor P | Probabilidade de rejeitar incorretamente uma hipótese nula \(que é realmente verdadeira\) |
    | ------- | ------------------------------------------------------------------------------ |
    | 0\.05    | Pelo menos 23\% \(e normalmente perto de 50\%\)                                      |
    | 0\.01    | Pelo menos 7\% \(e normalmente perto de 15\%\)                                       |

    > \"As taxas de erro mais altas nesta tabela te surpreendem\? Infelizmente\, a interpretação errada comum dos valores P como taxa de erro cria a ilusão de substancialmente mais evidências contra a hipótese nula do que o justificado\. Como você pode ver\, se você basear uma decisão em um único estudo com valor P próximo de 0\,05\, a diferença observada na amostra pode não existir no nível populacional\.\"

[^4]: Isso apesar de ter feito várias aulas de estatística no ensino médio e na faculdade\.\.\. o que mostra o quão difícil isso é ou o quanto tempo levo para entender algo\.

[^5]: Eles também preferem o termo \'intervalo de compatibilidade\'
