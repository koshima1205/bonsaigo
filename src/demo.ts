// 鍵（ANTHROPIC_API_KEY）がないときの代わり。手元の試しと審査用の見本。
// 決まった文の訳は用意した辞書から、それ以外は「見本」と分かる形で返す。
import type { Brief, Help, Intake, Knowledge, Letter } from "./claude";
import { termIn } from "./claude";
import type { Term } from "./glossary";
import type { Article, ML, Short } from "./seed";

type Tr = { en: string; es: string; zh: string; fr: string; de: string; it: string; easy: string };

// 職人さんがよく使う言葉と、見本の答えの訳（文ごと）
export const TR: Record<string, Tr> = {
  心配いりません: { en: "There is nothing to worry about.", es: "No hay de qué preocuparse.", zh: "不用担心。", fr: "Il n'y a pas d'inquiétude à avoir.", de: "Kein Grund zur Sorge.", it: "Non c'è da preoccuparsi.", easy: "しんぱい しなくて いいです。" },
  自然なことです: { en: "It is a natural thing.", es: "Es algo natural.", zh: "这是很自然的现象。", fr: "C'est tout à fait naturel.", de: "Das ist ganz natürlich.", it: "È una cosa naturale.", easy: "しぜんな ことです。" },
  室内に入れっぱなしは良くないです: { en: "Keeping it indoors all the time is not good for it.", es: "Tenerlo siempre dentro no le hace bien.", zh: "一直放在室内对它不好。", fr: "Le garder tout le temps à l'intérieur ne lui fait pas de bien.", de: "Ihn ständig drinnen zu halten, tut ihm nicht gut.", it: "Tenerlo sempre in casa non gli fa bene.", easy: "ずっと へやの 中に おくのは よくないです。" },
  冬も外の寒さに当ててください: { en: "Let it feel the outdoor cold in winter, too.", es: "Deja que sienta el frío de fuera también en invierno.", zh: "冬天也请让它感受室外的寒冷。", fr: "Laissez-le sentir le froid du dehors, même en hiver.", de: "Lassen Sie ihn auch im Winter die Kälte draußen spüren.", it: "Lascialo sentire il freddo esterno anche d'inverno.", easy: "冬も 外の さむさに あてて ください。" },
  "水やりは、土の表面が乾いてから、鉢の底から出るまでたっぷりと": { en: "Water when the surface of the soil is dry — generously, until it runs from the bottom of the pot.", es: "Riega cuando la superficie del sustrato esté seca, con generosidad, hasta que salga por el fondo de la maceta.", zh: "等土表面干了再浇水，要浇透，直到水从盆底流出。", fr: "Arrosez quand la surface du substrat est sèche, généreusement, jusqu'à ce que l'eau sorte par le fond du pot.", de: "Gießen Sie, wenn die Oberfläche trocken ist — reichlich, bis es unten aus dem Topf läuft.", it: "Annaffia quando la superficie del terriccio è asciutta, abbondantemente, finché l'acqua esce dal fondo del vaso.", easy: "土の 上が かわいたら、水を やります。はちの 下から 出るまで たっぷり です。" },
  "今は切らないで、春まで様子を見てください": { en: "Don't cut it now; watch it until spring.", es: "No lo podes ahora; obsérvalo hasta la primavera.", zh: "现在先别剪，观察到春天。", fr: "Ne taillez pas maintenant ; observez-le jusqu'au printemps.", de: "Schneiden Sie jetzt nicht; beobachten Sie ihn bis zum Frühling.", it: "Non potarlo ora; osservalo fino alla primavera.", easy: "いまは 切らないで ください。春まで ようすを 見て ください。" },
  "植え替えは春、芽が動き出す前にしてください": { en: "Repot in spring, before the buds begin to move.", es: "Trasplanta en primavera, antes de que se muevan las yemas.", zh: "换盆请在春天、芽开始萌动之前进行。", fr: "Rempotez au printemps, avant que les bourgeons ne se réveillent.", de: "Topfen Sie im Frühling um, bevor die Knospen austreiben.", it: "Rinvasa in primavera, prima che le gemme si muovano.", easy: "うえかえは 春に します。めが 出る まえに して ください。" },
  肥料は今は止めてください: { en: "Stop fertilizing for now.", es: "Deja el abono por ahora.", zh: "现在先停止施肥。", fr: "Arrêtez l'engrais pour le moment.", de: "Hören Sie vorerst mit dem Düngen auf.", it: "Sospendi il concime per ora.", easy: "いまは ひりょうを やめて ください。" },
  日当たりと風通しのよい所に置いてください: { en: "Keep it somewhere sunny with good airflow.", es: "Ponlo en un lugar soleado y bien ventilado.", zh: "请放在日照好、通风好的地方。", fr: "Placez-le dans un endroit ensoleillé et bien aéré.", de: "Stellen Sie ihn an einen sonnigen, luftigen Platz.", it: "Mettilo in un posto soleggiato e ben ventilato.", easy: "日が あたって、風が とおる ところに おいて ください。" },
  "葉先が茶色いのは、室内に入れっぱなしで弱ってきてるんだと思います": { en: "I think the tips are browning because it has been kept indoors all the time and is weakening.", es: "Creo que las puntas se ponen marrones porque ha estado siempre dentro y se está debilitando.", zh: "我想叶尖发褐，是因为一直放在室内，树变弱了。", fr: "Je pense que les pointes brunissent parce qu'il est resté tout le temps à l'intérieur et s'affaiblit.", de: "Ich glaube, die Spitzen werden braun, weil er ständig drinnen stand und schwächer wird.", it: "Credo che le punte diventino marroni perché è stato sempre in casa e si sta indebolendo.", easy: "はの 先が 茶色いのは、ずっと へやの 中に おいたので、弱って きたからだと 思います。" },
  "松は寒さに当てて休ませる木なので、冬も外に出してください": { en: "A pine rests by feeling the cold, so keep it outside in winter too.", es: "El pino descansa sintiendo el frío, así que déjalo fuera también en invierno.", zh: "松树要靠寒冷来休眠，所以冬天也请放在室外。", fr: "Le pin se repose en sentant le froid : laissez-le dehors, même en hiver.", de: "Eine Kiefer ruht, indem sie die Kälte spürt — lassen Sie sie auch im Winter draußen.", it: "Il pino riposa sentendo il freddo, quindi tienilo fuori anche d'inverno.", easy: "松は さむさで 休む 木です。だから 冬も 外に 出して ください。" },
  木がえらそうにしてますね: { en: "The tree looks like it is struggling.", es: "El árbol parece estar sufriendo.", zh: "这棵树看起来很吃力。", fr: "L'arbre a l'air de souffrir.", de: "Der Baum wirkt geschwächt.", it: "L'albero sembra in sofferenza.", easy: "木が 弱って いる ようです。" },
  "ただ、鉢が凍るくらいの夜だけは、軒下になおしてください": { en: "Only on nights cold enough to freeze the pot, move it under the eaves.", es: "Solo las noches en que la maceta pueda helarse, ponlo bajo el alero.", zh: "只有冷到花盆会结冰的夜晚，才把它移到屋檐下。", fr: "Seulement les nuits où le pot risque de geler, mettez-le à l'abri sous l'avant-toit.", de: "Nur in Nächten, in denen der Topf gefrieren könnte, stellen Sie ihn unter das Vordach.", it: "Solo nelle notti in cui il vaso potrebbe gelare, spostalo sotto la gronda.", easy: "でも、はちが こおるほど さむい 夜だけ、のきしたに うつして ください。" },
};

