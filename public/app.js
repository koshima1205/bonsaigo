// Engawa — 盆栽のメディアと、職人に聞ける縁側。ハッシュで画面を切り替える。
import { bonsai, enso, imgSrc, isIllust } from "./art.js";
import { bgm } from "./bgm.js";
import { makePlayer } from "./short.js";
import { LETTER_LANGS, UI_LANGS, VOICE, lang, ml, setLang, t, tl } from "./i18n.js";

const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const $ = (sel, root = app) => root.querySelector(sel);
const $$ = (sel, root = app) => [...root.querySelectorAll(sel)];
const KANJI = ["壱", "弐", "参", "肆", "伍", "陸"];
const NUM = ["一", "二", "三", "四", "五", "六", "七", "八"];
const MONTHS = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };
const monthName = (m) => (["ja", "easy", "zh"].includes(lang()) ? `${m}月` : (MONTHS.en[m - 1] ?? m));

const store = {
  get: (k, d = "") => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  sget: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  sset: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
};

// 画面の言葉：前に選んだもの → ブラウザの言葉
setLang(store.get("engawa-lang") || (navigator.language.startsWith("ja") ? "ja" : navigator.language.startsWith("es") ? "es" : navigator.language.startsWith("zh") ? "zh" : "en"));

let timer = null;
const stopTimer = () => { if (timer) clearInterval(timer); timer = null; };
let players = [];
const stopPlayers = () => { players.forEach((p) => p.pause()); players = []; };

// ---------------- 通信 ----------------
const code = () => store.get("engawa-code");
const masterName = () => store.get("engawa-master");
async function call(path, body, master = false) {
  const headers = { "content-type": "application/json" };
  if (master) headers["x-master-code"] = code();
  const res = await fetch(path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "error"), { status: res.status });
  return data;
}
let config = { demo: false };
call("/api/config").then((c) => { config = c; document.body.classList.toggle("is-demo", !!c.demo); }).catch(() => {});

// ショートのリンクから来た人を数える（?src=s-xxx-ig）
{
  const src = new URLSearchParams(location.search).get("src");
  if (src) {
    fetch("/api/hit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ src }) }).catch(() => {});
    history.replaceState(null, "", location.pathname + location.hash);
  }
}

async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width * k);
  cv.height = Math.round(bmp.height * k);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", 0.82);
}

const safe = (s) => (typeof s === "string" && (s.startsWith("data:image/") || isIllust(s)) ? s : "illust:pine:1");
const artCache = new Map();
const pic = (src, alt = "", cls = "") => {
  src = safe(src);
  if (isIllust(src)) {
    if (!artCache.has(src)) artCache.set(src, imgSrc(src));
    return `<img class="${cls}" src="${artCache.get(src)}" alt="${esc(alt)}" loading="lazy">`;
  }
  return `<img class="${cls}" src="${src}" alt="${esc(alt)}" loading="lazy">`;
};
const tm = (term) => (lang() === "es" ? term.es : lang() === "zh" ? term.zh : lang() === "ja" || lang() === "easy" ? term.meaning_ja : term.en);
const sampleTag = (x) => (x?.seed ? `<span class="tag-sample">${t("sample")}</span>` : "");
const when = (ms) => new Date(ms).toLocaleDateString(lang() === "ja" || lang() === "easy" ? "ja-JP" : lang() === "zh" ? "zh-CN" : lang() === "es" ? "es-ES" : "en-GB", { month: "short", day: "numeric" });

// ---------------- 音 ----------------
const BARS = `<span class="bars"><i></i><i></i><i></i><i></i></span>`;
function syncSound() { $$(".snd", document).forEach((b) => { b.classList.toggle("on", bgm.on); b.setAttribute("aria-pressed", bgm.on); }); }
document.addEventListener("bgm", syncSound);
document.addEventListener("click", (e) => {
  const b = e.target.closest(".snd");
  if (!b) return;
  e.stopPropagation();
  bgm.on ? bgm.stop() : bgm.start();
  store.set("engawa-sound", bgm.on ? "off" : "on");
}, true);
// 一度でも触れたら、音を出してよい人には流す（ブラウザは触れる前に音を出させない）
document.addEventListener("pointerdown", () => { if (store.get("engawa-sound") !== "off" && store.sget("engawa-entered") && !bgm.on) bgm.start(); }, { once: true });

