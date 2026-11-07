// 盆栽マッチング 小さなサーバー（2026-11-05）
// 画面を配り、AIにつなぎ、相談と投稿を手元のファイルに残す。
//
// AIのつなぎ方（起動のときに1つ決まる）
//   ANTHROPIC_API_KEY がある          → Claude API（使った分の料金がかかる）
//   AI_MODE=claude-code を付けて起動  → この端末の Claude Code（ログイン済みの枠を使う）
//   どちらもない                      → 見本の答え（AIは動かない。画面にそう出す）

import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promises as fs, readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomUUID, randomBytes, createHmac, createHash, timingSafeEqual } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import Anthropic from "@anthropic-ai/sdk";
import { COMMON, TASKS, glossaryForPrompt, langName } from "./AIへの指示と答えの形.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const MODEL = process.env.BONSAI_MODEL || "claude-opus-5-5";
const DATA_FILE = process.env.BONSAI_DATA || path.join(HERE, "データ", "保存データ.json");
const MAX_BODY = 20 * 1024 * 1024;
const MAX_IMAGES = 6;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const GLOSSARY = JSON.parse(readFileSync(path.join(HERE, "用語集.json"), "utf8"));
const GLOSSARY_WORDS = new Set(GLOSSARY.map((t) => t.ja));
const GLOSSARY_TEXT = glossaryForPrompt(GLOSSARY);
const RECORDED = existsSync(path.join(HERE, "見本の答え.json"))
  ? JSON.parse(readFileSync(path.join(HERE, "見本の答え.json"), "utf8"))
  : {};

const MODE = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
  ? "claude-api"
  : process.env.AI_MODE === "claude-code" ? "claude-code" : "sample";

/* ---------- 料金（すべて見せるためのサンプル。決済はしない） ---------- */
const OFFERS = [
  { id: "one_question", usd: 25, ja: "1回の相談", en: "One question", es: "Una consulta", zh: "单次咨询" },
  { id: "video_lesson", usd: 60, ja: "動画の教室", en: "Video lesson", es: "Clase en vídeo", zh: "视频课" },
  { id: "monthly", usd: 80, ja: "月の見守り", en: "Monthly guidance", es: "Guía mensual", zh: "每月指导" },
];
const CRAFTSPERSON_SHARE = 0.8;

const SAMPLE_TEACHERS = [
  { id: "s1", name_ja: "松風 清", name_en: "Kiyoshi Matsukaze", specialty_ja: ["黒松", "五葉松", "真柏"], can_teach_ja: ["松の水やりと置き場所", "針金かけ", "写真に線を引いて枝の見立てを伝える"], bio_en: "Has cared for black pines for over 40 years. Prefers drawing on your photo to long sentences.", offers: ["one_question", "video_lesson", "monthly"] },
  { id: "s2", name_ja: "楓 ゆき", name_en: "Yuki Kaede", specialty_ja: ["もみじ", "ボケ", "皐月"], can_teach_ja: ["季節の木の水やりと置き場所", "もみじの葉刈り", "花ものの手入れ"], bio_en: "Specializes in seasonal trees: maples, quince, azalea. Known for clear advice on watering and placement.", offers: ["one_question", "video_lesson"] },
  { id: "s3", name_ja: "岩井 正道", name_en: "Masamichi Iwai", specialty_ja: ["石付き", "真柏", "ジン・シャリ"], can_teach_ja: ["石を山に見立てる石付き", "枯れた部分（ジン・シャリ）の仕立て"], bio_en: "Builds landscapes where the stone becomes a mountain cliff. Junipers and deadwood are the strength.", offers: ["one_question", "monthly"] },
];

// 木を探している人（見せるためのサンプル。実在の人ではない）
const SAMPLE_WANTED = [
  { id: "w1", overseas: true, ja: "アメリカの方：針金の仕事を学べる小さな木を探しています", detail: "small tree with visible wiring to learn from, buyer in the USA" },
  { id: "w2", overseas: true, ja: "ドイツの方：動きのある幹の小さな木を探しています", detail: "small tree with a trunk that has movement, buyer in Germany" },
  { id: "w3", overseas: false, ja: "日本の方：紅葉を楽しめるもみじを探しています", detail: "maple with autumn color, buyer in Japan" },
];

/* ---------- 保存（手元の1ファイル） ---------- */
let store = { consultations: [], feed: [], teachers: [], trees: [] };
try { store = { ...store, ...JSON.parse(await fs.readFile(DATA_FILE, "utf8")) }; } catch (e) { if (e.code !== "ENOENT") throw e; }
// ログインの印に署名する鍵。保存データの中に1回だけ作る（GitHubには上げないファイル）
if (!store.session_secret) store.session_secret = randomBytes(32).toString("hex");
if (!store.ai_usage) store.ai_usage = { day: "", total: 0, by_user: {} };
let saving = Promise.resolve();
function save() {
  saving = saving.then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store));
    await fs.rename(tmp, DATA_FILE);
  });
  return saving;
}

/* ---------- AIを呼ぶ ---------- */
class AiUnavailable extends Error {}

