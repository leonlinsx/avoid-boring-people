---
title: "Mitos sobre la segmentación publicitaria"
description: "La segmentación publicitaria no es tan potente como podrías pensar"
pubDate: 2019-06-16
category: Technology
tags: ['business']
heroImage: '../../../blog/2019_06_16_ad/a_1.png'
locale: 'es'
sourceSlug: 'ad'
sourceHash: 'dc13e280c424181607da2dc708f7376d9ab461e55c3e7c3451f085786412207a'
---

La gente tiene con razón preocupaciones sobre la privacidad y otras en la era actual del intercambio y segmentación de ubicación\, que ha sido catalizado por el GPS\. La capacidad de segmentación publicitaria basada en la ubicación suele malinterpretarse\, como estos artículos [street fight](https://streetfightmag.com/2019/03/07/four-targeting-myths-that-devalue-the-real-power-of-location-data/) y [digiday](https://digiday.com/marketing/confessions-location-data-exec/) Detalles a continuación\. La precisión\, eficacia y escala de la localización es menor de lo que podrías pensar\.

Por pelea callejera\:

> Otra cosa que los datos de localización pueden hacer muy bien es encontrar viajeros de negocios que hayan estado en varios aeropuertos durante un determinado periodo de tiempo\, como en uno o dos meses\. Los datos de localización no pueden permitirte dirigirte a 25 millones de clientes de United Airlines que hayan estado en puertas específicas de United dentro de terminales específicas de aeropuertos específicos en el último mes

Se pueden identificar visitas generales repetidas a un lugar\, pero no con precisión ni a una escala tan grande\. El error de rango de usuario [^1] es [identical for military and civilian devices](https://www.gps.gov/systems/gps/performance/accuracy/)\, lo que lleva a una precisión de usuario de \~5 m\. El uso en interiores probablemente también haga esto más inexacto\.

Aparentemente hay [civilian equipment and tech that allows for centimetre level accuracy](https://www.novatel.com/an-introduction-to-gnss/chapter-5-resolving-errors/real-time-kinematic-rtk/) pero los costes son altos\, lo que hace que esta Cinemática en Tiempo Real \(RTK\) sea inviable para móviles en este momento [^2]\.

> Aunque tu proveedor de datos afirme haber dibujado un \"polígono personalizado\" alrededor de las tiendas Subway y UPS\, los datos de ubicación del dispositivo deben alinearse de forma precisa y exactitud con ese polígono para funcionar\. Así no funciona la localización\, aunque sea de origen GPS\. Si un proveedor de datos te dice que puede medir de forma definitiva las visitas incrementales \(a partir de un anuncio móvil\) a las tiendas de bocadillos Subway en Connecticut\, esa afirmación por sí sola debería levantar una señal de alarma\. Lo mismo ocurre con cualquier tienda en un centro comercial\. No se puede hacer con ningún tipo de escala ni fiabilidad\.

De nuevo\, ajusta tus expectativas de escala y fiabilidad\.

> Los datos de localización no pueden permitirte llegar a 30 millones de dispositivos a un par de millas del Arby\'s más cercano durante la hora de la comida en Dallas\. En primer lugar\, el 57\% de los datos de ubicación en las solicitudes de puja son erróneos por más de una milla\. Hoy en día\, intentar llegar a una audiencia a menos de una milla de un restaurante concreto puede gastar más de la mitad de tus gastos publicitarios\, a menos que tengas una forma fiable de filtrar los datos incorrectos\. Segundo\, ese tipo de escala simplemente no está disponible\, incluso si un segmento del archivo de datos afirma lo contrario

Me sorprende que un porcentaje tan grande de los datos sea incorrecto pero una distancia tan grande\, pero me fiaré de su palabra\. Si este es el caso\, no es de extrañar que la segmentación de localizaciones no pueda ser tan detallada como la gente parece esperar\.

Por digiday\:

> En el web\, el número de personas que comparten latitud y longitud al entrar en una tienda será prácticamente inexistente\. No es realista escalar este tipo de datos dado lo difícil que es para los proveedores de localización conseguirlos\.

Reiterando la escala de los datos disponibles\. Sin embargo\, espero que esto cambie con el tiempo\, a medida que más personas\, consciente o inconscientemente\, activen el compartir ubicación\. Actualmente estoy de acuerdo con este equilibrio para obtener mi línea temporal histórica dentro de Google Maps\. A mucha gente le parece inquietante\. Me gusta poder recordar dónde he estado dada mi pasión por la comida y los viajes\.

> Lo que realmente está ocurriendo es que estos proveedores de tecnología publicitaria intentan rellenar los datos limitados que ya poseen con otros conjuntos de datos de proveedores competitivos u otras fuentes desconocidas\. La mayoría de los editores reputados prefieren usar sus datos en su propio negocio antes que venderlos a proveedores de tecnología publicitaria\, ya que el potencial de ingresos es mayor frente a su propio contenido\.

Similar a la idea errónea de que Facebook vende tus datos [^3]\, los editores prefieren conservar sus propios datos antes que venderlos\. Los proveedores de tecnología publicitaria tienen que hacer que el conjunto de datos que usan parezca más grande de alguna manera\.\.\.

> ¿Quién entra en una tienda con el móvil en la mano mirando la web de un editor\? Así no se comporta la gente cuando compra\. Y sin embargo\, hay proveedores de datos de ubicación que venden conjuntos de datos de personas que tienen más probabilidades de entrar en una tienda tras ver un anuncio\.

Con la falta de objetivos alternativos de medición\, los cambios en las visitas a la tienda tras campañas publicitarias parecen ser la métrica predeterminada a seguir\. Sin embargo\, puedo entender un poco la razón por la que este proveedor de datos afirme esto\. Por ejemplo\, si ejecuto una campaña para una venta que solo aparece a los espectadores del anuncio\, se reclama en la tienda y no se anuncia en ningún otro sitio\. Entiendo el punto de Digiday de que esta es una medida inexacta\.

[^1]:
    Según la web\, es diferente de la precisión del usuario\. Parece que la URE influye en la precisión del usuario\, pero no es el único elemento\.

    > Para que quede claro\, la URE no es la precisión del usuario\. La precisión del usuario depende de una combinación de geometría del satélite\, URE y factores locales como el bloqueo de la señal\, las condiciones atmosféricas y las características\/calidad del diseño del receptor\.

[^2]: [u-blox claims to be taking this 'to the next level' which hopefully means cheaper and more mainstream usage eventually?](https://www.u-blox.com/en/high-precision-positioning)

[^3]: Quizá un tema para otro momento\, pero hay un matiz entre vender tus datos y vender acceso a ellos\. Facebook quiere conservar la mayor cantidad posible de tus datos\, anonimizados a gran escala\, y vender el derecho a segmentar anuncios basándose en esos datos que Facebook conserva
