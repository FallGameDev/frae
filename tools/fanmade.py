"""
fanmade.py
Replaces every picture that still showed the original FNaF characters with
Aidan's characters, drawn from the character files:

  FNaF          ->  Fried Rice at Eddie's
  Freddy        ->  Eddy
  Bonnie        ->  Weddy
  Chica         ->  Cheddy
  Foxy          ->  Endo
  Golden Freddy ->  Golden (the yellow bear drawing)

Rebuilt:
  - jumpscares (Bonnie, Chica, Foxy frames, Freddy's power-out scare)
  - Foxy running down the west hall (31 frames)
  - the four "NICE TRY!" game over portraits
  - hallucinations (Bonnie eyes, Freddy face)
  - Golden Freddy slumped in the west hall corner
  - the secret Freddy dance (91 frames)
  - "THE END" picture (the Mike card stays, the background gets the new cast)
Rooms and the stage stay the same.
Scary faces use the characters' power-out faces (the *-po-out files).
"""
import io, math, os, re, shutil
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import cameras

HEAD_SIGS = {'Mccccc24', 'Mccccc19', 'Mccccc33', 'Mcvccc36'}   # ears + head in every character file


def is_head(q):
    """Ears and head shapes (shape type + number of steps, same in every character file)."""
    return q['sig'][:6] + str(len(q['sig'])) in HEAD_SIGS and not cameras.is_face(q)


def head_box(A):
    pts = np.vstack([q['pts'] for q in A.paths if is_head(q)])
    (x0, y0), (x1, y1) = np.percentile(pts, 2, axis=0), np.percentile(pts, 98, axis=0)
    return x0, y0, x1, y1


def ease(t):
    return t * t * (3 - 2 * t)


class Cast:
    def __init__(self, b):
        self.b = b
        char_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'characters')
        # Golden: the yellow bear drawing from the Golden sprite becomes a character file too
        gold = next(t for t in b.project['targets'] if t['name'] == 'Golden')['costumes'][0]
        gpath = os.path.join(b.out_root, 'assets', 'characters', 'Golden.svg')
        shutil.copy(os.path.join(b.src, gold['md5ext']), gpath)
        b.char_src['Golden'] = 'assets/characters/Golden.svg'
        _, _, self.golden_w, self.golden_h = b.svg_size(open(gpath, encoding='utf-8').read())

    def scary(self, name):
        """The character's power-out face file (wide eyes, big grin), if there is one."""
        for rel, info in self.b.variant_info.items():
            if rel.endswith(f'/{name.lower()}-po-out.svg'):
                return rel, info
        return None

    def layers(self, name, hx, hy, hh, rot=0.0, scary=False, shade=0.0, head_only=False):
        """Character `name` with its head centered at (hx, hy), head `hh` tall, turned `rot` degrees."""
        A = self.b.char_assets[name]
        x0, y0, x1, y1 = head_box(A)
        s = hh / (y1 - y0)
        r = math.radians(rot)
        a, bb = s * math.cos(r), s * math.sin(r)
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        m = [a, bb, -bb, a, hx - (a * mx - bb * my), hy - (bb * mx + a * my)]
        base = dict(img=self.b.char_src[name], m=[round(v, 5) for v in m], iw=A.w, ih=A.h)
        if head_only:
            base['outline'] = [[q['el'].get('d'), [round(v, 5) for v in cameras.mul(m, q['m'])]]
                               for q in A.paths if is_head(q)]
        out = [base]
        if scary:
            sc = self.scary(name)
            if sc:
                rel, (vx, vy, vw, vh) = sc
                over = dict(img=rel, m=[round(v, 5) for v in cameras.mul(m, [1, 0, 0, 1, vx, vy])], iw=vw, ih=vh)
                out.append(over)
        if shade:
            for L in out:
                L['shade'] = round(shade, 3)
        return out


def save(b, im, label):
    rel = b.out_name('img', label, 'webp')
    b.save_webp(im, rel)
    return rel


def frame_no(name):
    return int(re.search(r'\((\d+)\)', name).group(1))