// 鍵が「ワークスペース」に属していないときは、使うワークスペースの番号（ANTHROPIC_WORKSPACE_ID）を一緒に送る
const WORKSPACE_ID = (process.env.ANTHROPIC_WORKSPACE_ID || "").trim();
const client = MODE === "claude-api"
  ? new Anthropic(WORKSPACE_ID ? { defaultHeaders: { "anthropic-workspace-id": WORKSPACE_ID } } : {})
  : null;

async function callClaudeApi(task, text, images) {
  const content = [...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })), { type: "text", text }];
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: `${COMMON}\n\n${GLOSSARY_TEXT}`, cache_control: { type: "ephemeral" } },
        { type: "text", text: task.instruction },
      ],
      output_config: { effort: task.effort, format: { type: "json_schema", schema: task.schema } },
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    // うまくいかなかった理由をターミナルに出す（鍵や相談の中身は出さない）
    console.error(`[AIの失敗] ${e?.constructor?.name || "Error"} ${e?.status ?? ""} ${String(e?.error?.error?.message || e?.message || "").slice(0, 300)}`);
    if (e instanceof Anthropic.AuthenticationError) throw new AiUnavailable("AIの鍵が正しくありません");
    if (e?.status === 400 && /workspace/i.test(String(e?.message || ""))) throw new AiUnavailable("AIの鍵の設定が足りません（ワークスペースの指定）");
    if (e instanceof Anthropic.RateLimitError) throw new AiUnavailable("AIが混み合っています。少し待ってください");
    if (e instanceof Anthropic.APIConnectionError) throw new AiUnavailable("AIにつながりませんでした");
    if (e instanceof Anthropic.APIError) throw new AiUnavailable(`AIの呼び出しに失敗しました（${e.status ?? "不明"}）`);
    throw e;
  }
  if (response.stop_reason === "refusal") throw new AiUnavailable("AIがこの内容には答えられませんでした");
  if (response.stop_reason === "max_tokens") throw new AiUnavailable("AIの答えが長すぎて途中で切れました");
  const block = response.content.find((b) => b.type === "text");
  if (!block) throw new AiUnavailable("AIの答えが空でした");
  return JSON.parse(block.text);
}

// この端末の Claude Code で動かす。読めるのは、この呼び出し専用の作業フォルダの写真だけ。
function callClaudeCode(task, text, images) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bonsai-ai-"));
  const files = images.map((im, i) => {
    const file = path.join(dir, `image_${i}.${im.media_type.split("/")[1]}`);
    writeFileSync(file, Buffer.from(im.data, "base64"));
    return file;
  });
  const systemFile = path.join(dir, "system.txt");
  writeFileSync(systemFile, `${COMMON}\n\n${GLOSSARY_TEXT}\n\n${task.instruction}`);
  const prompt = (files.length ? `Look at these image files with the Read tool:\n${files.join("\n")}\n\n` : "") + text;
  const args = ["-p", "--output-format", "json", "--json-schema", JSON.stringify(task.schema), "--model", MODEL, "--effort", task.effort,
    "--system-prompt-file", systemFile, "--setting-sources", "", "--disable-slash-commands", "--no-session-persistence",
    "--tools", files.length ? "Read" : "", ...(files.length ? ["--allowedTools", `Read(/${dir}/**)`] : [])];
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new AiUnavailable("AIの答えが時間内に返りませんでした")); }, 300000);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", () => { clearTimeout(timer); reject(new AiUnavailable("Claude Code を起動できませんでした")); });
    child.on("close", (code) => {
      clearTimeout(timer);
      rmSync(dir, { recursive: true, force: true });
      try {
        const res = JSON.parse(out);
        if (res.structured_output) return resolve(res.structured_output);
        console.error("claude-code の答えに形の合う中身がありません:", String(res.result || "").slice(0, 300));
      } catch { console.error("claude-code の失敗:", code, err.slice(0, 300), out.slice(0, 300)); }
      reject(new AiUnavailable("AIの答えを受け取れませんでした"));
    });
    child.stdin.end(prompt);
  });
}

/* ---------- AIの回数の上限（料金の守り） ---------- */
// 起動のとき AI_DAILY_LIMIT（全体で1日）・AI_USER_LIMIT（1人で1日）で変えられる
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 300);
const AI_USER_LIMIT = Number(process.env.AI_USER_LIMIT || 60);
class LimitReached extends Error {}
// 相手の住所（IP）。Cloudflare の公開の道具（cloudflared）はこの端末の中から届くので、
// そのときだけ Cloudflare が付ける CF-Connecting-IP を信じる。X-Forwarded-For は相手が書き換えられるので使わない
const AI_IP_LIMIT = Number(process.env.AI_IP_LIMIT || 120);
function clientIp(req) {
  if (!req) return "unknown";
  const remote = String(req.socket?.remoteAddress || "unknown");
  const fromThisMac = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  const cf = req.headers["cf-connecting-ip"];
  return (fromThisMac && typeof cf === "string" && cf.trim()) ? cf.trim() : remote;
}
const requestContext = new AsyncLocalStorage();
function countAiCall() {
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const u = store.ai_usage;
  if (u.day !== day) { u.day = day; u.total = 0; u.by_user = {}; u.by_ip = {}; }
  const ctx = requestContext.getStore();
  const who = ctx?.user?.id || "（ログインなし）";
  const ip = `ip:${clientIp(ctx?.req)}`;
  if (!u.by_ip) u.by_ip = {};
  if (u.total >= AI_DAILY_LIMIT) throw new LimitReached("本日のAIの上限に達しました。明日またお試しください");
  if ((ctx?.user && (u.by_user[who] || 0) >= AI_USER_LIMIT) || (u.by_ip[ip] || 0) >= AI_IP_LIMIT) throw new LimitReached("あなたの本日のAIの上限に達しました。明日またお試しください");
  u.total += 1;
  u.by_user[who] = (u.by_user[who] || 0) + 1;
  u.by_ip[ip] = (u.by_ip[ip] || 0) + 1;
  save();
}