// ---------------- 枠（メディア側） ----------------
const NAV = [["#/read", "nav_read"], ["#/shorts", "nav_shorts"], ["#/ask", "nav_ask"], ["#/glossary", "nav_glossary"], ["#/board", "nav_board"], ["#/help", "nav_help"], ["#/wish", "nav_wish"]];
function chrome(inner, { here = "", paper = false } = {}) {
  document.body.className = `media ${paper ? "on-paper" : ""} ${config.demo ? "is-demo" : ""}`;
  app.innerHTML = `
  <header class="top">
    <a class="brand" href="#/"><span class="seal">縁</span><span class="wm">ENGAWA<small>縁側</small></span></a>
    <nav class="nav">${NAV.map(([h, k]) => `<a href="${h}" class="${here === h ? "here" : ""}">${t(k)}</a>`).join("")}</nav>
    <div class="tools">
      <label class="langsel"><span class="sr">Language</span><select id="uilang">${Object.entries(UI_LANGS).map(([k, v]) => `<option value="${k}" ${k === lang() ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <button class="snd ${bgm.on ? "on" : ""}" aria-pressed="${bgm.on}" title="${t("sound")}">${BARS}<span class="snd-l">${t("sound")}</span></button>
    </div>
  </header>
  <main class="main">${inner}</main>
  <footer class="foot">
    <div class="foot-in">
      <a class="brand" href="#/"><span class="seal">縁</span><span class="wm">ENGAWA<small>縁側</small></span></a>
      <p>${t("footer_rule")}</p>
      <p class="dim">${t("footer_seed")}</p>
      <a class="to-master" href="#/master">${t("nav_master")} →</a>
    </div>
  </footer>`;
  $("#uilang").addEventListener("change", (e) => { setLang(e.target.value); store.set("engawa-lang", e.target.value); route(); });
  const top = $(".top");
  const onScroll = () => top.classList.toggle("solid", paper || scrollY > 40);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
}
const secHead = (n, title, sub = "") => `<header class="sec-h"><span class="num">${KANJI[n]}</span><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div></header>`;

// ---------------- 入口の幕 ----------------
function splash() {
  if (store.sget("engawa-entered")) return;
  const d = document.createElement("div");
  d.className = "splash";
  d.innerHTML = `
    <div class="splash-in">
      ${enso("draw")}
      <div class="splash-tree">${bonsai("illust:pine:11", "ink")}</div>
      <h1><span class="v">縁側</span><span class="en">ENGAWA</span></h1>
      <p>${esc(t("hero_sub").split("。")[0])}${lang() === "ja" || lang() === "easy" ? "。" : ""}</p>
      <button class="enter">${t("enter")}<small>♪ ${t("sound")}</small></button>
      <button class="quiet">${t("enter_quiet")}</button>
      <div class="langs">${Object.entries(UI_LANGS).map(([k, v]) => `<button data-l="${k}" class="${k === lang() ? "on" : ""}">${v}</button>`).join("")}</div>
    </div>`;
  document.body.append(d);
  const close = (sound) => {
    store.sset("engawa-entered", "1");
    store.set("engawa-sound", sound ? "on" : "off");
    if (sound) bgm.start();
    d.classList.add("out");
    setTimeout(() => d.remove(), 1200);
  };
  d.querySelector(".enter").addEventListener("click", () => close(true));
  d.querySelector(".quiet").addEventListener("click", () => close(false));
  d.querySelectorAll(".langs button").forEach((b) => b.addEventListener("click", () => { setLang(b.dataset.l); store.set("engawa-lang", b.dataset.l); d.remove(); splash(); route(); }));
}

// ---------------- メディア：表紙 ----------------
async function home() {
  chrome(`<section class="hero"><div class="loading">${t("loading")}</div></section>`, { here: "#/" });
  const [arts, shorts, gloss] = await Promise.all([call("/api/articles"), call("/api/shorts"), call("/api/glossary")]).catch(() => [[], [], []]);
  const pickTerms = ["なおす", "芽切り", "忌み枝", "えらい"].map((j) => gloss.find((g) => g.ja === j)).filter(Boolean);
  const main = $(".main");
  main.innerHTML = `
  <section class="hero">
    <div class="mist m1"></div><div class="mist m2"></div><div class="dust"></div>
    <div class="moon"></div>
    <div class="hero-tree">${bonsai("illust:pine:11", "ink")}</div>
    <div class="hero-v" lang="ja"><span>盆栽の知恵は、</span><span>海を渡れる。</span></div>
    <div class="hero-copy">
      <p class="kicker">BONSAI MASTERS · ACROSS THE SEA</p>
      <h1>Engawa<span>縁側</span></h1>
      <p class="sub">${t("hero_sub")}</p>
      <div class="cta"><a class="btn gold" href="#/ask">${t("hero_ask")}</a><a class="btn ghost" href="#/read">${t("hero_read")}</a></div>
    </div>
    <button class="scroll-cue" id="cue" aria-label="scroll"><span></span></button>
  </section>

  <section class="sec" id="latest">
    ${secHead(0, t("sec_latest"), t("sec_latest_sub"))}
    <div class="cards">${arts.slice(0, 6).map(articleCard).join("")}</div>
  </section>

  <section class="sec dark2">
    ${secHead(1, t("sec_shorts"), t("sec_shorts_sub"))}
    <div class="reel">${shorts.map((s) => `<a class="reel-i" href="#/short/${esc(s.id)}"><canvas data-short="${esc(s.id)}"></canvas><span class="play">▶</span><b>${esc(lang() === "ja" || lang() === "easy" ? s.hook_ja : s.hook_en)}</b>${sampleTag(s)}</a>`).join("")}</div>
  </section>

  <section class="sec">
    ${secHead(2, t("sec_how"))}
    <ol class="how">
      ${[1, 2, 3].map((i) => `<li><span class="how-n">${NUM[i - 1]}</span><h3>${t(`how${i}t`)}</h3><p>${t(`how${i}`)}</p></li>`).join("")}
    </ol>
    <a class="btn ghost center" href="#/c/sample">${t("sample_consult")} →</a>
  </section>

  <section class="sec paperband">
    ${secHead(3, t("sec_gloss"), t("sec_gloss_sub"))}
    <div class="terms">${pickTerms.map(termCard).join("")}</div>
    <a class="btn ink center" href="#/glossary">${t("nav_glossary")} →</a>
  </section>

  <section class="sec">
    ${secHead(4, t("sec_gather"))}
    <div class="gather">
      <a href="#/board"><span class="g-k">掲</span><h3>${t("nav_board")}</h3><p>${t("board_desc")}</p></a>
      <a href="#/help"><span class="g-k">問</span><h3>${t("nav_help")}</h3><p>${t("help_desc")}</p></a>
      <a href="#/wish"><span class="g-k">望</span><h3>${t("nav_wish")}</h3><p>${t("wish_desc")}</p></a>
    </div>
  </section>`;
  $("#cue").addEventListener("click", () => $("#latest").scrollIntoView({ behavior: "smooth" }));
  thumbs(shorts, arts);
  splash();
}

function articleCard(a) {
  return `<a class="card-a" href="#/read/${esc(a.slug)}">
    <div class="cover">${pic(a.cover, ml(a.title))}</div>
    <div class="card-b">
      <div class="meta"><span>${esc(ml(a.tree))}</span>${a.source ? `<span class="from">相談から</span>` : ""}${sampleTag(a)}</div>
      <h3>${esc(ml(a.title))}</h3>
      <p>${esc(ml(a.lead))}</p>
      <div class="foot-m"><span>${when(a.created)}</span>${a.views != null ? `<span>${Number(a.views).toLocaleString()} ${t("views")}</span>` : ""}</div>
    </div></a>`;
}

function termCard(g) {
  return `<div class="term ${g.dialect ? "dialect" : ""}">
    <div class="term-h"><b lang="ja">${esc(g.ja)}</b><small>${esc(g.yomi)}</small>${g.dialect ? `<span class="tag">${t("gloss_dialect")}</span>` : ""}${g.edited_by ? `<span class="tag ok">${t("gloss_edited")}</span>` : ""}</div>
    <div class="lit"><span>${t("literal")}</span><s>${esc(g.literal)}</s></div>
    <div class="mean"><span>${t("meaning")}</span>${esc(tm(g))}</div>
    <div class="why"><span>${t("why")}</span>${esc(g.why_ja)}</div>
  </div>`;
}

async function thumbs(shorts, arts) {
  for (const s of shorts) {
    const cv = $(`canvas[data-short="${CSS.escape(s.id)}"]`);
    if (!cv) continue;
    const a = arts.find((x) => x.slug === s.slug);
    const p = await makePlayer(cv, s, { cover: a?.cover, at: 2.2 });
    const card = cv.closest(".reel-i");
    card.addEventListener("mouseenter", () => p.play());
    card.addEventListener("mouseleave", () => p.pause());
    players.push(p);
  }
}

// ---------------- メディア：記事の一覧・記事 ----------------
async function readList() {
  chrome(`<section class="page-h"><span class="num">${KANJI[0]}</span><h1>${t("sec_latest")}</h1><p>${t("sec_latest_sub")}</p></section><div class="sec"><div class="loading">${t("loading")}</div></div>`, { here: "#/read" });
  const arts = await call("/api/articles");
  $(".sec").innerHTML = `<div class="cards">${arts.map(articleCard).join("")}</div>`;
}

function markTerms(text, gloss) {
  let s = esc(text);
  for (const g of gloss) {
    for (const f of [g.ja, ...(g.forms ?? [])]) if (text.includes(f)) s = s.split(esc(f)).join(`<abbr class="gl" title="${esc(tm(g))}">${esc(f)}</abbr>`);
  }
  return s;
}

async function article(slug) {
  chrome(`<div class="loading pad">${t("loading")}</div>`, { here: "#/read", paper: true });
  let a, gloss, shorts;
  try { [a, gloss, shorts] = await Promise.all([call(`/api/articles/${encodeURIComponent(slug)}`), call("/api/glossary"), call("/api/shorts")]); }
  catch { $(".main").innerHTML = `<div class="pad"><h1>Not found</h1><a href="#/read">${t("back")}</a></div>`; return; }
  const sh = shorts.filter((s) => s.slug === slug);
  const jaSide = lang() !== "ja";
  $(".main").innerHTML = `
  <article class="article">
    <header class="art-h">
      <div class="art-cover">${pic(a.cover, ml(a.title))}</div>
      <div class="art-t">
        <div class="meta"><span>${esc(ml(a.tree))}</span><span>${when(a.created)}</span>${sampleTag(a)}</div>
        <h1>${esc(ml(a.title))}</h1>
        <p class="lead">${esc(ml(a.lead))}</p>
        ${a.source ? `<div class="born"><span class="seal sm">縁</span>${t("born")}<a href="#/c/${esc(a.source)}">${t("see_consult")} →</a></div>` : ""}
      </div>
    </header>
    <div class="art-body">
      ${a.sections.map((s, i) => `
        <section class="art-s">
          <h2><span>${NUM[i] ?? i + 1}</span>${esc(ml(s.heading))}</h2>
          ${s.quote_ja ? `<blockquote class="mq"><p ${jaSide ? "" : 'lang="ja"'}>${jaSide ? esc(ml(s.body)) : `「${markTerms(s.quote_ja, gloss)}」`}</p>
            ${jaSide ? `<div class="orig"><em>${t("masters_words")}</em><span lang="ja">${markTerms(s.quote_ja, gloss)}</span></div>` : ""}
            <cite>${esc(s.master ?? "")}</cite></blockquote>` : `<p>${esc(ml(s.body))}</p>`}
        </section>`).join("")}
    </div>
    ${sh.length ? `<aside class="art-short"><h3>${t("article_short")}</h3><div class="mini"><canvas id="artShort"></canvas><button class="play-btn" id="artPlay">▶ ${t("play")}</button></div></aside>` : ""}
    <aside class="askbox"><p>${t("ask_box")}</p><a class="btn gold" href="#/ask">${t("hero_ask")}</a><a class="btn ghost" href="#/help">${t("nav_help")}</a></aside>
  </article>`;
  if (sh.length) {
    const p = await makePlayer($("#artShort"), sh[0], { cover: a.cover, link: `${location.host}`, at: 2.2 });
    players.push(p);
    $("#artPlay").addEventListener("click", () => { p.playing ? p.pause() : p.restart(); });
  }
}

// ---------------- メディア：ショート ----------------
async function shortsList() {
  chrome(`<section class="page-h"><span class="num">${KANJI[1]}</span><h1>${t("sec_shorts")}</h1><p>${t("sec_shorts_sub")}</p></section><section class="sec"><div class="reel wrap"></div></section>`, { here: "#/shorts" });
  const [shorts, arts] = await Promise.all([call("/api/shorts"), call("/api/articles")]);
  $(".reel").innerHTML = shorts.map((s) => `<a class="reel-i" href="#/short/${esc(s.id)}"><canvas data-short="${esc(s.id)}"></canvas><span class="play">▶</span><b>${esc(lang() === "ja" || lang() === "easy" ? s.hook_ja : s.hook_en)}</b>${sampleTag(s)}</a>`).join("");
  thumbs(shorts, arts);
}

async function shortView(id, master = false) {
  const draw = (inner) => (master ? mShell(inner, { back: "#/master/ok" }) : chrome(inner, { here: "#/shorts" }));
  draw(`<div class="loading pad">${t("loading")}</div>`);
  const [shorts, arts] = await Promise.all([call(`/api/shorts${master ? "?all=1" : ""}`, null, master), call(`/api/articles${master ? "?all=1" : ""}`, null, master)]);
  const s = shorts.find((x) => x.id === id);
  if (!s) { location.hash = master ? "#/master/ok" : "#/shorts"; return; }
  const a = arts.find((x) => x.slug === s.slug);
  const origin = location.origin;
  const links = { ig: `${origin}/?src=${s.id}-ig#/read/${s.slug}`, yt: `${origin}/?src=${s.id}-yt#/read/${s.slug}`, tt: `${origin}/?src=${s.id}-tt#/read/${s.slug}` };
  const stage = `
    <div class="stage">
      <div class="phone"><canvas id="sv"></canvas></div>
      <div class="stage-c">
        <button class="btn gold" id="pp">▶ ${t("play")}</button>
        <button class="btn ghost" id="rp">↺ ${t("replay")}</button>
        ${master ? `<button class="btn ghost" id="rec">⤓ 動画ファイルにする（.webm）</button><div id="recst" class="dim"></div>` : ""}
      </div>
    </div>`;
  if (!master) {
    draw(`<section class="short-page">${stage}<div class="short-side"><p class="kicker">${esc(ml(a?.tree))}</p><h1>${esc(lang() === "ja" || lang() === "easy" ? s.hook_ja : s.hook_en)}</h1>${a ? `<a class="btn gold" href="#/read/${esc(s.slug)}">${t("short_read")} →</a>` : ""}${sampleTag(s)}</div></section>`);
  } else {
    const cap = s.captions;
    draw(`
      <h1 class="m-title">ショート動画の下書き ${s.seed ? `<span class="badge">見本</span>` : ""}</h1>
      <p class="m-lead">記事「${esc(a?.title.ja ?? s.slug)}」から AI が作りました。<b>まだどこにも投稿していません。</b>OK を押したものだけ、担当者が各 SNS に出します。</p>
      ${stage}
      <div class="m-card"><h2>場面</h2><ol class="scenes">${s.scenes.map((x) => `<li><span class="sec">${x.sec}秒</span><b>${esc(x.text_ja)}</b><small>${esc(x.text_en)}</small></li>`).join("")}</ol></div>
      <div class="m-card"><h2>SNS ごとの文（下書き）</h2>
        <div class="tabs" id="tabs"><button data-p="ig" class="on">Instagram</button><button data-p="yt">YouTube</button><button data-p="tt">TikTok</button></div>
        ${["ig", "yt", "tt"].map((p, i) => { const c = [cap.instagram, cap.youtube, cap.tiktok][i]; const txt = `${c.title ? c.title + "\n\n" : ""}${c.text}\n\n${c.hashtags.map((h) => "#" + h.replace(/^#/, "")).join(" ")}`; return `<div class="cap ${i ? "hidden" : ""}" data-p="${p}"><pre>${esc(txt)}</pre><div class="link">計測つきリンク：<code>${esc(links[p])}</code></div><button class="big sub copy" data-copy="${esc(txt + "\n" + links[p])}">文とリンクをコピー</button></div>`; }).join("")}
      </div>
      ${s.status === "approved" ? `<div class="m-ok">✓ OK 済み（投稿は担当者が行います）</div>` : `<button class="big main" id="approve">この動画で OK（投稿はしません）</button>`}`);
    $$("#tabs button").forEach((b) => b.addEventListener("click", () => { $$("#tabs button").forEach((x) => x.classList.toggle("on", x === b)); $$(".cap").forEach((c) => c.classList.toggle("hidden", c.dataset.p !== b.dataset.p)); }));
    $$(".copy").forEach((b) => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "コピーしました ✓"; } catch { b.textContent = "コピーできませんでした"; } }));
    $("#approve")?.addEventListener("click", async (e) => { e.target.disabled = true; await call(`/api/shorts/${encodeURIComponent(id)}/approve`, {}, true); shortView(id, true); });
  }
  const p = await makePlayer($("#sv"), s, { cover: a?.cover, link: `${location.host}  ·  link in bio` });
  players.push(p);
  const pp = $("#pp");
  const sync = () => (pp.textContent = p.playing ? `❚❚ ${t("pause")}` : `▶ ${t("play")}`);
  p.onend = sync;
  pp.addEventListener("click", () => { p.playing ? p.pause() : p.play(); sync(); if (store.get("engawa-sound") !== "off") bgm.start(); });
  $("#rp").addEventListener("click", () => { p.restart(); sync(); });
  $("#rec")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    const st = $("#recst");
    try {
      const blob = await p.record((x) => (st.textContent = `書き出し中… ${Math.round(x * 100)}%（BGM ごと録っています）`));
      const url = URL.createObjectURL(blob);
      st.innerHTML = `<a class="btn gold" download="engawa-${esc(s.id)}.webm" href="${url}">⤓ engawa-${esc(s.id)}.webm を保存</a>`;
    } catch { st.textContent = "このブラウザでは書き出せません（Chrome でお試しください）"; }
    e.target.disabled = false;
    sync();
  });
  setTimeout(() => { p.play(); sync(); }, 300);
}

// ---------------- メディア：用語集 ----------------
async function glossaryPage() {
  chrome(`<section class="page-h"><span class="num">辞</span><h1>${t("gloss_title")}</h1><p>${t("gloss_lead")}</p></section>
    <section class="sec"><div class="g-tools"><input id="gq" class="field dark" placeholder="${t("gloss_search")}"><div class="chips"><button class="chip on" data-f="all">${t("gloss_all")}</button><button class="chip" data-f="dialect">${t("gloss_dialect")}</button></div></div><div class="terms" id="gl"></div></section>`, { here: "#/glossary" });
  const gloss = await call("/api/glossary");
  let f = "all";
  const paint = () => {
    const q = $("#gq").value.trim().toLowerCase();
    const list = gloss.filter((g) => (f === "all" || g.dialect) && (!q || [g.ja, g.yomi, g.en, g.es, g.zh, g.literal, g.meaning_ja].join(" ").toLowerCase().includes(q)));
    $("#gl").innerHTML = list.sort((a, b) => (b.dialect ? 1 : 0) - (a.dialect ? 1 : 0)).map(termCard).join("") || `<p class="dim">—</p>`;
  };
  $("#gq").addEventListener("input", paint);
  $$(".chip").forEach((c) => c.addEventListener("click", () => { f = c.dataset.f; $$(".chip").forEach((x) => x.classList.toggle("on", x === c)); paint(); }));
  paint();
}

// ---------------- メディア：掲示板 ----------------
async function board() {
  chrome(`<section class="page-h"><span class="num">掲</span><h1>${t("board_title")}</h1><p>${t("board_desc")}</p></section><section class="sec narrow"><div class="loading">${t("loading")}</div></section>`, { here: "#/board" });
  const list = await call("/api/board");
  $(".sec").innerHTML = `
    <details class="newpost"><summary class="btn gold">${t("board_new")}</summary>
      <div class="form"><input id="bt" class="field dark" placeholder="${t("board_tfield")}"><textarea id="bb" class="field dark" placeholder="${t("board_body")}"></textarea><input id="bn" class="field dark" placeholder="${t("board_name")}"><div id="berr" class="alert hidden"></div><button class="btn gold" id="bpost">${t("board_post")}</button></div>
    </details>
    <div class="threads">${list.map((th) => `<a class="thread" href="#/board/${esc(th.id)}"><span class="lang-b">${esc(th.posts[0]?.lang ?? "")}</span><div><h3>${esc(th.title)}</h3><p>${esc(th.posts[0]?.tr?.[lang() === "easy" ? "ja" : lang()] ?? th.posts[0]?.body ?? "").slice(0, 120)}</p><small>${esc(th.posts[0]?.name)} · ${when(th.created)} · ${th.count} ${t("board_count")}</small></div>${sampleTag(th)}</a>`).join("")}</div>`;
  $("#bpost").addEventListener("click", async () => {
    try {
      const th = await call("/api/board", { title: $("#bt").value, body: $("#bb").value, name: $("#bn").value, lang: lang() === "easy" ? "ja" : lang() });
      location.hash = `#/board/${th.id}`;
    } catch (e) { const er = $("#berr"); er.textContent = e.status === 429 ? t("limit") : t("error"); er.classList.remove("hidden"); }
  });
}

async function thread(id) {
  chrome(`<section class="sec narrow"><div class="loading">${t("loading")}</div></section>`, { here: "#/board" });
  const th = await call(`/api/board/${encodeURIComponent(id)}`).catch(() => null);
  if (!th) { location.hash = "#/board"; return; }
  const want = lang() === "easy" ? "ja" : lang();
  const asMaster = !!(masterName() && code());
  $(".sec").innerHTML = `
    <a class="back-l" href="#/board">← ${t("board_title")}</a>
    <h1 class="th-title">${esc(th.title)} ${sampleTag(th)}</h1>
    <div class="posts">${th.posts.map((p, i) => `
      <div class="post ${p.master ? "is-master" : ""}">
        <div class="who">${p.master ? `<span class="seal sm">職</span>` : ""}<b>${esc(p.name)}</b>${p.master ? `<span class="tag">${t("board_master")}</span>` : ""}<small>${when(p.created)} · ${esc(p.lang)}</small></div>
        ${p.lang !== want && p.tr?.[want] ? `<p class="tr">${esc(p.tr[want])}</p><details><summary>${t("board_orig")}</summary><p lang="${esc(p.lang)}">${esc(p.body)}</p></details>` : `<p lang="${esc(p.lang)}">${esc(p.body)}</p>${p.lang !== want ? `<button class="trbtn" data-i="${i}">${t("board_tr")}</button><p class="tr hidden" id="tr${i}"></p>` : ""}`}
      </div>`).join("")}</div>
    ${th.seed ? "" : `<div class="form reply"><textarea id="rb" class="field dark" placeholder="${t("board_body")}"></textarea><input id="rn" class="field dark" placeholder="${t("board_name")}" value="${esc(asMaster ? masterName() : "")}"><div id="rerr" class="alert hidden"></div><button class="btn gold" id="rpost">${t("board_reply")}</button></div>`}`;
  $$(".trbtn").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    const out = $(`#tr${b.dataset.i}`);
    try { const r = await call(`/api/board/${encodeURIComponent(id)}/translate`, { i: Number(b.dataset.i), lang: want }); out.textContent = r.text ?? t("board_tr_demo"); }
    catch (e) { out.textContent = e.status === 429 ? t("limit") : t("error"); }
    out.classList.remove("hidden");
  }));
  $("#rpost")?.addEventListener("click", async () => {
    try { await call(`/api/board/${encodeURIComponent(id)}/posts`, { body: $("#rb").value, name: $("#rn").value, lang: want }, asMaster); thread(id); }
    catch (e) { const er = $("#rerr"); er.textContent = e.status === 429 ? t("limit") : t("error"); er.classList.remove("hidden"); }
  });
}

