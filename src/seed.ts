// 最初に開いたときに空っぽに見えないよう、見本を入れておく。見本はすべて seed: true で、画面に「見本」と出す。
// 職人さんと園の名前は架空。数字も見本。
export type ML = { ja: string; easy: string; en: string; es: string; zh: string };

export interface Section { heading: ML; body: ML; quote_ja?: string; master?: string }
export interface Article {
  slug: string;
  created: number;
  status: "draft" | "published";
  source?: string; // 元になった相談
  cover: string; // "illust:pine:3" または写真
  tree: ML;
  title: ML;
  lead: ML;
  sections: Section[];
  tags: string[];
  seed?: boolean;
  demo?: boolean;
}

export interface Scene { sec: number; visual: "title" | "tree" | "photo" | "quote" | "cta"; text_ja: string; text_en: string }
export interface Caption { text: string; hashtags: string[]; title?: string }
export interface Short {
  id: string;
  slug: string;
  created: number;
  status: "draft" | "approved";
  hook_ja: string;
  hook_en: string;
  scenes: Scene[];
  captions: { instagram: Caption; youtube: Caption; tiktok: Caption };
  seed?: boolean;
  demo?: boolean;
}

export interface Post { name: string; lang: string; body: string; created: number; master?: boolean; tr?: Record<string, string> }
export interface Thread { id: string; title: string; created: number; posts: Post[]; seed?: boolean }

export interface Wish {
  id: string;
  created: number;
  text: string;
  country: string;
  parsed: { species: string; size: string; style: string; budget: string; summary_ja: string; summary_en: string };
  raised: string[];
  seed?: boolean;
}

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 3);

