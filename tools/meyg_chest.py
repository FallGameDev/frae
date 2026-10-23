"""
meyg_chest.py
Gives Meyg (Toy Endo) an actual chest to go with her Bust bone (bust_bones.py
put the bone and the vertex-group split in place, but there was nothing
shaped to see wobble yet): a copy of Toy Weddy's chest-blob mesh, recolored
to Meyg's own white instead of Weddy's pink, bound to Meyg's Bust bone.

  pip install bpy
  python3 tools/meyg_chest.py        (then python3 tools/face_toys.py to export)

Running it again replaces the old copy (safe to rerun).
"""
import os
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(os.path.dirname(HERE), 'models', 'toys_rigged.blend')


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    src = bpy.data.objects['Toy Weddy Chest']
    weddy_rig = bpy.data.objects['Toy Weddy Rig']
    rig = bpy.data.objects['Toy Endo Rig']
    body = bpy.data.objects['Toy Endo Body']

    old = bpy.data.objects.get('Toy Endo Chest')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)

    me = src.data.copy()
    me.name = 'Toy Endo Chest'
    chest = bpy.data.objects.new('Toy Endo Chest', me)
    for c in body.users_collection:
        c.objects.link(chest)

    # Weddy's chest mesh is baked at HER rig's own scene spot (its matrix_world is identity
    # only because its matrix_parent_inverse cancels her rig's offset; the spot itself is
    # baked into the vertex data). Copying it straight across would leave it sitting at
    # Weddy's spot, not Meyg's (her rig stands somewhere else entirely) -- so first move it
    # the same distance and direction that separates the two rigs, *then* do the same
    # parent-inverse cancelling trick relative to Meyg's own rig.
    chest.matrix_basis = rig.matrix_world @ weddy_rig.matrix_world.inverted() @ src.matrix_world
    chest.parent = rig
    chest.matrix_parent_inverse = rig.matrix_world.inverted()

    # her own color, not Weddy's pink: the white of her own suit ("Upper" material)
    mat = next((m for m in body.data.materials if m and 'Upper' in m.name), None)
    me.materials.clear()
    if mat:
        me.materials.append(mat)
    for p in me.polygons:
        p.material_index = 0

    # follows the Bust bone (bust_bones.py already put it on her rig); no lattice needed
    # in the game (the bone itself gets spring physics there, same as Weddy's)
    for m in list(chest.modifiers):
        chest.modifiers.remove(m)
    arm = chest.modifiers.new('Armature', 'ARMATURE')
    arm.object = rig
    chest.vertex_groups.clear()
    g = chest.vertex_groups.new(name='Bust')
    g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')

    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    print('Meyg chest:', len(me.vertices), 'points | modifiers:', [m.type for m in chest.modifiers],
          '| material:', me.materials[0].name if me.materials else None, '| world:', chest.matrix_world.translation)


main()
