---
title: "机器人分析师是股票研究的未来吗？"
description: "卖方股票研究提供了哪些价值？"
pubDate: 2020-02-26
category: Investing
tags: ['equity research', 'AI']
heroImage: '../../../blog/2020_02_26_sellside/s_3.webp'
locale: 'zh-Hans'
sourceSlug: 'sellside'
sourceHash: '9e9b2f343e79497b5aa89e766fd1869c1ccc8a0e1b36178d4de6e0c099372832'
---

## 摘要

机器人正在进行卖方股票研究，但这可能无关紧要

---

如果你想到 **金融作为资本来源与资本使用者之间的互动，** 高盛、摩根士丹利、摩根大通等投资银行处于中间地带，促进有钱人和需要钱人之间的交易。

![post](../../../blog/2020_02_26_sellside/s_1.webp)

银行有专门负责特定金融产品（股票、债务、并购等）或特定行业（消费、医疗、科技等）的银行家，并安排其覆盖范围内的公司融资交易。

在这些交易之外， **银行通常设有股票研究小组，负责发布股票观点** 基于对公司的调研并与公司管理层保持关系。这些是你在新闻中看到的“买入\/持有\/卖出”价格目标。请注意，这些是建议，研究团队并未持有公司头寸，这使他们区别于专业投资者 [^1]\.

![post](../../../blog/2020_02_26_sellside/s_2.webp)

股票研究会被卖给专业投资者，理论上他们会利用这些信息来做出投资决策。不过这些投资者也会自行进行研究，因此他们是否会从银行研究中吸收多少尚不确定。重要的是，他们支付股票研究费用并非基于推荐的准确性，而是通过银行通过交易佣金间接支付。

**因此，投资者究竟为何付出代价仍是一个悬而未决的问题：1）研究，2）与公司的关系，或3）投资推荐 [^2]\.** 我的卖方（研究）朋友会说是全部，买方（投资者）朋友可能会说是（2），而我的散户投资者朋友可能会说是（3），因为他们没有提供（1）和（2）。

![post](../../../blog/2020_02_26_sellside/s_3.webp)

如果你假设最大的增值来自（3）， [this paper by Braiden Coleman, Kenneth Merkley, Joseph Pacelli on computer programmed equity research](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3514879 'Robots') 会很有趣。 **他们研究“机器人分析师”——即由人类分析师辅助的自动化研究分析计算机程序——如何与人类研究分析师对抗** 通过分析两者推荐的差异。

团队确定了使用机器人的企业，收集了他们的股票推荐 [^3]然后检验关于偏置、频率和优异表现的三个假设。结果与三者一致，我们将依次分析：

> 首先，机器人分析师集体上比人类分析师更均衡地分配买入、持有和卖出建议，这与他们较少受到行为偏差和利益冲突的影响相符

第一是说机器人比人类分析师有更少偏见，而人类分析师同样存在利益冲突。因此，机器人推荐的股票分布更“自然”，并非全是没有“卖出”的“买入”。这些利益冲突“与经济激励有关，比如获得投资银行业务或讨好管理层”。

