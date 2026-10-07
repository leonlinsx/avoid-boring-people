---
title: "개인 CRM에 이 글을 읽으라는 알림을 설정하세요"
description: "페어 트레이드, 개인 CRM, 그리고 자기 인식"
pubDate: 2019-08-31
category: System Design
tags: ['software', 'investing']
heroImage: '../../../blog/2019_08_31_crm/c_4.webp'
locale: 'ko'
sourceSlug: 'crm'
sourceHash: 'e5a2ed68b6f324d3e2f388faad00d7837d2e58315703ea2d2981edde507a01ca'
---

## 주요 내용

1. 버블 내에서 페어 트레이드를 찾는 것이 숏이나 모멘텀을 타는 것보다 나을 수 있습니다
2. 개인 CRM이란 무엇이며 왜 사람들이 이에 대해 이야기하는 걸까요\?
3. 우리는 우리 자신을 잘 알지 못합니다\; 자기 인식을 높이는 방법

### 버블과 러시아 스파이

올해 거품 관련 소식이 많아진 가운데\, 저는 이를 강조하고 싶었습니다 [Byrne Hobart's post about them.](https://medium.com/@byrnehobart/so-youve-spotted-a-bubble-3f2fa5cf49a9 'Bubble') [^1] 자산의 현재 가격이 거품이라고 생각한다면 어떻게 해야 할까요\? 번은 아래에서 세 가지 생각 체계를 제시합니다\. 언제나 그렇듯이\, 이 모든 것은 재정 조언이 아닙니다\.

> \\\[우선\:\\\] 용감하고\, 어리석으며\, 지적으로 일관된 접근법\. 그냥 숏을 할 수도 있습니다\. \\\[\.\.\.\\\] 하지만 쉽지 않습니다\. 보통 버블 자산은 비슷한 자산보다 더 높은 수익을 내도록 가격이 책정되지만\, 위험을 충분히 보상할 만큼 충분히 높지 않기 때문입니다\. \\\[\.\.\.\\\] 버블은 본질적으로 불안정함에도 불구하고 부분적으로 스스로 지속되기 때문에 오랜 기간 지속되는 경향이 있습니다\.

숏팅 [^2] 섹시한 이유는 당신이 반대 의견을 내고 이론상 무제한 위험을 감수하며 평범한 멍청한 투자자보다 지적 우월함을 증명하기 때문입니다\. [There's even an oscar nominated movie about shorting the 2008 housing crisis](<https://en.wikipedia.org/wiki/The_Big_Short_(film)> 'movie')\. 공매도의 문제는 타이밍이 핵심이라는 점입니다\. 맞더라도 일찍 성공할 수 있습니다\. 투자자들에게 수십억 달러를 잃은 악명 높은 공매도들이 많습니다\. [Ackman and Herbalife](https://www.cnbc.com/2018/04/05/how-bill-ackmans-hedge-fund-empire-crumbled-in-less-than-three-years.html 'Ackman')\, [Einhorn and Netflix](https://www.forbes.com/sites/antoinegara/2019/03/05/after-horrendous-investing-run-david-einhorn-exits-billionaire-club/#3a140043498c 'Einhorn')\, 또는 [whoever was short squeezed by Porsche and Volkswagen in 2008.](https://www.reuters.com/article/us-volkswagen/short-sellers-make-vw-the-worlds-priciest-firm-idUSTRE49R3I920081028 'Porsche') 제가 Ackman과 Einhorn이 이 회사들에 대해 틀렸다고 말하는 것은 아닙니다\. 그들이 옳을 수도 있지만\, 그 사이에 너무 많은 돈을 잃었기 때문에 그 문제는 무의미합니다\.

Overstock\.com 를 또 다른 예로 들어봅시다\. 그들의 이전 [CEO resigned so he could let everyone know he'd dated a Russian spy,](https://www.forbes.com/sites/laurendebter/2019/08/22/the-exclusive-inside-story-of-the-fall-of-overstocks-mad-king-patrick-byrne/#176918ea53a5 'Forbes') [^3] 그는 2017년에 회사를 구하기 위해 블록체인으로 전환하려 했습니다\. 만약 Overstock도 이 부분에서 실패할 것이라고 생각해 2017년 8월에 20달러에 Overstock을 매도했다고 가정해 봅시다\:

![post](../../../blog/2019_08_31_crm/c_1.webp)

주가가 서서히 오르면서\, 당신은 이 상태가 오래가지 못할 것이라는 확신에 두 배로 가격을 내립니다\. 어쩐지 오래가고\, 2017년 11월에 60달러의 주가를 마주하게 됩니다\:

![post](../../../blog/2019_08_31_crm/c_2.webp)

앗\. 서류상 손실뿐만 아니라\, 노출 금액이 처음 보유하고 편안했던 것의 배수가 됩니다\. 지금 포지션을 청산하면 현재 60달러에서 처음 벌었던 20달러를 뺀 40달러를 잃게 됩니다\. 이제 원한이 생기고 이 주식을 완전히 공매도하거나 파산할 결심을 하고 있어서 다음 해까지 버지합니다\:

![post](../../../blog/2019_08_31_crm/c_3.webp)

중개인이 휴가에서 돌아왔는데 당신에게 발급하는 것을 깜빡했다는 것을 깨닫습니다 [margin call](https://www.investopedia.com/ask/answers/05/shortmarginrequirements.asp 'margin') 그동안 이렇게 공황 상태에서 벌어지고 있습니다\. 주식을 공매도할 때는 보통 주식 가치의 약 130\%를 담보로 필요로 하는 백업 자금입니다 [^4]\. 주식이 20달러였을 때는 26달러를 따로 떼어놓는 것이 문제가 되지 않았습니다\. 하지만 지금은 104달러를 따로 떼어놓아야 하고\, 중개인은 78달러의 차액\(104달러에서 26달러을 뺀 금액\)을 보완하길 원합니다\. 초기에 가지고 있던 돈에 따라\, 이 추가 78달러\(초기 노출의 3배\!\)는 쉽게 당신을 파산시킬 수 있습니다\. 당신은 포지션을 청산하고 Go Fund Me를 설정하여 차액을 메워야 합니다\.

그리고 물론 이런 일이 벌어집니다\:

![post](../../../blog/2019_08_31_crm/c_4.webp)

여기서 핵심은 당신이 옳았다는 점입니다 \- Overstock이 시도한 블록체인 피벗은 효과가 없었습니다\. 하지만 타이밍이 잘못되어 돈과 평판을 잃었습니다\. 주식을 공매도하는 것이 \'명백한\' 일일 때조차도\, 예를 들어 [bad quality companies changing their name to get a price bump](https://www.winton.com/longer-view/the-history-of-company-names 'names')\, 그 [time period](https://www.sciencedirect.com/science/article/pii/S0165176519301703 'time') 논문이 진행되기 위해 필요한 조건이 미리 파산할 수도 있습니다\.

흥미롭게도\, 유명한 공매도 투자자들 [Robert Wilson and Jim Chanos have this to say about shorting:](https://blogs.cfainstitute.org/investor/2016/12/22/lessons-from-a-legendary-short-seller/ 'short')

> \"처음부터 끝까지 \\\[\.\.\.\\\] 내 반바지도 손익분기점을 냈을 거야\.\"

> \"좋은 숏 포트폴리오는 더 긴 자산을 유지할 수 있게 해줍니다\.\.\. 그게 바로 우리가 하는 일의 핵심입니다\.\"

명확히 하자면\, 저는 공매도를 피하라는 뜻이 아니고\, 공매도가 경제에 나쁘다는 뜻도 아닙니다\. [There's research](https://marginalrevolution.com/marginalrevolution/2019/08/short-selling-reduces-crashes.html 'short MR') 좋은 작품일 수도 있고\, 많은 사람들이 숏 영화로 돈을 벌었어요\. 제가 말하는 건 제대로 만드는 게 어렵다는 거예요\.

대안이 뭐가 있을까요\?

> \\\[둘째\:\\\] 용병적이지만 수익성 있는 접근법\. \\\[\.\.\.\\\] \"우리는 거품의 일부가 된 것을 꽤 기쁘게 생각했지만\, 원한다면 빠르게 시장에서 빠져나갈 수 있도록 매우 유동적인 포지션에서 진행하는 것이 좋았습니다\.\"

이 버전에서는 가능한 한 오래 파도를 타다가 가능한 한 늦게 내리려고 합니다 [^5]\. 이것이 대부분의 전문 투자자들이 실제로 하는 일인 것 같아요\, 장기 보유자라고 끊임없이 선언하는 것과 달리요\. 효과가 있다면 효과가 있고\, 이 전략을 사용한 성공한 사람들이 많았습니다\.

> 한 번에 한 번에 몇 개를 선택해 모두 무너지지 않기를 바라며 다 선택하려 합니다\. 이 분산 투자는 레버리지를 약간 올릴 수 있게 해주어 수익을 끌어올립니다\. \\\[\.\.\.\\\] 측정된 위험이 증가하면 레버리지를 줄이려 합니다\. 하지만 레버리지를 낮추려면 여러 거래를 한꺼번에 풀어야 합니다 \\\[\.\.\.\\\] 전략을 따르던 트레이더들의 수익을 해치고 상관관계를 높여 더 많이 팔게 만듭니다\.

단점은 몇몇 베팅에 너무 늦게 베팅한 뒤\, 회사가 한 번에 얼마나 잃을 수 있는지에 대한 위험 기준 때문에 포지션을 풀어야 할 때입니다\. 일종의 \'빠르게 살고\, 젊게 죽고\, 다른 이름의 펀드를 시작하라\'는 전략입니다\.

> \\\[마지막으로\:\\\] 너바나\: 긍정적 캐리와 긍정적 스큐\. 저는 겸손하게 루이스가 틀렸다는 의견에 제 의견을 제출하겠습니다\: 빅 쇼트는 사실 훌륭한 거래가 아니었습니다\. 그가 정말 정신이 있었다면 빅 페어 트레이드를 썼을 겁니다\. \\\[\.\.\.\\\]

번은 주택 위기를 예로 들었다\. 주택 위기의 한 요인은 대출이 상관관계가 없다는 가정 하에 큰 풀로 묶여 있었다는 점이었다\. 알고 보니 서브프라임 대출은 예상보다 더 상관이 있었고\, 이는 다음과 같은 의미를 시사한다\:

> 이는 AAA 등급을 받은 서브프라임 담보 CDO 단면들이 사실상 AAA 등급을 받을 자격이 없었다는 뜻입니다\. 하지만 가장 위험한 부분인 주식 트랜치는 겉보기보다 위험이 적다는 의미이기도 합니다\: 증권 풀 내에서 높은 상관관계는 대규모 디폴트 가능성이 높지만\, 동시에 0 디폴트가 더 높다는 의미이기도 합니다\.

증권 간 상관관계가 더 높기 때문에\, 하락뿐만 아니라 상승 측면에서도 더 극단적인 사건들이 발생할 가능성이 높습니다\. 실제로는 이렇게 말씀드리자면\,

> 투자자는 지분의 일부를 사고\, AAA 등급 부채의 상당 부분에 대한 보험을 가입해 결국 \\\[\.\.\.\\\]을 얻을 수 있습니다\:

> 주식의 수익률은 AAA 등급 부문에 대한 보험 구매 비용을 충분히 상쇄했습니다\.

> 부동산이 상승하면 약간의 수익을 낼 수 있는데\, 자본이 더 가치가 있고 AAA 보험은 크게 낮을 수 없기 때문입니다\.

> 부동산이 떨어지면 큰 수익을 낼 수 있을 거예요\.

번은 모든 버블이 위의 세 번째 상황과 같은 상황을 가진 것은 아니며\, 이를 활용하는 포지션을 설정하는 것이 어려울 수 있다고 결론지었습니다\. 만약 그렇게 한다면\, 버블을 처리하는 전략으로는 위험이 적을 수 있습니다\.

### 걱정 마세요\, 당신은 제 개인 CRM에서 레벨 5 연락처입니다\\\*\\\*

성장 [Superhuman](https://techcrunch.com/2019/06/27/my-six-months-with-30-month-email-service-superhuman/ 'techcrunch')혁신적인 경험을 제공하는 대가로 요금을 부과하는 이메일 앱이 큰 열풍을 불러일으켰습니다 [premium subscription services](https://techcrunch.com/2019/08/27/kleiner-perkins-bets-on-a-premium-email-service-thats-bringing-slack-groups-into-gmail/ 'kleiner')\. 최근 기술 트위터에서는 개인 CRM\(고객 관계 관리\)이라는 개념이 부활했는데\, 이는 개인 관계를 관리하는 데 도움을 주는 소프트웨어입니다\.

![post](../../../blog/2019_08_31_crm/c_5.webp)\)

의견이 갈렸다\. 어떤 사람들은\.\.\. 미지근했다

![post](../../../blog/2019_08_31_crm/c_6.webp)

다른 이들은 트위터가 이미 개인 CRM 역할을 한다고 주장했습니다

![post](../../../blog/2019_08_31_crm/c_7.webp)

[And some people pointed out how this recurring idea continues to attract new startups](https://twitter.com/devahaz/status/1164224618602758144 'twitter')

무시하기 쉽죠\. 왜 사람들이 당신의 모든 관계를 추적하고\, 모든 상호작용을 저장하며\, 생일 축하 메시지가 억지스럽고 진실성 없게 만드는 무서운 소프트웨어를 원할까요\?

아\, 잠깐만요\.

![post](../../../blog/2019_08_31_crm/c_8.webp)

당신이 생각하든 말든 [Facebook has Zucked the world](https://www.theguardian.com/books/2019/feb/07/zucked-waking-up-to-facebook-catastrophe 'FB')그 성공은 사람들이 개인 관계를 관리할 방법을 원한다는 것을 보여줍니다\. 개인 CRM은 어리석은 생각이 아니며\, 저는 그것을 완전히 무시하지도 않을 것입니다\. 문제는 기존 시스템에서 어떻게 혁신할지\, 그리고 사람들이 비용을 지불하도록 만드는 데 있습니다\.

사람들과 연락을 유지하는 것이 쉬워서 우리는 _그래야 해_ 연락을 유지하세요\. 예전에는 \"내 편지 못 받았어\? 이상하네\, 우편 시스템 때문인가 봐\"라고 변명할 수 있었죠\. 이제는 그런 여유가 없고\, 친구의 50번째 목요일 인스타그램 게시물에 신경 쓰는 것처럼 보이는 것과 싸워야 해요\. 우리는 너무 벅차요\.

개인 CRM을 요청하는 사람들은 만난 사람들을 기억하고\, 공유한 관련 배경 맥락을 알며\, 중요한 날짜를 알려주고\, 가끔 누군가에게 연락하라고 상기시켜 주면서도 높은 수준의 프라이버시와 보안을 유지할 수 있는 것을 원합니다\. 이 아이디어에 분노하는 이유를 이해합니다\. 왜냐하면 개인의 사회적 노력을 컴퓨터에 외주를 주는 것이기 때문입니다\. \"아\, 그녀는 정말 다정해요\, 내 생일을 기억해줬어요\!\"라는 말이 \"네\, 그의 개인 CRM이 블록버스터 기프트카드를 보냈다\"는 것보다 더 낫게 들립니다\. 쉽게 만들면 오히려 진정성이 없게 됩니다\. 컴퓨터가 우리의 모든 사회적 상호작용을 수행한다면\, 인간이란 무엇일까요\?

하지만 친구에 관한 중요한 정보를 저장하는 시스템은 새로운 아이디어가 아닙니다\. 우리 대부분은 연락처의 전화번호부와 주소록을 가지고 자랐을 것입니다\. [David Rockefeller kept index cards of all the important people he met.](https://www.forbes.com/sites/carminegallo/2017/12/07/david-rockefellers-rolodex-offers-a-master-class-in-making-friends-and-influencing-people/#5b1525625cc4 'David') 이제 클라우드로 옮긴다고 해서 진정한 우정이 끝나는 것은 아닙니다\. 대부분의 도구와 마찬가지로\, 새로운 시스템을 좋든 나쁘든 사용하는 것은 우리에게 달려 있습니다\.

사람들이 이런 서비스를 위해 비용을 지불할까요\? 사람들이 LinkedIn Premium에 비용을 지불하니 선례가 있습니다\. 여기서 까다로운 점은 근본적으로 이 CRM이 데이터가 많을수록 더 유용하다는 점입니다\. 즉\, 사용자가 많을수록 경험이 더 좋아집니다\. 이게 바로 [network effect](https://www.nfx.com/post/network-effects-manual 'network') 사용자 요금 부과가 성장에 해로울 수 있다는 뜻인데\, 진입 장벽을 최소화하고 싶기 때문입니다\. 이것이 대부분의 소셜 네트워크가 구독보다 광고로 수익을 얻는 이유이기도 합니다\.

저는 원래 집착이 강하고\, 사람들과 연락을 유지하는 걸 좋아해요 [^6]\. 개인 CRM이 있으면 도움이 되겠지만\, 저는 비용을 지불하고 싶지 않을 것이고\, 대다수 사람들도 마찬가지일 것 같습니다\. 이들은 잠재력이 있지만 효율적으로 수익화하지 못하는 틈새 시장을 차지하는 것 같습니다\. 개인용 CRM은 앞으로도 계속 존재하고 재창조될 것이라고 생각하지만\, 개인에게 판매하는 데 집중하는 한 어느 것도 상당한 규모를 달성하기 어렵다고 60\% 확신합니다 [^7]\.

### 어디에나 워베곤 호수가 있다

대부분의 사람들은 자신의 사업 아이디어\, 인기 주식 추천\, 혹은 역대 최고의 시간 여행 프로그램에 대해 자신이 옳다는 것을 증명하려고 합니다 [^8]\. 저는 반대로 하라고 권합니다\. 어떤 주제에 강한 의견이 있다면\, 오히려 자신이 틀렸다는 것을 증명하려고 노력해야 합니다 [^9]\. 신념을 고집하는 것이 쉽게 가는 길입니다 [confirmation bias.](https://www.psychologytoday.com/us/blog/science-choice/201504/what-is-confirmation-bias 'confirm')

우리는 우리 자신을 잘 생각하고 싶어 한다\; 우리의 취향\, 싫어하는 것\, 편견\. 결국\, 자신을 묘사하기에 가장 적합한 사람이 누구인가\, 바로 자신이겠는가\? 이렇게 말한다 [Atlantic article](https://getpocket.com/explore/item/people-don-t-actually-know-themselves-very-well 'Atlantic') 하지만 우리는 그렇게 자각이 높지 않다고 지적합니다\. 우리가 행동해야 한다고 예측하는 방식과 실제 행동 사이에는 차이가 있으며\, 다른 사람들이 우리의 실제 행동을 더 잘 설명할 수도 있습니다\. 기사는 다음과 같이 인용합니다 [a meta-analysis](https://psycnet.apa.org/record/2010-25587-001 'meta')\:

> 우리의 결과는 관찰자 평가에 기반한 FFM 특성의 조작 타당성이 자기보고 평가보다 높음을 보여줍니다\.

위에서 FFM은 [Five Factor Model of personality](https://www.psychologistworld.com/personality/five-factor-model-big-five-personality 'FFM')\, 이는 [usually better regarded than the popular MBTI test.](/writing/moloch 'MBTI') 메타분석은 다른 사람들이 우리 자신보다 성격을 더 정확하게 평가한다고 주장합니다\. 전체 논문은 볼 수 없지만\, 비슷한 내용이 있습니다 [older study](https://home.ubalt.edu/NTYGMITC/641/barrick%20mount%20strauss%20big%20five%20obs%20ratings%20JAP%2094.pdf 'old test') 다른 사람들이 나에게 평가하는 것이 더 타당하다고 비슷하게 주장하는 것\.

애틀랜틱 기사는 다음과 같이 이어집니다\:

> 연구에서 사람들은 연설할 때 친구들이 얼마나 불안해 보이고 들릴지 예측하는 데 있어 친구들보다 더 뛰어난 성과를 냈습니다 \\\[\.\.\.\\\] 하지만 그룹 토론에서 자신이 얼마나 단호하게 나올지 예측하는 데는 친구들\(또는 8분 전에 만난 낯선 사람들\)보다 더 나은 성과를 내지 못했습니다\. IQ 테스트와 창의성 테스트에서 자신의 성과를 예측하려 했을 때\, 친구들보다 정확도가 떨어졌습니다\.

인간은 일반적으로 평가에 있어 제대로 조정되지 않으며\, 어떤 경우에는 자신의 능력을 과대평가하고 다른 경우에는 성과를 과소평가하는데\, 이는 우리가 어떻게 동기부여를 받느냐에 따라 다릅니다\. 기억하실 수도 있습니다 [Lake Wobegon effect](https://en.wikipedia.org/wiki/Lake_Wobegon#The_Lake_Wobegon_effect 'Lake') 그건 모두가 자신이 평균 이상이라고 생각하는 방식을 설명해줍니다\. 이 기사는 자기 인식을 높일 수 있는 몇 가지 방법을 제안합니다\.

> 첫째\: 사람들이 진짜로 당신을 알게 하고 싶다면\, 주간 미팅만으로는 부족합니다\. 고강도 상황에서 그들과 깊이 있게 대화해야 합니다\.

> 둘째\: \\\[\.\.\.\\\] 점점 더 많은 관리자들이 자신만의 사용 설명서를 작성해 사람들이 무엇이 자신을 가장 좋고 못 끌어내는지 이해하도록 돕는 것을 보았습니다\. 하지만 당신을 잘 아는 사람들이 사용자 설명서를 대신 작성하는 것이 더 좋습니다\.

> 셋째\: 여러 출처의 피드백을 무시할 수 없는 상황에 자신을 놓으세요\.

이 중 세 번째는 피드백을 주고받는 방법을 알고 있다면 시작하기에 가장 간단한 방법처럼 들립니다 [^10]\. 첫 번째는 당신의 진짜 내부 구조를 드러낼 수 있지만\, 많은 팀이 더 흔한 야생 글램핑 회사 리트릿에 비해 진짜 극단적인 상황에 자신을 내던지는 것은 어려울 것입니다 [^11]\. 2권에 사용자 매뉴얼이 있다는 아이디어가 마음에 들고\, 저도 직접 하나 있었으면 좋겠지만\, 사람들이 직접 써주길 바라는 것은 쉽지 않습니다\. 이 글을 읽고 자원봉사를 원하시는 분이 있다면\.\.\.

우리가 자신을 잘 알지 못한다는 것을 아는 것이 첫걸음입니다\. 안타깝게도\, 행동 편향을 인지한다고 해서 그것을 쉽게 고칠 수 있는 것은 아닙니다\. [Kahneman](https://en.wikipedia.org/wiki/Daniel_Kahneman 'Kahneman') 평생 편견을 연구하며 대부분의 편견에 빠진다고 말합니다\. 위에서 언급한 세 가지 점 외에도\, 시도해 보세요 [Steelmanning](https://rationalwiki.org/wiki/Straw_man#Steelmanning 'Steelmanning') 반대하는 주제를 허수아비 논리로 표현하는 것보다는\, [seeking out the weak points in your beliefs rather than continuing to emphasise the strong ones](https://medium.com/the-polymath-project/the-ideological-turing-test-how-to-be-less-wrong-6803a8c290cf 'less wrong')\. 틀렸다는 걸 증명하면 더 자주 옳을 수도 있어요\.

## 기타

1. 다른 사람들의 논의 [why](https://www.perell.com/blog/why-you-should-write 'why') 그리고 [how](https://jasonzweig.com/a-few-thoughts-on-journalism/ 'how') 더 많이 써보는 걸 생각해 봐야 해요 [^12]

   > 글쓰기는 뇌를 위한 역도 운동과 같습니다\. 아이디어의 한계를 시험하는 것이 아이디어를 개선하고 지능을 높이는 가장 빠른 방법입니다

   > 저널리즘에서 성공하려면 이 여섯 가지 자질이 모두 필요하다고 생각해요\. \\\[\.\.\.\\\] 호기심\, 회의\, 끈기\, 세심한 주의\, 책임감\, 두꺼운 피부

2. [Violent protests increased support for liberal policy due to greater mobilisation of voters](https://scholar.harvard.edu/files/renos/files/enoskaufmansands.pdf 'violent')\. 최근 시위와 그것들이 효과적일 수 있을지 고려할 만한 점입니다\.
3. ["Nobody ever says at a funeral, “He was too generous, too kind, and much too loving."](https://www.fastcompany.com/90348896/why-not-being-a-jerk-is-important-to-your-happiness-and-success 'jerks')
4. [SMCP came out with an overview of China Internet](https://www.scmp.com/china-internet-report 'smcp')\, 그리고 주요 트렌드는 다음과 같습니다\:

   > 중국의 \'모방\' 기술 산업이 이제 모방되고 있습니다

   > 중국은 5G로 앞서 나가고 있습니다

   > 중국은 대규모로 AI를 사용하고 있습니다

   > 사회신용이 중국에서 현실이 되어가고 있습니다

   저도 첫 번째 의견에 동의하지만\(한동안 그랬습니다\)\, 하지만 나머지 세 가지 경향은 과장된 면이 있다고 생각합니다\. [I've written about social credit misunderstandings before](/writing/moloch 'social')

5. [Wait but why writes about why we do what we do](https://waitbutwhy.com/2019/08/fire-light.html 'wait but why')\. 이 주제를 좋아한다면\, [Behave](https://www.goodreads.com/book/show/31170723-behave 'Behave') 더 포괄적인 해석입니다\.

**주석**

[^1]: 번스 [WeWork analysis](https://medium.com/@byrnehobart/what-is-we-understanding-the-wework-ipo-b74f0f1f1b46 'WeWork') 최근 소개된 [Matt Levine's Money Stuff](https://www.bloomberg.com/opinion/articles/2019-08-19/we-looks-out-for-our-selves 'Money Stuff') 또한\; 멋진 일이에요\, 번\!

[^2]: 금융 분야가 아닌 분들을 위해\, [shorting](https://www.investopedia.com/terms/s/shortselling.asp 'short') 주가가 하락할 것이라고 베팅하고 지금 사기 위해 빌리는 경우입니다\. 예를 들어\, FB 주식 한 주를 \$180에 빌려 180달러에 팔고\, 100달러까지 오르길 바라며 \$100에 다시 사는 식입니다\. FB 주식을 반환하면 \$80을 벌었습니다\. 하지만 FB가 \$280까지 올랐다면\, 빌린 주식을 돌려주려면 \$280에 사야 하므로 \$100 손실이 발생합니다\. 이론적으로는 주가가 무한대까지 오를 수 있지만 최소한 0에 가까워질 수 있기 때문에\, 공매도에서는 무제한으로 손실을 입을 수 있지만\, 잠재적 이익은 제한적입니다\.

[^3]: 이 기사는 다음과 같이 제공되었습니다 [The Profile](https://theprofile.substack.com/p/the-profile-the-government-informant 'Profile')폴리나 마리노바가 발행하는 주간 뉴스레터로\, 사람들의 흥미로운 이야기를 많이 담고 있습니다\. 꼭 확인해 보세요\!

[^4]: 누군가 내 계산을 꼭 확인해 줘야 할 것 같아요

[^5]: 저는 서핑을 해본 적이 없어서 이 비유가 끔찍할 수도 있겠네요

[^6]: 안타깝게도\, 반대는 완전히 사실이 아니야\.\.\.

[^7]: 트위터는 현재 300억 달러 규모의 기업이므로\, 100억 달러를 \'상당한 규모\'로 봅시다

[^8]: 참고로\, [Doctor Who](https://en.wikipedia.org/wiki/Doctor_Who 'Dr Who')특히 뛰어난 에피소드들에 대해 [Blink](<https://en.wikipedia.org/wiki/Blink_(Doctor_Who)> 'Blink')\, [Vincent and the Doctor](https://en.wikipedia.org/wiki/Vincent_and_the_Doctor 'Vincent')\, 그리고 [Heaven Sent](<https://en.wikipedia.org/wiki/Heaven_Sent_(Doctor_Who)> 'Heaven')\.

[^9]: 농담 아니고\, 사실 뉴스레터 이름을 \'Prove Me Wrong\'로 할까 고민했어요\.

[^10]: 이것 자체가 어려운 기술이지만\, 다음 기회에 주제로 하겠죠\. 예전에 배운 좋은 팁 중 하나는\, 피드백이 거짓이라고 생각하더라도\, 피드백은 동료들이 실제로 당신을 어떻게 보는지를 나타내기 때문에 중요하다는 것입니다\. 결국 중요한 것은 동료들이 당신을 어떻게 보는지입니다\.

[^11]: 야생 글램핑을 싫어하는 건 아니지만\, 첫 번째 시나리오를 유발할 만큼 극단적이지는 않다는 뜻입니다\.

[^12]: 데이비드와 제이슨 모두 온라인 작가라는 점에서 자연스러운 편견이 있지만\, 그것이 그들의 주장을 깎아내리지는 않습니다\.
