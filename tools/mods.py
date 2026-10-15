"""
mods.py
Edits applied to the Scratch project for the web version of game 1.

  1. remove_copyright()     - deletes the "(c)2025 Aidan Kadrovic" sprite
  2. drop_unused_costumes() - costumes no script can ever show are skipped
  3. text_costumes()        - sprites that are only words become real text
  4. cameras.split_cameras()- camera views become "empty room + character"

Each edit writes replacement costumes into b.custom[(sprite, costume)].
"""
import io, os, re
import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# Which sprites become real text, which font they use, and what they say.
# Each costume lists its lines; each line lists its word groups (a "group"
# is text that sits together, like "Power left:" and the lone "%").
# ---------------------------------------------------------------------------
PIXEL = 'Press Start 2P'     # chunky FNaF-style clock / camera font
SANS = 'Sans Serif'          # Scratch's Noto Sans
MONO = 'Share Tech Mono'     # thin monospace menu font
SCRATCH_PIXEL = 'Pixel'      # Scratch's Grand9K Pixel
COURIER = 'Courier Prime'

ORD = {1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 7: '7th'}
TEXT = {
    'FNaF text': (SANS, {'text': [['Fried'], ['Rice'], ['at'], ['Eddies']]}),
    'continue': (MONO, {'text': [['Continue']]}),
    'new game': (MONO, {'text': [['New Game']]}),
    '6th Night': (SANS, {'string': [['Spooky']]}),
    'Custom Night': (SANS, {'string': [["It's already dark."]]}),
    'selection': (SANS, {'arrows': [['>>']]}),
    'what day': (PIXEL, {**{f'12:00AM {n} Night': [['12:00 AM'], [f'{ORD[n]} Night']] for n in ORD},
                         '12:00AM 6 Night': [['12:00 AM'], ['Spooky Night']]}),
    'Power Left %': (PIXEL, {'text': [['Power left:', '%']]}),
    'Usage word': (PIXEL, {'text': [['Usage:']]}),
    'Power 10': (PIXEL, {str(d): [[str(d)]] for d in range(10)}),
    'Power 01': (PIXEL, {str(d): [[str(d)]] for d in range(10)}),
    'time AM': (PIXEL, {'text': [['AM']], '12am': [['12 AM']], **{f'{h}am': [[f'{h} AM']] for h in range(1, 7)}}),
    'night': (PIXEL, {'text': [['Night']], 'string': [[('Night', MONO)]]}),
    'level': (PIXEL, {str(d): [[str(d)]] for d in range(1, 8)}),
    'Ready': (SANS, {'active': [['READY']]}),
    'SettingsButton': (MONO, {'Deselected': [['Settings']], 'Selected': [['Settings']]}),
    'Custom10': (SANS, {'1': [['1']], '2': [['2']]}),
    'Custom01': (SANS, {str(d): [[str(d)]] for d in range(10)}),
    'dine in': (SANS, {'text': [['Dine In']]}),
    'hallucinations': (COURIER, {"It's Me1": [["IT'S ME"]], "It's Me2": [["IT'S ME"]]}),
    '6am fore': (PIXEL, {'am5': [['5 AM']], 'am': [['AM']], 'am6': [['6 AM']]}),
    '6am back': (PIXEL, {'slide': [['5'], ['6']]}),
    'Secret??//Title': (SANS, {'costume1': [['Fried'], ['Rice'], ['At'], ['Eddies']]}),
    'Secret??//New/continue': (SANS, {'costume1': [['>>', 'Dine In'], ['Take Away']],
                                      'costume2': [['Dine In'], ['>>', 'Take Away']]}),
    'Secret??//Lyrics': (SCRATCH_PIXEL, {
        'costume1': [['were cooking every night'], ['up bowls of such delicous rice']],
        'costume2': [['newcomers can eat with us'], ['you could dine in or get takeaway']],
        'costume3': [['We could do brown or white'], ["we've been frying rice all of our lives"]],
        'costume4': [["No imposter's stealing recipes"], ["but its just rice ain't hard to make"]],
        'costume5': [['Please let us  in!'], ['thats what our customers say'], ['they want that door open']],
        'costume6': None, 'costume7': None,            # filled in from the SVG (see below)
        'costume8': None,
        'costume9': [['Fried Rice at Eddies'], ['Is this where you want to be']],
        'costume10': [['you wont regret it'], ['what would you wanna eat']],
        'costume12': [['Fried Rice At Eddies']],
    }),
}
# camera buttons: "CAM" over the camera number, in a box (gray = off, green = showing)
for cam in ['0', '1A', '1B', '1C', '2A', '2B', '3', '4A', '4B', '5', '6', '7']:
    TEXT['CAM' + cam] = (PIXEL, {'Inactive': [['CAM'], [cam]], 'Active': [['CAM'], [cam]]})
