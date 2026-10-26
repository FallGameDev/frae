#!/usr/bin/env python3
"""
build_game1.py
Builds the web version of Fried Rice at Eddie's (game 1) from the Scratch .sb3.

  python3 tools/build_game1.py path/to/unzipped_sb3_folder
  python3 tools/build_game1.py --code      (only the game code changed: quick)

What it does:
  1. Reads project.json
  2. Applies the edits for the web version (see mods.py):
       - text-only sprites become real text
       - the copyright sprite is removed
       - camera views keep one empty room picture and draw the
         characters (Eddy, Cheddy, Weddy, Endo) as separate pictures
       - costumes that no script can ever show are dropped
  3. Converts assets: PNG -> WebP, WAV -> MP3, SVGs with photos or text -> WebP
  4. flatten.py paints every picture into one plain image file
     (1/assets/img/<group>/<name>.webp) and lists them in tools/game/names.js
  5. Writes 1/index.html: the hand-written game (tools/game/*.js) in <script>.
     The Scratch scripts are NOT converted: the game logic was rewritten
     by hand in tools/game/game.js.
"""
import hashlib, io, json, os, re, shutil, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from render import Renderer, font_css

REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, '1')
ASSETS = os.path.join(OUT, 'assets')


# Sounds controlled by the Music slider (everything else uses the Sound slider)
MUSIC = {'Menu', 'ColdPresc B', 'Fried Rice At Eddies (1)_E_major__bpm_103', 'circus', 'music box',
         'pirate song2', 'Download (5)', 'shimmy-shimmy-yay-made-with-Voicemod', 'chimes 2'}

# Phone calls recorded again (tools/calls/): Scratch sound name -> new file.
# Night 5 keeps its original call.
NEW_CALLS = {'voiceover1c': 'night1.mp3', 'voiceover2a': 'night2.mp3',
             'voiceover3': 'night3.mp3', 'voiceover4': 'night4.mp3'}

# texts.json groups: which sprites' words go in which group
TEXT_GROUPS = [
    ('Title menu', ['FNaF text', 'dine in', 'new game', 'continue', '6th Night', 'Custom Night', 'selection', 'SettingsButton']),
    ('Settings', []),
    ('Night start and clock', ['what day', 'time AM', 'night', '6am fore', '6am back']),
    ('Office', ['Power Left %', 'Usage word', 'office', 'Phone Calls', 'left button panel', 'right button panel']),
    ('Cameras', ['CAM']),
    ('Custom night', ['Ready']),
    ('Endings and game over', ['Backdrop']),
    ('Hallucinations', ['hallucinations']),
    ('Secret ending', ['Secret??//']),
]
SETTINGS_TEXTS = ['Settings', 'Jumpscares', 'ON', 'OFF', 'Music', 'Sound', 'Mods', 'CONFIRM', 'Debug mode', 'Golden Freddy Rate?',
                  'Select a file', 'FILE', 'EMPTY', 'Night', 'ERASE', 'Save file', 'CHANGE',
                  'Saving and achievements are off', 'no saving or achievements while on']
CHARACTER_NAMES = ['Eddie', 'Weddy', 'Cheddy', '???']


def default_texts(data):
    """All the words the game shows, grouped, as {group: {text: text}} for texts.json."""
    out = {g: {} for g, _ in TEXT_GROUPS}
    out['Custom night'] = {}
    out['Settings'] = {t: t for t in SETTINGS_TEXTS}
    out['Phone'] = {t: t for t in ['AM', 'Aidan', 'Manager', 'incoming call...']}   # the call banner
    # achievement names and descriptions (read from tools/game/achievements.js)
    ach = open(os.path.join(HERE, 'game', 'achievements.js'), encoding='utf-8').read()
    words = ['Achievements', 'Achievement Unlocked!', 'Hidden achievement', 'Keep playing to find it.', 'Unlocked', 'BACK']
    words += [w for pair in re.findall(r'name: "([^"]+)",\s*desc: "([^"]+)"', ach) for w in pair]
    out['Achievements'] = {t: t for t in words}
    # camera names shown on the monitor
    out.setdefault('Cameras', {}).update({t: t for t in ['CAM', 'Show Stage', 'Entrance', 'Dining Area', 'Pirate Cove', 'West Hall',
        'W. Hall Corner', 'Supply Closet', 'East Hall', 'E. Hall Corner', 'Backstage', 'Kitchen', 'Restrooms']})
    out['Characters'] = {}
    for t in data:
        group = next((g for g, names in TEXT_GROUPS if any(t['name'] == n or t['name'].startswith(n) for n in names)), None)
        for c in t['costumes']:
            for L in c['layers']:
                s = L.get('text')
                if s is None or s.strip() == '' or s.strip().isdigit():
                    continue           # single digits (clock, power) are not worth changing
                if s in CHARACTER_NAMES:
                    out['Characters'][s] = s
                elif L.get('group'):
                    out.setdefault(L['group'], {})[s] = s
                elif group:
                    out[group][s] = s
    return {g: v for g, v in out.items() if v}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:48] or 'x'


