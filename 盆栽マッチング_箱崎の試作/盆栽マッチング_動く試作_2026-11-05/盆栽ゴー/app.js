// 盆栽ゴー（アプリ版）2026-11-08
// 1枚の画面の中で、相談する人（g）と職人（a）を切りかえる。文字は i18n.js（8つの言葉）から。
// サーバーの API（/api/...）につなぐ。AI の鍵がなければ、サーバーが見本の答えを返す（見本モード）。
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const screen = $("#screen");
  const LANGS = ["en", "es", "zh", "fr", "it", "th", "km", "ja"];
  const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  // 言葉は1つ。右上で選んだ言葉で、相談する人の画面も職人の画面も全部出す（11/08）
  let GL = store.get("bg-l", ""); if (!LANGS.includes(GL)) { const n = String(navigator.language || "en").slice(0, 2); GL = LANGS.includes(n) ? n : "en"; }
  let AL = GL;
  const nm = (tc) => (tc ? (GL === "ja" || (GL === "zh" && !/[\u3040-\u30ff]/.test(tc.name_ja || "")) ? tc.name_ja : tc.name_en) || tc.name_en || "" : "");
  let ME = null, MODE = "sample", TEACHERS = [], GLOSSARY = [];
  let toTeacher = "s1", curConsult = null, curTree = null, consults = [];

  /* ── 言葉 ── */
  const D = (L, k) => (I18N[L] && I18N[L][k] != null) ? I18N[L][k] : (I18N[k.startsWith("g.") || k.startsWith("c.") ? "en" : "ja"][k] ?? I18N.en[k] ?? "");
  const sideLang = () => (ME && ME.role === "shokunin") || $("#s-" + cur)?.classList.contains("k") ? AL : GL;
  function langOf(k) { return k.startsWith("g.") ? GL : k.startsWith("a.") ? AL : sideLang(); }
  function t(k, vars) {
    const L = langOf(k), n = I18N[L].names;
    let s = D(L, k).replace(/\{A\}/g, k.startsWith("a.") ? n[AL] : n.ja).replace(/\{G\}/g, n[GL]);
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.split(`{${a}}`).join(b);
    return s;
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // 用語の印：見本の [[key:言葉]] と、サーバーの [[言葉|見出し]] の両方を読む
  const KEY2HEAD = { hazushi: "針金外し", kake: "針金掛け", mekiri: "芽切り", metsumi: "芽摘み", jin: "ジン", nebari: "根張り", tachiagari: "立ち上がり", uekae: "植え替え" };
  const HEAD2KEY = Object.fromEntries(Object.entries(KEY2HEAD).map(([k, v]) => [v, k]));
  function terms(v, side, safe) {
    let s = safe ? String(v) : esc(v);
    const span = (shown, head) => side === "a" ? `<span class="term-a">${shown}</span>` : `<span class="term" role="button" tabindex="0" data-term="${esc(head)}">${shown}</span>`;
    s = s.replace(/\[\[(\w+):([^\]]+)\]\]/g, (m, k, x) => span(x, KEY2HEAD[k] || k));
    s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (m, x, h) => span(x, h));
    return s.replace(/\[\[([^\]]+)\]\]/g, "$1");
  }
  const SPECIES = [["pine", "黒松"], ["juniper", "真柏"], ["whitepine", "五葉松"], ["maple", "もみじ"], ["azalea", "皐月"], ["ume", "梅"], ["zelkova", "けやき"], ["needle", "杜松"]];
  const spName = (k, L) => L === "ja" ? (SPECIES.find((x) => x[0] === k) || [, k])[1] : D(L, "g.tree." + k);
  const TREE_IMG = { pine: "pine", juniper: "juniper", maple: "maple", azalea: "azalea", ume: "ume", whitepine: "white-pine", zelkova: "zelkova", needle: "needle-juniper" };

  /* ── サーバー ── */
  async function api(method, url, body) {
    const r = await fetch("/api" + url, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
    let d = {}; try { d = await r.json(); } catch {}
    if (!r.ok) { const e = new Error(d.error || "error"); e.status = r.status; throw e; }
    return d;
  }
  function errText(e, side) {
    const L = side === "a" ? AL : GL;
    if (e.status === 429) return L === "ja" ? e.message : D(L, "g.x.errLimit");
    if (e.status === 401) return D(L, side === "a" ? "c.err" : "g.x.errLogin");
    return D(L, "c.err");
  }
  function showErr(id, msg) { const el = $(id); el.textContent = msg; el.hidden = !msg; }

  /* ── 写真を、送れる大きさの JPEG にする ── */
  function toB64(src) {
    return new Promise((ok, ng) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        const g = c.getContext("2d"); g.fillStyle = "#F1EDE5"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        ok({ media_type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] });
      };
      img.onerror = ng; img.src = src;
    });
  }
  const fileUrl = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });

  /* ── 下のタブ ── */
  const TABS = {
    g: [["home", "i-home", "g.tab.home"], ["ask", "i-cam", "g.tab.ask"], ["qa", "i-qa", "g.tab.qa"], ["learn", "i-book", "g.tab.learn"]],
    a: [["mhome", "i-home", "a.tab.home"], ["inbox", "i-reply", "a.tab.answer"], ["reg", "i-tree", "a.tab.reg"], ["mlearn", "i-book", "a.tab.learn"]],
  };
  $$("nav[data-tabs]").forEach((nav) => {
    nav.innerHTML = TABS[nav.dataset.tabs].map(([id, ic, k]) => `<button ${id === nav.dataset.on ? 'class="on" aria-current="page"' : ""} data-go="${id}"><svg><use href="#${ic}"/></svg><span data-i18n="${k}"></span></button>`).join("");
  });
  const FIXED = ["dock", "tabs", "busy"];
  $$(".scr").forEach((scr) => {
    const sc = document.createElement("div"); sc.className = "sc";
    [...scr.children].forEach((c) => { if (!FIXED.some((k) => c.classList.contains(k))) sc.appendChild(c); });
    scr.prepend(sc);
  });
  const scroller = (id) => $("#s-" + id + " > .sc");

  /* ── 画面の切り替え ── */
  let cur = "welcome"; const hist = [];
  function show(id, { push = true } = {}) {
    const to = $("#s-" + id); if (!to) return;
    if (id === cur) { enter[id] && enter[id](); return; }
    const from = $("#s-" + cur);
    if (push) hist.push(cur);
    if (hist.length > 30) hist.shift();
    from.classList.remove("on"); from.classList.add("off");
    setTimeout(() => from.classList.remove("off"), 600);
    to.classList.add("on"); scroller(id).scrollTop = 0;
    $("#status").classList.toggle("light", to.hasAttribute("data-light"));
    cur = id; closeSheets();
    applyLang();
    enter[id] && enter[id]();
  }
  function back() { const p = hist.pop(); if (p) show(p, { push: false }); }
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2600); }
  const busy = (id, on) => $(id).classList.toggle("show", on);

  screen.addEventListener("click", (e) => {
    const pk = e.target.closest("[data-pick]"); if (pk) { openPick(pk.dataset.pick); return; }
    if (e.target.closest("[data-cost]")) { openCost(); return; }
    if (e.target.closest("[data-role]")) { show("welcome"); return; }
    const g = e.target.closest("[data-go]"); if (g && !g.disabled) { go(g.dataset.go); return; }
    if (e.target.closest("[data-back]")) { back(); return; }
    const tm = e.target.closest("[data-term]"); if (tm) openGloss(tm.dataset.term);
  });
  screen.addEventListener("keydown", (e) => { const tm = e.target.closest("[data-term]"); if (tm && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openGloss(tm.dataset.term); } });
  // 役割が違う画面へは、まず入口へ
  function go(id) {
    const needA = $("#s-" + id)?.classList.contains("k") && !["mstart"].includes(id);
    const needG = ["home", "ask", "qa", "learn", "answer"].includes(id);
    if (id === "gstart" && ME && ME.role === "aikouka") return show("home");
    if (needA && (!ME || ME.role !== "shokunin")) return show("mstart");
    if (needG && (!ME || ME.role !== "aikouka")) return show("gstart");
    show(id);
  }

  /* ── 入るたびの読み込み ── */
  const enter = {
    async gstart() { $("#gName").value = $("#gName").value || ""; showErr("#gErr", ""); },
    async mstart() {
      showErr("#mErr", "");
      try { const d = await api("GET", "/me"); TEACHERS = d.teachers || []; } catch {}
      $("#whoList").innerHTML = TEACHERS.map((tc) => `<button data-tid="${esc(tc.id)}"><span class="seal">${esc(nm(tc).charAt(0))}</span><div><b>${esc(nm(tc))}</b><span>${esc(t(tc.id.startsWith("t-") ? "a.x.newOne" : "a.x.demo"))}</span></div><span style="margin-left:auto;color:var(--ink-2)">›</span></button>`).join("");
      $("#mSp").innerHTML = SPECIES.map(([k]) => `<label><input type="checkbox" value="${k}" ${k === "pine" ? "checked" : ""}><span>${esc(spName(k, AL))}</span></label>`).join("");
    },
    async home() {
      $("#gHello").textContent = `${t("g.home.hi")}${ME ? ", " + ME.name : ""}`;
      $("#posts").innerHTML = [["pine", 1], ["maple", 2], ["ume", 3]].map(([img, i]) => `<article class="post"><span class="tree"><img src="img/t-${img}.webp" alt=""></span><div class="tx"><div class="eyebrow c">${esc(t(`g.post${i}.e`))}</div><h4>${esc(t(`g.post${i}.h`))}</h4><p>${esc(t(`g.post${i}.p`))}</p><div class="by"><svg><use href="#i-tree"/></svg>BONSAIGO · X · Instagram</div></div></article>`).join("");
      loadQa("", "#homeQa", 2);
      try {
        const d = await api("GET", "/consultations"); consults = d.consultations || [];
        $("#mineList").innerHTML = consults.length ? consults.slice(0, 6).map((c) => `<button class="mine" data-cid="${c.id}"><img src="${c.image ? "data:" + c.image.media_type + ";base64," + c.image.data : "img/ask.jpg"}" alt=""><div><b>${esc(c.answer ? c.answer.headline.replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1") : c.question)}</b><span class="st ${c.answer ? "ok" : "wait"}"><i></i>${esc(t(c.answer ? "g.x.answered" : "g.x.wait"))}</span></div><span class="go" style="margin-left:auto;color:var(--ink-2)">›</span></button>`).join("") : `<div class="empty">${esc(t("g.x.none"))}</div>`;
        // 新しく届いた答えは、上からの知らせで出す
        const seen = new Set(JSON.parse(store.get("bg-seen", "[]")));
        const fresh = consults.find((c) => c.answer && !seen.has(c.id));
        if (fresh) {
          seen.add(fresh.id); store.set("bg-seen", JSON.stringify([...seen]));
          $("#bannerT").textContent = fresh.answer.headline.replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1");
          setTimeout(() => $("#banner").classList.add("show"), 300); setTimeout(() => $("#banner").classList.remove("show"), 3600);
        }
      } catch (e) { if (e.status === 401) { ME = null; show("welcome"); } }
    },
    ask() {
      showErr("#askErr", "");
      if (!$("#askText").value.trim()) $("#askText").value = t("g.q");
      $("#askText").placeholder = t("g.ask.ph");
      $("#toPick").innerHTML = TEACHERS.slice(0, 6).map((tc) => `<button class="${tc.id === toTeacher ? "on" : ""}" data-to="${esc(tc.id)}"><span class="seal">${esc(nm(tc).charAt(0))}</span>${esc(nm(tc))}</button>`).join("");
    },
    answer() { renderAnswer(); },
    qa() { searchQa(); },
    learn() { renderLearn(); },
    async mhome() {
      if (!TEACHERS.length) await refreshTeachers();
      $("#mHello").textContent = ME ? (nm(TEACHERS.find((x) => x.id === ME.teacher_id)) || ME.name) : "";
      try {
        const [c, tr] = await Promise.all([api("GET", "/consultations"), api("GET", "/bonsaigo/trees")]);
        consults = c.consultations || [];
        const waiting = consults.filter((x) => !x.answer).length;
        $("#mN").textContent = waiting; $("#mNbox").hidden = !waiting;
        const qt = $("#mQT"); qt.dataset.i18n = waiting ? "a.mh.qT" : "a.mh.qT0"; qt.dataset.n = waiting; qt.textContent = t(qt.dataset.i18n, { N: waiting });
        $("#mAns").textContent = consults.filter((x) => x.answer).length;
        $("#mPosts").textContent = (tr.trees || []).filter((x) => x.status === "ready").length;
      } catch (e) { if (e.status === 401) { ME = null; show("welcome"); return; } }
      loadCost();
    },
    async inbox() {
      try {
        const d = await api("GET", "/consultations"); consults = d.consultations || [];
        $("#inboxList").innerHTML = consults.length ? consults.map((c) => `<button class="inbox-card ${c.answer ? "done" : ""}" data-cid="${c.id}"><div class="row"><img src="${c.image ? "data:" + c.image.media_type + ";base64," + c.image.data : "img/ask.jpg"}" alt=""><div>${c.answer ? `<span class="st">✓ ${esc(t("a.x.done"))}</span>` : `<span class="new">${esc(t("a.x.notYet"))}</span>`}<p>${esc(forCraft(c).title || "")}</p></div></div><div class="from"><span>${esc(t("a.x.from", { L: I18N[AL].names[c.lang] || c.lang }))}</span><span>${esc(new Date(c.at).toLocaleDateString(AL === "zh" ? "zh-CN" : AL))}</span></div></button>`).join("") : `<div class="empty" style="margin-top:16px">${esc(t("a.x.inboxNone"))}</div>`;
      } catch (e) { if (e.status === 401) { ME = null; show("welcome"); } }
    },
    detail() { renderDetail(); },
    reg() { renderReg(); },
    mlearn() {
      $("#mlList").innerHTML = Object.entries(KEY2HEAD).map(([k, kj]) => `<div class="ml"><div class="kj">${kj}<small>${esc(ROMA[k])}</small></div><div class="tr"><span>${esc(D(GL, `g.gloss.${k}.m`))}</span></div></div>`).join("");
    },
  };
  const ROMA = { hazushi: "harigane-hazushi", kake: "harigane-kake", mekiri: "mekiri", metsumi: "metsumi", jin: "jin", nebari: "nebari", tachiagari: "tachiagari", uekae: "uekae" };

  /* ── はじまり・ログイン ── */
  $("#b-gstart").addEventListener("click", async () => {
    const name = $("#gName").value.trim() || "Guest";
    try { const d = await api("POST", "/login", { role: "aikouka", name, lang: GL }); ME = d.user; await refreshTeachers(); show("home"); }
    catch (e) { showErr("#gErr", errText(e, "g")); }
  });
  $("#whoList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-tid]"); if (!b) return;
    try { const d = await api("POST", "/login", { role: "shokunin", teacher_id: b.dataset.tid }); ME = d.user; show("mhome"); }
    catch (er) { showErr("#mErr", errText(er, "a")); }
  });
  $("#b-mreg").addEventListener("click", async () => {
    const name = $("#mName").value.trim();
    const sp = $$("#mSp input:checked").map((i) => spName(i.value, "ja"));
    if (!name) return showErr("#mErr", t("a.x.errName"));
    if (!sp.length) return showErr("#mErr", t("a.x.errSp"));
    try { const d = await api("POST", "/login", { role: "shokunin", name, place: $("#mPlace").value.trim(), specialties: sp, lang: AL }); ME = d.user; await refreshTeachers(); show("mhome"); }
    catch (e) { showErr("#mErr", errText(e, "a")); }
  });
  async function refreshTeachers() { try { const d = await api("GET", "/me"); TEACHERS = d.teachers || []; if (!TEACHERS.some((x) => x.id === toTeacher) && TEACHERS[0]) toTeacher = TEACHERS[0].id; } catch {} }

  /* ── 相談する ── */
  let askPhoto = { src: "img/ask.jpg" };
  $("#askFile").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; const u = await fileUrl(f); setPhoto("#askPhoto", u); $("#askPhoto").classList.add("own"); askPhoto = { src: u }; });
  $("#askSample").addEventListener("click", () => { setPhoto("#askPhoto", "img/ask.jpg"); $("#askPhoto").classList.remove("own"); askPhoto = { src: "img/ask.jpg" }; });
  function setPhoto(box, src) { const b = $(box); b.classList.add("swap"); setTimeout(() => { $("img", b).src = src; b.classList.remove("swap"); }, 220); }
  $("#toPick").addEventListener("click", (e) => { const b = e.target.closest("[data-to]"); if (!b) return; toTeacher = b.dataset.to; $$("#toPick button").forEach((x) => x.classList.toggle("on", x === b)); });
  $("#b-send").addEventListener("click", async () => {
    const q = $("#askText").value.trim(); if (!q) return showErr("#askErr", t("g.x.errEmpty"));
    showErr("#askErr", ""); busy("#askBusy", true);
    try {
      const image = await toB64(askPhoto.src);
      const c = await api("POST", "/consultations", { question: q, lang: GL, teacher_id: toTeacher, images: [image] });
      busy("#askBusy", false); $("#askText").value = "";
      $("#j1t").textContent = q;
      // 職人に届く中身。見本モードは、選んだ言葉で「職人にはこう届く」を見せる（画面に別の言葉を混ぜない）
      $("#j2l").textContent = D(GL, "a.sumLbl").replace(/\{A\}/g, I18N[GL].names.ja);
      if (MODE === "sample") $("#j2t").innerHTML = D(GL, "a.sum");
      else $("#j2t").innerHTML = esc(c.for_craftsperson?.summary_ja || "") + (c.for_craftsperson?.points_ja?.length ? `<br><br>${c.for_craftsperson.points_ja.map((p) => `<mark>${esc(p)}</mark>`).join("<br>")}` : "");
      const tc = TEACHERS.find((x) => x.id === toTeacher);
      show("sent");
      $("#jd b").textContent = "✓ " + nm(tc);
    } catch (e) { busy("#askBusy", false); showErr("#askErr", errText(e, "g")); }
  });
  const enterSent = () => {
    ["#j1", "#jf", "#j2", "#jd"].forEach((s) => $(s).classList.remove("show"));
    [["#j1", 250], ["#jf", 1000], ["#j2", 1800], ["#jd", 2900]].forEach(([s, ms]) => setTimeout(() => $(s).classList.add("show"), ms));
  };
  enter.sent = enterSent;
  $("#b-sentHome").addEventListener("click", () => show("home"));

  /* ── 答えを読む（相談する人） ── */
  $("#mineList").addEventListener("click", (e) => { const b = e.target.closest("[data-cid]"); if (!b) return; curConsult = consults.find((c) => c.id === b.dataset.cid); show("answer"); });
  $("#banner").addEventListener("click", () => { const c = consults.find((x) => x.answer); if (c) { curConsult = c; show("answer"); } });
  function verifiedBox(review, side) {
    if (!review || !review.checked) return "";
    const L = side === "a" ? AL : GL, conf = typeof review.confidence === "number" ? review.confidence : null;
    const low = review.needs_person || review.ok === false;
    const head = side === "a" ? t(low ? "a.x.confLow" : "a.x.confOk") : D(L, "g.x.checkedS");
    const body = side === "a" ? "" : D(L, "g.x.checked");
    return `<div class="verified ${low ? "low" : ""}"><span class="ok"><svg><use href="#${low ? "i-hold" : "i-check"}"/></svg></span><div><b>${esc(head)}</b>${body ? `<span>${esc(body)}</span>` : ""}${review.sample ? `<div class="sample-note"><i>SAMPLE</i>${esc(D(L, side === "a" ? "c.mode.sample" : "g.x.sample"))}</div>` : ""}</div>${conf != null ? `<span class="score">${conf.toFixed(2)}</span>` : ""}</div>`;
  }
  function renderAnswer() {
    const c = curConsult; if (!c) return;
    const tc = TEACHERS.find((x) => x.id === c.teacher_id);
    $("#ansWho").textContent = nm(tc) || t("g.banner.b");
    $("#ansBy").textContent = t("g.ans.by");
    $("#ansImg").src = c.image ? `data:${c.image.media_type};base64,${c.image.data}` : "img/ask.jpg";
    $("#ansQ").textContent = c.question;
    if (!c.answer) { $("#ansBody").innerHTML = `<div class="empty">${esc(t("g.x.wait"))}</div>`; $("#ansCheck").innerHTML = ""; $("#jpOrig").textContent = ""; return; }
    $("#ansBody").innerHTML = `<h2>${terms(c.answer.headline, "g")}</h2>${c.answer.paragraphs.map((p) => `<p>${terms(p, "g")}</p>`).join("")}`;
    $("#ansCheck").innerHTML = verifiedBox(c.answer.review, "g");
    $("#jpOrig").textContent = c.answer.back_translation_ja || "";
    $("#jpOrig").lang = "ja";
  }
  $("#jpBtn").addEventListener("click", () => { const b = $("#jpOrig"); b.hidden = !b.hidden; });

  /* ── Q&A（どの言葉からでも探せる） ── */
  let qaTimer;
  async function loadQa(q, box, limit) {
    try {
      const d = await api("GET", `/bonsaigo/qa?lang=${GL}&q=${encodeURIComponent(q)}`);
      const items = d.items.slice(0, limit || 20);
      if (box === "#qaList") {
        $("#qaCount").textContent = items.length === 1 ? t("g.x.qaHits1") : t("g.x.qaHits", { N: items.length });
        // 言葉をまたいで探した言い方を見せる（どの言葉で打っても同じ答えに当たる、の証拠）
        $("#qaAlso").innerHTML = q && d.also && d.also.length ? `<svg><use href="#i-globe"/></svg><span>${esc(t("g.x.alsoSearched"))}</span>` : "";
      }
      $(box).innerHTML = items.length ? items.map((it) => `<div class="qa"><div class="top"><span class="tree">${it.tree ? `<img src="img/t-${TREE_IMG[it.tree] || it.tree}.webp" alt="">` : `<img src="img/ask.jpg" alt="" style="object-fit:cover;height:100%">`}</span><div><b>${esc(it.q)}</b><div class="meta">${it.tree ? `<span>${esc(t("g.tree." + it.tree))}</span>` : ""}${it.asked_in && it.asked_in !== GL ? `<span>${esc(t("g.x.askedIn", { L: I18N[GL].names[it.asked_in] || it.asked_in }))}</span>` : ""}${it.other_lang && q ? `<span class="other"><svg><use href="#i-globe"/></svg>${esc(t("g.x.qaOther"))}</span>` : ""}</div></div></div><div class="a">${terms(it.a, "g")}</div></div>`).join("") : `<div class="empty" style="margin-top:12px">${esc(t("g.x.qaNone"))}</div>`;
    } catch {}
  }
  function searchQa() {
    const q = $("#qaQ").value.trim(); $("#qaClear").hidden = !q;
    $("#qaChips").innerHTML = ["juniper", "pine", "maple", "azalea", "ume"].map((k) => `<button class="chip" data-f="${k}">${esc(t("g.tree." + k).replace(/\s*\(.*\)$/, ""))}</button>`).join("");
    loadQa(q, "#qaList");
  }
  $("#qaQ").addEventListener("input", () => { clearTimeout(qaTimer); qaTimer = setTimeout(searchQa, 220); });
  $("#qaClear").addEventListener("click", (e) => { e.preventDefault(); $("#qaQ").value = ""; searchQa(); });
  $("#qaChips").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; $("#qaQ").value = b.textContent; searchQa(); });

  /* ── 学ぶ（記事と用語） ── */
  let seg = "art";
  const ARTS = [["g.art1", "img/grow.jpg", 2], ["g.art2", "../共通/写真/A_使える_2階から見た盆栽庭園の全景_横.jpg", 3], ["g.art3", "../共通/写真/A_使える_美術館の入口の小道_縦.jpg", 2]];
  function renderLearn() {
    $$("#learnSeg button").forEach((b) => b.classList.toggle("on", b.dataset.seg === seg));
    $("#artList").hidden = seg !== "art"; $("#glWrap").hidden = seg !== "gl";
    $("#artList").innerHTML = ARTS.map(([k, img, min], i) => `<button class="art" data-art="${i}"><div class="ph"><img src="${img}" alt=""></div><div class="tx"><div class="eyebrow c">${esc(t("g.x.min", { N: min }))}</div><h4>${esc(t(k + ".t"))}</h4><div class="body">${t(k + ".p")}</div><span class="more">${esc(t("g.x.art"))} ›</span></div></button>`).join("");
    $("#glList").innerHTML = Object.entries(KEY2HEAD).map(([k, kj]) => `<button class="gl" data-term="${kj}"><span class="kj">${kj}<small>${ROMA[k]}</small></span><span class="m">${esc(t(`g.gloss.${k}.m`))}</span><span class="go">›</span></button>`).join("");
  }
  $("#learnSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-seg]"); if (!b) return; seg = b.dataset.seg; renderLearn(); });
  $("#artList").addEventListener("click", (e) => { const b = e.target.closest(".art"); if (b) b.classList.toggle("open"); });

  /* ── 用語の札（意味と、なぜそうするか） ── */
  function openGloss(head) {
    const k = HEAD2KEY[head], g = GLOSSARY.find((x) => x.ja === head);
    if (!k && !g) return;
    $("#gK").textContent = head; $("#gR").textContent = k ? ROMA[k] : (g.yomi || "");
    if (k) { $("#gM").textContent = t(`g.gloss.${k}.m`); $("#gP").textContent = t(`g.gloss.${k}.p`); $("#gW").textContent = ""; }
    else { $("#gM").textContent = g.common_en || ""; $("#gP").textContent = g.meaning_en || ""; $("#gW").innerHTML = g.why_en ? `<b>${esc(t("g.x.why"))}</b> · ${esc(g.why_en)}` : ""; }
    const host = $("#s-" + cur); if (!host.contains($("#sheet"))) host.append($("#veil"), $("#sheet"));
    $("#veil").classList.add("show"); $("#sheet").classList.add("show");
  }
  function closeSheets() { ["#veil", "#sheet", "#lveil", "#lsheet", "#costSheet"].forEach((s) => $(s).classList.remove("show")); }
  $("#veil").addEventListener("click", closeSheets); $("#sheet").addEventListener("click", closeSheets);

  /* ── 職人：相談を読んで、答える ── */
  $("#inboxList").addEventListener("click", (e) => { const b = e.target.closest("[data-cid]"); if (!b) return; curConsult = consults.find((c) => c.id === b.dataset.cid); $("#ansText").value = ""; show("detail"); });
  let draftPoll;
  function renderDetail() {
    const c = curConsult; if (!c) return;
    const fc = forCraft(c);
    $("#dEye").textContent = t("a.x.from", { L: I18N[AL].names[c.lang] || c.lang });
    $("#dTitle").textContent = fc.title || "";
    $("#dImg").src = c.image ? `data:${c.image.media_type};base64,${c.image.data}` : "img/ask.jpg";
    $("#dMitate").textContent = fc.mitate || "";
    $("#dPoints").innerHTML = (fc.points || []).map((p) => `<li>${esc(p)}</li>`).join("");
    $("#dTerms").innerHTML = (fc.terms || []).map((w) => `<span class="chip">${esc(w)}</span>`).join("");
    $("#origBtn").textContent = t("a.det.orig").replace(/\{G\}/g, I18N[AL].names[c.lang] || c.lang);
    $("#origBody").textContent = c.question; $("#origBody").hidden = true;
    $("#ansText").placeholder = t("a.x.editPh");
    if (c.answer) $("#ansText").value = c.answer.voice_ja || $("#ansText").value;
    paintDraft(c);
    clearInterval(draftPoll);
    if (c.ai_draft_status === "making") {
      let n = 0;
      draftPoll = setInterval(async () => {
        if (cur !== "detail" || ++n > 20) return clearInterval(draftPoll);
        try { const d = await api("GET", "/consultations"); const nc = d.consultations.find((x) => x.id === c.id); if (nc && nc.ai_draft_status !== "making") { curConsult = nc; paintDraft(nc); clearInterval(draftPoll); } } catch {}
      }, 1500);
    }
  }
  const plain = (k) => t(k).replace(/<br>/g, " ").replace(/\[\[[^:\]|]+:([^\]]+)\]\]/g, "$1").replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1").replace(/<[^>]+>/g, "");
  // 職人に見せる相談の中身。見本モードは選んだ言葉の見本、本物のAIのときは日本語（職人向け）
  function forCraft(c) {
    const f = c.for_craftsperson || {};
    if (MODE === "sample") return { title: plain("a.det.h2"), mitate: plain("a.det.cap"), points: [1, 2, 3, 4].map((i) => plain(`a.det.li${i}`)), terms: [D("ja", "a.det.t1"), D("ja", "a.det.t2")] };
    return { title: f.title_ja, mitate: f.ai_mitate_ja, points: f.points_ja, terms: f.terms_ja };
  }
  function draftOf(c) {
    const d = c.ai_draft; if (!d) return null;
    if (MODE === "sample") return { text: ["a.dr.s1", "a.dr.s2", "a.dr.s3"].map(plain).join(GL === "ja" || GL === "zh" ? "" : " "), checks: [] };
    return { text: d.draft_ja, checks: d.check_ja || [] };
  }
  function paintDraft(c) {
    const s = c.ai_draft_status, d0 = draftOf(c), d = d0 && { draft_ja: d0.text, check_ja: d0.checks };
    $("#b-useDraft").disabled = !d;
    $("#dDraft").innerHTML = `<div class="hd"><b>${esc(t("a.dr.hd"))}</b><span>${s === "making" ? "Sonnet…" : "Sonnet"}</span></div>` +
      (s === "making" ? `<div class="dr-text" style="color:var(--ink-2)">${esc(t("a.x.making"))}</div>` : d ? `<div class="dr-text">${esc(d.draft_ja)}</div>${d.check_ja?.length ? `<div style="padding:0 12px 12px"><b style="font-size:12.5px;color:var(--copper)">${esc(t("a.x.checkList"))}</b><ul class="checks">${d.check_ja.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}` : `<div class="dr-text" style="color:var(--ink-2)">${esc(t("a.x.noDraft"))}</div>`);
  }
  $("#origBtn").addEventListener("click", () => { const b = $("#origBody"); b.hidden = !b.hidden; });
  let fromDraft = false;
  $("#b-useDraft").addEventListener("click", () => { const d = curConsult && draftOf(curConsult); if (!d) return; $("#ansText").value = d.text; fromDraft = true; $("#ansText").focus(); });

  // 声で入れる（ブラウザの音声入力。使えないときは文字で）
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SRL = { ja: "ja-JP", en: "en-US", es: "es-ES", zh: "zh-CN", fr: "fr-FR", it: "it-IT", th: "th-TH", km: "km-KH" };
  let rec = null;
  function voiceInto(btn, field) {
    if (!SR) { toast(t("a.x.voiceNo")); field.focus(); return; }
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = SRL[AL] || "ja-JP"; rec.interimResults = true; rec.continuous = true;
    const base = field.value ? field.value + (AL === "ja" || AL === "zh" ? "" : " ") : "";
    btn.classList.add("mic-on"); $("span", btn).textContent = t("a.x.voiceStop");
    rec.onresult = (e) => { field.value = base + [...e.results].map((r) => r[0].transcript).join(""); };
    rec.onend = () => { rec = null; btn.classList.remove("mic-on"); $("span", btn).textContent = t("a.x.voice"); };
    rec.onerror = () => toast(t("a.x.voiceNo"));
    rec.start();
  }
  $("#b-mic").addEventListener("click", () => voiceInto($("#b-mic"), $("#ansText")));
  $("#b-regMic").addEventListener("click", () => voiceInto($("#b-regMic"), $("#regNote")));

  let pending = null;
  $("#b-preview").addEventListener("click", async () => {
    const voice = $("#ansText").value.trim(); if (!voice) return showErr("#dErr", t("a.x.editPh"));
    showErr("#dErr", ""); busy("#dBusy", true);
    try {
      const r = await api("POST", `/consultations/${curConsult.id}/answer`, { voice, preview: true, from_draft: fromDraft });
      pending = r.pending_answer; busy("#dBusy", false); show("confirm");
    } catch (e) { busy("#dBusy", false); showErr("#dErr", errText(e, "a")); }
  });
  enter.confirm = () => {
    if (!pending || !curConsult) return;
    const L = curConsult.lang;
    $("#confLang").textContent = (I18N[L]?.self || L).toUpperCase();
    $("#confBody").innerHTML = `<h5>${terms(pending.headline, "a")}</h5>${pending.paragraphs.map((p) => `<p>${terms(p, "a")}</p>`).join("")}`;
    $("#confBody").lang = L;
    $("#confCheck").innerHTML = verifiedBox(pending.review, "a");
    $("#confBackB").textContent = D(AL, "a.conf.backB").replace(/\{G\}/g, I18N[AL].names[L] || L).replace(/\{A\}/g, I18N[AL].names.ja);
    $("#confBack").textContent = MODE === "sample" ? plain("a.conf.back") : pending.back_translation_ja;
    const low = pending.review?.needs_person || pending.review?.ok === false;
    $("#replyLbl").textContent = t(low ? "a.x.sendAnyway" : "a.x.send");
    showErr("#cErr", "");
  };
  $("#b-reply").addEventListener("click", async () => {
    try {
      await api("POST", `/consultations/${curConsult.id}/answer`, { confirm: true, at: pending && pending.at });
      toast(t("a.x.sent").replace(/\{G\}/g, I18N[AL].names[curConsult.lang] || curConsult.lang));
      pending = null; fromDraft = false; hist.length = 0; show("inbox", { push: false });
    } catch (e) { showErr("#cErr", errText(e, "a")); }
  });

  /* ── 職人：木を登録 → 2段の確かめ → 送ったら、こう出る ── */
  let regPhoto = { kind: "pine", src: "img/reg.jpg" };
  function renderReg() {
    $("#regSp").innerHTML = SPECIES.map(([k]) => `<option value="${k}">${esc(spName(k, AL))}</option>`).join("");
    $("#regSp").value = regSp; $("#regNote").placeholder = t("a.x.notePh");
    $("#regResult").innerHTML = ""; showErr("#rErr", "");
    $$("#regSample,#regNg").forEach((b) => b.classList.toggle("on", b.dataset.s === regPhoto.kind));
  }
  let regSp = "pine";
  $("#regSp").addEventListener("change", (e) => { regSp = e.target.value; });
  function pickReg(kind, src) { regPhoto = { kind, src }; setPhoto("#regPhoto", src); $$("#regSample,#regNg").forEach((b) => b.classList.toggle("on", b.dataset.s === kind)); $("#regResult").innerHTML = ""; }
  $("#regSample").addEventListener("click", () => pickReg("pine", "img/reg.jpg"));
  $("#regNg").addEventListener("click", () => pickReg("ng", "img/room.jpg"));
  $("#regFile").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; pickReg("own", await fileUrl(f)); });
  const imgReason = (tr) => { const ic = tr.image_check || {}; if (ic.failed) return t("a.x.img.err"); if (MODE === "sample") return t(`a.x.img.${tr.sample === "pine" ? "ok" : tr.sample === "ng" ? "ng" : "unsure"}`); return (ic.reasons && ic.reasons[GL]) || (GL === "ja" ? ic.reason_ja : ic.reason_en); };
  const textProblems = (tc) => tc.codes && tc.codes.length ? tc.codes.map((c) => t("a.rule." + c)) : tc.problems_by_lang && tc.problems_by_lang[GL] ? [tc.problems_by_lang[GL]] : (GL === "ja" ? tc.problems_ja : tc.problems_en) || [];
  const confTxt = (c) => (typeof c === "number" ? c.toFixed(2) : "–");
  function verdict(kind, title, lines, by) {
    return `<div class="verdict v-${kind}"><div class="hd"><span class="ic"><svg><use href="#${kind === "hold" ? "i-hold" : "i-x"}"/></svg></span><b>${esc(title)}</b></div>${lines.length > 1 ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p>${esc(lines[0] || "")}</p>`}<div class="by"><span>${esc(by)}</span></div></div>`;
  }
  $("#b-regGo").addEventListener("click", async () => {
    showErr("#rErr", ""); $("#regResult").innerHTML = "";
    $("#rBusyT").textContent = t("a.x.chkImg"); $("#rBusyM").textContent = `Haiku · ${t("a.x.pass")}`;
    busy("#rBusy", true); $("#scan").classList.add("on");
    const swap = setTimeout(() => { $("#rBusyT").textContent = t("a.x.drafting"); $("#rBusyM").textContent = t("a.x.writing8"); }, 1400);
    try {
      const image = await toB64(regPhoto.src);
      const tr = await api("POST", "/bonsaigo/trees", { images: [image], sample: regPhoto.kind, species: spName($("#regSp").value, "ja"), age: $("#regAge").value, note: $("#regNote").value });
      clearTimeout(swap); busy("#rBusy", false); $("#scan").classList.remove("on");
      curTree = tr; curTree.src = regPhoto.src;
      const ic = tr.image_check || {}, reason = imgReason(tr);
      const by = `${t("a.x.byAi")} · ${t("a.x.conf", { P: confTxt(ic.confidence) })} · ${t("a.x.pass")}`;
      if (tr.status === "image_failed") { $("#regResult").innerHTML = verdict("ng", t("a.x.imgFail"), [reason], by) + `<button class="cta ghost" style="margin-top:12px" id="b-retake">${esc(t("a.x.retake"))}</button>`; scrollEnd("reg"); return; }
      if (tr.status === "image_held") { $("#regResult").innerHTML = verdict("hold", t("a.x.held"), [t("a.x.imgLow"), reason], by); scrollEnd("reg"); return; }
      show("posts");
    } catch (e) { clearTimeout(swap); busy("#rBusy", false); $("#scan").classList.remove("on"); showErr("#rErr", errText(e, "a")); }
  });
  $("#regResult").addEventListener("click", (e) => { if (e.target.closest("#b-retake")) pickReg("pine", "img/reg.jpg"); });
  const scrollEnd = (id) => setTimeout(() => scroller(id).scrollTo({ top: scroller(id).scrollHeight, behavior: "smooth" }), 80);

  enter.posts = () => {
    const tr = curTree; if (!tr || !tr.draft) return;
    const ic = tr.image_check || {};
    $("#pcImgT").textContent = imgReason(tr); $("#pcImgC").textContent = confTxt(ic.confidence);
    $("#pX").value = tr.draft.x[GL]; $("#pIg").value = tr.draft.instagram[GL];
    $("#pAllBody").innerHTML = LANGS.map((l) => `<div class="l" lang="${l}"><i>${l.toUpperCase()}</i><span>${esc(tr.draft.x[l])}</span></div>`).join("");
    $("#textResult").innerHTML = "";
  };
  $("#b-tryNg").addEventListener("click", () => { $("#pX").value = t("a.x.ngText"); $("#pX").focus(); });
  $("#b-postOk").addEventListener("click", async () => {
    const tr = curTree; if (!tr) return;
    busy("#pBusy", true); $("#textResult").innerHTML = "";
    try {
      const r = await api("POST", `/bonsaigo/trees/${tr.id}/check`, { x: { ...tr.draft.x, [GL]: $("#pX").value }, instagram: { ...tr.draft.instagram, [GL]: $("#pIg").value } });
      busy("#pBusy", false);
      Object.assign(curTree, r);
      const tc = r.text_check || {}, probs = textProblems(tc);
      const by = tc.by === "rules" ? t("a.x.byRules") : `${t("a.x.byAi")} · ${t("a.x.conf", { P: confTxt(tc.confidence) })} · ${t("a.x.pass")}`;
      if (r.status === "text_failed") { $("#textResult").innerHTML = verdict("ng", t("a.x.textFail"), probs || [], by); scrollEnd("posts"); return; }
      if (r.status === "text_held") { $("#textResult").innerHTML = verdict("hold", t("a.x.held"), [t("a.x.imgLow")], by); scrollEnd("posts"); return; }
      show("pub");
    } catch (e) { busy("#pBusy", false); $("#textResult").innerHTML = `<p class="err">${esc(errText(e, "a"))}</p>`; }
  });
  let pubLang = "en";
  function paintPub() {
    const f = curTree?.final || curTree?.draft; if (!f) return;
    $("#pubLangs").innerHTML = LANGS.map((l) => `<button class="chip ${l === pubLang ? "on" : ""}" data-pl="${l}">${esc(I18N[l].self)}</button>`).join("");
    $("#pubX").textContent = f.x[pubLang]; $("#pubIg").textContent = f.instagram[pubLang];
    $("#pubX").lang = $("#pubIg").lang = pubLang;
  }
  $("#pubLangs").addEventListener("click", (e) => { const b = e.target.closest("[data-pl]"); if (!b) return; pubLang = b.dataset.pl; paintPub(); });
  enter.pub = () => {
    const tr = curTree; if (!tr) return;
    pubLang = GL;
    ["#pubImg1", "#pubImg2"].forEach((s) => ($(s).src = tr.src || "img/reg.jpg"));
    const ic = tr.image_check || {};
    $("#pc1T").textContent = imgReason(tr); $("#pc1C").textContent = confTxt(ic.confidence);
    $("#pc2C").textContent = confTxt(tr.text_check?.confidence);
    paintPub();
    ["#pc1", "#pc2", "#sp1", "#sp2"].forEach((s) => $(s).classList.remove("done", "show"));
    setTimeout(() => $("#pc1").classList.add("done"), 350); setTimeout(() => $("#pc2").classList.add("done"), 900);
    setTimeout(() => $("#sp1").classList.add("show"), 1400); setTimeout(() => $("#sp2").classList.add("show"), 1800);
  };
  $("#b-again").addEventListener("click", () => { hist.length = 0; pickReg("pine", "img/reg.jpg"); $("#regNote").value = ""; show("reg", { push: false }); });

  /* ── 料金の守り ── */
  async function loadCost() {
    try {
      const c = await api("GET", "/bonsaigo/cost"); MODE = c.mode;
      const L = sideLang();
      const meter = `<div><b>${c.today.total}<small>/${c.limits.total}</small></b><span>${esc(D(L, "c.cost.today").split("·")[0].replace(/\{N\}.*$/, "").trim() || "Today")}</span><div class="bar"><i style="width:${Math.min(100, c.today.total / c.limits.total * 100)}%"></i></div></div><div><b>${c.today.me}<small>/${c.limits.perUser}</small></b><span>${esc(ME ? (ME.role === "shokunin" ? nm(TEACHERS.find((x) => x.id === ME.teacher_id)) || ME.name : ME.name) : "—")}</span><div class="bar"><i style="width:${Math.min(100, c.today.me / c.limits.perUser * 100)}%"></i></div></div><div><b>${c.today.cache_hits}</b><span>${esc(D(L, "c.cached"))}</span></div>`;
      $("#mMeter").innerHTML = meter; $("#cMeter").innerHTML = meter;
      $("#cModels").innerHTML = [["check", "1"], ["main", "2"], ["fallback", "2"]].map(([k]) => `<div><b>${esc(c.models[k].replace(/^claude-/, ""))}</b>${esc(t("c.m." + k, { P: String(c.confidence_line) }))}</div>`).join("");
      $("#cLast").innerHTML = `<div style="border:0;color:#E9C9AC">${esc(D(L, "c.cost.last"))}</div>` + (c.last || []).map((x) => { const tier = /^check/.test(x.task) || x.task === "reviewAnswer" ? "check" : "main"; const model = String(x.model || "").replace(/^sample \((.*)\)$/, "$1").replace(/^claude-/, ""); return `<div><span>${esc(D(L, "c.m." + tier).replace(/\{P\}/g, String(c.confidence_line)))}</span><em>${esc(x.cached ? D(L, "c.cached") : model)}</em></div>`; }).join("");
      paintMode();
    } catch {}
  }
  function openCost() {
    const L = sideLang();
    $("#cH").textContent = D(L, "c.cost.h");
    $("#cList").innerHTML = [1, 2, 3, 4, 5].map((i) => `<li><i>${i}</i><span>${esc(D(L, "c.cost." + i))}</span></li>`).join("");
    loadCost();
    const host = $("#s-" + cur); if (!host.contains($("#costSheet"))) host.append($("#lveil"), $("#costSheet"));
    $("#lveil").classList.add("show"); $("#costSheet").classList.add("show");
  }
  $("#costSheet").addEventListener("click", closeSheets);
  function paintMode() { $$("[data-mode]").forEach((el) => { const L = el.closest(".k") ? AL : GL; const full = D(L, MODE === "sample" ? "c.mode.sample" : "c.mode.live"); el.innerHTML = `<i></i>${esc(el.closest(".topbar") ? (MODE === "sample" ? "SAMPLE" : "AI ON") : full)}`; el.title = full; el.classList.toggle("live", MODE !== "sample"); }); }

  /* ── 言葉を選ぶ ── */
  let pickFor = "g";
  function openPick(w) {
    pickFor = w; const now = w === "g" ? GL : AL, ui = I18N[now];
    $("#lTitle").textContent = D(now, "c.pick");
    $("#lList").innerHTML = LANGS.map((l) => `<button data-l="${l}" class="${l === now ? "on" : ""}"><b>${I18N[l].self}</b><span>${ui.names[l]}</span></button>`).join("");
    const host = $("#s-" + cur); if (!host.contains($("#lsheet"))) host.append($("#lveil"), $("#lsheet"));
    $("#lveil").classList.add("show"); $("#lsheet").classList.add("show");
  }
  $("#lList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-l]"); if (!b) return;
    GL = AL = b.dataset.l; store.set("bg-l", GL);
    $$("#lList button").forEach((x) => x.classList.toggle("on", x === b));
    applyLang(); enter[cur] && enter[cur]();
    setTimeout(closeSheets, 220);
  });
  $("#lveil").addEventListener("click", closeSheets);

  function applyLang() {
    $$("[data-i18n]").forEach((el) => { const k = el.dataset.i18n; el.innerHTML = terms(t(k, el.dataset.n != null ? { N: el.dataset.n } : undefined), k.startsWith("a.") ? "a" : "g", true); });
    $$("[data-pick]").forEach((b) => { b.querySelector(".lp-name").textContent = I18N[b.dataset.pick === "g" ? GL : AL].self; });
    $$(".scr:not(.k)").forEach((el) => (el.lang = GL === "zh" ? "zh-CN" : GL));
    $$(".scr.k").forEach((el) => (el.lang = AL === "zh" ? "zh-CN" : AL));
    document.documentElement.lang = sideLang();
    paintMode();
  }

  /* ── 大きさ合わせ ── */
  function fit() {
    if (innerWidth <= 560) { document.documentElement.style.setProperty("--s", 1); return; }
    const side = innerWidth > 860 ? 420 : 40;
    const s = Math.min((innerHeight - 40) / 844, 1.1, (innerWidth - side) / 390);
    document.documentElement.style.setProperty("--s", Math.max(0.5, s).toFixed(3));
  }
  addEventListener("resize", fit); fit();

  /* ── はじめ ── */
  (async () => {
    applyLang();
    try { const d = await api("GET", "/me"); ME = d.user; TEACHERS = d.teachers || []; } catch {}
    try { GLOSSARY = await (await fetch("../用語集.json")).json(); } catch {}
    loadCost();
    // #home などで、その画面から開ける（録画・確かめ用）
    const h = location.hash.slice(1);
    if (h && $("#s-" + h)) go(h);
  })();
})();
