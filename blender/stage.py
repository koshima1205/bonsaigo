# 撮影の土台：カメラ・柔らかい光・床・背景。STYLE で3案の光を切り替える
import bpy, math
sc = bpy.context.scene
STYLE = globals().get("STYLE", "white")
for o in [o for o in bpy.data.objects if o.type in ("CAMERA", "LIGHT") or o.name == "floor"]:
    bpy.data.objects.remove(o)
cam_data = bpy.data.cameras.new("cam"); cam_data.lens = 55
cam = bpy.data.objects.new("cam", cam_data); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0.4, -10.5, 1.55); cam.rotation_euler = (math.radians(87.5), 0, math.radians(2))
def area(name, loc, rot, power, size, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, "AREA"); l.energy = power; l.size = size; l.color = color
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc; o.rotation_euler = rot
P = {
    "white": dict(bg=(0.93, 0.925, 0.905), floor=(0.93, 0.925, 0.905), key=900, rim=400, fill=220, bgs=0.7, kc=(1, 0.97, 0.92)),
    "paper": dict(bg=(0.86, 0.82, 0.74), floor=(0.86, 0.82, 0.74), key=1100, rim=300, fill=120, bgs=0.5, kc=(1, 0.93, 0.82)),
    "forest": dict(bg=(0.012, 0.022, 0.016), floor=(0.02, 0.03, 0.022), key=1300, rim=900, fill=25, bgs=0.15, kc=(1, 0.88, 0.66)),
}[STYLE]
area("key", (-3.5, -3.5, 5), (math.radians(50), 0, math.radians(-45)), P["key"], 3, P["kc"])
area("rim", (3, 3, 3.5), (math.radians(-60), 0, math.radians(135)), P["rim"], 2, (0.85, 0.92, 1))
area("fill", (4, -4, 1.5), (math.radians(80), 0, math.radians(45)), P["fill"], 4)
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.45)); fl = bpy.context.object; fl.name = "floor"
m = bpy.data.materials.get("floor") or bpy.data.materials.new("floor"); m.use_nodes = True
b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); b.inputs["Base Color"].default_value = (*P["floor"], 1); b.inputs["Roughness"].default_value = 0.95
fl.data.materials.append(m)
w = sc.world or bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND"); bg.inputs[0].default_value = (*P["bg"], 1); bg.inputs[1].default_value = P["bgs"]
sc.render.resolution_x = 1200; sc.render.resolution_y = 1400
try:
    sc.eevee.use_raytracing = True
except Exception:
    pass
sc.view_settings.view_transform = "AgX"
print("stage", STYLE)
