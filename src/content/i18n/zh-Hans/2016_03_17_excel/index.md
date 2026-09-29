---
title: "Excel计算效率"
description: "关于Excel速度提示的笔记"
pubDate: 2016-03-17
category: System Design
tags: ['investment banking']
heroImage: './e_1.png'
locale: 'zh-Hans'
sourceSlug: 'excel'
sourceHash: '658f73ba1e40df367c86978fb2e3fde6def4efdf9bf18e1d34975fed5dc10592'
---

前段时间我不得不深入研究Excel的效率。我们在银行业务中使用的一些文件计算起来很慢，我们想看看还能改进哪些地方。网上有很多内容，这些是我找到的最有帮助的网站。不过请注意，我并不完全同意所有内容：

1. Microsoft 自家 ['improving performance' writeup](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)> 'office performance 2007')
   - “有了Excel 2007”大网格“，性能真的很重要”
   - “Excel在整体计算过程中分为三个不同阶段：
     - 建立初始计算链，确定从哪里开始计算。这个阶段发生在工作簿加载到内存时。
     - 跟踪依赖关系，标记单元格为未计算，并更新计算链。该阶段在每个单元格条目或变化处执行，即使是手动计算模式。通常执行速度快到你几乎察觉不到。
     - 计算所有公式。作为计算过程的一部分，Excel会重新排序和重构计算链，以优化未来的重新计算。”
   - “即使之前判例似乎没有变化，每次重算都会重新计算一个易失函数。使用大量易失函数会减慢每次重算，但对完整计算没有影响。
     - Excel 中内置的一些函数显然是易失性的：RAND（）、NOW（）、TODAY（）。其他则不那么明显的易失性：OFFSET（）、CELL（）、INDIRECT（）、INFO（）。
     - 一些此前被记录为波动性函数实际上并非波动性：INDEX（）、ROWS（）、COLUMNS（）、AREAS（）。”
     - 注意：后续版本可能有所变化
   - 他们列出了触发重置的易变性行动
   - 他们还提供了一个宏来衡量计算时间
   - 他们给了一些 [golden rules to follow,](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#first-golden-rule-remove-duplicated-repeated-and-unnecessary-calculations> 'golden rules') 总体意图简化
     - 去除重复、重复和不必要的计算
     - 使用最高效的函数
     - 善用智能重新计算
     - 每一次变化都经过时间和测试
   - 他们给出了一个很好的例子 [how to simplify a problem](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#dynamic-count-unique> 'example problem')
   - 并列出一长串常见的瓶颈

2. [Another site](https://trumpexcel.com/suffering-from-slow-excel-spreadsheets/ 'trump excel') 附带Excel速度提示
   - “使用辅助列”
     - 非常同意，而且很多人通常都没怎么用
   - “使用Excel表格和命名范围”
     - 同意命名范围，虽然我经常懒
   - “使用更快公式的技巧”
     - 注意反复出现的建议

3. [Yet another site](http://www.databison.com/how-to-speed-up-calculation-and-improve-performance-of-excel-and-vba/ 'databison')
   - “分离重复的公式并迁移到单细胞”
     - 与上面辅助者列的观点相关
   - “按出现频率排序的巢状条件”
     - 其实我记不清现在是不是这样了，所以请自行参考

4. 最后，有一个比较速度的网站 [vlookup vs index match](http://www.exceluser.com/blog/727/excels-fastest-lookup-methods-the-tested-results.html 'vlookup vs index match')
   - 指数匹配在效率上总是更优的
   - 话虽如此，当只是简单拉取，或者我觉得我的模型会被索引匹配弄糊涂时，我还是会用vlookup。设计时要考虑最终用户。
