---
title: "Paysage industriel de l’analyse de données"
description: "Aperçu du marché, risques et paysage concurrentiel"
pubDate: 2021-03-07
category: Technology
tags: ['business', 'data', 'software']
evergreen: false
heroImage: './d_1.webp'
locale: 'fr'
sourceSlug: 'data_landscape'
sourceHash: '3ceeb4d616b74fcc264ff995790c97a06de33969f39d827a51204c59697972d0'
---

## À retenir

J’ai dû rédiger récemment une analyse sur l’industrie des pipelines de données\, et j’ai pensé que je devrais la partager\. Nous allons passer en revue \:

1.  Un aperçu du marché\,
2.  risques\,
3.  entreprises impliquées à chaque étape

## 1\. Aperçu du marché

L’industrie des pipelines de données a un TAM de 100 milliards de dollars de \>\, certaines entreprises étant évaluées à ce niveau [^1]\. Puisque les pipelines de données constituent un domaine vaste\, je limiterai la discussion aux secteurs plus pertinents pour l’analyse de données\. Un mélange d’entreprises publiques et privées se dispute pour s’intégrer dans la pile technologique des organisations utilisant des données\, qui correspond essentiellement à toutes les grandes entreprises aujourd’hui [^2]\.

Les données passent des interactions générées par le client ou le fournisseur vers les transactions brutes **Bases de données**\. Les données sont alors \*\*déplacées \*\*et **transformé** au modèle approprié pour les entrepôts de données analytiques\. À partir de là\, les analystes peuvent interroger les données qui les intéressent **Analyse**\. Ils utilisent les résultats pour l’utilisateur final **Visualisation des données** des indicateurs commerciaux\.

Tous ces processus en gras ont des entreprises spécialisées soit dans le développement de logiciels\, soit dans le conseil en mise en place\. La plupart des entreprises récentes sont basées sur le cloud \(avec certaines sur site\)\, et sont au top des fournisseurs de services tels qu’Amazon Web Services \(AWS\) [^3]\, et tirer parti de la scalabilité\, de la flexibilité et de la frugalité pour construire des entreprises à forte marge\.

Compte tenu du taux de croissance de la génération de données et du chiffre d’affaires associé \(\>20 \% d’un an\)\, la plupart des startups dans ce domaine représentent des opportunités d’investissement passionnantes\, représentant des ratios risque\/rendement asymétriques et des multiples de sortie élevés et prouvés\. Si vous croyez à la croissance de l’industrie des startups\, vous devez croire en le soutien de l’industrie des pipelines de données\.

## 2\. Risques

- Sécurité \(probabilité à 95 \%\) \- De gros profits signifient de fortes récompenses pour les acteurs malveillants qui obtiennent illégalement des données [^4]\. Si les coûts de la sécurité augmentent \(et ils augmenteront\)\, cela nuira aux marges des entreprises
- Réglementation de la confidentialité des données \(70 \%\) \- Cela augmente les coûts de conformité\, aidant les acteurs en place et nuisant aux startups
- Pression sur les marges en amont \(30 \%\) \- S’il y a une consolidation accrue de l’industrie à certains niveaux de la pile de données\, ces entreprises pourraient réduire les marges à des entreprises qui n’ont pas d’alternatives [^5]

## 3\. Paysage

Nous commencerons par ce que l’utilisateur peut voir\, sur le **Visualisation** fin\. Lorsqu’un analyste a déjà des données nettoyées formatées dans la structure qu’il souhaite\, il doit organiser ces informations\. Cela prend généralement la forme d’un tableau de bord avec des graphiques et des tableaux\. Parmi les outils de ce domaine figurent Tableau\, Looker\, Google Data Studio\, R Shiny \(tableaux de bord basés sur navigateur et conviviaux\)\, Streamlit \(applications de données interactives\)\, ou même Google Sheets\.

Les compromis dans le choix d’un outil ici sont la capacité technique des utilisateurs versus la complexité des données\. Si une organisation compte de nombreux utilisateurs souhaitant collaborer sur le même projet\, un outil simple comme Sheets fonctionne\. S’il y a moins d’utilisateurs et de demandes de fonctionnalités\, construire quelque chose capable de gérer des charges plus importantes dans un logiciel de tableau de bord pourrait avoir du sens\.

Avant la visualisation\, l’analyste doit\.\.\.**analyser les données**\. Ils le font en interrogeant les données d’une base de données structurée avec un langage de requête\. Cela peut être quelque chose comme Presto \(faible latence\, faible débit\) ou Hive \(haute latence\, haut débit\)\.

