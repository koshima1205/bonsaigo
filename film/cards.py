# 字幕の板の割り付け → tools/textcard（CoreText）で PNG にする。python3 film/cards.py
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from captions import FILMS

HERE = os.path.dirname(os.path.abspath(__file__))
FD = os.path.join(HERE, "fonts")
OUT = os.path.join(HERE, "out", "cards")
INTER, ZEN, FR, FRB, FRI = (os.path.join(FD, f) for f in ("Inter-SemiBold.ttf", "ZenAntique-Regular.ttf", "Fraunces-Medium.ttf", "Fraunces-Black.ttf", "Fraunces-LightItalic.ttf"))
INK, PAPER, GREEN, HOT, MUTE, SALMON = "#111111", "#EFE9DD", "#1F3A2E", "#E4572E", "#6d675c", "#F2A58E"
SHORTS = {
    "s1-mekiri": {"film": "a-pine", "shots": [4, 5], "hook_ja": ["黒松の「芽切り」って、", "なに？"], "hook_en": "What is mekiri?"},
    "s2-maple": {"film": "b-maple", "shots": [2, 3, 5, 7], "hook_ja": ["もみじの一年を、", "30秒で。"], "hook_en": "A maple's year in 30 seconds."},
    "s3-eight": {"film": "c-eight", "shots": [1, 2, 3, 4, 5, 6, 7, 8], "hook_ja": ["盆栽の、", "8つの木。"], "hook_en": "Eight trees of bonsai."},
}
CJK = re.compile(r"[　-鿿＀-￯]")


def label(text, x, y, size, color, align="left"):
    # 欧文は Inter の大文字・字間あり、和文は Zen Antique
    runs = []
    for k, seg in enumerate(text.split(" · ")):
        if k:
            runs.append({"t": "  ·  ", "font": INTER, "size": size, "color": color, "track": size * 0.12})
        if CJK.search(seg):
            runs.append({"t": seg, "font": ZEN, "size": size * 1.15, "color": color, "track": size * 0.05})
        else:
            runs.append({"t": seg, "font": INTER, "size": size, "color": color, "track": size * 0.16})
    return {"x": x, "y": y, "align": align, "runs": runs}


def line(t, font, size, x, y, color, track=0, align="left"):
    return {"x": x, "y": y, "align": align, "runs": [{"t": t, "font": font, "size": size, "color": color, "track": track}]}


def word(t, size, x, y, color):
    return {"x": x, "y": y, "runs": [{"t": t, "font": FRB, "size": size, "color": color, "track": -size * 0.03}, {"t": ".", "font": FRI, "size": size, "color": HOT}]}


def wide(film, sh):
    W, H = 1280, 720
    dark = sh.get("dark")
    ink = PAPER if dark else INK
    L = []
    if sh.get("big"):
        L += [label(sh["label"], 56, 70, 15, HOT), line(film["title_ja"], ZEN, 44, 56, 140, INK), line(film["title_en"], FR, 30, 56, 192, INK), word(film["word"], 250, 44, H - 40, GREEN)]
    elif sh.get("end"):
        path = f"#/learn/{film['slug']}" if film["slug"] else "#/learn"
        L += [word("Engawa", 150, 52, 330, PAPER if dark else GREEN),
              line("記事・3Dの木・職人の声は、Engawa で。", ZEN, 36, 56, 410, ink),
              line("Articles, 3D trees and masters' voices — on Engawa.", FR, 27, 56, 458, ink),
              line(f"engawa.igdeploy.workers.dev/{path}", INTER, 16, 56, 528, SALMON if dark else HOT, 1.5)]
    else:
        L.append(label(sh["label"], 56, 70, 15, SALMON if dark else HOT))
        if sh.get("note"):
            ja, en = sh["note"].split(" · ")
            L.append({"x": 56, "y": 102, "runs": [{"t": ja, "font": ZEN, "size": 15, "color": PAPER if dark else MUTE}, {"t": "  ·  " + en, "font": INTER, "size": 13, "color": PAPER if dark else MUTE, "track": 0.6}]})
        ja, en = sh.get("ja", []), sh.get("en", [])
        y_en0 = H - 60 - (len(en) - 1) * 40
        L += [line(l, FR, 28, 56, y_en0 + k * 40, ink) for k, l in enumerate(en)]
        y_ja_last = y_en0 - 64
        L += [line(l, ZEN, 40, 56, y_ja_last - (len(ja) - 1 - k) * 58, PAPER if dark else GREEN) for k, l in enumerate(ja)]
    return {"w": W, "h": H, "lines": L}


def tall(film, sh, short):
    W, H = 720, 1280
    L = [label("ENGAWA · SHORTS", 48, 92, 15, HOT)]
    L += [line(l, ZEN, 54, 48, 180 + k * 72, INK) for k, l in enumerate(short["hook_ja"])]
    y = 180 + len(short["hook_ja"]) * 72 - 6
    L.append(line(short["hook_en"], FR, 34, 48, y, GREEN))
    L.append(label(sh["label"], 48, 895, 14, HOT))
    y = 955
    for l in sh.get("ja", []):
        L.append(line(l, ZEN, 31, 48, y, INK)); y += 48
    y += 14
    for l in sh.get("en", []):
        L.append(line(l, FR, 23, 48, y, INK)); y += 34
    L.append(word("Engawa", 44, 46, H - 52, GREEN))
    L.append(line("engawa.igdeploy.workers.dev", INTER, 13, W - 48, H - 58, MUTE, 0.8, "right"))
    return {"w": W, "h": H, "lines": L}


jobs = []
for fid, film in FILMS.items():
    for i, sh in enumerate(film["shots"]):
        jobs.append({**wide(film, sh), "out": os.path.join(OUT, fid, f"{i:02d}.png")})
for sid, short in SHORTS.items():
    film = FILMS[short["film"]]
    for i in short["shots"]:
        jobs.append({**tall(film, film["shots"][i], short), "out": os.path.join(OUT, sid, f"{i:02d}.png")})
os.makedirs(OUT, exist_ok=True)
jp = os.path.join(OUT, "jobs.json")
json.dump(jobs, open(jp, "w"), ensure_ascii=False)
subprocess.run([os.path.join(HERE, "tools", "textcard"), jp], check=True)
json.dump(SHORTS, open(os.path.join(OUT, "shorts.json"), "w"), ensure_ascii=False)
