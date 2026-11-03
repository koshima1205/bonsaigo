# 8樹種の盆栽を Python で組む。Blender 4.5 / EEVEE。
# 使い方：Blender の中で SPECIES="maple"; exec(open(この場所).read())
import bpy, math, random
from mathutils import Vector

SPECIES = globals().get("SPECIES", "pine")
random.seed({"pine": 7, "white-pine": 11, "juniper": 5, "maple": 3, "azalea": 9, "ume": 21, "zelkova": 4, "needle-juniper": 13}.get(SPECIES, 1))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.textures, bpy.data.node_groups):
    for b in list(coll):
        coll.remove(b)


def principled(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def noise_mat(name, c1, c2, rough, scale=6.0, bump=0.4):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = principled(m)
    b.inputs["Roughness"].default_value = rough
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 8
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c1, 1)
    ramp.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def flat_mat(name, color, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    principled(m).inputs["Base Color"].default_value = (*color, 1)
    principled(m).inputs["Roughness"].default_value = rough
    return m


# ---------- 樹種ごとの設定 ----------
S = {
    "pine": dict(bark=((0.035, 0.03, 0.025), (0.17, 0.15, 0.13)), trunk=[(0, 0, 0), (0.28, 0.05, 0.45), (-0.18, -0.04, 0.95), (0.22, 0.06, 1.4), (0.02, -0.03, 1.85), (-0.12, 0.02, 2.2)], r0=0.27,
             branches=[(0.42, -1, 1.15, 0.2), (0.55, 1, 1.0, -0.3), (0.68, -1, 0.85, 0.9), (0.78, 1, 0.75, 0.5), (0.88, -1, 0.55, -0.6)], pad=0.62, padz=0.5, top=0.5,
             tuft="needle", col=((0.012, 0.04, 0.018), (0.05, 0.12, 0.045)), dens=520, sc=(1.4, 2.4), pot="rect", potcol=(0.075, 0.045, 0.035)),
    "white-pine": dict(bark=((0.05, 0.045, 0.04), (0.2, 0.19, 0.17)), trunk=[(0, 0, 0), (0.15, 0, 0.5), (-0.08, 0.03, 1.0), (0.1, -0.02, 1.5), (0, 0, 2.05)], r0=0.22,
             branches=[(0.35, 1, 1.0, 0.1), (0.48, -1, 0.95, -0.2), (0.6, 1, 0.8, 0.8), (0.7, -1, 0.75, 0.6), (0.8, 1, 0.6, -0.7), (0.9, -1, 0.5, 0.3)], pad=0.5, padz=0.55, top=0.45,
             tuft="needle", col=((0.03, 0.065, 0.06), (0.10, 0.17, 0.15)), dens=760, sc=(0.9, 1.5), pot="rect", potcol=(0.11, 0.1, 0.095)),
    "juniper": dict(bark=((0.09, 0.04, 0.025), (0.3, 0.16, 0.09)), trunk=[(0, 0, 0), (0.35, 0.1, 0.35), (0.05, -0.2, 0.75), (-0.35, 0.05, 1.05), (-0.1, 0.2, 1.45), (0.25, 0, 1.75), (0.05, -0.05, 2.0)], r0=0.26,
             branches=[(0.45, 1, 1.0, 0.4), (0.62, -1, 0.9, -0.3), (0.78, 1, 0.65, -0.8), (0.9, -1, 0.5, 0.5)], pad=0.55, padz=0.6, top=0.45, shari=True,
             tuft="scale", col=((0.035, 0.09, 0.025), (0.12, 0.22, 0.06)), dens=420, sc=(0.8, 1.4), pot="rect", potcol=(0.13, 0.08, 0.06)),
    "maple": dict(bark=((0.1, 0.1, 0.095), (0.24, 0.23, 0.21)), trunk=[(0, 0, 0), (0.1, 0, 0.6), (-0.05, 0.05, 1.2), (0.05, 0, 1.75), (0, 0, 2.1)], r0=0.24,
             branches=[(0.38, -1, 0.95, 0.2), (0.5, 1, 0.95, -0.3), (0.6, -1, 0.85, 0.9), (0.7, 1, 0.8, 0.6), (0.8, -1, 0.65, -0.5), (0.88, 1, 0.55, 0.2)], pad=0.62, padz=0.62, top=0.6,
             tuft="leaf", col=((0.28, 0.015, 0.008), (0.62, 0.07, 0.015)), dens=300, sc=(0.8, 1.3), pot="oval", potcol=(0.18, 0.24, 0.3)),
    "azalea": dict(bark=((0.12, 0.08, 0.06), (0.28, 0.2, 0.15)), trunk=[(0, 0, 0), (0.18, 0.05, 0.35), (-0.05, 0, 0.75), (0.05, 0, 1.05)], r0=0.25,
             branches=[(0.55, -1, 0.75, 0.2), (0.65, 1, 0.7, -0.3), (0.8, -1, 0.55, 0.9), (0.9, 1, 0.5, 0.4)], pad=0.75, padz=0.65, top=0.75,
             tuft="flower", col=((0.85, 0.25, 0.42), (0.98, 0.55, 0.65)), dens=260, sc=(0.9, 1.3), pot="round", potcol=(0.82, 0.78, 0.68)),
    "ume": dict(bark=((0.04, 0.035, 0.03), (0.16, 0.14, 0.12)), trunk=[(0, 0, 0), (0.3, 0.05, 0.3), (0.1, -0.05, 0.7), (-0.25, 0.05, 1.05), (-0.15, 0, 1.5)], r0=0.33,
             branches=[(0.55, 1, 1.0, 0.5), (0.7, -1, 0.9, -0.2), (0.82, 1, 0.75, -0.6), (0.92, -1, 0.6, 0.6)], pad=0.35, padz=0.5, top=0.3, bare=True,
             tuft="blossom", col=((0.97, 0.88, 0.9), (1.0, 0.72, 0.8)), dens=90, sc=(0.8, 1.3), pot="round", potcol=(0.06, 0.06, 0.07)),
    "zelkova": dict(bark=((0.07, 0.065, 0.055), (0.2, 0.18, 0.15)), trunk=[(0, 0, 0), (0, 0, 0.5), (0, 0, 0.9)], r0=0.24,
             branches=[], pad=0.0, padz=0.5, top=0.0, broom=True,
             tuft="leaf", col=((0.45, 0.3, 0.06), (0.75, 0.55, 0.12)), dens=170, sc=(1.6, 2.6), pot="oval", potcol=(0.2, 0.13, 0.09)),
    "needle-juniper": dict(bark=((0.07, 0.04, 0.03), (0.25, 0.15, 0.1)), trunk=[(0, 0, 0), (0.12, 0.05, 0.6), (-0.1, 0, 1.2), (0.05, 0, 1.8), (0, 0, 2.3)], r0=0.2,
             branches=[(0.3, 1, 0.85, 0.3), (0.42, -1, 0.85, -0.2), (0.54, 1, 0.75, 0.9), (0.66, -1, 0.65, 0.5), (0.78, 1, 0.5, -0.6), (0.88, -1, 0.42, 0.2)], pad=0.5, padz=0.6, top=0.38,
             tuft="needle", col=((0.05, 0.11, 0.04), (0.14, 0.24, 0.08)), dens=640, sc=(1.0, 1.7), pot="rect", potcol=(0.16, 0.1, 0.07)),
}[SPECIES]

bark = noise_mat("bark", *S["bark"], 0.95, scale=18, bump=1.0)
core = noise_mat("core", tuple(c * 0.35 for c in S["col"][0]), tuple(c * 0.5 for c in S["col"][1]), 0.8, scale=22, bump=0.6)
potm = flat_mat("pot", S["potcol"], 0.55 if S["pot"] == "rect" else 0.3)
soil = noise_mat("soil", (0.05, 0.04, 0.03), (0.16, 0.12, 0.08), 1.0, scale=40)
moss = noise_mat("moss", (0.03, 0.06, 0.02), (0.09, 0.14, 0.04), 1.0, scale=30, bump=0.8)
shari_m = noise_mat("shari", (0.55, 0.52, 0.47), (0.82, 0.8, 0.75), 0.7, scale=25, bump=0.8)


def curve(points, r0, r1, name, mat, res=12):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for i, p in enumerate(points):
        bp = sp.bezier_points[i]
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
        bp.radius = r0 + (r1 - r0) * (i / (len(points) - 1)) ** 0.8
    cu.bevel_depth = 1.0
    cu.bevel_resolution = 5
    cu.resolution_u = res
    cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def lerp_path(pts, t):
    t = max(0, min(0.999, t)) * (len(pts) - 1)
    i = int(t)
    return pts[i].lerp(pts[i + 1], t - i)


trunk = [Vector(v) for v in S["trunk"]]
curve(trunk, S["r0"], 0.05, "trunk", bark, 16)
if S.get("shari"):
    # 舎利：幹に沿う白く枯れた筋
    curve([p + Vector((0.09, -0.12, 0)) for p in trunk[:-1]], S["r0"] * 0.45, 0.03, "shari", shari_m, 16)
for a in range(6):
    ang = a / 6 * math.tau + random.uniform(-0.2, 0.2)
    d = Vector((math.cos(ang), math.sin(ang), 0))
    curve([Vector((0, 0, 0.12)), d * S["r0"] * 1.2 + Vector((0, 0, 0.02)), d * S["r0"] * 2.1 + Vector((0, 0, -0.04))], S["r0"] * 0.5, 0.02, f"root{a}", bark)

pads = []  # (中心, 大きさ)
twig_tips = []
for k, (t, side, length, ang) in enumerate(S["branches"]):
    base = lerp_path(trunk, t)
    d = Vector((side * math.cos(ang), math.sin(ang), 0)).normalized()
    lift = 0.25 if S.get("bare") else 0.0
    p1 = base + d * length * 0.4 + Vector((0, 0, 0.06 + lift * 0.5))
    p2 = base + d * length * 0.75 + Vector((0, 0, -0.08 + lift))
    p3 = base + d * length + Vector((0, 0, -0.02 + lift * 1.3))
    curve([base, p1, p2, p3], 0.085 if not S.get("bare") else 0.07, 0.02, f"br{k}", bark)
    for j in range(5 if S.get("bare") else 3):
        a0 = p2.lerp(p3, j / 4)
        q = a0 + Vector((random.uniform(-0.25, 0.25), random.uniform(-0.25, 0.25), random.uniform(0.05, 0.35 if S.get("bare") else 0.08)))
        curve([a0, q], 0.025, 0.008, f"tw{k}{j}", bark, 6)
        twig_tips.append(q)
    pads.append((p3 + Vector((0, 0, 0.13)), length * S["pad"]))
if S["top"]:
    pads.append((trunk[-1] + Vector((0, 0, 0.18)), S["top"]))

if S.get("broom"):
    # ほうき立ち：幹の上で何本にも分かれ、扇のように上へ広がる
    top = trunk[-1]
    for k in range(9):
        ang = k / 9 * math.tau
        d = Vector((math.cos(ang), math.sin(ang), 0))
        p1 = top + d * 0.18 + Vector((0, 0, 0.35))
        p2 = top + d * 0.55 + Vector((0, 0, 0.85))
        p3 = top + d * 0.85 + Vector((0, 0, 1.25 + random.uniform(-0.1, 0.1)))
        curve([top, p1, p2, p3], 0.07, 0.015, f"bm{k}", bark)
        for j in range(6):
            a0 = p1.lerp(p3, 0.3 + j * 0.12)
            q = a0 + d * random.uniform(0.15, 0.35) + Vector((random.uniform(-0.15, 0.15), random.uniform(-0.15, 0.15), random.uniform(0.15, 0.35)))
            curve([a0, q], 0.018, 0.005, f"bt{k}{j}", bark, 6)
            twig_tips.append(q)
    pads = [(top + Vector((0, 0, 1.15)), 1.05)]

# 葉の雲（または花・つぼみの集まり）の芯
tex = bpy.data.textures.new("padnoise", "VORONOI")
tex.noise_scale = 0.09
pad_objs = []
if S.get("bare"):
    for i, q in enumerate(twig_tips):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.13, location=q)
        o = bpy.context.object
        o.name = f"pad{i}"
        o.data.materials.append(bark)
        pad_objs.append(o)
