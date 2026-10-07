---
title: "Excel計算効率"
description: "Excelの速度に関する注意事項"
pubDate: 2016-03-17
category: System Design
tags: ['investment banking']
heroImage: '../../../blog/2016_03_17_excel/e_1.png'
locale: 'ja'
sourceSlug: 'excel'
sourceHash: '658f73ba1e40df367c86978fb2e3fde6def4efdf9bf18e1d34975fed5dc10592'
---

以前、Excelの効率性について徹底的に調べなければなりませんでした。銀行で使っていたファイルの中には計算に時間がかかるものもあり、改善点を探りたかったのです。多くのコンテンツがあり、私が見つけた中で最も役立つサイトは以下の通りです。ただし、すべての内容に必ずしも同意しているわけではありません。

1. マイクロソフト自身の ['improving performance' writeup](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)> 'office performance 2007')
   - 「Excel 2007の『Big Grid』では、パフォーマンスが本当に重要だ」
   - 「Excelは計算プロセス全体において3つの明確なフェーズに分かれています。
     - 初期の計算チェーンを構築し、どこから計算を始めるかを決めます。このフェーズはワークブックがメモリに読み込まれるときに起こります。
     - 依存関係を追跡し、セルを未計算としてフラグ付けし、計算チェーンを更新します。このフェーズは、手動計算モードでも、各セルエントリや変更時に実行されます。通常は非常に速く実行されるため、気づきません。
     - すべての式を計算してください。計算プロセスの一環として、Excelは計算チェーンを再配置・再構成し、将来の再計算を最適化します。」
   - 「揮発性関数は、たとえ前例が変わっていないように見えても、毎回の再計算で必ず再計算されます。多くの揮発性関数を使うと再計算の速度は遅くなりますが、完全な計算には影響しません。
     - Excelの組み込み関数の中には明らかに揮発性が高いものもあります:RAND(), NOW(), TODAY()。他にはあまり明らかに揮発性が低いものもあります:OFFSET(), CELL(), INDIRECT(), INFO()。
     - 以前に揮発性として記録されていた関数の中には、実際には揮発性ではないものもあります:INDEX(), ROWS(), COLUMNS(), AREAS()。」
     - 注:これは後のオフィス版で変更された可能性があります
   - リカルクを引き起こす不安定な行動のリストが与えられます
   - また、計算時間を測定するマクロも提供されています
   - 彼らは少しくれます [golden rules to follow,](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#first-golden-rule-remove-duplicated-repeated-and-unnecessary-calculations> 'golden rules') シンプルさを大まかに意図して
     - 重複、繰り返し、不要な計算を除去する
     - 可能な限り効率的な関数を使う
     - 賢い再計算を有効活用しましょう
     - 時間とテスト、各変化
   - 彼らは [how to simplify a problem](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#dynamic-count-unique> 'example problem')
   - そして、公式でよくあるボトルネックを長いリストで確認しましょう

2. [Another site](https://trumpexcel.com/suffering-from-slow-excel-spreadsheets/ 'trump excel') Excelのスピードヒントで
   - 「ヘルパーコラムの使用」
     - 強く同意しますし、多くの人にはあまり活用されていません
   - 「Excelの表と名前付き範囲の使用」
     - 名前付きの範囲については同意しますが、私はよく怠けがちです
   - 「より速い公式の使い方」
     - 繰り返し言われているアドバイスに注目してください

3. [Yet another site](http://www.databison.com/how-to-speed-up-calculation-and-improve-performance-of-excel-and-vba/ 'databison')
   - 「繰り返しの公式を分離し、単一セルに移す」
     - 上記のヘルパーカラムポイントに関連しています
   - 「発生頻度の順に条件を巣立てる」
     - 実はこれが本当かどうかはもう覚えていないので、参考程度に聞いてください

4. 最後に、速度を比較するサイト [vlookup vs index match](http://www.exceluser.com/blog/727/excels-fastest-lookup-methods-the-tested-results.html 'vlookup vs index match')
   - 効率的にはインデックスマッチが常に優れています
   - とはいえ、単純なプルの場合や、インデックスマッチで混乱する人がモデルを見ると思う時には、vlookupは今でも使っています。エンドユーザーを念頭に置いて設計してください。
