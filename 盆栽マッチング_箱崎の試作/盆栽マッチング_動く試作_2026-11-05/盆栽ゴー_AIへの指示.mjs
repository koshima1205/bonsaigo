// 盆栽ゴー：足した AI の仕事（2026-11-08）
// 確かめ3つ（画像・文・逆翻訳）は Haiku で、確かさ confidence（0〜1）を必ず返させる。
// 木の投稿は Sonnet で、8つの言葉を一度に書く。

const str = { type: "string" };
const strs = { type: "array", items: str };
const num = { type: "number" };
const bool = { type: "boolean" };
const nullableStr = { type: ["string", "null"] };
const obj = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

export const LANGS8 = ["ja", "en", "es", "zh", "fr", "it", "th", "km"];
const eight = obj(Object.fromEntries(LANGS8.map((l) => [l, str])));

const CONFIDENCE = `- confidence: a number from 0 to 1 for how sure you are of your verdict. Use 0.9 or more only when it is obvious. If the image is small, dark, cropped, or you are guessing, go below 0.8; a person will then check it, which is the safe outcome.`;

export const BONSAIGO_TASKS = {
  // 画像の確かめ（投稿の前・1段目）
  checkImage: {
    effort: "low",
    instruction: `You check one photo before it is posted on BonsaiGO's official X and Instagram. You only judge; you write no post.
Fail the photo (ok=false) if any of these is true: it does not show a bonsai or a potted tree; a person's face can be recognised; it shows readable personal information (names, addresses, phone numbers, car plates, screens); it shows anything violent, sexual, or unrelated to bonsai.
- ok: true only if none of the above.
- is_bonsai: whether a bonsai or potted tree is the main subject.
- reason_ja and reason_en: one short sentence each. If ok, say what you see.
- reasons: the same sentence in each of the 8 languages (ja, en, es, zh, fr, it, th, km), so the app can show it in the user's language.
${CONFIDENCE}`,
    schema: obj({ ok: bool, is_bonsai: bool, confidence: num, reason_ja: str, reason_en: str, reasons: eight }),
  },

  // 文の確かめ（投稿の前・2段目）
  checkPostText: {
    effort: "low",
    instruction: `You check post text before it is posted on BonsaiGO's official accounts. The text is in <user_input>. Judge only; do not rewrite.
Fail it (ok=false) if it: states an age, price, award, lineage, or famous owner that the craftsperson's note does not support; promises results ("never dies", "guaranteed"); includes contact details, prices, or a person's full name; uses a bonsai term in a way that contradicts the glossary; or says anything that could embarrass the craftsperson.
- problems_ja and problems_en: one short sentence per problem. Empty if ok.
- problems_by_lang: all problems as one short paragraph in each of the 8 languages (ja, en, es, zh, fr, it, th, km). Empty strings if ok.
${CONFIDENCE}`,
    schema: obj({ ok: bool, confidence: num, problems_ja: strs, problems_en: strs, problems_by_lang: eight }),
  },

  // 逆翻訳の確かめ（答えを送る前）。元の reviewAnswer に確かさを足したもの
  reviewAnswer: {
    effort: "low",
    instruction: `You are a second reader who protects the craftsperson's reputation. Compare their original Japanese words with the rewrite for the asker and with its back-translation into Japanese. Look for: advice they did not give, changed meaning or certainty, dropped instructions, and a mistranslated term. A short "why" drawn from the glossary is allowed.
- ok: true only if nothing needs changing.
- problems_ja: each problem in one plain Japanese sentence. Empty if ok.
- corrected_headline, corrected_paragraphs, corrected_back_translation_ja: the fixed version, keeping the [[shown words|headword]] marks. Null if ok.
${CONFIDENCE}`,
    schema: obj({
      ok: bool,
      confidence: num,
      problems_ja: strs,
      corrected_headline: nullableStr,
      corrected_paragraphs: { type: ["array", "null"], items: str },
      corrected_back_translation_ja: nullableStr,
    }),
  },

  // 木を登録 → 8つの言葉の投稿
  treePosts: {
    effort: "medium",
    instruction: `A bonsai craftsperson photographed one tree and gave its species, age, and maybe a few spoken words. Write one short post about this tree for BonsaiGO's official X and Instagram, in 8 languages: ja, en, es, zh, fr, it, th, km.
- Open with what is striking and visible in this tree. Then one line on the craft behind it, using a glossary term if the note supports it, with the Japanese term kept in romaji in the non-Japanese versions.
- Use only the species, age, and note given. Do not add history, awards, owners, prices, or the craftsperson's name.
- x: under 240 characters per language, with 2 or 3 hashtags. instagram: 2 to 4 short sentences, then 3 to 5 hashtags.
- Write natively in each language; the meaning must be the same in all 8.
- title_ja: a short title for the craftsperson's list.
- terms_ja: glossary headwords (exact "ja" values) you used.`,
    schema: obj({ title_ja: str, x: eight, instagram: eight, terms_ja: strs }),
  },
};

// AI を呼ばない、決まりの確かめ（毎回・料金ゼロ）。AI の確かめの前に通す
const RULES = [
  { code: "words", re: /人間国宝|後継ぎ不足|後継者不足|living national treasure/i, ja: "使わないと決めた言い方が入っています", en: "Uses wording we decided not to use" },
  { code: "price", re: /[¥$€£]\s?\d|\d+\s?(円|万円|ドル|dollars?|usd|eur)/i, ja: "値段が入っています", en: "Includes a price" },
  { code: "contact", re: /[\w.+-]+@[\w-]+\.[\w.]+|https?:\/\/|\b0\d{1,4}-\d{1,4}-\d{3,4}\b/i, ja: "連絡先やリンクが入っています", en: "Includes contact details or a link" },
  { code: "promise", re: /絶対に枯れない|ne meurt jamais|non muore mai|nunca muere|永远不会枯|ไม่มีวันตาย|ធានាថាមិនងាប់|必ず(育つ|枯れない)|guaranteed|never dies/i, ja: "言い切れないことを約束しています", en: "Promises something no one can promise" },
];
export function ruleCheck(texts) {
  const all = texts.join("\n");
  const hit = RULES.filter((r) => r.re.test(all));
  return { ok: hit.length === 0, codes: hit.map((r) => r.code), problems_ja: hit.map((r) => r.ja), problems_en: hit.map((r) => r.en) };
}