// ---------------- メディア：AI 窓口 ----------------
const helpLog = [];
function helpPage() {
  chrome(`<section class="page-h"><span class="num">問</span><h1>${t("help_title")}</h1><p>${t("help_lead")}</p></section>
    <section class="sec narrow"><div class="chat" id="chat"></div>
      <form class="ask-row" id="hf"><input id="hq" class="field dark" placeholder="${t("help_ph")}" autocomplete="off"><button class="btn gold">${t("help_send")}</button></form></section>`, { here: "#/help" });
  const paint = () => {
    $("#chat").innerHTML = helpLog.map((m) => m.q ? `<div class="bubble me">${esc(m.q)}</div>` : `
      <div class="bubble ai"><div class="ai-l"><span class="seal sm">AI</span>${t("help_label")}</div><p>${esc(m.answer).replace(/\n/g, "<br>")}</p>
      ${m.sources?.length ? `<div class="srcs">${m.sources.map((s) => /^[a-z0-9-]+$/.test(s) ? `<a href="#/read/${esc(s)}">${esc(s)}</a>` : `<a href="#/glossary">${esc(s)}</a>`).join("")}</div>` : ""}
      ${m.handoff ? `<a class="btn gold sm" href="#/ask" data-prefill="${esc(m.forQ)}">${t("help_handoff")} →</a>` : ""}</div>`).join("");
    $$("[data-prefill]").forEach((a) => a.addEventListener("click", () => store.sset("engawa-prefill", a.dataset.prefill)));
    $("#chat").lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  paint();
  $("#hf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("#hq").value.trim();
    if (!q) return;
    $("#hq").value = "";
    helpLog.push({ q });
    paint();
    try { const r = await call("/api/help", { q, lang: lang() }); helpLog.push({ ...r, forQ: q }); }
    catch (e) { helpLog.push({ answer: e.status === 429 ? t("limit") : t("error") }); }
    paint();
  });
}

