# Tape 2 character files

Drop a character drawing here, named after the role it plays, then rebuild:

    python3 tools/build_game2.py path/to/unzipped_FNAF_2_sb3

| File          | Plays the part of (FNaF 2) | Shown as          |
|---------------|----------------------------|-------------------|
| tfreddy.svg   | Toy Freddy                 | Toy Eddy          |
| tbonnie.svg   | Toy Bonnie                 | Toy Weddy         |
| tchica.svg    | Toy Chica                  | Toy Cheddy        |
| mangle.svg    | Mangle                     | Mangled Endo      |
| bb.svg        | Balloon Boy                | Balloon Kid       |
| puppet.svg    | The Puppet                 | The Puppet        |
| wfreddy.svg   | Withered Freddy            | Withered Eddy     |
| wbonnie.svg   | Withered Bonnie            | Withered Weddy    |
| wchica.svg    | Withered Chica             | Withered Cheddy   |
| foxy.svg      | Withered Foxy              | Withered Endo     |
| golden.svg    | Golden Freddy              | Golden Eddie      |
| endo.svg      | Bare endoskeleton          | (vent / prize corner) |
| shadow.svg    | Shadow Freddy              | (drawn all black) |

Any missing file uses a stand-in (the Tape 1 drawings, or a simple "?" figure).
One full-body drawing per character is enough: the build places it in every
room, close-up, vent and jumpscare by itself (heads = the top 40% of the drawing).
The names players see are in texts.json ("Characters"), so mods can rename them.

## 3D toys
`tfreddy.png`, `tbonnie.png`, `tchica.png` and `mangle.png` (plus `-lunge.png` versions used in the
office and jumpscares) are rendered from the rigged 3D toys in `models/toys/toys_rigged.blend` by
`python3 tools/render_toys.py` (needs `pip install bpy`). A `<role>.png` wins over a `<role>.svg`.
Mangled Endo uses Toy Endo in a broken pose. The same script makes `tools/tape2/turntable.png`,
the turning Toy Eddy on the loading screens.
