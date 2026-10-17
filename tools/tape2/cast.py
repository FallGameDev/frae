"""
cast.py
Swaps every original FNaF character in Tape 2 for the fan-made cast.

Every room comes in two versions (dark, and lit by the flashlight), both
EMPTY. The characters are NOT painted into pictures: the game draws them
itself, at runtime, wherever they stand (tools/tape2/actors.js). Each
character is its 3D model from the repo's models/ folder (toy_eddy.glb,
withered_weddy.obj...), or its 2D drawing when there is no model yet.

This file measures WHERE they stand: the boxes below were measured by hand
from the Scratch costumes (in their pixels), and the build writes them,
with how dark each spot is, to tools/tape2/poses.js.

  body  the whole character fits the box (feet at the bottom)
  head  the character's head fills the box (close-ups, vents)

2D drawings (used until a 3D model is in models/): put a file named after
the role in tools/tape2/characters (for example wfreddy.svg) and rebuild.
Until a file is there, a stand-in is used (the Tape 1 characters, or a
simple placeholder drawing).

Made here (picture groups the game uses):
  Office      Aidan's office (tools/tape2/office): 000 (dark), 010 (hall light), 100 / 001 (vent lights)
  Cam1..Cam12 dark, light (empty rooms)
  Chars       every character's 2D drawing, standing (pin at the feet)
  Plush       the two custom night prizes that are not characters
  Loading     the spinning rice bowl
  Pixel       8-bit versions of the cast (death minigames)
"""
import base64, io, json, math, os, re, shutil
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CHAR_DIR = os.path.join(HERE, 'characters')
TAPE1_CHARS = os.path.join(os.path.dirname(HERE), 'characters')        # the Tape 1 drawings (stand-ins)

# ---------------------------------------------------------------------------
# Who is who. Until Aidan's files arrive, these stand in.
# ---------------------------------------------------------------------------
STAND_IN = {
    'tfreddy': 'Eddy.svg', 'tbonnie': 'Weddy.svg', 'tchica': 'Cheddy.svg',
    'wfreddy': 'Eddy.svg', 'wbonnie': 'Weddy.svg', 'wchica': 'Cheddy.svg',
    'foxy': 'Endo.svg', 'mangle': 'Endo.svg', 'golden': 'Golden.svg', 'endo': 'Endo.svg', 'shadow': 'Eddy.svg',
    'bb': None, 'puppet': None,        # drawn below
}
ROLES = list(STAND_IN)

# simple stand-in drawings (replaced as soon as real files are added)
PLACEHOLDER = {
    'bb': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 170" width="100" height="170">
<path d="M50 4 L58 14 L42 14 Z" fill="#ffd23f"/><rect x="47" y="12" width="6" height="8" fill="#555"/>
<ellipse cx="50" cy="20" rx="26" ry="9" fill="#e23b3b"/><ellipse cx="50" cy="20" rx="26" ry="9" fill="none" stroke="#2a5bd7" stroke-width="3" stroke-dasharray="6 6"/>
<circle cx="50" cy="48" r="28" fill="#f2c9a0"/><circle cx="40" cy="44" r="6" fill="#fff"/><circle cx="60" cy="44" r="6" fill="#fff"/>
<circle cx="40" cy="45" r="3" fill="#2a5bd7"/><circle cx="60" cy="45" r="3" fill="#2a5bd7"/><circle cx="32" cy="58" r="5" fill="#f08080"/><circle cx="68" cy="58" r="5" fill="#f08080"/>
<path d="M38 62 Q50 72 62 62" stroke="#802020" stroke-width="3" fill="none"/>
<rect x="28" y="76" width="44" height="58" rx="10" fill="#2a5bd7"/><rect x="28" y="86" width="44" height="8" fill="#e23b3b"/><rect x="28" y="104" width="44" height="8" fill="#e23b3b"/><rect x="28" y="122" width="44" height="8" fill="#e23b3b"/>
<rect x="14" y="80" width="12" height="36" rx="6" fill="#2a5bd7"/><rect x="74" y="80" width="12" height="36" rx="6" fill="#2a5bd7"/>
<rect x="33" y="134" width="13" height="28" rx="5" fill="#7a4a2a"/><rect x="54" y="134" width="13" height="28" rx="5" fill="#7a4a2a"/>
<text x="50" y="112" font-size="30" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">?</text></svg>''',
    'puppet': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 260" width="100" height="260">
<ellipse cx="50" cy="34" rx="24" ry="30" fill="#f4f0e6"/><path d="M36 26 q5 -4 10 0" stroke="#222" stroke-width="3" fill="none"/><path d="M54 26 q5 -4 10 0" stroke="#222" stroke-width="3" fill="none"/>
<rect x="38" y="30" width="4" height="22" fill="#7a3fa0"/><rect x="58" y="30" width="4" height="22" fill="#7a3fa0"/>
<circle cx="33" cy="42" r="6" fill="#e04848"/><circle cx="67" cy="42" r="6" fill="#e04848"/><path d="M38 50 Q50 64 62 50 Z" fill="#111"/>
<rect x="42" y="62" width="16" height="6" fill="#ccc"/><path d="M30 70 L70 70 L64 150 L36 150 Z" fill="#141414"/>
<path d="M30 74 L6 150" stroke="#141414" stroke-width="9"/><path d="M70 74 L94 150" stroke="#141414" stroke-width="9"/>
<path d="M40 150 L36 250" stroke="#141414" stroke-width="10"/><path d="M60 150 L64 250" stroke="#141414" stroke-width="10"/>
<g stroke="#eee" stroke-width="9"><path d="M38 170 l-0.4 6"/><path d="M37 195 l-0.4 6"/><path d="M36 220 l-0.4 6"/><path d="M62 170 l0.4 6"/><path d="M63 195 l0.4 6"/><path d="M64 220 l0.4 6"/></g>
<text x="50" y="120" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">?</text></svg>''',
}