else:
    for i, (c, s) in enumerate(pads):
        n_sub = 9 if S.get("broom") else 6
        for n in range(n_sub):
            off = Vector((random.uniform(-0.6, 0.6) * s, random.uniform(-0.5, 0.5) * s, random.uniform(-0.06, 0.12) * (4 if S.get("broom") else 1)))
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=s * random.uniform(0.3, 0.55), location=c + off)
            o = bpy.context.object
            o.name = f"pad{i}_{n}"
            o.scale = (0.85, 0.75, S["padz"] * 0.8)
            dm = o.modifiers.new("disp", "DISPLACE")
            dm.texture = tex
            dm.strength = 0.09
            o.data.materials.append(core)
            bpy.ops.object.shade_smooth()
            if S.get("broom"):
                o.hide_render = True  # 冬姿：芯は見せず、まばらな葉だけ
            pad_objs.append(o)

# ---------- 葉・花の1粒を作る ----------
tuft_mat = noise_mat("tuft", *S["col"], 0.55, scale=9, bump=0.2)


def join_parts(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for d in parts:
        d.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(tuft_mat)
    o.hide_render = True
    o.hide_viewport = True
    return o


kind = S["tuft"]
parts = []
if kind == "needle":
    for k in range(15):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.006, radius2=0, depth=0.16, location=(0, 0, -20))
        d = bpy.context.object
        d.rotation_euler = (random.uniform(-0.7, 0.7), random.uniform(-0.7, 0.7), random.uniform(0, math.tau))
        parts.append(d)
