# デモ動画の冒頭と最後：縁側に置いた黒松を、朝の低い光で写真のように撮る。Blender 4.5 / EEVEE。
# Blender -b -P blender/engawa_real.py -- <shot: open|close|still> <出力先>
import bpy, math, os, random, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["still", "/tmp/engawa_real"]
SHOT, OUT = argv[0], argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "species.py")).read(), {"SPECIES": "pine", "__name__": "__real__"})
# 樹皮：割れ目のある黒松の皮（ボロノイの凹凸を強く）
for m in bpy.data.materials:
    if m.name.startswith("bark"):
        nt = m.node_tree; b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        vo = nt.nodes.new("ShaderNodeTexVoronoi"); vo.feature = "DISTANCE_TO_EDGE"; vo.inputs["Scale"].default_value = 26
        tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1, 1, 0.35)
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.9; bp.inputs["Distance"].default_value = 0.03
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], vo.inputs["Vector"])
        nt.links.new(vo.outputs["Distance"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
        for n in nt.nodes:
            if n.type == "VALTORGB":
                n.color_ramp.elements[0].color = (0.018, 0.014, 0.012, 1); n.color_ramp.elements[1].color = (0.11, 0.085, 0.07, 1)
random.seed(3)
sc = bpy.context.scene
DECK = -0.41  # 鉢の足の下


def mat(name, color, rough=0.6, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m, b


def wood(name, c1, c2, scale=3.0, rough=0.45):
    # 板の木目：波の模様をノイズでゆらし、色と凹凸に使う
    m, b = mat(name, c1, rough)
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.12, 2.2, 1.0)
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.inputs["Scale"].default_value = scale
    wv.inputs["Distortion"].default_value = 4; wv.inputs["Detail"].default_value = 6
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c1, 1); ramp.color_ramp.elements[1].color = (*c2, 1)
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.15
    L = nt.links.new
    L(tc.outputs["Object"], mp.inputs["Vector"]); L(mp.outputs["Vector"], wv.inputs["Vector"])
    L(wv.outputs["Fac"], ramp.inputs["Fac"]); L(ramp.outputs["Color"], b.inputs["Base Color"])
    L(wv.outputs["Fac"], bp.inputs["Height"]); L(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def box(name, loc, size, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = size
    bv = o.modifiers.new("bv", "BEVEL"); bv.width = min(size) * 0.08; bv.segments = 2
    o.data.materials.append(m)
    return o


# 縁側の板：横に長い板を少しずつ色を変えて並べる
for o in [o for o in bpy.data.objects if o.name in ("floor",)]:
    bpy.data.objects.remove(o)
deck_ms = [wood(f"deck{i}", (0.09 + i * 0.012, 0.055 + i * 0.006, 0.03), (0.2 + i * 0.015, 0.13, 0.075)) for i in range(4)]
for k in range(-14, 6):
    y = k * 0.42
    box(f"plank{k}", (0, y, DECK - 0.06), (16, 0.4, 0.12), deck_ms[k % 4])
# 縁側の端（手前に落ちる框）
box("kamachi", (0, -14 * 0.42 - 0.25, DECK - 0.2), (16, 0.2, 0.4), deck_ms[1])

# 奥の障子：濃い木の桟と、光を透かす紙
frame_m = wood("frame", (0.05, 0.03, 0.018), (0.11, 0.07, 0.04), 5, 0.5)
paper_m, pb = mat("shoji", (0.93, 0.86, 0.72), 0.9)
pb.inputs["Emission Color"].default_value = (1.0, 0.86, 0.66, 1); pb.inputs["Emission Strength"].default_value = 0.22
pb.inputs["Transmission Weight"].default_value = 0.4
Y = 3.4
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, Y, 1.4)); sh = bpy.context.object
sh.scale = (10, 3.8, 1); sh.rotation_euler = (math.radians(90), 0, 0); sh.data.materials.append(paper_m)
for i in range(-14, 15):
    box(f"kv{i}", (i * 0.36, Y - 0.03, 1.4), (0.025, 0.03, 3.8), frame_m)
for j in range(9):
    box(f"kh{j}", (0, Y - 0.03, -0.4 + j * 0.45), (10, 0.03, 0.025), frame_m)
box("kamoi", (0, Y - 0.08, 3.35), (10, 0.16, 0.14), frame_m)
box("pillar_l", (-2.9, Y - 0.15, 1.4), (0.16, 0.16, 4.2), frame_m)
box("pillar_r", (3.6, Y - 0.15, 1.4), (0.16, 0.16, 4.2), frame_m)
# 右は土壁、上は軒：空を隠して、光を横からだけにする
wall_m, _ = mat("tsuchikabe", (0.32, 0.27, 0.2), 0.95)
box("wall_r", (5.2, 0, 1.4), (0.3, 9, 4.2), wall_m)
box("noki", (0, -1, 3.6), (16, 10, 0.12), frame_m)
for o in bpy.data.objects:
    if o.name == "pot" or o.name.startswith("Cube"):
        for ms in o.material_slots:
            if ms.material and ms.material.name.startswith("pot"):
                b = next(n for n in ms.material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
                b.inputs["Base Color"].default_value = (0.06, 0.032, 0.022, 1); b.inputs["Roughness"].default_value = 0.5

# 左の庭：苔と石、遠くの植え込み（ぼけて背景になる）
moss_m = bpy.data.materials["moss"] if "moss" in bpy.data.materials else mat("gmoss", (0.05, 0.1, 0.03), 1)[0]
bpy.ops.mesh.primitive_plane_add(size=1, location=(-9, -2, DECK - 0.55)); g = bpy.context.object
g.scale = (10, 14, 1); g.data.materials.append(moss_m)
stone_m, _ = mat("stone", (0.16, 0.155, 0.145), 0.85)
for i in range(7):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=random.uniform(0.25, 0.6), location=(random.uniform(-12, -5.5), random.uniform(-6, 2), DECK - 0.5))
    s = bpy.context.object; s.scale = (1.2, 1, 0.55); s.data.materials.append(stone_m)
    d = s.modifiers.new("d", "DISPLACE"); t = bpy.data.textures.new(f"st{i}", "CLOUDS"); t.noise_scale = 0.4; d.texture = t; d.strength = 0.18
bush_m, _ = mat("bush", (0.02, 0.06, 0.02), 0.9)
for i in range(10):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=random.uniform(0.8, 1.6), location=(random.uniform(-16, -8), random.uniform(-2, 6), DECK + random.uniform(-0.3, 0.4)))
    b = bpy.context.object; b.scale = (1, 1, 0.75); b.data.materials.append(bush_m)
    d = b.modifiers.new("d", "DISPLACE"); t = bpy.data.textures.new(f"bu{i}", "VORONOI"); t.noise_scale = 0.3; d.texture = t; d.strength = 0.35

