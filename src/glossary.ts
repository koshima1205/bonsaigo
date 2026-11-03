// 盆栽の用語集（見本）。箱崎さんの用語集（約110語）が届いたら差し替える。
// 直訳ではなく「意味」で訳すための表。職人さんが画面から直すと、KV の上書きが優先される。
export interface Term {
  ja: string;
  yomi: string;
  literal: string; // 直訳（英語）。直訳だと伝わらない例として見せる
  meaning_ja: string;
  why_ja: string; // なぜそうするか
  en: string;
  es: string;
  zh: string;
  dialect?: boolean;
  forms?: string[]; // 活用した形（なおし・なおさ など）
  edited_by?: string;
  edited_at?: number;
}

export const SEED: Term[] = [
  { ja: "芽摘み", yomi: "めつみ", literal: "bud picking", meaning_ja: "伸びてきた新しい芽を指先で摘み取ること", why_ja: "勢いをおさえて、枝を細かく増やすため", en: "pinching back new shoots by hand", es: "pinzado de brotes nuevos", zh: "摘芽（用手摘掉新芽）" },
  { ja: "芽切り", yomi: "めきり", literal: "bud cutting", meaning_ja: "初夏に、黒松などの今年伸びた芽を根元から切ること", why_ja: "二番芽を出させて、葉の長さを短くそろえるため", en: "candle cutting (removing this year's shoots in early summer)", es: "corte de velas a principios de verano", zh: "切芽（初夏剪掉当年新梢）" },
  { ja: "葉刈り", yomi: "はがり", literal: "leaf mowing", meaning_ja: "初夏に、落葉樹の葉を切り落とすこと", why_ja: "次に出る葉を小さくし、枝の内側まで光を入れるため", en: "defoliation (cutting off the leaves in early summer)", es: "defoliación a principios de verano", zh: "摘叶（初夏剪掉落叶树的叶片）" },
  { ja: "剪定", yomi: "せんてい", literal: "pruning", meaning_ja: "形を整えるために枝を切ること", why_ja: "形を保ち、木の力を必要な枝に回すため", en: "pruning branches to keep the shape", es: "poda para mantener la forma", zh: "修剪" },
  { ja: "透かし", yomi: "すかし", literal: "see-through", meaning_ja: "混み合った枝や葉を間引いて、すき間を作ること", why_ja: "内側に光と風を通し、蒸れや弱りを防ぐため", en: "thinning out crowded branches and needles", es: "aclareo de ramas y hojas", zh: "疏剪（剪掉过密的枝叶）" },
  { ja: "針金掛け", yomi: "はりがねかけ", literal: "wire hanging", meaning_ja: "枝や幹に針金を巻いて、曲げて形を作ること", why_ja: "思った方向に枝を向け、形を作るため", en: "wiring branches to shape them", es: "alambrado para dar forma", zh: "蟠扎（用金属丝缠绕造型）" },
  { ja: "植え替え", yomi: "うえかえ", literal: "replanting", meaning_ja: "鉢から出して根を整え、新しい土で植え直すこと", why_ja: "根が鉢の中で詰まるのを防ぎ、土を新しくするため", en: "repotting", es: "trasplante", zh: "换盆" },
  { ja: "根さばき", yomi: "ねさばき", literal: "root handling", meaning_ja: "植え替えのとき、からんだ根をほぐして整えること", why_ja: "新しい根が出やすくなり、水がよく通るようにするため", en: "combing out and trimming the roots when repotting", es: "desenredar y recortar las raíces al trasplantar", zh: "理根（换盆时梳理修剪根系）" },
  { ja: "赤玉土", yomi: "あかだまつち", literal: "red ball soil", meaning_ja: "粒になった赤土。盆栽の基本の土", why_ja: "水はけと水もちの両方がよいため", en: "akadama (granular Japanese clay soil)", es: "akadama (arcilla japonesa granulada)", zh: "赤玉土（日本粒状红土）" },
  { ja: "鹿沼土", yomi: "かぬまつち", literal: "Kanuma soil", meaning_ja: "酸性の軽い粒の土。サツキなどに使う", why_ja: "酸性の土を好む木に合うため", en: "kanuma (acidic pumice-like soil for azaleas)", es: "kanuma (sustrato ácido para azaleas)", zh: "鹿沼土（酸性轻质土，用于杜鹃）" },
  { ja: "用土", yomi: "ようど", literal: "use soil", meaning_ja: "鉢に入れる土の配合", why_ja: "木の種類と置き場所に合わせて、水はけを決めるため", en: "the soil mix for the pot", es: "mezcla de sustrato", zh: "盆土配方" },
  { ja: "置き肥", yomi: "おきごえ", literal: "placed fertilizer", meaning_ja: "固形の肥料を土の上に置くこと", why_ja: "水やりのたびに少しずつ溶けて、ゆっくり効くため", en: "solid fertilizer cakes placed on the soil", es: "abono sólido colocado sobre el sustrato", zh: "置肥（把固体肥放在土面）" },
  { ja: "棚持ち", yomi: "たなもち", literal: "shelf holding", meaning_ja: "整えた形が崩れずに長く保たれること", why_ja: "見頃が長く続く木ほど、手入れがうまくいっている証だから", en: "how long a tree keeps its refined shape", es: "cuánto tiempo el árbol conserva su forma", zh: "形态保持（造型能长期维持）" },
  { ja: "立ち上がり", yomi: "たちあがり", literal: "standing up", meaning_ja: "土から出たところの、幹の根元の部分", why_ja: "木の古さと力強さが一番よく見える所だから", en: "the base of the trunk where it rises from the soil", es: "la base del tronco al salir del sustrato", zh: "树干基部（出土处）" },
  { ja: "根張り", yomi: "ねばり", literal: "root stretch", meaning_ja: "土の上に見える、四方に広がった根", why_ja: "大地をつかむ安定感を見せるため", en: "nebari (surface roots spreading in all directions)", es: "nebari (raíces superficiales extendidas)", zh: "根盘（露出土面向四周展开的根）" },
  { ja: "幹模様", yomi: "みきもよう", literal: "trunk pattern", meaning_ja: "幹の曲がり方や流れ", why_ja: "木の個性と年月を表す一番の見どころだから", en: "the movement and curves of the trunk", es: "el movimiento del tronco", zh: "干的曲线与走势" },
  { ja: "忌み枝", yomi: "いみえだ", literal: "taboo branch", meaning_ja: "形を乱すので切る枝（交差する枝・同じ所から何本も出る枝など）", why_ja: "全体の流れを乱し、見た目と木の力の両方を損なうため", en: "unwanted branches that spoil the design (crossing, clustered, etc.)", es: "ramas indeseadas que estropean el diseño", zh: "忌枝（破坏造型、应剪除的枝）" },
  { ja: "徒長枝", yomi: "とちょうし", literal: "idle-long branch", meaning_ja: "勢いよく長く伸びすぎた枝", why_ja: "ほかの枝の力を奪い、形を崩すため", en: "overly vigorous, leggy shoots", es: "brotes demasiado vigorosos", zh: "徒长枝" },
  { ja: "舎利", yomi: "しゃり", literal: "relics", meaning_ja: "幹の一部が枯れて白く残った部分", why_ja: "厳しい自然を生きた年月を表すため", en: "shari (bleached deadwood on the trunk)", es: "shari (madera muerta en el tronco)", zh: "舍利干（树干上的白色枯木）" },
  { ja: "神", yomi: "じん", literal: "god", meaning_ja: "枝先が枯れて白く残った部分", why_ja: "風雪に耐えた姿を表すため", en: "jin (bleached deadwood on a branch tip)", es: "jin (madera muerta en la punta de una rama)", zh: "神枝（枝端的白色枯木）" },
  { ja: "正面", yomi: "しょうめん", literal: "front face", meaning_ja: "木を一番よく見せる向き", why_ja: "根張り・幹模様・枝の見え方がすべて決まるため", en: "the front of the tree (its best viewing side)", es: "el frente del árbol", zh: "正面（最佳观赏面）" },
  { ja: "不等辺三角形", yomi: "ふとうへんさんかくけい", literal: "unequal-sided triangle", meaning_ja: "木全体の輪郭を、辺の長さが違う三角形にする考え方", why_ja: "左右対称を避けると、自然で動きのある姿になるため", en: "an asymmetric triangle outline for the whole tree", es: "silueta de triángulo asimétrico", zh: "不等边三角形轮廓" },
  { ja: "模様木", yomi: "もようぎ", literal: "pattern tree", meaning_ja: "幹が前後左右に曲がりながら立つ樹形", why_ja: "自然の中で育った木の動きを表すため", en: "informal upright style", es: "estilo vertical informal (moyogi)", zh: "曲干式（模样木）" },
  { ja: "懸崖", yomi: "けんがい", literal: "hanging cliff", meaning_ja: "幹が鉢より下へ垂れ下がる樹形", why_ja: "崖から垂れ下がって生きる木の姿を表すため", en: "cascade style", es: "estilo cascada (kengai)", zh: "悬崖式" },
  { ja: "文人木", yomi: "ぶんじんぎ", literal: "literati tree", meaning_ja: "細い幹で枝の少ない、すっきりした樹形", why_ja: "余白と気品を味わうため", en: "literati style (slender trunk, few branches)", es: "estilo literati (bunjingi)", zh: "文人树" },
  { ja: "古葉取り", yomi: "ふるはとり", literal: "old leaf taking", meaning_ja: "秋に、松の古い葉を抜き取ること", why_ja: "光と風を通し、新しい葉の力を保つため", en: "removing old pine needles in autumn", es: "quitar las acículas viejas en otoño", zh: "摘除老叶（秋季拔掉松树旧针叶）" },
  { ja: "腰水", yomi: "こしみず", literal: "waist water", meaning_ja: "鉢ごと水に浸して、底から水を吸わせること", why_ja: "乾きすぎた土にも、むらなく水を行き渡らせるため", en: "soaking the whole pot in water from below", es: "riego por inmersión", zh: "浸盆法（把盆浸在水中从底部吸水）" },
  { ja: "冬越し", yomi: "ふゆごし", literal: "winter crossing", meaning_ja: "冬の間の置き場所と手入れ", why_ja: "松や落葉樹は寒さで休むことで、春に力強く芽を出すため", en: "overwintering (letting the tree rest in the cold)", es: "invernada (dejar que el árbol repose con el frío)", zh: "越冬（让树在寒冷中休眠）" },
  { ja: "芽かき", yomi: "めかき", literal: "bud scratching", meaning_ja: "いらない芽を早いうちに取ること", why_ja: "必要な枝にだけ力を集めるため", en: "removing unwanted buds early", es: "desyemado temprano", zh: "抹芽（及早去掉多余的芽）" },
  { ja: "一の枝", yomi: "いちのえだ", literal: "number one branch", meaning_ja: "幹の一番下にある、いちばん大事な枝", why_ja: "全体の形の土台になるため", en: "the first (lowest main) branch", es: "la primera rama (la más baja)", zh: "第一枝（最下面的主枝）" },
  { ja: "なおす", yomi: "なおす", literal: "repair", meaning_ja: "（西日本などの言い方）しまう・片づける。「軒下になおす」は軒下へ移すこと", why_ja: "直訳の『修理する』だと意味が通らなくなるため", en: "put away / move (regional; not \"repair\")", es: "guardar / mover (regional; no \"reparar\")", zh: "收进去、移到（方言，不是“修理”）", dialect: true, forms: ["なおし", "なおさ", "なおせ", "なおそ"] },
  { ja: "水をくれる", yomi: "みずをくれる", literal: "gives me water", meaning_ja: "（職人さんの言い方）木に水をやること", why_ja: "『くれる』は木に与える意味。『私に水をくれる』ではない", en: "to water the tree", es: "regar el árbol", zh: "给树浇水", dialect: true, forms: ["水をくれ", "水くれ"] },
  { ja: "えらい", yomi: "えらい", literal: "great", meaning_ja: "（西日本などの言い方）弱っている・しんどい。「木がえらそう」は木が弱っている様子", why_ja: "直訳の『偉い』だと、ほめ言葉に誤解されるため", en: "struggling / stressed (regional; not \"great\")", es: "debilitado / con estrés (regional)", zh: "虚弱、吃力（方言，不是“了不起”）", dialect: true, forms: ["えらそう", "えらく", "えらがって"] },
  { ja: "鉢映り", yomi: "はちうつり", literal: "pot reflection", meaning_ja: "木と鉢の釣り合い", why_ja: "鉢の色と形で、木の見え方が大きく変わるため", en: "the harmony between the tree and its pot", es: "la armonía entre árbol y maceta", zh: "树与盆的协调" },
];

export function findTerms(text: string, terms: Term[]): Term[] {
  return terms.filter((t) => [t.ja, ...(t.forms ?? [])].some((f) => text.includes(f)));
}
