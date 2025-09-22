---
title: 'Excel calculation efficiency'
description: 'Notes about excel speed tips'
pubDate: 2016-03-17
category: Tech
tags: ['investment banking']
heroImage: './e_1.png'
---

Some time back I had to do in depth research into excel efficiency. Some of the files we were using in banking were taking a long time to calculate, and we wanted to see what improvements could be made. There's a lot of content out there, and these were the most helpful sites I found. Note that I'm not necessarily agreeing with all of the content though:

1. Microsoft's own ['improving performance' writeup](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)> 'office performance 2007')
   - "With the Excel 2007 "Big Grid," performance really matter"
   - "Excel has three distinct phases in the overall calculation process:
     - Build the initial calculation chain and determine where to begin calculating. This phase occurs when the workbook is loaded into memory.
     - Track dependencies, flag cells as uncalculated, and update the calculation chain. This phase executes at each cell entry or change, even in manual calculation mode. Ordinarily this executes so fast that you do not notice it.
     - Calculate all formulas. As a part of the calculation process, Excel reorders and restructures the calculation chain to optimize future recalculations."
   - "A volatile function is always recalculated at each recalculation even if it does not appear to have any changed precedents. Using many volatile functions slows down each recalculation, but it makes no difference to a full calculation.
     - Some of the built-in functions in Excel are obviously volatile: RAND(), NOW(), TODAY(). Others are less obviously volatile: OFFSET(), CELL(), INDIRECT(), INFO().
     - Some functions that have previously been documented as volatile are not in fact volatile: INDEX(), ROWS(), COLUMNS(), AREAS()."
     - Note: this may have changed in later office versions
   - They give a list of volatile actions that trigger recalcs
   - They also give a macro to measure calc time
   - They give some [golden rules to follow,](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#first-golden-rule-remove-duplicated-repeated-and-unnecessary-calculations> 'golden rules') with the general intent of simplicity
     - Remove Duplicated, Repeated, and Unnecessary Calculations
     - Use the Most Efficient Function Possible
     - Make Good Use of Smart Recalculation
     - Time and Test Each Change
   - They give a neat example of [how to simplify a problem](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#dynamic-count-unique> 'example problem')
   - And go through a long list of common bottlenecks with formulas

2. [Another site](https://trumpexcel.com/suffering-from-slow-excel-spreadsheets/ 'trump excel') with excel speed tips
   - "Use Helper Columns"
     - Strongly agree, and usually underutilised by many
   - "Use Excel Tables and Named Ranges"
     - Agree on named ranges, though I'm often too lazy
   - "Use Faster Formulas Techniques"
     - Notice the repeated advice

3. [Yet another site](http://www.databison.com/how-to-speed-up-calculation-and-improve-performance-of-excel-and-vba/ 'databison')
   - "Isolate repeated formulae and move them to single cells"
     - Related to the helper column point above
   - "Nest if conditions in the order of frequency of occurrence"
     - I can't remember if this is true anymore actually, so take with grain of salt

4. And lastly, a site comparing the speed of [vlookup vs index match](http://www.exceluser.com/blog/727/excels-fastest-lookup-methods-the-tested-results.html 'vlookup vs index match')
   - Index match is always superior for efficiency
   - That said, I do still use vlookups when it's a simple pull, or when I think my model is going to be looked at by someone who will be confused by index match. Design with end user in mind.
