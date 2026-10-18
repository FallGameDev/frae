"""
face_toys.py
Puts Aidan's face drawings on the toys' heads.

  pip install bpy
  python3 tools/face_toys.py

Each toy has three faces in models/faces/<toy>_face1.png .. face3.png
(see-through PNGs, drawn looking straight at the face):
  face1  calm      (on the stage, newspapers, custom night...)
  face2  creepy    (wandering the cameras, in the hall and vents, title screen)
  face3  scary     (in the office, jumpscares)

What it does, for every toy:
  1. paints each face onto the FRONT of the head, in the head's own texture
     layout (UV map), on top of the head color: models/faces/<toy>_head1.png ..3
  2. plugs head1 (calm) into the head material and saves toys_rigged.blend
  3. exports models/<toy>.glb and .fbx again (with the calm face)
The game swaps in head2 / head3 by itself when it needs the other faces.
"""
import math, os
import bpy
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(os.path.dirname(HERE), 'models')
BLEND = os.path.join(MODELS, 'toys_rigged.blend')
FACES = os.path.join(MODELS, 'faces')
TOYS = {'Toy Eddy': 'toy_eddy', 'Toy Weddy': 'toy_weddy', 'Toy Cheddy': 'toy_cheddy', 'Toy Endo': 'toy_endo'}
TEX = 1024              # head texture size
FACE_SIZE = 1.55        # the face picture is this many head-radii wide on the front of the head
FACE_DROP = 0.06        # ...and this many radii below the middle of the head


def head_texture(obj, mat_index, color, face):
    """The head's texture (TEX x TEX, its UV layout) with `face` projected on the front."""
    me = obj.data
    uv = me.uv_layers.active.data
    head = [p for p in me.polygons if p.material_index == mat_index]
    verts = np.array([v.co[:] for v in me.vertices])
    idx = sorted({v for p in head for v in p.vertices})
    hv = verts[idx]
    c = (hv.min(0) + hv.max(0)) / 2
    r = (hv.max(0) - hv.min(0)).max() / 2
    fa = np.asarray(face.convert('RGBA')).astype(float) / 255
    fh, fw = fa.shape[:2]
    srgb = np.array(color[:3]) ** (1 / 2.2)                  # the material's (linear) color as a picture color
    out = np.zeros((TEX, TEX, 3)) + srgb
    base = out.copy()
    for p in head:
        loops = list(p.loop_indices)
        for k in range(1, len(loops) - 1):                      # fan into triangles
            tri = [loops[0], loops[k], loops[k + 1]]
            P = np.array([verts[me.loops[l].vertex_index] for l in tri])
            U = np.array([uv[l].uv[:] for l in tri]) * (TEX - 1)
            x0, y0 = np.floor(U.min(0)).astype(int)
            x1, y1 = np.ceil(U.max(0)).astype(int)
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
            px, py = xs.ravel() + 0.5, ys.ravel() + 0.5
            (ax, ay), (bx, by), (cx_, cy_) = U
            den = (by - cy_) * (ax - cx_) + (cx_ - bx) * (ay - cy_)
            if abs(den) < 1e-12:
                continue
            w0 = ((by - cy_) * (px - cx_) + (cx_ - bx) * (py - cy_)) / den
            w1 = ((cy_ - ay) * (px - cx_) + (ax - cx_) * (py - cy_)) / den
            w2 = 1 - w0 - w1
            ins = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
            if not ins.any():
                continue
            W = np.stack([w0[ins], w1[ins], w2[ins]], 1)
            pos = W @ P                                          # the 3D spot of each texel
            tx, ty = xs.ravel()[ins], ys.ravel()[ins]
            ok = (tx >= 0) & (tx < TEX) & (ty >= 0) & (ty < TEX)
            tx, ty, pos = tx[ok], ty[ok], pos[ok]
            # front projection (Blender: the toys look toward -Y, Z is up)
            n = (pos - c) / r
            fu = (pos[:, 0] - c[0]) / (FACE_SIZE * r) + 0.5
            fv = 0.5 - (pos[:, 2] - (c[2] - FACE_DROP * r)) / (FACE_SIZE * r)
            facing = np.clip((-n[:, 1] - 0.15) / 0.35, 0, 1)        # only the front of the head
            inside = (fu >= 0) & (fu < 1) & (fv >= 0) & (fv < 1) & (facing > 0)
            fx = np.clip((fu * fw).astype(int), 0, fw - 1)
            fy = np.clip((fv * fh).astype(int), 0, fh - 1)
            rgba = fa[fy, fx]
            a = (rgba[:, 3] * facing * inside)[:, None]
            row = TEX - 1 - ty                                   # image rows go down, UV v goes up
            out[row, tx] = base[row, tx] * (1 - a) + rgba[:, :3] * a
    return Image.fromarray((out.clip(0, 1) * 255).astype(np.uint8))


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    for col_name, toy in TOYS.items():
        col = bpy.data.collections[col_name]
        obj = next(o for o in col.all_objects if o.type == 'MESH' and any(m and 'Head' in m.name for m in o.data.materials))
        mi = next(i for i, m in enumerate(obj.data.materials) if m and 'Head' in m.name)
        mat = obj.data.materials[mi]
        bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        color = tuple(bsdf.inputs['Base Color'].default_value)
        for i in (1, 2, 3):
            face = Image.open(os.path.join(FACES, f'{toy}_face{i}.png'))
            head_texture(obj, mi, color, face).save(os.path.join(FACES, f'{toy}_head{i}.png'))
            print(toy, 'face', i)
        # the calm face goes into the model itself
        path = os.path.join(FACES, f'{toy}_head1.png')
        img = bpy.data.images.load(path, check_existing=False)
        img.name = f'{toy}_head1'
        img.pack()
        tex = next((n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'), None) or mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = img
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    # round parts (head, ears, hands, arms, legs) shade smooth; the boxy ones stay sharp
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for poly in o.data.polygons:
                poly.use_smooth = len(poly.vertices) != 4 or poly.area < 0.02
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    # export each toy again (glb for the games / Godot, fbx for Roblox / GameMaker)
    for col_name, toy in TOYS.items():
        col = bpy.data.collections[col_name]
        bpy.ops.object.select_all(action='DESELECT')
        for o in col.all_objects:
            o.hide_set(False)
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS, toy + '.glb'), export_format='GLB', use_selection=True,
                                  export_skins=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                                  export_force_sampling=True, export_frame_range=False)
        bpy.ops.export_scene.fbx(filepath=os.path.join(MODELS, toy + '.fbx'), use_selection=True, add_leaf_bones=False,
                                 path_mode='COPY', embed_textures=True, bake_anim=True,
                                 bake_anim_use_nla_strips=True, bake_anim_use_all_actions=False, bake_anim_force_startend_keying=True)
        print('exported', toy)


main()
