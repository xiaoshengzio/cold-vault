import bpy, sys, os, addon_utils
print("BPY", bpy.app.version_string)
print("ADDONS:", sorted([m.__name__ for m in addon_utils.modules()])[:40])
# is gltf exporter available?
try:
    bpy.ops.wm.read_factory_settings(use_empty=True)
except Exception as e:
    print("reset err", e)
bpy.ops.mesh.primitive_cube_add(size=1)
ob = bpy.context.active_object
mat = bpy.data.materials.new("M")
mat.use_nodes = True
ob.data.materials.append(mat)
out = os.path.join(os.path.dirname(bpy.data.filepath) or "C:/工作区/Projects/个人站·冷库/assets_src", "probe.glb")
try:
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
    print("EXPORT_OK", out, os.path.getsize(out))
except Exception as e:
    print("EXPORT_FAIL", repr(e))
print("DONE")
