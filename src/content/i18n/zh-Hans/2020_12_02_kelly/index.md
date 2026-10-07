---
title: "相信凯利天使投资标准"
description: "利用数学估算最佳投资组合规模"
pubDate: 2020-12-02
category: Risk & Decision Making
tags: ['investing', 'risk', 'math']
heroImage: '../../../blog/2020_12_02_kelly/kel_7.webp'
featured: true
locale: 'zh-Hans'
sourceSlug: 'kelly'
sourceHash: '360b60f1699a1f7679aa8e710a2d62b9ff39faaf7b217118a06c5a13e2b226cb'
---

## 要点

1. 凯利准则是一种用数学方式来评估你的投资组合规模，但要小心你的假设
2. HASH\.ai 让基于代理的仿真变得更容易\;我尝试建模启动失败率

## 1\. 凯利投资组合尺寸标准

莎拉是一名有抱负的天使投资人。她的朋友尼古拉斯、艾莉森和蔡斯有一个神奇的商业点子，涉及灭虫，莎拉认为这将大获成功。

莎拉正准备将她一生积蓄投入这项事业时，她的另一群朋友 [^1] 塞思、马克、艾玛和安柏向她提出了一个同样令人兴奋的兔子创意。

莎拉突然意识到自己有多重选择，却不确定该怎么办。她去咨询了年长的朋友安东尼，安东尼密切关注投资领域。安东尼说她走在正确的道路上——投资组合配置和风险\/回报是成为成功投资者的关键。他还补充说，她可能想了解一下关于 [Kelly criterion,](https://www.princeton.edu/~wbialek/rome/refs/kelly_56.pdf 'Kelly') 下注规模公式。

Kelly公式由贝尔实验室的John Kelly开发。它需要输入几次，然后返回给你 **你投资某项资产的最佳比例，** 假设你想最大化长期回报。我在附录里发了一个简化的推导，你也可以找到 [here](https://blogs.cfainstitute.org/investor/2018/06/14/the-kelly-criterion-you-dont-know-the-half-of-it/ 'derive') 或者在原始论文中。

![post](../../../blog/2020_12_02_kelly/kel_1.webp)

我知道数学很可怕，所以我们用一个例子来说明。你想知道在掷硬币时下注多少钱，比如你要么翻倍，要么输掉赌注。如果你代入这些数字：

![post](../../../blog/2020_12_02_kelly/kel_2.webp)

是的，你没看错。凯利说你应该避免任何风险。为什么？

既然你没有优势，且风险\/回报的评估也正确，最好的选择就是不下注。

现在，想象一下同一次掷硬币给你下注的11倍回报（1000\%），其他一切都保持不变。如果你代入这些数字：

![post](../../../blog/2020_12_02_kelly/kel_3.webp)

Kelly说你应该下注总资本的45\%。注意，即使赔率如此吸引人，你也没有把所有钱都押在下注 [^2]\.你还可以看到，在那些可能输光所有下注的游戏中，除非你相信自己有100\%的获胜概率，否则绝不会全押。

[Michael Mauboussin and Ed Thorp elaborate on the attractive features of the Kelly system:](http://www.capatcolumbia.com/MM%20LMCM%20reports/Size%20Matters.pdf 'Michael')

1. 破产的可能性“很小”。由于凯利系统基于比例投注，理论上失去全部资本是不可能的，尽管波动率仍会飙升
2. 凯利系统很可能比其他系统更快地增长资金
3. 你通常能在最短的平均时间内达到一定的奖金水平

这对天使投资方面有什么帮助？我们必须做出一些高度简化的假设 [^3]但Kelly可以帮助我们了解每个投资应该分配多少。

我们知道凯利会接受三个输入——我们对获胜概率的信念、损失百分比和利润百分比。 [Correlation Ventures and Seth Levine](https://www.sethlevine.com/archives/2020/10/vc-fund-returns-are-more-skewed-than-you-think.html 'Seth') 下面有一张漂亮的图表，显示了风险投资随时间的回报，我会以此作为我假设的基础。

![post](../../../blog/2020_12_02_kelly/kel_4.webp)

为了简化，我只把任何回报率达到10倍（900\%）以上的都算作赢，其他的都算亏。从图表来看，这意味着我们赢的概率大约是5\%。我再简化一点，假设我们输掉100\%的赌注，赢了900\%的利润。在这些初步假设下，我们得到：

![post](../../../blog/2020_12_02_kelly/kel_5.webp)

唉。这可不妙。根据我们目前的假设，凯利说风险投资是个糟糕的交易。我第一次看到这篇文章时愣了一下，然后想着怎么写完这期通讯 [^4]\.我最终的答案是作弊。非常多。

与其说5\%的胜率，不如说天使投资人带着信心进入投资，认为自己高于平均水平，并且他们的投资至少能回报资金。他们相信自己的中奖概率高于基础利率。除非你相信自己对概率有优势，否则你不会下注。

换句话说，我们忽略图中\<1x的部分，假设我们的宇宙就是剩余部分。那5\%的胜率会跳跃到大约14\% [^5]\.其他所有条件保持不变。在这些新假设下，我们得到：

![post](../../../blog/2020_12_02_kelly/kel_6.webp)

这至少是我们可以利用的。请先接受假设，我们稍后会重新探讨。

为了看看我们的回报可能是什么样子，我们还假设我们连续做了100笔这样的投资。我们会运行1000次模拟，模拟这样的投资组合可能是什么样子，也就是说，假设有1000个宇宙，在上述假设下我们投资100家公司。 [I'm using this Colab file here if you want to follow along](https://colab.research.google.com/drive/1YeMnl2QOQdCAGGxCDr2pfDk_HFgCh02D?usp=sharing 'Colab')

毫不意外，我们控的游戏显示我们赚了很多钱：

![post](../../../blog/2020_12_02_kelly/kel_7.webp)

不过有几点需要注意。看看那些巨大的回撤（所有的下跌）。许多投资组合在结束时亏损超过一半。回报会有巨大的波动性激增。

还有，我们跑了 _一千_ 模拟。虽然大回报在图表上很明显，但实际上并不多。大多数案例都集中在底部附近。

为了降低风险，许多人常采用“分数凯利”方法，即下注凯利推荐金额的较小比例。我们这里也会这样做，模拟只投注推荐金额一半（2\%）的情景。

让我们仔细看看这两种情况的回报分布。虽然难以看清，但箱形图显示了典型的第25百分位、中位数和第75百分位的回报范围。我们从100美元开始：

![post](../../../blog/2020_12_02_kelly/kel_8.webp)

如果忽略例外情况，我们可以看到所有模拟的第25到第75百分位的回报区间要小得多。

如果我们放大到“更安全的”半凯利方法，我们会发现大多数时候你获得的回报率不到5倍。

![post](../../../blog/2020_12_02_kelly/kel_9.webp)

**总结是，如果你是天使投资，你需要高度的信念，可能想做很多投资，并且一次只投资少量资本。** 即便如此，传说中的100倍回报的可能性仍然很低。请记住，这属于最优投注策略，我们已经以多种方式操控了游戏：

- 我们剔除了一大批失败者
- 我们假设结果为二项式
- 我们假设了固定的赢亏赔付
- 我们以为赌注是接连发生的
- 我们以为可以下注很多

这些都不是现实生活的样子\;以上说法极度简化。话虽如此， **我们至少可以用凯莉来降低毁灭的风险。**

如果你想深入了解，可以看瓦西里·涅克拉索夫的一篇论文 [here](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2259133 'paper') 那个模型好得多，但数学上我不太懂。Python Colab文件是 [here](https://colab.research.google.com/drive/1YeMnl2QOQdCAGGxCDr2pfDk_HFgCh02D?usp=sharing 'colab') 如果你想玩玩基础模拟假设 [^6]\.

### 关于凯利准则的更多信息：

1. [The Kelly Criterion: Multiple Investment Opportunities by Christian Aichinger](https://greek0.net/blog/2018/04/17/kelly_criterion2/)
2. [The Kelly Criterion: You Don’t Know the Half of It by Alon Bochman](https://blogs.cfainstitute.org/investor/2018/06/14/the-kelly-criterion-you-dont-know-the-half-of-it/)
3. [Python Risk Management: Kelly Criterion by Lester Leong](https://towardsdatascience.com/python-risk-management-kelly-criterion-526e8fb6d6fd)
4. [Practical Implementation of the Kelly Criterion by Andrea Carta and Claudio Conversano](https://www.frontiersin.org/articles/10.3389/fams.2020.577050/full)
5. [What AngelList Data Says About Power-Law Returns In Venture Capital by AngelList](https://angel.co/blog/what-angellist-data-says-about-power-law-returns-in-venture-capital)

## 2\. 利用 HASH\.ai 模拟公司存活率

我们将从一个充满假设的模型，转向另一个充满假设的模型。我最近听说了这家公司 [HASH.ai](https://hash.ai/ 'hash')这让你“几分钟内就能构建多智能体模拟”。也就是说，创建多个可以相互交互的对象，然后观察会发生什么。你可以阅读更多关于基于智能体建模的内容 [here](https://hash.ai/blog/what-is-agent-based-modeling 'hash')

![post](../../../blog/2020_12_02_kelly/kel_10.webp)

我想玩玩这个工具 [^7]模拟了我们在前面部分中做出的一些假设。风险投资困难的一些原因是许多公司失败，或者增长速度远低于预期。让我们来模拟一些在经济环境中成长的公司。

我还是做一些简化的假设：

- 我们知道公司每年的平均存活率。我滥用概率来假设每日存活率
- 基于此，我还推断出每日失败率
- 我们还知道公司每年的平均收入增长率。据此我推断出一个非常粗糙的每日增长率

![post](../../../blog/2020_12_02_kelly/kel_11.webp)

我把这些都放进了一个 HASH\.ai 项目，修改了他们的一个模板。因为很多文件是用Javascript写的，花了很多时间调整\.\.\.\.\.\.我不懂Javascript。但我觉得最终我大致上能用了 [^8]\.

模型模拟公司为绿色盒子，每天高度不断增长，高度代表公司规模。在任何时间点，公司都可能失败，盒子燃烧燃烧 [^9]\.我们可以看到有多少公司能长期存活下来。以下是示例：

![post](../../../blog/2020_12_02_kelly/kel_12.webp)

根据目前的假设，幸存者比我预想的多得多，虽然我们花了很长时间才看到任何100倍连队。也许可以回头调整假设。

HASH\.ai 还能绘制数据随时间变化。我现在的模型显示的是幸存者与失败者的稳定状态。

![post](../../../blog/2020_12_02_kelly/kel_13.webp)

这只是为了好玩，大部分假设都需要调整。最终模型是 [here](https://core.hash.ai/@leonlinsx/wildfires-regrowth-3/main 'model') 如果你想尝试一下。我很想看到有人创建更复杂的创业增长模型。

## 其他

1. [Unit economics of vending machines](https://thehustle.co/the-economics-of-vending-machines/ 'econs')
2. [Online game networking explained](https://www.pcgamer.com/netcode-explained/ 'netcode')
3. [What we can learn from War and Peace and a napkin about risk.](https://refractor.substack.com/p/the-story-range? 'refractor')
4. [American PhDs are failing at start-ups](https://marginalrevolution.com/marginalrevolution/2020/12/american-ph-ds-are-failing-at-start-ups.html 'phd')
5. [This isn't Sparta](https://acoup.blog/2019/08/16/collections-this-isnt-sparta-part-i-spartan-school/ 'sparta')

## 附录

![post](../../../blog/2020_12_02_kelly/kel_14.webp)

[^1]: 莎拉在交朋友方面表现得很棒

[^2]: 还有一个无关的观点，如果你看到这么有吸引力的机会，很可能是被骗了

[^3]: 我想再次强调我们这里简化了很多。首先，天使投资的流动性极差是个大问题，因为我们后期模拟中没有重复、连续的投注特性。另外，顺便说一句，我可能有数学错误，如果你发现错误请指正。

[^4]: 他们说要提前规划\.\.\.\.\.\.

[^5]: 5\%除以（100\%减去64\%）

[^6]: 你会发现，对中奖概率的微调会显著改变建议的投注百分比和预测回报

[^7]: 重点是玩法。我最终的模型非常糟糕。

[^8]: 你会注意到代码中会提到树木、火灾等元素，这些是原始模拟野火模型的遗留。

[^9]: 我想说这是刻意为之\;我没弄明白怎么改很多功能。
