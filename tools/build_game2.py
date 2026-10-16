#!/usr/bin/env python3
"""
build_game2.py
Builds the web version of Fried Rice at Eddie's 2 (Tape 2) from the Scratch .sb3.

  python3 tools/build_game2.py path/to/unzipped_sb3_folder
  python3 tools/build_game2.py --code      (only the game code changed: quick)

What it does:
  1. Reads project.json
  2. Picks the pictures the game uses (rooms, office, monitor, mask...)
  3. Swaps every original FNaF character for the fan-made cast
     (tools/tape2/cast.py: empty room + character file on top)
  4. Converts assets: PNG -> WebP, WAV -> MP3
  5. Writes 2/index.html: the hand-written game (tools/tape2/*.js) plus
     ART (every picture: size, pin and layers) and SOUNDS.
     The Scratch scripts are NOT converted: the game is written by hand.

Most words are drawn by the game itself (real text), so mods can change
them in texts.json. Every word the game draws goes through W("...") and
the build collects them for texts.json.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'tape2'))
import build_game1 as base                      # the shared picture/sound converter (Builder)

REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, '2')
ASSETS = os.path.join(OUT, 'assets')
TAPE = os.path.join(HERE, 'tape2')
# the shared converter writes to these folders
base.OUT, base.ASSETS = OUT, ASSETS

# ---------------------------------------------------------------------------
# Pictures the game uses: sprite -> costumes (None = every costume)
# ---------------------------------------------------------------------------
PICTURES = {
    # (pictures with characters in them are rebuilt by tape2/cast.py instead)
    'Light Left': None, 'Right Right': None, 'Sprite13': None,                       # vent light buttons, desk
    'Sprite1': None, 'Sprite2': None, 'Sprite3': None, 'Sprite4': None, 'Sprite5': None,   # bars, mask, monitor
    'Sprite12': None, 'Wind up': None, 'Sprite7': None, 'Sprite29': None, 'Sprite67': None,
    'Sprite28': ['costume1', 'costume2', 'costume3', 'costume4'], 'Sprite10': None,     # static
    # death minigames: rooms, children, the purple car and man (the 8-bit cast comes from cast.py)
    'Sprite45': ['give cake', 'foxy GET READY', 'foxy GO! GO! GO!', 'foxy blank', 'foxy stage', 'foxy stage2'],
    'Sprite47': None, 'Sprite53': None, 'Sprite54': None, 'Sprite69': ['GiveThemLifeEndo', 'GiveThemLifeEndo2'],
    'Sprite75': None, 'Sprite76': None,
}
# FNaF's purple man becomes a grey stranger (same pixels, colors moved away from purple)
RECOLOR = {('Sprite76', 'Purple_man'), ('Sprite54', 'Purple_Car')}

# ---------------------------------------------------------------------------
# Sounds: sprite -> sound names (None = every sound). Music follows the Music slider.
# ---------------------------------------------------------------------------
SOUNDS_USED = {
    'Stage': ['Ambient'], 'Light Left': ['ComputerInteriorLong_EVL02_2'], 'Sprite4': None, 'Sprite5': None,
    'Mangle': None, 'The office': None, 'Party 01': None, 'Left Vent': None, 'Wind up': None, 'Sprite6': None,
    'Sprite10': None, 'Sprite11': None, 'Fansound': None, 'Ambience': ['Chimes', 'CROWD_SMALL_CHIL_EC049202'],
    'BB': None, 'Sprite16': ['ambience2'], 'Sprite3': None, 'Sprite17': None, 'Sprite19': None, 'BB in the office': None,
    'Sprite28': None, 'Sprite45': None, 'Sprite21': ['PartyFavorraspyPart_AC01__3', 'recording1'],
    'Sprite27': None,
}
MUSIC = {'Music_Box_Melody_Playful', 'FNAF 2 - Win Music-Lullaby Waltz (End Of The Game).mp3', 'With_S3',
         'During mini game.mp3', 'jackinthebox', 'title', 'Chimes'}

TITLE_SONG = os.path.join(TAPE, 'title.mp3')     # Aidan's title song (Beat Saber lobby music)


def picture_groups(project):
    """Only keep the sprites and costumes the game uses."""
    keep = []
    for t in project['targets']:
        if t['name'] not in PICTURES:
            continue
        want = PICTURES[t['name']]
        if want is not None:
            t['costumes'] = [c for c in t['costumes'] if c['name'] in want]
        keep.append(t)
    return keep


def recolor(b, pictures):
    """Turns the purple man (and his car) grey-blue, as new costume pictures."""
    import numpy as np
    from PIL import Image
    for t in pictures:
        for c in t['costumes']:
            if (t['name'], c['name']) not in RECOLOR:
                continue
            a = np.array(Image.open(os.path.join(b.src, c['md5ext'])).convert('RGBA')).astype(float)
            gray = a[:, :, :3].mean(axis=2, keepdims=True)
            a[:, :, :3] = gray * np.array([0.78, 0.85, 1.0])            # cold grey-blue
            rel = b.out_name('img', base.slug(t['name'] + '-' + c['name']), 'webp')
            b.save_webp(Image.fromarray(a.clip(0, 255).astype(np.uint8)), rel)
            res = c.get('bitmapResolution', 1)
            w, h = a.shape[1] / res, a.shape[0] / res
            b.custom[(t['name'], c['name'])] = dict(name=c['name'], w=w, h=h, cx=c['rotationCenterX'] / res,
                                                    cy=c['rotationCenterY'] / res, layers=[dict(img=rel, x=0, y=0, w=w, h=h)])


def words_in_code():
    """Every W("...") in the game code: the words mods can change in texts.json."""
    out = {}
    for f in sorted(os.listdir(TAPE)):
        if f.endswith('.js'):
            src = open(os.path.join(TAPE, f), encoding='utf-8').read()
            for group, word in re.findall(r'W\(\s*"([^"]*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)', src):
                out.setdefault(group, {})[word] = word
    ui = open(os.path.join(HERE, 'ui.js'), encoding='utf-8').read()
    out['Settings'] = {w: w for w in base.SETTINGS_TEXTS}
    for w in re.findall(r'\bT\("([^"]+)"\)', ui):
        out['Settings'].setdefault(w, w)
    ach = open(os.path.join(TAPE, 'achievements.js'), encoding='utf-8').read()
    words = ['Achievements', 'Achievement Unlocked!', 'Hidden achievement', 'Keep playing to find it.', 'Unlocked', 'BACK']
    words += [w for pair in re.findall(r'name: "([^"]+)",\s*desc: "([^"]+)"', ach) for w in pair]
    out['Achievements'] = {t: t for t in words}
    return out


def write_page(data_js):
    """The data, the hand-written game and the settings/mods UI go into 2/index.html."""
    code = '\n\n'.join(open(os.path.join(HERE, 'game', f), encoding='utf-8').read() for f in ('pictures.js', 'sound.js'))
    code += '\n\n' + '\n\n'.join(open(os.path.join(TAPE, f), encoding='utf-8').read()
                                 for f in ('game.js', 'minigames.js', 'achievements.js'))
    ui = open(os.path.join(HERE, 'ui.js'), encoding='utf-8').read()
    shell = open(os.path.join(TAPE, 'shell.html'), encoding='utf-8').read()
    html = shell.replace('/*DATA*/', data_js).replace('/*GAME*/', code).replace('/*UI*/', ui)
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)


def main():
    if sys.argv[1] == '--code':
        write_page(open(os.path.join(TAPE, 'data_cache.js'), encoding='utf-8').read())
        print('wrote 2/index.html (code only)')
        return
    sb3_dir = sys.argv[1]
    # start clean so old files never linger
    if os.path.isdir(ASSETS):
        shutil.rmtree(ASSETS)
    os.makedirs(ASSETS)
    shutil.copytree(os.path.join(REPO, '1', 'assets', 'fonts'), os.path.join(ASSETS, 'fonts'))
    fonts_dir = os.path.join(ASSETS, 'fonts')
    fonts = {f: os.path.join(fonts_dir, n) for f, n in [
        ('Sans Serif', 'NotoSans-Medium.ttf'), ('Pixel', 'Grand9K-Pixel.ttf'), ('Press Start 2P', 'PressStart2P.woff2'),
        ('Share Tech Mono', 'ShareTechMono.woff2')]}
    b = base.Builder(sb3_dir, fonts)
    b.custom = {}
    b.notes = []
    shutil.copy(os.path.join(HERE, 'loading-rice.webp'), os.path.join(ASSETS, 'loading-rice.webp'))
    for f in ('favicon.png', 'favicon.ico'):                  # tab icon: Eddy with a 2
        shutil.copy(os.path.join(TAPE, f), os.path.join(OUT, f))

    all_targets = list(b.project['targets'])
    import cast, extras
    extra_art = cast.apply(b)                         # rooms, poses... with the fan-made cast
    extra_art.update(extras.apply(b, None))           # the camera map
    pictures = picture_groups(b.project)
    recolor(b, pictures)
    print('\n'.join(b.notes))

    art = {}
    for t in pictures:
        pics = {}
        for c in t['costumes']:
            rec = b.custom.get((t['name'], c['name'])) or b.costume(t, c)
            pics[c['name']] = {k: v for k, v in rec.items() if k != 'name'}
        art[t['name']] = {'list': [c['name'] for c in t['costumes']], 'pics': pics}
    for group, pics in extra_art.items():
        art.setdefault(group, {'list': [], 'pics': {}})
        for name, rec in pics.items():
            art[group]['list'].append(name)
            art[group]['pics'][name] = rec
    b.renderer.close()

    # ---- sounds ----
    base.MUSIC = MUSIC
    sounds = {}
    for t in all_targets:
        if t['name'] not in SOUNDS_USED:
            continue
        want = SOUNDS_USED[t['name']]
        for s in t['sounds']:
            if want is None or s['name'] in want:
                rec = b.sound(t, s)
                sounds.setdefault(t['name'], {})[s['name']] = {'src': rec['src'], 'music': rec['music']}
    shutil.copy(TITLE_SONG, os.path.join(ASSETS, 'snd', 'title.mp3'))
    sounds['Title'] = {'title': {'src': 'assets/snd/title.mp3', 'music': 1}}
    shutil.copy(os.path.join(HERE, 'calls', 'ringtone.mp3'), os.path.join(ASSETS, 'snd', 'ringtone.mp3'))
    sounds['Ringtone'] = {'ringtone': {'src': 'assets/snd/ringtone.mp3', 'music': 0}}

    data_js = 'const ART = ' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';'
    data_js += '\nconst SOUNDS = ' + json.dumps(sounds, ensure_ascii=False, separators=(',', ':')) + ';'
    files = sorted(os.path.relpath(os.path.join(dp, f), ASSETS).replace(os.sep, '/')
                   for dp, _, fs in os.walk(ASSETS) for f in fs)
    files = [f for f in files if f != 'loading-rice.webp' and not f.endswith('OFL.txt')]
    data_js += '\nconst ASSET_FILES = ' + json.dumps(files) + ';'
    data_js += '\nconst DEFAULT_TEXTS = ' + json.dumps(words_in_code(), ensure_ascii=False, indent=1) + ';'
    open(os.path.join(TAPE, 'art_debug.json'), 'w').write(json.dumps(art, indent=1))
    open(os.path.join(TAPE, 'data_cache.js'), 'w', encoding='utf-8').write(data_js)
    write_page(data_js)
    print(f'wrote 2/index.html ({len(art)} picture groups, {sum(len(v) for v in sounds.values())} sounds)')


if __name__ == '__main__':
    main()