export const SEED_ARTICLES: Article[] = [
  {
    slug: "history",
    created: T0 - 3 * DAY,
    status: "published",
    cover: "illust:literati:5",
    tags: ["history", "omiya"],
    seed: true,
    tree: { ja: "盆栽の歴史", easy: "ぼんさいの れきし", en: "History", es: "Historia", zh: "历史" },
    title: {
      ja: "鉢の中の自然 ― 盆栽の七百年",
      easy: "はちの なかの しぜん ― ぼんさいの れきし",
      en: "Nature in a Pot — Seven Centuries of Bonsai",
      es: "La naturaleza en una maceta: siete siglos de bonsái",
      zh: "盆中的自然 —— 盆栽七百年",
    },
    lead: {
      ja: "小さな鉢に、山の大木の姿を映す。中国の盆景に始まった楽しみは、日本で磨かれ、いま世界の言葉になった。",
      easy: "小さい はちに、山の 大きな 木の すがたを うつします。ぼんさいは 中国から 来て、日本で そだちました。いまは 世界の ことばです。",
      en: "A great mountain tree, reflected in a small pot. What began as Chinese penjing was refined in Japan — and is now a word the whole world knows.",
      es: "Un gran árbol de montaña reflejado en una pequeña maceta. Lo que empezó como el penjing chino se refinó en Japón y hoy es una palabra que conoce todo el mundo.",
      zh: "在小小的盆中映出山间大树的姿态。源于中国盆景的雅趣，在日本被精心打磨，如今已成为世界通用的词语。",
    },
    sections: [
      {
        heading: { ja: "絵巻に描かれた鉢の木", easy: "むかしの 絵に ある はちの 木", en: "Potted trees in a medieval scroll", es: "Árboles en maceta en un rollo medieval", zh: "绘卷中的盆中树" },
        body: {
          ja: "鎌倉時代の絵巻『春日権現験記絵』（1309年）には、鉢に植えた木が描かれています。七百年前の日本には、もう鉢の木を眺める楽しみがありました。",
          easy: "1309年に かかれた 絵に、はちに うえた 木が あります。700年 まえから、日本の 人は はちの 木を 見て たのしんで いました。",
          en: "The Kasuga Gongen Genki-e, a picture scroll from 1309, shows trees planted in pots. Seven hundred years ago, people in Japan were already enjoying the quiet pleasure of looking at a potted tree.",
          es: "El Kasuga Gongen Genki-e, un rollo pintado en 1309, muestra árboles plantados en macetas. Hace setecientos años, en Japón ya se disfrutaba del sereno placer de contemplar un árbol en maceta.",
          zh: "1309年的绘卷《春日权现验记绘》中，描绘着种在盆里的树。七百年前的日本，人们就已懂得欣赏盆中之树的乐趣。",
        },
      },
      {
        heading: { ja: "江戸の町へ", easy: "江戸の 町へ", en: "Into the streets of Edo", es: "Por las calles de Edo", zh: "走进江户的街巷" },
        body: {
          ja: "江戸時代になると、武士だけでなく町の人々も鉢植えを楽しむようになりました。限られた庭や縁側で、季節の移ろいを手元に置く文化が育ちました。",
          easy: "江戸時代に なると、さむらいも 町の 人も はちうえを たのしみました。小さい 庭や えんがわで、きせつを かんじました。",
          en: "In the Edo period, not only samurai but townspeople too took up potted plants. On small verandas and in narrow gardens, a culture grew of keeping the turning seasons close at hand.",
          es: "En el periodo Edo, no solo los samuráis sino también la gente de la ciudad empezó a cultivar plantas en maceta. En pequeñas galerías y jardines estrechos creció la costumbre de tener cerca el paso de las estaciones.",
          zh: "到了江户时代，不只是武士，城中百姓也开始喜爱盆栽。在小小的檐廊与窄庭里，人们把四季的流转放在手边，形成了独特的文化。",
        },
      },
      {
        heading: { ja: "大宮盆栽村", easy: "大宮の ぼんさい村", en: "The Omiya Bonsai Village", es: "La aldea del bonsái de Omiya", zh: "大宫盆栽村" },
        body: {
          ja: "1923年の関東大震災のあと、東京の盆栽業者たちは良い土と水を求めて大宮（いまのさいたま市）へ移り、1925年ごろに盆栽村が生まれました。最盛期には約30の園が並び、いまも6つの園が続いています。",
          easy: "1923年の 大きな 地しんの あと、東京の ぼんさいの 店が 大宮に うつりました。むかしは 30ぐらいの 園が ありました。いまは 6つです。",
          en: "After the Great Kanto Earthquake of 1923, Tokyo's bonsai growers moved to Omiya (today's Saitama City) in search of good soil and water, and around 1925 the Bonsai Village was born. At its peak about 30 gardens lined its lanes; six remain today.",
          es: "Tras el gran terremoto de Kanto de 1923, los viveristas de bonsái de Tokio se trasladaron a Omiya (hoy Saitama) en busca de buena tierra y agua, y hacia 1925 nació la Aldea del Bonsái. En su mejor época había unos 30 jardines; hoy quedan seis.",
          zh: "1923年关东大地震后，东京的盆栽园主们为寻找好土好水迁往大宫（今埼玉市），约1925年形成了盆栽村。鼎盛时期约有30家盆栽园，如今仍有6家延续至今。",
        },
      },
      {
        heading: { ja: "「BONSAI」が世界の言葉に", easy: "「BONSAI」は 世界の ことば", en: "“Bonsai” becomes a world word", es: "«Bonsái», una palabra universal", zh: "“BONSAI”成为世界语言" },
        body: {
          ja: "1989年、大宮で第1回の世界盆栽大会が開かれました。いま「BONSAI」は世界中で通じます。けれど、職人の言葉そのものは、日本語の壁で海の向こうに届きにくいまま。縁側は、その言葉をそのまま渡すための場所です。",
          easy: "1989年に 大宮で 世界の ぼんさいの 大会が ありました。いま「BONSAI」は 世界の ことばです。でも、しょくにんの ことばは 日本語なので、外国に とどきにくいです。えんがわは、その ことばを とどけます。",
          en: "In 1989 the first World Bonsai Convention was held in Omiya, and today “bonsai” is understood everywhere. Yet the masters' own words still struggle to cross the sea, held back by the language barrier. Engawa exists to carry those words across, unchanged.",
          es: "En 1989 se celebró en Omiya la primera Convención Mundial del Bonsái, y hoy «bonsái» se entiende en todas partes. Pero las palabras de los maestros aún cuesta que crucen el mar, frenadas por el idioma. Engawa existe para llevarlas al otro lado, tal como son.",
          zh: "1989年，首届世界盆栽大会在大宫举办。如今“BONSAI”举世皆知。然而，匠人们自己的话语，仍因语言的隔阂难以渡海。缘侧，就是为了把这些话原汁原味地送过去。",
        },
      },
    ],
  },
  {
    slug: "how-to-look",
    created: T0 - 2 * DAY,
    status: "published",
    cover: "illust:maple:3",
    tags: ["appreciation", "glossary"],
    seed: true,
    tree: { ja: "鑑賞", easy: "見かた", en: "Appreciation", es: "Apreciación", zh: "鉴赏" },
    title: {
      ja: "盆栽の見かた ― 四つの見どころ",
      easy: "ぼんさいの 見かた ― 4つの ポイント",
      en: "How to Look at a Bonsai — Four Things the Masters See",
      es: "Cómo mirar un bonsái: cuatro cosas que ven los maestros",
      zh: "如何欣赏盆栽 —— 匠人眼中的四个看点",
    },
    lead: {
      ja: "職人は木のどこを見ているのか。用語集の言葉を手がかりに、根元から鉢まで、順にたどります。",
      easy: "しょくにんは 木の どこを 見て いるのでしょう。下から 上へ じゅんばんに 見て いきます。",
      en: "Where does a master's eye go first? Using words from our glossary, we follow it from the roots up to the pot.",
      es: "¿Adónde mira primero un maestro? Con palabras de nuestro glosario, seguimos su mirada desde las raíces hasta la maceta.",
      zh: "匠人究竟在看树的哪里？借助词汇表中的词语，我们从根部一路看到花盆。",
    },
    sections: [
      {
        heading: { ja: "根張りと立ち上がり", easy: "ねばりと たちあがり", en: "Nebari and the rise of the trunk", es: "Nebari y la base del tronco", zh: "根盘与树干基部" },
        body: {
          ja: "土の上に四方へ広がる根を「根張り」、土から出たところの幹を「立ち上がり」と呼びます。大地をつかむ安定感と、木の古さが一番よく見える所です。",
          easy: "土の 上に 広がる 根を「ねばり」と いいます。木が しっかり 立って いるか、どれくらい 古いかが 分かります。",
          en: "The roots spreading out above the soil are called nebari; the trunk where it leaves the soil is the tachiagari. This is where a tree shows its grip on the earth — and its age.",
          es: "Las raíces que se extienden sobre el sustrato se llaman nebari; el tronco donde sale de la tierra es el tachiagari. Ahí el árbol muestra cómo se aferra a la tierra, y su edad.",
          zh: "露出土面、向四方展开的根叫“根盘”，树干出土的部分叫“立起”。这里最能看出树扎根大地的稳重，以及它的年岁。",
        },
      },
      {
        heading: { ja: "幹模様", easy: "みきの かたち", en: "The movement of the trunk", es: "El movimiento del tronco", zh: "干的走势" },
        body: {
          ja: "幹の曲がり方や流れを「幹模様」と言います。前後左右に曲がりながら立つ「模様木」、崖から垂れる「懸崖」、細く枝の少ない「文人木」。幹の流れが、その木の性格を決めます。",
          easy: "みきの まがりかたを「みきもよう」と いいます。まがりながら 立つ 木、下に たれる 木、ほそい 木。みきで 木の せいかくが 決まります。",
          en: "The way a trunk bends and flows is its mikimoyo. An informal upright twists as it rises; a cascade falls like a tree on a cliff; a literati stands slender with few branches. The trunk decides the tree's character.",
          es: "La forma en que el tronco se curva es su mikimoyo. El vertical informal se tuerce al subir; la cascada cae como un árbol en un acantilado; el literati se alza esbelto con pocas ramas. El tronco define el carácter del árbol.",
          zh: "树干的弯曲与流向叫“干模样”。边弯边立的“曲干式”，像崖边垂落的“悬崖式”，纤细少枝的“文人树”。干的走势决定了一棵树的性格。",
        },
      },
      {
        heading: { ja: "枝と不等辺三角形", easy: "えだと 三かくけい", en: "Branches and the uneven triangle", es: "Las ramas y el triángulo asimétrico", zh: "枝与不等边三角形" },
        body: {
          ja: "一番下の大事な枝を「一の枝」と呼びます。全体の輪郭は、辺の長さが違う三角形に。左右対称を避けることで、自然の中で育った木の動きが生まれます。",
          easy: "いちばん 下の 大切な えだを「いちのえだ」と いいます。木の 形は、左右が ちがう 三かくに します。そのほうが しぜんに 見えます。",
          en: "The lowest, most important branch is the ichi-no-eda. The outline of the whole tree forms a triangle with unequal sides — avoiding symmetry is what gives a bonsai the movement of a tree grown in the wild.",
          es: "La rama más baja e importante es la ichi-no-eda. La silueta del árbol forma un triángulo de lados desiguales: evitar la simetría es lo que le da el movimiento de un árbol crecido en la naturaleza.",
          zh: "最下面、最重要的枝叫“第一枝”。整棵树的轮廓是一个边长不等的三角形——避开左右对称，才有自然中生长的树的动感。",
        },
      },
      {
        heading: { ja: "正面と鉢映り", easy: "しょうめんと はち", en: "The front, and the pot", es: "El frente y la maceta", zh: "正面与盆" },
        body: {
          ja: "木を一番よく見せる向きが「正面」。根張り・幹模様・枝の見え方がすべてここで決まります。最後に、木と鉢の釣り合い「鉢映り」。同じ木でも、鉢の色と形で表情が変わります。",
          easy: "木が いちばん きれいに 見える むきを「しょうめん」と いいます。さいごに はちを 見ます。はちが かわると、木の 見えかたも かわります。",
          en: "The side that shows the tree at its best is its shomen, its front — roots, trunk and branches are all judged from here. Last comes hachi-utsuri, the harmony between tree and pot. The same tree changes its expression with the pot's colour and shape.",
          es: "El lado que muestra el árbol en su mejor versión es su shomen, el frente: raíces, tronco y ramas se juzgan desde ahí. Por último, el hachi-utsuri, la armonía entre árbol y maceta. El mismo árbol cambia de expresión según el color y la forma de la maceta.",
          zh: "最能展现树之美的方向叫“正面”，根盘、干模样、枝的看法都由此决定。最后是“盆映”，即树与盆的协调。同一棵树，换了盆的颜色和形状，神情也随之改变。",
        },
      },
    ],
  },
  {
    slug: "pine-brown-tips",
    created: T0 - 1 * DAY,
    status: "published",
    source: "sample",
    cover: "illust:pine:7",
    tags: ["black pine", "winter", "two masters"],
    seed: true,
    tree: { ja: "黒松", easy: "くろまつ", en: "Japanese black pine", es: "Pino negro japonés", zh: "黑松" },
    title: {
      ja: "黒松の葉先が茶色い ―「冬も外の寒さに当てて」",
      easy: "くろまつの はの 先が 茶色い ―「冬も 外に 出して」",
      en: "Brown Needle Tips on a Black Pine — “Let It Feel the Winter Cold”",
      es: "Puntas marrones en un pino negro: «Deja que sienta el frío del invierno»",
      zh: "黑松针叶尖发褐 ——“冬天也让它吹吹外面的冷风”",
    },
    lead: {
      ja: "リヨンの持ち主から届いた相談に、二人の職人が答えました。二人の言葉を、そのまま並べます。（見本の相談・職人は架空）",
      easy: "フランスの リヨンの 人から そうだんが 来ました。2人の しょくにんが こたえました。（見本です）",
      en: "An owner in Lyon asked; two masters in Japan answered. Here are their words, side by side, exactly as they said them. (Sample consultation — masters are fictional.)",
      es: "Una persona de Lyon preguntó y dos maestros de Japón respondieron. Aquí están sus palabras, una junto a otra, tal como las dijeron. (Consulta de ejemplo; los maestros son ficticios.)",
      zh: "来自里昂的主人提问，日本的两位匠人作答。这里原样并列他们的话。（示例咨询，匠人为虚构。）",
    },
    sections: [
      {
        heading: { ja: "相談", easy: "そうだん", en: "The question", es: "La pregunta", zh: "咨询" },
        body: {
          ja: "「葉先が茶色くなってきました。病気でしょうか。冬はどこに置けばいいですか」。10月から室内の窓ぎわに置いているそうです。",
          easy: "「はの 先が 茶色く なりました。びょうきですか。冬は どこに おけば いいですか」。10月から へやの 中に おいて います。",
          en: "“The needles are turning brown at the tips. Is it sick? Where should I keep it this winter?” The tree has been on an indoor windowsill since October.",
          es: "«Las puntas de las acículas se están poniendo marrones. ¿Está enfermo? ¿Dónde lo pongo este invierno?» El árbol está en el alféizar interior desde octubre.",
          zh: "“针叶尖开始发褐了，是生病了吗？冬天该放在哪里？”这棵树从10月起一直放在室内窗边。",
        },
      },
      {
        master: "職人A（見本）",
        quote_ja: "葉先が茶色いのは、室内に入れっぱなしで弱ってきてるんだと思います。松は寒さに当てて休ませる木なので、冬も外に出してください。ただ、鉢が凍るくらいの夜だけは、軒下になおしてください。",
        heading: { ja: "一人目の職人", easy: "1人目の しょくにん", en: "The first master", es: "El primer maestro", zh: "第一位匠人" },
        body: {
          ja: "室内に入れっぱなしで弱っている、という見立て。松は寒さで休む木だから、冬も外へ。凍るほどの夜だけ軒下へ。",
          easy: "へやの 中に ずっと おいたので 弱って いる、と いいます。松は 冬の さむさで 休みます。とても さむい 夜だけ、のきしたに うつします。",
          en: "“I think the tips are browning because it has been kept indoors all the time and is weakening. A pine rests by feeling the cold, so keep it outside in winter too. Only on nights cold enough to freeze the pot, move it under the eaves.”",
          es: "«Creo que las puntas se ponen marrones porque ha estado siempre dentro y se está debilitando. El pino descansa sintiendo el frío, así que déjalo fuera también en invierno. Solo las noches en que la maceta pueda helarse, ponlo bajo el alero.»",
          zh: "“我想叶尖发褐，是因为一直放在室内，树变弱了。松树要靠寒冷来休眠，所以冬天也请放在室外。只有冷到花盆会结冰的夜晚，才把它移到屋檐下。”",
        },
      },
      {
        master: "職人B（見本）",
        quote_ja: "水やりは、土の表面が乾いてから、鉢の底から出るまでたっぷりと。肥料は今は止めてください。植え替えは春、芽が動き出す前にしてください。",
        heading: { ja: "二人目の職人", easy: "2人目の しょくにん", en: "The second master", es: "El segundo maestro", zh: "第二位匠人" },
        body: {
          ja: "水やりの加減、今は肥料を止めること、植え替えの時期について。",
          easy: "水の やりかた、いまは ひりょうを やめる こと、うえかえの 時期に ついて 話しました。",
          en: "“Water when the surface of the soil is dry, generously, until it runs from the bottom of the pot. Stop fertilizing for now. Repot in spring, before the buds begin to move.”",
          es: "«Riega cuando la superficie del sustrato esté seca, con generosidad, hasta que salga por el fondo de la maceta. Deja el abono por ahora. Trasplanta en primavera, antes de que se muevan las yemas.»",
          zh: "“等土表面干了再浇水，要浇透，直到水从盆底流出。现在先停止施肥。换盆请在春天、芽开始萌动之前进行。”",
        },
      },
      {
        heading: { ja: "二人の答えをならべると", easy: "2人の こたえを くらべると", en: "The two answers, side by side", es: "Las dos respuestas, lado a lado", zh: "并列两位匠人的回答" },
        body: {
          ja: "置き場所は一人目、水やり・肥料・植え替えは二人目が答えました。言っていることはぶつからず、補い合っています。",
          easy: "おく ばしょは 1人目、水・ひりょう・うえかえは 2人目が こたえました。2人の こたえは ちがいません。",
          en: "The first master spoke about where to keep the tree; the second about water, fertilizer and repotting. Their answers don't conflict — they complete each other.",
          es: "El primer maestro habló de dónde tener el árbol; el segundo, del riego, el abono y el trasplante. Sus respuestas no chocan: se completan.",
          zh: "第一位讲了摆放位置，第二位讲了浇水、施肥和换盆。两人的话并不冲突，而是相互补充。",
        },
      },
    ],
  },
];

