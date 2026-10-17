"""
convert_models.py
Browsers can't open .blend files, so this turns every .blend in the
models folder into .glb files the games can load.

  pip install bpy
  python3 tools/convert_models.py            (every .blend in models/)
  python3 tools/convert_models.py some.blend (just that one)

One character per .blend: models/withered_eddy.blend -> models/withered_eddy.glb
Several characters in one .blend (one collection each, like toys_rigged.blend):
each collection becomes its own file, named after the collection
("Toy Eddy" -> toy_eddy.glb).

File names the game looks for: see ACTOR_FILES in tools/tape2/actors.js
(toy_eddy, withered_weddy, balloon_kid, the_puppet, golden_eddie ...).
"""
import os, re, sys
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(os.path.dirname(HERE), 'models')


def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')


def export(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.hide_set(False)
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_skins=True, export_animations=False, export_apply=False)
    print('  wrote', os.path.relpath(path, os.path.dirname(MODELS)))


def convert(blend):
    print(os.path.basename(blend))
    bpy.ops.wm.open_mainfile(filepath=blend)
    top = [c for c in bpy.context.scene.collection.children
           if any(o.type == 'MESH' for o in c.all_objects)]
    out_dir = os.path.dirname(blend)
    if len(top) > 1:
        for c in top:
            export(os.path.join(out_dir, slug(c.name) + '.glb'), list(c.all_objects))
    else:
        objs = [o for o in bpy.context.scene.objects if o.type in ('MESH', 'ARMATURE', 'EMPTY')]
        export(os.path.join(out_dir, os.path.splitext(os.path.basename(blend))[0] + '.glb'), objs)


if __name__ == '__main__':
    files = sys.argv[1:] or sorted(os.path.join(MODELS, f) for f in os.listdir(MODELS) if f.endswith('.blend'))
    for f in files:
        convert(os.path.abspath(f))
