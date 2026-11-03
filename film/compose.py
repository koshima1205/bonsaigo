# Blender の映像＋字幕の板＋BGM → public/films/*.mp4（16:9 の解説動画と 9:16 のショート）
# python3 film/compose.py [a-pine b-maple c-eight s1-mekiri …]
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from captions import FILMS

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
OUT = os.path.join(HERE, "out")
PUB = os.path.join(ROOT, "public", "films")
PY = "/Applications/Blender.app/Contents/Resources/4.5/python/bin/python3.11"
FPS = 24
SHORTS = json.load(open(os.path.join(OUT, "cards", "shorts.json")))
CUT = {"s1-mekiri": (1.5, 14), "s2-maple": (3, 7.5), "s3-eight": (6, 4)}  # 各ショットの切り出し（開始秒・長さ）
SEED = {"a-pine": 3, "b-maple": 7, "c-eight": 11, "s1-mekiri": 5, "s2-maple": 9, "s3-eight": 13}
os.makedirs(PUB, exist_ok=True)


def sh(*a):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *a], check=True)


def spec(fid):
    return json.load(open(os.path.join(HERE, f"{fid}.json")))


def segment(frames, card, dur, out, start=0.0, tall=False, dark=False, big=False):
    fade = "0B120E" if dark else "EFE9DD"
    vin = ["-framerate", str(FPS), "-start_number", str(1 + int(start * FPS)), "-i", os.path.join(frames, "f%04d.jpg")]
    cin = ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur}", "-i", card]
    t_in = 0.25 if big else 0.6
    cap = f"[1]format=rgba,fade=t=in:st={t_in}:d=0.7:alpha=1,fade=t=out:st={dur - 0.9:.2f}:d=0.5:alpha=1[c]"
    if tall:
        base = f"[0]scale=720:405,pad=720:1280:0:420:color=0x{fade}[v]"
    else:
        base = "[0]null[v]"
    fx = f"{cap};{base};[v][c]overlay=format=auto,fade=t=in:st=0:d=0.35:color=0x{fade},fade=t=out:st={dur - 0.35:.2f}:d=0.35:color=0x{fade},format=yuv420p"
    sh(*vin, *cin, "-filter_complex", fx, "-t", f"{dur}", "-r", str(FPS), "-c:v", "libx264", "-crf", "14", "-preset", "veryfast", out)


def finish(segs, name, dur, tall=False):
    lst = os.path.join(OUT, f"{name}.txt")
    open(lst, "w").write("".join(f"file '{s}'\n" for s in segs))
    raw = os.path.join(OUT, f"{name}-raw.mp4")
    sh("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", raw)
    wav = os.path.join(OUT, f"{name}.wav")
    subprocess.run([PY, os.path.join(HERE, "bgm.py"), wav, f"{dur}", str(SEED[name])], check=True)
    mp4 = os.path.join(PUB, f"{name}.mp4")
    sh("-i", raw, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "27" if not tall else "26", "-preset", "slow", "-tune", "film",
       "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", mp4)
    sh("-ss", "3", "-i", raw, "-frames:v", "1", "-q:v", "3", os.path.join(PUB, f"{name}.jpg"))
    print(name, f"{dur:.1f}s", f"{os.path.getsize(mp4) / 1e6:.1f}MB", flush=True)


def film(fid):
    sp = spec(fid)
    segs, total = [], 0
    for i, shot in enumerate(sp["shots"]):
        frames = os.path.join(OUT, f"{fid}-r2", f"{i:02d}")
        cap = FILMS[fid]["shots"][i]
        seg = os.path.join(OUT, f"seg-{fid}-{i:02d}.mp4")
        segment(frames, os.path.join(OUT, "cards", fid, f"{i:02d}.png"), shot["sec"], seg, dark=bool(cap.get("dark")), big=bool(cap.get("big")))
        segs.append(seg); total += shot["sec"]
    finish(segs, fid, total)


def short(sid):
    s = SHORTS[sid]
    start, d = CUT[sid]
    segs = []
    for i in s["shots"]:
        frames = os.path.join(OUT, f"{s['film']}-r2", f"{i:02d}")
        seg = os.path.join(OUT, f"seg-{sid}-{i:02d}.mp4")
        segment(frames, os.path.join(OUT, "cards", sid, f"{i:02d}.png"), d, seg, start=start, tall=True)
        segs.append(seg)
    finish(segs, sid, d * len(s["shots"]), tall=True)


names = sys.argv[1:] or [*FILMS, *SHORTS]
for n in names:
    film(n) if n in FILMS else short(n)
