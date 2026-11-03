# 3本の解説動画の字幕（日本語・英語）。中身は content/articles の記事から。
# 1ショット＝ label（上の小見出し）・ja（行のリスト）・en（行のリスト）
FILMS = {
  "a-pine": {
    "title_ja": "黒松：芽切りで、枝はふえる", "title_en": "Black pine: how one cut makes more branches", "word": "Pine", "slug": "black-pine",
    "shots": [
      {"label": "ENGAWA FILMS · 01", "big": True},
      {"label": "01 · THE TREE", "ja": ["黒松は、日本と韓国の海べに育つ松。", "丈夫で、盆栽の代表の木です。"], "en": ["Pinus thunbergii grows on the coasts of Japan", "and Korea — tough, and a classic of bonsai."]},
      {"label": "02 · SUN", "ja": ["いちばんの栄養は、日の光。", "一年じゅう外で、よく日に当てます。"], "en": ["Sun comes first.", "Keep it outdoors, in full sun, all year."]},
      {"label": "03 · NEEDLES", "ja": ["日が足りないと、葉が長くのびて", "木の姿がゆるみます。"], "en": ["Without enough light, needles stretch", "and the tree loses its shape."]},
      {"label": "04 · MEKIRI", "ja": ["初夏から盛夏に、今年のびた新芽を", "元近くで切る。これが「芽切り」です。"], "en": ["Mekiri: in early to mid summer,", "cut this year's candles near the base."], "note": "時期は関東平野部の目安 · timing shifts with your climate"},
      {"label": "05 · SECOND FLUSH", "ja": ["木は、短く細かい二番芽を出します。", "葉は短く、枝の数がふえていきます。"], "en": ["The tree answers with a second, finer flush —", "shorter needles, more branches."]},
      {"label": "06 · STRONG TREES ONLY", "ja": ["芽切りは、元気な木だけ。", "弱った木には負担が大きすぎます。"], "en": ["Only on healthy trees.", "A weak tree can't afford the stress."]},
      {"label": "07 · WATER", "ja": ["水は、土の乾きを見てから。", "松は、やや乾かし気味を好みます。"], "en": ["Water by how dry the soil is.", "Pines prefer the drier side."]},
      {"label": "08 · REPOTTING", "ja": ["植え替えは春、芽が動きだすころ。", "針金かけは、秋から早春が目安です。"], "en": ["Repot in spring as the buds begin to move.", "Wire from early autumn to early spring."]},
      {"label": "THE MASTERS' VOICES · 職人の声", "dark": True, "ja": ["記事のその先は、職人の声に。", "Engawa には、職人の答えが積み上がります。"], "en": ["Beyond the article: real answers", "from Japan's masters, gathering on Engawa."]},
      {"label": "SUMMARY · まとめ", "ja": ["日なたで、一年じゅう外に。", "芽切りは元気な木だけ。", "水はやや乾かし気味、植え替えは春。"], "en": ["Full sun, outdoors. Mekiri on strong trees only.", "Dry side; repot in spring."]},
      {"label": "", "end": True},
    ]},
  "b-maple": {
    "title_ja": "もみじ：一本の木の四季", "title_en": "Japanese maple: one tree, four seasons", "word": "Maple", "slug": "japanese-maple",
    "shots": [
      {"label": "ENGAWA FILMS · 02", "big": True},
      {"label": "01 · ZOKI", "ja": ["もみじは雑木（ぞうき）＝葉を落とす木。", "季節ごとに、まったく違う顔を見せます。"], "en": ["A deciduous tree — zoki —", "whose face changes with every season."]},
      {"label": "02 · SPRING", "ja": ["春、芽が動きだしたら芽摘み。", "のびすぎる芽をおさえ、枝を細かくします。"], "en": ["Spring: pinch the new shoots as they open,", "to keep the twigs fine."]},
      {"label": "03 · SUMMER", "ja": ["夏の強い日差しは、葉焼けのもと。", "午後は日よけを使います。"], "en": ["Summer: strong afternoon sun scorches", "the leaves — give it shade."]},
      {"label": "04 · LEAF TRIMMING", "ja": ["葉刈りは、元気な木にだけ。", "弱った木にはしません。"], "en": ["Leaf trimming is only", "for vigorous trees."]},
      {"label": "05 · AUTUMN", "ja": ["秋、葉は赤く色づきます。", "一年でいちばん見られる季節です。"], "en": ["Autumn: the leaves turn red —", "the season everyone waits for."]},
      {"label": "06 · FEEDING", "ja": ["暑さがやわらいだら、肥料を再開。", "冬に向けて、木に力をためます。"], "en": ["As the heat eases, feeding resumes —", "the tree builds strength for winter."]},
      {"label": "07 · WINTER", "ja": ["冬、葉を落とすと", "枝の骨格があらわになります。"], "en": ["Winter: bare branches", "reveal the tree's structure."]},
      {"label": "08 · STRUCTURE", "ja": ["枝の形をととのえる剪定は、", "葉のない休眠期が見やすい時期です。"], "en": ["With the leaves gone, it's the easiest time", "to see — and refine — the branches."]},
      {"label": "THE MASTERS' VOICES · 職人の声", "dark": True, "ja": ["季節ごとの迷いは、職人の声に。", "Engawa で、日本の職人に聞けます。"], "en": ["For each season's questions,", "ask a master on Engawa."]},
      {"label": "SUMMARY · まとめ", "ja": ["春は芽摘み、夏は日よけ。", "秋は色づきと肥料、冬は枝を見る。"], "en": ["Pinch in spring, shade in summer,", "colour and feeding in autumn, structure in winter."]},
      {"label": "", "end": True},
    ]},
  "c-eight": {
    "title_ja": "盆栽の8つの木", "title_en": "Eight trees of bonsai", "word": "Eight", "slug": "",
    "shots": [
      {"label": "ENGAWA FILMS · 03", "big": True},
      {"label": "01 · 黒松 · JAPANESE BLACK PINE", "ja": ["丈夫で、日なたが好き。", "芽切りで、細かい枝をふやします。"], "en": ["Tough and sun-loving;", "mekiri builds fine branching."]},
      {"label": "02 · 五葉松 · JAPANESE WHITE PINE", "ja": ["芽がのびるのは、年に一度。", "芽の長さをそろえて育てます。"], "en": ["One flush a year —", "keep the new shoots even."]},
      {"label": "03 · 真柏 · SHIMPAKU", "ja": ["岩場に生きるヒノキ科の木。", "白い舎利（しゃり）と神（じん）が見どころ。"], "en": ["A cliff-dweller, prized for its white", "deadwood: shari and jin."]},
      {"label": "04 · もみじ · JAPANESE MAPLE", "ja": ["四季で姿を変える木。", "夏の葉焼けに気をつけて。"], "en": ["A tree of four seasons;", "guard it from summer scorch."]},
      {"label": "05 · サツキ · SATSUKI AZALEA", "ja": ["花が終わったら、すぐ剪定。", "夏には、翌年の花芽ができます。"], "en": ["Prune right after flowering —", "next year's buds form in summer."]},
      {"label": "06 · 梅 · UME", "ja": ["冬の終わりから早春、", "葉より先に花をひらきます。"], "en": ["From late winter to early spring,", "it blooms before its leaves."]},
      {"label": "07 · 欅 · ZELKOVA", "ja": ["ほうき立ちの木。", "冬の細かい枝ぶりが見どころです。"], "en": ["The broom style —", "prized for its fine winter twigs."]},
      {"label": "08 · 杜松 · NEEDLE JUNIPER", "ja": ["真柏とは別の木。とがった葉。", "日なたの屋外で育てます。"], "en": ["Not the same as shimpaku: sharp needles,", "grown outdoors in full sun."]},
      {"label": "", "end": True, "dark": True},
    ]},
}