async function ask(taskName, text, images = [], recordedKey = taskName) {
  if (MODE !== "sample") countAiCall();
  if (MODE === "sample") {
    const rec = RECORDED[recordedKey];
    if (!rec) throw new AiUnavailable("見本の答えがありません");
    return structuredClone(rec);
  }
  const task = TASKS[taskName];
  const started = Date.now();
  const result = MODE === "claude-api" ? await callClaudeApi(task, text, images) : await callClaudeCode(task, text, images);
  if (process.env.BONSAI_RECORD) {
    // 見本の答えを撮り直すための記録。指定したときだけ動く
    const rec = existsSync(process.env.BONSAI_RECORD) ? JSON.parse(readFileSync(process.env.BONSAI_RECORD, "utf8")) : {};
    rec[recordedKey] = result;
    writeFileSync(process.env.BONSAI_RECORD, JSON.stringify(rec, null, 2));
  }
  console.log(`[AI] ${taskName} ${MODE} ${((Date.now() - started) / 1000).toFixed(1)}秒`);
  return result;
}

const input = (s) => `<user_input>\n${String(s ?? "").slice(0, 4000)}\n</user_input>`;

/* ---------- 入力の確かめ ---------- */
class BadRequest extends Error {}

function readImages(list) {
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > MAX_IMAGES) throw new BadRequest("写真の数が多すぎます");
  return list.map((im) => {
    if (!im || !IMAGE_TYPES.has(im.media_type) || typeof im.data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(im.data)) throw new BadRequest("写真の形式が読めません");
    return { media_type: im.media_type, data: im.data };
  });
}
const lang = (v) => (["en", "es", "zh", "ja"].includes(v) ? v : "en");
function text(v, max, name) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new BadRequest(`${name}を入れてください`);
  if (s.length > max) throw new BadRequest(`${name}が長すぎます`);
  return s;
}

// 用語の印 [[見せる言葉|用語]] のうち、用語集にない語の印は外して、言葉だけ残す
function cleanTermMarks(s) {
  return String(s).replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (m, shown, word) => (GLOSSARY_WORDS.has(word.trim()) ? `[[${shown}|${word.trim()}]]` : shown));
}

function allTeachers() { return [...SAMPLE_TEACHERS, ...store.teachers]; }
function teacherById(id) { return allTeachers().find((t) => t.id === id); }

// 同じ木の、前の相談と職人の答え（新しい順に3件まで）。AIには全部ではなく、この分だけ渡す
const HISTORY_LIMIT = 3;
function treeHistory(c) {
  if (!c.tree_id) return [];
  return store.consultations
    .filter((x) => x.id !== c.id && x.tree_id === c.tree_id && x.answer && x.answer.voice_ja && x.at < c.at)
    .slice(0, HISTORY_LIMIT)
    .map((x) => ({ at: x.at, question_ja: x.for_craftsperson.summary_ja, answer_ja: x.answer.voice_ja }));
}
// 画面に返す相談。金額は外し、海外の人には職人向けの答えの案を渡さない（職人にどう届いたかの要約だけ見せる）
function publicConsultation(c) {
  const { usd, offer_id, asker_id, ...rest } = c;
  const out = { ...rest, tree_history: treeHistory(c) };
  if (currentUser()?.role !== "shokunin") { delete out.ai_draft; delete out.ai_draft_status; delete out.tree_history; if (out.answer) out.answer = { ...out.answer, review: { checked: out.answer.review?.checked, ok: out.answer.review?.ok } }; if (out.for_craftsperson) out.for_craftsperson = { summary_ja: out.for_craftsperson.summary_ja, points_ja: out.for_craftsperson.points_ja }; }
  return out;
}

// 職人が答える前に見る「答えの案」。失敗しても相談そのものは届ける
async function makeDraft(c, images) {
  const history = treeHistory(c);
  const material = `The asker's question, already rewritten for the craftsperson:\n${input(`${c.for_craftsperson.summary_ja}\n${c.for_craftsperson.points_ja.join("\n")}`)}\nWhat can be seen in the photo (not a diagnosis): ${input(c.for_craftsperson.ai_mitate_ja)}\n<tree_history>\n${history.length ? JSON.stringify(history) : "none"}\n</tree_history>`;
  try {
    return await ask("draftAnswer", material, images, history.length ? "draftAnswerWithHistory" : "draftAnswer");
  } catch (e) {
    console.error("答えの案を作れませんでした:", e.message);
    return null;
  }
}

