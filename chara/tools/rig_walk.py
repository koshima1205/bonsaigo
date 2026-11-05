# AI で作った3Dキャラ（形と色だけのメッシュ）に骨と動き（歩く・立ち止まる）を付けて、庭で使う GLB にする。
# 使い方（engawa のフォルダで）:
#   "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python-exit-code 1 \
#     --python chara/tools/rig_walk.py -- <入力.glb | TEST> <出力.glb> [--height 1.1] [--yaw 0] [--preview フォルダ]
#     [--tris 60000] [--tex 1024] [--weights auto|dist]
# 前提: キャラは正面を向いた Aポーズ（腕を少し下ろして体から離す）。2.5頭身くらいのデフォルメ体型。
# 向き: Blender の −Y を向いて立つ（glTF では +Z）。キャラの右手は −X 側（骨の名前は .L＝+X、.R＝−X）。
# 骨の回し方の約束: どの骨も「ローカルX軸の正の回転＝前へ振る」になるように骨のロールをそろえる。
import bpy, bmesh, math, os, sys
from mathutils import Vector
from mathutils.geometry import intersect_point_line

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
INP, OUT = argv[0], argv[1]


def opt(name, default, cast=str):
    return cast(argv[argv.index(name) + 1]) if name in argv else default


HEIGHT = opt('--height', 1.1, float)
YAW = opt('--yaw', 0.0, float)
PREVIEW = os.path.abspath(opt('--preview', '')) if '--preview' in argv else ''
TRIS = opt('--tris', 60000, int)
TEX = opt('--tex', 1024, int)
WEIGHTS = opt('--weights', 'auto')

bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene


def log(*a):
    print('[rig]', *a, flush=True)


# ---------- 1. 読み込み（または試験用の人形） ----------
def make_test_doll():
    """試験用: 2.5頭身の人形を基本の形で作り、1つのメッシュにまとめる（AI の出力に似せる）"""
    parts = []

    def add(op, **kw):
        op(**kw); parts.append(bpy.context.object)

    add(bpy.ops.mesh.primitive_uv_sphere_add, radius=0.42, location=(0, 0, 1.62))                  # 頭
    add(bpy.ops.mesh.primitive_cone_add, radius1=0.12, radius2=0.0, depth=0.3, location=(0.22, 0.05, 2.05))  # 耳
    add(bpy.ops.mesh.primitive_cone_add, radius1=0.12, radius2=0.0, depth=0.3, location=(-0.22, 0.05, 2.05))
    add(bpy.ops.mesh.primitive_cylinder_add, radius=0.26, depth=0.62, location=(0, 0, 0.92))       # 胴
    add(bpy.ops.mesh.primitive_cylinder_add, radius=0.1, depth=0.62, location=(0.13, 0, 0.36))     # 脚
    add(bpy.ops.mesh.primitive_cylinder_add, radius=0.1, depth=0.62, location=(-0.13, 0, 0.36))
    for s in (1, -1):
        add(bpy.ops.mesh.primitive_cylinder_add, radius=0.07, depth=0.5, location=(s * 0.42, 0, 0.98),
            rotation=(0, s * math.radians(-50), 0))                                                 # 腕（Aポーズ）
        add(bpy.ops.mesh.primitive_uv_sphere_add, radius=0.09, location=(s * 0.6, 0, 0.82))         # 手
        add(bpy.ops.mesh.primitive_cube_add, size=0.2, location=(s * 0.13, -0.06, 0.06), scale=(0.7, 1.3, 0.5))  # 足
    add(bpy.ops.mesh.primitive_cylinder_add, radius=0.05, depth=0.4, location=(0, 0.3, 0.75),
        rotation=(math.radians(60), 0, 0))                                                          # しっぽ
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object
    m = o.modifiers.new('re', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = 0.02
    bpy.ops.object.modifier_apply(modifier='re')
    mat = bpy.data.materials.new('doll'); mat.use_nodes = True
    next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (0.8, 0.5, 0.25, 1)
    o.data.materials.append(mat)
    return o


if INP == 'TEST':
    body = make_test_doll()
else:
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(INP))
    meshes = [o for o in SC.objects if o.type == 'MESH']
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    for o in [o for o in SC.objects if o.type != 'MESH']:
        bpy.data.objects.remove(o, do_unlink=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
body.name = 'Body'
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); bpy.context.view_layer.objects.active = body
if YAW:
    body.rotation_euler.z += math.radians(YAW)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---------- 2. 大きさと置き場所をそろえる（足もと＝原点・高さ HEIGHT） ----------
