---
title: "Eficiencia en el cálculo de Excel"
description: "Notas sobre consejos de velocidad para Excel"
pubDate: 2016-03-17
category: System Design
tags: ['investment banking']
heroImage: './e_1.png'
locale: 'es'
sourceSlug: 'excel'
sourceHash: '658f73ba1e40df367c86978fb2e3fde6def4efdf9bf18e1d34975fed5dc10592'
---

Hace un tiempo tuve que investigar en profundidad sobre la eficiencia de Excel\. Algunos de los archivos que usábamos en la banca tardaban mucho en calcular\, y queríamos ver qué mejoras se podían hacer\. Hay mucho contenido disponible\, y estos fueron los sitios más útiles que encontré\. Sin embargo\, no estoy necesariamente de acuerdo con todo el contenido\:

1. Propio de Microsoft ['improving performance' writeup](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)> 'office performance 2007')
   - \"Con el Excel 2007 \"Big Grid\"\, el rendimiento realmente importa\"
   - \"Excel tiene tres fases distintas en el proceso general de cálculo\:
     - Construye la cadena inicial de cálculo y determina por dónde empezar a calcular\. Esta fase ocurre cuando el libro de trabajo se carga en la memoria\.
     - Rastrea las dependencias\, marca las celdas como no calculadas y actualiza la cadena de cálculo\. Esta fase se ejecuta en cada entrada o cambio de celda\, incluso en modo de cálculo manual\. Normalmente esto se ejecuta tan rápido que no te das cuenta\.
     - Calcula todas las fórmulas\. Como parte del proceso de cálculo\, Excel reordena y reestructura la cadena de cálculo para optimizar futuros recálculos\.\"
   - \"Una función volátil siempre se recalcula en cada recálculo aunque no parezca haber cambiado precedentes\. Usar muchas funciones volátiles ralentiza cada recálculo\, pero no hace diferencia para un cálculo completo\.
     - Algunas de las funciones integradas en Excel son obviamente volátiles\: RAND\(\)\, NOW\(\)\, TODAY\(\)\. Otras son menos volátiles evidentes\: OFFSET\(\)\, CELL\(\)\, INDIRECT\(\)\, INFO\(\)\.
     - Algunas funciones que previamente se han documentado como volátiles no lo son en realidad\: INDEX\(\)\, ROWS\(\)\, COLUMNS\(\)\, AREAS\(\)\.\"
     - Nota\: esto pudo haber cambiado en versiones posteriores de Office
   - Ofrecen una lista de acciones volátiles que desencadenan recálculos
   - También proporcionan una macro para medir el tiempo de cálculo
   - Ellos dan algunos [golden rules to follow,](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#first-golden-rule-remove-duplicated-repeated-and-unnecessary-calculations> 'golden rules') con la intención general de simplicidad
     - Eliminar cálculos duplicados\, repetidos e innecesarios
     - Utiliza la función más eficiente posible
     - Aprovecha bien el recálculo inteligente
     - Tiempo y prueba de cada cambio
   - Ofrecen un buen ejemplo de [how to simplify a problem](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#dynamic-count-unique> 'example problem')
   - Y repasa una larga lista de cuellos de botella comunes con las fórmulas

2. [Another site](https://trumpexcel.com/suffering-from-slow-excel-spreadsheets/ 'trump excel') Con consejos de velocidad de Excel
   - \"Usar columnas auxiliares\"
     - Totalmente de acuerdo\, y normalmente poco aprovechado por muchos
   - \"Usa tablas de Excel y rangos nombrados\"
     - Estoy de acuerdo con los rangos con nombre\, aunque a menudo soy demasiado perezoso
   - \"Usar técnicas de fórmulas más rápidas\"
     - Fíjate en los consejos repetidos

3. [Yet another site](http://www.databison.com/how-to-speed-up-calculation-and-improve-performance-of-excel-and-vba/ 'databison')
   - \"Aislar fórmulas repetidas y moverlas a celdas individuales\"
     - Relacionado con el punto de la columna de ayuda anterior
   - \"Anidar si las condiciones coinciden en el orden de frecuencia de ocurrencia\"
     - Ya no recuerdo si esto es cierto\, así que tómalo con cautela

4. Y por último\, un sitio que compara la velocidad de [vlookup vs index match](http://www.exceluser.com/blog/727/excels-fastest-lookup-methods-the-tested-results.html 'vlookup vs index match')
   - La igualación del índice siempre es superior en eficiencia
   - Dicho esto\, sigo usando vlookups cuando es una simple extracción o cuando creo que mi modelo va a ser revisado por alguien que se confundirá con la coincidencia del índice\. Diseña pensando en el usuario final\.