export const SEED_SHORTS: Short[] = [
  {
    id: "s-pine",
    slug: "pine-brown-tips",
    created: T0 - 1 * DAY + 3600_000,
    status: "approved",
    seed: true,
    hook_ja: "その松、冬に部屋へ入れていませんか？",
    hook_en: "Is your pine spending the winter indoors?",
    scenes: [
      { sec: 3, visual: "title", text_ja: "その松、冬に部屋へ入れていませんか？", text_en: "Is your pine spending the winter indoors?" },
      { sec: 4, visual: "photo", text_ja: "リヨンから届いた相談。葉先が茶色い。", text_en: "A question from Lyon: the needle tips are turning brown." },
      { sec: 5, visual: "quote", text_ja: "松は寒さに当てて休ませる木", text_en: "“A pine rests by feeling the cold.” — a master in Japan" },
      { sec: 5, visual: "quote", text_ja: "凍る夜だけ、軒下になおして", text_en: "“Only on freezing nights, move it under the eaves.”" },
      { sec: 4, visual: "cta", text_ja: "職人の言葉を、そのまま。", text_en: "A master's words, carried across unchanged." },
    ],
    captions: {
      instagram: { text: "Brown tips on your black pine? Two bonsai masters in Japan answered an owner in Lyon — in their own words. Full answer on our site (link in bio).", hashtags: ["bonsai", "blackpine", "bonsaitips", "japanesebonsai", "engawa"] },
      youtube: { title: "Why your bonsai pine hates winter indoors — a master in Japan answers", text: "An owner in Lyon asked two bonsai masters in Japan. Here's what they said, word for word.", hashtags: ["bonsai", "shorts", "blackpine"] },
      tiktok: { text: "POV: you asked a real bonsai master in Japan 🌲 #bonsai #bonsaitok #japan", hashtags: ["bonsai", "bonsaitok", "japan"] },
    },
  },
  {
    id: "s-history",
    slug: "history",
    created: T0 - 3 * DAY + 3600_000,
    status: "approved",
    seed: true,
    hook_ja: "700年前の絵に、もう盆栽があった。",
    hook_en: "Bonsai was already in a painting 700 years ago.",
    scenes: [
      { sec: 3, visual: "title", text_ja: "700年前の絵に、もう盆栽があった。", text_en: "Bonsai was already in a painting 700 years ago." },
      { sec: 4, visual: "tree", text_ja: "1309年の絵巻に、鉢の木。", text_en: "A potted tree, in a scroll from 1309." },
      { sec: 4, visual: "tree", text_ja: "1925年、大宮に盆栽村。", text_en: "1925: the Bonsai Village is born in Omiya." },
      { sec: 4, visual: "quote", text_ja: "最盛期は約30園、いまは6園。", text_en: "Once about 30 gardens. Six remain today." },
      { sec: 4, visual: "cta", text_ja: "その言葉を、海の向こうへ。", text_en: "Carrying their words across the sea." },
    ],
    captions: {
      instagram: { text: "From a 1309 picture scroll to the Omiya Bonsai Village: 700 years of nature in a pot. Read the full story (link in bio).", hashtags: ["bonsai", "bonsaihistory", "omiya", "japaneseculture", "engawa"] },
      youtube: { title: "700 years of bonsai in 20 seconds", text: "From a 1309 scroll to the Omiya Bonsai Village.", hashtags: ["bonsai", "shorts", "history"] },
      tiktok: { text: "bonsai is 700 years old and here's the proof 📜🌲 #bonsai #japan #history", hashtags: ["bonsai", "japan", "history"] },
    },
  },
];