# ---------------------------------------------------------------------------
# The rooms: game camera -> (Scratch sprite, dark empty costume, lit empty costume)
# ---------------------------------------------------------------------------
ROOMS = {
    1: ('Party 01', 'Dark', 'Light'), 2: ('Party 02', 'Dark', 'Light'), 3: ('Party 03', 'Dark', 'Light'),
    4: ('Party 04', 'Dark', 'light no paper plate'), 5: ('Left Vent', 'Dark', 'Light'), 6: ('Right Vent', 'Dark', 'Light'),
    7: ('Main Hall', 'Dark', 'Light'), 8: ('Parts/Service', 'Dark', 'Light'), 9: ('Showstage', 'S000', None),
    10: ('Game Area', 'Dark', 'Light'), 11: ('Prizecorner', 'Dark', 'Light'), 12: ("Kid's Cove", 'Dark', 'Light'),
}

# Poses on the cameras: (camera, pose name, sprite, costume, mode, box [x0, y0, x1, y1] in costume pixels, options)
CAM_POSES = [
    (1, 'wbonnie', 'Party 01', 'LightOldBonnie', 'body', [110, 150, 300, 700], {}),
    (1, 'tchica', 'Party 01', 'LightToyChica', 'body', [90, 250, 340, 600], {}),
    (2, 'wchica', 'Party 02', 'LightOldChica', 'head', [265, 30, 555, 420], {}),
    (2, 'tbonnie', 'Party 02', 'LightToybonnie', 'body', [640, 150, 830, 420], {}),
    (3, 'wfreddy', 'Party 03', 'LightOldFreddy', 'head', [170, 120, 770, 720], {}),
    (3, 'tbonnie', 'Party 03', 'LightToyBonnie', 'body', [350, 60, 530, 440], {}),
    (4, 'tbonnie', 'Party 04', 'LightToyBonnie', 'head', [200, -60, 740, 580], {}),
    (4, 'wchica', 'Party 04', 'LightOldChica', 'body', [380, 170, 640, 550], {}),
    (4, 'tchica', 'Party 04', 'LightToyChica', 'body', [320, 130, 470, 500], {}),
    (5, 'wbonnie', 'Left Vent', 'LightOldBonnie', 'head', [300, 100, 650, 560], {}),
    (5, 'tchica', 'Left Vent', 'LightToyChica', 'head', [280, 190, 520, 500], {}),
    (5, 'bb', 'Left Vent', 'LightBB', 'head', [270, 180, 620, 560], {}),
    (5, 'endo', 'Left Vent', 'LightEndoskeleton', 'head', [270, 290, 700, 560], {}),
    (6, 'tbonnie', 'Right Vent', 'LightToyBonnie', 'head', [440, 180, 810, 500], {}),
    (6, 'mangle', 'Right Vent', 'LightMangle', 'head', [400, 190, 790, 590], {}),
    (6, 'wchica', 'Right Vent', 'LightOldChica', 'head', [380, 170, 760, 700], {}),
    (7, 'tchica', 'Main Hall', 'LightToyChica', 'head', [205, 150, 375, 330], {}),
    (7, 'wbonnie', 'Main Hall', 'LightOldBonnie', 'body', [360, 135, 440, 300], {}),
    (7, 'wfreddy', 'Main Hall', 'LightOldFreddy', 'body', [430, 125, 520, 450], {}),
    (7, 'puppetwalk1', 'Main Hall', 'Puppetone', 'body', [390, 5, 560, 450], {'role': 'puppet', 'light': True}),
    (7, 'puppetwalk2', 'Main Hall', 'Puppettwo', 'head', [370, 60, 620, 360], {'role': 'puppet', 'light': True}),
    (7, 'puppetwalk3', 'Main Hall', 'Puppetthree', 'head', [310, 40, 650, 400], {'role': 'puppet', 'light': True}),
    (8, 'wchica', 'Parts/Service', 'LightOldChica', 'body', [120, 100, 330, 360], {}),
    (8, 'wbonnie', 'Parts/Service', 'LightOldBonnie', 'body', [170, -20, 330, 340], {}),
    (8, 'foxy', 'Parts/Service', 'LightFoxy', 'body', [400, 20, 570, 450], {}),
    (8, 'wfreddy', 'Parts/Service', 'LightOldFreddy', 'head', [550, 170, 650, 300], {}),
    (8, 'shadow', 'Parts/Service', 'shadow freddy', 'body', [230, 30, 520, 330], {'light': True}),
    (9, 'tbonnie', 'Showstage', 'S2', 'body', [170, 40, 370, 470], {}),
    (9, 'tfreddy', 'Showstage', 'S2', 'body', [380, 10, 620, 480], {}),
    (9, 'tchica', 'Showstage', 'S2', 'body', [630, 40, 840, 470], {}),
    (10, 'bb', 'Game Area', 'LightBB', 'body', [90, 170, 280, 450], {}),
    (10, 'tfreddy', 'Game Area', 'LightToyFreddy', 'body', [290, 130, 390, 345], {}),
    (11, 'puppet1', 'Prizecorner', 'LightPuppet1', 'body', [605, 150, 685, 330], {'role': 'puppet', 'light': True, 'cut': [0, 0, 960, 258]}),
    (11, 'puppet2', 'Prizecorner', 'LightPuppet1', 'body', [590, 125, 690, 330], {'role': 'puppet', 'light': True, 'cut': [0, 0, 960, 258]}),
    (11, 'puppet3', 'Prizecorner', 'LightPuppet2', 'body', [560, 95, 700, 420], {'role': 'puppet', 'light': True}),
    (11, 'endo', 'Prizecorner', 'Bare_Endoskeleton_(clean)', 'body', [530, 0, 760, 460], {'light': True}),
    (12, 'mangle', "Kid's Cove", 'LightMangle', 'body', [450, 140, 710, 330], {'rot': -75}),
]
# characters that walk through a room with no picture of them in it: borrow someone else's spot
CAM_BORROW = {
    (7, 'mangle'): 'tchica', (10, 'mangle'): 'tfreddy',
}