Ces calculs sont effectués sur une couche d’entrepôt de données\, qui peut être quelque chose comme Snowflake\, Redshift\, BigQuery\, Azure\. Ceux qui gagnent en popularité sont basés sur le cloud\, et certains permettent également une mise à l’échelle et une facturation séparés de l’utilisation du calcul par rapport à l’utilisation du stockage\. Les entrepôts de données peuvent être meilleurs pour l’analyse que les bases de données\, qui peuvent être meilleures pour stocker des données\.

Les compromis ici incluent le prix\, la montée en charge et le support\. Par exemple\, vous pourriez commencer avec Postgres open source\, puis passer à Snowflake lorsque votre entreprise aura dépassé la taille pour laquelle Postgres conviendrait et rencontrera des bugs plus techniques\.

Pour transmettre ces données aux entrepôts\, il peut y avoir **Transfert de données** et \*\*modélisation de données\*\*couches\. Des entreprises comme Stitch\, Fivetran\, Segment\, Airbyte vous aident à extraire vos données de sources brutes \(nous y reviendrons bientôt\) et à les intégrer dans votre base de données pour que vous puissiez les interroger\. Les data movers sont communément appelés une combinaison d’Extract\, Load\, Transform \(ELT\)\, Extract\, Transform\, Load \(ETL\)\, ou un sous\-ensemble de ces combinaisons\.

Les modélisateurs de données tels que dbt\, Matillion et Looker vous permettent de mapper ces données brutes dans la structure dont votre entrepôt a besoin\. Par exemple\, dbt vous permet de transformer vos données dans un environnement de développement intégré \(IDE\)\, de planifier des tâches de transformation et de créer une documentation de l’état des données\.

Les compromis ici sont le prix habituel\, la complexité et d’autres caractéristiques techniques\. Par exemple\, je crois que Fivetran a plus d’intégrations alors que Stitch en a moins\. Le choix d’un outil de transfert de données peut aussi influencer l’outil de modélisation des données utilisé – on peut voir cela comme ne pas avoir besoin de transformer deux fois les données\.

Toutes ces données proviennent des interactions clients et fournisseurs en brut **Données sources**\. Cela inclut des outils logiciels comme Salesforce\, Zendesk\, Hubspot \(CRM\)\. Comme ce sont toutes des entreprises différentes\, leurs formats de données sont différents – pensez\-y comme des monnaies différentes selon les pays\. D’où le besoin des couches de mouvement et de modélisation des données mentionnées plus tôt\.

Les données sources sont probablement stockées dans une base de données telle que Postgres\, MongoDB [^6]\, ou même Oracle si vous êtes un faible pour la douleur\. Contrairement aux entrepôts de données\, ces bases de données sont meilleures pour stocker les données d’interaction au fur et à mesure qu’elles sont générées en temps réel \; elles sont plus rapides à écrire\, plus lentes à être lues\.

En résumé \:

![post](./d_1.webp)

Merci à Paul Tune\, aux participants du Recurse Center Shae Matijs Erisson\, Ori Dean Bernstein\, Mikkel Paulson\, Steven Li\, Ryan Prior\, Luke Barone\-Adesi\, Chirag Davé\, Nathan Goldbaum\, ainsi qu’aux membres de Locally Optimistic Jacob Matson\, Arpit Choudhury\, Gordon Wong\, Kevin Hu\, Itto Kornecki\, pour avoir examiné cela\.

[^1]: J’ai dû fournir un TAM pour mes analyses\, qui\, à mon avis\, sont généralement des chiffres inventés\. Bref\, voici les miens \: Snowflake \(SNOW\) à lui seul se négocie à un plafond de 70 milliards de dollars de mkt sur 200 mm de rotation\. La visualisation des données est de 10 milliards de dollars\, l’analyse de données 40 milliards\, l’entreposage de données 20 milliards\, l’ELT\/ETL 10 milliards\, et la base de données 50 milliards par communiqués de presse industriels

[^2]: Au\-delà d’une certaine échelle\, il n’est plus possible de stocker les données dans un logiciel de tableau de forfait personnel gratuit

[^3]: AWS vaut probablement des centaines de milliards sur un renouvellement de 10 milliards de dollars \; Je l’ai exclu\, ainsi que les autres principaux fournisseurs\, de l’analyse pour plus de simplicité

[^4]: Les données peuvent ensuite être vendues en ligne\, utilisées pour la fraude ou retenues contre rançon\. Pour la plupart des entreprises\, il s’agit de savoir quand elles sont piratées\, pas si elles sont piratées\.

[^5]: Compte tenu de la concurrence dans la plupart des couches\, il y a généralement eu une déflation globale des coûts\, plutôt que de l’inflation

[^6]: Comme le souligne Paul Tune\, vous pouvez avoir à la fois des bases de données relationnelles \(Postgres\, MySQL\) et non relationnelles\, comme MongoDB et DynamoDB \(un produit AWS\)\. La nature non structurée de ces dernières crée des défis pour les entreprises qui cherchent à effectuer des analyses\.