const GREET: Record<string, string> = {
  en: "Thank you for your question. Here is what I see.",
  es: "Gracias por tu pregunta. Esto es lo que veo.",
  zh: "谢谢你的提问。我是这样看的。",
  fr: "Merci pour votre question. Voici ce que je vois.",
  de: "Danke für Ihre Frage. Folgendes sehe ich.",
  it: "Grazie per la domanda. Ecco cosa vedo.",
  easy: "しつもん ありがとう ございます。わたしの 考えを つたえます。",
};

const SAMPLE_NOTE: Record<string, string> = {
  en: "(sample — this sentence is translated when an API key is set)",
  es: "(ejemplo: esta frase se traduce con la clave de API)",
  zh: "（示例：设置 API 密钥后会翻译这句话）",
  fr: "(exemple — traduit une fois la clé API configurée)",
  de: "(Beispiel — wird mit API-Schlüssel übersetzt)",
  it: "(esempio — tradotto quando è impostata la chiave API)",
  easy: "（見本です。APIキーを 入れると ほんやく します）",
};

// 訳し戻し：意味で訳した所が分かるよう、言い換えた日本語で返す
const BACK: Record<string, string> = {
  ...Object.fromEntries(Object.keys(TR).map((k) => [k, k + "。"])),
  木がえらそうにしてますね: "木が弱っているように見えます。",
  "葉先が茶色いのは、室内に入れっぱなしで弱ってきてるんだと思います": "葉の先が茶色いのは、ずっと室内に置いていて弱ってきたからだと思います。",
  "松は寒さに当てて休ませる木なので、冬も外に出してください": "松は寒さを感じて休む木なので、冬も外に置いてください。",
  "ただ、鉢が凍るくらいの夜だけは、軒下になおしてください": "鉢が凍るほど寒い夜だけは、軒下に移してください。",
};

