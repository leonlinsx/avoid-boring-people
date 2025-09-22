---
title: 'Marketplace rakes'
description: 'Benchmarking take rates for various marketplaces'
pubDate: 2019-04-27
category: Tech
tags: ['business']
heroImage: './t_1.webp'
---

I'm fascinated by marketplaces and network effects since so much of the internet is built on companies succeeding in them e.g. Facebook's network effects, Amazon's 3rd party marketplace, Google's ad marketplace.

This post details my thoughts on a marketplace rake factor fundamental analysis I saw Josh Breinlinger write about [here.](http://acrowdedspace.com/post/172383900012/marketplace-rake-factors 'rake factors')

I liked Josh’s rake factors article because it was the first I’ve seen that attempts to build up fundamental reasons for why a rake is set at a certain percentage, rather than just ‘because comps are at that rake’. Some (many?) markets are indeed just priced based on comps, but I still like having a framework.

I had additional thoughts:

- There are some marketplaces that seem to be exceptions to this framework (which Josh self-admits is not definitive)
  - E.g. The stock photography market has always been curious to me since someone pointed it out. [The rake there can be >50%,]((https://microstockinsider.com/microstock_commission_rates 'photography commissions') an incredible amount for a service that has so many competitors, transparent fees, and little marginal costs on the platform side.
  - E.g. China e-commerce marketplace rakes are very low when compared to US marketplaces e.g. taobao ~4% vs ebay ~9%
- I think adding another factor of +3% for ‘promotional activity’ on the platform might be helpful
  _ E.g. China e-commerce marketplace rev mentioned above is mostly from marketing activities, and the average cost is ~4%
  _ E.g. How booking.com lets advertisers become preferred members with better placement for 300bps
  _ E.g. Hotel loyalty program average ~3% of rev in increased costs for the hotel
  _ E.g. Seamless' food delivery rake used to go from 12.5% to 20%, a difference of 7.5% (which is
  higher than 3%, but the average restaurant would be paying 15% and not the 12.5% rake, implying a smaller difference) \* E.g. I would guess that Ubereats will be charging a couple percentage points for [promotional placement of restaurants](https://techcrunch.com/2018/12/10/uber-ads/ 'uber ads') as well
- I think that companies coming into a market intending to undercut their competitor also set their take rate 5%-10% lower than the prevailing incumbent
  - E.g. How booking.com came in with 10% or more lower rates to undercut its competitor and [won the market that way](https://skift.com/2012/06/25/how-booking-com-conquered-world/ 'OTA history')
  - E.g. Seatgeek’s rates seems to be 5%+ lower than the incumbent based on my own benchmarking
  - E.g. The smaller Chinese online trave agencies (OTAs) are supposedly ~10% rake vs the main OTA's ~15% rake
- I haven’t seen many rakes >20% that are sustained over time. Similarly to how Bill Gurley talks about [a rake too far](http://abovethecrowd.com/2013/04/18/a-rake-too-far-optimal-platformpricing-strategy/ 'optimal pricing strategy'), there’s something about that threshold that pulls take rates down over time. My hypothesis is that it starts eating too much into the customer’s COGS for the situation to stay unchanged for >5 years
  - E.g. For the longest time, iOS and google play store rakes were 30%. Then they started introducing lower rakes for subscriptions
  - E.g. Steam used to have a 30% rake, and recently changed that to be lower for larger publishers. That's not a coincidence given Epic Games and Discord are coming out with their own 10%+ rake stores instead
- Take rates should be influenced by the operating margins of the sellers on the platform, though I’m still working on how to frame this.
  - E.g. Food delivery platforms can’t charge much higher than 30% without restaurants losing money given the low restaurant margin
  - E.g. Air ticket take rates in the US are essentially 0% since the airlines consolidated and have thin margins
- Where in the framework do we place platforms that charge both the seller and the buyer? I personally dislike them as a consumer but seems there’s no pressure to change that business model yet
  - Ruzwana on Twitter mentioned that perhaps [more infrequent, episodic transactions can support buyer fees, but not frequent, regular transaction cases](https://twitter.com/daveambrose/status/694921246799073280)
  - Airbnb, the ticketing market, dog vacation marketplaces are more episodic and can charge buyer fees
  - The food delivery platforms don't seem to quite fit this framework though. They're usually regular transactions that charge additional buyer fees for delivery, which would seem to be an impediment to growth.

I also did some comparison of predicted vs actual rake rates according to his framework, and they seem to fall in line with theory. Caveat being that I used some judgement in applying the criteria, and the actual take rates are approximated based on some benchmarking I've personally done.

- Booking.com take rate according to his framework should be 20% + 10% opaque fees + 5% quality control + 5% fraud prevention – 10% high price items – 10% users meet in person (does this qualify?) = 20% vs 14% actual rake
  - Other main OTAs: expedia is around 13-18% actual rake, ctrip is around 10-15% actual rake on its hotel inventory
  - **Smaller chinese competitors such as meituan are at 8-10%, and tongcheng is 6-9%**
- Etsy take rate predicted is 20% - 5% transparent fees - 5% buyer beware = 10% vs 5% actual
- Farfetch take rate predicted is 20% + 10% work on platform + 5% quality control + 5% fraud prevention – 5% transparent fees – 5% high price items = 30% vs 33% actual
- Taobao take rate 20% – 5% transparent fees – 5% buyer beware = **10% vs 4% actual**
- Tmall take rate 20% + 10% work on platform + 5% quality control – 5% transparent fees – 5% buyer beware = **25% vs 3% actual**
- JD.com take rate 20% + 5% quality control – 5% transparent fees – 5% buyer beware = **15% vs 2-8% actual**
- _Taobao, Tmall, JD all seem to not fit the framework. My guess is this has to do with China’s market, and how Taobao was initially started as a platform with 0 fees to compete against EachNet. So the starting point was at a 0% take rather than 20%_
- Mercado libre take rate 20% + 5% quality control – 5% transparent fees – 5% buyer beware = 15% vs 17% actual
- Stubhub/Seatgeek take rate 20% + 10% opaque fees + 5% quality control + 5% fraud prevention - 5% high price items = 35% vs 40%+ actual

If I'm mistaken on any of the above or if you have responses, feel free to let me know and I'll correct the post as needed.
