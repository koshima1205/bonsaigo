# 仮のキャラ（咲耶・琥珀・柴）を基本の形の組み合わせで作り、Aポーズの GLB に書き出す（骨は rig_walk.py で入れる）。
# fal で作る本番のモデルができるまでの代わり。見本は公式イラスト（chara/ref/cn_00N.jpg）と、それを描き直した下絵（gen_00N_*.png）。
# 使い方:
#   blender.exe -b --factory-startup --python-exit-code 1 --python chara/tools/build_kari.py -- <sakuya|kohaku|shiba> <出力.glb>
# 向き: Blender の −Y を向いて立つ。見る人から見て左＝−X（キャラの右手側）。高さは約2.2（rig_walk.py で 1.1m にそろえる）
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['sakuya', 'kari.glb']
CHARA, OUT = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
COLL = bpy.context.scene.collection
PARTS = []


# ---------- 材質 ----------
def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


MATS = {}


def mat(name, hexc, rough=0.6, metal=0.0, sheen=0.0, coat=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*lin(hexc), 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    for k, v in (('Sheen Weight', sheen), ('Coat Weight', coat)):
        if k in p.inputs: p.inputs[k].default_value = v
    MATS[name] = m
    return m


# ---------- 形 ----------
def obj(name, bm, m, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); COLL.objects.link(o)
    o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = smooth
    PARTS.append(o)
    return o


def ell(name, c, r, m, rot=(0, 0, 0), seg=32, rings=16):
    """だ円の玉。c=中心、r=(rx, ry, rz)"""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=Vector(r), verts=bm.verts)
    bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix(  # 回してから動かす
        (__import__('mathutils').Euler(rot)).to_matrix()))
    bmesh.ops.translate(bm, vec=Vector(c), verts=bm.verts)
    return obj(name, bm, m)


def tube(name, pts, radii, m, seg=20, flat=1.0, cap=True, up=Vector((0, 1, 0))):
    """点の列に沿った管。radii は点ごとの太さ。flat<1 で平たい帯"""
    pts = [Vector(p) for p in pts]; n = len(pts)
    if not isinstance(radii, (list, tuple)): radii = [radii] * n
    bm = bmesh.new(); rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        a = up - t * up.dot(t)
        if a.length < 1e-4: a = Vector((1, 0, 0)) - t * t.x
        a.normalize(); b = t.cross(a)
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * k / seg) * flat + b * math.sin(2 * math.pi * k / seg)) * radii[i])
                      for k in range(seg)])
    for i in range(n - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    if cap:
        for ring, rev in ((rings[0], True), (rings[-1], False)):
            c = bm.verts.new(sum((v.co for v in ring), Vector()) / seg)
            for k in range(seg):
                f = (ring[k], ring[(k + 1) % seg], c)
                bm.faces.new(tuple(reversed(f)) if rev else f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj(name, bm, m)


def smooth(ctrl, n=24):
    """制御点を通るなめらかな線（Catmull-Rom）"""
    P = [Vector(p) for p in ctrl]; out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, len(P) - 1)]
        for k in range(n // (len(P) - 1)):
            t = k / (n // (len(P) - 1))
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1])
    return out


def interp(vals, n):
    out = []
    for i in range(n):
        t = i / (n - 1) * (len(vals) - 1); k = min(int(t), len(vals) - 2)
        out.append(vals[k] + (vals[k + 1] - vals[k]) * (t - k))
    return out


def stube(name, ctrl, radii, m, n=28, **kw):
    pts = smooth(ctrl, n)
    return tube(name, pts, interp(radii, len(pts)), m, **kw)


