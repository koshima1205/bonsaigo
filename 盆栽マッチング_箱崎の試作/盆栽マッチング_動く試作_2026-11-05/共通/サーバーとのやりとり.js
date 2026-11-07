/* 盆栽マッチング サーバーとのやりとり 2026-11-05
   - サーバーに聞く（API.get / API.post）
   - 写真を小さくする、動画からコマを取る、見本の写真を作る
   - 声を文字にする（ブラウザの音声認識）
   - AIのつなぎ方を画面に出す（見本の答えのときは、はっきりそう出す） */
(function () {
  "use strict";

  var online = location.protocol === "http:" || location.protocol === "https:";

  function request(method, url, body) {
    return fetch(url, {
      method: method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || "うまくいきませんでした。もう一度お試しください");
        return data;
      });
    }, function () { throw new Error("サーバーにつながりませんでした"); });
  }

  var statusPromise = null;
  function status() {
    /* offers は、まだ読む画面があるので空の一覧だけ残す（金額は出さない） */
    if (!online) return Promise.resolve({ mode: "offline", offers: [] });
    if (!statusPromise) statusPromise = request("GET", "/api/status").catch(function () { return { mode: "offline", offers: [] }; });
    return statusPromise;
  }

  /* ---------- ログインしている人 ----------
     GET /api/me → { user: null | { id, role, name, lang, teacher_id }, teachers: [...] }
     画面を開いたすぐ後に役割で下のタブを出せるよう、最後に見た人をこのタブの間だけ覚えておく */
  var ME_KEY = "bonsai-me";
  function cachedMe() {
    try { var u = JSON.parse(sessionStorage.getItem(ME_KEY) || "null"); return u && u.role ? u : null; } catch (e) { return null; }
  }
  function rememberMe(user) {
    try { if (user) sessionStorage.setItem(ME_KEY, JSON.stringify(user)); else sessionStorage.removeItem(ME_KEY); } catch (e) {}
  }
  var mePromise = null;
  function me(fresh) {
    if (!online) return Promise.resolve({ user: null, teachers: [] });
    if (!mePromise || fresh) {
      mePromise = request("GET", "/api/me").then(function (r) {
        rememberMe(r.user || null);
        return { user: r.user || null, teachers: r.teachers || [] };
      }, function () { return { user: cachedMe(), teachers: [], failed: true }; });
    }
    return mePromise;
  }
  function login(body) {
    return request("POST", "/api/login", body).then(function (r) {
      rememberMe(r.user || null);
      mePromise = null;
      return r;
    });
  }
  function logout() {
    rememberMe(null);
    mePromise = null;
    return request("POST", "/api/logout", {}).catch(function () { return { ok: false }; });
  }

  function loadImage(src) {
    return new Promise(function (ok, ng) {
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { ng(new Error("画像を読めませんでした")); };
      im.src = src;
    });
  }
  function canvasToImage(canvas) {
    var url = canvas.toDataURL("image/jpeg", 0.85);
    return { media_type: "image/jpeg", data: url.split(",")[1], url: url };
  }
  function drawScaled(src, w, h, max) {
    var s = Math.min(1, max / Math.max(w, h));
    var c = document.createElement("canvas");
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  /* 写真を、送りやすい大きさのJPEGにする */
  function photoFromFile(file) {
    var url = URL.createObjectURL(file);
    return loadImage(url).then(function (im) {
      var out = canvasToImage(drawScaled(im, im.naturalWidth, im.naturalHeight, 1280));
      URL.revokeObjectURL(url);
      return out;
    }, function () {
      URL.revokeObjectURL(url);
      throw new Error("この写真は読めませんでした。別の写真でお試しください");
    });
  }

  /* 動画から、等間隔にコマを取る（AIは動画を直接は読めないので、コマで渡す） */
  function framesFromVideo(file, count) {
    count = count || 4;
    return new Promise(function (ok, ng) {
      var url = URL.createObjectURL(file);
      var v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      var fail = function () { URL.revokeObjectURL(url); ng(new Error("この動画は読めませんでした。短い動画か写真でお試しください")); };
      v.onerror = fail;
      var begin = function () {
        var frames = [], i = 0;
        var seek = function () { v.currentTime = v.duration * (i + 0.5) / count; };
        v.onseeked = function () {
          frames.push(canvasToImage(drawScaled(v, v.videoWidth, v.videoHeight, 960)));
          i += 1;
          if (i < count) seek(); else { URL.revokeObjectURL(url); ok(frames); }
        };
        seek();
      };
      v.onloadedmetadata = function () {
        if (!v.videoWidth) { fail(); return; }
        if (isFinite(v.duration)) { begin(); return; }
        v.onseeked = function () {
          v.onseeked = null;
          if (!isFinite(v.duration)) { fail(); return; }
          begin();
        };
        v.currentTime = 1e7;
      };
    });
  }

  /* アプリの盆栽の図を写真の代わりにする（カメラがなくても試せるように） */
  function sampleImage(kind) {
    var svg = window.bonsaiSVG(kind).replace("<svg ", '<svg width="960" height="720" ');
    return loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)).then(function (im) {
      var c = document.createElement("canvas"); c.width = 960; c.height = 720;
      c.getContext("2d").drawImage(im, 0, 0);
      return canvasToImage(c);
    });
  }

  /* 本物の盆栽の見本の写真。サーバーなしで読めないときは図を使う */
  function samplePhoto() {
    return fetch("共通/見本の写真_盆栽.jpg").then(function (r) {
      if (!r.ok) throw new Error("no photo");
      return r.blob();
    }).then(photoFromFile).catch(function () { return sampleImage("kengai"); });
  }

  /* 声を文字にする。使えないブラウザでは null を返す */
  function makeRecognizer(handlers) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var r = new SR();
    r.lang = "ja-JP"; r.continuous = true; r.interimResults = true;
    var base = "";
    r.onresult = function (e) {
      var done = "", now = "";
      for (var i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) done += e.results[i][0].transcript; else now += e.results[i][0].transcript;
      }
      handlers.onText(base + done + now);
    };
    r.onend = function () { handlers.onEnd(); };
    r.onerror = function (e) { handlers.onError(e.error); };
    return { start: function (startText) { base = startText || ""; r.start(); }, stop: function () { r.stop(); } };
  }

  /* [[見せる言葉|用語]] を、触ると用語の説明が開く形にする */
  function markTerms(s) {
    return window.esc(s).replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, function (m, shown, word) {
      return '<b class="term" data-term="' + word + '" tabindex="0" role="button">' + shown + "</b>";
    });
  }
  function dropTermMarks(s) { return String(s).replace(/\[\[([^\]|]+)\|[^\]]+\]\]/g, "$1"); }

  /* 写真と書き込みを4:3の枠に出す */
  function photoHtml(image, alt) {
    return '<img class="real-photo" alt="' + window.esc(alt || "") + '" src="data:' + image.media_type + ";base64," + image.data + '">';
  }

  /* AIのつなぎ方を、画面の一番上に出す */
  function showMode() {
    status().then(function (st) {
      var page = document.querySelector(".page");
      var no = document.body.getAttribute("data-screen");
      if (!page || !no || document.querySelector(".mode-note")) return;
      if (st.mode !== "sample" && st.mode !== "offline") return;
      var n = document.createElement("p");
      n.className = "mode-note demo-only";
      n.innerHTML = st.mode === "sample"
        ? window.tSpan({ ja: "いまはAIにつないでいません。入れた内容に関係なく、記録しておいた見本の答えを出します。", en: "AI is not connected. You will see a recorded sample answer, whatever you enter.", es: "La IA no está conectada. Verás una respuesta de muestra grabada.", zh: "AI 未连接。无论输入什么，都会显示录制的示例回答。" })
        : window.tSpan({ ja: "サーバーなしで開いています。見た目と流れだけの確認です。", en: "Opened without the server, so this only shows the look and flow.", es: "Abierto sin servidor: solo muestra el aspecto y el flujo.", zh: "未连接服务器，仅展示界面和流程。" });
      var foot = page.querySelector(".mock-foot");
      page.insertBefore(n, foot || null);
      if (window.BONSAI) window.BONSAI.applyLang();
    });
  }
  document.addEventListener("DOMContentLoaded", showMode);

  /* 体験の流れの、いまの場所を出す。立場が変わる画面では、そのことも言う */
  var FLOW = [
    { no: "17", who: "s" }, { no: "19", who: "s" }, { no: "18", who: "a" }, { no: "03", who: "a" },
    { no: "04", who: "s" }, { no: "05", who: "a" }
  ];
  function showFlow() {
    var no = document.body.getAttribute("data-screen");
    var page = document.querySelector(".page");
    var i = FLOW.findIndex(function (f) { return f.no === no; });
    /* 発表の流れで見ているとき（?demo=1 から入ったとき）だけ出す */
    var demo = window.isDemo ? window.isDemo() : false;
    document.body.classList.toggle("is-demo", demo);
    if (i < 0 || !page || !demo || new URLSearchParams(location.search).get("embed") === "1") return;
    var isS = FLOW[i].who === "s";
    var changed = i > 0 && FLOW[i - 1].who !== FLOW[i].who;
    var n = document.createElement("p");
    n.className = "flowbar" + (isS ? " flowbar--s" : "");
    var step = (i + 1) + " / " + FLOW.length + " ・ ";
    n.innerHTML = window.tSpan(isS
      ? { ja: step + (changed ? "ここからは職人の画面です" : "職人の画面") }
      : { ja: step + (changed ? "ここからは海外の人の画面です" : "海外の人の画面"), en: step + "The learner's screen", es: step + "Pantalla del aprendiz", zh: step + "海外学习者的画面" });
    page.insertBefore(n, page.firstChild);
    if (window.BONSAI) window.BONSAI.applyLang();
  }
  document.addEventListener("DOMContentLoaded", showFlow);

  window.API = {
    online: online,
    get: function (u) { return request("GET", u); },
    post: function (u, b) { return request("POST", u, b || {}); },
    status: status,
    me: me,
    cachedMe: cachedMe,
    login: login,
    logout: logout,
    photoFromFile: photoFromFile,
    framesFromVideo: framesFromVideo,
    sampleImage: sampleImage,
    samplePhoto: samplePhoto,
    makeRecognizer: makeRecognizer,
    markTerms: markTerms,
    dropTermMarks: dropTermMarks,
    photoHtml: photoHtml
  };
})();
