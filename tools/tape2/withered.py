"""
withered.py
Makes the withered characters look like FNaF 2's withered animatronics:
torn up (holes with the endoskeleton and wires showing, ripped edges,
grime) and misconfigured (head knocked crooked, plus one thing each):

  wfreddy  Withered Eddy    an eye socket emptied out, torn ear
  wbonnie  Withered Weddy   no face: a black hole with endoskeleton eyes and teeth
  wchica   Withered Cheddy  jaw broken open and hanging
  foxy     Withered Endo    chest ripped open, a chunk bitten out of an ear

Works on any full-body drawing (the game uses Aidan's 2D drawings for
these until there are 3D models), so it also works on new drawings.
  wither(image, role) -> image
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WITHERED = ('wfreddy', 'wbonnie', 'wchica', 'foxy')
DARK = (22, 18, 16)
ENDO = (150, 150, 158)
WIRES = [(200, 40, 30), (40, 90, 200), (220, 190, 40), (40, 160, 70)]


def _jagged(cx, cy, r, rng, n=14, rough=0.45, squash=1.0):
    """A ragged, torn-looking outline around (cx, cy)."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-0.15, 0.15)
        rr = r * (1 - rough + rough * 2 * rng.random())
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * squash))
    return pts


def _tear(im, cx, cy, r, rng, squash=1.0):
    """A torn hole: dark inside, a frayed rim, an endoskeleton strut and wires showing."""
    w, h = im.size
    hole = Image.new('L', (w, h), 0)
    pts = _jagged(cx, cy, r, rng, squash=squash)
    ImageDraw.Draw(hole).polygon(pts, fill=255)
    hole = Image.composite(hole, Image.new('L', (w, h), 0), im.getchannel('A').point(lambda v: 255 if v > 100 else 0))
    inside = Image.new('RGBA', (w, h), DARK + (255,))
    d = ImageDraw.Draw(inside)
    # an endoskeleton bar and a joint
    ang = rng.uniform(0, math.pi)
    dx, dy = math.cos(ang) * r * 1.4, math.sin(ang) * r * 1.4
    d.line([(cx - dx, cy - dy), (cx + dx, cy + dy)], fill=ENDO, width=max(2, int(r * 0.32)))
    d.ellipse([cx - r * 0.22, cy - r * 0.22, cx + r * 0.22, cy + r * 0.22], fill=(110, 110, 118))
    # loose wires
    for _ in range(rng.randint(1, 3)):
        col = WIRES[rng.randrange(len(WIRES))]
        a0 = rng.uniform(0, 2 * math.pi)
        p = [(cx + math.cos(a0) * r, cy + math.sin(a0) * r)]
        for k in range(3):
            p.append((p[-1][0] + rng.uniform(-r, r) * 0.7, p[-1][1] + rng.uniform(-r, r) * 0.7))
        d.line(p, fill=col, width=max(1, int(r * 0.09)))
    # the rim: torn fabric, a bit darker than the body around it
    rim = hole.filter(ImageFilter.MaxFilter(5))
    rgb = im.convert('RGB')
    darker = Image.eval(rgb, lambda v: int(v * 0.55))
    out = im.copy()
    out.paste(Image.merge('RGBA', (*darker.split(), im.getchannel('A'))), (0, 0), rim)
    out.paste(inside, (0, 0), hole)
    return out


def _bite(im, cx, cy, r, rng):
    """A chunk missing from the edge (see-through)."""
    a = np.array(im)
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).polygon(_jagged(cx, cy, r, rng, rough=0.5), fill=255)
    a[np.array(m) > 0, 3] = 0
    return Image.fromarray(a)


def _grime(im, rng):
    """Dirty and faded: duller colors, blotchy dark stains."""
    a = np.array(im).astype(float)
    rgb = a[:, :, :3]
    gray = rgb.mean(axis=2, keepdims=True)
    rgb = rgb * 0.72 + gray * 0.28                              # faded
    h, w = a.shape[:2]
    noise = Image.fromarray((np.array([rng.random() for _ in range(64)]).reshape(8, 8) * 255).astype(np.uint8))
    noise = np.array(noise.resize((w, h), Image.BICUBIC)).astype(float) / 255
    fine = Image.fromarray((np.array([rng.random() for _ in range(48 * 48)]).reshape(48, 48) * 255).astype(np.uint8))
    fine = np.array(fine.resize((w, h), Image.BICUBIC)).astype(float) / 255
    rgb = rgb * (0.95 - 0.28 * np.clip(noise * 1.4 - 0.3, 0, 1) - 0.12 * fine)[:, :, None]
    a[:, :, :3] = rgb
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def _find_neck(a, y0, y1):
    """The neck: the narrowest row between the head and the body (30-62% down)."""
    H = y1 - y0
    best, by = None, y0 + H * 0.45
    for y in range(int(y0 + H * 0.30), int(y0 + H * 0.62)):
        row = np.where(a[y])[0]
        if len(row) == 0:
            continue
        w = row.max() - row.min()
        if best is None or w < best:
            best, by = w, y
    return by


