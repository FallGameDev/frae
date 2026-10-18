"""
weddy_shirt.py
Gives Toy Weddy a shirt over her chest (the metaball blobs), with the
bottom of the blobs still showing below it.

  pip install bpy
  python3 tools/weddy_shirt.py          (then python3 tools/face_toys.py to export)

What it does (in models/toys_rigged.blend):
  1. copies the chest's shape ("Toy Weddy Chest"), puffs it out a little
     and cuts the bottom off  ->  "Toy Weddy Shirt"
  2. gives it the same setup as the chest: Armature modifier (Toy Weddy Rig,
     all on the Bust bone) and then the Lattice modifier (Toy Weddy Chest
     Lattice, the soft body one). So in Blender both wobble together with the
     lattice, and in the game both follow the Bust bone wobble in her animations.
  3. saves the .blend
Running it again replaces the old shirt (safe to rerun after updating Weddy).
"""
import os
import bpy
import bmesh

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(os.path.dirname(HERE), 'models', 'toys_rigged.blend')

SHIRT_COLOR = None                      # None = the same pink as her body (Toy Weddy Upper); or (r, g, b, 1) linear
PUFF = 0.028                            # how far the shirt sits out from the chest (meters)
SHOW = 0.07                             # how much of the blobs' height shows below the shirt (0..1, from the bottom): just the very bottom


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    chest = bpy.data.objects['Toy Weddy Chest']
    rig = bpy.data.objects['Toy Weddy Rig']
    lattice = bpy.data.objects['Toy Weddy Chest Lattice']

    # an old shirt goes first
    old = bpy.data.objects.get('Toy Weddy Shirt')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)

    # 1. the shape: the chest's own mesh, puffed out along its normals, bottom cut away
    bm = bmesh.new()
    bm.from_mesh(chest.data)
    # the blob mesh has a few tiny gaps (they show as dark specks): weld and patch them
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
    bmesh.ops.holes_fill(bm, edges=bm.edges, sides=12)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    zs = [v.co.z for v in bm.verts]
    cut = min(zs) + (max(zs) - min(zs)) * SHOW
    for v in bm.verts:
        v.co += v.normal * PUFF
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < cut], context='VERTS')
    me = bpy.data.meshes.new('Toy Weddy Shirt')
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True

    # the shirt's color (both sides drawn, so the open bottom never looks see-through)
    mat = bpy.data.materials.get('Toy Weddy Shirt') or bpy.data.materials.new('Toy Weddy Shirt')
    mat.use_nodes = True
    mat.use_backface_culling = False
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    color = SHIRT_COLOR
    if color is None:                                    # her body's pink
        body = bpy.data.objects['Toy Weddy Body']
        upper = next(m for m in body.data.materials if m and 'Upper' in m.name)
        color = tuple(next(n for n in upper.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value)
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = 0.85        # cloth, not shiny plastic
    me.materials.append(mat)

    shirt = bpy.data.objects.new('Toy Weddy Shirt', me)
    for c in chest.users_collection:
        c.objects.link(shirt)
    # same place and parent as the chest
    shirt.parent = chest.parent
    shirt.parent_type = chest.parent_type
    shirt.matrix_parent_inverse = chest.matrix_parent_inverse.copy()
    shirt.matrix_basis = chest.matrix_basis.copy()

    # 2. all of it rides on the Bust bone (like the chest), then the lattice on top
    g = shirt.vertex_groups.new(name='Bust')
    g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    arm = shirt.modifiers.new('Armature', 'ARMATURE')
    arm.object = rig
    lat = shirt.modifiers.new('Lattice', 'LATTICE')
    lat.object = lattice

    # 3. save
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    print('shirt:', len(me.vertices), 'points, cut at z', round(cut, 3), '| chest modifiers:',
          [m.type for m in chest.modifiers], '| shirt modifiers:', [m.type for m in shirt.modifiers])


main()
