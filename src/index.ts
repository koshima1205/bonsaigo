import Anthropic from "@anthropic-ai/sdk";
import {
  LANGS, MEDIA, runArticle, runBrief, runHelp, runIntake, runKnowledge, runLetter, runShort, runTranslate, runWish, termIn,
  type Brief, type Intake, type Knowledge, type Letter,
} from "./claude";
import { demo, knowledgeByRules } from "./demo";
import { findTerms, SEED, type Term } from "./glossary";
import { SEED_ARTICLES, SEED_HITS, SEED_SHORTS, SEED_THREADS, SEED_VIEWS, SEED_WISHES, type Article, type Post, type Short, type Thread, type Wish } from "./seed";

interface Env {
  CONSULTS: KVNamespace;
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY?: string;
  MASTER_CODE?: string; // 職人さんの画面の合言葉。未設定なら手元の試しとして開ける
}

type Status = "intake" | "waiting" | "answered";

interface UsedTerm { ja: string; yomi: string; literal: string; rendered: string; why_ja: string; dialect?: boolean }
type CheckedLetter = Letter & { lines: (Letter["lines"][number] & { verbatim: boolean })[]; terms: UsedTerm[] };

interface Reply {
  master: string;
  status: "draft" | "sent";
  at: number;
  spoken_ja: string;
  phrases: string[];
  drawing?: string;
  letter: CheckedLetter;
}

interface Consult {
  id: string;
  created: number;
  status: Status;
  lang: string;
  city: string;
  month: number;
  question: string;
  photos: string[];
  intake: Intake;
  answers: Record<string, string>;
  brief?: Brief;
  replies: Reply[];
  knowledge?: Knowledge;
  article?: string;
  thanked?: boolean;
  demo: boolean;
  seed?: boolean;
}

const TTL = 60 * 60 * 24 * 30;
const LIMITS = { ai: 20, post: 30 };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

async function getJson<T>(env: Env, key: string): Promise<T | null> {
  return env.CONSULTS.get<T>(key, "json");
}
const putJson = (env: Env, key: string, v: unknown, ttl = true) =>
  env.CONSULTS.put(key, JSON.stringify(v), ttl ? { expirationTtl: TTL } : undefined);

async function list(env: Env, key: string): Promise<string[]> {
  return (await getJson<string[]>(env, key)) ?? [];
}
async function pushList(env: Env, key: string, id: string, max = 100) {
  const ids = [id, ...(await list(env, key)).filter((x) => x !== id)].slice(0, max);
  await env.CONSULTS.put(key, JSON.stringify(ids));
}

function isMaster(req: Request, env: Env) {
  return !!env.MASTER_CODE && req.headers.get("x-master-code") === env.MASTER_CODE;
}

