"""Cold Vault - shared bpy helpers."""
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix, Euler

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "assets_src")
PUB = os.path.join(ROOT, "public")
SHOTS = os.path.join(ROOT, "shots")
for d in (SRC, PUB, SHOTS):
    os.makedirs(d, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1.0
    return sc


def mat(name, color, metallic=0.0, roughness=0.5, emission=None, emission_strength=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = 'BLEND'
    m.diffuse_color = (*color, 1.0)
    return m


def ensure_material(ob, m):
    ob.data.materials.clear()
    ob.data.materials.append(m)


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mesh_from_bm(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    return link(ob)


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), material=None, bevel=0.0, segments=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    ob = mesh_from_bm(name, bm)
    ob.location = loc
    ob.rotation_euler = Euler(rot)
    if material:
        ensure_material(ob, material)
    if bevel > 0:
        md = ob.modifiers.new("bev", 'BEVEL')
        md.width = bevel
        md.segments = segments
        md.limit_method = 'ANGLE'
        md.angle_limit = math.radians(40)
    return ob


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for md in list(ob.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=md.name)
        except Exception as e:
            print("modifier apply failed", ob.name, md.name, e)


def cyl(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), verts=64, material=None, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r, radius2=r, depth=depth)
    ob = mesh_from_bm(name, bm)
    ob.location = loc
    ob.rotation_euler = Euler(rot)
    if material:
        ensure_material(ob, material)
    if bevel > 0:
        md = ob.modifiers.new("bev", 'BEVEL')
        md.width = bevel
        md.segments = 2
        md.limit_method = 'ANGLE'
    return ob


def torus(name, major, minor, loc=(0, 0, 0), rot=(0, 0, 0), material=None, maj_seg=96, min_seg=24):
    bm = bmesh.new()
    for i in range(maj_seg):
        a = 2 * math.pi * i / maj_seg
        for j in range(min_seg):
            b = 2 * math.pi * j / min_seg
            x = (major + minor * math.cos(b)) * math.cos(a)
            y = (major + minor * math.cos(b)) * math.sin(a)
            z = minor * math.sin(b)
            bm.verts.new((x, y, z))
    bm.verts.ensure_lookup_table()
    for i in range(maj_seg):
        for j in range(min_seg):
            v0 = bm.verts[i * min_seg + j]
            v1 = bm.verts[i * min_seg + (j + 1) % min_seg]
            v2 = bm.verts[((i + 1) % maj_seg) * min_seg + (j + 1) % min_seg]
            v3 = bm.verts[((i + 1) % maj_seg) * min_seg + j]
            bm.faces.new((v0, v1, v2, v3))
    bm.normal_update()
    ob = mesh_from_bm(name, bm)
    ob.location = loc
    ob.rotation_euler = Euler(rot)
    if material:
        ensure_material(ob, material)
    return ob


def shade_auto_smooth(ob, angle_deg=35.0):
    me = ob.data
    for p in me.polygons:
        p.use_smooth = True
    bpy.context.view_layer.objects.active = ob
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle_deg))
    except Exception:
        try:
            me.set_sharp_from_angle(angle=math.radians(angle_deg))
        except Exception as e:
            print("smooth fail", e)


def export_glb(path, objects=None):
    if objects is not None:
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                                  export_apply=True, export_yup=True)
    else:
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True)
    print("EXPORT", path, os.path.getsize(path))


def save_blend(path):
    bpy.ops.wm.save_as_mainfile(filepath=path)
    print("BLEND", path)


def setup_render(cam_loc, cam_target, res=(1280, 720), engine=None, samples=64, hdri_strength=0.0):
    sc = bpy.context.scene
    cam_data = bpy.data.cameras.new("prevCam")
    cam_data.lens = 35
    cam = bpy.data.objects.new("prevCam", cam_data)
    link(cam)
    cam.location = cam_loc
    d = Vector(cam_target) - Vector(cam_loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    # view transform
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception as e:
        print("view transform fail", e)
    sc.view_settings.exposure = 0.0
    engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    print("ENGINES", engines)
    if engine is None:
        engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else engines[0]
    sc.render.engine = engine
    try:
        sc.eevee.taa_render_samples = samples
        sc.eevee.use_raytracing = True
    except Exception as e:
        print("eevee cfg", e)
    return cam


def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)
