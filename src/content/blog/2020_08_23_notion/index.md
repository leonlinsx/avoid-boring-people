---
title: 'Inception, Nolan, and Notion'
description: 'How Notion is literally trying to get everyone on the same page'
pubDate: 2020-08-23
category: Tech
tags: ['business', 'startups']
heroImage: './n_5.webp'
---

## Takeaway

1. Notion is a visual based approach to information organisation and collaboration
2. Notion's greatest strengths are flexible forms, visual based building, and template options
3. Notion’s biggest problems are likely to be quality related, and I give a few marketing and product ideas to solve them

## Notion workspace for your workplace

In the movie [Inception by Christopher Nolan,](https://en.wikipedia.org/wiki/Inception 'Inception') the main characters wander through nested layers of dreams to carry out a task. Their actions within that layer affect the layer itself, and also the layers above or below it. Sometimes you’re interested in what’s happening in that layer, sometimes in affecting other layers.

![post](./n_1.webp)

I want you to keep that framework in mind - **of layers, interaction within layers, and interaction among the layers.** We'll come back to it shortly [^1].

Recently, productivity startups like Notion, Coda, Roam have all raised rounds at high valuations for their size. [The hustle has Notion at a $2bn valuation, Coda at $600mm, and Roam at $200mm](https://thehustle.co/09142020-roam-research/ 'Hustle'). Considering how young these companies are [^2], those are optimistic venture evaluations of the potential for such companies.

Today I want to look closer at [Notion](https://www.notion.so/ 'Notion'). We'll go over [^3]:

1. What Notion's purpose is
2. Walkthrough of sample features
3. Suggestions for the Notion team

So that at the end of this, you'll have an idea of why these startups exist, what they look like, and how they might change for the future.

Let's get started.

## 1. Notion is a visual based approach to information organisation and collaboration

To better understand Notion, we need to get more context on the history of our interaction with information, and the evolution of computing.

We can crudely think of humans as a function. We take data as input, process it, and give some response as output. That output data then goes on to influence others who themselves process it and react accordingly.

We used to store data physically, and you'd have to go visit a library or professional in person to get some scroll of truth telling you [how likely Jack Sparrow would have visited Singapore](https://www.reddit.com/r/AskHistorians/comments/gd7cww/in_pirates_of_carribbean_jack_sparrow_says_youve/ 'Reddit') [^4].

With computers, we've moved to storing data digitally, even allowing multiple collaborators on a document at the same time. **We're no longer bound by the physical location of the data or person, which opens up opportunities to interact with information on a global scale.** Before, there was little chance I could work with someone in Uganda, given the speed of information transfer. Now, not only can we work together, we can even work on the same document simultaneously.

It took a while to get here though, as it required changes in mindset, technology, and design to enable our current work habits.

One big change was the **[graphical user interface](https://www.youtube.com/watch?time_continue=39&v=BFlop4sP8Os&feature=emb_title 'GUI').** Before this, [people were interacting with computers via a command line interface,](https://www.wired.com/1997/12/web-101-a-history-of-the-gui/#:~:text=In%201979%2C%20the%20Xerox%20Palo,first%20prototype%20for%20a%20GUI.&text=When%20Jobs%20saw%20this%20prototype,expensive%3B%20no%20one%20bought%20it. 'CLI') much like the below.

![post](./n_2.webp)

As you can see, it's not the most intuitive way to work with a computer. I'll claim I left that mistake in there as a teachable moment; truth is I forgot the proper syntax. Command line interaction may be powerful, but poses a high barrier to entry for most users. By redesigning usage around a visual experience, [Apple achieved a breakthrough](https://en.wikipedia.org/wiki/History_of_the_graphical_user_interface 'Apple') in making computing mass market [^5]. Computing progress would have been slowed significantly if we still worked only in command line.

A second big change was the internet, coming in two waves. Before this, people stored work on physical media such as floppy disks [^6]. If you wanted to share something, you'd still have to transport your temporary storage physically to the other person.

**Email helped change that,** by slowly removing the need for hardware and increasing the convenience and speed of data transfer. Rather than send you one thumb drive with a finalised edited version of your proposal, your boss can now send ten separate unlinked emails giving you comments on footnote size formatting.

In the last 10 years, the increased bandwidth of the internet has also enabled our **move to the cloud.** Instead of emailing back and forth, everyone can now collaborate in real time on the same document, further increasing convenience and reducing version control issues. I can now sit in my pajamas watching [Dark](<https://en.wikipedia.org/wiki/Dark_(TV_series)> 'Dark') while half-heartedly replying to comments on a google doc. Not that I would, of course.

The internet and cloud provided the foundation for the growth of all the [Software as a Service (SaaS)](https://www.bmc.com/blogs/saas-vs-paas-vs-iaas-whats-the-difference-and-how-to-choose/ 'SaaS') businesses we see today. By taking it as a given that someone else will provide the infrastructure (IaaS) or platform (PaaS) required to support them, software companies can concentrate on addressing the needs of a specific segment.

With the [low cost of capital](https://leonlins.com/writing/2020_09_16_capital/ 'low'), high potential margins, and sticky revenue base, it's no wonder we've seen so many software companies try to digitalise functions that used to be physical. We have company wikis replacing compendiums, kanban boards replacing post it notes, and note taking apps replacing journals. Most of us have to deal with at least 10, if not more, different software platforms while doing work.

This is where Notion comes in. **[Notion wants to be your all-in-one workspace,](https://www.notion.so/product 'Notion')** the main place you write, plan, and organise your work. All of that separate software we just mentioned? Notion wants to bundle them all, and give you one consistent user experience with enough flexibility to cater to most of your tasks.

![post](./n_3.webp)

Want a company wiki? You can create it in Notion.

Want a task board? You can create it in Notion.

Want a note taking page? You get the idea.

In case you think I'm making this up, [here's a quote from cofounder Ivan Zhou:](https://www.invisionapp.com/inside-design/ivan-zhou-notion-interview/ 'ivan')

> we’re in this pendulum swing from one product, Microsoft Office, to too many SaaS products. And now the pendulum is swinging back towards something more bundled up again. I want Notion \[...\] to catch that wave. It can be a product that is as powerful as those five different SaaS tools.

This is already a large, feasible market to serve, but let's speculate on Notion's potential, and how it can grow even further. It's time to bring in the Inception analogy from the beginning, and apply it to how data layers exist in a company.

A company has to gather and store data. We'll call this the **data storage layer,** and group all the infrastructure related companies together here for simplicity. For example, if you're a retailer, you're storing transaction records so that you can fulfil the orders later, and you'd use Amazon Web Services (AWS) to do so [^7].

A company also has to analyse the data they've gathered. We'll call this the **data analysis layer,** and group all the tools that can interact with databases to do calculations here. For example, you might want to find out how many customers you got this month, and you'd use SQL to query for that information from your database, and Excel to further refine your research.

A company also has to see the results of that analysis. We'll call this the **data visualisation layer,** and group all the presentation related software here. For example, you could use google slides to present a graph of that data you just pulled, showing that your customers grew 50% week over week.

There's one last main layer on top of all that. We'll call this the **data sync layer,** and it's where coordination of information takes place. It's no use if your team is the only one that knows how well the business is doing, so you need a way to communicate that information out, and get everyone on the same page. For example, you could send a company wide slack message doing a recap of recent financial metrics.

As data flows through the company in these layers, **it becomes more visual and visible,** resulting in more people being able to interact with it. The tools at the data sync layer, by nature of being the most "end user facing," usually have a more visual oriented design approach, making them easier to pick up for the layman. For example, email is easy, [hadoop](https://en.wikipedia.org/wiki/Apache_Hadoop 'hadoop') is hard.

![post](./n_4.webp)

The framework above gives us a better idea of where Notion's value add is. **Notion is currently in the data sync layer, and halfway creeping into the data visualisation layer.** I'd previously claimed that this was a big market, so let's justify that before exploring expansion opportunities.

![post](./n_5.webp)

The data sync layer is trying to solve an **information coordination problem at all scales**, from small groups in the company to external stakeholders. The aim is to ensure that everyone is on the same page for an issue. Having a messaging app allows your team to agree on next steps, and having a public website allows your customers to get information about your business. Slack is a $15bn mkt cap company focused on messaging; Wix is a $13bn mkt cap business building websites. We can list more companies for wikis, taskboards, note taking, but I think that's sufficient to show there's a multibillion opportunity here.

As for data visualisation, [Tableau was bought for $15bn](https://techcrunch.com/2019/06/10/salesforce-is-buying-data-visualization-company-tableau-for-15-7b-in-all-stock-deal/ 'Tableau'), so I think we can say there's also a multibillion opportunity here. I consider Notion as only halfway in this layer though, as the current features available are far from reaching parity with peers, as the later walkthrough will show.

Some of you might have noticed I left out Office and G Suite while discussing the layers above. That's because I believe that for the majority of Office/G Suite users, having some ability to do calculations on data is necessary for work. Hence, acquiring the capabilities in the data analysis layer is crucial to becoming as embedded in the workforce as those tools currently are. Notion's performance here is poor, but that also means high potential for expansion.

How big a market would that unlock?

Microsoft reports Office revenue as part of the "Productivity and Business Processes" segment, lumping together Office Commercial, Office Consumer, and some other smaller businesses. In their [recent annual report](https://www.microsoft.com/investor/reports/ar19/index.html 'ar'), they did $41bn of revenue for the entire segment, with $16bn of operating income, at a 39% margin. Now of course this isn't all Office revenue, but it's likely the largest sub-segment [^8].

![post](./n_6.webp)

Google reports G Suite revenue as part of the "Google Cloud" segment, smushing Google Cloud and other enterprise services in this line item as well. In their recent [10K](https://abc.xyz/investor/static/pdf/20200204_alphabet_10K.pdf?cache=cdd6dbf 'Google') they showed $9bn for the segment. Google Cloud is probably the majority of the revenue here, and I'd think G Suite is anywhere from $1bn or more.

![post](./n_7.webp)

Clearly, the "Word, Powerpoint, Excel" market is multi-billion in size as measured by revenue, and likely much larger. The size of the market is why **I'd argue for Notion to get more analytic capability** over time. You want to cover as much of your customer use case as possible.

Imagine if you started your day at work by first checking your to do task board, then checking comments on a proposal, then updating a general announcements page with new tasks to assign to your colleagues. **This can all be done in Notion now.**

In the afternoon you'd pull some customer churn data, filter and cut it down to show what you need, and then summarise it in some graphs to share with your team. Largely, **this can't be done in Notion now, but imagine if it could?** You could spend nearly all your time then within one app. That's one way Notion could potentially be a huge hit, by replacing Office and G Suite with a singular software. If I were at corp dev in Microsoft or Google, I'd be observing Notion closely and looking to either invest in or buy them.

If we think back to the Inception analogy, we're not just interested in how much space Notion will occupy within its current layers, but also how it will interact with or even take over other layers. If your data analysis, visualisation, and sync could all be done with Notion, that will make a lot of the software we use now redundant.

There's probably a [pace layer](https://leonlins.com/writing/2020_03_04_pace/ 'pace') comparison to make here as well, with the upper, faster, visual layers moving faster and dominating the attention cycle.

![post](./n_8.webp)

When I was thinking about this article, I had initially wanted to do a financial model for Notion, [like the one I did for newsletters](https://leonlins.com/writing/2021_04_17_community/ 'news'). However, given the lack of data I'd be making up too many assumptions. I have read they're already profitable with a revenue run-rate of [$30mm](https://www.forbes.com/sites/davidjeans/2020/04/01/buzzy-work-app-notion-hits-2-billion-valuation/#15da831578ec '30'), and I can see them doing 10x that revenue at a 40% margin, while still growing double digits. We'll have to wait on more data, but no wonder people are excited [^9].

That's enough justification above for Notion's valuation, and we'll come back to some wilder ideas of how to increase the addressable market. For now, let's do an overview of product features.

## 2. Notion's greatest strengths are flexible forms, visual based building, and template options

Signing in to Notion is simple, but getting started is not, which is an issue I'll come back to later in the suggestions section. You can sign in with your Google account, and then choose if you're setting up a workspace for yourself or for a team.

![post](./n_9.webp)

Past that, you'll see a "Getting Started" page, with tips on how to start working in Notion in the middle. On the left, you'll see that you start with a few preset templates such as a to do list or reading list.

![post](./n_10.webp)

**The basic unit of Notion is a block.** Think about how a cell in excel is fundamental to doing work there. Blocks in Notion are like that, but with a ton more features. Blocks are customisable in both what they display and how they are displayed. The key to remember is that Notion is a visual, design based application, so you should be able to arrange the blocks and alter them according to your needs.

![post](./n_11.webp)

You can turn a block into many things, such as a to do list, a calendar, or a table. These are themselves blocks, so you can move the created link around on your original page.

**You can nest one block/page under another,** making it easier to create a linked network of all your work. If you're the type of person that likes mind maps and making connections between everything you interact with, this design style is for you.

![post](./n_12.webp)

Besides the ability to create standalone pages from blocks, another feature I liked was the **toggle block**. If you're a fan of grouping and ungrouping rows in excel [^10], you'll like this feature of showing summary and then detailed views.

![post](./n_13.webp)

We've talked about how Notion has **modular blocks that allow you to interact visually with the page you're building.** In the past, if you wanted to change how a web page looked, you were limited by the features your web editor provided. For example, substack has limited text formatting options. To get any more than that, you'd have to code the HTML/javascript/CSS yourself.

![post](./n_14.webp)

With Notion, you gain a huge amount of functionality and flexibility, empowering non-front end programmers to do build more. **That's also brought about a large selection of templates, as users take pride in sharing what they've worked on.** For example, if you were going back to school, you could use a pre-made template to plan all your coursework.

![post](./n_15.webp)

**Notion templates are currently a big strength, and also potentially a big weakness.** We'll cover the strength first, and then the weakness in the suggestions section. The strength of having templates is that once someone figures out what they want and selects their template, getting up to speed is quick, since most of the functionality they want should already be created. For example, there's no need to create pages and sections from scratch if you want to make a task board, since there's already a template for it.

In the below, I find a task list template on Notion:

![post](./n_16.webp)

And then am able to quickly add my own tasks onto it. Notice that within a task, I can create nested sub tasks, which helps with organisation.

![post](./n_17.webp)

That's it for the overview of Notion, and you can go to their [youtube page](https://www.youtube.com/c/Notion/featured 'youtube') to see more on what you can create in Notion. Now I want to go over problems with Notion, and end off with some moonshot suggestions for the company.

## 3. Notion is likely to face selection quality issues and should invest in the ecosystem to prevent them

Here are some of the problems I see with Notion, ranging from larger strategy to smaller design nitpicks.

### Problem 1: Templates are also a barrier to adoption and getting started

If templates are a strength for Notion, then the more templates there are, the better. We've already seen many people promote templates of their own, some even charging for it. Let's assume that Notion's started a flywheel here, and that [the quantity of templates is not going to be a problem](https://www.notion.so/Notion-Template-Gallery-181e961aeb5c4ee6915307c0dfd5156d#90f6a0e426e1403093bb2a54ea33140d 'Notion')

**What will be a problem then is selection of the template.** This also ties into the problem of getting started I flagged at the beginning of the walkthrough. Right now, people have to 1) figure out what they want, and 2) find the right template that suits their needs. In the current state of Notion, both of these are still difficult and will deter usage.

**For the first, understanding what's possible is a task in itself.** I wouldn't be surprised if there were people who used Notion to plan how they wanted to use Notion, and get caught in this productivity death spiral of constantly trying to find the optimal design without doing any actual work.

**For the second, filtering the quality of available templates is also a task.** For new users, finding a good option without much context is difficult. Too much selection is a better problem to have than too little, but it also means some form of curation is going to be necessary. [You're already seeing unofficial template directories](https://templates.notion.vip/ 'vip') proving this out.

What's also interesting to note is that most of us don't use that many templates in our current tools of Word/Excel/Powerpoint. It's not for a lack of options, since these do have stock templates. Rather, we've realised that we prefer the flexibility available by starting from scratch. Perhaps over time, people will use less templates and create more pages themselves as they get used to Notion.

It's like art, where you start out drawing from reference (template). Once you've grown your skills, you'll want to start creating your own compositions. Notion needs to be able to support use cases for that entire journey.

### Problem 2: Visual design requires seeing it in action before people "get it"

We've already made the case that Notion is a visual tool. This means that rather than describing it, **you have to show it to people** before they understand the potential. Imagine if this article had been written without visuals; you'd probably still have no idea what Notion was about.

In terms of communication, that means having images are a bare minimum, and gifs or video are far superior to plain text. I don't know about you, but I'm annoyed at having to watch multiple videos on an issue, compared to just reading about it. This problem isn't a dealbreaker, but is going to slow adoption to the masses.

### Problem 3: Lack of core data analysis functionality

I've made this point earlier, about how Notion doesn't come close to Excel in terms of features. As [RadReads](https://radreads.co/notion-formulas/ 'Rad') points out, Notion acts like a database. It's not meant to be Excel, and so only gives you function views of entire sections. For example, you can't do a calculation just on two cells, you have to apply it to the entire column [^11]
![post](./n_18.webp)

If you look at the image above where I'm trying to add two numbers, you can also see how inelegant the formula looks. Formulas in Notion look as though they came from a programming mindset, with functions taking variables as inputs in a lengthy line. This is in complete contrast to Notion's visual design approach, and was a surprise to me.

To be clear though, getting anywhere close to Excel in features is going to be tremendously difficult. I don't expect the Notion team to prioritise this, but from the points made in an earlier section have shown how large of an opportunity they have here. If you could do your data analysis, presentation, and collaboration all within the same tool, that's huge. The fact that third parties are creating [chart plugins](https://www.notion.vip/charts/ 'charts') shows there'll be a market.

This problem also illustrates the tradeoff that Notion will have to make as it grows, in whether they should serve more casual users or power users. Power users will be willing to pay more, but there are more casual users to pay.

### Other problems

The below are more nitpicky so I'll list them all together. Notion [used to have a feature roadmap](https://twitter.com/NotionHQ/status/766137732980613120?s=20 'Road') but it's since disappeared, so I'll just assume [they're prioritising their top feature requests](https://www.notion.so/How-do-I-request-features-19830881751e4f68bcd674212c6c317c 'feature')

**Search is slow:** For some reason the search function is _really_ slow. Unsure what's up with that, but it's a drag on the whole "connected network" design

**Countless clicking:** This could be because I'm a new user, and I found I had to click to create for a lot of the things I wanted. More shortcuts and keyboard navigation would be appreciated.

**Weird whitespace:** This is a personal design preference. All the pages/blocks in Notion have ample whitespace to the left and to the right of the block. A user should think that nothing would happen if they click there, since it's empty after all. Instead, the selection area of a block extends beyond the visual area, so you end up clicking on the block, per the gif below.

![post](./n_19.webp)

We've covered some problems, let's look at some ideas. I'll split these into community/marketing ideas that are more actionable, and product ideas that are more farfetched.

### Marketing idea 1: Invest in template quality

If templates are critical for Notion now, the company should ensure their quality. Some tactics:

- Have a rating system, though these are subject to a lot of caveats
- Host a template competition like [Kaggle](https://www.kaggle.com/ 'Kaggle') or [ProductHunt](https://www.producthunt.com/ 'PH') where top templates get rewarded
- Buy out the best templates online and make them available to everyone

### Marketing idea 2: Invest in community content

Notion spread mostly through word of mouth, and based on some articles I'd assume marketing is already doing similar work here. That said, continuing to invest in people that are creating templates, organising events, and writing about Notion is worth looking into.

If Notion is able to either invest in or sponsor advocates, that will get them a lot of reach for relatively little cost. Put another way, if we end up in a situation where people can make a living teaching other people how to use Notion, that's when you know you have product market fit.

### Marketing idea 3: Invest in training

There's whole industries based around AWS certification, SQL training, and how to build a financial model in Excel. Likewise, Notion should start creating certifications for people to become experts in the product. They can supplement the certs with education, seminars, office hours and more. Some of this is already being done unofficially by the community, and it makes sense for Notion to provide even more funding and support here to grow the "Notion professional" job specification. An end goal can be for companies to start hiring for specialised Notion in-house champions to manage their Notion setup.

Now, on to the more farfetched ideas.

### Product idea 1: Data analysis

I've covered this above already when discussing Excel.

More generally, if I were running product at Notion, I'd look at all the things they allow to be embedded. I'd think of them both as failures for Notion, and opportunities to expand. You could even use that as the grand vision product roadmap. For example, all of Google Drive's capabilities could be duplicated one day. This is going to take years, and the end goal is that you won't need to leave Notion for anything.

![post](./n_20.webp)

### Product idea 2: Email

We've been locked in to the concept as mail having to go back and forth, due to the physical concept of sending letters. Not all communication needs to be done this way. If Notion can reduce the need for email or chat, and bundle that all into Notion pages, that's a large shift in work habits, hopefully for the better.

### Product idea 3: More code

Notion is currently visual based, but there's a whole world of written code, whether that's SQL data pulls or Machine Learning Jupyter Labs. Integrating such capabilities would greatly expand the usage of the product.

Going back to the data layers framework, if you are able to offer something that touches every part of the data flow except storage, you'll have a high visibility, high touch product that billions of users can interact with. With such a SaaS product hosted on the cloud, **you won't even need an OS.** Yes, that means that this could become a threat for Microsoft's $46bn of personal computing revenue, or Apple's market share. If all you need is an internet browser to access the tools you use for work, the entire OS layer becomes a commodity.

## Notion of an idea; Idea of a Notion

Notion is a visual, design-based approach at rethinking how we do work. It currently sits primarily in the "data sync" layer of the organisation, and is making progress in the "data visualisation" layer. Maybe one day it'll also sit in the "data analysis" layer, and we'll spend all of our days solely in Notion [^12].

It's also interesting to think of the tradeoffs for Notion. Companies usually face a trilemma of growth vs profitability vs quality. In Notion's case, they've supposedly already reached profitability, and given the strength of early adoption, growth is unlikely to be an issue for the next three years. **The rate determining step is then the quality** of the product, which would explain why Notion ships features slower than competitors.

![post](./n_21.webp)

What does Notion allow you to create, what type of customisation is available, and how much control do you have over the end design? Pushing the boundaries of these questions will allow Notion's way of working to creep into more areas of our lives.

Notion currently aims to reduce the cost of information sharing, and could one day do so much more. It’s starting out by pushing the idea that the way we work is going to change.

There’s a quote about ideas in Inception:

> What is the most resilient parasite? Bacteria? A virus? An intestinal worm? An idea. Resilient... highly contagious. Once an idea has taken hold of the brain it's almost impossible to eradicate. An idea that is fully formed - fully understood - that sticks; right in there somewhere.

I'm going to leave you with that, and the idea of what Notion could become. We'll see if it sticks.

_Credit to [Hadar Dor](http://hadardor.com/ 'Hadar'), [Ryan Rodenbaugh (who also writes an Asia tech newsletter)](https://eastmeetswest.substack.com/ 'Ryan'), [Valentin Hernandez](https://www.linkedin.com/in/valentinhernandez/ 'Valentin'), [Nathan Lui](http://nathanlui.com/ 'Nathan'), [Theodore Wu](https://www.linkedin.com/in/theo/ 'Theo'), [Nadia Eldeib](https://twitter.com/nseldeib 'Nadia') for resources on Notion, [Packy McCormick for corrections](https://notboring.substack.com/ 'packy'). And yep, [I’ve recreated this article in Notion as well](https://www.notion.so/Inception-Nolan-and-Notion-3478471a315945a9a0f87a79974714e1 'Notion')_

[^1]: I'll admit that half the reason I'm making this reference is so I can insert a Marion Cotillard poster, but you'll see later that the analogy actually makes sense. Well, at least to me.

[^2]: I have [Notion founded in 2013, ](https://www.crunchbase.com/organization/notion-so 'Notion') [Coda in 2014](https://www.crunchbase.com/organization/coda-add7 'Coda'), and [Roam in 2017](https://pitchbook.com/profiles/company/343764-28#funding 'Roam'), but have also heard early beta versions launched before those dates.

[^3]: I'm more comfortable analysing internet businesses vs software, but let's see where this takes us. As always, feel free to comment, especially if you disagree. Also note that due to time constraints, I've not done a full review of Roam or Coda before writing this.

[^4]: The top comment says not likely, fwiw.

[^5]: Yes, they stole the idea from Xerox; I'll give credit to them here for the execution of the idea. Apple executed the idea well; Xerox executed the idea. Yeah I'll see myself out.

[^6]: I oddly remember being so proud of this [zip drive](https://en.wikipedia.org/wiki/Zip_drive 'zip') that my dad gave me because it was newer, fancier, and had _more storage!!!_ than other people. Or when people would compare thumb drive sizes.

[^7]: As with all the other layers, this is a simplified version of reality. Many companies span multiple layers with multiple product offerings.

[^8]: I couldn't find more detail on specific line items, but they might actually exist somewhere in the filings, lmk if you do know. MSFT claims 43mm Office Consumer subscribers in their earnings call [here](https://view.officeapps.live.com/op/view.aspx?src=https://c.s-microsoft.com/en-us/CMSFiles/TranscriptFY20Q4.docx?version=0d57e08d-7bdf-419e-da08-e83b4800706a 'MSF'). At [$100 per year](https://www.microsoft.com/en-us/microsoft-365/buy/compare-all-microsoft-365-products?tab=1 'pricing') that's $400mm in revenue from Consumer, and likely many times that for Office Commercial.

[^9]: Notion's [pricing page](https://www.notion.so/pricing 'pricing') doesn't show their Enterprise pricing, but I'd assume it's somewhere in the range of $20 per user per month, given that's close to what [G suite is charging](https://support.google.com/a/answer/1247360?hl=en 'GOOG'). Like with most software businesses, once they overcome the large initial hurdle of selling into the enterprise, the revenue should be sticky after that, since it's a pain to switch away. This implies Notion can take pricing up every couple of years for any particular customer. I think modeling any growth rate assumptions right now is difficult, unless you're willing to accept a wide range in the final valuation that could be magnitudes of difference from low vs high end of the range.

[^10]: Sidenote, in a majority of cases don't ever "hide" rows or columns in your spreadsheet. Group and ungroup them instead. Hiding makes it difficult to realise that there's additional data, and that reduces ease of use for the next person. Investment banking analysts I'm talking to you.

[^11]: It's a bit more similar to SQL in this regard.

[^12]: To be clear, I don't think this is likely. I didn't cover this in depth, but given the large amount of specialised software out there, I think building a general purpose tool that can create all of them ends up meaning you make a programming language. Which is not the point.
