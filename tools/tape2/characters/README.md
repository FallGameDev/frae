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