BACKED = {'6am back'}     # sprites whose black backing shape is rebuilt from rectangles


def apply(b):
    b.custom = {}
    b.notes = []
    remove_copyright(b)
    stop_title_music(b)
    new_settings(b)
    drop_unused_costumes(b)
    text_costumes(b)
    from cameras import split_cameras
    split_cameras(b)
    from custom_night import custom_night
    custom_night(b)
    from fanmade import fanmade
    fanmade(b)


# ---------------------------------------------------------------------------
# 1. Copyright sprite
# ---------------------------------------------------------------------------
def remove_copyright(b):
    b.project['targets'] = [t for t in b.project['targets'] if t['name'] != 'copyright']
    b.notes.append('removed sprite "copyright"')


# ---------------------------------------------------------------------------
# Bug fix: the title music kept playing in the night after "New Game"
# (only "Continue" stopped the title music loop). Adds this script to the stage:
#   when I receive [intro] -> stop [other scripts in sprite]
# ---------------------------------------------------------------------------
def stop_title_music(b):
    stage = next(t for t in b.project['targets'] if t['isStage'])
    bid = next(k for k, v in stage['broadcasts'].items() if v == 'intro')
    stage['blocks']['fix_intro_hat'] = {
        'opcode': 'event_whenbroadcastreceived', 'next': 'fix_intro_stop', 'parent': None,
        'inputs': {}, 'fields': {'BROADCAST_OPTION': ['intro', bid]},
        'shadow': False, 'topLevel': True, 'x': 0, 'y': -999}
    stage['blocks']['fix_intro_stop'] = {
        'opcode': 'control_stop', 'next': None, 'parent': 'fix_intro_hat',
        'inputs': {}, 'fields': {'STOP_OPTION': ['other scripts in sprite', None]},
        'mutation': {'tagName': 'mutation', 'children': [], 'hasnext': 'true'},
        'shadow': False, 'topLevel': False}
    b.notes.append('fixed: title music now stops when a night starts')


# ---------------------------------------------------------------------------
# The settings screen is now real HTML (see ui.js), so the old Scratch
# buttons are removed, the saved jumpscare setting is no longer reset to OFF
# on start, and the settings picture becomes plain black (the panel draws
# the words on top).
# ---------------------------------------------------------------------------
def new_settings(b):
    gone = {'JumpscareON', 'JumpscareOFF', 'ConfirmSettings'}
    b.project['targets'] = [t for t in b.project['targets'] if t['name'] not in gone]
    sb = next(t for t in b.project['targets'] if t['name'] == 'SettingsButton')
    for bid, blk in list(sb['blocks'].items()):
        if isinstance(blk, dict) and blk['opcode'] == 'event_whenflagclicked':
            nxt = sb['blocks'].get(blk['next'] or '')
            if nxt and nxt['opcode'] == 'data_setvariableto' and nxt['fields']['VARIABLE'][0] == 'Jumpscares':
                del sb['blocks'][blk['next']]
                del sb['blocks'][bid]
    bd = next(t for t in b.project['targets'] if t['name'] == 'Backdrop')
    c = next(c for c in bd['costumes'] if c['name'] == 'SettingsMenu')
    res = c.get('bitmapResolution', 1)
    w, h = 960 / res, 540 / res
    b.custom[('Backdrop', 'SettingsMenu')] = dict(name='SettingsMenu', w=w, h=h,
        cx=c['rotationCenterX'] / res, cy=c['rotationCenterY'] / res, layers=[dict(rect=[0, 0, w, h], fill='#000000')])
    b.notes.append('settings screen moved to HTML (old buttons removed)')