// 写真の書き込みの知らせ。AIに任せず、必ず同じ言い方で出す
const MARK_NOTE = {
  en: "The craftsperson also marked your photo. Look at the red lines above.",
  es: "El maestro también marcó tu foto. Mira las líneas rojas de arriba.",
  zh: "匠人还在你的照片上做了标记，请看上方的红线。",
  ja: "職人が写真にも書き込みました。上の赤い線を見てください。",
};
const MARK_ONLY_HEADLINE = {
  en: "The craftsperson answered by marking your photo.",
  es: "El maestro respondió marcando tu foto.",
  zh: "匠人在你的照片上做了标记作为回答。",
  ja: "職人が写真への書き込みで答えました。",
};


/* ---------- 合言葉の門とログイン ---------- */
// ACCESS_PASSWORD を付けて起動すると、合言葉を知っている人だけが開ける（公開するときは必ず付ける）
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "";
const GATE_COOKIE = "bonsai_access";
const USER_COOKIE = "bonsai_user";
const THIRTY_DAYS = 60 * 60 * 24 * 30;
const LOGIN_PAGE = "ログイン_職人か海外の人かを選ぶ.html";
const sign = (s) => createHmac("sha256", store.session_secret).update(s).digest("base64url");
const sameText = (a, b) => timingSafeEqual(createHash("sha256").update(String(a)).digest(), createHash("sha256").update(String(b)).digest());
const gateToken = () => createHmac("sha256", ACCESS_PASSWORD).update("bonsai-matching-access").digest("hex");

function readCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function cookieLine(name, value, maxAge, req) {
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}
function userFromCookie(req) {
  const raw = readCookies(req)[USER_COOKIE];
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig || !sameText(sign(body), sig)) return null;
  try {
    const u = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (u.role === "shokunin" && !teacherById(u.teacher_id)) return null;
    return u;
  } catch { return null; }
}
function setUserCookie(res, req, user) {
  const body = Buffer.from(JSON.stringify(user)).toString("base64url");
  res.setHeader("Set-Cookie", cookieLine(USER_COOKIE, `${body}.${sign(body)}`, THIRTY_DAYS, req));
}
const currentUser = () => requestContext.getStore()?.user || null;
function needUser(role) {
  const u = currentUser();
  if (!u) throw new Unauthorized();
  if (role && u.role !== role) throw new Forbidden();
  return u;
}
class Unauthorized extends Error {}
class Forbidden extends Error {}

