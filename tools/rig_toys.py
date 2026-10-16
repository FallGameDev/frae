"""
rig_toys.py
Gives Aidan's base model an armature (skeleton) and makes one colored copy for each toy.

The model is made of separate parts (torso cube, arm/leg cylinders, hand spheres,
foot cubes, head sphere, two ear spheres). They are joined into one mesh called
"Body"; every part is weighted 100% to the bone that should move it, so nothing
stretches. The torso is split: its bottom follows Hips, its top follows Chest.

Bones (character faces -Y, so its LEFT is +X, Blender's usual .L/.R naming):
  Root > Hips > Chest > Head > Ear.L / Ear.R
                Chest > UpperArm.L > Hand.L,  UpperArm.R > Hand.R
         Hips > Leg.L > Foot.L,  Leg.R > Foot.R

Run:  python3 rig_toys.py basemodel.blend out_folder
"""
import sys, os, math
import bpy
from mathutils import Vector

src, out = sys.argv[-2], sys.argv[-1]

# ---- the toys: color for each material slot of the model (hex), roughness for the shiny toy look ----
TOYS = {
    "Toy Eddy":   {"Head": "#ffe639", "Hair": "#fffbdc", "Upper": "#fff766", "Lower": "#f2c818", "Hand": "#fffbdc"},
    "Toy Weddy":  {"Head": "#ecff00", "Hair": "#c4791f", "Upper": "#ffa6e2", "Lower": "#9966ff", "Hand": "#ffc4ec"},
    "Toy Cheddy": {"Head": "#ff9500", "Hair": "#ffe7c6", "Upper": "#ffbf66", "Lower": "#ffa11e", "Hand": "#ffe7c6"},
    "Toy Endo":   {"Head": "#f4f4f4", "Hair": "#ff8fc4", "Upper": "#ffffff", "Lower": "#ff8fc4", "Hand": "#f4f4f4"},
}

# which bone moves each part (object name in the original file)
PART_BONE = {
    "Sphere.002": "Head", "Sphere.003": "Ear.R", "Sphere.004": "Ear.L",
    "Cylinder": "UpperArm.L", "Cylinder.001": "UpperArm.R", "Sphere": "Hand.L", "Sphere.001": "Hand.R",
    "Cylinder.003": "Leg.L", "Cylinder.002": "Leg.R", "Cube.002": "Foot.L", "Cube.001": "Foot.R",
    "Cube": None,       # torso: split between Hips and Chest
}

# bone name: (head, tail, parent) in world space (the model stands on z = 0, T-pose)
BONES = {
    "Root":       ((0, 0, 0), (0, 0, 0.3), None),
    "Hips":       ((0, 0, 0.84), (0, 0, 1.08), "Root"),
    "Chest":      ((0, 0, 1.08), (0, 0, 1.50), "Hips"),
    "Head":       ((0, 0, 1.50), (0, 0, 2.05), "Chest"),
    "Ear.L":      ((0.30, 0, 1.95), (0.42, 0, 2.23), "Head"),
    "Ear.R":      ((-0.25, 0, 1.95), (-0.37, 0, 2.23), "Head"),
    "UpperArm.L": ((0.21, 0, 1.343), (0.80, 0, 1.343), "Chest"),
    "Hand.L":     ((0.80, 0, 1.343), (1.05, 0, 1.343), "UpperArm.L"),
    "UpperArm.R": ((-0.20, 0, 1.343), (-0.79, 0, 1.343), "Chest"),
    "Hand.R":     ((-0.79, 0, 1.343), (-1.05, 0, 1.343), "UpperArm.R"),
    "Leg.L":      ((0.118, 0, 0.84), (0.118, 0, 0.22), "Hips"),
    "Foot.L":     ((0.154, 0, 0.13), (0.154, -0.34, 0.13), "Leg.L"),
    "Leg.R":      ((-0.109, 0, 0.84), (-0.109, 0, 0.22), "Hips"),
    "Foot.R":     ((-0.132, 0, 0.13), (-0.132, -0.34, 0.13), "Leg.R"),
}


def hex_rgba(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]   # Blender wants linear colors
    return (*lin, 1.0)


