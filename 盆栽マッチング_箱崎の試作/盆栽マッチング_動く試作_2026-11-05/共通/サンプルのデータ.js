/* 盆栽アプリ モック サンプルのデータ（全画面で共通）2026-11-04
   名前はすべて架空。実在の職人・盆栽園・愛好家とは関係ない。
   画面をまたいで同じ人・同じ相談が出るように、ここにまとめる。 */
window.SAMPLE = {
  /* 架空の職人 */
  shokunin: [
    { id: "s1", name: "松風 清", en_title: "Pine specialist, 3rd generation",
      en_area: "Omiya area, Saitama", en_bio: "Has cared for black pines for over 40 years. Prefers to explain by drawing on your photo rather than with long sentences.",
      en_name: "Kiyoshi Matsukaze", en_garden: "Shofu-en",
      garden: "松風園", area: "埼玉・大宮のあたり", years: 42, specialty: ["黒松", "五葉松", "真柏"],
      title: "松の職人・三代目", bio: "黒松を40年以上育ててきた。長い文章より、写真に線を引いて伝えるのが得意。", answers: 128 },
    { id: "s2", name: "楓 ゆき", en_name: "Yuki Kaede", en_garden: "Kaede Bonsai",
      en_title: "Maples and flowering trees", en_area: "Kawaguchi, Saitama",
      en_bio: "Specializes in seasonal trees — maples, quince, azalea. Known for clear advice on watering and placement.",
      garden: "楓盆栽", area: "埼玉・川口", years: 18, specialty: ["もみじ", "ボケ", "皐月"],
      title: "もみじと花ものの職人", bio: "もみじ・ボケ・皐月など季節の木が専門。水やりと置き場所の助言に定評がある。", answers: 86 },
    { id: "s3", name: "岩井 正道", en_name: "Masamichi Iwai", en_garden: "Iwai Garden",
      en_title: "Rock plantings and junipers", en_area: "Tachikawa, Tokyo",
      en_bio: "Builds landscapes where the stone becomes a mountain cliff. Junipers and deadwood (jin and shari) are the specialty.",
      garden: "岩井園", area: "東京・立川のあたり", years: 31, specialty: ["石付き", "真柏", "ジン・シャリ"],
      title: "石付きと真柏の職人", bio: "石を山の崖に見立てる石付きが専門。真柏の枯れた部分（ジン・シャリ）の仕立ても得意。", answers: 64 }
  ],

  /* 架空の愛好家 */
  aikouka: [
    { id: "a1", name: "Emma", place: "Portland, USA", lang: "en", tree: "Small wired conifer" },
    { id: "a2", name: "Lucía", place: "Valencia, España", lang: "es", tree: "Juniper" },
    { id: "a3", name: "Wei", place: "成都, 中国", lang: "zh", tree: "Trident maple" }
  ],

  /* デモの中心になる相談（03 → 04 → 05 → 12 → 16 で同じものを使う） */
  soudan: {
    id: "q-0142",
    from: "a1",
    to: "s1",
    tree: { ja: "樹種は未確認（針金をかけた小さな針葉の木）", en: "Species not confirmed (a small wired conifer)" },
    sent: "2026-11-02 21:14（ポートランド時間）",
    question: {
      en: "I wired this tree a few months ago. Near the top, the wire now looks tight against the branch. When should I take it off, and how?",
      es: "Alambré este árbol hace unos meses. Arriba, el alambre ya se ve apretado contra la rama. ¿Cuándo lo quito y cómo?",
      zh: "几个月前我给这棵树缠了铁丝。现在上面的铁丝看起来紧贴着枝条。什么时候拆？怎么拆？"
    },
    /* AIが職人向けに直したもの（盆栽の言い方） */
    for_shokunin: {
      summary: "上のほうの針金が枝にきつく見える。いつ、どう外すか（針金外し）を知りたい。",
      points: [
        "針金をかけたのは数か月前",
        "上のほうの針金が、枝にきつく見える",
        "外したあと、枝が元に戻らないかも心配している"
      ],
      ai_mitate: "写真では、上の細い幹に黒い針金が何回か巻かれている。食い込んでいるかは、この大きさでは確かめられない。"
    },
    /* 職人の答え（話した言葉をそのまま文字にしたもの） */
    answer_ja_voice: "上のほうの針金、もう食い込みかけているね。今のうちに外そう。ほどくと樹皮を傷めるから、針金切りで1巻きずつ切って外して。少しの跡なら、幹が太るうちに目立たなくなる。枝が戻るようなら、春にもう一度針金掛けをすればいい。",
    /* 意訳（直訳しない）。用語は data-term で用語集につなぐ */
    answer: {
      en: [
        "The wire near the top is starting to bite into the branch. Take it off now, before it leaves a scar (<b data-term=\"針金外し\" class=\"term\">wire removal</b>).",
        "Don't unwind it. Unwinding twists the branch and can tear the bark. Use wire cutters and snip it off one turn at a time.",
        "A faint mark usually fades as the trunk thickens over the years.",
        "If the branch springs back, you can <b data-term=\"針金掛け\" class=\"term\">wire</b> it again in spring."
      ],
      es: [
        "El alambre de arriba empieza a clavarse en la rama. Quítalo ahora, antes de que deje marca (<b data-term=\"針金外し\" class=\"term\">quitar el alambre</b>).",
        "No lo desenrolles: córtalo vuelta a vuelta con un cortaalambres.",
        "Si la rama vuelve a su sitio, alámbrala otra vez en primavera."
      ],
      zh: [
        "上面的铁丝开始勒进枝条了。趁还没留下痕迹，现在就拆（<b data-term=\"針金外し\" class=\"term\">拆除铁丝</b>）。",
        "不要绕着解开，用钳子一圈一圈剪断。",
        "如果枝条弹回原位，春天再缠一次就好。"
      ]
    },
    /* 職人が写真に書いた印（図は 320×240。写真は縦長なので、真ん中の幅180に収まる） */
    marks: [
      { x: 163, y: 86, r: 20, label: { ja: "ここの針金が食い込みかけている", en: "This wire is starting to bite in", es: "Aquí el alambre empieza a clavarse", zh: "这里的铁丝开始勒进去了" } },
      { x: 150, y: 126, r: 15, label: { ja: "ここも1巻きずつ切って外す", en: "Cut this one off too, turn by turn", es: "Corta también este, vuelta a vuelta", zh: "这里也一圈一圈剪掉" } }
    ]
  },

  /* 投稿の下書き（12で使う） */
  sns: {
    x: "The wire looks tight? Take it off now, before it scars. Cut it off one turn at a time. Never unwind it. (Advice from a Japanese bonsai craftsperson, sample) #bonsai #bonsaiwiring",
    facebook: "A bonsai lover in Portland asked when to take the wire off a tree wired a few months ago. The craftsperson's answer: now, before it scars. Don't unwind it; cut it off one turn at a time. In bonsai, wire is a temporary guide, and knowing when to remove it matters as much as putting it on.",
    instagram: "The wire looks tight. Now what?\nA craftsperson in Japan marked the photo: the wire near the top is starting to bite in.\nCut it off one turn at a time. Don't unwind it.\n#bonsai #japanesebonsai #bonsaiwiring #bonsaicare"
  }
};
