---
title: "Cenário da indústria de análise de dados"
description: "Visão geral do mercado, riscos e cenário competitivo"
pubDate: 2021-03-07
category: Technology
tags: ['business', 'data', 'software']
evergreen: false
heroImage: './d_1.webp'
locale: 'pt-BR'
sourceSlug: 'data_landscape'
sourceHash: '3ceeb4d616b74fcc264ff995790c97a06de33969f39d827a51204c59697972d0'
---

## Mensagem

Recentemente\, precisei montar uma análise sobre a indústria de pipelines de dados e achei que deveria compartilhá\-la\. Vamos passar\:

1.  Uma visão geral do mercado\,
2.  riscos\,
3.  Empresas envolvidas em cada etapa

## 1\. Visão geral do mercado

A indústria de pipelines de dados tem um TAM de \> 100 bilhões de dólares\, com algumas empresas sozinhas avaliando algo próximo a esse valor [^1]\. Como pipelines de dados são uma área ampla\, vou restringir a discussão a setores mais relevantes para análise de dados\. Uma mistura de empresas públicas e privadas compete para se encaixar na pilha tecnológica das organizações que usam dados\, que é basicamente todas as grandes empresas hoje em dia [^2]\.

Os dados fluem das interações geradas por clientes ou fornecedores para transações brutas **Bancos de dados**\. Os dados são então \*\*movidos \*\*e **transformado** para o modelo apropriado para armazéns de dados analíticos\. A partir daí\, os analistas podem consultar os dados que lhes interessam **Análise**\. Eles usam os resultados para o usuário final **Visualização de dados** de métricas de negócios\.

Todos esses processos em negrito têm empresas especializadas em desenvolvimento de software ou consultoria em implementação\. A maioria das empresas mais novas é baseada em nuvem \(com algumas on\-premise\)\, e está em cima de provedores de serviços como a Amazon Web Services \(AWS\) [^3]\, e aproveitar a escalabilidade\, flexibilidade e frugalidade para construir empresas de alta margem\.

Dada a taxa de crescimento da geração de dados e a receita associada \(\>20\% ano a ano\)\, a maioria das startups nesse setor representa oportunidades empolgantes de investimento\, representando índices assimétricos de risco\/retorno e múltiplos de saída comprovadamente altos\. Se você acredita no crescimento da indústria de startups\, precisa acreditar no suporte da indústria de pipelines de dados\.

## 2\. Riscos

- Segurança \(95\% de probabilidade\) \- Grandes lucros significam altas recompensas para agentes maliciosos que obtêm dados ilegalmente [^4]\. Se os custos de valores mobiliários subirem \(e vão subir\)\, isso prejudicará as margens dos negócios
- Regulamentação de privacidade de dados \(70\%\) \- Isso aumenta os custos de conformidade\, ajudando os incumbentes e prejudicando startups
- Pressão de margem upstream \(30\%\) \- Se houver mais consolidação do setor em certas camadas da pilha de dados\, essas empresas poderiam apertar margens para empresas que não têm alternativas [^5]

## 3\. Paisagem

Vamos começar com o que o usuário pode ver\, no **Visualização** fim\. Quando um analista já tem dados limpos e formatados na estrutura que deseja\, ele precisa organizar essas informações\. Isso geralmente assume a forma de um painel com gráficos e tabelas\. Algumas ferramentas nesse espaço incluem Tableau\, Looker\, Google Data Studio\, R Shiny \(dashboards baseados em navegador e amigáveis ao usuário\)\, Streamlit \(aplicativos interativos de dados\) ou até mesmo Google Sheets\.

As desvantagens na escolha de uma ferramenta aqui são a capacidade técnica dos usuários versus a complexidade dos dados\. Se uma organização tem muitos usuários que querem colaborar no mesmo projeto\, uma ferramenta simples como o Sheets funciona\. Se houver menos usuários e pedidos de recursos\, construir algo que suporte cargas maiores em um software de dashboards pode fazer sentido\.

Antes da visualização\, o analista precisa\.\.\.**Analisar os dados**\. Eles fazem isso consultando os dados de um banco de dados estruturado com uma linguagem de consulta\. Isso pode ser algo como Presto \(baixa latência\, baixa taxa de transferência\) ou Hive \(alta latência\, alta taxa de transferência\)\.

