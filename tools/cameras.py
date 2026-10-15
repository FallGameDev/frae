"""
cameras.py
Splits the camera views into "empty room" + "character on top".

In the Scratch project, every camera costume with a character in it was a
full copy of the room photo with the character drawn on it. Here each
camera keeps only the room photos it really needs, and the characters are
drawn on top from their own files (Eddy.svg, Cheddy.svg, Weddy.svg,
Endo.svg), scaled and placed exactly where they were.

How the placing works: the camera drawings were made from the same
character drawings, so every shape (ear, head, body...) appears in both.
Matching the points of those shapes gives the exact size and position.

Special cases:
  - dark "close" shots draw the character as a solid black silhouette
  - when a pose has a different face (staring, twitching, open mouth,
    Eddy with the endoskeleton face), a small variant file is saved that
    is the character file with that face swapped in
  - two shots had the character painted into the photo itself; those are
    replaced by the empty room plus the character file
"""
import base64, hashlib, io, os, re
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

NS = '{http://www.w3.org/2000/svg}'
XLINK = '{http://www.w3.org/1999/xlink}'
ET.register_namespace('', 'http://www.w3.org/2000/svg')
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')

CAMERAS = ['Show Stage', 'Dining Area', 'Pirate Cove', 'West Hall', 'west hall corner', 'supply closet',
           'east hall', 'east hall corner', 'backstage', 'restrooms', 'kitchen', 'entrance']
# other sprites with characters drawn in (None = every costume)
EXTRA = {'office': None, 'back': None, 'Eddie': None, 'Backdrop': ['mike stuffed']}
CHAR_FILES = {'Eddy': 'Eddy.svg', 'Cheddy': 'Cheddy.svg', 'Weddy': 'Weddy.svg', 'Endo': 'Endo.svg'}
PALETTE = {
    'Eddy': {'#fffbdc', '#ffe639', '#fff766'},
    'Cheddy': {'#ffe7c6', '#ff9500', '#ffbf66', '#ffa11e'},
    'Weddy': {'#c4791f', '#ffa6e2', '#9966ff'},
    'Endo': {'#676767'},
}
FACE = {'#000000', '#ffffff'}
# FNaF names used in the costume names -> your characters
NAME_HINT = [('bonnie', 'Weddy'), ('chica', 'Cheddy'), ('freddy', 'Eddy'), ('peeking', 'Endo'), ('standing', 'Endo')]
# poses that only show part of the character (behind the curtain, close-ups)
OUTLINE_POSES = {('Pirate Cove', 'peeking out'), ('east hall', 'chica close'), ('east hall corner', 'freddy'),
               ('supply closet', 'bonnie'), ('kitchen', 'chicarumble3')}
# shots where the character is painted into the photo
BAKED = {('Dining Area', 'bonnie'): ('Weddy', 'empty'), ('restrooms', 'chica'): ('Cheddy', 'clear'),
         ('entrance', 'bonnie'): ('Weddy', 'empty')}


# ---------------------------------------------------------------------------
# SVG geometry helpers
# ---------------------------------------------------------------------------
def mul(a, b):
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3],
            a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]


def inv(m):
    a, b, c, d, e, f = m
    det = a * d - b * c
    return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]


def parse_tf(s):
    import math
    m = [1, 0, 0, 1, 0, 0]
    for fn, args in re.findall(r'(\w+)\s*\(([^)]*)\)', s or ''):
        a = [float(x) for x in re.split(r'[\s,]+', args.strip()) if x]
        if fn == 'translate': t = [1, 0, 0, 1, a[0], a[1] if len(a) > 1 else 0]
        elif fn == 'scale': t = [a[0], 0, 0, a[1] if len(a) > 1 else a[0], 0, 0]
        elif fn == 'matrix': t = a
        elif fn == 'rotate':
            r = math.radians(a[0]); t = [math.cos(r), math.sin(r), -math.sin(r), math.cos(r), 0, 0]
            if len(a) == 3: t = mul(mul([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]])
        elif fn == 'skewX': t = [1, 0, math.tan(math.radians(a[0])), 1, 0, 0]
        elif fn == 'skewY': t = [1, math.tan(math.radians(a[0])), 0, 1, 0, 0]
        else: raise ValueError(fn)
        m = mul(m, t)
    return m


