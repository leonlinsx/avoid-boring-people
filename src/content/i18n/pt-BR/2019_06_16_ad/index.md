---
title: "Mitos sobre segmentação de anúncios"
description: "A segmentação de anúncios não é tão poderosa quanto você imagina"
pubDate: 2019-06-16
category: Technology
tags: ['business']
heroImage: './a_1.png'
locale: 'pt-BR'
sourceSlug: 'ad'
sourceHash: 'dc13e280c424181607da2dc708f7376d9ab461e55c3e7c3451f085786412207a'
---

As pessoas têm com razão preocupações com privacidade e outras na atual era do compartilhamento e segmentação de localização\, que foi catalisada pelo GPS\. A capacidade de segmentação de anúncios baseada na localização geralmente é mal compreendida\, assim como esses artigos [street fight](https://streetfightmag.com/2019/03/07/four-targeting-myths-that-devalue-the-real-power-of-location-data/) e [digiday](https://digiday.com/marketing/confessions-location-data-exec/) Detalhes abaixo\. A precisão\, eficácia e escala do direcionamento de localização são menores do que você imagina\.

Por Briga de Rua\:

> Outra coisa que os dados de localização podem fazer muito bem é encontrar viajantes de negócios que estiveram em vários aeroportos durante um determinado período\, como em um ou dois meses\. Os dados de localização não podem permitir que você atenda a 25 milhões de clientes da United Airlines que estiveram em portões específicos da United dentro de terminais específicos de aeroportos específicos no último mês

Você pode identificar visitas gerais repetidas a um local\, mas não até a especificidade e não em uma escala tão grande\. O erro de alcance do usuário [^1] é [identical for military and civilian devices](https://www.gps.gov/systems/gps/performance/accuracy/)\, levando a uma precisão do usuário de \~5m\. O uso em ambientes internos provavelmente torna isso ainda mais impreciso\.

Aparentemente existem [civilian equipment and tech that allows for centimetre level accuracy](https://www.novatel.com/an-introduction-to-gnss/chapter-5-resolving-errors/real-time-kinematic-rtk/) mas os custos são altos\, tornando essa Cinemática em Tempo Real \(RTK\) inviável para celulares atualmente [^2]\.

> Mesmo que seu fornecedor de dados afirme ter desenhado um \"polígono personalizado\" ao redor das lojas Subway e UPS\, os dados de localização do dispositivo precisam se alinhar de forma precisa e precisa com esse polígono para funcionar\. Não é assim que os dados de localização funcionam\, mesmo que sejam de origem GPS\. Se um fornecedor de dados disser que pode medir definitivamente visitas incrementais \(a partir de um anúncio móvel\) a sanduíches Subway em Connecticut\, essa afirmação sozinha já deveria ser um alerta forte\. O mesmo vale para qualquer loja em um shopping\. Não pode ser feito com qualquer escala ou confiabilidade\.

Novamente\, ajuste suas expectativas de escala e confiabilidade\.

> Dados de localização não permitem que você alcance 30 milhões de dispositivos a poucos quilômetros do Arby\'s mais próximo durante o horário do almoço em Dallas\. Primeiramente\, 57\% dos dados de localização nos pedidos de convite estão errados por mais de uma milha\. Hoje\, tentar alcançar um público a menos de uma milha de um restaurante específico pode gastar mais da metade do seu dinheiro em anúncios\, a menos que você tenha uma forma confiável de filtrar os dados incorretos\. Segundo\, esse tipo de escala simplesmente não está disponível\, mesmo que um segmento do armazenamento de dados afirme o contrário

Fico surpreso que uma porcentagem tão grande dos dados esteja errada\, mas uma distância tão grande\, mas vou acreditar na palavra deles\. Se for esse o caso\, não é de se admirar que a segmentação de localização não possa ser tão detalhada quanto as pessoas parecem esperar\.

Segundo o Digiday\:

> Para a web\, o número de pessoas compartilhando latitude e longitude ao entrar em uma loja será praticamente inexistente\. É irrealista escalar esse tipo de dado dado o quão difícil é para os fornecedores de localização conseguirem encontrá\-los\.

Reiterando a escala dos dados disponíveis\. Espero que isso mude com o tempo\, à medida que mais pessoas\, consciente ou inconscientemente\, ativarem o compartilhamento de localização\. Atualmente estou bem com essa troca para obter minha linha do tempo histórica no Google Maps\. Muita gente acha isso assustador\. Gosto da possibilidade de lembrar onde estive dada minha paixão por comida e viagens\.

> O que realmente está acontecendo é que esses fornecedores de tecnologia publicitária estão tentando complementar os dados limitados que já possuem com outros conjuntos de dados de fornecedores concorrentes ou fontes desconhecidas\. A maioria dos editores respeitáveis prefere usar seus dados em todo o próprio negócio do que vendê\-los para fornecedores de tecnologia publicitária\, já que o potencial de receita é maior em relação ao próprio conteúdo\.

Semelhante ao equívoco de que o Facebook vende seus dados [^3]\, os editores preferem manter seus próprios dados do que vendê\-los\. Os fornecedores de tecnologia publicitária precisam fazer o conjunto de dados que usam parecer maior de alguma forma\.\.\.

> Quem entra numa loja com o celular na mão olhando o site de uma publicadora\? Não é assim que as pessoas se comportam quando estão fazendo compras\. E ainda assim existem fornecedores de dados de localização que vendem conjuntos de dados de pessoas que têm mais probabilidade de entrar em uma loja depois de ver um anúncio\.

Com a falta de alvos alternativos de medição\, as mudanças nas visitas a lojas após campanhas publicitárias parecem ser a métrica padrão a ser acompanhada\. Consigo meio que entender a justificativa desse fornecedor de dados afirmar isso\. Por exemplo\, se eu faço uma campanha para uma venda que aparece apenas para os espectadores do anúncio\, é declarada na loja e não é anunciada em nenhum outro lugar\. Entendo o ponto do Digiday de que essa é uma medida imprecisa\.

[^1]:
    Diferente da precisão do usuário\, segundo o site\. Parece que a URE influencia a precisão do usuário\, mas não é o único item\.

    > Para deixar claro\, URE não é precisão do usuário\. A precisão do usuário depende de uma combinação de geometria do satélite\, URE e fatores locais como bloqueio de sinal\, condições atmosféricas e características\/qualidade do projeto do receptor\.

[^2]: [u-blox claims to be taking this 'to the next level' which hopefully means cheaper and more mainstream usage eventually?](https://www.u-blox.com/en/high-precision-positioning)

[^3]: Talvez um assunto para outra ocasião\, mas há uma nuance entre vender seus dados e vender acesso aos seus dados\. O Facebook quer manter o máximo possível dos seus dados\, anonimizados em grande escala\, e vender o direito de direcionar anúncios com base nesses dados que o Facebook mantém