# Office poses: (pose name, sprite costume, office base costume, mode, box)
OFFICE_POSES = [
    ('hall-wfreddy', '0OldFreddy0', '010', 'body', [429, 150, 523, 457]),
    ('hall-foxy', '0Foxy0', '010', 'body', [430, 150, 530, 420]),
    ('hall-tfreddy', '0toyfreddy0', '010', 'body', [460, 140, 560, 450]),
    ('hall-tchica', '0ToyChica0', '010', 'body', [450, 160, 530, 335]),
    ('hall-wbonnie', 'Bonnie_Down_The_Hall', '010', 'body', [460, 150, 540, 450]),
    ('hall-mangle', 'Front_Hall_-_Mangle', '010', 'body', [470, 140, 560, 330]),
    ('hall-golden', 'Golden_Freddy_Down_The_Hall', '010', 'head', [420, 150, 560, 290]),
    ('ventL-tchica', 'ToyChica00', '100', 'head', [35, 280, 115, 370]),
    ('ventL-bb', 'BB00', '100', 'head', [30, 295, 105, 385]),
    ('ventL-wbonnie', 'ToyChica00', '100', 'head', [30, 270, 115, 375]),
    ('ventL-endo', 'BB00', '100', 'head', [25, 300, 115, 390]),
    ('ventR-tbonnie', '00ToyBonnie', '001', 'head', [840, 280, 930, 380]),
    ('ventR-mangle', '00Mangle', '001', 'head', [845, 285, 930, 400]),
    ('ventR-wchica', '00ToyBonnie', '001', 'head', [835, 275, 935, 385]),
    ('in-wchica', 'OldChica', '000', 'body', [360, 0, 600, 470]),
    ('in-wbonnie', 'OldBonnie', '000', 'body', [380, -30, 560, 460]),
    ('in-tfreddy', 'toyfreddy', '000', 'body', [500, 0, 780, 470]),
    ('in-wfreddy', 'OldFreddy', '000', 'body', [330, 0, 700, 470]),
    ('in-tchica', 'OldChica', '000', 'body', [380, 20, 580, 470]),
    ('in-tbonnie', 'OldBonnie', '000', 'body', [380, -10, 580, 470]),
]
# the vent openings are drawn only inside these holes (so characters peek out of them)
VENT_HOLE = {'ventL': [20, 280, 135, 460], 'ventR': [825, 270, 940, 460]}     # (in the FNaF office)

