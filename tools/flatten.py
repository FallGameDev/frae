#!/usr/bin/env python3
"""
flatten.py
Turns a game's pictures into plain image files, one per picture.

  python3 tools/flatten.py 1      (Tape 1: reads tools/data_cache.js and 1/assets)
  python3 tools/flatten.py 2      (Tape 2: reads tools/tape2/data_cache.js and 2/assets)

The art pipelines (build_game1.py / build_game2.py) describe every picture as
layers: room photos, character drawings placed with a matrix, shading,
boxes... This tool paints each picture in a headless browser (exactly like
the old game did at runtime) and saves the result as

    <tape>/assets/img/<group>/<name>.webp

The picture's pin (the spot that goes where the game draws it) is always the
middle of the image, and every image is 2 pixels per game pixel, so the game
needs no extra numbers to draw it.

Words (Tape 1 menus, clock, camera buttons...) are NOT painted in: they stay
real text so mods can change them. They are written to tools/game/words.js.

Sounds are copied to <tape>/assets/snd/<group>/<name>.mp3.

It also writes the list of picture and sound names the game loads
(names.js next to the game code) and assets/texts.json (all the words, for mods).
"""
import base64, io, json, os, re, shutil, subprocess, sys, time, socket
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
TAPES = {
    '1': dict(cache=os.path.join(HERE, 'data_cache.js'), code=os.path.join(HERE, 'game'),
              half=["dance", "Foxy", "Chica", "Bonnie", "Eddie", "West Hall", "moniter", "Secret??//Fnaf Static",
                    "Secret??//Glitch lines song", "Secret??//Static Line", "Secret??//Static Line2"]),
    '2': dict(cache=os.path.join(HERE, 'tape2', 'data_cache.js'), code=os.path.join(HERE, 'tape2'), half=["Sprite4", "Sprite5", "Sprite10", "Sprite28", "Sprite45"]),
}
# (half: groups saved at 1 image pixel per game pixel instead of 2, to save memory: long animations)
SCALE = 2          # image pixels per game pixel


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-') or 'x'


def save_webp(im, path):
    """Simple flat pictures stay lossless; photos get small lossy WebP."""
    colors = im.getcolors(4096)
    if colors is not None and len(colors) <= 256:
        im.save(path, 'WEBP', lossless=True, method=6)
    else:
        im.save(path, 'WEBP', quality=86, method=6)


HARNESS = '''<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Sans Serif"; src: url("assets/fonts/NotoSans-Medium.ttf"); }
@font-face { font-family: "Serif"; src: url("assets/fonts/SourceSerifPro-Regular.otf"); }
@font-face { font-family: "Pixel"; src: url("assets/fonts/Grand9K-Pixel.ttf"); }
@font-face { font-family: "Press Start 2P"; src: url("assets/fonts/PressStart2P.woff2"); }
@font-face { font-family: "Courier Prime"; src: url("assets/fonts/CourierPrime.woff2"); }
@font-face { font-family: "Share Tech Mono"; src: url("assets/fonts/ShareTechMono.woff2"); }
</style></head><body>
<script src="_flatten_data.js"></script>
<script src="_flatten_layers.js"></script>
<script>
// paint one picture (no words) and crop it around its pin
function renderPic(group, name, scale) {
  const p = ART[group].pics[name];
  const layers = p.layers.filter(L => L.text === undefined);
  const M = Math.ceil(Math.max(p.w, p.h, 8));               // room around it for parts that stick out
  const c = document.createElement("canvas");
  c.width = Math.ceil((p.w + 2 * M) * scale); c.height = Math.ceil((p.h + 2 * M) * scale);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.scale(scale, scale); g.translate(M, M);
  drawLayers(g, Object.assign({}, p, { layers }));
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const words = p.layers.filter(L => L.text !== undefined);
  const box = [p.w, p.h, p.cx, p.cy];
  if (x1 < 0) return { empty: true, words, box };
  // the pin is in the middle of the saved picture
  const px = (M + p.cx) * scale, py = (M + p.cy) * scale;
  const hw = Math.ceil(Math.max(px - x0, x1 + 1 - px)), hh = Math.ceil(Math.max(py - y0, y1 + 1 - py));
  const o = document.createElement("canvas");
  o.width = Math.max(1, 2 * hw); o.height = Math.max(1, 2 * hh);
  o.getContext("2d").drawImage(c, Math.round(px - hw), Math.round(py - hh), o.width, o.height, 0, 0, o.width, o.height);
  return { png: o.toDataURL("image/png"), words, box };
}
</script></body></html>'''