Esses cálculos são feitos em uma camada de data warehouse\, que pode ser algo como Snowflake\, Redshift\, BigQuery\, Azure\. Os que estão ganhando popularidade são baseados em nuvem\, e alguns também permitem escalonamento e faturamento separados do uso de computação versus armazenamento\. Warehouses de dados podem ser melhores para análises do que bancos de dados\, que podem ser melhores para armazenar dados\.

As desvantagens aqui incluem preço\, escalabilidade e suporte\. Por exemplo\, você pode começar com o Postgres de código aberto\, mas depois migrar para o Snowflake quando sua empresa já tiver escalado além do tamanho para o qual o Postgres é adequado e estiver enfrentando bugs mais técnicos\.

Para levar esses dados aos depósitos\, pode haver **Movimentação de dados** e \*\*modelagem de dados\*\*camadas\. Empresas como Stitch\, Fivetran\, Segment\, Airbyte ajudam você a extrair seus dados de fontes brutas \(vamos falar disso em breve\) e colocá\-los no seu banco de dados para que você possa consultá\-los\. Os data movers são comumente conhecidos como uma combinação de Extração\, Carga\, Transformação \(ELT\)\, Extração\, Transformação\, Carga \(ETL\) ou algum subconjunto dessas combinações\.

Modeladores de dados como dbt\, Matillion e Looker permitem que você mapeie esses dados brutos na estrutura que seu depósito exige\. Por exemplo\, o dbt permite transformar seus dados em um ambiente integrado de desenvolvimento \(IDE\)\, agendar trabalhos de transformação e criar documentação de como são os dados\.

As desvantagens aqui são o preço usual\, complexidade e outras características técnicas\. Por exemplo\, acredito que o Fivetran tem mais integrações\, enquanto o Stitch tem menos\. A escolha de uma ferramenta de movimentação de dados também pode afetar a ferramenta de modelagem de dados usada – você pode pensar nisso como não precisar transformar dados duas vezes\.

Todos esses dados vêm das interações com clientes e fornecedores em bruto\, **Dados de origem**\. Isso inclui ferramentas de software como Salesforce\, Zendesk\, Hubspot \(CRM\)\. Como todas são empresas diferentes\, seus formatos de dados são distintos – pense nisso como moedas diferentes para países diferentes\. Daí a necessidade das camadas de movimento e modelagem de dados mencionadas anteriormente\.

Os dados de origem provavelmente estão armazenados em algum banco de dados como Postgres\, MongoDB [^6]\, ou até mesmo Oracle se você for fã de dor\. Diferente dos data warehouses\, esses bancos de dados são melhores em armazenar os dados de interação conforme são gerados em tempo real\; eles escrevem mais rápido\, são mais lentos em serem lidos\.

Juntando tudo\:

![post](./d_1.webp)

Agradecimentos a Paul Tune\, aos participantes do Recurse Center Shae Matijs Erisson\, Ori Dean Bernstein\, Mikkel Paulson\, Steven Li\, Ryan Prior\, Luke Barone\-Adesi\, Chirag Davé\, Nathan Goldbaum e aos membros do Locally Optimistic Jacob Matson\, Arpit Choudhury\, Gordon Wong\, Kevin Hu\, Itto Kornecki\, por analisarem isso\.

[^1]: Fui obrigado a fornecer TAM para minhas análises\, que na minha opinião geralmente são números inventados\. Enfim\, aqui estão as minhas\: Snowflake \(SNOW\) sozinho negocia com um limite de \$70 bilhões de mkt em \$200mm de rotação\. Visualização de dados é de \$10 bilhões de rev\, análise de dados \$40 bilhões\, data warehousing \$20 bilhões\, ELT\/ETL \$10 bilhões e banco de dados \$50 bilhões por comunicados de imprensa da indústria

[^2]: A partir de certa escala\, não é mais viável armazenar dados em softwares gratuitos de planilha pessoal

[^3]: A AWS provavelmente vale centenas de bilhões em uma reprodução de US\$ 10 bilhões\; Eu a excluí e excluí os outros principais provedores da análise para simplificar

[^4]: Os dados podem então ser vendidos online\, usados para fraude ou mantidos como reféns\. Para a maioria das empresas\, é uma questão de quando serão hackeadas\, não se\.

[^5]: Dada a concorrência na maioria das camadas\, geralmente houve deflação de custos no geral\, em vez de inflação

[^6]: Como Paul Tune aponta\, você pode ter bancos de dados relacionais \(Postgres\, MySQL\) e não relacionais\, como MongoDB e DynamoDB \(um produto da AWS\)\. A natureza não estruturada deste último cria desafios para empresas que tentam realizar análises\.