vs = [v.co.copy() for v in body.data.vertices]
lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
s = HEIGHT / (hi.z - lo.z)
off = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
for v in body.data.vertices:
    v.co = (v.co - off) * s
body.data.update()
log('元の高さ', round(hi.z - lo.z, 3), '→', HEIGHT, '倍率', round(s, 3))

# 三角形が多すぎたら減らす
ntri = sum(len(p.vertices) - 2 for p in body.data.polygons)
if ntri > TRIS:
    m = body.modifiers.new('dec', 'DECIMATE'); m.ratio = TRIS / ntri
    bpy.ops.object.modifier_apply(modifier='dec')
    log('三角形', ntri, '→', sum(len(p.vertices) - 2 for p in body.data.polygons))
for p in body.data.polygons:
    p.use_smooth = True

# ---------- 3. 関節の高さを形から探す ----------
H = HEIGHT
V = [v.co.copy() for v in body.data.vertices]


def slab(z, dz=0.012):
    return [v for v in V if abs(v.z - z) < dz * H]


def clusters(pts, gap=0.02):
    """x で並べて、すき間で区切った塊（xmin, xmax, 点）"""
    pts = sorted(pts, key=lambda v: v.x)
    out = []
    for v in pts:
        if out and v.x - out[-1][1] < gap * H:
            out[-1][1] = v.x; out[-1][2].append(v)
        else:
            out.append([v.x, v.x, [v]])
    return [c for c in out if len(c[2]) >= 3]


def frac_range(a, b, step=0.01):
    z = a
    while z <= b:
        yield z
        z += step