export const sentences = (s: string) => s.split(/[。\n]/).map((x) => x.trim()).filter(Boolean);
const tr = (ja: string, lang: string) => (TR[ja] as Record<string, string> | undefined)?.[lang];

const INTAKE: Record<string, Intake> = {
  en: { tree_guess: "Looks like a Japanese black pine", followups: [{ id: "place", question: "Where is the tree right now?", options: ["Outside", "Indoors", "Balcony"] }, { id: "repot", question: "When was it last repotted?", options: ["This year", "2-3 years ago", "Not sure"] }], climate_owner: "This month in your city: around 4–11 °C, humid", climate_ja: "" },
  es: { tree_guess: "Parece un pino negro japonés", followups: [{ id: "place", question: "¿Dónde está el árbol ahora?", options: ["Fuera", "Dentro", "Balcón"] }, { id: "repot", question: "¿Cuándo se trasplantó por última vez?", options: ["Este año", "Hace 2-3 años", "No lo sé"] }], climate_owner: "Este mes en tu ciudad: unos 4–11 °C, húmedo", climate_ja: "" },
  zh: { tree_guess: "看起来像是日本黑松", followups: [{ id: "place", question: "这棵树现在放在哪里？", options: ["室外", "室内", "阳台"] }, { id: "repot", question: "上次换盆是什么时候？", options: ["今年", "2-3年前", "不清楚"] }], climate_owner: "你所在城市本月：约4–11°C，潮湿", climate_ja: "" },
  fr: { tree_guess: "On dirait un pin noir du Japon", followups: [{ id: "place", question: "Où est l'arbre en ce moment ?", options: ["Dehors", "Intérieur", "Balcon"] }, { id: "repot", question: "Dernier rempotage ?", options: ["Cette année", "Il y a 2-3 ans", "Je ne sais pas"] }], climate_owner: "Ce mois-ci dans votre ville : 4–11 °C, humide", climate_ja: "" },
  de: { tree_guess: "Sieht aus wie eine Japanische Schwarzkiefer", followups: [{ id: "place", question: "Wo steht der Baum gerade?", options: ["Draußen", "Drinnen", "Balkon"] }, { id: "repot", question: "Wann wurde er zuletzt umgetopft?", options: ["Dieses Jahr", "Vor 2-3 Jahren", "Weiß nicht"] }], climate_owner: "Diesen Monat in Ihrer Stadt: ca. 4–11 °C, feucht", climate_ja: "" },
  it: { tree_guess: "Sembra un pino nero giapponese", followups: [{ id: "place", question: "Dove si trova l'albero ora?", options: ["Fuori", "In casa", "Balcone"] }, { id: "repot", question: "Quando è stato rinvasato l'ultima volta?", options: ["Quest'anno", "2-3 anni fa", "Non so"] }], climate_owner: "Questo mese nella tua città: circa 4–11 °C, umido", climate_ja: "" },
  easy: { tree_guess: "くろまつ だと 思います", followups: [{ id: "place", question: "木は いま どこに ありますか", options: ["外", "へやの 中", "ベランダ"] }, { id: "repot", question: "さいごに うえかえたのは いつですか", options: ["ことし", "2〜3年 まえ", "わからない"] }], climate_owner: "あなたの 町の 今月：4〜11℃ぐらい、しめっぽい", climate_ja: "" },
};

const AXIS_RULES: [Knowledge["axes"][number]["key"], RegExp][] = [
  ["diagnosis", /茶色|病気|弱っ|弱い|心配|自然なこと|黄色|枯れ|えら/],
  ["repot", /植え替え|用土|根さばき|赤玉/],
  ["feed", /肥料|置き肥/],
  ["water", /水|乾/],
  ["prune", /切|剪定|芽摘み|芽切り|芽かき|針金|透かし|葉刈り/],
  ["place", /外|室内|軒下|置|日当たり|風通し|部屋|なおし|寒さ/],
];