def torus(name, c, R, r, m, rot=(0, 0, 0), scale=(1, 1, 1), seg=48, rseg=12):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for k in range(rseg):
            b = 2 * math.pi * k / rseg
            ring.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        rings.append(ring)
    for i in range(seg):
        for k in range(rseg):
            bm.faces.new((rings[i][k], rings[(i + 1) % seg][k], rings[(i + 1) % seg][(k + 1) % rseg], rings[i][(k + 1) % rseg]))
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    bmesh.ops.rotate(bm, verts=bm.verts, matrix=__import__('mathutils').Euler(rot).to_matrix())
    bmesh.ops.translate(bm, vec=Vector(c), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj(name, bm, m)


def cone(name, base, tip, r, m, seg=24):
    return tube(name, [base, Vector(base).lerp(Vector(tip), 0.5), tip], [r, r * 0.55, 0.004], m, seg=seg)


def shell(name, c, r, m, keep, seg=48, rings=24):
    """玉の皮のうち keep(点) が真の面だけ残す（髪・前髪・面）"""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=Vector(r), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(c), verts=bm.verts)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())], context='FACES')
    o = obj(name, bm, m)
    sd = o.modifiers.new('thick', 'SOLIDIFY'); sd.thickness = 0.025; sd.offset = 1
    return o


def on_sphere(c, R, x, z, out=0.0):
    """頭の玉（中心c・半径R）の前面で、横 x・高さ z の点（少し外へ out）"""
    dx, dz = x, z - c[2]
    y = -math.sqrt(max(R * R - dx * dx - dz * dz, 0.0))
    n = Vector((dx, y, dz)).normalized()
    return Vector(c) + n * (R + out), n


def rot_to(n):
    """−Y（前）を n に向ける回転（オイラー）"""
    return Vector((0, -1, 0)).rotation_difference(n).to_euler()


# ---------- 共通の体（咲耶・琥珀） ----------
def ninja_body(cfg):
    skin = mat('skin', '#f2d2bd', 0.45, sheen=0.2)
    cloth = mat('kimono', cfg['kimono'], 0.85, sheen=0.5)
    trim = mat('trim', '#1c1a1e', 0.7)
    obi = mat('obi', cfg['obi'], 0.75, sheen=0.4)
    sock = mat('sock', cfg['sock'], 0.9, sheen=0.4)
    tabi = mat('tabi', '#1d1d22', 0.55)
    band = mat('band', '#6b4630', 0.7)
    guard = mat('guard', '#2a2a2e', 0.35, metal=0.3)
    # 脚・足
    for s in (1, -1):
        tube(f'leg{s}', [(s * 0.12, 0, 0.1), (s * 0.125, 0, 0.35), (s * 0.13, 0, 0.62)], [0.08, 0.088, 0.1], sock)
        ell(f'foot{s}', (s * 0.12, -0.05, 0.065), (0.09, 0.16, 0.075), tabi)
        torus(f'ankle{s}', (s * 0.12, 0, 0.16), 0.085, 0.016, band)
    # 着物（すそ→胸）と黒い縁
    k = tube('kimono', [(0, 0, 0.47), (0, 0, 0.62), (0, 0, 0.8), (0, 0, 0.98), (0, 0, 1.1)], [0.27, 0.255, 0.235, 0.215, 0.13], cloth, seg=32)
    k.scale = (1, 0.82, 1)
    torus('hem', (0, 0, 0.475), 0.27, 0.014, trim, scale=(1, 0.82, 1))
    for s in (1, -1):  # えり（着る人の右が下＝前から見て y の字）
        stube(f'collar{s}', [(s * 0.12, -0.12, 1.08), (s * 0.05, -0.19, 0.95), (-s * 0.06, -0.21, 0.8)], [0.026, 0.026, 0.024], trim, flat=0.45, up=Vector((0, 1, 0)))
    tube('opening', [(0.0, -0.205, 0.78), (0.0, -0.225, 0.48)], 0.014, trim)  # 前あわせの縦の縁
    # 帯と結び目
    o = tube('obi', [(0, 0, 0.73), (0, 0, 0.81)], [0.252, 0.25], obi, seg=32); o.scale = (1, 0.84, 1)
    ell('knot', (0, -0.225, 0.77), (0.045, 0.03, 0.04), obi)
    for s in (1, -1):
        ell(f'loop{s}', (s * 0.07, -0.215, 0.785), (0.06, 0.025, 0.035), obi, rot=(0, s * 0.3, 0))
        ell(f'tail{s}', (s * 0.035, -0.22, 0.715), (0.025, 0.018, 0.06), obi, rot=(0, -s * 0.4, 0))
    # 首
    tube('neck', [(0, 0, 1.04), (0, 0, 1.17)], 0.065, skin)
    # 腕（Aポーズ）: そで → 二の腕 → 籠手 → 手
    for s in (1, -1):
        sh, el, wr = Vector((s * 0.19, 0, 1.03)), Vector((s * 0.37, 0, 0.88)), Vector((s * 0.53, -0.01, 0.75))
        tube(f'sleeve{s}', [sh, sh.lerp(el, 0.75)], [0.115, 0.105], cloth)
        torus(f'cuff{s}', tuple(sh.lerp(el, 0.75)), 0.105, 0.012, trim, rot=(0, s * math.radians(50), 0))
        tube(f'upper{s}', [sh.lerp(el, 0.6), el], [0.05, 0.05], skin)
        tube(f'guard{s}', [el, wr], [0.068, 0.058], guard)
        torus(f'wband{s}', tuple(el.lerp(wr, 0.78)), 0.062, 0.014, band, rot=(0, s * math.radians(50), 0))
        hd = wr + (wr - el).normalized() * 0.07
        ell(f'hand{s}', tuple(hd), (0.045, 0.035, 0.07), skin, rot=(0, s * math.radians(42), 0))
        ell(f'thumb{s}', tuple(hd + Vector((-s * 0.01, -0.035, 0.01))), (0.018, 0.018, 0.035), skin)
    return skin


