---
title: "Plaid et la puissance des API"
description: "Plaid abstrait la plomberie financière ennuyeuse, permettant aux autres d’innover plus rapidement."
pubDate: 2021-01-30
category: Technology
tags: ['startups', 'software']
featured: false
heroImage: '../../../blog/2021_01_30_plaid/plaid_3.webp'
locale: 'fr'
sourceSlug: 'plaid'
sourceHash: 'daae66d786d14dbfb4c0c831358b5f6fed3ca4b971461b077f61a7895375e9cd'
---

## À retenir

Plaid est une entreprise de technologie financière qui aide d’autres entreprises à se connecter aux données bancaires\. En faisant des choses ennuyeuses que les autres ne veulent pas faire\, cela rend la vie plus commode pour les autres et devient un produit très collant\.

## 1\. Abstraire les couches de travail

Je vais parler de l’entreprise de technologie financière [Plaid](https://plaid.com/ 'plaid') aujourd’hui\. Avant cela\, il serait utile d’avoir un peu d’intuition sur l’abstraction et les interfaces de programmation d’applications \(API\)\. Je consacrerai la section 1 à l’abstraction et la section 2 aux API \; passez directement à la section 3 si vous connaissez déjà ces concepts\. Comme d’habitude\, je pencherai plutôt pour être moins précis techniquement pour faciliter la compréhension\.

Nous allons d’abord parler de l’abstraction \:

Supposons que vous ayez une idée d’application révolutionnaire pour gagner beaucoup d’argent\. Vous codez votre application de façon à ce qu’à chaque fois qu’une personne appuie sur la touche F2 de son clavier\, des choses se produisent et elle réalise un profit \:

![plaid](../../../blog/2021_01_30_plaid/plaid_1.webp)

Tu testes ça sur ton ordinateur portable\, tout fonctionne bien\, et tu commences à gagner de l’argent\. Ça marche tellement bien que tu en parles à tous tes amis\, qui veulent aussi en profiter\. Tu leur envoies le code et leur dis d’aller de l’avant et de prospérer\.

Un de tes amis \(le hipster agaçant\) te dit que le code ne fonctionne pas sur son Mac\, et il est triste de ne pas pouvoir gagner de l’argent pour sa prochaine tasse de café mono\-fût à un seul tube\. Tu te demandes pourquoi\, et tu vas dépanner le code\.

Il s’avère que les Mac ont un truc bizarre [Touch Bar thing](https://support.apple.com/en-gb/guide/mac-help/mchlbfd5b039/mac 'touch') pour les touches de fonction\, dont le seul but semble être de rendre la vie misérable\. Vous ajoutez un code spécial pour les utilisateurs Mac \:

![plaid](../../../blog/2021_01_30_plaid/plaid_2.webp)

Ça marche pour lui maintenant\, et il passe à [suing magazines for saying all hipsters look alike.](https://www.independent.co.uk/news/media/hipster-magazine-photo-lawsuit-mit-technology-review-a8813941.html 'hipster')

Un autre ami demande si vous pouvez aussi prendre en charge les téléphones portables\, pour gagner de l’argent en déplacement\. Quelqu’un d’autre demande si vous pouvez ajouter le support Blackberry\. Et un autre encore veut savoir quand l’application sera disponible pour le [KFC gaming console](https://www.bbc.com/news/business-55433318 'kfc')\.

En regardant ces tâches consistant à ajouter plus de code pour tous les différents dispositifs informatiques\, on commence à désespérer\. Pourquoi gagner de l’argent ne peut\-il pas être aussi simple que d’appuyer sur un bouton \? **Il faut simplement écrire votre code une fois\, puis pouvoir l’utiliser sur plusieurs appareils\.**

L’idée ci\-dessus est en fait un problème courant en informatique \(support multi\-appareils\, pas celui qui rapporte de l’argent\)\. Si vous écrivez un logiciel conçu pour tout faire\, vous devrez prendre en compte tous les appareils utilisateurs finaux possibles\. Après que votre code a été traduit en binaire \(1 et 0\)\, il doit toujours faire la même chose\. Les appareils ont tous leurs particularités\, et vous passerez plus de temps à gérer les exceptions qu’à écrire la fonctionnalité principale\.

À la fin des années 90\, des gens ont trouvé une solution à cela \: ajouter une couche supplémentaire entre les deux\, c’est\-à\-dire **Faites en sorte que ce soit le problème de quelqu’un d’autre\.** [As Shimon Schocken explains,](https://www.youtube.com/watch?v=E28KczysecE 'Shimon') Avoir un « intermédiaire » simplifie désormais votre tâche\. Au lieu d’écrire du code pour tous les appareils possibles\, vous « écrivez une fois\, vous exécutez n’importe où »\, et laissez cet intermédiaire s’occuper de rendre votre code compatible [^1]\:

![plaid](../../../blog/2021_01_30_plaid/plaid_3.webp)

**Diviser une grande tâche en tâches plus petites facilite la tâche pour tout le monde\.** Vous avez abstrait une partie du problème\, car vous voulez écrire du code « haut niveau » sans vous soucier des bugs spécifiques de l’implémentation\. D’autres peuvent en fait apprécier les détails d’implémentation « bas niveau »\, mais ne veulent pas coder les applications par\-dessus\. De chacun selon ses capacités\, à chacun selon ses besoins\, et tout ce tralala\.

Nous reviendrons à cette idée d’abstraction\, qui permet aux gens **Concentrez\-vous uniquement sur des parties spécifiques d’une tâche\.**

Maintenant\, supposons que vous et vos amis vouliez placer tout cet argent dans des banques du monde entier\. Les banques ont toutes des procédures différentes\, et vous expulseront si vous ne respectez pas leurs règles \:

- Le site de New York veut juste que vous indiquiez votre numéro de compte\, votre mot de passe et votre commande\, [banning you if you talk too much](https://www.youtube.com/watch?v=euLQOQNVzgY 'soup')
- Le site de San Francisco ne vous servira pas à moins d’afficher au moins 5 autocollants de la marque sur votre ordinateur portable
- La région de Singapour veut savoir quand vous prévoyez de vous marier et d’avoir des enfants pour le bien du pays

La plupart du groupe déteste mémoriser toutes ces règles\, mais April fait exception\. Elle prend plaisir à gérer des options ésotériques\, se portant volontaire pour gérer toutes les banques au nom du groupe\. Ne se souciant pas de la façon dont les transactions se déroulent\, mais seulement du fait qu’elles aient lieu\, le groupe la laisse gérer tout\.

Des connaissances d’une retraite psychédélique à laquelle vous avez participé entendent parler de votre arrangement\. Ils n’aiment pas non plus traiter directement avec leurs banques et veulent savoir si April peut aussi les aider\. Elle est heureuse de le faire\, à condition qu’ils lui paient une petite somme\. La rumeur se répandit\, et bientôt tout le monde appelle April comme intermédiaire\.

On voit à nouveau que les gens se souciaient le plus **Une partie d’une tâche plus vaste** \- Les dépôts et les retraits\. Les gens se fichent de pourquoi April aime ça ou de la façon dont elle se souvient de tout\, juste qu’elle y arrive\. Avoir une April rend la vie plus pratique\.

Enfin\, supposons que vous vouliez vérifier le solde de votre compte\, juste pour confirmer qu’April ne détourne pas l’argent pour payer des frais de service cachés dans son AirBNB de location\. Vous commencez à taper les dépôts récents dans un tableau Excel \:

![plaid](../../../blog/2021_01_30_plaid/plaid_4.webp)

En tant que programmeur\, vous méprisez Excel et ne connaissez pas ses fonctionnalités\. Vous connaissez cependant le signe « \+ » pour ajouter des éléments\, et commencez à calculer votre solde manuellement de cette façon \:

![plaid](../../../blog/2021_01_30_plaid/plaid_5.webp)

Cent cellules et une heure plus tard\, vous êtes presque terminé\, quand un ami vous demande ce que vous faites\. Il explique alors que la fonction sum\(\) fait ce que vous voulez \:

![plaid](../../../blog/2021_01_30_plaid/plaid_6.webp)

Ils vous racontent aussi l’ensemble **« bibliothèque » de fonctions** Qu’Excel doit aider à rendre les maths plus faciles\, comme avg\(\)\, compter\(\)\, etc\. Ce qui est cool\, c’est que vous pouvez vous attendre au même comportement pour cette fonction\, quel que soit l’appareil que vous utilisez – votre ordinateur portable Windows\, le Mac de votre ami\, le téléphone portable de votre père\. Une fois que vous savez à quoi sert la fonction et comment l’appeler\, vous pouvez gagner du temps\. Peu importe comment Excel le fait\, c’est juste qu’il fonctionne partout\, tout le temps\.

Abstraire différentes couches de travail **Augmente les possibilités et les opportunités à chaque couche\.** La personne qui a programmé sum\(\) ne veut pas passer son temps à additionner tes dépôts pour toi\. Tu ne veux pas non plus programmer la fonction sum\(\)\. Les gens se concentrent sur la partie sur laquelle ils veulent travailler\. Ne pas tout faire permet aux gens de créer beaucoup de choses\.

**Le concept d’abstraction s’applique aussi en dehors de la programmation\.** Nous travaillons tous sur une « couche » d’un problème\, en faisant confiance à la fiabilité de tout ce qui se trouve en dessous\. Vous lisez cela dans votre e\-mail\, sans vous soucier du fonctionnement des services de messagerie\, juste de leur comportement prévisible\.

## 2\. Interfaces de programmation d’applications sous forme de contrats

Nous sommes maintenant prêts à penser aux interfaces de programmation d’applications \(API\)\. Imaginez que vous aviez programmé une bibliothèque de fonctions mathématiques\, comme sum\(\) mentionné ci\-dessus\. **Ne serait\-il pas pratique si vous pouviez utiliser ces fonctions dans d’autres programmes \?**

Et si vous pouvez rendre cette bibliothèque accessible à tous\, d’autres pourraient l’utiliser pour créer leurs propres éléments intéressants\. Vous pouvez vous concentrer sur la création de vos fonctions mathématiques\, et d’autres peuvent se concentrer sur la création d’applications qui utilisent les fonctionnalités de votre bibliothèque selon les besoins\.

En tant que [Joshua Bloch](https://www.youtube.com/watch?v=LzMp6uQbmns 'Josh') On souligne que\, dès 1952\, les gens aiment [David Wheeler](<https://en.wikipedia.org/wiki/David_Wheeler_(computer_scientist)> 'David') [^2] nous proposons déjà cette idée de [having libraries of functions (sub-routines)](http://www.laputan.org/pub/papers/Wheeler.pdf 'wheeler')\:

![plaid](../../../blog/2021_01_30_plaid/plaid_7.webp)

**Nous appellerons cette bibliothèque de fonctions une API [^3]\.** Joshua pense que le terme a été utilisé pour la première fois dans [a 1968 paper by Ira Cotton and Frank Greatorex:](https://www.computer.org/csdl/pds/api/csdl/proceedings/download-article/12OmNyRPgFZ/pdf 'ira')

![plaid](../../../blog/2021_01_30_plaid/plaid_8.webp)

Cet usage touche aux concepts que nous avons abordés dans nos exemples \:

- **Abstraction\.** On ne se soucie pas du fonctionnement des fonctions mathématiques\, seulement du fait qu’elles fonctionnent\. Diviser la grande tâche ouvre des possibilités pour un travail intéressant à chaque niveau
- **Indépendance matérielle\.** Nous pouvons utiliser l’API quel que soit l’appareil utilisé\, en nous attendant à ce qu’elle s’occupe de l’intégration
- **Réutilisabilité\.** La bibliothèque peut être utilisée par plusieurs personnes qui veulent des choses différentes

Notre API est une **Contrat bien défini**\, nous indique les entrées requises et les sorties attendues\. Par exemple\, nous voulons que la fonction somme\(\) renvoie toujours le total des entrées\, et non le total dans certains cas et la moyenne dans d’autres\.

Nous aussi **on ne peut pas s’attendre à ce que nos API fassent quoi que ce soit en dehors du contrat\.** Par exemple\, sum\(\) fonctionne dans Excel\, mais make\_me\_money\(\) non\, sauf si le créateur d’Excel code cette fonction\.

Et nous **faire confiance à ce que l’API ait été correctement programmée\,** ayant subi des tests rigoureux\. Par exemple\, la fonction sum\(\) devrait nous donner le même résultat sur le même jeu de données à chaque fois\.

Imaginez la vie sans aucune API\. Il faudrait repartir de zéro à chaque fois que vous programmez quoi que ce soit\, et il faudrait aussi prendre en compte tous les scénarios possibles pour les utilisateurs finaux\. Ce serait comme si [making a sandwich from scratch](https://www.smithsonianmag.com/smart-news/making-sandwich-scratch-took-man-six-months-180956674/ 'sandwich')\.

## 3\. Plaid en tant qu’API

Nous avons établi ce qu’est une API et pourquoi elles sont importantes\. Alors\, que fait Plaid \?

Pour ceux qui ne le savent pas\, Plaid est une entreprise de technologie financière qui était [supposed to be bought by Visa for $5bn](https://www.justice.gov/opa/pr/visa-and-plaid-abandon-merger-after-antitrust-division-s-suit-block 'plaid')\, avant d’abandonner l’acquisition à cause de problèmes antitrust\. Contrairement à ma vie amoureuse\, le fait d’être rejeté les a en fait causés _plus_ précieux\, et ils sont maintenant [rumoured to be raising money at $15bn.](https://www.theinformation.com/articles/plaid-shareholders-field-offers-at-15-billion-after-merger-collapse '15')

Vous vous souvenez comment avril s’est écoulé entre vous et les banques \? Considérez avril comme une API\.

**Plaid est l’API entre les banques et tout autre organisme souhaitant utiliser les données bancaires\.** Ils permettent à leurs clients de construire des applications sur leurs API\, sans se soucier du travail d’intégration en coulisses requis\. Et c’est énormément de travail\.

Supposons que vous construisiez une application de budget\, qui nécessite l’accès à l’historique des dépenses des utilisateurs\. Si vous utilisiez votre propre code pour vous connecter aux banques\, vous devrez écrire de nouvelles sections entières chaque fois qu’une nouvelle banque est ajoutée\. Vous passeriez probablement plus de temps là\-dessus que sur les fonctions principales de votre application\, étant donné les nouvelles normes qui changent constamment\.

![plaid](../../../blog/2021_01_30_plaid/plaid_9.webp)

Plaid peut vous fournir des API qui fonctionneront toujours\, ainsi qu’une interface utilisateur que l’utilisateur verra lors de la connexion à une banque [(Plaid Link).](https://plaid.com/docs/link/ 'link') Ton problème est devenu leur problème\.

Nous allons jeter un coup d’œil à ce que cela ressemble en suivant le guide Quickstart de Plaid [here](https://plaid.com/docs/quickstart/ 'quickstart')\. Il vous donne des fichiers pour configurer une application de démonstration sur votre propre ordinateur\.

Après une journée de dépannage\, de multiples redémarrages d’ordinateurs\, et l’installation à l’aveugle de ce qui semblait être tous les programmes possibles [^4]\:

![plaid](../../../blog/2021_01_30_plaid/plaid_10.webp)

J’ai enfin réussi à en faire fonctionner une partie\, en me connectant à un compte bancaire test \:

![plaid](../../../blog/2021_01_30_plaid/plaid_11.webp)

Cela m’a permis de consulter des données fictives comme le solde de mon compte bancaire \:

![plaid](../../../blog/2021_01_30_plaid/plaid_12.webp)

Ou des données de transactions récentes \:

![plaid](../../../blog/2021_01_30_plaid/plaid_13.webp)

Si je ~~je voulais~~ je savais comment faire\, je pouvais continuer à développer une application financière de cette façon\. L’application utilisait l’API Plaid pour extraire les données de solde\, enregistrer une transaction et mettre à jour le solde\. À ce stade\, j’ai rencontré d’autres bugs et ~~abandonné~~ Ça a été repoussé\.

Si je devais construire une entreprise\, vous pouvez imaginer le temps gagné en laissant Plaid faire tout le travail financier fondamental pour moi\. Je ne veux pas travailler sur le problème d’intégration bancaire qui est une couche en dessous \; ce n’est pas excitant pour moi\. Je préfère travailler à fabriquer la roulette du trading d’actions brillante par\-dessus pour dépouiller l’argent des gens \; c’est ça [doing god's work](https://dealbook.nytimes.com/2009/11/09/goldman-chief-says-he-is-just-doing-gods-work/ 'god')\.

Si vous considérez la plupart des entreprises aujourd’hui comme des entreprises « technologiques »\, puis que vous pensez aussi au nombre d’entre elles qui nécessitent des données « financières »\, **on commence à se faire une idée de l’ampleur de l’opportunité de Plaid\.** Plus il y a d’entreprises créées qui souhaitent s’intégrer directement aux comptes bancaires des clients\, plus Plaid devient pertinent\.

**Plaid facture les entreprises\,** pas pour les consommateurs\, pour l’utilisation de l’API [^5]\. Ça [seems to take](https://plaid.com/pricing/ 'pricing') un frais basé sur les transactions pour les petites entreprises\, et un abonnement pour les grandes entreprises\. En faisant les tâches « ennuyeuses »\, ils ont créé une situation gagnant\-gagnant pour eux\-mêmes et pour d’autres innovateurs heureux de les payer pour la commodité\.

Une fois que vous utilisez Plaid\, **Il est peu probable que vous changeriez\,** car cela impliquerait de réécrire une grande partie du code utilisant les API de Plaid [^6]\. Réfléchissez à ce que cela signifie pour la capacité de Plaid à faire monter les prix\. À quelle fréquence changez\-vous votre plomberie \?

Si cela vous semble irréaliste\, considérez Fortran\, un des premiers langages de programmation\. Sa bibliothèque de fonctions était [defined in **1958**](http://ed-thelen.org/LaFarr/IBM-FORTRAN-II-704-C28-6000-2-c-1958.pdf 'fortran')\, et est toujours utilisée aujourd’hui\. Une fois implémentées\, les API durent longtemps \:

![plaid](../../../blog/2021_01_30_plaid/plaid_14.webp)

Nous avons beaucoup abordé aujourd’hui \: l’intuition derrière l’abstraction\, les API\, et ce que fait Plaid\. La principale leçon est que **Il y a beaucoup de choses que les gens ne veulent pas faire\, et beaucoup d’argent à gagner en faisant tout ça\.** La newsletter vous conseille d’éviter d’ennuyer les gens\, mais dans ce cas\, construire les choses ennuyeuses est une entreprise de plusieurs milliards\.

### Ressources supplémentaires \:

1. [What does Plaid do?](https://technically.substack.com/p/what-does-plaid-do 'plaid') par Technically
2. [Fireside chat with Plaid CEO Zach Perret](https://www.youtube.com/watch?v=sgnCs34mopw 'youtube') par FirstMark
3. [APIs all the way down](https://notboring.substack.com/p/apis-all-the-way-down 'nb') par Pas Ennuyeux
4. [A brief, opinionated history of the API](https://www.youtube.com/watch?v=LzMp6uQbmns 'youtube') par Joshua Bloch
5. [How to build a fintech app in Python using Plaid's banking API](https://www.youtube.com/watch?v=Lv2jIOi2fao 'youtube') par Erol Aspromatis

Merci à [Brian Rubinton](https://twitter.com/brianru 'b')\, [Justin Gage](https://mobile.twitter.com/itunpredictable 'j')\, Ben Morsillo\, [Denis Papathanasiou](https://github.com/dpapathanasiou 'd')\, Mai Schwartz\, [Aditya Athalye](https://evalapply.org/ 'a')\, [Jeremy Presser](https://mobile.twitter.com/JeremyPresser 'j')\, [Ian Kar](https://mobile.twitter.com/iankar_ 'i') pour des conseils sur cet article

## Autres

1. [Why working from home will stick.](https://nbloom.people.stanford.edu/sites/g/files/sbiybj4746/f/why_wfh_stick1_0.pdf 'wfh') Conformément à ma conviction actuelle que nous reviendrons au travail au bureau\, avec plus de journées de télétravail\.
2. [What is an IP address?](https://outofips.netlify.app/ 'IP')
3. [The sting of poverty](http://archive.boston.com/bostonglobe/ideas/articles/2008/03/30/the_sting_of_poverty/?page=1 'poverty')
4. [How I blew out my knee and came back to win a national championship](https://www.jasonshen.com/2011/blew-out-knee-win-national-championship/ 'jason')
5. [Judgement is an exercise in discretion](https://aeon.co/essays/judgment-is-an-exercise-in-discretion-circumstances-are-everything? 'judge')

[^1]: Pour être plus précis techniquement\, ce serait le compilateur qui doit être compatible avec chaque appareil\, et non le code lui\-même\, qui est une couche au\-dessus du compilateur\.

[^2]: David est apparemment la première personne à obtenir un doctorat en informatique\.

[^3]: Techniquement\, ce devrait être le contrat lui\-même entre les parties qui constitue l’interface\, mais je pense que le regrouper est plus facile à comprendre pour un débutant

[^4]: Je suis sûr à 99 \% que le dossier github Plaid pour Python est incorrect\, car il contient des fichiers index\.html vides\. Il y a aussi un problème étrange d’espace de noms entre plaid et plaid\-python que je n’ai pas vraiment compris mais que j’ai finalement corrigé\. Je ne comprends pas pourquoi ils ont besoin d’utiliser Docker\, qui faisait partie des nombreux programmes supplémentaires nécessaires pour que mes fichiers fonctionnent\. Mise à jour \: Plaid a depuis mentionné que ces bugs ont été corrigés\, avec un processus de démarrage rapide différent\.

[^5]: Je suis sûr que les entreprises essaient de répercuter ce coût sur les consommateurs\, mais le point ici\, c’est que le client direct qui paie pour le service est celui des entreprises qui créent des applications nécessitant une intégration financière

[^6]: Je crois que c’est le cas\, mais dites\-moi si je me trompe\.
