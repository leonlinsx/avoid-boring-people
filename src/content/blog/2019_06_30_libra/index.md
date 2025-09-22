---
title: 'Would you buy the Libra Neopet Kin token?'
description: 'Centralised decentralised finance'
pubDate: 2019-06-30
category: Finance
tags: ['finance', 'crypto', 'career']
heroImage: './f_4.png'
---

I try to avoid writing about crypto because I don't really know what's going on, am likely to be misunderstanding something, and will probably be wrong [^1]. This month I'm making an exception because [Facebook's Libra](https://libra.org/en-US/ 'Libra') project is so confusing I need to rant at length about it in the first section. The second section is about the SEC suing a crypto company, and the third is career advice. New this month is a shoutouts section for projects friends are working on!

Anyway, on to Facebook. This is a long section; skip to the next if uninterested.

## What is the point of Facebook and Libra?

If you haven't heard, Facebook is working with partners to issue a cryptocurrency, Libra. The white paper can be found [here,](https://libra.org/en-US/white-paper/#introduction 'white paper') and many experts have already commented on what it means for the future of finance. I'm going boldy predict with 60% certainty that Libra will fail its objectives [^2].

What _are_ those objectives?

> Libra’s mission is to enable a simple global currency and financial infrastructure that empowers billions of people.

Guess [special drawing rights](https://www.imf.org/en/About/Factsheets/Sheets/2016/08/01/14/51/Special-Drawing-Right-SDR 'SDR') weren't good enough, and truthfully their usage is negligible. But this is an interesting mission though! Imagine a world where you don't have to deal with foreign exchange and can just earn, use, and give funds anywhere. I'll discuss my concerns later, but it is an exciting problem to work on.

> Blockchains and cryptocurrencies have a number of unique properties \[...\] These include distributed governance, which ensures that no single entity controls the network; open access, which allows anybody with an internet connection to participate; and security through cryptography, which protects the integrity of funds.

This lines up with my understanding and this _super duper authoritative search result_ [blockgeeks](https://blockgeeks.com/guides/what-is-blockchain-technology/ 'blockgeeks') [^3], which says a blockchain network "has no central authority \[...\] democratized system. Since it is a shared and immutable ledger, \[...\] by its very nature transparent and everyone involved is accountable for their actions." Note the distributed governance / democratized system aspects that differentiate it from being just some ledger or transaction record kept by one dude. The key innovation was that everyone can verify the system and no one is in control.

> We believe that global, open, instant, and low-cost movement of money will create immense economic opportunity and more commerce across the world.

Having wasted thousands of dollars sending money so far, this sounds great too. [There are reasons why international bank transfers suck](https://transferwise.com/us/blog/transferwise-vs-bank-transfers 'transferwise'), but reducing this friction is a worthy goal. So how does Libra solve this?

> Libra is made up of three parts that will work together to create a more inclusive financial system:

> One. It is built on a secure, scalable, and reliable blockchain;

Alright so they're having a decentralised ledger to record the Libra you get and give. It'll be simple, quick, and cheap to transfer Libra. Still makes sense.

> Two. It is backed by a reserve of assets designed to give it intrinsic value;

This isn't a new idea, [stablecoins](https://www.cbinsights.com/research/report/what-are-stablecoins/ 'stable?') have been [attempted before](https://thenextweb.com/hardfork/2019/06/27/stablecoin-projects-gold-failed/ 'stable???'). Starting to get confused about how a global currency would work but let's ignore that for now.

> Three. It is governed by the independent Libra Association tasked with evolving the ecosystem.

Wait a minute, it's governed by people? What happened to "decentralised"? Maybe I misunderstood

> We hope to have approximately 100 members of the Libra Association by the target launch in the first half of 2020.

_What._ We went from "democratised system" to "100 companies shall control this". Similar to other [centralised company efforts](https://www.coindesk.com/jpmorgan-to-start-customer-trials-of-its-jpm-coin-crypto 'JPM'), this... kinda seems to defeat the purpose of using a blockchain?

Let's imagine a company whose sole purpose is to track how many virtual [neopets](http://www.neopets.com/ 'this is still alive?') we have. I want to transfer a neopet, I go to the company, enter the transaction amount and recipient, and straightaway I see that I lose my neopet and my recipient has gained one [^4]. Now let's make only 100 companies able to do this type of transaction, but for the sake of appearances have them always publish the transaction record publicly. Replace neopet with Libra. If this counts as a blockchain project we should start neopet coin as a new global currency and raise a billion dollars. It seems like Libra is a global currency controlled by 100 companies that doesn't need a blockchain in the first place [^5]?

Behold the future of finance. Not going to lie, kinda cute.

![post](./f_1.webp)

> it will be backed by a collection of low-volatility assets, such as bank deposits and short-term government securities in currencies from stable and reputable central banks. It is important to highlight that this means one Libra will not always be able to convert into the same amount of a given local currency

Rather than me transferring USD to GBP, I transfer USD to Libra to GBP, and the transaction costs are so low I save money. I'm skeptical about how incurring 2 bid/ask spreads will be better, [but this could work](https://marginalrevolution.com/marginalrevolution/2019/06/libra-and-remittances.html 'TC libra remit'). If the Association is willing to subsidise the costs of running the system, Libra could perform the 'transfer of value' function of money and allow frictionless global transfers. This sounds great, until we realise there are people we _don't_ want to have the ability to have frictionless transfers, such as criminals, companies under investigation, and more.

So does that mean we restrict transfers? Who has the authority to deny a transaction? The Libra Association? This looks less like a democratised system and more like a way to deny your Libra transaction until you watch a FB ad. If we do restrict transfers, how is the Association going to check the identity of every single customer at a low cost? Recall that this is meant to bring cheap banking to schoolteacher Suzie in the Congo. Now it seems like it's ideal for terrorist leader Tim.

Maintaining the peg will be difficult but let's assume it magically works [^6]. Suppose this stability lets Libra becomes truly global, replacing local currency entirely. I pay for FB ads in the US with Libra [^7], order chocolate from Madagascar with Libra, and buy my chicken rice in Singapore with Libra. In this case Libra is performing the 'means of exchange' function of money. Does this make the Libra Association the world's central bank? _Why would any government intent on retaining monetary policy control allow this to happen?_ How is this different from creating a bank, and all the accompanying regulations that are required? Of all companies, for Facebook to be the one spearheading this is not a great look.

Tyler Cowen had some [questions about Libra](https://marginalrevolution.com/marginalrevolution/2019/06/the-libra-reserve-discussion-of-background-documents.html 'TC Libra'), and [Libra responded here.](https://threadreaderapp.com/thread/1141089260486811649.html 'Libra response') I want to point out that Tyler's third and tenth questions are similar to my concerns above, and coincidentally unaddressed.

To round up an already overly long section, [here are some other concerns by Michael Pettis](https://carnegieendowment.org/chinafinancialmarkets/79396 'Pettis'), in a scenario where Libra succeeds:

> Against the obvious benefits, there are at least three equally obvious costs and risks associated with the structure of the Libra system: a trust deficit, the necessity of some transfer regulations, and a temptation to game the system

> we need to consider additional potential issues and problems with a global digital payments system: Complicating central bank monetary policy, A procyclical digital currency, Less locally compartmentalized financial risks

I have no idea what the purpose of this is. I mean, I see the mission, and it's a good one. I don't see how using a blockchain (is this even one?) helps, don’t see why this will stand under regulation, and I think Libra is going to fail.

## Annotated guide to SEC vs Kik

In other crypto news, the SEC filed a complaint against Kik, charging them with conducting an illegal securities offering. [Katherine Wu](https://www.katherinewu.me/writings/2019/6/4/annotated-guide-to-the-secs-complaint-against-kik 'Kat') published a detailed annotation of her thoughts on the complaint [here](https://static1.squarespace.com/static/5ac136ed12b13f7c187bdf21/t/5cf6b874d6c27c00017d2f14/1559672949112/SEC+sues+Kik.pdf 'pdf'), highly recommended if you’re interested in crypto. Quotes below are from the SEC; comments from Katherine:

> However, Kik’s offer and sale of Kin was not registered with the SEC, and investors did not receive the disclosures required by the federal securities

issue: kin = unregistered security

> it is unlawful for any person, directly or indirectly, to sell securities in interstate commerce.

this puts it under federal jurisdiction

> The company expected to run out of cash to fund its operations by the end of 2017, but its revenues were insignificant, and executives had no realistic plan to increase revenues through its existing operations. In late 2016 and early 2017, Kik hired an investment bank to try to sell itself to a larger technology company, but no one was interested.

> Faced with a shrinking financial “runway,” Kik decided to “pivot” to an entirely different business and attempt what a board member called a “hail Mary pass”: Kik would offer and sell one trillion digital tokens in return for cash to fund company operations and a speculative new venture.

> And, Kik described Kin as an opportunity for both Kik and early Kin investors to “make a ton of money.”

oof

> Even prior to the DAO Report, however, Kik had been informed by one of its consultants that the Kin offering was, potentially, an offering of securities that needed to be registered with the SEC and that “unregistered public securities offerings are not
> legal in the U.S.”

This is their way of saying "Kik knew better"

> The SEC seeks a final judgment: (a) permanently enjoining Kik from engaging in acts, practices, and courses of business alleged herein; (b) ordering Kik to disgorge its ill-gotten gains and to pay prejudgment interest thereon; and (c) imposing civil money penalties on Kik pursuant to Section 20(d) of the Securities Act \[15 U.S.C § 77t(d)\].

Here is what the SEC wants, the penalty amount will be decided by the jury

> Investors’ purchases of Kin were an investment of money, in a common enterprise, with an expectation of profits for both Kik and the offerees, derived primarily from the future efforts of Kik and others to build the Kin Ecosystem and drive demand for Kin. Consequently, Kik’s offer and sale of Kin in 2017 was an offer and sale of securities

For a completely different take on the case, check out [Fred Wilson's post](https://avc.com/2019/05/defendcrypto-org/ 'AVC'), though keep in mind his VC firm is heavily invested in the crypto ecosystem. To be clear, I’m not against crypto, just against knowing when doing something is a bad idea and doing it anyway.

## Career advice

I came across [an old post by Elizabeth Yin](https://elizabethyin.com/2015/11/25/6-things-ive-learned-about-careers-in-the-last-decade/ 'elizabeth'), but the career and life advice is timeless:

> tl;dr Believe in your fucking self. That’s it. That’s all that matters. Everything else stems from this

> One. Failure opens doors to success. When one door closes, you’re forced to find another one to open, and that one could be better.

There's truth to the cliche 'if you're not failing you're not trying hard enough'. Failure is awful. We don't wake up in the morning and go 'I'm thankful for my spouse and my kids and the chance to fail horribly at everything I do today'. But it's unavoidable if we're pushing ourselves. And we should be pushing ourselves.

After a failure, we can keep trying, give up and try something different, or give up entirely. The former two options are both valid, the last is not. If you've succeeded at something you've failed at before, that's awesome. If you've realised the prestigious career you went into 'because everyone else was doing so' isn't working out, that's good to know sooner rather than later [^8]. However, if you give up on trying anything and resign yourself to 'whatever happens will happen', you're making a conscious choice to fail. Being temporarily lazy is fine. Being permanently lazy is not.

It's still going to suck. Believing in yourself even while everything seems to be crumbling will be hard, and sometimes impossible. And I say this as someone who's experienced one of my life's greatest failures in the past year. It's tough to get over, and maybe we never do. But we have to move on, if only a bit at a time. If we quit entirely, we lose by default. Quitting entirely is the comfortable and easy way out, but also the least rewarding. ["Man is not made for defeat. A man can be destroyed but not defeated"](https://www.goodreads.com/quotes/111352-but-man-is-not-made-for-defeat-he-said-a 'Hemingway') Know the game you're playing for, and _stay in the game._

> Two. Don’t worry about what other people think. Worrying about what other people think prevents you from taking risks and, by definition, limits your reward.

I broadly agree with this. Most people care too much about how their friends, their friends' friends, or that random cute stranger at the rock climbing wall on Saturdays is perceiving them. [Group consensus](https://www.psychologytoday.com/us/blog/after-service/201705/the-science-behind-why-people-follow-the-crowd 'social psych') is a thing after all, and usually comes with a negative connotation. We could use more self-assurance and less worrying about the subjective opinions of others.

However, this can also swing to the extreme. There's plenty of examples in which a confident leader leads a country or company into ruin. I think the balance here is having a small number of trusted advisors that you can reach out to for unbiased help, and knowing when their advice is applicable or lacking full context. This takes time to build, and the people might change over the years as well.

> Three. Persistence trumps all. Anything worth doing is hard. Just keep going.

Similar to the first point above. Most things aren't easy, even if you have a passion for it [^9]. But if you don't put in the work to get better you can only blame yourself.

> Four. Optimize for one thing. What you optimize for may change over time, but you can only optimize for one thing at a time.

I don't know how I feel about this. There's more than one thing I care deeply about, and I think that's likely the case for most people. Maybe they don't have to all be in conflict, though I see her point. Another caveat is that going too far in one pursuit when younger could also lead to significant setbacks when you're older, e.g. putting off saving in tax-deferred accounts to enjoy life when you're younger is probably a bad idea.

> Five. Find feedback buried in a haystack and improve yourself.

Similar to what I wrote about in the second point, so we're aligned on this. Getting constructive feedback sucks. Who wants to be told about their weaknesses [^10]? However, even if we feel the feedback we've received is inaccurate, we need to realise that that is how our critic views us. It's then up to us to decide if it's worth fixing that perceived flaw or not.

> Six. Keep perspective. Time is actually your most important commodity, not money. You don’t know how much more time you have, and every day that passes, it becomes even more valuable.

I would give multiple kidneys to be 18 again. And I'm sure I'd feel even more strongly about that the older I get. But time spent regretting the past is also time wasted. Live in the now or for the future. Don't waste too much time. [^11]

## Miscellaneous

1. [Causes of death vs media coverage](https://ourworldindata.org/does-the-news-reflect-what-we-die-from?linkId=68864855 'media')

![post](./f_2.webp)

2. ["But every trend has a shelf life, and as quickly as Instagram ushered in pink walls and pastel macaroons, it’s now turning on them."](https://www.theatlantic.com/technology/archive/2019/04/influencers-are-abandoning-instagram-look/587803/ 'insta') Well there goes my hope of becoming insta-famous
3. ["Another strategy, one we term “manclusion,” involves including men in meetings simply to induce better behavior from the men on the other side of the table."](http://clsbluesky.law.columbia.edu/2019/06/06/venture-bearding/ 'venture bearding') I can't believe this is a thing.
4. [And on the opposite end of (3), stories from Female to Male transgender people](https://www.washingtonpost.com/news/local/wp/2018/07/20/feature/crossing-the-divide-do-men-really-have-it-easier-these-transgender-guys-found-the-truth-was-more-complex/?utm_term=.95366da87114 'FTM')

   > "What continues to strike me is the significant reduction in friendliness and kindness now extended to me in public spaces. It now feels as though I am on my own"

5. [Reconstructing facial images based on voice data](https://arxiv.org/pdf/1905.09773.pdf 'face'). Note that the idea wasn't to recover an exact image, but common visual features that connected with speech attributes.

![post](./f_3.webp)

6. [Celebrity cameos for sale.](https://www.cameo.com/faq 'cameo') Would be a great Xmas present if anyone got me a Jenna Coleman one...just saying [^12]

[^1]: And also because most industry news on it is toxic, popular personalities seem like nutjobs, and I'm half afraid some rich crypto teen is going to hire a hitman to snuff me out. Note that none of this is investment advice.

[^2]: I prefer predicting things with percentage certainty since reading about it in [Tetlock's work](https://hbr.org/2016/05/superforecasting-how-to-upgrade-your-companys-judgment 'Tetlock'), and it increases accountability of the forecaster compared to using weasel words that are easy to distance yourself from.

[^3]: It even has crypto prices right on top so you know it's focused on education and not getting you to trade crypto! Again, not investment advice. Trade all the crypto you feel like doing so.

[^4]: I'm simplifying a lot, but you get the point

[^5]: [Stratechery compares Libra to a distributed ledger that is more similar to a centralised database.](https://stratechery.com/2019/facebook-libra-and-the-long-game/ 'Stratechery') If so, I really don't see the blockchain connection here for Libra

[^6]: If there's high demand for Libra and people convert local currency into Libra, does that cause Libra to appreciate against the basket, requiring the Association to issue more Libra, affecting the exchange rate for the basket of currencies, except the local currency? I have a feeling trying to maintain a steady peg will be impossible

[^7]: I wonder if FB will consider just making all ad buyers _have_ to buy Libra in order to buy Ads. Seems like an easy way to start ~~world domination~~ adoption of Libra. Or perhaps this is all an excuse to build a [global digital id](https://www.coindesk.com/buried-in-facebooks-cryptocurrency-white-paper-a-digital-identity-bombshell 'coindesk') to better target ads...

[^8]: I wouldn't come to that conclusion too quickly, but 6 mths - 2 years seems like a good enough timeframe to understand if you want to stay in that role

[^9]: Heck, writing this monthly is a huge time sink and exhausting, even though I like reading and know that writing helps me clarify my thoughts

[^10]: Sidenote, I think the 'what is your biggest weakness' question in interviewing is horrible. Absolutely horrible. I immediately think badly of anyone who asks that question, regardless of how they justify it 'Oh we want to be totally honest with each other in the process' _Yeah right_

[^11]: Note that I said don't waste _too much_ time rather than don't waste any time. I think some amount of time wasting is good.

[^12]: While I was drafting this, [Cameo raised $50mm](https://techcrunch.com/2019/06/25/cameo/ 'cameo round'), bringing my track record of calling trends correctly to 1 out of 1, a 100% batting average.
