---
title: "C’est des tortues jusqu’en bas"
description: "Pourquoi la plupart des entreprises, même dans la tech, sont mauvaises pour innover"
pubDate: 2020-07-15
category: Technology
tags: ['business', 'startups']
heroImage: './t_3.webp'
locale: 'fr'
sourceSlug: 'turtle'
sourceHash: '350a3fc3117a588d40ffda1e362a4272b665ee57cf4be889be526c4129f66586'
---

## À retenir

Les entreprises ne sont pas incitées à prendre des risques\, ce qui nuit à l’innovation interne et augmente les chances qu’une startup les remporte sur elles\.

## Tortue contre lièvre

Je vais considérer que tout le monde connaît bien le [tortoise vs hare fable.](http://read.gov/aesop/025.html 'aesop') Le lièvre fait une course de tortue\, s’endort\, perd\, et passe le reste de sa vie dans la honte avant d’écrire un récit explosif sur ce que c’était [all a shell game](https://en.wikipedia.org/wiki/Shell_game 'shell') [^1]\.

[Drawing on this post by Farnam Street](https://fs.blog/2016/07/james-march-the-trouble-with-genius/ 'FS')\, prolongeons l’analogie avec un peu de mathématiques\. Je sais que cela effraie immédiatement la moitié des lecteurs\, mais ne paniqueons pas encore\. Venant de quelqu’un qui a récemment perdu 15 minutes sur un problème de maths parce que j’ai mal ajouté 1 \+ 1\, je vais garder les calculs simples\, ne serait\-ce que pour mon bien [^2]\.

Faisons une piste de course de 1 km\. On suppose que la tortue met 100 minutes à courir 1 km\, et que le lièvre met 20 minutes à courir 1 km\. Cependant\, le rythme de sommeil du lièvre a été perturbé à cause du covid et il y a 95 \% de chances qu’il dorme à chaque bloc de 20 minutes\. Autrement dit\, il y a 5 \% de chances qu’il soit éveillé pendant les minutes 0 à 20\, puis 5 \% de chances qu’il soit éveillé pendant les minutes 20 à 40\, et 5 \% de chances qu’il soit éveillé pendant les minutes 40 à 60\, etc\.

![post](./t_1.webp)

Quelle est la chance que le lièvre batte la tortue \?

Pour ceux d’entre vous qui se souviennent de la probabilité au lycée\, nous pouvons calculer cela avec un [binomial distribution formula.](https://online.stat.psu.edu/stat414/lesson/10/10.3 'binom') La formule ressemble à ceci \:

![post](./t_2.webp)

Mais cela fait peur avec des signes de sommation et des points d’exclamation\, et j’ai promis de garder les calculs simples\. Une façon de raccourcir le calcul est d’observer qu’il y a 5 « blocs de 20 minutes » pour que le lièvre s’endorme ou soit éveillé\, puisque le lièvre est 5 fois plus rapide que la tortue\. Tant que le lièvre est réveillé une fois\, il gagnera\. Donc\, la seule fois où le lièvre perd\, c’est quand il dort toutes ces fois\. C’est un calcul beaucoup plus simple\, puisque cela ne fait que 95 \% de sa propre multiplication par 5 fois\, soit 0\,95 fois la puissance de 5 [^3]\.

Cela nous donne 77 \%\, ce qui implique que\, selon nos hypothèses\, le lièvre perd 77 \% du temps face à la tortue\, et ne gagne que 23 \% du temps\.

Maintenant\, changeons un peu notre cadrage\. Si nous avons couru 100 courses\, quelle est la chance d’avoir au moins une course où le lièvre gagne \?

Il n’y a qu’un seul cas où aucun lièvre ne gagne\, c’est\-à\-dire lorsque toutes les courses sont gagnées par des tortues\. En supposant que la mafia des tortues n’ait pas truqué le jeu à nouveau\, la probabilité que cela arrive est que 77 \% se multiplie par 100 fois\, ce qui arrondi à 0 \%\.

En d’autres termes\, il est presque garanti qu’au moins une fois\, un lièvre gagnera\.

![post](./t_3.webp)

J’ai mis les calculs dans un google sheet [here](https://docs.google.com/spreadsheets/d/1-_LV1ewb0D4DsERENaM_xp0oy8pHH7xWmAvNX8H9bdE/edit?usp=sharing 'sheet') Avec laquelle tu peux jouer [^4]\. Vous pouvez aussi voir sur le graphique ci\-dessous qu’il ne faut même pas autant de courses pour que les chances qu’au moins un lièvre gagne approchent 100 \%\. Rappelez\-vous\, c’est un lièvre qui gagne\, pas la majorité des lièvres qui gagnent\.

![post](./t_4.webp)

Les mathématiques sont moins importantes que les conclusions à retenir\. **Ce que nous avons déduit\, c’est que même lorsque les chances qu’un événement se produise seul\(e\) sont faibles\, une partie répétée garantira probablement que l’événement se produise une seule fois\.** Tout comme il est peu probable que vous gagniez à la loterie\, il est probable qu’il y ait au moins un gagnant\.

## Tortue vs technologie

Relions cela à la tech\. L’industrie technologique est fière d’innover\, mais il faut noter que c’est la somme des échecs cumulés qui fait avancer le progrès\. Si l’on considère les startups comme les lièvres dans ce scénario\, et les grands acteurs en place comme la tortue\, il y a peu de chances qu’une startup en particulier gagne contre un titulaire en particulier\, mais il y a de fortes chances qu’au moins une l’une d’elles le fasse\.

Il existe plusieurs exemples de grandes entreprises qui ont simplement laissé tomber d’énormes opportunités de revenus\. Pour quelque chose de récent\, pensez à la façon dont Microsoft et Google ont tous deux perdu 70 milliards de dollars de valeur [(mkt cap of Zoom)](https://finance.yahoo.com/quote/ZM/ 'ZM') En ayant un produit de visioconférence correct mais pas excellent\. Pour quelque chose d’ancien\, pensez à comment [Xerox invented the mouse, graphical user interface, and the PC, but failed to follow up on them](https://www.forbes.com/sites/tendayiviki/2017/07/01/as-xerox-parc-turns-forty-seven-the-lesson-learned-is-that-business-models-matter/#eaf579075482 'xerox')\.

Il y a plusieurs raisons pour lesquelles la plupart des entreprises sont nulles dans ce domaine\. Tout d’abord\, **Les gens sont aversifs au risque\,** Dans le sens où ils ne sont pas prêts à tolérer la quantité massive d’échecs nécessaires au succès de nouvelles idées\. Le succès des projets se détermine individuellement\, pas au niveau de l’entreprise\. « Pouvez\-vous soutenir ce projet dont le résultat le plus probable est un gaspillage total de ressources » n’est pas le meilleur slogan commercial\.

Le problème\, c’est que le génie est volatile\. Si vous voulez des résultats fous\, parfois il vous faudra des fous\. Que ce soit par chance\, compétence\, ou une combinaison des deux \(plus probable\)\, la gamme des résultats issus de projets plus fous sera répartie sur un éventail plus large de possibilités\. Pour chaque iPhone\, il y en a cent [cheetos lip balm](https://www.usatoday.com/story/money/2018/07/11/50-worst-product-flops-of-all-time/36734837/ 'cheetos') Un genre de projets qui ne décollent jamais\.

Puisque la plupart des gens pensent aussi en termes de [outcomes rather than process,](https://www.schroders.com/id/uk/the-value-perspective/blog/all-blogs/outcomes-and-timeframes--with-annie-duke-part-3/?t=true 'annie') Le jugement pour les projets est binaire\. Ce sont soit un succès\, soit un échec\. Et personne ne veut être associé à des échecs\, même lorsque la récompense potentielle est élevée\, puisque la valeur espérée est faible\. Nous voulons le génie seulement après qu’elle ait été identifiée\, et nous ne sommes pas prêts à supporter les pertes au préalable\.

Deuxièmement\, et de manière liée\, **Il y a un manque d’alignement des incitations** Dans les grandes entreprises\, pour que les petits projets réussissent\. Pour la plupart\, les gens dans les grandes entreprises cherchent plutôt à ne pas se faire licencier qu’à exceller\. Et ce pour de bonnes raisons\, car la valeur générée dans une grande entreprise va principalement à l’entreprise et non à vous\. En revanche\, les personnes dans les petites entreprises cherchent à ne pas faire faillite [^5]\. Il y a un degré plus élevé d’alignement des incitations chez les personnes dans les startups par rapport aux grandes entreprises\, ce qui entraîne un effort moyen par personne plus élevé\.

Les entreprises pourraient\-elles résoudre cela \? Possiblement\, mais inciter et gérer les gens est un domaine notoirement délicat\. Vous pourriez probablement viser à payer les gens au\-dessus du marché\, en leur donnant [15 percent time for special projects](https://www.fastcompany.com/1663137/how-3m-gave-everyone-days-off-and-created-an-innovation-dynamo '15')\, ou proposer un programme de récompenses et de reconnaissance pour encourager vos employés\. Cependant\, l’employé moyen serait probablement plus préoccupé par ses plans Netflix après le travail que par son projet spécial qui risque d’échouer\. Il y a probablement une somme d’argent qui fonctionnerait\, mais ce coût supplémentaire est probablement trop élevé pour que la plupart des entreprises puissent le justifier [^6]

Enfin\, **Les entreprises aiment « se concentrer »\.** En général\, c’est un mot à la mode pour désigner les coupes de coûts et les réorganisations\, comme quand [Ruth Porat took over as Google CFO.](https://www.bizjournals.com/sanjose/news/2015/07/15/google-reins-in-hiring-and-spending.html 'Ruth') On peut voir des situations similaires se reproduire aujourd’hui avec les licenciements liés au covid\, la plupart des entreprises affirmant qu’elles doivent « prioriser sans pitié » pour une raison favorable aux relations publiques\. Quand les choses vont mal\, la direction trie les choses entre les « \(« »\) \(«

Même dans une bonne situation économique\, les projets sont souvent rejetés parce qu’ils sont « trop petits pour faire avancer » ou « ne vont pas évoluer »\. Pouvez\-vous imaginer essayer de présenter AirBNB à Marriott \? Vous auriez du mal non seulement à justifier comment la taille du marché pourrait être suffisamment grande pour y consacrer du temps\, mais aussi pourquoi cannibaliser vos propres revenus serait une bonne idée\.

L’innovation n’est pas facile\, et elle est encore plus compliquée puisque la plupart des endroits jugent des résultats et non des processus\. Si vous êtes une startup cherchant à révolutionner un secteur\, découvrez ce que le [base rate](https://en.wikipedia.org/wiki/Base_rate 'base') du succès est\, et préparez\-vous à l’échec\. Beaucoup d’échecs\. Si vous êtes une entreprise qui espère rester pertinente\, réalisez que presque toutes vos structures d’incitation sont conçues pour la moyenne\. Et **À long terme\, la moyenne signifie irrélevance\.**

[^1]: Également connu sous le nom de \#Me [Tu](https://www.echineselearning.com/blog/chinese-character-tu-rabbit-beginner 'tu') Mouvement\.

[^2]: Ok\, donc c’était 1 \- 1 et je me suis trompé sur le panneau dans ma tête\, donc ce n’était pas si terrible\. Non\, je ne deviens pas sur la défensive\.

[^3]: J’ai choisi les chiffres ici précisément pour garder l’exemple simple\. Je cherchais quelque chose où le lièvre perd la plupart du temps et n’a que quelques intervalles\.

[^4]: J’ai fait le calcul des probabilités de plusieurs façons\, avec la formule factorielle montrée et la fonction binomdist de Google Sheet\, juste pour montrer qu’elles sont équivalentes

[^5]: Ce n’est probablement pas si grave pour les employés des startups aujourd’hui quand l’entreprise échoue\, car il y a beaucoup de postes disponibles\, surtout pour les ingénieurs logiciels\. Cela dit\, c’est quand même pénible d’être licencié\, et il y a plus de chances que cela arrive avec une startup\.

[^6]: Par exemple\, imaginons un scénario extrême où les employés réalisent 50 \% du chiffre d’affaires ou 50 \% des économies qu’ils réalisent pour l’entreprise\. Nous allons ignorer les difficultés de mesure pour l’instant\, mais cela est probablement un moteur suffisant dans les grandes entreprises où de petits changements peuvent faire économiser des millions de dollars\. Le problème vient alors du fait que l’employé a gagné de l’argent alors que l’entreprise ne l’a pas fait\.
