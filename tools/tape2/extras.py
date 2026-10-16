"""
extras.py
Pictures made for Tape 2 that are not straight copies of a Scratch costume:

  - the camera map with no button lit (the game lights the picked one itself)
    plus where each of the 12 camera buttons sits on it
"""
import os
import numpy as np
from PIL import Image


def lit_box(im):
    """Where the lit (yellow-green) camera button is in a map picture, in pixels."""
    a = np.array(im.convert('RGBA')).astype(int)
    m = (a[:, :, 1] > 150) & (a[:, :, 2] < 100) & (a[:, :, 3] > 200)
    ys, xs = np.where(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def camera_map(b):
    t = next(t for t in b.project['targets'] if t['name'] == 'Map2')
    full = next(c for c in t['costumes'] if c['name'] == '08')
    res = full['bitmapResolution']
    im = Image.open(os.path.join(b.src, full['md5ext'])).convert('RGBA')
    buttons = {}
    for c in t['costumes']:
        cim = Image.open(os.path.join(b.src, c['md5ext'])).convert('RGBA')
        x0, y0, x1, y1 = lit_box(cim)
        # the small pictures (cams 1-7) line up with the full map by their pins
        dx = full['rotationCenterX'] - c['rotationCenterX']
        dy = full['rotationCenterY'] - c['rotationCenterY']
        buttons[int(c['name'])] = [(x0 + dx) / res, (y0 + dy) / res, (x1 - x0) / res, (y1 - y0) / res]
    # turn the lit button (cam 8) gray like the rest (the lime fill becomes the dark button gray)
    a = np.array(im).astype(int)
    lime = (np.abs(a[:, :, :3] - [194, 221, 0]).sum(axis=2) < 90) & (a[:, :, 3] > 0)
    a[lime, :3] = [50, 53, 69]
    a = a.astype(np.uint8)
    rel = b.out_name('img', 'camera-map', 'webp')
    b.save_webp(Image.fromarray(a), rel)
    w, h = im.width / res, im.height / res
    out = {'map': dict(w=w, h=h, cx=full['rotationCenterX'] / res, cy=full['rotationCenterY'] / res,
                       layers=[dict(img=rel, x=0, y=0, w=w, h=h)],
                       buttons={k: [round(v, 2) for v in r] for k, r in sorted(buttons.items())})}
    # each button lit up (lime with its own white words), drawn over the map for the camera you watch
    for k, (x, y, bw, bh) in buttons.items():
        x0, y0 = int(round(x * res)), int(round(y * res))
        crop = a[y0:y0 + int(round(bh * res)), x0:x0 + int(round(bw * res))].astype(int)
        gray = (np.abs(crop[:, :, :3] - [50, 53, 69]).sum(axis=2) < 40) & (crop[:, :, 3] > 0)
        crop[gray, :3] = [194, 221, 0]
        rel = b.out_name('img', f'cam-button-{k:02d}', 'webp')
        b.save_webp(Image.fromarray(crop.astype(np.uint8)), rel)
        out[f'lit{k}'] = dict(w=bw, h=bh, cx=0, cy=0, layers=[dict(img=rel, x=0, y=0, w=bw, h=bh)])
    return out


def apply(b, pictures):
    out = {'Map': camera_map(b)}
    b.notes.append('made the plain camera map (12 buttons)')
    return out