def katana(cfg, mirror=1):
    sheath = mat('sheath', '#141317', 0.3, coat=0.6)
    grip = mat('grip', '#121114', 0.6)
    ito = mat('ito', '#ece8e0', 0.6)
    gold = mat('gold', '#c49a3c', 0.3, metal=0.9)
    lo_, hi_ = Vector((-0.32 * mirror, 0.24, 0.5)), Vector((0.22 * mirror, 0.24, 1.06))
    tube('saya', [lo_, hi_], [0.04, 0.045], sheath)
    ax = (hi_ - lo_).normalized()
    tsuba = hi_ + ax * 0.012
    t = tube('tsuba', [tsuba - ax * 0.012, tsuba + ax * 0.012], 0.075, gold)
    top = tsuba + ax * 0.27
    tube('tsuka', [tsuba, top], [0.036, 0.034], grip)
    for i in range(4):
        c = tsuba.lerp(top, 0.18 + i * 0.2)
        ell(f'ito{i}', tuple(c + Vector((0, -0.03, 0))), (0.022, 0.012, 0.022), ito, rot=(0, math.radians(45), 0))
    tube('kashira', [top, top + ax * 0.03], 0.038, gold)
    tube('kojiri', [lo_ - ax * 0.03, lo_], 0.041, gold)


