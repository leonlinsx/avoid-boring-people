---
title: "Panorama industrial del análisis de datos"
description: "Visión general del mercado, riesgos y panorama competitivo"
pubDate: 2021-03-07
category: Technology
tags: ['business', 'data', 'software']
evergreen: false
heroImage: '../../../blog/2021_03_07_data_landscape/d_1.webp'
locale: 'es'
sourceSlug: 'data_landscape'
sourceHash: '3ceeb4d616b74fcc264ff995790c97a06de33969f39d827a51204c59697972d0'
---

## Conclusión

Recientemente tuve que preparar un análisis sobre la industria de la pipeline de datos y pensé que debería compartirlo\. Vamos a repasar\:

1.  Una visión general del mercado\,
2.  riesgos\,
3.  Empresas implicadas en cada etapa

## 1\. Visión general del mercado

La industria de canalizaciones de datos tiene un TAM de \>100\.000 millones de dólares\, con algunas empresas por sí solas valoradas cerca de ese valor [^1]\. Dado que las canalizaciones de datos son un área amplia\, restringiré la discusión a sectores más relevantes para el análisis de datos\. Una mezcla de empresas públicas y privadas compiten por encajar dentro de la pila tecnológica de organizaciones que utilizan datos\, que es prácticamente cualquier empresa grande hoy en día [^2]\.

Los datos fluyen desde interacciones generadas por clientes o proveedores hacia transacciones en bruto **Bases de datos**\. Los datos se \*\*mueven \*\*y **transformado** al modelo adecuado para almacenes de datos analíticos\. A partir de ahí\, los analistas pueden consultar los datos que les interesan **Análisis**\. Utilizan los resultados para el usuario final **Visualización de datos** de métricas empresariales\.

Todos estos procesos en negrita hacen que empresas se especializen en desarrollar software o asesorar en implementación\. La mayoría de las empresas más nuevas están basadas en la nube \(con algunas en las instalaciones\)\, y están por encima de proveedores de servicios como Amazon Web Services \(AWS\) [^3]\, y aprovechar la escalabilidad\, flexibilidad y frugalidad para construir empresas de alto margen\.

Dada la tasa de crecimiento de la generación de datos y los ingresos asociados \(\>20\% interanual\)\, la mayoría de las startups en este sector son oportunidades emocionantes de inversión\, representando ratios riesgo\/rentabilidad asimétricos y múltiplos de salida demostrados y altos\. Si crees en el crecimiento de la industria de las startups\, tienes que confiar en que la industria de la pipeline de datos la respalde\.

## 2\. Riesgos

- Seguridad \(95\% de probabilidad\) \- Grandes beneficios significan altas recompensas para actores maliciosos que obtienen datos de forma ilegal [^4]\. Si los costes de seguridad suben \(y lo harán\)\, esto perjudicará los márgenes empresariales
- Regulación de la privacidad de datos \(70\%\) \- Esto incrementa los costes de cumplimiento\, ayudando a los incumbentes y perjudicando a las startups
- Presión de márgenes aguas arriba \(30\%\) \- Si hubiera más consolidación industrial en ciertas capas de la pila de datos\, esas empresas podrían exprimir márgenes para empresas que no tienen alternativas [^5]

## 3\. Paisaje

Empezaremos con lo que el usuario puede ver\, en el **Visualización** fin\. Cuando un analista ya ha limpiado los datos formateados en la estructura que desea\, necesita organizar esa información\. Esto suele adoptar la forma de un panel de control con gráficos y tablas\. Algunas herramientas en este ámbito incluyen Tableau\, Looker\, Google Data Studio\, R Shiny \(paneles de control para navegador\, fáciles de usar\)\, Streamlit \(aplicaciones de datos interactivas\) o incluso Google Sheets\.

Los sacrificios al elegir una herramienta aquí son la capacidad técnica de los usuarios frente a la complejidad de los datos\. Si una organización tiene muchos usuarios que quieren colaborar en el mismo proyecto\, una herramienta sencilla como Sheets funciona\. Si hay menos usuarios y solicitudes de funcionalidades\, construir algo que pueda manejar cargas mayores en un software de dashboarding podría tener sentido\.

Antes de la visualización\, el analista necesita\.\.\.**Analizar los datos**\. Lo hacen consultando los datos de una base de datos estructurada con un lenguaje de consulta\. Esto podría ser algo como Presto \(baja latencia\, bajo rendimiento\) o Hive \(alta latencia\, alto rendimiento\)\.