SEED_SHORTS.push({
  id: "s-look",
  slug: "how-to-look",
  created: T0 - 2 * DAY + 3600_000,
  status: "approved",
  seed: true,
  hook_ja: "職人は、まず根元を見る。",
  hook_en: "A bonsai master looks at the roots first.",
  scenes: [
    { sec: 3, visual: "title", text_ja: "職人は、まず根元を見る。", text_en: "A bonsai master looks at the roots first." },
    { sec: 4, visual: "tree", text_ja: "根張り ― 大地をつかむ根", text_en: "Nebari: roots that grip the earth." },
    { sec: 4, visual: "tree", text_ja: "幹模様 ― 木の性格", text_en: "The trunk's movement is the tree's character." },
    { sec: 4, visual: "quote", text_ja: "左右対称を避ける", text_en: "Avoid symmetry — that's where nature lives." },
    { sec: 4, visual: "cta", text_ja: "四つの見どころを、記事で。", text_en: "Four things the masters see — full article." },
  ],
  captions: {
    instagram: { text: "Where does a bonsai master look first? Not the leaves. Four things the masters see — full article via link in bio.", hashtags: ["bonsai", "nebari", "bonsaiart", "japaneseculture", "engawa"] },
    youtube: { title: "How to look at a bonsai like a Japanese master", text: "Nebari, trunk movement, the uneven triangle and the pot.", hashtags: ["bonsai", "shorts", "nebari"] },
    tiktok: { text: "bonsai masters look at THIS first 👀🌳 #bonsai #nebari #japan", hashtags: ["bonsai", "nebari", "japan"] },
  },
});