# 股: 下から上へ、脚が左右に分かれている所の上端（しっぽなど後ろへ出たものは除く）
crotch = None
for f in frac_range(0.06, 0.5):
    pts = slab(f * H)
    if not pts: continue
    ym = sorted(v.y for v in pts)[len(pts) // 2]
    pts = [v for v in pts if v.y < ym + 0.06 * H]
    if any(abs(v.x) < 0.012 * H for v in pts):
        crotch = f * H; break
if crotch is None or crotch < 0.12 * H:
    crotch = 0.27 * H; log('股は見つからず（目安を使う）')

# 腕: 股より上で、左右に胴から離れた塊がある範囲（Aポーズ）
arm_z = []
torso_half = {}
for f in frac_range(crotch / H, 0.7):
    cs = clusters(slab(f * H))
    mid = [c for c in cs if c[0] < 0 < c[1]]
    if not mid: continue
    torso_half[round(f, 2)] = max(-mid[0][0], mid[0][1])
    side_l = [c for c in cs if c[0] > mid[0][1]]
    side_r = [c for c in cs if c[1] < mid[0][0]]
    if side_l and side_r:
        arm_z.append((f * H, side_l[-1], side_r[0]))
if arm_z:
    hand_z = arm_z[0][0]
    armpit = arm_z[-1][0]
    hand_xl = max(v.x for v in arm_z[0][1][2]); hand_xr = min(v.x for v in arm_z[0][2][2])
else:
    hand_z, armpit = 0.34 * H, 0.5 * H
    hand_xl, hand_xr = 0.3 * H, -0.3 * H
    log('腕は見つからず（目安を使う）')
shoulder = armpit + 0.03 * H

# 首: 肩より上で、まん中の塊がいちばん細い高さ（頭の下＝あご）
best = None
for f in frac_range(shoulder / H, 0.72, 0.005):
    cs = clusters(slab(f * H, 0.006))
    mid = [c for c in cs if c[0] < 0 < c[1]]
    if not mid: continue
    w = mid[0][1] - mid[0][0]
    if best is None or w < best[1]:
        best = (f * H, w)
neck = best[0] if best and best[0] < 0.7 * H else 0.57 * H
neck = max(neck, shoulder + 0.02 * H)

# 脚の中心（ひざの高さで左右の塊のまん中）
knee = crotch * 0.5
cs = clusters([v for v in slab(knee) if True])
legs_l = [c for c in cs if (c[0] + c[1]) / 2 > 0]
legs_r = [c for c in cs if (c[0] + c[1]) / 2 < 0]
leg_xl = (legs_l[0][0] + legs_l[0][1]) / 2 if legs_l else 0.1 * H
leg_xr = (legs_r[-1][0] + legs_r[-1][1]) / 2 if legs_r else -0.1 * H
mid_y = sum(v.y for v in slab(crotch + 0.05 * H)) / max(1, len(slab(crotch + 0.05 * H)))
th = torso_half.get(round(armpit / H, 2), 0.18 * H)
# 形から探した値を、分かっている値で上書きする（--joints "crotch=0.23,hand=0.29,armpit=0.4,neck=0.45,legx=0.05,handx=0.24,torso=0.09"・どれも高さに対する割合）
if '--joints' in argv:
    J = {k: float(v) for k, v in (kv.split('=') for kv in opt('--joints', '').split(','))}
    crotch = J.get('crotch', crotch / H) * H
    hand_z = J.get('hand', hand_z / H) * H
    armpit = J.get('armpit', armpit / H) * H
    shoulder = armpit + 0.03 * H
    neck = J.get('neck', neck / H) * H
    knee = crotch * 0.5
    if 'legx' in J: leg_xl, leg_xr = J['legx'] * H, -J['legx'] * H
    if 'handx' in J: hand_xl, hand_xr = J['handx'] * H, -J['handx'] * H
    if 'torso' in J: th = J['torso'] * H
    mid_y = J.get('y', mid_y / H) * H
    log('関節は --joints の値を使う')
log(f'股 {crotch / H:.2f}H  手 {hand_z / H:.2f}H  わき {armpit / H:.2f}H  首 {neck / H:.2f}H  '
    f'脚x {leg_xl:.3f}/{leg_xr:.3f}  手x {hand_xl:.3f}/{hand_xr:.3f}  胴の半幅 {th:.3f}')

# ---------- 4. 骨を立てる ----------
arm_data = bpy.data.armatures.new('Rig')
rig = bpy.data.objects.new('Rig', arm_data)
SC.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
EB = arm_data.edit_bones
FWD = Vector((0, -1, 0))


def bone(name, head, tail, parent=None, connect=False):
    b = EB.new(name); b.head = Vector(head); b.tail = Vector(tail)
    b.align_roll(FWD)
    if parent: b.parent = EB[parent]; b.use_connect = connect
    return b


y = mid_y
bone('root', (0, y, 0), (0, y - 0.1 * H, 0))
bone('hips', (0, y, crotch + 0.02 * H), (0, y, crotch + 0.1 * H), 'root')
bone('spine', (0, y, crotch + 0.1 * H), (0, y, armpit), 'hips', True)
bone('chest', (0, y, armpit), (0, y, neck), 'spine', True)
bone('head', (0, y, neck), (0, y, H), 'chest', True)
for side, lx, hx in (('L', leg_xl, hand_xl), ('R', leg_xr, hand_xr)):
    sgn = 1 if side == 'L' else -1
    bone(f'thigh.{side}', (lx, y, crotch), (lx, y - 0.005 * H, knee), 'hips')
    bone(f'shin.{side}', (lx, y - 0.005 * H, knee), (lx, y, 0.045 * H), f'thigh.{side}', True)
    bone(f'foot.{side}', (lx, y, 0.045 * H), (lx, y - 0.08 * H, 0.015 * H), f'shin.{side}', True)
    sh = Vector((sgn * th * 0.85, y, shoulder))
    hand = Vector((hx - sgn * 0.035 * H, y, hand_z + 0.03 * H))
    elbow = sh.lerp(hand, 0.5)
    bone(f'upperarm.{side}', sh, elbow, 'chest')
    bone(f'forearm.{side}', elbow, hand, f'upperarm.{side}', True)
    bone(f'hand.{side}', hand, hand + (hand - elbow).normalized() * 0.05 * H, f'forearm.{side}', True)
bpy.ops.object.mode_set(mode='OBJECT')
DEFORM = [b.name for b in arm_data.bones if b.name != 'root']
arm_data.bones['root'].use_deform = False

# ---------- 5. 肌のつけ方（重み） ----------
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig


def dist_weights():
    """骨までの近さで重みをつける（自動がうまくいかないとき用）。頭より上は頭、左右は x の向きで分ける"""
    for vg in list(body.vertex_groups): body.vertex_groups.remove(vg)
    groups = {n: body.vertex_groups.new(name=n) for n in DEFORM}
    segs = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in arm_data.bones if b.name in DEFORM}
    for v in body.data.vertices:
        p = v.co
        if p.z > neck + 0.02 * H:
            groups['head'].add([v.index], 1.0, 'REPLACE'); continue
        cand = []
        for n, (a, b) in segs.items():
            if n.endswith('.L') and p.x < -0.01 * H: continue
            if n.endswith('.R') and p.x > 0.01 * H: continue
            if n.startswith(('thigh', 'shin', 'foot')) and p.z > crotch + 0.04 * H: continue
            q, t = intersect_point_line(p, a, b)
            t = min(max(t, 0.0), 1.0)
            d = (p - a.lerp(b, t)).length
            cand.append((d, n))
        cand.sort()
        top = cand[:3]
        ws = [1.0 / (d + 0.01 * H) ** 4 for d, _ in top]
        tot = sum(ws)
        for w, (_, n) in zip(ws, top):
            if w / tot > 0.02:
                groups[n].add([v.index], w / tot, 'REPLACE')
    mod = body.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
    body.parent = rig