def path_points(d):
    """Absolute points (end and control points) of an SVG path, in order."""
    toks = re.findall(r'[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?', d)
    pts, i, cmd, x, y, sx, sy = [], 0, None, 0.0, 0.0, 0.0, 0.0
    counts = {'m': 2, 'l': 2, 'c': 6, 's': 4, 'q': 4, 't': 2, 'h': 1, 'v': 1, 'a': 7, 'z': 0}
    while i < len(toks):
        if re.match(r'[A-Za-z]', toks[i]):
            cmd = toks[i]; i += 1
            if cmd in 'zZ':
                x, y = sx, sy
                continue
        n = counts[cmd.lower()]
        vals = [float(v) for v in toks[i:i + n]]; i += n
        rel = cmd.islower()
        c = cmd.lower()
        if c in 'mltsqc':
            for j in range(0, n, 2):
                px, py = vals[j] + (x if rel else 0), vals[j + 1] + (y if rel else 0)
                pts.append((px, py))
            x, y = pts[-1]
            if c == 'm':
                sx, sy = x, y
                cmd = 'l' if rel else 'L'
        elif c == 'h':
            x = vals[0] + (x if rel else 0); pts.append((x, y))
        elif c == 'v':
            y = vals[0] + (y if rel else 0); pts.append((x, y))
        elif c == 'a':
            x, y = vals[5] + (x if rel else 0), vals[6] + (y if rel else 0); pts.append((x, y))
    return np.array(pts)


def sig(d):
    return ''.join(re.findall(r'[A-Za-z]', d))


def flatten(root):
    """Every drawable element with its full transform, fill and parent."""
    out = []

    def walk(el, parent, m, fill):
        m = mul(m, parse_tf(el.get('transform')))
        fill = el.get('fill', fill)
        tag = el.tag.replace(NS, '')
        if tag == 'path' and el.get('d') and re.search(r'\d', el.get('d')):
            pts = path_points(el.get('d'))
            world = pts @ np.array([[m[0], m[1]], [m[2], m[3]]]) + np.array([m[4], m[5]])
            out.append(dict(el=el, parent=parent, m=m, fill=(fill or 'none').lower(), sig=sig(el.get('d')), pts=world))
        elif tag in ('image', 'rect', 'ellipse', 'circle', 'polygon', 'polyline', 'line', 'text'):
            out.append(dict(el=el, parent=parent, m=m, fill=(fill or 'none').lower(), sig=tag, pts=None))
        for c in list(el):
            walk(c, el, m, fill)
    walk(root, None, [1, 0, 0, 1, 0, 0], None)
    return out


def fit_similarity(src, dst):
    """Best scale+rotation+move that maps src points onto dst points (least squares)."""
    s = src[:, 0] + 1j * src[:, 1]
    d = dst[:, 0] + 1j * dst[:, 1]
    sm, dm = s.mean(), d.mean()
    a = np.vdot(s - sm, d - dm) / np.vdot(s - sm, s - sm)
    b = dm - a * sm
    m = [a.real, a.imag, -a.imag, a.real, b.real, b.imag]
    err = np.abs(a * s + b - d)
    return m, err


def apply(m, pts):
    return pts @ np.array([[m[0], m[1]], [m[2], m[3]]]) + np.array([m[4], m[5]])


def char_of(fill):
    for name, pal in PALETTE.items():
        if fill in pal:
            return name
    if fill.startswith('url('):
        return 'Endo'
    return None


# ---------------------------------------------------------------------------
# The character files
# ---------------------------------------------------------------------------
class CharAsset:
    def __init__(self, name, path):
        self.name = name
        self.text = open(path, encoding='utf-8').read()
        self.root = ET.fromstring(self.text)
        vb = [float(v) for v in re.split(r'[\s,]+', self.root.get('viewBox'))]
        self.w, self.h = vb[2], vb[3]
        self.paths = [p for p in flatten(self.root) if p['pts'] is not None]
        self.size = max(np.ptp(np.vstack([p['pts'] for p in self.paths]), axis=0))


