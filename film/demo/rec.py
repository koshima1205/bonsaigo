# デモ動画の画面を録る（Playwright＋CDP のスクリーンキャストで 1920x1080 のくっきりした連番を残す）
# python3 film/demo/rec.py <出力フォルダ> [場面…]
#   相談と職人の画面＝手元の試し（見本の応答・テスト用の合言葉）、メディアの画面＝本番（見るだけ）
import base64, json, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
ONLY = set(sys.argv[2:])
LOCAL = "http://127.0.0.1:8796"
PROD = "https://engawa.igdeploy.workers.dev"
CODE = "rec-local-test"  # 手元の試し専用の合言葉（本番とは別）
PHOTO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pine.jpg")

TAP_JS = r"""
(() => {
  const st = document.createElement('style');
  st.textContent = `#__tap{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(176,64,38,.28);
    border:2px solid rgba(176,64,38,.85);z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .25s,transform .25s;transform:scale(.6)}
    html{scroll-behavior:smooth}`;
  const ins = () => { if (document.getElementById('__tap')) return; document.documentElement.appendChild(st);
    const t = document.createElement('div'); t.id = '__tap'; document.documentElement.appendChild(t); };
  window.__tap = (x, y) => { ins(); const t = document.getElementById('__tap'); t.style.left = x + 'px'; t.style.top = y + 'px';
    t.style.opacity = 1; t.style.transform = 'scale(1)'; setTimeout(() => { t.style.opacity = 0; t.style.transform = 'scale(.6)'; }, 520); };
  if (document.readyState !== 'loading') ins(); else document.addEventListener('DOMContentLoaded', ins);
})();
"""


class Seg:
    """1つの場面＝1つのタブ。CDP のスクリーンキャストで、変わった瞬間の画を時刻つきで残す"""

    def __init__(self, browser, name, lang, extra=None):
        self.name = name
        self.dir = os.path.join(OUT, name)
        os.makedirs(self.dir, exist_ok=True)
        for f in os.listdir(self.dir):
            os.remove(os.path.join(self.dir, f))
        self.ctx = browser.new_context(viewport={"width": 1280, "height": 720}, device_scale_factor=1.5,
                                       locale="ja-JP", timezone_id="Asia/Tokyo")
        init = {"engawa-lang": lang, "engawa-sound": "off", **(extra or {})}
        self.ctx.add_init_script("Object.entries(" + json.dumps(init) + ").forEach(([k,v]) => { try { if (localStorage.getItem(k) === null) localStorage.setItem(k, v) } catch {} }); try { sessionStorage.setItem('engawa-entered', '1') } catch {}")
        self.ctx.add_init_script(TAP_JS)
        self.page = self.ctx.new_page()
        self.frames = []
        self.marks = []
        self.cdp = self.ctx.new_cdp_session(self.page)
        self.cdp.on("Page.screencastFrame", self._frame)
        self.t0 = None

    def start(self):
        self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 90, "maxWidth": 1920, "maxHeight": 1080, "everyNthFrame": 1})
        self.t0 = time.time()

    def _frame(self, p):
        ts = time.time() - (self.t0 or time.time())
        fn = os.path.join(self.dir, f"{len(self.frames):05d}.jpg")
        with open(fn, "wb") as f:
            f.write(base64.b64decode(p["data"]))
        self.frames.append((ts, fn))
        try:
            self.cdp.send("Page.screencastFrameAck", {"sessionId": p["sessionId"]})
        except Exception:
            pass

    def mark(self, label):
        self.marks.append((round(time.time() - self.t0, 2), label))

    def wait(self, s):
        self.page.wait_for_timeout(int(s * 1000))

    def go(self, url, settle=1.6):
        self.page.goto(url, wait_until="networkidle")
        self.wait(settle)

    def tap(self, sel, after=1.0):
        loc = self.page.locator(sel).first if isinstance(sel, str) else sel
        loc.scroll_into_view_if_needed()
        self.wait(0.35)
        b = loc.bounding_box()
        if b:
            self.page.evaluate("([x,y]) => window.__tap && window.__tap(x,y)", [b["x"] + b["width"] / 2, b["y"] + b["height"] / 2])
            self.wait(0.4)
        loc.click()
        self.wait(after)

    def type(self, sel, text, delay=45):
        loc = self.page.locator(sel).first
        loc.scroll_into_view_if_needed()
        loc.click()
        loc.press_sequentially(text, delay=delay)
        self.wait(0.5)

    def scroll(self, dy, steps=1, pause=1.0):
        for _ in range(steps):
            self.page.mouse.wheel(0, dy)
            self.wait(pause)

    def to(self, sel, pause=1.4, block="center"):
        self.page.locator(sel).first.evaluate(f"e => e.scrollIntoView({{behavior:'smooth', block:'{block}'}})")
        self.wait(pause)

    def close(self):
        self.wait(0.6)
        try:
            self.cdp.send("Page.stopScreencast")
        except Exception:
            pass
        end = time.time() - self.t0
        self.ctx.close()
        json.dump({"frames": [[round(t, 3), os.path.basename(f)] for t, f in self.frames], "end": round(end, 2), "marks": self.marks},
                  open(os.path.join(self.dir, "index.json"), "w"), ensure_ascii=False, indent=1)
        print(self.name, len(self.frames), "frames", round(end, 1), "s", self.marks, flush=True)


