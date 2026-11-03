# 字幕の板（背景透明の PNG）を Blender の文字で描く。サイトと同じ書体（Fraunces・Zen Antique・Inter）。
# Blender -b -P blender/titles.py
import bpy, os, sys, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
FONTS = os.path.join(ROOT, "film", "fonts")
spec = importlib.util.spec_from_file_location("captions", os.path.join(ROOT, "film", "captions.py"))
cap = importlib.util.module_from_spec(spec); spec.loader.exec_module(cap)
SHORTS = {
    "s1-mekiri": {"film": "a-pine", "shots": [4, 5], "hook_ja": "黒松の「芽切り」って、なに？", "hook_en": "What is mekiri?"},
    "s2-maple": {"film": "b-maple", "shots": [2, 3, 5, 7], "hook_ja": "もみじの一年を、30秒で。", "hook_en": "A maple's year in 30 seconds."},
    "s3-eight": {"film": "c-eight", "shots": [1, 2, 3, 4, 5, 6, 7, 8], "hook_ja": "盆栽の、8つの木。", "hook_en": "Eight trees of bonsai."},
}


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c] + [1]


INK, PAPER, GREEN, HOT, MUTE, SALMON = lin("111111"), lin("EFE9DD"), lin("1F3A2E"), lin("E4572E"), lin("6d675c"), lin("F2A58E")
F = {}


def font(name):
    if name not in F:
        F[name] = bpy.data.fonts.load(os.path.join(FONTS, name))
    return F[name]


MATS = {}


def mat(col):
    k = tuple(round(x, 4) for x in col)
    if k not in MATS:
        m = bpy.data.materials.new(str(k)); m.use_nodes = True
        nt = m.node_tree; nt.nodes.clear()
        e = nt.nodes.new("ShaderNodeEmission"); e.inputs[0].default_value = col; e.inputs[1].default_value = 1
        o = nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(e.outputs[0], o.inputs[0])
        MATS[k] = m
    return MATS[k]


def reset(w, h):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    try:
        sc.eevee.taa_render_samples = 16
    except Exception:
        pass
    cd = bpy.data.cameras.new("c"); cd.type = "ORTHO"; cd.ortho_scale = max(w, h) / 100
    c = bpy.data.objects.new("c", cd); sc.collection.objects.link(c); sc.camera = c
    c.location = (w / 200, -h / 200, 10)


def text(s, fnt, size, x, y, col, spacing=1.0, align="LEFT"):
    """x, y は左上からの位置（100px＝1）。y は文字の並びの基準線"""
    cu = bpy.data.curves.new("t", "FONT"); cu.body = s; cu.font = font(fnt); cu.size = size
    cu.space_character = spacing; cu.align_x = align
    o = bpy.data.objects.new("t", cu); bpy.context.scene.collection.objects.link(o)
    o.location = (x, -y, 0); o.data.materials.append(mat(col))
    bpy.context.view_layer.update()
    return o


def width(o):
    bpy.context.view_layer.update()
    return o.dimensions.x


