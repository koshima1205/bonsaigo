// Claude が受け持つ仕事。
// どれも「職人さんの代わりに答える」ことはしない。聞き返す・まとめる・訳す・並べる・整えるだけ。
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Term } from "./glossary";
import type { Article, Short } from "./seed";

const MODEL = "claude-opus-5-5";

// 手紙の言語（持ち主が選ぶ）
export const LANGS: Record<string, string> = {
  en: "English",
  es: "Spanish",
  zh: "Simplified Chinese",
  fr: "French",
  de: "German",
  it: "Italian",
  easy: "Easy Japanese (やさしい日本語: short sentences, basic words, for non-native readers)",
};
// メディアの言語
export const MEDIA = ["ja", "easy", "en", "es", "zh"] as const;
export const termIn = (t: Term, lang: string) => (lang === "es" ? t.es : lang === "zh" ? t.zh : lang === "easy" || lang === "ja" ? t.meaning_ja : t.en);

const ML = z.object({
  ja: z.string(),
  easy: z.string().describe("やさしい日本語"),
  en: z.string(),
  es: z.string(),
  zh: z.string().describe("Simplified Chinese"),
});

// ---------- 1. 受け付け：足りない情報を聞き返す ----------
export const Intake = z.object({
  tree_guess: z.string().describe("Likely species in the owner's language, hedged (e.g. 'Looks like a Japanese black pine'). Empty if unsure."),
  followups: z
    .array(z.object({ id: z.string(), question: z.string().describe("In the owner's language"), options: z.array(z.string()).describe("2-4 short tap answers in the owner's language") }))
    .describe("At most 3 questions a bonsai master would need answered before advising"),
  climate_owner: z.string().describe("One line about the typical climate in the owner's city this month, owner's language"),
  climate_ja: z.string().describe("同じ気候を日本の地域と季節に言い換えた一文（例：日本でいうと11月の東北くらい）"),
});
export type Intake = z.infer<typeof Intake>;

// ---------- 2. 職人さん向けのまとめ ----------
export const Brief = z.object({
  summary_ja: z.array(z.string()).describe("職人さんに見せる要約。やさしい日本語で3行まで"),
  asked_ja: z.string().describe("聞かれていることを一文で"),
  facts_ja: z.array(z.object({ label: z.string(), value: z.string() })).describe("置き場所・最後の植え替え・水やりなど、持ち主の答えから分かった事実だけ"),
  tree_ja: z.string().describe("樹種の見立て（推定と分かる書き方）"),
});
export type Brief = z.infer<typeof Brief>;

// ---------- 3. 職人さんの言葉を手入れの手紙に ----------
export const Letter = z.object({
  greeting: z.string().describe("Short opening line in the owner's language, written as from the master"),
  lines: z
    .array(
      z.object({
        quote_ja: z.string().describe("職人さんの言葉からそのまま抜き出した部分。言い換えない"),
        text: z.string().describe("Faithful translation of quote_ja into the owner's language, using the glossary meanings. No added advice."),
        back_ja: z.string().describe("text を日本語に訳し戻したもの（職人さんが確かめる用）"),
      }),
    )
    .describe("One entry per piece of advice the master actually gave"),
  reminders: z.array(z.object({ month: z.number().int().min(1).max(12), text: z.string(), quote_ja: z.string() })).describe("Only when the master mentioned a timing (e.g. 'repot in spring'). Month in the owner's hemisphere."),
  unclear_ja: z.array(z.string()).describe("訳しにくかった言い回し・あいまいな所。職人さんに確かめてほしい点"),
});
export type Letter = z.infer<typeof Letter>;

// ---------- 4. 何人もの答えを、軸ごとに並べる ----------
export const Knowledge = z.object({
  axes: z.array(
    z.object({
      key: z.enum(["diagnosis", "place", "water", "feed", "repot", "prune", "other"]),
      items: z.array(z.object({ master: z.string(), quote_ja: z.string().describe("copied exactly"), text: z.string().describe("translation in the owner's language") })),
    }),
  ),
  agree_ja: z.string().describe("職人さんたちの言うことが一致している点（一文）。なければ空"),
  differ_ja: z.string().describe("言うことが分かれている点（一文）。なければ空"),
});
export type Knowledge = z.infer<typeof Knowledge>;

// ---------- 5. 相談から記事を ----------
const ArticleOut = z.object({
  slug: z.string().describe("short lowercase english slug with hyphens"),
  tree: ML,
  title: ML,
  lead: ML,
  sections: z.array(z.object({ heading: ML, body: ML, quote_ja: z.string().describe("該当する職人さんの言葉をそのまま。なければ空"), master: z.string() })),
  tags: z.array(z.string()),
});

