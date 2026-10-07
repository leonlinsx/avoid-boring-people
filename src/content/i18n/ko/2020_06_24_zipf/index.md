---
title: "말의 전쟁"
description: "외계인 탐색에서 집프의 법칙과 정보 엔트로피를 활용한 이야기"
pubDate: 2020-06-24
category: Technology
tags: ['information']
heroImage: '../../../blog/2020_06_24_zipf/z_3.webp'
locale: 'ko'
sourceSlug: 'zipf'
sourceHash: '973192c22790935d832c5e18991ced9ee6c8da9f91d41215baf5d37cb9c8863a'
---

## 주요 정보

집프의 법칙과 섀넌의 정보 엔트로피는 외계 생명체를 찾는 데 도움을 줄 수 있습니다

## 외계 생명체를 어떻게 찾을 수 있을까요\?

우리가 이야기한 적 있죠 [how machine learning companies use data to recognise text](/writing/ml 'ML') 그리고 어떻게요 [investors use data to pick companies.](/writing/data 'invest')

이번 주에는 과학자들이 데이터를 활용해 외계인을 찾는 방법에 대해 이야기해 봅시다\. 아래 내용 중 일부는 다음에서 인용할 것입니다 [Laurance Doyle's talk with the Long Now group.](http://longnow.org/seminars/02020/apr/29/interspecies-communication-and-search-extraterrestrial-intelligence/ 'Long')

### 문제 프레임 설정

외계 지적 연구소\(SETI\) 탐색은 외계 생명체를 찾는 연구소 중 가장 유명한 연구소입니다\. 그 임무는 ["to explore, understand and explain the origin and nature of life in the universe and the evolution of intelligence."](https://www.seti.org/about-us/mission 'mission')

그런 문제를 어떻게 범위화할 수 있을까요\?

외계 생명체를 찾으려면\, 그들은 다른 행성에 존재해야 합니다\. 그래서 행성을 찾는 것이 출발점이 될 수 있다는 것을 알고 있습니다\.

초등 과학에서도 행성은 별 주위에서 형성된다는 것을 알고 있습니다\. 그래서 행성을 지탱할 수 있는 별을 찾는 것도 중요한 문제입니다\.

대부분의 행성은 혹독한 환경을 가지고 있다는 것을 알고 있습니다\. 그래서 그 목록을 생명체를 유지할 수 있다고 생각하는 행성들로만 제한해 봅시다 [^1]\.

그 행성 중 모두가 실제로 생명체가 나타나는 것은 아니므로\, 실제로 생명체가 나타난 비율을 살펴보겠습니다\.

여기서는 충분히 괜찮다고 생각하고\, 검색을 시작할 만큼의 특징이 있다고 생각할 수도 있습니다\. 그래도 검색 정밀도를 좁히기 위해 추가할 수 있는 기능들이 남아 있습니다\.

행성을 볼 때는 행성에서 신호가 나오는 것을 찾고 싶어 하는데\, 그것이 행성에 생명체가 있다는 훨씬 강력한 증거가 되기 때문입니다\. 누군가 음악을 연주하는 집과 비교해 보세요\. 두 번째 시나리오에서는 생명체가 있다고 결론짓기가 훨씬 쉽습니다\.

그러니 생명체가 실제로 나타나는 행성들과\, \'지능적인\' 종이 나타나는 행성들로 좁혀봅시다\.

그리고 그 \'지능 종\' 중에서\, 통신 기술을 개발하게 된 종만 빼자\.

마지막으로\, 설령 그 종이 통신을 발전시켰다 해도\, 그들이 더 이상 살아 있지 않다면 우리는 그 통신을 받을 수 없습니다\. 그래서 그 문명들이 얼마나 오래 살지도 고려해야 합니다\.

정말 많았죠\. 하지만 이제 우리는 문제를 정의하고 신호를 보낼 수 있는 지능 외계 문명의 수를 찾는 데 필요한 모든 주요 요소를 갖추게 되었습니다\.

이 모든 것을 종합해 보면\, 우리가 한 일은 [Drake equation](https://en.wikipedia.org/wiki/Drake_equation#:~:text=The%20Drake%20equation%20is%20a%20statement%20that%20stimulates%20intellectual%20curiosity,a%20part%20of%20that%20universe. 'Drake')\, 지적 생명체를 추정하는 유명한 방법 [^2]\. 방금 다룬 모든 포인트를 곱해서 지능적인 외계인이 몇 명인지 추측할 수 있는 것을 주목하세요\:

![post](../../../blog/2020_06_24_zipf/z_1.webp)

### 범위 좁히기

변수가 너무 많으니\, 오늘은 그 방정식의 한 부분\, 즉 \'지능적인\' 종의 비율에 집중해 보겠습니다\.

\"지능적인\" 신호와 \"지능적인\" 신호를 구분할 방법을 찾아야 합니다\. 예를 들어\, 마이크로 노래하는 것과 노래하는 것을 구분하고 싶습니다 [audio feedback](https://en.wikipedia.org/wiki/Audio_feedback 'audio')\.

외계인 소통 사례가 있거나 우리가 무엇을 찾아야 하는지 알면 도움이 될 텐데요\. 우리는 전자를 가지고 있지 않아요 [^3]\, 하지만 후자를 더 좁힐 수 있는 방법도 있습니다\. 우리가 찾고자 하는 것은 지능 신호가 무작위 잡음과 대조적으로 가질 수 있는 특성입니다\.

그 방법 중 하나는 우리 주변의 비인간 지능 생명체를 관찰하는 것입니다\. [We use Antarctica as a proxy for Mars,](https://www.cnn.com/2015/12/09/health/white-mars-antarctica-concordia/index.html 'Mars') 그리고 동물을 외계어 대리인으로 사용할 수도 있습니다\.

만약 우리가 지적 커뮤니케이션이 따라야 한다고 믿는 규칙이 있다면\, 그 규칙을 동물 커뮤니케이션과 비교해 보고 얼마나 잘 작동하는지 확인할 수 있습니다\. 이렇게 하면 검색 기준을 넓혀야 할지 좁혀야 하는지 알 수 있습니다\.

알고 보니 언어 이론에는 두 가지 주요 규칙이 있습니다 \- 집프의 법칙과 섀넌의 정보 이론 엔트로피입니다\. 각각을 차례로 살펴보겠습니다\.

### 단어 빈도에 관한 집프의 법칙

Zipf의 법칙은 모든 언어에 대해 단어의 등장 빈도가 단어의 순위에 반비례한다는 것을 제안합니다\. 만약 모든 단어를 등장 빈도로 순위를 매겼을 때입니다\. 예를 들어\, \"the\"가 가장 흔한 단어라면 순위 \#1을 가집니다\. \"I\"가 두 번째로 흔한 단어라면\, 순위는 \#2입니다\. 순위 \#1인 \"the\"는 랭크 \#2인 \"I\"보다 언어 내에서 두 배 더 많이 등장합니다\. 이 단어는 run된 \#3 단어보다 세 배나 더 많이 언어 내에서 등장합니다\.

이런 법칙을 통해 우리는 그 언어의 샘플 텍스트로 이를 검증할 수 있다\. 예를 들어\, 누군가가 로미오와 줄리엣에서 단어의 빈도를 그래프로 그렸다\:

![post](../../../blog/2020_06_24_zipf/z_2.webp)

인터넷에서 만난 낯선 사람에게 의존하는 데 만족하지 않고\, 저는 제 뉴스레터 게시물을 직접 분석하기 시작했습니다\. 간단한 파이썬 코드로 [^4]저는 모든 서브스택 게시물에서 텍스트를 추출하고\, 사용한 상위 50개 단어를 뽑아 빈도에 대해 그래프로 표시했습니다\. 이 관계가 완벽하지는 않지만\, Zipf의 법칙이 예측하는 것과 꽤 가깝습니다\. 상상할 수 있듯이\, \"the\"\, \"to\"\, \"a\"\, \"and\"\, \"of\" 모두 자주 나타납니다\.

![post](../../../blog/2020_06_24_zipf/z_3.webp)

좋아요\, 이제 하나의 법칙이 생겼네요\. 돌고래나 고래 같은 동물을 대상으로 시험해 보고 여전히 유효한지 확인할 수 있습니다\. [Researchers did that,](https://www.seti.org/animal-communications-information-theory-and-search-extraterrestrial-intelligence-seti#:~:text=We%20also%20found%20that%20bottlenose,Zipf's%20Law%20distribution%20of%20signals.&text=In%20other%20words%2C%20baby%20bottlenose,start%20to%20whistle%20like%20adults. 'dolphin') 그리고 그들이 그들을 발견했다\! [^5] 즉\, 집프의 법칙은 외계 언어에도 적용될 가능성이 큽니다\. 우주 신호에 적용하면 일부 잡음을 걸러낼 수 있습니다\.

### 샤넌의 다음 단어 예측에 관한 정보 이론

섀넌의 정보 이론 [^6] 다른 단어 앞에 단어를 알면 그 단어가 무엇인지 알 수 있는 단서를 얻을 수 있다고 제안합니다\. 다시 말해\, 문장 내 단어들은 각각에 따라 달라집니다\. 예를 들어\, 마지막 단어 \"other\"를 생략했음에도 불구하고 이전 문장을 잘 이해하실 수 있을 것입니다\.

단어들 사이에 어떤 관계가 있다는 것을 알면서도\, [we can also derive a way to score the language based on those relationships.](https://langev.com/pdf/plotkin00languageEvolution.pdf 'shannon') 저는 수학을 잘 이해하지 못해서 대충 넘어가지만\, 우리가 이해할 수 있는 주요 교훈은 언어에는 점수가 있다는 점입니다\.

점수를 그래프로 표시함으로써 대부분의 언어가 어느 범위에 속하는지 알 수 있습니다\. 이전과 마찬가지로 돌고래와 고래를 점수 짓고\, 그들의 언어가 어떻게 작동하는지 확인할 수 있습니다\:

![post](../../../blog/2020_06_24_zipf/z_4.webp)

보시다시피\, 대부분의 언어가 그 범위에 속합니다\. 같은 점수 체계를 신호에 적용하면\, 언어가 될 가능성이 낮은 신호도 걸러낼 수 있습니다\.

### 외계인을 찾는 것은 머신러닝과 크게 다르지 않습니다

우리는 넓은 목표를 가지고 시작했어요 \- 외계인을 찾는 것\.

그 후 문제를 구상하고\, 참고할 만한 여러 구성 요소를 제시했습니다\.

우리는 문제의 한 부분으로 좁혀 검색의 정밀도를 높일 방법을 찾았습니다\. 인간 언어에서 두 가지 주요 기준을 제시한 후\, 이를 다른 비인간 언어와 교차 검증했습니다\. 앞으로는 비슷한 접근법을 사용해 더 연구하고자 하는 신호를 좁힐 수 있습니다\.

만약 이 모든 것이 가정적인 이야기라고 생각했다면\, 위의 접근법은 [exactly what one team at SETI is using to analyse signals.](https://www.seti.org/animal-communications-information-theory-and-search-extraterrestrial-intelligence-seti#:~:text=We%20also%20found%20that%20bottlenose,Zipf's%20Law%20distribution%20of%20signals.&text=In%20other%20words%2C%20baby%20bottlenose,start%20to%20whistle%20like%20adults. 'SETI')

보시다시피\, 이 과정 자체는 다른 데이터 분석 문제들과 비슷할 수 있습니다\. 먼저\, 목표를 세우고\, 그다음\, 필요한 것을 구상합니다\. 다음으로\, 알고리즘을 만듭니다\. 마지막으로\, 그 알고리즘이 효과가 있는지 테스트합니다\. 한 분야의 문제 해결은 다른 분야의 문제 해결과 크게 다르지 않습니다\.

[^1]: 거주 가능하고 거주 불가능한 것의 정의 [is difficult of course,](https://en.wikipedia.org/wiki/Circumstellar_habitable_zone 'zone') 우리에게 맞는 것이 외계 생명체에게도 통하지 않을 수 있기 때문입니다\. 어떤 사람들은 탄소 기반 생명체\(우리가 가진 것\)가 아니라 실리콘 기반 생명체라고 믿을 수도 있습니다 [there are difficulties with that assumption](https://astronomy.stackexchange.com/questions/20858/why-do-aliens-have-to-be-carbon-based-lifeforms 'carbon')

[^2]: \"드레이크 방정식의 유용성은 문제를 해결하는 데 있는 것이 아니라\, 과학자들이 다른 곳의 생명 문제를 고려할 때 반드시 포함해야 하는 다양한 개념들을 숙고하는 데 있으며\, 다른 곳의 생명 문제에 과학적 분석의 기초를 제공한다\"는 점에 주목해야 한다

[^3]: 혹시 당신이 제가 모르는 뭔가를 알고 있다면\, 더 알고 싶어요\.\.\.

[^4]: 간단하다는 건\, 작성하는 데 \<30분\, 문제 해결에 3시간이 걸렸다는 뜻입니다\. 코드는 [here](https://github.com/leonlinsx/ABP-code/blob/master/Python-projects/File%20extractor.py 'git') 본인의 목적에 맞게 조정하고 싶다면\,

[^5]: 또한 인간과 돌고래 새끼 아기의 옹알이도 대조해 실험했습니다\. 이 둘 다 집프의 법칙을 따르지 않는다는 것을 발견했습니다\.

[^6]: 네\, 이건 _그_ [Claude Shannon, the guy who essentially taught us how to create electronic communications](https://www.itsoc.org/about/shannon 'Shannon')