export function knowledgeByRules(lines: { master: string; quote_ja: string; text: string }[]): Knowledge {
  const axes = new Map<Knowledge["axes"][number]["key"], Knowledge["axes"][number]["items"]>();
  for (const l of lines) {
    const key = AXIS_RULES.find(([, re]) => re.test(l.quote_ja))?.[0] ?? "other";
    axes.set(key, [...(axes.get(key) ?? []), l]);
  }
  const masters = new Set(lines.map((l) => l.master));
  const shared = [...axes].filter(([, items]) => new Set(items.map((i) => i.master)).size > 1).map(([k]) => k);
  return {
    axes: [...axes].map(([key, items]) => ({ key, items })),
    agree_ja: masters.size > 1 ? (shared.length ? `${shared.length}つの点で、複数の職人さんが同じことに触れています。` : "職人さんごとに別の点に答えていて、ぶつかる所はありません。") : "",
    differ_ja: "",
  };
}

const CITY_T: Record<string, (city: string) => string> = {
  en: (c) => `A question from ${c || "abroad"}`,
  es: (c) => `Una pregunta desde ${c || "el extranjero"}`,
  zh: (c) => `来自${c || "海外"}的咨询`,
  easy: (c) => `${c || "外国"}からの そうだん`,
};

// 樹種名（見本の応答用）。ない樹種は日本語のまま出す
const TREES: Record<string, Omit<ML, "ja">> = {
  黒松: { easy: "くろまつ", en: "Japanese black pine", es: "Pino negro japonés", zh: "黑松" },
  五葉松: { easy: "ごようまつ", en: "Japanese white pine", es: "Pino blanco japonés", zh: "五针松" },
  松: { easy: "まつ", en: "Pine", es: "Pino", zh: "松" },
  真柏: { easy: "しんぱく", en: "Shimpaku juniper", es: "Junípero shimpaku", zh: "真柏" },
  もみじ: { easy: "もみじ", en: "Japanese maple", es: "Arce japonés", zh: "枫" },
  サツキ: { easy: "さつき", en: "Satsuki azalea", es: "Azalea satsuki", zh: "皋月杜鹃" },
};
function treeNames(ja: string): ML {
  const hit = TREES[ja] ?? Object.entries(TREES).find(([k]) => ja.includes(k))?.[1];
  return hit ? { ja, ...hit } : { ja, easy: ja, en: ja, es: ja, zh: ja };
}

function mlFromJa(ja: string): ML {
  const parts = sentences(ja);
  const pick = (lang: string) => parts.map((p) => tr(p, lang) ?? `${p}。`).join(" ");
  return { ja, easy: pick("easy"), en: pick("en"), es: pick("es"), zh: pick("zh") };
}

