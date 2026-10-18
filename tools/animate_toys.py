"""
animate_toys.py
The toys' animations, made on their skeleton in models/toys_rigged.blend:

  Idle   (2 s loop)  breathing, head tilting, arms swaying (Meyg twitches)
  Crawl  (2 s loop)  lying on its front in a vent, head up, pulling itself along
  Walk   (2 s loop)  a slow, lurching walk (coming down the hall)
  Scare  (jumpscare, played when a toy gets you)
         Toy Eddy    lunges at you while his head spins all the way round
         Toy Weddy   lunges chest-first into you. Her chest has NO keyframes: in
                     Blender the soft body lattice does all the wobbling; the
                     game runs its own spring physics on her "Bust" bone
                     (actors.js, jiggle) the same way
         Toy Cheddy  comes up from below and strangles you (hands at your neck, shaking)
         Meyg        twisted and broken, she reaches up and covers the camera with her hand

  pip install bpy
  python3 tools/animate_toys.py
  python3 tools/face_toys.py        (faces + export .glb/.fbx with the animations)

Bone turns are in degrees, in each bone's own axes (like Blender's pose mode).
The toys look toward -Y, so moving toward the player = -Y.
"""
import math, os
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(os.path.dirname(HERE), 'models', 'toys_rigged.blend')
FPS = 24
HOME = {}                  # each rig's own spot (moves are measured from here)
R = math.radians
FREE = {'Bust'}            # bones that never get keyframes (moved by physics instead)

STAND = {'UpperArm.L': (-78, 0, 0), 'UpperArm.R': (-78, 0, 0), 'Head': (0, 6, 0)}
BROKEN = {'UpperArm.L': (40, 0, 30), 'UpperArm.R': (-88, 0, 0), 'Head': (12, 14, 12), 'Chest': (8, 10, 6),
          'Ear.L': (0, -55, 0), 'Ear.R': (0, 70, 30), 'Leg.L': (0, 25, 0), 'Leg.R': (30, -15, 0), 'Hand.L': (60, 0, 0)}
REACH = {'UpperArm.L': (-12, 0, -88), 'UpperArm.R': (-12, 0, 88)}       # both arms straight at you


def clear(rig):
    for b in rig.pose.bones:
        b.rotation_mode = 'XYZ'
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)


def key(rig, frame, pose, loc=None, scale=None):
    """Keyframe a whole pose ({bone: (x, y, z) degrees}) at a frame; loc = where the toy stands (x, y, z)."""
    for b in rig.pose.bones:
        if b.name in FREE:                    # left to physics (the lattice / the game's jiggle)
            continue
        x, y, z = pose.get(b.name, (0, 0, 0))
        b.rotation_euler = (R(x), R(y), R(z))
        b.keyframe_insert('rotation_euler', frame=frame)
        s = (scale or {}).get(b.name, (1, 1, 1))
        b.scale = s
        b.keyframe_insert('scale', frame=frame)
    if loc is not None:
        # the whole toy moves with its Root bone (object moves don't survive the export)
        from mathutils import Vector
        root = rig.pose.bones['Root']
        d = Vector(loc) - Vector(HOME[rig.name])
        root.location = root.bone.matrix_local.to_3x3().inverted() @ d
        root.keyframe_insert('location', frame=frame)


def mix(*poses):
    """Add poses together (bone by bone)."""
    out = {}
    for p in poses:
        for k, v in p.items():
            o = out.get(k, (0, 0, 0))
            out[k] = (o[0] + v[0], o[1] + v[1], o[2] + v[2])
    return out


def new_action(rig, name):
    act = bpy.data.actions.new(f'{rig.name.replace(" Rig", "")} {name}')
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    return act


def finish(rig, act, start, end, cyclic=False):
    for fc in getattr(act, 'fcurves', []) or []:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
    rig.animation_data.action = None
    tr = rig.animation_data.nla_tracks.new()
    tr.name = act.name
    st = tr.strips.new(act.name, int(start), act)
    st.action_frame_start, st.action_frame_end = start, end
    tr.mute = True                                # (only stored here; the game and engines pick them by name)


def bust(rig, pose, t, kind):
    """(Toy Weddy's chest used to get a hand-made wobble here. Now physics does it: the soft body
    lattice in Blender, spring physics on the Bust bone in the game. Kept so the calls still work.)"""
    return None


