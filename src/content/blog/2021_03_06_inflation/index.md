---
title: 'What do we really know about inflation'
description: 'Causation, measurement, and adjustments'
pubDate: 2021-03-06
category: Finance
tags: ['inflation']
heroImage: './i_3.webp'
---

## Takeaway

We probably know less about inflation than we believe we do.

## What I don't understand about inflation

I don't understand inflation.

I get the concept of prices rising, sure. But for the longest time I haven't understood what _causes_ inflation, how to _measure_ inflation, and how to _adjust_ inflation.

**I also have a feeling nobody really knows either.**

That's ridiculous, you might say, there's a whole group of people out there [making policy based on inflation targets](https://www.federalreserve.gov/faqs/economy_14400.htm 'fed'), talking about [hedging against inverted yield curves](https://www.chathamfinancial.com/insights/hedging-in-an-inverted-yield-curve-environment 'yield'), and if google trends is to be believed, some sonic the hedgehog game [(apparently some weird nsfw meme).](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/SonicInflationAdventure 'sonic')

![post](./i_1.webp)

Yeah, but that doesn't mean they know how stuff works. If my work experience has taught me anything, it's that people can do huge amounts of work without understanding what they're doing [^1]. Nassim Taleb wrote about this before, in a story of a finance trader becoming successful trading green lumber [without understanding what it was.](https://fs.blog/2016/11/green-lumber-fallacy/ 'taleb')

A big problem with inflation is firstly **deciding what counts** towards it. **This is not a trivial task,** and if you think it is, ask yourself these questions:

- What broad categories of "things" do you want to include? Only physical goods? What about services?
- Whatever thing you include, how are you going to measure its price?
- How do you account for outlier data points, such as when toilet paper pricing spikes?
- How often do you take measurements?
- How do you account for quality improvements in those goods? If quality goes up and price stays same, is that deflation?

As you can see, it's not just "take the Consumer Price Index" and be done with it. In fact, the US Fed doesn't officially use the CPI, opting for another Personal Consumption Expenditures (PCE) price index instead [^2]. And even then, [they acknowledge its imperfect nature:](https://www.federalreserve.gov/econres/notes/feds-notes/comparing-two-measures-of-core-inflation-20190802.htm 'fed')

> total PCE price inflation is highly volatile, even on a year-to-year basis. Consequently, economists and policymakers have suggested alternative procedures for reweighting the index's components so as to reduce the variance of the measured inflation, to better distinguish transitory from persistent movements, and, ultimately to better anticipate future developments in inflation

We recently discussed how definitions were important when dealing with [monopolies](https://leonlins.com/writing/2021_02_13_monopoly/ 'monopoly'); regulations depend on definitions.

Similarly, what you define as inflation has large effects on public policy and thus the economy. Imagine if the Fed only looked at the rising costs of cities, and left out suburban areas. Or if they only looked at energy costs, and left out housing costs.

Another big problem with inflation is that it's **influenced by expectations.** Hoping for it to follow some mathematical law is like expecting the stock market to perfectly represent the present value of future cash flows. Which is why it's so hard to aim for an inflation target:

![post](./i_2.webp)

The US Fed has a 2% goal, so the first sentence above can either be interpreted as 1) the Fed is horrible at its job or 2) it's genuinely a difficult thing to do. I'm inclined to believe the latter, given the complexity of the system [^3].

Knowing that it's an expectations game also explains why there's always uncertainty in [interpreting Fed statements](https://www.stlouisfed.org/open-vault/2019/may/how-read-fomc-statement 'Fed') on monetary policy (interest rates), [even though the Fed is trying to speak more plainly in recent years](https://www.bankrate.com/banking/federal-reserve/fed-simple-communication-may-be-confusing-markets/ 'Fed')

Doing so gives them flexibility, since there's so much about the economy that is not perfectly understood. **The ambiguity gives them buffer room for the unknown unknowns.** And then you can pretend that was the plan all along, building more confidence, continuing to control expectations. If people lose confidence that the Fed knows what it's doing, that causes a negative feedback loop, like a bank suffering from a run trying to convince customers it's not suffering from a run.

And when people lose confidence, you get situations like these:

![post](./i_3.webp)

I feel like these are the only things I'm comfortable saying about inflation:

1. Prices generally go up by small amounts over time, and when compounded the nominal values become large over long time periods
2. Prices can go up by large amounts in small periods of time, but what causes this is hard to say
3. It's hard to target a small increase in prices and easier to target a large increase. Nobody wants large increases though
4. A lot of price changes are expectations driven, so maybe it's inherently unpredictable

I'm not alone in thinking this, by the way. [Economist John Cochrane wrote about inflation recently](https://johnhcochrane.blogspot.com/2021/02/inflation-issues.html 'john') [^4], and also wonders how much we really know. He concludes by thinking that services could become a larger component of inflation over time, continuing trends of services inflation and goods deflation.

Maybe inflation's like the tide - [it goes in, it goes out, you can't explain that.](https://www.newser.com/story/109164/bill-oreilly-to-atheists-you-cant-explain-the-tides.html 'tide')

[^1]: Myself included, having done so multiple times.

[^2]: ["While the CPI and PCE price index both provide measures of how prices are changing over time, they are not constructed in the same way. One difference is the smaller number of items in the basket of the CPI. The CPI reflects out-of-pocket expenditures of all urban households, while the PCE price index also includes goods and services purchased on behalf of households. Another difference is the expenditure weights assigned to each of the CPI and PCE categories of items"](https://www.clevelandfed.org/en/our-research/center-for-inflation-research/consumer-price-data.aspx 'fed')

[^3]: I couldn't find a way to fit this in the main body flow, but there's a whole issue with measurement error as well. Imagine you have a normal ruler that lets you measure things in centimeters (take that americans). If you were told to measure something that was in millimeters (that's smaller than centimeters for the americans out there), would you be able to do so? Given the precision of your measuring tool, you wouldn't be able to do so. Likewise, particularly when targeting such a low inflation rate, you have to wonder how wide the confidence interval is.

[^4]: His article was the inspiration behind getting my thoughts down on this topic.
