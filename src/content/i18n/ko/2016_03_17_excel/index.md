---
title: "엑셀 계산 효율성"
description: "엑셀 속도 팁에 관한 노트"
pubDate: 2016-03-17
category: System Design
tags: ['investment banking']
heroImage: './e_1.png'
locale: 'ko'
sourceSlug: 'excel'
sourceHash: '658f73ba1e40df367c86978fb2e3fde6def4efdf9bf18e1d34975fed5dc10592'
---

얼마 전 엑셀 효율성에 대해 깊이 있는 조사를 해야 했습니다\. 은행에서 사용하던 파일 중 일부는 계산하는 데 시간이 오래 걸렸고\, 어떤 개선이 가능한지 보고 싶었습니다\. 콘텐츠가 정말 많고\, 제가 찾은 가장 도움이 되는 사이트들이 이 사이트들이었습니다\. 다만 모든 내용에 동의하는 것은 아닙니다\:

1. 마이크로소프트 자체 ['improving performance' writeup](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)> 'office performance 2007')
   - \"Excel 2007 \'빅 그리드\'에서는 성능이 정말 중요합니다\"
   - \"엑셀은 전체 계산 과정에서 세 가지 뚜렷한 단계로 나뉩니다\:
     - 초기 계산 체인을 구축하고 어디서 계산을 시작할지 결정하세요\. 이 단계는 워크북이 메모리에 로드될 때 발생합니다\.
     - 의존성을 추적하고\, 셀을 계산되지 않은 것으로 표시하며\, 계산 체인을 업데이트합니다\. 이 단계는 수동 계산 모드에서도 각 셀 항목이나 변경에 따라 실행됩니다\. 보통은 너무 빠르게 실행되어 눈에 띄지 않습니다\.
     - 모든 공식을 계산하세요\. 계산 과정의 일환으로\, 엑셀은 미래의 재계산을 최적화하기 위해 계산 체인을 재정렬하고 재구성합니다\.\"
   - \"휘발성 함수는 변경된 선례가 없어 보여도 매번 재계산됩니다\. 많은 휘발성 함수를 사용하면 재계산 속도가 느려지지만\, 완전한 계산에는 차이가 없습니다\.
     - 엑셀에 내장된 일부 함수는 명백히 변동성이 있습니다\: RAND\(\)\, NOW\(\)\, TODAY\(\)\. 반면 덜 명확하게 변동성 있는 기능들도 있습니다\: OFFSET\(\)\, CELL\(\)\, INDIRECT\(\)\, INFO\(\)\.
     - 이전에 휘발성으로 문서화된 일부 함수들은 실제로는 휘발성이 아닙니다\: INDEX\(\)\, ROWS\(\)\, COLUMNS\(\)\, AREAS\(\)\.\"
     - 참고\: 이후 사무소 버전에서는 변경되었을 수 있습니다
   - 리칼리를 유발하는 변동성 행동 목록을 제공합니다
   - 또한 계산 시간을 측정하는 매크로 자료도 제공합니다
   - 그들은 좀 줘 [golden rules to follow,](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#first-golden-rule-remove-duplicated-repeated-and-unnecessary-calculations> 'golden rules') 단순함을 위한 일반적인 의도
     - 중복되고 반복되며 불필요한 계산을 제거하세요
     - 가장 효율적인 기능을 사용하세요
     - 스마트 재계산을 잘 활용하세요
     - 시간과 테스트 각 변경 사항
   - 그들은 다음과 같은 멋진 예를 제공합니다\. [how to simplify a problem](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#dynamic-count-unique> 'example problem')
   - 그리고 공식에서 흔히 발생하는 병목 현상들을 길게 나열해 보세요

2. [Another site](https://trumpexcel.com/suffering-from-slow-excel-spreadsheets/ 'trump excel') 엑셀 속도 팁과 함께
   - \"헬퍼 칼럼 사용\"
     - 강력히 동의하며\, 많은 사람들이 보통 저평가하는 편입니다
   - \"엑셀 테이블과 이름 있는 범위 사용\"
     - 이름 있는 범위에 대해서는 동의하지만\, 저는 종종 너무 귀찮아서 그런 것 같아요
   - \"더 빠른 공식법 사용\"
     - 반복되는 조언들을 주목해 보세요

3. [Yet another site](http://www.databison.com/how-to-speed-up-calculation-and-improve-performance-of-excel-and-vba/ 'databison')
   - \"반복된 공식들을 분리해서 단일 세포로 옮긴다\"
     - 위의 헬퍼 칼럼 포인트와 관련이 있습니다
   - \"발생 빈도 순서대로 조건 중첩\"
     - 사실 이게 사실인지 기억이 잘 안 나니\, 참고만 하세요

4. 마지막으로\, 속도 비교 사이트입니다\. [vlookup vs index match](http://www.exceluser.com/blog/727/excels-fastest-lookup-methods-the-tested-results.html 'vlookup vs index match')
   - 인덱스 매칭은 효율성 면에서 항상 우수합니다
   - 그렇긴 해도\, 간단한 풀이나\, 인덱스 매칭에 혼란스러워할 것 같은 사람이 제 모델을 볼 것 같을 때는 여전히 vlookup을 사용합니다\. 최종 사용자를 염두에 두고 설계하세요\.