// ---------------- メディア：欲しい木 ----------------
async function wishPage() {
  chrome(`<section class="page-h"><span class="num">望</span><h1>${t("wish_title")}</h1><p>${t("wish_lead")}</p></section><section class="sec narrow"><div class="loading">${t("loading")}</div></section>`, { here: "#/wish" });
  const list = await call("/api/wishes");
  $(".sec").innerHTML = `
    <div class="form wishform"><textarea id="wt" class="field dark" placeholder="${t("wish_ph")}"></textarea><input id="wc" class="field dark" placeholder="${t("wish_country")}"><div id="werr" class="alert hidden"></div><button class="btn gold" id="wsend">${t("wish_send")}</button><p class="dim">${t("wish_note")}</p></div>
    <div class="wishes">${list.map((w) => `
      <div class="wish"><div class="wish-h"><span class="lang-b">${esc(w.country)}</span><small>${when(w.created)}</small>${sampleTag(w)}</div>
        <p class="wish-t">${esc(w.text)}</p>
        <dl>${[["species", w.parsed.species], ["size", w.parsed.size], ["style", w.parsed.style], ["budget", w.parsed.budget]].filter(([, v]) => v).map(([k, v]) => `<div><dt>${t(k)}</dt><dd lang="ja">${esc(v)}</dd></div>`).join("")}</dl>
        <div class="raised ${w.raised.length ? "yes" : ""}">🙋 ${w.raised.length} ${t("wish_raised")}</div></div>`).join("")}</div>`;
  $("#wsend").addEventListener("click", async () => {
    try { await call("/api/wishes", { text: $("#wt").value, country: $("#wc").value }); wishPage(); }
    catch (e) { const er = $("#werr"); er.textContent = e.status === 429 ? t("limit") : t("error"); er.classList.remove("hidden"); }
  });
}

// ---------------- 持ち主：相談を書く ----------------
function paperShell(inner) {
  chrome(`<section class="letter-wrap"><div class="letter">${inner}</div></section>`, { here: "#/ask" });
}
const demoBar = () => (config.demo ? `<div class="demo-flag">${t("demo_banner")}</div>` : "");

function ask() {
  const photos = [];
  const pre = store.sget("engawa-prefill") ?? "";
  store.sset("engawa-prefill", "");
  const defLang = LETTER_LANGS[lang()] && lang() !== "ja" ? lang() : "en";
  paperShell(`${demoBar()}
    <h2>${t("ask_title")}</h2>
    <div><label>${t("ask_photos")}</label><div class="photos" id="photos"></div><input id="file" type="file" accept="image/*" multiple class="hidden"></div>
    <div><label for="q">${t("ask_q")}</label><textarea id="q" class="field" placeholder="${esc(t("ask_q_ph"))}">${esc(pre)}</textarea></div>
    <div><label for="city">${t("ask_city")}</label><input id="city" class="field" placeholder="Lyon, France" autocomplete="address-level2"></div>
    <div><label for="ll">${t("ask_lang")}</label><select id="ll" class="field">${Object.entries(LETTER_LANGS).map(([k, v]) => `<option value="${k}" ${k === defLang ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div id="err" class="alert hidden"></div>
    <button id="go" class="btn-l">${t("ask_go")}</button>
    <div id="busy" class="loading hidden">${t("ask_busy")}</div>
    <a class="sub-link" href="#/c/sample">${t("sample_consult")} →</a>`);
  const paint = () => {
    $("#photos").innerHTML = photos.map((p) => `<img class="ph" src="${p}" alt="">`).join("") + (photos.length < 3 ? `<button class="add" id="add">${t("ask_add")}</button>` : "");
    $("#add")?.addEventListener("click", () => $("#file").click());
  };
  paint();
  $("#file").addEventListener("change", async (e) => {
    for (const f of [...e.target.files].slice(0, 3 - photos.length)) photos.push(await shrink(f));
    e.target.value = "";
    paint();
  });
  $("#go").addEventListener("click", async () => {
    const question = $("#q").value.trim();
    const err = $("#err");
    if (!photos.length || !question) { err.textContent = t("ask_need"); err.classList.remove("hidden"); return; }
    err.classList.add("hidden");
    $("#go").disabled = true;
    $("#busy").classList.remove("hidden");
    try {
      const c = await call("/api/consults", { photos, question, city: $("#city").value.trim(), lang: $("#ll").value, month: new Date().getMonth() + 1 });
      location.hash = `#/c/${c.id}`;
    } catch (e) {
      err.textContent = e.status === 429 ? t("limit") : t("error");
      err.classList.remove("hidden");
      $("#go").disabled = false;
      $("#busy").classList.add("hidden");
    }
  });
}

