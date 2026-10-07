---
title: "PlaidとAPIの力"
description: "Plaidは退屈な金融の配管を抽象化し、他者がより速くイノベーションできるようにします。"
pubDate: 2021-01-30
category: Technology
tags: ['startups', 'software']
featured: false
heroImage: '../../../blog/2021_01_30_plaid/plaid_3.webp'
locale: 'ja'
sourceSlug: 'plaid'
sourceHash: 'daae66d786d14dbfb4c0c831358b5f6fed3ca4b971461b077f61a7895375e9cd'
---

## テイクアウト

Plaidは、他の企業が銀行データとつながるのを支援する金融テクノロジー企業です。他の人がやりたくない退屈な作業をすることで、他の人にとって生活が便利になり、非常に粘着性の高い商品になります。

## 1.作品の層を抽象化して取り除く

今日は金融テクノロジー企業について話[Plaid](https://plaid.com/ 'plaid')します。その前に、抽象化やアプリケーションプログラミングインターフェース(API)について直感を身につけておくと良いでしょう。セクション1は抽象化、セクション2はAPIについて話します。すでにこれらの概念に慣れている方はセクション3に飛ばしてください。いつものように、理解しやすいように技術的に正確さは控えめにします。

まず抽象について話しましょう。

例えば、画期的なアプリのアイデアで大金を稼ぐとします。ユーザーがキーボードのF2キーを押すたびに何かが起こり、利益を得るようにアプリをコーディングします:

![plaid](../../../blog/2021_01_30_plaid/plaid_1.webp)

これをノートパソコンでテストし、すべて順調に動作し、収益を上げ始めます。あまりにもうまくいくので、参加したい友人たちに話すのです。コードを送って、成功しろと伝えます。

友人の一人(うるさいヒップスターの方)が、そのコードがMacでは動かないと言い、次の単一産地単一バレル単一植物のコーヒーを買うためにお金が稼げないことを悲しんでいます。なぜそうなるのか不思議に思い、コードのトラブルシューティングに行きます。

Macにはファンクションキー用の奇妙な[Touch Bar thing](https://support.apple.com/en-gb/guide/mac-help/mchlbfd5b039/mac 'touch')があり、その唯一の目的は生活を困らせることだけのようです。Macユーザー向けに特別なコードを追加します:

![plaid](../../../blog/2021_01_30_plaid/plaid_2.webp)

今はそれが彼に合い、彼は[suing magazines for saying all hipsters look alike.](https://www.independent.co.uk/news/media/hipster-magazine-photo-lawsuit-mit-technology-review-a8813941.html 'hipster')に進みます

別の友人は、モバイルもサポートして外出先でお金を稼げるか尋ねています。別の人はBlackberryのサポートを追加できるか尋ねています。さらに別の友人は、アプリがいつ[KFC gaming console](https://www.bbc.com/news/business-55433318 'kfc')で利用可能になるのか知りたがっています。

さまざまなコンピューティングデバイス向けにコードを追加する作業を見つめていると、だんだん絶望し始めます。なぜお金を稼ぐのがボタンを押すだけの簡単なことではないのでしょうか?**一度コードを書いて、それを複数のデバイスで使えるようにしたいだけです。**

上記の考え方は、実際にはコンピューティング(複数のデバイスサポート、つまり収益化のためのものではなく)でよくある問題です。すべてのことを目的としたソフトウェアを書くなら、すべてのエンドユーザーデバイスを考慮する必要があります。コードをバイナリ(1と0)に変換した後も、同じことをしなければなりません。デバイスごとに独自の癖があり、主な機能を書くよりも例外処理に多くの時間を費やすことになります。

90年代後半には解決策が見つかりました。つまり、その間にもう一層、つまり**他人の問題にする*という方法です。** [As Shimon Schocken explains,](https://www.youtube.com/watch?v=E28KczysecE 'Shimon')「仲介者」がいることで作業が簡素化されます。すべてのデバイス向けにコードを書く代わりに、「一度書いてどこでも動く」という形で、その仲介者がコードの互換性を担当する[^1]:

![plaid](../../../blog/2021_01_30_plaid/plaid_3.webp)

**大きなタスクを小さなタスクに分割することで、みんなにとって楽になります。** あなたは問題の一部を抽象化してしまいました。なぜなら「高レベル」なコードを書きたいので、特定の実装バグを気にしなくていいからです。他の人は「低レベルの」実装の詳細は好きでも、その上にアプリを書くのは嫌がるかもしれません。それぞれの能力に応じて、それぞれのニーズに応じて、そういった流れです。

この抽象化の考え方に戻ります。抽象化は、人々がタスクの特定の部分に集中できるようにします。

さて、あなたと友人たちが世界中の銀行にそのお金をすべて振り込みたいとします。銀行はそれぞれ異なる手続きを持っており、ルールに従わなければ追い出されます:

- ニューヨークの店舗は口座番号、パスワード、注文を伝えてほしいだけ[banning you if you talk too much](https://www.youtube.com/watch?v=euLQOQNVzgY 'soup')
- サンフランシスコの店舗は、ノートパソコンに少なくとも5枚の会社のステッカーを貼らない限り対応しません
- シンガポールの拠点は、国のために結婚や子どもを持つ予定日を知りたがっています

グループの多くはこれらのルールを暗記するのが嫌いだが、エイプリルは例外だ。彼女は難解な選択肢を扱うことを楽しんでおり、グループの代わりにすべての銀行とやり取りすることを志願している。取引の進み方には関心がなく、ただ取引が起こることだけを気にし、グループはすべて彼女に任せている。

あなたが参加したサイケデリックリトリートの知り合いの何人かが、あなたの取り決めについて聞いています。彼らは銀行と直接やり取りするのを嫌い、エイプリルにも助けられるかどうか知りたがっています。彼女は少額の料金を支払えば喜んで協力します。噂が広まり、やがて皆が仲介者としてエイプリルに電話をかけるようになります。

またしても、人々が一番気にかけていたのは**大きなタスクの一つ**―入出金――に集中していたということです。人々はエイプリルがなぜこれを好むのか、どうやってすべてを覚えているのかは気にせず、ただそれをやり遂げることだけが大切です。エイプリルがいることで生活がより便利になります。

最後に、もしあなたがアカウント残高を確認したいとしたら、エイプリルがレンタルAirBNBの隠れたサービス料を横領していないか確認したいのです。あなたはスプレッドシートに最近の入金を入力し始めます:

![plaid](../../../blog/2021_01_30_plaid/plaid_4.webp)

プログラマーなのでExcelが嫌いで、その機能に詳しくありません。ただし、追加用の「+」記号は知っていて、その方法で手動で残高を計算し始めます。

![plaid](../../../blog/2021_01_30_plaid/plaid_5.webp)

100セルと1時間後、ほぼ終わろうとしたとき、友人が「何をしているの?」と尋ねます。彼らはsum()関数があなたの望むことをすると説明します:

![plaid](../../../blog/2021_01_30_plaid/plaid_6.webp)

また、エクセルが数学を楽にするための「ライブラリ」機能(例えばavg()、count(など)についても教えてくれます。面白いのは、どのデバイスを使っていても、Windowsノートパソコンでも友人のMacでも、お父さんの携帯電話でも同じ動作が期待できることです。関数の動作や呼び方がわかれば、時間の節約になります。Excelがどうやって使うかは気にせず、どこでもいつでも動作すればいいだけです。

異なる作業層を抽象化することで、**各層での可能性と機会が増えます。** sum() をプログラムした人は、あなたの預金を合計するのに時間を費やしたくありません。あなたも sum() 関数をプログラムしたくありません。人は自分が取り組みたい部分に集中します。すべてをやらなければ、多くのものを作れるのです。

**抽象化の概念はプログラミングの外にも適用されます。** 私たちは皆、問題の「層」に取り組み、その下のすべてが信頼できると信じています。あなたはメールでこれを読んでいて、メールサービスの仕組みは気にせず、ただ予測可能な振る舞いをしているだけです。

## 2.契約としてのアプリケーションプログラミングインターフェース

これでアプリケーションプログラミングインターフェース(API)について考える準備ができました。上記のsum()のような数学関数のライブラリをプログラムしたと想像してください。**それらの関数を他のプログラムで使えたら便利ではないでしょうか?**

そして、そのライブラリを誰でも利用できるようにすれば、他の人もそれを使って自分だけ面白いものを作ることができます。あなたは数学関数の作成に集中でき、他の人は必要に応じてライブラリの機能を呼び出すアプリを作ることに集中できます。

[Joshua Bloch](https://www.youtube.com/watch?v=LzMp6uQbmns 'Josh')が指摘するように、1952年にはすでに[David Wheeler](<https://en.wikipedia.org/wiki/David_Wheeler_(computer_scientist)> 'David') [^2]のような人々がこの[having libraries of functions (sub-routines)](http://www.laputan.org/pub/papers/Wheeler.pdf 'wheeler')の考えを提案していました。

![plaid](../../../blog/2021_01_30_plaid/plaid_7.webp)

**その関数ライブラリをAPI[^3]と呼びます。**ジョシュアはこの用語が[a 1968 paper by Ira Cotton and Frank Greatorex:](https://www.computer.org/csdl/pds/api/csdl/proceedings/download-article/12OmNyRPgFZ/pdf 'ira')年に初めて使われたと考えています

![plaid](../../../blog/2021_01_30_plaid/plaid_8.webp)

この用法は、私たちが例で議論した概念に触れています。

- **抽象化。** 数学関数がどう動くかは気にせず、ただ機能していることだけが重要だ。大きなタスクを分割することで、あらゆる層で面白い仕事の可能性が開ける
- **ハードウェアに依存しない。** どのデバイスを使っていてもAPIを使え、統合を担当するAPIを期待して使えます
- **再利用性。** ライブラリは異なる目的を持つ複数の人で利用できます

私たちのAPIは**明確に定義された契約**で、必要な入力と期待される出力を教えてくれます。例えば、sum()関数は常に入力の合計を返してほしいのですが、場合によっては合計ではなく、また別の場合は平均を返しません。

また、APIが契約外のことを期待することもできません。例えば、sum()はExcelでは動作しますが、make_me_money()はExcelの作成者がその機能をコード化しない限り動かしません。

そして、厳格なテストを経てAPIが正しくプログラムされていると信頼しています。例えば、sum()関数は同じデータセットで毎回同じ結果を出すはずです。

APIがない生活を想像してみてください。何かをプログラムするたびに一からやり直さなければならず、あらゆるエンドユーザーのシナリオを考慮しなければなりません。それはまるで[making a sandwich from scratch](https://www.smithsonianmag.com/smart-news/making-sandwich-scratch-took-man-six-months-180956674/ 'sandwich')のようなものです。

## 3.PlaidをAPIとして

APIとは何か、なぜ重要なのかを確立しました。では、Plaidは何をするのでしょうか?

ご存じない方のために説明すると、Plaidは金融テクノロジー企業で、[supposed to be bought by Visa for $5bn](https://www.justice.gov/opa/pr/visa-and-plaid-abandon-merger-after-antitrust-division-s-suit-block 'plaid')していましたが、独占禁止法の問題で買収を断念しました。私の恋愛とは違い、拒絶されたことで実際に価値が高まり、今ではその会社は[rumoured to be raising money at $15bn.](https://www.theinformation.com/articles/plaid-shareholders-field-offers-at-15-billion-after-merger-collapse '15')

4月があなたと銀行の間にあったのを覚えていますか?4月をAPIだと考えてください。

**Plaidは銀行と銀行データを利用したい他の企業間のAPIです。** 彼らは顧客がAPIの上にアプリを構築できるようにし、裏での統合作業を気にする必要がありません。そしてそれは膨大な作業です。

例えば、予算アプリを作っているとしましょう。ユーザーの支出履歴にアクセスする必要があります。もし自分のコードを銀行と接続するなら、新しい銀行が追加されるたびに新しいセクションを書く必要があります。新しい基準が常に変わっているため、アプリの主要な機能よりも多くの時間をかけることになるでしょう。

![plaid](../../../blog/2021_01_30_plaid/plaid_9.webp)

Plaidは常に動作するAPIを提供し、銀行に接続した際にユーザーが見ることができるユーザーインターフェースも提供します[(Plaid Link).](https://plaid.com/docs/link/ 'link')あなたの問題が彼らの問題に変わったのです。

Plaidのクイックスタートガイド[here](https://plaid.com/docs/quickstart/ 'quickstart')を参考にして、この様子を少し見てみましょう。自分のパソコンでデモアプリをセットアップするためのファイルがいくつかあります。

一日のトラブルシューティング、複数回の再起動、そしてほぼすべてのプログラムを無差別にインストールした後[^4]:

![plaid](../../../blog/2021_01_30_plaid/plaid_10.webp)

ついに一部を動かし、テスト用の銀行口座に接続しました:

![plaid](../../../blog/2021_01_30_plaid/plaid_11.webp)

これにより、銀行口座残高などのダミーデータを見ることができました:

![plaid](../../../blog/2021_01_30_plaid/plaid_12.webp)

または最近の取引データ:

![plaid](../../../blog/2021_01_30_plaid/plaid_13.webp)

もし私が~~やり方を知っていれば~~金融アプリを作り続けることもできました。アプリはPlaid APIを使って残高データを取得し、取引を記録し、残高を更新します。しかしこの時点でさらにバグに遭遇し、~~諦めました~~はまた別の機会にしておきました。

もし私が会社を作っているなら、Plaidに基礎的な財務業務をすべて任せて時間を節約できるか想像できるでしょう。銀行統合の問題はその下の層にあるので、私は取り組みたくありません。それは私にとってワクワクしません。むしろ、その上にピカピカの株式取引ルーレットホイールを作って人々のお金を騙し取る仕事をしたいです。それが[doing god's work](https://dealbook.nytimes.com/2009/11/09/goldman-chief-says-he-is-just-doing-gods-work/ 'god')です。

現代の多くの企業を「テクノロジー」企業と考え、さらに多くの企業が「財務」データを必要とすることを考えると、Plaidのチャンスがどれほど大きいかがわかります。** 顧客の銀行口座と直接連携したい企業が増えれば増えるほど、Plaidの関連性は高まります。

**PlaidはAPI[^5]の利用に対して消費者ではなく企業に料金を請求しています。小規模企業[seems to take](https://plaid.com/pricing/ 'pricing')取引手数料、大企業にはサブスクリプション料金がかかります。「退屈な」作業を行うことで、彼ら自身と利便性のために喜んで支払う他のイノベーターにとってウィンウィンの状況を生み出しています。

一度Plaidを使い始めると、切り替える可能性は低いでしょう。なぜなら、PlaidのAPIを使う多くのコードを書き直すことになるからです[^6]。それがPlaidの価格上げ能力にどう影響するか考えてみてください。配管はどのくらいの頻度で交換していますか?

もしこれが非現実的に聞こえるなら、初期のプログラミング言語であるFortranを考えてみてください。その関数ライブラリは[defined in **1958**](http://ed-thelen.org/LaFarr/IBM-FORTRAN-II-704-C28-6000-2-c-1958.pdf 'fortran')され、現在も使われ続けています。一度実装されると、APIは長く使えます:

![plaid](../../../blog/2021_01_30_plaid/plaid_14.webp)

今日は多くのことを扱いました。抽象化の直感、API、そしてPlaidが何をしているのか。主な教訓は、**人々がやりたくないことがたくさんあり、そういったことで多くのお金が稼げるということです。** ニュースレターは退屈な人を避けるように言っていますが、この場合、退屈なものを作ることは数十億ドルのビジネスです。

### さらなるリソース:

1. 技術的に [What does Plaid do?](https://technically.substack.com/p/what-does-plaid-do 'plaid')
2. FirstMarkによる[Fireside chat with Plaid CEO Zach Perret](https://www.youtube.com/watch?v=sgnCs34mopw 'youtube')
3. [APIs all the way down](https://notboring.substack.com/p/apis-all-the-way-down 'nb') Not Boringによる
4. ジョシュア・ブロックによる[A brief, opinionated history of the API](https://www.youtube.com/watch?v=LzMp6uQbmns 'youtube')
5. エロル・アスプロマティスによる[How to build a fintech app in Python using Plaid's banking API](https://www.youtube.com/watch?v=Lv2jIOi2fao 'youtube')

この記事に関するアドバイスをくださった[Brian Rubinton](https://twitter.com/brianru 'b')、[Justin Gage](https://mobile.twitter.com/itunpredictable 'j')、ベン・モルシロ、[Denis Papathanasiou](https://github.com/dpapathanasiou 'd')、マイ・シュワルツ、[Aditya Athalye](https://evalapply.org/ 'a')、[Jeremy Presser](https://mobile.twitter.com/JeremyPresser 'j')、[Ian Kar](https://mobile.twitter.com/iankar_ 'i')に感謝します

## その他

1. [Why working from home will stick.](https://nbloom.people.stanford.edu/sites/g/files/sbiybj4746/f/why_wfh_stick1_0.pdf 'wfh') 私の現在の信念に沿って、オフィスワークに戻り、在宅勤務日数を増やす予定です。
2. [What is an IP address?](https://outofips.netlify.app/ 'IP')
3. [The sting of poverty](http://archive.boston.com/bostonglobe/ideas/articles/2008/03/30/the_sting_of_poverty/?page=1 'poverty')
4. [How I blew out my knee and came back to win a national championship](https://www.jasonshen.com/2011/blew-out-knee-win-national-championship/ 'jason')
5. [Judgement is an exercise in discretion](https://aeon.co/essays/judgment-is-an-exercise-in-discretion-circumstances-are-everything? 'judge')

[^1]:より技術的に正確に言うと、コード自体ではなく、すべてのデバイスと互換性があるのはコンパイラであり、コード自体はコンパイラの上の層です。

[^2]:デイビッドはコンピュータサイエンスの博士号を授与された最初の人物らしい。

[^3]:技術的には当事者間の契約自体がインターフェースであるべきですが、初心者には一括りにまとめた方が理解しやすいと思います

[^4]:Plaidのpython用githubフォルダは99%間違いだと思います。index.htmlファイルが空だからです。また、plaidとplaid-pythonの間には理解できなかった名前空間の問題もありましたが、最終的には修正されました。なぜDockerを使う必要があるのか分かりませんが、私の作品が動作するために必要な多くの追加プログラムの一つでした。更新:Plaidはこれらのバグが修正され、クイックスタートプロセスが変わったと述べています。

[^5]:企業はそのコストを消費者に転嫁しようとしていると思いますが、ここでのポイントは、サービスに対して直接支払っているのは、金融統合を必要とするアプリを作っている企業だということです

[^6]:私はそう思いますが、間違っていたら教えてください。
