# Fried Rice at Eddie's: handoff notes (menu, Tape 1, Tape 2)

Repo: FallGameDev/frae (GitHub Pages: fallgamedev.github.io/frae)

## Layout
- `index.html`: franchise menu (carousel of 4 games, VHS style). Save file picker (FILE 1-3, keys 1/2/3), remembered in localStorage `frae-file`. START opens `1/?file=N` or `2/?file=N`. Games 1 and 2 are unlocked (`GAMES` list).
- `1/index.html`: game 1, built by the tools below (do not edit by hand).
- `1/assets/`: `img/<group>/<name>.webp` (one finished picture each, pin in the middle, 2 px per game pixel), `snd/<group>/<name>.mp3`, fonts, `texts.json` (every word, for mods), loading-rice.webp. Same layout in `2/assets/`.
- Each game page is ONE plain HTML file with the hand-written code in `<script>`; there is no data block from the Scratch project. `names.js` (next to each game's code) lists which pictures/sounds exist; Tape 1's `words.js` holds the real text drawn on some pictures (mods change it in texts.json).
- `favicon.png/.ico` (rice bowl), `1/favicon.png/.ico` (Eddie), `2/favicon.png/.ico` (Eddie with a 2).
- `img/game1.png`, `img/game2.png`: menu card pictures.

## Building game 1
- Full build (re-renders all art from the Scratch project): `python3 tools/build_game1.py path/to/unzipped_sb3`
- Code-only rebuild (after changing JS/HTML only): `python3 tools/build_game1.py --code`
- The build describes every picture as layers (rooms, character files, words...), then `tools/flatten.py 1` paints each one into a single image file (headless browser, using `tools/legacy_layers.js`) and writes `tools/game/names.js` + `words.js` + `assets/texts.json`. `1/index.html` is just `game_shell.html` with the code files pasted into its `<script>`.
- Art pipeline: `tools/mods.py` (text sprites to real text, unused costumes), `tools/cameras.py` (empty rooms + separate character art), `tools/custom_night.py`, `tools/fanmade.py` (fan-made cast replaces FNaF characters).
- New phone calls and ringtone live in `tools/calls/` (night1-4.mp3, ringtone.mp3); the build copies them in.

## Hand-written game code (`tools/game/`)
- `pictures.js` (shared): loads `assets/img/<group>/<name>.webp` by name (`pic`, `picAt`, `hasPic`), draws them and their words, hit tests, mod file swaps (`MOD_FILES`), Smooth (interpolation between 30 Hz updates).
- `sound.js` (shared): sounds by name from `assets/snd/`, speakers with their own volumes, music/sound buses (music = `MUSIC_NAMES`), fadeOut.
- `game.js`: the Game class. Screens: title, night, custom, secret, black (+ overlays). Night logic: clock (90 s/hour), power, doors/lights, monitor + cameras, AI for Weddy/Cheddy/Endo/Eddie, phone + call banner, power out, jumpscares, 6 AM, endings, custom night (+ 1227 and 1987 codes). Save files: `frae1-save-fileN`.
- `secret.js`: the Dine In music video timeline.
- `achievements.js`: list of achievements, unlock(), Steam-style toast and list panel.
- `tools/ui.js` (shared by both tapes): settings, debug mode (H/P/G keys; blocks saving + achievements), mods, save file screen, Golden rate box (left arrow). Each shell sets `GAME_INFO` (storage key prefix `frae1` / `frae2`, mod template name, debug key help); Tape 1 uses the defaults.
- `tools/game_shell.html`: page, CSS, startup, main loop, input.

## Testing tips
- Serve the repo (`python3 -m http.server 8765`) and open `/1/?file=3`.
- `game.level = N; game.startNight()` jumps into a night; `game.debugInfo()` shows state.

## Tape 2 (`2/`)
Built from the FNaF 2 Scratch project (not in the repo, ~40 MB):
- Full build: `python3 tools/build_game2.py path/to/unzipped_FNAF_2_sb3`
- Code-only rebuild: `python3 tools/build_game2.py --code`. The full build ends with `tools/flatten.py 2` (pictures become plain image files, `tools/tape2/names.js`).
- Title song: `tools/tape2/title.mp3` (Beat Saber multiplayer lobby music). Ringtone shared from `tools/calls/`.
- Phone calls: the original FNaF 2 calls (nights 1-6) for now, with the Tape 1 call banner.

### Art (`tools/tape2/`)
- `cast.py`: every room is an EMPTY picture (dark + flashlight-lit) and every character is a separate "pose" picture on top, measured by hand from where the FNaF character stood (`CAM_POSES`, `OFFICE_POSES`, boxes in costume pixels; `body` = whole character in the box, `head` = head fills the box). Also covers FNaF posters/plushies in rooms (`COVERS`), jumpscare frames, the cast standing (`Chars`), heads (`Heads`, custom night), office extras, prizes, title faces, 8-bit cast (`Pixel`).
- Character files: `tools/tape2/characters/<role>.svg` or `.png` (see the README there). The toys (Toy Eddy/Weddy/Cheddy, and Mangled Endo = broken Toy Endo) are PNG renders of the 3D models from `tools/render_toys.py`, with `-lunge` versions for the office and jumpscares; the loading screens show the turning 3D Toy Eddy (`turntable.png`). Missing ones use stand-ins (Tape 1 drawings, or a "?" figure for BB and the Puppet). Add the file and run the full build.
- `extras.py`: the camera map with no lit button + each lit button.

### Game code (`tools/tape2/`, shares `tools/game/pictures.js` + `sound.js` + `tools/ui.js`)
- `game.js`: title (New Game / Continue / 6th Night / "It's still dark."), newspaper, night intro, the night (70 s per hour), mask (Q / bottom-left bar), cameras (E / bottom-right bar), flashlight (hold Space/F/Ctrl or click-and-hold) with battery, vent lights (A/D or hold the LIGHT buttons), music box on CAM 11, AI for 10 characters (`PATHS`, `DETOURS`, `NIGHT_AI`), office visits (mask in time), Withered Endo in the hall (flash him away), Puppet, Golden Eddie, BB disabling lights, Mangled Endo on the ceiling, phone, 6 AM, endings (drawn by the game), custom night with 11 presets and desk prizes. Save files: `frae2-save-fileN` (beat5/beat6/beat420 = the three stars, same as Tape 1 so the menu shows them).
- `minigames.js`: death minigames (Take Cake, Give Gifts Give Life, Endo Go! Go! Go!).
- `achievements.js`: Tape 2 achievement list.
- `shell.html`: page, keys (hold keys for flashlight / vents / 8-bit movement).
- Every word the game draws goes through `W("group", "text")`; the build collects them into texts.json for mods.

### Testing
- `/2/?file=3`, then `game.level = N; game.startNight()`; `game.n.at.<role> = "hall"` etc. to place characters; `game.startMinigame("cake")`.

## 3D models (`models/`)
- `models/basemodel.blend` (original) and `models/toys/` (rigged, four toy colors, .blend/.glb/.fbx). Rebuild with `python3 tools/rig_toys.py models/basemodel.blend models/toys` (needs `pip install bpy`). See `models/README.md`.
