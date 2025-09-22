---
title: 'P values - you (and I) are getting it wrong'
description: 'What does a p value mean actually'
pubDate: 2019-09-04
category: Lifestyle
tags: ['math']
heroImage: './p_1.webp'
---

Most of us have studied about p values in a Statistics class at some point. Most of us think we understood enough then; we passed our class after all. Most of us are very wrong.

Because of widespread p value misuse, [some scientists are speaking out against the application of p values in research](https://www.nature.com/articles/d41586-019-00857-9 'against p values'):

> We are not calling for a ban on P values. Nor are we saying they cannot be used as a decision criterion in certain specialized applications (such as determining whether a manufacturing process meets some quality-control standard). And we are also not advocating for an anything-goes situation, in which weak evidence suddenly becomes credible. Rather, and in line with many others over the decades, we are calling for a stop to the use of P values in the conventional, dichotomous way — to decide whether a result refutes or supports a scientific hypothesis

The authors are asking to change the perception of p values as the 'one thing' that determines if research result is accepted or not. They go on to describe their rationale, and also outline some alternatives, which I'll come to in a bit.

Firstly though, to better understand what they're arguing for, we should refresh our memory on [what p values are](https://www.nature.com/articles/d41586-019-00874-8 'p values') [^1]:

> a measure of how surprising a result is, given assumptions about an experiment, including that no effect exists. Whether a P value falls above or below an arbitrary threshold demarcating ‘statistical significance’ (such as 0.05) decides whether hypotheses are accepted, papers are published and products are brought to market.

So we do some math around our results, get a number X, and then reject our null hypothesis if our number X is <0.05, implying credibility for our alternate hypothesis [^2]. The process itself seems mechanical but somewhat understandable. The problem comes with interpreting what we've just done. Is X the probability that you're making a mistake by rejecting the null hypothesis? Is X the probability of you being wrong when accepting the alternate hypothesis? Is 1 - X the probability you're right?

None of the above interpretations are correct, showing how stats can be non-intuitive, and why [not even scientists for meta-science can explain what p values mean intuitively](https://fivethirtyeight.com/features/not-even-scientists-can-easily-explain-p-values/? 'easily explain'):

> We want to know if results are right, but a p-value doesn’t measure that. It can’t tell you the magnitude of an effect, the strength of the evidence or the probability that the finding was the result of chance.

> So what information can you glean from a p-value? The most straightforward explanation I found came from Stuart Buck, vice president of research integrity at the Laura and John Arnold Foundation. Imagine, he said, that you have a coin that you suspect is weighted toward heads. (Your null hypothesis is then that the coin is fair.) You flip it 100 times and get more heads than tails. The p-value won’t tell you whether the coin is fair, but it will tell you the probability that you’d get at least as many heads as you did if the coin was fair. That’s it — nothing more.

Importantly, your p value is the probability of getting the result you have, _under the null hypothesis assumed_. If your null hypothesis was correct, you'd only have gotten the result you did in X% of experiments. Since X is a low number, you assume it's unlikely the null hypothesis is correct, and reject it. This doesn't tell you the probability of getting the result you have _when not assuming the null hypothesis_.

Let's assume we have an experiment to see if the average height of a group of people is 0. We'd reject our null hypothesis with a very low p value, since obviously everyone's height is >0. However, that tells us nothing about the chance of getting the average height we calculated in this 'true state of the world'. It just tells us that there was a low probability that we'd have gotten the average height we did, _if average height was 0_ [^3].

Clearly p values are more nuanced than the simple yes/no that most people (myself included) believed [^4]. The authors in the first piece go on to state:

> Let’s be clear about what must stop: we should never conclude there is ‘no difference’ or ‘no association’ just because a P value is larger than a threshold such as 0.05 or, equivalently, because a confidence interval includes zero. Neither should we conclude that two studies conflict because one had a statistically significant result and the other did not.

> Surveys of hundreds of articles have found that statistically non-significant results are interpreted as indicating ‘no difference’ or ‘no effect’ in around half

Non-significant statistical results do not mean the same thing as no effect. In fact, the authors prefer to avoid the usage of 'statistically significant':

> We agree, and call for the entire concept of statistical significance to be abandoned.

Their reason for doing so is that this designation of yes/no signficance is a false dichotomy:

> The trouble is human and cognitive more than it is statistical: bucketing results into ‘statistically significant’ and ‘statistically non-significant’ makes people think that the items assigned in that way are categorically different \[...\] One reason to avoid such ‘dichotomania’ is that all statistics, including P values and confidence intervals, naturally vary from study to study, and often do so to a surprising degree. In fact, random variation alone can easily lead to large disparities in P values, far beyond falling just to either side of the 0.05 threshold.

This makes sense to me, but seems to be an uphill battle. When dealing with complicated decisions, people want simple heuristics to use, and p values provide an easy way to justify something

The authors also discuss some things to bear in mind when using confidence intervals [^5]:

> First, just because the interval gives the values most compatible with the data, given the assumptions, it doesn’t mean values outside it are incompatible; they are just less compatible.

> Second, not all values inside are equally compatible with the data, given the assumptions.

> Third, like the 0.05 threshold from which it came, the default 95% used to compute intervals is itself an arbitrary convention.

> Last, and most important of all, be humble: compatibility assessments hinge on the correctness of the statistical assumptions used to compute the interval.

And they conclude with their vision of what a world without singular emphasis on p values would look like:

> What will retiring statistical significance look like? We hope that methods sections and data tabulation will be more detailed and nuanced. Authors will emphasize their estimates and the uncertainty in them — for example, by explicitly discussing the lower and upper limits of their intervals. They will not rely on significance tests. When P values are reported, they will be given with sensible precision (for example, P = 0.021 or P = 0.13) — without adornments such as stars or letters to denote statistical significance and not as binary inequalities (P  < 0.05 or P > 0.05). Decisions to interpret or to publish results will not be based on statistical thresholds. People will spend less time with statistical software, and more time thinking.

As I've written about before, [beliefs are tricky](https://leonlins.com/writing/2019_02_18_why/ 'belief'), even if you're a firm believer in Science. Experimentation is a key part of how the scientific process works, and understanding how to intepret results is a significant component of that. Misunderstanding of p values has led to misconceptions about studies when reported in the news. Unfortunately I don't see this changing anytime soon, given it's so much easier to interpret p values as a yes/no thing. I don't know if the solution is to reduce the significance of p values, but being more aware of their misuse is helpful.

[^1]: The article the below description is from also summarises the main arguments of the opening opinion piece by Valentin Amrhein, Sander Greenland, Blake McShane

[^2]: In my initial draft I wrote "accept our hypothesis and reject it otherwise", which is the wrong interpretation of what a p value is. Goes to show how easy it is to make a mistake, and I'm now slightly paranoid that I've made another in this post.

[^3]:
    Some other resources I found helpful to read through again are [here](https://blog.minitab.com/blog/adventures-in-statistics-2/how-to-correctly-interpret-p-values 'interpret') and [here](https://blog.minitab.com/blog/adventures-in-statistics-2/understanding-hypothesis-tests-significance-levels-alpha-and-p-values-in-statistics? 'stats'). Besides talking about why p value is not the same as error rate, the site also had an interesting table which showed how a low p value could result in a high error rate:

    | P value | Probability of incorrectly rejecting a null hypothesis (that is actually true) |
    | ------- | ------------------------------------------------------------------------------ |
    | 0.05    | At least 23% (and typically close to 50%)                                      |
    | 0.01    | At least 7% (and typically close to 15%)                                       |

    > "Do the higher error rates in this table surprise you? Unfortunately, the common misinterpretation of P values as the error rate creates the illusion of substantially more evidence against the null hypothesis than is justified. As you can see, if you base a decision on a single study with a P value near 0.05, the difference observed in the sample may not exist at the population level."

[^4]: This is despite taking multiple stats classes across high school and college... which either shows how difficult this is or how long I take to understand something.

[^5]: They also prefer the term 'compatibility interval' instead