def idle(rig, broken=False, phase=0.0):
    act = new_action(rig, 'Idle')
    base = BROKEN if broken else STAND
    n = 2 * FPS
    for i in range(0, n + 1, 4):
        t = (i / n + phase) % 1
        s, c = math.sin(2 * math.pi * t), math.cos(2 * math.pi * t)
        wob = {'Chest': (2.5 * s, 0, 0), 'Head': (2 * c, 0, 6 * s),
               'UpperArm.L': (3 * s, 0, 2 * c), 'UpperArm.R': (3 * s, 0, -2 * c)}
        if broken:   # Meyg twitches: a sharp jerk of the head now and then
            jerk = 12 if 0.45 < t < 0.5 else 0
            wob['Head'] = (wob['Head'][0] + jerk, wob['Head'][1] - jerk, wob['Head'][2])
        p = mix(base, wob)
        key(rig, 1 + i, p, None, bust(rig, p, t, 'idle'))
    finish(rig, act, 1, 1 + n, cyclic=True)


def crawl(rig, broken=False, phase=0.0):
    """Lying down in a vent: on its belly, head up looking at you, pulling itself along (loop)."""
    act = new_action(rig, 'Crawl')
    n = 2 * FPS
    x, y, z = HOME[rig.name]
    for i in range(0, n + 1, 4):
        t = (i / n + phase) % 1
        s, c = math.sin(2 * math.pi * t), math.cos(2 * math.pi * t)
        p = {'Root': (88, 0, 3 * s),                                    # tipped over onto its front (head toward you)
             'Head': (-62 + 4 * c, 0, 8 * s),                           # looking up at you
             'Chest': (4 * c, 0, 0),
             'UpperArm.L': (68 + 18 * s, 0, -18 - 10 * s),              # arms out in front, pulling in turn
             'UpperArm.R': (68 - 18 * s, 0, 18 - 10 * s),
             'Leg.L': (12 * s, 0, 0), 'Leg.R': (-12 * s, 0, 0)}
        if broken:
            p['Head'] = (p['Head'][0] - 10, 25, 12 + (14 if 0.45 < t < 0.5 else 0))
            p['Ear.L'], p['Ear.R'] = (0, -55, 0), (0, 70, 30)
        key(rig, 1 + i, p, (x, y, z + 0.18), bust(rig, p, t, 'crawl'))  # (lifted a little: lying on its front)
    finish(rig, act, 1, 1 + n, cyclic=True)


def walk(rig, broken=False, phase=0.0):
    """Coming down the hall: a slow, heavy, lurching walk on the spot (loop)."""
    act = new_action(rig, 'Walk')
    n = 2 * FPS
    x, y, z = HOME[rig.name]
    base = BROKEN if broken else STAND
    for i in range(0, n + 1, 3):
        t = (i / n + phase) % 1
        s, c = math.sin(2 * math.pi * t), math.cos(2 * math.pi * t)
        lurch = {'Leg.L': (24 * s, 0, 0), 'Leg.R': (-24 * s, 0, 0),
                 'UpperArm.L': (-14 * s, 0, 0), 'UpperArm.R': (14 * s, 0, 0),
                 'Chest': (-6, 0, 5 * s), 'Head': (-4 + 3 * abs(c), 0, -6 * s)}
        p = mix(base, lurch)
        key(rig, 1 + i, p, (x, y, z + 0.04 * abs(c)), bust(rig, p, t, 'walk'))
    finish(rig, act, 1, 1 + n, cyclic=True)


def scare_eddy(rig, home):
    act = new_action(rig, 'Scare')
    x, y, z = home
    key(rig, 1, mix(STAND, {'Chest': (8, 0, 0)}), (x, y, z))                          # rears back
    key(rig, 6, mix(STAND, {'Chest': (14, 0, 0), 'Head': (10, 0, 0)}), (x, y + 0.15, z))
    for f, spin, dist in ((10, 90, -0.8), (14, 180, -1.5), (18, 270, -2.0), (22, 360, -2.25)):
        key(rig, f, mix(REACH, {'Chest': (-14, 0, 0), 'Head': (-12, spin, 0), 'Leg.L': (18, 0, 0), 'Leg.R': (-12, 0, 0)}),
            (x, y + dist, z))
    key(rig, 28, mix(REACH, {'Chest': (-18, 0, 0), 'Head': (-16, 368, 4)}), (x, y - 2.3, z))
    finish(rig, act, 1, 28)