def fanmade(b):
    cast = Cast(b)
    T = {t['name']: t for t in b.project['targets']}
    count = 0

    # ---- the office as seen in a jumpscare (rendered once) ----
    office = next(c for c in T['office']['costumes'] if c['name'] == 'normal')
    otext = open(os.path.join(b.src, office['md5ext']), encoding='utf-8').read()
    ox, oy, ow, oh = b.svg_size(otext)
    office_img = save(b, Image.open(io.BytesIO(b.renderer.svg_to_png(otext, ow, oh, 2))), 'jumpscare-office')

    def office_bg(w, h):
        k = max(w / ow, h / oh)                      # cover the frame
        return [dict(rect=[0, 0, w, h], fill='#000000'),
                dict(img=office_img, x=round((w - ow * k) / 2, 3), y=round((h - oh * k) / 2, 3), w=round(ow * k, 3), h=round(oh * k, 3))]

    def costume(t, c, layers):
        res = c.get('bitmapResolution', 1)
        w, h = c_size(b, c)
        b.custom[(t['name'], c['name'])] = dict(name=c['name'], w=w, h=h, cx=c['rotationCenterX'] / res,
                                                cy=c['rotationCenterY'] / res, clip=True, layers=layers)

    # ---- 1. jumpscares: the character lunges at you ----
    for sprite, who in [('Bonnie', 'Weddy'), ('Chica', 'Cheddy'), ('Foxy', 'Endo')]:
        frames = T[sprite]['costumes']
        n = max(frame_no(c['name']) for c in frames)
        for c in frames:
            k = (frame_no(c['name']) - 1) / max(1, n - 1)
            w, h = c_size(b, c)
            jit = math.sin(k * 41) * 4
            if who == 'Endo' and k < 0.45:
                # Endo runs in from the left door first
                u = ease(k / 0.45)
                hx, hy, hh = 70 + 160 * u, 92 + math.sin(k * 30) * 4, 48 + 62 * u
            else:
                u = ease(k if who != 'Endo' else (k - 0.45) / 0.55)
                hx, hy, hh = w / 2 + jit, h * 0.5 + 6 * u, 110 + 210 * u
            layers = office_bg(w, h) + cast.layers(who, hx, hy, hh, rot=math.sin(k * 23) * 6, scary=True, shade=0.12)
            costume(T[sprite], c, layers)
            count += 1
    # Freddy's power-out scare (one frame): Eddy right in your face, lights out
    for c in T['red dot']['costumes']:
        if c['name'].startswith('FreddyScare'):
            w, h = c_size(b, c)
            layers = office_bg(w, h) + [dict(rect=[0, 0, w, h], fill='rgba(0,0,0,0.75)')] + \
                cast.layers('Eddy', w / 2, h * 0.52, 250, rot=-4, scary=True, shade=0.15)
            costume(T['red dot'], c, layers)
            count += 1

    # ---- 2. Endo running down the west hall ----
    wh = T['West Hall']
    room = next(c for c in wh['costumes'] if c['name'] == 'light on')
    room_rel = b.image_file(room['md5ext'], 'west-hall-light-on')['src']
    for c in wh['costumes']:
        if not c['name'].startswith('FoxyRun'):
            continue
        k = frame_no(c['name'])
        w, h = c_size(b, c)
        layers = [dict(img=room_rel, x=0, y=0, w=w, h=h)]
        if k <= 28:
            t = (k - 1) / 27
            body = 45 * 9 ** t                         # far and small -> right up to the camera
            cx = 290 - 110 * t * t
            bottom = 140 + 130 * t ** 1.5 + math.sin(k * 1.7) * body * 0.02
            if k == 28:
                body, cx, bottom = 560, 40, 360
            A = b.char_assets['Endo']
            x0, y0, x1, y1 = head_box(A)
            full = np.vstack([q['pts'] for q in A.paths])
            fh = full[:, 1].max() - full[:, 1].min()
            hh = body * (y1 - y0) / fh                 # head size for that body size
            hy = bottom - body + (((y0 + y1) / 2 - full[:, 1].min()) / fh) * body
            layers += cast.layers('Endo', cx, hy, hh, rot=math.sin(k * 2.3) * 5, shade=0.45 * (1 - t) + 0.1)
        costume(wh, c, layers)
        count += 1

    # ---- 3. "NICE TRY!" game over portraits ----
    for cname, who in [('NoJSFreddy', 'Eddy'), ('NoJSBonnie', 'Weddy'), ('NoJSChica', 'Cheddy'), ('NoJSFoxy', 'Endo')]:
        c = next(c for c in T['Backdrop']['costumes'] if c['name'] == cname)
        text = open(os.path.join(b.src, c['md5ext']), encoding='utf-8').read()
        sx, sy, w, h = b.svg_size(text)
        root = ET.fromstring(text)
        words = cameras.take_text(root, sx, sy, 'Backdrop')
        parent = {id(ch): par for par in root.iter() for ch in par}
        portrait = None
        for e in cameras.flatten(root):
            if e['sig'] == 'image':
                el = e['el']
                ix, iy, iw, ih = [float(el.get(k, 0)) for k in ('x', 'y', 'width', 'height')]
                rw, rh = e['m'][0] * iw, e['m'][3] * ih
                if rw * rh < 0.5 * w * h:              # the small FNaF portrait
                    portrait = [e['m'][0] * ix + e['m'][4] - sx, e['m'][3] * iy + e['m'][5] - sy, rw, rh]
                    parent[id(el)].remove(el)
        bg = save(b, Image.open(io.BytesIO(b.renderer.svg_to_png(ET.tostring(root, encoding='unicode'), w, h, 2))), f'backdrop-{cname.lower()}')
        px, py, pw, ph = portrait
        layers = [dict(img=bg, x=0, y=0, w=w, h=h), dict(rect=[px, py, pw, ph], fill='#101010')]
        layers += cast.layers(who, px + pw / 2, py + ph / 2, ph * 0.86, scary=True, head_only=True)
        layers[-1]['cut'] = [px, py, pw, ph]
        if len(layers) > 3:
            layers[-2]['cut'] = [px, py, pw, ph]
        layers += words
        b.custom[('Backdrop', cname)] = dict(name=cname, w=w, h=h, cx=c['rotationCenterX'] - sx,
                                             cy=c['rotationCenterY'] - sy, clip=True, layers=layers)
        count += 1

    # ---- 4. hallucinations ----
    for cname, who, hh, shade in [('Bonnie Eyes', 'Weddy', 300, 0.5), ('Freddy', 'Eddy', 290, 0.1)]:
        c = next((c for c in T['hallucinations']['costumes'] if c['name'] == cname), None)
        if not c:
            continue
        w, h = c_size(b, c)
        layers = [dict(rect=[0, 0, w, h], fill='#000000')] + cast.layers(who, w / 2, h * 0.52, hh, scary=True, shade=shade)
        costume(T['hallucinations'], c, layers)
        count += 1

    # ---- 5. Golden slumped in the west hall corner ----
    whc = T['west hall corner']
    gc = next((c for c in whc['costumes'] if c['name'] == 'Golden Freddy'), None)
    if gc:
        clear = b.custom[('west hall corner', 'clear')]
        room_layer = next(L for L in clear['layers'] if L.get('img') and 'characters' not in L['img'])
        w, h = c_size(b, gc)
        layers = [dict(room_layer)]                    # the empty corner (Golden covers the spot, like Eddy does)
        # where FNaF's Golden Freddy sat in the old picture (slumped in the upper left corner)
        gx0, gx1, gy0, gy1 = 158, 246, 6, 118
        x0, y0, x1, y1 = 0, 0, cast.golden_w, cast.golden_h        # the bear fills its whole drawing
        s = (gy1 - gy0) / (y1 - y0)
        r = math.radians(-10)
        a, bb = s * math.cos(r), s * math.sin(r)
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        cx, cy = (gx0 + gx1) / 2, (gy0 + gy1) / 2
        m = [a, bb, -bb, a, cx - (a * mx - bb * my), cy - (bb * mx + a * my)]
        layers.append(dict(img=b.char_src['Golden'], m=[round(v, 5) for v in m], iw=cast.golden_w, ih=cast.golden_h, shade=0.55))
        costume(whc, gc, layers)
        count += 1

    # ---- 6. the secret dance: Eddy dancing under a spotlight ----
    dance = T['dance']['costumes']
    w, h = c_size(b, dance[0])
    bgim = Image.new('RGB', (int(w * 2), int(h * 2)), (8, 4, 14))
    glow = Image.new('L', bgim.size, 0)
    ImageDraw.Draw(glow).ellipse([w * 0.35, h * 0.1, w * 1.65, h * 1.9], fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    bgim = Image.composite(Image.new('RGB', bgim.size, (70, 30, 90)), bgim, glow)
    dance_bg = save(b, bgim, 'dance-spotlight')
    A = b.char_assets['Eddy']
    full = np.vstack([q['pts'] for q in A.paths])
    x0, y0, x1, y1 = head_box(A)
    fh = full[:, 1].max() - full[:, 1].min()
    for i, c in enumerate(dance):
        ph = i / len(dance) * 2 * math.pi * 6          # six dance beats
        bounce = abs(math.sin(ph)) * 10
        body = h * 0.82
        hh = body * (y1 - y0) / fh
        hy = h * 0.95 - body - bounce + (((y0 + y1) / 2 - full[:, 1].min()) / fh) * body
        layers = [dict(img=dance_bg, x=0, y=0, w=w, h=h)] + \
            cast.layers('Eddy', w / 2 + math.sin(ph / 2) * 18, hy, hh, rot=math.sin(ph) * 9)
        costume(T['dance'], c, layers)
        count += 1

    # ---- 7. "THE END": keep the Mike card and the words, new cast behind ----
    bd = T['Backdrop']
    pc = next((c for c in bd['costumes'] if c['name'] == 'pink slip2'), None)
    if pc:
        old = Image.open(os.path.join(b.src, pc['md5ext'])).convert('RGBA')
        arr = np.array(old).astype(int)
        # the card: the dark area in the middle and everything drawn on it
        dark = arr[:, :, :3].max(axis=2) < 18
        ys, xs = np.where(dark[100:400, 260:720])
        quad = np.stack([xs + 260, ys + 100], axis=1)
        from PIL import ImageDraw as D
        hull = convex_hull(quad)
        mask = Image.new('L', old.size, 0)
        D.Draw(mask).polygon([tuple(p) for p in hull], fill=255)
        card = old.copy(); card.putalpha(mask)
        # the hand-written "THE END": bright pixels near the bottom middle
        end = np.zeros(arr.shape[:2], np.uint8)
        region = (slice(420, 490), slice(370, 600))
        bright = arr[region][:, :, :3].min(axis=2) > 170
        end[region] = np.where(bright, 255, 0)
        words = old.copy(); words.putalpha(Image.fromarray(end).filter(ImageFilter.MaxFilter(3)))
        card_rel = save(b, card.crop(card.getbbox()), 'the-end-card')
        cb = card.getbbox()
        end_rel = save(b, words.crop(words.getbbox()), 'the-end-words')
        eb = words.getbbox()
        w, h = c_size(b, pc)
        layers = [dict(rect=[0, 0, w, h], fill='#0c0810')]
        layers += cast.layers('Weddy', 95, 115, 120, rot=-4, shade=0.6)
        layers += cast.layers('Cheddy', 395, 120, 115, rot=4, shade=0.6)
        layers += cast.layers('Eddy', 245, 85, 120, shade=0.65)
        layers.append(dict(img=card_rel, x=cb[0] / 2, y=cb[1] / 2, w=(cb[2] - cb[0]) / 2, h=(cb[3] - cb[1]) / 2))
        layers.append(dict(img=end_rel, x=eb[0] / 2, y=eb[1] / 2, w=(eb[2] - eb[0]) / 2, h=(eb[3] - eb[1]) / 2))
        costume(bd, pc, layers)
        count += 1

    # ---- 8. the little loading clock before each night becomes the spinning rice bowl ----
    lc = T['loading']['costumes'][0]
    w, h = c_size(b, lc)                                 # 40 x 40 units, centered
    rw, rh = 400, 303                                    # rice bowl picture size
    k = min(w / rw, h / rh) * 1.15
    b.custom[('loading', lc['name'])] = dict(name=lc['name'], w=w, h=h, cx=lc['rotationCenterX'] / 2,
        cy=lc['rotationCenterY'] / 2, spin=True,
        layers=[dict(img='assets/loading-rice.webp', x=round((w - rw * k) / 2, 3), y=round((h - rh * k) / 2, 3),
                     w=round(rw * k, 3), h=round(rh * k, 3))])
    count += 1

    # the hidden project thumbnail was a FNaF Freddy picture: it is never shown, so it goes
    b.project['targets'] = [t for t in b.project['targets'] if t['name'] != 'icon']
    b.notes.append(f'replaced {count} pictures of the original FNaF characters with the fan-made cast')


def c_size(b, c):
    res = c.get('bitmapResolution', 1)
    if c['dataFormat'] == 'svg':
        _, _, w, h = b.svg_size(open(os.path.join(b.src, c['md5ext']), encoding='utf-8').read())
        return w, h
    im = Image.open(os.path.join(b.src, c['md5ext']))
    return im.width / res, im.height / res


def convex_hull(pts):
    pts = sorted(set(map(tuple, pts.tolist())))
    if len(pts) < 3:
        return pts
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]