elif kind == "scale":
    for k in range(7):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.028, location=(random.uniform(-0.04, 0.04), random.uniform(-0.04, 0.04), -20 + random.uniform(0, 0.06)))
        parts.append(bpy.context.object)
elif kind == "leaf":
    # 5つに裂けた葉（もみじ）／楕円の葉（欅）
    lobes = 5 if SPECIES == "maple" else 1
    for k in range(lobes):
        bpy.ops.mesh.primitive_circle_add(vertices=8, radius=0.05 if lobes > 1 else 0.04, fill_type="TRIFAN", location=(0, 0, -20))
        d = bpy.context.object
        d.scale = (0.32, 1.0, 1)
        a = (k - 2) * 0.55 if lobes > 1 else 0
        d.rotation_euler = (0, 0, a)
        d.location = (math.sin(-a) * 0.045, math.cos(a) * 0.045, -20)
        parts.append(d)
elif kind in ("flower", "blossom"):
    for k in range(5):
        bpy.ops.mesh.primitive_circle_add(vertices=8, radius=0.028 if kind == "flower" else 0.02, fill_type="TRIFAN", location=(0, 0, -20))
        d = bpy.context.object
        a = k / 5 * math.tau
        d.location = (math.cos(a) * 0.026, math.sin(a) * 0.026, -20)
        parts.append(d)
