"""
bust_bones.py
Makes Toy Weddy's Bust bone smaller and sit lower on her chest, and gives
Meyg (Toy Endo) the same Bust bone: in the game, any bone named Bust (or
Jiggle/Breast) gets spring physics instead of keyframes (actors.js,
JIGGLE_BONE), so this is all it takes for Meyg's chest to jiggle too.

  pip install bpy
  python3 tools/bust_bones.py        (then python3 tools/face_toys.py to export)

What it does (in models/toys_rigged.blend):
  1. Toy Weddy: resizes/repositions her existing Bust bone (smaller, lower
     on the chest). Her chest-blob mesh ("Toy Weddy Chest") and shirt
     already follow it, so nothing else needs to change for her.
  2. Toy Endo (Meyg): adds the same Bust bone to her rig. She has no
     separate chest-blob mesh like Weddy, so instead her own Body mesh's
     "Chest" vertex group (already 100%-weighted and split from "Hips" at
     the waist by rig_toys.py) is renamed to "Bust" and follows the new
     bone instead.
Running it again is safe: it resizes the bone if it already exists rather
than making a second one.
"""
import os
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(os.path.dirname(HERE), 'models', 'toys_rigged.blend')

# smaller (was head (0, -0.05, 1.3) -> tail (0, -0.42, 1.3): 0.37 long) and lower on the chest
HEAD = (0.0, -0.04, 1.18)
TAIL = (0.0, -0.26, 1.18)


def set_bust_bone(rig, chest_obj, source_group='Chest'):
    """Creates the Bust bone if missing, otherwise just resizes/repositions it; then makes
    chest_obj's chest-area mesh follow it (renaming its vertex group to "Bust" if needed)."""
    bpy.context.view_layer.objects.active = rig
    for o in bpy.context.selected_objects:
        o.select_set(False)
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones.get('Bust')
    if eb is None:
        eb = rig.data.edit_bones.new('Bust')
        eb.parent = rig.data.edit_bones['Chest']
        eb.use_deform = True
        eb.roll = 0
    eb.head, eb.tail = HEAD, TAIL
    bpy.ops.object.mode_set(mode='OBJECT')
    g = chest_obj.vertex_groups.get(source_group)
    if g:
        g.name = 'Bust'


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)

    weddy = bpy.data.objects['Toy Weddy Rig']
    set_bust_bone(weddy, bpy.data.objects['Toy Weddy Chest'])

    endo = bpy.data.objects['Toy Endo Rig']
    endo_body = bpy.data.objects['Toy Endo Body']
    set_bust_bone(endo, endo_body)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    print('Weddy Bust bone head/tail:', tuple(round(c, 3) for c in weddy.data.bones['Bust'].head_local),
          tuple(round(c, 3) for c in weddy.data.bones['Bust'].tail_local))
    print('Endo (Meyg) has Bust bone:', 'Bust' in endo.data.bones,
          '| Endo Body groups:', [vg.name for vg in endo_body.vertex_groups])


main()