def is_face(p):
    return p['fill'] in FACE


# ---------------------------------------------------------------------------
# Main entry
# ---------------------------------------------------------------------------
def split_cameras(b):
    import shutil
    char_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'characters')
    assets = {n: CharAsset(n, os.path.join(char_dir, f)) for n, f in CHAR_FILES.items()}
    for n, f in CHAR_FILES.items():
        shutil.copy(os.path.join(char_dir, f), os.path.join(b.out_root, 'assets', 'characters', f))
    b.char_src = {n: f'assets/characters/{f}' for n, f in CHAR_FILES.items()}
    b.char_assets = assets
    b.variant_hashes = {}
    b.variant_info = {}
    b.bg_cache = {}            # image content hash -> asset path
    stats = dict(costumes=0, base=0, silhouette=0, variant=0, partial=0, baked=0)
    for t in b.project['targets']:
        if t['name'] not in CAMERAS + list(EXTRA):
            continue
        for c in t['costumes']:
            if t['name'] in EXTRA and EXTRA[t['name']] and c['name'] not in EXTRA[t['name']]:
                continue
            rec = None
            if (t['name'], c['name']) in BAKED:
                rec = baked_costume(b, t, c, assets, stats)
            elif c['dataFormat'] == 'svg':
                rec = svg_costume(b, t, c, assets, stats)
            if rec:
                b.custom[(t['name'], c['name'])] = rec
                stats['costumes'] += 1
    b.notes.append('cameras: {costumes} costumes rebuilt, {base} plain character overlays, '
                   '{silhouette} silhouettes, {variant} face variants, {partial} partial poses (full file, clipped), {baked} painted-in characters replaced'.format(**stats))


SVG_FONTS = {'Sans Serif': 'Sans Serif', 'Serif': 'Serif', 'Pixel': 'Pixel'}


def take_text(root, ox, oy, group_sprite):
    """Remove <text> from an SVG and return it as real text layers (same spot, size and turn)."""
    out = []
    parent = {id(ch): par for par in root.iter() for ch in par}
    for e in flatten(root):
        if e['sig'] != 'text':
            continue
        el = e['el']
        size = float(el.get('font-size', 40))
        font = SVG_FONTS.get(el.get('font-family'), 'Sans Serif')
        color = el.get('fill') or '#000000'
        tm = [round(v, 5) for v in mul([1, 0, 0, 1, -ox, -oy], e['m'])]
        spans = el.findall(NS + 'tspan') or [el]
        y = 0.0
        for sp in spans:
            y += float(re.sub(r'[^\d.\-]', '', sp.get('dy', '0')) or 0)
            words = ''.join(sp.itertext()).strip()
            if words:
                out.append(dict(text=words, font=font, color=color, tm=tm, size=size,
                                pos=[float(sp.get('x', 0) or 0), round(y, 3)]))
        parent[id(el)].remove(el)
    return out


def room_label(t):
    """File name for a camera's room photo, like dining-area-room."""
    return re.sub(r'[^a-z0-9]+', '-', t['name'].lower()).strip('-') + '-room'


def bg_image(b, data, label):
    """Save an embedded room photo once (shared by every costume that uses it)."""
    h = hashlib.md5(data).hexdigest()
    if h in b.bg_cache:
        return b.bg_cache[h]
    # identical to a costume file in the project? reuse that conversion
    for ext in ('png', 'jpg'):
        if os.path.exists(os.path.join(b.src, f'{h}.{ext}')):
            rec = b.image_file(f'{h}.{ext}', label)
            b.bg_cache[h] = rec['src']
            return rec['src']
    rel = b.out_name('img', label, 'webp')
    b.save_webp(Image.open(io.BytesIO(data)), rel)
    b.bg_cache[h] = rel
    return rel


