---
title: 'Set a reminder in your personal CRM to read this'
description: 'Pair trades, personal CRMs, and self awareness'
pubDate: 2019-08-31
category: Tech
tags: ['software', 'investing']
heroImage: './c_4.webp'
---

## Takeaways

1. Finding a pair trade in a bubble might be better than shorting it or riding the momentum
2. What is a personal CRM and why are people talking about it?
3. We don't know ourselves very well; how to increase self-awareness

### Bubbles and russian spies

With all the news about bubbles this year, I wanted to highlight [Byrne Hobart's post about them.](https://medium.com/@byrnehobart/so-youve-spotted-a-bubble-3f2fa5cf49a9 'Bubble') [^1] What should you do if you think an asset's current price represents a bubble? Byrne frames three schools of thought below. As always, none of this is financial advice.

> \[Firstly:\] The Brave, Stupid, and Intellectually Consistent Approach. You could just short it. \[...\] It’s hard, though, because typically bubbly assets are priced such that they get higher returns than comparable assets, just returns not quite high enough to compensate for the risk. \[...\] Bubbles also tend to persist for a long time, despite their intrinsic instability, because they’re partly self-perpetuating.

Shorting [^2] is sexy, because you're being contrarian and taking theoretically unlimited risk to prove your intellectual superiority to the common dumb investor. [There's even an oscar nominated movie about shorting the 2008 housing crisis](<https://en.wikipedia.org/wiki/The_Big_Short_(film)> 'movie'). The problem with shorting is that timing is key. You can be right but early and still blow up. There are plenty of infamous shorts that lost billions for their investors, such as [Ackman and Herbalife](https://www.cnbc.com/2018/04/05/how-bill-ackmans-hedge-fund-empire-crumbled-in-less-than-three-years.html 'Ackman'), [Einhorn and Netflix](https://www.forbes.com/sites/antoinegara/2019/03/05/after-horrendous-investing-run-david-einhorn-exits-billionaire-club/#3a140043498c 'Einhorn'), or [whoever was short squeezed by Porsche and Volkswagen in 2008.](https://www.reuters.com/article/us-volkswagen/short-sellers-make-vw-the-worlds-priciest-firm-idUSTRE49R3I920081028 'Porsche') Note that I'm not saying that Ackman and Einhorn were wrong about these companies. They could still be right, but they've lost so much money in the meantime it's a moot point.

Let's take Overstock.com as another example. Before their [CEO resigned so he could let everyone know he'd dated a Russian spy,](https://www.forbes.com/sites/laurendebter/2019/08/22/the-exclusive-inside-story-of-the-fall-of-overstocks-mad-king-patrick-byrne/#176918ea53a5 'Forbes') [^3] he was trying to save the company in 2017 by pivoting to blockchain. Suppose you thought Overstock was going to fail at this too, and shorted Overstock at $20 in Aug 2017:

![post](./c_1.webp)

As the stock price creeps up, you double down, convinced that it cannot last. Somehow, it does, and you're looking at a $60 price in Nov 2017:

![post](./c_2.webp)

Woops. Not only do you have a paper loss, but your exposure is a multiple of what you started with and were comfortable with. If you liquidated your position now you'd lose $40 - the current $60 less the $20 you initially made. You have a vendetta now and are determined to short this stock to the ground or go bankrupt trying, so you hold on till the next year:

![post](./c_3.webp)

Your broker comes back from vacation and realises he forgot to issue you a [margin call](https://www.investopedia.com/ask/answers/05/shortmarginrequirements.asp 'margin') all this time, and does so now in a panic. When you're short a stock, you usually need ~130% of the value of the stock as collateral, back up funds [^4]. When the stock was at $20, having $26 set aside wasn't an issue. Now though, you need $104 set aside, and the broker wants you to top up the difference of $78 ($104 less $26). Depending on how much money you had at the beginning, this additional $78 (3x the initial exposure!) could easily wipe you out. You're forced to liquidiate your position and make up the difference by setting up a Go Fund Me.

And then of course this happens:

![post](./c_4.webp)

The key here is that you were right - the blockchain pivot Overstock attempted wouldn't work. But you were wrong on timing and lost your money and your reputation. Even when shorting a stock is 'obvious', such as [bad quality companies changing their name to get a price bump](https://www.winton.com/longer-view/the-history-of-company-names 'names'), the [time period](https://www.sciencedirect.com/science/article/pii/S0165176519301703 'time') required for your thesis to play out might bankrupt you beforehand.

Interestingly, famous short sellers [Robert Wilson and Jim Chanos have this to say about shorting:](https://blogs.cfainstitute.org/investor/2016/12/22/lessons-from-a-legendary-short-seller/ 'short')

> “I would say from the beginning to the end of it \[...\] I may have broken even on my shorts.”

> “A good short portfolio allows you to be more long... And that’s the crux of what we do."

To be clear, I'm not saying to avoid shorting, or that shorting is bad for the economy. [There's research](https://marginalrevolution.com/marginalrevolution/2019/08/short-selling-reduces-crashes.html 'short MR') indicating it might be good, and many people have made money on shorts. I'm saying that it's difficult to get right.

What's an alternative?

> \[Secondly:\] The Mercenary But Profitable Approach. \[...\] "We were quite happy to be part of the bubble, but to do it in positions that were highly liquid, so that we could exit the market quickly if we wanted to."

In this version you try to ride the wave for as long as you can, before getting off as late as possible [^5]. This seems to me what most professional investors are doing in reality, despite the constant proclamations of being long term holders. If it works, it works though, and there have been many successful people using this strategy.

> Since it’s dangerous to do this with just one, they’ll pick a few at once, hoping they won’t all collapse at the same time. This diversification allows them to lever up a bit, which juices returns. \[...\] as measured risk rises, they want to take leverage down. But taking leverage down means unwinding several trades at once \[...\] hurts the returns of traders who followed your strategy and raises correlations, forcing them to sell more, too.

The downside is when you're just too late on a few of your bets, and are then forced to unwind your positions due to risk parameters your company set on how much you can lose at a time. It's kinda a live fast, die young, start another fund with a different name strategy.

> \[Lastly:\] Nirvana: Positive Carry and Positive Skew. I’m going to humbly submit my own contribution to the Lewis-is-wrong field: The Big Short was actually not a great trade. If he were really on the ball, he would have written The Big Pair Trade. \[...\]

Byrne uses the housing crisis as an example. One factor in the housing crisis was how loans were packaged together in large pools, under the assumption that they were uncorrelated. Turns out that subprime loans were more correlated than expected, implying:

> it means AAA-rated slices of subprime-backed CDOs were not, in fact, worthy of the AAA rating. But it also means that the riskiest portion, the equity tranche, is less risky than it looks: high correlation within a pool of securities means mass defaults are more likely, but it also means that zero defaults are more likely.

Since the securities are more correlated, you are likely to get more extreme events not just on the downside but also on the upside. To put this in practice,

> an investor could buy a small slice of the equity, buy insurance against a big chunk of the AAA-rated debt, and end up with \[...\]:

> The equity’s returns more than compensated for the cost of buying insurance against the AAA-rated slice.

> It would make a little money if real estate drifted up, because the equity would be worth more while the AAA insurance couldn’t be worth much less.

> It would make a lot of money if real estate dropped.

Byrne concludes by saying not all bubbles have situations like the third above, and it can be hard to identify how to set up a position that takes advantage of it. If you do, it's potentially a less risky strategy of treating a bubble.

### Don't worry, you're a level 5 contact in my personal CRM\*\*

The growth of [Superhuman](https://techcrunch.com/2019/06/27/my-six-months-with-30-month-email-service-superhuman/ 'techcrunch'), an email app that charges a fee in return for a supposedly revolutionary experience, has spurred a craze in [premium subscription services](https://techcrunch.com/2019/08/27/kleiner-perkins-bets-on-a-premium-email-service-thats-bringing-slack-groups-into-gmail/ 'kleiner'). Recently, tech twitter revived the idea of a personal CRM (Customer Relationship Management), i.e. a software that can help you manage your personal relationships.

![post](./c_5.webp))

Opinion was divided. Some people were... lukewarm

![post](./c_6.webp)

Others claimed Twitter was already a personal CRM

![post](./c_7.webp)

[And some people pointed out how this recurring idea continues to attract new startups](https://twitter.com/devahaz/status/1164224618602758144 'twitter')

It's easy to be dismissive. Why would people want scary software that tracks all of your relationships, saves all of your interactions, and makes all of you birthday wishes seem forced and inauthentic?

Oh wait.

![post](./c_8.webp)

Whether or not you think [Facebook has Zucked the world](https://www.theguardian.com/books/2019/feb/07/zucked-waking-up-to-facebook-catastrophe 'FB'), its success tells me that people do want a way to manage their personal relationships. A personal CRM is not a stupid idea and I wouldn't dismiss it outright. The difficulty lies in how to innovate on our existing systems and also in getting people to pay for it.

The ease of keeping in touch with people has made us feel like we _should_ keep in touch. We used to be able to excuse our lack of keeping in touch with an "Oh you never got my letter? So strange, must be the postal system". We no longer have that luxury now, and have to struggle with seeming to care about your friend's 50th throwback thursday insta post. We are overwhelmed.

People who are asking for a personal CRM want something that remembers the people they've met, knows relevant background context they've shared, prompts you about important dates, and reminds you to ping someone now and then, while still keeping a high degree of privacy and security. I can see why others are outraged at this idea, since it involves outsourcing social effort by the individual to a computer. "Oh she's so sweet, she remembered my birthday!" sounds better than "Yeah his personal CRM sent me an gift card to Blockbuster". Making it easy also makes it inauthentic. What does it mean to be human if a computer is conducting all our social interactions?

However, a system storing important information about friends is not a new idea. I'm sure most of us grew up with phone and address books of our contacts. [David Rockefeller kept index cards of all the important people he met.](https://www.forbes.com/sites/carminegallo/2017/12/07/david-rockefellers-rolodex-offers-a-master-class-in-making-friends-and-influencing-people/#5b1525625cc4 'David') Just because we're now migrating this to the cloud doesn't mean the end of true friendship. As with most tools, it will be up to us to use newer systems for good or for bad.

Would people pay for this? People pay for LinkedIn Premium so there are precedents. The tricky thing here is that fundamentally this CRM is more useful the more data it has, meaning the more people using it the better your experience. This [network effect](https://www.nfx.com/post/network-effects-manual 'network') implies that charging users will be detrimental to growth, since you want minimal barriers to entry. It's also why most social networks make money off ads rather than subscription.

I'm naturally clingy, and like to keep in touch with people [^6]. Having a personal CRM would be helpful, but I'd be unwilling to pay for one, and I think the majority of people wouldn't either. They seem to occupy a niche space that has potential but can't monetize efficiently. While I think that personal CRMs will continue to be around and re-invented, I'm 60% certain that none of them can hit substantial scale as long as they focus on selling to the individual [^7].

### Everywhere is Lake Wobegon

Most people try to prove they're right - about their business idea, hot stock pick, or the best time travel show of all time [^8]. I'd encourage you to do the opposite. If you have a strong opinion on a topic, you should instead seek to prove yourself wrong [^9]. Rigidly sticking to your beliefs without examining them is the easy path towards [confirmation bias.](https://www.psychologytoday.com/us/blog/science-choice/201504/what-is-confirmation-bias 'confirm')

We like to think we ourselves well; our likes, dislikes, and biases. After all, who better to describe yourself, than yourself? As this [Atlantic article](https://getpocket.com/explore/item/people-don-t-actually-know-themselves-very-well 'Atlantic') points out however, we aren't that self-aware. There's a discrepancy between how we predict we should behave vs how we actually behave, and other people might actually be better at describing our actual behaviour. The article cites [a meta-analysis](https://psycnet.apa.org/record/2010-25587-001 'meta'):

> Our results show that the operational validities of FFM traits based on observer ratings are higher than those based on self-report ratings.

FFM in the above refers to the [Five Factor Model of personality](https://www.psychologistworld.com/personality/five-factor-model-big-five-personality 'FFM'), which is [usually better regarded than the popular MBTI test.](https://leonlins.com/writing/2019_03_03_moloch/ 'MBTI') The meta-analysis claims that others rate our personality more accurately than we rate ourselves. I can't access the full paper, but there's a similar [older study](https://home.ubalt.edu/NTYGMITC/641/barrick%20mount%20strauss%20big%20five%20obs%20ratings%20JAP%2094.pdf 'old test') making the similar claim that other people's ratings of you have better validity.

The Atlantic article goes on:

> In the study, people outperformed their friends at predicting how anxious they’d look and sound when giving a speech \[...\] But they did no better than their friends (or than strangers who had met them just eight minutes earlier) at forecasting how assertive they’d be in a group discussion. And when they tried to predict their performance on an IQ test and a creativity test, they were less accurate than their friends.

Humans generally are badly calibrated in our estimations, overstating our ability in cases and understating our performance in others, depending on how we might be incentivised. You might recall the [Lake Wobegon effect](https://en.wikipedia.org/wiki/Lake_Wobegon#The_Lake_Wobegon_effect 'Lake') that describes how everyone thinks they're above average. The article suggests a few ways to achieve more self-awareness.

> One: If you want people to really know you, weekly meetings don’t cut it. You need deep dives with them in high-intensity situations.

> Two: \[...\] I’ve seen a growing number of managers write their own user manuals to help people understand what brings out the best and worst in them. But it’s even better to have the people who know you well write your user manual for you.

> Three: Put yourself in situations where you can’t ignore feedback from multiple sources.

Of these, number three sounds like the simplest approach to start with, as long as both you and your source know how to give and receive feedback [^10]. Number one might reveal your true inner workings, but I doubt many teams would put themselves in a true extreme situation, compared to the more common wilderness glamping company retreat [^11]. I like the idea of a user manual in number two and wish I had one of my own, but getting people to spend the time writing it for you is a tough sell. If anyone reading wants to volunteer...

Knowing that we don't know ourselves well is the first step. Unfortunately, just because you're aware of a behavioural bias doesn't mean you can fix it easily, if at all. [Kahneman](https://en.wikipedia.org/wiki/Daniel_Kahneman 'Kahneman') has spent his life studying biases and says he still falls for a majority of them. Besides the three points mentioned above, try [Steelmanning](https://rationalwiki.org/wiki/Straw_man#Steelmanning 'Steelmanning') rather than Strawmanning topics you disagree with, or [seeking out the weak points in your beliefs rather than continuing to emphasise the strong ones](https://medium.com/the-polymath-project/the-ideological-turing-test-how-to-be-less-wrong-6803a8c290cf 'less wrong'). Prove yourself wrong and you might be right more often.

## Other

1. Other people discuss [why](https://www.perell.com/blog/why-you-should-write 'why') and [how](https://jasonzweig.com/a-few-thoughts-on-journalism/ 'how') you should think about writing more [^12]

   > Writing is like weightlifting for the brain. Testing the limits of your ideas is the fastest way to improve them and raise your intelligence

   > I think you need all six of these qualities to succeed in journalism. \[...\] Curiousity, Skepticism, Persistence, Attention to detail, Responsibility, A thick skin

2. [Violent protests increased support for liberal policy due to greater mobilisation of voters](https://scholar.harvard.edu/files/renos/files/enoskaufmansands.pdf 'violent'). Something to think about in the light of recent protests and whether they could be effective.
3. ["Nobody ever says at a funeral, “He was too generous, too kind, and much too loving."](https://www.fastcompany.com/90348896/why-not-being-a-jerk-is-important-to-your-happiness-and-success 'jerks')
4. [SMCP came out with an overview of China Internet](https://www.scmp.com/china-internet-report 'smcp'), and their top trends were:

   > China’s ‘Copycat’ Tech Industry Is Now Being Copied

   > China is Racing Ahead With 5G

   > China is Using AI on a Massive Scale

   > Social Credit Is Becoming a Reality in China

   I agree with the first (and have for a while), but think the other three trends might be over exaggerated. [I've written about social credit misunderstandings before](https://leonlins.com/writing/2019_03_03_moloch/ 'social')

5. [Wait but why writes about why we do what we do](https://waitbutwhy.com/2019/08/fire-light.html 'wait but why'). If you like this topic, [Behave](https://www.goodreads.com/book/show/31170723-behave 'Behave') is a more comprehensive take on it.

**Footnotes**

[^1]: Byrne's [WeWork analysis](https://medium.com/@byrnehobart/what-is-we-understanding-the-wework-ipo-b74f0f1f1b46 'WeWork') was recently featured in [Matt Levine's Money Stuff](https://www.bloomberg.com/opinion/articles/2019-08-19/we-looks-out-for-our-selves 'Money Stuff') as well; awesome stuff Byrne!

[^2]: For the non-finance folks, [shorting](https://www.investopedia.com/terms/s/shortselling.asp 'short') is when you bet that a stock price will decline and borrow to buy it now e.g. borrowing one FB share for $180, selling it at $180, then hoping it goes to $100, allowing you to buy it back at $100. You return the FB share and have made $80. However, if FB went up to $280, you now have to buy it at $280 to return the share you borrowed, implying a $100 loss. Since stock prices can theoretically go to infinity but can at minimum go to zero, you could lose an unlimited amount on a short, whereas your potential gain is limited.

[^3]: This article is courtesy of [The Profile](https://theprofile.substack.com/p/the-profile-the-government-informant 'Profile'), a weekly newsletter by Polina Marinova that features many interesting stories of people. Check it out!

[^4]: Someone really needs to check my math on this

[^5]: I have never surfed before and this could be a horrible analogy

[^6]: Unfortunately, not quite true the other way around...

[^7]: Twitter is currently a $30bn company, so let's take $10bn as "substantial scale"

[^8]: For the record, it's [Doctor Who](https://en.wikipedia.org/wiki/Doctor_Who 'Dr Who'), particularly the brilliant episodes [Blink](<https://en.wikipedia.org/wiki/Blink_(Doctor_Who)> 'Blink'), [Vincent and the Doctor](https://en.wikipedia.org/wiki/Vincent_and_the_Doctor 'Vincent'), and [Heaven Sent](<https://en.wikipedia.org/wiki/Heaven_Sent_(Doctor_Who)> 'Heaven').

[^9]: No joke, I actually considered naming the newsletter Prove Me Wrong.

[^10]: Which is in itself a hard skill, but a topic for another day. One good tip I learnt a while back was that even if you think the feedback is false, it's still important since it represents how your colleagues actually view you, and not what you think they see in you. And how they view you is what matters in the end.

[^11]: Not hating on wilderness glamping, just that it's not extreme enough to trigger the first scenario.

[^12]: There's a natural bias since both David and Jason are online writers, but that doesn't detract from their points.