tuft = join_parts(parts, "tuft")

ng = bpy.data.node_groups.new("scatter", "GeometryNodeTree")
ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N = ng.nodes
gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
dist = N.new("GeometryNodeDistributePointsOnFaces"); dist.inputs["Density"].default_value = S["dens"]
oi = N.new("GeometryNodeObjectInfo"); oi.inputs["Object"].default_value = tuft
inst = N.new("GeometryNodeInstanceOnPoints")
rr = N.new("FunctionNodeRandomValue"); rr.data_type = "FLOAT_VECTOR"
rr.inputs["Min"].default_value = (-0.6, -0.6, 0); rr.inputs["Max"].default_value = (0.6, 0.6, 6.28)
rs = N.new("FunctionNodeRandomValue"); rs.data_type = "FLOAT"
rs.inputs[2].default_value = S["sc"][0]; rs.inputs[3].default_value = S["sc"][1]
align = N.new("FunctionNodeAlignEulerToVector"); align.axis = "Z"
rot_add = N.new("FunctionNodeRotateEuler")
join = N.new("GeometryNodeJoinGeometry")
L = ng.links.new
L(gi.outputs[0], dist.inputs["Mesh"])
L(dist.outputs["Points"], inst.inputs["Points"])
L(oi.outputs["Geometry"], inst.inputs["Instance"])
L(dist.outputs["Normal"], align.inputs["Vector"])
L(align.outputs["Rotation"], rot_add.inputs[0])
L(rr.outputs[0], rot_add.inputs[1])
L(rot_add.outputs[0], inst.inputs["Rotation"])
L(rs.outputs[1], inst.inputs["Scale"])
if not (S.get("broom") or S.get("bare")):
    L(gi.outputs[0], join.inputs[0])
L(inst.outputs[0], join.inputs[0])
L(join.outputs[0], go.inputs[0])
for o in pad_objs:
    gm = o.modifiers.new("scatter", "NODES")
    gm.node_group = ng
    o.hide_render = False

# ---------- 鉢・土・苔 ----------
if S["pot"] == "rect":
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.17))
    p = bpy.context.object
    p.scale = (1.9, 1.25, 0.34)
    for sx in (-1, 1):
        for sy in (-1, 1):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(sx * 0.78, sy * 0.48, -0.37))
            f = bpy.context.object
            f.scale = (0.18, 0.14, 0.08)
            f.data.materials.append(potm)
    soil_scale = (1.8, 1.15)
else:
    depth = 0.42 if S["pot"] == "round" else 0.26
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1, depth=depth, location=(0, 0, -depth / 2 + 0.02))
    p = bpy.context.object
    p.scale = (0.85, 0.85, 1) if S["pot"] == "round" else (1.2, 0.8, 1)
    soil_scale = (1.6, 1.6) if S["pot"] == "round" else (2.3, 1.5)
p.name = "pot"
bv = p.modifiers.new("bevel", "BEVEL")
bv.width = 0.04
bv.segments = 4
p.data.materials.append(potm)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.025))
s = bpy.context.object
s.scale = (*soil_scale, 1)
if S["pot"] != "rect":
    bpy.ops.object.delete()
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=0.97, fill_type="NGON", location=(0, 0, 0.025))
    s = bpy.context.object
    s.scale = p.scale
s.data.materials.append(soil)
for n in range(16):
    r = soil_scale[0] * 0.4
    bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.05, 0.1), location=(random.uniform(-r, r), random.uniform(-r * 0.55, r * 0.55), 0.02))
    m = bpy.context.object
    m.scale = (1, 1, 0.3)
    m.data.materials.append(moss)
    bpy.ops.object.shade_smooth()

print("built", SPECIES, len(bpy.data.objects))
