---
title: 'Plaid and the Power of APIs'
description: 'Plaid abstracts away the boring financial plumbing, enabling others to innovate faster.'
pubDate: 2021-01-30
category: 'Tech'
tags: ['startups', 'tech', 'software']
featured: false
heroImage: './plaid_3.webp'
---

## Takeaway

Plaid is a financial technology company that helps other companies connect with bank data. By doing the boring stuff others don't want to do it makes life more convenient for everyone else and becomes a highly sticky product.

## 1. Abstracting away layers of work

I'll be discussing the financial technology company [Plaid](https://plaid.com/ 'plaid') today. Before that, it would help to get some intuition on abstraction and Application Programming Interfaces (APIs). I'll spend section 1 on abstraction and section 2 on APIs; skip ahead to section 3 if you're already familiar with those concepts. As usual, I'll err on the side of being less technically accurate for easier understanding.

We'll first discuss abstraction:

Suppose you have a groundbreaking app idea to make lots of money. You code your app such that every time a person presses their keyboard's F2 key, stuff happens and they make a profit:

![plaid](./plaid_1.webp)

You test this on your laptop, all works well, and you start raking in cash. It works so well that you tell all your friends about it, who want in on it too. You send them the code and tell them to go forth and prosper.

One of your friends (the annoying hipster one) tells you that the code doesn't work on his Mac, and he's sad he can't make money for his next single origin single barrel single plant cup of coffee. You wonder why, and go troubleshoot the code.

