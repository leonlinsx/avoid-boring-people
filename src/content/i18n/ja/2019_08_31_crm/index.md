---
title: "個人CRMにリマインダーを設定して、これを読むようにしてください"
description: "ペアトレード、パーソナルCRM、そして自己認識"
pubDate: 2019-08-31
category: System Design
tags: ['software', 'investing']
heroImage: '../../../blog/2019_08_31_crm/c_4.webp'
locale: 'ja'
sourceSlug: 'crm'
sourceHash: 'e5a2ed68b6f324d3e2f388faad00d7837d2e58315703ea2d2981edde507a01ca'
---

## 要点

1. バブルの中でペアトレードを見つける方が、ショートや勢いに乗るよりも良いかもしれません
2. パーソナルCRMとは何で、なぜ人々がそれについて話しているのでしょうか?
3. 私たちは自分自身をあまりよく知らない。自己認識を高める方法について

### バブルとロシアのスパイ

今年は泡に関するニュースが多い中で、特に注目したいと思います [Byrne Hobart's post about them.](https://medium.com/@byrnehobart/so-youve-spotted-a-bubble-3f2fa5cf49a9 'Bubble') [^1] 資産の現在の価格がバブルだと思ったらどうすればよいでしょうか?バーンは以下に三つの考え方を提示しています。いつものように、これらは金融アドバイスではありません。

> \[まず第一に:\] 勇敢で愚か、そして知的に一貫したアプローチ。ショートして売ることもできます。\[...\] しかし難しいのは、通常バブル資産は比較対象の資産よりも高いリターンを得るように価格設定されているからです。ただし、リスクを補うには十分に高くないリターンです。\[...\] バブルは本質的に不安定であっても長く持続する傾向があります。なぜなら部分的に自己維持的だからです。

ショート [^2] セクシーなのは、あなたが逆張り、理論上無制限のリスクを負って、普通の愚かな投資家に対して知的優位性を証明しているからです。 [There's even an oscar nominated movie about shorting the 2008 housing crisis](<https://en.wikipedia.org/wiki/The_Big_Short_(film)> 'movie').ショートの問題はタイミングが鍵だということです。早めに間違っても大ヒットすることがあります。投資家が何十億ドルも失った悪名高いショートはたくさんあります。例えば [Ackman and Herbalife](https://www.cnbc.com/2018/04/05/how-bill-ackmans-hedge-fund-empire-crumbled-in-less-than-three-years.html 'Ackman'), [Einhorn and Netflix](https://www.forbes.com/sites/antoinegara/2019/03/05/after-horrendous-investing-run-david-einhorn-exits-billionaire-club/#3a140043498c 'Einhorn')、または [whoever was short squeezed by Porsche and Volkswagen in 2008.](https://www.reuters.com/article/us-volkswagen/short-sellers-make-vw-the-worlds-priciest-firm-idUSTRE49R3I920081028 'Porsche') アクマンとアインホーンがこれらの会社について間違っていたとは言いません。彼らはまだ正しいかもしれませんが、その間に多額の損失を出しているので議論の余地はありません。

別の例として Overstock.com を挙げましょう。彼らの前に [CEO resigned so he could let everyone know he'd dated a Russian spy,](https://www.forbes.com/sites/laurendebter/2019/08/22/the-exclusive-inside-story-of-the-fall-of-overstocks-mad-king-patrick-byrne/#176918ea53a5 'Forbes') [^3] 彼は2017年にブロックチェーンに転換して会社を救おうとしていました。もしあなたがオーバーストックもこれで失敗すると思い、2017年8月に20ドルでオーバーストックを空売りしたとしたらどうでしょうか?

![post](../../../blog/2019_08_31_crm/c_1.webp)

株価がゆっくりと上昇する中、あなたはそれが長くは続かないと確信してさらに値下げします。なぜか、それは続き、2017年11月の価格は60ドルに達しています。

![post](../../../blog/2019_08_31_crm/c_2.webp)

やばい。帳面上の損失があるだけでなく、リスクも最初に持っていて安心していたものの倍にもなります。もし今ポジションを清算したら、現在の60ドルから最初に稼いだ20ドルを差し引いた40ドルを失うことになります。あなたは今、この株を空売りするか破産する決意を固めており、翌年まで持ちこたえています。

![post](../../../blog/2019_08_31_crm/c_3.webp)

あなたのブローカーが休暇から戻ってきて、あなたに発行し忘れたことに気づきます [margin call](https://www.investopedia.com/ask/answers/05/shortmarginrequirements.asp 'margin') これまでずっと、そして今になってパニック状態に陥っています。株を空売りするときは、通常、株価の約130%を担保としてバックアップ資金として必要になります [^4].株価が20ドルだった頃は、26ドルを確保できても問題ありませんでした。しかし今は104ドルを確保し、ブローカーは78ドルの差額(104ドルから26ドルを引いた額)を補足してほしいと言っています。最初に持っていた資金の量によっては、この追加で78ドル(初期エクスポージャーの3倍!)が簡単に全てを失う可能性があります。あなたはポジションを清算し、その差額をGo Fund Meを設定して補う必要があります。

そしてもちろん、こうなります:

![post](../../../blog/2019_08_31_crm/c_4.webp)

ここでの鍵は、あなたが正しかったことです。Overstockが試みたブロックチェーンのピボットはうまくいきませんでした。しかし、タイミングが間違っていて、お金も評判も失いました。たとえ株を空売りすることが『明白』であっても、例えば [bad quality companies changing their name to get a price bump](https://www.winton.com/longer-view/the-history-of-company-names 'names')、 [time period](https://www.sciencedirect.com/science/article/pii/S0165176519301703 'time') 論文が成立するために必要とされるものは、事前に破産する可能性もあります。

興味深いことに、有名な空売り業者 [Robert Wilson and Jim Chanos have this to say about shorting:](https://blogs.cfainstitute.org/investor/2016/12/22/lessons-from-a-legendary-short-seller/ 'short')

> 「最初から最後まで、ショートパンツはトントンだったかもしれない。」

> 「良いショートポートフォリオは、よりロングを持てる...それが私たちの仕事の核心です。」

はっきりさせておくと、私はショートを避けるべきだとか、ショートが経済に悪いと言っているわけではありません。 [There's research](https://marginalrevolution.com/marginalrevolution/2019/08/short-selling-reduces-crashes.html 'short MR') これは良いことかもしれないと示唆しており、多くの人がショートで利益を上げています。正しく描くのは難しいと言いたいのです。

代替案はありますか?

> \[第二に:\] 傭兵的だが利益を生むアプローチ。\[...\] 「私たちはバブルの一部であることを非常に喜んでいましたが、非常に流動性の高いポジションでそれを行えば、望めば市場から迅速に撤退できるのです。」

このバージョンでは、できるだけ長く波に乗って、できるだけ遅く降りるまで続けます [^5].これは、長期保有者を自称するにもかかわらず、多くのプロの投資家が実際にやっていることのように思えます。うまくいくなら、それはうまくいくし、多くの成功した人々がこの戦略を使っています。

> 一つだけでこれをするのは危険なので、一度にいくつかを選び、すべてが同時に崩壊しないことを願います。この分散化により、少しレバーを上げることができ、それがリターンを生み出します。リスクが上昇すると、レバレッジを下げたいとします。しかしレバレッジを下げると、複数の取引を一度に解消してしまうと、戦略を追ったトレーダーのリターンが減り、相関が高まり、売却を余儀なくされます。

デメリットは、いくつかの賭けが遅すぎて、会社が一度にどれだけ失うかのリスクパラメータのためにポジションを解消せざるを得なくなることです。これは「速く生きて若くして死ぬ」という戦略で、別の名前のファンドを始めるという感じです。

> \[最後に:\] ニルヴァーナ:ポジティブキャリーとポジティブスキュー。私自身もルイスが間違っているという意見に謙虚に貢献します。『ビッグショート』は実は素晴らしいトレードではありませんでした。もし彼が本当に本気でいれば、『ビッグペアトレード』を書いていたでしょう。\[...\]

バーンは住宅危機を例に挙げています。住宅危機の一因は、ローンが相関性がないという前提で大きなプールにまとめられたことです。実はサブプライムローンは予想以上に相関があり、これは次のことを示唆しています:

> つまり、サブプライム担保のCDOのAAA評価スライスは、実際にはAAA評価に値しなかったということです。しかし同時に、最もリスクの高い部分である株式トランシェは見た目ほどリスクが低いことも意味します。証券プール内での高い相関は大量のデフォルトの可能性が高い一方で、デフォルトのゼロも高くなります。

証券の相関が強いため、下落だけでなく上向きでもより極端な出来事が起こる可能性が高いです。これを実際に言い換えると、

> 投資家は株式の一部を購入し、AAA評価の債務の大部分に対する保険を購入し、最終的には[...\]を得ることができます。

> 株式のリターンは、AAAレーティングのスライスに対する保険購入コストを十分に補っていました。

> 不動産が上昇すれば少しは利益が出ます。なぜなら、資産価値は高くなる一方で、AAA保険はそれほど価値が低いはずがないからです。

> 不動産が下がればかなりの利益になるでしょう。

バーンは、すべてのバブルに上記の3つ目の状況があるわけではなく、それを活かすポジションの構築方法を見つけるのは難しいと結論づけています。もしそうであれば、バブルを処理するためのリスクの低い戦略となる可能性があります。

### 心配しないでください、あなたは私の個人CRMのレベル5の連絡先です\*\*

成長 [Superhuman](https://techcrunch.com/2019/06/27/my-six-months-with-30-month-email-service-superhuman/ 'techcrunch')革命的な体験と見返りに料金を請求するメールアプリが、ブームを巻き起こしました [premium subscription services](https://techcrunch.com/2019/08/27/kleiner-perkins-bets-on-a-premium-email-service-thats-bringing-slack-groups-into-gmail/ 'kleiner').最近、テックTwitterでパーソナルCRM(カスタマーリレーションシップマネジメント)というアイデアが復活しました。これは、個人的な関係管理を支援するソフトウェアです。

![post](../../../blog/2019_08_31_crm/c_5.webp))

意見は分かれていた。中には...冷たい人もいた

![post](../../../blog/2019_08_31_crm/c_6.webp)

また、Twitterはすでに個人的なCRMであると主張する人もいます

![post](../../../blog/2019_08_31_crm/c_7.webp)

[And some people pointed out how this recurring idea continues to attract new startups](https://twitter.com/devahaz/status/1164224618602758144 'twitter')

軽くあしらうのは簡単です。なぜ人々は、あなたのすべての人間関係を追跡し、すべてのやり取りを保存し、誕生日の祝福が無理やりで本物らしく感じられないようにする恐ろしいソフトウェアを求めるのでしょうか?

あ、待って。

![post](../../../blog/2019_08_31_crm/c_8.webp)

あなたがそう思うかどうかに関わらず [Facebook has Zucked the world](https://www.theguardian.com/books/2019/feb/07/zucked-waking-up-to-facebook-catastrophe 'FB')その成功は、人々が個人的な人間関係を管理する方法を望んでいることを示しています。個人CRMは愚かなアイデアではなく、完全に否定するつもりはありません。難しさは既存のシステムでどのように革新するか、そして人々にそれにお金を払ってもらうことにあります。

人と連絡を取り合うのが簡単で、私たちは自分たちのことを感じさせてくれました _そうあるべきだ_ 連絡を取り合いましょう。以前は「ああ、私の手紙が届かなかったの?」と言って連絡を取れなかったことを言い訳できていました。変な感じですね、郵便システムが原因でしょうね。今ではその贅沢はなく、友人の50回目の木曜日インスタ投稿に関心があるように見えることに苦労しています。私たちは圧倒されています。

個人CRMを求める人は、会った人を覚えていて、共有した背景の背景を知り、重要な日付を促し、時々誰かに連絡を促しつつ、高いプライバシーとセキュリティを保つものを求めています。この考えに多くの人が憤慨する理由も理解できます。なぜなら、個人の社会的努力をコンピューターにアウトソースすることになるからです。「彼女はとても優しい、誕生日を覚えてくれた!」という方が、「彼の個人CRMがブロックバスターのギフトカードを送ってくれた」よりはマシに聞こえます。簡単にすると、本物らしさを欠いてしまいます。もしコンピューターがすべての社会的やり取りを行っていると、人間とはどういう意味でしょうか?

しかし、友人の重要な情報を保存するシステムは新しいアイデアではありません。私たちの多くは、連絡先の電話帳やアドレス帳を持って育ったことでしょう。 [David Rockefeller kept index cards of all the important people he met.](https://www.forbes.com/sites/carminegallo/2017/12/07/david-rockefellers-rolodex-offers-a-master-class-in-making-friends-and-influencing-people/#5b1525625cc4 'David') 今これをクラウドに移行するからといって、真の友情が終わるわけではありません。ほとんどのツールと同様に、新しいシステムを良くも悪くも使うのは私たち次第です。

人々はこれにお金を払うのでしょうか?LinkedIn Premiumにはお金を払う人がいるので、前例もあります。ここでの難しい点は、基本的にこのCRMはデータが多いほど有用になるということです。つまり、利用者が多ければ多いほど体験が良くなるということです。これ [network effect](https://www.nfx.com/post/network-effects-manual 'network') ユーザーに課金すると成長に悪影響が出ることを示唆しています。なぜなら、参入障壁を最小限にしたいからです。また、多くのソーシャルネットワークがサブスクリプションよりも広告で収益を得ている理由でもあります。

私はもともとべったりしていて、人と連絡を取り合いたいのが好きです [^6].個人用のCRMがあれば助かりますが、私はお金を払いたくありませんし、大多数の人もそうだと思います。彼らはニッチな分野を占めているように見えますが、潜在能力はあるものの効率的に収益化できないようです。個人CRMは今後も存在し、再発明されると思いますが、個人への販売に注力している限り、どれも大きな規模を達成できるとは60%は思えません [^7].

### どこにでもウォベゴン湖があります

ほとんどの人は自分のビジネスアイデアや注目株、史上最高のタイムトラベル番組など、自分が正しいと証明しようとします [^8].私はむしろ逆のことを勧めます。もし強い意見があるなら、むしろ自分の間違いを証明しようとすべきです [^9].自分の信念を厳格に貫き、それを検証せずに過ごすことが、簡単な道です [confirmation bias.](https://www.psychologytoday.com/us/blog/science-choice/201504/what-is-confirmation-bias 'confirm')

私たちは自分自身をうまくやっていると思いたがります。好き嫌いや偏見など。結局のところ、自分自身を表現するのにふさわしいのは自分自身でしょう?このように [Atlantic article](https://getpocket.com/explore/item/people-don-t-actually-know-themselves-very-well 'Atlantic') しかし、私たちはそこまで自己認識がないと指摘しています。私たちがどうすべきかを予測するのと、実際にどう振る舞うかには食い違いがあり、他の人の方が私たちの実際の行動をうまく説明できるかもしれません。記事は引用しています [a meta-analysis](https://psycnet.apa.org/record/2010-25587-001 'meta'):

> 私たちの結果は、観察者評価に基づくFFM特性の運用妥当性が自己報告評価に基づくものよりも高いことを示しています。

上記のFFMは [Five Factor Model of personality](https://www.psychologistworld.com/personality/five-factor-model-big-five-personality 'FFM')、これは [usually better regarded than the popular MBTI test.](/writing/moloch 'MBTI') メタアナリシスは、他者が私たちの性格を私たち自身よりも正確に評価していると主張しています。私は全文にアクセスできませんが、似たようなものがあります [older study](https://home.ubalt.edu/NTYGMITC/641/barrick%20mount%20strauss%20big%20five%20obs%20ratings%20JAP%2094.pdf 'old test') 他人の評価の方が妥当性が高いという似た主張をしています。

アトランティック紙の記事は続きます。

> 研究では、スピーチをする際にどれだけ不安そうに見えるか、聞こえるかを予測する点では友人よりも優れていましたが、グループディスカッションでどれだけ自己主張するかを予測する点では、友人(あるいは8分前に会ったばかりの見知らぬ人)と比べて特に良い結果はありませんでした。また、IQテストや創造性テストで自分のパフォーマンスを予測しようとしたとき、友人よりも正確ではありませんでした。

人間は一般的に、自分の能力を過大評価し、他のケースではパフォーマンスを過小評価し、インセンティブの付与方法によっては過小評価します。覚えているかもしれませんが、 [Lake Wobegon effect](https://en.wikipedia.org/wiki/Lake_Wobegon#The_Lake_Wobegon_effect 'Lake') それは誰もが自分が平均以上だと思っていることを表しています。この記事は、より自己認識を高めるためのいくつかの方法を提案しています。

> 一つ目:本当に人にあなたを知ってもらいたいなら、週ごとのミーティングだけでは足りません。高強度な状況では、彼らと深く掘り下げる必要があります。

> 二つ目:\[...\] マネージャーが自分の良い面と悪い点を理解できるように、自分でマニュアルを書く人が増えているのを見てきました。しかし、あなたをよく知る人にユーザーマニュアルを書いてもらう方がさらに良いです。

> 三つ目:複数のフィードバックを無視できない状況に自分を置くこと。

その中で、3つ目は、あなたと情報源の両方がフィードバックのやり方と受け取り方を知っていれば、最も簡単な方法のように思えます [^10].まず一つ目はあなたの本当の内情を明かすかもしれませんが、多くのチームがより一般的なウィルダネスグランピング会社のリトリートと比べて、真の極端な状況に自分を置くとは思えません [^11].2号にユーザーマニュアルがあるというアイデアは好きですし、自分専用のものがあればいいのにと思いますが、時間をかけて書いてもらうのはなかなか説得が難しいです。もし読んでいる方がボランティアをしたいなら...

自分自身をよく知らないと知ることが第一歩です。残念ながら、行動バイアスを自覚しているからといって、簡単に、あるいは全く直せないとは限りません。 [Kahneman](https://en.wikipedia.org/wiki/Daniel_Kahneman 'Kahneman') 人生をかけて偏見を研究し、今でもその大半に陥っていると言っています。上記の三つのポイントに加えて、試してみて [Steelmanning](https://rationalwiki.org/wiki/Straw_man#Steelmanning 'Steelmanning') 自分が同意できない話題をストローマン化するのではなく、 [seeking out the weak points in your beliefs rather than continuing to emphasise the strong ones](https://medium.com/the-polymath-project/the-ideological-turing-test-how-to-be-less-wrong-6803a8c290cf 'less wrong').自分が間違っていることを証明すれば、より多く正しいかもしれません。

## その他

1. 他の人たちが議論している [why](https://www.perell.com/blog/why-you-should-write 'why') および [how](https://jasonzweig.com/a-few-thoughts-on-journalism/ 'how') もっと書くことを考えたほうがいいですよ [^12]

   > 書くことは脳にとってのウェイトリフティングのようなものです。自分のアイデアの限界を試すことが、それを最も早く改善し、知能を高める方法です

   > ジャーナリズムで成功するには、これら6つの資質すべてが必要だと思います。好奇心、懐疑心、粘り強さ、細部への注意力、責任感、厚い皮膚

2. [Violent protests increased support for liberal policy due to greater mobilisation of voters](https://scholar.harvard.edu/files/renos/files/enoskaufmansands.pdf 'violent').最近の抗議活動を踏まえ、それらが効果的かどうかを考えてみる価値があります。
3. ["Nobody ever says at a funeral, “He was too generous, too kind, and much too loving."](https://www.fastcompany.com/90348896/why-not-being-a-jerk-is-important-to-your-happiness-and-success 'jerks')
4. [SMCP came out with an overview of China Internet](https://www.scmp.com/china-internet-report 'smcp')、そして彼らのトップトレンドは以下の通りです:

   > 中国の「模倣」テック産業が今や模倣されています

   > 中国は5Gで急速に前進しています

   > 中国は大規模にAIを活用しています

   > 社会信用が中国で現実のものになりつつあります

   私は前者に同意します(しばらく前からそうですが)、しかし他の三つの傾向は誇張されているかもしれません。 [I've written about social credit misunderstandings before](/writing/moloch 'social')

5. [Wait but why writes about why we do what we do](https://waitbutwhy.com/2019/08/fire-light.html 'wait but why').この話題が好きなら、 [Behave](https://www.goodreads.com/book/show/31170723-behave 'Behave') より包括的な見解です。

**脚注**

[^1]: バーンズ [WeWork analysis](https://medium.com/@byrnehobart/what-is-we-understanding-the-wework-ipo-b74f0f1f1b46 'WeWork') 最近、 [Matt Levine's Money Stuff](https://www.bloomberg.com/opinion/articles/2019-08-19/we-looks-out-for-our-selves 'Money Stuff') また、素晴らしいことだ、バーン!

[^2]: 非ファイナンスの方へ、 [shorting](https://www.investopedia.com/terms/s/shortselling.asp 'short') 株価が下落すると賭けて今すぐ買う場合、例えばFBの株を1株180ドルで借りて180ドルで売り、その後100ドルまで上がることを期待して100ドルで買い戻す方法です。あなたはFB株を返品し、80ドルを稼ぎました。しかし、FBが280ドルまで上がった場合、借りた株を返すには280ドルで買わなければならず、100ドルの損失を意味します。株価は理論上無限大に上がることもありますが、最低でもゼロになることもあるため、ショートで無制限に損失を被す可能性がありますが、潜在的な利益は限定的です。

[^3]: この記事は [The Profile](https://theprofile.substack.com/p/the-profile-the-government-informant 'Profile')ポリーナ・マリノヴァによる週刊ニュースレターで、多くの興味深い人々の物語を紹介しています。ぜひチェックしてみてください!

[^4]: 誰かが私の計算を確認してほしいです

[^5]: 私はサーフィンをしたことがなく、これはひどい例えかもしれません

[^6]: 残念ながら、逆は完全には正しくない...

[^7]: Twitterは現在300億ドルの企業なので、「実質的な規模」として100億ドルを考えましょう

[^8]: 念のために言っておくと、 [Doctor Who](https://en.wikipedia.org/wiki/Doctor_Who 'Dr Who')特に素晴らしいエピソードが印象的です [Blink](<https://en.wikipedia.org/wiki/Blink_(Doctor_Who)> 'Blink'), [Vincent and the Doctor](https://en.wikipedia.org/wiki/Vincent_and_the_Doctor 'Vincent')、および [Heaven Sent](<https://en.wikipedia.org/wiki/Heaven_Sent_(Doctor_Who)> 'Heaven').

[^9]: 冗談ではなく、実はニュースレターの名前を『Prove Me Wrong』にしようかと考えました。

[^10]: それ自体が難しいスキルですが、また別の機会に話します。以前学んだ良いアドバイスは、たとえフィードバックが誤りだと思っていても、それは同僚が実際にあなたをどう見ているかを表しているので、あなたが彼らがあなたの中を見ていると思うものではないということです。そして最終的に重要なのは、彼らがあなたをどう見ているかということです。

[^11]: 荒野グランピングを否定しているわけではなく、最初のシナリオを引き起こすほど極端ではないということです。

[^12]: デイビッドもジェイソンもオンライン作家なので自然なバイアスはありますが、それが彼らの主張を損なうわけではありません。
