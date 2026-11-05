#!/usr/bin/env python3
"""絵1枚から3Dモデル（GLB）を作る（Hugging Face の無料の試用ページ経由・鍵なし・料金なし）。

使い方:
  python chara/tools/hf_3d.py hunyuan chara/ref/gen_004_shiba.png shiba
  python chara/tools/hf_3d.py trellis chara/ref/gen_004_shiba.png shiba

- hunyuan = tencent/Hunyuan3D-2.1（形＋色）／trellis = microsoft/TRELLIS.2（形＋PBRの色）
- 無料の GPU には1日の使用量の上限がある。上限に当たったら時間をおくか、fal（fal_3d.py）に切り替える
- できたものは chara/raw/<name>_<方式>_<日時>.glb
"""
import os, shutil, sys, time
from datetime import datetime
from gradio_client import Client, handle_file

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(os.path.dirname(HERE), "raw")


def save(src, name, tag, ext=None):
    os.makedirs(RAW, exist_ok=True)
    ext = ext or os.path.splitext(src)[1] or ".glb"
    out = os.path.join(RAW, f"{name}_{tag}_{datetime.now():%Y%m%d_%H%M%S}{ext}")
    shutil.copyfile(src, out)
    print("[保存]", out, os.path.getsize(out), "bytes")
    return out


def hunyuan(img, name):
    c = Client("tencent/Hunyuan3D-2.1", verbose=False)
    r = c.predict(handle_file(img), None, None, None, None, 30, 5.0, 1234, 384, True, 8000, False,
                  api_name="/generation_all")
    print("[stats]", r[3])
    for i, f in enumerate(r[:2]):
        if f: save(f if isinstance(f, str) else f.get("value") or f.get("path"), name, f"hy{i}")


def trellis(img, name):
    c = Client("microsoft/TRELLIS.2", verbose=False)
    try: c.predict(api_name="/start_session")
    except Exception as e: print("[start_session]", e)
    pre = c.predict(handle_file(img), api_name="/preprocess_image")
    c.predict(pre if isinstance(pre, dict) else handle_file(pre), 1234, "1024", api_name="/image_to_3d")
    glb, dl = c.predict(200000, 2048, api_name="/extract_glb")
    save(dl or glb, name, "tr", ".glb")


if __name__ == "__main__":
    mode, img, name = sys.argv[1:4]
    t0 = time.time()
    {"hunyuan": hunyuan, "trellis": trellis}[mode](img, name)
    print(f"[完了] {time.time() - t0:.0f}秒")
