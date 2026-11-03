# 1樹種を描く：切り抜き1枚（大）＋回る木24コマ（WEBP・背景透明）
import bpy, math, os
from mathutils import Vector
SPECIES = globals().get("SPECIES", "pine")
FRAMES = globals().get("FRAMES", 24)
OUT = os.path.expanduser(f"~/dev/engawa/public/trees/{SPECIES}")
os.makedirs(OUT, exist_ok=True)
STYLE = "paper"
exec(open(os.path.expanduser("~/dev/engawa/blender/stage.py")).read())
sc = bpy.context.scene
sc.render.film_transparent = True
fl = bpy.data.objects.get("floor")
fl.hide_render = True
# 木全体を1つの空に下げて回す
piv = bpy.data.objects.new("pivot", None); sc.collection.objects.link(piv)
for o in list(sc.objects):
    if o.type in ("MESH", "CURVE") and o.name != "floor" and o.parent is None and o.name != "tuft":
        o.parent = piv
# 枠に合わせてカメラを引く
pts = []
for o in sc.objects:
    if o.type in ("MESH", "CURVE") and o.name not in ("floor", "tuft") and not o.hide_render:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
zmin = min(p.z for p in pts); zmax = max(p.z for p in pts)
w = max(max(abs(p.x) for p in pts), max(abs(p.y) for p in pts))
h = zmax - zmin
cam = sc.camera
cam.data.lens = 55
dist = max(h / 0.5, w * 2 / 0.42)  # 55mm の画角に余白つきで収める
cam.location = (0, -dist, zmin + h * 0.5 + 0.2)
cam.rotation_euler = (math.radians(88), 0, 0)
sc.render.image_settings.file_format = "WEBP"
sc.render.image_settings.color_mode = "RGBA"
sc.render.image_settings.quality = 82
sc.render.resolution_x, sc.render.resolution_y = 1200, 1200
sc.render.filepath = f"{OUT}/hero.webp"
bpy.ops.render.render(write_still=True)
sc.render.resolution_x, sc.render.resolution_y = 960, 960
sc.render.image_settings.quality = 72
for i in range(FRAMES):
    piv.rotation_euler = (0, 0, i / FRAMES * math.tau)
    sc.render.filepath = f"{OUT}/t{i:02d}.webp"
    bpy.ops.render.render(write_still=True)
piv.rotation_euler = (0, 0, 0)
print("rendered", SPECIES, round(h, 2), round(w, 2), round(dist, 2))
