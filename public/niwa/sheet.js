// 庭の中で使う「茶屋の掲示板」と「市の縁側（欲しい木）」。下から出る画面。
// Engawa の API（/api/board・/api/wishes）をそのまま使う。本番に届かない場所（試しの写し）では見本だけ見せる。
import { SAMPLE_THREADS, SAMPLE_WISHES } from './samples.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LANG = /^ja/i.test(navigator.language || 'ja') ? 'ja' : 'en';
const L = (ja, en) => (LANG === 'ja' ? ja : en);
// 書いた言葉の印は、ブラウザの言葉をそのまま送る（es・zh・fr…）。画面の言葉（LANG）は日本語と英語の2つだけ
const POST_LANG = (navigator.language || 'en').slice(0, 2).toLowerCase();
function when(ts) {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return L(`${m}分前`, `${m} min ago`);
  const h = Math.round(m / 60); if (h < 24) return L(`${h}時間前`, `${h} h ago`);
  const d = Math.round(h / 24); return L(`${d}日前`, `${d} days ago`);
}
// 送れなかったときの一言（empty＝空で送ったときの言い方）
const ERR = (e, empty) => (e.status === 429 ? L('書きこみが続いたので、少し時間をおいてからもう一度どうぞ。', 'Too many posts in a row. Please wait a little and try again.')
  : e.status === 400 ? empty
    : e.status === 409 ? L('この話題には返信できません。', 'This topic cannot be replied to.')
      : L('うまく送れませんでした。通信を確かめて、もう一度お試しください。', 'Could not send. Check your connection and try again.'));
const EMPTY_TOPIC = L('題名と本文を書いてから送ってください。', 'Please write a title and a message before sending.');
const EMPTY_TEXT = L('ひとこと書いてから送ってください。', 'Please write something before sending.');
// 書く前に知っておいてほしいこと（公開・AI・個人の情報・試作）
const NOTE_BOARD = L('書いた内容は、だれでも読めます。訳すときは AI に送ります。住所・電話・メールなど、あなたが分かることは書かないでください。試作のため、書きこみは予告なく消すことがあります。',
  'Anyone can read what you post, and it is sent to AI when someone translates it. Do not include your address, phone or email. This is a prototype; posts may be removed without notice.');
const NOTE_WISH = L('書いた内容は、市の台と一覧にだれでも見える形で出て、AI が整理します。あなたが分かることは書かないでください。これは購入の申し込みではありません。売り買い・発送・検疫・お支払いはここでは扱わず、つなぐだけです（手を挙げた職人との連絡のしかたは準備中）。試作のため、予告なく消すことがあります。',
  'Your wish is shown publicly on the market table and in the list, and AI sorts it. Do not include anything that identifies you. This is not a purchase order: we only connect, and no sales, shipping, quarantine or payment happen here (how masters contact you is still being prepared). This is a prototype; wishes may be removed without notice.');

