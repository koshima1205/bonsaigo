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
  // 言葉は両側で別々に選ぶ（11/08 午後）。相談する人＝GL、答える人（職人・お弟子さん）＝AL
  let GL = store.get("bg-l", ""); if (!LANGS.includes(GL)) { const n = String(navigator.language || "en").slice(0, 2); GL = LANGS.includes(n) ? n : "en"; }
  let AL = store.get("bg-a", ""); if (!LANGS.includes(AL)) AL = GL;
  const nm = (tc, L = GL) => (tc ? (L === "ja" || (L === "zh" && !/[\u3040-\u30ff]/.test(tc.name_ja || "")) ? tc.name_ja : tc.name_en) || tc.name_en || "" : "");
  let ME = null, MODE = "sample", TEACHERS = [], GLOSSARY = [], GARDENS = [];
  let WORLD = { regions: [], countries: {}, gardens: [], people: [], topics: {}, species: {}, glossary: [] };
  let toGarden = store.get("bg-g", "g1"), curConsult = null, curTree = null, consults = [];
  const gardenOf = (id) => GARDENS.find((g) => g.id === id) || null;
  const gName = (g, L) => (g ? (g.name && g.name[L]) || g.name_ja || "" : "");
  const regName = (id, L) => { const r = WORLD.regions.find((x) => x.id === id); return r ? r.name[L] || r.name.en : ""; };
  const ctry = (c, L) => (WORLD.countries[c] && WORLD.countries[c][L]) || c || "";
  const peopleOf = (g) => TEACHERS.filter((x) => x.garden === (g && g.id));
  const gardenLang = (g) => { const ps = peopleOf(g); return ((ps.find((x) => x.role === "master") || ps[0]) || {}).lang || "ja"; };
  const myPerson = () => TEACHERS.find((x) => ME && x.id === ME.teacher_id) || null;
  const myGarden = () => gardenOf(myPerson() && myPerson().garden);
  const initial = (tc, L) => [...(nm(tc, L) || "?")][0];
  // 役割の言い方（園主／◯◯から来たお弟子さん）
  const roleLbl = (p, L, side) => p.role === "apprentice" ? (p.from ? D(L, side === "a" ? "a.x.appr" : "g.gp.appr").replace("{C}", ctry(p.from, L)) : D(L, side === "a" ? "a.x.appr0" : "g.gp.appr0")) : D(L, side === "a" ? "a.x.master" : "g.gp.master");
  // 相談する人の画面の {A}＝相手（答える人）の言葉
  const otherL = () => (cur === "answer" && curConsult && curConsult.answer && curConsult.answer.answer_lang) || gardenLang(gardenOf(toGarden));

  /* ── 言葉 ── */
  const D = (L, k) => (I18N[L] && I18N[L][k] != null) ? I18N[L][k] : (I18N[k.startsWith("g.") || k.startsWith("c.") ? "en" : "ja"][k] ?? I18N.en[k] ?? "");
  const sideLang = () => (ME && ME.role === "shokunin") || $("#s-" + cur)?.classList.contains("k") ? AL : GL;
  // はじまりの画面は、相談する人が選んだ言葉で出す（「職人として使う」も）
  function langOf(k) { return k.startsWith("g.") || k === "a.welcome.master" ? GL : k.startsWith("a.") ? AL : sideLang(); }
  function t(k, vars, Lover) {
    const L = Lover || langOf(k), n = I18N[L].names;
    let s = D(L, k).replace(/\{A\}/g, k.startsWith("a.") ? n[AL] : n[otherL()] || n.ja).replace(/\{G\}/g, n[GL]);
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
  // 木の登録で選べる樹種は12（箱崎版の一覧）。職人の得意な木などは上の8つのまま
  const REG_SPECIES = [...SPECIES, ["redpine", "赤松"], ["kaede", "楓"], ["chojubai", "長寿梅"], ["boke", "ボケ"]];
  const spName = (k, L) => L === "ja" ? (REG_SPECIES.find((x) => x[0] === k) || [, k])[1] : D(L, "g.tree." + k);
  const TREE_IMG = { pine: "pine", juniper: "juniper", maple: "maple", azalea: "azalea", ume: "ume", whitepine: "white-pine", zelkova: "zelkova", needle: "needle-juniper" };

  /* ── サーバー ── */
  async function api(method, url, body) {
    const r = await fetch("/api" + url, { method, headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" });
    let d = {}; try { d = await r.json(); } catch {}
    if (!r.ok) { const e = new Error(d.error || "error"); e.status = r.status; e.msg = d.error || ""; throw e; }
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
    // ログアウト：相談する人・職人のどちらでも、はじめの画面へ戻る（共有の端末で次の人に前の相談が見えないように）
    if (e.target.closest("[data-logout]")) { api("POST", "/logout", {}).catch(() => {}).finally(() => { ME = null; consults = []; hist.length = 0; show("welcome", { push: false }); }); return; }
    if (e.target.closest("[data-welcome]")) { hist.length = 0; show("welcome", { push: false }); return; }
    if (e.target.closest("[data-back]")) { if (hist.length) back(); else show(ME ? (ME.role === "shokunin" ? "mhome" : "home") : "welcome", { push: false }); return; }
    const tm = e.target.closest("[data-term]"); if (tm) openGloss(tm.dataset.term);
  });
  screen.addEventListener("keydown", (e) => { const tm = e.target.closest("[data-term]"); if (tm && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openGloss(tm.dataset.term); } });
  // 役割が違う画面へは、まず入口へ
  function go(id) {
    const needA = $("#s-" + id)?.classList.contains("k") && !["mstart"].includes(id);
    const needG = ["home", "ask", "qa", "learn", "answer", "gpick", "art"].includes(id);
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
      await refreshTeachers();
      showErr("#lErr", "");
      // 職人はメールとパスワードで入る。はじめての人は園を登録する（名前・園の名前・地域・立場・得意な木・SNS）
      const keepSp = new Set($$("#mSp input:checked").map((i) => i.value));
      $("#mSp").innerHTML = SPECIES.map(([k]) => `<label><input type="checkbox" value="${k}" ${(keepSp.size ? keepSp.has(k) : k === "pine") ? "checked" : ""}><span>${esc(spName(k, AL))}</span></label>`).join("") + `<label><input type="checkbox" value="other" ${keepSp.has("other") ? "checked" : ""}><span>${esc(t("a.x.spOther"))}</span></label>`;
      $("#mSpOther").placeholder = t("a.x.spOtherPh"); $("#mSpOther").hidden = !keepSp.has("other");
      const rv = $("#mRegion").value;
      $("#mRegion").innerHTML = `<option value="">${esc(t("a.x.regionPick"))}</option>` + WORLD.regions.map((r) => `<option value="${esc(r.id)}">${esc(r.name[AL] || r.name.en)}</option>`).join("");
      $("#mRegion").value = rv || "";
      if (!$("#mSns").children.length) addSns("x"), addSns("instagram"), addSns("web");
      $$("#mSns [data-k]").forEach((r) => { $("span", r).textContent = r.dataset.k === "web" ? t("a.x.snsWeb") : r.dataset.k === "x" ? "X" : "Instagram"; });
    },
    async home() {
      $("#gHello").textContent = `${t("g.home.hi")}${ME ? (GL === "ja" ? "、" : GL === "zh" ? "，" : ", ") + ME.name : ""}`;
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
    async ask() {
      showErr("#askErr", ""); $("#s-ask").classList.remove("done"); $("#askDone").hidden = true;
      if (!$("#askText").value.trim()) $("#askText").value = t("g.q");
      $("#askText").placeholder = t("g.ask.ph");
      if (!GARDENS.length) await refreshTeachers();
      const sv = $("#askSp").value || "juniper";
      $("#askSp").innerHTML = Object.entries(WORLD.species).map(([k, n]) => `<option value="${esc(k)}">${esc(n[GL] || n.en)}</option>`).join("");
      $("#askSp").value = sv;
      suggestGarden();
      $("#askWinOut").innerHTML = "";
      paintTrees();
    },
    gpick() { renderGpick(); },
    answer() { renderAnswer(); },
    qa() { searchQa(); paintWin(); },
    learn() { renderLearn(); },
    art() { renderArticle($("#artBody"), curArt, GL, "g"); },
    mart() { renderArticle($("#martBody"), curArt, AL, "a"); },
    async mhome() {
      if (!TEACHERS.length) await refreshTeachers();
      // 「おはようございます　◯◯ 様」。下に、役割と園
      const mp = myPerson();
      $("#mHello").textContent = t("a.mh.name", { N: mp ? nm(mp, AL) : ME ? ME.name : "" });
      // いちばん上に日付と曜日（答える人の言葉で）
      try { $("#mToday").textContent = new Intl.DateTimeFormat(AL === "zh" ? "zh-CN" : AL, { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date()); } catch { $("#mToday").textContent = new Date().toDateString(); }
      $("#mWho").textContent = mp ? `${roleLbl(mp, AL, "a")} · ${gName(myGarden(), AL)}` : "";
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
        paintInbox();
      } catch (e) { if (e.status === 401) { ME = null; show("welcome"); } }
    },
    detail() { renderDetail(); },
    reg() { renderReg(); },
    mlearn() { renderMl(); },
  };
  let inboxTab = "todo";
  // 前にも相談した木：答えのついた前の相談（tree_history）か、同じ木のもっと前の相談が一覧にあるとき
  const askedBefore = (c) => (c.tree_history || []).length > 0 || consults.some((x) => x.id !== c.id && x.tree_id && x.tree_id === c.tree_id && x.at < c.at);
  const tagOf = (c) => c.answer ? `<span class="st">✓ ${esc(t("a.tag.done"))}</span>` : askedBefore(c) ? `<span class="new again">${esc(t("a.tag.again"))}</span>` : `<span class="new">${esc(t("a.tag.new"))}</span>`;
  function paintInbox() {
    const todo = consults.filter((c) => !c.answer), list = inboxTab === "todo" ? todo : consults.filter((c) => c.answer);
    const h = $("#inboxH");
    if (todo.length) { h.dataset.i18n = "a.inbox.cnt"; h.dataset.n = todo.length; h.textContent = t("a.inbox.cnt", { N: todo.length }); } else { h.dataset.i18n = "a.tab.answer"; h.textContent = t("a.tab.answer"); }
    $$("#inboxSeg [data-ib]").forEach((b) => b.classList.toggle("on", b.dataset.ib === inboxTab));
    $("#inboxList").innerHTML = list.length ? list.map((c) => `<button class="inbox-card ${c.answer ? "done" : ""}" data-cid="${c.id}"><div class="row"><img src="${c.image ? "data:" + c.image.media_type + ";base64," + c.image.data : "img/ask.jpg"}" alt=""><div>${tagOf(c)}<p>${esc(forCraft(c).title || "")}</p></div></div><div class="from"><span>${esc(t("a.x.from", { L: I18N[AL].names[c.lang] || c.lang }))}</span><span>${esc(new Date(c.at).toLocaleDateString(AL === "zh" ? "zh-CN" : AL))}</span></div></button>`).join("") : `<div class="empty" style="margin-top:16px">${esc(t(inboxTab === "todo" ? "a.x.inboxNone" : "a.x.doneNone"))}</div>`;
  }
  $("#inboxSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-ib]"); if (!b) return; inboxTab = b.dataset.ib; paintInbox(); });
  const ROMA = { hazushi: "harigane-hazushi", kake: "harigane-kake", mekiri: "mekiri", metsumi: "metsumi", jin: "jin", nebari: "nebari", tachiagari: "tachiagari", uekae: "uekae" };

  /* ── はじまり・ログイン ── */
  // 相談する人：名前だけで入る（今までどおり）か、メールアドレスとパスワードも入れておく。登録済みの人はメールとパスワードで入る
  let gMode = "new";
  $("#gMode").addEventListener("click", (e) => {
    const b = e.target.closest("[data-gm]"); if (!b) return; gMode = b.dataset.gm;
    $$("#gMode [data-gm]").forEach((x) => x.classList.toggle("on", x === b));
    $$("#s-gstart .gm-new").forEach((x) => (x.hidden = gMode !== "new")); $$("#s-gstart .gm-have").forEach((x) => (x.hidden = gMode !== "have"));
    const st = $("#b-gstart"); st.dataset.i18n = gMode === "new" ? "g.x.start" : "g.st.signin"; st.textContent = t(st.dataset.i18n); showErr("#gErr", "");
  });
  const gLoginErr = (e) => e.status === 400 && /登録済み/.test(e.msg) ? t("g.st.errUsed") : e.status === 400 && /違います/.test(e.msg) ? t("g.st.errSignin") : e.status === 400 && /8文字/.test(e.msg) ? t("g.st.errPass") : e.status === 400 && /メールアドレスを入れて/.test(e.msg) ? t("g.st.errMail") : errText(e, "g");
  $("#b-gstart").addEventListener("click", async () => {
    let body;
    if (gMode === "have") {
      const email = $("#gMail2").value.trim(), password = $("#gPass2").value;
      if (!email || !password) return showErr("#gErr", t("g.st.errSignin"));
      body = { role: "aikouka", mode: "signin", email, password, lang: GL };
    } else {
      const name = $("#gName").value.trim() || "Guest", email = $("#gMail").value.trim(), password = $("#gPass").value;
      if (!email && password) return showErr("#gErr", t("g.st.errNoMail"));
      if (email && password.length < 8) return showErr("#gErr", t("g.st.errPass"));
      body = { role: "aikouka", name, lang: GL, ...(email ? { email, password } : {}) };
    }
    try { const d = await api("POST", "/login", body); ME = d.user; $("#gPass").value = $("#gPass2").value = ""; await refreshTeachers(); show("home"); }
    catch (e) { showErr("#gErr", gLoginErr(e)); }
  });
  // ログイン。答える言葉は、その人がふだん答える言葉（最初に選んだ言葉）にする
  async function signedIn(d) { ME = d.user; if (LANGS.includes(ME.lang)) { AL = ME.lang; store.set("bg-a", AL); } await refreshTeachers(); applyLang(); show("mhome"); }
  $("#b-login").addEventListener("click", async () => {
    const email = $("#lMail").value.trim(), password = $("#lPass").value;
    if (!email || !password) return showErr("#lErr", t("a.x.errLogin"));
    showErr("#lErr", "");
    try { await signedIn(await api("POST", "/login", { role: "shokunin", mode: "signin", email, password })); }
    catch (e) { showErr("#lErr", e.status === 429 ? errText(e, "a") : t("a.x.errLogin")); }
  });
  [$("#lMail"), $("#lPass")].forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter") $("#b-login").click(); }));
  // 見本の職人（架空）のアカウントを入れる。答える言葉が日本語なら霧松園の青木さん、ほかの言葉ならその言葉で答える見本の人
  $("#b-demoAcc").addEventListener("click", () => {
    const p = TEACHERS.find((x) => x.lang === AL && /^p\d+$/.test(x.id)) || TEACHERS.find((x) => x.id === "p1");
    if (!p) return;
    $("#lMail").value = `${p.name_en.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.+|\.+$/g, "")}@bonsaigo.example`;
    $("#lPass").value = ""; $("#lPass").focus({ preventScroll: true });
  });
  // 登録：立場・その他の木・SNS
  let mRole = "master";
  $("#mRole").addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (!b) return; mRole = b.dataset.r; $$("#mRole [data-r]").forEach((x) => x.classList.toggle("on", x === b)); });
  $("#mSp").addEventListener("change", (e) => { if (e.target.value === "other") { $("#mSpOther").hidden = !e.target.checked; if (e.target.checked) $("#mSpOther").focus(); } });
  function addSns(k) {
    if ($$("#mSns [data-k]").length >= 12) return;
    const row = document.createElement("label"); row.className = "sns-row"; row.dataset.k = k;
    row.innerHTML = `<span>${esc(k === "web" ? t("a.x.snsWeb") : k === "x" ? "X" : "Instagram")}</span><input type="url" inputmode="url" maxlength="300" placeholder="https://">`;
    $("#mSns").appendChild(row);
  }
  $("#b-snsAdd").addEventListener("click", () => addSns("web"));
  $("#b-mreg").addEventListener("click", async () => {
    const name = $("#mName").value.trim(), place = $("#mPlace").value.trim(), region = $("#mRegion").value;
    const keys = $$("#mSp input:checked").map((i) => i.value).filter((k) => k !== "other");
    const other = $("#mSpOther").hidden ? "" : $("#mSpOther").value.trim();
    const sp = [...keys.map((k) => spName(k, "ja")), ...(other ? [other] : [])];
    const email = $("#mMail").value.trim(), password = $("#mPass").value;
    const sns = { x: [], instagram: [], web: [] };
    $$("#mSns [data-k]").forEach((r) => { const v = $("input", r).value.trim(); if (v) sns[r.dataset.k].push(v); });
    if (!name) return showErr("#mErr", t("a.x.errName"));
    if (!place) return showErr("#mErr", t("a.x.errPlace"));
    if (!region) return showErr("#mErr", t("a.x.errRegion"));
    if (!sp.length) return showErr("#mErr", t("a.x.errSp"));
    if ([...sns.x, ...sns.instagram, ...sns.web].some((u) => !/^https:\/\/\S{3,}$/.test(u))) return showErr("#mErr", t("a.x.errUrl"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr("#mErr", t("a.x.errMail"));
    if (password.length < 8) return showErr("#mErr", t("a.x.errPass"));
    showErr("#mErr", "");
    try { await signedIn(await api("POST", "/login", { role: "shokunin", name, place, region, role_in_garden: mRole, species: keys, specialties: sp, sns, email, password, lang: AL })); }
    catch (e) { showErr("#mErr", /登録済み/.test(e.message || "") ? t("a.x.errMailUsed") : errText(e, "a")); }
  });
  async function refreshTeachers() { try { const d = await api("GET", "/me"); TEACHERS = d.teachers || []; GARDENS = d.gardens || []; if (!gardenOf(toGarden) && GARDENS[0]) toGarden = GARDENS[0].id; paintGtag(); } catch {} }
  // 職人の画面の左上：自分の園の名前（すべて架空の見本）
  function paintGtag() { const g = myGarden(); $$("[data-garden]").forEach((el) => { el.innerHTML = g ? `<span>${esc(gName(g, AL))}</span>` : ""; }); }

  /* ── 相談する ── */
  let askPhoto = { src: "img/ask.jpg" };
  $("#askFile").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; const u = await fileUrl(f); setPhoto("#askPhoto", u); $("#askPhoto").classList.add("own"); askPhoto = { src: u }; });
  $("#askSample").addEventListener("click", () => { setPhoto("#askPhoto", "img/ask.jpg"); $("#askPhoto").classList.remove("own"); askPhoto = { src: "img/ask.jpg" }; });
  function setPhoto(box, src) { const b = $(box); b.classList.add("swap"); setTimeout(() => { $("img", b).src = src; b.classList.remove("swap"); }, 220); }
  // 園の札（人と、答える言葉つき）
  function peopleHtml(g, L, side) { return `<div class="ppl">${peopleOf(g).map((p) => `<div><span class="seal">${esc(initial(p, L))}</span><span>${esc(nm(p, L))} · ${esc(roleLbl(p, L, side))}</span><em>${esc(I18N[L].names[p.lang] || p.lang)}</em></div>`).join("")}</div>`; }
  function paintGardenCard() {
    const g = gardenOf(toGarden) || GARDENS[0]; if (!g) return; toGarden = g.id;
    const L = gardenLang(g);
    $("#gCard").innerHTML = `<span class="chg">${esc(t("g.gp.change"))} ›</span><div class="nm"><b>${esc(gName(g, GL))}</b><span>${esc(regName(g.region, GL))}</span></div>${peopleHtml(g, GL, "g")}`;
    $("#gLangNote").textContent = L === GL ? t("g.gp.same") : t("g.gp.diff", { L: I18N[GL].names[L] || L });
    applyLang();
  }
  // 写真・木の種類・相談の中身から、合う園を提案する（自分で園を選んだら、それを優先）
  let pickedByHand = false;
  const TOPIC_WORDS = { wire: ["wire", "wiring", "alambre", "filo", "fil", "铝丝", "金属丝", "ลวด", "លួស", "針金"], repot: ["repot", "trasplant", "rinvas", "rempot", "换盆", "เปลี่ยนกระถาง", "ប្តូរផើង", "植え替え"], water: ["water", "riego", "acqua", "arros", "浇水", "รดน้ำ", "ស្រោចទឹក", "水やり"], pruning: ["prun", "pod", "potat", "taille", "修剪", "ตัดแต่ง", "កាត់", "剪定", "芽切り", "芽摘み"], pests: ["pest", "mite", "plaga", "parassit", "ravageur", "虫", "แมลง", "សត្វល្អិត", "ハダニ"] };
  function suggestGarden() {
    if (pickedByHand) { paintGardenCard(); $("#gSugg").hidden = true; return; }
    const sp = $("#askSp").value, q = $("#askText").value.toLowerCase();
    const topics = Object.entries(TOPIC_WORDS).filter(([, ws]) => ws.some((w) => q.includes(w))).map(([k]) => k);
    const score = (g) => ((g.species || []).includes(sp) ? 3 : 0) + topics.filter((k) => (g.topics || []).includes(k)).length;
    // 同点なら日本の園を先に（日本の職人に聞けるのが BONSAIGO の芯）
    const jp = (g) => (String(g.region).startsWith("jp-") ? 0 : 1);
    const best = GARDENS.filter((g) => peopleOf(g).length).map((g) => [score(g), g]).sort((a, b) => b[0] - a[0] || jp(a[1]) - jp(b[1]))[0];
    if (best && best[0] > 0) toGarden = best[1].id;
    paintGardenCard(); $("#gSugg").hidden = !(best && best[0] > 0);
  }
  $("#askSp").addEventListener("change", suggestGarden);
  let suggT = null;
  $("#askText").addEventListener("input", () => { clearTimeout(suggT); suggT = setTimeout(suggestGarden, 500); });
  // 園を選ぶ：地域 → 木か困りごと → 答えられる園（縦に並べる）
  let gpRegion = "all", gpTree = "", gpTopic = "";
  function renderGpick() {
    const chip = (attr, v, on, label) => `<button class="chip ${on ? "on" : ""}" ${attr}="${esc(v)}">${esc(label)}</button>`;
    $("#gpRegion").innerHTML = chip("data-rg", "all", gpRegion === "all", t("g.gp.all")) + WORLD.regions.map((r) => chip("data-rg", r.id, gpRegion === r.id, r.name[GL] || r.name.en)).join("");
    $("#gpTree").innerHTML = chip("data-tr", "", !gpTree, t("g.gp.any")) + Object.entries(WORLD.species).map(([k, n]) => chip("data-tr", k, gpTree === k, n[GL] || n.en)).join("");
    $("#gpTopic").innerHTML = Object.entries(WORLD.topics).map(([k, n]) => chip("data-tp", k, gpTopic === k, n[GL] || n.en)).join("");
    const list = GARDENS.filter((g) => (gpRegion === "all" || g.region === gpRegion) && (!gpTree || (g.species || []).includes(gpTree)) && (!gpTopic || (g.topics || []).includes(gpTopic)) && peopleOf(g).length);
    $("#gpN").textContent = list.length === 1 ? t("g.gp.n1") : t("g.gp.n", { N: list.length });
    $("#gpList").innerHTML = list.length ? list.map((g) => `<div class="gcard"><div class="nm"><b>${esc(gName(g, GL))}</b><span>${esc(regName(g.region, GL))}</span></div>${g.about && g.about[GL] ? `<p>${esc(g.about[GL])}</p>` : ""}<div class="sp">${(g.species || []).map((k) => `<i>${esc((WORLD.species[k] || {})[GL] || k)}</i>`).join("")}${(g.topics || []).map((k) => `<i>${esc((WORLD.topics[k] || {})[GL] || k)}</i>`).join("")}</div>${peopleHtml(g, GL, "g")}<button class="cta go" data-gid="${esc(g.id)}">${esc(t("g.gp.pick"))}</button></div>`).join("") : `<div class="empty" style="margin-top:12px">${esc(t("g.gp.none"))}</div>`;
  }
  $("#s-gpick").addEventListener("click", (e) => {
    const rg = e.target.closest("[data-rg]"), tr = e.target.closest("[data-tr]"), tp = e.target.closest("[data-tp]"), gd = e.target.closest("[data-gid]");
    if (rg) { gpRegion = rg.dataset.rg; renderGpick(); }
    else if (tr) { gpTree = tr.dataset.tr; gpTopic = ""; renderGpick(); }
    else if (tp) { gpTopic = gpTopic === tp.dataset.tp ? "" : tp.dataset.tp; gpTree = ""; renderGpick(); }
    else if (gd) { toGarden = gd.dataset.gid; store.set("bg-g", toGarden); pickedByHand = true; back(); }
  });
  // どの木の相談か。前に相談した木を選ぶと、同じ木の番号で送る（職人は前のやりとりを見て答える）
  let askTree = "";
  async function paintTrees() {
    let mine = ME && ME.role === "aikouka" && consults.length ? consults : [];
    if (!mine.length) { try { mine = consults = (await api("GET", "/consultations")).consultations || []; } catch {} }
    const trees = []; const seen = new Set();
    for (const c of mine) if (c.tree_id && !seen.has(c.tree_id)) { seen.add(c.tree_id); trees.push(c); }
    if (askTree && !seen.has(askTree)) askTree = "";
    $("#askTreeF").hidden = !trees.length;
    $("#askTrees").innerHTML = `<button class="chip ${askTree ? "" : "on"}" data-tree="">${esc(t("g.ask.treeNew"))}</button>` + trees.slice(0, 5).map((c) => `<button class="chip ${askTree === c.tree_id ? "on" : ""}" data-tree="${esc(c.tree_id)}">${esc(c.question.slice(0, 14))}${c.question.length > 14 ? "…" : ""} · ${esc(new Date(c.at).toLocaleDateString(GL === "zh" ? "zh-CN" : GL, { month: "numeric", day: "numeric" }))}</button>`).join("");
  }
  $("#askTrees").addEventListener("click", (e) => { const b = e.target.closest("[data-tree]"); if (!b) return; askTree = b.dataset.tree; $$("#askTrees .chip").forEach((x) => x.classList.toggle("on", x === b)); });
  $("#b-send").addEventListener("click", async () => {
    const q = $("#askText").value.trim(); if (!q) return showErr("#askErr", t("g.x.errEmpty"));
    showErr("#askErr", ""); busy("#askBusy", true);
    const bt = $("#askBusy b"); bt.dataset.i18n = "g.x.sending"; bt.textContent = t("g.x.sending");
    const step2 = setTimeout(() => { bt.dataset.i18n = "g.sent.step2"; bt.textContent = t("g.sent.step2"); }, 1200);
    try {
      const image = await toB64(askPhoto.src);
      const isSample = q === D(GL, "g.q");
      const c = await api("POST", "/consultations", { question: q, lang: GL, garden_id: toGarden, images: [image], is_sample: isSample, ...(askTree ? { tree_id: askTree } : {}) });
      if (ME && ME.role === "aikouka") consults = [c, ...consults.filter((x) => x.id !== c.id)];
      busy("#askBusy", false); $("#askText").value = "";
      $("#j1t").textContent = q;
      // 園に届く中身。言葉が同じならそのまま。見本モードは、見本の質問だけ「こう届く」を見せる
      const g = gardenOf(toGarden), L = gardenLang(g), fc = c.for_craftsperson || {};
      $("#j2l").textContent = D(GL, "a.sumLbl").replace(/\{A\}/g, I18N[GL].names[L] || L);
      const fk = fc.same_lang ? "g.sent.flowSame" : fc.untranslated ? "g.sent.flowRaw" : "g.sent.flow", fe = $("#jf [data-i18n]");
      fe.dataset.i18n = fk; fe.innerHTML = terms(t(fk), "g", true);
      if (fc.same_lang || fc.untranslated) $("#j2t").textContent = q;
      else if (MODE === "sample") $("#j2t").innerHTML = D(GL, "a.sum");
      else $("#j2t").innerHTML = esc(fc.summary_ja || "") + (fc.points_ja?.length ? `<br><br>${fc.points_ja.map((p) => `<mark>${esc(p)}</mark>`).join("<br>")}` : "");
      // 黒い別の画面には移らず、相談の画面の中で「職人に送りました」と、どう届いたかの要約を見せる（2026-11-08 すり合わせ 4-5）
      clearTimeout(step2);
      $("#adTo").textContent = `${gName(g, GL)} · ${t("g.sent.delT", { A: I18N[GL].names[L] || L })}`;
      $("#adLbl").textContent = $("#j2l").textContent;
      $("#adText").innerHTML = $("#j2t").innerHTML;
      $("#s-ask").classList.add("done"); $("#askDone").hidden = false;
      scroller("ask")?.scrollTo({ top: 0 });
      askTree = "";
    } catch (e) { clearTimeout(step2); busy("#askBusy", false); showErr("#askErr", errText(e, "g")); }
  });
  const enterSent = () => {
    ["#j1", "#jf", "#j2", "#jd"].forEach((s) => $(s).classList.remove("show"));
    [["#j1", 250], ["#jf", 1000], ["#j2", 1800], ["#jd", 2900]].forEach(([s, ms]) => setTimeout(() => $(s).classList.add("show"), ms));
  };
  enter.sent = enterSent;
  $("#b-sentHome").addEventListener("click", () => show("home"));
  const askReset = () => { $("#s-ask").classList.remove("done"); $("#askDone").hidden = true; };
  $("#b-adHome").addEventListener("click", () => { askReset(); show("home"); });
  $("#b-adAgain").addEventListener("click", async () => { askReset(); await enter.ask(); $("#askText").value = ""; scroller("ask")?.scrollTo({ top: 0 }); });

  /* ── 答えを読む（相談する人） ── */
  $("#mineList").addEventListener("click", (e) => { const b = e.target.closest("[data-cid]"); if (!b) return; curConsult = consults.find((c) => c.id === b.dataset.cid); show("answer"); });
  $("#banner").addEventListener("click", () => { const c = consults.find((x) => x.answer); if (c) { curConsult = c; show("answer"); } });
  function verifiedBox(review, side) {
    if (!review || !review.checked) return "";
    const L = side === "a" ? AL : GL, conf = typeof review.confidence === "number" ? review.confidence : null;
    const low = review.needs_person || review.ok === false;
    const head = side === "a" ? t(low ? "a.x.confLow" : "a.x.confOk") : D(L, "g.x.checkedS");
    const body = side === "a" ? "" : D(L, "g.x.checked");
    return `<div class="verified ${low ? "low" : ""}"><span class="ok"><svg><use href="#${low ? "i-hold" : "i-check"}"/></svg></span><div><b>${esc(head)}</b>${body ? `<span>${esc(body)}</span>` : ""}</div></div>`;
  }
  function renderAnswer() {
    const c = curConsult; if (!c) return;
    // 答えた人と園の名前を両方出す（お弟子さんが園の代わりに答えることもある）
    const g = gardenOf(c.garden_id), by = c.answer && c.answer.by;
    $("#ansWho").textContent = gName(g, GL) || t("g.banner.b");
    $("#ansBy").textContent = by ? t("g.ans.by2", { P: `${nm(by, GL)} · ${roleLbl(by, GL, "g")}`, L: I18N[GL].names[c.answer.answer_lang] || c.answer.answer_lang || "" }) : "";
    $("#s-answer .tnote").hidden = !c.answer || Boolean(c.answer.same_lang || c.answer.untranslated);
    $("#ansImg").src = c.image ? `data:${c.image.media_type};base64,${c.image.data}` : "img/ask.jpg";
    $("#ansQ").textContent = c.question;
    if (!c.answer) { $("#ansBody").innerHTML = `<div class="empty">${esc(t("g.x.wait"))}</div>`; $("#ansCheck").innerHTML = ""; $("#jpOrig").textContent = ""; $("#jpBtn").hidden = true; return; }
    $("#ansBody").innerHTML = `<h2>${terms(c.answer.headline, "g")}</h2>${c.answer.paragraphs.map((p) => `<p>${terms(p, "g")}</p>`).join("")}`;
    $("#ansCheck").innerHTML = c.answer.same_lang || c.answer.untranslated ? `<p class="lang-note">${esc(t(c.answer.same_lang ? "g.x.sameAns" : "g.x.untr"))}</p>` : verifiedBox(c.answer.review, "g");
    // 職人が話した言葉（整える前の、職人の言葉のまま）
    $("#jpOrig").textContent = c.answer.voice_ja || c.answer.back_translation_ja || "";
    $("#jpOrig").lang = c.answer.answer_lang || "ja";
    $("#jpBtn").hidden = !$("#jpOrig").textContent || Boolean(c.answer.same_lang);
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
      $(box).innerHTML = items.length ? items.map((it) => `<div class="qa"><div class="top"><span class="tree">${it.tree ? `<img src="img/t-${TREE_IMG[it.tree] || it.tree}.webp" alt="">` : `<img src="img/ask.jpg" alt="" style="object-fit:cover;height:100%">`}</span><div><b>${esc(it.q)}</b><div class="meta">${qaBy(it, GL) ? `<span>${esc(qaBy(it, GL))}</span>` : ""}${it.tree ? `<span>${esc(t("g.tree." + it.tree))}</span>` : ""}${it.asked_in && it.asked_in !== GL ? `<span>${esc(t("g.x.askedIn", { L: I18N[GL].names[it.asked_in] || it.asked_in }))}</span>` : ""}${it.other_lang && q ? `<span class="other"><svg><use href="#i-globe"/></svg>${esc(t("g.x.qaOther"))}</span>` : ""}</div></div></div><div class="a">${terms(it.a, "g")}</div></div>`).join("") : `<div class="empty" style="margin-top:12px">${esc(t("g.x.qaNone"))}</div>`;
    } catch {}
  }
  const qaBy = (it, L) => { const p = TEACHERS.find((x) => x.id === it.person_id), g = gardenOf(it.garden_id); return p && g ? D(L, "g.qa.by").replace("{P}", nm(p, L)).replace("{G}", gName(g, L)) : g ? gName(g, L) : ""; };
  function searchQa() {
    const q = $("#qaQ").value.trim(); $("#qaClear").hidden = !q;
    const nameOf = (o) => (o ? o[GL] || o.en : "");
    $("#qaChips").innerHTML = ["juniper", "pine", "maple", "azalea", "ume"].map((k) => `<button class="chip" data-f="${k}">${esc(nameOf(WORLD.species[k]) || t("g.tree." + k))}</button>`).join("") + ["wire", "repot", "water", "winter", "pests", "indoor"].map((k) => `<button class="chip" data-f="${k}">${esc(nameOf(WORLD.topics[k]))}</button>`).join("");
    loadQa(q, "#qaList");
  }
  // AI 窓口：たまった答え（見本＋答えのついた相談）から近いものを返す。答えがたまるほど賢くなる
  async function paintWin() { try { const r = await api("GET", `/bonsaigo/qa?lang=${GL}&q=`); $("#winLead").textContent = t("g.win.lead", { N: String(r.pool ?? (r.items || []).length) }); } catch {} $("#winQ").placeholder = D(GL, "g.win.ph"); }
  // AI窓口は1つのしくみ。Q&A の画面と、相談を書く画面の両方から呼ぶ（2026-11-08 すり合わせ）
  async function winAnswer(q, out, onAsk) {
    out.innerHTML = `<div class="win-a"><p class="lead">…</p></div>`;
    try {
      const r = await api("POST", "/bonsaigo/window", { q, lang: GL });
      const ask = onAsk === "ask" ? `<div class="win-btns"><button class="cta ghost" data-winok>${esc(t("g.ask.solved"))}</button><button class="cta" data-wincraft>${esc(t("g.ask.toCraft"))}</button></div>` : `<button class="cta ghost" data-winask>${esc(t("g.win.ask"))}</button>`;
      if (!r.found) { out.innerHTML = `<div class="win-a"><p>${esc(t("g.win.none"))}</p>${ask}</div>`; return; }
      const s = r.sources[0];
      out.innerHTML = `<div class="win-a"><q>${terms(r.answer, "g")}</q><div class="by">${esc(t("g.win.from", { P: qaBy(s, GL) || "BONSAIGO" }))}</div>${r.sources.map((x) => `<div class="about">Q · ${esc(x.q)}</div>`).join("")}${ask}</div>`;
    } catch (e) { out.innerHTML = `<p class="err">${esc(errText(e, "g"))}</p>`; }
  }
  async function askWin() {
    const q = $("#winQ").value.trim(); if (!q) { $("#winQ").focus({ preventScroll: true }); return; }
    winAnswer(q, $("#winOut"), "qa");
  }
  $("#askWinGo").addEventListener("click", () => {
    const q = $("#askText").value.trim(); if (!q) { $("#askText").focus({ preventScroll: true }); return; }
    winAnswer(q, $("#askWinOut"), "ask");
  });
  $("#askWinOut").addEventListener("click", (e) => {
    if (e.target.closest("[data-winok]")) { toast(t("g.ask.solvedT")); $("#askWinOut").innerHTML = ""; go("home"); }
    else if (e.target.closest("[data-wincraft]")) $("#b-send").click();
  });
  $("#winGo").addEventListener("click", askWin);
  $("#winQ").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); askWin(); } });
  $("#winOut").addEventListener("click", (e) => { if (!e.target.closest("[data-winask]")) return; $("#askText").value = $("#winQ").value.trim(); go("ask"); });
  $("#qaQ").addEventListener("input", () => { clearTimeout(qaTimer); qaTimer = setTimeout(searchQa, 220); });
  $("#qaClear").addEventListener("click", (e) => { e.preventDefault(); $("#qaQ").value = ""; searchQa(); });
  $("#qaChips").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; $("#qaQ").value = b.textContent; searchQa(); });

  /* ── 学ぶ：読みもの24本・動画・職人の声・用語（両側で同じ中身を、それぞれの言葉で） ── */
  let seg = "art", mlSeg = "words", curArt = 1, LEARN = null, FB = [], FIXES = [], NOTES = [];
  // 職人が直した用語の訳（その用語・その言葉の最新）と、読みものに足した気づき。相談する人の「学ぶ」にも出す
  async function loadFixes() { try { const r = await api("GET", "/bonsaigo/gloss"); FIXES = r.fixes || []; FB = r.items || []; } catch { FIXES = []; } }
  async function loadNotes() { try { NOTES = (await api("GET", "/bonsaigo/notes")).notes || []; } catch { NOTES = []; } }
  const fixOf = (term, l) => FIXES.find((f) => f.term === term && f.lang === l);
  const whoLine = (p, L) => { const pp = p && (TEACHERS.find((x) => x.id === p.id) || p); if (!pp) return ""; const g = gardenOf(pp.garden); return `${nm(pp, L)}${g ? ` · ${gName(g, L)}` : ""}`; };
  async function loadLearn() {
    if (LEARN) return LEARN;
    const part = (u) => fetch(u).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    const [a, b] = await Promise.all([part("data/learn_a.json"), part("data/learn_b.json")]);
    LEARN = [...a, ...b].sort((x, y) => x.no - y.no);
    return LEARN;
  }
  const GARDEN1 = "../共通/写真/A_使える_2階から見た盆栽庭園の全景_横.jpg", PATH1 = "../共通/写真/A_使える_美術館の入口の小道_縦.jpg";
  const ART_IMG = { "black-pine": "img/t-pine.webp", "white-pine": "img/t-white-pine.webp", shimpaku: "img/t-juniper.webp", "japanese-maple": "img/t-maple.webp", satsuki: "img/t-azalea.webp", ume: "img/t-ume.webp", zelkova: "img/t-zelkova.webp", "needle-juniper": "img/t-needle-juniper.webp", "flowering-year": "img/t-ume.webp", omiya: GARDEN1, history: PATH1, "what-is-bonsai": "img/grow.jpg", styles: "img/t-juniper.webp", "how-to-look": "img/t-pine.webp", spring: "img/t-maple.webp", autumn: "img/t-maple.webp", winter: "img/t-zelkova.webp", "early-summer": "img/t-pine.webp", midsummer: "img/t-azalea.webp" };
  const artImg = (a) => ART_IMG[a.slug] || [GARDEN1, "img/grow.jpg", PATH1][a.no % 3];
  const FILMS = [["a-pine", "g.film.pine"], ["b-maple", "g.film.maple"], ["c-eight", "g.film.eight"], ["s1-mekiri", "g.film.s1", 1], ["s2-maple", "g.film.s2", 1], ["s3-eight", "g.film.s3", 1]];
  const pick8 = (o, L) => (o ? o[L] || o.en || "" : "");
  async function learnHtml(kind, L, side) {
    if (kind === "art") {
      const arts = await loadLearn();
      return ["basics", "species", "seasons"].map((gr) => `<div class="lg-h">${esc(D(L, "g.l." + gr))}</div>` + arts.filter((a) => a.group === gr).map((a) => `<button class="arow" data-art="${a.no}"><img src="${artImg(a)}" alt="" loading="lazy"><div><em>${String(a.no).padStart(2, "0")} · ${esc(D(L, "g.x.min").replace("{N}", a.minutes || 4))}</em><b>${esc(pick8(a.title, L))}</b><span>${esc(pick8(a.lead, L))}</span></div></button>`).join("")).join("");
    }
    if (kind === "film") return `<p class="lead">${esc(D(L, "g.l.filmNote"))}</p>` + FILMS.map(([f, k, tall]) => `<div class="film ${tall ? "tall" : ""}"><video controls playsinline preload="none" poster="films/${f}.jpg" src="films/${f}.mp4"></video><div class="cap"><small>${esc(tall ? D(L, "g.l.short") : "FILM")}</small>${esc(D(L, k))}</div></div>`).join("");
    if (kind === "voice") {
      let items = []; try { items = (await api("GET", `/bonsaigo/qa?lang=${L}&q=`)).items || []; } catch {}
      return `<p class="lead">${esc(D(L, "g.l.voiceLead"))}</p>` + items.filter((it) => !it.own).map((it) => { const p = TEACHERS.find((x) => x.id === it.person_id), g = gardenOf(it.garden_id); return `<div class="vq"><q>${terms(it.a, side)}</q><div class="by">${p ? `<span class="seal">${esc(initial(p, L))}</span>` : ""}<span>${esc(p ? `${nm(p, L)} · ${roleLbl(p, L, side)}` : "")}${g ? ` · ${esc(gName(g, L))}` : ""}</span></div><div class="about">Q · ${esc(it.q)}</div></div>`; }).join("");
    }
    if (kind === "gl") {
      await loadFixes();
      return `<p class="lead">${esc(D(L, "g.l.glossLead"))}</p>` + WORLD.glossary.map((w) => { const f = L === "ja" ? null : fixOf(w.ja, L); return `<button class="gl" data-term="${esc(w.ja)}"><span class="kj">${esc(w.ja)}<small>${esc(w.roma)}</small></span><span class="m">${esc(f ? f.text : L === "ja" ? w.yomi : w.shown[L])}${f ? `<em class="fixd">${esc(D(L, "g.gl.fixed").replace("{P}", whoLine(f.by, L)))}</em>` : ""}</span><span class="go">›</span></button>`; }).join("");
    }
    return "";
  }
  async function renderLearn() {
    $$("#learnSeg button").forEach((b) => b.classList.toggle("on", b.dataset.seg === seg));
    const want = seg; const html = await learnHtml(seg, GL, "g");
    if (want === seg && cur === "learn") $("#learnBox").innerHTML = html;
  }
  $("#learnSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-seg]"); if (!b) return; seg = b.dataset.seg; renderLearn(); });
  $("#learnBox").addEventListener("click", (e) => { const b = e.target.closest("[data-art]"); if (!b) return; curArt = Number(b.dataset.art); show("art"); });
  // 読みもの1本
  function notesHtml(no, L, side) {
    const list = NOTES.filter((n) => n.art === no);
    if (!list.length && side !== "a") return "";
    return `<div class="notes"><b>${esc(D(L, "g.art.notes"))}</b>${list.map((n) => `<div class="vq"><q lang="${esc(n.lang)}">${esc(n.text)}</q><div class="by">${n.by ? `<span class="seal">${esc(initial(TEACHERS.find((x) => x.id === n.by.id) || n.by, L))}</span>` : ""}<span>${esc(whoLine(n.by, L))}</span></div>${n.lang !== L ? `<div class="about">${esc(D(L, "g.art.noteLang").replace("{L}", I18N[L].names[n.lang] || n.lang))}</div>` : ""}</div>`).join("")}${side === "a" ? `<button class="chip" data-note="${no}">＋ ${esc(D(L, "a.ml.noteBtn"))}</button>` : ""}</div>`;
  }
  async function renderArticle(box, no, L, side) {
    await loadNotes();
    const a = (await loadLearn()).find((x) => x.no === no); if (!a) return;
    const body = (a.body && (a.body[L] || a.body.en)) || [];
    box.innerHTML = `<div class="artv" lang="${L}"><div class="hero"><img src="${artImg(a)}" alt=""></div><div class="eyebrow c" style="margin-top:14px">${esc(D(L, "g.l." + a.group))} · ${esc(D(L, "g.x.min").replace("{N}", a.minutes || 4))}</div><h1>${esc(pick8(a.title, L))}</h1><p class="ld">${esc(pick8(a.lead, L))}</p>${body.map((x) => (x.h ? `<h3>${esc(x.h)}</h3>` : `<p>${esc(x.p)}</p>`)).join("")}${side === "g" && pick8(a.voice, L) ? `<div class="voice"><b>${esc(D(L, "g.l.voiceQ"))}</b><p>${esc(pick8(a.voice, L))}</p>${side === "g" ? `<button class="cta" data-askq="${a.no}">${esc(D(L, "g.l.ask"))}</button>` : ""}</div>` : ""}${notesHtml(a.no, L, side)}${(a.sources || []).length ? `<div class="src"><b>${esc(D(L, "g.l.src"))}</b><br>${a.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join("<br>")}</div>` : ""}</div>`;
    scroller(side === "g" ? "art" : "mart").scrollTop = 0;
  }
  $("#artBody").addEventListener("click", async (e) => { const b = e.target.closest("[data-askq]"); if (!b) return; const a = (await loadLearn()).find((x) => x.no === Number(b.dataset.askq)); $("#askText").value = pick8(a.voice, GL); go("ask"); });

  // 職人の学ぶ：自分の言葉がどう届くか（言いかえた日本語 → 各国の言葉）＋直す・違うと知らせる
  async function renderMl() {
    $$("#mlSeg button").forEach((b) => b.classList.toggle("on", b.dataset.seg === mlSeg));
    const want = mlSeg; let html;
    if (mlSeg === "words") {
      await loadFixes();
      const others = LANGS.filter((l) => l !== "ja");
      html = `<p class="lead">${esc(t("a.ml.lead"))}</p>` + WORLD.glossary.map((w) => {
        const mine = FB.filter((f) => f.term === w.ja);
        const fp = fixOf(w.ja, "plain"), shownOf = (l) => fixOf(w.ja, l)?.text || w.shown[l];
        const fixedBy = [...new Set(FIXES.filter((f) => f.term === w.ja).map((f) => whoLine(f.by, AL)))].filter(Boolean);
        return `<div class="wd"><div class="kj">${esc(w.ja)}<small>${esc(w.roma)}</small></div><div class="pl"><b>${esc(t("a.ml.plain"))}</b>${esc(fp ? fp.text : w.plain_ja)}</div><div class="ar">${esc(t("a.ml.arrive"))}</div><div class="tr">${others.map((l) => `<i>${esc(I18N[l].self)}</i><span class="${l === AL ? "me" : ""}" lang="${l}"><b>${esc(shownOf(l))}</b>${l === AL ? ` — ${esc(w.meaning[l])}` : ""}</span>`).join("")}</div><div class="act"><button class="chip" data-fx="${esc(w.ja)}" data-kind="fix">${esc(t("a.ml.fix"))}</button><button class="chip" data-fx="${esc(w.ja)}" data-kind="wrong">${esc(t("a.ml.wrong"))}</button></div>${fixedBy.length ? `<div class="fb fixd">${esc(t("g.gl.fixed", { P: fixedBy.join("、") }, AL))}</div>` : ""}${mine.map((f) => `<div class="fb">✓ ${esc(f.kind === "wrong" ? t("a.ml.flagged") : t("a.ml.yours"))} · ${esc(f.lang === "plain" ? t("a.ml.plain") : (I18N[f.lang] || {}).self || f.lang)}${f.text ? `：${esc(f.text)}` : ""}</div>`).join("")}</div>`;
      }).join("");
    } else html = await learnHtml(mlSeg, AL, "a");
    if (want === mlSeg && cur === "mlearn") $("#mlBox").innerHTML = html;
  }
  $("#mlSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-seg]"); if (!b) return; mlSeg = b.dataset.seg; renderMl(); });
  let fx = { term: "", kind: "fix", lang: "plain" };
  $("#mlBox").addEventListener("click", (e) => {
    const a = e.target.closest("[data-art]"); if (a) { curArt = Number(a.dataset.art); show("mart"); return; }
    const b = e.target.closest("[data-fx]"); if (!b) return;
    fx = { term: b.dataset.fx, kind: b.dataset.kind, lang: "plain" }; $("#fxWhich").hidden = false;
    $("#fxH").textContent = `${fx.term} · ${t(fx.kind === "fix" ? "a.ml.fix" : "a.ml.wrong")}`;
    paintFxWhich();
    $("#fxText").hidden = fx.kind !== "fix"; $("#fxText").value = ""; $("#fxText").placeholder = t("a.ml.fixPh"); showErr("#fxErr", "");
    const host = $("#s-" + cur); if (!host.contains($("#fixSheet"))) host.append($("#lveil"), $("#fixSheet"));
    $("#lveil").classList.add("show"); $("#fixSheet").classList.add("show");
  });
  function paintFxWhich() { $("#fxWhich").innerHTML = [["plain", t("a.ml.plain")], ...LANGS.filter((l) => l !== "ja").map((l) => [l, I18N[l].self])].map(([v, n]) => `<button class="chip ${v === fx.lang ? "on" : ""}" data-fl="${v}">${esc(n)}</button>`).join(""); }
  $("#fxWhich").addEventListener("click", (e) => { const b = e.target.closest("[data-fl]"); if (!b) return; fx.lang = b.dataset.fl; paintFxWhich(); });
  $("#martBody").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-note]"); if (!b) return;
    const a = (await loadLearn()).find((x) => x.no === Number(b.dataset.note));
    fx = { kind: "note", art: Number(b.dataset.note) };
    $("#fxH").textContent = `${t("a.ml.noteBtn")} · ${pick8(a && a.title, AL)}`;
    $("#fxWhich").hidden = true; $("#fxText").hidden = false; $("#fxText").value = ""; $("#fxText").placeholder = t("a.ml.notePh"); showErr("#fxErr", "");
    const host = $("#s-" + cur); if (!host.contains($("#fixSheet"))) host.append($("#lveil"), $("#fixSheet"));
    $("#lveil").classList.add("show"); $("#fixSheet").classList.add("show");
  });
  $("#fxSend").addEventListener("click", async () => {
    if (fx.kind === "note") {
      if (!$("#fxText").value.trim()) return showErr("#fxErr", t("a.ml.notePh"));
      try { await api("POST", "/bonsaigo/notes", { art: fx.art, text: $("#fxText").value, lang: AL }); closeSheets(); toast(t("a.ml.noteThanks")); renderArticle($("#martBody"), curArt, AL, "a"); }
      catch (er) { showErr("#fxErr", errText(er, "a")); }
      return;
    }
    if (fx.kind === "fix" && !$("#fxText").value.trim()) return showErr("#fxErr", t("a.ml.fixPh"));
    try { await api("POST", "/bonsaigo/gloss", { term: fx.term, lang: fx.lang, kind: fx.kind, text: $("#fxText").value }); closeSheets(); toast(t(fx.kind === "fix" ? "a.ml.thanks" : "a.ml.flagged")); renderMl(); }
    catch (er) { showErr("#fxErr", errText(er, "a")); }
  });

  /* ── 用語の札（意味と、なぜそうするか） ── */
  function openGloss(head) {
    const k = HEAD2KEY[head], g = GLOSSARY.find((x) => x.ja === head), w = WORLD.glossary.find((x) => x.ja === head);
    if (w) {
      $("#gK").textContent = head; $("#gR").textContent = w.roma;
      const SL = $("#s-" + cur).classList.contains("k") ? AL : GL;
      const fm = SL === "ja" ? null : fixOf(head, SL), fpl = fixOf(head, "plain");
      $("#gM").textContent = fm ? fm.text : SL === "ja" ? w.yomi : w.shown[SL]; $("#gP").textContent = SL === "ja" ? (fpl ? fpl.text : w.plain_ja) : w.meaning[SL];
      const fby = fm || (SL === "ja" && fpl); $("#gW").textContent = fby ? D(SL, "g.gl.fixed").replace("{P}", whoLine(fby.by, SL)) : "";
      const host = $("#s-" + cur); if (!host.contains($("#sheet"))) host.append($("#veil"), $("#sheet"));
      $("#veil").classList.add("show"); $("#sheet").classList.add("show"); return;
    }
    if (!k && !g) return;
    $("#gK").textContent = head; $("#gR").textContent = k ? ROMA[k] : (g.yomi || "");
    if (k) { $("#gM").textContent = t(`g.gloss.${k}.m`); $("#gP").textContent = t(`g.gloss.${k}.p`); $("#gW").textContent = ""; }
    else { $("#gM").textContent = g.common_en || ""; $("#gP").textContent = g.meaning_en || ""; $("#gW").innerHTML = g.why_en ? `<b>${esc(t("g.x.why"))}</b> · ${esc(g.why_en)}` : ""; }
    const host = $("#s-" + cur); if (!host.contains($("#sheet"))) host.append($("#veil"), $("#sheet"));
    $("#veil").classList.add("show"); $("#sheet").classList.add("show");
  }
  function closeSheets() { ["#veil", "#sheet", "#lveil", "#lsheet", "#costSheet", "#fixSheet"].forEach((s) => $(s).classList.remove("show")); }
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
    $("#origBtn").textContent = D(AL, "a.det.orig").replace(/\{G\}/g, I18N[AL].names[c.lang] || c.lang);
    $("#origBody").textContent = c.question; $("#origBody").hidden = true;
    $("#ansText").placeholder = t("a.x.editPh");
    $("#dAs").textContent = t("a.x.asWho", { P: nm(myPerson(), AL), E: gName(myGarden(), AL) });
    // 言葉が同じ・訳していない相談は、原文がそのまま本文
    $("#origBtn").hidden = Boolean(fc.raw);
    if (c.answer) $("#ansText").value = c.answer.voice_ja || $("#ansText").value;
    setMode(0);
    clearInterval(draftPoll);
    if (false) { // 答えの案は出さない方針（2026-11-08）。案を待つ問い合わせもしない
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
    if (f.same_lang || f.untranslated) return { title: f.title_ja, mitate: "", points: [c.question], terms: [], raw: true };
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
    $$("#ansModes [data-m='1'], #ansModes [data-m='2']").forEach((b) => (b.disabled = !d));
    $("#dDraft").innerHTML = `<div class="hd"><b>${esc(t("a.dr.hd"))}</b></div>` +
      (s === "making" ? `<div class="dr-text" style="color:var(--ink-2)">${esc(t("a.x.making"))}</div>` : d ? `<div class="dr-text">${esc(d.draft_ja)}</div>${d.check_ja?.length ? `<div style="padding:0 12px 12px"><b style="font-size:12.5px;color:var(--copper)">${esc(t("a.x.checkList"))}</b><ul class="checks">${d.check_ja.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}` : `<div class="dr-text" style="color:var(--ink-2)">${esc(t("a.x.noDraft"))}</div>`);
  }
  $("#origBtn").addEventListener("click", () => { const b = $("#origBody"); b.hidden = !b.hidden; });
  let fromDraft = false;
  // 答え方は4つ：Claude の案から始める（そのまま確かめへ）／案をもとに直す／自分で書く／声で話す
  function setMode(m) {
    $$("#ansModes [data-m]").forEach((b) => b.classList.toggle("on", b.dataset.m === String(m)));
    $("#ansModeT").textContent = m ? t(`a.ans.m${m}T`) : "";
  }
  $("#ansModes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-m]"); if (!b || b.disabled) return;
    const m = b.dataset.m, d = curConsult && draftOf(curConsult);
    if (m === "4") { setMode(4); voiceInto($("#b-mic"), $("#ansText"), "a.ans.m4"); return; }
    if (rec) rec.stop();
    setMode(m);
    if (m === "3") { if (fromDraft) $("#ansText").value = ""; fromDraft = false; $("#ansText").focus({ preventScroll: true }); }
  });

  // 声で入れる（ブラウザの音声入力。使えないときは文字で）
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SRL = { ja: "ja-JP", en: "en-US", es: "es-ES", zh: "zh-CN", fr: "fr-FR", it: "it-IT", th: "th-TH", km: "km-KH" };
  let rec = null;
  // side＝"g" なら相談する人の言葉で聞き取る
  function voiceInto(btn, field, label = "a.x.voice", side = "a") {
    const L = side === "g" ? GL : AL, stopK = side === "g" ? "g.ask.voiceStop" : "a.x.voiceStop", noK = side === "g" ? "g.ask.voiceNo" : "a.x.voiceNo";
    if (!SR) { toast(t(noK)); field.focus(); return; }
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = SRL[L] || "ja-JP"; rec.interimResults = true; rec.continuous = true;
    const base = field.value ? field.value + (L === "ja" || L === "zh" ? "" : " ") : "";
    btn.classList.add("mic-on"); $("span", btn).textContent = t(stopK);
    rec.onresult = (e) => { field.value = base + [...e.results].map((r) => r[0].transcript).join(""); };
    rec.onend = () => { rec = null; btn.classList.remove("mic-on"); $("span", btn).textContent = t(label); };
    rec.onerror = () => toast(t(noK));
    rec.start();
  }
  $("#b-regMic").addEventListener("click", () => voiceInto($("#b-regMic"), $("#regNote")));
  $("#b-askMic").addEventListener("click", () => { $("#askText").value === t("g.q") && ($("#askText").value = ""); voiceInto($("#b-askMic"), $("#askText"), "g.ask.voice", "g"); });

  let pending = null;
  $("#b-preview").addEventListener("click", async () => {
    const voice = $("#ansText").value.trim(); if (!voice) return showErr("#dErr", t("a.x.editPh"));
    showErr("#dErr", ""); busy("#dBusy", true);
    try {
      const r = await api("POST", `/consultations/${curConsult.id}/answer`, { voice, preview: true, from_draft: fromDraft, lang: AL });
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
    $("#confAfter").innerHTML = terms(D(AL, "a.conf.after").replace(/\{G\}/g, I18N[AL].names[curConsult.lang] || curConsult.lang), "a", true);
    $("#confBackB").textContent = D(AL, "a.conf.backB").replace(/\{G\}/g, I18N[AL].names[L] || L).replace(/\{A\}/g, I18N[AL].names[AL]);
    $("#confBack").textContent = MODE === "sample" ? plain("a.conf.back") : pending.back_translation_ja;
    // 言葉が同じなら、訳さずにそのまま届く（戻して確かめる欄は出さない）
    const raw = pending.same_lang || pending.untranslated;
    $("#s-confirm .back-tr").hidden = raw;
    $("#confSame").hidden = !pending.same_lang; $("#confSame").textContent = t("a.x.same", { L: I18N[AL].names[L] || L });
    const low = pending.review?.needs_person || pending.review?.ok === false;
    $("#replyLbl").textContent = t(low ? "a.x.sendAnyway" : "a.x.send");
    showErr("#cErr", "");
  };
  $("#b-reply").addEventListener("click", async () => {
    try {
      await api("POST", `/consultations/${curConsult.id}/answer`, { confirm: true, at: pending && pending.at });
      toast(D(AL, "a.x.sent").replace(/\{G\}/g, I18N[AL].names[curConsult.lang] || curConsult.lang));
      pending = null; fromDraft = false; hist.length = 0; show("inbox", { push: false });
    } catch (e) { showErr("#cErr", errText(e, "a")); }
  });

  /* ── 職人：木を登録 → 2段の確かめ → 送ったら、こう出る ── */
  let regPhoto = { kind: "pine", src: "img/reg.jpg" };
  function renderReg() {
    $("#regSp").innerHTML = REG_SPECIES.map(([k]) => `<option value="${k}">${esc(spName(k, AL))}</option>`).join("");
    $("#regSp").value = regSp; $("#regNote").placeholder = t("a.x.notePh"); $("#regName").placeholder = t("a.x.treeNamePh");
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
  const textProblems = (tc) => tc.codes && tc.codes.length ? tc.codes.map((c) => t("a.rule." + c)) : tc.problems_by_lang && tc.problems_by_lang[AL] ? [tc.problems_by_lang[AL]] : (AL === "ja" ? tc.problems_ja : tc.problems_en) || [];
  const confTxt = () => ""; // 点数は画面に出さない
  function verdict(kind, title, lines, by) {
    return `<div class="verdict v-${kind}"><div class="hd"><span class="ic"><svg><use href="#${kind === "hold" ? "i-hold" : "i-x"}"/></svg></span><b>${esc(title)}</b></div>${lines.length > 1 ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p>${esc(lines[0] || "")}</p>`}${by ? `<div class="by"><span>${esc(by)}</span></div>` : ""}</div>`;
  }
  $("#b-regGo").addEventListener("click", async () => {
    showErr("#rErr", ""); $("#regResult").innerHTML = "";
    $("#rBusyT").textContent = t("a.x.chkImg"); $("#rBusyM").textContent = "";
    busy("#rBusy", true); $("#scan").classList.add("on");
    const swap = setTimeout(() => { $("#rBusyT").textContent = t("a.x.drafting"); $("#rBusyM").textContent = t("a.x.writing8"); }, 1400);
    try {
      const image = await toB64(regPhoto.src);
      const tr = await api("POST", "/bonsaigo/trees", { images: [image], sample: regPhoto.kind, name: $("#regName").value.trim(), species: spName($("#regSp").value, "ja"), age: $("#regAge").value, note: $("#regNote").value });
      clearTimeout(swap); busy("#rBusy", false); $("#scan").classList.remove("on");
      curTree = tr; curTree.src = regPhoto.src;
      const ic = tr.image_check || {}, reason = imgReason(tr);
      const by = ""; // 点数は画面に出さない
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
    $("#pX").value = tr.draft.x[AL]; $("#pIg").value = tr.draft.instagram[AL];
    $("#pAllBody").innerHTML = LANGS.map((l) => `<div class="l" lang="${l}"><i>${l.toUpperCase()}</i><span>${esc(tr.draft.x[l])}</span></div>`).join("");
    $("#textResult").innerHTML = "";
  };
  $("#b-postOk").addEventListener("click", async () => {
    const tr = curTree; if (!tr) return;
    if (!$("#pX").value.trim() || !$("#pIg").value.trim()) { $("#textResult").innerHTML = `<p class="err">${esc(t("a.x.emptyPost"))}</p>`; return; }
    busy("#pBusy", true); $("#textResult").innerHTML = "";
    try {
      const r = await api("POST", `/bonsaigo/trees/${tr.id}/check`, { x: { ...tr.draft.x, [AL]: $("#pX").value }, instagram: { ...tr.draft.instagram, [AL]: $("#pIg").value } });
      busy("#pBusy", false);
      Object.assign(curTree, r);
      const tc = r.text_check || {}, probs = textProblems(tc);
      const by = ""; // 点数は画面に出さない
      if (r.status === "text_failed") { $("#textResult").innerHTML = verdict("ng", t("a.x.textFail"), probs || [], by); scrollEnd("posts"); return; }
      if (r.status === "text_held") { $("#textResult").innerHTML = verdict("hold", t("a.x.held"), [t("a.x.imgLow")], by); scrollEnd("posts"); return; }
      show("pub");
    } catch (e) { busy("#pBusy", false); $("#textResult").innerHTML = `<p class="err">${esc(errText(e, "a"))}</p>`; }
  });
  let pubLang = "en";
  function paintPub() {
    const f = curTree?.final || curTree?.draft; if (!f) return;
    $("#pubLangs").innerHTML = [AL, ...LANGS.filter((l) => l !== AL)].map((l) => `<button class="chip ${l === pubLang ? "on" : ""}" data-pl="${l}">${esc(I18N[l].self)}</button>`).join("");
    $("#pubX").textContent = f.x[pubLang]; $("#pubIg").textContent = f.instagram[pubLang];
    $("#pubX").lang = $("#pubIg").lang = pubLang;
  }
  $("#pubLangs").addEventListener("click", (e) => { const b = e.target.closest("[data-pl]"); if (!b) return; pubLang = b.dataset.pl; paintPub(); });
  enter.pub = () => {
    const tr = curTree; if (!tr) return;
    pubLang = AL;
    ["#pubImg1", "#pubImg2"].forEach((s) => ($(s).src = tr.src || "img/reg.jpg"));
    const ic = tr.image_check || {};
    $("#pc1T").textContent = imgReason(tr); $("#pc1C").textContent = confTxt(ic.confidence);
    $("#pc2C").textContent = confTxt(tr.text_check?.confidence);
    paintPub();
    ["#pc1", "#pc2", "#sp1", "#sp2"].forEach((s) => $(s).classList.remove("done", "show"));
    setTimeout(() => $("#pc1").classList.add("done"), 350); setTimeout(() => $("#pc2").classList.add("done"), 900);
    setTimeout(() => $("#sp1").classList.add("show"), 1400); setTimeout(() => $("#sp2").classList.add("show"), 1800);
    $("#pubState").classList.remove("done"); $("#pubStateT").textContent = t("a.pub.posting"); $("#pubLinks").hidden = true;
    setTimeout(() => { $("#pubState").classList.add("done"); $("#pubStateT").textContent = t("a.pub.posted"); $("#pubLinks").hidden = false; }, 2300);
  };
  $("#b-again").addEventListener("click", () => { hist.length = 0; pickReg("pine", "img/reg.jpg"); $("#regNote").value = ""; $("#regName").value = ""; show("reg", { push: false }); });

  /* ── 料金の守り ── */
  async function loadCost() {
    try {
      const c = await api("GET", "/bonsaigo/cost"); MODE = c.mode;
      const L = sideLang();
      const meter = `<div><b>${c.today.total}<small>/${c.limits.total}</small></b><span>${esc(D(L, "c.cost.today").split("·")[0].replace(/\{N\}.*$/, "").trim() || "Today")}</span><div class="bar"><i style="width:${Math.min(100, c.today.total / c.limits.total * 100)}%"></i></div></div><div><b>${c.today.me}<small>/${c.limits.perUser}</small></b><span>${esc(ME ? (ME.role === "shokunin" ? nm(TEACHERS.find((x) => x.id === ME.teacher_id)) || ME.name : ME.name) : "—")}</span><div class="bar"><i style="width:${Math.min(100, c.today.me / c.limits.perUser * 100)}%"></i></div></div><div><b>${c.today.cache_hits}</b><span>${esc(D(L, "c.cached"))}</span></div>`;
      $("#cMeter").innerHTML = meter;
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
    if (pickFor === "a") { AL = b.dataset.l; store.set("bg-a", AL); }
    else { GL = b.dataset.l; store.set("bg-l", GL); if (!store.get("bg-a", "")) AL = GL; }
    paintGtag();
    // 選んだ言葉で、言葉の一覧も描き直す（閉じた札に前の言葉が残らないように）
    { const ui = I18N[b.dataset.l]; $("#lTitle").textContent = D(b.dataset.l, "c.pick"); $("#lList").innerHTML = LANGS.map((l) => `<button data-l="${l}" class="${l === b.dataset.l ? "on" : ""}"><b>${I18N[l].self}</b><span>${ui.names[l]}</span></button>`).join(""); }
    applyLang(); enter[cur] && enter[cur]();
    setTimeout(closeSheets, 220);
  });
  $("#lveil").addEventListener("click", closeSheets);

  function applyLang() {
    // 職人の画面の中は、相談する人の言葉の鍵（g.）でも、職人が選んだ言葉で出す
    $$("[data-i18n]").forEach((el) => { const k = el.dataset.i18n, inA = Boolean(el.closest(".scr.k")); el.innerHTML = terms(t(k, el.dataset.n != null ? { N: el.dataset.n } : undefined, inA ? AL : undefined), inA || k.startsWith("a.") ? "a" : "g", true); });
    $("#qaQ").placeholder = D(GL, "g.qa.search");
    $$("[data-pick]").forEach((b) => { b.querySelector(".lp-name").textContent = I18N[b.dataset.pick === "g" ? GL : AL].self; });
    $$(".scr:not(.k)").forEach((el) => (el.lang = GL === "zh" ? "zh-CN" : GL));
    $$(".scr.k").forEach((el) => (el.lang = AL === "zh" ? "zh-CN" : AL));
    document.documentElement.lang = sideLang();
    paintMode();
    paintGtag();
  }

  /* ── 大きさ合わせ ── */
  function fit() {
    if (innerWidth <= 560) { document.documentElement.style.setProperty("--s", 1); return; }
    const side = 40; // PCでも説明欄は出さず、スマホの枠だけ
    const s = Math.min((innerHeight - 40) / 844, 1.1, (innerWidth - side) / 390);
    document.documentElement.style.setProperty("--s", Math.max(0.5, s).toFixed(3));
  }
  addEventListener("resize", fit); fit();

  /* ── はじめ ── */
  (async () => {
    applyLang();
    try { WORLD = await (await fetch("data/world.json")).json(); } catch {}
    try { const d = await api("GET", "/me"); ME = d.user; TEACHERS = d.teachers || []; GARDENS = d.gardens || []; paintGtag(); } catch {}
    try { GLOSSARY = await (await fetch("../用語集.json")).json(); } catch {}
    loadCost();
    // #home などで、その画面から開ける（録画・確かめ用）
    const h = location.hash.slice(1);
    if (h && $("#s-" + h)) go(h);
  })();
})();
