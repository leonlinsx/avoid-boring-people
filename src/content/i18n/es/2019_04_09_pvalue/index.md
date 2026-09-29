---
title: "Valores P: tú (y yo) nos estamos equivocando"
description: "¿Qué significa realmente un valor p?"
pubDate: 2019-09-04
category: Risk & Decision Making
tags: ['math']
heroImage: './p_1.webp'
locale: 'es'
sourceSlug: 'pvalue'
sourceHash: '4a1fb3af69e0e255c81d9e518a885d55d00cff57669f82853377e51b1475ee32'
---

La mayoría de nosotros hemos estudiado sobre valores p en una clase de Estadística en algún momento\. La mayoría pensamos que entendíamos lo suficiente entonces\; al fin y al cabo\, aprobamos la asignatura\. La mayoría estamos muy equivocados\.

Debido al uso indebido generalizado del valor p\, [some scientists are speaking out against the application of p values in research](https://www.nature.com/articles/d41586-019-00857-9 'against p values')\:

> No estamos pidiendo prohibición de los valores P\. Tampoco decimos que no puedan usarse como criterio de decisión en ciertas aplicaciones especializadas \(como determinar si un proceso de fabricación cumple algún estándar de control de calidad\)\. Y tampoco estamos defendiendo una situación de \'vale todo\'\, en la que la evidencia débil se vuelva creíble de repente\. Más bien\, y en línea con muchos otros a lo largo de las décadas\, estamos pidiendo que se detenga el uso de valores P de forma convencional y dicotómica — para decidir si un resultado refuta o apoya una hipótesis científica

Los autores piden cambiar la percepción de los valores p como \'la única cosa\' que determina si el resultado de la investigación es aceptado o no\. Luego describen su razonamiento y también exponen algunas alternativas\, que abordaré en un momento\.

En primer lugar\, para entender mejor lo que defienden\, deberíamos refrescar la memoria [what p values are](https://www.nature.com/articles/d41586-019-00874-8 'p values') [^1]\:

> una medida de lo sorprendente que es un resultado\, dadas las suposiciones sobre un experimento\, incluyendo que no existe efecto\. Si un valor P está por encima o por debajo de un umbral arbitrario que demarca la \'significación estadística\' \(como 0\,05\) decide si se aceptan hipótesis\, se publican artículos y se llevan productos al mercado\.

Así que hacemos algunos cálculos alrededor de nuestros resultados\, obtenemos un número X y luego rechazamos nuestra hipótesis nula si nuestro número X es \<0\,05\, lo que implica credibilidad para nuestra hipótesis alternativa [^2]\. El proceso en sí parece mecánico pero algo comprensible\. El problema surge en interpretar lo que acabamos de hacer\. ¿Es X la probabilidad de que estés cometiendo un error al rechazar la hipótesis nula\? ¿Es X la probabilidad de que te equivoques al aceptar la hipótesis alternativa\? ¿Es 1 \- X la probabilidad de que tengas razón\?

Ninguna de las interpretaciones anteriores es correcta\, mostrando cómo las estadísticas pueden ser poco intuitivas y por qué [not even scientists for meta-science can explain what p values mean intuitively](https://fivethirtyeight.com/features/not-even-scientists-can-easily-explain-p-values/? 'easily explain')\:

> Queremos saber si los resultados son correctos\, pero un valor p no mide eso\. No puede decirte la magnitud de un efecto\, la fuerza de la evidencia o la probabilidad de que el hallazgo haya sido resultado del azar\.

> ¿Qué información puedes obtener de un valor p\? La explicación más directa que encontré vino de Stuart Buck\, vicepresidente de integridad en la investigación de la Fundación Laura y John Arnold\. Imagina\, dijo\, que tienes una moneda que sospechas que está inclinada hacia caras\. \(Tu hipótesis nula es entonces que la moneda es justa\.\) La lanzas 100 veces y obtienes más caras que cruz\. El valor p no te dirá si la moneda es justa\, pero sí la probabilidad de que conseguirías al menos tantas caras como si la moneda fuera justa\. Eso es todo — nada más\.

Es importante destacar que tu valor p es la probabilidad de obtener el resultado que tienes\, _bajo la hipótesis nula asumida_\. Si tu hipótesis nula fuera correcta\, solo habrías obtenido el resultado que obtuviste en X \% de experimentos\. Como X es un número bajo\, asumes que es poco probable que la hipótesis nula sea correcta y la rechazas\. Esto no te indica la probabilidad de obtener el resultado que tienes _cuando no se asume la hipótesis nula_\.

Supongamos que tenemos un experimento para ver si la altura media de un grupo de personas es 0\. Rechazaríamos nuestra hipótesis nula con un valor p muy bajo\, ya que obviamente la altura de todos es \>0\. Sin embargo\, eso no nos dice nada sobre la probabilidad de obtener la altura media que calculamos en este \'estado real del mundo\'\. Simplemente nos indica que había una baja probabilidad de que hubiéramos conseguido la altura media que obtenimos\, _si la altura media era 0_ [^3]\.

Claramente\, los valores p son más matizados que el simple sí\/no que la mayoría de la gente \(yo incluido\) creía [^4]\. Los autores en el primer artículo continúan diciendo\:

> Seamos claros sobre lo que debe detenerse\: nunca debemos concluir que no hay \'diferencia\' ni \'asociación\' solo porque un valor P sea mayor que un umbral como 0\,05 o\, equivalentemente\, porque un intervalo de confianza incluye cero\. Tampoco deberíamos concluir que dos estudios entren en conflicto porque uno tuvo un resultado estadísticamente significativo y el otro no\.

> Encuestas a cientos de artículos han encontrado que los resultados estadísticamente no significativos se interpretan como indicios de \'ninguna diferencia\' o \'ningún efecto\' en aproximadamente la mitad

Los resultados estadísticos no significativos no significan lo mismo que no tener efecto\. De hecho\, los autores prefieren evitar el uso de \'estadísticamente significativo\'\:

> Estamos de acuerdo y pedimos que se abandone todo el concepto de significación estadística\.

Su razón para hacerlo es que esta designación de significado sí\/no es una falsa dicotomía\:

> El problema es más humano y cognitivo que estadístico\: agrupar los resultados en \'estadísticamente significativo\' y \'estadísticamente no significativo\' hace que la gente piense que los ítems asignados de esa manera son categóricamente diferentes \\\[\.\.\.\\\] Una razón para evitar tal \'dicotomanía\' es que todas las estadísticas\, incluidos los valores P y los intervalos de confianza\, varían naturalmente de un estudio a otro\, y a menudo lo hacen de forma sorprendente\. De hecho\, la variación aleatoria por sí sola puede fácilmente provocar grandes disparidades en los valores P\, mucho más allá de caer justo en ambos lados del umbral de 0\,05\.

Esto tiene sentido para mí\, pero parece una batalla cuesta arriba\. Cuando se trata de decisiones complicadas\, la gente quiere heurísticas simples para usar\, y los valores p ofrecen una forma sencilla de justificar algo

Los autores también comentan algunas cosas a tener en cuenta al usar intervalos de confianza [^5]\:

> Primero\, que el intervalo dé los valores más compatibles con los datos\, dadas las suposiciones\, no significa que los valores fuera de él sean incompatibles\; simplemente son menos compatibles\.

> Segundo\, no todos los valores internos son igualmente compatibles con los datos\, dadas las suposiciones\.

> Tercero\, al igual que el umbral de 0\,05 del que proviene\, el 95\% por defecto usado para calcular intervalos es en sí mismo una convención arbitraria\.

> Por último\, y lo más importante de todo\, sé humilde\: las evaluaciones de compatibilidad dependen de la corrección de las suposiciones estadísticas utilizadas para calcular el intervalo\.

Y concluyen con su visión de cómo sería un mundo sin un énfasis único en los valores p\:

> ¿Cómo será retirar la significación estadística\? Esperamos que las secciones de métodos y la tabulación de datos sean más detalladas y matizadas\. Los autores enfatizarán sus estimaciones y la incertidumbre en ellas — por ejemplo\, discutiendo explícitamente los límites inferior y superior de sus intervalos\. No se basarán en pruebas de significación\. Cuando se informen los valores P\, se darán con precisión sensata \(por ejemplo\, P \= 0\,021 o P \= 0\,13\) — sin adornos como estrellas o letras para indicar significación estadística y no como desigualdades binarias \(P \< 0\,05 o P \> 0\,05\)\. Las decisiones para interpretar o publicar resultados no se basarán en umbrales estadísticos\. Las personas pasarán menos tiempo con software estadístico y más tiempo pensando\.

Como ya he escrito antes\, [beliefs are tricky](/writing/why 'belief')\, incluso si eres un firme creyente en la ciencia\. La experimentación es una parte clave de cómo funciona el proceso científico\, y entender cómo interpretar resultados es un componente importante de ello\. El malentendido de los valores p ha llevado a conceptos erróneos sobre los estudios cuando se informan en las noticias\. Desafortunadamente\, no veo que esto cambie pronto\, dado que es mucho más fácil interpretar los valores p como un sí o un no\. No sé si la solución es reducir la importancia de los valores p\, pero ser más consciente de su mal uso es útil\.

[^1]: El artículo del que procede la siguiente descripción también resume los principales argumentos del artículo de opinión inicial de Valentin Amrhein\, Sander Greenland\, Blake McShane

[^2]: En mi borrador inicial escribí \"acepta nuestra hipótesis y rechátala de lo contrario\"\, que es la interpretación equivocada de lo que es un valor p\. Esto demuestra lo fácil que es cometer un error\, y ahora estoy un poco paranoico pensando que he cometido otro en esta publicación\.

[^3]:
    Otros recursos que me han resultado útiles para releer son [here](https://blog.minitab.com/blog/adventures-in-statistics-2/how-to-correctly-interpret-p-values 'interpret') y [here](https://blog.minitab.com/blog/adventures-in-statistics-2/understanding-hypothesis-tests-significance-levels-alpha-and-p-values-in-statistics? 'stats')\. Además de hablar de por qué el valor p no es lo mismo que la tasa de error\, el sitio también tenía una tabla interesante que mostraba cómo un valor p bajo podía resultar en una alta tasa de error\:

    | Valor P | Probabilidad de rechazar incorrectamente una hipótesis nula \(que en realidad es cierta\) |
    | ------- | ------------------------------------------------------------------------------ |
    | 0\.05    | Al menos un 23\% \(y normalmente cerca del 50\%\)                                      |
    | 0\.01    | Al menos un 7\% \(y normalmente cerca del 15\%\)                                       |

    > \"¿Te sorprenden las tasas de error más altas en esta tabla\? Desafortunadamente\, la interpretación errónea común de los valores P como tasa de error crea la ilusión de que hay sustancialmente más evidencia contra la hipótesis nula de la justificada\. Como puedes ver\, si basas una decisión en un solo estudio con un valor P cercano a 0\,05\, la diferencia observada en la muestra puede no existir a nivel poblacional\.\"

[^4]: Esto a pesar de haber hecho varias asignaturas de estadística durante el instituto y la universidad\.\.\. lo que o bien demuestra lo difícil que es esto o cuánto tiempo tardo en entender algo\.

[^5]: También prefieren el término \'intervalo de compatibilidad\'
