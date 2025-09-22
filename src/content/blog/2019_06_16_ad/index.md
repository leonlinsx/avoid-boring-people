---
title: 'Ad targeting myths'
description: 'Ad targeting is not as powerful as you might think'
pubDate: 2019-06-16
category: Tech
tags: ['business']
heroImage: './a_1.png'
---

People rightfully have privacy and other concerns in the current age of location sharing and targeting, which has been catalysed by GPS. The ability of ad targeting based on location is usually misunderstood, as these articles on [street fight](https://streetfightmag.com/2019/03/07/four-targeting-myths-that-devalue-the-real-power-of-location-data/) and [digiday](https://digiday.com/marketing/confessions-location-data-exec/) detail below. The accuracy, efficacy, and scale of location targeting is lower than you might think.

Per Street Fight:

> Another thing that location data can do extremely well is find business travelers who have been in multiple airports over a certain period of time, such as within a month or two. \[But\] Location data cannot enable you to target 25 million United Airlines customers who’ve been at specific United gates within specific terminals of specific airports in the last month

You can identify repeated general visits to a location, but not down to the specificity and not at such a large scale. The user range error [^1] is [identical for military and civilian devices](https://www.gps.gov/systems/gps/performance/accuracy/), leading to a user accuraccy of ~5m. Indoor use is likely to make this more inaccurate too.

There are apparently [civilian equipment and tech that allows for centimetre level accuracy](https://www.novatel.com/an-introduction-to-gnss/chapter-5-resolving-errors/real-time-kinematic-rtk/) but the costs are high, making this Real-Time Kinematic (RTK) unfeasible for mobiles right now [^2].

> Even if your data vendor claims to have drawn a “custom polygon” around the Subway and UPS Stores, the device location data needs to precisely and accurately align to that polygon in order to work. That’s not how location data works, even if it’s GPS-sourced. If a data vendor tells you they can definitively measure incremental visits (from a mobile ad) to Subway sandwich shops in Connecticut, that claim alone should raise a bright red flag. The same goes for any store in a mall. It can’t be done with any kind of scale or reliability.

Again, adjust your scale and reliabilty expectations.

> Location data can’t enable you to reach 30 million devices within a couple miles of the closest Arby’s during lunch hour in Dallas. First of all, 57% of location data in bid requests is wrong by more than a mile. Today, trying to reach an audience within a mile of a specific restaurant can burn more than half of your ad dollars, unless you have a reliable way to filter out the incorrect data. Second, that sort of scale simply isn’t available, even if a segment in the data store claims otherwise

I'm surprised that such a large percentage of the data is wrong but such a large distance, but will take their word for it. If this is the case, then no wonder location targeting cannot be as granular as people seem to expect it to be.

Per Digiday:

> For the web, the number of people sharing latitude and longitude while walking into a store will be relatively non-existent. It’s unrealistic to scale this sort of data given how hard it is for location data vendors to source it.

Reiterating the scale of the data available. I expect this to change over time though, as more people knowingly or unknowingly turn on location sharing. I'm currently ok with this tradeoff in order to get my historical timeline within Google Maps. Many people find that creepy. I like the ability to remember where I've been given my passion for food and travel.

> What’s actually happening is these ad tech vendors are trying to pad out the limited data they already own with other data sets from competitive vendors or other unknown sources. Most reputable publishers would rather use their data across their own business than sell it to ad tech vendors, as the revenue potential is greater against their own content.

Similar to the misconception that Facebook sells your data [^3], publishers would rather keep their own data rather than sell it. Ad tech vendors have to make the dataset they're using look larger somehow...

> Who goes into a shop with their phone in-hand looking at a publisher site? That’s not how people behave when they’re shopping. And yet there are location data vendors who are selling data sets of people who are more likely to go into a shop after seeing an ad.

With the lack of alternative measurement targets, store visit changes post ad campaign runs seem to be the default metric to track. I can kinda see the rationale for this data vendor claiming this though. For example, if I run a campaign for a sale that only appears to viewers of the ad, is claimed in-store, and isn't advertised anywhere else. I get Digiday's point that this is an inaccurate measure though.

[^1]:
    Different from user accuracy, according to the site. Seems like URE plays a factor into user accuracy but is not the only item.

    > To be clear, URE is not user accuracy. User accuracy depends on a combination of satellite geometry, URE, and local factors such as signal blockage, atmospheric conditions, and receiver design features/quality.

[^2]: [u-blox claims to be taking this 'to the next level' which hopefully means cheaper and more mainstream usage eventually?](https://www.u-blox.com/en/high-precision-positioning)

[^3]: Perhaps a topic for another time, but there is a nuance between selling your data and selling access to your data. Facebook wants to keep as much of your data, anonymised on a large scale, and sell the right to target ads based on that data Facebook keeps