// ---------------- 持ち主：相談のページ ----------------
const AXES = ["diagnosis", "place", "water", "feed", "repot", "prune", "other"];
async function ownerView(id) {
  let c;
  try { c = await call(`/api/consults/${encodeURIComponent(id)}`); }
  catch { paperShell(`<h2>Not found</h2><a href="#/">${t("back")}</a>`); return; }
  const photos = `<div class="photos">${c.photos.map((p) => pic(p, "", "ph")).join("")}</div>`;

  if (c.status === "intake") {
    const answers = {};
    paperShell(`${c.demo ? demoBar() : ""}
      <h2>${t("few_q")}</h2>${photos}
      <div class="climate">${esc(c.intake.climate_owner)}</div>
      <div class="claude"><small>${t("claude_note")}</small>
        ${c.intake.tree_guess ? `<div>${esc(c.intake.tree_guess)}</div>` : ""}
        ${c.intake.followups.map((f) => `<div><div class="q">${esc(f.question)}</div><div class="chip-row" data-q="${esc(f.id)}">${f.options.map((o) => `<button class="chip">${esc(o)}</button>`).join("")}</div></div>`).join("")}
      </div>
      <button id="send" class="btn-l">${t("send_master")}</button>
      <div id="busy" class="loading hidden">${t("prep")}</div>`);
    $$(".chip-row").forEach((row) => row.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      $$(".chip", row).forEach((x) => x.classList.toggle("on", x === b));
      answers[row.dataset.q] = b.textContent;
    }));
    $("#send").addEventListener("click", async () => {
      $("#send").disabled = true;
      $("#busy").classList.remove("hidden");
      try { await call(`/api/consults/${encodeURIComponent(id)}/answers`, { answers }); ownerView(id); }
      catch { $("#send").disabled = false; $("#busy").classList.add("hidden"); }
    });
    return;
  }

  if (c.status !== "answered" || !c.replies.length) {
    paperShell(`<h2>${t("sent_title")}</h2>
      <div class="wait"><div class="big-seal">待</div>${t("sent_wait")}</div>${photos}
      <div><label>${t("your_q")}</label>${esc(c.question)}</div>`);
    stopTimer();
    timer = setInterval(async () => {
      const n = await call(`/api/consults/${encodeURIComponent(id)}`).catch(() => null);
      if (n?.status === "answered" && n.replies.length) { stopTimer(); ownerView(id); }
    }, 8000);
    return;
  }

  const L = c.letter_lang ?? c.lang;
  const terms = [...new Map(c.replies.flatMap((r) => r.letter.terms ?? []).map((x) => [x.ja, x])).values()];
  const k = c.knowledge;
  const masters = new Set(c.replies.map((r) => r.master)).size;
  paperShell(`${c.seed ? `<div class="demo-flag">${t("sample")} · ${t("footer_seed")}</div>` : ""}
    <div class="ans-h"><span class="big-n">${masters}</span><span>${t("masters_n")}</span></div>
    ${photos}
    <div class="q-quote"><label>${t("your_q")}</label>${esc(c.question)}</div>
    ${c.replies.map((r) => `
    <div class="card">
      <div class="stamp">${esc([...r.master][0] ?? "職")}<br>印</div>
      <h2>${t("letter_title")}</h2>
      <div class="by">${esc(r.master)} · ${t("letter_by")}</div>
      <p class="greet">${esc(r.letter.greeting)}</p>
      ${r.letter.lines.map((l) => `<div class="tip"><b>${esc(l.text)}</b><div class="quote"><em>${t("masters_words")}</em>${esc(l.quote_ja)}</div></div>`).join("")}
      ${r.drawing ? `<img class="drawn" src="${safe(r.drawing)}" alt="">` : ""}
    </div>`).join("")}
    ${terms.length ? `<div class="explain"><h3>${t("terms_title")}</h3>${terms.map((x) => `<div class="ex"><b lang="ja">${esc(x.ja)}</b>${x.dialect ? `<span class="tag">${t("gloss_dialect")}</span>` : ""}<div class="lit"><span>${t("literal")}</span><s>${esc(x.literal)}</s></div><div class="mean"><span>${t("meaning")}</span>${esc(x.rendered)}</div></div>`).join("")}</div>` : ""}
    ${k && masters > 1 ? `<div class="wisdom"><h3>${t("wisdom")}</h3>${AXES.filter((a) => k.axes.some((x) => x.key === a)).map((a) => `<div class="axis"><div class="ax-l">${t("axis_" + a)}</div>${k.axes.find((x) => x.key === a).items.map((i, n, arr) => `<div class="ax-i">${n && arr[n - 1].master === i.master ? "" : `<span class="who">${esc(i.master)}</span>`}${esc(i.text)}</div>`).join("")}</div>`).join("")}</div>` : ""}
    <button class="listen" id="listen"><span class="pl">▶</span>${t("listen")}</button>
    <div><label>${t("record")}</label>
      <div class="log">
        <div class="row"><span class="d">${monthName(c.month)}</span><span>${t("you_asked")}: ${esc(c.question.slice(0, 60))}${c.question.length > 60 ? "…" : ""}</span></div>
        ${c.replies.flatMap((r) => r.letter.reminders).map((r) => `<div class="row"><span class="d next">${monthName(r.month)}</span><span>${esc(r.text)}</span></div>`).join("")}
      </div>
    </div>
    ${c.article ? `<a class="became" href="#/read/${esc(c.article)}"><span class="seal sm">縁</span>${t("became_article")} →</a>` : ""}
    ${c.seed ? "" : `<button id="thanks" class="btn-l ${c.thanked ? "ghost" : ""}" ${c.thanked ? "disabled" : ""}>${c.thanked ? t("thanks_sent") : t("thanks")}</button>`}`);
  $("#listen").addEventListener("click", () => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(c.replies.flatMap((r) => [r.letter.greeting, ...r.letter.lines.map((l) => l.text)]).join(" "));
    u.lang = VOICE[L] || "en-US";
    bgm.duck(true);
    u.onend = () => bgm.duck(false);
    speechSynthesis.speak(u);
  });
  $("#thanks")?.addEventListener("click", async () => { await call(`/api/consults/${encodeURIComponent(id)}/thanks`, {}).catch(() => {}); ownerView(id); });
}

// =====================================================================
// 職人さんの縁側（大きな文字・少ない操作）
// =====================================================================
function mShell(inner, { back = "#/master", title = "" } = {}) {
  document.body.className = `engawa-mode size-${store.get("engawa-size", "l")}`;
  app.innerHTML = `
  ${config.demo ? `<div class="demo-flag">見本の応答で動いています（API キー未設定）</div>` : ""}
  <header class="m-top">
    <a href="${back}" class="m-back">← もどる</a>
    <div class="m-brand"><span class="seal">縁</span>縁側 <small>職人の方の入口</small></div>
    <div class="m-tools"><button class="snd ${bgm.on ? "on" : ""}" aria-pressed="${bgm.on}" title="音">${BARS}</button><button class="m-size" id="msize">文字 ${store.get("engawa-size", "l") === "xl" ? "特大" : "大"}</button></div>
  </header>
  <main class="m-main">${title ? `<h1 class="m-title">${title}</h1>` : ""}${inner}</main>`;
  $("#msize").addEventListener("click", () => { store.set("engawa-size", store.get("engawa-size", "l") === "xl" ? "l" : "xl"); route(); });
}

function codeGate(next) {
  mShell(`<div class="m-card"><h2>合言葉を入れてください</h2><div class="code"><input id="code" type="password" autocomplete="off"><button class="big main" id="ok">開く</button></div></div>`, { back: "#/" });
  $("#ok").addEventListener("click", () => { store.set("engawa-code", $("#code").value.trim()); next(); });
}
function nameGate(next) {
  mShell(`<div class="m-card"><h2>お名前（園の名前）を教えてください</h2><p class="m-lead">持ち主への手紙と記事に、この名前で載ります。</p><input id="nm" class="m-input" placeholder="例：松風園 山田"><button class="big main" id="ok">はじめる</button></div>`, { back: "#/" });
  $("#ok").addEventListener("click", () => { const v = $("#nm").value.trim(); if (!v) return; store.set("engawa-master", v); next(); });
}

async function masterGuard(next) {
  try { await call("/api/inbox", null, true); }
  catch (e) { if (e.status === 401) return codeGate(() => masterGuard(next)); throw e; }
  if (!masterName()) return nameGate(next);
  next();
}

