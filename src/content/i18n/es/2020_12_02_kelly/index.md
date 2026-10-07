---
title: "Tener fe en el criterio Kelly para la inversión ángel"
description: "Uso de matemáticas para estimar el tamaño óptimo de la cartera"
pubDate: 2020-12-02
category: Risk & Decision Making
tags: ['investing', 'risk', 'math']
heroImage: '../../../blog/2020_12_02_kelly/kel_7.webp'
featured: true
locale: 'es'
sourceSlug: 'kelly'
sourceHash: '360b60f1699a1f7679aa8e710a2d62b9ff39faaf7b217118a06c5a13e2b226cb'
---

## Conclusiones

1. El criterio de Kelly es una forma matemática de dimensionar tu portafolio\, aunque ten cuidado con tus suposiciones
2. HASH\.ai facilita las simulaciones basadas en agentes\; Intento modelar las tasas de fallo en el arranque

## 1\. Criterio de Kelly para el tamaño de carteras

Sarah es una aspirante a inversora ángel\. Sus amigos Nicholas\, Alyson y Chase tienen una idea de negocio mágica relacionada con la exterminación de plagas\, y Sarah piensa que va a ser un gran éxito\.

Sarah estaba a punto de invertir tres ahorros de toda una vida en este negocio\, cuando su otro grupo de amigos [^1] Seth\, Marc\, Emma y Amber le proponen una idea igual de emocionante que involucra conejitos\.

