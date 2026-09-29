---
title: "Eficiência de cálculo em Excel"
description: "Notas sobre dicas de velocidade do Excel"
pubDate: 2016-03-17
category: System Design
tags: ['investment banking']
heroImage: './e_1.png'
locale: 'pt-BR'
sourceSlug: 'excel'
sourceHash: '658f73ba1e40df367c86978fb2e3fde6def4efdf9bf18e1d34975fed5dc10592'
---

Algum tempo atrás\, precisei fazer uma pesquisa aprofundada sobre eficiência do Excel\. Alguns dos arquivos que usávamos no setor bancário estavam demorando muito para serem calculados\, e queríamos ver quais melhorias poderiam ser feitas\. Há muito conteúdo disponível\, e esses foram os sites mais úteis que encontrei\. Note que não concordo necessariamente com todo o conteúdo\, porém\:

1. A própria Microsoft ['improving performance' writeup](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)> 'office performance 2007')
   - \"Com o Excel 2007 \"Big Grid\"\, o desempenho realmente importa\"
   - \"O Excel possui três fases distintas no processo geral de cálculo\:
     - Construa a cadeia inicial de cálculo e determine por onde começar a calcular\. Essa fase ocorre quando o livro de exercícios é carregado na memória\.
     - Rastreie dependências\, sinalize células como não calculadas e atualize a cadeia de cálculo\. Essa fase é executada a cada entrada ou alteração de célula\, mesmo no modo de cálculo manual\. Normalmente\, isso é executado tão rápido que você nem percebe\.
     - Calcule todas as fórmulas\. Como parte do processo de cálculo\, o Excel reordena e reestrutura a cadeia de cálculo para otimizar futuros recálculos\.\"
   - \"Uma função volátil é sempre recalculada a cada recálculo\, mesmo que não pareça ter precedentes alterados\. Usar muitas funções voláteis desacelera cada recálculo\, mas não faz diferença para um cálculo completo\.
     - Algumas das funções embutidas no Excel são obviamente voláteis\: RAND\(\)\, NOW\(\)\, TODAY\(\)\. Outras são menos visivelmente voláteis\: OFFSET\(\)\, CELL\(\)\, INDIRECT\(\)\, INFO\(\)\.
     - Algumas funções que já foram documentadas como voláteis não são\, de fato\, voláteis\: INDEX\(\)\, ROWS\(\)\, COLUMNS\(\)\, AREAS\(\)\.\"
     - Nota\: isso pode ter mudado em versões posteriores do escritório
   - Eles fornecem uma lista de ações voláteis que acionam recálculos
   - Eles também fornecem uma macro para medir o tempo de cálculo
   - Eles dão um pouco [golden rules to follow,](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#first-golden-rule-remove-duplicated-repeated-and-unnecessary-calculations> 'golden rules') com a intenção geral de simplicidade
     - Remover Cálculos Duplicados\, Repetidos e Desnecessários
     - Use a Função Mais Eficiente Possível
     - Faça bom uso do Recálculo Inteligente
     - Tempo e Teste Cada Mudança
   - Eles dão um bom exemplo de [how to simplify a problem](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#dynamic-count-unique> 'example problem')
   - E passe por uma longa lista de gargalos comuns com fórmulas

2. [Another site](https://trumpexcel.com/suffering-from-slow-excel-spreadsheets/ 'trump excel') Com dicas de velocidade do Excel
   - \"Use Colunas de Ajudante\"
     - Concordo plenamente\, e geralmente é subutilizado por muitos
   - \"Use tabelas do Excel e intervalos nomeados\"
     - Concordo sobre os campos nomeados\, embora eu geralmente seja preguiçoso demais
   - \"Use Técnicas de Fórmulas Mais Rápidas\"
     - Repare nos conselhos repetidos

3. [Yet another site](http://www.databison.com/how-to-speed-up-calculation-and-improve-performance-of-excel-and-vba/ 'databison')
   - \"Isole fórmulas repetidas e mova\-as para células individuais\"
     - Relacionado ao ponto da coluna auxiliar acima
   - \"Aninhar se condições na ordem de frequência de ocorrência\"
     - Na verdade\, não lembro mais se isso é verdade\, então leve com cautela

4. E\, por fim\, um site comparando a velocidade de [vlookup vs index match](http://www.exceluser.com/blog/727/excels-fastest-lookup-methods-the-tested-results.html 'vlookup vs index match')
   - A correspondência de índice é sempre superior em eficiência
   - Dito isso\, ainda uso vlookups quando é uma simples extração\, ou quando acho que meu modelo vai ser analisado por alguém que vai se confundir com a correspondência do índice\. Projete pensando no usuário final\.