async function masterHome() {
  const [list, arts, shorts, wishes] = await Promise.all([call("/api/inbox", null, true), call("/api/articles?all=1", null, true), call("/api/shorts?all=1", null, true), call("/api/wishes")]);
  const me = masterName();
  const todo = list.filter((c) => !c.seed && !c.replies.some((r) => r.master === me && r.status === "sent")).length;
  const oks = arts.filter((a) => a.status === "draft").length + shorts.filter((s) => s.status === "draft").length;
  const wishN = wishes.filter((w) => !w.raised.includes(me)).length;
  mShell(`
    <div class="m-hello">${esc(me)} さん、ようこそ。<button class="m-link" id="rename">名前を変える</button></div>
    <div class="tiles">
      <a class="tile main" href="#/master/inbox"><span class="t-k">答</span><b>相談に答える</b><small>${todo ? `${todo}件 届いています` : "いまは届いていません"}</small></a>
      <a class="tile" href="#/master/ok"><span class="t-k">可</span><b>記事と動画を見て OK する</b><small>${oks ? `${oks}件 OK を待っています` : "待っているものはありません"}</small></a>
      <a class="tile" href="#/master/wish"><span class="t-k">望</span><b>欲しい木</b><small>${wishN}件 の「欲しい」が届いています</small></a>
      <a class="tile" href="#/master/glossary"><span class="t-k">辞</span><b>用語集を育てる</b><small>訳がおかしい言葉を直す・足す</small></a>
      <a class="tile" href="#/studio"><span class="t-k">数</span><b>数字を見る</b><small>どの動画から何人来たか</small></a>
      <a class="tile" href="#/"><span class="t-k">縁</span><b>メディアを見る</b><small>持ち主が見ている画面</small></a>
    </div>`, { back: "#/" });
  $("#rename").addEventListener("click", () => { store.set("engawa-master", ""); nameGate(masterHome); });
}

async function masterInbox() {
  const list = await call("/api/inbox", null, true);
  const me = masterName();
  const paint = (l) => l.map((c) => {
    const mine = c.replies.some((r) => r.master === me && r.status === "sent");
    const n = new Set(c.replies.filter((r) => r.status === "sent").map((r) => r.master)).size;
    return `<a class="item ${mine ? "" : "new"}" href="#/master/c/${esc(c.id)}">${pic(c.photos[0])}
      <div><div class="t">${esc(c.brief?.asked_ja)}</div>
      <div class="s">${esc(c.city)} ・ <span class="badge ${mine ? "done" : ""}">${mine ? "答えた" : "まだ"}</span>${n ? ` ・ ${n}人が答えた` : ""}${c.seed ? ` ・ <span class="badge">見本</span>` : ""}</div></div></a>`;
  }).join("");
  mShell(`<div class="m-list">${paint(list)}</div>`, { title: "届いた相談" });
  stopTimer();
  timer = setInterval(async () => { if (location.hash !== "#/master/inbox") return; const n = await call("/api/inbox", null, true).catch(() => null); if (n) $(".m-list").innerHTML = paint(n); }, 15000);
}

const PHRASES = [
  "心配いりません。自然なことです。",
  "室内に入れっぱなしは良くないです。冬も外の寒さに当ててください。",
  "水やりは、土の表面が乾いてから、鉢の底から出るまでたっぷりと。",
  "今は切らないで、春まで様子を見てください。",
  "植え替えは春、芽が動き出す前にしてください。",
  "肥料は今は止めてください。",
  "日当たりと風通しのよい所に置いてください。",
];

async function masterAnswer(id) {
  let c;
  try { c = await call(`/api/consults/${encodeURIComponent(id)}`, null, true); } catch { location.hash = "#/master/inbox"; return; }
  const me = masterName();
  if (c.seed || c.replies.some((r) => r.master === me && r.status === "sent")) return masterDone(c);
  const b = c.brief;
  const mine = c.replies.find((r) => r.master === me && r.status === "draft");
  const others = c.replies.filter((r) => r.status === "sent");
  const chosen = new Set(mine?.phrases ?? []);
  mShell(`
    <div class="m-ask"><div class="m-q">${esc(b.asked_ja)}</div><div class="m-from">${esc(c.city)} から</div></div>
    <div class="pic" id="pic">${isIllust(c.photos[0]) ? pic(c.photos[0]) : `<img id="photo" src="${safe(c.photos[0])}" alt="">`}<canvas id="pen"></canvas></div>
    ${c.photos.length > 1 ? `<div class="thumbs">${c.photos.map((p, i) => `<img src="${safe(p)}" data-i="${i}" class="${i ? "" : "on"}" alt="">`).join("")}</div>` : ""}
    <div class="points"><h3>聞かれていること <button class="m-link" id="say">🔊 読み上げる</button></h3><ol>${b.summary_ja.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>
    ${b.facts_ja.length ? `<div class="points"><dl>${b.facts_ja.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd>`).join("")}<dt>木</dt><dd>${esc(b.tree_ja)}</dd></dl></div>` : ""}
    <div class="memo">気候：${esc(c.intake.climate_ja)}</div>
    ${others.length ? `<details class="points"><summary>ほかの職人の答え（${others.length}人）</summary>${others.map((r) => `<p><b>${esc(r.master)}</b>：${esc([r.spoken_ja, ...r.phrases].filter(Boolean).join(" "))}</p>`).join("")}</details>` : ""}

    <button class="big main" id="mic">🎤 話して答える</button>
    <textarea class="said" id="said" placeholder="話した言葉がここに出ます。指で直せます。">${esc(mine?.spoken_ja ?? "")}</textarea>
    <button class="big sub" id="drawBtn">✍️ 写真に書きこむ</button>
    <div class="pen-row hidden" id="penRow"><button id="undo">ひとつ消す</button><button id="clear">全部消す</button><button id="penDone">書き終わり</button></div>
    <button class="big sub" id="phraseBtn">💬 よく使う言葉</button>
    <div id="phrases" class="hidden">${PHRASES.map((p) => `<button class="phrase ${chosen.has(p) ? "on" : ""}">${esc(p)}</button>`).join("")}</div>

    <div id="err" class="alert hidden"></div>
    <button class="big main" id="check">相手に届く文を見る</button>
    <div id="busy" class="loading hidden">AI が訳しています（言葉はそのまま引用します）…</div>
    <div id="draft"></div>`, { back: "#/master/inbox" });

  $("#say").addEventListener("click", () => { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`${b.asked_ja}。${b.summary_ja.join("。")}`); u.lang = "ja-JP"; u.rate = 0.9; bgm.duck(true); u.onend = () => bgm.duck(false); speechSynthesis.speak(u); });

  // 写真への書きこみ
  const cv = $("#pen");
  const ctx = cv.getContext("2d");
  const strokes = [];
  let drawing = false;
  const photoEl = () => $("#pic img");
  const fit = () => { const r = cv.getBoundingClientRect(); cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio; redraw(); };
  function redraw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineWidth = 5 * devicePixelRatio; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#e0321c";
    for (const s of strokes) { ctx.beginPath(); s.forEach(([x, y], i) => (i ? ctx.lineTo(x * cv.width, y * cv.height) : ctx.moveTo(x * cv.width, y * cv.height))); ctx.stroke(); }
  }
  photoEl().addEventListener("load", fit);
  if (photoEl().complete) fit();
  addEventListener("resize", fit);
  $$(".thumbs img").forEach((th) => th.addEventListener("click", () => { photoEl().src = safe(c.photos[+th.dataset.i]); $$(".thumbs img").forEach((x) => x.classList.toggle("on", x === th)); strokes.length = 0; redraw(); }));
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  cv.addEventListener("pointerdown", (e) => { if (!drawing) return; cv.setPointerCapture(e.pointerId); strokes.push([pt(e)]); });
  cv.addEventListener("pointermove", (e) => { if (!drawing || !(e.buttons & 1)) return; strokes.at(-1)?.push(pt(e)); redraw(); });
  $("#drawBtn").addEventListener("click", () => { drawing = true; $("#penRow").classList.remove("hidden"); $("#pic").scrollIntoView({ behavior: "smooth" }); });
  $("#penDone").addEventListener("click", () => { drawing = false; $("#penRow").classList.add("hidden"); });
  $("#undo").addEventListener("click", () => { strokes.pop(); redraw(); });
  $("#clear").addEventListener("click", () => { strokes.length = 0; redraw(); });
  const drawingData = () => {
    if (!strokes.length) return undefined;
    const img = photoEl();
    const out = document.createElement("canvas");
    out.width = img.naturalWidth || 800; out.height = img.naturalHeight || 800;
    const o = out.getContext("2d");
    o.fillStyle = "#efe8d8"; o.fillRect(0, 0, out.width, out.height);
    o.drawImage(img, 0, 0, out.width, out.height);
    o.drawImage(cv, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.82);
  };

  $("#phraseBtn").addEventListener("click", () => $("#phrases").classList.toggle("hidden"));
  $$(".phrase").forEach((p) => p.addEventListener("click", () => { const on = !chosen.has(p.textContent); on ? chosen.add(p.textContent) : chosen.delete(p.textContent); p.classList.toggle("on", on); }));

  // 話して答える（ブラウザの音声入力・日本語）。話すあいだは BGM を小さく
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  $("#mic").addEventListener("click", () => {
    if (!SR) { $("#said").focus(); $("#mic").textContent = "🎤 この端末では文字で入れてください"; return; }
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = "ja-JP"; rec.continuous = true; rec.interimResults = true;
    const base = $("#said").value ? $("#said").value + "\n" : "";
    rec.onresult = (e) => { $("#said").value = base + [...e.results].map((r) => r[0].transcript).join(""); };
    rec.onend = () => { rec = null; bgm.duck(false); $("#mic").textContent = "🎤 話して答える"; $("#mic").classList.remove("rec-on"); };
    bgm.duck(true);
    rec.start();
    $("#mic").textContent = "■ 話し終わったら押す";
    $("#mic").classList.add("rec-on");
  });

  $("#check").addEventListener("click", async () => {
    rec?.stop();
    const spoken_ja = $("#said").value.trim();
    const err = $("#err");
    if (!spoken_ja && !chosen.size) { err.textContent = "話すか、よく使う言葉を選んでください。"; err.classList.remove("hidden"); return; }
    err.classList.add("hidden");
    $("#check").disabled = true;
    $("#busy").classList.remove("hidden");
    try { const d = await call(`/api/consults/${encodeURIComponent(id)}/draft`, { master: me, spoken_ja, phrases: [...chosen], drawing: drawingData() }, true); showDraft(d.reply); }
    catch (e) { err.textContent = e.status === 401 ? "合言葉がちがいます。" : "うまく訳せませんでした。もう一度押してください。"; err.classList.remove("hidden"); }
    finally { $("#check").disabled = false; $("#busy").classList.add("hidden"); }
  });

  function showDraft(r) {
    const L = r.letter;
    $("#draft").innerHTML = `
      ${L.terms?.length ? `<div class="glossbox"><h3>用語集で「意味」に訳した言葉</h3>${L.terms.map((x) => `<div class="gx"><b>${esc(x.ja)}</b>${x.dialect ? `<span class="badge">方言・職人ことば</span>` : ""}<div>直訳だと：<s>${esc(x.literal)}</s> ✗</div><div>届く訳：<b>${esc(x.rendered)}</b> ✓</div></div>`).join("")}<a class="m-link" href="#/master/glossary">訳がおかしいときは用語集を直す →</a></div>` : ""}
      <div class="back"><h3>相手にはこう届きます（日本語に戻したもの）</h3>
        <ol>${L.lines.map((l) => `<li>${esc(l.back_ja)}<br>${l.verbatim ? `<span class="ok">✓ あなたの言葉をそのまま引用</span>` : `<span class="warn">⚠ 言い回しが変わっています。確かめてください</span>`}</li>`).join("")}</ol>
        ${L.reminders.length ? `<h3>この木のお知らせ</h3><ul>${L.reminders.map((x) => `<li>${x.month}月：${esc(x.quote_ja)}</li>`).join("")}</ul>` : ""}
      </div>
      ${L.unclear_ja.length ? `<div class="alert">確かめてほしい所：${L.unclear_ja.map(esc).join("／")}</div>` : ""}
      ${r.drawing ? `<img class="drawn" src="${safe(r.drawing)}" alt="">` : ""}
      <button class="big main" id="send">この内容で送る</button>
      <div class="mode">直したいときは、上の文を直してもう一度「相手に届く文を見る」</div>`;
    $("#draft").scrollIntoView({ behavior: "smooth" });
    $("#send").addEventListener("click", async () => {
      $("#send").disabled = true;
      await call(`/api/consults/${encodeURIComponent(id)}/send`, { master: me }, true);
      masterDone(await call(`/api/consults/${encodeURIComponent(id)}`, null, true));
    });
  }
}

function masterDone(c) {
  const sent = c.replies.filter((r) => r.status === "sent");
  const k = c.knowledge;
  mShell(`
    <div class="m-ok">✓ ${c.seed ? "見本の相談です（職人ふたりが答えたもの）" : "送りました。持ち主に届いています"}</div>
    ${sent.map((r) => `<div class="points"><h3>${esc(r.master)} の言葉</h3><ul>${r.letter.lines.map((l) => `<li>${esc(l.quote_ja)}</li>`).join("")}</ul></div>`).join("")}
    ${k && sent.length > 1 ? `<div class="points"><h3>AI が軸ごとに並べました</h3>${AXES.filter((a) => k.axes.some((x) => x.key === a)).map((a) => `<div class="m-axis"><b>${tl("axis_" + a, "ja")}</b>${k.axes.find((x) => x.key === a).items.map((i) => `<div>${esc(i.master)}：${esc(i.quote_ja)}</div>`).join("")}</div>`).join("")}${k.agree_ja ? `<p class="memo">${esc(k.agree_ja)}</p>` : ""}${k.differ_ja ? `<p class="memo">${esc(k.differ_ja)}</p>` : ""}</div>` : ""}
    ${c.thanked ? `<div class="memo">🙏 持ち主からお礼が届いています</div>` : ""}
    ${c.article ? `<a class="big main" href="#/master/article/${esc(c.article)}">この相談の記事を見る</a>` : `<button class="big main" id="toArticle">この相談を記事にする</button><div class="mode">記事は、職人の言葉をそのまま引用して 5 つの言葉で作ります。OK するまで公開されません。</div>`}
    <div id="busy" class="loading hidden">AI が記事を組んでいます（日本語・やさしい日本語・英語・スペイン語・中国語）…</div>
    <a class="big sub" href="#/master/inbox">一覧にもどる</a>`, { back: "#/master/inbox" });
  $("#toArticle")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    $("#busy").classList.remove("hidden");
    try { const a = await call(`/api/consults/${encodeURIComponent(c.id)}/article`, {}, true); location.hash = `#/master/article/${a.slug}`; }
    catch { e.target.disabled = false; $("#busy").classList.add("hidden"); }
  });
}

