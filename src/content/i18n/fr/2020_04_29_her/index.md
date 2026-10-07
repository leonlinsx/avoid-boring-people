---
title: "On la voulait, mais à la place, on a pris Tinder"
description: "Le piège à marge des entreprises d’IA, les concepts d’investissement value et les compromis"
pubDate: 2020-04-29
category: Technology
tags: ['AI', 'business', 'investing']
heroImage: '../../../blog/2020_04_29_her/her_1.webp'
locale: 'fr'
sourceSlug: 'her'
sourceHash: '140929fc05bda4f1a76315eefef59e45e7cb3db132f6b4504e8865ffe9865199'
---

## Points à retenir

1. Les entreprises d’IA semblent plus être des entreprises de services que des entreprises de logiciels\, ce qui implique qu’elles devraient se négocier à des valorisations plus basses
2. La seule personne dans qui Charlie Munger investit dit que l’investissement ne consiste pas à être intelligent\, mais à penser comme un propriétaire
3. Essayez de mieux comprendre les compromis dans la prise de décision

## L’IA en tant que service\(s\) d’activité

J’ai déjà écrit sur l’apprentissage automatique \(ML\) et l’intelligence artificielle \(IA\) [^1]\. Scott Locklin détaille les problèmes rencontrés par les startups de ML [here](https://scottlocklin.wordpress.com/2020/02/21/andreessen-horowitz-craps-on-ai-startups-from-a-great-height/ 'Scott') [^2]\, principalement en réponse à un post connexe sur a16z [here.](https://a16z.com/2020/02/16/the-new-business-of-ai-and-how-its-different-from-traditional-software/ 'a16z')

Ses principaux points sont \:

1. Le ML coûte cher pour des gains marginaux

2. Les startups ML n’ont généralement pas de douves ni de spécialité particulière significative

3. Les startups de ML sont principalement des entreprises de services\, pas des entreprises de logiciels

Ce sont plus des opinions négatives que consensus\, alors voyons pourquoi il pense que c’est le cas\. Je vais citer à la fois Scott et l’article a16z de Martin Casado et Matt Bornstein\.

### Coût

> Pris ensemble\, ces forces d’opération et de calcul cloud contribuent aux 25 \% ou plus des revenus que les entreprises d’IA consacrent souvent aux ressources cloud\. Dans les cas extrêmes\, les startups qui s’attaquent à des tâches particulièrement complexes ont constaté que le traitement manuel des données est moins cher que d’exécuter un modèle \\\[ML\\\] entraîné\. \- a16z

> La structure tarifaire des conneries du « cloud » est conçue pour extraire le maximum de sang des personnes ayant des besoins lourds en données ou en calcul\. \- Scott

Est\-ce que 25 \% du révisionnage est consacré uniquement aux opérations cloud [^3] Beaucoup \? Pour contextualiser ce chiffre\, regardons le coût total des biens \(COGS\) de Salesforce\, une entreprise de logiciels de premier plan\. [Their 8K](https://s23.q4cdn.com/574569502/files/doc_financials/2020/q4/CRM-Q4-FY20-Earnings-Press-Release-w-financials.pdf '8K') affiche un COGS total de 25 \%\, ce qui inclut tous les autres coûts que Salesforce classerait dans cette catégorie [^4]\, pas seulement les coûts cloud\. Pour avoir la même marge qu’un Salesforce\, les entreprises d’IA n’auraient besoin d’aucun autre COGS que les coûts cloud\.

> Des données anecdotiques montrent que de nombreuses entreprises consacrent jusqu’à 10 à 15 \% du chiffre d’affaires au processus de nettoyage manuel et de maintenance de précision des données – généralement sans compter les ressources d’ingénierie de base – et suggèrent que le travail de développement en cours dépasse les corrections de bugs et l’ajout de fonctionnalités typiques \- A16Z

Il s’avère que les entreprises d’IA disposent d’autres COG\, dépensant jusqu’à 15 \% en processus manuels de données\. Les médias grand public se concentrent sur les prédictions issues de l’apprentissage automatique\, [but data scientists spend more of their time on data collection and cleaning.](/writing/time 'ABP') Cela ne disparaîtra pas\, c’est\-à\-dire **la plupart des entreprises d’IA sont immédiatement 15 \% moins rentables qu’une entreprise de logiciels\.** Cela aussi avant tout autre COGS impliqué\, ce qui implique que les marges brutes finales sont encore plus faibles\.

L’attrait d’investir dans les entreprises de logiciels réside dans le fait que les coûts marginaux sont faibles\, donc un pourcentage élevé du chiffre d’affaires incrémental est converti en profit\. Les entreprises d’IA doivent réduire ce pourcentage de COGS ou s’attendre à un bénéfice d’échelle pour être aussi attractives\. Est\-ce probable \?

> la puissance de calcul des puces GPU n’a pas vraiment augmenté rapidement \- Scott

L’IA nécessite [graphics processing units (GPUs) to do the computing.](https://www.nvidia.com/en-us/deep-learning-ai/solutions/ 'GPU') Cependant\, les ressources nécessaires ont considérablement augmenté par rapport à la croissance de la puissance de calcul \; la loi de Moore ne s’applique pas du côté du calcul de l’IA\. Nous ne devrions pas nous attendre à ce que les 25 \% de COGS au\-dessus diminuent significativement de sitôt\.

> Comme la plage des valeurs d’entrée possibles est très large\, chaque nouveau déploiement client est susceptible de générer des données jamais vues auparavant \- a16z

> la plupart des gens n’ont pas compris que les processus orientés ML ne sont presque jamais évolutifs comme une application plus simple \- Scott

Comparez la vente de Microsoft Office à la vente d’une offre de conseil à une entreprise\. Dans le premier cas\, vous pouvez donner la même copie d’Office que vous vendez à toutes les autres entreprises\. Dans le second\, vous devrez créer de nouveaux supports adaptés à ce client [^5]\, ce qui signifie que vous aurez toujours des coûts supplémentaires lorsque vous obtenez plus de revenus\.

Si l’IA ressemble davantage au second cas\, cela signifie que nous ne devrions pas nous attendre à ce que les 15 \% restants \(et tout autre COGS\) diminuent non plus\. [That low margin still takes a lot of work to get. ](https://avc.com/2020/04/not-all-gross-margin-is-the-same/ 'AVC') **Non seulement les entreprises d’IA sont moins rentables\, mais il faut s’attendre à ce que ce profil de marge dure un certain temps**

### Douves

Cette augmentation de prix en vaut\-elle la peine \? Ni A16z ni Scott ne semblent le penser \:

> Dans le monde de l’IA\, la différenciation technique est plus difficile à atteindre\. \\\[\.\.\.\\\] Les données sont le cœur d’un système d’IA\, mais elles appartiennent souvent aux clients\, appartiennent au domaine public\, ou deviennent progressivement une marchandise\. \- a16z

> Je sais que\, d’un point de vue business\, quelque chose de stupide comme Naive Bayes ou un modèle linéaire pourrait résoudre le problème du client aussi bien que la dernière atrocité du réseau neuronal gigawatt\. \\\[\.\.\.\\\] Les gens ne paieront pas un supplément par rapport aux solutions internes ad\-hoc en data science à moins que cela ne représente des résultats véritablement révolutionnaires\. \- Scott

Si le produit d’une entreprise n’est pas réellement significativement meilleur\, elle doit se concentrer sur les ventes et le marketing pour se différencier\. **Cela implique des coûts encore plus élevés que pour une entreprise de logiciels classique\,** qui est déjà très axée sur les ventes\. Cela fait se demander si le battage autour de l’apprentissage automatique est justifié ou utilisé pour justifier la survie d’une entreprise\.

Je ne sais pas quel est le seuil pour « changer la donne » cependant\. Un de mes lecteurs a répondu après le post de Vicki Boykis qui laissait entendre qu’il considérait une amélioration de la précision de 10 à 15 \% comme significative [^6]\. Je suppose que ça dépendra de l’entreprise\.

Si le produit lui\-même est une commodité\, peut\-être que le marché total est important \?

> De nombreuses entreprises constatent que la tâche minimale viable pour les modèles d’IA est plus limitée qu’elles ne l’avaient prévu\. \- a16z

> mais le bâton de hockey nécessaire pour le financement du capital\-risque\, et l’armée de docteurs nécessaires pour le faire fonctionner\, ne s’accordent pas vraiment avec ces domaines limités\, qui ont un marché limité\. \- Scott

On pense généralement qu’on peut simplement appliquer l’apprentissage automatique à n’importe quel problème et que cela fonctionnera magiquement pour ce problème et tout autre problème similaire\. Malheureusement\, pour l’instant\, il semble que beaucoup de problèmes ne seront pas encore améliorés en lançant de l’IA dessus\. Nous voulions [Her](<https://en.wikipedia.org/wiki/Her_(film)> 'Her')\, à la place\, nous avons eu Tinder\.

Si l’IA a des cas d’utilisation limités\, le marché total adressable dans lequel vendre votre produit d’IA est bien plus restreint que ce que vous pensiez\. Compte tenu des VC [size of market as a key factor for investment,](https://bettereveryday.vc/how-to-prove-your-market-is-big-enough-to-vcs-d04059d93380 'size') cela semble poser problème lorsque les entreprises d’IA devront démontrer leur croissance à l’avenir\.

### Entreprises de services vs entreprises de logiciels

> la plupart des systèmes d’IA aujourd’hui ne sont pas tout à fait des logiciels\, au sens traditionnel\. Et les entreprises d’IA\, par conséquent\, ne ressemblent pas exactement aux entreprises de logiciels\. Elles impliquent un soutien humain continu et des coûts variables matériels\. Elles ne se développent souvent pas aussi facilement qu’on le souhaiterait\. Et une forte défense – essentielle au modèle logiciel « construire une fois \/ vendre plusieurs fois » – ne semble pas être gratuite\. \- a16z

> Les entreprises de services ne sont pas aussi valorisées que les entreprises de logiciels\. Les VCs adorent les entreprises de logiciels \; travaillent dur dès le départ pour résoudre un problème\, impriment de l’argent pour toujours\. C’est pourquoi ils obtiennent des valorisations de revenus 10\-20 fois supérieures\. Les entreprises de services \? Pourquoi investir dans une entreprise de services \? Leur croissance est intrinsèquement limitée par les coûts de main\-d’œuvre et des problèmes de marché étranges et abordables\. \- Scott

![post](../../../blog/2020_04_29_her/her_1.webp)

Les entreprises sont souvent évaluées sur la base d’un multiple d’un indicateur financier tel que le chiffre d’affaires\, l’EBITDA ou le bénéfice net\. Les entreprises de logiciels sont généralement évaluées à un multiple supérieur à celui des entreprises de services\, pour les raisons mentionnées ci\-dessus\. [Higher gross margins matter, as described by Two Sigma](https://twosigmaventures.com/blog/article/why-gross-margins-matter/ 'Two')

A16z et Scott sous\-entendent tous deux que **une entreprise d’IA est plus proche d’une entreprise de services et devrait donc recevoir un multiple d’évaluation plus bas qu’une société de logiciels\.** Même si vous pensez qu’elles obtiendront un multiple supérieur au chiffre d’affaires 2x que les services obtient\, les entreprises d’IA ne devraient pas percevoir les revenus 10x que les entreprises de logiciels traditionnelles obtient\, et que ces entreprises d’IA ont auparavant collecté des fonds\.

Cela posera probablement problème aux entreprises d’IA qui ont augmenté à des valorisations élevées et qui ont désormais du mal à lever leur prochain tour\, car davantage de personnes prennent conscience des problèmes ci\-dessus\. Je m’attends\, avec 60 \% de certitude\, à voir des valorisations plus basses que prévu pour les tours privés avancés d’IA\.

## La pratique de l’investissement en valeur par Li Lu

Le partenaire de Warren Buffett\, Charlie Munger\, a donné de l’argent à un étranger pour qu’il se présente [only once in his life.](https://qz.com/work/1551328/the-only-person-besides-warren-buffett-who-charlie-munger-trusts-with-his-money/ 'Munger') Cet étranger est [Li Lu of Himalaya Capital.](http://himalayacapital.com/ 'Himalaya')

Fondée en 1998\, Himalaya est une société d’investissement en valeur\, centrée sur les entreprises d’Asie avec un accent particulier sur la Chine\. Fidèle à ce style d’investissement\, elles semblent être des propriétaires à long terme d’entreprises de qualité qui se multiplient au fil du temps [^7]\. [They've historically taken a 0% management fee, and 25% carry after a 6% return hurdle.](https://www8.gsb.columbia.edu/valueinvesting/sites/valueinvesting/files/files/Graham%20%26%20Doddsville%20-%20Issue%2018%20-%20Spring%202013_0.pdf 'Graham') C’est inhabituel dans le secteur de l’investissement et cela montre à quel point ils sont confiants dans la génération de rendements annuels [^8]\.

Comme Li Lu est centré sur la Chine\, il y a moins d’interviews de lui que d’autres investisseurs célèbres\. Graham de Longriver récemment [translated a 9,000 word speech outlining Li Lu's investment philosophy,](https://www.longriverinv.com/blog/the-practice-of-value-investing-by-li-lu 'Longriver') que je vais résumer ci\-dessous [^9]\.

Li Lu a abordé quatre concepts fondamentaux de l’investissement valorisant \: la différence entre investir et spéculer\, les cercles de compétence\, le tempérament de l’investisseur et ce que la personne moyenne peut faire pour accroître sa richesse\. J’ai constaté que la plupart de ces concepts peuvent être classés dans ses quatre concepts\, qui sont \:

1. Les actions représentent une copropriété d’une entreprise

2. Le marché est un guide\, et c’est à vous de l’accepter ou de le rejeter

3. Investir repose sur la probabilité et une marge de sécurité

4. Construisez un cercle de compétence et restez en secours

### Li Lu \: Les actions représentent une copropriété

Le concept d’acheter une action comme achat de la propriété de l’entreprise est courant parmi les adeptes du style d’investissement value de Buffett\. Plutôt que de considérer une action comme un chiffre\, Li Lu la considère comme une responsabilité\. Cela contraste avec les hedge funds long\/short qui négocient davantage sur les catalyseurs de sentiment et de prix\, ou les fonds quantitatifs qui négocient on ne sait quoi [^10]\.

> les gens ne cherchaient plus à deviner les résultats futurs de la Compagnie des Indes orientales \; ils essayaient simplement de deviner le comportement des autres acheteurs et vendeurs d’actions\.

Li Lu évoque l’histoire de la bourse\, qui a d’abord été créée pour permettre aux entreprises de lever des capitaux afin de financer leur croissance\. Elle a ensuite profité de la nature de jeu de l’humanité pour devenir non seulement un pari sur l’avenir de l’entreprise\, mais un pari sur ce que vous pensez que les autres pensent de l’avenir de l’entreprise\. C’est similaire à la [Keynesian beauty contest](https://en.wikipedia.org/wiki/Keynesian_beauty_contest 'contest') concept\.

> C’est la plus grande différence entre investir et spéculer \: au final\, le résultat net de toute spéculation est nul\. Bien sûr\, il y aura des gens qui gagneront un peu plus longtemps \; et d’autres « qui seront pris pour des pigeons » sans aucune chance de s’enrichir\. Mais avec assez de temps\, toute spéculation aboutit à un résultat à somme nulle\. Ainsi\, en raison de leur focalisation sur le comportement à court terme\, les spéculateurs n’ont absolument aucune influence sur la croissance économique ni sur les profits d’une entreprise\.

Il fait une distinction entre investir et spéculer\, plaçant les investisseurs les personnes qui prévoient la performance des entreprises dans la première catégorie\, et celles qui prédisent la réaction des autres dans la seconde catégorie comme spéculateurs\. Les investisseurs se soucient des fondamentaux des entreprises et du long terme\, les spéculateurs se soucient du sentiment et du court terme\. Selon lui\, la plupart des fonds d’investissement actuels seraient classés comme spéculateurs\.

Je ne suis pas d’accord avec Li Lu sur l’influence des spéculateurs\, et je crois que les spéculateurs peuvent influencer le comportement des entreprises\, que ce soit par l’investissement actif ou lors de réunions régulières en conférences d’investisseurs\. Nous voyons des entreprises prendre des décisions tout le temps directement sous la pression des actionnaires\, telles que [fire CEOs,](https://www.nytimes.com/2020/01/10/business/boeing-dennis-muilenburg-severance.html 'CEO') [divest businesses,](https://faculty.wharton.upenn.edu/wp-content/uploads/2005/11/Activist-Impelled.pdf 'Divest') ou [sell the company.](https://corpgov.law.harvard.edu/2019/10/11/recent-trends-in-shareholder-activism/ 'Sell')

Cela n’enlève rien à son point de vue général cependant\, que **Spéculer\, comme il le définit\, est à somme nulle\.** Lorsque vous surperformez sur une entreprise à cause de problèmes sans lien avec la croissance fondamentale\, quelqu’un d’autre de l’autre côté de cette transaction a sous\-performé\. Si vous avez de meilleurs rendements que le marché\, quelqu’un d’autre a une pire journée\.

### Li Lu \: Le marché est un guide

> La plupart du temps\, cependant\, vous pouvez simplement l’ignorer\. Mais lorsque M\. Marché devient extrêmement énervé – soit excité\, soit déprimé – vous pouvez l’utiliser pour acheter et vendre\.

Il discute de [the popular anecdote of Mr Market,](https://fs.blog/2013/11/mr-market/ 'Market') Ce qui met en lumière comment la bourse peut être perçue comme quelque chose qui vous crie un prix en permanence\. C’est à vous de décider quand acheter et vendre\, et il vaut mieux ignorer le prix du marché la plupart du temps\. Vous n’êtes pas pressé \; l’activité est l’ennemi\.

> Quand tu es à l’école et que tu entends parler d’investissement de valeur\, tu penses que ce n’est pas un gros problème à mettre en pratique\. Mais dès que tu commences à travailler\, tu réalises qu’il y a de vraies personnes de l’autre côté de chaque transaction\. Ils sont supérieurs à toi en tout point et ne ressemblent en rien au M\. Marché de Graham\. Alors\, après avoir été continuellement réprimandé par ton patron\, tu sentiras que M\. Marché et ces gens sont tous meilleurs que toi\. Tu commenceras à avoir des doutes\.

L’investissement value est beaucoup plus difficile en pratique\, car vous faites moins de transactions\. C’est une chose de dire que vous êtes une personne disciplinée \; c’en est une autre de résister à l’achat d’options sur votre compte Robinhood quand vous apprenez que vos amis ont gagné 10 000 \$ en une journée en se cachant [r/wallstreetbets.](https://www.dailydot.com/debug/wall-street-bets-reddit-jartek/ 'Reddit') Quand tout le monde autour de vous gagne de l’argent rapidement\, il est presque impossible de s’en tenir à une stratégie moins excitante\.

C’est plus facile à faire quand on adopte la mentalité du propriétaire mentionnée plus haut\. Si vous achetiez des actions avec la même attitude que lors de l’achat d’une maison\, vous seriez plus rigoureux et posé dans votre achat\.

### Li Lu \: Probabilité et marge de sécurité

> La chose la plus importante dans l’investissement est de prédire l’avenir\, mais celui\-ci est intrinsèquement imprévisible\. Investir repose donc sur la probabilité et une marge de sécurité\.

Investir comme une question de probabilité est un concept avec lequel la plupart des professionnels seraient d’accord\, quel que soit le style\. Même les meilleurs investisseurs ont un taux de réussite entre 50 et 60 \%\, ce qui signifie qu’ils se trompent souvent [^11]\. Plutôt que de miser à 100 \% sur un seul nom\, ils pensent en termes d’investissement dans un portefeuille de noms\, évaluant chaque position en fonction de ce qu’ils estiment être les chances de succès de chaque entreprise\.

Le concept de marge de sécurité n’est pas aussi universel\, et plus typique des investisseurs de valeur\. C’est l’idée que pour chaque investissement que vous faites\, vous devriez le faire à un prix qui vous laisse encore suffisamment de marge en cas de baisse inattendue\. Si vous pouvez trouver une marge de sécurité suffisante dans un investissement\, cela vaut la peine d’être examiné\. Si vous ne pouvez pas obtenir une marge de sécurité suffisante\, vous ne devriez pas investir\.

### Li Lu \: Cercle de compétence

Li Lu raconte une longue histoire sur la façon dont il a commencé à investir après avoir entendu Buffett parler [^12]\. Il a commencé à lire davantage les écrits de Buffett\, à faire des recherches sur les entreprises\, et à les rendre sur place quand il le pouvait\, même lorsqu’il ne pouvait que parler au gardien de sécurité\. Ce faisant\, il a découvert quatre leçons pour développer un cercle de compétences \:

> La première leçon était que les actions représentent une part de propriété dans une entreprise

> Le deuxième point est que lorsque vous commencez à regarder les choses du point de vue des propriétaires\, votre compréhension de l’entreprise sera complètement différente

> Lorsque des analystes rejoignent notre entreprise\, la première chose que nous faisons est de les envoyer étudier certaines entreprises\. Nous leur demandons de supposer qu’un oncle qu’ils n’ont jamais rencontré auparavant est décédé et leur a laissé l’entreprise\. Que doivent\-ils faire \? Ils héritent soudainement de cet actif sans savoir ce que c’est\. Vous devez convoquer une réunion du conseil d’administration et participer à la discussion\. C’est le modèle mental que nous leur demandons d’utiliser lorsqu’ils mènent leurs recherches\.

Popularisée par Buffett\, l’idée d’un cercle de compétence est que vous devez développer une compréhension approfondie d’une industrie ou d’un problème\. Vous devez aussi comprendre où se situent les limites de vos connaissances\, et ne pas vous surmener\.

Ces deux premières leçons sont similaires à celles précédentes sur la considération des participations en copropriété\. Quelle que soit l’ampleur de votre participation dans l’entreprise\, Li Lu dit que vous devez vous considérer comme un propriétaire à part entière\. Cette mentalité vous motivera à vouloir en savoir le plus possible sur l’entreprise et à comprendre quelles décisions sont bonnes ou mauvaises pour l’avenir de l’entreprise\. Passer autant de temps sur un seul nom limite naturellement le nombre d’entreprises que vous pouvez consulter\, ce qui réduit votre cercle de compétences\.

> Le troisième point est que la connaissance est effectivement cumulative mais il faut toujours garder une honnêteté intellectuelle

Je suis encore d’accord pour dire que c’est important mais difficile à faire\. Quand avez\-vous changé d’avis pour la dernière fois sur un sujet non trivial \?

> La dernière chose est que tu devrais laisser ta passion te guider\. N’écoute pas ce que les autres pensent de toi\. Ils n’ont rien à voir avec toi\. Accepte que ton cercle de compétences sera restreint et ne t’inquiète pas pour tout le reste\. Gagner de l’argent ne dépend pas de ce que tu sais \; ça dépend si ce que tu sais est juste ou mal\. Si ce que tu sais est juste\, tu ne perdras pas d’argent\.

C’est un contraste avec la façon dont beaucoup d’autres fonds d’investissement fonctionnent en pratique\, où ils veulent généralement que les analystes d’investissement augmentent leur couverture des noms et des secteurs industriels au fil du temps\. Il est difficile de dire aux partenaires limités de votre fonds \(ceux qui vous donnent leur capital pour investir\) que vous ne modifiez pas le portefeuille\, et que vous aimez les noms dans lesquels vous êtes déjà\. Maintenez cela assez longtemps et ils se demanderont pourquoi ils vous paient pour ne rien faire\. Ainsi\, pour beaucoup de fonds\, il y a une incitation à faire des transactions actives avec des noms\, et plus vous connaissez un ensemble de noms grand\, mieux c’est\. Cela fonctionne pour certains endroits\, et ce n’est pas le style de Li Lu\.

### Li Lu \: Réflexions de conclusion sur l’investissement de valeur

> cette profession ne vous exige pas d’être particulièrement intelligent\, ni d’avoir un QI élevé ou les meilleures qualifications académiques

Li Lu décrit les attributs qui font un investisseur réussi\, à savoir \:

1. La personne doit être indépendante et ne pas se soucier des évaluations des autres

2. La personne doit être objective et toujours prête à apprendre

3. La personne doit faire preuve à la fois d’une patience extrême et d’une grande détermination lorsque de grandes opportunités se présentent

4. La personne doit s’intéresser au fonctionnement des entreprises

En gardant à l’esprit les concepts fondamentaux de l’investissement value ci\-dessus\, ces traits d’investisseur ont du sens\. Pour un fonds long ou court typique\, ils seraient moins préoccupés par \(3\)\. Un fonds quantitatif typique serait probablement moins préoccupé par \(4\)\.

> Le plus grand tabou pour les investisseurs est d’être comme Newton et de se laisser séduire par le marché \: acheter au sommet le plus chaud du marché et vendre à son point le plus déprimé\. Si vous ne participez pas à la spéculation et que vous vous limitez à investir dans ce que vous comprenez\, alors vous ne perdrez pas d’argent\.

> La meilleure et la plus importante chose est d’avoir suffisamment de temps pour accumuler\. Notre conseil à la personne moyenne est de ne faire que ce que vous comprenez et de rester loin de tout le reste\.

Compte tenu de son parcours d’investisseur value à long terme\, il n’est pas surprenant qu’il préconise une croissance progressive de la richesse par la capitalisation sur le long terme\. Tout le monde n’est cependant pas assez patient pour le faire\.

L’investissement en valeur est une façon de gagner de l’argent\, et il existe de nombreuses autres façons de réussir pendant différentes périodes\. [Renaisssance seems to print money,](https://en.wikipedia.org/wiki/Renaissance_Technologies 'Ren') par exemple\, et ils ne font rien en lien avec l’investissement value évoqué plus haut\. Si vous décidez de rester dans l’investissement value\, le parcours de Li Lu parle de lui\-même\. Pensez comme un propriétaire\, évitez le trading pour le plaisir\, et sachez dans quoi vous êtes doué\.

## Compromis

[Efficiency vs Resilience.](https://en.wikipedia.org/wiki/O-ring_theory_of_economic_development 'O ring')

[Optionality vs Certainty.](https://nesslabs.com/optionality-fallacy 'Option')

Écrire son post de newsletter comme prévu le week\-end vs regarder Peaky Blinders en rafale à moitié ivre puis devoir veiller tard un jour de semaine [^13]\.

Dans la vie\, nous faisons face à des compromis tout le temps\.

**Si quelqu’un vous dit qu’il n’y a pas de compromis pour quelque chose\, c’est soit naïf\, soit il essaie de vous vendre quelque chose\.** Dans tous les cas\, il vaut probablement mieux les éviter\.

Les entreprises fonctionnent efficacement n’ont pas de redondances\. Cela permet d’économiser des coûts\, jusqu’à ce que tout tombe en panne\. Mais vous ne pouvez pas non plus avoir de sauvegardes pour tout\, car ce sera exorbitant\.

Quitter les options s’ouvre signifie que tu as de la flexibilité\. Ça marche jusqu’à ce que tu réalises que tu as vécu ta vie avec toutes les options et que tu ne t’es jamais contenté de quelque chose\. Mais tu ne dois pas non plus choisir un chemin sans avoir un plan B\.

Dans toutes les décisions importantes que nous prenons\, nous devrions \:

1. apprenez quels sont les compromis explicites et implicites\, et

2. améliorer notre processus pour choisir entre eux

Pour la première\, écrire explicitement ce que vous abandonnez\, par exemple avec un [decision journal,](https://fs.blog/2014/02/decision-journal/ 'FS') peut être utile\. Faire tout comme [premortems](/writing/premortem 'pre')\. Le fait de réfléchir pleinement au scénario met généralement en lumière des préoccupations dont vous n’aviez que vaguement conscience\.

Une autre façon serait de demander conseil à d’autres\, en particulier à ceux qui ont eu une décision similaire dans un contexte similaire\. Ils pourront signaler des préoccupations ou regrets clés qu’ils ont eus\. Ces conseils sont cependant très variés par nature\, et peuvent aller de l’utile au carrément nuisible\. Ce qui peut être risqué pour quelqu’un peut être sûr pour une autre\.

Sur le second point\, c’est à vous de décider quel cadre vous souhaitez utiliser\. Je peux en parler [optimal stopping theory](https://www.americanscientist.org/article/knowing-when-to-stop 'optimal')\, [game theory](https://plato.stanford.edu/entries/game-theory/ 'game')\, ou la planification de scénarios\, mais la plupart des gens trouveront quelque chose qui leur convient\. Tant que vous avez un cadre et que vous tenez un registre\, vous devriez être tranquille\.

S’améliorer à la fois à l’étape 1 et à l’étape 2 conduira à une meilleure prise de décision\.

J’en suis venu à penser qu’à court terme\, il est plus facile d’améliorer l’étape 1\, donc je travaille à accélérer ce processus tout en maintenant l’efficacité\. Il est plus difficile d’améliorer l’étape 2\, qui sera un projet à long terme consistant à suivre et évaluer les décisions au fil du temps\. Le processus d’amélioration de ces deux étapes vous permettra également de mieux comprendre ce que vous valorisez\.

Nous faisons face à des compromis tout le temps\, nous n’aimons juste pas y penser\. Malheureusement\, les oublier ne les fait pas disparaître\. Exposer explicitement ce que vous abandonnez dans le processus d’une décision importante aidera à réduire les regrets à l’avenir\.

## Autres

1. [A tale of two talebs.](https://medium.com/@allenfarrington/a-tale-of-two-talebs-1775dff3302b 'Taleb') Je recommande vivement\, que vous aimiez ou détestiez Nassim Taleb\.
2. « ce sont les ménages à faible revenu qui souffriront le plus du Covid\-19\, et parce qu’ils ont tendance à dépenser la majeure partie de leurs revenus\, le impact sur leurs revenus réduira la part de consommation du PIB »\, [Michael Pettis twitter thread on how imbalances in the economy will be resolved.](https://twitter.com/michaelxpettis/status/1253217553083707393 'Pettis')
3. ["While Microsoft made $100M it shrunk the \[encyclopedia\] market by over $600M. For every dollar of revenue Microsoft made, it took away six dollars of revenue from their competitors."](https://redeye.firstround.com/2006/04/shrink_a_market.html 'MSFT') Crédit [Brett Bivens](https://venturedesktop.substack.com/ 'Brett')
4. « Long Bets a été fondé en 2002 comme un moyen de favoriser des prédictions plus responsables sur l’avenir\. » C’est le même groupe qui a géré le pari Warren Buffett contre les Hedge Funds\. [This post looks at predictions for 2020](https://medium.com/the-long-now-foundation/our-long-bets-and-predictions-about-02020-736cf08efcd6 '2020')
5. ["Can the teardrops that fall after reading bad science writing generate renewable electricity? Yes, they can."](https://eighteenthelephant.com/2020/02/12/can-the-teardrops-that-fall-after-reading-bad-science-writing-generate-renewable-electricity-yes-they-can/ 'teardrops')

[^1]: Les gens diraient [machine learning is a subset of AI](https://towardsdatascience.com/clearing-the-confusion-ai-vs-machine-learning-vs-deep-learning-differences-fce69b21d5eb 'ML')\, j’utiliserai les termes de manière interchangeable ici pour plus de commodité\, puisque les principes semblent valables dans les deux domaines \; Scott les distinguerait\. « L’intention du ML est de permettre aux machines d’apprendre par elles\-mêmes en utilisant les données fournies et de faire des prédictions précises\. »

[^2]: Crédit [Daniel McCarthy on twitter](https://twitter.com/d_mccar/status/1237738926086987777?s=20 'Daniel')

[^3]: Les opérations cloud ici incluent l’entraînement du modèle IA\, l’inférence du modèle\, le transfert de données

[^4]: PDF page 6 sur leur 8K du quatrième trimestre 2020\. Notez aussi que pour simplifier\, j’ai pris le COGS wholeco\, ce qui inclut les services professionnels moins rentables\. Si vous prenez le COGS uniquement par abonnement\, ils ont 80 \% de marges brutes\.

[^5]: Ou peut\-être que vous trouvez simplement et remplacez le nom de l’entreprise et les logos dans le deck\, qui suis\-je pour juger\.

[^6]: Cela faisait partie d’une réponse plus longue sur la recherche de l’équilibre entre la technologie et le business\, qui mérite son propre article\, et je le ferai à l’avenir\. Il a retenu de choisir entre trois approches \: 1\) La tech peut dicter les affaires si elle montre une amélioration par rapport aux indicateurs convenus 2\) Commencer moins sexy mais se préparer au fil du temps 3\) Créer un espace spécifique pour expérimenter\, comme la règle des 20 \% de Google

[^7]: « Nous adoptons les principes d’investissement value de Benjamin Graham\, Warren Buffett et Charles Munger\, et aujourd’hui nous concentrons principalement sur les sociétés cotées en bourse en Asie\, avec un accent particulier sur la Chine\. Nous visons à obtenir des rendements supérieurs en étant propriétaires à long terme d’entreprises de haute qualité avec un important « fossé économique »\, un grand potentiel de croissance et gérées par des personnes dignes de confiance\. Certaines de nos participations remontent à notre création il y a vingt ans\. »

[^8]: La plupart des sociétés d’investissement prennent des frais de gestion sur les actifs investis\, puis des frais de performance sur les rendements des actifs\. Une structure de frais typique est « 2 et 20 »\, c’est\-à\-dire 2 \% de frais de gestion et 20 \%\. Si vous mettez 1000 \$ et que cela monte à 1200 \$\, en supposant que les frais de gestion sont déduits de la valeur de fin de période\, les frais de gestion seront de 24 \$ \(2 \% \_ 1200 \$\) et les frais de performance 40 \$ \(20 \% \_ \(1200 \$ \- 1000 \$\)\)\. Comparez cela au modèle des honoraires de Li Lu qui ne prend les frais de performance qu’après les 6 \% premiers de rendement\. Ici\, il n’y aurait pas de frais de gestion\, et les frais de performance seraient de 47 \$ \(25 \% \_ 1000 \$ \- 6 \% \_ 200 \$\)\)\. C’est un secret de polichinelle que de nombreuses sociétés d’investissement vivent des frais de gestion fixes de la croissance de leurs actifs sous gestion plutôt que de la performance\. Le modèle de Li Lu lui serait plus bénéfique s’il croyait pouvoir générer de gros rendements\, et moins avantageux s’il s’en sortait mal\.

[^9]: Je crois que c’est le même discours [previously translated on gurufocus,](https://www.gurufocus.com/news/997607/notes-from-li-lus-latest-speech-at-peking-university 'guru') et la version de Graham semble plus complète\. J’ai \(très\) brièvement vérifié la traduction et elle semble exacte\, mais je ne peux évidemment pas garantir totalement l’œuvre\. L’original est [here](https://xueqiu.com/6026781624/137223946 'original')

[^10]: Un fonds spéculatif long\/short est un type populaire de fonds d’investissement qui prend des positions longues \(achètes\) sur certaines entreprises et se couvre en vendant d’autres entreprises\. Un fonds quantitatif est un autre style populaire qui utilise principalement des algorithmes pour prendre des décisions d’investissement\. Oui\, ils utilisent probablement le ML\.\.\.

[^11]: Je ne trouve pas la source de cette statistique\, et il est connu que même les meilleurs investisseurs réussissent 50 à 60 \% du temps\. Ils gagnent en évaluant leurs paris de manière appropriée\, et en faisant compter leurs gagnants

[^12]: « Autrefois\, ma compréhension de la bourse était essentiellement qu’elle était pleine de méchants\. Mais Monsieur Déjeuner Gratuit — \[Buffett\] n’était pas du tout comme eux\. Il était très intelligent et ce qu’il disait était intelligent et perspicace\. Je comprenais ses principes dès que je les entendais\. Et j’avais l’impression que ce qu’il faisait était quelque chose que je pouvais faire aussi\. » Étrangement\, il n’y a aucune mention de Buffett dans [this 1998 profile of Li Lu](https://observer.com/1998/05/tiananmen-square-to-wall-street-li-lu-hits-the-new-york-jackpot/amp/ 'Li Lu')\, donc peut\-être que l’histoire est du marketing \?

[^13]: L’auteur tient à souligner qu’il s’agit d’exemples hypothétiques\, abstraits\.