def svg_costume(b, t, c, assets, stats):
    text = open(os.path.join(b.src, c['md5ext']), encoding='utf-8').read()
    root = ET.fromstring(text)
    ox, oy, w, h = b.svg_size(text)
    els = flatten(root)
    paths = [e for e in els if e['pts'] is not None]
    for i, p in enumerate(paths):
        p['idx'] = i                                   # drawing order

    # 1. colored character shapes -> characters (a new one starts at each first ear)
    instances = []
    hint = next((v for k, v in NAME_HINT if k in c['name'].lower()), None)
    colored = [p for p in paths if char_of(p['fill']) or p['fill'] == '#ecff00']
    if not colored and hint:
        # dark shot: the character is a solid black silhouette
        parts = [p for p in paths if p['fill'] == '#000000' and p['sig'].startswith('Mc')]
        if parts:
            instances.append(dict(char=hint, parts=parts, face=[], silhouette=True))
    cur = None
    for p in colored:
        who = char_of(p['fill'])
        if p['fill'] == '#ecff00':                     # yellow head: Eddy or Weddy, keep current
            who = cur['char'] if cur else ('Weddy' if hint == 'Weddy' else 'Eddy')
        new_ear = p['sig'] == 'Mccccc24' and cur is not None and len(cur['parts']) > 3
        if cur is None or cur['char'] != who or new_ear:
            cur = dict(char=who, parts=[], face=[], silhouette=False)
            instances.append(cur)
        cur['parts'].append(p)
    if not instances:
        return None

    # 2. black/white face pieces go to the character they sit on
    char_ids = {id(p['el']) for inst in instances for p in inst['parts']}
    orphans = []
    for p in paths:
        if id(p['el']) in char_ids:
            continue
        cx, cy = p['pts'].mean(axis=0)
        pw_, ph_ = np.ptp(p['pts'], axis=0)
        home = None
        for inst in instances:
            if inst['silhouette']:
                continue
            if p['fill'] not in FACE and p['idx'] < inst['parts'][0]['idx']:
                continue                     # colored shapes drawn before the character are part of the room
            allp = np.vstack([q['pts'] for q in inst['parts']])
            (x0, y0), (x1, y1) = allp.min(axis=0), allp.max(axis=0)
            small = pw_ * ph_ < 0.25 * (x1 - x0) * (y1 - y0)     # (big shapes like a cover box are room)
            if x0 <= cx <= x1 and y0 <= cy <= y1 and small:
                home = inst
        if home:
            home['face'].append(p)
        elif p['fill'] in FACE and p['sig'].startswith('Mc'):
            orphans.append(p)       # leftover face of a character that was removed (invisible on black)

    # 3. words in the drawing become real text, then remove all character shapes:
    #    what is left is the room
    word_layers = take_text(root, ox, oy, t['name'])
    remove = {id(p['el']) for inst in instances for p in inst['parts'] + inst['face']} | {id(p['el']) for p in orphans}
    parent = {id(ch): par for par in root.iter() for ch in par}
    for p in paths:
        if id(p['el']) in remove:
            parent[id(p['el'])].remove(p['el'])
    left = [e for e in flatten(root)]
    layers = []
    if left and all(e['sig'] == 'image' for e in left):
        for e in left:
            el = e['el']
            href = el.get(XLINK + 'href') or el.get('href')
            data = base64.b64decode(href.split(',', 1)[1])
            src = bg_image(b, data, room_label(t))
            x, y = float(el.get('x', 0)), float(el.get('y', 0))
            m = mul([1, 0, 0, 1, -ox, -oy], mul(e['m'], [1, 0, 0, 1, x, y]))
            layers.append(dict(img=src, m=[round(v, 5) for v in m],
                               iw=float(el.get('width')), ih=float(el.get('height'))))
    elif left:
        # room has extra drawn shapes (like the black stage cover): flatten it to one picture
        svg = ET.tostring(root, encoding='unicode')
        png = b.renderer.svg_to_png(svg, w, h, 2)
        hsh = hashlib.md5(np.array(Image.open(io.BytesIO(png))).tobytes()).hexdigest()
        if hsh not in b.bg_cache:
            rel = b.out_name('img', room_label(t), 'webp')
            b.save_webp(Image.open(io.BytesIO(png)), rel)
            b.bg_cache[hsh] = rel
        layers.append(dict(img=b.bg_cache[hsh], x=0, y=0, w=w, h=h))

    # 4. put each character back from its own file
    for inst in instances:
        layers.append(place(b, t, c, inst, assets[inst['char']], ox, oy, w, h, root, stats))
    layers += word_layers
    res = 1
    return dict(name=c['name'], w=round(w, 3), h=round(h, 3),
                cx=round(c['rotationCenterX'] / res - ox, 3), cy=round(c['rotationCenterY'] / res - oy, 3),
                clip=True, layers=layers)


