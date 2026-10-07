---
title: "Guerra de las palabras"
description: "Uso de la ley de Zipf y la entropía de la información en la búsqueda de alienígenas"
pubDate: 2020-06-24
category: Technology
tags: ['information']
heroImage: '../../../blog/2020_06_24_zipf/z_3.webp'
locale: 'es'
sourceSlug: 'zipf'
sourceHash: '973192c22790935d832c5e18991ced9ee6c8da9f91d41215baf5d37cb9c8863a'
---

## Conclusión

La ley de Zipf y la entropía de la información de Shannon pueden ayudarnos a encontrar vida alienígena

## ¿Cómo podemos encontrar vida alienígena\?

Ya hemos hablado de [how machine learning companies use data to recognise text](/writing/ml 'ML') y cómo [investors use data to pick companies.](/writing/data 'invest')

Esta semana\, hablemos de cómo los científicos están utilizando datos para buscar extraterrestres\. Parte del contenido que se basa a continuación de [Laurance Doyle's talk with the Long Now group.](http://longnow.org/seminars/02020/apr/29/interspecies-communication-and-search-extraterrestrial-intelligence/ 'Long')

### Enmarcando el problema

El Instituto de Búsqueda de Inteligencia Extraterrestre \(SETI\) es el más famoso de los institutos de investigación que buscan vida alienígena\. Su misión es ["to explore, understand and explain the origin and nature of life in the universe and the evolution of intelligence."](https://www.seti.org/about-us/mission 'mission')

¿Cómo abordamos siquiera el alcance de un problema así\?

Bueno\, si intentamos encontrar vida alienígena\, tienen que existir en otro planeta\. Así que sabemos que intentar encontrar planetas es un posible punto de partida\.

Por la ciencia elemental también sabemos que los planetas se forman alrededor de las estrellas\. Así que sabemos que intentar encontrar estrellas que puedan sostener planetas también es un punto relevante\.

Sabemos que la mayoría de los planetas tienen entornos hostiles\. Así que limitemos esa lista solo a los planetas que creemos que pueden sostener la vida [^1]\.

De esos planetas\, no todos tendrán vida realmente\, así que tomemos la proporción que sí la tiene\.

Podríamos pensar que aquí estamos bien y que tenemos suficientes funciones para empezar a buscar\. Sin embargo\, todavía hay algunas funciones que podemos añadir para reducir la precisión de búsqueda\.

Cuando observamos planetas\, queremos encontrar alguna señal que provenga del planeta\, ya que eso será una prueba mucho más fuerte de que el planeta tiene vida\. Imagina que estás viendo una casa frente a una casa donde alguien está poniendo música\. Es mucho más fácil concluir que hay un ser vivo en el segundo escenario\.

Así que\, acotemos los planetas donde realmente aparece la vida\, a los planetas donde aparecen especies \"inteligentes\"\.

Y de esas \"especies inteligentes\"\, tomemos solo a las que acaban desarrollando tecnología de comunicaciones\.

Por último\, incluso si la especie desarrollara comunicaciones\, si ya no están vivas para enviarlas\, nunca las recibiríamos\. Así que también debemos tener en cuenta cuánto viven esas civilizaciones\.

Eso fue mucho\. Pero ahora tenemos todos los factores principales que necesitamos para enmarcar nuestro problema y buscar el número de civilizaciones alienígenas inteligentes que pueden enviar señales\.

Juntando todo\, lo que hemos hecho es crear el [Drake equation](https://en.wikipedia.org/wiki/Drake_equation#:~:text=The%20Drake%20equation%20is%20a%20statement%20that%20stimulates%20intellectual%20curiosity,a%20part%20of%20that%20universe. 'Drake')\, una forma famosa de estimar la vida inteligente [^2]\. Fíjate cómo todos los puntos que acabamos de cubrir se multiplican para adivinar cuántos alienígenas inteligentes hay por ahí\:

![post](../../../blog/2020_06_24_zipf/z_1.webp)

### Reduciendo el alcance

Eso son muchas variables\, así que centrémonos en una parte de esa ecuación por hoy\, la fracción de especies \"inteligentes\"\.

Necesitamos encontrar una forma de distinguir las señales \"inteligentes\" de las \"no inteligentes\"\. Por ejemplo\, querría diferenciar entre cantar con un micrófono y cantar en un micrófono [audio feedback](https://en.wikipedia.org/wiki/Audio_feedback 'audio')\.

Sería útil tener ejemplos de comunicación alienígena\, o saber lo que buscamos\. Obviamente no tenemos lo primero [^3]\, pero hay formas de acotar aún más la segunda opción\. Lo que queremos encontrar son características que una señal inteligente podría tener en contraste con el ruido aleatorio\.

Una forma de hacerlo es observando la vida inteligente no humana que nos rodea\. [We use Antarctica as a proxy for Mars,](https://www.cnn.com/2015/12/09/health/white-mars-antarctica-concordia/index.html 'Mars') y de forma similar puede usar animales como sustituto del lenguaje alienígena\.

Si tuviéramos reglas que creemos que las comunicaciones inteligentes deben seguir\, podríamos probar esas normas contra las comunicaciones con animales y ver qué tan bien funcionan\. Esto nos permitirá saber si necesitamos ampliar o restringir nuestros criterios de búsqueda\.

Resulta que hay dos reglas principales en la teoría del lenguaje\: la Ley de Zipf y la entropía de la teoría de la información de Shannon\. Veamos cada una por turno\.

### La ley de Zipf sobre la frecuencia de las palabras

Lo que propone la ley de Zipf es que para cada idioma\, la frecuencia de aparición de una palabra es inversamente proporcional al rango de la palabra\, si ordenas todas las palabras por frecuencia de ocurrencia\. Por ejemplo\, si \"the\" es la palabra más común\, tiene rango \#1\. Si \"i\" es la segunda palabra más común\, tiene rango \#2\. La palabra de rango \#1\, \"the\"\, aparecerá el doble de veces en el idioma que la palabra de rango \#2\, \"I\"\. Aparecerá tres veces más veces en el idioma que la palabra \#3 de rango\, y así sucesivamente\.

Con tal ley\, podemos probarlo en textos de ejemplo de ese idioma\. Por ejemplo\, alguien graficó la frecuencia de palabras en Romeo y Julieta\:

![post](../../../blog/2020_06_24_zipf/z_2.webp)

No contento de depender de algún desconocido de internet\, así que analizé mis propias publicaciones en el boletín\. Con algo de código simple en Python [^4]\, extraje el texto de todas mis publicaciones en substack\, extraje las 50 palabras principales que usé y las representé en función de su frecuencia\. La relación no es perfecta\, pero se acerca bastante a lo que predice la ley de Zipf\. Como puedes imaginar\, \"the\"\, \"to\"\, \"a\"\, \"y\"\, \"of\" aparecen con frecuencia\.

![post](../../../blog/2020_06_24_zipf/z_3.webp)

Genial\, ahora tenemos una ley\. Podemos comprobarla con animales como delfines y ballenas\, y ver si sigue siendo válida\. [Researchers did that,](https://www.seti.org/animal-communications-information-theory-and-search-extraterrestrial-intelligence-seti#:~:text=We%20also%20found%20that%20bottlenose,Zipf's%20Law%20distribution%20of%20signals.&text=In%20other%20words%2C%20baby%20bottlenose,start%20to%20whistle%20like%20adults. 'dolphin') ¡Y descubrí que sí\! [^5] En otras palabras\, es probable que la ley de Zipf también se aplique a las lenguas alienígenas\. Al aplicarla a señales del espacio exterior\, podemos filtrar parte del ruido\.

### La teoría de la información de Shannon sobre la predicción de la siguiente palabra

Teoría de la información de Shannon [^6] propone que conocer las palabras antes que otra te dará alguna pista sobre cuál es esa palabra\. Dicho de otro modo\, las palabras en una frase dependerán de cada una\. Por ejemplo\, probablemente entiendas bien la frase anterior\, aunque yo omití la última palabra \"otro\"\.

Sabiendo que hay alguna relación entre las palabras\, [we can also derive a way to score the language based on those relationships.](https://langev.com/pdf/plotkin00languageEvolution.pdf 'shannon') Estoy ignorando las matemáticas porque yo mismo no las entiendo\, pero lo principal que podemos entender es que los idiomas tienen una puntuación\.

Al graficar esas puntuaciones\, podemos ver en qué rango se encuentran la mayoría de los idiomas\. Podemos hacer el mismo proceso que antes\, puntuando delfines y ballenas\, y observando cómo funcionan sus lenguas\:

![post](../../../blog/2020_06_24_zipf/z_4.webp)

Como puedes ver\, hay un rango en el que la mayoría de los idiomas se encajan\. Si aplicamos el mismo sistema de puntuación a las señales\, también podemos filtrar aquellas que probablemente no sean idiomas\.

### Encontrar alienígenas no es tan diferente del aprendizaje automático

Empezamos con un objetivo amplio\: querer encontrar extraterrestres\.

Luego planteamos el problema y propusimos los distintos componentes que podrían ser útiles de analizar\.

Reducimos la lista a una sola parte del problema y buscamos formas de aumentar la precisión de nuestra búsqueda\. Propusimos dos criterios principales a partir de lenguas humanas y luego los validamos con otros idiomas no humanos\. De cara al futuro\, podemos usar un enfoque similar para reducir las señales que queremos estudiar más a fondo\.

Por si pensabas que todo esto era hipotético\, el enfoque anterior es [exactly what one team at SETI is using to analyse signals.](https://www.seti.org/animal-communications-information-theory-and-search-extraterrestrial-intelligence-seti#:~:text=We%20also%20found%20that%20bottlenose,Zipf's%20Law%20distribution%20of%20signals.&text=In%20other%20words%2C%20baby%20bottlenose,start%20to%20whistle%20like%20adults. 'SETI')

Como puedes ver\, el proceso en sí puede ser similar a otros problemas de análisis de datos\. Primero\, empiezas con un objetivo\. Luego\, enmarcas lo que podrías necesitar\. Después\, creas un algoritmo\. Por último\, lo pruebas para ver si aguanta\. La resolución de problemas en un campo no es tan diferente a la resolución de problemas en otro\.

[^1]: Definir qué es habitable y qué no [is difficult of course,](https://en.wikipedia.org/wiki/Circumstellar_habitable_zone 'zone') Ya que lo que nos funciona a nosotros puede no funcionar para la vida alienígena\. Algunas personas podrían creer en la vida basada en silicio en lugar de en carbono \(lo que somos\)\, sin embargo [there are difficulties with that assumption](https://astronomy.stackexchange.com/questions/20858/why-do-aliens-have-to-be-carbon-based-lifeforms 'carbon')

[^2]: Cabe señalar que \"la utilidad de la ecuación de Drake no está en resolver\, sino en contemplar todos los diversos conceptos que los científicos deben incorporar al considerar la cuestión de la vida en otro lugar\, y da a la cuestión de la vida en otro lugar una base para el análisis científico\"

[^3]: A menos que sepas algo que yo no\, en cuyo caso me interesa saber más\.\.\.

[^4]: Por simple me refiero a que tardó \<30 minutos en escribir\, y luego 3 horas en solucionar el problema\. El código es [here](https://github.com/leonlinsx/ABP-code/blob/master/Python-projects/File%20extractor.py 'git') Si te interesa adaptarlo para tus propios fines\.

[^5]: También lo probaron contra el balbuceo de bebés\, tanto humanos como delfines\. Descubren que ninguno de estos sigue la ley de Zipf\.

[^6]: Sí\, esto es _la_ [Claude Shannon, the guy who essentially taught us how to create electronic communications](https://www.itsoc.org/about/shannon 'Shannon')
