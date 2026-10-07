---
title: "La queríamos a ella, pero en su lugar compramos Tinder"
description: "La trampa del margen de las empresas de IA, los conceptos de inversión en valor y los compromisos"
pubDate: 2020-04-29
category: Technology
tags: ['AI', 'business', 'investing']
heroImage: '../../../blog/2020_04_29_her/her_1.webp'
locale: 'es'
sourceSlug: 'her'
sourceHash: '140929fc05bda4f1a76315eefef59e45e7cb3db132f6b4504e8865ffe9865199'
---

## Conclusiones

1. Las empresas de IA parecen más empresas de servicios que de software\, lo que implica que deberían cotizar a valoraciones más bajas
2. La única persona en la que Charlie Munger invierte dice que invertir no es ser inteligente\, sino pensar como un propietario
3. Intenta entender mejor los compromisos en la toma de decisiones

## IA como negocio o negocio de servicio

He escrito antes sobre aprendizaje automático \(ML\) e inteligencia artificial \(IA\) [^1]\. Scott Locklin explica los problemas que enfrentan las startups de ML [here](https://scottlocklin.wordpress.com/2020/02/21/andreessen-horowitz-craps-on-ai-startups-from-a-great-height/ 'Scott') [^2]\, respondiendo principalmente a una publicación relacionada con a16z [here.](https://a16z.com/2020/02/16/the-new-business-of-ai-and-how-its-different-from-traditional-software/ 'a16z')

Sus puntos principales son\:

1. El ML cuesta mucho para beneficios marginales

2. Las startups de ML generalmente no tienen fosos ni salsa especial significativa

3. Las startups de ML son principalmente empresas de servicios\, no de software

Estas son opiniones más negativas que consensus\, así que veamos por qué cree que es así\. Citaré tanto a Scott como a la publicación a16z de Martin Casado y Matt Bornstein\.

### Coste

> En conjunto\, estas fuerzas de operación y cómputo en la nube contribuyen al 25\% o más de los ingresos que las empresas de IA suelen destinar a recursos en la nube\. En casos extremos\, las startups que abordan tareas especialmente complejas han encontrado que el procesamiento manual de datos es más barato que ejecutar un modelo entrenado de \\\[ML\\\]\. \- a16z

> La estructura de precios de la mierda de la \"nube\" está diseñada para extraer la máxima sangre de personas con grandes necesidades de datos o cálculo\. \- Scott

¿Se gasta el 25\% del rev solo en operaciones en la nube\? [^3] ¿Mucho\? Para contextualizar esa cifra\, veamos el coste total de bienes \(COGS\) de Salesforce\, una empresa de software de primer nivel\. [Their 8K](https://s23.q4cdn.com/574569502/files/doc_financials/2020/q4/CRM-Q4-FY20-Earnings-Press-Release-w-financials.pdf '8K') muestra un COGS total del 25\%\, que incluye todos los demás costes que Salesforce clasificaría en esa categoría [^4]\, no solo los costes de la nube\. Para tener el mismo margen que una Salesforce\, las empresas de IA no necesitarían tener otro COGS aparte de los costes en la nube\.

> Datos anecdóticos muestran que muchas empresas gastan hasta un 10\-15\% de los ingresos en el proceso de limpieza manual de datos y mantenimiento de precisión de datos\, normalmente sin contar los recursos principales de ingeniería\, y sugieren que el trabajo de desarrollo continuo supera las correcciones típicas de errores y añadidos de funcionalidades \- A16Z

Resulta que las empresas de IA sí tienen otros COGS\, gastando hasta un 15\% en procesos manuales de datos\. Los medios de comunicación convencionales se centran en las predicciones del aprendizaje automático\, [but data scientists spend more of their time on data collection and cleaning.](/writing/time 'ABP') Eso no va a desaparecer\, es decir\, **la mayoría de las empresas de IA son inmediatamente un 15\% menos rentables que una empresa de software\.** Eso también antes de cualquier otro COGS involucrado\, lo que implica que los márgenes brutos finales son aún menores\.

El atractivo de invertir en empresas de software es que los costes marginales son bajos\, por lo que un alto porcentaje de los ingresos incrementales se convierte en beneficio\. Las empresas de IA necesitan reducir ese porcentaje de COGS o esperar algún beneficio de escala para ser igual de atractivas\. ¿Es eso probable\?

> la potencia computacional de los chips GPU no ha crecido precisamente a buen ritmo \- Scott

La IA requiere [graphics processing units (GPUs) to do the computing.](https://www.nvidia.com/en-us/deep-learning-ai/solutions/ 'GPU') Sin embargo\, los recursos necesarios han crecido enormemente en comparación con el crecimiento de la potencia computacional\; La Ley de Moore no se aplica en el ámbito de la computación de IA\. No deberíamos esperar que ese 25\% de COGS por encima disminuya significativamente en un futuro próximo\.

> Dado que el rango de posibles valores de entrada es tan amplio\, cada nuevo despliegue de cliente probablemente generará datos que nunca se han visto antes \- a16z

> la mayoría de la gente no ha descubierto que los procesos orientados a ML casi nunca escalan como lo haría una aplicación más sencilla \- Scott

Compara vender Microsoft Office con vender una oferta de consultoría a una empresa\. En el primer caso\, puedes dar la misma copia de Office que has estado vendiendo a todas las demás empresas\. En el segundo\, tendrás que crear nuevos materiales adaptados a ese cliente [^5]\, lo que significa que siempre tendrás costes incrementales al obtener más ingresos\.

Si la IA es más parecida al segundo caso\, esto significa que no deberíamos esperar que el otro 15\% \(y cualquier otro COGS\) baje tampoco\. [That low margin still takes a lot of work to get. ](https://avc.com/2020/04/not-all-gross-margin-is-the-same/ 'AVC') **No solo las empresas de IA son menos rentables\, sino que deberíamos esperar que ese perfil de margen dure un tiempo**

### Foso

¿Merece la pena ese aumento de coste\? Ni a16z ni Scott parecen pensar así\:

> En el mundo de la IA\, la diferenciación técnica es más difícil de lograr\. \\\[\.\.\.\\\] Los datos son el núcleo de un sistema de IA\, pero a menudo pertenecen a los clientes\, están en dominio público o\, con el tiempo\, se convierten en una mercancía\. \- a16z

> Sé que\, desde una perspectiva empresarial\, algo absurdo como Naive Bayes o un modelo lineal podría resolver el problema del cliente tan bien como la última atrocidad de la red neuronal de gigavatios\. \\\[\.\.\.\\\] La gente no pagará un precio más frente a soluciones de ciencia de datos ad\-hoc internas a menos que representen resultados realmente revolucionarios\. \- Scott

Si el producto de una empresa no es realmente significativamente mejor\, tiene que llegar a ventas y marketing para diferenciarse\. **Esto implica costes aún más altos que una empresa de software típica\,** que ya está muy demandado en ventas\. Hace que uno se pregunte si el bombo en torno al aprendizaje automático está justificado o se usa para justificar la supervivencia de una empresa\.

No estoy seguro de cuál es el umbral para \"cambiar el juego\"\. Uno de mis lectores respondió tras la publicación de Vicki Boykis que daba a entender que consideraba significativa una mejora del 10\-15\% en la precisión [^6]\. Supongo que dependerá de la empresa\.

Si el producto en sí es una mercancía\, ¿quizás el mercado total sea grande\?

> Muchas empresas están descubriendo que la tarea mínima viable para los modelos de IA es más limitada de lo que esperaban\. \- a16z

> pero el palo de hockey necesario para el respaldo de capital riesgo y el ejército de doctores necesarios para que funcione no encajan bien con esos dominios limitados\, que tienen un mercado limitado\. \- Scott

Se piensa comúnmente que puedes simplemente aplicar aprendizaje automático a cualquier problema y mágicamente funcionará para ese problema y cualquier otro problema similar\. Desafortunadamente\, por ahora parece que muchos problemas aún no se mejorarán lanzando IA contra él\. Queríamos [Her](<https://en.wikipedia.org/wiki/Her_(film)> 'Her')\, en su lugar tuvimos Tinder\.

Si la IA tiene casos de uso limitados\, el mercado total al que puedes dirigir el producto de IA es mucho menor de lo que pensabas\. Considerando los VC [size of market as a key factor for investment,](https://bettereveryday.vc/how-to-prove-your-market-is-big-enough-to-vcs-d04059d93380 'size') esto parece un problema cuando las empresas de IA necesiten demostrar crecimiento en el futuro\.

### Empresas de servicios frente a empresas de software

> La mayoría de los sistemas de IA hoy en día no son exactamente software\, en el sentido tradicional\. Y los negocios de IA\, como resultado\, no se parecen exactamente a los negocios de software\. Implican soporte humano continuo y costes variables de materiales\. A menudo no escalan tan fácilmente como nos gustaría\. Y una fuerte defensabilidad —crítica para el modelo de software de \"construir una vez \/ vender muchas veces\"— no parece ser gratuita\. \- a16z

> Las empresas de servicios no se valoran como las de software\. A los capitalistas de riesgo les encantan los negocios de software\; trabajan duro desde el principio para resolver un problema\, imprimen dinero para siempre\. Por eso reciben valoraciones de ingresos de 10\-20 veces\. ¿Empresas de servicios\? ¿Por qué invertir en una empresa de servicios\? Su crecimiento está inherentemente limitado por costes laborales y problemas extraños y abordables de mercado\. \- Scott

![post](../../../blog/2020_04_29_her/her_1.webp)

Las empresas suelen valorarse en función de un múltiplo de algún indicador financiero como ingresos\, EBITDA o beneficio neto\. Las empresas de software suelen valorarse con un múltiplo más alto que las empresas de servicios\, por las razones mencionadas anteriormente\. [Higher gross margins matter, as described by Two Sigma](https://twosigmaventures.com/blog/article/why-gross-margins-matter/ 'Two')

Tanto a16z como Scott insinúan que **una empresa de IA es más parecida a una empresa de servicios y\, por tanto\, debería recibir un múltiplo de valoración más bajo que una empresa de software\.** Incluso si crees que obtendrán un múltiplo superior al doble de ingresos que obtienen los servicios\, las empresas de IA no deberían obtener los ingresos 10x que tienen las empresas de software tradicionales\, y en los que estas compañías de IA recaudaban dinero anteriormente\.

Esto probablemente será un problema para las empresas de IA que han subido a valoraciones altas y ahora les cuesta subir su siguiente ronda debido a que más personas se dan cuenta de los problemas anteriores\. Espero\, con un 60\% de certeza\, que empecemos a ver valoraciones más bajas de lo esperado para las rondas privadas de empresas de IA en fase avanzada\.

## La práctica de la inversión en valor por Li Lu

El socio de Warren Buffett\, Charlie Munger\, ha dado dinero a un forastero para que se encargue [only once in his life.](https://qz.com/work/1551328/the-only-person-besides-warren-buffett-who-charlie-munger-trusts-with-his-money/ 'Munger') Ese forastero es [Li Lu of Himalaya Capital.](http://himalayacapital.com/ 'Himalaya')

Fundada en 1998\, Himalaya es una firma de inversión en valor\, centrada en empresas de Asia con énfasis en China\. Típico de ese estilo de inversión\, parecen ser propietarios a largo plazo de empresas de calidad que se acumulan con el tiempo [^7]\. [They've historically taken a 0% management fee, and 25% carry after a 6% return hurdle.](https://www8.gsb.columbia.edu/valueinvesting/sites/valueinvesting/files/files/Graham%20%26%20Doddsville%20-%20Issue%2018%20-%20Spring%202013_0.pdf 'Graham') Esto es poco habitual en la industria de la inversión y demuestra lo confiados que están en generar rendimientos anuales [^8]\.

Como Li Lu está centrado en China\, hay menos entrevistas con él que con otros inversores famosos\. Graham de Longriver recientemente [translated a 9,000 word speech outlining Li Lu's investment philosophy,](https://www.longriverinv.com/blog/the-practice-of-value-investing-by-li-lu 'Longriver') que resumiré a continuación [^9]\.

Li Lu habló de cuatro conceptos básicos de inversión en valor\: la diferencia entre invertir y especular\, los círculos de competencia\, el temperamento del inversor y lo que la persona promedio puede hacer para aumentar su riqueza\. Descubrí que la mayoría de estos pueden agruparse dentro de sus cuatro conceptos\, que son\:

1. Las acciones representan una copropiedad de un negocio

2. El mercado es una guía\, y depende de ti aceptarlo o rechazarlo

3. Invertir se basa en la probabilidad y en un margen de seguridad

4. Construye un círculo de competencia y mantente dentro de él

### Li Lu\: Las acciones representan una copropiedad

El concepto de comprar una acción como comprar la propiedad de la empresa es común entre los seguidores del estilo de inversión en valor de Buffett\. En lugar de ver una acción como un número\, Li Lu lo ve como una responsabilidad\. Esto contrasta con los fondos de cobertura largo\/corto\, que operan más en catalizadores de sentimiento y precios\, o con fondos cuantitativos que operan en quién sabe qué [^10]\.

> ya no intentaban adivinar los futuros resultados de la Compañía de las Indias Orientales\; simplemente intentaban adivinar el comportamiento de otras personas que compraban y vendían acciones\.

Li Lu habla sobre la historia del mercado de valores\, que se creó inicialmente para permitir que las empresas recaudaran capital para financiar su crecimiento\. Luego aprovechó la naturaleza de juego de la humanidad para convertirse no solo en una apuesta sobre el futuro de la empresa\, sino en una apuesta sobre lo que piensas que otros piensan sobre el futuro de la empresa\. Esto es similar a la [Keynesian beauty contest](https://en.wikipedia.org/wiki/Keynesian_beauty_contest 'contest') concepto\.

> Esta es la mayor diferencia entre invertir y especular\: al final\, el resultado neto de toda especulación es cero\. Por supuesto\, habrá algunas personas que ganen un poco más\; y otras que se tomen por tontas sin ninguna posibilidad de hacerse ricas\. Pero con el tiempo\, toda especulación termina en un resultado de suma cero\. Por lo tanto\, debido a su enfoque en el comportamiento a corto plazo\, los especuladores no tienen absolutamente ninguna influencia en el crecimiento económico ni en los beneficios de una empresa\.

Hace una distinción entre invertir y especular\, situando a quienes pronostican el rendimiento de las empresas en la primera categoría como inversores\, y a quienes predicen cómo reaccionan otros en la segunda como especuladores\. A los inversores les importan los fundamentos de las empresas y el largo plazo\, a los especuladores les importa el sentimiento y el corto plazo\. En su opinión\, la mayoría de los fondos de inversión actuales se clasificarían como especuladores\.

No estoy de acuerdo con Li Lu sobre la influencia de los especuladores\, y sí creo que los especuladores pueden influir en el comportamiento de las empresas\, ya sea mediante inversión activista o reuniones más regulares de inversores\. Vemos que las empresas toman decisiones constantemente que se deben directamente a la presión de los accionistas\, como [fire CEOs,](https://www.nytimes.com/2020/01/10/business/boeing-dennis-muilenburg-severance.html 'CEO') [divest businesses,](https://faculty.wharton.upenn.edu/wp-content/uploads/2005/11/Activist-Impelled.pdf 'Divest') o [sell the company.](https://corpgov.law.harvard.edu/2019/10/11/recent-trends-in-shareholder-activism/ 'Sell')

Sin embargo\, esto no quita a su punto general\, que **especular\, tal y como él lo define\, es de suma cero\.** Cuando superas a una empresa por problemas no relacionados con el crecimiento fundamental de la empresa\, otra persona en el otro lado de esa operación ha tenido un rendimiento inferior\. Si tienes mejores rendimientos que el mercado\, alguien más está teniendo un peor día\.

### Li Lu\: El mercado es una guía

> Sin embargo\, en su mayor parte\, puedes simplemente ignorarle\. Pero cuando Mr\. Market se altera muchísimo —ya sea emocionado o deprimido— puedes usarlo para comprar y vender\.

Habla sobre [the popular anecdote of Mr Market,](https://fs.blog/2013/11/mr-market/ 'Market') Lo que pone de manifiesto cómo la bolsa puede verse como algo que te grita un precio continuamente\. Depende de ti decidir cuándo comprar y vender\, y es mejor ignorar el precio de mercado la mayor parte del tiempo\. No tienes prisa\; la actividad es el enemigo\.

> Cuando estás en la universidad y oyes hablar de inversión en valor\, piensas que no debería ser gran cosa ponerlo en práctica\. Pero en cuanto llegas al trabajo\, te das cuenta de que hay personas reales al otro lado de cada transacción\. Son superiores a ti en todos los aspectos y no se parecen en nada al señor mercado de Graham\. Así que\, después de un tiempo\, tras que tu jefe te regañe continuamente\, sentirás que el señor mercado y esas personas son mejores que tú\. Empezarás a tener dudas\.

Invertir en valor es mucho más difícil en la práctica\, ya que haces menos operaciones\. Una cosa es decir que eres una persona disciplinada\; otra muy distinta es resistirse a comprar opciones en tu cuenta de Robinhood cuando oyes que tus amigos ganaron 10\.000 dólares en un día leyendo [r/wallstreetbets.](https://www.dailydot.com/debug/wall-street-bets-reddit-jartek/ 'Reddit') Cuando todos a tu alrededor ganan dinero rápidamente\, es casi imposible seguir una estrategia menos emocionante\.

Esto es más fácil de hacer cuando adoptas la mentalidad del propietario mencionada antes\. Si compraras acciones con la misma actitud que tuviste al comprar una casa\, serías más diligente y sensato a la hora de comprar\.

### Li Lu\: Probabilidad y margen de seguridad

> Lo más importante en la inversión es predecir el futuro\, pero el futuro es inherentemente impredecible\. Por tanto\, invertir se trata de probabilidad y de un margen de seguridad\.

Invertir como una cuestión de probabilidad es un concepto con el que la mayoría de los profesionales estarían de acuerdo\, independientemente del estilo\. Incluso los mejores inversores tienen una tasa de acierto en el rango del 50\-60\%\, lo que significa que se equivocan muchas veces [^11]\. En lugar de apostar al 100\% por un solo nombre\, piensan en términos de invertir en una cartera de nombres\, evaluando cada puesto según lo que creen que son las probabilidades de éxito de cada empresa\.

El concepto de margen de seguridad no es tan universal\, y es más típico de los inversores de valor\. Esta es la idea de que por cada inversión que hagas\, deberías hacerlo a un precio que aún te dé suficiente margen en caso de que haya descensos inesperados\. Si puedes encontrar suficiente margen de seguridad en una inversión\, merece la pena considerarlo\. Si no puedes obtener suficiente margen de seguridad\, no deberías invertir\.

### Li Lu\: Círculo de competencia

Li Lu cuenta una larga historia sobre cómo empezó a invertir tras escuchar a Buffett hablar [^12]\. Empezó a leer más escritos de Buffett\, a investigar empresas y a visitarlas en el lugar cuando podía\, incluso cuando lo único que podía hacer era hablar con el guardia de seguridad\. Al hacerlo\, descubrió cuatro lecciones para desarrollar un círculo de competencia\:

> La primera lección fue que las acciones representan una propiedad parcial en un negocio

> El segundo punto es que\, cuando empiezas a mirar las cosas desde el punto de vista de un propietario\, tu comprensión del negocio será completamente diferente

> Cuando los analistas se incorporan a nuestra empresa\, lo primero que hacemos es enviarlos a estudiar algunas empresas\. Les pedimos que supongan que un tío que nunca han conocido antes ha fallecido y les ha dejado el negocio\. ¿Qué deberían hacer\? De repente heredan este activo pero no tienen ni idea de qué es\. Debes convocar una reunión del consejo y participar en la discusión\. Este es el modelo mental que les pedimos que utilicen cuando realicen su investigación\.

Popularizado por Buffett\, la idea de un círculo de competencia es que debes desarrollar un conocimiento profundo de una industria o problema\. También debes entender dónde están los límites de tu conocimiento y no sobrellevarte\.

Estas dos primeras lecciones son similares al punto anterior sobre ver las participaciones como parte de la empresa\. Independientemente de lo grande que sea tu participación en la empresa\, Li Lu dice que deberías verte a ti mismo como un propietario total\. Esa mentalidad te motivará a seguir queriendo saber todo lo posible sobre la empresa y entender qué decisiones son buenas o malas para el futuro de la empresa\. Dedicar tanto tiempo a un solo nombre limita naturalmente la cantidad de empresas que puedes consultar\, lo que reducirá tu círculo de competencias\.

> El tercer punto es que el conocimiento es efectivamente acumulativo\, pero siempre debes mantener la honestidad intelectual

De nuevo\, coincido en que esto es importante pero difícil de hacer\. ¿Cuándo fue la última vez que cambiaste de opinión sobre un tema no trivial\?

> Lo último es que dejes que tu pasión sea tu guía\. No escuches lo que piensen los demás de ti\. No tienen nada que ver contigo\. Acepta que tu círculo de competencia será pequeño y no te preocupes por todo lo demás\. Ganar dinero no depende de cuánto sepas\; depende de si lo que sabes es correcto o incorrecto\. Si lo que sabes es correcto\, no perderás dinero\.

Esto contrasta con cómo funcionan muchos otros fondos de inversión en la práctica\, donde normalmente quieren que los analistas de inversión aumenten su cobertura de nombres y sectores industriales con el tiempo\. Es difícil decirles a los socios limitados de tu fondo \(los que te dan su capital para invertir\) que no estás haciendo ningún cambio en la cartera y que te gustan los nombres en los que ya estás\. Si sigues así el tiempo suficiente\, se preguntarán por qué te pagan por no hacer nada\. Por eso\, para muchos fondos hay un incentivo para operar activamente dentro y fuera de nombres\, y cuanto mayor sea el conjunto de nombres que conoces\, mejor\. Esto funciona en algunos lugares y no es el estilo de Li Lu\.

### Li Lu\: Reflexiones finales sobre la inversión en valor

> Esta profesión no exige que seas especialmente inteligente\, ni que tengas un alto CI o las mejores credenciales académicas

Li Lu describe los atributos que hacen a un inversor exitoso\, que son\:

1. La persona debe ser independiente y no preocuparse por las evaluaciones de los demás

2. La persona debe ser objetiva y estar siempre dispuesta a aprender

3. La persona debe tener tanto una paciencia extrema como una gran determinación cuando surgen grandes oportunidades

4. La persona debe estar interesada en cómo funcionan las empresas

Teniendo en cuenta los conceptos fundamentales de inversión en valor mencionados anteriormente\, estas características del inversor tienen sentido\. Para un fondo largo o corto típico\, se preocuparían menos por \(3\)\. Un fondo cuantitativo típico probablemente se preocuparía menos por \(4\)\.

> El mayor tabú para los inversores es ser como Newton y dejarse seducir por el mercado\: comprar en el pico más caliente del mercado y vender en su momento más deprimido\. Si no participas en la especulación y te limitas estrictamente a invertir en lo que entiendes\, no perderás dinero\.

> Lo mejor y más importante es disponer de un tiempo suficiente para poder componerse\. Nuestro consejo para la persona promedio es que solo hagas lo que entiendas y que te mantengas alejado de todo lo demás\.

Dado su historial como inversor en valor a largo plazo\, no es de extrañar que defienda el crecimiento de la riqueza lentamente mediante la composición a largo plazo\. Sin embargo\, no todo el mundo tiene la paciencia suficiente para hacerlo\.

La inversión en valor es una forma de ganar dinero\, y existen muchas otras formas que han tenido éxito durante distintos periodos de tiempo\. [Renaisssance seems to print money,](https://en.wikipedia.org/wiki/Renaissance_Technologies 'Ren') por ejemplo\, y no hacen nada remotamente relacionado con la inversión en valor mencionada anteriormente\. Si decides seguir con la inversión en valor\, el historial de Li Lu habla por sí mismo\. Piensa como un propietario\, evita operar por el simple hecho de hacerlo y sabe en qué eres bueno\.

## Compensaciones

[Efficiency vs Resilience.](https://en.wikipedia.org/wiki/O-ring_theory_of_economic_development 'O ring')

[Optionality vs Certainty.](https://nesslabs.com/optionality-fallacy 'Option')

Escribir tu publicación del boletín según lo programado el fin de semana frente a ver Peaky Blinders medio borracho y luego tener que desvelarte hasta tarde entre semana [^13]\.

En la vida\, nos enfrentamos a compensaciones todo el tiempo\.

**Si alguien te dice que no hay intercambio por algo\, o es ingenuo o está intentando venderte algo\.** De cualquier manera\, probablemente lo mejor sea evitarlos\.

Las empresas funcionan eficientemente no tienen redundancias\. Eso ahorra costes\, hasta que todo se estropea\. Pero tampoco puedes tener copias de seguridad para todo\, ya que será exorbitantemente caro\.

Dejar opciones se abre significa que tienes flexibilidad\. Eso funciona hasta que te das cuenta de que has vivido tu vida con todas las opciones y nunca te conformas con nada\. Pero tampoco deberías decidir un camino sin tener un plan B\.

En todas las decisiones importantes que tomamos\, deberíamos\:

1. aprender cuáles son los compromisos explícitos e implícitos\, y

2. mejorar nuestro proceso para elegir entre ellos

En la primera\, escribir explícitamente lo que estás renunciando\, como con un [decision journal,](https://fs.blog/2014/02/decision-journal/ 'FS') puede ser útil\. Hacerlo también [premortems](/writing/premortem 'pre')\. El acto de reflexionar completamente sobre el escenario suele poner de relieve preocupaciones de las que solo eras vagamente consciente\.

Otra forma sería pedir consejo a otros\, especialmente a quienes han tenido que tomar una decisión similar en un contexto similar\. Podrán señalar preocupaciones o arrepentimientos clave que hayan tenido\. Sin embargo\, este tipo de consejos son muy variables y pueden ir desde útiles hasta directamente perjudiciales\. Lo que puede ser arriesgado para alguien puede ser seguro para otro\.

En el segundo\, depende de ti decidir qué framework quieres usar\. Puedo hablar de eso [optimal stopping theory](https://www.americanscientist.org/article/knowing-when-to-stop 'optimal')\, [game theory](https://plato.stanford.edu/entries/game-theory/ 'game')\, o planificación de escenarios\, pero la mayoría de la gente encontrará algo que funcione para sí misma\. Mientras tengas un marco y lleves un registro\, deberías estar bien\.

Mejorar tanto en el paso 1 como en el paso 2 conducirá a una mejor toma de decisiones\.

He llegado a la conclusión de que\, a corto plazo\, es más fácil mejorar el paso 1\, así que estoy trabajando para poder acelerar ese proceso más rápido manteniendo la efectividad\. Es más difícil mejorar el paso 2\, que será un proyecto a largo plazo para hacer seguimiento y evaluación de decisiones a lo largo del tiempo\. El proceso de mejorar ambos pasos también te llevará a entender mejor qué valoras\.

Nos enfrentamos a compensaciones todo el tiempo\, simplemente no nos gusta pensar en ellas\. Desafortunadamente\, olvidarlas no hace que desaparezcan\. Exponer explícitamente lo que estás renunciando en el proceso de una decisión importante ayudará a reducir el arrepentimiento en el futuro\.

## Otros

1. [A tale of two talebs.](https://medium.com/@allenfarrington/a-tale-of-two-talebs-1775dff3302b 'Taleb') Lo recomiendo mucho\, tanto si amas como si notaste a Nassim Taleb\.
2. \"son los hogares de bajos ingresos los que más sufrirán por el Covid\-19\, y como tienden a gastar la mayor parte de sus ingresos\, el impacto en sus ingresos reducirá la cuota de consumo del PIB\,\" [Michael Pettis twitter thread on how imbalances in the economy will be resolved.](https://twitter.com/michaelxpettis/status/1253217553083707393 'Pettis')
3. ["While Microsoft made $100M it shrunk the \[encyclopedia\] market by over $600M. For every dollar of revenue Microsoft made, it took away six dollars of revenue from their competitors."](https://redeye.firstround.com/2006/04/shrink_a_market.html 'MSFT') Crédito [Brett Bivens](https://venturedesktop.substack.com/ 'Brett')
4. \"Long Bets se fundó en 2002 como una forma de fomentar predicciones más responsables sobre el futuro\.\" Este es el mismo grupo que administró la apuesta Warren Buffett vs Hedge Fund\. [This post looks at predictions for 2020](https://medium.com/the-long-now-foundation/our-long-bets-and-predictions-about-02020-736cf08efcd6 '2020')
5. ["Can the teardrops that fall after reading bad science writing generate renewable electricity? Yes, they can."](https://eighteenthelephant.com/2020/02/12/can-the-teardrops-that-fall-after-reading-bad-science-writing-generate-renewable-electricity-yes-they-can/ 'teardrops')

[^1]: La gente diría [machine learning is a subset of AI](https://towardsdatascience.com/clearing-the-confusion-ai-vs-machine-learning-vs-deep-learning-differences-fce69b21d5eb 'ML')\, usaré los términos indistintamente aquí por conveniencia\, ya que parece que los principios se aplican en ambas áreas\; Scott los separaría\. \"La intención del aprendizaje automático es permitir que las máquinas aprendan por sí mismas usando los datos proporcionados y hagan predicciones precisas\.\"

[^2]: Crédito [Daniel McCarthy on twitter](https://twitter.com/d_mccar/status/1237738926086987777?s=20 'Daniel')

[^3]: Las operaciones en la nube aquí incluyen entrenar el modelo de IA\, la inferencia del modelo y la transferencia de datos

[^4]: PDF pág\. 6 sobre su cuarto trimestre 8K del año fiscal 20\. También ten en cuenta que para simplificar he hecho COGS wholeco\, que incluye el negocio de servicios profesionales menos rentable\. Si aceptas el COGS solo por suscripción\, tienen márgenes brutos del 80\%\.

[^5]: O quizá simplemente encuentres y reemplaces el nombre de la empresa y los logotipos en la baraja\, ¿quién soy yo para juzgar\?

[^6]: Formaba parte de una respuesta más larga sobre cómo encontrar el equilibrio entre tecnología y negocio que merece su propia publicación\, y lo haré en el futuro\. Su conclusión fue elegir entre 3 enfoques\: 1\) La tecnología puede dictar el negocio si demuestra una mejora en las métricas acordadas 2\) Empezar menos atractivo pero arreglar con el tiempo 3\) Crear un espacio específico para experimentar\, como la regla del 20\% de Google

[^7]: \"Adoptamos los principios de inversión en valor de Benjamin Graham\, Warren Buffett y Charles Munger\, y hoy en día nos centramos principalmente en empresas cotizadas en Asia\, con especial énfasis en China\. Nuestro objetivo es lograr rendimientos superiores siendo propietarios a largo plazo de empresas de alta calidad con un \"foso económico\" considerable\, un gran potencial de crecimiento y gestionados por personas de confianza\. Algunas de nuestras participaciones se remontan a nuestra creación hace veinte años\.\"

[^8]: La mayoría de las firmas de inversión cobran una comisión de gestión por los activos invertidos con ellas y luego una comisión de rendimiento por los rendimientos de los activos\. Una estructura típica de comisiones es \"2 y 20\"\, es decir\, una comisión de gestión del 2\% y una del 20\%\. Si aportas 1000 \$ y crecen a 1200 \$\, asumiendo que la comisión de gestión se descuenta de los valores de fin de periodo\, la comisión de gestión sería de 24 \$ \(2\% \_ 1200 \$ \- 1000 \$ \) \(20\% \_ \(1200 \$ \- 1000 \$\)\)\. Compárese esto con el modelo de comisiones de Li Lu\, que solo acepta comisiones de rendimiento después del primer 6\% de rentabilidad\. Aquí no habría comisión de gestión\, y la comisión de desempeño sería de 47 \$ \(25\% \_ \(1200 \$ \- 6\% \_ 200 \$\)\)\. Es un secreto a voces que muchas firmas de inversión viven de las comisiones fijas de gestión que hacen crecer sus activos bajo gestión en lugar de rendimiento\. El modelo de Li Lu sería más beneficioso para él si creyera que puede obtener altos rendimientos\, y menos beneficioso si lo hace mal\.

[^9]: Creo que es el mismo discurso [previously translated on gurufocus,](https://www.gurufocus.com/news/997607/notes-from-li-lus-latest-speech-at-peking-university 'guru') y la versión de Graham parece más completa\. He revisado \(muy\) brevemente la traducción y parece precisa\, pero obviamente no puedo garantizar completamente la pieza\. El original sí [here](https://xueqiu.com/6026781624/137223946 'original')

[^10]: Un fondo de cobertura largo\/corto es un tipo popular de fondo de inversión que compra \(compra en posición larga y cubre eso vendiendo en corto \(vendiendo\) otras\. Un fondo cuantitativo es otro estilo popular que utiliza principalmente algoritmos para tomar decisiones de inversión\. Sí\, probablemente usan ML\.\.\.

[^11]: No encuentro la fuente de esta estadística\, y se sabe que incluso los mejores inversores aciertan entre el 50 y el 60\% de las veces\. Ganan calculando sus apuestas de forma adecuada y haciendo que sus ganadores cuenten

[^12]: \"En el pasado\, mi comprensión del mercado de valores era básicamente que estaba lleno de malos\. Pero el señor Almuerzo Gratis \\\[Buffett\] no se parecía en nada a ellos\. Era muy inteligente y lo que decía era ingenioso y perspicaz\. Pude entender sus principios en cuanto los escuchaba\. Y sentía que lo que hacía era algo que yo también podía hacer\.\" Curiosamente\, no se menciona a Buffett en [this 1998 profile of Li Lu](https://observer.com/1998/05/tiananmen-square-to-wall-street-li-lu-hits-the-new-york-jackpot/amp/ 'Li Lu')\, ¿así que quizá la historia sea marketing\?

[^13]: El autor quiere enfatizar que estos son ejemplos hipotéticos\, abstractos\.