ok = False
if WEIGHTS == 'auto':
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        none = sum(1 for v in body.data.vertices if not any(g.weight > 0.01 for g in v.groups))
        log('自動の重み: 重みのない点', none, '/', len(body.data.vertices))
        ok = none < 0.005 * len(body.data.vertices)
    except Exception as e:
        log('自動の重みに失敗:', e)
if not ok:
    for m in list(body.modifiers):
        if m.type == 'ARMATURE': body.modifiers.remove(m)
    body.parent = None
    dist_weights()
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='ALL', factor=0.5, repeat=3)
    bpy.ops.object.mode_set(mode='OBJECT')
    log('近さの重みを使った')

# ---------- 6. 動き（Walk・Idle） ----------
SC.render.fps = 30
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
for pb in rig.pose.bones:
    pb.rotation_mode = 'XYZ'
rig.animation_data_create()
D = math.radians


def key(act_name, frames):
    """frames: {frame: {bone: {'rx':度, 'ry':度, 'rz':度, 'ly':長さ(H比)}}}"""
    act = bpy.data.actions.new(act_name); act.use_fake_user = True
    rig.animation_data.action = act
    for f in sorted(frames):
        for pb in rig.pose.bones:
            pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
        for bn, vals in frames[f].items():
            pb = rig.pose.bones[bn]
            pb.rotation_euler = (D(vals.get('rx', 0)), D(vals.get('ry', 0)), D(vals.get('rz', 0)))
            pb.location = (0, vals.get('ly', 0) * H, 0)
        for pb in rig.pose.bones:
            pb.keyframe_insert('rotation_euler', frame=f, group=pb.name)
            if pb.name == 'hips':
                pb.keyframe_insert('location', frame=f, group=pb.name)
    return act


def walk_pose(t):
    """t=0..1 の歩き。左脚は t=0 で前、t=0.5 で後ろ"""
    c = math.cos(2 * math.pi * t); s2 = math.cos(4 * math.pi * t)
    def leg(ph):
        c1 = math.cos(2 * math.pi * (t + ph)); s1 = math.sin(2 * math.pi * (t + ph))
        swing = max(0.0, -s1)  # 後ろから前へ戻る間だけ、ひざを曲げる
        return ({'rx': 24 * c1}, {'rx': -8 - 48 * swing ** 1.5}, {'rx': 10 * c1 * (0.5 + 0.5 * swing)})
    tl, sl, fl = leg(0.0); tr, sr, fr = leg(0.5)
    return {
        'hips': {'ly': -0.012 * s2, 'ry': 7 * c},
        'spine': {'ry': -4 * c, 'rx': 3},
        'chest': {'ry': -3 * c},
        'head': {'rx': -2 + 1.5 * s2, 'ry': 3 * c},
        'thigh.L': tl, 'shin.L': sl, 'foot.L': fl,
        'thigh.R': tr, 'shin.R': sr, 'foot.R': fr,
        'upperarm.L': {'rx': -22 * c}, 'forearm.L': {'rx': 10 + 8 * max(0, -c)},
        'upperarm.R': {'rx': 22 * c}, 'forearm.R': {'rx': 10 + 8 * max(0, c)},
    }


