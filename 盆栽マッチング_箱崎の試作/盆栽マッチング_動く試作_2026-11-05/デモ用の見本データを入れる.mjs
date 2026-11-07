// デモ用の見本データ（架空の相談と答え）を、保存データに入れる。
// 使い方：サーバーを止めてから  node デモ用の見本データを入れる.mjs  → もう一度 npm start
// 何回動かしても同じ（見本の相談の番号 00000000-0000-4000-8000-00000000000N だけを入れ直す。ほかの相談は消さない）
// 番号はサーバーの受け口に合わせて、ふつうの相談と同じ36文字の形にしている
// 出てくる人（Emma・Lucía・Wei・Tom）は全員架空です。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.BONSAI_DATA || path.join(HERE, "データ", "保存データ.json");
const store = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
for (const k of ["consultations", "feed", "teachers", "trees"]) store[k] ||= [];

const photo = { media_type: "image/jpeg", data: readFileSync(path.join(HERE, "共通", "見本の写真_盆栽.jpg")).toString("base64") };
const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const EMMA = "u-a-demo-emma";

const answered = (h, voice, headline, paragraphs, back) => ({
  at: ago(h), voice_ja: voice, marks: [], from_draft: true, headline, paragraphs, back_translation_ja: back,
  review: { ok: true, problems_ja: [], checked: true },
});