// 計測の見本（ショートごと・SNSごとの来訪数）
export const SEED_HITS: Record<string, number> = {
  "s-pine-ig": 412, "s-pine-yt": 268, "s-pine-tt": 731,
  "s-history-ig": 198, "s-history-yt": 344, "s-history-tt": 156,
  "s-look-ig": 287, "s-look-yt": 121, "s-look-tt": 509,
};
export const SEED_VIEWS: Record<string, number> = { history: 1290, "how-to-look": 846, "pine-brown-tips": 1873 };

export const SEED_THREADS: Thread[] = [
  {
    id: "t-juniper",
    title: "First winter with a juniper on my balcony",
    created: T0 - 2 * DAY,
    seed: true,
    posts: [
      { name: "Marco · Milan", lang: "en", created: T0 - 2 * DAY, body: "My first winter with a shimpaku juniper on a 4th-floor balcony. It gets windy. Anything I should watch for?", tr: { ja: "4階のベランダで真柏を育てて初めての冬です。風が強いです。気をつけることはありますか。" } },
      { name: "職人A（見本）", lang: "ja", created: T0 - 2 * DAY + 5 * 3600_000, master: true, body: "真柏は寒さには強いです。風で鉢が乾きやすいので、水を切らさないようにしてください。", tr: { en: "Shimpaku is strong against the cold. The wind dries the pot quickly, so don't let it run out of water.", es: "El shimpaku resiste bien el frío. El viento seca rápido la maceta, así que no dejes que le falte agua.", zh: "真柏很耐寒。风会让盆土很快变干，请别让它缺水。" } },
    ],
  },
  {
    id: "t-nebari",
    title: "¿Qué significa «nebari»?",
    created: T0 - 1 * DAY,
    seed: true,
    posts: [
      { name: "Lucía · Valencia", lang: "es", created: T0 - 1 * DAY, body: "Leo «nebari» en todas partes. ¿Es solo «raíces»?", tr: { ja: "「根張り」という言葉をよく見ます。ただの「根」という意味ですか。", en: "I see “nebari” everywhere. Does it just mean “roots”?" } },
      { name: "Engawa", lang: "es", created: T0 - 1 * DAY + 3600_000, body: "No exactamente: son las raíces que se ven sobre el sustrato, extendidas en todas direcciones. Mira el glosario: #/glossary", tr: { ja: "少し違います。土の上に見えて、四方に広がる根のことです。用語集をどうぞ。" } },
    ],
  },
  {
    id: "t-repot",
    title: "第一次换盆，有点紧张",
    created: T0 - 6 * 3600_000,
    seed: true,
    posts: [
      { name: "小林 · 上海", lang: "zh", created: T0 - 6 * 3600_000, body: "明年春天想给我的五针松第一次换盆，有点紧张。大家第一次都是怎么做的？", tr: { ja: "来年の春、五葉松をはじめて植え替えたいです。少し緊張しています。みなさんは最初どうしましたか。", en: "I want to repot my white pine for the first time next spring and I'm a bit nervous. How did everyone do their first time?" } },
    ],
  },
];