function gatePage(wrong) {
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>BonsaiGO</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #fbfaf6; color: #1c1815; font-family: "Hiragino Sans", "Yu Gothic", sans-serif; }
  main { width: 100%; max-width: 360px; }
  h1 { margin: 0 0 8px; font-family: "Hiragino Mincho ProN", "Yu Mincho", serif; font-size: 24px; line-height: 1.4; }
  p { margin: 0 0 24px; font-size: 14px; line-height: 1.6; }
  label { display: block; margin-bottom: 8px; font-size: 14px; }
  input { width: 100%; padding: 12px; font-size: 16px; border: 1px solid #1c1815; border-radius: 4px; background: #fff; color: inherit; }
  button { width: 100%; margin-top: 12px; padding: 12px; font-size: 16px; border: 0; border-radius: 4px; background: #1c1815; color: #fff; cursor: pointer; }
  input:focus-visible, button:focus-visible { outline: 2px solid #b23a24; outline-offset: 2px; }
  .wrong { margin: 0 0 16px; color: #b23a24; }
</style></head>
<body><main>
  <h1>BonsaiGO</h1>
  <p>BonsaiGO — passphrase required / 合言葉を入れてください</p>
  ${wrong ? '<p class="wrong" role="alert">合言葉が違います / Wrong passphrase</p>' : ""}
  <form method="post"><label for="password">合言葉 / Passphrase</label>
    <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
    <button type="submit">開く / Open</button></form>
</main></body></html>`;
}

// 合言葉が合っていれば true。合わなければ、ここで合言葉の画面を返して false
async function passGate(req, res, url) {
  if (!ACCESS_PASSWORD) return true;
  if (sameText(readCookies(req)[GATE_COOKIE] || "", gateToken())) return true;
  if (req.method === "POST" && !url.pathname.startsWith("/api/")) {
    const raw = await new Promise((ok) => { let s = ""; req.on("data", (d) => { s += d; if (s.length > 4096) req.destroy(); }); req.on("end", () => ok(s)); req.on("error", () => ok("")); });
    const given = new URLSearchParams(raw).get("password") || "";
    if (sameText(given, ACCESS_PASSWORD)) {
      res.writeHead(303, { Location: url.pathname + url.search, "Set-Cookie": cookieLine(GATE_COOKIE, gateToken(), THIRTY_DAYS, req), "Cache-Control": "no-store" }).end();
      return false;
    }
    res.writeHead(401, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }).end(gatePage(true));
    return false;
  }
  if (url.pathname.startsWith("/api/")) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify({ error: "合言葉を入れてください" }));
    return false;
  }
  res.writeHead(401, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }).end(gatePage(false));
  return false;
}

// ログインなしで開けるもの（ログイン画面と、その画面が読む部品）
// 今回は使わない画面（ファイルは残し、開けないようにする）
const HIDDEN_PAGES = new Set(["01", "02", "06", "07", "08", "09", "12", "14", "15", "16", "20", "21"]);
// 役割ごとの画面。違う役割の人が開いたら、その人のホームへ戻す
const PAGE_ROLE = { "03": "aikouka", "05": "aikouka", "13": "aikouka", "18": "aikouka", "04": "shokunin", "17": "shokunin", "22": "shokunin" };
const OPEN_WITHOUT_LOGIN = (rel) => rel === LOGIN_PAGE || rel.startsWith("共通/") || rel === "用語集.json";
const teacherCard = (t) => ({ id: t.id, name_ja: t.name_ja, name_en: t.name_en });

/* ---------- 役割ごとの処理 ---------- */
async function makePosts({ kind, note, images, context }) {
  const brief = `Material type: ${kind === "video" ? "frames taken from a short video" : "a photo"}.\nCraftsperson's note (may be empty):\n${input(note)}` +
    (context ? `\nThis came from a real exchange. Keep the asker anonymous; never name them or their city.\n${input(context)}` : "");
  return ask("socialPosts", brief, images, context ? "socialPostsFromAnswer" : "socialPosts");
}

const routes = {
  // 金額は画面にも通信にも出さない（11/7 の決定）。offers は読む画面のために空で返す
  "GET /api/status": async () => ({ mode: MODE, model: MODE === "sample" ? null : MODEL, offers: [] }),

  "GET /api/teachers": async () => ({ teachers: store.teachers.map(({ offers, ...t }) => t), offers: [] }),

  /* ログイン（パスワードなし。合言葉の門の内側だけで使う） */
  "GET /api/me": async () => ({ user: currentUser(), teachers: allTeachers().map(teacherCard) }),
  "POST /api/login": async (b) => {
    const role = b.role === "shokunin" ? "shokunin" : b.role === "aikouka" ? "aikouka" : null;
    if (!role) throw new BadRequest("職人か海外の人かを選んでください");
    let user;
    if (role === "shokunin" && b.teacher_id) {
      // 見本の職人（または前に登録した職人）を選んで入る
      const t = teacherById(b.teacher_id);
      if (!t) throw new BadRequest("職人を選んでください");
      user = { id: `u-${t.id}`, role, name: t.name_ja, lang: "ja", teacher_id: t.id };
    } else if (role === "shokunin") {
      // 新しく職人として登録する（デモ用。名前・言語・得意な木・園名と地域だけ）
      const name = text(b.name, 40, "お名前");
      const specialties = (Array.isArray(b.specialties) ? b.specialties : []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 20)).slice(0, 8);
      if (!specialties.length) throw new BadRequest("得意な木を1つ以上選んでください");
      const place = typeof b.place === "string" ? b.place.trim().slice(0, 60) : "";
      const t = { id: `t-${randomUUID().slice(0, 8)}`, name_ja: name, name_en: name, title_ja: place, specialty_ja: specialties, can_teach_ja: [], bio_en: "", lang: lang(b.lang || "ja"), offers: OFFERS.map((o) => o.id) };
      store.teachers.unshift(t);
      await save();
      user = { id: `u-${t.id}`, role, name, lang: t.lang, teacher_id: t.id };
    } else {
      if (b.demo === "learner") {
        // デモ用：見本の学び手（架空の Emma）。見本の相談と答えが入っている
        user = { id: "u-a-demo-emma", role, name: "Emma", lang: "en", teacher_id: null };
        setUserCookie(requestContext.getStore().res, requestContext.getStore().req, user);
        return { user };
      }
      const name = text(b.name, 40, "お名前（Name）");
      // 人の印はサーバーが作る（名前からは作らない。同じ名前の別の人に相談が見えないように）
      const prev = currentUser();
      const id = prev && prev.role === "aikouka" ? prev.id : `u-a-${randomUUID()}`;
      user = { id, role, name, lang: lang(b.lang), teacher_id: null };
    }
    setUserCookie(requestContext.getStore().res, requestContext.getStore().req, user);
    return { user };
  },
  "POST /api/logout": async () => {
    const { res, req } = requestContext.getStore();
    res.setHeader("Set-Cookie", cookieLine(USER_COOKIE, "", 0, req));
    return { ok: true };
  },

  /* 写真か動画 → 各SNSの下書き */
  "POST /api/posts/draft": async (b) => {
    needUser("shokunin");
    const images = readImages(b.images);
    if (!images.length) throw new BadRequest("写真か動画を選んでください");
    return makePosts({ kind: b.kind === "video" ? "video" : "photo", note: typeof b.note === "string" ? b.note.slice(0, 2000) : "", images });
  },

  /* OK を押した下書きを、発信の一覧に残す（SNSへの投稿はしない） */
  "POST /api/posts/ok": async (b) => {
    if (!b.draft || !b.draft.posts || !b.draft.culture_note) throw new BadRequest("下書きがありません");
    const images = readImages(b.images);
    const me = needUser("shokunin");
    const item = { id: randomUUID(), at: new Date().toISOString(), teacher_id: me.teacher_id, posts: b.draft.posts, culture_note: b.draft.culture_note, image: images[0] || null };
    store.feed.unshift(item);
    const tree = store.trees.find((t) => t.id === b.tree_id && t.teacher_id === me.teacher_id);
    if (tree) tree.log.push({ at: item.at, text: "投稿の下書きをOKしました（まだ投稿はしていません）" });
    await save();
    return { id: item.id };
  },
  "GET /api/feed": async () => { const me = needUser("shokunin"); return { feed: store.feed.filter((f) => f.teacher_id === me.teacher_id).slice(0, 20) }; },

  /* 話したこと・撮った写真 → 聞き分けて、木の記録を作る */
  "GET /api/trees": async () => { const me = needUser("shokunin"); return { trees: store.trees.filter((t) => t.teacher_id === me.teacher_id).slice(0, 30) }; },
  "POST /api/trees": async (b) => {
    needUser("shokunin");
    const voice = typeof b.voice === "string" ? b.voice.trim().slice(0, 3000) : "";
    const images = readImages(b.images).slice(0, 1);
    if (!voice && !images.length) throw new BadRequest("話すか、写真を撮ってください");
    const res = await ask("treeIntake", `What the craftsperson said (may be empty):\n${input(voice)}\nPhoto attached: ${images.length ? "yes" : "no"}`, images);
    const at = new Date().toISOString();
    const tree = { ...res, id: randomUUID(), at, voice_ja: voice, image: images[0] || null, wants: (res.wants || []).filter((w) => ["post", "listing", "teach"].includes(w)), log: [{ at, text: res.record_ja }], listing: null };
    tree.teacher_id = currentUser().teacher_id;
    store.trees.unshift(tree);
    await save();
    return tree;
  },

  /* 木の記録 → 出品の下書き。公開も販売もしない */
  "POST /api/trees/:id/listing": async (b, id) => {
    const me = needUser("shokunin");
    const tree = store.trees.find((t) => t.id === id);
    if (!tree || tree.teacher_id !== me.teacher_id) throw new NotFound();
    const format = b.format === "auction" ? "auction" : "fixed";
    const price_note = typeof b.price_note === "string" ? b.price_note.trim().slice(0, 200) : "";
    const material = `Tree record: ${input(`${tree.title_ja}\n${tree.what_i_saw_ja}`)}\nWhat the craftsperson said: ${input(tree.voice_ja)}\nSale format: ${format === "auction" ? "bids" : "fixed price"}\nCraftsperson's price wish (may be empty): ${input(price_note)}\n<wanted>\n${JSON.stringify(SAMPLE_WANTED.map(({ id, detail }) => ({ id, detail })))}\n</wanted>`;
    const res = await ask("listingDraft", material, tree.image ? [tree.image] : []);
    const known = new Map(SAMPLE_WANTED.map((w) => [w.id, w]));
    const at = new Date().toISOString();
    tree.listing = { ...res, format, price_note, at, wanted_matches: res.wanted_matches.filter((m) => known.has(m.wanted_id)).map((m) => ({ ...m, wanted_ja: known.get(m.wanted_id).ja, overseas: known.get(m.wanted_id).overseas })) };
    tree.log.push({ at, text: "出品の下書きを作りました（公開はしていません）" });
    await save();
    return tree;
  },

  /* 知りたいこと → 合う職人 */
  "POST /api/match": async (b) => {
    needUser("aikouka");
    const l = lang(b.lang);
    const want = text(b.want, 2000, "知りたいこと");
    const teachers = allTeachers().map(({ id, specialty_ja, can_teach_ja, bio_en, offers }) => ({ id, specialty_ja, can_teach_ja, bio_en, offers }));
    const res = await ask("matchTeachers", `Asker's language: ${langName(l)}.\n<teachers>\n${JSON.stringify(teachers)}\n</teachers>\nWhat they want to learn:\n${input(want)}`);
    // 見本の答えは録音なので、いま登録した職人を知らない。その分だけここで足す
    if (MODE === "sample" && store.teachers.length && res.matches?.length) {
      const t = store.teachers[0];
      res.matches.unshift({ teacher_id: t.id, reason: t.bio[l] || t.bio.en, offer_id: "one_question", first_question: res.matches[0].first_question });
    }
    const known = new Map(allTeachers().map((t) => [t.id, t]));
    res.matches = (res.matches || []).filter((m) => known.has(m.teacher_id)).slice(0, 3).map((m) => {
      const t = known.get(m.teacher_id);
      return { ...m, offer_id: t.offers.includes(m.offer_id) ? m.offer_id : t.offers[0] };
    });
    return res;
  },

  /* 話した内容 → 紹介ページの下書き。保存は別 */
  "POST /api/teachers/draft": async (b) => ask("teacherProfile", `What the craftsperson said:\n${input(text(b.voice, 3000, "話した内容"))}`),
  "POST /api/teachers": async (b) => {
    const p = b.profile;
    if (!p || !p.bio || !p.first_words) throw new BadRequest("紹介ページの下書きがありません");
    const name = text(b.name, 40, "お名前");
    const t = { id: `t-${randomUUID().slice(0, 8)}`, name_ja: name, name_en: name, title_ja: p.title_ja, specialty_ja: p.specialty_ja, can_teach_ja: p.can_teach_ja, bio_en: p.bio.en, bio: p.bio, first_words: p.first_words, offers: OFFERS.map((o) => o.id) };
    store.teachers.unshift(t);
    await save();
    // 登録した人を、そのままこの職人としてログインさせる
    const ctx = requestContext.getStore();
    setUserCookie(ctx.res, ctx.req, { id: `u-${t.id}`, role: "shokunin", name: t.name_ja, lang: "ja", teacher_id: t.id });
    return t;
  },

  /* 相談 → 職人へ */
  "POST /api/consultations": async (b) => {
    const me = needUser("aikouka");
    const l = lang(b.lang || me.lang);
    const question = text(b.question, 3000, "質問");
    const images = readImages(b.images);
    // 宛先が決まっていなければ、いちばん新しく登録した職人へ（いなければ見本の職人）
    const teacher = teacherById(b.teacher_id) || store.teachers[0] || SAMPLE_TEACHERS[0];
    const offer = OFFERS.find((o) => o.id === b.offer_id) || OFFERS[0];
    const forCraftsperson = await ask("toCraftsperson", `Asker's language: ${langName(l)}.\nTheir question:\n${input(question)}`, images);
    forCraftsperson.terms_ja = (forCraftsperson.terms_ja || []).filter((w) => GLOSSARY_WORDS.has(w));
    // どの木の相談か。前に相談した木なら同じ番号を使い、なければ新しい木にする
    const known = typeof b.tree_id === "string" && store.consultations.some((x) => x.tree_id === b.tree_id && x.asker_id === me.id);
    const c = { id: randomUUID(), at: new Date().toISOString(), asker_id: me.id, asker_name: me.name, lang: l, question, image: images[0] || null, tree_id: known ? b.tree_id : randomUUID(), teacher_id: teacher.id, offer_id: offer.id, usd: offer.usd, for_craftsperson: forCraftsperson, ai_draft: null, ai_draft_status: "making", answer: null };
    store.consultations.unshift(c);
    await save();
    // 答えの案は裏で作る。相談した人は待たせない
    makeDraft(c, images).then((d) => { c.ai_draft = d; c.ai_draft_status = d ? "done" : "failed"; return save(); });
    return publicConsultation(c);
  },
  "GET /api/consultations": async () => {
    const me = needUser();
    const mine = store.consultations.filter((c) => (me.role === "shokunin" ? c.teacher_id === me.teacher_id : c.asker_id === me.id));
    return { consultations: mine.slice(0, 30).map(publicConsultation) };
  },

  /* 職人の答え → 意訳して、別の目で見直す */
  "POST /api/consultations/:id/answer": async (b, id) => {
    const me = needUser("shokunin");
    const c = store.consultations.find((x) => x.id === id);
    if (!c || c.teacher_id !== me.teacher_id) throw new NotFound();
    const voice = typeof b.voice === "string" ? b.voice.trim().slice(0, 3000) : "";
    const marks = Array.isArray(b.marks) ? b.marks.filter((m) => typeof m === "string" && /^[ML0-9. ]+$/.test(m) && m.length < 20000).slice(0, 50) : [];
    if (!voice && !marks.length) throw new BadRequest("話すか、写真に書き込んでください");
    let fixed, review = { ok: true, problems_ja: [] };
    if (voice) {
      const material = `Asker's language: ${langName(c.lang)}.\nAsker's question:\n${input(c.question)}\nCraftsperson's words in Japanese:\n${input(voice)}`;
      const draft = await ask("toLearner", material);
      review = await ask("reviewAnswer", `${material}\nThe rewrite to check:\n${input(JSON.stringify(draft))}`);
      fixed = review.ok ? draft : {
        headline: review.corrected_headline || draft.headline,
        paragraphs: review.corrected_paragraphs || draft.paragraphs,
        back_translation_ja: review.corrected_back_translation_ja || draft.back_translation_ja,
      };
    } else {
      fixed = { headline: MARK_ONLY_HEADLINE[c.lang], paragraphs: [], back_translation_ja: "" };
    }
    const paragraphs = fixed.paragraphs.map(cleanTermMarks);
    if (marks.length) paragraphs.push(MARK_NOTE[c.lang]);
    c.answer = {
      at: new Date().toISOString(), voice_ja: voice, marks, from_draft: Boolean(b.from_draft) && Boolean(voice),
      headline: cleanTermMarks(fixed.headline),
      paragraphs,
      back_translation_ja: [fixed.back_translation_ja, marks.length ? MARK_NOTE.ja : ""].filter(Boolean).join("\n"),
      review: { ok: review.ok, problems_ja: review.problems_ja || [], checked: Boolean(voice) && MODE !== "sample" },
    };
    await save();
    return publicConsultation(c);
  },

  /* 相談から投稿の下書き */
  "POST /api/consultations/:id/posts": async (b, id) => {
    const me = needUser("shokunin");
    const c = store.consultations.find((x) => x.id === id);
    if (!c || c.teacher_id !== me.teacher_id) throw new NotFound();
    if (!c.answer) throw new BadRequest("まだ職人の答えがありません");
    const context = `Question (summary for the craftsperson): ${c.for_craftsperson.summary_ja}\nCraftsperson's answer: ${c.answer.voice_ja}`;
    return makePosts({ kind: "photo", note: context, images: c.image ? [c.image] : [] });
  },
};

class NotFound extends Error {}

/* ---------- 配る ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json; charset=utf-8" };
const PRIVATE = new Set(["データ", "node_modules", "サーバー.mjs", "AIへの指示と答えの形.mjs", "package.json", "package-lock.json"]);

async function serveFile(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html"; } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(HERE, rel);
  if (!file.startsWith(HERE + path.sep) || PRIVATE.has(rel.split("/")[0]) || rel.split("/").some((p) => p.startsWith("."))) { res.writeHead(404).end(); return; }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("見つかりません"); }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (d) => { size += d.length; if (size > MAX_BODY) { reject(new BadRequest("写真が大きすぎます")); req.destroy(); return; } chunks.push(d); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject(new BadRequest("送られた内容が読めません")); } });
    req.on("error", reject);
  });
}

function findRoute(method, pathname) {
  const exact = routes[`${method} ${pathname}`];
  if (exact) return { fn: exact };
  const m = pathname.match(/^\/api\/consultations\/([0-9a-f-]{36})\/(answer|posts)$/);
  if (m && method === "POST") return { fn: routes[`POST /api/consultations/:id/${m[2]}`], id: m[1] };
  const tm = pathname.match(/^\/api\/trees\/([0-9a-f-]{36})\/listing$/);
  if (tm && method === "POST") return { fn: routes["POST /api/trees/:id/listing"], id: tm[1] };
  return null;
}

const server = http.createServer((req, res) => {
  requestContext.run({ req, res, user: null }, () => handle(req, res));
});

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const { pathname } = url;
  if (pathname === "/favicon.ico") { res.writeHead(204).end(); return; }
  // 合言葉なしで外から来たら止める（公開の道具を通ると、この見出しが付く）
  if (!ACCESS_PASSWORD && (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"])) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" }).end("準備中です。");
    return;
  }
  if (!(await passGate(req, res, url))) return;
  const user = userFromCookie(req);
  requestContext.getStore().user = user;
  if (!pathname.startsWith("/api/")) {
    let rel = "";
    try { rel = decodeURIComponent(pathname).replace(/^\/+/, ""); } catch {}
    // 共有URLをそのまま開いた人は、自分の役割のホームへ（開発用の画面一覧は index.html を直接開く）
    if (rel === "") {
      const to = user ? `/${encodeURI("00_ホーム_職人と愛好家.html")}?role=${user.role}` : `/${encodeURI(LOGIN_PAGE)}`;
      res.writeHead(302, { Location: to, "Cache-Control": "no-store" }).end();
      return;
    }
    const no = /^(\d\d)_/.exec(rel)?.[1];
    if (no && HIDDEN_PAGES.has(no)) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("見つかりません"); return; }
    if (user && no && PAGE_ROLE[no] && PAGE_ROLE[no] !== user.role) {
      res.writeHead(302, { Location: `/${encodeURI("00_ホーム_職人と愛好家.html")}?role=${user.role}`, "Cache-Control": "no-store" }).end();
      return;
    }
    if (!user && rel.endsWith(".html") && !OPEN_WITHOUT_LOGIN(rel) && !rel.startsWith("19_")) {
      res.writeHead(302, { Location: `/${encodeURI(LOGIN_PAGE)}?next=${encodeURIComponent(pathname + url.search)}`, "Cache-Control": "no-store" }).end();
      return;
    }
    return serveFile(req, res, pathname);
  }
  const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
  try {
    const route = findRoute(req.method, pathname);
    if (!route) return send(404, { error: "見つかりません" });
    // よそのサイトからの送信を防ぐため、JSONだけ受ける
    if (req.method === "POST" && !String(req.headers["content-type"] || "").startsWith("application/json")) return send(415, { error: "送り方が違います" });
    const body = req.method === "POST" ? await readBody(req) : {};
    send(200, await route.fn(body, route.id));
  } catch (e) {
    if (!(e instanceof Unauthorized)) console.error(`[うまくいかなかった] ${req.method} ${decodeURIComponent(pathname)} → ${e?.constructor?.name}: ${String(e?.message || "").slice(0, 200)}`);
    if (e instanceof BadRequest) return send(400, { error: e.message });
    if (e instanceof NotFound) return send(404, { error: "見つかりません" });
    if (e instanceof AiUnavailable) return send(503, { error: e.message });
    if (e instanceof LimitReached) return send(429, { error: e.message });
    if (e instanceof Unauthorized) return send(401, { error: "ログインしてください（Please sign in）", login: `/${LOGIN_PAGE}` });
    if (e instanceof Forbidden) return send(403, { error: "この操作は、この役割ではできません" });
    console.error(e);
    send(500, { error: "うまくいきませんでした。もう一度お試しください" });
  }
}

server.listen(PORT, HOST, () => {
  const label = { "claude-api": "Claude API（使った分の料金がかかります）", "claude-code": "この端末の Claude Code", sample: "見本の答え（AIは動きません）" }[MODE];
  console.log(`BonsaiGO（盆栽マッチングの試作）: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}/index.html`);
  console.log(`AIのつなぎ方: ${label}`);
  console.log(`合言葉の門: ${ACCESS_PASSWORD ? "あり" : "なし（公開しないでください）"} ／ AIの上限: 1日 ${AI_DAILY_LIMIT} 回・1人 ${AI_USER_LIMIT} 回・同じ回線 ${AI_IP_LIMIT} 回`);
});