# ---------------- 場面 ----------------
STATE = {}


def consult(b):
    # 海外の持ち主が、写真と英語で相談する → AI が気候をふまえて聞き返す → 職人へ
    s = Seg(b, "consult", "en")
    s.page.goto(LOCAL + "/#/ask", wait_until="networkidle")
    s.start()
    s.wait(1.2)
    s.mark("ask")
    s.page.locator("#file").set_input_files(PHOTO)
    s.wait(1.0)
    s.type("#q", "Some needles are turning brown at the tips. It's getting cold here - should I bring my pine inside for winter?", delay=28)
    s.type("#city", "Lyon, France", delay=60)
    s.tap("#go", after=2.5)
    s.page.wait_for_selector(".chip")
    STATE["cid"] = s.page.url.split("/c/")[-1]
    s.wait(1.0)
    s.mark("intake")
    s.to(".climate", 1.8)
    for row in s.page.locator(".chip-row").all()[:3]:
        s.tap(row.locator(".chip").first, after=0.7)
    s.mark("send")
    s.tap("#send", after=3.0)
    s.close()


def master(b):
    # 京都の職人が、日本語で読み、話して答える → 用語集で「意味」に訳し、日本語に戻して確かめる
    s = Seg(b, "master", "ja", {"engawa-size": "l"})
    s.page.goto(LOCAL + "/#/master", wait_until="networkidle")
    s.page.locator("#code").fill(CODE)
    s.page.locator("#ok").click()
    s.page.wait_for_selector("#nm")
    s.page.locator("#nm").fill("職人A")
    s.page.locator("#ok").click()
    s.page.wait_for_selector(".tiles")
    s.start()
    s.wait(1.6)
    s.mark("home")
    s.tap(".tile.main", after=1.6)
    s.mark("inbox")
    s.tap(f'a[href="#/master/c/{STATE["cid"]}"]', after=1.8)
    s.mark("brief")
    s.to(".points", 2.0, "start")
    s.to("#mic", 1.0)
    s.mark("speak")
    s.type("#said", "葉先が茶色いのは、古い葉が落ちる前の自然なことです。心配いりません。冬は外の寒さに当ててください。ただ、氷点下が続く夜だけ、軒下になおしてください。", delay=55)
    s.wait(0.6)
    s.mark("check")
    s.tap("#check", after=0.5)
    s.page.wait_for_selector(".glossbox", timeout=60000)
    s.wait(1.2)
    s.mark("gloss")
    s.to(".glossbox", 3.2, "start")
    s.mark("back")
    s.to(".back", 3.4, "start")
    s.mark("sendbtn")
    s.tap("#send", after=2.2)
    s.mark("sent")
    s.wait(1.2)
    s.close()


