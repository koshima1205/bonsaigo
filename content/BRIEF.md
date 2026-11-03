# Engawa 知識記事の書き方（記事を書く担当向け）

Engawa は「世界一の盆栽メディア」。土台＝盆栽の知識を分かりやすく整理した記事。その上に日本の職人の声と QA が積み上がる。読者は海外の愛好家と日本の初心者。

## 1本の形（ファイル1つ＝1記事・1言語）
置き場：`~/dev/engawa/content/articles/{番号2桁}-{slug}.{ja|en}.md`
```
---
no: 9
slug: black-pine
group: species        # basics | species | seasons
title: 黒松 ― 芽切りと冬の寒さ
lead: 1〜2文の導入（何が分かるか）
tree: pine            # 3D の木の種類（pine / white-pine / juniper / maple / azalea / ume / zelkova / needle-juniper / none）
sources:
  - title: 出典の名前
    url: https://...
voice_hook: 職人に聞きたいこと（この記事に積み上がる「職人の声」の問い）1つ
---
## 見出し
本文…
```

## 中身の決まり
- 長さ：日本語 1,200〜1,800字。英語は同じ中身を自然な英語で（直訳しない）
- 構成：導入 → 3〜5つの見出し → 「まとめ（3行）」→ 「職人に聞いてみたいこと」1行
- **他サイトの文章を写さない**。出典の要点を読み、自分の言葉で書き直す。数字・年・学名は出典で確かめたものだけ。確かめられないことは書かない
- 出典は記事ごとに2件以上。下の目次の URL を必ず開いて読んでから書く（WebFetch）。足りなければ公的機関・植物園・美術館・定評ある専門サイトから足す
- 盆栽用語は初出で読みと意味を添える（例：芽切り（めきり）＝初夏に今年伸びた芽を元から切ること）。英語では日本語のローマ字＋意味（e.g. *mekiri* — cutting this year's candles in early summer）
- 地域差のある時期（月）は「日本の関東平野部の目安」と書き、海外は気候で前後すると添える
- 断定しすぎない。「〜が目安」「木の状態を見て」。病気・薬剤は一般的な説明までにし、薬剤名は書かない
- 職人の名前・園の名前は出さない（職人の声は別の仕組みで載る）
- 文体：日本語は です・ます。やさしく、短い文。英語は落ち着いた編集記事の調子

