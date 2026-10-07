---
title: "谁来守门人"
description: "守门人的守门人会自己设门槛吗？"
pubDate: 2020-10-28
category: Culture
tags: ['finance', 'behaviour']
heroImage: '../../../blog/2020_10_28_gatekeep/g_5.webp'
locale: 'zh-Hans'
sourceSlug: 'gatekeep'
sourceHash: 'a726c7c131fb27b670f7a03994bb2d6dc9f6d19bb210d87084183e4dabde1729'
---

## 要点

1. 守门通常是为了维护个人身份而非群体身份，应避免
2. 资本成本和流动性低迷形成反馈循环

## 1\. 群体身份与个人身份的门槛

你以前见过这种情况。

一个初学者，满怀憧憬、充满活力，会来寻求如何入门某个学科的建议。

![post](../../../blog/2020_10_28_gatekeep/g_1.webp)

而且还有许多专家会 [emerge from the depths](https://youtu.be/Y2fwe0rnHak?t=118 'balrog') 告诉他们这不可能完成，应该回去花几年时间学习先修课程，并且他们应该为一开始提出这个问题而感到尴尬。 _“有些人真是厚颜无耻，竟然以为能逃避缴纳会费。”_

甚至有些“专家”在别人开设课程帮助初学者时，总能找到抱怨的理由。

![post](../../../blog/2020_10_28_gatekeep/g_2.webp)

我们经常遇到门槛设法，而这大多是为了维护地位。确实有一些有效的门槛设置，稍后我会详细说到。但几乎总是为了排斥别人、刻薄而做。有趣的是，守门人似乎从未意识到自己也可能被排除在外。

比如，你可以说，除非你学好微积分、统计学和线性代数，否则无法开始机器学习，就像上面评论者说的那样。

![post](../../../blog/2020_10_28_gatekeep/g_3.webp)

你也可以说，除非你学会群论，否则你无法开始线性代数，怎么会这样 [matrices are a ring](https://www.youtube.com/watch?v=_RTHvweHlhE 'ring')， 和 [when to work with linear groups or not](https://www.youtube.com/watch?v=AJTRwhSZJWw 'group') [^1]

![post](../../../blog/2020_10_28_gatekeep/g_4.webp)

你还可以进一步设限，说上述情况取决于 [set theory](https://plato.stanford.edu/entries/set-theory/ 'set')\, [Peano axioms](https://en.wikipedia.org/wiki/Peano_axioms 'Peano')， 和 [philosophy](https://plato.stanford.edu/entries/philosophy-mathematics/ 'philo')\.不知道评论者本科期间花了多少时间学习这些内容。

如果我们愿意，我们可以把关任何东西都设在门槛上。

**我们也永远不会有进展，因为我们根本没开始。**

有合理的门槛设置。如果你因为某人会对社区有害而排除他们，那是合理的。比如，如果你在组建一个游戏玩家团队，收到一个想要禁止电子游戏的人的会员请求，接受她加入可能就不太合理。

但更多时候，把关是“内群体”中的个体为了维护自己的地位而设想的，好像越多人知道他们知道的事就越是他们失去了。这源于一种不安全感\;来自于害怕让别人意识到他们所做的事情也可以被别人做。正如我上个月写的，这就像是输了彩票，可能是个坏主意。比如，印象派画家刚开始时都被设为门槛，但看看他们现在在艺术中的影响力 [^2]\.

不过，要注意守门人说的也不完全错。 **事实上，他们的建议往往很有道理。** 比如，在学习机器学习时掌握线性代数会非常有帮助。如果你想成为专家，就必须掌握所有所需的数学知识 [^3]\.但人为阻止人们开始学习一门课对任何人都没有帮助。更好的回应是“是的，这里有一些更简单的课程，入门后回来复习基础。”启用而不是禁用。

![post](../../../blog/2020_10_28_gatekeep/g_5.webp)

如果你一直偏向于把关，我建议你思考你是在帮助社区，还是在帮助自己 [^4]\.如果你是自愿选择阅读这份通讯，你可以做得更好。

领域足够大，追求者越多越好。这很少，甚至几乎从不是零和游戏，更像是 [infinite game](https://fs.blog/2020/02/finite-and-infinite-games-two-ways-to-play-the-game-of-life/ 'infinite')\.通过开放心态和接纳初学者，我们可以扩大整个蛋糕，并为自己争取更多。这就是我们作为个人推动进步的方式\;我们既能兼得蛋糕又能拥有蛋糕。

打开更多大门，然后 [be kind.](https://www.youtube.com/watch?v=xnouj9Yz-Gs&feature=youtu.be&t=23 'who')

## 2\. 流动性螺旋

你以前也见过这种情况。

市场运转起来，做着它该做的市场平衡，匹配买卖双方。当突然发生冲击时，市场会冻结，变得“流动性不足”。

例如， [how flour was in short supply a while back](https://www.theatlantic.com/health/archive/2020/05/why-theres-no-flour-during-coronavirus/611527/ 'flour') [^5]\.

或者08年危机如何导致银行机构挤兑，导致部分银行破产。

还要回想今年早些时候我们讨论过，危机的根源是流动性，而不是资本。

今天我们将回顾论文的亮点 ["Market Liquidity and Funding Liquidity"](https://www.nber.org/system/files/working_papers/w12939/w12939.pdf 'Markus') 作者：马库斯·布鲁纳迈尔和拉塞·佩德森。论文篇幅较长，且主要以数学为主 [^6]，但我们仍然可以回顾结论。

Markus和Lasse探讨了导致这些流动性低迷的原因，找出了资本成本 [^7] 与流动性形成反馈循环。资金更难获得，流动性较低，波动性更大。

他们首先关注保证金要求 [^8]并注意它们如何随着危机变化。正如预期的那样，利润率（这里以成本为单位）在不确定性增加时流动性降低，不确定性减少时利润率变高。

![post](../../../blog/2020_10_28_gatekeep/g_6.webp)

减少流动性的另一种方法是减少参与者的资本：

> 重要的是，任何均衡选择都具有这样一个特性：小额投机者损失可能导致市场流动性断断续续下降。这种“突然枯竭”或市场流动性脆弱性，是因为投机者资本水平高时，市场必须处于流动性均衡，如果投机者资本减少到足够程度，市场最终必须转向低流动性\/高利润率均衡

这可能导致流动性低落，有两种方式：

![post](../../../blog/2020_10_28_gatekeep/g_7.webp)

> 首先，如果市场流动性不足导致利润率上升，投机者财富减少导致市场流动性下降，导致利润率上升，进一步收紧投机者的资金限制，便形成“保证金螺旋”，如此类推

> 其次，如果投机者持有与客户需求冲击负相关的大额初始头寸，就会出现“亏损螺旋”

第一个似乎不言自明\;第二个意思是，如果你是被迫卖家，价格会大幅下跌，你就得卖更多。

这使他们得出了投资者和央行的结论：

对投资者来说，它们强调了安全边际的重要性，这似乎显而易见：

> 最后，仅仅是资金限制变得具有约束力的风险，就限制了投机者提供市场流动性。我们的分析显示，投机者的最佳（资金）风险管理政策是保持“安全缓冲”。

更有趣的是他们对中央银行和货币政策的结论。

> 中央银行可以通过控制资金流动性来缓解市场流动性问题。如果中央银行在区分流动性冲击和基本面冲击方面比投机者的典型融资者更为出色，那么中央银行可以传达这些信息，并敦促金融家放宽资金要求

> 中央银行还可以通过在流动性危机期间提升投机者融资条件，或仅仅声明在危机期间提供额外资金的意图来改善市场流动性

**这正是你在当今市场中看到的情况。** 请注意，中央银行可以做三种独立的行动：1）传递信息，2）提供资金，3）仅仅 _说_ 他们可能会提供资金\;最终甚至可能根本不需要这样做。在当前的危机中， [markets recovered after (3), even though the actual funding provided was small.](https://www.ft.com/content/a1fba7cd-5329-46e6-82a8-57149e409f6c 'fed')

甚至美联储也意识到自己并非最后的守门人。

## 其他

1. [A brief history of graphics (youtube video)](https://www.youtube.com/watch?v=QyjyWUrHsFc&list=WL&index=8 'gfx')
2. ["Colour blindness is an inaccurate term"](https://commandcenter.blogspot.com/2020/09/color-blindness-is-inaccurate-term.html 'colour')\.作为色盲者，读到这篇文章很酷，尤其是里面有新信息
3. ["The long tail turns out toe be a major cause of the economic challenges of building AI businesses"](https://a16z.com/2020/08/12/taming-the-tail-adventures-in-improving-ai-economics/ 'a16z')
4. [Intro to abstract algebra and group theory by Socratica (youtube series)](https://www.youtube.com/watch?v=IP7nW_hKB7I 'aa')\.推荐，适合初学者。
5. ["Fusion reactor very likely to work"](https://futurism.com/mit-researchers-fusion-reactor-very-likely-work 'fusion')

[^1]: 直到今年才知道群论，我得说这是我今年学到的最有趣的东西。它真的帮我直觉理解为什么我们会这样定义代数“事物”和“运算”。比如矩阵乘法为什么不是交换的？

[^2]: 印象派最早得名 [from critics ridiculing them for their "unfinished" artwork that were mere "impressions"](https://smarthistory.org/how-the-impressionists-got-their-name/ 'art')

[^3]: 说清楚点——我同意，要想擅长机器学习，你需要擅长微积分、统计、线性代数等。评论者在这方面说得对。我不同意我们应该把人设限多年，因为他们还没学到所有必要的知识

[^4]: 我跳过了关于安全问题的讨论，比如你 _应该_ 如果没爬过任何东西，就不能自由单人攀登。我相信读者会有常识\;希望这不会太苛刻

[^5]: 你会注意到我没有用卫生纸作为例子。那是因为我对一篇之前走红的TP媒介文章有强烈反感，我认为那篇文章大多不准确。我打算写那种“这里有个反直觉解释”的文章，这些文章其实并不反直觉，只是错了\;我还没时间写。

[^6]: 另外，坦白说我并不完全理解论文中的数学原理。特别是有一个投机者偏向回报的结论，我不太理解。

[^7]: 对于不了解资本成本的读者来说，可以把它想象成资金成本。我之前写过更多相关内容 [here](/writing/capital 'sub')

[^8]: “当交易者——例如交易商、对冲基金或投资银行——购买证券时，他可以将证券作为抵押品并以此借款，但不能借出全部价格。证券价格与抵押品价值之间的差额，记作保证金，必须用交易者自身的资本融资。”