def idle_pose(t):
    b = math.sin(2 * math.pi * t)
    return {
        'hips': {'ly': -0.004 * (0.5 + 0.5 * b)},
        'spine': {'rx': 1.5 * b},
        'chest': {'rx': 1.0 * b},
        'head': {'rz': 3 * math.sin(2 * math.pi * t * 0.5 + 0.6), 'rx': -1.5 * b},
        'upperarm.L': {'rx': 2 * b, 'ry': 0}, 'upperarm.R': {'rx': 2 * b},
        'forearm.L': {'rx': 6}, 'forearm.R': {'rx': 6},
    }


WALK_N, IDLE_N = 24, 72
walk = key('Walk', {f: walk_pose(f / WALK_N) for f in range(0, WALK_N + 1, 2)})
idle = key('Idle', {f: idle_pose(f / IDLE_N) for f in range(0, IDLE_N + 1, 6)})
bpy.ops.object.mode_set(mode='OBJECT')
rig.animation_data.action = None
log('動き: Walk', WALK_N, 'コマ / Idle', IDLE_N, 'コマ（30fps）')

# ---------- 7. 絵の大きさを減らす ----------
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX * img.size[1] // img.size[0])
        log('絵を縮めた', img.name, '→', TEX)


# ---------- 8. 確かめの絵 ----------
def render_previews(folder):
    os.makedirs(folder, exist_ok=True)
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'CYCLES'):
        try:
            SC.render.engine = eng; break
        except TypeError:
            continue
    if SC.render.engine == 'CYCLES':
        SC.cycles.samples = 32
    SC.render.resolution_x, SC.render.resolution_y = 600, 760
    SC.render.film_transparent = False
    w = bpy.data.worlds.new('W'); SC.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
    bg.inputs[0].default_value = (0.92, 0.9, 0.86, 1); bg.inputs[1].default_value = 0.9
    def light(name, loc, energy, size=2.0):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size
        lo_ = bpy.data.objects.new(name, ld); SC.collection.objects.link(lo_)
        lo_.location = loc
        d = Vector((0, 0, 0.5 * H)) - Vector(loc)
        lo_.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    light('key', (-2, -3, 3), 400); light('fill', (3, -2, 1.5), 150); light('rim', (0, 3, 2.5), 200)
    cam_d = bpy.data.cameras.new('Cam'); cam_d.lens = 60
    cam = bpy.data.objects.new('Cam', cam_d); SC.collection.objects.link(cam); SC.camera = cam
    def shoot(name, ang, frame=None, action=None):
        rig.animation_data.action = action
        if frame is not None: SC.frame_set(frame)
        r = 3.0 * H
        cam.location = (r * math.sin(D(ang)), -r * math.cos(D(ang)), 0.55 * H)
        d = Vector((0, 0, 0.5 * H)) - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        SC.render.filepath = os.path.join(folder, name + '.png')
        bpy.ops.render.render(write_still=True)
    shoot('front', 0); shoot('side', 90); shoot('back', 180); shoot('three_q', 35)
    for i, f in enumerate((0, 6, 12, 18)):
        shoot(f'walk_{i}', 60, f, walk)
    rig.animation_data.action = None; SC.frame_set(0)


if PREVIEW:
    render_previews(PREVIEW)

# ---------- 9. 書き出し ----------
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
kw = dict(filepath=os.path.abspath(OUT), export_format='GLB', use_selection=True,
          export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
          export_image_format='JPEG', export_jpeg_quality=85, export_yup=True,
          export_force_sampling=True, export_def_bones=True, export_optimize_animation_size=True,
          export_cameras=False, export_lights=False)
bpy.ops.export_scene.gltf(**{k: v for k, v in kw.items() if k in props})
log('書き出し', OUT, os.path.getsize(OUT), 'bytes')