def head_common(HC, R, skin, hair_hex, band_hex, bow_hex, bangs=True, face=True):
    hair = mat('hair', hair_hex, 0.32, coat=0.4)
    band = mat('hachimaki', band_hex, 0.8, sheen=0.5)
    bow = mat('bow', bow_hex, 0.5, sheen=0.3)
    ell('head', HC, (R, R * 0.96, R * 0.95), skin, seg=48, rings=24)
    for s in (1, -1):
        ell(f'ear{s}', (s * R * 0.97, 0.02, HC[2] - 0.04), (0.04, 0.07, 0.09), skin)
    # 髪のかぶり（顔の窓をあける）
    shell('hair', (HC[0], HC[1] + 0.02, HC[2] + 0.02), (R * 1.07, R * 1.05, R * 1.04), hair,
          lambda p: not (p.y < -0.05 and p.z < HC[2] + 0.13 and abs(p.x) < R * 0.86))
    if bangs:  # ぱっつんの前髪
        shell('bangs', (HC[0], HC[1], HC[2] + 0.02), (R * 1.09, R * 1.07, R * 1.06), hair,
              lambda p: p.y < -0.1 and p.z > HC[2] + 0.05 and abs(p.x) < R * 0.82)
    for s in (1, -1):  # 顔の横の長い毛
        stube(f'lock{s}', [(s * R * 0.84, -0.18, HC[2] + 0.2), (s * R * 0.9, -0.2, HC[2] - 0.05), (s * R * 0.82, -0.2, HC[2] - 0.32), (s * R * 0.74, -0.18, HC[2] - 0.42)],
              [0.05, 0.055, 0.04, 0.008], hair, flat=0.5, up=Vector((0, 1, 0)))
    # ポニーテール（頭の上で結び、見る人の左へ弧を描く）
    top = Vector((0, 0.12, HC[2] + R * 0.98))
    stube('pony', [top, top + Vector((-0.04, 0.0, 0.18)), top + Vector((-0.3, 0.02, 0.28)), top + Vector((-0.58, 0.02, 0.12)),
                   top + Vector((-0.72, 0.0, -0.12)), top + Vector((-0.84, -0.02, -0.06))],
          [0.08, 0.13, 0.15, 0.11, 0.05, 0.008], hair, n=40, flat=0.75, up=Vector((0, 1, 0)))
    ell('bowc', tuple(top + Vector((0, -0.02, 0.03))), (0.05, 0.045, 0.045), bow)
    for s in (1, -1):
        ell(f'bow{s}', tuple(top + Vector((s * 0.1, -0.02, 0.05))), (0.09, 0.03, 0.05), bow, rot=(0, -s * 0.35, 0))
    # はちまき（前で少し下がる）と、見る人の左に結んだ端
    torus('hachimaki', (0, 0.02, HC[2] + 0.17), R * 1.075, 0.022, band, rot=(math.radians(-8), 0, 0), scale=(1, 1, 2.4))
    for k, (dz, ln) in enumerate(((0.03, 0.32), (-0.05, 0.26))):
        base = Vector((-R * 0.95, 0.18, HC[2] + 0.2 + dz))
        stube(f'band_tail{k}', [base, base + Vector((-0.12, 0.06, -0.05)), base + Vector((-ln, 0.1, -0.16))], [0.05, 0.06, 0.03], band, flat=0.25, up=Vector((0, 0, 1)))
    if face:
        dark = mat('eye', '#26232a', 0.15, coat=1.0)
        iris = mat('iris', '#6b6870', 0.2, coat=1.0)
        white = mat('hilite', '#ffffff', 0.1)
        lip = mat('mouth', '#5a2a2a', 0.5)
        cheek = mat('cheek', '#f1aaa0', 0.6)
        for s in (1, -1):
            p, n = on_sphere(HC, R * 0.96, s * 0.17, HC[2] - 0.04, 0.0)
            ell(f'eye{s}', tuple(p), (0.062, 0.02, 0.085), dark, rot=tuple(rot_to(n)))
            p2, _ = on_sphere(HC, R * 0.96, s * 0.17, HC[2] - 0.07, 0.012)
            ell(f'iris{s}', tuple(p2), (0.04, 0.012, 0.045), iris, rot=tuple(rot_to(n)))
            p3, _ = on_sphere(HC, R * 0.96, s * 0.17 + 0.02, HC[2] - 0.0, 0.022)
            ell(f'hl{s}', tuple(p3), (0.016, 0.008, 0.02), white, rot=tuple(rot_to(n)))
            pl, _ = on_sphere(HC, R * 0.96, s * 0.2, HC[2] + 0.05, 0.012)  # まつ毛のはね
            stube(f'lash{s}', [pl, pl + Vector((s * 0.05, -0.005, 0.012))], [0.012, 0.004], dark)
            pc, nc = on_sphere(HC, R * 0.96, s * 0.27, HC[2] - 0.15, 0.0)
            ell(f'cheek{s}', tuple(pc), (0.055, 0.012, 0.035), cheek, rot=tuple(rot_to(nc)))
        pts = [on_sphere(HC, R * 0.96, x, HC[2] - 0.2 - 0.04 * math.cos(x / 0.07 * math.pi / 2), 0.005)[0] for x in (-0.07, -0.035, 0, 0.035, 0.07)]
        stube('smile', pts, [0.008, 0.01, 0.011, 0.01, 0.008], lip, n=16)
        pn, nn = on_sphere(HC, R * 0.96, 0, HC[2] - 0.12, 0.0)
        ell('nose', tuple(pn), (0.012, 0.01, 0.01), mat('skin', '#f2d2bd'))


