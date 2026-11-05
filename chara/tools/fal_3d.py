#!/usr/bin/env python3
"""絵1枚から3Dモデル（GLB）を作る（fal・Tripo H3.1）。標準ライブラリだけで動く。

使い方（engawa のフォルダで）:
  python chara/tools/fal_3d.py chara/ref/gen_004_shiba.png --name shiba --dry-run   # 見積だけ（送らない）
  python chara/tools/fal_3d.py chara/ref/gen_004_shiba.png --name shiba             # 本番（お金がかかる）

- 鍵は環境変数 FAL_KEY か ~/.fal_key（1行）。中身は画面に出さない
- 料金（2026-11-05 に fal のページで確認）: 基本 $0.20／色つき +$0.10／高精細の色 +$0.10／高精細の形 +$0.20／四角形 +$0.05
- 1回ごとに chara/ledger.csv に記録する（いつ・何を・見積いくら・結果）
- できたものは chara/raw/<name>_<日時>.glb に保存する
"""
import argparse, base64, csv, json, mimetypes, os, sys, time, urllib.request, urllib.error
from datetime import datetime

MODEL = "tripo3d/h3.1/image-to-3d"
HERE = os.path.dirname(os.path.abspath(__file__))
CHARA = os.path.dirname(HERE)


def fal_key():
    k = os.environ.get("FAL_KEY", "").strip()
    p = os.path.expanduser("~/.fal_key")
    if not k and os.path.isfile(p):
        with open(p, encoding="utf-8-sig") as f:
            k = f.read().strip()
    if not k:
        sys.exit("fal の鍵がありません（~/.fal_key に1行で入れてください。中身はチャットに貼らない）")
    return k


def call(url, key, data=None):
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, method="POST" if data is not None else "GET",
                               headers={"Authorization": f"Key {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=300) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"[HTTP {e.code}] {e.read().decode()[:600]}")


def estimate(a):
    usd = 0.20
    if a.texture: usd += 0.10
    if a.texture and a.texture_quality == "detailed": usd += 0.10
    if a.geometry_quality == "detailed": usd += 0.20
    if a.quad: usd += 0.05
    return round(usd, 2)


def ledger(row):
    p = os.path.join(CHARA, "ledger.csv")
    new = not os.path.isfile(p)
    with open(p, "a", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        if new: w.writerow(["日時", "モデル", "名前", "入力", "見積USD", "状態", "出力"])
        w.writerow(row)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--name", required=True)
    ap.add_argument("--no-texture", dest="texture", action="store_false")
    ap.add_argument("--texture-quality", default="detailed", choices=["standard", "detailed"])
    ap.add_argument("--geometry-quality", default="standard", choices=["standard", "detailed"])
    ap.add_argument("--quad", action="store_true")
    ap.add_argument("--face-limit", type=int, default=0)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    payload = {"texture": a.texture, "pbr": a.texture, "texture_quality": a.texture_quality,
               "geometry_quality": a.geometry_quality, "texture_alignment": "original_image",
               "orientation": "align_image"}
    if a.quad: payload["quad"] = True
    if a.face_limit: payload["face_limit"] = a.face_limit
    if a.seed: payload["model_seed"] = a.seed; payload["texture_seed"] = a.seed
    usd = estimate(a)
    print(f"[見積] {MODEL} 1回 ${usd}（約{round(usd * 155)}円）  設定: {json.dumps(payload, ensure_ascii=False)}")
    if a.dry_run:
        print("[dry-run] 送っていません"); return

    key = fal_key()
    mime = mimetypes.guess_type(a.image)[0] or "image/png"
    with open(a.image, "rb") as f:
        payload["image_url"] = f"data:{mime};base64,{base64.b64encode(f.read()).decode()}"
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    t0 = time.time()
    sub = call(f"https://queue.fal.run/{MODEL}", key, payload)
    print("[送信]", sub.get("request_id"))
    while True:
        st = call(sub["status_url"], key)
        if st.get("status") == "COMPLETED": break
        if st.get("status") not in ("IN_QUEUE", "IN_PROGRESS"):
            ledger([stamp, MODEL, a.name, a.image, usd, "失敗", json.dumps(st)[:200]])
            sys.exit(f"[失敗] {st}")
        time.sleep(3)
    res = call(sub["response_url"], key)
    os.makedirs(os.path.join(CHARA, "raw"), exist_ok=True)
    urls = res.get("model_urls") or {}
    best = (urls.get("pbr_model") or urls.get("glb") or res.get("model_mesh") or {}).get("url")
    out = os.path.join(CHARA, "raw", f"{a.name}_{stamp}.glb")
    urllib.request.urlretrieve(best, out)
    if (res.get("rendered_image") or {}).get("url"):
        urllib.request.urlretrieve(res["rendered_image"]["url"], out.replace(".glb", "_preview.webp"))
    ledger([stamp, MODEL, a.name, a.image, usd, "完了", out])
    print(f"[完了] {time.time() - t0:.0f}秒 → {out}")


if __name__ == "__main__":
    main()
