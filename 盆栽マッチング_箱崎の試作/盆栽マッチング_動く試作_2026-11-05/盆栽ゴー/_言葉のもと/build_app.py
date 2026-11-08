"""盆栽ゴー（アプリ版）の言葉と見本をつくる。
- 見本版（../../i18n.js）の訳＋アプリで足した訳（base_app.json と6つの *.json）→ アプリの 盆栽ゴー/i18n.js
- 8つの言葉の見本の答え・確かめ・投稿・Q&A・言いかえ表 → 盆栽ゴー_見本の答え.json
訳を直したら、これを流す。"""
import json, os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(here, "..", ".."))  # このフォルダ＝盆栽ゴー/_言葉のもと/
L8 = ["en", "es", "zh", "fr", "it", "th", "km", "ja"]

src = open(os.path.join(here, "i18n_proto.js")).read()  # 1枚版の見本（盆栽ゴー_1108）の訳
I = json.loads(src[src.index("=") + 1:].strip().rstrip(";"))
base = json.load(open(os.path.join(here, "base_app.json")))
add = {"en": base["en"], "ja": {**json.load(open(os.path.join(here, "ja_g.json"))), **base["ja"]}}  # ja_g.json＝育てる人の画面の日本語（11/08）
for c in ["es", "zh", "fr", "it", "th", "km"]:
    add[c] = json.load(open(os.path.join(here, c + ".json")))
bad = 0
for c in L8:
    for k, v in add[c].items():
        en = base["en"].get(k, "")
        for m in ["{N}", "{M}", "{K}", "{L}", "{G}", "{P}", "<br>"]:
            if en.count(m) != v.count(m): print(c, k, "mark", m); bad += 1
    I[c].update(add[c])
# 11/08 の検品で直した言葉（◯◯園の置き忘れ・内部の言い方など）。見本版の訳より後から重ねる
for k, by in json.load(open(os.path.join(here, "fix_1108.json"))).items():
    for c in L8: I[c][k] = by[c]
# 11/08 午後：園を選ぶ・言葉を両側で選ぶ・学ぶの作り直し（keys_1108b.py が書き出す）
for k, by in json.load(open(os.path.join(here, "fix_1108b.json"))).items():
    for c in L8: I[c][k] = by[c]
# 11/08 昼の kenpin：日本語だけの短い言いかえ（1文字だけの改行・ボタンの折れ・名前は BONSAIGO に統一）
I["ja"]["a.mh.out"] = "公式 X とインスタに出た投稿"
I["ja"]["a.pub.done"] = "BONSAIGO の公式 X とインスタに出ました"
# 英字の言語でない言葉に残った英語の添え書き「(Wiring)」などを外す（選んだ言葉だけで出す・11/08）
for c in ["ja", "zh", "th", "km"]:
    for k, v in list(I[c].items()):
        if isinstance(v, str): I[c][k] = re.sub(r"\s*\((?:[A-Z][A-Za-z \-]*)\)", "", v)
I["km"]["g.tree.ume"] = "អ៊ូមេ (ផ្លែព្រូនជប៉ុន)"
# 11/08 夕方：箱崎さんとのすり合わせ（師匠→職人・ボタンの文・案を出さない答え方）。いちばん最後に重ねる
KEEP = {"g.gp.master", "a.x.master"}
def _en(v):
    for x, y in [(r"\bA master\b", "A craftsperson"), (r"\ba master\b", "a craftsperson"), (r"\bmasters'", "craftspeople's"), (r"\bMasters\b", "Craftspeople"), (r"\bmasters\b", "craftspeople"), (r"\bMaster\b", "Craftsperson"), (r"\bmaster\b", "craftsperson"), (r"what he said", "what they said")]:
        v = re.sub(x, y, v)
    return v
for k, v in list(I["ja"].items()):
    if isinstance(v, str): I["ja"][k] = v.replace("師匠", "職人")
for k, v in list(I["en"].items()):
    if isinstance(v, str) and k not in KEEP: I["en"][k] = _en(v)
for k, by in json.load(open(os.path.join(here, "fix_1108_hakozaki.json"))).items():
    for c, v in by.items(): I[c][k] = v
# 使っていない鍵（◯◯ Garden の置き忘れのもと）は外す
for c in I: I[c].pop("g.m.name", None)
os.makedirs(os.path.join(APP, "盆栽ゴー"), exist_ok=True)
open(os.path.join(APP, "盆栽ゴー", "i18n.js"), "w").write("window.I18N = " + json.dumps(I, ensure_ascii=True) + ";\n")

# 用語の印：見本版 [[key:見せる言葉]] → サーバーの形 [[見せる言葉|用語集の見出し]]
HEAD = {"hazushi": "針金外し", "kake": "針金掛け", "mekiri": "芽切り", "metsumi": "芽摘み", "jin": "ジン", "nebari": "根張り", "tachiagari": "立ち上がり", "uekae": "植え替え"}
conv = lambda s: re.sub(r"\[\[(\w+):([^\]]+)\]\]", lambda m: f"[[{m.group(2)}|{HEAD[m.group(1)]}]]", s)
plain = lambda s: re.sub(r"\[\[(\w+):([^\]]+)\]\]", r"\2", s)
G = lambda c, k: I[c].get(k, I["en"].get(k, ""))

