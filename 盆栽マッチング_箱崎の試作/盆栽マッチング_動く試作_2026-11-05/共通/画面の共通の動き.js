/* 盆栽アプリ モック 画面の共通の動き 2026-11-04
   - 上の帯・下のタブを差し込む（<body data-screen="03"> を見る）
   - 言語の切り替え（日本語／英語／スペイン語／中国語）
   - 用語に触ると「直訳／意味／なぜそうするか」が開く
   - 写真の代わりの盆栽の図（SVG）
   使う前に 用語集データ.js を先に読み込むこと。 */
(function () {
  "use strict";

  /* ---------- 画面の一覧（一覧ページとナビの元） ---------- */
  var SCREENS = [
    { no: "00", file: "00_ホーム_職人と愛好家.html", role: "both", status: "新規",
      t: { ja: "ホーム", en: "Home", es: "Inicio", zh: "首页" },
      name: "ホーム（職人と海外の愛好家）", desc: "使う人を選ぶと、その人がいまやることと、全部の機能への入口が出る。どの画面からもここに戻れる" },
    { no: "01", file: "01_ホーム_博物館の入口.html", role: "aikouka", status: "決定",
      t: { ja: "盆栽の間", en: "The Bonsai Hall", es: "Sala del Bonsái", zh: "盆栽之馆" },
      name: "ホーム（博物館の入口）", desc: "新着の相談・Q&A・職人の日記・記事を1か所に並べる入口。言語を切り替えられる" },
    { no: "02", file: "02_1鉢のページ.html", role: "aikouka", status: "決定",
      t: { ja: "一鉢のページ", en: "One Tree", es: "Un árbol", zh: "一盆详情" },
      name: "1鉢のページ", desc: "1鉢を商品ページのように説明。正面・見上げ・石を崖に見立てる見方、不等辺三角形と幹の腰" },
    { no: "03", file: "03_職人への相談_愛好家.html", role: "aikouka", status: "決定",
      t: { ja: "職人に相談する", en: "Ask a Craftsperson", es: "Consultar a un maestro", zh: "咨询匠人" },
      name: "職人への相談（愛好家側）", desc: "木の写真をつけて、自分の言葉で質問して送る" },
    { no: "04", file: "04_職人の画面_相談を受ける.html", role: "shokunin", status: "決定",
      t: { ja: "相談が届きました", en: "相談が届きました", es: "相談が届きました", zh: "相談が届きました" },
      name: "職人の画面（相談を受ける）", desc: "盆栽の言い方の日本語で届く。ボタンは「話す・書き込む・送る」の3つ、字は大きく" },
    { no: "05", file: "05_答えが届く_愛好家.html", role: "aikouka", status: "決定",
      t: { ja: "職人からの答え", en: "Your Answer", es: "Tu respuesta", zh: "匠人的回答" },
      name: "答えが届く（愛好家側）", desc: "書き込み入りの写真と、意訳した答え。用語に触ると「直訳／意味／なぜそうするか」" },
    { no: "06", file: "06_質問と答え_QandA.html", role: "aikouka", status: "決定",
      t: { ja: "質問と答え", en: "Q&A", es: "Preguntas", zh: "问答" },
      name: "Q&A", desc: "1つの質問に複数の職人が答え、知見がたまる。育て方などの軸で整理" },
    { no: "07", file: "07_掲示板.html", role: "aikouka", status: "決定",
      t: { ja: "掲示板", en: "Community", es: "Comunidad", zh: "交流区" },
      name: "掲示板", desc: "自由に交流する場。地域・木の種類で分ける" },
    { no: "08", file: "08_AIの相談窓口.html", role: "aikouka", status: "会議で出た案",
      t: { ja: "AIの相談窓口", en: "AI Helper", es: "Asistente IA", zh: "AI 助手" },
      name: "AIの相談窓口（サポートボット）", desc: "職人に聞く前にAIが答える。答えきれないときは「職人に聞く」へつなぐ" },
    { no: "09", file: "09_職人の日記.html", role: "aikouka", status: "会議で出た案",
      t: { ja: "職人の日記", en: "Craftsperson's Journal", es: "Diario del maestro", zh: "匠人日记" },
      name: "職人の日記", desc: "職人が話すだけで、AIが日記にまとめる。引退とともに消える知恵を残す" },
    { no: "10", file: "10_学ぶ_歴史と育て方.html", role: "aikouka", status: "決定",
      t: { ja: "学ぶ", en: "Learn", es: "Aprender", zh: "学习" },
      name: "学ぶ（歴史・育て方の記事）", desc: "盆栽の歴史・育て方の記事。本文は【下書き・未確認】" },
    { no: "11", file: "11_用語集.html", role: "aikouka", status: "決定",
      t: { ja: "用語集", en: "Glossary", es: "Glosario", zh: "术语表" },
      name: "用語集", desc: "122語。用語ごとに「直訳／意味／なぜそうするか」と、確かめた／未確認の印" },
    { no: "12", file: "12_SNS投稿の下書き.html", role: "shokunin", status: "決定",
      t: { ja: "投稿の下書き", en: "投稿の下書き", es: "投稿の下書き", zh: "投稿の下書き" },
      name: "SNS投稿の下書き", desc: "相談とQ&Aから、X・Facebook・Instagramの下書き。職人は「OK」を押すだけ" },
    { no: "13", file: "13_職人を探す.html", role: "aikouka", status: "会議で出た案",
      t: { ja: "職人を探す", en: "Find a Craftsperson", es: "Buscar maestro", zh: "寻找匠人" },
      name: "職人を探す・連絡する", desc: "職人の紹介ページ（架空）から相談できる" },
    { no: "14", file: "14_欲しい盆栽を伝える_仮.html", role: "aikouka", status: "仮",
      t: { ja: "欲しい盆栽を伝える", en: "Request a Tree", es: "Pedir un árbol", zh: "发布需求" },
      name: "欲しい盆栽を伝える（マーケットプレイスの入口）", desc: "買い手が欲しい盆栽の写真・条件を先に出し、合う職人とつなぐ" },
    { no: "15", file: "15_職人の手直しを図で_仮.html", role: "aikouka", status: "仮",
      t: { ja: "手直しを図で見る", en: "See the Correction", es: "Ver la corrección", zh: "查看修整示意" },
      name: "職人の手直しを図で見せる", desc: "写真（3Dの代わりの図）に職人が直す線を引き、言葉なしで伝える" },
    { no: "16", file: "16_使う人で変わる画面の比べ.html", role: "kurabe", status: "決定",
      t: { ja: "使う人で変わる画面", en: "One Exchange, Two Screens", es: "Dos pantallas", zh: "同一对话，两种界面" },
      name: "使う人で変わる画面の比べ", desc: "同じやり取りを、職人の画面と愛好家の画面で左右に並べる" },
    { no: "17", file: "17_撮るだけで発信_職人.html", role: "shokunin", status: "新規",
      t: { ja: "撮って発信", en: "撮って発信", es: "撮って発信", zh: "撮って発信" },
      name: "撮るだけで発信", desc: "写真か動画を撮るだけで、X・Instagram・Facebook・ショート動画の下書きが3言語でそろう。文化の一言つき" },
    { no: "18", file: "18_知りたいことから職人を探す.html", role: "aikouka", status: "新規",
      t: { ja: "職人を見つける", en: "Find Your Craftsperson", es: "Encuentra a tu maestro", zh: "找到你的匠人" },
      name: "知りたいことから職人を探す", desc: "知りたいことを母語で書くと、合う職人が理由つきで出る" },
    { no: "19", file: "19_話して先生に登録_職人.html", role: "shokunin", status: "新規",
      t: { ja: "先生に登録", en: "先生に登録", es: "先生に登録", zh: "先生に登録" },
      name: "話して先生に登録", desc: "教えられることを話すだけで、紹介ページが3言語でできる" },
    { no: "20", file: "20_職人に入るお金_職人.html", role: "shokunin", status: "新規",
      t: { ja: "入るお金", en: "入るお金", es: "入るお金", zh: "入るお金" },
      name: "職人に入るお金", desc: "答えた相談から、職人にいくら入るかを見せる。料金はサンプル" },
    { no: "21", file: "21_話すか撮るだけ_1鉢の記録と出品_職人.html", role: "shokunin", status: "新規",
      t: { ja: "話すか撮るだけ", en: "話すか撮るだけ", es: "話すか撮るだけ", zh: "話すか撮るだけ" },
      name: "話すか撮るだけ・1鉢の記録と出品の下書き", desc: "話すか撮ると、AIが発信・出品・先生の登録を聞き分けて、木ごとの記録に残す。出品は下書きまで" }
  ];
  window.SCREENS = SCREENS;

  /* ---------- 言語 ---------- */
  var LANGS = [
    { code: "ja", label: "日本語", short: "日" },
    { code: "en", label: "English", short: "EN" },
    { code: "es", label: "Español", short: "ES" },
    { code: "zh", label: "中文", short: "中" }
  ];
  var KEY = "bonsai-mock-lang";
  function readLang() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (q) return q;
      return localStorage.getItem(KEY) || "en";
    } catch (e) { return "en"; }
  }
  var current = readLang();
  if (!LANGS.some(function (l) { return l.code === current; })) current = "en";

  /* 文字を選ぶ。ない言語は 英語 → 日本語 の順で代わりに出す */
  function T(obj) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    return obj[current] || obj.en || obj.ja || "";
  }
  function getLang() { return document.body && document.body.classList.contains("role-shokunin") ? "ja" : current; }

  /* <span class="t"> の中から、いまの言語の子だけを見せる */
  function pickT(box, lang) {
    var kids = Array.prototype.filter.call(box.children, function (c) { return c.hasAttribute("data-l"); });
    var pick = kids.find(function (c) { return c.getAttribute("data-l") === lang; }) ||
               kids.find(function (c) { return c.getAttribute("data-l") === "en"; }) || kids[0];
    /* 図（SVG）の中の文字には hidden が効かないので、display でも隠す */
    kids.forEach(function (c) { var off = c !== pick; c.toggleAttribute("hidden", off); c.style.display = off ? "none" : ""; });
  }
  function applyT(root) {
    var lang = getLang();
    if (root.nodeType === 1 && root.classList.contains("t")) pickT(root, lang);
    if (root.querySelectorAll) root.querySelectorAll(".t").forEach(function (b) { pickT(b, lang); });
  }
  /* 画面のJSがあとから差し込んだ文にも、言語の切り替えを効かせる */
  function watchT() {
    if (!window.MutationObserver) return;
    new MutationObserver(function (list) {
      list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) applyT(n); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  function applyLang() {
    var lang = getLang();
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : lang;
    /* <span class="t"><span data-l="ja">…</span><span data-l="en">…</span></span> */
    applyT(document);
    /* 入力欄の見本の文字: data-ph-ja / data-ph-en / … */
    document.querySelectorAll("[data-ph-en],[data-ph-ja]").forEach(function (el) {
      el.placeholder = el.getAttribute("data-ph-" + lang) || el.getAttribute("data-ph-en") || el.getAttribute("data-ph-ja") || "";
    });
    /* 選択肢の文字: <option data-o-ja data-o-en …> */
    document.querySelectorAll("option[data-o-en]").forEach(function (o) {
      o.textContent = o.getAttribute("data-o-" + lang) || o.getAttribute("data-o-en");
    });
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-code") === lang));
    });
    var me = SCREENS.find(function (s) { return s.no === document.body.getAttribute("data-screen"); });
    var titleEl = document.querySelector(".appbar__title");
    if (me && titleEl) titleEl.textContent = T(me.t);
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: lang } }));
  }
  function setLang(code) {
    current = code;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    applyLang();
  }

  /* ---------- 上の帯・下のタブ ---------- */
  var ICON = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    learn: '<svg viewBox="0 0 24 24"><path d="M4 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4z"/><path d="M20 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z"/></svg>',
    ask: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h6"/></svg>',
    qa: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7"/><path d="M12 17h.01"/></svg>',
    board: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>'
  };
  /* 下のメニュー：海外の愛好家と職人で中身を分ける。どちらも先頭はホーム */
  var TABS = [
    { no: "00", icon: "home", t: { ja: "ホーム", en: "Home", es: "Inicio", zh: "首页" } },
    { no: "10", icon: "learn", t: { ja: "学ぶ", en: "Learn", es: "Aprender", zh: "学习" } },
    { no: "18", icon: "ask", t: { ja: "職人を探す", en: "Find", es: "Buscar", zh: "找匠人" } },
    { no: "06", icon: "qa", t: { ja: "Q&A", en: "Q&A", es: "Preguntas", zh: "问答" } },
    { no: "07", icon: "board", t: { ja: "掲示板", en: "Community", es: "Comunidad", zh: "交流" } }
  ];
  var TABS_S = [
    { no: "00", icon: "home", t: { ja: "ホーム" } },
    { no: "04", icon: "ask", t: { ja: "相談" } },
    { no: "21", icon: "learn", t: { ja: "私の木" } },
    { no: "20", icon: "board", t: { ja: "お金" } }
  ];
  /* 下のタブで、そのタブの仲間とみなす画面 */
  var TAB_GROUP = { "00": "00", "01": "00", "02": "00", "09": "00", "14": "00", "10": "10", "11": "10",
    "03": "18", "05": "18", "08": "18", "13": "18", "15": "18", "18": "18", "06": "06", "07": "07" };
  var TAB_GROUP_S = { "00": "00", "04": "04", "12": "00", "17": "00", "19": "00", "20": "20", "21": "21" };

  function fileOf(no) { var s = SCREENS.find(function (x) { return x.no === no; }); return s ? s.file : "index.html"; }
  window.fileOf = fileOf;
  /* ホームへのリンク。職人の画面からは職人のホームへ */
  function homeHref(shokunin) { return fileOf("00") + "?role=" + (shokunin ? "shokunin" : "aikouka"); }
  window.homeHref = homeHref;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  window.esc = esc;

  function tSpan(obj) {
    return '<span class="t">' + Object.keys(obj).map(function (k) { return '<span data-l="' + k + '">' + esc(obj[k]) + "</span>"; }).join("") + "</span>";
  }
  window.tSpan = tSpan;

  function buildChrome() {
    var body = document.body;
    var no = body.getAttribute("data-screen");
    var me = SCREENS.find(function (s) { return s.no === no; });
    var shokunin = body.classList.contains("role-shokunin");
    var params = new URLSearchParams(location.search);
    if (params.get("embed") === "1") body.classList.add("embed");

    var bar = document.getElementById("appbar");
    if (bar) {
      bar.className = "appbar";
      var langHtml = shokunin
        ? ""
        : (me && me.role === "kurabe") ? '<span class="appbar__role">2つの画面を並べて比べる</span>'
        : '<div class="lang" role="group" aria-label="Language">' + LANGS.map(function (l) {
            return '<button type="button" data-code="' + l.code + '" title="' + l.label + '">' + l.short + "</button>";
          }).join("") + "</div>";
      bar.innerHTML =
        '<a class="appbar__back" href="' + homeHref(shokunin) + '" title="ホームへ" aria-label="ホームへ">' + (shokunin ? "ホーム" : tSpan({ ja: "ホーム", en: "Home", es: "Inicio", zh: "首页" })) + '</a>' +
        '<div class="appbar__title">' + (me ? esc(T(me.t)) : "") + "</div>" + langHtml;
      bar.querySelectorAll(".lang button").forEach(function (b) {
        b.addEventListener("click", function () { setLang(b.getAttribute("data-code")); });
      });
    }
    var tab = document.getElementById("tabbar");
    if (tab) {
      if (body.classList.contains("no-tabbar")) { tab.remove(); }
      else {
        var tabs = shokunin ? TABS_S : TABS, group = shokunin ? TAB_GROUP_S : TAB_GROUP;
        tab.className = "tabbar";
        tab.style.gridTemplateColumns = "repeat(" + tabs.length + ", 1fr)";
        tab.setAttribute("aria-label", shokunin ? "職人のメニュー" : "main");
        tab.innerHTML = tabs.map(function (x) {
          var cur = group[no] === x.no ? ' aria-current="page"' : "";
          var href = x.no === "00" ? homeHref(shokunin) : fileOf(x.no);
          return '<a href="' + href + '"' + cur + ">" + ICON[x.icon] + tSpan(x.t) + "</a>";
        }).join("");
      }
    }
    /* 画面の下の注記 */
    var page = document.querySelector(".page");
    if (page && !document.querySelector(".mock-foot")) {
      var f = document.createElement("p");
      f.className = "mock-foot";
      var kari = me && me.status === "仮";
      f.innerHTML = tSpan({
        ja: "試作です。名前・図・数字はすべてサンプルで、実在の職人・盆栽園とは関係ありません。" + (kari ? " この画面は会議で決まっていない「仮」の案です。" : ""),
        en: "This is a prototype. All names, pictures and numbers are samples and do not refer to real craftspeople or gardens." + (kari ? " This screen is a tentative idea that has not been decided." : ""),
        es: "Prototipo. Nombres, imágenes y cifras son de ejemplo." + (kari ? " Pantalla provisional, aún no decidida." : ""),
        zh: "这是试作版。姓名、图片和数字均为示例。" + (kari ? " 此页面为暂定方案，尚未决定。" : "")
      });
      page.appendChild(f);
    }
  }

  /* ---------- 用語の説明（下から開くシート） ---------- */
  function findTerm(key) {
    var list = window.YOUGO || [];
    return list.find(function (t) { return t.id === key || t.ja === key; });
  }
  window.findTerm = findTerm;

  var L = {
    literal: { ja: "直訳すると", en: "Word-for-word", es: "Traducción literal", zh: "直译" },
    common: { ja: "英語での言い方", en: "What it's called in English", es: "Nombre habitual (inglés)", zh: "英文常用说法" },
    meaning: { ja: "意味", en: "What it means", es: "Qué significa", zh: "含义" },
    why: { ja: "なぜそうするか", en: "Why it's done", es: "Por qué se hace", zh: "为什么这样做" },
    ok: { ja: "確かめた", en: "Checked", es: "Verificado", zh: "已核实" },
    mi: { ja: "未確認", en: "Not yet checked", es: "Sin verificar", zh: "未核实" },
    src: { ja: "出どころ", en: "Source", es: "Fuente", zh: "出处" },
    close: { ja: "閉じる", en: "Close", es: "Cerrar", zh: "关闭" },
    enOnly: { ja: "", en: "", es: "Explicación en inglés (versión de prueba).", zh: "说明暂以英文显示（试作版）。" },
    literalNote: { ja: "直訳だと意味がずれるので、下の意味で伝えます", en: "A literal translation misleads — so we explain it instead.", es: "La traducción literal confunde; por eso lo explicamos.", zh: "直译会产生误解，所以我们解释它的含义。" }
  };

  /* デモの1往復で出る用語だけ、スペイン語・中国語の説明を持たせる（ほかの語は英語で出す） */
  var TAYOU = {
    "水のやりすぎ": {
      es: { n: "exceso de riego", l: "dar agua demasiado", m: "Regar con demasiada frecuencia o en exceso.", w: "Es una de las causas más comunes de problemas: por cariño se riega a diario, y las raíces se dañan." },
      zh: { n: "浇水过多", l: "给水太多", m: "浇水过于频繁或过多。", w: "这是盆栽出问题最常见的原因之一：出于关心每天浇水，反而伤了根。" } },
    "乾湿のメリハリ": {
      es: { n: "dejar secar entre riegos", l: "contraste claro de seco y húmedo", m: "Dejar que la tierra se seque y luego regar a fondo.", w: "Si se riega antes de que se seque, las raíces no respiran y se pudren. Al secarse entra aire en la maceta." },
      zh: { n: "干透再浇", l: "干湿分明", m: "等土干透后再一次浇透。", w: "土还没干就再浇水，根无法呼吸会烂根。土干后盆中才会进入空气。" } },
    "置き場所": {
      es: { n: "ubicación", l: "lugar de poner", m: "El lugar donde se coloca el bonsái, pensando en el sol y el viento.", w: "Un lugar inadecuado, como el sol fuerte de la tarde, daña las hojas y las vuelve amarillas." },
      zh: { n: "摆放位置", l: "放置的地方", m: "考虑日照和通风来摆放盆栽的位置。", w: "位置不合适（例如下午的强烈西晒）会伤叶，使叶子变黄。" } },
    "植え替え": {
      es: { n: "trasplante", l: "volver a plantar", m: "Sacar el árbol, quitar la tierra vieja, ordenar las raíces y plantarlo en tierra nueva.", w: "Con los años la tierra ya no deja pasar agua ni aire. Se hace justo antes de que el árbol despierte en primavera." },
      zh: { n: "换盆", l: "重新种植", m: "把树从盆中取出，去掉旧土、整理根系，再用新土种回。", w: "旧土会让水和空气无法到达根部。在春季树木苏醒前进行，根最容易恢复。" } },
    "黄化": {
      es: { n: "clorosis / hojas amarillas", l: "volverse amarillo", m: "Las hojas pierden el verde y se vuelven amarillas.", w: "Tiene varias causas posibles; lo primero es revisar cómo se riega." },
      zh: { n: "黄化 / 叶子发黄", l: "变黄", m: "叶子的绿色变淡、发黄。", w: "原因有很多，首先要检查浇水的方式。" } }
  };

  var CAT = {
    "手入れ": { en: "Care", es: "Cuidados", zh: "养护" },
    "鉢と土": { en: "Pots and soil", es: "Maceta y tierra", zh: "盆与土" },
    "木の形": { en: "Tree styles", es: "Estilos", zh: "树形" },
    "木の部位": { en: "Parts of the tree", es: "Partes del árbol", zh: "树的部位" },
    "季節の作業": { en: "Seasonal work", es: "Trabajo de temporada", zh: "季节作业" },
    "病気・虫・不調": { en: "Pests and problems", es: "Plagas y problemas", zh: "病虫害与异常" }
  };
  window.CAT = CAT;

  function openTerm(key) {
    var t = findTerm(key);
    if (!t) return;
    var lang = getLang();
    var isJa = lang === "ja";
    var tay = (TAYOU[t.ja] || {})[lang];
    closeSheet();
    var back = document.createElement("div");
    back.className = "sheet-backdrop";
    var sh = document.createElement("div");
    sh.className = "sheet";
    sh.setAttribute("role", "dialog");
    sh.setAttribute("aria-modal", "true");
    sh.setAttribute("aria-label", t.ja);
    var badge = t.status === "確かめた"
      ? '<span class="badge-ok">' + esc(T(L.ok)) + "</span>"
      : '<span class="badge-mi">' + esc(T(L.mi)) + "</span>";
    sh.innerHTML =
      '<div class="sheet__grip"></div>' +
      '<p class="sheet__term">' + esc(t.ja) + (isJa ? "" : ' <span style="font-family:var(--gothic);font-size:1rem;color:var(--sumi-2)">' + esc(tay ? tay.n : t.common_en) + "</span>") + "</p>" +
      '<p class="sheet__yomi">' + esc(t.yomi || "") + " ・ " + esc(isJa ? (t.category || "") : T(CAT[t.category] || { en: t.category || "" })) + " " + badge + "</p>" +
      "<dl>" +
      "<dt>" + esc(T(L.literal)) + "</dt><dd class=\"is-literal\">" + esc(tay ? tay.l : t.literal_en) + "</dd>" +
      '<dd class="note">' + esc(T(L.literalNote)) + "</dd>" +
      (isJa ? "<dt>" + esc(T(L.common)) + "</dt><dd>" + esc(t.common_en) + "</dd>" : "") +
      "<dt>" + esc(T(L.meaning)) + "</dt><dd>" + esc(isJa ? t.meaning_ja : (tay ? tay.m : t.meaning_en)) + "</dd>" +
      "<dt>" + esc(T(L.why)) + "</dt><dd>" + esc(isJa ? t.why_ja : (tay ? tay.w : t.why_en)) + "</dd>" +
      "</dl>" +
      ((lang === "es" || lang === "zh") && !tay ? '<p class="note" style="margin-top:var(--s4)">' + esc(T(L.enOnly)) + "</p>" : "") +
      (t.source ? '<p class="note" style="margin-top:var(--s4)">' + esc(T(L.src)) + '：<a href="' + esc(t.source) + '" target="_blank" rel="noopener">' + esc(t.source.replace(/^https?:\/\//, "").slice(0, 40)) + "…</a></p>" : "") +
      '<button type="button" class="btn btn--quiet btn--wide sheet__close">' + esc(T(L.close)) + "</button>";
    document.body.appendChild(back);
    document.body.appendChild(sh);
    back.addEventListener("click", closeSheet);
    sh.querySelector(".sheet__close").addEventListener("click", closeSheet);
    sh.querySelector(".sheet__close").focus();
  }
  function closeSheet() {
    document.querySelectorAll(".sheet, .sheet-backdrop").forEach(function (n) { n.remove(); });
  }
  window.openTerm = openTerm;
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-term]");
    if (el) { e.preventDefault(); openTerm(el.getAttribute("data-term")); }
  });

  /* ---------- 知らせ ---------- */
  function toast(msg) {
    var old = document.querySelector(".toast"); if (old) old.remove();
    var el = document.createElement("div");
    el.className = "toast"; el.setAttribute("role", "status"); el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }
  window.toast = toast;

  /* ---------- 写真の代わりの盆栽の図 ----------
     <figure class="zu" data-zu="moyogi"></figure>
     種類: moyogi（模様木・正面） / miage（下から見上げる） / ishitsuki（石を崖に見立てる）
           kengai（懸崖） / kiiro（葉が黄色い・相談の木） / chokkan（直幹） / yose（寄せ植え） */
  var C = { bg: "#F1EEE8", trunk: "#5A4636", trunk2: "#3F3127", leaf: "#4C6B44", leaf2: "#3A5534", leaf3: "#6F8A5C",
    yel: "#C9A640", yel2: "#A98A2E", pot: "#6B5A4A", pot2: "#4E4136", soil: "#3A2F27", rock: "#8D877C", rock2: "#6E685E", moss: "#7C9461", line: "#23201B" };

  function pad(cx, cy, rx, ry, c1, c2) {
    /* 雲のような葉のかたまり */
    return '<g><ellipse cx="' + cx + '" cy="' + (cy + ry * 0.25) + '" rx="' + rx + '" ry="' + ry * 0.75 + '" fill="' + c2 + '"/>' +
      '<ellipse cx="' + (cx - rx * 0.45) + '" cy="' + cy + '" rx="' + rx * 0.55 + '" ry="' + ry * 0.7 + '" fill="' + c1 + '"/>' +
      '<ellipse cx="' + (cx + rx * 0.4) + '" cy="' + (cy - ry * 0.05) + '" rx="' + rx * 0.6 + '" ry="' + ry * 0.72 + '" fill="' + c1 + '"/>' +
      '<ellipse cx="' + cx + '" cy="' + (cy - ry * 0.3) + '" rx="' + rx * 0.5 + '" ry="' + ry * 0.55 + '" fill="' + c1 + '"/></g>';
  }
  function pot(x, y, w, h) {
    return '<rect x="' + (x - 6) + '" y="' + (y - 6) + '" width="' + (w + 12) + '" height="8" rx="2" fill="' + C.soil + '"/>' +
      '<path d="M' + (x - 10) + " " + y + "h" + (w + 20) + "l-8 " + h + "h-" + (w + 4) + 'z" fill="' + C.pot + '"/>' +
      '<rect x="' + (x - 10) + '" y="' + y + '" width="' + (w + 20) + '" height="5" fill="' + C.pot2 + '"/>' +
      '<rect x="' + (x + 6) + '" y="' + (y + h) + '" width="12" height="5" fill="' + C.pot2 + '"/>' +
      '<rect x="' + (x + w - 18) + '" y="' + (y + h) + '" width="12" height="5" fill="' + C.pot2 + '"/>';
  }
  function svgWrap(inner, label) {
    return '<svg viewBox="0 0 320 240" role="img" aria-label="' + esc(label) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="320" height="240" fill="' + C.bg + '"/>' + inner + "</svg>";
  }
  var ZU = {
    moyogi: function (o) {
      var l1 = o.yellow ? C.yel : C.leaf, l2 = o.yellow ? C.yel2 : C.leaf2;
      return svgWrap(
        '<rect x="0" y="196" width="320" height="44" fill="#E5E1D9"/>' +
        pot(98, 176, 124, 26) +
        /* 根張り */
        '<path d="M128 176c10-6 22-8 30-8s22 2 32 8z" fill="' + C.trunk2 + '"/>' +
        /* 幹：腰で左へ、上で右へ（模様木） */
        '<path d="M146 172c-4-22-22-34-18-56s30-26 26-50c-2-12 2-22 8-30l6 2c-4 10-6 18-3 30 5 26-22 32-24 50-2 20 16 32 22 56z" fill="' + C.trunk + '"/>' +
        '<path d="M140 120c-14-4-34-2-52 8l2 4c18-8 34-9 48-6z" fill="' + C.trunk + '"/>' +
        '<path d="M156 92c16-6 36-6 56 2l-2 4c-18-6-36-6-52-2z" fill="' + C.trunk + '"/>' +
        /* 葉が黄色い木は、下の古い葉ほど黄色く、上の新しい葉は緑のまま */
        pad(84, 124, 40, 18, l1, l2) + pad(218, 92, 44, 19, o.yellow ? "#9C9A4E" : l1, o.yellow ? "#7E7E3E" : l2) +
        pad(150, 70, 36, 18, o.yellow ? C.leaf3 : l1, o.yellow ? C.leaf : l2) + pad(168, 38, 30, 16, o.yellow ? C.leaf : l1, o.yellow ? C.leaf2 : l2) +
        (o.yellow ? pad(110, 148, 18, 8, C.yel2, C.yel2) : ""), o.label || "模様木の盆栽の図");
    },
    kiiro: function () { return ZU.moyogi({ yellow: true, label: "葉が黄色くなった盆栽の図（相談の木）" }); },
    /* 相談の木：見本の写真（縦長 960×1280）を、320×240 の真ん中に縮めて置く。職人の印と位置がそろう */
    soudan: function () {
      return svgWrap('<image href="共通/見本の写真_盆栽.jpg" x="70" y="0" width="180" height="240" preserveAspectRatio="xMidYMid meet"/>',
        "針金をかけた小さな盆栽の写真（相談の木）");
    },
    miage: function () {
      return svgWrap(
        /* 下から見上げる：根元が大きく手前、枝は上に広がる */
        '<path d="M110 240c14-40 24-80 30-120s6-70 14-100h14c4 30 2 64 10 100s20 80 34 120z" fill="' + C.trunk + '"/>' +
        '<path d="M150 120c-30-8-70-4-110 14l4 8c36-14 72-18 104-12z" fill="' + C.trunk2 + '"/>' +
        '<path d="M170 92c30-10 70-8 110 6l-3 8c-36-12-72-14-104-6z" fill="' + C.trunk2 + '"/>' +
        '<path d="M160 52c-20-10-46-12-70-4l2 6c22-6 46-4 66 4z" fill="' + C.trunk2 + '"/>' +
        pad(52, 132, 52, 22, C.leaf, C.leaf2) + pad(274, 98, 50, 22, C.leaf, C.leaf2) + pad(96, 48, 46, 20, C.leaf3, C.leaf2) + pad(196, 30, 60, 24, C.leaf, C.leaf2) +
        '<path d="M60 236c30-6 60-8 100-8s70 2 100 8" stroke="' + C.pot2 + '" stroke-width="6" fill="none"/>', "下から見上げた盆栽の図");
    },
    ishitsuki: function () {
      return svgWrap(
        '<rect x="0" y="206" width="320" height="34" fill="#E5E1D9"/>' +
        '<path d="M40 206h240l-10 14H50z" fill="' + C.pot2 + '"/>' +
        /* 石を山の崖に見立てる */
        '<path d="M70 206l20-70 30-30 22-44 30 20 18 46 34 26 24 52z" fill="' + C.rock + '"/>' +
        '<path d="M142 62l30 20 18 46-20-18-10-30z" fill="' + C.rock2 + '"/>' +
        '<path d="M90 136l30-30 8 40-24 22z" fill="' + C.rock2 + '"/>' +
        '<path d="M120 172c20-4 50-4 70 2" stroke="' + C.moss + '" stroke-width="6" fill="none" stroke-linecap="round"/>' +
        /* 崖の上の木と、石を抱く根 */
        '<path d="M150 66c-2-14 4-24 10-34l5 2c-5 10-9 18-7 32z" fill="' + C.trunk + '"/>' +
        '<path d="M152 66c-6 20-14 40-28 60M156 66c4 24 10 44 24 62" stroke="' + C.trunk2 + '" stroke-width="3" fill="none"/>' +
        pad(150, 30, 34, 14, C.leaf, C.leaf2) + pad(196, 44, 22, 10, C.leaf3, C.leaf2), "石を山の崖に見立てた石付きの盆栽の図");
    },
    kengai: function () {
      return svgWrap(
        '<rect x="0" y="210" width="320" height="30" fill="#E5E1D9"/>' +
        /* 深い鉢 */
        '<path d="M60 96h80l-6 70H66z" fill="' + C.pot + '"/><rect x="56" y="92" width="88" height="8" fill="' + C.soil + '"/>' +
        '<path d="M96 94c10-20 40-26 70-10s50 40 60 74 8 50 0 62l-8-2c6-14 8-30 0-58s-28-50-54-62-50-6-60 2z" fill="' + C.trunk + '"/>' +
        pad(110, 70, 30, 14, C.leaf, C.leaf2) + pad(196, 120, 34, 15, C.leaf, C.leaf2) + pad(236, 176, 30, 14, C.leaf, C.leaf2) + pad(216, 222, 24, 11, C.leaf3, C.leaf2), "懸崖の盆栽の図（幹が鉢より下へ垂れる）");
    },
    chokkan: function () {
      return svgWrap(
        '<rect x="0" y="196" width="320" height="44" fill="#E5E1D9"/>' + pot(108, 178, 104, 22) +
        '<path d="M150 176l6-150h8l6 150z" fill="' + C.trunk + '"/>' +
        pad(110, 140, 40, 16, C.leaf, C.leaf2) + pad(210, 116, 40, 16, C.leaf, C.leaf2) + pad(130, 86, 32, 14, C.leaf, C.leaf2) + pad(190, 62, 30, 13, C.leaf, C.leaf2) + pad(160, 30, 24, 14, C.leaf3, C.leaf2), "直幹の盆栽の図");
    },
    momiji: function () {
      /* もみじ（紅葉した葉のかたまり） */
      var r = "#B4552F", r2 = "#8E3F22", o = "#C9783A";
      return svgWrap(
        '<rect x="0" y="196" width="320" height="44" fill="#E5E1D9"/>' + pot(104, 180, 112, 20) +
        '<path d="M150 178c-2-30-12-48-6-72s16-40 10-62l7-1c6 22-4 40-8 62s8 42 6 73z" fill="' + C.trunk + '"/>' +
        '<path d="M150 120c-18-10-38-12-58-4l2 5c18-6 36-4 54 4zM156 92c18-12 40-14 62-6l-2 5c-20-6-40-4-58 6z" fill="' + C.trunk + '"/>' +
        pad(86, 116, 36, 18, r, r2) + pad(220, 88, 40, 20, o, r2) + pad(150, 62, 44, 22, r, r2) + pad(186, 40, 26, 14, o, r) +
        '<circle cx="232" cy="150" r="3" fill="' + r + '"/><circle cx="70" cy="170" r="3" fill="' + o + '"/>', "紅葉したもみじの盆栽の図");
    },
    shimpaku: function () {
      /* 真柏（白い枯れ枝＝ジンと、うねる幹） */
      return svgWrap(
        '<rect x="0" y="196" width="320" height="44" fill="#E5E1D9"/>' + pot(110, 180, 100, 20) +
        '<path d="M156 178c-20-20 16-40-4-64s20-38 4-58l8-4c16 22-14 38 4 60s-22 44-4 66z" fill="' + C.trunk + '"/>' +
        '<path d="M154 150c-6-20 4-40-2-58" stroke="#E9E4D8" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<path d="M160 56l-10-30M150 40l-12-8" stroke="#E9E4D8" stroke-width="3" stroke-linecap="round"/>' +
        pad(98, 112, 34, 15, C.leaf3, C.leaf) + pad(214, 92, 38, 16, C.leaf3, C.leaf) + pad(178, 52, 30, 14, C.leaf3, C.leaf), "真柏の盆栽の図（白い枯れ枝のジン）");
    },
    yose: function () {
      var g = "";
      [[100, 60, 1], [140, 34, 1.3], [178, 50, 1.1], [214, 76, .9], [122, 84, .8]].forEach(function (p) {
        g += '<path d="M' + p[0] + " 186l3-" + (186 - p[1]) + "h" + (4 * p[2]) + "l3 " + (186 - p[1]) + 'z" fill="' + C.trunk + '"/>' + pad(p[0] + 4, p[1], 22 * p[2], 12 * p[2], C.leaf, C.leaf2);
      });
      return svgWrap('<rect x="0" y="196" width="320" height="44" fill="#E5E1D9"/><rect x="60" y="184" width="200" height="10" rx="3" fill="' + C.pot + '"/>' + g, "寄せ植えの盆栽の図");
    }
  };
  function drawZu(fig) {
    if (fig.getAttribute("data-drawn")) return;
    var kind = fig.getAttribute("data-zu");
    var fn = ZU[kind] || ZU.moyogi;
    var cap = fig.getAttribute("data-cap");
    fig.innerHTML = '<div class="zu__frame">' + fn({}) + "</div>" + (cap === "none" ? "" : "<figcaption>" + esc(cap || "写真の代わりの図") + "</figcaption>");
    fig.setAttribute("data-drawn", "1");
  }
  window.bonsaiSVG = function (kind) { return (ZU[kind] || ZU.moyogi)({}); };
  window.drawZu = function (root) { (root || document).querySelectorAll("figure.zu[data-zu]").forEach(drawZu); };

  /* ---------- はじめに動かす ---------- */
  window.BONSAI = { T: T, getLang: getLang, setLang: setLang, applyLang: applyLang, LANGS: LANGS };
  document.addEventListener("DOMContentLoaded", function () {
    buildChrome();
    window.drawZu();
    applyLang();
    watchT();
    /* 画面ごとの初めの描画が終わったあとに、もう一度そろえる */
    setTimeout(applyLang, 0);
  });
})();