## 目次（番号・slug・tree・中身の要点・出典の候補）
### 基本
1 what-is-bonsai / none：鉢の中に自然の景色を写す・一代で終わらない・源流は中国の盆景 ／ https://www.maff.go.jp/j/pr/aff/1702/spe2_01.html ・ https://www.bonsaiempire.com/origin/what-is-bonsai
2 history / none：中国の盆景→日本／江戸の園芸文化／1989年 第1回世界盆栽大会（大宮） ／ https://www.maff.go.jp/j/pr/aff/1702/spe2_01.html ・ https://www.bonsaiempire.com/origin/bonsai-history
3 styles / pine：直幹・模様木・斜幹・懸崖・文人木／正面の決め方 ／ https://www.bonsaiempire.com/origin/bonsai-styles ・ maff spe2_01
4 how-to-look / pine：松柏と雑木（葉もの・花もの・実もの）／根張り・立ち上がり・幹模様・枝順／舎利と神 ／ maff spe2_01
5 water-and-place / none：乾いたらたっぷり／屋外・日当たり・風通し／猛暑と厳寒 ／ https://www.bonsaiempire.com/basics/bonsai-care/watering ・ https://www.bonsaiempire.com/basics/bonsai-care/position
6 soil-pots-feeding / none：赤玉土・鹿沼土・配合／鉢の選び方と鉢映り／置き肥の時期 ／ https://www.bonsaiempire.com/basics/bonsai-care/bonsai-soil ・ https://www.bonsaiempire.com/basics/bonsai-care/choosing-pots ・ https://www.bonsaiempire.com/basics/bonsai-care/fertilizing
7 prune-wire-repot / pine：芽摘み・剪定・針金掛け・植え替えの基本 ／ https://www.bonsaiempire.com/basics/styling/pruning ・ https://www.bonsaiempire.com/basics/styling/wiring ・ https://www.bonsaiempire.com/basics/bonsai-care/repotting
8 omiya / none：1923年の関東大震災後に職人が移り住んだ大宮盆栽村／村の取り決め／2010年 大宮盆栽美術館 ／ https://www.maff.go.jp/j/pr/aff/1702/spe2_02.html
### 樹種
9 black-pine / pine：日当たり／芽切りと二番芽／水は乾かし気味・植え替えは春 ／ https://www.bonsaiempire.com/tree-species/pines ・ https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?kempercode=b438
10 white-pine / white-pine：一度伸び／芽の長さをそろえる／水のやりすぎ注意 ／ bonsaiempire pines ・ https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=284968
11 shimpaku / juniper：岩場に自生するヒノキ科／舎利・神／葉のない枝からは芽が出ない ／ https://www.bonsaiempire.com/tree-species/juniper ・ maff spe2_01
12 japanese-maple / maple：夏の葉焼け／葉刈りは強い木だけ／芽摘みと紅葉 ／ https://www.bonsaiempire.com/tree-species/maple ・ https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=275408
13 satsuki / azalea：花後すぐ剪定（花芽は夏）／鹿沼土・水質／花の時期は雨と強い日差しを避ける ／ https://www.bonsaiempire.com/tree-species/azalea ・ https://www.chicagobotanic.org/plant-information/plant-finder/rhododendron-indicum-satsuki-azalea
14 ume / ume：晩冬〜早春に葉より先に咲く／花後に剪定／植え替えは早春 ／ https://www.bonsaiempire.com/tree-species/apricot ・ https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?kempercode=d115
15 zelkova / zelkova：冬姿の細かい枝／芽を伸ばして切る／ほうき立ち ／ https://www.bonsaiempire.com/tree-species/zelkova ・ https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?kempercode=a927
16 needle-juniper / needle-juniper：杜松（ネズ）は真柏と別種／屋外・日当たり／錆病の枝は処分 ／ https://www.bonsaiempire.com/tree-species/needle-juniper ・ https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=249854&isprofile=0&gen=Juniperus
### 季節と手入れ
17 spring / maple：芽出しと芽摘み／植え替えの適期／挿し木・取り木 ／ https://www.bonsaiempire.com/basics/general/calendar ・ https://www.bonsai.co.jp/recipe/
18 early-summer / pine：黒松の芽切り（6月〜7月半ば）／花後の剪定／雑木の葉が固まってから ／ calendar ・ bonsaiempire pines
19 midsummer / maple：猛暑の水やり／葉焼けと置き場所／針葉樹に強い作業をしない ／ calendar ・ bonsaiempire maple
20 autumn / maple：肥料の再開／根と枝を締める／紅葉と光 ／ calendar ・ bonsaiempire maple
21 winter / pine：休眠期の針金と構造の剪定／冬越し（寒さに当てて、凍らせない）／古葉取り ／ calendar ・ bonsaiempire juniper
22 calendar / none：月ごとの作業の一覧（関東平野部の目安）／地域差／職人 QA で補う ／ calendar ・ https://www.bonsai.co.jp/recipe/
23 pests / none：よく出る虫（アブラムシ・ハダニ・カイガラムシ）／松の病気は専門家へ／見分け方 ／ https://www.bonsaiempire.com/basics/bonsai-care/troubleshooting ・ https://www.rinya.maff.go.jp/j/kouhou/kouhousitu/jouhoushi/rinya_pdf/234-12.pdf
24 flowering-year / azalea：花後すぐ剪定→夏に花芽→翌春に開花／サツキと梅の1年 ／ bonsaiempire azalea ・ bonsaiempire apricot