export function makeSheet({ app, onThreads, onWishes, onOpen, onClose, onSeeTag }) {
  const live = !app; // 本番（同じ場所に API がある）なら書きこめる
  const el = document.querySelector('#sheet'), panel = el.querySelector('.sh-panel'), body = el.querySelector('.sh-body');
  let threads = null, wishes = null, view = null;
  let gen = 0; // 画面を切り替えるたびに増やす。遅れて返った通信が、いまの画面を書きかえないように
  let threadsFailed = false, wishesFailed = false; // 本番で読めずに見本を出しているとき
  const fresh = (name) => { view = name; panel.scrollTop = 0; return ++gen; };
  // 書きかけは、閉じても画面を移っても残す（送れたら消す。名前と国は次も使えるように残す）
  const drafts = {};
  const keep = () => body.querySelectorAll('input[id],textarea[id]').forEach((x) => {
    if (drafts[x.id]) x.value = drafts[x.id];
    x.addEventListener('input', () => { drafts[x.id] = x.value; });
  });
  const forget = (...ids) => ids.forEach((k) => delete drafts[k]);

  async function call(path, data) {
    const res = await fetch(path, { method: data ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error || 'error'), { status: res.status });
    return out;
  }
  // 見本は本番の一覧と同じく、新しい話題から並べる
  const sampleList = () => [...SAMPLE_THREADS].sort((a, b) => b.created - a.created).map((t) => ({ ...t, posts: t.posts.slice(0, 1), count: t.posts.length }));
  async function loadThreads() {
    threadsFailed = false;
    threads = live ? await call('/api/board').catch(() => { threadsFailed = true; return sampleList(); }) : sampleList();
    onThreads?.(threads); return threads;
  }
  async function loadWishes() {
    wishesFailed = false;
    wishes = live ? await call('/api/wishes').catch(() => { wishesFailed = true; return SAMPLE_WISHES; }) : SAMPLE_WISHES;
    onWishes?.(wishes); return wishes;
  }
  const sampleTag = (x) => (x.seed ? `<span class="tag">${L('見本', 'Sample')}</span>` : '');
  // 本番の庭で同じ画面を開く（歩ける庭は本番の /niwa/ にある）
  const offline = () => (live ? '' : `<p class="note">${L('この試しのページでは見本だけ見られます。書きこみは本番の庭でどうぞ。', 'This preview shows samples only. Post in the live garden.')}
    <a href="${esc(app)}/niwa/?sheet=${view === 'market' ? 'market' : 'board'}" target="_blank" rel="noopener">${L('本番の庭で開く', 'Open the live garden')} →</a></p>`);
  const failed = () => `<li class="note">${L('いまは読みこめなかったので、見本を出しています。', 'Could not load the latest posts, so samples are shown for now.')}
    <button type="button" class="link retry">${L('もう一度読みこむ', 'Try again')}</button></li>`;
  const pick = (p) => (p.lang !== LANG && p.tr?.[LANG] ? p.tr[LANG] : p.body);

  // ----- 掲示板（一覧） -----
  async function board(openNew) {
    const my = fresh('board');
    body.innerHTML = `<p class="kicker">${L('茶屋の掲示板', 'Tea-house board')}<span>${L('Tea-house board', '茶屋の掲示板')}</span></p>
      <h2 id="sheet-h">${L('持ち主どうしで話す', 'Talk with other growers')}</h2>
      <p class="lead">${L('どの言葉で書いても大丈夫です。読むときは、あなたの言葉に訳せます。', 'Write in any language. Readers can translate it into theirs.')}</p>
      ${live ? `<details class="new"><summary class="btn">${L('話題を立てる', 'Start a topic')}</summary>
        <form class="form" id="f-thread">
          <label>${L('題名', 'Title')}<input id="nt-title" maxlength="120" required></label>
          <label>${L('本文（どの言葉でも）', 'Message (any language)')}<textarea id="nt-body" rows="4" maxlength="2000" required></textarea></label>
          <label>${L('お名前・町（なくても可・ニックネームで）', 'Name · city (optional, a nickname is fine)')}<input id="nt-name" maxlength="40"></label>
          <p class="fine">${NOTE_BOARD}</p>
          <p class="err" role="alert"></p><button class="btn solid" type="submit">${L('書きこむ', 'Post')}</button>
        </form></details>` : offline()}
      <ul class="list"><li class="dim">${L('読みこんでいます…', 'Loading…')}</li></ul>`;
    keep();
    const nd = body.querySelector('details.new');
    if (nd && (openNew || drafts['nt-title'] || drafts['nt-body'])) { nd.open = true; if (openNew) body.querySelector('#nt-title').focus({ preventScroll: true }); }
    const f = body.querySelector('#f-thread');
    f?.addEventListener('submit', async (e) => {
      e.preventDefault(); const b = f.querySelector('button'); b.disabled = true;
      try {
        const t = await call('/api/board', { title: f.querySelector('#nt-title').value, body: f.querySelector('#nt-body').value, name: f.querySelector('#nt-name').value, lang: POST_LANG });
        forget('nt-title', 'nt-body'); await loadThreads();
        if (my === gen) thread(t.id); // ほかの画面へ移っていたら、そのままにする
      } catch (er) { if (my === gen) { f.querySelector('.err').textContent = ERR(er, EMPTY_TOPIC); b.disabled = false; } }
    });
    const list = await loadThreads(); // 開くたびに新しくする（3Dの札も同じものになる）
    if (my !== gen) return;
    body.querySelector('.list').innerHTML = (threadsFailed ? failed() : '') + (list.map((t) => `<li><button type="button" class="row" data-id="${esc(t.id)}">
      <span class="lang">${esc(t.posts[0]?.lang ?? '')}</span>
      <span class="txt"><b lang="${esc(t.posts[0]?.lang ?? '')}">${esc(t.title)}</b><span class="snip">${esc(pick(t.posts[0] ?? {}).slice(0, 90))}</span>
      <small>${esc(t.posts[0]?.name ?? '')} · ${when(t.created)} · ${t.count ?? t.posts.length}${L('件', ' posts')}</small></span>${sampleTag(t)}</button></li>`).join('')
      || `<li class="dim">${L('まだ話題がありません。最初の話題をどうぞ。', 'No topics yet. Start the first one.')}</li>`);
    body.querySelectorAll('.row').forEach((r) => r.addEventListener('click', () => thread(r.dataset.id)));
    body.querySelector('.retry')?.addEventListener('click', () => board());
  }

  // ----- 掲示板（ひとつの話題） -----
  async function thread(id) {
    const my = fresh('thread');
    body.innerHTML = `<button type="button" class="back">← ${L('話題の一覧', 'All topics')}</button><p class="dim">${L('読みこんでいます…', 'Loading…')}</p>`;
    body.querySelector('.back').addEventListener('click', () => board());
    let t = live ? await call(`/api/board/${encodeURIComponent(id)}`).catch(() => null) : null;
    t ??= SAMPLE_THREADS.find((x) => x.id === id);
    if (my !== gen) return; // 読みこむあいだに別の話題や画面へ移った
    if (!t) {
      body.innerHTML = `<button type="button" class="back">← ${L('話題の一覧', 'All topics')}</button>
        <p class="note">${L('この話題を読みこめませんでした。少しおいて、もう一度お試しください。', 'Could not load this topic. Please try again in a moment.')}</p>`;
      body.querySelector('.back').addEventListener('click', () => board());
      return;
    }
    body.innerHTML = `<button type="button" class="back">← ${L('話題の一覧', 'All topics')}</button>
      <h2 id="sheet-h" lang="${esc(t.posts[0]?.lang ?? '')}">${esc(t.title)} ${sampleTag(t)}</h2>
      <div class="posts">${t.posts.map((p, i) => {
        const tr = p.lang !== LANG && p.tr?.[LANG];
        return `<div class="post${p.master ? ' master' : ''}">
          <div class="who">${p.master ? `<span class="seal">${L('職', 'M')}</span>` : ''}<b>${esc(p.name)}</b><small>${when(p.created)} · ${esc(p.lang)}</small></div>
          ${tr ? `<p>${esc(tr)}</p><details><summary>${L('原文', 'Original')}</summary><p lang="${esc(p.lang)}">${esc(p.body)}</p></details>`
            : `<p lang="${esc(p.lang)}">${esc(p.body)}</p>${p.lang !== LANG && live ? `<button type="button" class="link tr" data-i="${i}">${L('訳して読む', 'Translate')}</button><p class="trout" id="tr${i}" hidden></p>` : ''}`}
        </div>`;
      }).join('')}</div>
      ${t.seed ? `<p class="note">${L('これは見本の話題なので、返信はできません。話してみたいことがあれば、新しい話題を立ててください。', 'This is a sample topic, so replies are off. To talk about it, start a new topic.')}${live ? `<button type="button" class="link newtopic">${L('話題を立てる', 'Start a topic')} →</button>` : ''}</p>`
        : live ? `<form class="form" id="f-reply">
          <label>${L('返信（どの言葉でも）', 'Reply (any language)')}<textarea id="rp-body" rows="3" maxlength="2000" required></textarea></label>
          <label>${L('お名前・町（なくても可・ニックネームで）', 'Name · city (optional, a nickname is fine)')}<input id="rp-name" maxlength="40"></label>
          <p class="fine">${NOTE_BOARD}</p>
          <p class="err" role="alert"></p><button class="btn solid" type="submit">${L('返信する', 'Reply')}</button></form>` : offline()}`;
    body.querySelector('.back').addEventListener('click', () => board());
    body.querySelector('.newtopic')?.addEventListener('click', () => board(true));
    keep();
    body.querySelectorAll('.tr').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true; const out = body.querySelector(`#tr${b.dataset.i}`);
      try {
        const r = await call(`/api/board/${encodeURIComponent(id)}/translate`, { i: Number(b.dataset.i), lang: LANG });
        if (my !== gen) return;
        out.textContent = r.text ?? L('訳は、本番の設定が入ると出ます。', 'Translation appears once the live key is set.');
        b.hidden = true; // 訳が出たらボタンはしまう
      } catch (er) {
        if (my !== gen) return;
        out.textContent = ERR(er, EMPTY_TEXT); b.disabled = false; // 失敗したら、もう一度押せる
      }
      out.hidden = false;
    }));
    const f = body.querySelector('#f-reply');
    f?.addEventListener('submit', async (e) => {
      e.preventDefault(); const b = f.querySelector('button'); b.disabled = true;
      try {
        await call(`/api/board/${encodeURIComponent(id)}/posts`, { body: f.querySelector('#rp-body').value, name: f.querySelector('#rp-name').value, lang: POST_LANG });
        forget('rp-body'); await loadThreads();
        if (my === gen) thread(id);
      } catch (er) { if (my === gen) { f.querySelector('.err').textContent = ERR(er, EMPTY_TEXT); b.disabled = false; } }
    });
  }

  // ----- 市の縁側（欲しい木） -----
  async function market(flash) {
    const my = fresh('market');
    body.innerHTML = `<p class="kicker">${L('市の縁側', 'The market engawa')}<span>${L('The market engawa', '市の縁側')}</span></p>
      <h2 id="sheet-h">${L('欲しい木を伝える', 'Tell us the tree you want')}</h2>
      <p class="lead">${L('欲しい木を書くと、AI が職人向けに「樹種・大きさ・樹形・予算」に分けて、市の台に札を下げます。持っている職人が手を挙げます。', 'Describe the tree you want. AI sorts it into species, size, style and budget for the masters and hangs a tag on the market table. Masters who have one raise a hand.')}</p>
      ${flash ? `<p class="ok" role="status">${esc(flash)}<button type="button" class="link see">${L('台の札を見に行く', 'See your tag on the table')} →</button></p>` : ''}
      ${live ? `<form class="form" id="f-wish">
        <label>${L('欲しい木', 'The tree you want')}<textarea id="w-text" rows="3" maxlength="600" required placeholder="${L('例：根張りのよい小さな黒松、20cmくらい、300ユーロまで', 'e.g. A shohin black pine with good nebari, about 20 cm, up to 300 EUR')}"></textarea></label>
        <label>${L('国・町（なくても可）', 'Country · city (optional)')}<input id="w-country" maxlength="60"></label>
        <p class="fine">${NOTE_WISH}</p>
        <p class="err" role="alert"></p><button class="btn solid" type="submit">${L('札を下げる', 'Hang my tag')}</button></form>` : offline()}
      <p class="fine list-note">${L('市の台に下がるのは、新しい4枚までです。', 'The table shows the newest four tags.')}</p>
      <ul class="wishes"><li class="dim">${L('読みこんでいます…', 'Loading…')}</li></ul>`;
    keep();
    const f = body.querySelector('#f-wish');
    f?.addEventListener('submit', async (e) => {
      e.preventDefault(); const b = f.querySelector('button'); b.disabled = true; b.textContent = L('AI が整理しています…（10秒ほど）', 'AI is sorting it… (about 10 seconds)');
      try {
        const w = await call('/api/wishes', { text: f.querySelector('#w-text').value, country: f.querySelector('#w-country').value });
        forget('w-text'); await loadWishes();
        if (my === gen) market(L(`札を下げました：${w.parsed?.species || w.parsed?.summary_ja || '欲しい木'}。`, `Tag hung: ${w.parsed?.summary_en || 'your wish'}.`));
      } catch (er) { if (my === gen) { f.querySelector('.err').textContent = ERR(er, EMPTY_TEXT); b.disabled = false; b.textContent = L('札を下げる', 'Hang my tag'); } }
    });
    const list = flash ? wishes : await loadWishes(); // 送った直後は読みこみ済み
    if (my !== gen) return;
    const K = [['species', L('樹種', 'Species')], ['size', L('大きさ', 'Size')], ['style', L('樹形', 'Style')], ['budget', L('予算', 'Budget')]];
    body.querySelector('.wishes').innerHTML = (wishesFailed ? failed() : '') + list.map((w) => `<li class="wish">
      <div class="wh"><span class="lang">${esc(w.country || '—')}</span><small>${when(w.created)}</small>${sampleTag(w)}</div>
      <p class="wt">${esc(w.text)}</p>${LANG === 'en' && w.parsed?.summary_en ? `<p class="sum">${esc(w.parsed.summary_en)}</p>` : ''}
      <dl>${K.filter(([k]) => w.parsed?.[k]).map(([k, n]) => `<div><dt>${n}</dt><dd lang="ja">${esc(w.parsed[k])}</dd></div>`).join('')}</dl>
      <p class="raised${w.raised?.length ? ' yes' : ''}">${L(`手を挙げた職人 ${w.raised?.length ?? 0}人`, `${w.raised?.length ?? 0} master(s) raised a hand`)}</p></li>`).join('');
    body.querySelector('.retry')?.addEventListener('click', () => market());
    body.querySelector('.see')?.addEventListener('click', () => { close(); onSeeTag?.(); });
  }

  // 開いている間は、後ろの庭と案内をキーボードでも触れないようにする（Tab が後ろへ抜けない）
  const behind = () => document.querySelectorAll('#stage,#hud,#labels,#card,#stick');
  function open(kind, id) {
    el.hidden = false; behind().forEach((x) => { x.inert = true; }); onOpen?.();
    if (kind === 'market') market(); else if (kind === 'thread' && id) thread(id); else board();
    panel.focus({ preventScroll: true }); // 読み上げなどが、開いた画面から始められるように（ボタンに枠を出さない）
  }
  function close() { el.hidden = true; view = null; gen++; behind().forEach((x) => { x.inert = false; }); onClose?.(); }
  el.querySelector('.sh-x').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); }); // 上の庭のところを押しても閉じる
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden && !e.target.closest?.('input,textarea')) close(); }); // 書いている途中の Esc では閉じない
  return { open, close, isOpen: () => !el.hidden, loadThreads, loadWishes };
}