Estos cálculos se realizan en una capa de data warehouse\, que puede ser algo como Snowflake\, Redshift\, BigQuery o Azure\. Los que están ganando popularidad son los en la nube\, y algunos también permiten escalar y facturar por separado el uso de computación frente al almacenamiento\. Los almacenes de datos pueden ser mejores para hacer análisis que las bases de datos\, que pueden ser mejores para almacenar datos\.

Los compromisos aquí incluyen precio\, escalado y soporte\. Por ejemplo\, podrías empezar con Postgres de código abierto\, pero luego cambiar a Snowflake cuando tu empresa haya escalado más allá del tamaño para el que Postgres es adecuado y esté enfrentando errores más técnicos\.

Para llevar esos datos a los almacenes\, puede haber **Movimiento de datos** y capas de modelado de \*\*datos\*\*\. Empresas como Stitch\, Fivetran\, Segment\, Airbyte te ayudan a extraer tus datos de fuentes en bruto \(ya llegaremos a esto\) y a meterlos en tu base de datos para que puedas consultarlos\. Los Data Movers son comúnmente conocidos como una combinación de Extract\, Load\, Transform \(ELT\)\, Extract\, Transform\, Load \(ETL\)\, o algún subconjunto de esas combinaciones\.

Modeladores de datos como dbt\, Matillion y Looker te permiten mapear esos datos en bruto en la estructura que requiere tu almacén\. Por ejemplo\, dbt te permite transformar tus datos en un entorno de desarrollo integrado \(IDE\)\, programar trabajos de transformación y crear documentación de cómo son los datos\.

Los compromisos aquí son el precio\, la complejidad y otras características técnicas\. Por ejemplo\, creo que Fivetran tiene más integraciones mientras que Stitch tiene menos\. La elección de una herramienta de movimiento de datos también puede afectar la herramienta de modelado de datos utilizada\; puedes pensar en esto como no necesitar transformar los datos dos veces\.

Todos esos datos provienen de las interacciones entre clientes y proveedores en bruto\. **Datos fuente**\. Esto incluye herramientas de software como Salesforce\, Zendesk\, Hubspot \(CRM\)\. Como son empresas diferentes\, sus formatos de datos son distintos\: piénsalo como monedas distintas para distintos países\. De ahí la necesidad de las capas de movimiento y modelado de datos mencionadas antes\.

Los datos fuente probablemente se almacenan en alguna base de datos como Postgres\, MongoDB [^6]\, o incluso Oracle si eres un fanático del dolor\. A diferencia de los almacenes de datos\, estas bases de datos almacenan mejor los datos de interacción tal como se generan en tiempo real\; escriben más rápido\, se leen más lentos\.

Resumiendo todo\:

![post](../../../blog/2021_03_07_data_landscape/d_1.webp)

Gracias a Paul Tune\, a los participantes del Recurse Center Shae Matijs Erisson\, Ori Dean Bernstein\, Mikkel Paulson\, Steven Li\, Ryan Prior\, Luke Barone\-Adesi\, Chirag Davé\, Nathan Goldbaum y a los miembros de Locally Optimistic Jacob Matson\, Arpit Choudhury\, Gordon Wong\, Kevin Hu e Itto Kornecki por echar un vistazo a esto\.

[^1]: Me exigieron proporcionar TAM para mis análisis\, que en mi opinión suelen ser cifras inventadas\. En fin\, aquí están los míos\: Snowflake \(SNOW\) por sí solo se negocia con un tope de 70\.000 millones de dólares en mkt con 200 millones de rev\. La visualización de datos es 10\.000 millones de dólares\, el análisis de datos 40\.000 millones\, el almacenamiento de datos 20\.000 millones\, ELT\/ETL 10\.000 millones y la base de datos 50\.000 millones por comunicados de prensa del sector

[^2]: A partir de cierta escala\, ya no es factible almacenar datos en un software gratuito de hojas de cálculo personales

[^3]: AWS probablemente valga cientos de miles de millones en una regeneración de 10\.000 millones de dólares\; La he excluido a ella y a los otros proveedores principales del análisis por simplicidad

[^4]: Los datos pueden venderse en línea\, usarse para fraudes o retenerse como pedir rescate\. Para la mayoría de las empresas\, es cuestión de cuándo son hackeadas\, no de si\.

[^5]: Dada la competencia en la mayoría de los niveles\, normalmente ha habido deflación de costes en general\, más que inflación

[^6]: Como señala Paul Tune\, puedes tener tanto bases de datos relacionales \(Postgres\, MySQL\) como no relacionales\, como MongoDB y DynamoDB \(un producto de AWS\)\. La naturaleza no estructurada de esta última crea desafíos para las empresas que intentan realizar análisis\.