def build_sakuya():
    HC, R = (0, 0, 1.6), 0.45
    skin = ninja_body(dict(kimono='#d26ca3', obi='#b5952f', sock='#6c6b70'))
    head_common(HC, R, skin, '#16141a', '#d673ad', '#d32b2b')
    katana({})


def build_kohaku():
    HC, R = (0, 0, 1.6), 0.45
    skin = ninja_body(dict(kimono='#6a3c9e', obi='#5160b5', sock='#a9a9ad'))
    head_common(HC, R, skin, '#16141a', '#6b3fa0', '#1e9a9e', bangs=False, face=False)
    katana({}, mirror=-1)
    # 狐の面
    mask = mat('mask', '#f6f4f1', 0.25, coat=0.8)
    red = mat('mask_red', '#d4161b', 0.3, coat=0.6)
    teal = mat('mask_teal', '#159fb3', 0.3, coat=0.6)
    ink = mat('mask_ink', '#18161a', 0.3, coat=0.6)
    MC = Vector((0, -0.2, HC[2] - 0.02))
    shell('mask', tuple(MC), (0.43, 0.36, 0.47), mask, lambda p: p.y < MC.y + 0.08)
    ell('snout', tuple(MC + Vector((0, -0.35, -0.12))), (0.17, 0.12, 0.12), mask)
    for s in (1, -1):  # 耳（内が赤）
        b = MC + Vector((s * 0.27, -0.12, 0.33))
        cone(f'mear{s}', tuple(b), tuple(b + Vector((s * 0.05, -0.02, 0.26))), 0.13, mask)
        cone(f'mearin{s}', tuple(b + Vector((0, -0.075, 0.03))), tuple(b + Vector((s * 0.045, -0.085, 0.22))), 0.075, red)
        # 閉じた目（黒い線）
        e = MC + Vector((s * 0.15, -0.37, 0.02))
        stube(f'meye{s}', [e + Vector((-s * 0.07, 0.01, 0.0)), e + Vector((0, -0.01, 0.025)), e + Vector((s * 0.08, 0.02, 0.0))], [0.01, 0.014, 0.008], ink)
        # 横の青緑の模様
        for j, dx in enumerate((0.1, 0.19)):
            ell(f'mdrop{s}{j}', tuple(MC + Vector((s * dx, -0.38 + dx * 0.25, 0.16 - j * 0.02))), (0.016, 0.01, 0.035), teal, rot=(0.3, 0, -s * 0.3))
        # 口の赤
        ell(f'mlip{s}', tuple(MC + Vector((s * 0.13, -0.38, -0.2))), (0.04, 0.012, 0.025), red, rot=(0, 0, s * 0.4))
    ell('mstripe', tuple(MC + Vector((0, -0.425, 0.14))), (0.022, 0.012, 0.13), teal)
    ell('mnose', tuple(MC + Vector((0, -0.47, -0.08))), (0.025, 0.015, 0.016), ink)
    stube('mmouth', [MC + Vector((-0.14, -0.39, -0.2)), MC + Vector((-0.06, -0.43, -0.24)), MC + Vector((0, -0.45, -0.22)),
                     MC + Vector((0.06, -0.43, -0.24)), MC + Vector((0.14, -0.39, -0.2))], [0.012, 0.02, 0.016, 0.02, 0.012], ink, n=20)