# ---------------------------------------------------------------------------
# 2. Costumes that can never be shown
# A sprite whose scripts only switch costumes by name (never "next costume",
# never by number) can only show the costumes it names. The rest are skipped.
# Costume numbers do not matter for these sprites, so removing them is safe.
# ---------------------------------------------------------------------------
def drop_unused_costumes(b):
    targets = b.project['targets']
    by_number = set()   # sprites whose costume number is read by another sprite
    for t in targets:
        for blk in t['blocks'].values():
            if isinstance(blk, dict) and blk['opcode'] == 'sensing_of' and blk['fields']['PROPERTY'][0] in ('costume #', 'backdrop #'):
                menu = t['blocks'][blk['inputs']['OBJECT'][1]]
                by_number.add(menu['fields']['OBJECT'][0])
    removed = 0
    for t in targets:
        blocks = [x for x in t['blocks'].values() if isinstance(x, dict)]
        dynamic = t['name'] in by_number or t['isStage']
        named = set()
        for blk in blocks:
            op = blk['opcode']
            if op in ('looks_nextcostume', 'looks_switchbackdropto', 'looks_nextbackdrop'):
                dynamic = True
            if op == 'looks_costumenumbername' and blk['fields']['NUMBER_NAME'][0] == 'number':
                dynamic = True
            if op == 'looks_switchcostumeto':
                ref = blk['inputs']['COSTUME'][1]
                src = t['blocks'].get(ref) if isinstance(ref, str) else None
                if not (src and src['opcode'] == 'looks_costume'):
                    dynamic = True          # a reporter picks the costume
                else:
                    named.add(src['fields']['COSTUME'][0])
        if dynamic:
            continue
        current = t['costumes'][t['currentCostume']]['name']
        keep = [c for c in t['costumes'] if c['name'] in named or c['name'] == current]
        if len(keep) < len(t['costumes']):
            removed += len(t['costumes']) - len(keep)
            t['costumes'] = keep
            t['currentCostume'] = next(i for i, c in enumerate(keep) if c['name'] == current)
    b.notes.append(f'skipped {removed} costumes that no script can show')