def fit_instance(inst, A):
    """Scale/turn/move that puts character file A on top of a drawn character."""
    pairs = []
    used = set()
    for p in inst['parts'] + inst['face']:
        cands = [(i, q) for i, q in enumerate(A.paths) if q['sig'] == p['sig'] and is_face(q) == is_face(p) and i not in used]
        if cands:
            pairs.append((p, cands))
    # first guess from shapes that appear once, then match the rest by position
    uniq = [(p, cs[0][1]) for p, cs in pairs if len(cs) == 1]
    if len(uniq) < 2:
        uniq = [(p, cs[0][1]) for p, cs in pairs]
    src = np.vstack([q['pts'] for p, q in uniq]); dst = np.vstack([p['pts'] for p, q in uniq])
    m, err = fit_similarity(src, dst)
    # refine: drop shapes that were redrawn (big error), refit
    for _ in range(3):
        good = []
        for p, cs in pairs:
            best = min(cs, key=lambda iq: np.abs(apply(m, iq[1]['pts']) - p['pts']).mean())
            e = np.abs(apply(m, best[1]['pts']) - p['pts']).mean()
            good.append((e, p, best[1]))
        scale = abs(complex(m[0], m[1])) * A.size
        keep = [(p, q) for e, p, q in good if e < 0.03 * scale] or [(p, q) for e, p, q in sorted(good, key=lambda g: g[0])[:3]]
        src = np.vstack([q['pts'] for p, q in keep]); dst = np.vstack([p['pts'] for p, q in keep])
        m, err = fit_similarity(src, dst)
    return m


def place(b, t, c, inst, A, ox, oy, w, h, croot, stats):
    """Find where the character file must go so it covers the drawn character."""
    m = fit_instance(inst, A)
    m_costume = mul([1, 0, 0, 1, -ox, -oy], m)
    layer = dict(img=b.char_src[A.name], m=[round(v, 5) for v in m_costume], iw=A.w, ih=A.h)
    if inst['silhouette']:
        layer['tint'] = '#000000'
        stats['silhouette'] += 1
        return layer
    # a partial pose (peeking, close-up head, behind the curtain)? use the full character
    # file anyway, but only show it inside the drawn shapes
    def clipped_box(pts):
        lo = np.maximum(pts.min(axis=0), [ox, oy]); hi = np.minimum(pts.max(axis=0), [ox + w, oy + h])
        return np.maximum(hi - lo, 0)
    drawn = clipped_box(np.vstack([q['pts'] for q in inst['parts'] + inst['face']]))
    full = clipped_box(apply(m, np.vstack([q['pts'] for q in A.paths])))
    partial = (drawn < 0.94 * full).any() or (t['name'], c['name']) in OUTLINE_POSES
    # does the face match the character file?
    scale = abs(complex(m[0], m[1])) * A.size
    a_face = [q for q in A.paths if is_face(q)]
    matched_a, extra = set(), []
    for p in inst['face']:
        hit = None
        for i, q in enumerate(a_face):
            if i in matched_a or q['sig'] != p['sig'] or q['fill'] != p['fill']:
                continue
            if np.abs(apply(m, q['pts']) - p['pts']).mean() < 0.012 * scale:
                hit = i
                break
        if hit is None:
            extra.append(p)
        else:
            matched_a.add(hit)
    missing = [q for i, q in enumerate(a_face) if i not in matched_a]
    if extra or missing:
        # a different face: this pose gets its own file, copied exactly from the drawing
        layer.update(exact_pose(b, A, m, inst, croot, c['name'], ox, oy))
        stats['variant'] += 1
        return layer
    if partial:
        # only part of the character shows: the full file, clipped to the drawn outline
        layer['outline'] = [[q['el'].get('d'), [round(v, 5) for v in mul([1, 0, 0, 1, -ox, -oy], q['m'])]]
                            for q in inst['parts']]
        stats['partial'] += 1
        return layer
    stats['base'] += 1
    return layer

