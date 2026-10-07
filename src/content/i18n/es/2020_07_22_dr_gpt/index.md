---
title: "Doctor GPT-3"
description: "o: Cómo aprendí a dejar de preocuparme y a amar la inteligencia artificial"
pubDate: 2020-07-22
category: Technology
tags: ['AI', 'computer science', 'math']
evergreen: false
heroImage: '../../../blog/2020_07_22_dr_gpt/gpt_28.webp'
featured: true
locale: 'es'
sourceSlug: 'dr_gpt'
sourceHash: '71b3312cf1cfb5110ced0c235342922bfdfe4e4d54e6798a85dde1d8941f3a6d'
---

## Conclusión

GPT\-3 es un modelo impresionante de predicción de texto que se generaliza a muchos casos de uso\. Explico cómo funciona a un nivel general\, si el bombo es merecido\, cómo detectar GPT y si va a saquear nuestros empleos\.

## Solo humano\, al fin y al cabo

Hace aproximadamente una semana\, Sharif Shameem compartió [this video on twitter
demonstrating the abilities of a new AI, GPT-3](https://twitter.com/sharifshameem/status/1282676454690451457)

Y\. Twitter\. Asustada\. Fuera de combate\.

Quizá dándose cuenta de que sus trabajos cómodos de [copying stack overflow answers](https://www.zdnet.com/article/the-most-copied-stackoverflow-java-code-snippet-contains-a-bug/ 'SO') o [gossiping about startups](https://twitter.com/magdalenakala/status/1285597906892988417?s=20 'startup') estaban en riesgo [^1]\, tanto programadores como capitalistas de riesgo en Twitter empezaron a inundar el feed con demos de GPT\-3 y opiniones polémicas sobre esta nueva inteligencia artificial\. Siguen en marcha\, si quieres [take a look](https://twitter.com/hashtag/gpt3?lang=en 'gpt3')

Así que aquí estoy\, con mi propia opinión polémica\, para aprovechar a toda esa audiencia cautivada para la IA\.

Oye\, tío\, solo soy humano\.

El artículo está dividido en 5 secciones\:

1. Explicación de lo que puede hacer GPT\-3\, por qué es impresionante y por qué la gente está preocupada
2. Visión general ligeramente técnica de cómo funcionaban los modelos de lenguaje antes de GPT\-3
3. Visión general ligeramente técnica de cómo funciona GPT\-3
4. Cómo detectar texto escrito por GPT\-3
5. Implicaciones de GPT\-3

Empecemos\.

## 1\. GPT\-3 es impresionante porque puede crear salidas inteligibles para una amplia variedad de casos de uso

[GPT-3](https://arxiv.org/pdf/2005.14165.pdf 'GPT') fue creado por [OpenAI](https://openai.com/about/ 'Open')\, una empresa que intenta \"asegurarse de que la inteligencia artificial general beneficie a toda la humanidad\"\, es decir\, que los robots no nos maten a todos\.

GPT\-3 es un modelo de lenguaje general\, lo que significa que toma algunas palabras como entrada y produce más palabras como salida\. **Piénsalo como un increíble [autocomplete function](https://en.wikipedia.org/wiki/Autocomplete#:~:text=Autocomplete%2C%20or%20word%20completion%2C%20is,to%20accept%20one%20of%20several. 'auto')\.** Como es un modelo general\, puede resolver muchos tipos diferentes de tareas\. Podrías pedirle que escriba un párrafo sobre unicornios\, traduzca una frase\, genere código de programación o más\.

Esto es muy útil\, ya que normalmente esperarías que un algoritmo solo hiciera lo que fue entrenado para hacer\. No escribes en Excel y buscas que te diga un poema\. Desde hace mucho tiempo esperamos que los programas hagan lo que se les ha ordenado\, con poca capacidad para realizar tareas para las que no fueron diseñados\.

Como es un modelo general\, también pensarías que GPT\-3 sería peor en una tarea que los modelos especializados en esa tarea\, por ejemplo\, al comparar los resultados de traducción de GPT con un algoritmo centrado solo en traducir\, GPT no será tan bueno\.

Sorprendentemente e impresionantemente\, no siempre es así\. A continuación se muestra la tabla de la [GPT paper](https://arxiv.org/pdf/2005.14165.pdf 'GPT') con los resultados de una prueba de traducción\. Para simplificar\, podemos simplemente comparar la primera línea que representa un modelo \"Estado del Arte\" con la última línea que representa el modelo GPT con mejor rendimiento [^2]\. Un número mayor es mejor aquí\. Podemos verlo en algunas de las tareas de traducción \(especialmente en traducción _a_ inglés\)\, **GPT es tan bueno\, si no mejor\, que los modelos de última generación\.**

![post](../../../blog/2020_07_22_dr_gpt/gpt_1.webp)

OpenAI probó GPT en una gran variedad de otras tareas\, como la predicción de texto\, preguntas de trivia sin permitirle buscar en un conjunto de datos separado\, o determinar a qué palabra se refiere un pronombre [^3]\. Aunque GPT no gana en todos los casos\, en la mayoría obtiene excelentes resultados\. **Si solo pudieras elegir un modelo\, probablemente querrías usar GPT\.** Es el [Simone Biles](https://www.nytimes.com/2019/10/13/sports/simone-biles-worlds.html 'Simone') de la comunidad de IA\, siendo los mejores en muchos eventos y excelentes en el resto\.

Veamos algunos ejemplos\.

En esta primera imagen de abajo\, el modelo recibe una indicación en la parte superior y luego aparece el resto del texto abajo\. El texto se extiende más tiempo\; simplemente lo recorté para fines de exhibición\. Es bastante impresionante lo que ha sacado\, ¿verdad\?

![post](../../../blog/2020_07_22_dr_gpt/gpt_2.webp)

En esta segunda imagen\, vemos otro texto de muestra generado a partir del modelo\, esta vez mostrando que también puede producir poesía\. Probablemente sea mejor que lo que yo escribiría\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_3.webp)

Increíble\, ¿entonces todo el bombo está justificado\? ¿Fue este un momento decisivo\, cuando la capacidad de la IA cruzó algún límite artificial\? Twitter y Google Trends ciertamente parecen pensar que sí\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_4.webp)

Bueno\.\.\. sí y no\.

¿Esas dos imágenes que acabo de mostrar\? Mentí\, no son de GPT\-3\.

En realidad son de GPT\-2\, el modelo antiguo lanzado en febrero de 2019\. De hecho\, los lectores de toda la vida de este boletín quizá lo recuerden [this article](/writing/moloch 'Moloch') Escribí entonces\, destacando los resultados ya admirables del modelo [^4]\. El texto generado por el modelo antiguo ya era impresionante\.

Entonces\, ¿qué es diferente esta vez\? ¿Los robots acaban de tener un departamento de marketing mejor\?

En parte\, sí\. GPT\-3 se lanzó en [the end of May](https://minimaxir.com/2020/07/gpt3-expectations/ 'GPT')\. Si retrocedes hasta esa tendencia de búsqueda en Google y entrecerras los ojos con fuerza\, notarás ese pequeño aumento en el gráfico\, dos semanas antes de que realmente empiece a dispararse\. Ese era el interés público en GPT\-3 antes del tuit viral\. Esto demuestra que los formatos de presentación pueden marcar la diferencia y debería dejar de escribir para hacer vídeos de TikTok\.

Dicho esto\, esta vez también hay mejoras impresionantes\. GPT\-3 da mejores resultados que GPT\-2 y puede generalizarse a más escenarios\. Esto se debe en gran parte al aumento de datos usados en el entrenamiento y al aumento de parámetros del modelo\.

Voy a explicar más a continuación y la forma en que funcionan estos modelos es que reciben datos\, entrenan con ellos y cambian los pesos de su modelo según el conjunto de entrenamiento\.

Se sabe desde hace tiempo que más datos de entrenamiento suelen ayudar [^5]\, y los resultados de GPT\-3 siguen demostrando que es cierto\. GPT\-3 ingerido [~50x the amount of data](https://lambdalabs.com/blog/demystifying-gpt-3 'lambda') que la versión anterior sí lo hizo\, dando cierta intuición sobre cómo puede generar tantas referencias relevantes para sus resultados [^6]\.

GPT\-3 también tiene [~100x the amount of parameters](https://minimaxir.com/2020/07/gpt3-expectations/ 'params') en su modelo comparado con la versión anterior\. Con parámetros de 175 mil millones [isn't unheard of](https://twitter.com/iamtrask/status/1285301017878441988?s=20 'params')\, pero sí ayuda a GPT\-3 a diferenciar aún más sus respuestas [^7]\.

Max Woolf señala otras dos cosas que se han mejorado en GPT\-3\: [1) It allows for text generation twice as long, and 2) prompts to the model are even more helpful in steering the direction of text generated](https://minimaxir.com/2020/07/gpt3-expectations/ 'Max')\. GPT\-3 puede aceptar cero\, uno o unos pocos \"prompts\" de respuestas de muestra cuando le das entradas\. Los prompts ayudan a entender qué respuestas dar\, y cuantos más prompts\, mejor\.

En general\, Max estima que GPT\-3 le dio resultados útiles unas 5 veces más a menudo que el GPT\-2 más antiguo\. En cuanto a expectativa\, el público general ha pasado de 0 a 100\, mientras que la gente que observa el espacio ha pasado de 50 a 70\.

Esto permite obtener resultados como [this, a plugin to pull GPT results to autofill google sheets](https://twitter.com/pavtalk/status/1285410751092416513?s=20 'twitter') \(demo real esta vez\, lo prometo\)\:

Como GPT generaliza bien\, hay mucho entusiasmo por su uso en cualquier campo de \"trabajo del conocimiento\"\. Desde la programación hasta la banca y la medicina\, se piensa que GPT pueda eventualmente dar respuestas de la misma calidad que un profesional\. La próxima vez que vayas al médico\, quizá tu diagnóstico venga del Dr\. GPT\.

Todo eso suena genial\, ¿cuáles son las preocupaciones\?

Max entra en más detalles [here](https://minimaxir.com/2020/07/gpt3-expectations/ 'expectations')\, señalando que\:

- El modelo produce lenta producción
- Ha habido mucha selección selectiva en los ejemplos mostrados públicamente
- Todos trabajan con el mismo modelo entrenado y no podemos ajustarlo
- Hay un problema continuo con el sesgo sistemático en el entrenamiento\, por ejemplo\, la llamada [how Microsoft had to pull its chatbot after it turned racist](https://www.theverge.com/2016/3/24/11297050/tay-microsoft-chatbot-racist 'Tay')

Otra preocupación es el coste de entrenar a un modelo así\. Curiosamente\, [Yannic on youtube](https://www.youtube.com/watch?v=SY5PvZrJhLE&feature=youtu.be 'Yannic') señalaron que los investigadores cometieron un error en parte de la recogida de datos y no se dieron cuenta hasta que ya habían entrenado el modelo\. En lugar de empezar de nuevo\, tuvieron que ajustar ese problema de otras maneras\, ya que **Era demasiado caro volver a entrenar el modelo\.**

![post](../../../blog/2020_07_22_dr_gpt/gpt_5.webp)

Eso es una locura\. La gente espera que los costes de entrenamiento de modelos bajen\, a medida que el hardware se ponga al día con los requisitos del algoritmo\. Si no lo hacen\, solo las grandes empresas podrán personalizar modelos para sus propios fines\.

Por último\, también está la inquietud constante sobre cómo esto acabará con todos nuestros empleos y provocará el fin de la humanidad\. Abordaré este tema ligero en mis palabras finales\.

Ahora\, echemos un vistazo más detallado a cómo funcionan los modelos\.

## 2\. Visión general del modelo seq2seq utilizado antes de GPT\-3

_Aviso\: Las dos siguientes secciones se ponen un poco técnicas mientras explico los modelos utilizados\. Si no te apetece\, pasa a la sección \"¿Cómo podemos detectar GPT\-3\?\" si no te apetece el reto\._

_Aclaración adicional\: no soy experto en aprendizaje automático\, y los modelos implicados son complicados\. Me apoyaré en [this talk](https://www.youtube.com/watch?v=S0KakHcj_rs 'talk') además de las otras explicaciones enlazadas al final de este artículo\. No dudes en responder con cualquier corrección\._

**GPT\-3 utiliza un modelo diferente** Comparado con los modelos tradicionales de predicción\. Sin embargo\, sigue siendo útil captar la intuición detrás de los modelos antiguos antes de mirar GPT\-3\. Primero repaso un modelo antiguo y luego GPT\-3\.

Empezaremos por lo popular y más antiguo [sequence to sequence model.](https://google.github.io/seq2seq/ 'seq') Esto se abrevia comúnmente como \"seq2seq\"\, pero para que sea aún más fácil de entender\, simplemente lo llamaré \"modelo antiguo\" y a GPT\-3 \"modelo nuevo\"\.

Supongamos que tuviéramos una frase y quisiéramos predecir la siguiente\. Pasaríamos nuestra frase por nuestro algoritmo\, que es una serie de funciones\, y luego obtendríamos la salida predicha\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_6.webp)

Cada palabra importa\, así que tenemos que dividir la frase de entrada y verla palabra a palabra\. Por ejemplo\, \"Had we but world enough and time\" tiene connotaciones diferentes frente a \"Had we but world enough and limes\"

![post](../../../blog/2020_07_22_dr_gpt/gpt_7.webp)

Vamos a despejar el diagrama y mirar la primera palabra\. Pasamos esa palabra por una función y luego obtenemos una salida temporal\. Sabemos que podemos representar palabras como números\, ya que así es como los ordenadores procesan palabras [^8]\. Así que piensa en que la palabra se transforma en cierta cantidad de números\, se hacen cálculos y luego obtienes otro conjunto de números después\. Por ejemplo\, \(1\, 2\, 3\) por 2 es igual a \(2\, 4\, 6\)\.

Si recuerdas las matemáticas del instituto\, esto es multiplicación de matrices o álgebra lineal\. **Casi todas las matemáticas a continuación pueden representarse en alguna forma de multiplicación matricial\, tanto para esta sección como para la siguiente\.**

![post](../../../blog/2020_07_22_dr_gpt/gpt_8.webp)

La función utilizada es una [neural network, so it's more complicated than just multiplying by two.](https://towardsdatascience.com/learn-how-recurrent-neural-networks-work-84e975feaaf7 'neural') Voy a pasar por alto exactamente cómo funcionan porque ya he repasado la intuición antes [here](/writing/ml 'ML')\, y complicará demasiado esta guía\. Subtítulos gratuitos\, enviadme un correo y reenviaré el mensaje\.

Lo que es más importante entender aquí es que la palabra se transforma en otra cosa\. El modelo puede controlar tanto cómo la palabra se convierte inicialmente en números como qué función realizamos\. Por ejemplo\, en lugar de \(1\, 2\, 3\) por 2\, podríamos tener \"Had\" convertido en \(2\, 3\, 4\)\, y luego por 3 para igualar \(6\, 9\, 12\)

![post](../../../blog/2020_07_22_dr_gpt/gpt_9.webp)

Hemos terminado con la primera palabra\, así que pasemos a la segunda\. Lo que es diferente aquí es que tenemos esa salida temporal 1 de la primera palabra [^9]\. Combinaremos eso\, junto con la segunda palabra\, aplicaremos nuestra función de nuevo y obtendremos una nueva salida temporal 2\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_10.webp)

En este punto\, puedes inferir hacia dónde vamos para el resto de la secuencia\. De hecho\, seguimos haciendo esto hasta llegar a la última palabra de nuestra entrada\. Usamos la salida temporal de una palabra para ayudar a generar la salida temporal de la siguiente de forma recurrente\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_11.webp)

Usando esa salida temporal\, aplicamos una función diferente\, y eso nos da dos cosas\. Obtenemos la primera palabra de nuestra salida \(tras traducirla de nuevo desde números\)\, y luego otra salida temporal \(aún en números\)\. En nuestro ejemplo\, obtenemos la palabra \"esto\"\. ¡Genial\, por fin hay un progreso tangible\!

![post](../../../blog/2020_07_22_dr_gpt/gpt_12.webp)

Ahora tenemos una salida temporal\, una salida real y nuestra nueva función\. Como habrás adivinado\, podemos repetir este mismo paso para obtener la siguiente palabra predicha y otra salida temporal\. Es un patrón recurrente otra vez\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_13.webp)

Y como en el escenario de entrada anterior\, repite hasta el final de la frase\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_14.webp)

¡Y hemos terminado con el modelo antiguo\! Eso fue mucho\, y obviamente demasiado simplificado\, pero hemos adquirido una comprensión general del proceso\. Para más detalles\, puedes consultar el artículo original [here](https://arxiv.org/abs/1409.3215 'paper')

Ahora hay una pregunta crítica que pone a prueba nuestra comprensión y sugiere las mejoras en el nuevo modelo\. En el modelo antiguo\, ¿podríamos resolver alguna parte del proceso antes de haber resuelto las anteriores\? Por ejemplo\, ¿podríamos obtener la salida temporal para \"tiempo\"\, sin resolver primero para \"nosotros\"\?

**No\, porque teníamos que hacer todo en secuencia\.** Tanto la posición como el contexto de las palabras importan\, así que queremos procesarlo todo palabra a palabra\. No podemos saltar ninguna parte\, ya que cada paso depende del anterior\, de forma recurrente\. Por eso también se conoce el modelo antiguo como [recurrent neural network](http://karpathy.github.io/2015/05/21/rnn-effectiveness/ 'RNN')\. Por ello\, el cálculo de la predicción también se vuelve lento una vez que nuestro texto de entrada se vuelve grande\.

Aquí entra el modelo del transformador\.

## 3\. GPT\-3 utiliza un modelo de decodificador de transformador\, una variación del modelo de transformador

GPT\-3 significa Transformador Generativo Preentrenado 3\. El transformador del nombre representa el [transformer model, using an "attention" mechanism.](http://jalammar.github.io/illustrated-transformer/ 'transformer') Tanto GPT\-2 como GPT\-3 usan el mismo tipo de modelo\, así que cualquier explicación que encuentres del primero también se generalizará [^10]\.

Sin embargo\, lo que aprendí justo antes de publicar esta entrada fue que **De hecho\, usan [a variation of the transformer model.](https://s3-us-west-2.amazonaws.com/openai-assets/research-covers/language-unsupervised/language_understanding_paper.pdf 'variation')** Por tanto\, primero repasemos una versión simplificada del nuevo modelo\, qué significa \"atención\" y luego veamos cómo es diferente la versión de GPT\-3\. Indicaré cuándo dejaremos el transformador normal y usaremos los ajustes de GPT\-3\.

Para el nuevo modelo\, volveremos al principio\, con nuestras palabras de entrada e intentando obtener la salida de ellas\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_15.webp)

Ahora\, sin embargo\, queremos evaluar todas las palabras de entrada al mismo tiempo\, en paralelo en lugar de en secuencia\. Esto nos ahorrará mucho tiempo calculando el resultado\, ya que podemos usar matemáticas matriciales para calcularlo de una sola vez\.

Convertimos nuestras palabras de entrada en números de nuevo\, como siempre hacemos\. Esta vez\, sin embargo\, pasamos esos números por 3 funciones diferentes\, obteniendo 3 salidas temporales para cada palabra\, a\, b y c\. Ten en cuenta que es solo para simplificar que nuestra palabra y salidas tienen 3 números\; en la práctica tienen cientos de números\. Veremos cómo se usan estas 3 salidas en breve [^11]\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_16.webp)

Vamos a deshacer el diagrama y hacer esos cálculos para todas las palabras de entrada\. Ahora tenemos a\, b y c para todas nuestras palabras de entrada\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_17.webp)

Ahora este es el problema que encontramos cuando no consideramos la entrada de forma secuencial\; los investigadores estuvieron atascados en esto durante mucho tiempo antes del nuevo modelo\. Como se mencionó antes\, **Tanto la posición como el contexto de las palabras importan\. ¿Cómo podemos conseguir eso si no evaluamos secuencialmente\?**

Por ejemplo\, tomemos la frase \"El autor bebió aún más café para terminar su boletín\, porque aún no estaba listo\"\. Cambiar la posición de \"café\" por \"boletín\" no tendría sentido\, así que el ordenador necesita saberlo de alguna manera\. Además\, el \"eso\" aquí se refiere al boletín\, y el ordenador también necesita conocer ese contexto\. En el modelo antiguo\, toda esa información se conserva porque movemos una palabra a la vez\. En el nuevo modelo\, necesitamos otro método para obtener esa información desde el principio\.

Fíjate en el diagrama que hemos calculado todas esas salidas temporales simultáneamente\, y ninguna depende una de la otra\. Lo que haremos a continuación es tomar la primera salida temporal de la primera palabra y aplicar una función en esa salida con todas las segundas salidas temporales de todas las palabras\. En el diagrama\, he representado los resultados de estas como el primer \"punto\" de salida temporal y la segunda salida temporal\, por ejemplo 1a\.2b

![post](../../../blog/2020_07_22_dr_gpt/gpt_18.webp)

Hemos tomado algo relacionado con la primera palabra y lo hemos vinculado con algo relacionado con todas las demás palabras\. Es importante que no tengamos que hacer estos cálculos secuencialmente\, ya que el resultado de uno no fluye hacia el otro\. Podemos repetir esto para el resto de palabras\. Aquí muestro el mismo paso para la palabra 2\, solo para mayor claridad\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_19.webp)

Volvamos a la primera palabra\. Hemos terminado con las salidas a y b\, pero aún queda c\. Para sorpresa de nadie\, aplicamos otra función más a todas estas salidas temporales de puntos y a todas las salidas c\. Después de eso\, usamos otra función más\, para convertir todas esas salidas separadas en una sola salida\. Por ejemplo\, en este caso pasamos de 7 salidas a 1 salida única 1z\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_20.webp)

Vale\, eso ha sido mucho trabajo\. Te juro que esto tiene sentido para la gente que lo ha ideado\. Lo que acabamos de hacer ya está pasado por [the steps of calculating "attention" for our words](http://jalammar.github.io/illustrated-gpt2/ 'attention') [^12]\. La cantidad de \"atención\" que tiene la palabra A para otra palabra es cuánto debe centrarse la palabra A en ella y\, por tanto\, cuánto contexto debe recibir\. Al asociar componentes de las palabras con todas las demás palabras\, resolvemos el problema de contexto antes\. Voy a saltarme la resolución del problema de posición por simplicidad\, solo piensa que están añadiendo más números a la palabra original basándose en la posición de la palabra [^13]\.

Ahora tenemos esta nueva salida\, z\, que contiene información de esa palabra en particular\, así como el contexto de otras palabras en la entrada\. Pasamos esto por otra función \(una red neuronal de alimentación anticipada\) para obtener otra salida más\, llamémosla z\\\*\. Casi llegamos\.

**Resumiremos todos los pasos que acabamos de hacer y los llamaremos un paso de \"codificación\"\.** Durante la \"codificación\"\, transformamos nuestros números iniciales de la palabra en nuevos números que incluyen más contexto de las otras palabras que la rodean\. Por ejemplo\, \(1\, 2\, 3\) se convierte en \(5\, 7\, 0\)\. Recordatorio de que cada palabra en realidad son cientos de números\, no solo tres\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_21.webp)

La salida z\\\* tiene el mismo número de elementos que cuando transformamos la palabra por primera vez en números\. El nuevo modelo toma este resultado y lo introduce repetidamente por todo el proceso de codificación\. Piénsalo como múltiples capas de codificación\, por ejemplo\, haciendo el proceso 96 veces\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_22.webp)

Después de todo este entrenamiento\, tenemos una salida final de la codificación\. Llamémoslos vf\. Ten en cuenta que el cálculo del vf de una palabra sigue siendo independiente del cálculo del vf de otra palabra\. Esta paralelización nos ha ahorrado mucho tiempo\. Por ejemplo\, puedo calcular 7\_vf sin saber 1\_vf primero\.

Ahora\, podemos usar estas salidas finales para empezar a predecir nuestras palabras\. Pasamos todas estas salidas finales por otra \"función de decodificación\" para obtener nuestra primera palabra [^14]\. Hay diferencias entre cómo funciona la función de decodificación y la función de codificación\, pero los pasos son lo suficientemente similares como para que no los repasemos de nuevo\. **Puedes pensar en la función de decodificación como haciendo todos esos pasos de codificación\, pero también tomando la salida del proceso de la \"función de codificación\" [^15]\.**

He puesto aquí solo un gran bloque para \"funciones de decodificación\"\, pero el nuevo modelo repite este proceso el mismo número de veces que el proceso de codificación\. Por ejemplo\, si tuviera 96 capas de codificación\, tendría 96 capas de decodificación\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_23.webp)

Ahora que tenemos nuestra primera palabra predicha\, usaremos esa palabra junto con las salidas finales y las pasaremos de nuevo por la función de decodificación\. Si entrecerras los ojos\, esto se parece mucho al proceso de la sección anterior de modelos antiguos\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_24.webp)

Y una vez que repites ese proceso para todas las palabras\, obtienes la frase final\. Por fin\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_25.webp)

Vale\, así que eso era el _General_ Modelo de transformador\. Ahora dejemos todo eso a un lado y empecemos de cero para la versión de GPT\-3\.

Es broma\, no te asustes [^16]\.

GPT\-3 combina el proceso de codificación y decodificación\, para obtener un [Transformer Decoder](https://arxiv.org/pdf/1801.10198.pdf 'TD')\. Combinan la secuencia de entrada y la de salida esperada en una sola \"oración\" y luego la pasan por las capas de decodificación\. GPT\-3 tiene 96 de estas capas de decodificación [^17]\. El modelo se utiliza para predecir la siguiente entrada y también la siguiente salida\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_26.webp)

Si esto suena un poco vago\, es porque lo es\. No encuentro ninguna explicación de cómo combinan los pasos en internet\, aparte de la [original paper,](https://arxiv.org/pdf/1801.10198.pdf 'paper') [this post](http://jalammar.github.io/illustrated-gpt2/ 'Jay')\, y este aleatorio [github comment as confused as I am](https://github.com/openai/gpt-2/issues/157 'github')\. Parece que la forma en que predicen palabra a palabra también implicaría que hemos vuelto al problema recursivo\, de procesar el texto secuencialmente\. Quizá simplemente dedicar suficiente potencia de cálculo al problema fue la solución\. Si alguien sabe más\, por favor envíeme un correo\.

Muchas personas que publican en internet dicen que GPT\-3 utiliza el modelo tradicional de transformador\, o codificador\-decodificador de transformador\. Luego explican el modelo tradicional de transformador para describir lo que ocurre en GPT\-3\. **Sí\, toda esa gente está equivocada\,** igual que yo hasta antes de que me corrigieran justo antes de publicar esto\.

Si sigues conmigo\, hay dos características más importantes del algoritmo que merece la pena mencionar\.

Primero\, ¿recuerdas cuando dividimos la palabra en 3 características diferentes\, a\, b y c\? El nuevo modelo hace eso 96 veces desde el principio [^18]\. Cada vez utiliza una función diferente\, de modo que se generan 96 tripletes distintos\. Como estos son independientes\, pasa todos estos por las capas de codificación\/decodificación al mismo tiempo\, para todas las palabras de entrada\. Los resultados de estos se combinan al obtener esa salida de la función de codificación\/decodificación\, z\. Esto se conoce como tener \"múltiples cabezas de atención\"\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_27.webp)

En segundo lugar\, cada vez que menciono función en esta sección\, puedes pensar en ella como un peso o parámetro sobre algún número\. **Si sumas todos los pesos\, el modelo nuevo tiene 175 mil millones de pesos\.** No\, no es un error tipográfico\. Cuando la gente se refiere al número de parámetros que usa GPT\-3 y a cómo es mucho más grande que en modelos anteriores\, a esto se refieren\.

Por ejemplo\, si cada palabra se representara como una lista de 1000 números\, entonces necesitarías esos parámetros solo para pasar por una función en todo el proceso descrito arriba\. Puedes ver fácilmente cómo tener un proceso con 96 capas y 96 alternativas dentro de cada capa te lleva a un número gigantesco de parámetros necesarios\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_28.webp)

Esto fue un largo desvio\, pero ahora tienes más intuición sobre lo que hace GPT\-3\. Toma entradas de palabras\, realiza múltiples iteraciones de transformaciones mediante matemáticas matriciales y usa eso para predecir o traducir palabras\.

Si eso fue un poco demasiado enrevesado\, piensa en este ejemplo más sencillo\. Imagina un [choose your own adventure game](https://en.wikipedia.org/wiki/Choose_Your_Own_Adventure 'choose your own')\, donde tus elecciones deciden cómo termina la historia\. **GPT\-3 es así\, excepto que tiene miles de millones de opciones disponibles\, superpuestas unas sobre otras\.** La más mínima diferencia en la redacción de tu elección te llevará por otro camino\. Y los caminos posibles son prácticamente infinitos\.

Habiendo analizado todo eso\, la arquitectura de transformadores del artículo original está abajo como referencia\. Puedes ver cómo partes de ella se corresponden con el diagrama simplificado que acabamos de pensar\, con algunas casillas que he dejado fuera por simplicidad [^19]\. GPT\-3 utiliza solo el lado derecho de este diagrama\. Si te interesa saber más\, hay referencias adicionales al final de este artículo\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_29.webp)

## 4\. ¿Cómo podemos detectar GPT\-3\?

Sabemos que GPT\-3 es bueno\, y que algunas muestras de la salida son difíciles de distinguir de la escritura humana\. La pregunta natural es entonces preguntarse si hay otras formas de detectar si el texto fue escrito por una máquina\.

Resulta que hay formas sorprendentemente sencillas de hacerlo\.

Primero\, [because of the hyperparameters used in GPT-3,](https://medium.com/analytics-vidhya/understanding-the-gpt-2-source-code-part-1-4481328ee10b 'temp') **La frecuencia de las palabras generadas no seguirá las distribuciones esperadas de los humanos normales\.** En la captura de pantalla de abajo\, Gwern explica que esto hace que las palabras comunes aparezcan aún más de lo esperado\, y que las palabras poco comunes no aparezcan en absoluto\. La temperatura controla la aleatoriedad\, y el hiperparámetro top\-k controla dónde está el punto de corte de frecuencia para las palabras principales elegidas\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_30.webp)

Para quienes no estén familiarizados con la ley de Zipf\, ya la he tratado anteriormente [here](/writing/zipf 'Zipf') Cuando hablamos de buscar extraterrestres \(sí\, extraterrestres\. Subtítulos gratuitos enviadme un correo y reenviaré el mensaje\)\. Básicamente\, indica que en una gran muestra de texto\, la frecuencia de cualquier palabra es inversamente proporcional a su rango\, cuando se ordena por frecuencia de ocurrencia\. Por ejemplo\, la palabra más común es \~2 veces más frecuente que la segunda palabra más común\.

He trazado la ley de Zipf para mi boletín antes\, y parece el gráfico superior\. Si GPT\-3 escribiera mis artículos\, esperarías algo como el final \(con más palabras\, claro\, el ejemplo es solo para ilustrar\)\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_31.webp)

En segundo lugar\, puedes usar otro modelo para revisar el texto\. Analítica Vidhya hizo una publicación hace un tiempo [how to detect computer generated articles.](https://www.analyticsvidhya.com/blog/2019/12/detect-fight-neural-fake-news-nlp/ 'Vidhya') Proporcionan algunas herramientas como un modelo de detector GPT\-2 o [Grover,](https://grover.allenai.org/detect 'Grover') Eso puede tomar texto de ejemplo y decirte si creen que fue generado por máquina [^20]\. Estas herramientas se lanzaron antes que GPT\-3 y aún no han sido calibradas para él\, pero aún funcionan bien\. Funcionan porque **Los modelos están familiarizados con las peculiaridades que otros modelos utilizan para generar texto\.**

Aquí tienes una demostración\. Fui a la primera muestra del apéndice de la [GPT 3 paper (page 49)](https://arxiv.org/pdf/2005.14165.pdf 'GPT')\, y copió el poema generado por máquina allí\. Al conectarlo en la web de Grover\, se ve que Grover piensa que fue generado por máquina\. Probablemente no lo habría adivinado bien\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_32.webp)

Por supuesto\, ninguno de estos métodos es infalible\. Si no tienes una muestra de texto lo suficientemente grande\, es difícil hacer análisis de frecuencia o verificarlo mediante los modelos de comprobación\. Si alguien te envía un muro de texto legal estándar solo una vez\, puede que no haya suficientes datos para saberlo con certeza\. Me pregunto qué tan insultante sería responder preguntando si es un bot\.\.\.

Grover también recibe falsos positivos\, como afirmar erróneamente que el poema de Allen Ginsberg [Howl](https://www.poetryfoundation.org/poems/49303/howl 'Howl') fue escrito por una máquina [^21]\. Y también recibe falsos negativos\, pensando que el texto generado por GPT\-3 fue creado por un humano\. [You can try playing around with it and see what works for you](https://grover.allenai.org/detect 'Grover')

Dicho esto\, tener estos métodos aún disponibles me hace menos temeroso de los peligros del texto generado por máquina falso\. Dado que ambas herramientas anteriores dependen de características estructurales de los modelos\, parece probable que mientras los modelos tengan hiperparámetros para ajustar\, el texto generado sea identificable\.

En el peor de los casos\, todo el mundo tendrá que instalar alguna extensión del navegador que escanee la página y te avise si cree que el texto es falso\. ¿Quizá algo como los bloqueadores de anuncios de hoy\? A estas alturas\, ¿deberíamos preocuparnos siquiera\?

## 5\. Estar vivo

Actualmente\, el acceso a la API GPT\-3 es [subject to a waitlist,](https://openai.com/blog/openai-api/ 'waitlist') ya que OpenAI quiere tener cuidado con que la gente haga un mal uso del modelo\. Si te interesa el concepto\, hay algunas soluciones alternativas\.

- OpenAI publicó el código de GPT\-2 \(la versión anterior de GPT\-3\) [here](https://openai.com/blog/better-language-models/ '2')\, así que puedes ejecutarlo tú mismo si sabes cómo configurarlo\.
- El equipo de Hugging Face ha creado una interfaz más intuitiva para GPT\-2\, así como para otros modelos basados en transformadores\. Puedes echarle un vistazo [here](https://transformer.huggingface.co/ 'transformer')
- [Aaron Tay](https://musingsaboutlibrarianship.blogspot.com 'Aaron') también publiqué que usando la versión premium \"Dragon\" de [AI Dungeon](https://play.aidungeon.io/ 'AI')\, un juego generador de texto usando GPT\, [supposedly gets you access to GPT-3 within the game](https://musingsaboutlibrarianship.blogspot.com/2020/07/playing-with-gpt-3-via-ai-dungeon.html 'AI')

Deberíamos esperar que más personas tengan acceso a capacidades similares a GPT\-3\, y que los modelos de lenguaje generales sigan mejorando\. Los modelos podrían no superar un [Turing Test](https://plato.stanford.edu/entries/turing-test/ 'Turing') sin embargo\, como [Kevn Lacker shows.](http://lacker.io/ai/2020/07/06/giving-gpt-3-a-turing-test.html 'Lacker') Sin embargo\, parece que cada día nos acercamos más\. Cada vez será más difícil para los humanos saber si algo fue fabricado por máquinas\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_33.webp)

Los casos de uso finales de GPT probablemente serán aún más creativos de lo que pensamos\. [Tyler Cowen gives some thoughts here](https://marginalrevolution.com/marginalrevolution/2020/07/the-case-for-gpt-3.html 'Cowen') en diagnósticos médicos y terapias\, y probablemente aún estamos empezando a entender qué podría ser posible hacer a gran escala con GPT o modelos similares\. Las demostraciones seguirán sorprendiéndonos\. Nos preguntaremos qué significa ser inteligente\.

Al mismo tiempo\, ha habido tuits de programadores diciendo que esto va a quitar empleos en banca y consultoría\, de capitalistas de riesgo sobre cómo esto va a quitar empleos de programación\, y de cualquier otro grupo que puedas imaginar intentando descargar en otra industria\. Actualmente no encuentro estos argumentos convincentes\, pero sigo abierto a que me convenzan\. Si conseguir herramientas más eficientes fuera un gran problema de empleo\, Excel habría eliminado la mitad de todos los empleos de oficina hace años\.

Lo que podría pasar en cambio es que **La especialización en tu carrera es aún más recompensa\.** GPT puede darte la plantilla para revisar antes de que rellenes y edites cuando sea necesario\. Los tediosos documentos y diapositivas estándar pueden generarse sin mucho esfuerzo por tu parte\, y luego puedes aplicar tu experiencia para personalizarlo para el proyecto\. Los banqueros y consultores junior podrían finalmente hacer algo productivo con su tiempo en lugar de recrear el mismo mazo para otra empresa con los logotipos cambiados [^22]\.

Piénsalo así\: ¿Necesitas más o menos experiencia para corregir los deberes de tu hijo a medida que crece\? Empiezas corrigiendo errores ortográficos\, pero al final necesitas saber cálculo\.

Además\, parece que la gente piensa que todos nuestros datos de entrada y salida van a estar limpios y fácilmente utilizables\. Como [Vicki Boykis](https://vicki.substack.com/p/were-still-in-the-steam-powered-days 'Vicki') ha señalado repetidamente que ese suele ser el punto de vista de alguien que nunca ha trabajado con conjuntos de datos más grandes antes\. Si tuvieras un modelo GPT personalizado para ti\, probablemente pasarías la mayor parte del tiempo limpiando los datos\. Si no lo tuvieras\, probablemente pasarías la mayor parte del tiempo limpiando la salida\.

De cualquier manera\, aún hay trabajo por hacer\. Estamos a salvo por ahora\.

Propondría de forma controvertida que **GPT\-3 nos dice más sobre nosotros mismos como humanos\, que sobre los ordenadores\.** Demuestra que tenemos una sorprendente tolerancia a la variación en las entradas que recibimos\, ya sea prosa\, poesía o piezas musicales\. Un texto que un ordenador marcaría como generado por máquina pasaría nuestras pruebas instintivas\, implicando que somos los más complacientes de los dos\.

Quizá sea esa apreciación por la ambigüedad\, esa acogedora hacia lo raro\, lo que separa nuestras señales de sinapsis de bits y bytes\.

O quizá tengamos que replantearnos lo que significa\; de [being alive](https://www.youtube.com/watch?v=eBBPKedba5o 'alive')\.

_Este artículo no fue escrito por GPT\-3\. Gracias a [Gwern](https://twitter.com/gwern?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor 'Gwern') y [Jay Alammar](https://twitter.com/JayAlammar?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor 'Jay') por responder preguntas en Twitter sobre GPT\, y [Nathan](https://mobile.twitter.com/nbashaw 'Nathan') Para ediciones\._

## Otros comentarios interesantes

1. [Gwern showcases creative writing by OpenAI’s GPT-3 model, demonstrating poetry, dialogue, puns, literary parodies, and storytelling](https://www.gwern.net/GPT-3 'Gwern')
2. [Max Woolf on Tempering Expectations for GPT-3 and OpenAI’s API](https://minimaxir.com/2020/07/gpt3-expectations/ 'Max')
3. [Kevin Lacker on Giving GPT-3 a Turing Test](http://lacker.io/ai/2020/07/06/giving-gpt-3-a-turing-test.html 'Lacker')
4. [Michael Nielsen twitter thread](https://twitter.com/michael_nielsen/status/1284937254666768384?s=20 'Nielsen')
5. [Manuel Araoz on how OpenAI's GPT-3 may be the biggest thing since bitcoin](https://maraoz.com/2020/07/18/openai-gpt3/ 'Maraoz')
6. [Exxact with other GPT-3 applications, such as summaries, code, and spreadsheets](https://blog.exxactcorp.com/what-can-you-do-with-the-openai-gpt-3-language-model/ 'GPT')

## Explicaciones más detalladas

1. [Yannic's youtube video explaining the GPT 3 paper](https://www.youtube.com/watch?v=SY5PvZrJhLE&feature=youtu.be 'Yannic')\. Además del propio artículo de GPT 3 ["Language Models are Few-Shot Learners"](https://arxiv.org/pdf/2005.14165.pdf 'GPT3')\. [Yannic's youtube video explaining the GPT 2 paper, which GPT 3 bases itself on.](https://www.youtube.com/watch?v=u1_qMdb0kYU 'Yannic') Además del propio artículo de GPT 2 ["Language Models are Unsupervised Multitask Learners"](https://d4mucfpksywv.cloudfront.net/better-language-models/language_models_are_unsupervised_multitask_learners.pdf 'GPT2')
2. [Joseph Palermo](https://twitter.com/j_w_palermo 'Joseph') de Dessa [speaking at Insight on Transformers.](https://www.youtube.com/watch?v=S0KakHcj_rs 'youtube') Esto me resultó útil debido a las preguntas que planteaban los miembros del público\, aunque yo estuve tan perdido durante toda la presentación\.
3. [Andrew Ng on attention models](https://www.youtube.com/watch?v=SysgYptB198 'Ng')
4. [How do Transformers Work in NLP? A Guide to the Latest State-of-the-Art Models](https://www.analyticsvidhya.com/blog/2019/06/understanding-transformers-nlp-state-of-the-art-models/ 'Vidhya')
5. [Jay Alammar on the illustrated transformer](http://jalammar.github.io/illustrated-transformer/ 'transformer')

[^1]: Es broma\, es broma\. De vez en cuando juegan al ping\-pong\.

[^2]: Aparentemente hay problemas para comparar directamente los resultados\. No conozco los detalles\, pero parece estar relacionado con la estandarización de los datos preparados utilizados\. El artículo dice\: \"Sin embargo\, nuestros ajustes de una o pocas fotos no son estrictamente comparables con trabajos previos no supervisados\, ya que utilizan una pequeña cantidad de ejemplos emparejados \(1 o 64\)\. Esto corresponde a hasta una o dos páginas de datos de entrenamiento en contexto\.\"

[^3]: Contexto \- \"El conjunto de datos LAMBADA prueba el modelado de dependencias a largo plazo en el texto – se pide al modelo que prediga la última palabra de las oraciones que requieren leer un párrafo de contexto\"\; Curiosidades \- \"En TriviaQA\, conseguimos un 64\,3\% en la configuración de disparo cero\, 68\,0\% en la de una sola sesión y un 71\,2\% en la de pocos disparos\"\; Pronombres \- \"El Desafío de Esquemas de Winogrado es una tarea clásica en PLN que implica determinar a qué palabra se refiere un pronombre\, cuando el pronombre es gramaticalmente ambiguo pero semánticamente no ambiguo para un humano\"

[^4]: Uno de los enlaces está roto porque el códice estelar de slate eliminó su blog\; pero puedes encontrar algunos de los ejemplos de poesía de GPT\-2 conservados [here](https://antinegationism.tumblr.com/post/182901133106/an-eternal-howl 'Moloch')\, y [Gwen's site](https://www.gwern.net/GPT-2 'Gwern') tiene muchas más\.

[^5]: [Banko and Brill showed way back in 2001 that more data can make a bad algorithm perform better than a good one.](https://dl.acm.org/doi/10.3115/1073012.1073017 'Banko')

[^6]: Páginas 8 y 9 de la [GPT-3 paper](https://arxiv.org/pdf/2005.14165.pdf 'paper') comentar cómo utilizaron los conjuntos de datos de CommonCrawl\, WebText\, Books y Wikipedia para entrenar\.

[^7]: Creo que se refiere a este modelo de parámetros de 160 mil millones [here](https://dl.acm.org/doi/abs/10.5555/3045118.3045359 'model')

[^8]: No estamos exactamente convirtiendo las palabras en representación binaria aquí\, si eso es lo que pensabas\. En cambio\, estamos [using a word embedding such as word2vec](https://towardsdatascience.com/learn-how-recurrent-neural-networks-work-84e975feaaf7 'word2') para generar representaciones numéricas variables de las palabras que se pueden usar en los algoritmos en el futuro\. Es cierto\, al final del día todo se convierte a binario\, pero eso no ocurre en este punto del proceso\.

[^9]: Vale\, estoy bastante seguro de que la primera función en realidad tiene un [bias unit](https://ayearofai.com/rohan-5-what-are-bias-units-828d942b4f52 'bias')\, así que también requiere otra entrada\. Pero eso complica demasiado la explicación del texto principal\, así que la dejo fuera\.

[^10]: Puedes verificar esto en el [GPT-3 paper page 8,](https://arxiv.org/pdf/2005.14165.pdf 'paper') donde dicen \"Usamos el mismo modelo y arquitectura que GPT\-2\, incluyendo la inicialización modificada\, la pre\-normalización y la tokenización reversible descritas en él\, con la excepción de que usamos patrones de atención dispersos alternados densos y localmente bandados en las capas del transformador\, similares al Transformador Disperso\"

[^11]: Esta es la parte del modelo del transformador donde [they embed the word, and then calculate smaller query, key, and value vectors by mapping the embedded word vector on to a pre-trained weighted matrix.](https://youtu.be/S0KakHcj_rs?t=1083 'youtube') Todavía no tengo del todo claro qué representan la consulta\, la clave y los valores después de ver toda esta lectura y vídeo\. Te sugeriría que consultes los recursos adicionales para más detalles y así verlo por ti mismo\. Mi intuición actual es que es una descomposición de la palabra en algo que puede soportar el peso de la palabra\, el peso cuando se compara con otra y una coincidencia de búsqueda\.

[^12]: El primer paso fue obtener los vectores de consulta\, clave\, valor\. Luego tomamos el producto escalar del vector de consulta con los vectores clave de otras palabras para ver cuánto foco poner en otras palabras\. Luego dividimos por la raíz cuadrada de la dimensión de los vectores clave\. Después hacemos un [softmax function](https://towardsdatascience.com/softmax-function-simplified-714068bf8156 'soft')\. Luego multiplicamos los resultados por los vectores de valor\. Y finalmente tomamos la suma de todo eso para obtener un vector final que se utilice en la siguiente parte del proceso\.

[^13]: Utilizan funciones seno y coseno\, véase [page 6 of the original paper](https://arxiv.org/pdf/1706.03762.pdf 'sin')\. Necesitaban algo periódico para que el modelo pudiera extenderse a diferentes longitudes de intervalo\.

[^14]: Técnicamente hay otra capa lineal de red neuronal y una capa softmax [after the decoding layers](http://jalammar.github.io/illustrated-transformer/ 'linear')\, pero lo han dejado fuera por simplicidad\.

[^15]: En el decodificador\, las salidas solo pueden prestar atención a las palabras de salida que vienen antes\, en lugar de toda la secuencia de salida\. Esto se conoce como \"enmascaramiento\"

[^16]: Aunque esa fue la sensación que tuve cuando me di cuenta de que GPT no usa un modelo estándar de transformador\. De verdad pensé que iba a tener que recrear todos esos diagramas\.

[^17]: Per [page 8 of the paper (n layers)](https://arxiv.org/pdf/2005.14165.pdf 'gpt')

[^18]: Casualmente\, es igual que el número de capas repetidas anteriores\, pero no tiene por qué serlo\. Página 8 del artículo también\.

[^19]:
    Vale\, esto parece aterrador\, y pasé mucho tiempo leyendo y viendo los vídeos antes de entender qué estaba pasando\. Para mapear esto al modelo que hemos recorrido\, empecemos por la izquierda\. Tenemos entradas\, se incrustan\. Hasta ahora es igual que cómo se convirtieron nuestras palabras en números al principio\. Luego tenemos la \"codificación posicional\"\, que es la suma de los números de posición que me salté\. Luego entramos en esta caja que empieza con \"atención multi\-cabeza\" — lo sabemos\, pasamos por todo ese proceso\. Hay una casilla de \"añadir y normalizar\" que se refiere a [layer normalisation](https://mlexplained.com/2018/11/30/an-overview-of-normalization-methods-in-deep-learning/ 'norm') Eso puedes pensar en eso como escalar los números\. Luego esto va a la caja de \"feed forward\"\, que es la red neuronal mencionada para llegar a z\\\*\. Luego normalizamos de nuevo\. Esta caja más grande tiene Nx en el exterior\, indicando que repetimos esto N veces según se desee\. A la derecha\, vemos las salidas\, hacemos la incrustación y codificación\, y luego entramos en la caja grande\. Los pasos ahí dentro son similares a los de la izquierda\, excepto que hacemos atención \"enmascarada\" con múltiples cabezas\, y también tomamos la salida de la caja izquierda\. Repite N veces según se desee\. Esto pasa por una capa lineal y una función softmax para obtener las probabilidades de salida de qué palabras salir\. Uf\. De nuevo\, esto es para el modelo normal de transformador\. GPT\-3 simplemente usa el lado derecho\.
    [^20]: La publicación también enlaza a una herramienta de análisis estadístico\, [GLTR,](https://gltr.io/ 'GLTR') eso sería hacer algo similar al análisis de la ley de Zipf mencionado antes\.
    [^21]: Para ser justos\, definitivamente tiene el aspecto adecuado\.
    [^22]: Es broma\, sé que también intercambias los colores del gráfico\.
