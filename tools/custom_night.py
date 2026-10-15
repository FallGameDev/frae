"""
custom_night.py
Rebuilds the Custom Night screen:
  - the words that were baked into the picture ("Customize Night",
    "A.I. Level", the easy/med/hard line) become real text
  - the character names stay real text
  - the four head icons are drawn from the character files
    (Eddy.svg, Weddy.svg, Cheddy.svg, Endo.svg), showing only their top
    (head) part, so a mod that changes a character changes its icon too
"""
import io, os
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image

import cameras
import mods


def custom_night(b):
    t = next(t for t in b.project['targets'] if t['name'] == 'Backdrop')
    c = next(c for c in t['costumes'] if c['name'] == 'custom night')
    path = os.path.join(b.src, c['md5ext'])
    text = open(path, encoding='utf-8').read()
    ox, oy, w, h = b.svg_size(text)
    root = ET.fromstring(text)
    everything = cameras.flatten(root)
    for i, e in enumerate(everything):
        e['n'] = i                               # position in the file (same every time it is read)
    paths = [p for p in everything if p['pts'] is not None]

    # 1. the four drawn heads (grouped by their colors, like the cameras)
    heads, cur = [], None
    for p in paths:
        who = cameras.char_of(p['fill'])
        if p['fill'] == '#ecff00':
            who = cur['char'] if cur else 'Eddy'
        if not who:
            continue
        if cur is None or cur['char'] != who:
            cur = dict(char=who, parts=[], face=[], silhouette=False)
            heads.append(cur)
        cur['parts'].append(p)
    ids = {id(p['el']) for hd in heads for p in hd['parts']}
    for p in paths:
        if id(p['el']) in ids or p['fill'] not in cameras.FACE or not p['sig'].startswith('Mc'):
            continue                              # (the big black cover box is not a face)
        cx, cy = p['pts'].mean(axis=0)
        for hd in heads:
            allp = np.vstack([q['pts'] for q in hd['parts']])
            (x0, y0), (x1, y1) = allp.min(axis=0), allp.max(axis=0)
            if x0 <= cx <= x1 and y0 <= cy <= y1:
                hd['face'].append(p)

    # 2. head icons from the character files, cut to where each drawn head really is
    #    (measured from a picture of just that head; curve handles reach too far)
    head_ns = {p['n'] for hd in heads for p in hd['parts'] + hd['face']}

    def render_only(keep):
        r = ET.fromstring(text)
        parent = {id(ch): par for par in r.iter() for ch in par}
        for n, e in enumerate(cameras.flatten(r)):
            if e['pts'] is None and e['sig'] not in ('image', 'text'):
                continue
            e['n'] = n
            if not keep(e):
                parent[id(e['el'])].remove(e['el'])
        return np.array(Image.open(io.BytesIO(b.renderer.svg_to_png(ET.tostring(r, encoding='unicode'), w, h, 2))).convert('RGBA'))

    icon_layers = []
    for hd in heads:
        mine = {p['n'] for p in hd['parts'] + hd['face']}
        a = render_only(lambda e: e['n'] in mine)[:, :, 3]
        ys, xs = np.where(a > 20)
        A = b.char_assets[hd['char']]
        m = cameras.fit_instance(hd, A)
        # stop at the chin of the character file too, so no body shows under the head
        head = next(q for q in A.paths if q['sig'].startswith('Mccccc') and len(q['sig']) == 33)
        chin = cameras.apply(m, head['pts'])[:, 1].max() - oy
        bottom = min(ys.max() / 2 + 1, chin)
        box = [xs.min() / 2 - 1, ys.min() / 2 - 1, (xs.max() - xs.min()) / 2 + 2, bottom - (ys.min() / 2 - 1)]
        # clip the file to the drawn head's outline (ears + head), so no body shows
        outline = [[q['el'].get('d'), [round(v, 5) for v in cameras.mul([1, 0, 0, 1, -ox, -oy], q['m'])]]
                   for q in hd['parts']]
        icon_layers.append(dict(img=b.char_src[hd['char']], m=[round(v, 5) for v in cameras.mul([1, 0, 0, 1, -ox, -oy], m)],
                                iw=A.w, ih=A.h, outline=outline, top=round(box[1], 3)))

    # 3. find the words: render the old screen without the heads, keep the light pixels
    svg_words = []
    for e in everything:
        if e['sig'] == 'text':
            el = e['el']
            words = ''.join(el.itertext()).strip()
            size = float(el.get('font-size', 40)) * (e['m'][0] ** 2 + e['m'][1] ** 2) ** 0.5
            font = {'Sans Serif': mods.SANS, 'Serif': 'Serif', 'Pixel': mods.SCRATCH_PIXEL}.get(el.get('font-family'), mods.SANS)
            svg_words.append(dict(text=words, font=font, color=(el.get('fill') or '#ffffff'),
                                  at=[round(e['m'][4] - ox, 3), round(e['m'][5] - oy, 3), round(size, 3)]))
    # the other words were baked into the picture: render without heads or SVG text, keep the light pixels
    px = render_only(lambda e: e['n'] not in head_ns and e['sig'] != 'text').astype(int)
    rgb = px[:, :, :3]
    light = (rgb.min(axis=2) > 110) & (rgb.max(axis=2) - rgb.min(axis=2) < 40) & (px[:, :, 3] > 200)
    only_text = np.zeros_like(px)
    only_text[light, 3] = 255
    only_text[light, :3] = rgb[light]
    S, M = mods.SANS, mods.MONO
    # the screen in bands (top to bottom), so close lines do not run together
    head_top = min(L['top'] for L in icon_layers)
    for L in icon_layers:
        del L['top']
    bands = [
        (38, 68, [[('Customize Night', M)]]),
        (head_top, h, [[('A.I. Level', M), ('A.I. Level', M), ('A.I. Level', M), ('A.I. Level', M)],
                       [('(0-2)easy  (3-6)med  (7-12)hard (12+)extreme', M)]]),
    ]
    text_layers = list(svg_words)
    for y0, y1, lines in bands:
        part = np.zeros_like(only_text)
        part[int(y0 * 2):int(y1 * 2)] = only_text[int(y0 * 2):int(y1 * 2)]
        if (part[:, :, 3] > 0).any():
            text_layers += mods.text_layers(part, lines, M, 'Backdrop', 'custom night')

    # 4. the picture area was all black under the words and heads
    img_top = 45 - 6.9807                       # where the old picture started (from the SVG)
    layers = [dict(rect=[0, round(img_top, 3), w, round(h - img_top, 3)], fill='#000000')] + icon_layers + text_layers
    res = c.get('bitmapResolution', 1)
    b.custom[('Backdrop', 'custom night')] = dict(
        name='custom night', w=w, h=h, cx=c['rotationCenterX'] / res - ox, cy=c['rotationCenterY'] / res - oy,
        layers=layers)
    b.notes.append(f'custom night: {len(text_layers)} words as real text, {len(icon_layers)} head icons from character files')