export const demo = {
  intake(lang: string): Intake {
    return { ...(INTAKE[lang] ?? INTAKE.en), climate_ja: "日本でいうと11月の東北くらい（朝は冷える・湿気が多い）" };
  },
  brief(): Brief {
    return {
      summary_ja: ["黒松の葉先が茶色くなってきた", "10月から室内に入れている", "植え替えは2〜3年前"],
      asked_ja: "葉が茶色いのは病気か、冬はどこに置けばよいか",
      facts_ja: [{ label: "置き場所", value: "10月から室内の窓ぎわ" }, { label: "植え替え", value: "2〜3年前" }],
      tree_ja: "黒松（見た目からの推定）",
    };
  },
  letter(words: string, lang: string): Letter {
    const lines = sentences(words).map((s) => ({ quote_ja: s, text: tr(s, lang) ?? `${s} ${SAMPLE_NOTE[lang] ?? SAMPLE_NOTE.en}`, back_ja: tr(s, lang) ? BACK[s] ?? s : `${s}（見本：鍵を入れると訳します）` }));
    const reminders = lines
      .filter((l) => /植え替え/.test(l.quote_ja) && /春/.test(l.quote_ja))
      .map((l) => ({ month: 3, text: tr(l.quote_ja, lang) ?? l.text, quote_ja: l.quote_ja }));
    return { greeting: GREET[lang] ?? GREET.en, lines, reminders, unclear_ja: lines.some((l) => !TR[l.quote_ja]) ? ["見本のため、辞書にない文は訳していません"] : [] };
  },
  article(c: { question: string; city: string; tree_ja: string; replies: { master: string; quote: string }[] }): Omit<Article, "created" | "status" | "cover"> {
    const q: ML = { ja: `「${c.question}」`, easy: `「${c.question}」`, en: `“${c.question}”`, es: `«${c.question}»`, zh: `“${c.question}”` };
    return {
      slug: `consult-${Date.now().toString(36)}`,
      tree: treeNames(c.tree_ja),
      title: { ja: `${c.city || "海外"}からの相談 ― 職人${c.replies.length}人の答え`, easy: `${CITY_T.easy(c.city)}`, en: CITY_T.en(c.city), es: CITY_T.es(c.city), zh: CITY_T.zh(c.city) },
      lead: { ja: `海外の持ち主から届いた相談に、${c.replies.length}人の職人が答えました。言葉をそのまま並べます。`, easy: `${c.replies.length}人の しょくにんが こたえました。`, en: `Masters in Japan answered an owner abroad. Their words, exactly as spoken.`, es: `Maestros de Japón respondieron a una persona del extranjero. Sus palabras, tal como las dijeron.`, zh: `日本的匠人回答了海外主人的提问。原样呈现他们的话。` },
      sections: [
        { heading: { ja: "相談", easy: "そうだん", en: "The question", es: "La pregunta", zh: "咨询" }, body: q },
        ...c.replies.map((r, i) => ({
          master: r.master,
          quote_ja: r.quote,
          heading: { ja: `${i + 1}人目の職人 ${r.master}`, easy: `${i + 1}人目の しょくにん`, en: `Master ${i + 1} — ${r.master}`, es: `Maestro ${i + 1}: ${r.master}`, zh: `第${i + 1}位匠人 ${r.master}` },
          body: mlFromJa(r.quote),
        })),
      ],
      tags: ["consultation"],
    };
  },
  short(a: Article): Pick<Short, "hook_ja" | "hook_en" | "scenes" | "captions"> {
    const quotes = a.sections.filter((s) => s.quote_ja).slice(0, 2);
    const first = (s: string) => { const x = s.split(/(?<=[.!?。])\s/)[0]; return x.length <= 90 ? x : `${x.slice(0, 88).replace(/\s+\S*$/, "")}…`; };
    return {
      hook_ja: a.title.ja.split("―")[0].trim(),
      hook_en: a.title.en.split("—")[0].trim(),
      scenes: [
        { sec: 3, visual: "title", text_ja: a.title.ja.split("―")[0].trim(), text_en: a.title.en.split("—")[0].trim() },
        { sec: 4, visual: "photo", text_ja: sentences(a.lead.ja)[0], text_en: first(a.lead.en) },
        ...quotes.map((s) => ({ sec: 5, visual: "quote" as const, text_ja: sentences(s.quote_ja!)[0], text_en: first(s.body.en) })),
        { sec: 4, visual: "cta", text_ja: "職人の言葉を、そのまま。", text_en: "A master's words, carried across unchanged." },
      ],
      captions: {
        instagram: { text: `${a.title.en}. Bonsai masters in Japan answered — in their own words. Full story via link in bio.`, hashtags: ["bonsai", "japanesebonsai", "bonsaimaster", "engawa"] },
        youtube: { title: `${a.title.en} | a bonsai master in Japan answers`, text: a.lead.en, hashtags: ["bonsai", "shorts"] },
        tiktok: { text: `asked a real bonsai master in Japan 🌲 ${a.tree.en.toLowerCase()} #bonsai #bonsaitok`, hashtags: ["bonsai", "bonsaitok", "japan"] },
      },
    };
  },
  help(q: string, lang: string, terms: Term[], articles: Article[]): Help {
    const lq = q.toLowerCase();
    const tokens = lq.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 4);
    const hits = terms
      .filter((t) => lq.includes(t.ja) || lq.includes(t.yomi) || tokens.some((k) => t.en.toLowerCase().includes(k) || t.es.toLowerCase().includes(k)) || [...t.zh].some((ch, i, a) => i < a.length - 1 && lq.includes(ch + a[i + 1]) && /\p{Script=Han}/u.test(ch)))
      .slice(0, 3);
    const arts = articles.filter((a) => tokens.some((k) => (a.title.en + a.lead.en + a.tree.en).toLowerCase().includes(k)) || lq.includes(a.tree.ja) || lq.includes(a.tree.zh)).slice(0, 2);
    const handoff = /brown|yellow|dying|dead|sick|pest|bug|droop|wilt|茶色|黄色|枯|病|虫|弱|しお|marr[oó]n|amarill|enferm|plaga|seca|发黄|发褐|枯|生病|虫/.test(lq);
    const H: Record<string, [string, string, string]> = {
      en: ["From our glossary:", "Related article:", "This sounds like it is about your own tree. A master should look at it — that's what the masters are for."],
      es: ["Del glosario:", "Artículo relacionado:", "Parece que hablas de tu propio árbol. Mejor que lo vea un maestro."],
      zh: ["词汇表：", "相关文章：", "这似乎是关于你自己的树，最好请匠人看一看。"],
      ja: ["用語集より：", "関連する記事：", "あなたの木のことのようです。職人さんに見てもらいましょう。"],
      easy: ["ことばの ひょう：", "かんけいの ある きじ：", "あなたの 木の ことですね。しょくにんに 見て もらいましょう。"],
    };
    const h = H[lang] ?? H.en;
    const lines = [
      ...(hits.length ? [h[0], ...hits.map((t) => `・${t.ja}（${t.yomi}）— ${termIn(t, lang)}${lang === "ja" || lang === "easy" ? `。${t.why_ja}` : ""}`)] : []),
      ...(arts.length ? [h[1], ...arts.map((a) => `・${(a.title as Record<string, string>)[lang] ?? a.title.en}`)] : []),
      ...(handoff ? [h[2]] : []),
    ];
    const none: Record<string, string> = { en: "I couldn't find this in our glossary or articles yet. You can ask a master directly.", es: "Aún no lo encuentro en el glosario ni en los artículos. Puedes preguntar a un maestro.", zh: "词汇表和文章里还没有找到。可以直接问匠人。", ja: "用語集と記事には、まだ見つかりません。職人さんに直接聞けます。", easy: "まだ 見つかりません。しょくにんに きいて ください。" };
    return { answer: lines.length ? lines.join("\n") : (none[lang] ?? none.en), sources: [...hits.map((t) => t.ja), ...arts.map((a) => a.slug)], handoff: handoff || !lines.length };
  },
  wish(text: string) {
    const t = text.toLowerCase();
    const species =
      /white pine|五葉|五针|goyo/.test(t) ? "五葉松" : /pine|pino|松|pin\b/.test(t) ? "黒松" : /juniper|enebro|真柏|shimpaku|genévrier|ginepro|wacholder/.test(t) ? "真柏" : /maple|arce|もみじ|枫|érable|acero|ahorn/.test(t) ? "もみじ" : /azalea|satsuki|サツキ|杜鹃/.test(t) ? "サツキ" : /cherry|sakura|桜|樱|cerezo/.test(t) ? "桜" : /ficus|榕/.test(t) ? "ガジュマル" : "";
    const size = /shohin|mame|small|pequeñ|小|petit|klein|piccol/.test(t) ? "小品" : /medium|median|中|moyen|mittel|medi/.test(t) ? "中品" : /large|big|grande|大|groß/.test(t) ? "大品" : "";
    const style = /cascade|kengai|cascada|悬崖|懸崖/.test(t) ? "懸崖" : /literati|bunjin|文人/.test(t) ? "文人木" : /nebari|根張り|根盘/.test(t) ? "根張りのよいもの" : /balcon|balcony|阳台|ベランダ/.test(t) ? "ベランダ向き" : "";
    const m = text.match(/(\$|€|£|¥|円|元|eur|usd|euro)?\s?(\d[\d,.]*)\s?(\$|€|£|¥|円|元|eur|usd|euros?|dollars?)?/i);
    const cur = (m?.[1] ?? m?.[3] ?? "").toLowerCase();
    const unit = /€|eur/.test(cur) ? "ユーロ" : /\$|usd|dollar/.test(cur) ? "ドル" : /£/.test(cur) ? "ポンド" : /円|¥/.test(cur) ? "円" : /元/.test(cur) ? "元" : "";
    const budget = m && unit ? `約${m[2]}${unit}` : "";
    const parts = [species, size, style].filter(Boolean).join("・");
    return { species, size, style, budget, summary_ja: `${parts || "木の種類は未記入"}${budget ? `、${budget}まで` : ""}`, summary_en: text.slice(0, 100) };
  },
};
