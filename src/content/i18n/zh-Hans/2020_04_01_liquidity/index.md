---
title: "书评：误解金融危机"
description: "金融危机关乎流动性，而非资本"
pubDate: 2020-04-01
category: Investing
tags: ['liquidity', 'risk']
heroImage: '../../../blog/2020_04_01_liquidity/m_1.webp'
locale: 'zh-Hans'
sourceSlug: 'liquidity'
sourceHash: '67efb2924cca16f71bf7d832e0079c4ee89e15ef1867bbd74d62b0bc2c5af106'
---

我读过 ["Misunderstanding financial crises" by Gary Gorton](https://www.amazon.com/Misunderstanding-Financial-Crises-Dont-Coming/dp/019992290X 'AMZN') 几年前。它对金融危机发生的原因有很好的观点，可以重新编写，使其更有结构和清晰。以下是重点：

> 金融危机的根源都是一样的——银行挤兑和银行系统存款需求的急剧减少。危机发生在市场参与者不信任银行债务价值，金融机构突然对现金产生巨大需求

> 现金需求如此之大，银行无法满足这一需求，因为资产无法大规模出售，否则价格将暴跌

> 危机在历史上屡见不鲜，且发生得突然且难以预测

银行的业务是向消费者（零售）和企业借贷资金。当你或你的公司向银行存钱时，你是在向银行借款，期望未来能提取这笔现金。银行反过来借出比现有更多的钱，这被称为 [fractional reserve banking](https://en.wikipedia.org/wiki/Fractional-reserve_banking 'bank')，并期望并非所有人同时想要退出。这使得经济中的货币（信用）供应和速度得以增加，并提供流动性。

消费者银行挤兑在很大程度上已成为过去，原因有1） [FDIC deposit insurance](https://www.fdic.gov/deposit/deposits/faq.html 'FDIC') 2）消费者存款与企业存款的规模。现在已经不像 [the 1920s where 2 banks would fail a day](https://econproph.com/2009/10/26/fdic-managing-the-crisis-the-fdic-and-rtc-experience/ '1920')\.

现在更大的风险是来自机构的挤兑，无论是公司还是投资公司。在危机时期，这些公司希望收回现金。 **当他们同时想要时，银行根本无法满足这种需求。**

我就不谈这些公司如何保管现金的细节\;如果你已经了解过相关条款 [repo,](https://www.quora.com/Where-do-billion-dollar-companies-keep-their-money 'repo') 商业票据，或者最近是循环信贷，这些都属于这个范畴。简单来说，银行对公司有各种形式的义务，而公司现在也在调用这些义务来获取现金 [^1]\.

这里的主要观点是 **危机的根源是流动性，而非资本。** 银行可能仍有大量流动性不佳的资产，但此刻无法按需提供足够的现金。而且银行甚至无法以好价出售流动性较低的资产，因为这是危机，导致流动性恶性循环。

> 当没有什么可知道或值得知道的时，市场是流动的\;当没有秘密时

反过来， **当未知数过多时，流动性就会停止。** 在08年危机中，银行不愿互相放贷，因为他们不知道哪家银行已经资不抵债。现在，人们不知道正常业务何时恢复，哪些企业能存活下来。这就是为什么美联储介入，试图增加流动性并提供已知的资金来源。

> 银行系统一直被视为“太大而不能倒”。没有哪个社会会有意清算其银行系统\;相反，他们选择不执行债务合同。他们这样做的方法是

> 1. 允许暂停可兑换性（不得提取）或 [bank holidays](https://www.federalreservehistory.org/essays/bank_holiday_of_1933 'holiday') （全面暂停所有银行服务）

> 2. 即使银行未偿还债务，也宣称银行不破产

> 3. 对不良资产的救助

货币和信贷对当前社会至关重要，几个世纪以来一直如此。这是部分银行的内在权衡，因为信贷依赖于信任。在信任高、流动性不在问题的好时期，信贷得以扩展，经济活动得以进行。在信任低落的低迷时期，流动性消失，信贷被撤回，经济活动停滞 [^2]\.

[^1]: 为什么公司不像你我那样直接保留现金呢？首先，缺乏能覆盖如此大额余额的存款保险。其次，这些现金的回报会更少。因此，公司会签订回购、国库等安排，用现金换取他人的短期负债。当人们认为谷歌拥有1000亿美元现金时，这确实有道理——某种程度上。它确实拥有这笔现金的总流动资产，但现金等价物只有一小部分，大部分是证券。参见他们的 [2019 10K page 50, cash and cash equivalents vs marketable securities](https://abc.xyz/investor/static/pdf/20200204_alphabet_10K.pdf?cache=cdd6dbf '10k')

[^2]: 书中还讨论了金融危机带来的四种潜在成本：1）纳税人向机构转移财政带来的无谓损失，2）产出损失和失业率上升，3）因缓解危机采取的行动导致资源错配，4）社会福祉成本。我们可以通过良好的政策降低这些成本，但无法消除它们，且应预期每场危机都会发生