Turns out Macs have this weird [Touch Bar thing](https://support.apple.com/en-gb/guide/mac-help/mchlbfd5b039/mac 'touch') for function keys, whose sole purpose as far as you can tell seems to be to make life miserable. You add in special code for Mac users:

![plaid](./plaid_2.webp)

It works for him now, and he moves on to [suing magazines for saying all hipsters look alike.](https://www.independent.co.uk/news/media/hipster-magazine-photo-lawsuit-mit-technology-review-a8813941.html 'hipster')

Another friend asks if you can also support mobile phones, to make money on the go. Someone else asks if you can add Blackberry support. And yet another wants to know when the app will be available for the [KFC gaming console](https://www.bbc.com/news/business-55433318 'kfc').

As you stare at these tasks of adding more code for all the different computing devices out there, you start to despair. Why can't making money be as easy as pushing a button? **You just want to write your code once, and then be able to use it across multiple devices.**

The idea above is actually a common problem in computing (multiple device support, not the money making one). If you write software that is meant to do everything, you'll need to account for all possible end user devices. After your code is translated to binary (1s and 0s), it needs to still do the same thing. Devices all have their own quirks, and you'll spend more time dealing with exceptions than writing the main functionality.

In the late 90s people realised a solution to this - add an additional layer in between, aka **make it someone else's problem.** [As Shimon Schocken explains,](https://www.youtube.com/watch?v=E28KczysecE 'Shimon') having a "middleman" now simplifies your task. Instead of writing code for every possible device, you "write once, run anywhere", and let that middleman deal with making your code compatible [^1]:

![plaid](./plaid_3.webp)

**Splitting one big task into smaller tasks makes it easier for everyone.** You've abstracted away part of the problem, since you want to write "high level" code and not worry about specific implementation bugs. Others may actually like the "low level" implementation details, but don't want to code the apps on top of it. From each according to his ability, to each according to his needs and all that jazz.

We'll come back to this idea of abstraction, which lets people **focus on just specific portions of a task.**

Now, suppose you and your friends want to put all of that money into banks around the world. The banks all have different procedures, and will kick you out if you don't follow their rules:

- The New York location just wants you to say your account number, password, and order, [banning you if you talk too much](https://www.youtube.com/watch?v=euLQOQNVzgY 'soup')
- The San Francisco location won't serve you unless you display at least 5 company stickers on your laptop
- The Singapore location wants to know when you're expecting to get married and have children for the sake of the country

Most of the group hates memorising all these rules, but April is an exception. She delights in handling esoteric options, volunteering to deal with all the banks on behalf of the group. Not caring about how transactions happen, but only that they do happen, the group lets her deal with everything.

Some acquaintances from a psychedelic retreat you took part in hear about your arrangement. They also dislike dealing directly with their banks, and want to know if April can help them too. She's happy to do so, as long as they pay her a small fee. Word spreads, and pretty soon everyone is calling on April as an intermediary.

We see again that people cared most about **one part of a larger task** - the deposits and withdrawals. People don't care why April likes this or how she remembers everything, just that she gets it done. Having an April makes life more convenient.

Lastly, suppose you wanted to check your account balance, just to confirm April isn't embezzling the money to pay for hidden service fees in her rental AirBNB. You start typing in recent deposits in a spreadsheet:

![plaid](./plaid_4.webp)

Being a programmer, you disdain excel and aren't familiar with its features. You do know about the "+" sign to add things though, and start manually calculating your balance that way:

![plaid](./plaid_5.webp)

A hundred cells and an hour later, you're close to being done, when a friend asks you what you're doing. They then explain the sum() function does what you want:

![plaid](./plaid_6.webp)

They also tell you about the whole **"library" of functions** that excel has to help make math easier, such as avg(), count(), etc. The cool thing is that you can expect the same behaviour for that function, regardless of whatever device you're using - your Windows laptop, your friend's Mac, your dad's mobile phone. Once you know what the function does and how to call on it, you can save time. You don't care how excel does it, just that it works everywhere, all the time.

Abstracting away different layers of work **increases possibilities and opportunities at each layer.** The person who programmed sum() doesn't want to spend her time adding up your deposits for you. Neither do you want to program the sum() function. People focus on the part they want to work on. Not doing everything lets people create lots of things.

**The concept of abstraction applies outside of programming too.** We all work on a "layer" of a problem, trusting that everything below it is reliable. You're reading this in your email, not caring how email services work, just that they behave in predictable ways.

## 2. Application Programming Interfaces as contracts

We're now ready to think about Application Programming Interfaces (APIs). Imagine you had programmed a library of math functions, like sum() in the above. **Wouldn't it be convenient if you could use those functions in other programs?**

And if you can make that library accessible to everyone, others could use it to build their own interesting things. You can focus on making your math functions, and others can focus on making apps that call on the functionality of your library as needed.

As [Joshua Bloch](https://www.youtube.com/watch?v=LzMp6uQbmns 'Josh') points out, as early as 1952 people like [David Wheeler](<https://en.wikipedia.org/wiki/David_Wheeler_(computer_scientist)> 'David') [^2] were already proposing this idea of [having libraries of functions (sub-routines)](http://www.laputan.org/pub/papers/Wheeler.pdf 'wheeler'):

![plaid](./plaid_7.webp)

**We'll call that library of functions an API [^3].** Joshua believes the term was first used in [a 1968 paper by Ira Cotton and Frank Greatorex:](https://www.computer.org/csdl/pds/api/csdl/proceedings/download-article/12OmNyRPgFZ/pdf 'ira')

![plaid](./plaid_8.webp)

That usage touches on the concepts we discussed in our examples:

- **Abstraction.** You don't care how the math functions work, just that they do. Splitting up the big task opens up possibilities for interesting work at every layer
- **Hardware independence.** We can use the API regardless of what device we're using, expecting it to be the one handling integration
- **Reusability.** The library can be used across multiple people who want different things

Our API is a **well defined contract**, telling us the inputs required and the outputs expected. For example, we want the sum() function to always return the total of the inputs, and not the total in some cases and the average in others.

We also **can't expect our APIs to do anything outside of the contract.** For example, sum() works in excel, but make_me_money() does not, unless the creator of excel codes that function.

And we **trust that the API was programmed correctly,** having undergone rigourous testing. For example, the sum() function should give us the same result on the same dataset each time.

Imagine life without any APIs. You would have to start from scratch every time you programmed anything, and would also have to account for every possible end user scenario. It'd be like [making a sandwich from scratch](https://www.smithsonianmag.com/smart-news/making-sandwich-scratch-took-man-six-months-180956674/ 'sandwich').

## 3. Plaid as an API

We've established what APIs are and why they're important. Now, what does Plaid do?

For those unaware, Plaid is a financial technology company that was [supposed to be bought by Visa for $5bn](https://www.justice.gov/opa/pr/visa-and-plaid-abandon-merger-after-antitrust-division-s-suit-block 'plaid'), before abandoning the acquisition due to antitrust issues. Unlike my dating life, getting rejected actually made them _more_ valuable, and they're now [rumoured to be raising money at $15bn.](https://www.theinformation.com/articles/plaid-shareholders-field-offers-at-15-billion-after-merger-collapse '15')

Remember how April was running in between you and banks? Think of April as an API.

**Plaid is the API between banks and whatever else wants to use banking data.** They enable their customers to build apps on top of their APIs, without worrying about the behind the scenes integration work required. And it's a ton of work.

Suppose you're building a budget app, which needs access to user's spending history. If you used your own code for connecting with banks, you would need to write entire new sections whenever a new bank was added. You'd probably spend more time on that than the main functions of your app, given the new standards changing all the time.

![plaid](./plaid_9.webp)

Plaid can provide you with APIs that will always work, and also a user interface that the user will see when connecting to a bank [(Plaid Link).](https://plaid.com/docs/link/ 'link') Your problem has become their problem.

We'll take a peek at what this looks like, by following Plaid's Quickstart guide [here](https://plaid.com/docs/quickstart/ 'quickstart'). It gives you some files to set up a demo app on your own computer.

After a day of troubleshooting, multiple computer restarts, and blindly installing what seemed like every possible program out there [^4]:

![plaid](./plaid_10.webp)

I finally got some of it to work, connecting with a test bank account:

![plaid](./plaid_11.webp)

This allowed me to look at dummy data such as my bank account balance:

![plaid](./plaid_12.webp)

Or recent transaction data:

![plaid](./plaid_13.webp)

If I ~~wanted to~~ knew how to, I could continue building out a financial app this way. The app would use the Plaid API to pull balance data, log a transaction, and update the balance. At this point though I encountered more bugs and ~~gave up~~ left it for another time.

If I was building a company, you can imagine the time saved by letting Plaid do all the foundational finance work for me. I don't want to be working on the bank integration problem that's a layer below; that's not exciting for me. I'd rather work on making the shiny stock trading roulette wheel on top of that to fleece people of their money; that's [doing god's work](https://dealbook.nytimes.com/2009/11/09/goldman-chief-says-he-is-just-doing-gods-work/ 'god').

If you think about most companies these days as "technology" companies, and then also think about how many of them require "financial" data, **you start to get a sense of how large Plaid's opportunity is.** The more companies created that want to integrate directly with customer bank accounts, the more relevant Plaid becomes.

**Plaid charges companies,** not consumers, for usage of the API [^5]. It [seems to take](https://plaid.com/pricing/ 'pricing') a transaction based fee for smaller companies, and a subscription fee for larger companies. By doing the "boring" stuff they've created a win-win situation for themselves and other innovators who are happy to pay them for the convenience.

Once you're using Plaid, **it's unlikely you'll switch,** since that would involve re-writing a lot of the code that uses Plaid's APIs [^6]. Think about what that means for Plaid's ability to raise prices. How often do you change your plumbing?

If that sounds unrealistic, consider Fortran, an early programming language. Its library of functions was [defined in **1958**](http://ed-thelen.org/LaFarr/IBM-FORTRAN-II-704-C28-6000-2-c-1958.pdf 'fortran'), and is still being used today. Once implemented, APIs last a long time:

![plaid](./plaid_14.webp)

We covered a lot today - intuition behind abstraction, APIs, and what Plaid does. The main takeaway is that **there's a lot of stuff that people don't want to do, and a lot of money to be made doing all that stuff.** The newsletter tells you to avoid boring people, but in this case building the boring stuff is a multibillion business.

### Further resources:

1. [What does Plaid do?](https://technically.substack.com/p/what-does-plaid-do 'plaid') by Technically
2. [Fireside chat with Plaid CEO Zach Perret](https://www.youtube.com/watch?v=sgnCs34mopw 'youtube') by FirstMark
3. [APIs all the way down](https://notboring.substack.com/p/apis-all-the-way-down 'nb') by Not Boring
4. [A brief, opinionated history of the API](https://www.youtube.com/watch?v=LzMp6uQbmns 'youtube') by Joshua Bloch
5. [How to build a fintech app in Python using Plaid's banking API](https://www.youtube.com/watch?v=Lv2jIOi2fao 'youtube') by Erol Aspromatis

Thanks to [Brian Rubinton](https://twitter.com/brianru 'b'), [Justin Gage](https://mobile.twitter.com/itunpredictable 'j'), Ben Morsillo, [Denis Papathanasiou](https://github.com/dpapathanasiou 'd'), Mai Schwartz, [Aditya Athalye](https://evalapply.org/ 'a'), [Jeremy Presser](https://mobile.twitter.com/JeremyPresser 'j'), [Ian Kar](https://mobile.twitter.com/iankar_ 'i') for advice on this article

## Other

1. [Why working from home will stick.](https://nbloom.people.stanford.edu/sites/g/files/sbiybj4746/f/why_wfh_stick1_0.pdf 'wfh') In line with my current belief that we'll go back to office based work, with more work from home days.
2. [What is an IP address?](https://outofips.netlify.app/ 'IP')
3. [The sting of poverty](http://archive.boston.com/bostonglobe/ideas/articles/2008/03/30/the_sting_of_poverty/?page=1 'poverty')
4. [How I blew out my knee and came back to win a national championship](https://www.jasonshen.com/2011/blew-out-knee-win-national-championship/ 'jason')
5. [Judgement is an exercise in discretion](https://aeon.co/essays/judgment-is-an-exercise-in-discretion-circumstances-are-everything? 'judge')

[^1]: To be more technically accurate, it would be the compiler that has to be compatible with every device, and not the code itself, which is a layer above the compiler.

[^2]: David is apparently the first person to be awarded a PHD in computer science.

[^3]: Technically it should be the contract itself between the parties that is the interface, but I think lumping it together is easier to understand for a beginner

[^4]: I'm 99% certain the Plaid github folder for python is incorrect, as it has empty index.html files. There's also some weird namespace issue between plaid and plaid-python that I couldn't quite understand but eventually fixed. I don't know why they need to use Docker, which was among the many additional programs required for my stuff to work. Update: Plaid has since mentioned that these bugs have been fixed, with a different quickstart process.

[^5]: I'm sure the companies try to pass on that cost to consumers, but the point here is that the direct customer paying for the service is companies that are making apps that require financial integration

[^6]: I believe this to be the case but let me know if mistaken.