def make_rig(name, location):
    """One armature + one joined, weighted mesh, from the parts in the original file."""
    # copy the parts so the original file objects are left alone
    parts = []
    for oname, bone in PART_BONE.items():
        o = bpy.data.objects[oname].copy()
        o.data = o.data.copy()
        bpy.context.scene.collection.objects.link(o)
        g = o.vertex_groups.new(name=bone or "Chest")
        if bone:
            g.add(range(len(o.data.vertices)), 1.0, "REPLACE")
        else:
            # the torso: bottom corners follow the hips, top corners the chest
            hips = o.vertex_groups.new(name="Hips")
            for v in o.data.vertices:
                z = (o.matrix_world @ v.co).z
                (hips if z < 1.1 else g).add([v.index], 1.0, "REPLACE")
        parts.append(o)
    # join into one mesh
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    body.name = f"{name} Body"
    body.data.name = f"{name} Body"

    # the armature
    arm_data = bpy.data.armatures.new(f"{name} Rig")
    arm = bpy.data.objects.new(f"{name} Rig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, (h, t, parent) in BONES.items():
        eb = arm_data.edit_bones.new(bname)
        eb.head, eb.tail = Vector(h), Vector(t)
        eb.roll = 0
        if parent:
            eb.parent = arm_data.edit_bones[parent]
            eb.use_connect = (Vector(h) - arm_data.edit_bones[parent].tail).length < 1e-4
    bpy.ops.object.mode_set(mode="OBJECT")
    arm_data.display_type = "STICK"
    arm.show_in_front = True

    body.parent = arm
    mod = body.modifiers.new("Armature", "ARMATURE")
    mod.object = arm

    # its own colored materials (shiny, like the toys)
    colors = TOYS[name]
    for i, slot in enumerate(body.material_slots):
        base = slot.material.name.split(".")[0]
        m = slot.material.copy()
        m.name = f"{name} {base}"
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        # the head had a blank (unsaved, all black) painted texture plugged in: unplug it so the color shows.
        # The texture node stays in the material, ready to plug back in once a face is painted and saved.
        for link in list(m.node_tree.links):
            if link.to_socket == bsdf.inputs["Base Color"]:
                m.node_tree.links.remove(link)
        bsdf.inputs["Base Color"].default_value = hex_rgba(colors.get(base, "#cccccc"))
        bsdf.inputs["Metallic"].default_value = 0.0                     # shiny plastic, not metal
        bsdf.inputs["Roughness"].default_value = 0.28
        if "Coat Weight" in bsdf.inputs:
            bsdf.inputs["Coat Weight"].default_value = 0.4
        m.diffuse_color = hex_rgba(colors.get(base, "#cccccc"))      # color in solid view too
        body.material_slots[i].material = m

    # each toy in its own collection, standing next to the others
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    for o in (arm, body):
        for c in o.users_collection:
            c.objects.unlink(o)
        col.objects.link(o)
    arm.location = location
    return arm, body, col


bpy.ops.wm.open_mainfile(filepath=src)
made = []
for i, name in enumerate(TOYS):
    made.append(make_rig(name, (i * 2.6, 0, 0)))
# the original loose parts are no longer needed in the scene (the toys are built from copies)
for oname in PART_BONE:
    bpy.data.objects.remove(bpy.data.objects[oname], do_unlink=True)
for m in list(bpy.data.materials):
    if m.users == 0:
        bpy.data.materials.remove(m)

# frame the camera on all four
cam = bpy.data.objects.get("Camera")
if cam:
    cam.location = (3.9, -11.5, 2.4)
    cam.rotation_euler = (math.radians(85), 0, 0)
    cam.data.lens = 40
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "toys_rigged.blend"), compress=True)

# one game-ready file per toy (rig + mesh + colors), standing at the origin
for arm, body, col in made:
    keep = arm.location.copy()
    arm.location = (0, 0, 0)
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True); body.select_set(True)
    stem = col.name.lower().replace(" ", "_")
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, stem + ".glb"), use_selection=True, export_skins=True)
    bpy.ops.export_scene.fbx(filepath=os.path.join(out, stem + ".fbx"), use_selection=True, add_leaf_bones=False,
                             object_types={"ARMATURE", "MESH"})
    arm.location = keep
print("done")
