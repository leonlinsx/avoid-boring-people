---
title: "Valeurs P - vous (et moi) vous vous trompez"
description: "Que signifie réellement une valeur p"
pubDate: 2019-09-04
category: Risk & Decision Making
tags: ['math']
heroImage: '../../../blog/2019_04_09_pvalue/p_1.webp'
locale: 'fr'
sourceSlug: 'pvalue'
sourceHash: '4a1fb3af69e0e255c81d9e518a885d55d00cff57669f82853377e51b1475ee32'
---

La plupart d’entre nous ont étudié les valeurs p dans un cours de statistiques à un moment donné\. La plupart d’entre nous pensent avoir compris assez à l’époque \; nous avons réussi notre cours après tout\. La plupart d’entre nous ont beaucoup tort\.

En raison d’une utilisation abusive généralisée de la valeur p\, [some scientists are speaking out against the application of p values in research](https://www.nature.com/articles/d41586-019-00857-9 'against p values')\:

> Nous ne réclamons pas une interdiction des valeurs P\. Nous ne disons pas non plus qu’elles ne peuvent pas être utilisées comme critère décisionnel dans certaines applications spécialisées \(comme déterminer si un procédé de fabrication respecte une certaine norme de contrôle qualité\)\. Et nous ne plaidons pas non plus pour une situation où tout est permis\, où des preuves faibles deviennent soudainement crédibles\. Au contraire\, et conformément à beaucoup d’autres au fil des décennies\, nous demandons l’arrêt de l’utilisation des valeurs P de manière conventionnelle et dichotomique — pour décider si un résultat réfute ou soutient une hypothèse scientifique

Les auteurs demandent de changer la perception des valeurs p comme « la seule chose » qui détermine si les résultats de la recherche sont acceptés ou non\. Ils expliquent ensuite leur raisonnement\, et exposent aussi quelques alternatives\, que j’aborderai dans un instant\.

Tout d’abord\, pour mieux comprendre ce qu’ils défendent\, il faut se rafraîchir la mémoire [what p values are](https://www.nature.com/articles/d41586-019-00874-8 'p values') [^1]\:

> une mesure de la surpreté d’un résultat\, compte tenu des hypothèses sur une expérience\, notamment qu’aucun effet n’existe\. Le fait qu’une valeur P dépasse ou descende un seuil arbitraire délimitant la « signification statistique » \(comme 0\,05\) détermine si les hypothèses sont acceptées\, si des articles sont publiés et si des produits sont mis sur le marché\.

Nous faisons donc un calcul autour de nos résultats\, obtenons un nombre X\, puis rejetons notre hypothèse nulle si notre nombre X est \<0\,05\, ce qui implique la crédibilité de notre hypothèse alternative [^2]\. Le processus lui\-même semble mécanique mais en partie compréhensible\. Le problème vient de l’interprétation de ce que nous venons de faire\. X est\-il la probabilité que vous fassiez une erreur en rejetant l’hypothèse nulle \? X est\-il la probabilité que vous ayez tort en acceptant l’hypothèse alternative \? 1 \- X est\-il la probabilité que vous ayez raison \?

Aucune des interprétations ci\-dessus n’est correcte\, montrant comment les statistiques peuvent être non intuitives\, et pourquoi [not even scientists for meta-science can explain what p values mean intuitively](https://fivethirtyeight.com/features/not-even-scientists-can-easily-explain-p-values/? 'easily explain')\:

> Nous voulons savoir si les résultats sont exacts\, mais une valeur p ne mesure pas cela\. Elle ne peut pas vous donner l’ampleur d’un effet\, la force des preuves ou la probabilité que la découverte soit le résultat du hasard\.

> Alors\, quelles informations pouvez\-vous tirer d’une valeur p \? L’explication la plus simple que j’ai trouvée vient de Stuart Buck\, vice\-président de l’intégrité de la recherche à la Laura and John Arnold Foundation\. Imaginez\, disait\-il\, que vous ayez une pièce que vous soupçonnez d’être penchée en faveur de face\. \(Votre hypothèse nulle est alors que la pièce est équitable\.\) Vous la lancez 100 fois et obtenez plus de pile que pile\. La valeur p ne vous dira pas si la pièce est équitable\, mais elle vous indiquera la probabilité d’obtenir au moins autant de faces que si la pièce était équitable\. C’est tout — rien de plus\.

Il est important de noter que votre valeur p est la probabilité d’obtenir le résultat que vous avez\, _selon l’hypothèse nulle supposée_\. Si votre hypothèse nulle était correcte\, vous n’auriez obtenu le résultat que vous n’avez obtenu que dans X \% d’expériences\. Puisque X est un nombre faible\, vous supposez qu’il est peu probable que l’hypothèse nulle soit correcte\, et vous la rejetez\. Cela ne vous indique pas la probabilité d’obtenir le résultat que vous avez _lorsqu’on ne suppose pas l’hypothèse nulle_\.

Supposons que nous ayons une expérience pour voir si la taille moyenne d’un groupe de personnes est nulle\. Nous rejetterions notre hypothèse nulle avec une valeur p très basse\, puisque la taille de tout le monde est évidemment \>0\. Cependant\, cela ne nous dit rien sur la probabilité d’obtenir la taille moyenne que nous avons calculée dans cet « état réel du monde »\. Cela nous indique simplement qu’il y avait une faible probabilité que nous ayons obtenu la hauteur moyenne que nous avons eue\, _si la taille moyenne était 0_ [^3]\.

Clairement\, les valeurs p sont plus nuancées que le simple oui\/non que la plupart des gens \(moi y compris\) croyaient [^4]\. Les auteurs du premier texte poursuivent en disant \:

> Soyons clairs sur ce qui doit s’arrêter \: nous ne devons jamais conclure qu’il n’y a « aucune différence » ou « aucune association » simplement parce qu’une valeur P est supérieure à un seuil tel que 0\,05 ou\, de manière équivalente\, parce qu’un intervalle de confiance inclut zéro\. Nous ne devons pas non plus conclure que deux études sont contradictoires parce que l’une a eu un résultat statistiquement significatif et l’autre non\.

> Des enquêtes menées auprès de centaines d’articles ont révélé que des résultats statistiquement non significatifs sont interprétés comme indiquant « aucune différence » ou « aucun effet » dans environ la moitié des personnes

Les résultats statistiques non significatifs ne signifient pas la même chose que l’absence d’effet\. En fait\, les auteurs préfèrent éviter l’utilisation de « statistiquement significatif » \:

> Nous sommes d’accord et appelons à abandonner tout le concept de signification statistique\.

Leur raison est que cette désignation de signification oui\/non est une fausse dichotomie \:

> Le problème est plus humain et cognitif que statistique \: le segment en « statistiquement significatif » et « statistiquement non significatif » fait penser que les items attribués de cette manière sont catégoriquement différents \\\[\.\.\.\\\] Une raison d’éviter cette « dichotomie » est que toutes les statistiques\, y compris les valeurs P et les intervalles de confiance\, varient naturellement d’une étude à l’autre\, et souvent à un degré surprenant\. En fait\, la variation aléatoire seule peut facilement entraîner de grandes disparités dans les valeurs P\, bien au\-delà de tomber juste de chaque côté du seuil de 0\,05\.

Cela me paraît logique\, mais cela semble être une bataille difficile\. Lorsqu’on prend des décisions compliquées\, les gens veulent des heuristiques simples à utiliser\, et les valeurs p offrent un moyen simple de justifier quelque chose

Les auteurs discutent également de certains points à garder à l’esprit lors de l’utilisation des intervalles de confiance [^5]\:

> Premièrement\, ce n’est pas parce que l’intervalle donne les valeurs les plus compatibles avec les données\, compte tenu des hypothèses\, que les valeurs extérieures sont incompatibles \; elles sont simplement moins compatibles\.

> Deuxièmement\, toutes les valeurs contenues ne sont pas également compatibles avec les données\, compte tenu des hypothèses\.

> Troisièmement\, comme le seuil de 0\,05 dont elle est issue\, les 95 \% par défaut utilisés pour calculer les intervalles sont eux\-mêmes une convention arbitraire\.

> Enfin\, et surtout\, soyez humble \: les évaluations de compatibilité reposent sur la justesse des hypothèses statistiques utilisées pour calculer l’intervalle\.

Et ils concluent avec leur vision de ce à quoi ressemblerait un monde sans une seule insistance sur les valeurs p \:

> À quoi ressemblera la retraite de la signification statistique \? Nous espérons que les sections méthodes et la tabulation des données seront plus détaillées et nuancées\. Les auteurs mettront l’accent sur leurs estimations et l’incertitude qui s’y trouve — par exemple\, en discutant explicitement des limites inférieure et supérieure de leurs intervalles\. Ils ne s’appuieront pas sur des tests de signification\. Lorsque les valeurs P seront rapportées\, elles seront données avec une précision raisonnable \(par exemple\, P \= 0\,021 ou P \= 0\,13\) — sans ornements tels que des étoiles ou des lettres pour indiquer la signification statistique et non comme des inégalités binaires \(P \< 0\,05 ou P \> 0\,05\)\. Les décisions d’interpréter ou de publier les résultats ne seront pas basées sur des seuils statistiques\. Les gens passeront moins de temps avec les logiciels statistiques\, et plus de temps à réfléchir\.

Comme je l’ai déjà écrit\, [beliefs are tricky](/writing/why 'belief')\, même si vous êtes un fervent partisan de la science\. L’expérimentation est une partie clé du fonctionnement du processus scientifique\, et comprendre comment interpréter les résultats en est un élément important\. La mauvaise compréhension des valeurs p a conduit à des idées fausses sur les études lorsqu’elles sont rapportées dans les médias\. Malheureusement\, je ne vois pas cela changer de sitôt\, car il est beaucoup plus facile d’interpréter les valeurs p comme une question oui\/non\. Je ne sais pas si la solution est de réduire la signification des valeurs p\, mais être plus conscient de leur mauvais usage est utile\.

[^1]: L’article dont provient la description ci\-dessous résume également les principaux arguments de l’article d’ouverture par Valentin Amrhein\, Sander Greenland\, Blake McShane

[^2]: Dans mon premier brouillon\, j’ai écrit « acceptez notre hypothèse et rejetez\-la autrement »\, ce qui est une mauvaise interprétation de ce qu’est une valeur p\. Cela montre à quel point il est facile de faire une erreur\, et je suis maintenant un peu paranoïaque à l’idée d’en avoir fait une autre dans ce post\.

[^3]:
    D’autres ressources que j’ai trouvées utiles à relire sont [here](https://blog.minitab.com/blog/adventures-in-statistics-2/how-to-correctly-interpret-p-values 'interpret') et [here](https://blog.minitab.com/blog/adventures-in-statistics-2/understanding-hypothesis-tests-significance-levels-alpha-and-p-values-in-statistics? 'stats')\. En plus de discuter des raisons pour lesquelles la valeur p n’est pas la même que le taux d’erreur\, le site proposait aussi un tableau intéressant qui montrait comment une faible valeur p pouvait entraîner un taux d’erreur élevé \:

    | Valeur p | Probabilité de rejeter incorrectement une hypothèse nulle \(qui est réellement vraie\) |
    | ------- | ------------------------------------------------------------------------------ |
    | 0\.05    | Au moins 23 \% \(et généralement près de 50 \%\)                                      |
    | 0\.01    | Au moins 7 \% \(et généralement près de 15 \%\)                                       |

    > « Les taux d’erreur plus élevés dans ce tableau vous surprennent \? Malheureusement\, la mauvaise interprétation courante des valeurs P comme taux d’erreur crée l’illusion de preuves nettement supérieures à l’hypothèse nulle que ce qui est justifié\. Comme vous pouvez le voir\, si vous basez une décision sur une seule étude avec une valeur P proche de 0\,05\, la différence observée dans l’échantillon peut ne pas exister au niveau de la population\. »

[^4]: Et ce\, malgré plusieurs cours de statistiques au lycée et à la fac\.\.\. ce qui montre soit à quel point c’est difficile\, soit combien de temps je mets à comprendre quelque chose\.

[^5]: Ils préfèrent aussi le terme « intervalle de compatibilité »
