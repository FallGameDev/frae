# 3D models

- `basemodel.blend`: Aidan's original base model (no skeleton).
- `toys/toys_rigged.blend`: the base model with a skeleton, in four toy colors
  (Toy Eddy, Toy Weddy, Toy Cheddy, Toy Endo), each in its own collection.
- `toys/toy_*.glb` (Godot, web) and `toys/toy_*.fbx` (Roblox, GameMaker): one toy per file, rig + colors.
- `toys/toys_preview.png`: the four toys posed to test the skeleton.

Skeleton: Root > Hips > Chest > Head > Ear.L / Ear.R, Chest > UpperArm > Hand,
Hips > Leg > Foot (.L / .R). Every body part follows one bone (no stretching);
the torso bends between Hips and Chest.

The head material still holds the (blank) face texture node, unplugged:
paint a face, save the image, and plug it into Base Color.

Rebuild the toys (for example after changing the base model or a color in `TOYS`):

    pip install bpy
    python3 tools/rig_toys.py models/basemodel.blend models/toys