// ---------- 6. 記事からショートを ----------
const ShortOut = z.object({
  hook_ja: z.string(),
  hook_en: z.string(),
  scenes: z.array(z.object({ sec: z.number().int().min(2).max(6), visual: z.enum(["title", "tree", "photo", "quote", "cta"]), text_ja: z.string().describe("15文字くらいまで"), text_en: z.string().describe("max ~70 characters") })).describe("4-6 scenes, 18-28 seconds total, vertical video"),
  captions: z.object({
    instagram: z.object({ text: z.string(), hashtags: z.array(z.string()) }),
    youtube: z.object({ title: z.string(), text: z.string(), hashtags: z.array(z.string()) }),
    tiktok: z.object({ text: z.string(), hashtags: z.array(z.string()) }),
  }),
});

// ---------- 7. 職人さんの前の窓口 ----------
export const Help = z.object({
  answer: z.string().describe("In the asker's language. Only from the provided glossary and articles."),
  sources: z.array(z.string()).describe("slugs of articles or glossary terms (ja) you used"),
  handoff: z.boolean().describe("true if the question is about this person's specific tree (health, what to do now) and needs a master"),
});
export type Help = z.infer<typeof Help>;

// ---------- 8. 欲しい木 ----------
export const WishOut = z.object({
  species: z.string().describe("日本語の樹種名。不明なら空"),
  size: z.string().describe("日本語（小品・中品など）"),
  style: z.string().describe("日本語（樹形・好み）"),
  budget: z.string().describe("日本語（例：約300ユーロ）"),
  summary_ja: z.string().describe("職人さん向けに一文で"),
  summary_en: z.string(),
});

const Translated = z.object({ text: z.string() });

const RULES = `You work inside Engawa, a bonsai media and consultation service that connects bonsai owners abroad with bonsai masters in Japan.
You never give bonsai care advice of your own. Diagnosis and advice come only from the masters' own words.
Your jobs: ask the owner for missing facts, summarise for the master in plain Japanese, translate the master's words faithfully (by meaning, using the glossary, never word-for-word), and arrange the masters' words into articles, short-video scripts and captions without adding advice.`;

function photosToBlocks(photos: string[]): Anthropic.Beta.BetaImageBlockParam[] {
  return photos
    .filter((p) => p.startsWith("data:image/"))
    .slice(0, 3)
    .map((url) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: url.replace(/^data:image\/\w+;base64,/, "") } }));
}

async function ask<T extends z.ZodType>(client: Anthropic, schema: T, effort: "low" | "medium", content: Anthropic.Beta.BetaContentBlockParam[]): Promise<z.infer<T>> {
  const res = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: RULES,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("refusal");
  if (!res.parsed_output) throw new Error("no_output");
  return res.parsed_output as z.infer<T>;
}

const glossLines = (terms: Term[], lang: string) =>
  terms.map((t) => `- ${t.ja}${t.dialect ? "（方言・職人ことば）" : ""}: means "${termIn(t, lang)}" — NOT the literal "${t.literal}"`).join("\n");

export async function runIntake(client: Anthropic, c: { photos: string[]; question: string; city: string; lang: string; month: number }): Promise<Intake> {
  return ask(client, Intake, "low", [
    ...photosToBlocks(c.photos),
    {
      type: "text",
      text: `An owner in ${c.city} (month ${c.month}) wrote, in ${LANGS[c.lang]}:\n"""${c.question}"""\n
Look at the photos. Decide what a bonsai master would still need to know before answering (for example: indoors or outdoors, last repotting, watering, recent changes).
Ask at most 3 short questions with tap answers. Do not answer the question yourself. Write owner-facing text in ${LANGS[c.lang]}.`,
    },
  ]);
}

export async function runBrief(client: Anthropic, c: { photos: string[]; question: string; city: string; lang: string; intake: Intake; answers: Record<string, string> }): Promise<Brief> {
  const qa = c.intake.followups.map((f) => `- ${f.question} → ${c.answers[f.id] ?? "(no answer)"}`).join("\n");
  return ask(client, Brief, "low", [
    ...photosToBlocks(c.photos),
    {
      type: "text",
      text: `持ち主（${c.city}）の相談を、日本の盆栽職人さんに渡すためにまとめてください。
相談文: """${c.question}"""
聞き返しと答え:
${qa}
気候: ${c.intake.climate_ja}

職人さんはスマホが得意ではありません。短く、やさしい日本語で。カタカナ語は避ける。あなたの見立てや助言は書かない。`,
    },
  ]);
}