def save(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def wide(film, i, sh, out):
    reset(1280, 720)
    W, H = 12.8, 7.2
    dark = sh.get("dark")
    ink = PAPER if dark else INK
    sub = PAPER if dark else GREEN
    if sh.get("big"):
        text(sh["label"], "Inter-SemiBold.ttf", 0.15, 0.56, 0.7, HOT, 1.25)
        text(film["title_ja"], "ZenAntique-Regular.ttf", 0.44, 0.56, 1.42, INK)
        text(film["title_en"], "Fraunces-Medium.ttf", 0.3, 0.56, 1.95, INK)
        w = text(film["word"], "Fraunces-Black.ttf", 2.6, 0.42, H - 0.36, GREEN, 0.92)
        text(".", "Fraunces-LightItalic.ttf", 2.6, 0.42 + width(w) + 0.04, H - 0.36, HOT)
    elif sh.get("end"):
        w = text("Engawa", "Fraunces-Black.ttf", 1.5, 0.56, 3.3, PAPER if dark else GREEN, 0.95)
        text(".", "Fraunces-LightItalic.ttf", 1.5, 0.56 + width(w) + 0.03, 3.3, HOT)
        text("記事・3Dの木・職人の声は、Engawa で。", "ZenAntique-Regular.ttf", 0.36, 0.56, 4.1, ink)
        text("Articles, 3D trees and masters' voices — on Engawa.", "Fraunces-Medium.ttf", 0.27, 0.56, 4.6, ink)
        path = f"#/learn/{film['slug']}" if film["slug"] else "#/learn"
        text(f"engawa.igdeploy.workers.dev/{path}", "Inter-SemiBold.ttf", 0.16, 0.56, 5.3, SALMON if dark else HOT, 1.1)
    else:
        text(sh["label"], "Inter-SemiBold.ttf", 0.15, 0.56, 0.7, SALMON if dark else HOT, 1.25)
        if sh.get("note"):
            text(sh["note"], "Inter-SemiBold.ttf", 0.13, 0.56, 1.02, PAPER if dark else MUTE, 1.05)
        ja, en = sh.get("ja", []), sh.get("en", [])
        y_en_last = H - 0.6
        y_en_first = y_en_last - (len(en) - 1) * 0.4
        for k, l in enumerate(en):
            text(l, "Fraunces-Medium.ttf", 0.28, 0.56, y_en_first + k * 0.4, ink)
        y_ja_last = y_en_first - 0.62
        for k, l in enumerate(ja):
            text(l, "ZenAntique-Regular.ttf", 0.4, 0.56, y_ja_last - (len(ja) - 1 - k) * 0.58, sub)
    save(out)


def tall(film, sh, short, out):
    reset(720, 1280)
    W, H = 7.2, 12.8
    # 上：問い／中：映像（y 4.2〜8.25）／下：字幕
    text("ENGAWA · SHORTS", "Inter-SemiBold.ttf", 0.15, 0.48, 0.95, HOT, 1.25)
    hj = short["hook_ja"]
    lines = [hj] if len(hj) <= 13 else [hj[: len(hj) // 2 + 1], hj[len(hj) // 2 + 1:]]
    for k, l in enumerate(lines):
        text(l, "ZenAntique-Regular.ttf", 0.5, 0.48, 1.8 + k * 0.72, INK)
    text(short["hook_en"], "Fraunces-Medium.ttf", 0.34, 0.48, 1.8 + len(lines) * 0.72 + 0.1, GREEN)
    text(sh["label"], "Inter-SemiBold.ttf", 0.14, 0.48, 8.95, HOT, 1.2)
    for k, l in enumerate(sh.get("ja", [])):
        text(l, "ZenAntique-Regular.ttf", 0.3, 0.48, 9.55 + k * 0.48, INK)
    y = 9.55 + len(sh.get("ja", [])) * 0.48 + 0.2
    for k, l in enumerate(sh.get("en", [])):
        text(l, "Fraunces-Medium.ttf", 0.22, 0.48, y + k * 0.34, INK)
    w = text("Engawa", "Fraunces-Black.ttf", 0.42, 0.48, H - 0.55, GREEN, 0.95)
    text(".", "Fraunces-LightItalic.ttf", 0.42, 0.48 + width(w) + 0.01, H - 0.55, HOT)
    text("engawa.igdeploy.workers.dev", "Inter-SemiBold.ttf", 0.13, W - 0.48, H - 0.6, MUTE, 1.05, "RIGHT")
    save(out)


OUT = os.path.join(ROOT, "film", "out", "titles")
only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for fid, film in cap.FILMS.items():
    if only and fid not in only:
        continue
    for i, sh in enumerate(film["shots"]):
        wide(film, i, sh, os.path.join(OUT, fid, f"{i:02d}.png"))
for sid, short in SHORTS.items():
    if only and sid not in only:
        continue
    film = cap.FILMS[short["film"]]
    for i in short["shots"]:
        tall(film, film["shots"][i], short, os.path.join(OUT, sid, f"{i:02d}.png"))
print("titles done")