Sarah se da cuenta de que tiene múltiples opciones y no sabe qué hacer\. Va a consultar con su amigo mayor Anthony\, que observa de cerca el sector de la inversión\. Anthony dice que va por buen camino\: la asignación de carteras y los pagos de riesgo\/recompensa son la clave para convertirse en una inversora exitosa\. También añade que quizá le interese leer sobre el [Kelly criterion,](https://www.princeton.edu/~wbialek/rome/refs/kelly_56.pdf 'Kelly') Una fórmula para ajustar las tallas de apuestas\.

La fórmula Kelly fue desarrollada por John Kelly en Bell Labs\. Requiere unas pocas entradas y te devuelve el **El porcentaje óptimo de tu capital para apostar en algo\,** Suponiendo que quieras maximizar los rendimientos a largo plazo\. He publicado una deducción simplificada en el apéndice\, y también puedes encontrarla [here](https://blogs.cfainstitute.org/investor/2018/06/14/the-kelly-criterion-you-dont-know-the-half-of-it/ 'derive') o en el artículo original\.

![post](../../../blog/2020_12_02_kelly/kel_1.webp)

Sé que las matemáticas dan miedo\, así que vamos a ilustrarlo con un ejemplo\. Quieres saber cuánto apostar en un lanzamiento de moneda\, donde o bien duplicas tu dinero o pierdes la apuesta\. Si introduces los números\:

![post](../../../blog/2020_12_02_kelly/kel_2.webp)

Sí\, has leído bien\. Kelly dice que deberías evitar arriesgarte en absoluto\. ¿Por qué\?

Como no tienes ventaja y el riesgo\/recompensa está bien dimensionado\, la mejor opción es no apostar\.

Ahora\, imagina que el mismo lanzamiento de moneda te paga un retorno de 11 veces \(1000\%\) en tu apuesta\, y todo lo demás sigue igual\. Si introduces los números\:

![post](../../../blog/2020_12_02_kelly/kel_3.webp)

Kelly dice que deberías apostar el 45\% de tu capital total\. Fíjate que\, incluso con cuotas tan atractivas\, no estás apostando todo tu dinero [^2]\. También puedes ver que en juegos donde puedes perder todas tus apuestas\, nunca vas a apostarlo todo a menos que creas que tienes un 100\% de posibilidades de ganar\.

[Michael Mauboussin and Ed Thorp elaborate on the attractive features of the Kelly system:](http://www.capatcolumbia.com/MM%20LMCM%20reports/Size%20Matters.pdf 'Michael')

1. La probabilidad de ruina es \"baja\"\. Como el sistema Kelly se basa en apuestas proporcionales\, perder todo tu capital es teóricamente imposible\, aunque aún habrá picos de volatilidad
2. El sistema Kelly tiene muchas probabilidades de aumentar su capital más rápido que otros sistemas
3. Tiendes a alcanzar un nivel específico de ganancias en el menor tiempo medio posible

¿Cómo puede esto ayudarnos en el ámbito de la inversión ángel\? Tendremos que hacer algunas suposiciones muy simplificadoras [^3]\, pero Kelly puede ayudarnos a tener una idea de cuánto asignar por inversión\.

Sabemos que Kelly toma tres entradas\: nuestra creencia sobre cuál es la probabilidad de ganar\, el porcentaje de pérdida y el porcentaje de beneficio\. [Correlation Ventures and Seth Levine](https://www.sethlevine.com/archives/2020/10/vc-fund-returns-are-more-skewed-than-you-think.html 'Seth') tengo un gráfico interesante abajo mostrando los rendimientos de los capitalistas de riesgo a lo largo del tiempo\, y usaré eso como base para mis suposiciones\.

![post](../../../blog/2020_12_02_kelly/kel_4.webp)

Para simplificar\, voy a considerar cualquier cosa que tenga un retorno 10x \(900\%\) o más como una victoria\, y todo lo demás como una pérdida\. Según el gráfico\, eso significa que ganamos aproximadamente el 5\% de las veces\. Simplificaré aún más asumiendo que perdemos el 100\% de nuestra apuesta en una pérdida\, y ganamos ese 900\% de beneficio con una victoria\. Bajo estas suposiciones iniciales\, obtenemos\:

![post](../../../blog/2020_12_02_kelly/kel_5.webp)

Bueno\. Eso no es bueno\. Bajo nuestras suposiciones actuales\, Kelly dice que invertir en capital riesgo es un mal negocio\. Cuando vi esto por primera vez\, me quedé mirando dos veces y luego me pregunté cómo iba a terminar de escribir este número del boletín [^4]\. La respuesta a la que llegué fue hacer trampas\. Mucho\.

En lugar de la tasa de victoria del 5\%\, supongamos que los inversores ángel entran en una inversión confiando en que están por encima de la media y que al menos sus inversiones les devolverán el dinero\. Creen que su probabilidad de ganar es mayor que la tasa base\. No apuestas por algo a menos que creas tener ventaja frente a las probabilidades\.

En otras palabras\, ignoraremos toda esa parte \<1x en el gráfico y asumiremos que nuestro universo es solo el resto\. Ese 5\% de tasa de victorias salta a aproximadamente el 14\% [^5]\. Mantendremos todo lo demás constante\. Bajo estas nuevas suposiciones\, obtenemos\:

![post](../../../blog/2020_12_02_kelly/kel_6.webp)

Al menos es algo con lo que podemos trabajar\. Aguanta con las suposiciones por ahora y las revisaremos más adelante\.

Para ver cómo podrían ser nuestros rendimientos\, supongamos también que hacemos 100 inversiones seguidas\. Haremos 1\.000 simulaciones de cómo podría ser una cartera así\, es decir\, imaginaremos 1\.000 universos donde invertimos en 100 empresas bajo las suposiciones anteriores\. [I'm using this Colab file here if you want to follow along](https://colab.research.google.com/drive/1YeMnl2QOQdCAGGxCDr2pfDk_HFgCh02D?usp=sharing 'Colab')

No es de extrañar que nuestro juego amañado nos muestre ganando mucho dinero\:

![post](../../../blog/2020_12_02_kelly/kel_7.webp)

Sin embargo\, hay algunas cosas a tener en cuenta\. Fíjate en las enormes caídas \(todas las caídas\) que ocurren\. Muchas carteras pierden más de la mitad de su dinero al final\. Los rendimientos tienen picos de volatilidad enormes\.

Además\, huimos _mil_ simulaciones\. Aunque los grandes rendimientos destacan en el gráfico\, realmente no hay tantos\. La mayoría de los casos están todos comprimidos cerca del fondo\.

Para reducir el riesgo\, muchas personas suelen adoptar un enfoque de \"Kelly Fraccionado\"\, donde apuestan un porcentaje menor del tamaño recomendado por Kelly\. Lo haremos aquí también\, simulando escenarios en los que solo apostamos la mitad de lo recomendado \(2\%\)\.

Echemos un vistazo más de cerca a la distribución de los rendimientos de ambos casos\. Es difícil de ver\, pero los diagramas de caja muestran los rangos típicos del 25º\, mediana\, percentil 75 de retornos\. Empezamos en 100 dólares\:

![post](../../../blog/2020_12_02_kelly/kel_8.webp)

Si ignoramos los casos atípicos\, podemos ver que el percentil 25 al 75 de los rendimientos para todas las simulaciones está en un rango mucho menor\.

Y si nos centramos en el enfoque \"más seguro\"\, de Half Kelly\, vemos que la mayoría de las veces obtienes menos de 5x retornos\.

![post](../../../blog/2020_12_02_kelly/kel_9.webp)

**La conclusión es que\, si inviertes como ángel\, necesitas mucha convicción\, probablemente querrás hacer muchas inversiones y solo invertir pequeños porcentajes de tu capital a la vez\.** Aun así\, la probabilidad de obtener el mítico retorno de 100x sigue siendo baja\. Ten en cuenta que esta es la estrategia óptima de apuestas\, y ya manipulamos el juego de varias maneras\:

- Eliminamos a una gran parte de los perdedores
- Asumimos un resultado binomial
- Asumimos pagos fijos de victorias y derrotas
- Asumimos que las apuestas ocurren una tras otra
- Asumimos que podríamos hacer muchas apuestas

Ninguna de estas es la vida real\; lo anterior es una gran simplificación\. Dicho esto\, **al menos podemos usar a Kelly para reducir el riesgo de ruina\.**

Si quieres profundizar\, hay un artículo de Vasili Nekrasov [here](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2259133 'paper') Ese tiene un modelo mucho mejor\, pero las matemáticas me superan\. El archivo de Python Colab sí [here](https://colab.research.google.com/drive/1YeMnl2QOQdCAGGxCDr2pfDk_HFgCh02D?usp=sharing 'colab') Si quieres experimentar con las suposiciones base de la simulación [^6]\.

### Para más información sobre el criterio de Kelly\:

1. [The Kelly Criterion: Multiple Investment Opportunities by Christian Aichinger](https://greek0.net/blog/2018/04/17/kelly_criterion2/)
2. [The Kelly Criterion: You Don’t Know the Half of It by Alon Bochman](https://blogs.cfainstitute.org/investor/2018/06/14/the-kelly-criterion-you-dont-know-the-half-of-it/)
3. [Python Risk Management: Kelly Criterion by Lester Leong](https://towardsdatascience.com/python-risk-management-kelly-criterion-526e8fb6d6fd)
4. [Practical Implementation of the Kelly Criterion by Andrea Carta and Claudio Conversano](https://www.frontiersin.org/articles/10.3389/fams.2020.577050/full)
5. [What AngelList Data Says About Power-Law Returns In Venture Capital by AngelList](https://angel.co/blog/what-angellist-data-says-about-power-law-returns-in-venture-capital)

## 2\. Utilizar HASH\.ai para simular las tasas de supervivencia de la empresa

Pasaremos de un modelo lleno de suposiciones a otro modelo lleno de suposiciones\. Recientemente oí hablar de la empresa [HASH.ai](https://hash.ai/ 'hash')\, que te permite \"construir simulaciones multiagente en minutos\.\" Con eso se refieren a crear múltiples objetos que puedan interactuar entre sí y luego ver qué ocurre\. Puedes leer más sobre modelado basado en agentes [here](https://hash.ai/blog/what-is-agent-based-modeling 'hash')

![post](../../../blog/2020_12_02_kelly/kel_10.webp)

Quería experimentar con la herramienta [^7]\, simulando algunas de las suposiciones que hicimos en las secciones anteriores\. Algunas razones por las que invertir en capital riesgo es difícil son porque muchas empresas fracasan o no crecen lo suficientemente rápido en relación con las expectativas\. Vamos a modelar algunas empresas que crecen en una economía\.

De nuevo\, haré suposiciones simplificadoras\:

- Conocemos las tasas medias de supervivencia de las empresas anualmente\. Abuso de la probabilidad para suponer una tasa diaria de supervivencia
- Con base en eso\, también dedujo una tasa diaria de fracaso
- También conocemos las tasas medias de crecimiento de ingresos de la empresa anuales\. De eso deduzco una tasa de crecimiento diaria improvisada

![post](../../../blog/2020_12_02_kelly/kel_11.webp)

Puse todo eso en un proyecto HASH\.ai\, modificando una de sus plantillas\. Me costó mucho trastear porque muchos archivos están en Javascript y\.\.\. No sé Javascript\. Pero creo que al final conseguí que funcionara en su mayoría [^8]\.

El modelo simula a las empresas como cajas verdes\, que crecen en altura cada día\, con la altura representando el tamaño de la empresa\. En cualquier momento\, existe la posibilidad de que la empresa fracase\, representada por la caja ardiendo en llamas [^9]\. Podemos ver cuántas empresas sobreviven durante largos periodos de tiempo\. Aquí tienes una muestra de ejemplo\:

![post](../../../blog/2020_12_02_kelly/kel_12.webp)

Bajo las suposiciones actuales\, hubo muchos más supervivientes de los que pensaba\, aunque tardamos mucho en ver empresas cien veces\. Probablemente podríamos retroceder y ajustar las suposiciones\.

HASH\.ai también te permite graficar estadísticas a lo largo del tiempo\. Mi modelo actual muestra un estado estable de supervivientes frente a fracasos\.

![post](../../../blog/2020_12_02_kelly/kel_13.webp)

De nuevo\, esto era solo por diversión\, y la mayoría de las suposiciones necesitan ajustarse\. El modelo final es [here](https://core.hash.ai/@leonlinsx/wildfires-regrowth-3/main 'model') Si quieres experimentar con ello\. Me interesaría ver a alguien crear un modelo más sofisticado de crecimiento de startups\.

## Otros

1. [Unit economics of vending machines](https://thehustle.co/the-economics-of-vending-machines/ 'econs')
2. [Online game networking explained](https://www.pcgamer.com/netcode-explained/ 'netcode')
3. [What we can learn from War and Peace and a napkin about risk.](https://refractor.substack.com/p/the-story-range? 'refractor')
4. [American PhDs are failing at start-ups](https://marginalrevolution.com/marginalrevolution/2020/12/american-ph-ds-are-failing-at-start-ups.html 'phd')
5. [This isn't Sparta](https://acoup.blog/2019/08/16/collections-this-isnt-sparta-part-i-spartan-school/ 'sparta')

## Apéndice

![post](../../../blog/2020_12_02_kelly/kel_14.webp)

[^1]: Sarah lo está petando en el apartado de amigos

[^2]: También está el punto\, no relacionado\, de que si alguna vez ves cuotas tan atractivas\, probablemente te estés timando

[^3]: Quiero recalcar cuánto estamos simplificando aquí\. Por un lado\, la iliquidez de las inversiones ángeles es un gran problema\, ya que no hay una naturaleza de apuestas repetidas y continuas que ejecutamos más adelante en las simulaciones\. Además\, apunte\: podría haberme equivocado fácilmente en alguna de las matemáticas\, por favor corregidme si veis errores\.

[^4]: Planifica con antelación\, dicen\.\.\.

[^5]: 5\% dividido entre \(100\% menos 64\%\)

[^6]: Verás que pequeños ajustes en la probabilidad de ganar desde donde está cambiarán drásticamente el porcentaje de apuesta sugerido y los rendimientos previstos

[^7]: Énfasis en el juego\. Mi modelo final es súper chapucero\.

[^8]: Notarás referencias a árboles\, incendios y más en el código\, que es un resto del modelo original que simulaba incendios forestales\.

[^9]: Quiero decir que fue intencionado\; no conseguía averiguar cómo cambiar muchas de las funciones\.
