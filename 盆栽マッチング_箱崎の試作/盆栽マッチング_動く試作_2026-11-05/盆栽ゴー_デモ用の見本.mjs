// 盆栽ゴー：デモ動画を撮るための見本（2026-11-08 箱崎さんの修正の控え No.1・No.2）
// 1. 見本のユーザー：相談する人（Emma）と職人（大宮の園の青木 義郎さん＝見本の p1）。
//    メールアドレスとパスワードはコードに書かず、.env から読む。4つとも入っているときだけ動く。
//      BONSAIGO_DEMO_ASKER_EMAIL / BONSAIGO_DEMO_ASKER_PASSWORD   … 相談する人
//      BONSAIGO_DEMO_CRAFT_EMAIL / BONSAIGO_DEMO_CRAFT_PASSWORD   … 職人
//    ログイン画面には、メールアドレスだけが最初から入った状態で出る（GET /api/demo-accounts）。パスワードは画面に送らず、手で打つ。
// 2. 見本の相談：Emma が送った相談3件（うち1件は答えつき）と、ほかの国から届いた相談4件。
//    サーバーを起動するたびに入れ直す（撮り直しのたびに同じ状態から始められる）。番号が決まっているので、ほかの相談は消さない。
// 3. 見本の木：管理する人の画面に出る10本（写真・Xとインスタの投稿文つき）。起動のたびに入れ直す。
// 出てくる相談する人（Emma・李 偉・Camille・Lucía・Somchai）は全員架空です。写真はAIで作った絵です。
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";

export const DEMO_ASKER_ID = "u-a-demo-emma";
const DEMO_GARDEN = "g1";      // 大宮の園（見本）
const DEMO_CRAFT = "p1";       // 園主 青木 義郎（見本）
const ID = (n) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;

