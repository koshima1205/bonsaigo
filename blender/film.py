# 解説動画の素材を Blender で描く（字幕なしの映像）。
# Blender -b -P blender/film.py -- film/a-pine.json [ショット番号…]
import bpy, json, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SPEC = json.load(open(argv[0]))
ONLY = set(argv[1:])
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "film", "out", SPEC["id"] + "-r2")
SEASONS = {
    "spring": ((0.10, 0.24, 0.03), (0.28, 0.46, 0.08)),
    "summer": ((0.04, 0.12, 0.03), (0.12, 0.26, 0.06)),
    "autumn": ((0.28, 0.015, 0.008), (0.62, 0.07, 0.015)),
}


def build(shot):
    g = {"SPECIES": shot["species"], "__name__": "__film__"}
    season = shot.get("season")
    if season in SEASONS:
        g["COL"] = SEASONS[season]
    if season == "winter":
        g["LEAFLESS"] = True
    exec(open(os.path.join(HERE, "species.py")).read(), g)
    g2 = {"STYLE": shot.get("style", "paper"), "__name__": "__film__"}
    exec(open(os.path.join(HERE, "stage.py")).read(), g2)


def cyc(sc, azim):
    # 床から壁へ丸くつながる背景（撮影スタジオのホリゾント）。地平線を見せない
    import bmesh
    me = bpy.data.meshes.new("cyc"); bm = bmesh.new()
    prof = [(-30, 0)] + [(6 + math.sin(t / 10 * math.pi / 2) * 6, 6 - math.cos(t / 10 * math.pi / 2) * 6) for t in range(11)] + [(12, 40)]
    rows = []
    for x in (-40, 40):
        rows.append([bm.verts.new((x, y, z - 0.45)) for y, z in prof])
    for i in range(len(prof) - 1):
        bm.faces.new((rows[0][i], rows[1][i], rows[1][i + 1], rows[0][i + 1]))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("cyc", me); sc.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = True
    o.data.materials.append(bpy.data.materials["floor"])
    o.rotation_euler = (0, 0, math.radians(azim))
    fl = bpy.data.objects.get("floor")
    if fl:
        fl.hide_render = True


def candles(sc, f0, f1):
    # 芽切りの説明：新芽が伸びる → 元から切る → 細かい二番芽が出る
    tips = []
    for o in sc.objects:
        if o.name.startswith("pad") and o.type == "MESH":
            bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
            top = max(bb, key=lambda v: v.z)
            cx = sum(v.x for v in bb) / 8; cy = sum(v.y for v in bb) / 8
            tips.append(Vector((cx, cy, top.z - 0.04)))
    m = bpy.data.materials.new("candle"); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.55, 0.62, 0.3, 1); b.inputs["Roughness"].default_value = 0.6
    n = f1 - f0
    grow, cut, regrow = f0 + int(n * 0.38), f0 + int(n * 0.5), f0 + int(n * 0.62)
    for i, p in enumerate(tips[::2]):
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.075, radius2=0.02, depth=0.5, location=p + Vector((0, 0, 0.25)))
        c = bpy.context.object; c.data.materials.append(m)
        c.scale = (0.3, 0.3, 0.01); c.keyframe_insert("scale", frame=f0 + 10)
        c.scale = (1, 1, 1); c.keyframe_insert("scale", frame=grow)
        c.keyframe_insert("scale", frame=cut - 2)
        c.scale = (0.01, 0.01, 0.01); c.keyframe_insert("scale", frame=cut)
        for k in range(3):
            a = k / 3 * math.tau + i
            q = p + Vector((math.cos(a) * 0.06, math.sin(a) * 0.06, 0.06))
            bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.035, radius2=0.008, depth=0.2, location=q)
            d = bpy.context.object; d.data.materials.append(m)
            d.rotation_euler = (math.cos(a) * 0.4, math.sin(a) * 0.4, 0)
            d.scale = (0.01, 0.01, 0.01); d.keyframe_insert("scale", frame=regrow)
            d.scale = (1, 1, 1); d.keyframe_insert("scale", frame=min(f1, regrow + int(n * 0.25)))


