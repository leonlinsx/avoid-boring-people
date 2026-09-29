---
title: "Mythes de ciblage publicitaire"
description: "Le ciblage publicitaire n’est pas aussi puissant qu’on pourrait le penser"
pubDate: 2019-06-16
category: Technology
tags: ['business']
heroImage: './a_1.png'
locale: 'fr'
sourceSlug: 'ad'
sourceHash: 'dc13e280c424181607da2dc708f7376d9ab461e55c3e7c3451f085786412207a'
---

Les gens ont à juste titre des préoccupations en matière de vie privée et d’autres préoccupations à l’ère actuelle du partage de localisation et du ciblage\, qui a été catalysé par le GPS\. La capacité du ciblage publicitaire basé sur la localisation est généralement mal comprise\, comme ces articles sur [street fight](https://streetfightmag.com/2019/03/07/four-targeting-myths-that-devalue-the-real-power-of-location-data/) et [digiday](https://digiday.com/marketing/confessions-location-data-exec/) Détails ci\-dessous\. La précision\, l’efficacité et l’échelle du ciblage de localisation sont inférieures à ce que l’on pourrait penser\.

Par bagarre de rue \:

> Une autre chose que les données de localisation peuvent très bien faire est de trouver des voyageurs d’affaires ayant fréquenté plusieurs aéroports sur une certaine période\, par exemple en un mois ou deux\. Mais\, les données de localisation ne peuvent pas vous permettre de cibler 25 millions de clients United Airlines qui ont été à des portes United spécifiques dans des terminaux spécifiques d’aéroports spécifiques au cours du mois dernier

On peut identifier des visites générales répétées à un lieu\, mais pas à la précision et pas à une telle échelle\. L’erreur de plage utilisateur [^1] est [identical for military and civilian devices](https://www.gps.gov/systems/gps/performance/accuracy/)\, ce qui conduit à une précision utilisateur de \~5 m\. L’utilisation en intérieur risque aussi de rendre cela plus inexact\.

Il y en a apparemment [civilian equipment and tech that allows for centimetre level accuracy](https://www.novatel.com/an-introduction-to-gnss/chapter-5-resolving-errors/real-time-kinematic-rtk/) mais les coûts sont élevés\, rendant cette cinématique en temps réel \(RTK\) actuellement irréalisable pour les mobiles [^2]\.

> Même si votre fournisseur de données affirme avoir dessiné un « polygone personnalisé » autour des magasins Subway et UPS\, les données de localisation des appareils doivent s’aligner précisément et précisément avec ce polygone pour fonctionner\. Ce n’est pas ainsi que fonctionnent les données de localisation\, même si elles proviennent du GPS\. Si un fournisseur de données vous dit qu’il peut mesurer de manière définitive les visites incrémentales \(via une publicité mobile\) aux sandwicheries Subway dans le Connecticut\, cette affirmation seule devrait être un signal d’alarme\. Il en va de même pour n’importe quel magasin dans un centre commercial\. Cela ne peut pas se faire avec une quelconque échelle ou fiabilité\.

Encore une fois\, ajustez vos attentes d’échelle et de fiabilité\.

> Les données de localisation ne peuvent pas vous permettre d’atteindre 30 millions d’appareils dans un rayon de quelques miles autour de l’Arby’s le plus proche pendant l’heure du déjeuner à Dallas\. Tout d’abord\, 57 \% des données de localisation dans les demandes d’enchères sont fausses de plus d’un mile\. Aujourd’hui\, essayer d’atteindre un public à moins d’un mile d’un restaurant spécifique peut brûler plus de la moitié de vos dollars publicitaires\, à moins d’avoir un moyen fiable de filtrer les données incorrectes\. Deuxièmement\, ce type d’échelle n’est tout simplement pas disponible\, même si un segment dans le magasin de données affirme le contraire

Je suis surpris qu’un pourcentage aussi important des données soit erroné mais une si grande distance\, mais je leur crois sur parole\. Si c’est le cas\, il n’est donc pas étonnant que le ciblage par localisation ne soit pas aussi précis que les gens semblent l’espérer\.

Selon la journée \:

> Pour le web\, le nombre de personnes partageant latitude et longitude en entrant dans un magasin sera relativement inexistant\. Il est irréaliste d’écheller ce type de données étant donné la difficulté des fournisseurs de localisation à les obtenir\.

Je réitère l’ampleur des données disponibles\. Je m’attends cependant à ce que cela évolue avec le temps\, à mesure que plus de gens\, sciemment ou non\, activeront le partage de localisation\. Je suis actuellement d’accord avec ce compromis afin d’obtenir ma chronologie historique dans Google Maps\. Beaucoup de gens trouvent cela inquiétant\. J’aime pouvoir me souvenir d’où j’ai été vu ma passion pour la nourriture et les voyages\.

> Ce qui se passe réellement\, c’est que ces fournisseurs de technologies publicitaires essaient d’enrichir les données limitées qu’ils possèdent déjà avec d’autres ensembles de données provenant de fournisseurs concurrents ou d’autres sources inconnues\. La plupart des éditeurs réputés préfèrent utiliser leurs données dans leur propre entreprise plutôt que de les vendre à des fournisseurs de technologies publicitaires\, car le potentiel de revenus est plus élevé par rapport à leur propre contenu\.

Un peu comme l’idée reçue selon laquelle Facebook vend vos données [^3]\, les éditeurs préfèrent conserver leurs propres données plutôt que de les vendre\. Les fournisseurs de technologies publicitaires doivent faire paraître le jeu de données qu’ils utilisent plus grand d’une manière ou d’une autre\.\.\.

> Qui entre dans un magasin avec son téléphone en main en regardant le site d’un éditeur \? Ce n’est pas ainsi que les gens se comportent lorsqu’ils font leurs achats\. Et pourtant\, il existe des fournisseurs de données de localisation qui vendent des ensembles de données de personnes plus susceptibles d’entrer dans une boutique après avoir vu une publicité\.

En l’absence d’objectifs de mesure alternatifs\, les changements de visites en magasin après les campagnes publicitaires semblent être la métrique par défaut à suivre\. Je comprends un peu la raison pour laquelle ce fournisseur de données affirme cela\. Par exemple\, si je lance une campagne pour une vente qui n’apparaît qu’aux spectateurs de la pub\, est revendiquée en magasin et n’est annoncée nulle part ailleurs\. Je comprends le point de Digiday \: cette mesure est inexacte\.

[^1]:
    Différent de la précision utilisateur\, selon le site\. Il semble que l’URE joue un rôle dans la précision utilisateur\, mais ce n’est pas le seul élément\.

    > Pour être clair\, l’URE n’est pas une précision utilisateur\. La précision de l’utilisateur dépend d’une combinaison de géométrie du satellite\, d’URE et de facteurs locaux tels que le blocage du signal\, les conditions atmosphériques et les caractéristiques\/qualité de conception du récepteur\.

[^2]: [u-blox claims to be taking this 'to the next level' which hopefully means cheaper and more mainstream usage eventually?](https://www.u-blox.com/en/high-precision-positioning)

[^3]: Peut\-être un sujet pour une autre fois\, mais il y a une nuance entre vendre vos données et vendre l’accès à vos données\. Facebook veut conserver autant de données que possible\, anonymisées à grande échelle\, et vendre le droit de cibler des publicités basées sur ces données que Facebook conserve
