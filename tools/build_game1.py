#!/usr/bin/env python3
"""
build_game1.py
Builds the web version of Fried Rice at Eddie's (game 1) from the Scratch .sb3.

  python3 tools/build_game1.py path/to/unzipped_sb3_folder

What it does:
  1. Reads project.json
  2. Applies the edits for the web version (see mods.py):
       - text-only sprites become real text
       - the copyright sprite is removed
       - camera views keep one empty room picture and draw the
         characters (Eddy, Cheddy, Weddy, Endo) as separate pictures
       - costumes that no script can ever show are dropped
  3. Converts assets: PNG -> WebP, WAV -> MP3, SVGs with photos or text -> WebP
  4. Converts every script to JavaScript (sb3_to_js.py)
  5. Writes 1/index.html (engine + scripts + data in one file)
"""
import hashlib, io, json, os, re, shutil, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from sb3_to_js import convert
from render import Renderer, font_css

REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, '1')
ASSETS = os.path.join(OUT, 'assets')


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
        rec = self.image_file(c['md5ext'], slug(f"{target['name']}-{c['name']}"))
        w, h = rec['w'] / res, rec['h'] / res
        cx = (c.get('rotationCenterX', 0)) / res - rec['ox']
        cy = (c.get('rotationCenterY', 0)) / res - rec['oy']
        return dict(name=c['name'], w=round(w, 3), h=round(h, 3), cx=round(cx, 3), cy=round(cy, 3),
                    layers=[dict(img=rec['src'], x=0, y=0, w=round(w, 3), h=round(h, 3))])

    # --------------------------------------------------------------- sounds
    def sound(self, target, s):
        key = s['md5ext']
        if key in self.done:
            return dict(name=s['name'], src=self.done[key])
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
        return dict(name=s['name'], src=rel)

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


def main():
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

    scripts_js, n = convert(b.project)
    engine = open(os.path.join(HERE, 'engine.js'), encoding='utf-8').read()
    shell = open(os.path.join(HERE, 'game_shell.html'), encoding='utf-8').read()
    project_js = 'const PROJECT = ' + json.dumps(dict(targets=data), ensure_ascii=False, separators=(',', ':')) + ';'
    html = (shell.replace('/*ENGINE*/', engine)
                 .replace('/*PROJECT*/', project_js)
                 .replace('/*SCRIPTS*/', scripts_js))
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
    print(f'wrote 1/index.html with {n} scripts, {len(data)} sprites')


if __name__ == '__main__':
    main()