class Builder:
    def __init__(self, sb3_dir, fonts):
        self.src = sb3_dir
        self.out_root = OUT
        self.project = json.load(open(os.path.join(sb3_dir, 'project.json')))
        self.done = {}            # source file -> converted record (so shared files convert once)
        self.used_names = set()
        self.renderer = Renderer(font_css(fonts))
        for d in ('img', 'snd', 'fonts', 'characters'):
            os.makedirs(os.path.join(ASSETS, d), exist_ok=True)

    # ---------------------------------------------------------------- names
    def out_name(self, folder, base, ext):
        name, n = base, 1
        while f'{folder}/{name}.{ext}' in self.used_names:
            n += 1
            name = f'{base}-{n}'
        self.used_names.add(f'{folder}/{name}.{ext}')
        return f'assets/{folder}/{name}.{ext}'

    # --------------------------------------------------------------- images
    def save_webp(self, im, rel):
        """Photos get small lossy WebP; simple flat pictures stay lossless."""
        path = os.path.join(OUT, rel)
        im = im.convert('RGBA')
        colors = im.getcolors(4096)
        if colors is not None and len(colors) <= 256:
            im.save(path, 'WEBP', lossless=True, method=6)
        else:
            im.save(path, 'WEBP', quality=86, method=6)

    def svg_size(self, text):
        m = re.search(r'viewBox="([^"]+)"', text)
        if m:
            vb = [float(v) for v in re.split(r'[\s,]+', m.group(1).strip())]
            return vb[0], vb[1], vb[2], vb[3]
        w = float(re.search(r'width="([\d.]+)', text).group(1))
        h = float(re.search(r'height="([\d.]+)', text).group(1))
        return 0, 0, w, h

    def image_file(self, md5ext, label):
        """Convert one costume file. Returns {src, w, h, ox, oy} in costume units."""
        if md5ext in self.done:
            return self.done[md5ext]
        path = os.path.join(self.src, md5ext)
        if md5ext.endswith('.svg'):
            text = open(path, encoding='utf-8', errors='replace').read()
            ox, oy, w, h = self.svg_size(text)
            if '<image' in text or '<text' in text:
                # photos or fonts inside: flatten to a picture at 2x (same detail Scratch shows)
                png = self.renderer.svg_to_png(text, w, h, 2)
                rel = self.out_name('img', label, 'webp')
                self.save_webp(Image.open(io.BytesIO(png)), rel)
            else:
                rel = self.out_name('img', label, 'svg')
                shutil.copy(path, os.path.join(OUT, rel))
            rec = dict(src=rel, w=w, h=h, ox=ox, oy=oy)
        else:
            im = Image.open(path)
            rel = self.out_name('img', label, 'webp')
            self.save_webp(im, rel)
            rec = dict(src=rel, w=im.width, h=im.height, ox=0, oy=0, px=True)
        self.done[md5ext] = rec
        return rec

    def costume(self, target, c):
        res = c.get('bitmapResolution', 1)
        if c['dataFormat'] == 'svg':
            text = open(os.path.join(self.src, c['md5ext']), encoding='utf-8', errors='replace').read()
            if '<text' in text:
                return self.costume_with_words(target, c, text)
        rec = self.image_file(c['md5ext'], slug(f"{target['name']}-{c['name']}"))
        w, h = rec['w'] / res, rec['h'] / res
        cx = (c.get('rotationCenterX', 0)) / res - rec['ox']
        cy = (c.get('rotationCenterY', 0)) / res - rec['oy']
        return dict(name=c['name'], w=round(w, 3), h=round(h, 3), cx=round(cx, 3), cy=round(cy, 3),
                    layers=[dict(img=rec['src'], x=0, y=0, w=round(w, 3), h=round(h, 3))])

    def costume_with_words(self, target, c, text):
        """An SVG drawing with words: the words become real text, the rest becomes a picture."""
        import xml.etree.ElementTree as ET
        from cameras import take_text
        ox, oy, w, h = self.svg_size(text)
        root = ET.fromstring(text)
        words = take_text(root, ox, oy, target['name'])
        png = self.renderer.svg_to_png(ET.tostring(root, encoding='unicode'), w, h, 2)
        rel = self.out_name('img', slug(f"{target['name']}-{c['name']}"), 'webp')
        self.save_webp(Image.open(io.BytesIO(png)), rel)
        return dict(name=c['name'], w=round(w, 3), h=round(h, 3),
                    cx=round(c['rotationCenterX'] - ox, 3), cy=round(c['rotationCenterY'] - oy, 3),
                    layers=[dict(img=rel, x=0, y=0, w=round(w, 3), h=round(h, 3))] + words)

    # --------------------------------------------------------------- sounds
    def sound(self, target, s):
        key = s['md5ext']
        music = 1 if s['name'] in MUSIC else 0
        if key in self.done:
            return dict(name=s['name'], src=self.done[key], music=music)
        path = os.path.join(self.src, key)
        rel = self.out_name('snd', slug(s['name']), 'mp3')
        codec = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name',
                                '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
        if key.endswith('.mp3') and codec == 'mp3':
            shutil.copy(path, os.path.join(OUT, rel))
        else:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-codec:a', 'libmp3lame', '-q:a', '3',
                            os.path.join(OUT, rel)], check=True)
        self.done[key] = rel
        return dict(name=s['name'], src=rel, music=music)

    # ---------------------------------------------------------------- data
    def target_data(self, t, costumes):
        locals_ = {}
        seen = {}
        for vid, v in t['variables'].items():
            n = v[0]
            seen[n] = seen.get(n, 0) + 1
            locals_[n if seen[n] == 1 else f'{n} ({seen[n]})'] = v[1]
        return dict(
            name=t['name'], isStage=t['isStage'],
            costumes=costumes,
            sounds=[self.sound(t, s) for s in t['sounds']],
            start=dict(
                x=t.get('x', 0), y=t.get('y', 0), dir=t.get('direction', 90), size=t.get('size', 100),
                visible=t.get('visible', True), costumeIndex=t['currentCostume'],
                rotationStyle=t.get('rotationStyle', 'all around'), draggable=t.get('draggable', False),
                volume=t.get('volume', 100), layer=t.get('layerOrder', 0), vars=locals_))