async function masterArticle(slug) {
  const a = await call(`/api/articles/${encodeURIComponent(slug)}?noview`, null, true).catch(() => null);
  if (!a) { location.hash = "#/master/ok"; return; }
  let L = "ja";
  const paint = () => {
    mShell(`
      <div class="m-status ${a.status}">${a.status === "published" ? "✓ 公開中" : "下書き（まだ公開していません）"}${a.seed ? " ・ 見本" : ""}</div>
      <div class="tabs" id="lt">${[["ja", "日本語"], ["easy", "やさしい日本語"], ["en", "英語"], ["es", "スペイン語"], ["zh", "中国語"]].map(([k, v]) => `<button data-l="${k}" class="${k === L ? "on" : ""}">${v}</button>`).join("")}</div>
      <div class="m-article">
        <div class="m-cover">${pic(a.cover)}</div>
        <h2>${esc(a.title[L])}</h2><p class="m-lead">${esc(a.lead[L])}</p>
        ${a.sections.map((s) => `<h3>${esc(s.heading[L])}</h3>${s.quote_ja ? `<div class="m-quote">「${esc(s.quote_ja)}」<small>— ${esc(s.master)}（あなたの言葉のまま）</small></div>` : ""}<p>${esc(s.body[L])}</p>`).join("")}
      </div>
      ${a.status === "draft" ? `<button class="big main" id="pub">この記事で OK（公開する）</button>` : `<a class="big sub" href="#/read/${esc(a.slug)}">メディアで見る</a>`}
      <button class="big ${a.status === "draft" ? "sub" : "main"}" id="mk">この記事からショート動画を作る</button>
      <div id="busy" class="loading hidden">AI が台本と SNS ごとの文を作っています…</div>`, { back: "#/master/ok", title: "記事" });
    $$("#lt button").forEach((b) => b.addEventListener("click", () => { L = b.dataset.l; paint(); }));
    $("#pub")?.addEventListener("click", async (e) => { e.target.disabled = true; Object.assign(a, await call(`/api/articles/${encodeURIComponent(slug)}/publish`, {}, true)); paint(); });
    $("#mk").addEventListener("click", async (e) => {
      e.target.disabled = true;
      $("#busy").classList.remove("hidden");
      try { const s = await call(`/api/articles/${encodeURIComponent(slug)}/short`, {}, true); location.hash = `#/master/short/${s.id}`; }
      catch { e.target.disabled = false; $("#busy").classList.add("hidden"); }
    });
  };
  paint();
}