def free_port():
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close(); return port


def main():
    tape = sys.argv[1]
    cfg = TAPES[tape]
    game_dir = os.path.join(REPO, tape)
    old_assets = os.path.join(game_dir, 'assets')
    new_assets = os.path.join(game_dir, 'assets_new')
    data_js = open(cfg['cache'], encoding='utf-8').read()
    art = json.loads(re.search(r'const ART = (\{.*?\});\n', data_js, re.S).group(1))
    sounds = json.loads(re.search(r'const SOUNDS = (\{.*?\});\n', data_js, re.S).group(1))
    texts = json.loads(re.search(r'const DEFAULT_TEXTS = (\{.*\});', data_js, re.S).group(1))
    # Tape 1 has an unused picture group "Fan" (its only picture is never shown) next to "fan"
    if tape == '1':
        art.pop('Fan', None)
        sounds.pop('Fan', None)

    # names must stay different after turning them into file names
    for g, gr in art.items():
        seen = {}
        for n in gr['list']:
            k = slug(n)
            if k in seen:
                sys.exit(f'two pictures in "{g}" share the file name {k}: "{seen[k]}" and "{n}"')
            seen[k] = n
    for kind in (list(art), list(sounds)):            # pictures and sounds have their own folders
        gslugs = {}
        for g in kind:
            if slug(g) in gslugs:
                sys.exit(f'groups "{g}" and "{gslugs[slug(g)]}" share a folder name')
            gslugs[slug(g)] = g
    for g, group in sounds.items():
        seen = {}
        for n in group:
            if slug(n) in seen:
                sys.exit(f'two sounds in "{g}" share the file name {slug(n)}')
            seen[slug(n)] = n

    # ---- paint every picture in a headless browser ----
    open(os.path.join(game_dir, '_flatten.html'), 'w').write(HARNESS)
    open(os.path.join(game_dir, '_flatten_data.js'), 'w').write(data_js)
    shutil.copy(os.path.join(HERE, 'legacy_layers.js'), os.path.join(game_dir, '_flatten_layers.js'))
    port = free_port()
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port)], cwd=game_dir,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    if os.path.isdir(new_assets):
        shutil.rmtree(new_assets)
    os.makedirs(os.path.join(new_assets, 'img'))
    words = {}
    pictures = {}
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            br = pw.chromium.launch()
            pg = br.new_page()
            pg.goto(f'http://localhost:{port}/_flatten.html')
            pg.evaluate('''async () => {
                await Promise.all(["Sans Serif","Serif","Pixel","Press Start 2P","Courier Prime","Share Tech Mono"].map(f => document.fonts.load('10px "' + f + '"')));
                await Files.loadAll(allImageUrls(), [], () => {});
            }''')
            count = 0
            for g, gr in art.items():
                pictures[g] = []
                for n in gr['list']:
                    r = pg.evaluate('([g, n, s]) => renderPic(g, n, s)', [g, n, 1 if g in cfg['half'] else SCALE])
                    pictures[g].append(n)
                    if r['words']:
                        words[f'{g}/{n}'] = dict(box=[round(v, 3) for v in r['box']], words=r['words'])
                    if r.get('empty'):
                        im = Image.new('RGBA', (2, 2), (0, 0, 0, 0))      # only words: a see-through dot
                    else:
                        im = Image.open(io.BytesIO(base64.b64decode(r['png'].split(',', 1)[1]))).convert('RGBA')
                    folder = os.path.join(new_assets, 'img', slug(g))
                    os.makedirs(folder, exist_ok=True)
                    save_webp(im, os.path.join(folder, slug(n) + '.webp'))
                    count += 1
            br.close()
    finally:
        server.terminate()
        for f in ('_flatten.html', '_flatten_data.js', '_flatten_layers.js'):
            os.remove(os.path.join(game_dir, f))
    print(f'painted {count} pictures ({len(words)} with words)')

    # ---- sounds: <group>/<name>.mp3 ----
    music = []
    for g, group in sounds.items():
        for n, s in group.items():
            dst = os.path.join(new_assets, 'snd', slug(g), slug(n) + '.mp3')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy(os.path.join(game_dir, s['src']), dst)
            if s['music']:
                music.append(n)

    # ---- fonts, the loading picture, the words for mods ----
    shutil.copytree(os.path.join(old_assets, 'fonts'), os.path.join(new_assets, 'fonts'))
    for keep in ('loading-rice.webp',):           # the loading screen picture (used before the game loads)
        if os.path.exists(os.path.join(old_assets, keep)):
            shutil.copy(os.path.join(old_assets, keep), os.path.join(new_assets, keep))
    json.dump(texts, open(os.path.join(new_assets, 'texts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    shutil.rmtree(old_assets)
    os.rename(new_assets, old_assets)

    # ---- names.js: which pictures and sounds exist (the game loads these files) ----
    def js_list(items):
        return '[' + ', '.join(json.dumps(x, ensure_ascii=False) for x in items) + ']'
    out = ['/* =====================================================================',
           '   PICTURES AND SOUNDS',
           '   Every picture is the file assets/img/<group>/<name>.webp and every sound',
           '   is assets/snd/<group>/<name>.mp3 (names written in lower case with',
           '   dashes, see fileName in pictures.js). This list says which ones exist,',
           '   in order (picAt(group, 3) is the third picture of a group).',
           '   Made by tools/flatten.py.',
           '   ===================================================================== */',
           '"use strict";', '', 'const PICTURE_NAMES = {']
    for g, names in pictures.items():
        out.append(f'  {json.dumps(g, ensure_ascii=False)}: {js_list(names)},')
    out += ['};', '', 'const SOUND_NAMES = {']
    for g, group in sounds.items():
        out.append(f'  {json.dumps(g, ensure_ascii=False)}: {js_list(list(group))},')
    out += ['};', '', '// sounds that follow the Music slider (all others follow the Sound slider)',
            f'const MUSIC_NAMES = new Set({js_list(sorted(set(music)))});', '',
            '// pictures saved at half size (1 image pixel per game pixel) to save memory: long animations',
            f'const HALF_SIZE_GROUPS = new Set({js_list(cfg["half"])});', '']
    open(os.path.join(cfg['code'], 'names.js'), 'w', encoding='utf-8').write('\n'.join(out))

    # ---- words.js: the words drawn on top of pictures (Tape 1) ----
    w = ['/* =====================================================================',
         '   WORDS ON PICTURES',
         '   Real text drawn on top of some pictures (menus, clock, camera buttons,',
         '   the secret song lyrics...). Mods can change any of it in texts.json.',
         '   box: the picture\'s [width, height, pin x, pin y]; each word has its',
         '   font, color and where it sits in the picture. Made by tools/flatten.py.',
         '   ===================================================================== */',
         '"use strict";', '', 'const PICTURE_WORDS = {']
    for k, v in words.items():
        w.append(f'  {json.dumps(k, ensure_ascii=False)}: {{ box: {json.dumps(v["box"])}, words: [')
        for L in v['words']:
            w.append('    ' + json.dumps(L, ensure_ascii=False) + ',')
        w.append('  ] },')
    w += ['};', '']
    open(os.path.join(cfg['code'], 'words.js'), 'w', encoding='utf-8').write('\n'.join(w))
    print(f'wrote names.js and words.js in {os.path.relpath(cfg["code"], REPO)}')


if __name__ == '__main__':
    main()