def write_page():
    """1/index.html: the page, the hand-written game and the settings/mods UI, all in <script>.
    (Small pictures are packed into embedded.js as base64; the other pictures and sounds are plain files in 1/assets, listed by names.js.)"""
    game_dir = os.path.join(HERE, 'game')
    code = '\n\n'.join(open(os.path.join(game_dir, f), encoding='utf-8').read()
                        for f in ('names.js', 'words.js', 'embedded.js', 'pictures.js', 'sound.js', 'vhs.js', 'pause.js', 'game.js', 'guide.js', 'secret.js', 'achievements.js'))

    # the devlog (Settings > Devlog): this tape's updates from tools/devlog.json
    log = [e for e in json.load(open(os.path.join(HERE, 'devlog.json'), encoding='utf-8')) if 1 in e['tapes']]
    code = 'const DEVLOG = ' + json.dumps(log, ensure_ascii=False) + ';\n\n' + code
    # global settings + accounts (shared with the tape menu) go first
    code = open(os.path.join(HERE, 'global.js'), encoding='utf-8').read() + '\n\n' + code
    ui = open(os.path.join(HERE, 'ui.js'), encoding='utf-8').read()
    shell = open(os.path.join(HERE, 'game_shell.html'), encoding='utf-8').read()
    html = shell.replace('/*GAME*/', code).replace('/*UI*/', ui)
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)