rec = {}
back_ja = I["ja"]["a.dr.s1"] + I["ja"]["a.dr.s2"] + I["ja"]["a.dr.s3"] + I["ja"]["a.fixed"]
for c in L8:
    rec[f"toLearner_{c}"] = {"headline": conv(G(c, "g.ans.h")), "paragraphs": [conv(G(c, f"g.ans.p{i}")) for i in range(1, 5)], "back_translation_ja": back_ja}
rec["reviewAnswer"] = {"ok": True, "confidence": 0.92, "problems_ja": [], "corrected_headline": None, "corrected_paragraphs": None, "corrected_back_translation_ja": None}
rec["checkImage_ok"] = {"ok": True, "is_bonsai": True, "confidence": 0.96, "reason_ja": "鉢に植わった黒松の盆栽が、写真のまん中に写っています。", "reason_en": "A black pine bonsai in a pot fills the middle of the photo."}
rec["checkImage_ng"] = {"ok": False, "is_bonsai": False, "confidence": 0.97, "reason_ja": "庭の小道の写真で、盆栽が写っていません。盆栽が主役の写真にしてください。", "reason_en": "This is a photo of a garden path, and no bonsai is in it. Please use a photo where the bonsai is the subject."}
rec["checkImage_unsure"] = {"ok": True, "is_bonsai": True, "confidence": 0.55, "reason_ja": "見本モードでは、手元の写真を AI が見られません。人が確かめます。", "reason_en": "In sample mode the AI cannot see your own photo, so a person will check it."}
rec["checkPostText_ok"] = {"ok": True, "confidence": 0.93, "problems_ja": [], "problems_en": []}
post = {c: G(c, "pub.post") for c in L8}
rec["treePosts"] = {"title_ja": "黒松・約45年", "x": post, "instagram": {c: post[c] for c in L8}, "terms_ja": ["針金掛け", "芽切り"]}

# Q&A の見本（5つ・8つの言葉）
QA = [("q1", "juniper", "g.qa1.q", "g.ans.h"), ("q2", "pine", "g.qa2.q", "g.qa2.a"), ("q3", "maple", "g.qa3.q", "g.qa3.a"), ("q4", "azalea", "g.qa4.q", "g.qa4.a"), ("q5", "ume", "g.qa5.q", "g.qa5.a")]
qa = [{"id": i, "tree": t, "lang": None, "q": {c: G(c, q) for c in L8 if c != "ja"} | {"ja": ""}, "a": {c: conv(G(c, a)) for c in L8}} for i, t, q, a in QA]
# 日本語の見出し（職人が探すとき用）
JQ = {"q1": "真柏の針金はいつ、どう外す？", "q2": "黒松の芽切りはいつ？", "q3": "もみじの葉先が夏に茶色くなる", "q4": "皐月の植え替えはいつ？", "q5": "梅が今年は咲かなかった"}
for x in qa: x["q"]["ja"] = JQ[x["id"]]

# 言いかえ表：どれか1つで探すと、ほかの言葉の言い方でも当たる
concepts = [
    ["wire", "wiring", "alambre", "alambrado", "fil", "fil de fer", "filo", "filo di", "针金", "铁丝", "金属丝", "蟠扎", "針金", "ลวด", "ខ្សែ"],
    ["juniper", "enebro", "genévrier", "ginepro", "真柏", "杜松", "刺柏", "จูนิเปอร์"],
    ["black pine", "pine", "pino", "pin", "黑松", "松", "黒松", "สน", "ស្រល់"],
    ["maple", "arce", "érable", "acero", "枫", "槭", "もみじ", "楓", "เมเปิล"],
    ["azalea", "azalée", "杜鹃", "皐月", "さつき", "อะซาเลีย"],
    ["ume", "plum", "ciruelo", "prunier", "pruno", "梅", "บ๊วย"],
    ["shoot", "brote", "pousse", "germoglio", "芽", "ยอด", "ពន្លក"],
    ["repot", "trasplant", "rempot", "rinvas", "换盆", "植え替え", "เปลี่ยนกระถาง", "ប្តូរផើង"],
    ["flower", "bloom", "flor", "fleur", "fior", "花", "ดอก", "ផ្កា"],
    ["leaf", "leaves", "hoja", "feuille", "foglia", "叶", "葉", "ใบ", "ស្លឹក"],
]
out = {"recorded": rec, "qa": qa, "concepts": concepts}
json.dump(out, open(os.path.join(APP, "盆栽ゴー_見本の答え.json"), "w"), ensure_ascii=False, indent=1)
print("i18n.js + 盆栽ゴー_見本の答え.json written · problems:", bad)