[Sarbanes-Oxley was intended to reduce such conflicts of interest,](https://www.sec.gov/news/speech/spch012803cag.htm 'Sarbox') 通过限制投资银行家（金融交易）与股票研究组之间的联系 [^4]\.即使你认为这已经是成功的有限接触，分析师仍然有动力发布对公司的正面报告。如果你是CEO，并且有不同分析师对你的股票的“买入”和“卖出”评级，你更可能和谁友好？

> 其次，机器人分析师比人工分析师更频繁地修改建议，并且采用不同的生产流程

第二种是机器人更新输入的频率和数据都不同于人类，因此推荐更新频率更高。要理解这一点，我们需要了解企业如何发布财务信息。在美国，公司发布一份大型年度报告（10K）和三份较小的季度报告（10Q）。此外，他们会在这些报告（8K）之前发布财报，包含季度业绩，并可能包含额外信息。

**投资者通常在8K美元交易，因为这些信息会在10季度之前发布。** 同样，人工分析师也会根据8K报告更新报告。而机器人则更关注10Q和10K，且更可能在提交后更新。

第二个发现是否有趣，取决于你是什么类型的投资者。许多投资者会围绕财报发布（8K）进行交易。由于投资中有一半是预期游戏，而这些投资者想知道的大部分信息已经包含在8K中，8K后获得的推荐减少而10Q后获得更多建议的帮助较小。你应该尽快知道，而不是等到更详细的10Q报告出来，因为价格会随着8K周期波动。

> 第三，基于机器人分析师买入建议形成的投资组合似乎优于人类分析师，表明他们的买入调用更具盈利性

第三个发现是论文中的“那又怎样”，指出 **上述两个发现很重要，因为跟踪机器人比人类分析师获得更好的回报。** 这种情况只发生在“买入”推荐中，但“卖出”推荐时不会，他们认为这是因为人类不太可能降低“买入”的评级，而机器人过度修正并发出过多的“卖出”。

我对他们的方法有一点小意见，会放在脚注里 [^5]\.总体来说，如果你像许多散户投资者那样认为股票推荐很重要， **这篇论文主张你也应该关注机器人分析师，因为他们偏见更小，更新更频繁，并且可能带来超额表现。**

这对股票研究行业意味着什么，取决于你认为他们对服务买家的附加价值在哪里。如果是（1）或（3），这篇论文是坏消息\;但如果是（2），那就没那么严重。我有60\%的信心我们会看到机器人数量增加，但这对大多数研究分析师来说仍然无关紧要。

## 其他

1. [Is the momentum factor in stocks explained by randomness?](https://breakingthemarket.com/randomness-in-momentum-everywhere/ 'Random')
2. [The 4 major parts of shipping and maintaining a software application, and the products, methods, and services developers use](https://technically.dev/posts/what-your-developers-are-using.html 'dev')
3. [Buying your way into nobility](https://www.bloomberg.com/news/articles/2020-02-02/even-if-you-weren-t-born-into-nobility-you-can-buy-your-way-in 'Nobility')
4. ["Romeo and Juliet is not a love story. It is a six-day relationship between adolescents and an infatuation that leads to a tribal war."](https://aeon.co/essays/how-emotionally-focused-couple-therapy-can-help-love-last? 'EFT')
5. [Interactive documentary of Jheronimus Bosch's artwork "the Garden of Earthly Delights"](https://archief.ntr.nl/tuinderlusten/en.html# 'Art')

[^1]: 根据公司的合规政策，股票研究分析师本人可能有职位，但这极不可能，我认为甚至可能被禁止。令人困惑的是，银行整体上可能确实通过资产管理部门设立职位，而资产管理部门是与股票研究不同的业务线。

[^2]: 随着MiFID的新监管，股权研究的激励结构也在变化，导致银行行为发生变化。此外，我并不是说股权研究分析师工作不好\;有些人如玛丽·米克尔（Mary Meeker）之所以成名，是因为他们作为研究分析师的优秀表现

[^3]: 他们重点关注推荐，“因为这些是机器人分析公司中报告最频繁的产出，同时也是散户投资者最关注的产出”

[^4]: 它还包括了诸如“研究报告必须包含跟踪股票在历史时期相对于分析师建议价格走势的价格图表”这样的规则。我在银行工作时为公司管理编制材料时删除了这些页面，买方时也没怎么关注，所以我不禁怀疑，善意的监管到底有多有效

[^5]: 他们通过“在推荐发布后，于第二天交易结束时将这些股票加入相关投资组合”来构建投资组合。换句话说，机器人发布推荐，经过交易日，然后在收盘时放入股票。价格不应该已经受到推荐的影响吗？如果没有，我想知道动量有多少算
