---
title: "Râteaux de marché"
description: "Taux de prise de référence pour différents marchés"
pubDate: 2019-04-27
category: Technology
tags: ['marketplace']
heroImage: '../../../blog/2019_04_27_rake/t_1.webp'
locale: 'fr'
sourceSlug: 'rake'
sourceHash: 'd41c4ceb6c388ccc2108108bee3cc93c0fe9a951ea418a505e2e79c4508dcce7'
---

Je suis fasciné par les places de marché et les effets de réseau car une grande partie d’Internet repose sur la réussite des entreprises\, par exemple les effets réseau de Facebook\, la place de marché tierce d’Amazon\, la place de marché publicitaire de Google\.

Cet article détaille mes réflexions sur une analyse fondamentale du facteur de ratissage de marché que j’ai vue Josh Breinlinger écrire [here.](http://acrowdedspace.com/post/172383900012/marketplace-rake-factors 'rake factors')

J’ai aimé l’article de Josh sur les facteurs de rateau parce que c’est le premier que j’ai vu qui tente d’élaborer des raisons fondamentales pour lesquelles un rake est fixé à un certain pourcentage\, plutôt que simplement « parce que les comparables sont à ce rake »\. Certains \(beaucoup \?\) marchés sont effectivement simplement tarifés en fonction des comparables\, mais j’aime quand même avoir un framework\.

J’avais d’autres réflexions \:

- Il existe certains marchés qui semblent être des exceptions à ce cadre \(ce que Josh admet lui\-même ne pas être définitif\)
  - Par exemple\, le marché de la photographie de stock m’a toujours intrigué depuis que quelqu’un l’a souligné\. \[Le râteau là\-bas peut être \>50 \%\,\] \(\(https://microstockinsider.com/microstock_commission_rates « commissions photographiques »\) un montant incroyable pour un service qui compte autant de concurrents\, des frais transparents et des coûts marginaux minimes du côté des plateformes\.
  - Par exemple\, les rakes sur les marketplaces e\-commerce chinois sont très faibles comparés aux marketplaces américaines\, par exemple taobao \~4 \% contre ebay \~9 \%
- Je pense qu’ajouter un facteur supplémentaire de \+3 \% pour « activité promotionnelle » sur la plateforme pourrait être utile
  \_ Par exemple\, la rev du marché du commerce électronique chinois mentionnée ci\-dessus provient principalement des activités marketing\, et le coût moyen est de \~4 \% 
  \_ Par exemple\, comment booking\.com permet aux annonceurs de devenir des membres privilégiés avec un meilleur placement à 300 points de base
  \_ Par exemple\, le programme de fidélité de l’hôtel en moyenne \~3 \% de rev est en augmentation des coûts pour l’hôtel
  \_ Par exemple\, le rateau de livraison de nourriture de Seamless passait de 12\,5 \% à 20 \%\, soit une différence de 7\,5 \% \(ce qui est
  plus de 3 \%\, mais le restaurant moyen paierait 15 \% et non le rake de 12\,5 \%\, ce qui implique une différence plus faible\) \\\* Par exemple\, je suppose qu’Ubereats facturera quelques points de pourcentage pour [promotional placement of restaurants](https://techcrunch.com/2018/12/10/uber-ads/ 'uber ads') De même
- Je pense que les entreprises qui entrent sur un marché avec l’intention de sous\-vendre leur concurrent fixent aussi leur taux de prise 5 \% à 10 \% inférieur à celui de l’actuel incumbent
  - Par exemple\, comment booking\.com obtenu\- des tarifs inférieurs ou plus pour dépasser son concurrent et [won the market that way](https://skift.com/2012/06/25/how-booking-com-conquered-world/ 'OTA history')
  - Par exemple\, les taux de Seatgeek semblent être 5 \%\+ inférieurs à ceux de l’entreprise en place d’après mes propres benchmarks
  - Par exemple\, les petites agences chinoises de transport en ligne \(OTA\) sont censées avoir \~10 \% de rake contre \~15 \% de rake des OTA principales
- Je n’ai pas vu beaucoup de rachats \> 20 \% qui se maintiennent dans le temps\. De la même manière que Bill Gurley parle de [a rake too far](http://abovethecrowd.com/2013/04/18/a-rake-too-far-optimal-platformpricing-strategy/ 'optimal pricing strategy')\, il y a quelque chose dans ce seuil qui fait baisser les taux de prise au fil du temps\. Mon hypothèse est que cela commence à trop gruger le COGS du client pour que la situation reste inchangée pendant \>5 ans
  - Par exemple\, pendant très longtemps\, les rakes sur iOS et Google Play Store étaient de 30 \%\. Puis ils ont commencé à introduire des rakes plus bas pour les abonnements
  - Par exemple\, Steam avait un rake de 30 \%\, et a récemment changé ce taux pour être plus bas pour les grands éditeurs\. Ce n’est pas un hasard puisque Epic Games et Discord sortent leurs propres boutiques rake 10 \%\+
- Les taux d’acceptation devraient être influencés par les marges opérationnelles des vendeurs sur la plateforme\, même si je travaille encore sur la façon de présenter cela\.
  - Par exemple\, les plateformes de livraison de nourriture ne peuvent pas facturer beaucoup plus de 30 \% sans que les restaurants ne perdent de l’argent compte tenu de la faible marge
  - Par exemple\, les taux d’acceptation des billets d’avion aux États\-Unis sont essentiellement de 0 \% puisque les compagnies aériennes ont consolidé et ont des marges faibles
- Où place\-t\-on dans le cadre les plateformes qui facturent à la fois le vendeur et l’acheteur \? Personnellement\, je ne les aime pas en tant que consommateur\, mais il ne semble pas y avoir encore de pression pour changer ce modèle économique
  - Ruzwana a mentionné sur Twitter que peut\-être [more infrequent, episodic transactions can support buyer fees, but not frequent, regular transaction cases](https://twitter.com/daveambrose/status/694921246799073280)
  - Airbnb\, le marché de la billetterie et les marchés de vacances pour chiens sont plus épisodiques et peuvent facturer des frais d’achat
  - Les plateformes de livraison de nourriture ne semblent pas vraiment correspondre à ce cadre\. Ce sont généralement des transactions régulières qui facturent des frais supplémentaires pour la livraison\, ce qui semble être un obstacle à la croissance\.

J’ai aussi fait une comparaison entre les taux de rake prédit et réels selon son cadre\, et cela semble correspondre à la théorie\. La réserve est que j’ai utilisé un certain jugement en appliquant les critères\, et les taux d’acceptation réels sont approximés en fonction de certains benchmarkings que j’ai personnellement réalisés\.

- Booking\.com taux de prise selon son cadre devrait être de 20 \% \+ 10 \% de frais opaques \+ 5 \% de contrôle qualité \+ 5 \% de prévention de la fraude – 10 \% d’articles à haut prix – 10 \% d’utilisateurs se rencontrent en personne \(est\-ce que cela en est éligible \?\) \= 20 \% contre 14 \% de réel de ratissage
  - Autres OTA principaux \: Expedia représente environ 13\-18 \% de rake réel\, ctrip représente environ 10\-15 \% de rake réel sur son inventaire hôtelier
  - **Les concurrents chinois plus petits comme Meituan sont à 8\-10 \%\, et Tongcheng à 6\-9 \%**
- Le taux de prise sur Etsy est prévu \: 20 \% \- 5 \% frais transparents \- 5 \% acheteur attention \= 10 \% contre 5 \% réel
- Le taux de prise Farfetch prévu est de 20 \% \+ 10 \% travail sur plateforme \+ 5 \% contrôle qualité \+ 5 \% prévention de la fraude – 5 \% frais transparents – 5 \% articles à prix élevé \= 30 \% contre 33 \% réel
- Taux de prise Taobao 20 \% – 5 \% frais transparents – 5 \% acheteur attention \= **10 \% contre 4 \% réel**
- Taux de prise de la série 20 \% \+ 10 \% travail sur plateforme \+ 5 \% contrôle qualité – 5 \% frais transparents – 5 \% acheteur attention \= **25 \% contre 3 \% réel**
- JD\.com taux de prise 20 \% \+ 5 \% contrôle qualité – 5 \% frais transparents – 5 \% acheteur attention \= **15 \% contre 2 à 8 \% en réalité**
- _Taobao\, Tmall\, JD semblent tous ne pas correspondre au cadre\. Je suppose que cela a à voir avec le marché chinois\, et la façon dont Taobao a été initialement lancé comme une plateforme sans frais pour concurrencer EachNet\. Le point de départ était donc à 0 \% au lieu de 20 \%_
- Taux de prise Mercado libre 20 \% \+ 5 \% contrôle qualité – 5 \% frais transparents – 5 \% acheteur attention \= 15 \% vs 17 \% réel
- Taux de prise Stubhub\/Seatgeek 20 \% \+ 10 \% frais opaques \+ 5 \% contrôle qualité \+ 5 \% prévention de la fraude \- 5 \% articles à haut prix \= 35 \% contre 40 \% \+ réel

Si je me trompe sur l’un des points ci\-dessus ou si vous avez des réponses\, n’hésitez pas à me le faire savoir et je corrigerai le post si besoin\.
