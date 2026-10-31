import bpy, math, os, sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lib_cv import *

reset()

M_CONCRETE = mat("concrete", (0.34, 0.335, 0.325), metallic=0.0, roughness=0.9)
M_CONCRETE_DARK = mat("concrete_dark", (0.22, 0.215, 0.21), 0.0, 0.85)
M_FLOOR = mat("floor", (0.16, 0.158, 0.155), 0.0, 0.42)
M_STEEL = mat("steel", (0.09, 0.09, 0.095), 0.9, 0.42)
M_BRASS = mat("brass", (0.62, 0.45, 0.22), 1.0, 0.28)
M_EMIT = mat("strip", (1.0, 0.86, 0.68), 0.0, 0.4, emission=(1.0, 0.82, 0.62), emission_strength=18.0)

W, D, H = 9.0, 24.0, 7.0
objects = []

def add(ob):
    objects.append(ob)
    return ob

# ---------- floor ----------
add(box("floor", (W, D, 0.4), (0, 0, -0.2), material=M_FLOOR, bevel=0.02))
# floor seams: thin dark strips every 3m across depth
for i in range(-4, 5):
    add(box("floor_seam_%d" % i, (W, 0.035, 0.02), (0, i * 3.0, 0.001), material=M_STEEL))

# ---------- ceiling + coffered beams ----------
add(box("ceil", (W, D, 0.5), (0, 0, H + 0.25), material=M_CONCRETE_DARK))
for i in range(-6, 7):
    add(box("beam_%d" % i, (0.42, D, 0.55), (i * 1.45, 0, H - 0.27), material=M_CONCRETE_DARK, bevel=0.03))

# ---------- side walls: panelled ----------
n_panels = 12
seg = D / n_panels
for side in (-1, 1):
    x = side * (W / 2 + 0.25)
    for i in range(n_panels):
        y = -D / 2 + seg * (i + 0.5)
        add(box("wall_%d_%d" % (side, i), (0.5, seg - 0.06, H), (x, y, H / 2),
                material=M_CONCRETE, bevel=0.03))
    # recessed linear light strip high on the wall
    add(box("strip_%d" % side, (0.08, D - 0.6, 0.10), (side * (W / 2 - 0.02), 0, H - 0.85), material=M_EMIT))

# ---------- back wall with aperture ----------
BW_Y = -D / 2 - 0.3      # wall slab centre
T = 0.7                  # thickness
AW, AH = 6.6, 4.3        # aperture
AZ0, AZ1 = 1.05, 1.05 + AH
# left / right jambs
for side in (-1, 1):
    wj = (W / 2 + 0.25) - AW / 2
    add(box("jamb_%d" % side, (wj, T, H), (side * (AW / 2 + wj / 2), BW_Y, H / 2), material=M_CONCRETE, bevel=0.03))
# head + sill
add(box("head", (AW, T, H - AZ1), (0, BW_Y, (H + AZ1) / 2), material=M_CONCRETE, bevel=0.03))
add(box("sill", (AW, T, AZ0), (0, BW_Y, AZ0 / 2), material=M_CONCRETE, bevel=0.03))
# aperture reveal frame (brass)
add(box("frame_top", (AW + 0.16, 0.1, 0.16), (0, BW_Y + T / 2, AZ1 + 0.04), material=M_BRASS))
add(box("frame_bot", (AW + 0.16, 0.1, 0.16), (0, BW_Y + T / 2, AZ0 - 0.04), material=M_BRASS))

# slats inside aperture: horizontal, tilted
n_slats = 13
z_span = AH
for i in range(n_slats):
    t = (i + 0.5) / n_slats
    z = AZ0 + t * z_span
    ob = box("slat_%02d" % i, (AW - 0.06, 0.34, 0.075), (0, BW_Y, z), rot=(math.radians(38), 0, 0),
             material=M_STEEL, bevel=0.008)
    add(ob)

# ---------- plinth ----------
add(box("plinth", (2.2, 2.2, 0.62), (0, -0.4, 0.31), material=M_CONCRETE_DARK, bevel=0.05, segments=3))
add(box("plinth_cap", (2.26, 2.26, 0.035), (0, -0.4, 0.63), material=M_STEEL, bevel=0.01))

# ---------- sun outside ----------
sun_data = bpy.data.lights.new("sun", 'SUN')
sun_data.energy = 6.0
sun_data.angle = math.radians(0.6)
sun_data.color = (1.0, 0.93, 0.82)
sun = bpy.data.objects.new("sun", sun_data)
link(sun)
sun.location = (2.0, -22.0, 14.0)
d = Vector((0, -1.0, -0.9)) - Vector((2.0, -22.0, 14.0))
sun.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

# ---------- world ----------
world = bpy.data.worlds.new("W")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.006, 0.0065, 0.008, 1)
bg.inputs[1].default_value = 1.0

# apply bevels
for ob in objects:
    if ob.modifiers:
        apply_mods(ob)

export_glb(os.path.join(PUB, "vault.glb"), objects)
save_blend(os.path.join(SRC, "vault.blend"))

cam = setup_render((0.0, 10.5, 2.3), (0, -4.0, 2.0), res=(1400, 787))
render_to(os.path.join(SHOTS, "bl-vault.png"))