# ---------------------------------------------------------------------------
# 3. Text sprites
# ---------------------------------------------------------------------------
def raster(b, c):
    """Picture of a costume at 2 pixels per costume unit, as an RGBA numpy array."""
    path = os.path.join(b.src, c['md5ext'])
    if c['dataFormat'] == 'svg':
        text = open(path, encoding='utf-8', errors='replace').read()
        ox, oy, w, h = b.svg_size(text)
        im = Image.open(io.BytesIO(b.renderer.svg_to_png(text, w, h, 2)))
    else:
        im = Image.open(path)
        res = c.get('bitmapResolution', 1)
        if res != 2:
            im = im.resize((im.width * 2 // res, im.height * 2 // res), Image.NEAREST)
    return np.array(im.convert('RGBA')).astype(int)


def svg_lines(b, c):
    """Text lines straight from an SVG's <text> elements (used for long lyric cards)."""
    text = open(os.path.join(b.src, c['md5ext']), encoding='utf-8').read()
    lines = []
    for m in re.finditer(r'<text[^>]*>(.*?)</text>', text, re.S):
        for tspan in re.findall(r'<tspan[^>]*>(.*?)</tspan>', m.group(1), re.S):
            s = re.sub(r'<[^>]+>', '', tspan).replace('&#39;', "'").replace('&amp;', '&').strip()
            if s:
                lines.append([s])
    return lines


def runs(mask_1d, min_len=1):
    """Start/end index pairs of True runs in a 1D boolean array."""
    out, start = [], None
    for i, v in enumerate(list(mask_1d) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                out.append([start, i])
            start = None
    return out


def split_by_gaps(r, n, sizes=None):
    """Merge runs into n groups by cutting at gaps. With `sizes` (text lengths),
    pick the cut whose group widths best match them; otherwise cut at the widest gaps."""
    from itertools import combinations
    if n <= 1 or len(r) <= 1:
        return [[r[0][0], r[-1][1]]]
    order = sorted(range(len(r) - 1), key=lambda i: r[i + 1][0] - r[i][1], reverse=True)

    def build(cuts):
        groups, start = [], r[0][0]
        for i in range(len(r) - 1):
            if i in cuts:
                groups.append([start, r[i][1]])
                start = r[i + 1][0]
        groups.append([start, r[-1][1]])
        return groups
    if not sizes:
        return build(set(order[:n - 1]))
    total, want = r[-1][1] - r[0][0], [x / sum(sizes) for x in sizes]
    best = None
    for cuts in combinations(order[:8], n - 1):
        g = build(set(cuts))
        err = sum(abs((b - a) / total - wv) for (a, b), wv in zip(g, want))
        if best is None or err < best[0]:
            best = (err, g)
    return best[1]


def hexcol(rgb):
    return '#%02x%02x%02x' % tuple(int(v) for v in rgb[:3])


# Pictures whose letters touch every edge, so they look like a box but are not
NOT_BOXES = {('time AM', 'text')}


def text_layers(px, lines, font, sprite, costume=''):
    """Work out where each piece of text sits in the old picture, and the box behind it."""
    h, w = px.shape[:2]
    alpha = px[:, :, 3]
    layers = []
    edges = [alpha[1, :], alpha[-2, :], alpha[:, 1], alpha[:, -2]]
    boxed = min((e > 200).mean() for e in edges) > 0.95 and (sprite, costume) not in NOT_BOXES
    ink = alpha > 110
    if sprite in BACKED:
        ink = (alpha > 110) & (px[:, :, :3].mean(axis=2) > 128)    # only the light letters
    if boxed:
        # walk in from the top-left corner in color bands: thin bands are the border,
        # the first wide band (or see-through area) is the fill
        limit = max(4, round(0.3 * min(h, w)))
        bands = []                      # [color, length]
        for k in range(1, limit):
            col = px[k, k]
            if bands and np.abs(col - bands[-1][0]).sum() <= 60:
                bands[-1][1] += 1
            else:
                bands.append([col, 1])
        thin = max(2, round(0.1 * min(h, w)))
        border, edge, inner = 0, px[1, 1], None
        for i, (col, n) in enumerate(bands):
            if col[3] < 128 or n > thin or i == len(bands) - 1:
                inner = col
                if i:
                    main = max(bands[:i], key=lambda bn: bn[1])[0]     # main border color
                    # a real border stands out from the fill (letters near the corner do not count)
                    if col[3] < 128 or np.abs(main[:3] - col[:3]).sum() > 60:
                        border = sum(n for _, n in bands[:i]) + 1
                        edge = main
                    else:
                        inner = main
                break
        fill, fill_alpha = inner[:3], inner[3]
        if fill_alpha < 128:     # an outline box with see-through middle
            layers.append(dict(rect=[0, 0, w / 2, h / 2], stroke=hexcol(edge), lw=round(border / 2, 2)))
            ink = (alpha > 110)
        else:
            rect = dict(rect=[0, 0, w / 2, h / 2], fill=hexcol(fill))
            if border:
                rect.update(stroke=hexcol(edge), lw=round(border / 2, 2))
            layers.append(rect)
            ink = (alpha > 110) & (np.abs(px[:, :, :3] - fill).sum(axis=2) > 90)
        if border:
            ink[:border + 1, :] = False; ink[-border - 1:, :] = False
            ink[:, :border + 1] = False; ink[:, -border - 1:] = False
        # a see-through window in a full-screen box (the 6 AM roll)
        hole = alpha < 60
        if hole.any():
            ys, xs = np.where(hole)
            layers[0]['hole'] = [xs.min() / 2, ys.min() / 2, (xs.max() + 1 - xs.min()) / 2, (ys.max() + 1 - ys.min()) / 2]
    # lines (top to bottom), then word groups (left to right)
    row_runs = runs(ink.any(axis=1))
    line_boxes = split_by_gaps(row_runs, len(lines))
    texts = []
    for (y0, y1), groups in zip(line_boxes, lines):
        band = ink[y0:y1]
        col_runs = runs(band.any(axis=0))
        groups = [g if isinstance(g, tuple) else (g, font) for g in groups]
        sizes = [len(g[0].strip()) for g in groups]
        for (x0, x1), (s, gfont) in zip(split_by_gaps(col_runs, len(groups), sizes), groups):
            sub = band[:, x0:x1]
            ys = np.where(sub.any(axis=1))[0]
            gy0, gy1 = y0 + ys.min(), y0 + ys.max() + 1
            cols = px[gy0:gy1, x0:x1][ink[gy0:gy1, x0:x1]]
            color = hexcol(np.median(cols, axis=0)) if len(cols) else '#ffffff'
            texts.append(dict(text=s, font=gfont, color=color,
                              box=[round(x0 / 2, 2), round(gy0 / 2, 2), round((x1 - x0) / 2, 2), round((gy1 - gy0) / 2, 2)]))
    if not boxed and sprite in BACKED:
        # rebuild the solid backing as rectangles (rows with the same span merge)
        solid = alpha > 110
        spans, prev, top = [], None, 0
        for y in range(h + 1):
            cols = np.where(solid[y])[0] if y < h else []
            span = (cols.min(), cols.max() + 1) if len(cols) else None
            if span != prev:
                if prev:
                    spans.append([prev[0] / 2, top / 2, (prev[1] - prev[0]) / 2, (y - top) / 2])
                prev, top = span, y
        layers += [dict(rect=sp, fill='#000000') for sp in spans]
    return layers + texts


def text_costumes(b):
    count = 0
    for t in b.project['targets']:
        spec = TEXT.get(t['name'])
        if not spec:
            continue
        font, table = spec
        for c in t['costumes']:
            if c['name'] not in table:
                continue
            lines = table[c['name']]
            if lines is None and c['dataFormat'] == 'svg':
                lines = svg_lines(b, c)
            if lines is None:
                lines = MANUAL_LINES[(t['name'], c['name'])]
            px = raster(b, c)
            res = c.get('bitmapResolution', 1)
            w, h = px.shape[1] / 2, px.shape[0] / 2
            ox = oy = 0
            if c['dataFormat'] == 'svg':
                ox, oy, _, _ = b.svg_size(open(os.path.join(b.src, c['md5ext']), encoding='utf-8').read())
            b.custom[(t['name'], c['name'])] = dict(
                name=c['name'], w=round(w, 3), h=round(h, 3),
                cx=round(c['rotationCenterX'] / res - ox, 3), cy=round(c['rotationCenterY'] / res - oy, 3),
                layers=text_layers(px, lines, font, t['name'], c['name']))
            count += 1
    b.notes.append(f'{count} costumes turned into real text')
    match_menu_font(b)


# ---------------------------------------------------------------------------
# Dine In, Spooky and It's already dark. use the same font, size and left
# edge as New Game / Continue (and Dine In loses its black box)
# ---------------------------------------------------------------------------
MENU_LIKE_NEW_GAME = {'dine in': 'text', '6th Night': 'string', 'Custom Night': 'string'}


def sprite_pos(b, name):
    """Where the menu scripts put a sprite (x, y, size), or its starting spot."""
    t = next(t for t in b.project['targets'] if t['name'] == name)
    x, y, size = t['x'], t['y'], t['size']
    for blk in t['blocks'].values():
        if isinstance(blk, dict) and blk['opcode'] == 'motion_gotoxy':
            vx, vy = blk['inputs']['X'][1], blk['inputs']['Y'][1]
            if isinstance(vx, list) and isinstance(vy, list):
                x, y = float(vx[1]), float(vy[1])
        if isinstance(blk, dict) and blk['opcode'] == 'looks_setsizeto':
            v = blk['inputs']['SIZE'][1]
            if isinstance(v, list):
                size = float(v[1])
    return x, y, size


def match_menu_font(b):
    ng = b.custom[('new game', 'text')]
    ngt = next(L for L in ng['layers'] if 'text' in L)
    nx, ny, ns = sprite_pos(b, 'new game')
    k = ns / 100
    left_stage = nx + (ngt['box'][0] - ng['cx']) * k          # left edge of "New Game" on the stage
    cap_stage = ngt['box'][3] * k                               # letter height of "New Game" on the stage
    for name, cos in MENU_LIKE_NEW_GAME.items():
        c = b.custom[(name, cos)]
        L = next(L for L in c['layers'] if 'text' in L)
        sx, sy, ss = sprite_pos(b, name)
        ks = ss / 100
        mid = L['box'][1] + L['box'][3] / 2                    # keep the item's vertical spot
        cap = cap_stage / ks
        x0 = (left_stage - sx) / ks + c['cx']
        L.update(font=MONO, color='#ffffff', like=['New Game', round(cap, 3)], align='left',
                 box=[round(x0, 3), round(mid - cap / 2, 3), round(L['box'][2], 3), round(cap, 3)])
        c['layers'] = [L]                                        # no box behind it any more
        if x0 < 2:                                               # keep the text inside the costume
            shift = 2 - x0
            L['box'][0] += shift
            c['cx'] += shift
        c['w'] = L['box'][0] + 420                               # room for the wider font
        c['h'] = max(c['h'], L['box'][1] + L['box'][3] * 1.6)
    b.notes.append('Dine In, Spooky and It\'s already dark. now use the New Game font')


# Lines read off pictures that have no SVG text inside
MANUAL_LINES = {
    ('Backdrop', 'SettingsMenu'): [[('Settings', MONO)], [('Jumpscares', MONO)], [('Jumpscares are default to off', SANS)]],
}
