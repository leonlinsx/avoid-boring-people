---
title: "Efficacité de calcul Excel"
description: "Notes sur les astuces de vitesse Excel"
pubDate: 2016-03-17
category: System Design
tags: ['investment banking']
heroImage: '../../../blog/2016_03_17_excel/e_1.png'
locale: 'fr'
sourceSlug: 'excel'
sourceHash: '658f73ba1e40df367c86978fb2e3fde6def4efdf9bf18e1d34975fed5dc10592'
---

Il y a quelque temps\, j’ai dû faire des recherches approfondies sur l’efficacité d’Excel\. Certains fichiers que nous utilisions en banque prenaient beaucoup de temps à calculer\, et nous voulions voir quelles améliorations pouvaient être apportées\. Il y a beaucoup de contenu\, et ce sont les sites les plus utiles que j’ai trouvés\. Notez que je ne suis pas forcément d’accord avec tout le contenu cependant \:

1. Propre à Microsoft ['improving performance' writeup](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)> 'office performance 2007')
   - « Avec l’Excel 2007 « Big Grid »\, la performance compte vraiment\. »
   - « Excel comporte trois phases distinctes dans l’ensemble du processus de calcul \:
     - Construisez la chaîne de calcul initiale et déterminez par où commencer le calcul\. Cette phase se produit lorsque le classeur est chargé en mémoire\.
     - Suivez les dépendances\, marquez les cellules comme non calculées\, et mettez à jour la chaîne de calcul\. Cette phase s’exécute à chaque entrée ou changement de cellule\, même en mode calcul manuel\. En général\, cela s’exécute si rapidement que vous ne le remarquez pas\.
     - Calculez toutes les formules\. Dans le cadre du processus de calcul\, Excel réorganise et restructure la chaîne de calcul pour optimiser les recalculs futurs\. »
   - « Une fonction volatile est toujours recalculée à chaque recalcul même si elle ne semble pas avoir changé de précédent\. L’utilisation de nombreuses fonctions volatiles ralentit chaque recalcul\, mais cela ne change rien à un calcul complet\.
     - Certaines fonctions intégrées dans Excel sont évidemment volatiles \: RAND\(\)\, NOW\(\)\, TODAY\(\)\. D’autres sont moins manifestement volatiles \: OFFSET\(\)\, CELL\(\)\, INDIRECT\(\)\, INFO\(\)\.
     - Certaines fonctions qui ont déjà été documentées comme volatiles ne le sont en fait pas \: INDEX\(\)\, LIGNES\(\)\, COLONNES\(\)\, ZONES\(\)\. »
     - Note \: cela a peut\-être changé dans les versions officielles ultérieures
   - Ils donnent une liste d’actions volatiles qui déclenchent des recalculs
   - Ils donnent aussi une macro pour mesurer le temps de calcul
   - Ils en donnent un peu [golden rules to follow,](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#first-golden-rule-remove-duplicated-repeated-and-unnecessary-calculations> 'golden rules') dans le but général de simplicité
     - Supprimer les calculs dupliqués\, répétés et inutiles
     - Utiliser la fonction la plus efficace possible
     - Profitez bien du recalcul intelligent
     - Temps et test à chaque changement
   - Ils donnent un bel exemple de [how to simplify a problem](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#dynamic-count-unique> 'example problem')
   - Et passer en revue une longue liste de goulets d’étranglement courants avec les formules

2. [Another site](https://trumpexcel.com/suffering-from-slow-excel-spreadsheets/ 'trump excel') Avec des conseils de vitesse Excel
   - « Utiliser les colonnes d’aide »
     - Je suis tout à fait d’accord\, mais souvent sous\-utilisé par beaucoup
   - « Utiliser des tableaux Excel et des plages nommées »
     - Je suis d’accord sur les champs nommés\, même si je suis souvent trop paresseux
   - « Utiliser des techniques de formules plus rapides »
     - Remarquez les conseils répétés

3. [Yet another site](http://www.databison.com/how-to-speed-up-calculation-and-improve-performance-of-excel-and-vba/ 'databison')
   - « Isoler les formules répétées et les déplacer vers des cellules uniques »
     - En lien avec le point de la colonne d’aide ci\-dessus
   - « Nidification si les conditions correspondent à la fréquence d’occurrence »
     - Je ne me souviens plus si c’est vrai en fait\, donc prenez cela avec des pincettes

4. Et enfin\, un site comparant la vitesse de [vlookup vs index match](http://www.exceluser.com/blog/727/excels-fastest-lookup-methods-the-tested-results.html 'vlookup vs index match')
   - L’ajustement de l’indice est toujours supérieur en termes d’efficacité
   - Cela dit\, j’utilise toujours vlookups quand il s’agit d’une simple extraite\, ou quand je pense que mon modèle va être examiné par quelqu’un qui sera confus par la correspondance d’indice\. Concevoir en pensant à l’utilisateur final\.
