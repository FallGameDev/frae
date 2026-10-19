"""
weddy_softbody.py
Sets up Toy Weddy's chest lattice soft body (Blender only; the game runs
its own spring physics on the Bust bone, see actors.js "jiggle").

  pip install bpy
  python3 tools/weddy_softbody.py

What it does (models/toys_rigged.blend, "Toy Weddy Chest Lattice"):
  - NO collision: the soft body only collides with the objects in an empty
    collection ("Toy Weddy No Collision"), so it can never hit her torso or
    anything else, even if something gets a Collision modifier later.
    Self collision and edge / face collision stay off.
  - detached from the torso: only the back row of the lattice (against her
    torso) is pinned; the middle and the front swing freely (goal weights
    BACK / MIDDLE / FRONT below). Before this every point had goal 1.0,
    which pins everything and stops the lattice from moving at all.
  - no keyframes on the lattice or the Bust bone (animate_toys.py skips Bust).
Rerun it any time (it replaces its own settings).
"""
import os
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND = os.path.join(os.path.dirname(HERE), 'models', 'toys_rigged.blend')
LATTICE = 'Toy Weddy Chest Lattice'
BODY = 'Toy Weddy Body'

BACK, MIDDLE, FRONT = 1.0, 0.88, 0.74       # goal weights: 1 = stuck to the chest, lower = more jiggle
SPRING, FRICTION, DAMPING = 0.75, 6.0, 8.0  # how fast the front springs back and settles
GRAVITY = 2.0                               # a little sag only (9.8 makes it droop)


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    lat = bpy.data.objects[LATTICE]
    body = bpy.data.objects[BODY]
    sbm = next(m for m in lat.modifiers if m.type == 'SOFT_BODY')
    sb = sbm.settings

    # --- no collision with anything ---
    none = bpy.data.collections.get('Toy Weddy No Collision') or bpy.data.collections.new('Toy Weddy No Collision')
    for o in list(none.objects):
        none.objects.unlink(o)
    sb.collision_collection = none
    sb.use_self_collision = False
    sb.use_edge_collision = False
    sb.use_face_collision = False
    for m in [m for m in body.modifiers if m.type == 'COLLISION']:
        body.modifiers.remove(m)

    # --- pin only the side against the torso ---
    # the toys face -Y, so the torso is on the +Y side of the lattice (in the world)
    pts = lat.data.points
    ys = [(lat.matrix_world @ p.co).y for p in pts]
    lo, hi = min(ys), max(ys)
    g = lat.vertex_groups.get('Goal') or lat.vertex_groups.new(name='Goal')
    for i, y in enumerate(ys):
        t = (y - lo) / ((hi - lo) or 1)                 # 0 = front, 1 = back (torso)
        w = BACK if t > 0.75 else MIDDLE if t > 0.25 else FRONT
        g.add([i], w, 'REPLACE')
    sb.use_goal = True
    sb.vertex_group_goal = g.name
    sb.goal_min, sb.goal_max, sb.goal_default = 0.0, 1.0, 1.0
    sb.goal_spring, sb.goal_friction, sb.damping = SPRING, FRICTION, DAMPING
    sb.gravity = GRAVITY
    sb.use_edges = True
    sbm.point_cache.frame_start, sbm.point_cache.frame_end = 1, 1000

    # --- nothing keyframed on the lattice ---
    if lat.animation_data:
        lat.animation_data_clear()

    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    print('soft body: goal weights', sorted({round(w, 2) for w in (BACK, MIDDLE, FRONT)}),
          '| collides with:', none.name, '(empty) | points', len(pts))


main()
