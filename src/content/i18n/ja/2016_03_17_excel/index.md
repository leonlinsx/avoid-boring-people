---
title: "Excel計算効率"
description: "Excelの速度に関する注意事項"
pubDate: 2016-03-17
category: System Design
tags: ['investment banking']
heroImage: './e_1.png'
locale: 'ja'
sourceSlug: 'excel'
sourceHash: '658f73ba1e40df367c86978fb2e3fde6def4efdf9bf18e1d34975fed5dc10592'
---

以前、Excelの効率性について徹底的に調べなければなりませんでした。銀行で使っていたファイルの中には計算に時間がかかるものもあり、改善点を探りたかったのです。多くのコンテンツがあり、私が見つけた中で最も役立つサイトは以下の通りです。ただし、すべての内容に必ずしも同意しているわけではありません。

1. Microsoft独自の[「パフォーマンス改善」に関する記述](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)>「Office Performance 2007」)
   - 「Excel 2007 『Big Grid』では、パフォーマンスが本当に重要だ」
   - 「Excelは全体の計算プロセスにおいて3つの明確なフェーズを持っています。
     - 初期計算チェーンを構築し、どこから計算を始めるかを決定する。このフェーズはワークブックがメモリに読み込まれるときに起こります。
     - 依存関係を追跡し、セルを未計算としてフラグ付けし、計算チェーンを更新します。このフェーズは手動計算モードでも各セルエントリや変更時に実行されます。通常は非常に速く実行されるため、気づきません。
     - すべての式を計算する。計算プロセスの一環として、Excelは計算チェーンを再配置し再構成し、将来の再計算を最適化する。」
   - 「揮発性関数は、前例が変わっていないように見えても、毎回の再計算で必ず再計算される。多くの揮発性関数を使うと再計算の速度は遅くなるが、完全な計算には影響しない。
     - Excelに組み込まれている関数の中には明らかに揮発性のあるものもあります:RAND(), NOW(), TODAY().他にはあまり顕著でない揮発性もあります:OFFSET(), CELL(), INDIRECT(), INFO().
     - 以前に揮発性として記録されていた関数の中には、実際には揮発性ではないものもあります:INDEX(), ROWS(), COLUMNS(), AREAS()。」
     - 注:これは後のオフィス版で変更されている可能性があります
   - リカルクを引き起こす不安定な行動のリストを提供します
   - 計算時間を測定するマクロも提供します
   - シンプルさを大まかに意図して、いくつかの[守るべき黄金律](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#first-golden-rule-remove-duplicated-repeated-and-unnecessary-calculations>「黄金律」)を与えます
     - 重複、繰り返し、不要な計算を除去する
     - 可能な限り効率的な関数を使用すること
     - スマート再計算を有効に活用する
     - 変更ごとに時間とテスト
   - 彼らは[問題の簡略化方法](<https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2007/aa730921(v=office.12)#dynamic-count-unique>「例問題」)の良い例を示しています
   - そして、公式のよくあるボトルネックの長いリストを順に挙げる

2. [別のサイト](https://trumpexcel.com/suffering-from-slow-excel-spreadsheets/「trump excel」)、Excelのスピードヒントを紹介しています
   - 「ヘルパーコラムの使用」
     - 強く同意し、多くの人にあまり活用されていないことが多い
   - 「Excelテーブルと名前付き範囲の使用」
     - 名前付きの範囲については同意しますが、私はよく怠けがちです
   - 「より速い式の使い方」
     - 繰り返されるアドバイスに注目してください

3. [また別のサイト](http://www.databison.com/how-to-speed-up-calculation-and-improve-performance-of-excel-and-vba/「databison」)
   - 「繰り返しの式を分離し、単一セルに移す」
     - 上記のヘルパー列ポイントに関連しています
   - 「発生頻度の順序で条件をネストする」
     - 実はもう本当かどうか覚えていないので、話半分に聞いてください

4. 最後に、[vlookup vs index match]の速度を比較するサイト(http://www.exceluser.com/blog/727/excels-fastest-lookup-methods-the-tested-results.html 'vlookup vs index match')
   - インデックスマッチは常に効率の面で優れています
   - とはいえ、単純なプルの場合や、インデックスマッチで混乱する人がモデルを見ると思う時は、今でもvlookupを使っています。エンドユーザーを念頭に置いて設計します。