export async function runLetter(
  client: Anthropic,
  c: { question: string; lang: string; city: string; spoken_ja: string; phrases: string[]; drew: boolean; terms: Term[] },
): Promise<Letter> {
  const words = [c.spoken_ja, ...c.phrases].filter(Boolean).join("\n");
  return ask(client, Letter, "medium", [
    {
      type: "text",
      text: `The owner (${c.city}) asked: """${c.question}"""
The master answered in Japanese:
"""${words}"""
${c.drew ? "The master also drew marks on the photo; refer to 'the marks on your photo' where the master points at something." : ""}
${c.terms.length ? `Glossary — these words in the master's answer must be translated by their meaning in bonsai (and regional speech), not literally:\n${glossLines(c.terms, c.lang)}` : ""}

Turn this into a care letter in ${LANGS[c.lang]}.
- quote_ja must be copied exactly from the master's words.
- Translate faithfully by meaning. Keep the master's tone. Do not add, soften or extend advice.
- Add reminders only for timings the master actually said, converted to the owner's hemisphere.
- List anything ambiguous in unclear_ja so the master can check it.`,
    },
  ]);
}

export async function runKnowledge(client: Anthropic, c: { lang: string; question: string; lines: { master: string; quote_ja: string; text: string }[] }): Promise<Knowledge> {
  return ask(client, Knowledge, "low", [
    {
      type: "text",
      text: `Several bonsai masters answered the same question: """${c.question}"""
Their statements (already translated into ${LANGS[c.lang]}):
${c.lines.map((l) => `- [${l.master}] ${l.quote_ja} => ${l.text}`).join("\n")}

Group every statement under one axis (diagnosis, place, water, feed, repot, prune, other). Copy quote_ja and text exactly; do not merge or rewrite them.
Then say in one Japanese sentence where the masters agree and where they differ. Do not judge who is right.`,
    },
  ]);
}

export async function runArticle(
  client: Anthropic,
  c: { question: string; city: string; brief?: Brief; replies: { master: string; quote: string }[]; terms: Term[] },
): Promise<Omit<Article, "created" | "status" | "cover">> {
  const out = await ask(client, ArticleOut, "medium", [
    {
      type: "text",
      text: `Write a short media article for Engawa, a multilingual bonsai media site, from this consultation.
Owner in ${c.city} asked: """${c.question}"""
${c.brief ? `Facts: ${c.brief.facts_ja.map((f) => `${f.label}=${f.value}`).join(", ")}; tree: ${c.brief.tree_ja}` : ""}
The masters answered (Japanese, exact):
${c.replies.map((r) => `- [${r.master}] ${r.quote}`).join("\n")}
${c.terms.length ? `Glossary (translate by meaning):\n${glossLines(c.terms, "en")}` : ""}

Structure: 1 section for the question, 1 section per master (quote_ja = that master's words copied exactly; body = faithful translation in each language, in quotation marks), 1 closing section that lays the answers side by side without judging.
All text in ja, easy (やさしい日本語), en, es, zh. Do not add any advice that the masters did not give. Keep it calm and dignified.`,
    },
  ]);
  return { ...out, sections: out.sections.map((s) => ({ ...s, quote_ja: s.quote_ja || undefined })) };
}

export async function runShort(client: Anthropic, a: Article): Promise<Pick<Short, "hook_ja" | "hook_en" | "scenes" | "captions">> {
  return ask(client, ShortOut, "low", [
    {
      type: "text",
      text: `Make a vertical short-video script (Instagram Reels / YouTube Shorts / TikTok) that sends viewers to this article on our bonsai media site.
Title: ${a.title.en} / ${a.title.ja}
Lead: ${a.lead.en}
Sections:
${a.sections.map((s) => `- ${s.heading.en}: ${s.body.en}${s.quote_ja ? ` (master's words: ${s.quote_ja})` : ""}`).join("\n")}

- Scene 1 is a hook that stops the scroll. Use "quote" scenes for the masters' own words (shortened, never changed in meaning). End with a "cta" scene.
- Captions differ by platform: Instagram (warm, "link in bio"), YouTube (searchable title), TikTok (casual, short).
- Only facts and words in the article. No new advice.`,
    },
  ]);
}

export async function runHelp(client: Anthropic, c: { q: string; lang: string; terms: Term[]; articles: Article[] }): Promise<Help> {
  const L = c.lang === "ja" ? "Japanese" : (LANGS[c.lang] ?? "English");
  return ask(client, Help, "low", [
    {
      type: "text",
      text: `You are the front desk of Engawa, before a question goes to a master. Answer in ${L}.
Use ONLY this material. If it doesn't cover the question, say so briefly.
If the person describes their own tree's condition or asks what to do with it now, set handoff=true and suggest asking a master instead of answering.

Glossary:
${c.terms.map((t) => `- ${t.ja} (${t.yomi}): ${t.meaning_ja} / ${t.en}. ${t.why_ja}`).join("\n")}

Articles:
${c.articles.map((a) => `[${a.slug}] ${a.title.en}\n${a.sections.map((s) => s.body.en).join("\n")}`).join("\n\n")}

Question: """${c.q}"""`,
    },
  ]);
}

export async function runWish(client: Anthropic, text: string, country: string) {
  return ask(client, WishOut, "low", [{ type: "text", text: `A bonsai lover in ${country} wrote what tree they want to own:\n"""${text}"""\nStructure it for Japanese bonsai gardens. Do not invent details.` }]);
}

export async function runTranslate(client: Anthropic, text: string, lang: string) {
  const L = lang === "ja" ? "Japanese" : (LANGS[lang] ?? "English");
  return ask(client, Translated, "low", [{ type: "text", text: `Translate this message from a bonsai community board into ${L}. Faithful, natural, keep the tone.\n"""${text}"""` }]);
}
