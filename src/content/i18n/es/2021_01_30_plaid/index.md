---
title: "Plaid y el poder de las APIs"
description: "Plaid abstrae la aburrida fontanería financiera, permitiendo que otros innoven más rápido."
pubDate: 2021-01-30
category: Technology
tags: ['startups', 'software']
featured: false
heroImage: '../../../blog/2021_01_30_plaid/plaid_3.webp'
locale: 'es'
sourceSlug: 'plaid'
sourceHash: 'daae66d786d14dbfb4c0c831358b5f6fed3ca4b971461b077f61a7895375e9cd'
---

## Conclusión

Plaid es una empresa de tecnología financiera que ayuda a otras empresas a conectarse con datos bancarios\. Al hacer cosas aburridas que otros no quieren hacer\, la vida es más cómoda para todos y se convierte en un producto muy pegajoso\.

## 1\. Abstraer capas de trabajo

Hablaré sobre la empresa de tecnología financiera [Plaid](https://plaid.com/ 'plaid') hoy\. Antes de eso\, ayudaría tener algo de intuición sobre abstracción e interfaces de programación de aplicaciones \(APIs\)\. Dedicaré la sección 1 a abstracción y la sección 2 a APIs\; salta a la sección 3 si ya conoces esos conceptos\. Como siempre\, prefiero pecar de ser menos preciso técnicamente para facilitar la comprensión\.

Primero hablaremos de la abstracción\:

Supongamos que tienes una idea revolucionaria para ganar mucho dinero\. Codificas tu app de tal manera que cada vez que alguien pulsa la tecla F2 del teclado\, ocurran cosas y obtiene beneficios\:

![plaid](../../../blog/2021_01_30_plaid/plaid_1.webp)

Lo pruebas en tu portátil\, todo funciona bien y empiezas a ganar dinero\. Funciona tan bien que se lo cuentas a todos tus amigos\, que también quieren participar\. Les envías el código y les dices que sigan adelante y prosperen\.

Uno de tus amigos \(el hipster pesado\) te dice que el código no funciona en su Mac\, y está triste porque no puede ganar dinero para su próxima taza de café de origen único de un solo barril\. Te preguntas por qué\, y vas a solucionar el código\.

Resulta que los Macs tienen esto raro [Touch Bar thing](https://support.apple.com/en-gb/guide/mac-help/mchlbfd5b039/mac 'touch') para teclas de función\, cuyo único propósito parece ser hacer la vida imposible\. Añades código especial para usuarios de Mac\:

![plaid](../../../blog/2021_01_30_plaid/plaid_2.webp)

Ahora le funciona\, y pasa a [suing magazines for saying all hipsters look alike.](https://www.independent.co.uk/news/media/hipster-magazine-photo-lawsuit-mit-technology-review-a8813941.html 'hipster')

Otro amigo pregunta si también puedes soportar móviles para ganar dinero en cualquier lugar\. Otra persona pregunta si puedes añadir soporte para Blackberry\. Y otro más quiere saber cuándo estará disponible la app para el [KFC gaming console](https://www.bbc.com/news/business-55433318 'kfc')\.

Mientras te enfrentas a estas tareas de añadir más código para todos los diferentes dispositivos informáticos que existen\, empiezas a desesperarte\. ¿Por qué no puede ser tan fácil ganar dinero como pulsar un botón\? **Solo quieres escribir tu código una vez y luego poder usarlo en varios dispositivos\.**

La idea anterior es en realidad un problema común en informática \(soporte para múltiples dispositivos\, no para ganar dinero\)\. Si escribes software que está pensado para hacerlo todo\, tendrás que tener en cuenta todos los posibles dispositivos de usuario final\. Después de que tu código se traduzca a binario \(1s y 0s\)\, debe seguir haciendo lo mismo\. Cada dispositivo tiene sus peculiaridades\, y pasarás más tiempo lidiando con excepciones que escribiendo la funcionalidad principal\.

A finales de los 90 la gente descubrió una solución para esto\: añadir una capa adicional intermedia\, es decir\, **Haz que sea problema de otro\.** [As Shimon Schocken explains,](https://www.youtube.com/watch?v=E28KczysecE 'Shimon') Tener un \"intermediario\" ahora simplifica tu tarea\. En lugar de escribir código para todos los dispositivos posibles\, \"escribes una vez\, ejecutas en cualquier sitio\" y dejas que ese intermediario se encargue de hacer tu código compatible [^1]\:

![plaid](../../../blog/2021_01_30_plaid/plaid_3.webp)

**Dividir una tarea grande en tareas más pequeñas facilita las cosas para todos\.** Has abstraído parte del problema\, ya que quieres escribir código \"de alto nivel\" y no preocuparte por errores específicos de implementación\. A otros les pueden gustar los detalles de implementación \"de bajo nivel\"\, pero no quieren programar las aplicaciones encima\. De cada uno según su capacidad\, a cada uno según sus necesidades y todo ese rollo\.

Volveremos a esta idea de abstracción\, que permite a la gente **Concéntrate solo en partes concretas de una tarea\.**

Ahora\, supongamos que tú y tus amigos queréis poner todo ese dinero en bancos de todo el mundo\. Cada banco tiene procedimientos distintos y te echarán si no sigues sus normas\:

- La ubicación de Nueva York solo quiere que digas tu número de cuenta\, contraseña y pedido\, [banning you if you talk too much](https://www.youtube.com/watch?v=euLQOQNVzgY 'soup')
- La ubicación de San Francisco no te servirá a menos que pongas al menos 5 pegatinas de la empresa en tu portátil
- La sede de Singapur quiere saber cuándo esperas casarte y tener hijos por el bien del país

A la mayoría del grupo no le gusta memorizar todas estas reglas\, pero April es una excepción\. Disfruta manejando opciones esotéricas\, ofreciéndose voluntaria para tratar con todos los bancos en nombre del grupo\. Sin importarle cómo ocurren las transacciones\, sino solo que ocurran\, el grupo la deja encargarse de todo\.

Algunos conocidos de un retiro psicodélico en el que participaste se enteran de vuestro acuerdo\. Tampoco les gusta tratar directamente con sus bancos y quieren saber si April puede ayudarles también\. Ella está encantada de hacerlo\, siempre que le paguen una pequeña tarifa\. La noticia se corre y pronto todos llaman a April como intermediaria\.

Volvemos a ver que a la gente le importaba más **Una parte de una tarea mayor** \- Los depósitos y retiradas\. A la gente no le importa por qué le gusta esto a April o cómo lo recuerda todo\, solo que lo haga\. Tener una April hace la vida más cómoda\.

Por último\, supongamos que quieres comprobar el saldo de tu cuenta\, solo para confirmar que April no está malversando el dinero para pagar comisiones de servicio ocultas en su AirBNB de alquiler\. Empiezas a escribir los depósitos recientes en una hoja de cálculo\:

![plaid](../../../blog/2021_01_30_plaid/plaid_4.webp)

Siendo programador\, desprecias Excel y no estás familiarizado con sus funciones\. Eso sí\, conoces el signo \"\+\" para añadir cosas\, y empiezas a calcular manualmente tu saldo así\:

![plaid](../../../blog/2021_01_30_plaid/plaid_5.webp)

Cien celdas y una hora después\, estás a punto de terminar\, cuando un amigo te pregunta qué estás haciendo\. Entonces te explica que la función suma\(\) hace lo que quieres\:

![plaid](../../../blog/2021_01_30_plaid/plaid_6.webp)

También te cuentan todo el proceso **\"Biblioteca\" de funciones** Que Excel tiene que ayudar a que las matemáticas sean más fáciles\, como AVG\(\)\, Count\(\)\, etc\. Lo interesante es que puedes esperar el mismo comportamiento para esa función\, independientemente del dispositivo que uses\: tu portátil con Windows\, el Mac de tu amigo\, el móvil de tu padre\. Una vez que sepas qué hace la función y cómo llamarla\, puedes ahorrar tiempo\. No te importa cómo lo haga Excel\, solo que funcione en todas partes\, todo el tiempo\.

Abstraer diferentes capas de trabajo **Aumenta las posibilidades y oportunidades en cada capa\.** La persona que programó sum\(\) no quiere gastar su tiempo sumando tus depósitos por ti\. Tampoco quieres programar la función sum\(\)\. La gente se centra en la parte en la que quiere trabajar\. No hacer todo permite que la gente cree muchas cosas\.

**El concepto de abstracción también se aplica fuera de la programación\.** Todos trabajamos en una \"capa\" de un problema\, confiando en que todo lo que hay debajo es fiable\. Estás leyendo esto en tu correo\, sin importarte cómo funcionan los servicios de correo\, solo que se comporten de forma previsible\.

## 2\. Interfaces de programación de aplicaciones como contratos

Ahora estamos listos para pensar en las Interfaces de Programación de Aplicaciones \(APIs\)\. Imagina que programaras una biblioteca de funciones matemáticas\, como sum\(\) en lo anterior\. **¿No sería conveniente si pudieras usar esas funciones en otros programas\?**

Y si puedes hacer que esa biblioteca sea accesible para todos\, otros podrían usarla para crear sus propias cosas interesantes\. Puedes centrarte en crear tus funciones matemáticas\, y otros pueden centrarse en crear aplicaciones que recurran a la funcionalidad de tu biblioteca según sea necesario\.

Como [Joshua Bloch](https://www.youtube.com/watch?v=LzMp6uQbmns 'Josh') señala que\, ya en 1952\, a la gente le gusta [David Wheeler](<https://en.wikipedia.org/wiki/David_Wheeler_(computer_scientist)> 'David') [^2] ya proponían esta idea de [having libraries of functions (sub-routines)](http://www.laputan.org/pub/papers/Wheeler.pdf 'wheeler')\:

![plaid](../../../blog/2021_01_30_plaid/plaid_7.webp)

**Llamaremos a esa biblioteca de funciones una API [^3]\.** Joshua cree que el término se usó por primera vez en [a 1968 paper by Ira Cotton and Frank Greatorex:](https://www.computer.org/csdl/pds/api/csdl/proceedings/download-article/12OmNyRPgFZ/pdf 'ira')

![plaid](../../../blog/2021_01_30_plaid/plaid_8.webp)

Ese uso toca los conceptos que discutimos en nuestros ejemplos\:

- **Abstracción\.** No te importa cómo funcionan las funciones matemáticas\, solo que funcionen\. Dividir la tarea grande abre posibilidades para trabajos interesantes en cada capa
- **Independencia del hardware\.** Podemos usar la API independientemente del dispositivo que usemos\, esperando que sea la que gestione la integración
- **Reutilizabilidad\.** La biblioteca puede usarse para varias personas que quieren cosas diferentes

Nuestra API es una **Contrato bien definido**\, indicándonos las entradas requeridas y las salidas esperadas\. Por ejemplo\, queremos que la función suma\(\) siempre devuelva el total de las entradas\, y no el total en algunos casos y la media en otros\.

También **no podemos esperar que nuestras APIs hagan nada fuera del contrato\.** Por ejemplo\, sum\(\) funciona en Excel\, pero make\_me\_money\(\) no\, a menos que el creador de Excel lo haga en código para esa función\.

Y nosotros **confiar en que la API estaba programada correctamente\,** habiendo pasado por pruebas rigurosas\. Por ejemplo\, la función sum\(\) debería darnos el mismo resultado en el mismo conjunto de datos cada vez\.

Imagina la vida sin APIs\. Tendrías que empezar de cero cada vez que programaras algo\, y también tendrías que tener en cuenta todos los posibles escenarios del usuario final\. Sería como [making a sandwich from scratch](https://www.smithsonianmag.com/smart-news/making-sandwich-scratch-took-man-six-months-180956674/ 'sandwich')\.

## 3\. Plaid como API

Hemos establecido qué son las APIs y por qué son importantes\. Ahora\, ¿qué hace Plaid\?

Para quienes no lo sepan\, Plaid es una empresa de tecnología financiera que fue [supposed to be bought by Visa for $5bn](https://www.justice.gov/opa/pr/visa-and-plaid-abandon-merger-after-antitrust-division-s-suit-block 'plaid')\, antes de abandonar la adquisición por problemas antimonopolio\. A diferencia de mi vida amorosa\, ser rechazado realmente los hizo _más_ valiosos\, y ahora son [rumoured to be raising money at $15bn.](https://www.theinformation.com/articles/plaid-shareholders-field-offers-at-15-billion-after-merger-collapse '15')

¿Recuerdas cómo abril iba entre tú y los bancos\? Piensa en abril como una API\.

**Plaid es la API entre bancos y cualquier otro que quiera usar datos bancarios\.** Permiten a sus clientes crear aplicaciones sobre sus APIs\, sin preocuparse por el trabajo de integración entre bastidores que se requiere\. Y es mucho trabajo\.

Supongamos que estás construyendo una app de presupuesto que necesita acceso al historial de gastos de los usuarios\. Si usaras tu propio código para conectar con los bancos\, tendrías que escribir secciones nuevas enteras cada vez que se añada un nuevo banco\. Probablemente dedicarías más tiempo a eso que a las funciones principales de tu app\, dado que los nuevos estándares cambian constantemente\.

![plaid](../../../blog/2021_01_30_plaid/plaid_9.webp)

Plaid puede proporcionarte APIs que siempre funcionarán\, y también una interfaz de usuario que el usuario verá al conectarse a un banco [(Plaid Link).](https://plaid.com/docs/link/ 'link') Tu problema se ha convertido en el suyo\.

Echaremos un vistazo a cómo es esto siguiendo la guía de inicio rápido de Plaid [here](https://plaid.com/docs/quickstart/ 'quickstart')\. Te da algunos archivos para configurar una app de demostración en tu propio ordenador\.

Tras un día de diagnóstico\, varios reinicios del ordenador e instalar a ciegas lo que parecían todos los programas posibles [^4]\:

![plaid](../../../blog/2021_01_30_plaid/plaid_10.webp)

Por fin conseguí que algo funcionara\, conectándome con una cuenta bancaria de prueba\:

![plaid](../../../blog/2021_01_30_plaid/plaid_11.webp)

Esto me permitió consultar datos ficticios como el saldo de mi cuenta bancaria\:

![plaid](../../../blog/2021_01_30_plaid/plaid_12.webp)

O datos recientes de transacciones\:

![plaid](../../../blog/2021_01_30_plaid/plaid_13.webp)

Si yo ~~quería~~ sabía cómo hacerlo\, podía seguir desarrollando una app financiera de esta manera\. La app usaba la API de Plaid para extraer datos de saldo\, registrar una transacción y actualizar el saldo\. Pero en ese momento me encontré con más errores y ~~Rendido~~ lo dejó para otro momento\.

Si estuviera construyendo una empresa\, te puedes imaginar el tiempo ahorrado dejando que Plaid haga todo el trabajo financiero básico por mí\. No quiero estar trabajando en el problema de integración bancaria que está una capa abajo\; eso no me emociona\. Prefiero trabajar en hacer la brillante ruleta de trading de acciones encima para estafar el dinero de la gente\; eso es [doing god's work](https://dealbook.nytimes.com/2009/11/09/goldman-chief-says-he-is-just-doing-gods-work/ 'god')\.

Si piensas en la mayoría de las empresas hoy en día como \"tecnológicas\"\, y también piensas en cuántas de ellas requieren datos \"financieros\"\, **empiezas a hacerte una idea de lo grande que es la oportunidad de Plaid\.** Cuantas más empresas creen que quieran integrarse directamente con las cuentas bancarias de los clientes\, más relevante se vuelve Plaid\.

**Plaid cobra a las empresas\,** no para consumidores\, para el uso de la API [^5]\. Es [seems to take](https://plaid.com/pricing/ 'pricing') una comisión basada en transacciones para empresas más pequeñas y una cuota de suscripción para las grandes\. Al hacer lo \"aburrido\" han creado una situación en la que todos ganan para ellos mismos y para otros innovadores que están dispuestos a pagarles por la comodidad\.

Una vez que uses Plaid\, **Es poco probable que cambies\,** ya que eso implicaría reescribir gran parte del código que usa las APIs de Plaid [^6]\. Piensa en lo que eso significa para la capacidad de Plaid para subir precios\. ¿Con qué frecuencia cambias tu fontanería\?

Si eso suena poco realista\, considera Fortran\, un lenguaje de programación temprano\. Su biblioteca de funciones era [defined in **1958**](http://ed-thelen.org/LaFarr/IBM-FORTRAN-II-704-C28-6000-2-c-1958.pdf 'fortran')\, y que todavía se utiliza hoy en día\. Una vez implementadas\, las APIs duran mucho tiempo\:

![plaid](../../../blog/2021_01_30_plaid/plaid_14.webp)

Hoy hemos cubierto mucho\: la intuición detrás de la abstracción\, las APIs y lo que hace Plaid\. La principal conclusión es que **Hay muchas cosas que la gente no quiere hacer\, y mucho dinero que ganar haciendo todo eso\.** El boletín te dice que evites aburrir a la gente\, pero en este caso construir lo aburrido es un negocio multimillonario\.

### Más recursos\:

1. [What does Plaid do?](https://technically.substack.com/p/what-does-plaid-do 'plaid') por Technically
2. [Fireside chat with Plaid CEO Zach Perret](https://www.youtube.com/watch?v=sgnCs34mopw 'youtube') por FirstMark
3. [APIs all the way down](https://notboring.substack.com/p/apis-all-the-way-down 'nb') por no aburrir
4. [A brief, opinionated history of the API](https://www.youtube.com/watch?v=LzMp6uQbmns 'youtube') por Joshua Bloch
5. [How to build a fintech app in Python using Plaid's banking API](https://www.youtube.com/watch?v=Lv2jIOi2fao 'youtube') por Erol Aspromatis

Gracias a [Brian Rubinton](https://twitter.com/brianru 'b')\, [Justin Gage](https://mobile.twitter.com/itunpredictable 'j')\, Ben Morsillo\, [Denis Papathanasiou](https://github.com/dpapathanasiou 'd')\, Mai Schwartz\, [Aditya Athalye](https://evalapply.org/ 'a')\, [Jeremy Presser](https://mobile.twitter.com/JeremyPresser 'j')\, [Ian Kar](https://mobile.twitter.com/iankar_ 'i') para consejos sobre este artículo

## Otros

1. [Why working from home will stick.](https://nbloom.people.stanford.edu/sites/g/files/sbiybj4746/f/why_wfh_stick1_0.pdf 'wfh') En línea con mi creencia actual de que volveremos al trabajo en oficina\, con más días de teletrabajo\.
2. [What is an IP address?](https://outofips.netlify.app/ 'IP')
3. [The sting of poverty](http://archive.boston.com/bostonglobe/ideas/articles/2008/03/30/the_sting_of_poverty/?page=1 'poverty')
4. [How I blew out my knee and came back to win a national championship](https://www.jasonshen.com/2011/blew-out-knee-win-national-championship/ 'jason')
5. [Judgement is an exercise in discretion](https://aeon.co/essays/judgment-is-an-exercise-in-discretion-circumstances-are-everything? 'judge')

[^1]: Para ser más precisos técnicamente\, sería el compilador el que tiene que ser compatible con todos los dispositivos\, y no el código en sí\, que está una capa por encima del compilador\.

[^2]: Aparentemente\, David es la primera persona en obtener un doctorado en informática\.

[^3]: Técnicamente debería ser el contrato entre las partes lo que sea la interfaz\, pero creo que agruparlo es más fácil de entender para un principiante

[^4]: Estoy 99\% seguro de que la carpeta de GitHub de Plaid para Python es incorrecta\, ya que tiene archivos de index\.html vacíos\. También hay un problema raro de espacio de nombres entre Plaid y plaid\-python que no entendí del todo\, pero que al final solucioné\. No sé por qué necesitan usar Docker\, que era uno de los muchos programas adicionales necesarios para que funcionara mi equipo\. Actualización\: Plaid ha mencionado desde entonces que estos errores han sido corregidos\, con un proceso de inicio rápido diferente\.

[^5]: Estoy seguro de que las empresas intentan trasladar ese coste a los consumidores\, pero la cuestión aquí es que el cliente directo que paga por el servicio son las que crean aplicaciones que requieren integración financiera

[^6]: Creo que es así\, pero avísame si me equivoco\.
