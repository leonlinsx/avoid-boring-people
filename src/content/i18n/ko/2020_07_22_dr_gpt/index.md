---
title: "닥터 GPT-3"
description: "또는 '내가 어떻게 걱정을 멈추고 인공지능을 사랑하게 되었는가'"
pubDate: 2020-07-22
category: Technology
tags: ['AI', 'computer science', 'math']
evergreen: false
heroImage: '../../../blog/2020_07_22_dr_gpt/gpt_28.webp'
featured: true
locale: 'ko'
sourceSlug: 'dr_gpt'
sourceHash: '71b3312cf1cfb5110ced0c235342922bfdfe4e4d54e6798a85dde1d8941f3a6d'
---

## 주요 정보

GPT\-3는 다양한 사용 사례에 일반화되는 인상적인 텍스트 예측 모델입니다\. 저는 GPT\-3가 어떻게 작동하는지\, 과대광고가 정당한지\, GPT를 어떻게 감지하는지\, 그리고 우리의 일자리를 약탈할 수 있는지 설명해 봅니다\.

## 결국 인간일 뿐이니까

약 일주일 전\, 샤리프 샤밈은 공유했습니다 [this video on twitter
demonstrating the abilities of a new AI, GPT-3](https://twitter.com/sharifshameem/status/1282676454690451457)

그리고\. 트위터\. 겁먹었어\. 나갔어\.

아마도 그들의 편안한 직업들이 [copying stack overflow answers](https://www.zdnet.com/article/the-most-copied-stackoverflow-java-code-snippet-contains-a-bug/ 'SO') 또는 [gossiping about startups](https://twitter.com/magdalenakala/status/1285597906892988417?s=20 'startup') 위험에 처해 있었다 [^1]\, 프로그래머와 벤처캐피털 투자자들이 트위터에서 GPT\-3 데모와 이 최신 인공지능에 대한 뜨거운 의견을 피드에 쏟아내기 시작했습니다\. 원한다면 아직도 계속되고 있습니다 [take a look](https://twitter.com/hashtag/gpt3?lang=en 'gpt3')

그래서 저는 제 개인적인 의견을 담아\, AI에 매료된 관객층을 이용해 수익을 내려고 합니다\.

야\, 나도 인간일 뿐이야\.

이 글은 5개의 섹션으로 나뉘어 있습니다\:

1. GPT\-3가 할 수 있는 일\, 왜 인상적인지\, 그리고 사람들이 왜 우려하는지에 대한 설명
2. GPT\-3 이전 언어 모델이 어떻게 작동했는지에 대한 약간의 기술적 개요
3. GPT\-3가 어떻게 작동하는지에 대한 약간의 기술적 개요
4. GPT\-3가 작성한 텍스트를 감지하는 방법
5. GPT\-3의 함의

시작하자\.

## 1\. GPT\-3는 다양한 사용 사례에 대해 이해 가능한 출력물을 생성할 수 있어 인상적입니다

[GPT-3](https://arxiv.org/pdf/2005.14165.pdf 'GPT') 창조된 [OpenAI](https://openai.com/about/ 'Open')이 회사가 \"인공지능이 인류 전체에 이익이 되도록 보장하는\" 것\, 즉 로봇이 우리 모두를 죽이지 않도록 하려는 것이다\.

GPT\-3는 일반 언어 모델로\, 일부 단어를 입력으로 받아 출력으로 더 많은 단어를 생성합니다\. **이걸 놀라운 것으로 생각하세요 [autocomplete function](https://en.wikipedia.org/wiki/Autocomplete#:~:text=Autocomplete%2C%20or%20word%20completion%2C%20is,to%20accept%20one%20of%20several. 'auto')\.** 일반적인 모델이기 때문에 다양한 작업을 해결할 수 있습니다\. 유니콘에 관한 단락을 쓰게 하거나\, 문장을 번역하거나\, 프로그래밍 코드를 생성해 달라고 할 수도 있습니다\.

보통 알고리즘이 훈련된 목적만 수행할 거라 기대하는 이 점은 참 좋습니다\. 엑셀에 입력해서 시를 알려주려고 찾으려는 게 아니니까요\. 오랫동안 우리는 프로그램이 설계된 대로 작동하지 않는 작업을 제대로 수행하지 못할 것이라 기대해 왔습니다\.

일반적인 모델이기 때문에\, GPT\-3가 특정 작업에 특화된 모델보다 더 못할 것 같다고 생각할 수도 있습니다\. 예를 들어 GPT의 번역 결과와 번역에만 집중하는 알고리즘을 비교할 때\, GPT는 그만큼 뛰어나지 않을 것입니다\.

놀랍고 인상적이게도\, 항상 그런 것은 아닙니다\. 아래는 [GPT paper](https://arxiv.org/pdf/2005.14165.pdf 'GPT') 번역 테스트 결과와 함께 말입니다\. 간단히 하기 위해\, \"최첨단\" 모델을 나타내는 첫 번째 줄과 가장 성능이 좋은 GPT 모델을 나타내는 마지막 줄을 비교하면 됩니다 [^2]\. 여기서는 더 높은 수치가 더 좋습니다\. 특히 번역 작업에서 이런 점을 볼 수 있습니다 _로_ 영어\)\, **GPT는 최첨단 모델보다 더 좋거나 더 좋습니다\.**

![post](../../../blog/2020_07_22_dr_gpt/gpt_1.webp)

OpenAI는 GPT가 별도의 데이터셋을 검색하지 않고 텍스트 예측\, 퀴즈 질문 등 다양한 다른 작업에 대해 GPT를 테스트했으며\, 대명사가 어떤 단어를 가리키는지 판단하지 못하게 했습니다 [^3]\. GPT가 모든 경우에서 이기는 것은 아니지만\, 대부분의 경우에 훌륭한 결과를 냅니다\. **만약 한 가지 모델만 선택할 수 있다면\, 아마 GPT를 사용하고 싶을 것입니다\.** 그건 [Simone Biles](https://www.nytimes.com/2019/10/13/sports/simone-biles-worlds.html 'Simone') AI 커뮤니티에서 많은 행사에서 1위를 차지하고 나머지 행사에서도 뛰어나다\.

몇 가지 예를 살펴보겠습니다\.

아래 첫 번째 이미지에서는 모델이 상단에 프롬프트를 받고\, 그 다음 나머지 텍스트가 나타납니다\. 텍스트는 더 길게 이어집니다\; 저는 표시용으로 잘라냈습니다\. 결과물이 정말 멋지지 않나요\?

![post](../../../blog/2020_07_22_dr_gpt/gpt_2.webp)

두 번째 이미지에서는 모델에서 생성된 또 다른 샘플 텍스트가 나오는데\, 이번에는 시도 만들어낼 수 있음을 보여줍니다\. 아마도 제가 직접 쓰는 것보다 더 나을 것 같습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_3.webp)

놀랍네요\, 그렇다면 모든 과대광고가 정당화된 건가요\? AI의 능력이 인위적인 경계를 넘은 전환점이었나요\? 트위터와 구글 트렌드는 분명히 그렇게 생각하는 것 같습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_4.webp)

음\.\.\. 그렇기도 하고 아니기도 해\.

방금 보여준 두 이미지요\? 거짓말했어요\, 그건 GPT\-3에서 온 게 아니에요\.

사실 이 글들은 2019년 2월에 출시된 구형 모델인 GPT\-2에서 온 것입니다\. 사실\, 이 뉴스레터의 오랜 독자라면 기억할 수도 있을 것입니다 [this article](/writing/moloch 'Moloch') 그때 저는 이미 모델의 훌륭한 결과를 강조하며 글을 썼습니다 [^4]\. 이전 모델에서 생성된 텍스트는 이미 훌륭했습니다\.

그럼 이번에는 뭐가 달라졌나요\? 로봇들이 마케팅 부서가 더 좋아진 걸까요\?

부분적으로는 그렇습니다\. GPT\-3는 [the end of May](https://minimaxir.com/2020/07/gpt3-expectations/ 'GPT')\. 구글 검색 트렌드를 다시 스크롤해서 자세히 보면\, 그래프에서 아주 작은 상승이 있었던 것을 알 수 있을 겁니다\. 실제로 급증하기 2주 전이었죠\. 그것이 바로 GPT\-3에 대한 대중의 관심이었고\, 그 바이럴 트윗 이전이었습니다\. 프레젠테이션 형식이 정말 큰 차이를 만들 수 있다는 것을 보여주고\, 저는 글쓰기를 그만두고 틱톡 영상을 만들어야 한다는 걸 알 수 있습니다\.

그럼에도 불구하고 이번에도 인상적인 개선이 있습니다\. GPT\-3는 GPT\-2보다 더 나은 결과를 제공하며\, 더 많은 시나리오에 일반화할 수 있습니다\. 이는 주로 훈련에 사용되는 데이터 증가와 모델 매개변수 증가 덕분입니다\.

아래에서 더 자세히 설명하겠지만\, 이 모델들이 작동하는 방식은 데이터를 받아 훈련한 뒤\, 훈련 세트에 따라 모델 가중치를 변경하는 것입니다\.

훈련 데이터가 많으면 보통 도움이 된다는 것은 한동안 알려져 있었습니다 [^5]그리고 GPT\-3의 결과는 계속해서 이것이 사실임을 보여줍니다\. GPT\-3 섭취 [~50x the amount of data](https://lambdalabs.com/blog/demystifying-gpt-3 'lambda') 이전 버전이 그랬던 것처럼\, 출력에 대해 이렇게 많은 관련 참조를 어떻게 만들어낼 수 있는지에 대한 직관적인 이해를 제공합니다 [^6]\.

GPT\-3는 또한 [~100x the amount of parameters](https://minimaxir.com/2020/07/gpt3-expectations/ 'params') 이전 버전과 비교해 모델에서 차이가 나옵니다\. 1\,750억 파라미터를 가집니다 [isn't unheard of](https://twitter.com/iamtrask/status/1285301017878441988?s=20 'params')하지만 이 덕분에 GPT\-3는 답변에서 더 많은 차별화를 얻을 수 있습니다 [^7]\.

맥스 울프는 GPT\-3에서 개선된 두 가지 다른 점을 지적합니다\: [1) It allows for text generation twice as long, and 2) prompts to the model are even more helpful in steering the direction of text generated](https://minimaxir.com/2020/07/gpt3-expectations/ 'Max')\. GPT\-3는 입력할 때 샘플 답변 중 0개\, 1개\, 또는 몇 개의 \'프롬프트\'를 받을 수 있습니다\. 프롬프트는 어떤 답변을 제공할지 이해하는 데 도움을 주며\, 프롬프트가 많을수록 좋습니다\.

전반적으로 맥스는 GPT\-3가 이전 GPT\-2보다 약 5배 더 자주 쓸 만한 결과를 제공했다고 추정합니다\. 과대광고 측면에서 일반 대중은 0에서 100으로 증가한 반면\, 이 분야를 시청하는 사람들은 50에서 70으로 증가했습니다\.

이로 인해 다음과 같은 결과가 나올 수 있습니다\. [this, a plugin to pull GPT results to autofill google sheets](https://twitter.com/pavtalk/status/1285410751092416513?s=20 'twitter') \(이번에는 진짜 데모입니다\, 약속합니다\)\:

GPT는 일반화가 잘 되어 있어서\, 모든 \'지식 작업\' 분야에서 사용될 것이라는 기대가 큽니다\. 프로그래밍부터 은행업\, 의학 분야까지\, GPT가 결국 전문가와 같은 수준의 답변을 제공할 수 있을 것이라는 생각이 있습니다\. 다음에 의사를 방문할 때\, 아마도 당신의 진단은 Dr\. GPT에게서 나올지도 모릅니다\.

모두 좋아 보이는데\, 어떤 걱정거리가 있나요\?

맥스가 더 자세히 설명한다 [here](https://minimaxir.com/2020/07/gpt3-expectations/ 'expectations')\, 다음과 같이 지적한다\:

- 이 모델은 산출이 느립니다
- 공개적으로 제시된 사례들에는 많은 선택적 선택이 있었습니다
- 모두가 같은 훈련된 모델을 사용하고 있어서 미세 조정이 불가능합니다
- 훈련에는 체계적인 편향\, 예를 들어 리콜 같은 문제가 계속 존재합니다 [how Microsoft had to pull its chatbot after it turned racist](https://www.theverge.com/2016/3/24/11297050/tay-microsoft-chatbot-racist 'Tay')

또 다른 우려는 이런 모델을 훈련시키는 비용입니다\. 재미있게도\, [Yannic on youtube](https://www.youtube.com/watch?v=SY5PvZrJhLE&feature=youtu.be 'Yannic') 연구자들이 일부 데이터 수집에서 실수를 했고\, 이미 모델을 학습시키고 나서야 그것을 깨달았다고 지적했습니다\. 처음부터 다시 시작하는 대신\, 그 문제에 대해 다른 방식으로 조정해야 했기 때문입니다\. **모델을 재학습하는 데 비용이 너무 많이 들었습니다\.**

![post](../../../blog/2020_07_22_dr_gpt/gpt_5.webp)

정말 놀랍네요\. 사람들은 하드웨어가 알고리즘 요구사항을 따라잡으면서 모델 학습 비용이 줄어들기를 기대하고 있습니다\. 그렇지 않으면 대기업만이 자체 목적에 맞게 모델을 맞춤화할 수 있게 될 것입니다\.

마지막으로\, 이 사건이 우리 모두의 일자리를 없애고 인류의 종말을 가져올 것이라는 끝없는 불안감도 있습니다\. 이 가벼운 주제는 결론 발언에서 다루겠습니다\.

이제 모델들이 어떻게 작동하는지 좀 더 자세히 살펴보겠습니다\.

## 2\. GPT\-3 이전에 사용된 seq2seq 모델 개요

_면책 조항\: 다음 두 섹션에서는 사용된 모델을 설명하면서 약간 기술적인 내용이 다가옵니다\. 도전이 마음에 들지 않으시면 \"GPT\-3를 어떻게 탐지할 수 있을까요\?\" 섹션으로 건너뛰어도 좋습니다\._

_추가 고지\: 저는 머신러닝 전문가가 아니며\, 관련 모델이 복잡합니다\. 앞으로 기대어 보겠습니다 [this talk](https://www.youtube.com/watch?v=S0KakHcj_rs 'talk') 그리고 이 글 하단에 링크된 다른 설명들도 있습니다\. 수정이 있으면 언제든지 답변해 주세요\._

**GPT\-3는 다른 모델을 사용합니다** 전통적인 예측 모델과 비교했을 때입니다\. 하지만 GPT\-3를 보기 전에 이전 모델들의 직관을 이해하는 것이 여전히 도움이 됩니다\. 먼저 오래된 모델을 살펴보고\, 그 다음 GPT\-3를 살펴보겠습니다\.

먼저 인기 있고 나이가 많은 것부터 시작하겠습니다 [sequence to sequence model.](https://google.github.io/seq2seq/ 'seq') 이것을 일반적으로 \"seq2seq\"라고 약칭하지만\, 이해하기 쉽게 하기 위해 저는 이를 \"구 모델\"\, GPT\-3를 \"새 모델\"이라고 부르겠습니다\.

예를 들어\, 문구가 있고 다음 문구를 예측하고 싶다고 가정해 봅시다\. 우리는 그 구문을 일련의 함수들로 구성된 알고리즘에 넣고\, 예측된 출력을 얻습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_6.webp)

모든 단어가 중요하기 때문에 입력 구문을 나누어 한 단어씩 살펴봐야 합니다\. 예를 들어\, \"Had we but world enough and time\"은 \"Had we but world enough\"와 \"Had we but world enough\"와 \"limes\"가 다른 의미를 가집니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_7.webp)

다이어그램을 정리하고 첫 번째 단어만 봅시다\. 그 단어를 함수에 통과시키고\, 임시 출력을 얻습니다\. 컴퓨터가 단어를 처리하는 방식이기 때문에 단어를 숫자로 표현할 수 있다는 것을 알고 있습니다 [^8]\. 그래서 단어를 어떤 숫자로 변환하고\, 수학을 거친 뒤 또 다른 숫자 집합을 얻는 것으로 생각하세요\. 예를 들어\, \(1\, 2\, 3\) 곱하기 2는 \(2\, 4\, 6\)입니다\.

고등학교 수학을 기억한다면\, 이건 행렬 곱셈이나 선형대수입니다\. **아래 수학 내용은 거의 모두 이 섹션과 다음 섹션 모두에서 행렬 곱셈 형태로도 표현할 수 있습니다\.**

![post](../../../blog/2020_07_22_dr_gpt/gpt_8.webp)

사용되는 함수는 [neural network, so it's more complicated than just multiplying by two.](https://towardsdatascience.com/learn-how-recurrent-neural-networks-work-84e975feaaf7 'neural') 직관에 대해 이전에 다뤘기에 그 작동 원리들은 간단히 넘어가겠습니다 [here](/writing/ml 'ML')\, 그리고 이 공연을 너무 복잡하게 만들 거예요\. 무료 구독 자료\, 이메일 주세요\. 제가 전달할게요\.

여기서 더 중요한 것은 단어가 다른 것으로 변환된다는 점입니다\. 모델은 단어가 처음 숫자로 변환되는 방식과 수행하는 기능을 모두 제어할 수 있습니다\. 예를 들어\, \(1\, 2\, 3\) 곱하기 대신에 \"Had\"를 \(2\, 3\, 4\)로 바꾸고\, 3을 곱해 \(6\, 9\, 12\)로 만들 수 있습니다

![post](../../../blog/2020_07_22_dr_gpt/gpt_9.webp)

첫 번째 단어는 끝났으니 두 번째 단어로 넘어가겠습니다\. 여기서 다른 점은 첫 번째 단어에서 임시 출력 1이 있다는 것입니다 [^9]\. 두 번째 단어와 함께 함수를 다시 적용한 후 새로운 임시 출력 2를 얻습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_10.webp)

이 시점에서 나머지 시퀀스에서 어디로 가는지 추론할 수 있습니다\. 실제로 우리는 이 과정을 반복하여 입력의 마지막 단어에 도달합니다\. 한 단어의 임시 출력을 사용하여 다음 단어의 임시 출력을 반복적으로 생성하는 데 도움을 줍니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_11.webp)

그 임시 출력을 사용해 다른 함수를 적용하면 두 가지가 나옵니다\. 첫 번째 단어는 숫자에서 다시 변환한 후\, 또 다른 임시 출력\(여전히 숫자 값\)입니다\. 예시에서는 \"this\"라는 단어가 나옵니다\. 멋지네요\, 드디어 눈에 띄는 진전이 있습니다\!

![post](../../../blog/2020_07_22_dr_gpt/gpt_12.webp)

이제 임시 출력\, 실제 출력 하나\, 그리고 새로운 함수가 생겼습니다\. 예상하셨겠지만\, 다음 예측 단어와 또 다른 임시 출력을 얻기 위해 같은 단계를 반복할 수 있습니다\. 이게 다시 반복되는 패턴입니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_13.webp)

그리고 앞서 입력한 상황과 마찬가지로\, 구절이 끝날 때까지 계속 반복하세요\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_14.webp)

이제 기존 모델은 끝났습니다\! 설명이 많았고\, 분명히 지나치게 단순화된 부분이었지만\, 우리는 과정을 대략적으로 이해할 수 있었습니다\. 더 자세한 내용은 원본 논문을 참고하세요 [here](https://arxiv.org/abs/1409.3215 'paper')

이제 우리의 이해를 시험하고 새 모델의 개선점을 암시하는 중요한 질문이 있습니다\. 이전 모델에서는 이전 부분을 먼저 해결하기 전에 과정의 어떤 부분을 해결할 수 있을까요\? 예를 들어\, \"우리\"를 먼저 풀지 않고 \"시간\"의 임시 출력을 얻을 수 있을까요\?

**아니요\, 모든 걸 순서대로 진행해야 했으니까요\.** 단어의 위치와 맥락 모두 중요하므로\, 우리는 한 단어씩 모든 것을 처리하고 싶습니다\. 모든 단계가 이전 단계에 반복적으로 의존하기 때문에 어떤 부분도 건너뛸 수 없습니다\. 이것이 바로 옛 모델이 \' [recurrent neural network](http://karpathy.github.io/2015/05/21/rnn-effectiveness/ 'RNN')\. 이로 인해 입력 텍스트가 커지면 예측 계산도 느려집니다\.

여기서 트랜스포머 모델이 등장합니다\.

## 3\. GPT\-3는 트랜스포머 디코더 모델을 사용하는데\, 이는 트랜스포머 모델의 변형입니다

GPT\-3는 생성 사전 학습 트랜스포머 3\(Generative Pretrained Transformer 3\)의 약자입니다\. 이름에 있는 트랜스포머는 [transformer model, using an "attention" mechanism.](http://jalammar.github.io/illustrated-transformer/ 'transformer') GPT\-2와 GPT\-3 모두 같은 유형의 모델을 사용하기 때문에\, 전자에 대한 설명을 찾으면 일반화될 것입니다 [^10]\.

하지만 이 글을 올리기 직전에 배운 것은 다음과 같습니다 **실제로 [a variation of the transformer model.](https://s3-us-west-2.amazonaws.com/openai-assets/research-covers/language-unsupervised/language_understanding_paper.pdf 'variation')** 따라서 먼저 새 모델의 단순화된 버전\, 즉 \'attention\'이 무엇을 의미하는지 살펴보고\, 그 다음 GPT\-3 버전이 어떻게 다른지 살펴보겠습니다\. 일반 변압기를 벗어나 GPT\-3의 조정을 사용할 때를 알려드리겠습니다\.

새 모델에서는 입력 단어를 가지고 처음부터 다시 돌아가 출력을 얻으려 합니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_15.webp)

하지만 이제는 모든 입력 단어를 동시에 순차적으로 평가하는 것이 아니라 병렬로 평가하고자 합니다\. 이렇게 하면 행렬 수학을 사용해 결과를 한 번에 계산할 수 있어 많은 시간을 절약할 수 있습니다\.

우리는 항상 하던 것처럼 입력 단어를 다시 숫자로 변환합니다\. 이번에는 그 숫자들을 3개의 다른 함수를 거쳐 각 단어마다 a\, b\, c 세 개의 임시 출력을 얻습니다\. 간단히 말씀드리기 위해 단어와 출력은 3개의 숫자로 구성되어 있습니다\; 실제로는 수백 개의 숫자가 있습니다\. 이 3개의 출력이 어떻게 사용되는지 곧 살펴보겠습니다 [^11]\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_16.webp)

다이어그램을 정리하고 모든 입력 단어에 대해 계산을 해봅시다\. 이제 모든 입력 단어에 대해 a\, b\, c가 있습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_17.webp)

이제 입력을 순차적으로 고려하지 않을 때 우리가 겪는 문제가 있습니다\; 연구자들은 새로운 모델이 나오기 전까지 오랫동안 이 문제에 얽매여 있었습니다\. 앞서 언급했듯이\, **단어의 위치와 맥락 모두 중요합니다\. 순차적으로 평가하지 않으면 어떻게 그런 점을 얻을 수 있을까요\?**

예를 들어\, \"저자는 뉴스레터를 완성하기 위해 커피를 더 많이 마셨다\, 왜냐하면 아직 끝나지 않았기 때문이다\"라는 문장을 생각해 보세요\. \"coffee\"의 위치를 \"newsletter\"로 바꾸는 것은 의미가 없기 때문에 컴퓨터가 어떻게든 그 위치를 알아야 합니다\. 게다가 여기서 \"it\"은 뉴스레터를 가리키며\, 컴퓨터도 그 맥락을 알아야 합니다\. 이전 모델에서는 한 단어씩 이동하기 때문에 모든 정보가 유지됩니다\. 새 모델에서는 처음부터 그 정보를 얻기 위한 다른 방법이 필요합니다\.

다이어그램에서 모든 임시 출력을 동시에 계산했으며\, 어느 하나도 서로 의존하지 않는다는 점을 주목하세요\. 다음으로 할 일은 첫 번째 단어의 첫 임시 출력을 가져와\, 모든 단어의 두 번째 임시 출력을 포함하는 함수를 적용하는 것입니다\. 다이어그램에서 저는 이 결과를 첫 번째 임시 출력 \"dot\"과 두 번째 임시 출력\(예\: 1a\.2b\)으로 표현했습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_18.webp)

첫 번째 단어와 관련된 것을 가져와서\, 다른 모든 단어와 관련된 것과 연결했습니다\. 중요한 점은\, 이 계산을 순서대로 할 필요가 없다는 것입니다\. 왜냐하면 한 단어의 결과가 다른 단어로 이어지지 않기 때문입니다\. 이 과정을 나머지 단어들에 대해 반복할 수 있습니다\. 여기서는 명확성을 위해 단어 2에 대해서도 같은 단계를 보여줍니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_19.webp)

첫 번째 단어로 돌아가 봅시다\. a와 b 출력은 끝났지만 c가 남아 있습니다\. 예상대로 우리는 이 임시 dot 출력과 모든 c 출력에 또 다른 함수를 적용합니다\. 그 다음에는 또 다른 함수를 사용해 이 모든 개별 출력을 하나의 출력으로 만듭니다\. 예를 들어\, 이 경우 7개의 출력에서 1개의 단일 출력 1z로 바뀌었습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_20.webp)

정말 많은 노력이었네요\. 정말로\, 이걸 생각해낸 사람들에게는 이해가 돼요\. 우리가 방금 한 일은 [the steps of calculating "attention" for our words](http://jalammar.github.io/illustrated-gpt2/ 'attention') [^12]\. 단어 A가 다른 단어에 대해 가진 \'주의\'의 양은 단어 A가 그 단어에 얼마나 집중해야 하는지\, 따라서 얼마나 많은 맥락을 받아야 하는지를 의미합니다\. 단어의 구성 요소를 다른 모든 단어와 연관 짓음으로써\, 우리는 이전에 맥락 문제를 해결할 수 있습니다\. 단순화를 위해 위치 문제 해결은 생략하고\, 단어 위치에 따라 원래 단어에 숫자를 더 추가하는 것으로 생각하세요 [^13]\.

이제 새로운 출력인 z가 있는데\, 이 출력은 해당 단어에서 얻은 정보와 입력 내 다른 단어들의 맥락을 포함합니다\. 우리는 이를 또 다른 함수\(피드 포워드 신경망\)에 통과시켜 또 다른 출력\, 즉 z\\\*라고 부릅니다\. 거의 다 왔습니다\.

**방금 한 모든 단계를 요약해서 \'인코딩\' 단계라고 부르겠습니다\.** \"인코딩\" 과정에서는 단어의 초기 숫자를 주변 단어들의 더 많은 맥락을 포함하는 새로운 숫자로 변환합니다\. 예를 들어 \(1\, 2\, 3\)는 \(5\, 7\, 0\)이 됩니다\. 각 단어는 사실 세 개가 아니라 수백 개의 숫자임을 상기시켜 드립니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_21.webp)

출력 z\\\*는 단어를 처음 숫자로 변환했을 때와 동일한 요소 수를 가집니다\. 새로운 모델은 이 결과를 전체 인코딩 과정에 반복적으로 전달합니다\. 예를 들어 96번 반복하는 여러 인코딩 계층으로 생각하세요\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_22.webp)

이 모든 훈련 후\, 인코딩에서 최종 출력이 나옵니다\. 이를 vf라고 부르겠습니다\. 한 단어의 vf 계산은 여전히 다른 단어의 vf 계산과 독립적이라는 점에 유의하세요\. 이 병렬화 덕분에 많은 시간을 절약할 수 있었습니다\. 예를 들어\, 1\_vf 먼저 알지 못한 상태에서 7\_vf 계산할 수 있습니다\.

이제 이 최종 출력을 사용해 단어를 예측하기 시작할 수 있습니다\. 이 모든 최종 출력을 또 다른 \'디코딩 함수\'에 통과시켜 첫 단어를 얻습니다 [^14]\. 디코딩 기능과 인코딩 함수 사이에는 차이가 있지만\, 단계가 충분히 비슷해서 다시 설명하지는 않겠습니다\. **디코딩 함수는 모든 인코딩 단계를 수행하는 동시에 \"인코딩 함수\" 과정의 출력도 함께 가져가는 것으로 생각할 수 있습니다 [^15]\.**

여기에 \"디코딩 함수\"를 위한 큰 블록 하나를 넣었지만\, 새 모델은 인코딩 과정과 같은 횟수로 이 과정을 반복합니다\. 예를 들어\, 인코딩 레이어가 96개였다면 디코딩 레이어가 96개가 될 것입니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_23.webp)

이제 첫 번째 예측 단어를 얻었으니\, 그 단어와 최종 출력을 함께 사용해 다시 디코딩 함수를 통과시킵니다\. 눈을 가늘게 뜨고 보면\, 이 과정은 이전 모델 섹션에서 본 과정과 매우 비슷해 보입니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_24.webp)

그리고 모든 단어에 대해 이 과정을 반복하면 마지막 문구가 나옵니다\. 드디어\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_25.webp)

좋아\, 그럼 그게 _일반 사항_ 트랜스포머 모델\. 이제 그 모든 것을 제쳐두고 GPT\-3 버전을 처음부터 다시 시작해 봅시다\.

농담이야\, 놀라지 마 [^16]\.

GPT\-3는 인코딩과 디코딩 과정을 결합하여 [Transformer Decoder](https://arxiv.org/pdf/1801.10198.pdf 'TD')\. 입력과 예상 출력 시퀀스를 하나의 \"문장\"으로 합친 후 디코딩 계층을 통과시킵니다\. GPT\-3에는 96개의 디코딩 레이어가 있습니다 [^17]\. 이 모델은 다음 입력과 다음 출력을 예측하는 데 사용됩니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_26.webp)

이 질문이 좀 애매하게 들린다면\, 그건 사실 그렇기 때문입니다\. 온라인에서 어떻게 단계를 결합하는지에 대한 설명을 찾을 수 없지만\, [original paper,](https://arxiv.org/pdf/1801.10198.pdf 'paper') [this post](http://jalammar.github.io/illustrated-gpt2/ 'Jay')\, 그리고 이 무작위 [github comment as confused as I am](https://github.com/openai/gpt-2/issues/157 'github')\. 한 단어씩 예측하는 방식은 텍스트를 순차적으로 처리하는 재귀적 문제로 다시 돌아온 것 같아요\. 아마도 충분한 컴퓨팅 파워를 투입하는 것이 해결책이었을지도 모르겠네요\. 더 아시는 분이 있으면 이메일로 알려주세요\.

온라인에 글을 올리는 많은 사람들은 GPT\-3가 전통적인 트랜스포머 또는 트랜스포머 인코더\-디코더 모델을 사용한다고 말합니다\. 그들은 GPT\-3에서 일어나는 일을 설명하기 위해 전통적인 트랜스포머 모델을 설명합니다\. **네\, 그 모든 사람들이 틀렸어요\,** 저도 이 글을 올리기 직전에 정정받기 전까지는 그랬어요\.

아직 제 말을 듣고 계시다면\, 이 알고리즘의 두 가지 더 중요한 특징을 언급할 가치가 있습니다\.

첫째\, 예전에 단어를 a\, b\, c의 세 가지 특징으로 나눴던 때를 기억하시나요\? 새 모델은 실제로 처음부터 96번이나 그렇게 했습니다 [^18]\. 매번 다른 함수를 사용해 96개의 서로 다른 트리플렛이 생성됩니다\. 이들은 독립적이기 때문에 모든 입력 단어에 대해 인코딩\/디코딩 계층을 동시에 처리합니다\. 이 결과들은 인코딩\/디코딩 함수 z에서 출력을 받을 때 합쳐집니다\. 이를 \'다중 주의 헤드\'라고 합니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_27.webp)

둘째로\, 이 섹션에서 함수를 언급할 때마다 어떤 숫자에 대한 가중치나 매개변수로 생각할 수 있습니다\. **모든 무게를 합치면 새 모델은 1\,750억 개의 무게를 가지고 있습니다\.** 아니요\, 오타가 아닙니다\. 사람들이 GPT\-3가 사용하는 매개변수 수와 이전 모델보다 훨씬 크다는 점을 말할 때\, 바로 이 부분을 말하는 것입니다\.

예를 들어\, 각 단어가 1000개의 숫자 목록으로 표현된다면\, 위에서 설명한 전체 과정에서 한 함수를 통과하는 데도 그만큼 많은 매개변수가 필요합니다\. 96개의 레이어와 각 레이어 내에 96개의 대안이 있는 프로세스가 어떻게 엄청난 수의 매개변수가 필요한지 쉽게 알 수 있습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_28.webp)

긴 옆길이었지만\, 이제 GPT\-3가 무엇을 하는지 더 직관적으로 이해하게 되었습니다\. GPT\-3는 단어 입력을 받아 행렬 수학을 통해 여러 번 변환을 반복하고\, 이를 이용해 단어를 예측하거나 번역하는 것입니다\.

만약 너무 복잡하다면\, 더 단순한 예를 생각해 보세요\. 예를 들어 [choose your own adventure game](https://en.wikipedia.org/wiki/Choose_Your_Own_Adventure 'choose your own')\, 당신의 선택이 이야기의 결말을 결정하는 곳입니다\. **GPT\-3도 마찬가지지만\, 수십억 가지 옵션이 겹겹이 쌓여 있습니다\.** 문구가 조금이라도 달라져도 선택이 다른 방향으로 나아가게 됩니다\. 그리고 가능한 경로는 사실상 무한합니다\.

이 모든 과정을 거쳐 나온 결과\, 참고용으로 원래 논문에 나온 트랜스포머 아키텍처가 아래에 있습니다\. 이 구조의 일부가 우리가 방금 생각한 단순화된 다이어그램과 어떻게 일치하는지 볼 수 있으며\, 단순화를 위해 몇 칸은 제외했습니다 [^19]\. GPT\-3는 이 다이어그램의 오른쪽만 사용합니다\. 더 알고 싶으시다면\, 이 글 하단에 추가 참고문헌이 있습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_29.webp)

## 4\. GPT\-3를 어떻게 감지할 수 있을까요\?

우리는 GPT\-3가 우수하다는 것을 알고 있으며\, 일부 출력 샘플은 인간의 글과 구분하기 어렵다는 것을 알고 있습니다\. 그렇다면 자연스러운 질문은\, 텍스트가 기계에 의해 작성되었는지 감지할 수 있는 다른 방법이 있는지 묻는 것입니다\.

알고 보니 놀랍도록 간단한 방법들이 있었습니다\.

우선\, [because of the hyperparameters used in GPT-3,](https://medium.com/analytics-vidhya/understanding-the-gpt-2-source-code-part-1-4481328ee10b 'temp') **생성되는 단어의 빈도는 정상적인 인간이 기대하는 분포를 따르지 않습니다\.** 아래 스크린샷에서 Gwern은 이로 인해 일반적인 단어가 예상보다 더 많이 나타나고\, 비흔한 단어는 전혀 나타나지 않는다고 설명합니다\. 온도는 무작위성을 제어하고\, top\-k 하이퍼파라미터는 선택한 단어들의 빈도 컷오프 지점을 결정합니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_30.webp)

Zipf의 법칙을 모르는 분들을 위해 말씀드리자면\, 저는 이전에 다룬 적이 있습니다 [here](/writing/zipf 'Zipf') 외계인을 찾는 것에 대해 이야기할 때\(네\, 외계인입니다\. 무료 구독자 분들은 이메일로 보내주시면 전달하겠습니다\)\. 본질적으로\, 많은 텍스트 샘플에서 어떤 단어의 빈도는 출현 빈도에 따라 순위와 반비례한다는 뜻입니다\. 예를 들어\, 가장 흔한 단어는 두 번째로 자주 나타나는 단어보다 \~2배 더 자주 나타납니다\.

저는 뉴스레터에서 Zipf의 법칙을 그려본 적이 있는데\, 위쪽 그래프처럼 보입니다\. 만약 GPT\-3가 제 글을 쓴다면\, 아래쪽 그래프 같은 것\(물론 단어가 더 많아진 경우\, 예시는 설명용일 뿐입니다\)를 기대할 수 있습니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_31.webp)

둘째로\, 다른 모델을 사용해 텍스트를 확인할 수 있습니다\. Analytics Vidhya가 예전에 글을 올린 적이 있습니다 [how to detect computer generated articles.](https://www.analyticsvidhya.com/blog/2019/12/detect-fight-neural-fake-news-nlp/ 'Vidhya') 그들은 GPT\-2 탐지기 모델과 같은 몇 가지 도구를 제공합니다\. [Grover,](https://grover.allenai.org/detect 'Grover') 샘플 텍스트를 받아 기계가 생성한 것이라고 믿는지 알려줄 수 있습니다 [^20]\. 이 도구들은 GPT\-3 이전에 출시되었고 아직 보정되지 않았지만 여전히 잘 작동합니다\. 이 도구들이 작동하는 이유는 **모델들은 다른 모델들이 텍스트를 생성하는 데 사용하는 특이점에 익숙합니다\.**

여기 데모가 있습니다\. 부록에 있는 첫 번째 샘플을 확인해 보았습니다\. [GPT 3 paper (page 49)](https://arxiv.org/pdf/2005.14165.pdf 'GPT')그리고 기계가 생성한 시를 그곳에 복사했습니다\. 그걸 그로버 사이트에 연결하면\, 그로버는 그것이 기계가 생성한 것이라고 생각한다는 것을 알 수 있습니다\. 아마 제가 제대로 추측하지 못했을 겁니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_32.webp)

물론 이 두 방법 모두 완벽하지는 않습니다\. 충분한 표본 수가 없으면 빈도 분석이나 검사 모델로 검증하기가 어렵습니다\. 누군가가 단 한 번만 법칙적인 텍스트를 보내면 확실히 알 수 있는 데이터가 충분하지 않을 수도 있습니다\. 봇인지 묻는 답변이 얼마나 모욕적일지 궁금합니다\.\.\.

그로버는 또한 잘못된 양성 결과를 받는데\, 예를 들어 앨런 긴즈버그의 시가 잘못 주장되는 경우도 있습니다 [Howl](https://www.poetryfoundation.org/poems/49303/howl 'Howl') 기계가 작성한 것입니다 [^21]\. 또한 GPT\-3가 생성한 텍스트가 인간이 만든 것이라고 생각하는 거짓 음성 판정도 받습니다\. [You can try playing around with it and see what works for you](https://grover.allenai.org/detect 'Grover')

그렇긴 해도\, 이런 방법이 여전히 존재한다는 점에서 가짜 기계 생성 텍스트의 위험성에 대한 두려움은 줄어들었습니다\. 위 두 도구 모두 모델의 구조적 특징에 의존하기 때문에\, 모델이 조정할 수 있는 하이퍼파라미터가 있는 한 생성된 텍스트는 식별 가능할 가능성이 높아 보입니다\.

최악의 경우\, 모두가 페이지를 스캔하고 텍스트가 가짜라고 판단되면 경고하는 브라우저 확장 프로그램을 설치해야 할 것입니다\. 아마도 오늘날의 광고 차단기 같은 게 어떨까요\? 하지만 그때는 우리가 신경 써야 할까요\?

## 5\. 살아 있음

현재 GPT\-3 API 접근은 [subject to a waitlist,](https://openai.com/blog/openai-api/ 'waitlist') OpenAI는 사람들이 모델을 오용하지 않도록 조심하고 싶어 합니다\. 하지만 이 개념에 관심이 있다면\, 몇 가지 우회 방법이 있습니다\.

- OpenAI는 GPT\-2\(GPT\-3의 구버전\)용 코드를 공개했습니다 [here](https://openai.com/blog/better-language-models/ '2')\, 설정 방법을 알면 직접 실행할 수 있습니다\.
- Hugging Face 팀은 GPT\-2와 다른 트랜스포머 기반 모델들을 위한 더 사용자 친화적인 인터페이스를 만들었습니다\. 확인해 보실 수 있습니다 [here](https://transformer.huggingface.co/ 'transformer')
- [Aaron Tay](https://musingsaboutlibrarianship.blogspot.com 'Aaron') 프리미엄 \"드래곤\" 버전을 사용해본 글도 게시했습니다\. [AI Dungeon](https://play.aidungeon.io/ 'AI')\, GPT를 활용한 텍스트 생성기 게임\, [supposedly gets you access to GPT-3 within the game](https://musingsaboutlibrarianship.blogspot.com/2020/07/playing-with-gpt-3-via-ai-dungeon.html 'AI')

더 많은 사람들이 GPT\-3와 유사한 기능에 접근할 수 있고\, 일반 언어 모델도 계속 발전할 것으로 기대해야 합니다\. 모델들이 [Turing Test](https://plato.stanford.edu/entries/turing-test/ 'Turing') 그러나 [Kevn Lacker shows.](http://lacker.io/ai/2020/07/06/giving-gpt-3-a-turing-test.html 'Lacker') 하지만 우리는 매일 더 가까워지고 있는 것 같습니다\. 인간만으로는 무언가가 기계로 만들어졌는지 구분하기가 점점 더 어려워질 것입니다\.

![post](../../../blog/2020_07_22_dr_gpt/gpt_33.webp)

GPT의 최종 활용 사례는 우리가 생각하는 것보다 훨씬 더 창의적일 가능성이 큽니다\. [Tyler Cowen gives some thoughts here](https://marginalrevolution.com/marginalrevolution/2020/07/the-case-for-gpt-3.html 'Cowen') 의학적 진단과 치료법에 관해서\, 우리는 아직 GPT나 유사한 모델로 대규모로 무엇을 할 수 있을지 이제 막 이해하기 시작한 단계일 것입니다\. 데모는 계속해서 우리를 놀라게 할 것입니다\. 우리는 지능이 무엇인지 궁금해할 것입니다\.

동시에\, 프로그래머들은 이것이 은행과 컨설팅 일자리를 빼앗을 것이라는 트윗\, VC들로부터 프로그래밍 일자리를 빼앗는다는 말\, 그리고 다른 산업에 떠넘기려는 다른 집단들로부터 트윗을 올리기도 했습니다\. 저는 현재 이런 주장들이 설득력 있다고 생각하지 않지만\, 설득될 열려 있습니다\. 더 효율적인 도구를 얻는 것이 일자리를 치닫는 큰 원인이었다면\, 엑셀은 몇 년 전에 사무직의 절반을 없애버렸을 것입니다\.

대신 일어날 수 있는 일은 다음과 같습니다 **경력에서 전문화는 더 큰 보상을 줍니다\.** GPT는 작성 및 편집 전에 확인할 수 있는 템플릿을 제공합니다\. 지루한 보일러플레이트 문서와 슬라이드는 큰 노력 없이 생성할 수 있고\, 그 후 전문 지식을 활용해 프로젝트에 맞게 맞춤화할 수 있습니다\. 주니어 은행가와 컨설턴트들도 다른 회사에서 로고만 바꿔 같은 덱을 다시 만드는 대신 생산적인 일을 할 수 있게 될 수도 있습니다 [^22]\.

이렇게 생각해 보세요\: 아이가 자라면서 숙제를 고치는 데 더 많은 전문 지식이 필요한가요\, 아니면 덜 필요한가요\? 처음에는 철자 오류를 수정하는 것부터 시작해서\, 결국 미적분을 알아야 하는 상황이 됩니다\.

또한\, 사람들은 모든 입출력 데이터가 깨끗하고 쉽게 사용할 수 있을 것이라고 착각하는 것 같습니다\. as [Vicki Boykis](https://vicki.substack.com/p/were-still-in-the-steam-powered-days 'Vicki') 여러 번 지적했듯이\, 보통 대규모 데이터셋을 다뤄본 적 없는 사람의 관점입니다\. 만약 자신만을 위한 맞춤형 GPT 모델이 있다면\, 대부분의 시간을 데이터 정리에 쓸 것입니다\. 만약 없다면\, 대부분의 시간을 출력 정리에 쓰게 될 것입니다\.

어쨌든 해야 할 일이 남아 있어\. 지금은 안전해\.

저는 논란이 될 만한 제안을 하고 싶습니다 **GPT\-3는 컴퓨터보다는 인간으로서 우리 자신에 대해 더 많이 알려줍니다\.** 이것은 우리가 산문\, 시\, 음악 등 입력의 변동에 대해 놀라울 정도로 넓은 내성을 가지고 있음을 보여줍니다\. 컴퓨터가 기계가 생성한 것으로 표시하는 텍스트는 본능적인 테스트를 통과할 수 있어\, 우리가 두 사람 중 더 관대하다는 것을 의미합니다\.

아마도 모호함에 대한 그 감사함\, 이상함을 환영하는 태도가 우리의 시냅스 신호를 비트와 바이트와 구분하는 것일지도 모릅니다\.

아니면 아마도 그 의미를 다시 생각해봐야 할지도 모른다\; 의 [being alive](https://www.youtube.com/watch?v=eBBPKedba5o 'alive')\.

_이 글은 GPT\-3가 작성한 것이 아닙니다\. 감사합니다 [Gwern](https://twitter.com/gwern?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor 'Gwern') 그리고 [Jay Alammar](https://twitter.com/JayAlammar?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eserp%7Ctwgr%5Eauthor 'Jay') 트위터에서 GPT에 관한 질문에 답변하기 위해 [Nathan](https://mobile.twitter.com/nbashaw 'Nathan') 수정을 위해서요\._

## 기타 흥미로운 해설

1. [Gwern showcases creative writing by OpenAI’s GPT-3 model, demonstrating poetry, dialogue, puns, literary parodies, and storytelling](https://www.gwern.net/GPT-3 'Gwern')
2. [Max Woolf on Tempering Expectations for GPT-3 and OpenAI’s API](https://minimaxir.com/2020/07/gpt3-expectations/ 'Max')
3. [Kevin Lacker on Giving GPT-3 a Turing Test](http://lacker.io/ai/2020/07/06/giving-gpt-3-a-turing-test.html 'Lacker')
4. [Michael Nielsen twitter thread](https://twitter.com/michael_nielsen/status/1284937254666768384?s=20 'Nielsen')
5. [Manuel Araoz on how OpenAI's GPT-3 may be the biggest thing since bitcoin](https://maraoz.com/2020/07/18/openai-gpt3/ 'Maraoz')
6. [Exxact with other GPT-3 applications, such as summaries, code, and spreadsheets](https://blog.exxactcorp.com/what-can-you-do-with-the-openai-gpt-3-language-model/ 'GPT')

## 더 자세한 설명

1. [Yannic's youtube video explaining the GPT 3 paper](https://www.youtube.com/watch?v=SY5PvZrJhLE&feature=youtu.be 'Yannic')\. 게다가 GPT 3 논문 자체도 ["Language Models are Few-Shot Learners"](https://arxiv.org/pdf/2005.14165.pdf 'GPT3')\. [Yannic's youtube video explaining the GPT 2 paper, which GPT 3 bases itself on.](https://www.youtube.com/watch?v=u1_qMdb0kYU 'Yannic') 게다가 GPT 2 논문 자체도 ["Language Models are Unsupervised Multitask Learners"](https://d4mucfpksywv.cloudfront.net/better-language-models/language_models_are_unsupervised_multitask_learners.pdf 'GPT2')
2. [Joseph Palermo](https://twitter.com/j_w_palermo 'Joseph') 데사 [speaking at Insight on Transformers.](https://www.youtube.com/watch?v=S0KakHcj_rs 'youtube') 저도 발표 내내 당황한 청중들이 질문을 던져서 이 점이 도움이 되었습니다\.
3. [Andrew Ng on attention models](https://www.youtube.com/watch?v=SysgYptB198 'Ng')
4. [How do Transformers Work in NLP? A Guide to the Latest State-of-the-Art Models](https://www.analyticsvidhya.com/blog/2019/06/understanding-transformers-nlp-state-of-the-art-models/ 'Vidhya')
5. [Jay Alammar on the illustrated transformer](http://jalammar.github.io/illustrated-transformer/ 'transformer')

[^1]: 농담이야\, 농담이야\. 가끔 탁구도 해\.

[^2]: 결과를 직접 비교하는 데에는 문제가 있다고 합니다\. 세부 사항은 잘 모르지만\, 프라임드 데이터의 표준화와 관련이 있는 것 같습니다\. 논문에는 \"하지만 우리의 원샷 또는 소수 기반 설정은 이전의 무감독 연구와 엄밀히 비교할 수 없습니다\. 왜냐하면 1개 또는 64개의 작은 쌍 예제를 사용하기 때문입니다\. 이는 최대 한두 페이지의 컨텍스트 내 훈련 데이터에 해당합니다\.\"

[^3]: 맥락 \- \"LAMBADA 데이터셋은 텍스트 내 장거리 의존성 모델링을 테스트하며\, 문맥 한 단락을 읽어야 하는 문장의 마지막 단어를 예측하도록 요청받습니다\"\; 잡학 \- \"TriviaQA에서 우리는 제로 샷 설정에서 64\.3\%\, 원샷 설정에서 68\.0\%\, 소수 샷 설정에서 71\.2\%를 달성했습니다\"\; 대명사 \- \"Winograd 스키마 챌린지는 NLP에서 고전적인 과제로\, 대명사가 문법적으로는 모호하지만 의미론적으로는 혼동성이 없을 때 어떤 단어를 가리키는지 결정하는 것을 포함합니다\.\"

[^4]: 링크 중 하나는 슬레이트 스타 코덱스가 그의 블로그를 삭제하면서 끊어졌지만\; GPT\-2의 시 샘플 일부가 보존되어 있습니다 [here](https://antinegationism.tumblr.com/post/182901133106/an-eternal-howl 'Moloch')\, 그리고 [Gwen's site](https://www.gwern.net/GPT-2 'Gwern') 더 많은 것이 있습니다\.

[^5]: [Banko and Brill showed way back in 2001 that more data can make a bad algorithm perform better than a good one.](https://dl.acm.org/doi/10.3115/1073012.1073017 'Banko')

[^6]: 8쪽과 9쪽 [GPT-3 paper](https://arxiv.org/pdf/2005.14165.pdf 'paper') 그들이 CommonCrawl\, WebText\, Books\, Wikipedia 데이터셋을 어떻게 훈련에 사용했는지 논의합니다\.

[^7]: 그가 말하는 것은 1\,600억 파라미터 모델을 말하는 것 같습니다 [here](https://dl.acm.org/doi/abs/10.5555/3045118.3045359 'model')

[^8]: 여기서 단어를 이진 표현으로 변환하는 게 아니에요\, 만약 그렇게 생각하셨다면요\. 대신\, [using a word embedding such as word2vec](https://towardsdatascience.com/learn-how-recurrent-neural-networks-work-84e975feaaf7 'word2') 앞으로 알고리즘에 사용할 수 있는 단어의 다양한 수치 표현을 생성하는 것입니다\. 물론 결국 모든 것이 이진수로 변환되지만\, 이 과정의 현재 단계에서는 그렇지 않습니다\.

[^9]: 네\, 첫 번째 함수가 실제로 [bias unit](https://ayearofai.com/rohan-5-what-are-bias-units-828d942b4f52 'bias')그래서 또 다른 입력도 필요합니다\. 하지만 그게 본문 설명을 너무 복잡하게 만들어서 생략하겠습니다\.

[^10]: 이 점은 다음에서 확인할 수 있습니다\. [GPT-3 paper page 8,](https://arxiv.org/pdf/2005.14165.pdf 'paper') 여기서 \"우리는 GPT\-2와 동일한 모델과 아키텍처를 사용하며\, 수정된 초기화\, 사전 정규화\, 가역 토큰화를 포함하지만\, 트랜스포머 계층에서 교차하는 조밀하고 국소 밴드가 있는 희소 주의 패턴을 사용한다는 점이 예외입니다\. 이는 희소 트랜스포머와 유사합니다\.\"

[^11]: 이 부분은 변압기 모델에서 다음과 같은 부분입니다\. [they embed the word, and then calculate smaller query, key, and value vectors by mapping the embedded word vector on to a pre-trained weighted matrix.](https://youtu.be/S0KakHcj_rs?t=1083 'youtube') 이렇게 많은 읽기와 영상을 보고 나서도 쿼리\, 키\, 값이 무엇을 의미하는지 아직 완전히 이해하지 못했습니다\. 더 자세한 내용을 확인하려면 추가 자료를 확인해 보시길 권합니다\. 현재 제 직감으로는\, 단어를 분해하여 단어의 무게\, 다른 단어와 비교했을 때의 무게\, 그리고 조회용 일치를 전달하는 과정이라고 생각합니다\.

[^12]: 첫 번째 단계는 쿼리\, 키\, 값 벡터를 얻는 것이었습니다\. 그 다음 쿼리 벡터와 다른 단어들의 키 벡터의 점적을 취하여 다른 단어에 얼마나 집중해야 하는지 판단합니다\. 그 다음 키 벡터들의 차원의 제곱근으로 나눕니다\. 그다음 다음을 수행합니다\. [softmax function](https://towardsdatascience.com/softmax-function-simplified-714068bf8156 'soft')\. 그 다음 값 벡터에 결과를 곱합니다\. 마지막으로 이 모든 벡터의 합을 가져서 다음 과정에서 사용할 마지막 벡터를 만듭니다\.

[^13]: 이들은 사인과 코사인 함수를 사용합니다\. [page 6 of the original paper](https://arxiv.org/pdf/1706.03762.pdf 'sin')\. 모델이 다양한 구간 길이로 확장될 수 있도록 주기적인 무언가가 필요했습니다\.

[^14]: 기술적으로는 또 다른 선형 계층\, 신경망과 소프트맥스 계층이 있습니다 [after the decoding layers](http://jalammar.github.io/illustrated-transformer/ 'linear')\, 하지만 단순화를 위해 제외했습니다\.

[^15]: 디코더에서는 출력이 전체 출력 시퀀스가 아니라 앞에 오는 출력 단어에만 주의를 기울일 수 있습니다\. 이를 \'마스킹\'이라고 합니다

[^16]: 하지만 GPT가 표준 트랜스포머 모델을 사용하지 않는다는 걸 깨달았을 때 느꼈던 느낌이 딱 그랬어요\. 정말 그 모든 다이어그램을 다시 만들어야 할 거라고 생각했었죠\.

[^17]: 페르 [page 8 of the paper (n layers)](https://arxiv.org/pdf/2005.14165.pdf 'gpt')

[^18]: 우연히도 위의 반복 층 수와 같지만\, 꼭 그럴 필요는 없습니다\. 논문 8페이지도 참고하세요\.

[^19]:
    음\, 이거 무섭게 보이고\, 무슨 일이 일어나는지 이해하기까지 영상을 읽고 보는 데 오랜 시간이 걸렸어요\. 우리가 지나간 모델에 매핑하기 위해\, 왼쪽부터 시작해봅시다\. 입력이 있고\, 그것들이 임베드됩니다\. 지금까지는 처음에 단어가 숫자로 변환된 방식과 같습니다\. 그다음은 \"위치 인코딩\"인데\, 제가 건너뛰었던 위치 번호를 추가하는 것입니다\. 그리고 \"multi\-head attention\"로 시작하는 박스를 입력합니다 \- 우리는 이 과정을 모두 거쳤습니다\. \"add \& norm\" 박스가 있는데\, [layer normalisation](https://mlexplained.com/2018/11/30/an-overview-of-normalization-methods-in-deep-learning/ 'norm') 이것을 숫자를 스케일링하는 것으로 생각할 수 있습니다\. 그 다음 이 박스는 z\\\*에 도달하기 위해 언급된 신경망인 \"피드 포워드\" 박스로 갑니다\. 그리고 다시 정규화합니다\. 이 큰 박스에는 Nx가 바깥쪽에 있어\, 원하는 대로 N번 반복한다는 뜻입니다\. 오른쪽에는 출력이 보이고\, 임베딩과 인코딩을 한 후 큰 박스에 들어갑니다\. 그 안의 단계는 왼쪽과 비슷하지만\, \"마스크된\" 다중 헤드 주의를 수행하고 왼쪽 박스에서 출력도 받습니다\. 원하는 대로 N번 반복합니다\. 이 과정은 선형 계층과 소프트맥스 함수를 거쳐 어떤 단어를 출력할지 출력 확률을 얻습니다\. 휴\. 다시 말하지만\, 이것은 일반 트랜스포머 모델에 대한 것입니다\. GPT\-3는 오른쪽만 사용합니다\.
    [^20]: 이 게시물에는 통계 분석 도구로도 링크되어 있습니다\. [GLTR,](https://gltr.io/ 'GLTR') 이는 앞서 언급한 Zipf의 법칙 분석과 유사한 일을 하는 것입니다\.
    [^21]: 솔직히 말해서\, 확실히 그 역할에 맞는 모습입니다\.
    [^22]: 농담이에요\, 그래프 색상도 바꿔치는 거 알아요\.