def shoot(shot, idx):
    build(shot)
    sc = bpy.context.scene
    c0 = shot.get("cam", {})
    if shot.get("style", "paper") != "forest":
        cyc(sc, (c0.get("a0", -15) + c0.get("a1", 15)) / 2)
    fps = SPEC.get("fps", 24)
    sc.render.fps = fps
    sc.render.resolution_x, sc.render.resolution_y = SPEC.get("res", [1280, 720])
    sc.render.resolution_percentage = 100
    try:
        sc.eevee.taa_render_samples = 24
    except Exception:
        pass
    sc.render.film_transparent = False
    sc.view_settings.exposure = SPEC.get("exposure", 0.35)
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 90
    frames = int(shot["sec"] * fps)
    sc.frame_start, sc.frame_end = 1, frames
    # 木の大きさから、カメラの基本の距離を決める
    pts = []
    for o in sc.objects:
        if o.type in ("MESH", "CURVE") and o.name not in ("floor", "tuft", "cyc") and not o.hide_render:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    zmin = min(p.z for p in pts); zmax = max(p.z for p in pts)
    h = zmax - zmin
    c = shot.get("cam", {})
    target = bpy.data.objects.new("target", None); sc.collection.objects.link(target)
    target.location = (c.get("tx", 0), 0, zmin + h * c.get("tz", 0.5))
    cam = sc.camera
    cam.data.lens = c.get("lens", 40)
    cam.data.shift_x = c.get("shift", SPEC.get("shift", -0.17))  # 木を右へ寄せ、左に字幕の余白
    cam.data.dof.use_dof = c.get("dof", 0) > 0
    if cam.data.dof.use_dof:
        cam.data.dof.focus_object = target; cam.data.dof.aperture_fstop = c["dof"]
    tr = cam.constraints.new("TRACK_TO"); tr.target = target; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
    dist = h * 3.1 * c.get("r", 1.0) * (cam.data.lens / 40)
    el = math.radians(c.get("el", 6))
    for f, a, rr, e in ((1, c.get("a0", -15), c.get("r0", 1.0), el), (frames, c.get("a1", 15), c.get("r1", 1.0), math.radians(c.get("el1", c.get("el", 6))))):
        ang = math.radians(a - 90)
        d = dist * rr
        cam.location = (math.cos(ang) * d * math.cos(e), math.sin(ang) * d * math.cos(e), target.location.z + d * math.sin(e))
        cam.keyframe_insert("location", frame=f)
    for fc in cam.animation_data.action.fcurves if cam.animation_data and cam.animation_data.action else []:
        for kp in fc.keyframe_points:
            kp.interpolation = "SINE" if c.get("ease", True) else "LINEAR"
    # 弧を描いて回す：途中のキーを足す（直線だと木に近づきすぎる）
    steps = 6
    for s in range(1, steps):
        t = s / steps
        f = 1 + (frames - 1) * t
        ang = math.radians(c.get("a0", -15) + (c.get("a1", 15) - c.get("a0", -15)) * t - 90)
        d = dist * (c.get("r0", 1.0) + (c.get("r1", 1.0) - c.get("r0", 1.0)) * t)
        e = el + (math.radians(c.get("el1", c.get("el", 6))) - el) * t
        cam.location = (math.cos(ang) * d * math.cos(e), math.sin(ang) * d * math.cos(e), target.location.z + d * math.sin(e))
        cam.keyframe_insert("location", frame=f)
    if shot.get("anim") == "candles":
        candles(sc, 1, frames)
    if shot.get("anim") == "sun":
        key = bpy.data.objects.get("key")
        for f, a in ((1, -80), (frames, 60)):
            key.location = (math.cos(math.radians(a)) * 5, math.sin(math.radians(a)) * 5, 4.5)
            key.rotation_euler = (math.radians(45), 0, math.radians(a + 90))
            key.keyframe_insert("location", frame=f); key.keyframe_insert("rotation_euler", frame=f)
    d = os.path.join(OUT, f"{idx:02d}")
    os.makedirs(d, exist_ok=True)
    sc.render.filepath = os.path.join(d, "f")
    bpy.ops.render.render(animation=True)
    print("shot", idx, shot["species"], frames, flush=True)


for i, shot in enumerate(SPEC["shots"]):
    if ONLY and str(i) not in ONLY:
        continue
    if os.path.exists(os.path.join(OUT, f"{i:02d}", f"f{int(shot['sec'] * SPEC.get('fps', 24)):04d}.jpg")):
        print("skip", i, flush=True)
        continue
    shoot(shot, i)