export const SEED_WISHES: Wish[] = [
  { id: "w-1", created: T0 - 2 * DAY, seed: true, country: "Germany", text: "Looking for a shohin black pine, about 20 cm, with good nebari. Budget around 300 EUR.", raised: ["職人A（見本）"],
    parsed: { species: "黒松", size: "小品（約20cm）", style: "根張りのよいもの", budget: "約300ユーロ", summary_ja: "ドイツの方。根張りのよい小品の黒松、20cmくらい、300ユーロほど。", summary_en: "Shohin black pine, ~20 cm, good nebari, ~300 EUR" } },
  { id: "w-2", created: T0 - 1 * DAY, seed: true, country: "España", text: "Busco un arce japonés pequeño para mi balcón en Valencia. Presupuesto 150 €.", raised: [],
    parsed: { species: "もみじ（イロハモミジ）", size: "小さめ", style: "ベランダ向き", budget: "約150ユーロ", summary_ja: "スペイン・バレンシアの方。ベランダに置ける小さめのもみじ、150ユーロほど。", summary_en: "Small Japanese maple for a balcony, ~150 EUR" } },
  { id: "w-3", created: T0 - 8 * 3600_000, seed: true, country: "USA", text: "Dream tree: a cascade juniper (kengai) for my first show. Medium size, up to $800.", raised: ["職人B（見本）"],
    parsed: { species: "真柏", size: "中品", style: "懸崖", budget: "約800ドル", summary_ja: "アメリカの方。はじめての展示会に出す懸崖の真柏、中品、800ドルまで。", summary_en: "Cascade juniper, medium, up to $800, for a first show" } },
];
