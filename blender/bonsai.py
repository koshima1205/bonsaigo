# 盆栽（黒松・模様木）を Python で組む。Blender 4.5 / EEVEE。
# 使い方：Blender の中で exec(open(この場所).read())
import bpy, math, random
from mathutils import Vector

random.seed(7)
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


bark = noise_mat("bark", (0.035, 0.03, 0.025), (0.17, 0.15, 0.13), 0.95, scale=18, bump=1.0)
foliage = noise_mat("foliage", (0.008, 0.025, 0.01), (0.03, 0.08, 0.03), 0.8, scale=22, bump=0.6)
pot = bpy.data.materials.new("pot")
pot.use_nodes = True
principled(pot).inputs["Base Color"].default_value = (0.075, 0.045, 0.035, 1)
principled(pot).inputs["Roughness"].default_value = 0.6
soil = noise_mat("soil", (0.05, 0.04, 0.03), (0.16, 0.12, 0.08), 1.0, scale=40)
moss = noise_mat("moss", (0.03, 0.06, 0.02), (0.09, 0.14, 0.04), 1.0, scale=30, bump=0.8)


def branch(points, r0, r1, name, res=12):
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
    ob.data.materials.append(bark)
    return ob


def lerp_path(pts, t):
    t = max(0, min(0.999, t)) * (len(pts) - 1)
    i = int(t)
    return pts[i].lerp(pts[i + 1], t - i)


# 幹：立ち上がりが太く、前後左右にうねる
trunk = [Vector(v) for v in [(0, 0, 0), (0.28, 0.05, 0.45), (-0.18, -0.04, 0.95), (0.22, 0.06, 1.4), (0.02, -0.03, 1.85), (-0.12, 0.02, 2.2)]]
branch(trunk, 0.27, 0.05, "trunk", 16)
# 根張り
for a in range(6):
    ang = a / 6 * math.tau + random.uniform(-0.2, 0.2)
    d = Vector((math.cos(ang), math.sin(ang), 0))
    branch([Vector((0, 0, 0.12)), d * 0.32 + Vector((0, 0, 0.02)), d * 0.55 + Vector((0, 0, -0.04))], 0.13, 0.02, f"root{a}")

pads = []
specs = [(0.42, -1, 1.15, 0.2), (0.55, 1, 1.0, -0.3), (0.68, -1, 0.85, 0.9), (0.78, 1, 0.75, 0.5), (0.88, -1, 0.55, -0.6)]
for k, (t, side, length, ang) in enumerate(specs):
    base = lerp_path(trunk, t)
    d = Vector((side * math.cos(ang), math.sin(ang), 0)).normalized()
    p1 = base + d * length * 0.4 + Vector((0, 0, 0.06))
    p2 = base + d * length * 0.75 + Vector((0, 0, -0.08))
    p3 = base + d * length + Vector((0, 0, -0.02))
    branch([base, p1, p2, p3], 0.085, 0.02, f"br{k}")
    # 小枝
    for j in range(3):
        q = p2.lerp(p3, j / 3) + Vector((random.uniform(-0.2, 0.2), random.uniform(-0.25, 0.25), 0.05))
        branch([p2.lerp(p3, j / 3), q], 0.025, 0.01, f"tw{k}{j}", 6)
    pads.append((p3 + Vector((0, 0, 0.13)), length * 0.62))
pads.append((trunk[-1] + Vector((0, 0, 0.18)), 0.5))

# 葉の雲（雲形の棚）：つぶした球を凸凹にし、上を明るく
tex = bpy.data.textures.new("padnoise", "VORONOI")
tex.noise_scale = 0.09
for i, (c, s) in enumerate(pads):
    for n in range(6):
        off = Vector((random.uniform(-0.6, 0.6) * s, random.uniform(-0.5, 0.5) * s, random.uniform(-0.06, 0.12)))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=s * random.uniform(0.3, 0.55), location=c + off)
        o = bpy.context.object
        o.name = f"pad{i}_{n}"
        o.scale = (1.0, 0.85, 0.5)
        dm = o.modifiers.new("disp", "DISPLACE")
        dm.texture = tex
        dm.strength = 0.09
        o.data.materials.append(foliage)
        bpy.ops.object.shade_smooth()

# 鉢（長方の泥物）
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.17))
p = bpy.context.object
p.name = "pot"
p.scale = (1.9, 1.25, 0.34)
bv = p.modifiers.new("bevel", "BEVEL")
bv.width = 0.05
bv.segments = 4
p.data.materials.append(pot)
for sx in (-1, 1):
    for sy in (-1, 1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(sx * 0.78, sy * 0.48, -0.37))
        f = bpy.context.object
        f.scale = (0.18, 0.14, 0.08)
        f.data.materials.append(pot)
# 土と苔
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.005))
s = bpy.context.object
s.scale = (1.8, 1.15, 1)
s.data.materials.append(soil)
for n in range(16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.05, 0.1), location=(random.uniform(-0.8, 0.8), random.uniform(-0.45, 0.45), 0.0))
    m = bpy.context.object
    m.scale = (1, 1, 0.3)
    m.data.materials.append(moss)
    bpy.ops.object.shade_smooth()


# 針葉の房：細い針を放射状に束ねた1房を作り、葉の雲の表面に何千と生やす
needle_mat = noise_mat("needle", (0.012, 0.04, 0.018), (0.05, 0.12, 0.045), 0.55, scale=9, bump=0.2)
bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.006, radius2=0, depth=0.16, location=(0, 0, -20))
spike = bpy.context.object
spike.name = "spike"
tuft_parts = []
for k in range(14):
    bpy.ops.object.duplicate()
    d = bpy.context.object
    d.rotation_euler = (random.uniform(-0.7, 0.7), random.uniform(-0.7, 0.7), random.uniform(0, math.tau))
    tuft_parts.append(d)
bpy.ops.object.select_all(action="DESELECT")
for d in tuft_parts + [spike]:
    d.select_set(True)
bpy.context.view_layer.objects.active = spike
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
bpy.ops.object.join()
tuft = bpy.context.object
tuft.name = "tuft"
tuft.data.materials.clear()
tuft.data.materials.append(needle_mat)
tuft.hide_render = True
tuft.hide_viewport = True

ng = bpy.data.node_groups.new("needles", "GeometryNodeTree")
ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N = ng.nodes
gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
dist = N.new("GeometryNodeDistributePointsOnFaces"); dist.inputs["Density"].default_value = 520
oi = N.new("GeometryNodeObjectInfo"); oi.inputs["Object"].default_value = tuft
inst = N.new("GeometryNodeInstanceOnPoints")
rr = N.new("FunctionNodeRandomValue"); rr.data_type = "FLOAT_VECTOR"
rr.inputs["Min"].default_value = (-0.5, -0.5, 0); rr.inputs["Max"].default_value = (0.5, 0.5, 6.28)
rs = N.new("FunctionNodeRandomValue"); rs.data_type = "FLOAT"
rs.inputs[2].default_value = 1.4; rs.inputs[3].default_value = 2.4
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
L(gi.outputs[0], join.inputs[0])
L(inst.outputs[0], join.inputs[0])
L(join.outputs[0], go.inputs[0])
for o in bpy.data.objects:
    if o.name.startswith("pad"):
        o.scale = (o.scale[0] * 0.85, o.scale[1] * 0.85, o.scale[2] * 0.8)
        gm = o.modifiers.new("needles", "NODES")
        gm.node_group = ng

print("built", len(bpy.data.objects))