// 公開しても API 料金が膨らまないよう、1日あたりの上限をかける
async function underLimit(req: Request, env: Env, bucket: keyof typeof LIMITS) {
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  const key = `rate:${bucket}:${new Date().toISOString().slice(0, 10)}:${ip}`;
  const n = Number((await env.CONSULTS.get(key)) ?? 0);
  if (n >= LIMITS[bucket]) return false;
  await env.CONSULTS.put(key, String(n + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}

// ---------- 用語集（見本＋職人さんが直した分） ----------
async function glossary(env: Env): Promise<Term[]> {
  const edits = (await getJson<Term[]>(env, "glossary")) ?? [];
  const byJa = new Map(SEED.map((t) => [t.ja, t]));
  for (const e of edits) byJa.set(e.ja, { ...byJa.get(e.ja), ...e });
  return [...byJa.values()];
}

const usedTerms = (words: string, terms: Term[], lang: string): UsedTerm[] =>
  findTerms(words, terms).map((t) => ({ ja: t.ja, yomi: t.yomi, literal: t.literal, rendered: termIn(t, lang), why_ja: t.why_ja, dialect: t.dialect }));

// 職人さんの言葉が「そのまま」引用されているかを、Claude 任せにせずこちらでも確かめる
const squash = (s: string) => s.replace(/[\s、。，．,.!！?？「」]/g, "");
function check(letter: Letter, words: string, terms: UsedTerm[]): CheckedLetter {
  const all = squash(words);
  return { ...letter, terms, lines: letter.lines.map((l) => ({ ...l, verbatim: all.includes(squash(l.quote_ja)) })) };
}

// ---------- 見本の相談（職人ふたりが答えたもの） ----------
function sampleConsult(): Consult {
  const A = "葉先が茶色いのは、室内に入れっぱなしで弱ってきてるんだと思います。松は寒さに当てて休ませる木なので、冬も外に出してください。ただ、鉢が凍るくらいの夜だけは、軒下になおしてください。";
  const B = "水やりは、土の表面が乾いてから、鉢の底から出るまでたっぷりと。肥料は今は止めてください。植え替えは春、芽が動き出す前にしてください。";
  const reply = (master: string, words: string, h: number): Reply => ({
    master, status: "sent", at: Date.UTC(2026, 10, 2, h), spoken_ja: words, phrases: [],
    letter: check(demo.letter(words, "en"), words, usedTerms(words, SEED, "en")),
  });
  const replies = [reply("職人A（見本）", A, 1), reply("職人B（見本）", B, 4)];
  return {
    id: "sample", created: Date.UTC(2026, 10, 1, 20), status: "answered", lang: "en", city: "Lyon, France", month: 11,
    question: "The needles are turning brown at the tips. Is it sick? Where should I keep it this winter?",
    photos: ["illust:pine:7"], intake: demo.intake("en"), answers: { place: "Indoors", repot: "2-3 years ago" }, brief: demo.brief(),
    replies, knowledge: knowledgeByRules(replies.flatMap((r) => r.letter.lines.map((l) => ({ master: r.master, quote_ja: l.quote_ja, text: l.text })))),
    article: "pine-brown-tips", demo: true, seed: true,
  };
}

async function loadConsult(env: Env, id: string): Promise<Consult | null> {
  if (id === "sample") return sampleConsult();
  const c = await getJson<Consult & { letter?: CheckedLetter; reply?: Omit<Reply, "letter" | "master" | "status" | "at"> }>(env, `c:${id}`);
  if (!c) return null;
  // 複数の職人さんに対応する前の形を読み替える
  if (!c.replies) {
    c.replies = c.letter && c.reply ? [{ master: "職人", status: c.status === "answered" ? "sent" : "draft", at: c.created, ...c.reply, letter: { ...c.letter, terms: c.letter.terms ?? [] } }] : [];
    if ((c.status as string) === "draft") c.status = "waiting";
  }
  return c;
}
const saveConsult = (env: Env, c: Consult) => putJson(env, `c:${c.id}`, c);

// 一覧に返すときは重いものを外す
const light = (c: Consult) => ({ ...c, photos: c.photos.slice(0, 1), replies: c.replies.map((r) => ({ ...r, drawing: undefined })) });
const forOwner = (c: Consult) => ({ ...c, replies: c.replies.filter((r) => r.status === "sent") });

async function buildKnowledge(client: Anthropic | null, c: Consult): Promise<Knowledge> {
  const lines = c.replies.filter((r) => r.status === "sent").flatMap((r) => r.letter.lines.map((l) => ({ master: r.master, quote_ja: l.quote_ja, text: l.text })));
  if (client && new Set(lines.map((l) => l.master)).size > 1) return runKnowledge(client, { lang: c.lang, question: c.question, lines });
  return knowledgeByRules(lines);
}

// ---------- 記事・ショート ----------
async function articles(env: Env, all: boolean): Promise<Article[]> {
  const mine = (await Promise.all((await list(env, "articles")).map((s) => getJson<Article>(env, `a:${s}`)))).filter((a): a is Article => !!a);
  const slugs = new Set(mine.map((a) => a.slug));
  return [...mine, ...SEED_ARTICLES.filter((a) => !slugs.has(a.slug))].filter((a) => all || a.status === "published");
}
async function getArticle(env: Env, slug: string) {
  return (await getJson<Article>(env, `a:${slug}`)) ?? SEED_ARTICLES.find((a) => a.slug === slug) ?? null;
}
async function shorts(env: Env, all: boolean): Promise<Short[]> {
  const mine = (await Promise.all((await list(env, "shorts")).map((s) => getJson<Short>(env, `s:${s}`)))).filter((s): s is Short => !!s);
  return [...mine, ...SEED_SHORTS].filter((s) => all || s.status === "approved");
}
const PLATFORMS = ["ig", "yt", "tt"] as const;
async function counter(env: Env, key: string) {
  return Number((await env.CONSULTS.get(key)) ?? 0);
}
// 数え損ねても記事やページの表示は止めない
async function bump(env: Env, key: string) {
  try { await env.CONSULTS.put(key, String((await counter(env, key)) + 1)); } catch {}
}
// 公開の場には元の相談の ID を出さない（見本の相談だけはつなぐ）
const pub = (a: Article) => ({ ...a, source: a.source === "sample" ? a.source : undefined, from_consult: !!a.source });
const IMG = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

// ---------- 掲示板・欲しい木 ----------
async function threads(env: Env): Promise<Thread[]> {
  const mine = (await Promise.all((await list(env, "board")).map((t) => getJson<Thread>(env, `t:${t}`)))).filter((t): t is Thread => !!t);
  return [...mine, ...SEED_THREADS];
}
async function wishes(env: Env): Promise<Wish[]> {
  const mine = (await getJson<Wish[]>(env, "wishes")) ?? [];
  const ids = new Set(mine.map((w) => w.id));
  return [...mine, ...SEED_WISHES.filter((w) => !ids.has(w.id))];
}

async function api(req: Request, env: Env, path: string[]): Promise<Response> {
  const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
  const [, , area, id, act] = path;
  const M = req.method;
  const master = isMaster(req, env);
  const body = async <T>() => ((await req.json().catch(() => ({}))) ?? {}) as T;
  const deny = () => json({ error: "code" }, 401);

  if (area === "config" && M === "GET") return json({ demo: !client, langs: Object.keys(LANGS), media: MEDIA });

  // ----- 用語集 -----
  if (area === "glossary") {
    if (M === "GET") return json(await glossary(env));
    if (M === "POST") {
      if (!master) return deny();
      const b = await body<Partial<Term> & { master?: string }>();
      const ja = str(b.ja, 30);
      if (!ja) return json({ error: "empty" }, 400);
      const cur = (await glossary(env)).find((t) => t.ja === ja);
      const t: Term = {
        ja, yomi: str(b.yomi ?? cur?.yomi, 40), literal: str(b.literal ?? cur?.literal, 80), meaning_ja: str(b.meaning_ja ?? cur?.meaning_ja, 200),
        why_ja: str(b.why_ja ?? cur?.why_ja, 200), en: str(b.en ?? cur?.en, 160), es: str(b.es ?? cur?.es, 160), zh: str(b.zh ?? cur?.zh, 160),
        dialect: b.dialect ?? cur?.dialect, forms: cur?.forms, edited_by: str(b.master, 40) || "職人", edited_at: Date.now(),
      };
      const edits = ((await getJson<Term[]>(env, "glossary")) ?? []).filter((e) => e.ja !== ja);
      await putJson(env, "glossary", [t, ...edits].slice(0, 300), false);
      return json(t);
    }
  }

  // ----- 職人さんの受け取り箱 -----
  if (area === "inbox" && M === "GET") {
    if (!master) return deny();
    const all = await Promise.all((await list(env, "inbox")).map((x) => loadConsult(env, x)));
    return json([sampleConsult(), ...all.filter((c): c is Consult => !!c && c.status !== "intake")].map(light));
  }

  // ----- 相談 -----
  if (area === "consults" && M === "POST" && !id) {
    if (!(await underLimit(req, env, "ai"))) return json({ error: "limit" }, 429);
    const b = await body<Partial<Consult>>();
    const lang = b.lang && LANGS[b.lang] ? b.lang : "en";
    const photos = (b.photos ?? []).filter((p) => typeof p === "string" && IMG.test(p) && p.length > 200 && p.length < 1_500_000).slice(0, 3);
    const question = str(b.question, 1200);
    const city = str(b.city, 80);
    if (!photos.length || !question) return json({ error: "photo_and_question" }, 400);
    const month = Number(b.month) || new Date().getMonth() + 1;
    const intake = client ? await runIntake(client, { photos, question, city, lang, month }) : demo.intake(lang);
    const c: Consult = { id: crypto.randomUUID().replace(/-/g, "").slice(0, 16), created: Date.now(), status: "intake", lang, city, month, question, photos, intake, answers: {}, replies: [], demo: !client };
    await saveConsult(env, c);
    return json(light(c));
  }

  if (area === "consults" && id) {
    const c = await loadConsult(env, id);
    if (!c) return json({ error: "not_found" }, 404);
    const isOwnerView = !req.headers.get("x-master-code") && !!env.MASTER_CODE;

    if (!act && M === "GET") return json(isOwnerView || !master ? forOwner(c) : c);
    if (c.seed && M === "POST") return json({ error: "sample" }, 409);

    if (act === "answers" && M === "POST" && c.status === "intake") {
      if (!(await underLimit(req, env, "ai"))) return json({ error: "limit" }, 429);
      const { answers } = await body<{ answers: Record<string, string> }>();
      c.answers = Object.fromEntries(Object.entries(answers ?? {}).slice(0, 5).map(([k, v]) => [str(k, 30), str(v, 200)]));
      c.brief = client ? await runBrief(client, c) : demo.brief();
      c.status = "waiting";
      await saveConsult(env, c);
      await pushList(env, "inbox", c.id, 50);
      return json(light(c));
    }

    if (act === "draft" && M === "POST") {
      if (!master) return deny();
      if (c.status === "intake") return json({ error: "state" }, 409);
      const b = await body<{ master: string; spoken_ja: string; phrases: string[]; drawing?: string }>();
      const name = str(b.master, 40) || "職人";
      const spoken_ja = str(b.spoken_ja, 3000);
      const phrases = (b.phrases ?? []).map((p) => str(p, 200)).slice(0, 10);
      if (!spoken_ja && !phrases.length) return json({ error: "empty" }, 400);
      const drawing = typeof b.drawing === "string" && b.drawing.startsWith("data:image/") && b.drawing.length < 1_500_000 ? b.drawing : undefined;
      const words = [spoken_ja, ...phrases].join("\n");
      const terms = usedTerms(words, await glossary(env), c.lang);
      const gl = (await glossary(env)).filter((t) => terms.some((u) => u.ja === t.ja));
      const letter = client
        ? await runLetter(client, { question: c.question, lang: c.lang, city: c.city, spoken_ja, phrases, drew: !!drawing, terms: gl })
        : demo.letter(words, c.lang);
      const r: Reply = { master: name, status: "draft", at: Date.now(), spoken_ja, phrases, drawing, letter: check(letter, words, terms) };
      c.replies = [...c.replies.filter((x) => !(x.master === name && x.status === "draft")), r];
      await saveConsult(env, c);
      return json({ consult: c, reply: r });
    }

    if (act === "send" && M === "POST") {
      if (!master) return deny();
      const { master: name } = await body<{ master: string }>();
      const r = c.replies.find((x) => x.master === (str(name, 40) || "職人") && x.status === "draft");
      if (!r) return json({ error: "state" }, 409);
      r.status = "sent";
      r.at = Date.now();
      c.status = "answered";
      c.knowledge = await buildKnowledge(client, c);
      await saveConsult(env, c);
      return json(light(c));
    }

    if (act === "thanks" && M === "POST" && c.status === "answered") {
      c.thanked = true;
      await saveConsult(env, c);
      return json({ ok: true });
    }

    // 相談 → 記事の下書き
    if (act === "article" && M === "POST") {
      if (!master) return deny();
      const sent = c.replies.filter((r) => r.status === "sent");
      if (!sent.length) return json({ error: "state" }, 409);
      const replies = sent.map((r) => ({ master: r.master, quote: [r.spoken_ja, ...r.phrases].filter(Boolean).join("") }));
      const terms = (await glossary(env)).filter((t) => replies.some((r) => r.quote.includes(t.ja)));
      const out = client
        ? await runArticle(client, { question: c.question, city: c.city, brief: c.brief, replies, terms })
        : demo.article({ question: c.question, city: c.city, tree_ja: c.brief?.tree_ja ?? "盆栽", replies });
      const slug = `${out.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "consult"}-${newId().slice(0, 4)}`;
      const a: Article = { ...out, slug, created: Date.now(), status: "draft", source: c.id, cover: c.photos[0], demo: !client };
      await putJson(env, `a:${slug}`, a, false);
      await pushList(env, "articles", slug, 200);
      c.article = slug;
      await saveConsult(env, c);
      return json(a);
    }
  }

  // ----- 記事 -----
  if (area === "articles") {
    const all = master && new URL(req.url).searchParams.get("all") === "1";
    if (!id && M === "GET") {
      const [arts, sh] = await Promise.all([articles(env, all), shorts(env, all)]);
      const views = await Promise.all(arts.map((a) => counter(env, `v:${a.slug}`)));
      return json(arts.map((a, i) => ({ ...(master ? a : pub(a)), sections: undefined, views: views[i] + (SEED_VIEWS[a.slug] ?? 0), shorts: sh.filter((s) => s.slug === a.slug).length })).sort((x, y) => y.created - x.created));
    }
    const a = id ? await getArticle(env, id) : null;
    if (!a) return json({ error: "not_found" }, 404);
    if (!act && M === "GET") {
      if (a.status !== "published" && !master) return json({ error: "not_found" }, 404);
      if (a.status === "published" && !new URL(req.url).searchParams.has("noview")) await bump(env, `v:${a.slug}`);
      return json(master ? a : pub(a));
    }
    if (!master) return deny();
    if (act === "publish" && M === "POST") {
      if (a.seed) return json({ error: "sample" }, 409);
      a.status = "published";
      await putJson(env, `a:${a.slug}`, a, false);
      return json(a);
    }
    if (act === "short" && M === "POST") {
      const out = client ? await runShort(client, a) : demo.short(a);
      const s: Short = { ...out, id: `s-${newId().slice(0, 8)}`, slug: a.slug, created: Date.now(), status: "draft", demo: !client };
      await putJson(env, `s:${s.id}`, s, false);
      await pushList(env, "shorts", s.id, 200);
      return json(s);
    }
  }

  // ----- ショート -----
  if (area === "shorts") {
    const all = master && new URL(req.url).searchParams.get("all") === "1";
    if (!id && M === "GET") {
      const sh = await shorts(env, all);
      const hits = await Promise.all(sh.flatMap((s) => PLATFORMS.map((p) => counter(env, `h:${s.id}-${p}`))));
      return json(sh.map((s, i) => ({ ...s, hits: Object.fromEntries(PLATFORMS.map((p, j) => [p, hits[i * 3 + j] + (SEED_HITS[`${s.id}-${p}`] ?? 0)])) })).sort((x, y) => y.created - x.created));
    }
    if (id && act === "approve" && M === "POST") {
      if (!master) return deny();
      const s = await getJson<Short>(env, `s:${id}`);
      if (!s) return json({ error: "not_found" }, 404);
      if ((await getArticle(env, s.slug))?.status !== "published") return json({ error: "article_not_published" }, 409);
      s.status = "approved";
      await putJson(env, `s:${id}`, s, false);
      return json(s);
    }
  }

  // ----- 計測（ショートのリンクから来た人を数える） -----
  if (area === "hit" && M === "POST") {
    const { src } = await body<{ src: string }>();
    const m = /^(s-[a-z0-9]{2,12})-(ig|yt|tt)$/.exec(String(src ?? ""));
    if (!m) return json({ error: "bad" }, 400);
    if (!SEED_SHORTS.some((s) => s.id === m[1]) && !(await env.CONSULTS.get(`s:${m[1]}`))) return json({ error: "not_found" }, 404);
    await bump(env, `h:${m[0]}`);
    return json({ ok: true });
  }

  // ----- 掲示板 -----
  if (area === "board") {
    if (!id && M === "GET") return json((await threads(env)).map((t) => ({ ...t, posts: t.posts.slice(0, 1), count: t.posts.length })).sort((a, b) => b.created - a.created));
    if (!id && M === "POST") {
      if (!(await underLimit(req, env, "post"))) return json({ error: "limit" }, 429);
      const b = await body<{ title: string; body: string; name: string; lang: string }>();
      const t: Thread = { id: `t-${newId()}`, title: str(b.title, 120), created: Date.now(), posts: [{ name: str(b.name, 40) || "Guest", lang: str(b.lang, 5) || "en", body: str(b.body, 2000), created: Date.now() }] };
      if (!t.title || !t.posts[0].body) return json({ error: "empty" }, 400);
      await putJson(env, `t:${t.id}`, t);
      await pushList(env, "board", t.id, 200);
      return json(t);
    }
    const t = id ? ((await getJson<Thread>(env, `t:${id}`)) ?? SEED_THREADS.find((x) => x.id === id) ?? null) : null;
    if (!t) return json({ error: "not_found" }, 404);
    if (!act && M === "GET") return json(t);
    if (act === "posts" && M === "POST") {
      if (t.seed) return json({ error: "sample" }, 409);
      if (!(await underLimit(req, env, "post"))) return json({ error: "limit" }, 429);
      const b = await body<{ body: string; name: string; lang: string }>();
      const p: Post = { name: str(b.name, 40) || "Guest", lang: str(b.lang, 5) || "en", body: str(b.body, 2000), created: Date.now(), master: !!req.headers.get("x-master-code") && master };
      if (!p.body) return json({ error: "empty" }, 400);
      t.posts.push(p);
      await putJson(env, `t:${t.id}`, t);
      return json(t);
    }
    if (act === "translate" && M === "POST") {
      const { i, lang } = await body<{ i: number; lang: string }>();
      const p = t.posts[Number(i)];
      if (!p) return json({ error: "not_found" }, 404);
      if (p.tr?.[lang]) return json({ text: p.tr[lang] });
      if (!client) return json({ text: null, demo: true });
      if (!(await underLimit(req, env, "ai"))) return json({ error: "limit" }, 429);
      const { text } = await runTranslate(client, p.body, lang);
      p.tr = { ...p.tr, [lang]: text };
      if (!t.seed) await putJson(env, `t:${t.id}`, t);
      return json({ text });
    }
  }

  // ----- 職人さんの前の窓口（AI） -----
  if (area === "help" && M === "POST") {
    const b = await body<{ q: string; lang: string }>();
    const q = str(b.q, 500);
    const lang = ["ja", ...Object.keys(LANGS)].includes(b.lang) ? b.lang : "en";
    if (!q) return json({ error: "empty" }, 400);
    if (!(await underLimit(req, env, "ai"))) return json({ error: "limit" }, 429);
    const [terms, arts] = await Promise.all([glossary(env), articles(env, false)]);
    const full = (await Promise.all(arts.map((a) => getArticle(env, a.slug)))).filter((a): a is Article => !!a);
    return json({ ...(client ? await runHelp(client, { q, lang, terms, articles: full }) : demo.help(q, lang, terms, full)), demo: !client });
  }

  // ----- 欲しい木 -----
  if (area === "wishes") {
    if (!id && M === "GET") return json(await wishes(env));
    if (!id && M === "POST") {
      if (!(await underLimit(req, env, "post"))) return json({ error: "limit" }, 429);
      if (client && !(await underLimit(req, env, "ai"))) return json({ error: "limit" }, 429);
      const b = await body<{ text: string; country: string }>();
      const text = str(b.text, 600);
      const country = str(b.country, 60);
      if (!text) return json({ error: "empty" }, 400);
      const parsed = client ? await runWish(client, text, country) : demo.wish(text);
      const w: Wish = { id: `w-${newId()}`, created: Date.now(), text, country, parsed, raised: [] };
      const mine = (await getJson<Wish[]>(env, "wishes")) ?? [];
      await putJson(env, "wishes", [w, ...mine].slice(0, 200), false);
      return json(w);
    }
    if (id && act === "raise" && M === "POST") {
      if (!master) return deny();
      const { master: name } = await body<{ master: string }>();
      const all = await wishes(env);
      const w = all.find((x) => x.id === id);
      if (!w) return json({ error: "not_found" }, 404);
      const who = str(name, 40) || "職人";
      w.raised = w.raised.includes(who) ? w.raised.filter((x) => x !== who) : [...w.raised, who];
      const mine = ((await getJson<Wish[]>(env, "wishes")) ?? []).filter((x) => x.id !== id);
      await putJson(env, "wishes", [w, ...mine].slice(0, 200), false);
      return json(w);
    }
  }

  return json({ error: "not_found" }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    try {
      return await api(req, env, url.pathname.split("/"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      if (msg === "refusal") return json({ error: "refusal" }, 422);
      if (e instanceof Anthropic.APIError) return json({ error: "claude", status: e.status }, 502);
      console.error(e);
      return json({ error: "server" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
