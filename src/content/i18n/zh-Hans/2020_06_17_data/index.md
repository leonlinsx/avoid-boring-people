---
title: "并非所有事情都是内幕交易"
description: "专业投资者使用的工具"
pubDate: 2020-06-17
category: Investing
tags: ['data']
heroImage: '../../../blog/2020_06_17_data/data_9.webp'
locale: 'zh-Hans'
sourceSlug: 'data'
sourceHash: 'b716115438b8c73071627a4fbd38849089af6c74f2ff19a81e3e14aa975d6a5d'
---

## 摘要

作为散户投资者，你在信息上不太可能有优势\;你应该在其他地方找到优势

## 投资中的数据运用

上周，我们考察了 [how companies use machine learning to take data, process it, and come to a conclusion.](/writing/ml 'ML')

本周，我们将探讨一个更以人为本的流程。我们将带领分析投资公司的分析师如何获取数据、分析数据并形成投资论点。与投资者合作 [spending >$30bn on data](https://www.ft.com/content/222855de-4fbf-11e9-9c76-bf4a0ce37d49 'spend')那么多钱都去哪儿了？

我会从一个典型的状态开始 [long/short fundamental hedge fund](https://en.wikipedia.org/wiki/Long/short_equity 'LS') 视角，而非定量公司 [^1]\.为了方便起见，我也会从美国公司的角度讨论，尽管以程适用于国际。

我的目标是让你作为散户投资者更好地理解专业人士的优势，以及这意味着你可以拥有的优势 [^2]\.

### 公共数据

上市公司 [have to file financial statements regularly with the SEC.](https://www.sec.gov/edgar.shtml 'SEC') 这些信息在公司投资者关系页面和 [SEC Edgar](https://www.sec.gov/edgar/searchedgar/companysearch.html 'Edgar') 让你去搜寻。

公司还会在每次重大财报发布时定期召开财报电话会议，任何人都可以拨入 [^3]\.通话记录有时也可以在投资者关系页面或类似网站找到 [Seeking Alpha.](https://seekingalpha.com/earnings/earnings-call-transcripts 'SA') 然而，它们可能比财务报表更难追踪。

公司通常通过以下方式发布新闻 [PR newswire](https://prnewswire.mediaroom.com/about-pr-newswire 'PR') 同时也会在自己的网站上发布。这些新闻可以是上述财务报告，或是收购和管理层变动等特殊事件。这些新闻通过公关新闻线向其他新闻网站发布。

除了上述公开数据外，分析师还会花时间浏览推特、谷歌搜索或阅读Reddit。他们将所有这些一手资料汇总起来，形成是否投资公司的意见。

这是投资研究过程的一部分，即发现和利用公开信息，每个人都可以做到。基于以上，你已经拥有足够的数据来构建公司财务模型、分析趋势并形成投资论点。事实上，许多散户投资者从未超过这一部分，仍然能为自己做得不错。正如我之前提到的，成功投资有很多途径。

![post](../../../blog/2020_06_17_data/data_1.webp)

### 公共数据访问

那么如果仅仅需要这些，为什么还存在这么多公司来向投资者提供信息呢？彭博社是如何制作的 [$20k a year from a single subscription?](https://www.vox.com/2020-presidential-election/2019/12/11/21005008/michael-bloomberg-terminal-net-worth-2020 'Bloomberg')

事实证明：

1. 直接从SEC Edgar获取数据非常麻烦
2. 人们总是想要更多数据，因为他们认为数据越多越好
3. 还有很多其他非公开数据可以购买

在本节中，我将讨论第一点，即用户体验。

假设你想快速查看一家公司的长期收入。如果你用Edgar的传统方式，你得搜索该公司，结果会是这样的页面：

![post](../../../blog/2020_06_17_data/data_2.webp)

然后你需要查找每个你想要的申报文件，下载所有文件，并将数据复制到电子表格中 [^4]\.清理数据并添加行进行逐年计算后，你终于得到了想要的趋势。

这付出了很多努力，回报却很少，这也是彭博、FactSet、汤姆森等公司存在的原因。他们收集财务数据，并在平台上方便访问。

你为寻找一家公司收入所做的所有工作？FactSet为所有上市公司提供了：

![post](../../../blog/2020_06_17_data/data_3.webp)

当然，存储的数据并不总是完美无缺 [^5]\.然而，对于所有需要快速查阅资料的人来说，已经以易于理解格式完成所有工作工作的平台是无价的。只要几键就能找到数据，你就不需要花费数小时提取数据。这种便利性是平台能够吸引粘性订阅者的原因之一 [^6]，尽管破坏者喜欢 [Koyfin](https://www.koyfin.com/ 'koy') 他们试图压低他们。

还有像BamSEC和Last10K这样的公司，让查找申报更方便。例如，BamSEC会将不同类型的申报归类归类，显示申报的标题，并让你快速查找之前的申报版本。这些公司的功能不如上述平台丰富，但仍能节省分析师的时间。

![post](../../../blog/2020_06_17_data/data_4.webp)

### 卖方研究数据的访问

我们已经谈过用户体验，现在让我们来谈谈获取更多数据和付费。

除了提供公司的汇总财务数据外，彭博等平台还提供卖方研究估算。

提醒一下，这些研究人员是投资银行的人员，负责发布公司报告。当新闻说“分析师将公司评级降为卖出”或“银行提高了公司的目标价”时，通常会提到这些人。卖方研究则提出自己的财务模型，对未来公司财务状况做出估计，据称用模型来得出价格目标 [^7]\.

许多投资者喜欢看到卖方数据，以便了解市场共识的现状。例如，如果卖方对明年收入的平均估算是100美元，但你认为会是1000美元，那么你要么即将经历非常愉快的时期，要么是非常糟糕的体验。

如果你是专业投资者，也可以直接给银行发邮件，获取他们的研究 [^8]\.如果你真的想，可以把所有这些PDF和Excel整理在一起，自己做基准测试。

显然没人真的想这么做 [^9]研究人员将这些数据提供给平台，平台再向投资者展示。如果你想快速总结卖方共识的位置，也只需几个关键点击即可获得。

![post](../../../blog/2020_06_17_data/data_5.webp)

### 公司管理层的访问

许多投资者根据管理团队的质量来评估公司。为此，公司和卖方研究都会定期举办投资者会议。这些会议的目的是让管理层与投资者见面，向新投资者解释公司战略，并回答提问。

投资者可以根据与管理层的会议更新财务模型或对公司的看法。例如，如果管理团队对您的问题反应不佳，您可能有兴趣做空该股票。

“等等，这听起来像是内幕交易。”

不，不是。你会觉得巴菲特的年度股东大会， [attracting 40k people yearly](https://www.investopedia.com/articles/investing/121715/how-attend-berkshire-hathaways-annual-meeting.asp 'Buffett')，算是内幕交易吗？如果不是，上述会议有什么不同？没被邀请参加派对并不代表违法。管理层有规定可以说什么，但这种做法已经存在很久了。

![post](../../../blog/2020_06_17_data/data_6.webp)

### 行业专家

投资者也希望与他们研究的行业的员工交流。例如，如果我想了解Facebook广告收入的情况，我会想与Facebook广告的大买家交流。如果他们对产品更乐观，那可能是积极信号。

[Expert network firms like GLG, AlphaSights, Third Bridge](https://www.forbes.com/sites/jonyounger/2020/02/12/the-global-expert-network-business-is-growing-fast-meet-inex-one/#435336b2f257 'GLG') 存在的目的是帮助投资者找到这样的人选。这些公司拿钱帮投资者联系行业专家\;顾问们也按时间获得报酬。你会惊讶有多少前高管在业余时间做这类工作。

“等等，这听起来像是内幕交易。”

不，不是。如果你有兴趣投资一家医疗公司，你会觉得向医生朋友询问这家公司是内幕交易吗？如果不是，那为什么上述情况会不同？仅仅因为你负担不起中间商，并不意味着这是违法的 [^10]\.

![post](../../../blog/2020_06_17_data/data_7.webp)

### 行业数据

最后，投资者也在使用“另类数据”来更好地预测公司业绩。例如，如果你关心某个移动应用的表现，你可能会关注该公司的应用下载数据。如果你关注电商销售，你可能会关注某个行业的信用卡数据。如果你想监测卡车重量，以估算一家公司是否销售更多（更重型的卡车），有专门的公司专门做这类工作 [^11]\.

有一个 [large market of sellers for such data](https://alternativedata.org/data-providers/ 'mkt')\.像AppAnnie、SensorTower、QuestMobile这样的公司以提供应用数据而闻名。像Earnest research、Second Measure这样的公司，也同样以提供信用卡数据而闻名。

“等等，这听起来像是内幕交易。”

去商店数顾客会违法吗？

![post](../../../blog/2020_06_17_data/data_8.webp)

### 这对零售投资者意味着什么

我们已经分析了典型基本面投资者可能使用的公开和私募数据。这对你作为散户投资者意味着什么？

如果你认为你的投资优势在于拥有比其他人更多的公司信息，那么你需要有可信地相信你的调研过程比上述更为详尽。或者，你的调研过程足够不同，使用了典型专业人士可能使用的不同来源。

让我们来看看几个例子。

如果你认为你的优势来自一篇报纸文章，提到管理层对新产品感到兴奋，那你就得证明管理层早就和投资者讨论过这个问题。

如果你认为你的优势在于你在推特上看到的应用下载数据，你就得证明投资者在你之前并没有接触到这些数据。

如果你认为你的优势是那个行业专家的亲戚，你就得证明他们比专业人士接触的人更了解这个行业。

需要说明的是，上述所有情景都有可能成立。也许管理层最近改变了主意，投资者看到了应用数据却不在意，或者行业专家其实并不那么专业。

我的观点不是说这不可能，而是你应该了解竞争对手是什么，以及这对你需要拥有的优势意味着什么。

例如，如果你找到一家拥有有用数据集但尚未向投资者销售的小公司，这可能是一个优势来源。

如果你雇人做体力活，那 [counting store traffic and taking pictures of receipts](https://www.qsrmagazine.com/fast-food/luckin-coffee-faces-fraud-allegations-anonymous-report 'luckin') 与其依赖信用卡数据，不如说这可能成为Edge的来源。

如果你匿名访问公司工厂，了解它们有多忙，这可能会成为一个优势来源。

你要做的是找到那些普通职业选手不愿意做的事情。在一个职业选手能获得比你更多资源的世界里，你需要在那些不太理想的领域寻找优势。看看下面的图表，发现那些漏洞。

![post](../../../blog/2020_06_17_data/data_9.webp)

[^1]: 我没有量化公司的经验，所以不能亲自发言。我确实认识量化分析师 [pay for order flow though,](https://www.institutionalinvestor.com/article/b1m2p1cv68bx56/Twitter-Freaked-Out-Over-Robinhood-Selling-Its-Trade-Flow-But-the-App-and-Others-Have-Been-Doing-It-for-Years 'order') 这很可能包含在300亿美元的数字中。另外，注意像对冲基金这样的投资公司与投资银行不同\;大多数投资分析师的工作与投资银行家完全不同。 [Sellside equity research is the role most similar to a hedge fund analyst, but researchers don't actually invest money.](/writing/time 'Sellside')

[^2]: 这里的优势指的是你相较于竞争对手的相对优势。我们讨论过 [why this was important in investing last month.](/writing/relative_billionaire 'edge') 感谢Barak Paz，是基于我们一次对话促使我写这篇文章。

[^3]: 但通常不会提问。一些罕见的公司允许公众提问\;大多数问题来自卖方调研（而非买方投资分析师）

[^4]: 如果你从8K数据中提取数据，而不是从10Q\/K中提取数据，情况更糟。注意没有标题，因为SEC喜欢看你受苦。

[^5]: 投资银行工作很大一部分是下载数据，然后做出必要的调整以“准确”反映公司情况。这里准确指的是你老板想展示的任何内容。

[^6]: 但这并不是唯一的原因。彭博社有社区感，存在状态信号，解锁直接消息功能也很有用。拜恩·霍巴特对此有更详细的介绍 [here](https://marker.medium.com/why-its-hard-to-kill-the-bloomberg-terminal-61073482e496 'Byrne')

[^7]: 他们是先设定价格目标再调整数字以适应，还是反过来，我就留给你自己判断。请注意，这个批评既适用于卖方投资者，也适用于买方投资者

[^8]: 散户投资者在这里大多运气不佳。你通常必须是银行的客户并通过他们进行交易，他们才会关心。这涉及到卖方研究的商业模式，目前不在讨论范围内。

[^9]: 除非你是被老板要求这么做的投资银行家，那你就得花好几天手动从有限的PDF中输入数字，因为你的银行被限制了其他银行的研究。然后你还得手动调整估计，因为有些卖方数据过时或假设错误。是的，这种情况经常发生。是的，大多数时候都是浪费时间。银行业是光鲜亮丽的工作。

[^10]: 不过，这件事确实有可能变得更加模糊。关于SAC所谓内幕交易的《Black Edge》一书讨论了这里可能存在的滥用。这些聊天都应该被合规部门监控。有时投资者与行业专家建立了“友谊”，然后开始索要重要的非公开信息。

[^11]: 我一时找不到这家公司，虽然我记得在哪儿读过。我觉得他们用摄像头数据来拍摄卡车，看看它们离路的距离。越近越重，意味着销量越多。