const demo = [
  {
    // Emma → 松風 清：答えが届いている
    id: "00000000-0000-4000-8000-000000000001", at: ago(50), asker_id: EMMA, asker_name: "Emma", lang: "en", teacher_id: "s1", image: null, tree_id: null,
    question: "The inner needles on my black pine are turning yellow and falling. It's autumn here in Seattle. Is my tree dying?",
    for_craftsperson: {
      title_ja: "黒松の内側の葉が黄色くなって落ちる。木が弱っているのか心配、という相談です。",
      summary_ja: "アメリカのシアトルで黒松を育てている方です。秋になって、内側の古い葉が黄色くなって落ち始めたので、木が枯れかけていないか知りたいそうです。",
      points_ja: ["木は黒松", "秋に、内側の葉が黄色くなって落ちる", "枯れかけていないか心配している"],
      ai_mitate_ja: "写真はありません。秋に内側の古い葉だけが黄色くなるなら、古葉が落ちるふつうの動きのことが多いです。",
      terms_ja: ["古葉取り", "黄化"], photo_problem_ja: null,
    },
    ai_draft: { draft_ja: "秋に内側の古い葉が黄色くなるのは、心配いりません。", used_history_ja: null, check_ja: [] }, ai_draft_status: "done",
    answer: answered(46,
      "秋に内側の古い葉が黄色くなって落ちるのは、松が古い葉を入れ替えているだけです。心配いりません。新しい先の葉が緑で元気なら大丈夫。黄色い葉は指でつまんで取ってあげると、風通しがよくなります。先の新しい葉まで黄色くなってきたら、水と根を疑ってください。",
      "Your pine is fine — it's just shedding old needles for autumn.",
      [
        "In autumn, a pine lets go of its oldest needles, the ones on the inside. Turning yellow and dropping is normal, not a sign the tree is dying.",
        "Check the tips: if the newest needles at the ends of the branches are green and firm, the tree is healthy.",
        "You can pull the yellow needles off by hand. This is called [[old-needle removal|古葉取り]], and it lets air and light reach the inside of the tree.",
        "If the new needles at the tips start turning yellow too, look at watering and the roots instead — that is a different problem.",
      ],
      "秋になると、松はいちばん古い内側の葉を落とします。黄色くなって落ちるのは普通のことで、枯れかけているわけではありません。枝先の新しい葉が緑でしっかりしていれば元気です。黄色い葉は手で取ってかまいません（古葉取り）。先の新しい葉まで黄色くなったら、水やりと根を見てください。"),
  },
  {
    // Emma → 岩井 正道：写真つき・答え待ち（職人の画面で答えるデモ用）
    id: "00000000-0000-4000-8000-000000000002", at: ago(3), asker_id: EMMA, asker_name: "Emma", lang: "en", teacher_id: "s3", image: photo, tree_id: null,
    question: "I wired this shimpaku about four months ago. The wire near the top looks tight now. When and how should I take it off?",
    for_craftsperson: {
      title_ja: "4か月前にかけた針金が、上のほうで枝に食い込みそうに見える、という相談です。",
      summary_ja: "真柏に4か月前に針金をかけた方です。上のほうの針金がきつく見えるので、いつ、どうやって外せばよいかを知りたいそうです。写真が1枚ついています。",
      points_ja: ["木は真柏", "針金をかけたのは4か月前", "上のほうの針金がきつく見える", "外す時期と外し方を知りたい"],
      ai_mitate_ja: "写真から見た様子で、診断ではありません。上の細い幹に黒い針金が何回か巻かれています。食い込んでいるかどうかは、この写真の大きさでははっきりしません。",
      terms_ja: ["針金外し", "針金掛け"], photo_problem_ja: null,
    },
    ai_draft: {
      draft_ja: "上のほうの枝で、針金が樹皮に食い込んでいないか見てください。きつくなっているなら、時期を待たずに今外します。ほどかずに、針金切りで1巻きずつ切って外してください。",
      used_history_ja: null,
      check_ja: ["写真では食い込みの具合が分かりません。近くからの写真を頼むかどうか決めてください。"],
    },
    ai_draft_status: "done", answer: null,
  },
  {
    // Lucía（スペイン語）→ 松風 清：答え待ち
    id: "00000000-0000-4000-8000-000000000003", at: ago(20), asker_id: "u-a-demo-lucia", asker_name: "Lucía", lang: "es", teacher_id: "s1", image: null, tree_id: null,
    question: "Mi pino lleva tres años en la misma maceta y el agua tarda mucho en bajar. ¿Debo trasplantarlo ahora o esperar a la primavera?",
    for_craftsperson: {
      title_ja: "3年植え替えていない松。水がなかなか染みこまない。今植え替えるか、春まで待つか、という相談です。",
      summary_ja: "スペイン語圏の方です。松を3年同じ鉢で育てていて、水やりのあと水がなかなか下に抜けないそうです。今すぐ植え替えるべきか、春まで待つべきかを知りたいそうです。",
      points_ja: ["木は松", "3年植え替えていない", "水がなかなか抜けない", "今か、春か"],
      ai_mitate_ja: "写真はありません。水が抜けにくいのは、根詰まりや用土の崩れのことが多いです。",
      terms_ja: ["植え替え", "根詰まり", "水はけ"], photo_problem_ja: null,
    },
    ai_draft: { draft_ja: "松の植え替えは春の芽が動く前がいちばんです。今は無理に植え替えず、春まで待ってください。", used_history_ja: null, check_ja: [] },
    ai_draft_status: "done", answer: null,
  },
  {
    // Wei（中国語）→ 松風 清：答えた
    id: "00000000-0000-4000-8000-000000000004", at: ago(80), asker_id: "u-a-demo-wei", asker_name: "Wei", lang: "zh", teacher_id: "s1", image: null, tree_id: null,
    question: "我的五叶松夏天放在阳台上，叶尖有点发褐。应该挪到阴凉的地方吗？",
    for_craftsperson: {
      title_ja: "ベランダの五葉松、夏に葉先が茶色くなった。日陰に移すべきか、という相談です。",
      summary_ja: "中国語圏の方です。五葉松を夏のあいだベランダに置いていたら、葉先が少し茶色くなったそうです。日陰に移したほうがよいか知りたいそうです。",
      points_ja: ["木は五葉松", "夏はベランダに置いていた", "葉先が茶色い", "日陰に移すべきか"],
      ai_mitate_ja: "写真はありません。夏の照り返しや西日で、葉先が焼けることがあります。",
      terms_ja: ["葉焼け", "西日", "遮光"], photo_problem_ja: null,
    },
    ai_draft: { draft_ja: "真夏の西日と照り返しを避けてください。", used_history_ja: null, check_ja: [] }, ai_draft_status: "done",
    answer: answered(70,
      "葉先が茶色いのは、夏の西日とベランダの照り返しで焼けたんでしょう。真っ暗な日陰に移すと弱るので、午前中だけ日が当たる場所に置くか、午後だけ寒冷紗で日を和らげてください。茶色くなった葉先は戻りませんが、新しい葉が元気なら心配いりません。",
      "叶尖发褐是夏天被晒伤了，换个上午有阳光的地方就好。",
      [
        "叶尖发褐，多半是夏天的西晒和阳台地面的反射热造成的[[叶片晒伤|葉焼け]]。",
        "不要挪到完全阴暗的地方，那样树会变弱。最好放在只有上午有阳光的位置，或者下午用遮阳网把阳光减弱一些。",
        "已经变褐的叶尖不会恢复，但只要新长出的叶子健康，就不用担心。",
      ],
      "葉先が茶色いのは、夏の西日とベランダの照り返しによる葉焼けでしょう。真っ暗な日陰に移すと木が弱るので、午前中だけ日が当たる場所に置くか、午後は寒冷紗で日を和らげてください。茶色くなった葉先は戻りませんが、新しい葉が元気なら心配いりません。"),
  },
  {
    // Tom（英語）→ 楓 ゆき：答え待ち
    id: "00000000-0000-4000-8000-000000000005", at: ago(8), asker_id: "u-a-demo-tom", asker_name: "Tom", lang: "en", teacher_id: "s2", image: null, tree_id: null,
    question: "My Japanese maple's leaves are getting crispy brown edges. I water every day. What am I doing wrong?",
    for_craftsperson: {
      title_ja: "もみじの葉のふちが茶色くパリパリになる。毎日水をやっているのに、という相談です。",
      summary_ja: "英語圏の方です。もみじの葉のふちが茶色く乾いてきたそうです。毎日水をやっているのに、何がいけないのか知りたいそうです。",
      points_ja: ["木はもみじ", "葉のふちが茶色くパリパリ", "毎日水をやっている"],
      ai_mitate_ja: "写真はありません。強い日差しや風、水切れのほか、根の傷みでも葉のふちが枯れます。",
      terms_ja: ["葉焼け", "水切れ", "根の傷み"], photo_problem_ja: null,
    },
    ai_draft: { draft_ja: "葉のふちが枯れるのは、日差しと風が強すぎるか、根が水を吸えていないことが多いです。", used_history_ja: null, check_ja: [] },
    ai_draft_status: "done", answer: null,
  },
];

const DEMO_ID = /^00000000-0000-4000-8000-0000000000\d\d$/;
store.consultations = store.consultations.filter((c) => !String(c.id).startsWith("demo-") && !DEMO_ID.test(String(c.id)));
store.consultations.unshift(...demo);
mkdirSync(path.dirname(FILE), { recursive: true });
writeFileSync(FILE, JSON.stringify(store, null, 2));
console.log(`見本の相談を ${demo.length} 件入れました → ${path.relative(HERE, FILE)}`);