# Aidan's own office (tools/tape2/office/000.png dark, 010 hall light, 100 left vent, 001 right vent).
# Same shape as the FNaF office (960 x 460 costume pixels), but the hall door and the
# vents are in other places, so every spot measured in the FNaF office is moved over:
OFFICE_DIR = os.path.join(HERE, 'office')
NEW_VENT_HOLE = {'ventL': [126, 222, 214, 331], 'ventR': [733, 222, 818, 331]}
NEW_HALL = dict(cx=475, floor=268, k=0.33)      # the hall door: middle, the floor in it, how much smaller


def office_spot(name, box):
    """A spot measured in the FNaF office -> the same spot in Aidan's office."""
    spot = name.split('-')[0]
    x0, y0, x1, y1 = box
    if spot in NEW_VENT_HOLE:
        a, b = VENT_HOLE[spot], NEW_VENT_HOLE[spot]
        sx, sy = (b[2] - b[0]) / (a[2] - a[0]), (b[3] - b[1]) / (a[3] - a[1])
        return [b[0] + (x0 - a[0]) * sx, b[1] + (y0 - a[1]) * sy, b[0] + (x1 - a[0]) * sx, b[1] + (y1 - a[1]) * sy]
    if spot == 'hall':
        # standing in the doorway: smaller, feet on the hall floor (the short ones stand further back)
        k, cx = NEW_HALL['k'], NEW_HALL['cx'] + ((x0 + x1) / 2 - 490) * 0.3
        h = (y1 - y0) * k
        floor = NEW_HALL['floor'] - (8 if (y1 - y0) < 200 else 0)
        w = (x1 - x0) * k
        return [cx - w / 2, floor - h, cx + w / 2, floor]
    return box                                    # in the office: right in front of you, same as before

# Posters and toys in the rooms that show FNaF characters: covered with the new cast
# (sprite, costume or None for all of that sprite, box, role, kind)
COVERS = [
    ('Main Hall', None, [0, 100, 140, 460], 'tbonnie', 'poster'),
    ('Main Hall', None, [150, 70, 218, 400], 'tchica', 'poster'),
    ('Main Hall', None, [842, 120, 960, 380], 'tfreddy', 'poster'),
    ('Prizecorner', None, [362, 40, 560, 160], 'tchica', 'posters'),
    ('Prizecorner', None, [72, 70, 165, 170], 'tchica', 'plush'),
    ('Prizecorner', None, [262, 228, 335, 300], 'tfreddy', 'plush'),
    ('Party 01', None, [140, 140, 470, 310], 'wfreddy', 'posters'),
    ('Party 03', None, [500, 88, 668, 205], 'tbonnie', 'posters'),
    ('Party 04', None, [555, 140, 655, 262], 'tbonnie', 'plate'),
    ('Party 04', None, [680, 180, 785, 300], 'tfreddy', 'plate'),
]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def costume_image(b, sprite, name):
    """A costume as a PIL image (2 pixels per costume unit). SVGs holding a photo give the photo."""
    t = next(t for t in b.project['targets'] if t['name'] == sprite)
    c = next(c for c in t['costumes'] if c['name'] == name)
    path = os.path.join(b.src, c['md5ext'])
    if path.endswith('.svg'):
        data = re.search(r'base64,([^"]+)"', open(path, encoding='utf-8').read()).group(1)
        return Image.open(io.BytesIO(base64.b64decode(data))).convert('RGB')
    return Image.open(path).convert('RGB')