def build_shiba():
    HC, R = (0, 0, 1.55), 0.47
    fur = mat('fur', '#d39a5c', 0.75, sheen=0.6)
    white = mat('white_fur', '#f4efe6', 0.75, sheen=0.6)
    cloth = mat('kimono', '#3f7a35', 0.85, sheen=0.5)
    trim = mat('trim', '#1c1a1e', 0.7)
    obi = mat('obi', '#7d7f84', 0.75, sheen=0.3)
    ink = mat('eye', '#141215', 0.12, coat=1.0)
    hil = mat('hilite', '#ffffff', 0.1)
    metal = mat('plate', '#8d9096', 0.35, metal=0.85)
    tongue = mat('tongue', '#e8838a', 0.4)
    # 頭
    ell('head', HC, (R, R * 0.95, R * 0.9), fur, seg=48, rings=24)
    ell('cheeks', (0, -0.14, HC[2] - 0.15), (R * 0.93, R * 0.68, R * 0.5), white, seg=48)
    ell('muzzle', (0, -0.36, HC[2] - 0.13), (0.2, 0.13, 0.12), white)
    ell('nose', (0, -0.49, HC[2] - 0.07), (0.05, 0.03, 0.035), ink)
    ell('tongue', (0, -0.44, HC[2] - 0.23), (0.04, 0.02, 0.03), tongue)
    stube('mouth', [(-0.12, -0.42, HC[2] - 0.15), (-0.06, -0.47, HC[2] - 0.2), (0, -0.48, HC[2] - 0.15),
                    (0.06, -0.47, HC[2] - 0.2), (0.12, -0.42, HC[2] - 0.15)], [0.008, 0.01, 0.009, 0.01, 0.008], ink, n=20)
    for s in (1, -1):
        p, n = on_sphere(HC, R * 0.95, s * 0.17, HC[2] + 0.0, 0.0)
        ell(f'eye{s}', tuple(p), (0.045, 0.03, 0.05), ink, rot=tuple(rot_to(n)))
        p2, _ = on_sphere(HC, R * 0.95, s * 0.17 + 0.015, HC[2] + 0.02, 0.03)
        ell(f'hl{s}', tuple(p2), (0.013, 0.008, 0.013), hil)
        p3, n3 = on_sphere(HC, R * 0.95, s * 0.16, HC[2] + 0.12, 0.0)
        ell(f'brow{s}', tuple(p3), (0.04, 0.012, 0.022), white, rot=tuple(rot_to(n3)))
        b = Vector((s * 0.27, 0.02, HC[2] + 0.34))
        cone(f'ear{s}', tuple(b), tuple(b + Vector((s * 0.1, 0.0, 0.3))), 0.15, fur)
        cone(f'earin{s}', tuple(b + Vector((s * 0.005, -0.07, 0.03))), tuple(b + Vector((s * 0.09, -0.08, 0.24))), 0.085, white)
    # はちまきと金属の板
    band = mat('hachimaki', '#3f7a35', 0.8, sheen=0.5)
    torus('hachimaki', (0, 0.02, HC[2] + 0.22), R * 1.0, 0.024, band, rot=(math.radians(-6), 0, 0), scale=(1, 1, 2.6))
    p, n = on_sphere(HC, R * 1.0, 0, HC[2] + 0.2, 0.02)
    plate = ell('plate', tuple(p), (0.24, 0.035, 0.085), metal, rot=tuple(rot_to(n)))
    for i in (-1, 0, 1):
        q, nq = on_sphere(HC, R * 1.0, i * 0.13, HC[2] + 0.2, 0.05)
        cone(f'stud{i}', tuple(q - nq * 0.02), tuple(q + nq * 0.03), 0.035, metal, seg=4)
    for k, (dz, ln) in enumerate(((0.04, 0.3), (-0.04, 0.24))):
        base = Vector((-R * 0.95, 0.12, HC[2] + 0.24 + dz))
        stube(f'band_tail{k}', [base, base + Vector((-0.1, 0.0, 0.02)), base + Vector((-ln, -0.02, -0.08))], [0.05, 0.065, 0.03], band, flat=0.25, up=Vector((0, 0, 1)))
    # 体: 上衣・帯・ズボン・足
    k = tube('kimono', [(0, 0, 0.6), (0, 0, 0.8), (0, 0, 0.98), (0, 0, 1.1)], [0.27, 0.25, 0.22, 0.13], cloth, seg=32); k.scale = (1, 0.82, 1)
    for s in (1, -1):
        stube(f'collar{s}', [(s * 0.12, -0.12, 1.08), (s * 0.05, -0.19, 0.95), (-s * 0.08, -0.21, 0.72)], [0.026, 0.026, 0.024], trim, flat=0.45)
    o = tube('obi', [(0, 0, 0.6), (0, 0, 0.69)], [0.26, 0.26], obi, seg=32); o.scale = (1, 0.84, 1)
    ell('knot', (0, -0.235, 0.645), (0.05, 0.03, 0.045), obi)
    for s in (1, -1):
        ell(f'loop{s}', (s * 0.075, -0.225, 0.655), (0.06, 0.025, 0.035), obi, rot=(0, s * 0.3, 0))
        ell(f'otail{s}', (s * 0.04, -0.23, 0.58), (0.025, 0.018, 0.06), obi, rot=(0, -s * 0.4, 0))
        tube(f'pants{s}', [(s * 0.13, 0, 0.62), (s * 0.15, 0, 0.4), (s * 0.14, 0, 0.18)], [0.15, 0.15, 0.115], cloth)
        torus(f'pcuff{s}', (s * 0.14, 0, 0.17), 0.11, 0.025, cloth)
        ell(f'foot{s}', (s * 0.14, -0.05, 0.07), (0.1, 0.15, 0.08), white)
        for t in (-1, 0, 1):
            ell(f'toe{s}{t}', (s * 0.14 + t * 0.045, -0.18, 0.06), (0.025, 0.03, 0.03), white)
    tube('neck', [(0, 0, 1.04), (0, 0, 1.17)], 0.08, fur)
    for s in (1, -1):
        sh, el, wr = Vector((s * 0.19, 0, 1.03)), Vector((s * 0.37, 0, 0.88)), Vector((s * 0.53, -0.01, 0.75))
        tube(f'sleeve{s}', [sh, sh.lerp(el, 0.8)], [0.12, 0.11], cloth)
        torus(f'cuff{s}', tuple(sh.lerp(el, 0.8)), 0.11, 0.012, trim, rot=(0, s * math.radians(50), 0))
        tube(f'arm{s}', [sh.lerp(el, 0.6), el, wr], [0.06, 0.06, 0.058], fur)
        hd = wr + (wr - el).normalized() * 0.06
        ell(f'paw{s}', tuple(hd), (0.07, 0.055, 0.08), white, rot=(0, s * math.radians(42), 0))
    # しっぽ（くるりと巻く）
    stube('tail', [(0, 0.2, 0.68), (0, 0.38, 0.78), (0, 0.44, 0.98), (0, 0.36, 1.08), (0, 0.27, 1.0)],
          [0.07, 0.085, 0.08, 0.065, 0.04], fur, n=30)
    ell('tailtip', (0, 0.27, 0.99), (0.05, 0.05, 0.05), white)
    katana({})


{'sakuya': build_sakuya, 'kohaku': build_kohaku, 'shiba': build_shiba}[CHARA]()

# まとめて1つにして書き出す（モディファイアは確定）
for o in PARTS:
    o.select_set(True)
bpy.context.view_layer.objects.active = PARTS[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
o = bpy.context.object; o.name = CHARA
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', use_selection=True)
print('[kari]', CHARA, len(o.data.polygons), 'faces ->', OUT)
