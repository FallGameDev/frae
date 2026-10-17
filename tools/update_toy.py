"""
update_toy.py
Puts Aidan's updated toy (.blend) into models/toys_rigged.blend, replacing that toy.

  pip install bpy
  python3 tools/update_toy.py path/to/updated.blend "Toy Weddy"
  python3 tools/face_toys.py            (faces back on, export .glb/.fbx again)

New parts that aren't attached to the skeleton (a top, a chest made of
metaballs...) are turned into meshes if needed, faced outward, and made to
follow the Chest bone. Materials nothing uses are dropped.
"""
import bpy
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(os.path.dirname(HERE), 'models', 'toys_rigged.blend')
SRC = os.path.abspath(sys.argv[1])
TOY = sys.argv[2] if len(sys.argv) > 2 else 'Toy Weddy'
bpy.ops.wm.open_mainfile(filepath=BLEND)
col = bpy.data.collections[TOY]
for o in list(col.all_objects):
    bpy.data.objects.remove(o, do_unlink=True)
for d in (bpy.data.meshes, bpy.data.armatures):
    for x in list(d):
        if x.users == 0: d.remove(x)
with bpy.data.libraries.load(SRC, link=False) as (src, dst):
    dst.objects = [n for n in src.objects]
rig = None
for o in dst.objects:
    if o is None: continue
    col.objects.link(o)
    if o.type == 'ARMATURE': rig = o
print('rig', rig.name, [o.name for o in col.objects])
# metaballs (the chest): turn them into one smooth mesh (browsers and other engines can't use metaballs)
balls = [o for o in col.objects if o.type == 'META']
if balls:
    for mb in bpy.data.metaballs: mb.resolution = mb.render_resolution
    base = next(o for o in balls if '.' not in o.name) if any('.' not in o.name for o in balls) else balls[0]
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(base.evaluated_get(dg))
    me.name = 'Toy Weddy Chest'
    chest = bpy.data.objects.new('Toy Weddy Chest', me)
    chest.matrix_basis = base.matrix_basis.copy()
    col.objects.link(chest)
    # same pink as her shirt (the chest's own first material had nothing plugged in, so it showed black)
    body = next(o for o in col.objects if o.type == 'MESH' and o.name.endswith('Body'))
    shirt = next(m for m in body.data.materials if m and 'Upper' in m.name)
    me.materials.clear(); me.materials.append(shirt)
    for p in me.polygons: p.material_index = 0
    for o in balls: bpy.data.objects.remove(o, do_unlink=True)
    print('metaballs -> mesh', len(me.vertices), [m.name for m in me.materials])
# the new top and chest: follow the Chest bone (they weren't attached to the skeleton)
for o in list(col.objects):
    if o.type != 'MESH' or o.parent == rig: continue
    mw = o.matrix_basis.copy()               # (no parent: its own place/turn/size is where it is)
    o.data.transform(mw, shape_keys=True)   # bake their scale/place into the mesh (and its shape keys)
    print('shape keys', o.data.shape_keys and len(o.data.shape_keys.key_blocks))
    o.matrix_world.identity()
    o.vertex_groups.clear()
    g = o.vertex_groups.new(name='Chest')
    g.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    for m in list(o.modifiers):
        if m.type == 'ARMATURE': o.modifiers.remove(m)
    mod = o.modifiers.new('Armature', 'ARMATURE'); mod.object = rig
    o.parent = rig
    o.matrix_parent_inverse = rig.matrix_basis.inverted()
    # a mirrored (negative) size turns the faces inside out: point them outward again
    import bmesh
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth = True
    print('attached', o.name, len(o.data.vertices))
# drop materials/images nothing uses (from the extra assets in the file)
for m in list(bpy.data.materials):
    if m.users == 0: bpy.data.materials.remove(m)
for i in list(bpy.data.images):
    if i.users == 0: bpy.data.images.remove(i)
bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