def save_img(b, im, label):
    rel = b.out_name('img', label, 'webp')
    b.save_webp(im, rel)
    return rel


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


class Char:
    """One character file: its size and where its head is."""
    def __init__(self, b, role):
        self.role = role
        own = os.path.join(CHAR_DIR, role + '.svg')
        rel = f'assets/characters/{role}.svg'
        dst = os.path.join(b.out_root, rel)
        if os.path.exists(own):
            shutil.copy(own, dst)
            self.stand_in = False
        elif STAND_IN.get(role):
            shutil.copy(os.path.join(TAPE1_CHARS, STAND_IN[role]), dst)
            self.stand_in = True
        else:
            open(dst, 'w', encoding='utf-8').write(PLACEHOLDER[role])
            self.stand_in = True
        self.src = rel
        text = open(dst, encoding='utf-8').read()
        _, _, self.w, self.h = b.svg_size(text)
        # draw it once to find the drawing's outline and its head
        k = 600 / max(self.w, self.h)
        a = np.array(Image.open(io.BytesIO(b.renderer.svg_to_png(text, self.w, self.h, k))))[:, :, 3] > 40
        head_part = 0.40
        ys, xs = np.where(a)
        x0, x1, y0, y1 = xs.min() / k, (xs.max() + 1) / k, ys.min() / k, (ys.max() + 1) / k
        self.body = (x0, y0, x1, y1)
        band = int(ys.min() + (ys.max() - ys.min()) * head_part)
        hx = np.where(a[ys.min():band].any(axis=0))[0]
        self.head = (hx.min() / k, y0, (hx.max() + 1) / k, band / k)

    def layer(self, box, mode='body', rot=0.0, shade=0.0, tint=None, flip=False):
        """A picture layer that puts this character in `box` ([x0, y0, x1, y1] in costume units)."""
        bx0, by0, bx1, by1 = box
        if mode == 'head':
            x0, y0, x1, y1 = self.head
            s = (by1 - by0) / (y1 - y0)
            ax, ay = (x0 + x1) / 2, (y0 + y1) / 2          # this point of the drawing ...
            tx, ty = (bx0 + bx1) / 2, (by0 + by1) / 2      # ... goes here
        else:
            x0, y0, x1, y1 = self.body
            s = (by1 - by0) / (y1 - y0)
            ax, ay = (x0 + x1) / 2, y1
            tx, ty = (bx0 + bx1) / 2, by1
        r = math.radians(rot)
        a, c = s * math.cos(r), s * math.sin(r)
        sx = -1 if flip else 1
        m = [a * sx, c * sx, -c, a, 0, 0]
        m[4] = tx - (m[0] * ax + m[2] * ay)
        m[5] = ty - (m[1] * ax + m[3] * ay)
        L = dict(img=self.src, m=[round(v, 5) for v in m], iw=round(self.w, 3), ih=round(self.h, 3))
        if shade > 0.01:
            L['shade'] = round(min(0.95, shade), 3)
        if tint:
            L['tint'] = tint
        return L


def measured_shade(orig, base, box):
    """How dark the FNaF character looked in its picture (0 = bright, 0.9 = nearly black)."""
    x0, y0, x1, y1 = [int(max(0, v)) for v in box]
    o = np.asarray(orig).astype(int)[y0:y1, x0:x1]
    bb = np.asarray(base).astype(int)[y0:y1, x0:x1]
    if o.size == 0:
        return 0.3
    diff = np.abs(o - bb).sum(axis=2) > 45
    px = o[diff] if diff.sum() > 50 else o.reshape(-1, 3)
    lum = (px @ [0.299, 0.587, 0.114]).mean() / 255
    return float(np.clip(1 - lum / 0.42, 0.0, 0.8))


def room_pic(rel, w, h, extra=None):
    p = dict(w=w, h=h, cx=w / 2, cy=h / 2, clip=True, layers=[dict(img=rel, x=0, y=0, w=w, h=h)])
    if extra:
        p['layers'] += extra
    return p