def exact_pose(b, A, m, inst, croot, label, ox, oy):
    """Save a pose with its own face exactly as drawn, as its own file (in the character file's coordinates)."""
    to_asset = inv(m)
    shapes = sorted(inst['parts'] + inst['face'], key=lambda p: p['idx'])
    pts = np.vstack([apply(to_asset, p['pts']) for p in shapes])
    (x0, y0), (x1, y1) = pts.min(axis=0) - 2, pts.max(axis=0) + 2
    vw, vh = x1 - x0, y1 - y0
    root = ET.Element(NS + 'svg', {'version': '1.1', 'width': '%.3f' % vw, 'height': '%.3f' % vh,
                                    'viewBox': '0,0,%.3f,%.3f' % (vw, vh)})
    defs = croot.find(NS + 'defs')
    if defs is not None:
        import copy
        root.append(copy.deepcopy(defs))        # gradients used by the shapes
    shift = mul([1, 0, 0, 1, -x0, -y0], to_asset)
    for p in shapes:
        g = ET.SubElement(root, NS + 'g', {'transform': 'matrix(%s)' % ','.join('%.6g' % v for v in mul(shift, p['m']))})
        ET.SubElement(g, NS + 'path', {'d': p['el'].get('d'), 'fill': p['el'].get('fill') or p['fill'], 'stroke': 'none'})
    svg = ET.tostring(root, encoding='unicode')
    hsh = hashlib.md5(svg.encode()).hexdigest()
    if hsh not in b.variant_hashes:
        rel = b.out_name('characters', f"{A.name.lower()}-{re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-')}", 'svg')
        open(os.path.join(b.out_root, rel), 'w', encoding='utf-8').write(svg)
        b.variant_hashes[hsh] = rel
    # where this file sits in the base character's coordinates (so it can be reused elsewhere)
    b.variant_info[b.variant_hashes[hsh]] = (x0, y0, vw, vh)
    # the file starts at (x0, y0) of the character's coordinates
    m_img = mul([1, 0, 0, 1, -ox, -oy], mul(m, [1, 0, 0, 1, x0, y0]))
    return dict(img=b.variant_hashes[hsh], m=[round(v, 5) for v in m_img], iw=round(vw, 3), ih=round(vh, 3))


def order_of(root, el):
    for i, e in enumerate(root.iter()):
        if e is el:
            return i
    return 0


def baked_costume(b, t, c, assets, stats):
    """A character painted into the photo: use the empty room + the character file."""
    char, empty_name = BAKED[(t['name'], c['name'])]
    from mods import raster
    empty = next(x for x in t['costumes'] if x['name'] == empty_name)
    px = raster(b, c)
    # find the character by its own paint colors
    pal = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in PALETTE[char] | ({'#ecff00'} if char != 'Cheddy' else set())]
    near = np.zeros(px.shape[:2], bool)
    for col in pal:
        near |= np.abs(px[:, :, :3] - np.array(col)).sum(axis=2) < 70
    ys, xs = np.where(near)
    # character outline box in costume units (pictures are 2 pixels per unit)
    x0, x1, y0, y1 = np.percentile(xs, 0.2) / 2, np.percentile(xs, 99.8) / 2, np.percentile(ys, 0.2) / 2, np.percentile(ys, 99.8) / 2
    A = assets[char]
    allp = np.vstack([q['pts'] for q in A.paths])
    (ax0, ay0), (ax1, ay1) = allp.min(axis=0), allp.max(axis=0)
    s = (y1 - y0) / (ay1 - ay0)
    m = [s, 0, 0, s, (x0 + x1) / 2 - s * (ax0 + ax1) / 2, y0 - s * ay0]
    emp = b.costume(t, empty)
    stats['baked'] += 1
    res = c.get('bitmapResolution', 1)
    return dict(name=c['name'], w=emp['w'], h=emp['h'],
                cx=round(c['rotationCenterX'] / res, 3), cy=round(c['rotationCenterY'] / res, 3), clip=True,
                layers=emp['layers'] + [dict(img=b.char_src[char], m=[round(v, 5) for v in m], iw=A.w, ih=A.h)])