def _outline(im):
    a = np.array(im.getchannel('A')) > 100
    ys, xs = np.where(a)
    return a, xs.min(), xs.max(), ys.min(), ys.max()


def _inside_point(a, x0, x1, y0, y1, rng, avoid=None):
    for _ in range(200):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        if a[int(y), int(x)] and not (avoid and avoid(x, y)):
            return x, y
    return (x0 + x1) / 2, (y0 + y1) / 2


def _dark_blobs(im, box):
    """Dark features (eyes, mouth) inside box: [(x0, y0, x1, y1, area)] biggest first."""
    from collections import deque
    a = np.array(im)
    x0, y0, x1, y1 = [int(v) for v in box]
    sub = a[y0:y1, x0:x1]
    dark = (sub[:, :, :3].max(axis=2) < 70) & (sub[:, :, 3] > 100)
    seen = np.zeros_like(dark)
    out = []
    H, W = dark.shape
    for sy in range(0, H, 2):
        for sx in range(0, W, 2):
            if not dark[sy, sx] or seen[sy, sx]:
                continue
            q = deque([(sy, sx)]); seen[sy, sx] = True; pts = []
            while q:
                y, x = q.popleft(); pts.append((x, y))
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < H and 0 <= nx < W and dark[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            out.append((x0 + min(xs), y0 + min(ys), x0 + max(xs) + 1, y0 + max(ys) + 1, len(pts)))
    return sorted(out, key=lambda b: -b[4])


def _tilt_head(im, top, neck, cx, deg, shift):
    """Knock the head crooked: the part above `neck` turns around the neck and slides over."""
    w, h = im.size
    head = im.crop((0, 0, w, int(neck)))
    body = im.copy()
    a = np.array(body); a[:int(neck), :, 3] = 0; body = Image.fromarray(a)
    # a bit of bare neck (endoskeleton) shows where the head moved
    d = ImageDraw.Draw(body)
    nw = (w * 0.02) + 3
    d.rectangle([cx - nw, neck - (neck - top) * 0.12, cx + nw, neck + 4], fill=ENDO + (255,))
    head = head.rotate(deg, resample=Image.BICUBIC, center=(cx, neck), expand=False)
    body.alpha_composite(head, (int(shift), int(-abs(shift) * 0.3)))
    return body


def wither(im, role, seed=None):
    im = im.convert('RGBA')
    # room around it, so a crooked head or a dropped jaw never gets cut off
    pad = int(max(im.size) * 0.12)
    big = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    big.paste(im, (pad, pad))
    im = big
    rng = __import__('random').Random(seed if seed is not None else role)
    a, x0, x1, y0, y1 = _outline(im)
    H = y1 - y0
    neck = _find_neck(a, y0, y1)
    cx = (x0 + x1) / 2
    face_box = (x0 + (x1 - x0) * 0.15, y0 + H * 0.08, x1 - (x1 - x0) * 0.15, neck)

    # ---- misconfiguration ----
    blobs = _dark_blobs(im, face_box)
    if role == 'wbonnie':
        # no face: the skin under the hair is gone, endoskeleton eyes and teeth in the dark
        fx0, fy0, fx1, fy1 = face_box
        d = ImageDraw.Draw(im)
        top = fy0 + (fy1 - fy0) * 0.32
        void = _jagged((fx0 + fx1) / 2, (top + fy1) / 2, (fx1 - fx0) * 0.36, rng, n=18, rough=0.18, squash=0.85)
        d.polygon(void, fill=DARK + (255,))
        ew = (fx1 - fx0) * 0.07
        for ex in ((fx0 + fx1) / 2 - (fx1 - fx0) * 0.16, (fx0 + fx1) / 2 + (fx1 - fx0) * 0.16):
            ey = top + (fy1 - top) * 0.3
            d.ellipse([ex - ew * 1.6, ey - ew * 1.6, ex + ew * 1.6, ey + ew * 1.6], fill=(70, 70, 76, 255))
            d.ellipse([ex - ew * 0.55, ey - ew * 0.55, ex + ew * 0.55, ey + ew * 0.55], fill=(255, 235, 235, 255))
        ty = top + (fy1 - top) * 0.72
        for i in range(6):
            tx = (fx0 + fx1) / 2 + (i - 2.5) * ew * 1.5
            d.rectangle([tx - ew * 0.55, ty - ew * 0.9, tx + ew * 0.55, ty + ew * 0.9], fill=(225, 220, 205, 255))
    elif role == 'wchica' and blobs:
        # jaw broken: everything under the mouth drops and hangs crooked, teeth showing in the gap
        mouth = blobs[0]
        jy = mouth[1] + (mouth[3] - mouth[1]) * 0.35
        w, h = im.size
        jx0, jx1, jy1 = int(face_box[0]) - 5, int(face_box[2]) + 5, int(neck)
        jaw = Image.new('RGBA', im.size, (0, 0, 0, 0))
        jaw.paste(im.crop((jx0, int(jy), jx1, jy1)), (jx0, 0))
        cut = np.array(im); cut[int(jy):jy1, jx0:jx1, 3] = 0
        base = Image.fromarray(cut)
        drop = H * 0.07
        d = ImageDraw.Draw(base)
        d.rectangle([mouth[0] - 4, jy - 2, mouth[2] + 4, jy + drop + 4], fill=DARK + (255,))
        tw = (mouth[2] - mouth[0]) / 7
        for i in range(6):
            tx = mouth[0] + tw * (i + 0.8)
            d.polygon([(tx - tw * 0.4, jy), (tx + tw * 0.4, jy), (tx, jy + tw * 0.9)], fill=(225, 220, 205, 255))
        jaw = jaw.rotate(-9, resample=Image.BICUBIC, center=(mouth[0], 0), expand=False)
        base.alpha_composite(jaw, (0, int(jy + drop)))
        im = base
    elif role == 'wfreddy' and len(blobs) >= 2:
        # one eye socket emptied out: just a black hole with a tiny light far inside
        eyes = sorted(blobs[1:3] if len(blobs) > 2 else blobs[:2], key=lambda b: b[0])
        e = eyes[-1]
        d = ImageDraw.Draw(im)
        ecx, ecy = (e[0] + e[2]) / 2, (e[1] + e[3]) / 2
        r = max(e[2] - e[0], e[3] - e[1]) * 0.75
        d.ellipse([ecx - r, ecy - r * 0.9, ecx + r, ecy + r * 0.9], fill=DARK + (255,))
        d.ellipse([ecx - r * 0.18, ecy - r * 0.18, ecx + r * 0.18, ecy + r * 0.18], fill=(255, 245, 230, 255))

    # ---- torn up: holes with the endoskeleton showing ----
    rs = H * 0.05
    a, x0, x1, y0, y1 = _outline(im)
    in_face = lambda x, y: face_box[0] < x < face_box[2] and face_box[1] < y < face_box[3]
    n_holes = {'foxy': 4, 'wfreddy': 5, 'wbonnie': 4, 'wchica': 5}.get(role, 4)
    for i in range(n_holes):
        x, y = _inside_point(a, x0, x1, neck, y1 - H * 0.04, rng, avoid=in_face)
        im = _tear(im, x, y, rs * rng.uniform(0.7, 1.25), rng, squash=rng.uniform(0.7, 1.2))
    if role == 'foxy':
        # chest ripped wide open
        im = _tear(im, cx + (x1 - x0) * 0.05, neck + H * 0.17, rs * 2.3, rng, squash=0.8)
    # ripped edges: chunks missing from the ears / sides
    for i in range({'foxy': 3, 'wfreddy': 2}.get(role, 1)):
        ex = x0 + (x1 - x0) * (0.12 if i % 2 == 0 else 0.88)
        ey = y0 + H * rng.uniform(0.03, 0.14)
        im = _bite(im, ex, ey, rs * rng.uniform(0.8, 1.3), rng)

    im = _grime(im, rng)
    # ---- head knocked crooked ----
    deg = {'wfreddy': 7, 'wbonnie': -6, 'wchica': 5, 'foxy': -9}.get(role, 5)
    a, x0, x1, y0, y1 = _outline(im)
    im = _tilt_head(im, y0, neck, (x0 + x1) / 2, deg, (x1 - x0) * 0.03 * (1 if deg < 0 else -1))
    return im