# 光：低い朝日（左手前から差す）と空。部屋の中は暗く、木だけが浮かぶ
for o in [o for o in bpy.data.objects if o.type == "LIGHT"]:
    bpy.data.objects.remove(o)
sun_d = bpy.data.lights.new("sun", "SUN"); sun_d.energy = 4.5; sun_d.color = (1.0, 0.8, 0.58); sun_d.angle = math.radians(1.2)
sun = bpy.data.objects.new("sun", sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(81), 0, math.radians(-72))
fill_d = bpy.data.lights.new("fill", "AREA"); fill_d.energy = 90; fill_d.size = 8; fill_d.color = (0.75, 0.85, 1.0)
fill = bpy.data.objects.new("fill", fill_d); sc.collection.objects.link(fill)
fill.location = (-3, -7, 3); fill.rotation_euler = (math.radians(70), 0, math.radians(-25))
w = sc.world; w.use_nodes = True
nt = w.node_tree; bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
sky = nt.nodes.new("ShaderNodeTexSky"); sky.sky_type = "NISHITA"; sky.sun_elevation = math.radians(9); sky.sun_rotation = math.radians(208)
nt.links.new(sky.outputs["Color"], bg.inputs["Color"]); bg.inputs["Strength"].default_value = 0.08
# 朝のもや：光の筋が見える程度の薄い霧
vol = nt.nodes.new("ShaderNodeVolumePrincipled"); vol.inputs["Density"].default_value = 0.004
vol.inputs["Anisotropy"].default_value = 0.6
# （EEVEE では空のもやが日の光を吸ってしまうので、つながない）

# カメラ：50mm・浅いピントで木に寄る
for o in [o for o in bpy.data.objects if o.type == "CAMERA"]:
    bpy.data.objects.remove(o)
cd = bpy.data.cameras.new("cam"); cd.lens = 50; cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.2
cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam); sc.camera = cam
target = bpy.data.objects.new("target", None); sc.collection.objects.link(target); target.location = (0, 0, 0.95)
cd.dof.focus_object = target
tr = cam.constraints.new("TRACK_TO"); tr.target = target; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"


def campos(a, d, h):
    r = math.radians(a - 90)
    return (math.cos(r) * d, math.sin(r) * d, h)


sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
ee = sc.eevee
for k, v in (("use_raytracing", True), ("taa_render_samples", 48), ("use_shadows", True), ("volumetric_tile_size", "4"), ("volumetric_samples", 96), ("use_volumetric_shadows", True)):
    try:
        setattr(ee, k, v)
    except Exception:
        pass
try:
    ee.ray_tracing_options.resolution_scale = "1"
except Exception:
    pass
sc.view_settings.view_transform = "AgX"
try:
    sc.view_settings.look = "AgX - Medium High Contrast"
except Exception:
    pass
sc.view_settings.exposure = 0.0
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, 100
sc.render.fps = 24
sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 92
os.makedirs(OUT, exist_ok=True)

if SHOT == "still":
    cam.location = campos(-28, 10.5, 1.6)
    sc.render.filepath = os.path.join(OUT, "still.jpg")
    bpy.ops.render.render(write_still=True)
else:
    # open：遠くからゆっくり木へ寄る（15秒）／close：夕方の光で横へ回る（15秒）
    n = 360
    sc.frame_start, sc.frame_end = 1, n
    if SHOT == "open":
        keys = [(1, -40, 15.5, 2.6), (n, -24, 9.6, 1.5)]
    else:
        sun.rotation_euler = (math.radians(80), 0, math.radians(-118)); sun_d.color = (1.0, 0.66, 0.4)
        sky.sun_elevation = math.radians(4)
        keys = [(1, 12, 10.5, 1.6), (n, 46, 11.2, 1.9)]
    for f, a, d, h in keys:
        cam.location = campos(a, d, h); cam.keyframe_insert("location", frame=f)
    for s in range(1, 6):
        t = s / 6; f = 1 + (n - 1) * t
        a = keys[0][1] + (keys[1][1] - keys[0][1]) * t; d = keys[0][2] + (keys[1][2] - keys[0][2]) * t; h = keys[0][3] + (keys[1][3] - keys[0][3]) * t
        cam.location = campos(a, d, h); cam.keyframe_insert("location", frame=f)
    for fc in cam.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "SINE"
    sc.render.filepath = os.path.join(OUT, "f")
    bpy.ops.render.render(animation=True)
print("done", SHOT, flush=True)
