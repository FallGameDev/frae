# 3D models

**Every character's 3D model goes in this folder.** The games look here while
they load, and wherever that character shows up (cameras, the office, vents,
jumpscares, the title screen, custom night, newspapers...) its model is drawn.
No build needed: drop the file in, push, done.

Name the file after the character (any of `.glb`, `.gltf`, `.fbx`, `.obj`):

| File name         | Character        |
|-------------------|------------------|
| `toy_eddy`        | Toy Eddy         |
| `toy_weddy`       | Toy Weddy        |
| `toy_cheddy`      | Toy Cheddy       |
| `meyg`            | Meyg (until there is one: `toy_endo` in a broken pose) |
| `balloon_kid`     | Balloon Kid      |
| `the_puppet`      | The Puppet       |
| `withered_eddy`   | Withered Eddy    |
| `withered_weddy`  | Withered Weddy   |
| `withered_cheddy` | Withered Cheddy  |
| `withered_endo`   | Withered Endo    |
| `golden_eddie`    | Golden Eddie     |
| `endo`            | the bare endoskeleton (vents, prize corner) |

(The list lives in `ACTOR_FILES` in `tools/tape2/actors.js`.) A character
with no model yet is drawn as its 2D drawing.

Mods can do the same without touching the repo: a mod's `models/` folder
(3D) and `characters/` folder (2D drawings, same names) win over these.

**.blend files:** browsers can't open them, so turn them into .glb first:

    pip install bpy
    python3 tools/convert_models.py

That converts every .blend here. One character per .blend
(`withered_eddy.blend` -> `withered_eddy.glb`), or one collection per
character (`toys_rigged.blend` has "Toy Eddy", "Toy Weddy"... -> `toy_eddy.glb`...).

**Poses:** the game poses each model itself (standing, and reaching for you
in the office and jumpscares). Models made from the base model's skeleton
are posed bone by bone. Any other skeleton (Mixamo, Rigify, your own...)
follows the game's set rig: its arms, legs, chest and head are found by name
(LeftArm, upper_arm.L, Thigh_R...) and pointed the same way, so every
model ends up in the same poses.

**Animations:** if the model has a looping animation (one named idle or
loop, otherwise its first one), it plays whenever the character stands.
An animation named Scare (or Jumpscare / Death) is played as the jumpscare,
filmed from where the player sits (the character starts about 3 units in
front of the camera and should come at it). The toys' animations are made by
`tools/animate_toys.py`.

## What's here
- `basemodel.blend`: Aidan's original base model (no skeleton).
- `toys_rigged.blend`: the base model with a skeleton, in four toy colors
  (Toy Eddy, Toy Weddy, Toy Cheddy, Toy Endo), each in its own collection.
- `toy_*.glb` (games, Godot, web) and `toy_*.fbx` (Roblox, GameMaker): one toy per file, rig + colors.
- `faces/`: Aidan's face drawings (`<toy>_face1..3.png`: calm, creepy, scary) and the
  head textures made from them (`<toy>_head1..3.png`). The models carry the calm face;
  the game swaps in head2 (cameras, hall, vents, title) and head3 (office, jumpscares).
  After changing a face drawing: `python3 tools/face_toys.py` (needs `pip install bpy`).

Skeleton: Root > Hips > Chest > Head > Ear.L / Ear.R, Chest > UpperArm > Hand,
Hips > Leg > Foot (.L / .R). Every body part follows one bone (no stretching);
the torso bends between Hips and Chest.

The head material still holds the (blank) face texture node, unplugged:
paint a face, save the image, and plug it into Base Color.

Rebuild the toys (for example after changing the base model or a color in `TOYS`):

    pip install bpy
    python3 tools/rig_toys.py models/basemodel.blend models