def scare_weddy(rig, home):
    act = new_action(rig, 'Scare')
    x, y, z = home
    back = {'UpperArm.L': (-60, 0, 35), 'UpperArm.R': (-60, 0, -35)}                  # arms swung back
    key(rig, 1, mix(STAND, {}), (x, y, z))
    key(rig, 6, mix(back, {'Chest': (12, 0, 0), 'Head': (8, 0, 0)}), (x, y + 0.1, z))
    key(rig, 14, mix(back, {'Chest': (16, 0, 0), 'Head': (-6, 0, 0)}), (x, y - 1.9, z))
    # impact: she stops dead (the chest's wobble comes from the physics)
    key(rig, 16, mix(back, {'Chest': (14, 0, 0), 'Head': (-8, 0, 4)}), (x, y - 2.05, z))
    key(rig, 27, mix(back, {'Chest': (14, 0, 0), 'Head': (-8, 0, 4)}), (x, y - 2.05, z))
    finish(rig, act, 1, 27)


def scare_cheddy(rig, home):
    act = new_action(rig, 'Scare')
    x, y, z = home
    up = mix(REACH, {'Chest': (-20, 0, 0), 'Head': (-14, 0, 0)})
    key(rig, 1, up, (x, y - 1.7, z - 1.5))                                             # below you, out of sight
    key(rig, 8, up, (x, y - 1.8, z - 0.5))                                             # comes up...
    key(rig, 12, up, (x, y - 1.9, z - 0.05))
    # ...hands close in on your neck, and shake
    grab = mix({'UpperArm.L': (-14, 0, -62), 'UpperArm.R': (-14, 0, 62)}, {'Chest': (-22, 0, 0), 'Head': (-18, 0, 0)})
    for i, f in enumerate(range(15, 33, 2)):
        j = 5 if i % 2 else -5
        key(rig, f, mix(grab, {'Chest': (0, 0, j), 'Head': (0, j * 1.4, -j)}), (x + j * 0.004, y - 2.0, z - 0.02))
    finish(rig, act, 1, 31)


def scare_meyg(rig, home):
    act = new_action(rig, 'Scare')
    x, y, z = home
    key(rig, 1, BROKEN, (x, y, z))
    key(rig, 8, mix(BROKEN, {'Head': (-10, 20, 6)}), (x, y - 1.2, z))
    # her raised hand swings round at the camera and covers it
    cover = dict(BROKEN)
    cover['UpperArm.L'] = (30, 0, -70)
    cover['Hand.L'] = (0, 0, 0)
    key(rig, 13, mix(cover, {'Head': (-14, 24, 8)}), (x, y - 1.75, z))
    cover2 = dict(BROKEN)
    cover2['UpperArm.L'] = (24, 0, -108)
    cover2['Hand.L'] = (0, 0, 0)
    key(rig, 18, mix(cover2, {'Head': (-16, 26, 8)}), (x, y - 2.0, z))
    key(rig, 26, mix(cover2, {'Head': (-18, 30, 10)}), (x, y - 2.05, z))
    finish(rig, act, 1, 26)


def add_bust_bone(rig, chest_obj):
    """Toy Weddy: a Bust bone in front of the Chest, and the chest mesh follows it (so it can wobble anywhere)."""
    if 'Bust' in rig.data.bones:
        return
    bpy.context.view_layer.objects.active = rig
    for o in bpy.context.selected_objects:
        o.select_set(False)
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones.new('Bust')
    eb.head = (0.0, -0.05, 1.3)
    eb.tail = (0.0, -0.42, 1.3)
    eb.roll = 0
    eb.parent = rig.data.edit_bones['Chest']
    eb.use_deform = True
    bpy.ops.object.mode_set(mode='OBJECT')
    g = chest_obj.vertex_groups.get('Chest')
    if g:
        g.name = 'Bust'


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    bpy.context.scene.render.fps = FPS
    for a in [a for a in bpy.data.actions if a.name.endswith((' Idle', ' Scare', ' Crawl', ' Walk'))]:
        bpy.data.actions.remove(a)
    toys = {'Toy Eddy': (scare_eddy, False, 0.0), 'Toy Weddy': (scare_weddy, False, 0.3),
            'Toy Cheddy': (scare_cheddy, False, 0.6), 'Toy Endo': (scare_meyg, True, 0.15)}
    for name, (scare, broken, phase) in toys.items():
        rig = bpy.data.objects[name + ' Rig']
        if rig.animation_data:
            for tr in list(rig.animation_data.nla_tracks):
                rig.animation_data.nla_tracks.remove(tr)
        if name == 'Toy Weddy':
            add_bust_bone(rig, bpy.data.objects['Toy Weddy Chest'])
        home = tuple(rig.location)
        HOME[rig.name] = home
        clear(rig)
        idle(rig, broken, phase)
        clear(rig)
        crawl(rig, broken, phase)
        clear(rig)
        walk(rig, broken, phase)
        clear(rig)
        scare(rig, home)
        clear(rig)
        rig.location = home
        print('animated', name)
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)


main()