def letter(b):
    # 持ち主に、英語の手紙として届く。「なおす」は repair ではなく move
    s = Seg(b, "letter", "en")
    s.page.goto(LOCAL + f"/#/c/{STATE['cid']}", wait_until="networkidle")
    s.start()
    s.wait(2.0)
    s.mark("letter")
    s.to(".card", 3.0, "start")
    s.mark("terms")
    s.to(".explain", 3.6, "center")
    s.mark("log")
    s.to(".log", 2.4, "center")
    s.close()


def article(b):
    # 相談が記事になる（5つの言葉）→ 職人が OK → ショートの下書き → OK だけ（投稿はしない）→ 来た人の数
    s = Seg(b, "article", "ja", {"engawa-code": CODE, "engawa-master": "職人A", "engawa-size": "l"})
    s.page.goto(LOCAL + f"/#/master/c/{STATE['cid']}", wait_until="networkidle")
    s.start()
    s.wait(1.4)
    s.mark("done")
    s.tap("#toArticle", after=0.5)
    s.page.wait_for_selector(".m-article", timeout=60000)
    s.wait(1.6)
    s.mark("article_ja")
    s.to(".m-quote", 2.2)
    for lab in ("英語", "スペイン語", "中国語", "やさしい日本語"):
        s.page.evaluate("() => scrollTo({top:0, behavior:'smooth'})")
        s.wait(0.4)
        s.tap(f'#lt button:has-text("{lab}")', after=1.3)
    s.mark("publish")
    s.tap("#pub", after=1.6)
    s.mark("mkshort")
    s.tap("#mk", after=0.5)
    s.page.wait_for_selector("#sv", timeout=60000)
    s.wait(1.2)
    s.mark("short")
    s.tap("#pp", after=6.0)
    s.mark("captions")
    s.to("#tabs", 1.6)
    s.tap('#tabs button[data-p="yt"]', after=1.0)
    s.tap('#tabs button[data-p="tt"]', after=1.0)
    s.mark("approve")
    s.tap("#approve", after=1.8)
    s.mark("studio")
    s.go(LOCAL + "/#/studio", 1.6)
    s.scroll(320, 2, 1.1)
    s.close()


def media(b):
    # 本番のメディア（見るだけ）：記事24本×5言語・3Dの木・水彩・動画・掲示板・AI窓口・欲しい木
    s = Seg(b, "media", "ja")
    s.page.goto(PROD + "/#/", wait_until="networkidle")
    s.start()
    s.wait(2.2)
    s.mark("home")
    s.scroll(600, 2, 1.0)
    s.mark("learn")
    s.go(PROD + "/#/learn", 1.8)
    s.scroll(700, 2, 0.9)
    s.mark("article")
    s.go(PROD + "/#/learn/black-pine", 2.4)
    s.scroll(650, 3, 1.1)
    s.mark("lang")
    s.page.evaluate("() => { localStorage.setItem('engawa-lang', 'fr'); }")
    s.go(PROD + "/#/learn/black-pine", 1.8)
    s.page.evaluate("() => { localStorage.setItem('engawa-lang', 'ja'); }")
    s.mark("films")
    s.go(PROD + "/#/shorts", 3.0)
    s.scroll(600, 1, 1.4)
    s.mark("board")
    s.go(PROD + "/#/board", 1.8)
    s.mark("help")
    s.go(PROD + "/#/help", 1.6)
    s.mark("wish")
    s.go(PROD + "/#/wish", 1.8)
    s.mark("glossary")
    s.go(PROD + "/#/glossary", 1.8)
    s.scroll(500, 1, 1.0)
    s.close()


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for fn in (consult, master, letter, article, media):
        if ONLY and fn.__name__ not in ONLY:
            continue
        fn(browser)
    browser.close()
json.dump(STATE, open(os.path.join(OUT, "state.json"), "w"))