def pose_pic(w, h, layers, cut=None):
    p = dict(w=w, h=h, cx=w / 2, cy=h / 2, clip=True, layers=layers)
    if cut:
        for L in layers:
            L['cut'] = cut
    return p


def cover_layers(sprite, costume, dim=False):
    """Dark backing over posters that show FNaF characters (the game draws the new cast on top)."""
    out = []
    for s, c, box, role, kind in COVERS:
        if s != sprite or (c and c != costume) or kind not in ('poster', 'posters'):
            continue
        x0, y0, x1, y1 = [v / 2 for v in box]
        out.append(dict(rect=[x0, y0, x1 - x0, y1 - y0], fill='#0c0a12' if dim else '#1a1424'))
    return out


def cover_spots(sprite):
    """Where the new cast goes on posters, plates and shelves (room picture units)."""
    out = []
    for s, c, box, role, kind in COVERS:
        if s != sprite:
            continue
        x0, y0, x1, y1 = [v / 2 for v in box]
        cut = [x0, y0, x1 - x0, y1 - y0]
        if kind in ('poster', 'posters'):
            n = 1 if kind == 'poster' else 3
            roles = [role] if n == 1 else ['tbonnie', 'tfreddy', 'tchica']
            cw = (x1 - x0) / n
            for i, r in enumerate(roles):
                hb = [x0 + cw * i + cw * 0.12, y0 + (y1 - y0) * 0.18, x0 + cw * (i + 1) - cw * 0.12, y0 + (y1 - y0) * 0.62]
                out.append(dict(role=r, box=hb, mode='head', shade=0.35, cut=cut))
        elif kind == 'plate':   # a paper plate pal on the wall: just the head, a bit faded
            out.append(dict(role=role, box=[x0 + 6, y0 + 6, x1 - 6, y1 - 6], mode='head', shade=0.3, cut=cut))
        else:                   # a plush on a shelf
            out.append(dict(role=role, box=[x0, y0, x1, y1], mode='body', shade=0.55))
    return out


def js_obj(d):
    """A small dict as JavaScript (keys without quotes, numbers rounded)."""
    def val(v):
        if isinstance(v, float):
            v = round(v, 2)
            return str(int(v)) if v == int(v) else str(v)
        if isinstance(v, (list, tuple)):
            return '[' + ', '.join(val(x) for x in v) + ']'
        if isinstance(v, bool):
            return 'true' if v else 'false'
        if isinstance(v, int):
            return str(v)
        return json.dumps(v)
    return '{' + ', '.join(f'{k}: {val(v)}' for k, v in d.items()) + '}'


POSES_HEAD = """/* =====================================================================
   WHERE THE CHARACTERS STAND  (written by tools/tape2/cast.py: edit the
   tables there and rebuild, this file is made again)

   Every spot a character can be seen, measured by hand from where the
   FNaF character stood in the original pictures. The game draws the
   character there (its 3D model from the models folder, or its 2D
   drawing) on top of the empty room. See actors.js.

   box    [left, top, right, bottom] in the room picture (its own pixels,
          0,0 = the picture's top-left corner)
   mode   "body": the whole character fits the box (feet at the bottom)
          "head": the head fills the box (close-ups, vents, posters)
   shade  how dark the character is there (0 = full light, 0.9 = almost black)
   role   who it is (when the spot's name is not the role)
   rot    turned this many degrees
   cut    only drawn inside [left, top, width, height]
   same   looks the same with and without the camera flashlight
   kind   "lunge" = reaching for you (otherwise standing)
   ===================================================================== */
"use strict";
"""


