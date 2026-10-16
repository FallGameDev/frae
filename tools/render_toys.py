"""
render_toys.py
Renders Aidan's rigged 3D toys (models/toys/toys_rigged.blend) into the
pictures Tape 2 uses for the toy characters.

  pip install bpy
  python3 tools/render_toys.py

Writes (see-through PNGs) to tools/tape2/characters/:
  tfreddy.png  tbonnie.png  tchica.png      standing, arms down (cameras, hall, posters...)
  tfreddy-lunge.png ...                      reaching for you (in the office, jumpscares)
  mangle.png  mangle-lunge.png               Toy Endo, bent and broken (Mangled Endo)
and the turning toy for the loading screens to tools/tape2/turntable.png
(a strip of frames side by side).

The build (tools/build_game2.py) then places these exactly like the 2D
character files: anything named <role>.png wins over <role>.svg.
"""
import math, os, sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC = os.path.join(REPO, 'models', 'toys', 'toys_rigged.blend')
OUT = os.path.join(HERE, 'tape2', 'characters')
TOYS = {'tfreddy': 'Toy Eddy', 'tbonnie': 'Toy Weddy', 'tchica': 'Toy Cheddy', 'mangle': 'Toy Endo'}
R = math.radians

# Poses: bone -> (x, y, z) rotation in degrees (bone's own axes)
POSES = {
    'stand': {'UpperArm.L': (-78, 0, 0), 'UpperArm.R': (-78, 0, 0), 'Head': (0, 6, 0), 'Hand.L': (0, 0, 0)},
    'lunge': {'UpperArm.L': (-12, 0, -88), 'UpperArm.R': (-12, 0, 88), 'Chest': (-14, 0, 0), 'Head': (-12, -10, 0),
              'Ear.L': (0, -20, 0), 'Ear.R': (0, 20, 0), 'Leg.L': (18, 0, 0), 'Leg.R': (-12, 0, 0)},
    # Mangled Endo: twisted head, one arm wrenched up, one hanging, legs splayed
    'broken': {'UpperArm.L': (40, 0, 30), 'UpperArm.R': (-88, 0, 0), 'Head': (25, 35, 18), 'Chest': (8, 10, 6),
               'Ear.L': (0, -55, 0), 'Ear.R': (0, 70, 30), 'Leg.L': (0, 25, 0), 'Leg.R': (30, -15, 0), 'Hand.L': (60, 0, 0)},
    'brokenlunge': {'UpperArm.L': (-10, 0, -75), 'UpperArm.R': (-30, 0, 85), 'Chest': (-18, 6, 0), 'Head': (-15, 30, 25),
                    'Ear.L': (0, -55, 0), 'Ear.R': (0, 70, 30), 'Leg.L': (20, 20, 0)},
}


def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.35, 0.35, 0.4, 1)
    bg.inputs[1].default_value = 0.6
    for o in list(bpy.data.objects):
        if o.type == 'LIGHT':
            bpy.data.objects.remove(o, do_unlink=True)
    # key, fill and rim lights (like a stage spotlight from above the camera)
    for name, loc, energy, size in (('Key', (-2.5, -4, 4.5), 650, 2.5), ('Fill', (3.5, -3, 2.0), 200, 3.0),
                                    ('Rim', (0.5, 4, 3.5), 600, 1.5)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy, ld.size = energy, size
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.location = loc
        direction = Vector((0, 0, 1.2)) - Vector(loc)
        lo.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    return sc


def show_only(name):
    """Only one toy visible, standing at the middle."""
    for col in bpy.data.collections:
        if col.name in TOYS.values():
            vis = col.name == name
            col.hide_render = not vis
            for o in col.objects:
                o.hide_render = not vis
                if o.type == 'ARMATURE':
                    o.location = (0, 0, 0)


def pose(arm, which):
    for b in arm.pose.bones:
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (0, 0, 0)
    for bone, (x, y, z) in POSES[which].items():
        if bone in arm.pose.bones:
            arm.pose.bones[bone].rotation_euler = (R(x), R(y), R(z))
    bpy.context.view_layer.update()


def camera(sc, angle=0.0, height=1.35, dist=6.5, res=(700, 900), lens=55):
    cam = bpy.data.objects.get('Camera')
    a = R(angle)
    cam.location = (math.sin(a) * dist, -math.cos(a) * dist, height)
    look = Vector((0, 0, 1.12)) - cam.location
    cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100


def render(sc, path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def smooth_round_parts():
    """Round parts (head, ears, hands, arms, legs) shade smooth; the boxy ones stay sharp."""
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        for poly in o.data.polygons:
            poly.use_smooth = len(poly.vertices) != 4 or poly.area < 0.02


def main():
    bpy.ops.wm.open_mainfile(filepath=SRC)
    sc = setup_scene()
    smooth_round_parts()
    os.makedirs(OUT, exist_ok=True)
    arms = {c.name: next(o for o in c.objects if o.type == 'ARMATURE') for c in bpy.data.collections if c.name in TOYS.values()}
    for role, toy in TOYS.items():
        show_only(toy)
        arm = arms[toy]
        broken = role == 'mangle'
        pose(arm, 'broken' if broken else 'stand')
        camera(sc, angle=8)
        render(sc, os.path.join(OUT, f'{role}.png'))
        pose(arm, 'brokenlunge' if broken else 'lunge')
        camera(sc, angle=0, height=1.6, dist=5.2, res=(1000, 1290))
        render(sc, os.path.join(OUT, f'{role}-lunge.png'))
    # the loading screen: Toy Eddy turning around (one strip of frames)
    show_only('Toy Eddy')
    pose(arms['Toy Eddy'], 'stand')
    frames = 16
    tmp = []
    sc.cycles.samples = 24
    for i in range(frames):
        camera(sc, angle=i * 360 / frames, res=(200, 260), dist=4.6)
        p = os.path.join(OUT, f'_turn{i:02d}.png')
        render(sc, p)
        tmp.append(p)
    from PIL import Image
    ims = [Image.open(p) for p in tmp]
    strip = Image.new('RGBA', (200 * frames, 260))
    for i, im in enumerate(ims):
        strip.paste(im, (i * 200, 0))
    strip.save(os.path.join(HERE, 'tape2', 'turntable.png'))
    for p in tmp:
        os.remove(p)
    print('rendered toys to', OUT)


main()
