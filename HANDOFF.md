# Fried Rice at Eddie's: handoff notes (game 1 + menu)

Repo: FallGameDev/frae (GitHub Pages: fallgamedev.github.io/frae)

## Layout
- `index.html`: franchise menu (carousel of 4 games, VHS style). Save file picker (FILE 1-3, keys 1/2/3), remembered in localStorage `frae-file`. START opens `1/?file=N`.
- `1/index.html`: game 1, built by the tools below (do not edit by hand).
- `1/assets/`: img, snd, characters, fonts, loading-rice.webp.
- `favicon.png/.ico` (rice bowl) and `1/favicon.png/.ico` (Eddie).

## Building game 1
- Full build (re-renders all art from the Scratch project): `python3 tools/build_game1.py path/to/unzipped_sb3`
- Code-only rebuild (after changing JS/HTML only): `python3 tools/build_game1.py --code`
- The build makes ART (pictures as layers), SOUNDS, ASSET_FILES and DEFAULT_TEXTS, then joins them with the hand-written code into `1/index.html`.
- Art pipeline: `tools/mods.py` (text sprites to real text, unused costumes), `tools/cameras.py` (empty rooms + separate character art), `tools/custom_night.py`, `tools/fanmade.py` (fan-made cast replaces FNaF characters).
- New phone calls and ringtone live in `tools/calls/` (night1-4.mp3, ringtone.mp3); the build copies them in.

## Hand-written game code (`tools/game/`)
- `pictures.js`: drawing pictures/text, hit tests, Smooth (interpolation between 30 Hz updates).
- `sound.js`: speakers with their own volumes, music/sound buses, fadeOut.
- `game.js`: the Game class. Screens: title, night, custom, secret, black (+ overlays). Night logic: clock (90 s/hour), power, doors/lights, monitor + cameras, AI for Weddy/Cheddy/Endo/Eddie, phone + call banner, power out, jumpscares, 6 AM, endings, custom night (+ 1227 and 1987 codes). Save files: `frae1-save-fileN`.
- `secret.js`: the Dine In music video timeline.
- `achievements.js`: list of achievements, unlock(), Steam-style toast and list panel.
- `tools/ui.js`: settings, debug mode (H/P/G keys; blocks saving + achievements), mods (localStorage `frae1-mods`), save file screen, Golden rate box (left arrow).
- `tools/game_shell.html`: page, CSS, startup, main loop, input.

## Testing tips
- Serve the repo (`python3 -m http.server 8765`) and open `/1/?file=3`.
- `game.level = N; game.startNight()` jumps into a night; `game.debugInfo()` shows state.