def main():
    if sys.argv[1] == '--code':
        # quick rebuild: only the game code changed
        write_page()
        print('wrote 1/index.html (code only)')
        return
    sb3_dir = sys.argv[1]
    fonts_dir = os.path.join(ASSETS, 'fonts')
    fonts = {f: os.path.join(fonts_dir, n) for f, n in [
        ('Sans Serif', 'NotoSans-Medium.ttf'), ('Serif', 'SourceSerifPro-Regular.otf'),
        ('Pixel', 'Grand9K-Pixel.ttf'), ('Press Start 2P', 'PressStart2P.woff2'), ('Courier Prime', 'CourierPrime.woff2'),
        ('Share Tech Mono', 'ShareTechMono.woff2')]}
    b = Builder(sb3_dir, fonts)

    # loading screen picture
    shutil.copy(os.path.join(HERE, 'loading-rice.webp'), os.path.join(ASSETS, 'loading-rice.webp'))

    import mods
    mods.apply(b)          # edits for the web version (text, cameras, copyright, unused costumes)

    print('\n'.join(b.notes))
    data = []
    for t in b.project['targets']:
        costumes = [b.custom.get((t['name'], c['name'])) or b.costume(t, c) for c in t['costumes']]
        data.append(b.target_data(t, costumes))
    b.renderer.close()

    # ---- pictures and sounds, looked up by sprite name and costume/sound name ----
    art, sounds = {}, {}
    for t in data:
        art[t['name']] = {'list': [c['name'] for c in t['costumes']],
                          'pics': {c['name']: {k: v for k, v in c.items() if k != 'name'} for c in t['costumes']}}
        sounds[t['name']] = {s['name']: {'src': s['src'], 'music': s['music']} for s in t['sounds']}
    # ---- new phone calls for nights 1-4 (tools/calls/) and the ringtone before each call ----
    calls_dir = os.path.join(HERE, 'calls')
    for old, new in NEW_CALLS.items():
        shutil.copy(os.path.join(calls_dir, new), os.path.join(OUT, sounds['Phone Calls'][old]['src']))
    shutil.copy(os.path.join(calls_dir, 'ringtone.mp3'), os.path.join(ASSETS, 'snd', 'ringtone.mp3'))
    sounds['Phone Calls']['ringtone'] = {'src': 'assets/snd/ringtone.mp3', 'music': 0}

    # the song on the VHS death guide (DOORS "Self", turned down 10 dB: tools/game/vhs_song.mp3)
    shutil.copy(os.path.join(HERE, 'game', 'vhs_song.mp3'), os.path.join(ASSETS, 'snd', 'vhs-song.mp3'))
    sounds['VHS'] = {'Self': {'src': 'assets/snd/vhs-song.mp3', 'music': 1}}

    data_js = 'const ART = ' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';'
    data_js += '\nconst SOUNDS = ' + json.dumps(sounds, ensure_ascii=False, separators=(',', ':')) + ';'
    # everything a mod template needs: every asset file (except the loading picture) and the words
    files = sorted(os.path.relpath(os.path.join(dp, f), ASSETS).replace(os.sep, '/')
                   for dp, _, fs in os.walk(ASSETS) for f in fs)
    files = [f for f in files if f != 'loading-rice.webp']
    data_js += '\nconst ASSET_FILES = ' + json.dumps(files) + ';'
    data_js += '\nconst DEFAULT_TEXTS = ' + json.dumps(default_texts(data), ensure_ascii=False, indent=1) + ';'
    open(os.path.join(HERE, 'art_debug.json'), 'w').write(json.dumps(art, indent=1))   # for checking (git-ignored)

    open(os.path.join(HERE, 'data_cache.js'), 'w', encoding='utf-8').write(data_js)   # the layer description (git-ignored)
    # paint every picture into one plain image file (and write names.js / words.js)
    subprocess.run([sys.executable, os.path.join(HERE, 'flatten.py'), '1'], check=True)
    write_page()
    print(f'wrote 1/index.html ({len(data)} sprites of art, {sum(len(v) for v in sounds.values())} sounds)')


if __name__ == '__main__':
    main()
