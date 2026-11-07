// 盆栽ゴー：AIの料金の守り（2026-11-08）
// 5つの守りを1か所にまとめる。サーバー.mjs の ask() が、AIを呼ぶ前と後に必ずここを通る。
//   1. 確かめ（画像・文・逆翻訳）は小さいモデル（Haiku）。確かさが 0.8 より低ければ「人が確かめる」側に倒す
//   2. 文を書くのは Sonnet。Sonnet がうまくいかなかったときだけ Opus で1回やり直す
//   3. 決まった指示と用語集は、プロンプトキャッシュで使い回す（callClaudeApi の cache_control）
//   4. 同じ頼み（同じ仕事・同じ文・同じ写真・同じ言葉）には、前の答えを返す（料金ゼロ）
//   5. 回数の上限：1人1日12回・全体で1日200回（起動のとき AI_USER_LIMIT・AI_DAILY_LIMIT で変えられる）

import { createHash } from "node:crypto";

export const MODELS = {
  check: process.env.BONSAI_MODEL_CHECK || "claude-haiku-5-5",
  main: process.env.BONSAI_MODEL_MAIN || "claude-sonnet-5-5",
  fallback: process.env.BONSAI_MODEL_FALLBACK || "claude-opus-5-5",
};
export const CONFIDENCE_LINE = 0.8;
export const LIMITS = {
  perUser: Number(process.env.AI_USER_LIMIT || 12),
  total: Number(process.env.AI_DAILY_LIMIT || 200),
  perIp: Number(process.env.AI_IP_LIMIT || 60),
};
const CACHE_MAX = 400;
const LOG_MAX = 12;

// 仕事ごとの「段」。ここにない仕事は main（Sonnet）
const TIER = {
  checkImage: "check",
  checkPostText: "check",
  reviewAnswer: "check",
};
export const tierOf = (taskName) => TIER[taskName] || "main";

export class LimitReached extends Error {}

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

export function createGuard(store, save) {
  if (!store.ai_cache) store.ai_cache = {};
  if (!store.ai_usage) store.ai_usage = { day: "", total: 0, by_user: {}, by_ip: {} };
  if (!store.ai_log) store.ai_log = [];
  const u = store.ai_usage;
  const roll = () => {
    if (u.day !== today()) { u.day = today(); u.total = 0; u.by_user = {}; u.by_ip = {}; u.cache_hits = 0; }
    if (!u.by_ip) u.by_ip = {};
    if (!u.cache_hits) u.cache_hits = 0;
  };

  // 同じ頼みかどうかの印。写真は中身の指紋だけ使う
  function keyOf(taskName, text, images, extra = "") {
    const h = createHash("sha256");
    h.update(`${taskName}\u0000${extra}\u0000${text}`);
    for (const im of images || []) h.update(`\u0000${im.media_type}:${createHash("sha256").update(im.data).digest("hex")}`);
    return h.digest("hex");
  }

  function fromCache(key) {
    const hit = store.ai_cache[key];
    if (!hit) return null;
    roll(); u.cache_hits += 1;
    return structuredClone(hit.result);
  }

  function remember(key, result) {
    store.ai_cache[key] = { at: Date.now(), result };
    const keys = Object.keys(store.ai_cache);
    if (keys.length > CACHE_MAX) {
      keys.sort((a, b) => store.ai_cache[a].at - store.ai_cache[b].at).slice(0, keys.length - CACHE_MAX).forEach((k) => delete store.ai_cache[k]);
    }
  }

  // 呼ぶ前に数える。上限なら止める（数えるのは前の答えを使わなかったときだけ）
  function count(who, ip) {
    roll();
    if (u.total >= LIMITS.total) throw new LimitReached("本日のAIの上限（全体200回）に達しました。明日またお試しください");
    if ((who && (u.by_user[who] || 0) >= LIMITS.perUser) || (ip && (u.by_ip[ip] || 0) >= LIMITS.perIp)) throw new LimitReached("あなたの本日のAIの上限（12回）に達しました。明日またお試しください");
    u.total += 1;
    if (who) u.by_user[who] = (u.by_user[who] || 0) + 1;
    if (ip) u.by_ip[ip] = (u.by_ip[ip] || 0) + 1;
  }

  function log(entry) {
    store.ai_log.unshift({ at: new Date().toISOString(), ...entry });
    store.ai_log.length = Math.min(store.ai_log.length, LOG_MAX);
  }

  // 確かめの答えを、確かさの線で読み直す。線より下なら ok を外し、人が確かめる側に倒す
  function judge(result) {
    const confidence = typeof result.confidence === "number" ? Math.max(0, Math.min(1, result.confidence)) : 0;
    const sure = confidence >= CONFIDENCE_LINE;
    return { ...result, confidence, sure, ok: Boolean(result.ok) && sure, needs_person: !sure };
  }

  function status(who) {
    roll();
    return {
      models: MODELS, confidence_line: CONFIDENCE_LINE, limits: LIMITS,
      today: { total: u.total, me: who ? (u.by_user[who] || 0) : 0, cache_hits: u.cache_hits },
      last: store.ai_log.slice(0, 8),
    };
  }

  return { keyOf, fromCache, remember, count, log, judge, status, tierOf, save };
}
