---
title: "Rastrillos de mercado"
description: "Tasas de toma comparativas para varios mercados"
pubDate: 2019-04-27
category: Technology
tags: ['marketplace']
heroImage: '../../../blog/2019_04_27_rake/t_1.webp'
locale: 'es'
sourceSlug: 'rake'
sourceHash: 'd41c4ceb6c388ccc2108108bee3cc93c0fe9a951ea418a505e2e79c4508dcce7'
---

Me fascinan los marketplaces y los efectos de red\, ya que gran parte de internet se basa en que las empresas tienen éxito en ellos\, por ejemplo\, los efectos de red de Facebook\, el marketplace de terceros de Amazon\, el marketplace publicitario de Google\.

Esta publicación detalla mis pensamientos sobre un análisis fundamental del factor rake del mercado que vi escribir a Josh Breinlinger [here.](http://acrowdedspace.com/post/172383900012/marketplace-rake-factors 'rake factors')

Me gustó el artículo de Josh sobre factores de rake porque fue el primero que vi que intenta construir razones fundamentales por las que un rake se fija a un cierto porcentaje\, en lugar de simplemente \'porque las comparables están en ese rake\'\. Algunos \(¿muchos\?\) mercados efectivamente se valoran solo en base a los rake\, pero aún así me gusta tener un marco\.

Tenía pensamientos adicionales\:

- Hay algunos mercados que parecen ser excepciones a este marco \(lo cual Josh admite que no es definitivo\)
  - Por ejemplo\, el mercado de fotografía de stock siempre me ha intrigado desde que alguien lo señaló\. \[El rastrillo allí puede ser \>50\%\,\] \(\(https://microstockinsider.com/microstock_commission_rates \'comisiones de fotografía\'\) una cantidad increíble para un servicio que tiene tantos competidores\, tarifas transparentes y pocos costes marginales en el lado de la plataforma\.
  - Por ejemplo\, los rakes en los mercados de comercio electrónico en China son muy bajos en comparación con los mercados estadounidenses\, por ejemplo\, taobao \~4\% frente a ebay \~9\%
- Creo que añadir otro factor de \+3\% para la \'actividad promocional\' en la plataforma podría ser útil
  \_ Por ejemplo\, la regeneración del mercado de comercio electrónico chino mencionada anteriormente proviene principalmente de actividades de marketing\, y el coste medio es de \~4\% 
  \_ Por ejemplo\, ¿cómo booking\.com permite que los anunciantes se conviertan en miembros preferidos con mejor colocación para 300 puntos básicos
  \_ Por ejemplo\, el programa de fidelización del hotel promedia \~3\% de rev en costes incrementados para el hotel
  \_ Por ejemplo\, el rake de reparto de comida de Seamless solía pasar del 12\,5\% al 20\%\, una diferencia del 7\,5\% \(que es
  más alto que el 3\%\, pero el restaurante medio pagaría un 15\% y no el rake del 12\,5\%\, lo que implica una diferencia menor\) \\\* Por ejemplo\, supongo que Ubereats cobrará un par de puntos porcentuales por [promotional placement of restaurants](https://techcrunch.com/2018/12/10/uber-ads/ 'uber ads') también
- Creo que las empresas que entran en un mercado con la intención de soportar precios inferiores a su competidor también fijan su tasa de adopción entre un 5\% y un 10\% más baja que la del incumbente vigente
  - Por ejemplo\, ¿cómo booking\.com consiguió tarifas un 10\% o más bajas para superar a su competidor y [won the market that way](https://skift.com/2012/06/25/how-booking-com-conquered-world/ 'OTA history')
  - Por ejemplo\, los tipos de Seatgeek parecen ser un 5\%\+ más bajos que los del incumbente según mi propio benchmark
  - Por ejemplo\, las agencias chinas de viajes online \(OTAs\) más pequeñas supuestamente tienen un \~10\% de rake frente al \~15\% de las OTA principales
- No he visto muchos rastrillos \>20\% que se mantengan a lo largo del tiempo\. De forma similar a como habla Bill Gurley de [a rake too far](http://abovethecrowd.com/2013/04/18/a-rake-too-far-optimal-platformpricing-strategy/ 'optimal pricing strategy')\, hay algo en ese umbral que reduce las tasas de aceptación con el tiempo\. Mi hipótesis es que empieza a consumir demasiado el COGS del cliente como para que la situación se mantenga sin cambios durante \>5 años
  - Por ejemplo\, durante mucho tiempo\, los rakes en iOS y Google Play Store eran del 30\%\. Luego empezaron a introducir rakes más bajos para las suscripciones
  - Por ejemplo\, Steam solía tener un rake del 30\%\, y recientemente lo cambió para que fuera más bajo para editores grandes\. No es casualidad\, dado que Epic Games y Discord están sacando sus propias tiendas de rake del 10\%\+
- Las tasas de aceptación deberían estar influenciadas por los márgenes operativos de los vendedores en la plataforma\, aunque todavía estoy trabajando en cómo plantear esto\.
  - Por ejemplo\, las plataformas de reparto de comida no pueden cobrar mucho más del 30\% sin que los restaurantes pierdan dinero debido al bajo margen
  - Por ejemplo\, las tasas de aceptación de billetes de avión en EE\. UU\. son prácticamente del 0\% desde que las aerolíneas se han consolidado y tienen márgenes reducidos
- ¿En qué parte del marco colocamos las plataformas que cobran tanto al vendedor como al comprador\? Personalmente no me gustan como consumidor\, pero parece que aún no hay presión para cambiar ese modelo de negocio
  - Ruzwana en Twitter mencionó que quizá [more infrequent, episodic transactions can support buyer fees, but not frequent, regular transaction cases](https://twitter.com/daveambrose/status/694921246799073280)
  - Airbnb\, el mercado de venta de billetes y los mercados de vacaciones para perros son más episódicos y pueden cobrar tarifas de compra
  - Sin embargo\, las plataformas de entrega de comida no parecen encajar del todo en este marco\. Normalmente son transacciones regulares que cobran comisiones adicionales por la entrega\, lo que parecería ser un obstáculo para el crecimiento\.

También hice una comparación entre las tasas de rake previstas y reales según su marco\, y parecen encajar con la teoría\. La salvedad es que usé cierto criterio al aplicar los criterios\, y las tasas reales de aceptación se aproximan basándose en algunos benchmarks que he hecho personalmente\.

- Booking\.com tasa de compra según su marco debería ser del 20\% \+ 10\% de comisiones opacas \+ 5\% de control de calidad \+ 5\% prevención de fraude – 10\% de artículos de alto precio – 10\% de usuarios que se reúnen en persona \(¿esto cumple\?\) \= 20\% frente a 14\% de rake real
  - Otros OTAs principales\: expedia tiene alrededor del 13\-18\% de rake real\, ctrip es alrededor del 10\-15\% de rake real en su inventario hotelero
  - **Competidores chinos más pequeños\, como Meituan\, están entre el 8 y el 10 \%\, y Tongcheng entre el 6 y el 9 \%\.**
- La tasa de aceptación en Etsy se predice entre 20\% \- 5\% comisiones transparentes \- 5\% comprador beware \= 10\% frente a 5\% real
- La tasa de toma de Farfetch se predice es 20\% \+ 10\% trabajo en plataforma \+ 5\% control de calidad \+ 5\% prevención de fraude – 5\% comisiones transparentes – 5\% artículos de alto precio \= 30\% frente a 33\% real
- Tasa de toma de Taobao 20\% – 5\% comisiones transparentes – 5\% comprador cuidado \= **10\% frente a 4\% real**
- Tasa de toma de TMALL\: 20\% \+ 10\% trabajo en plataforma \+ 5\% control de calidad – 5\% comisiones transparentes – 5\% comprador\, cuidado \= **25\% frente a 3\% real**
- JD\.com tasa de aceptación 20\% \+ 5\% control de calidad – 5\% comisiones transparentes – 5\% comprador cuidado \= **15\% frente a 2\-8\% real**
- _Taobao\, Tmall y JD parecen no encajar en el marco\. Supongo que esto tiene que ver con el mercado chino y cómo Taobao comenzó inicialmente como una plataforma sin comisiones para competir contra EachNet\. Así que el punto de partida fue con una toma del 0\% en lugar del 20\%_
- Tasa de compra en mercado libre 20\% \+ 5\% control de calidad – 5\% comisiones transparentes – 5\% comprador cuidado \= 15\% vs 17\% real
- Tasa de relevo de Stubhub\/Seatgeek 20\% \+ 10\% comisiones opacas \+ 5\% control de calidad \+ 5\% prevención de fraude \- 5\% artículos de alto precio \= 35\% frente a 40\% \+ efectivos

Si me equivoco en alguna de las cosas anteriores o si tienes respuestas\, no dudes en decírmelo y corregiré la publicación según sea necesario\.
