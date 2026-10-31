import bpy, bmesh, math, os, sys, random
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lib_cv import *
from mathutils import Vector, Matrix

reset()
random.seed(7)

M_QUARTZ = mat("quartz", (0.92, 0.95, 1.0), 0.0, 0.03, emission=(0.55, 0.72, 0.95), emission_strength=0.35)
M_BRASS = mat("brass_hq", (0.66, 0.47, 0.21), 1.0, 0.24)
M_BRASS_DK = mat("brass_dark", (0.30, 0.21, 0.09), 1.0, 0.38)
M_CORE = mat("core", (1.0, 0.55, 0.35), 0.0, 0.4, emission=(1.0, 0.42, 0.22), emission_strength=40.0)

# ------------------------------------------------------------------ crystal
def crystal(r=0.235, h=0.62, tip=0.34, sides=6, jitter=0.035):
    bm = bmesh.new()
    ring_top, ring_bot = [], []
    for i in range(sides):
        a = 2 * math.pi * i / sides + math.pi / 6
        rr = r * (1.0 + random.uniform(-jitter, jitter) * 0.5)
        z = h / 2 * (1.0 + random.uniform(-jitter, jitter) * 0.25)
        ring_top.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        ring_bot.append(bm.verts.new((rr * math.cos(a + 0.13), rr * math.sin(a + 0.13), -h / 2)))
    apex = bm.verts.new((random.uniform(-0.02, 0.02), random.uniform(-0.02, 0.02), h / 2 + tip))
    base = bm.verts.new((0, 0, -h / 2 - tip * 0.55))
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new((ring_bot[i], ring_bot[j], ring_top[j], ring_top[i]))
        bm.faces.new((ring_top[i], ring_top[j], apex))
        bm.faces.new((ring_bot[j], ring_bot[i], base))
    bm.normal_update()
    ob = mesh_from_bm("crystal", bm)
    ensure_material(ob, M_QUARTZ)
    return ob

crystal_ob = crystal()
apply_mods(crystal_ob) if crystal_ob.modifiers else None
objects = [crystal_ob]

# inner glow core (small faceted stone)
inner = crystal(r=0.075, h=0.24, tip=0.10, sides=5, jitter=0.0)
inner.name = "core_glow"
inner.data.materials.clear()
inner.data.materials.append(M_CORE)
objects.append(inner)

# ------------------------------------------------------------------ brass rings
rings = []
def ring_set(name, major, minor, axis_rot, y=0.0):
    ob = torus(name, major, minor, rot=axis_rot, material=M_BRASS, maj_seg=128, min_seg=28)
    rings.append(ob)
    return ob

r1 = ring_set("ring_x", 0.46, 0.020, (0, 0, 0))
r2 = ring_set("ring_y", 0.55, 0.017, (math.radians(90), 0, math.radians(12)))
r3 = ring_set("ring_z", 0.63, 0.014, (math.radians(74), math.radians(31), 0))

# machined blocks on rings
for idx, (rr, n) in enumerate([(0.46, 4), (0.55, 3), (0.63, 6)]):
    base = [r1, r2, r3][idx]
    eul = base.rotation_euler.to_matrix()
    for k in range(n):
        a = 2 * math.pi * k / n + idx * 0.7
        p = eul @ Vector((rr * math.cos(a), rr * math.sin(a), 0.0))
        blk = box("ringblk_%d_%d" % (idx, k), (0.055, 0.028, 0.035), tuple(p), material=M_BRASS_DK, bevel=0.004)
        blk.rotation_euler = (base.rotation_euler.x, base.rotation_euler.y, base.rotation_euler.z + a)
        objects.append(blk)

objects += rings

# small brass suspension rods (visual anchor: artifact hangs from nothing)
for k in range(3):
    a = 2 * math.pi * k / 3 + 0.4
    rod = cyl("rod_%d" % k, 0.006, 0.55, (0.62 * math.cos(a), 0.62 * math.sin(a), -1.15 + 0.0), material=M_BRASS, verts=12)
    rod.rotation_euler = (0, 0, 0)
    objects.append(rod)

for ob in objects:
    if ob.modifiers:
        apply_mods(ob)
    shade_auto_smooth(ob, 30)

export_glb(os.path.join(PUB, "artifact.glb"), objects)
save_blend(os.path.join(SRC, "artifact.blend"))

# ------------------------------------------------------------------ fragments
def bm_from_object(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.transform(ob.matrix_world)
    return bm

def split_half(bm_src, co, no, keep_side):
    bm = bm_src.copy()
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5,
                                 plane_co=co, plane_no=no,
                                 clear_outer=(keep_side < 0), clear_inner=(keep_side > 0))
    cut_edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if cut_edges:
        try:
            bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)
        except Exception:
            try:
                bmesh.ops.contextual_create(bm, geom=cut_edges)
            except Exception as e:
                print("fill fail", e)
    bm.normal_update()
    return bm

pieces = [bm_from_object(crystal_ob)]
TARGET = 26
safety = 0
while len(pieces) < TARGET and safety < 400:
    safety += 1
    idx = random.randrange(len(pieces))
    bm = pieces[idx]
    bm.verts.ensure_lookup_table()
    if len(bm.verts) < 8:
        continue
    center = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    v = random.choice(bm.verts).co - center
    if v.length < 1e-4:
        continue
    no = v.normalized()
    # bias cut planes toward the vertical axis for shard-like slivers
    no = (no + Vector((random.uniform(-.3, .3), random.uniform(-.3, .3), random.uniform(-.3, .3)))).normalized()
    co = center + no * random.uniform(0.01, 0.06)
    a = split_half(bm, co, no, -1)
    b = split_half(bm, co, no, +1)
    if len(a.verts) < 6 or len(b.verts) < 6:
        continue
    pieces[idx] = a
    pieces.append(b)

print("FRAGMENTS", len(pieces))
crystal_parent = crystal_ob.matrix_world.copy()
frag_objects = []
for i, bm in enumerate(pieces):
    center = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    bm.transform(Matrix.Translation(-center))
    me = bpy.data.meshes.new("frag_%02d" % i)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("frag_%02d" % i, me)
    link(ob)
    ob.location = center
    ensure_material(ob, M_QUARTZ)
    me.polygons.foreach_set("use_smooth", [False] * len(me.polygons))
    me.update()
    print("FRAG", i, "verts", len(me.vertices), "vol_ok", len(me.polygons) > 3)
    frag_objects.append(ob)

export_glb(os.path.join(PUB, "shards.glb"), frag_objects)

# preview
cam = setup_render((0.95, -1.75, 0.75), (0, 0, 0), res=(1100, 825))
key = bpy.data.lights.new("key", 'AREA'); key.energy = 220; key.size = 2.2
ko = bpy.data.objects.new("key", key); link(ko); ko.location = (2.2, -2.2, 2.6)
ko.rotation_euler = (math.radians(48), 0, math.radians(38))
rim = bpy.data.lights.new("rim", 'AREA'); rim.energy = 120; rim.size = 1.5
ro = bpy.data.objects.new("rim", rim); link(ro); ro.location = (-2.0, 1.6, 1.2)
ro.rotation_euler = (math.radians(70), 0, math.radians(-130))
render_to(os.path.join(SHOTS, "bl-artifact.png"))
