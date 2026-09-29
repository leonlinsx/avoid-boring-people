---
title: "Reseña de libro: Algoritmos para vivir"
description: "¿Cómo podemos aplicar algoritmos para mejorar la toma de decisiones en la vida real?"
pubDate: 2021-04-10
category: Risk & Decision Making
tags: ['behaviour', 'tech']
heroImage: './a_3.webp'
locale: 'es'
sourceSlug: 'algo'
sourceHash: '8d862c8a5a1107133c4c5ea0a2a80a0d41ad23b28d8d764cd9bae130552a882b'
---

## Conclusión

Un algoritmo es un proceso definido a seguir para obtener el resultado deseado\. Gran parte de nuestra vida está decidida por algoritmos\. Saber qué algoritmos seguir puede resultar en una toma de decisiones más eficiente y eficaz\.

## Algoritmos en la vida

Recientemente he releído [Algorithms to Live By](https://algorithmstoliveby.com/ 'algo')\, un libro de Brian Christian y Tom Griffiths sobre cómo los algoritmos pueden ayudarnos a ser más efectivos en nuestras vidas\. Habiendo aprendido a programar el año pasado\, saqué más provecho de esta vez\.

Un algoritmo es un proceso\, y puedes pensar en él como instrucciones a seguir para completar una tarea\. Por ejemplo\, aprender a sumar números es un algoritmo sencillo [^1]\.

Instrucciones más complejas pueden calcular resultados para otros problemas de la vida\. Los tipos de interés\, el posicionamiento en búsquedas web o los feeds de redes sociales se basan en la salida de algoritmos\. El libro repasa muchos de estos algoritmos y los relaciona con problemas que podrías enfrentar personalmente\.

Es demasiado difícil explicar todos los algoritmos que mencionan [^2]\, así que en su lugar haré pequeños resumen de algunos\, y normalmente me centro en las conclusiones cualitativas\, no cuantitativas\.

Además\, la mayoría de los algoritmos se basan en ciertas suposiciones\; en lugar de especificar eso cada vez\, tómalo como algo dado al leer\. Añadiré algunas de las suposiciones en notas al pie para quienes estén interesados\.

Algunos de los problemas tratados incluyen\:

- Cuándo dejar de hacer entrevistas para tener la máxima probabilidad de obtener el mejor resultado
- ¿Cuándo deberías dejar de explorar nuevas opciones para disfrutar de las que ya conoces
- Cómo programar tus tareas según tu objetivo

Veamos nuestro primer algoritmo\, sobre cuándo deberías dejar de trabajar en un problema\.

## Parada óptima

Si estás evaluando opciones \(candidatos a empleo\, ofertas de vivienda\, plazas de aparcamiento\, etc\.\)\, hay un equilibrio entre cuánto tiempo dedicas a elegir y la posibilidad de elegir la \"mejor\"\. Esto se conoce como la [secretary problem](https://en.wikipedia.org/wiki/Secretary_problem 'prob') \- Supongamos que contratas a una secretaria\, ¿cuántas entrevistas deberías hacer para tener la mejor oportunidad de encontrar a la mejor\?

En este caso\, hay un porcentaje preciso que debes usar\. Deberías esperar después de ver el 37\% del grupo de candidatos y luego elegir al siguiente mejor candidato que veas [^3]\. Por ejemplo\, si tuviste 100 candidatos\, espera después de haber visto los primeros 37 y luego elige al siguiente que sea mejor que todos los que has visto hasta ahora\.

Ese es el punto matemáticamente óptimo con la mayor probabilidad de elegir a la mejor persona para el puesto\. Si paras demasiado pronto\, podrías perder a alguien que entreviste más tarde\. Si paras demasiado tarde\, pierdes tiempo [^4]\.

![post](./a_1.webp)

## Explorar exploit

Similar a la situación óptima de detención\, hay un equilibrio entre recopilar información \(explorar\) y disfrutar \(explotar\)\. Supongamos que estás en un casino y quieres decidir qué máquinas jugar\. Quieres maximizar tus ganancias\, pero no sabes las probabilidades exactas de las máquinas \(si las supieras\, jugarías con la mejor\)\.

En este caso\, hay un número\, conocido como el [Gittins Index](https://www.cs.cornell.edu/courses/cs6840/2017sp/lecnotes/6840sp17R_Kleinberg.pdf 'gittins')\, que te da la máquina óptima para jugar [^5]\. Si conoces el número de victorias\, derrotas y cuánto valoras las ganancias futuras\, puedes calcular valores precisos para cada elección\. Algunas propiedades interesantes\:

- Si juegas con la máquina óptima y vuelves a ganar\, tiene sentido seguir jugando con esa máquina
- Si juegas con la máquina óptima y pierdes una vez\, puede que siga teniendo sentido seguir jugando con esa máquina
- Una máquina completamente desconocida puede ser preferible a máquinas que se sabe que ganan con frecuencia\, y esa máquina desconocida se vuelve más valiosa cuanto más valoras las ganancias futuras

Algunas otras implicaciones relacionadas\:

- La exploración tiene un mayor impacto en la vida temprana\; que los bebés se metan todo en la boca tiene sentido desde su punto de vista
- Explotar tiene un mayor impacto en la vida adulta\; de ahí que las personas mayores reduzcan su red social y prefieren volver a sus restaurantes favoritos

## Clasificación

El libro daba algunos ejemplos de algoritmos de ordenación\, que se usan comúnmente en programación\. Por ejemplo\, devolver resultados de búsqueda requiere ordenar los más relevantes para ti\.

Dejaré para otro día una discusión más detallada sobre algoritmos de ordenación\, ya que requieren comprensión [time complexity](https://www.bigocheatsheet.com/ 'time')\. Aquí tienes algunas conclusiones cualitativas\:

- Algunas formas de ordenar pueden ser mucho más eficientes que otras \(\>10 veces más rápidas\)
- Algunas situaciones no requieren solo eficiencia en el orden\. Por ejemplo\, organizar un calendario de partidos de temporada deportiva también requiere tener en cuenta lo emocionante que será la temporada\. Podrías optimizar la eficiencia del orden\, pero la temporada parecerá menos emocionante
- Cuanto más eficiente es una clasificación\, más frágil puede ser ante errores accidentales\. Por ejemplo\, el \"mejor\" equipo podría ser eliminado accidentalmente en un torneo de eliminación directa \(básicamente un algoritmo de ordenación\) como la Copa del Mundo [^6]\.

## Caché y memoria

La idea de tener una caché es tener 1\) una sección pequeña y rápida de memoria \(almacenamiento\)\, y 2\) una sección grande y lenta de memoria\. Luego alternaremos entre ambas según nuestra intención\. Esto nos permite obtener tanto cierta velocidad como cierto tamaño para la actividad que queremos\.

Por ejemplo\, podrías tener tu ropa favorita en el armario y la que no uses en el desván\. Tendrías acceso rápido a las prendas que más usaste\, pero aún así tendrías espacio para ese feo jersey navideño si quisieras\. Guardar caching suena complicado\, pero te darás cuenta de que lo hacemos de forma natural la mayor parte de nuestra vida diaria\.

¿Cómo decides qué objetos deben ponerse en la sección rápida y cuáles en la lenta\? Podrías poner objetos aleatorios\, el más nuevo\, el más grande\, etc\.

En este caso\, mantener los artículos más usados recientemente en la sección pequeña y rápida es la opción óptima\, debido a algo conocido como [temporal locality](https://www.geeksforgeeks.org/difference-between-spatial-locality-and-temporal-locality/ 'temp')\. Es más probable que necesites algo que hayas usado recientemente\. Por ejemplo\, Google Drive resalta tus archivos que usas con frecuencia para acceder rápidamente\.

![post](./a_2.webp)

## Programación

La mayoría tenemos que decidir cómo priorizar los asuntos de nuestra lista de tareas\. Esto suele requerir hacer un equilibrio entre la capacidad de respuesta \(la rapidez con la que respondes\) y el rendimiento \(cuánto puedes hacer\)\.

Un punto clave sobre la planificación y la priorización es definir tu métrica objetivo\, ya que eso determina qué algoritmo quieres usar [^7]\. Maximizar la capacidad de respuesta tiene a costa de lo que puedes lograr\:

Si quieres minimizar el máximo de retraso de todos tus proyectos [^8]\, el [Earliest Due Date](https://en.wikipedia.org/wiki/Single-machine_scheduling 'EDT') El algoritmo te dice que empieces con el proyecto que vence cuanto antes\.

Si quieres minimizar el tiempo total de finalización\, el [Shortest Processing Time](https://en.wikipedia.org/wiki/Single-machine_scheduling 'spt') El algoritmo te dice que primero hagas la tarea más rápida\.

Si tus tareas no son iguales en importancia\, entonces poner un peso en cada tarea y calcular la proporción de peso sobre el tiempo requerido te ayudará a decidir qué tarea realizar\; elige el proyecto con mayor peso a lo largo del tiempo\.

Prácticamente\, esto significa que probablemente merezca la pena hablar con tu jefe sobre cómo piensa el equipo sobre este intercambio y qué método preferiría que adoptaras\.

Hay otro concepto importante en la planificación\, que es la idea de [context switching](https://blog.doist.com/context-switching/ 'switch') \- siempre que tengas que cambiar entre tareas\. Cambiar de contexto es tiempo perdido porque no es trabajo real\, sino que requiere tiempo y esfuerzo por tu parte\.

Por ejemplo\, si estabas escribiendo un correo y luego te interrumpió un mensaje de Slack\, tardas en responder al mensaje y luego recordar qué querías hacer con el correo\.

En el peor de los casos\, cambiar de contexto se convierte en thrash\, cuando no haces nada productivo porque estás demasiado ocupado solo cambiando\. Las formas de evitar el thrash incluyen\:

- Decir que no a las tareas\, aunque los autores reconocen que a menudo no podemos hacerlo
- Trabajar de forma más tonta y más ineficiente\. En lugar de pensar en la forma óptima de hacer tus tareas\, simplemente empieza con algo y hazlo

## Regla de Bayes y distribuciones

Explicar la regla de Bayes probablemente requeriría un artículo por sí solo\, así que tomémoslo como una regla que te ayuda a predecir qué tan probable es que ocurra algo [^9]\. Lo que los autores quieren destacar es que esto depende de la distribución de la que provengan tus eventos\. Hay tres distribuciones principales a tener en cuenta\:

- Ley de potencia\: cuanto más tiempo ha durado algo\, más esperamos que continúe\. Por ejemplo\, si una empresa lleva mucho tiempo creciendo\, esperaríamos que siga creciendo
- Normal\: los eventos tempranos son sorprendentes\, los eventos tardíos son esperados\. Por ejemplo\, nos sorprendería la gente que muere joven\, y no la gente que muere tarde\.
- Erlang\: los eventos nunca son más ni menos sorprendentes\. Por ejemplo\, una distribución sin memoria de una ruleta o [the coin flips we discussed last week](/writing/ergodicity 'sub')

![post](./a_3.webp)

## Teoría de juegos

La mayoría probablemente ya haya oído hablar de la teoría de juegos\, que es una forma de pensar cuál es la estrategia óptima al jugar a un juego\. Algunos puntos destacados\:

- Si juegas demasiados niveles por encima de tu oponente\, vas a pensar que tiene información que en realidad no tiene\, y no podrá pensar lo que tú quieres que piense\. Dicho de otro modo\, no quieres conseguir _también_ Inteligente con tus estrategias
- Cada partida para dos jugadores tiene al menos uno [Nash Equilibrium,](https://en.wikipedia.org/wiki/Nash_equilibrium 'nash') donde ambos jugadores eligen la estrategia óptima para sí mismos
- Sin embargo\, encontrar el equilibrio de Nash es un problema intratable\, lo que significa que hay límites a la practicidad de la teoría de juegos
- El equilibrio tampoco puede ser el mejor resultado para todos los jugadores\. [It may be optimal for an individual to compete, but optimal for the group to cooperate.](https://en.wikipedia.org/wiki/Prisoner%27s_dilemma#:~:text=The%20prisoner's%20dilemma%20is%20a,working%20at%20RAND%20in%201950. 'wiki') Podemos cuantificar esto como el \"precio de la anarquía\"\, que mide la brecha entre cooperación y competencia\.
- También existe un concepto contraintuitivo conocido como [mechanism design](https://en.wikipedia.org/wiki/Mechanism_design 'mech')\, lo que muestra que _empeoramiento_ Cada resultado podría en realidad mejorar la situación de todos\, debido a que desplaza el equilibrio

Además de los algoritmos mencionados anteriormente\, los autores también analizan\:

- Cuando podrías estar sobreajustando tu proceso de toma de decisiones y qué puedes hacer al respecto
- Qué hacer cuando los problemas del mundo real no son tan buenos como la teoría y por qué deberías relajar las restricciones
- Cómo pensar en las redes de información y cómo funciona internet

En general\, pensé que merecía la pena leer el libro para hacerme una visión general de las formas interesantes en que los algoritmos aparecen en la vida\. Lo entendí mejor _después_ Eso sí\, estoy aprendiendo algo de informática\, así que tenlo en cuenta\. También me habría gustado que hubieran incluido ejemplos más prácticos [^10]\, ya que intentar aplicar los hallazgos a la vida puede ser difícil cuando hay que partir de diferentes suposiciones\.

[^1]: Es fácil enseñarles a los niños\, diciéndoles que memoricen sumas y cuándo llevar un número\, pero sorprendentemente no es obvio al intentar implementarlo en un ordenador\, mira [full adder logic gate](https://www.electronics-tutorials.ws/combination/comb_7.html 'full')

[^2]: Podrías decir que para cuando te explique todo\, más vale que lo haya hecho [written the entire book](https://en.wikipedia.org/wiki/P_versus_NP_problem 'p np')

[^3]: [The percentage is 1 divided by e, euler's number.](https://projecteuclid.org/journals/statistical-science/volume-4/issue-3/Who-Solved-the-Secretary-Problem/10.1214/ss/1177012493.full 'problem') La probabilidad no cambia a medida que crece el grupo de solicitantes\, pero sí cambia según la información que recibas

[^4]: El problema de la secretaria base asume que no puedes volver a un candidato al que rechazaste\, pero hay variaciones que se parecen un poco más a la vida real\.

[^5]: Este problema es intratable si las probabilidades de un beneficio en una máquina cambian con el tiempo\; esencialmente significa que es irresoluble\. Algunos problemas son intratables\. En estos casos\, relajar algunas restricciones y aceptar soluciones que sean \"lo suficientemente cercanas\" nos ayuda significativamente a estructurar el problema\.

[^6]: O March Madness\, para los americanos

[^7]: Solo el 9\% de todos los problemas de programación pueden resolverse de forma eficiente\.

[^8]: Es decir\, toma todos los proyectos que llegan tarde y luego el máximo de ellos\. Esa es la métrica que quieres minimizar\.

[^9]: Véase [here](https://betterexplained.com/articles/an-intuitive-and-short-explanation-of-bayes-theorem/ 'bayes') para un artículo que explica Bayes\. Bayes no es intuitivo \(al menos para mí\)\, lo que también significa que es bueno saberlo

[^10]: Para ser justos\, hay bastante información en las notas al pie que profundiza más
