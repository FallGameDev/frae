"""
embed_small.py
Packs a tape's small pictures into its code as base64, so the game has fewer
files (itch.io allows 1000 files per upload).

  python3 tools/embed_small.py 1        (Tape 1)
  python3 tools/embed_small.py 2        (Tape 2)

Every picture in <tape>/assets/img smaller than LIMIT bytes is moved into
embedded.js (next to that tape's names.js) as a data: URL, and its file is
deleted. The game then loads it from the code instead of the file
(EMBEDDED_PICS / ownAssetUrl in tools/game/pictures.js). Mods still replace
these pictures by path, exactly like any other picture.

Safe to run again: pictures already packed stay packed, packed pictures that
names.js no longer lists are dropped. tools/flatten.py runs this at the end of
every full build. Rebuild the page after it (build_game<N>.py --code).
"""
import base64, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
LIMIT = 10 * 1024                       # pictures under 10 KB get packed
CODE = {'1': os.path.join(HERE, 'game'), '2': os.path.join(HERE, 'tape2')}


def file_name(s):
    """The same as fileName() in pictures.js: "Show Stage" -> "show-stage"."""
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', str(s).lower())) or 'x'


def listed_paths(code_dir):
    """Every picture path names.js says the game has (img/<group>/<name>.webp)."""
    src = open(os.path.join(code_dir, 'names.js'), encoding='utf-8').read()
    block = src[src.index('const PICTURE_NAMES = {'):]
    block = block[:block.index('};')]
    paths = set()
    for g, names in re.findall(r'^  ("(?:[^"\\]|\\.)*"): (\[.*\]),$', block, re.M):
        g = json.loads(g)
        for n in json.loads(names):
            paths.add(f'img/{file_name(g)}/{file_name(n)}.webp')
    return paths


def read_embedded(path):
    """The pictures already packed (path -> data URL), or {} if there is no embedded.js yet."""
    if not os.path.exists(path):
        return {}
    src = open(path, encoding='utf-8').read()
    m = re.search(r'const EMBEDDED_PICS = (\{.*\});', src, re.S)
    return json.loads(m.group(1)) if m else {}


def main():
    tape = sys.argv[1]
    code_dir = CODE[tape]
    assets = os.path.join(REPO, tape, 'assets')
    out = os.path.join(code_dir, 'embedded.js')
    listed = listed_paths(code_dir)

    # keep what is already packed (if the game still lists it), then add new small files
    packed = {p: u for p, u in read_embedded(out).items() if p in listed}
    moved = 0
    for root, _, files in os.walk(os.path.join(assets, 'img')):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, assets).replace(os.sep, '/')
            if rel not in listed or os.path.getsize(full) >= LIMIT:
                continue
            data = base64.b64encode(open(full, 'rb').read()).decode('ascii')
            packed[rel] = 'data:image/webp;base64,' + data
            os.remove(full)
            moved += 1
    # drop folders the move left empty
    for root, dirs, files in os.walk(os.path.join(assets, 'img'), topdown=False):
        if root != os.path.join(assets, 'img') and not os.listdir(root):
            os.rmdir(root)

    lines = ['/* =====================================================================',
             '   SMALL PICTURES, PACKED INTO THE CODE',
             '   Pictures under 10 KB live here as base64 (data: URLs) instead of',
             '   files, to keep the file count down (itch.io allows 1000 files).',
             '   asset path -> data URL. Made by tools/embed_small.py, do not edit.',
             '   ===================================================================== */',
             '"use strict";', '',
             'const EMBEDDED_PICS = {']
    # (no comma after the last one, so read_embedded can read it back as JSON)
    lines.append(',\n'.join(f'  {json.dumps(p)}: {json.dumps(packed[p])}' for p in sorted(packed)))
    lines += ['};', '']
    open(out, 'w', encoding='utf-8').write('\n'.join(lines))
    size = sum(len(u) for u in packed.values())
    print(f'tape {tape}: {len(packed)} pictures packed ({moved} new), {size // 1024} KB of base64 in {os.path.relpath(out, REPO)}')


if __name__ == '__main__':
    main()