def write_poses(b, rooms_light):
    """tools/tape2/poses.js: every spot, with how dark the character looked there."""
    L = [POSES_HEAD, '// camera number -> spot -> where (spot = the role, unless it says role:)', 'const CAM_POSES = {']
    cams = {}
    for c, name, s, cos, mode, box, opt in CAM_POSES:
        e = dict(box=[v / 2 for v in box], mode=mode,
                 shade=measured_shade(costume_image(b, s, cos), rooms_light[c], box))
        if 'role' in opt:
            e['role'] = opt['role']
        if opt.get('rot'):
            e['rot'] = float(opt['rot'])
        if 'cut' in opt:
            x0, y0, x1, y1 = [v / 2 for v in opt['cut']]
            e['cut'] = [x0, y0, x1 - x0, y1 - y0]
        if opt.get('light'):
            e['same'] = True
        if name == 'shadow':
            e['tint'] = True
        cams.setdefault(c, {})[name] = e
    for (c, role), other in CAM_BORROW.items():
        e = {k: v for k, v in cams[c][other].items() if k != 'role'}
        cams[c][role] = e
    for c in sorted(cams):
        L.append(f'  {c}: {{')
        L += [f'    {k}: {js_obj(e)},' for k, e in cams[c].items()]
        L.append('  },')
    L += ['};', '', '// the office: hall-<who> (hall light), ventL- / ventR-<who> (vent lights), in-<who> (in the office)',
          'const OFFICE_POSES = {']
    for name, cos, base, mode, box in OFFICE_POSES:
        role = name.split('-', 1)[1]
        spot = name.split('-')[0]
        shade = measured_shade(costume_image(b, 'The office', cos), costume_image(b, 'The office', base), box)
        if role == 'golden':
            shade = max(shade, 0.35)
        e = dict(box=[v / 2 for v in office_spot(name, box)], mode=mode, shade=shade)
        if spot == 'in':
            e['kind'] = 'lunge'
        if spot in NEW_VENT_HOLE:
            x0, y0, x1, y1 = [v / 2 for v in NEW_VENT_HOLE[spot]]
            e['cut'] = [x0, y0, x1 - x0, y1 - y0]
        L.append(f'  {json.dumps(name)}: {js_obj(e)},')
    L += ['};', '', '// posters, paper plates and plushies in the rooms ("office" or the camera number);',
          '// in a dark room the game makes them darker', 'const ROOM_COVERS = {']
    for key, sprite in [('office', 'The office')] + [(str(c), r[0]) for c, r in ROOMS.items()]:
        spots = cover_spots(sprite)
        if spots:
            L.append(f'  {json.dumps(key)}: [')
            L += [f'    {js_obj(e)},' for e in spots]
            L.append('  ],')
    L += ['};', '']
    open(os.path.join(HERE, 'poses.js'), 'w', encoding='utf-8').write('\n'.join(L))


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def apply(b):
    chars = {r: Char(b, r) for r in ROLES}
    stand_ins = [r for r in ROLES if chars[r].stand_in]
    if stand_ins:
        b.notes.append('stand-in 2D drawings (until there is a 3D model or a drawing): ' + ', '.join(stand_ins))
    art = {}

    # ---- the office (empty) ----
    office = {}
    for name in ('000', '010', '100', '001'):
        # Aidan's office (saved 3 pixels per game unit so it stays sharp; see "big" in flatten.py)
        im = Image.open(os.path.join(OFFICE_DIR, name + '.png')).convert('RGB').resize((1440, 690), Image.LANCZOS)
        rel = save_img(b, im, f'office-{name}')
        office[name] = room_pic(rel, 480, 230)
    art['Office'] = office

    # ---- the cameras (empty rooms) ----
    rooms_light = {}
    for cam, (sprite, dark, light) in ROOMS.items():
        g = {}
        dim = costume_image(b, sprite, dark)
        w, h = dim.width / 2, dim.height / 2
        g['dark'] = room_pic(save_img(b, dim, f'cam{cam}-dark'), w, h, cover_layers(sprite, dark, dim=True))
        if light:
            lim = costume_image(b, sprite, light)
        else:
            # no lit empty picture (the stage): brighten the dark one
            a = np.asarray(dim).astype(float)
            lim = Image.fromarray(np.clip(a * 1.9 + 8, 0, 255).astype(np.uint8))
            light = dark
        rooms_light[cam] = lim
        g['light'] = room_pic(save_img(b, lim, f'cam{cam}-light'), w, h, cover_layers(sprite, light))
        art[f'Cam{cam}'] = g
    write_poses(b, rooms_light)

    # ---- every character's 2D drawing, standing (used when there is no 3D model) ----
    art['Chars'] = {}
    for r, ch in chars.items():
        x0, y0, x1, y1 = ch.body
        H = 300.0
        W = (x1 - x0) * H / (y1 - y0)
        art['Chars'][r] = dict(w=W, h=H, cx=W / 2, cy=H, layers=[ch.layer([0, 0, W, H], 'body')])

    # ---- the two custom night prizes that are not characters (the others are drawn by the game) ----
    plush = {}
    for spr, cos in (('Sprite61', 'FNAF2CupcakePlushie'), ('Sprite65', 'LoneMicrophone')):
        t = next(t for t in b.project['targets'] if t['name'] == spr)
        c = next(c for c in t['costumes'] if c['name'] == cos)
        plush[spr] = {k: v for k, v in b.costume(t, c).items() if k != 'name'}
    art['Plush'] = plush
    # custom night: the red star over each character's right eye (stronger the harder they are)
    star = Image.open(os.path.join(HERE, 'eye_star.png')).convert('RGBA')
    sw, sh = 48.0, 48.0 * star.height / star.width
    art['Custom'] = {'star': dict(w=sw, h=sh, cx=sw / 2, cy=sh / 2,
                                  layers=[dict(img=save_img(b, star, 'custom-star'), x=0, y=0, w=sw, h=sh)])}
    # the title screen after the GET READY run: "Eddies Riceria", with the rainbow guy crying
    cry = Image.open(os.path.join(HERE, 'riceria_crying.png')).convert('RGBA')
    ch_ = 330.0
    cw_ = ch_ * cry.width / cry.height
    art['Riceria'] = {'crying': dict(w=cw_, h=ch_, cx=cw_ / 2, cy=ch_ / 2,
                                     layers=[dict(img=save_img(b, cry, 'riceria-crying'), x=0, y=0, w=cw_, h=ch_)])}
    art['Loading'] = {'icon': dict(w=40, h=40, cx=20, cy=20, spin=True,
                                   layers=[dict(img='assets/loading-rice.webp', x=-3, y=4.85, w=46, h=34.85)])}

    # ---- 8-bit versions of the cast (for the death minigames) ----
    pix = {}
    for r, tall in (('wfreddy', 46), ('foxy', 46), ('puppet', 60), ('wbonnie', 46), ('wchica', 46), ('tfreddy', 46)):
        ch = chars[r]
        path = os.path.join(b.out_root, ch.src)
        for kind in ('body', 'head'):
            x0, y0, x1, y1 = ch.body if kind == 'body' else ch.head
            k = (tall if kind == 'body' else 20) / (y1 - y0)
            text = open(path, encoding='utf-8').read()
            im = Image.open(io.BytesIO(b.renderer.svg_to_png(text, ch.w, ch.h, k))).convert('RGBA')
            im = im.crop((int(x0 * k), int(y0 * k), int(math.ceil(x1 * k)), int(math.ceil(y1 * k))))
            a = np.array(im)
            a[:, :, 3] = np.where(a[:, :, 3] > 110, 255, 0)
            rgb = Image.fromarray(a[:, :, :3]).quantize(12).convert('RGB')
            out = np.dstack([np.array(rgb), a[:, :, 3]]).astype(np.uint8)
            rel = save_img(b, Image.fromarray(out), f'pixel-{kind}-{r}')
            u = 3                                               # 1 pixel = 3 game units
            W, H = out.shape[1] * u, out.shape[0] * u
            pix[(r if kind == 'body' else 'head-' + r)] = dict(w=W, h=H, cx=W / 2, cy=H / 2 if kind == 'head' else H,
                                                                pixel=True, layers=[dict(img=rel, x=0, y=0, w=W, h=H)])
    # Aidan's own Endo for the GET READY run (minigame_endo.png), made 8-bit like the others:
    # 64 pixels tall, shown as tall as the other runners
    im = Image.open(os.path.join(HERE, 'minigame_endo.png')).convert('RGBA')
    k = 64 / im.height
    im = im.resize((max(1, round(im.width * k)), 64), Image.LANCZOS)
    a = np.array(im)
    a[:, :, 3] = np.where(a[:, :, 3] > 110, 255, 0)
    rgb = Image.fromarray(a[:, :, :3]).quantize(16).convert('RGB')
    out = np.dstack([np.array(rgb), a[:, :, 3]]).astype(np.uint8)
    rel = save_img(b, Image.fromarray(out), 'pixel-body-runner')
    u = 3 * 46 / 64
    W, H = out.shape[1] * u, out.shape[0] * u
    pix['runner'] = dict(w=W, h=H, cx=W / 2, cy=H, pixel=True, layers=[dict(img=rel, x=0, y=0, w=W, h=H)])
    art['Pixel'] = pix
    b.notes.append(f"cast: {sum(len(v) for v in art.values())} pictures (the characters are drawn by the game)")
    return art