async function masterOK() {
  const [arts, shorts] = await Promise.all([call("/api/articles?all=1", null, true), call("/api/shorts?all=1", null, true)]);
  const da = arts.filter((a) => a.status === "draft"), ds = shorts.filter((s) => s.status === "draft");
  mShell(`
    <p class="m-lead">AI が作った下書きです。OK するまで、どこにも出ません。</p>
    <h2 class="m-h2">記事（${da.length}）</h2>
    <div class="m-list">${da.map((a) => `<a class="item new" href="#/master/article/${esc(a.slug)}">${pic(a.cover)}<div><div class="t">${esc(a.title.ja)}</div><div class="s"><span class="badge">下書き</span></div></div></a>`).join("") || `<div class="mode">いまはありません</div>`}</div>
    <h2 class="m-h2">ショート動画（${ds.length}）</h2>
    <div class="m-list">${ds.map((s) => `<a class="item new" href="#/master/short/${esc(s.id)}">${pic(arts.find((a) => a.slug === s.slug)?.cover)}<div><div class="t">${esc(s.hook_ja)}</div><div class="s"><span class="badge">下書き</span></div></div></a>`).join("") || `<div class="mode">いまはありません</div>`}</div>
    <h2 class="m-h2">OK 済み</h2>
    <div class="m-list">${[...arts.filter((a) => a.status === "published").map((a) => `<a class="item" href="#/master/article/${esc(a.slug)}">${pic(a.cover)}<div><div class="t">${esc(a.title.ja)}</div><div class="s"><span class="badge done">公開中</span>${a.seed ? ` <span class="badge">見本</span>` : ""}</div></div></a>`), ...shorts.filter((s) => s.status === "approved").map((s) => `<a class="item" href="#/master/short/${esc(s.id)}">${pic(arts.find((a) => a.slug === s.slug)?.cover)}<div><div class="t">▶ ${esc(s.hook_ja)}</div><div class="s"><span class="badge done">OK 済み</span>${s.seed ? ` <span class="badge">見本</span>` : ""}</div></div></a>`)].join("")}</div>`, { title: "記事と動画の OK" });
}

async function masterWish() {
  const list = await call("/api/wishes");
  const me = masterName();
  mShell(`
    <p class="m-lead">海外の方の「欲しい木」です。持っていたら手を挙げてください。売り買い・発送・お支払いはここではしません。つなぐだけです。</p>
    <div class="m-list">${list.map((w) => `<div class="wish-m">
      <div class="t">${esc(w.parsed.summary_ja)}</div>
      <div class="s">${esc(w.country)}${w.seed ? ` ・ <span class="badge">見本</span>` : ""}</div>
      <details><summary>原文</summary><p>${esc(w.text)}</p></details>
      <button class="big ${w.raised.includes(me) ? "sub" : "main"} raise" data-id="${esc(w.id)}">${w.raised.includes(me) ? "✓ 手を挙げています（取り消す）" : "🙋 持っています（手を挙げる）"}</button>
      ${w.raised.length ? `<div class="mode">手を挙げた園：${w.raised.map(esc).join("・")}</div>` : ""}</div>`).join("")}</div>`, { title: "欲しい木" });
  $$(".raise").forEach((b) => b.addEventListener("click", async () => { b.disabled = true; await call(`/api/wishes/${encodeURIComponent(b.dataset.id)}/raise`, { master: me }, true); masterWish(); }));
}

async function masterGlossary() {
  const gloss = await call("/api/glossary");
  const me = masterName();
  const form = (g = {}) => `<div class="g-form">
    <label>言葉<input class="m-input" name="ja" value="${esc(g.ja)}" ${g.ja ? "readonly" : ""}></label>
    <label>読み<input class="m-input" name="yomi" value="${esc(g.yomi)}"></label>
    <label>意味（日本語で）<input class="m-input" name="meaning_ja" value="${esc(g.meaning_ja)}"></label>
    <label>なぜそうするか<input class="m-input" name="why_ja" value="${esc(g.why_ja)}"></label>
    <label>英語での訳<input class="m-input" name="en" value="${esc(g.en)}"></label>
    <label>スペイン語での訳<input class="m-input" name="es" value="${esc(g.es)}"></label>
    <label>中国語での訳<input class="m-input" name="zh" value="${esc(g.zh)}"></label>
    <label>直訳すると（まちがいの例）<input class="m-input" name="literal" value="${esc(g.literal)}"></label>
    <label class="cb"><input type="checkbox" name="dialect" ${g.dialect ? "checked" : ""}> 方言・職人ことば</label>
    <button class="big main save">この内容で用語集に入れる</button></div>`;
  mShell(`
    <p class="m-lead">訳がおかしい言葉を直すと、次の相談から、その訳で届きます。英語などは分かる人に頼んでも大丈夫です。</p>
    <details class="m-card"><summary class="big sub">＋ 新しい言葉を足す</summary>${form()}</details>
    <div class="m-list">${gloss.map((g) => `<details class="m-card"><summary><b>${esc(g.ja)}</b>（${esc(g.yomi)}）${g.dialect ? `<span class="badge">方言</span>` : ""}${g.edited_by ? `<span class="badge done">${esc(g.edited_by)} が直した</span>` : ""}<div class="s">${esc(g.meaning_ja)} ／ ${esc(g.en)}</div></summary>${form(g)}</details>`).join("")}</div>`, { title: "用語集を育てる" });
  $$(".save").forEach((b) => b.addEventListener("click", async () => {
    const f = b.closest(".g-form");
    const v = Object.fromEntries([...f.querySelectorAll("input")].map((i) => [i.name, i.type === "checkbox" ? i.checked : i.value]));
    if (!v.ja) return;
    b.disabled = true;
    await call("/api/glossary", { ...v, master: me }, true);
    masterGlossary();
  }));
}

// 数字：どのショートの、どの SNS から何人来たか
async function studio() {
  const [shorts, arts] = await Promise.all([call("/api/shorts?all=1", null, true), call("/api/articles?all=1", null, true)]);
  const P = [["ig", "Instagram"], ["yt", "YouTube"], ["tt", "TikTok"]];
  const sum = (s) => s.hits.ig + s.hits.yt + s.hits.tt;
  const total = shorts.reduce((n, s) => n + sum(s), 0);
  const byP = Object.fromEntries(P.map(([k]) => [k, shorts.reduce((n, s) => n + s.hits[k], 0)]));
  const max = Math.max(1, ...shorts.flatMap((s) => P.map(([k]) => s.hits[k])));
  const amax = Math.max(1, ...arts.map((a) => a.views || 0));
  mShell(`
    <p class="m-lead">ショート動画の説明欄のリンク（計測つき）から、メディアに何人来たか。投稿の数ではなく、<b>来た人の数</b>を見ます。${shorts.some((s) => s.seed) ? "見本の数字がふくまれます。" : ""}</p>
    <div class="kpis"><div><b>${total.toLocaleString()}</b><small>動画から来た人</small></div>${P.map(([k, n]) => `<div><b>${byP[k].toLocaleString()}</b><small>${n}</small></div>`).join("")}</div>
    <h2 class="m-h2">動画ごと</h2>
    ${shorts.map((s) => `<div class="m-card stat"><div class="stat-h"><a href="#/master/short/${esc(s.id)}">▶ ${esc(s.hook_ja)}</a>${s.seed ? `<span class="badge">見本</span>` : ""}${s.status === "draft" ? `<span class="badge">下書き</span>` : ""}</div>
      ${P.map(([k, n]) => `<div class="bar-r"><span>${n}</span><div class="bar"><i class="p-${k}" style="width:${(s.hits[k] / max) * 100}%"></i></div><b>${s.hits[k].toLocaleString()}</b></div>`).join("")}
      <div class="mode">合計 ${sum(s).toLocaleString()} 人</div></div>`).join("")}
    <h2 class="m-h2">記事ごとの読まれた数</h2>
    <div class="m-card">${arts.map((a) => `<div class="bar-r wide"><span>${esc(a.title.ja)}</span><div class="bar"><i style="width:${((a.views || 0) / amax) * 100}%"></i></div><b>${(a.views || 0).toLocaleString()}</b></div>`).join("")}</div>`, { title: "数字を見る" });
}

// ---------------- 画面の切り替え ----------------
function route() {
  stopTimer();
  stopPlayers();
  speechSynthesis?.cancel?.();
  bgm.duck(false);
  const h = location.hash.replace(/^#/, "") || "/";
  const [, a, b, c] = h.split("/");
  document.documentElement.lang = a === "master" || a === "studio" ? "ja" : lang() === "easy" ? "ja" : lang();
  scrollTo(0, 0);
  if (a === "read" && b) return article(b);
  if (a === "read") return readList();
  if (a === "shorts") return shortsList();
  if (a === "short" && b) return shortView(b);
  if (a === "glossary") return glossaryPage();
  if (a === "board" && b) return thread(b);
  if (a === "board") return board();
  if (a === "help") return helpPage();
  if (a === "wish") return wishPage();
  if (a === "ask") return ask();
  if (a === "c" && b) return ownerView(b);
  if (a === "studio") return masterGuard(studio);
  if (a === "master") {
    if (b === "inbox") return masterGuard(masterInbox);
    if (b === "c" && c) return masterGuard(() => masterAnswer(c));
    if (b === "ok") return masterGuard(masterOK);
    if (b === "article" && c) return masterGuard(() => masterArticle(c));
    if (b === "short" && c) return masterGuard(() => shortView(c, true));
    if (b === "wish") return masterGuard(masterWish);
    if (b === "glossary") return masterGuard(masterGlossary);
    if (b && /^[0-9a-f]{16}$/.test(b)) return masterGuard(() => masterAnswer(b));
    return masterGuard(masterHome);
  }
  home();
}
addEventListener("hashchange", route);
route();