export function setupDemo({ store, people, here, personCard }) {
  const env = process.env;
  const accounts = { asker: null, craft: null };
  const hash = (pw) => { const salt = randomBytes(16).toString("hex"); return { salt, hash: scryptSync(pw, salt, 32).toString("hex") }; };

  // ── 1. 見本のユーザー ──
  const aMail = String(env.BONSAIGO_DEMO_ASKER_EMAIL || "").trim().toLowerCase(), aPass = String(env.BONSAIGO_DEMO_ASKER_PASSWORD || "");
  if (aMail && aPass) {
    if (!store.growers) store.growers = [];
    store.growers = store.growers.filter((g) => g.id !== DEMO_ASKER_ID && g.email !== aMail);
    store.growers.push({ id: DEMO_ASKER_ID, email: aMail, pass: hash(aPass), name: "Emma", lang: "en", at: new Date().toISOString(), demo: true });
    accounts.asker = { email: aMail, password: aPass };
  }
  const cMail = String(env.BONSAIGO_DEMO_CRAFT_EMAIL || "").trim().toLowerCase(), cPass = String(env.BONSAIGO_DEMO_CRAFT_PASSWORD || "");
  const craft = people.find((p) => p.id === DEMO_CRAFT);
  if (cMail && cPass && craft) {
    craft.email = cMail; craft.pass = hash(cPass);  // 起動中だけ持つ（world.json は書きかえない）
    accounts.craft = { email: cMail, password: cPass };
  }

  // ── 2. 見本の相談 ──
  const photoDir = path.join(here, "共通", "デモの相談の写真");
  const photo = (name) => { const f = path.join(photoDir, `${name}.jpg`); return existsSync(f) ? { media_type: "image/jpeg", data: readFileSync(f).toString("base64") } : null; };
  const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
  const base = (n, h, asker_id, asker_name, lang, question, img, fc) => ({
    id: ID(n), at: ago(h), asker_id, asker_name, lang, question, image: photo(img), tree_id: ID(n + 50), teacher_id: DEMO_CRAFT, garden_id: DEMO_GARDEN, garden_lang: "ja",
    is_sample: false, offer_id: "one_question", usd: 25, for_craftsperson: { photo_problem_ja: null, terms_ja: [], ...fc }, ai_draft: null, ai_draft_status: "none", answer: null, demo: true,
  });
  const demo = [
    // Emma（アメリカ・英語）：答えが届いている
    { ...base(1, 52, DEMO_ASKER_ID, "Emma", "en",
      "The inner needles on my black pine are turning yellow and falling. It's autumn here in Seattle. Is my tree dying?",
      "黒松の葉が黄色い",
      { title_ja: "黒松の内側の葉が、秋に黄色くなって落ちる", summary_ja: "アメリカのシアトルで黒松を育てている方です。秋になって内側の古い葉が黄色くなり、木が弱っていないか心配しています。", points_ja: ["木は黒松", "秋に、内側の葉が黄色くなって落ちる", "枯れかけていないか心配"], ai_mitate_ja: "写真からの見立て：内側の古い葉が黄色く、先の葉は緑に見えます（診断ではありません）。", terms_ja: [] }),
      answer: {
        at: ago(47), voice_ja: "秋に内側の古い葉が黄色くなって落ちるのは、松が古い葉を入れ替えているだけです。心配いりません。先の新しい葉が緑で元気なら大丈夫。黄色い葉は指でつまんで取ってあげると、風通しがよくなります。先の葉まで黄色くなってきたら、水と根を疑ってください。",
        marks: [], from_draft: false,
        headline: "Your pine is fine — it is just letting go of its old needles for autumn.",
        paragraphs: [
          "In autumn, a black pine drops the old needles on the inside. This is normal. If the new needles at the tips are green and firm, your tree is healthy.",
          "Pinch off the yellow needles with your fingers. More air and light will reach the inside of the tree.",
          "If the needles at the tips start to turn yellow too, check the watering and the roots.",
        ],
        back_translation_ja: "秋に、黒松は内側の古い葉を落とします。ふつうのことです。先の新しい葉が緑でしっかりしていれば、木は元気です。黄色い葉は指でつまんで取ってください。木の内側に風と光が入ります。先の葉まで黄色くなってきたら、水やりと根を確かめてください。",
        review: { ok: true, problems_ja: [], checked: true, confidence: 0.93, needs_person: false, sample: false },
        answer_lang: "ja", same_lang: false, untranslated: false, by: personCard(craft),
      } },
    // Emma：まだ答えを待っている
    base(2, 20, DEMO_ASKER_ID, "Emma", "en",
      "I wired this juniper a few months ago. Now the wire near the top is cutting into the branch. Should I take it off now, or wait until spring?",
      "真柏の針金",
      { title_ja: "真柏の針金が、てっぺん近くで枝に食い込んでいる", summary_ja: "数か月前に真柏に針金を掛けた方です。てっぺん近くの針金が枝に食い込み始めたので、今外すか春まで待つかを知りたいそうです。", points_ja: ["木は真柏", "数か月前に針金を掛けた", "てっぺん近くで針金が食い込んでいる", "今外すか、春まで待つか"], ai_mitate_ja: "写真からの見立て：上の方の枝に針金が掛かっています（診断ではありません）。", terms_ja: ["針金掛け", "針金外し"] }),
    base(3, 6, DEMO_ASKER_ID, "Emma", "en",
      "The leaf tips on my maple turned brown in the summer heat. Can I cut the brown parts off?",
      "もみじの葉先",
      { title_ja: "もみじの葉先が、夏の暑さで茶色くなった", summary_ja: "もみじを育てている方です。夏の暑さで葉先が茶色くなったので、茶色い所を切ってよいか知りたいそうです。", points_ja: ["木はもみじ", "夏に葉先が茶色くなった", "茶色い所を切ってよいか"], ai_mitate_ja: "写真からの見立て：葉の先がところどころ茶色く見えます（診断ではありません）。" }),
    // ほかの国から届いた相談（職人の受け取り箱に出る）
    base(4, 30, "u-a-demo-liwei", "李 偉", "zh",
      "我的五针松已经三年没有换盆了。今年秋天可以换盆吗？",
      "五葉松の植え替え",
      { title_ja: "五葉松を3年植え替えていない。今年の秋に植え替えてよいか", summary_ja: "中国で五葉松を育てている方です。3年植え替えていないので、今年の秋に植え替えてよいか知りたいそうです。", points_ja: ["木は五葉松", "3年植え替えていない", "秋に植え替えてよいか"], ai_mitate_ja: "写真からの見立て：鉢の中に根が詰まっているかは、写真からは見えません（診断ではありません）。", terms_ja: ["植え替え"] }),
    base(5, 14, "u-a-demo-camille", "Camille", "fr",
      "Quand faut-il pincer les nouvelles pousses de mon pin ? Je ne veux pas affaiblir l'arbre.",
      "松の芽摘み",
      { title_ja: "松の新しい芽は、いつ摘めばよいか", summary_ja: "フランスで松を育てている方です。木を弱らせずに新しい芽を摘む時期を知りたいそうです。", points_ja: ["木は松", "新しい芽を摘む時期", "木を弱らせたくない"], ai_mitate_ja: "写真からの見立て：まっすぐな幹の松で、枝先に新しい芽が見えます（診断ではありません）。", terms_ja: ["芽摘み"] }),
    base(6, 9, "u-a-demo-lucia", "Lucía", "es",
      "La punta de mi pino en cascada se está debilitando y las agujas se ven pálidas. ¿Qué puedo hacer?",
      "懸崖の松の先が弱る",
      { title_ja: "懸崖の松の、垂れた枝の先が弱っている", summary_ja: "スペインで懸崖の松を育てている方です。垂れた枝の先が弱り、葉の色が薄くなってきたので、どうすればよいか知りたいそうです。", points_ja: ["木は懸崖の松", "垂れた枝の先が弱っている", "葉の色が薄い"], ai_mitate_ja: "写真からの見立て：鉢から下へ伸びた枝の先は、葉が少なめに見えます（診断ではありません）。" }),
    base(7, 3, "u-a-demo-somchai", "Somchai", "th",
      "ที่บ้านอากาศร้อนมาก ต้นเมเปิลบนหินของผมใบแห้ง ควรรดน้ำวันละกี่ครั้งครับ",
      "石付きのもみじの水やり",
      { title_ja: "暑い国で、石付きのもみじの葉が乾く。水やりは1日何回か", summary_ja: "タイで石付きのもみじを育てている方です。とても暑く葉が乾いてしまうので、1日に何回水をやればよいか知りたいそうです。", points_ja: ["木は石付きのもみじ", "住んでいる所がとても暑い", "葉が乾く", "水やりは1日何回か"], ai_mitate_ja: "写真からの見立て：石の上に根を張ったもみじです。石の上は土が少なく、乾きやすい形です（診断ではありません）。" }),
  ];
  const ids = new Set(demo.map((c) => c.id));
  store.consultations = [...demo, ...(store.consultations || []).filter((c) => !ids.has(c.id))];

  // ── 3. 見本の木（管理する人の画面に出る10本）──（11/08 箱崎さん：管理画面からXとインスタに出す様子を撮るため）
  // 6本はまだ投稿していない・2本はXだけ投稿済み・2本は両方投稿済み。起動のたびにこの状態に戻る
  // 投稿文は日本語と英語。ほかの6つの言葉は英語の文を入れておく
  const treePhoto = (n) => { const f = path.join(here, "共通", "デモの木の写真", `木${String(n).padStart(2, "0")}.jpg`); return existsSync(f) ? { media_type: "image/jpeg", data: readFileSync(f).toString("base64") } : null; };
  // 11/08 箱崎さん：すべての見本の投稿に「架空のイメージ投稿です」の注釈をつける
  const NOTE_JA = "※BonsaiGOのイメージ投稿です。掲載している画像・園・職人・内容は、すべてAIで作った架空のものです。";
  const NOTE_EN = "*A BonsaiGO concept post. All images, gardens, craftspeople and details shown are fictional and AI-generated.";
  const L8 = (ja, en) => { ja = `${ja}\n\n${NOTE_JA}`; en = `${en}\n\n${NOTE_EN}`; return { ja, en, es: en, zh: en, fr: en, it: en, th: en, km: en }; };
  const T = [
    // [番号, 職人, 木の名前, 樹種, 樹齢, 職人のひとこと, X（日本語）, X（英語）, インスタ（日本語）, インスタ（英語）, 投稿済み（何時間前・x／ig）]
    [1, "p1", "空へ伸びる真柏", "真柏", 60, "幹のねじれは、六十年かけて木が自分で作ったもの。",
      "六十年かけて、幹は自分でねじれた。霧松園の真柏です。 #盆栽 #bonsai #BonsaiGO",
      "Sixty years, and the trunk twisted itself. A shimpaku juniper from Kirimatsu-en. #bonsai #BonsaiGO",
      "幹のねじれは、人が曲げたのではありません。六十年かけて、木が自分で作った形です。\n埼玉・大宮　霧松園の真柏。\n\n#盆栽 #真柏 #bonsai #juniper #BonsaiGO",
      "No one bent this trunk. Over sixty years, the tree made this shape by itself.\nShimpaku juniper — Kirimatsu-en, Omiya, Japan.\n\n#bonsai #juniper #shimpaku #BonsaiGO", [30, 30]],
    [2, "p3", "竹林の黒松", "黒松", 45, "冬の前に古い葉を抜いて、内側まで光を入れた。",
      "冬の前に古い葉を抜いた黒松。内側まで光が届きます。 #盆栽 #黒松 #BonsaiGO",
      "Old needles thinned before winter, so light reaches inside. Japanese black pine. #bonsai #blackpine #BonsaiGO",
      "冬の前に古い葉を抜くと、木の内側まで光が届き、来年の芽が育ちます。\n凪松園の黒松、樹齢四十五年。\n\n#盆栽 #黒松 #bonsai #blackpine #BonsaiGO",
      "Thinning the old needles before winter lets light reach the inside, so next year's buds can grow.\nJapanese black pine, 45 years — Nagimatsu-en.\n\n#bonsai #blackpine #BonsaiGO", [20, 18]],
    [3, "p5", "小さな黒松", "黒松", 15, "小さくても、松の形はちゃんと出る。",
      "手のひらに乗る大きさでも、松の形。朝霞園の小品盆栽です。 #盆栽 #BonsaiGO",
      "Small enough for your palm, still every inch a pine. A shohin bonsai from Asaka-en. #bonsai #shohin #BonsaiGO",
      "手のひらに乗るほど小さくても、幹の立ち上がりと枝の段は、大きな松と同じです。\n朝霞園の小品・黒松。\n\n#盆栽 #小品盆栽 #bonsai #shohin #BonsaiGO",
      "Small enough to hold, yet the base of the trunk and the layers of branches are those of a full-size pine.\nShohin black pine — Asaka-en.\n\n#bonsai #shohin #BonsaiGO", [8, null]],
    [4, "p7", "欅の森", "欅", 25, "十一本で、ひとつの森にした。",
      "十一本の欅で、ひとつの森。汐風園の寄せ植えです。 #盆栽 #寄せ植え #BonsaiGO",
      "Eleven zelkova trees, one small forest. A group planting from Shiokaze-en. #bonsai #forest #BonsaiGO",
      "高さの違う十一本を、ひとつの鉢に。近くの木は大きく、遠くの木は小さく植えて、奥行きを出しています。\n汐風園の欅の寄せ植え。\n\n#盆栽 #寄せ植え #欅 #bonsai #BonsaiGO",
      "Eleven trees of different heights in one pot. Taller trees in front, smaller ones behind, to give depth.\nZelkova forest planting — Shiokaze-en.\n\n#bonsai #forestplanting #zelkova #BonsaiGO", [5, null]],
    [5, "p9", "まっすぐな五葉松", "五葉松", 50, "まっすぐな幹は、ごまかしがきかない。",
      "まっすぐな幹は、ごまかしがききません。月影園の五葉松。 #盆栽 #五葉松 #BonsaiGO",
      "A straight trunk hides nothing. Japanese white pine from Tsukikage-en. #bonsai #whitepine #BonsaiGO",
      "まっすぐな幹（直幹）は、いちばん基本で、いちばんごまかしがきかない形です。\n月影園の五葉松、樹齢五十年。\n\n#盆栽 #五葉松 #直幹 #bonsai #BonsaiGO",
      "The formal upright style is the most basic shape — and the one where nothing can be hidden.\nJapanese white pine, 50 years — Tsukikage-en.\n\n#bonsai #whitepine #formalupright #BonsaiGO", null],
    [6, "p10", "模様木の黒松", "黒松", 35, "幹の曲がりで、風の強い場所に立つ松を表した。",
      "幹の曲がりは、風の強い場所に立つ松の姿。苔雫園の黒松です。 #盆栽 #BonsaiGO",
      "The curves of the trunk recall a pine standing in strong wind. Black pine from Kokeshizuku-en. #bonsai #BonsaiGO",
      "幹をゆるやかに曲げた形（模様木）。風の強い海辺に立つ松を思い浮かべて作りました。\n苔雫園の黒松。\n\n#盆栽 #模様木 #黒松 #bonsai #BonsaiGO",
      "An informal upright, with a gently curving trunk — inspired by pines standing on a windy coast.\nBlack pine — Kokeshizuku-en.\n\n#bonsai #informalupright #blackpine #BonsaiGO", null],
    [7, "p1", "崖から垂れる松", "黒松", 40, "崖に生えて、下へ伸びる松の姿。",
      "崖に根を張り、下へ伸びる松。霧松園の懸崖です。 #盆栽 #懸崖 #BonsaiGO",
      "A pine rooted on a cliff, growing downward. Cascade style from Kirimatsu-en. #bonsai #cascade #BonsaiGO",
      "崖に根を張り、下へ下へと伸びる松の姿を、鉢の上に写した形（懸崖）。\n霧松園の黒松。\n\n#盆栽 #懸崖 #bonsai #cascade #BonsaiGO",
      "The shape of a pine rooted on a cliff, growing down and down — brought into a pot. Cascade style.\nBlack pine — Kirimatsu-en.\n\n#bonsai #cascade #BonsaiGO", null],
    [8, "p3", "石を抱くかえで", "かえで", 30, "根が石を抱くまで、十年かかった。",
      "根が石を抱くまで、十年。凪松園の石付きです。 #盆栽 #石付き #BonsaiGO",
      "Ten years for the roots to embrace the stone. Root-over-rock from Nagimatsu-en. #bonsai #rootoverrock #BonsaiGO",
      "根が石をしっかり抱くまで、十年かかりました。石と木が、ひとつの景色になっています。\n凪松園のかえでの石付き。\n\n#盆栽 #石付き #bonsai #BonsaiGO",
      "It took ten years for the roots to grip the stone. Now stone and tree make one landscape.\nRoot-over-rock maple — Nagimatsu-en.\n\n#bonsai #rootoverrock #maple #BonsaiGO", null],
    [9, "p5", "秋のもみじ", "もみじ", 20, "紅葉は、夏の水やりで決まる。",
      "紅葉の色は、夏の水やりで決まります。朝霞園のもみじ。 #盆栽 #もみじ #BonsaiGO",
      "Autumn color is decided by summer watering. Japanese maple from Asaka-en. #bonsai #maple #BonsaiGO",
      "きれいに色づくかどうかは、夏の水やりで決まります。葉を焼かずに夏を越えた木だけが、この赤になります。\n朝霞園のもみじ。\n\n#盆栽 #もみじ #紅葉 #bonsai #BonsaiGO",
      "Whether the leaves color well is decided in summer. Only a tree that gets through summer without scorched leaves turns this red.\nJapanese maple — Asaka-en.\n\n#bonsai #japanesemaple #autumn #BonsaiGO", null],
    [10, "p12", "池のほとりのもみじ", "もみじ", 25, "スペインの秋にも、もみじは赤くなる。",
      "スペインの秋にも、もみじは赤く染まる。ひだまり園から。 #盆栽 #BonsaiGO",
      "Maples turn red in a Spanish autumn too. From Hidamari-en in Valencia. #bonsai #maple #BonsaiGO",
      "日本の職人に学んだ育て方で、スペインの秋にも、もみじは赤く染まります。\nバレンシア　ひだまり園のもみじ。\n\n#盆栽 #もみじ #bonsai #BonsaiGO",
      "Grown the way we learned from craftspeople in Japan, our maples turn red in the Spanish autumn too.\nJapanese maple — Hidamari-en, Valencia.\n\n#bonsai #japanesemaple #BonsaiGO", null],
  ];
  const trees = T.map(([n, who, name, species, age, note, xja, xen, igja, igen, posted], i) => ({
    id: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`, at: ago(2 + i * 5), teacher_id: who, name, species, age, note, sample: "own", image: treePhoto(n),
    status: "ready", image_check: { ok: true, is_bonsai: true, confidence: 0.95, sure: true, needs_person: false },
    final: { x: L8(xja, xen), instagram: L8(igja, igen) }, text_check: { ok: true, confidence: 0.93, problems_ja: [], problems_en: [] },
    posted: posted ? { x: posted[0] ? ago(posted[0]) : null, instagram: posted[1] ? ago(posted[1]) : null } : {}, demo: true,
  }));
  const tids = new Set(trees.map((t) => t.id));
  store.bonsaigo_trees = [...trees, ...(store.bonsaigo_trees || []).filter((t) => !tids.has(t.id))];
  return accounts;
}
