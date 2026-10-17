/* =====================================================================
   PICTURES
   Loads every picture and draws it on the game screen.

   The game screen is 480 x 360 "game pixels" (it is scaled up to fit
   the window). (0, 0) is the TOP-LEFT corner, x goes right, y goes down.

   Every picture is a plain image file:
       assets/img/<group>/<name>.webp
   (names in lower case with dashes, see fileName). Each image is 2 image
   pixels per game pixel, and its middle is its "pin": the point that goes
   on the spot you draw it at. names.js lists which pictures exist.
   Some pictures also have real words drawn on top (words.js), so mods can
   change them in texts.json.
   ===================================================================== */
"use strict";

const VIEW_W = 480, VIEW_H = 360;
const IMG_SCALE = 2;                  // image pixels per game pixel
// groups saved at half size to save memory (long animations): 1 image pixel per game pixel (names.js)
const imgScale = group => (typeof HALF_SIZE_GROUPS !== "undefined" && HALF_SIZE_GROUPS.has(group) ? 1 : IMG_SCALE);

// "Show Stage" -> "show-stage" (how names become file names)
function fileName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}
const picturePath = (group, name) => `img/${fileName(group)}/${fileName(name)}.webp`;

// Files a mod replaces: asset path -> its own file (see applyMods in ui.js)
const MOD_FILES = {};
const assetUrl = path => MOD_FILES[path] || "assets/" + path;

/* ---------------------------------------------------------------------
   Loading files
   --------------------------------------------------------------------- */
const Files = {
  images: new Map(),   // asset path -> <img>
  sizes: new Map(),    // asset path -> the game's own [width, height] (only for pictures a mod replaced)

  image(path) { return this.images.get(path); },

  // The same picture with every visible pixel black (for darkening), made once
  blacks: new Map(),
  black(img) {
    if (!this.blacks.has(img)) {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
      this.blacks.set(img, c);
    }
    return this.blacks.get(img);
  },

  // Loads every picture and sound, reporting progress from 0 to 1
  async loadAll(imagePaths, soundPaths, onProgress) {
    const total = imagePaths.length + soundPaths.length;
    let done = 0;
    const tick = () => onProgress(++done / total);
    const loadOne = url => new Promise(res => {
      const img = new Image();
      img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => res(img));
      img.onerror = () => { console.warn("Missing image", url); res(null); };
      img.src = url;
    });
    const loadImage = async path => {
      const img = await loadOne(assetUrl(path));
      if (img) this.images.set(path, img);
      // a mod's picture may be any size: remember the game's own size so it fills the same spot
      if (MOD_FILES[path]) {
        const own = await loadOne("assets/" + path);
        if (own) this.sizes.set(path, [own.naturalWidth, own.naturalHeight]);
      }
      tick();
    };
    const loadSound = async path => {
      try { await Sound.load(path); } catch (e) { console.warn("Missing sound", path, e); }
      tick();
    };
    // a few files at a time so the browser stays responsive
    const queue = [...imagePaths.map(u => () => loadImage(u)), ...soundPaths.map(u => () => loadSound(u))];
    const workers = Array.from({ length: 8 }, async () => { while (queue.length) await queue.shift()(); });
    await Promise.all(workers);
  }
};

// Every picture file (for the loading bar and the mod template)
function allImagePaths() {
  const out = [];
  for (const [group, names] of Object.entries(PICTURE_NAMES)) for (const n of names) out.push(picturePath(group, n));
  return out;
}

/* ---------------------------------------------------------------------
   Finding pictures
   A picture: its image (img, iw x ih game pixels, pin in the middle) and
   its box (w, h, pin cx, cy) that hit tests and words use.
   --------------------------------------------------------------------- */
const pictureCache = new Map();
function hasPic(group, name) { return !!(PICTURE_NAMES[group] && PICTURE_NAMES[group].includes(name)); }
function pic(group, name) {
  const key = group + "/" + name;
  if (pictureCache.has(key)) return pictureCache.get(key);
  if (!hasPic(group, name)) { console.warn("No picture", group, name); return undefined; }
  const path = picturePath(group, name), img = Files.image(path);
  const [nw, nh] = Files.sizes.get(path) || (img ? [img.naturalWidth, img.naturalHeight] : [0, 0]);
  const k = imgScale(group);
  const iw = nw / k, ih = nh / k;
  const words = typeof PICTURE_WORDS !== "undefined" ? PICTURE_WORDS[key] : undefined;
  const [w, h, cx, cy] = words ? words.box : [iw, ih, iw / 2, ih / 2];
  const p = { img, iw, ih, w, h, cx, cy, words: words ? words.words : null,
              pixel: group === "Pixel",                         // 8-bit pictures stay blocky
              spin: group.toLowerCase() === "loading" };         // the spinning rice bowl
  pictureCache.set(key, p);
  return p;
}
// The n-th picture of a group (1 = first), for random picks and number names
function picAt(group, n) {
  const list = PICTURE_NAMES[group];
  const i = ((Math.round(n) - 1) % list.length + list.length) % list.length;
  return pic(group, list[i]);
}

/* ---------------------------------------------------------------------
   Words
   Mods can change any word with texts.json (old text -> new text).
   --------------------------------------------------------------------- */
let TEXTS = {};
const inkCache = new Map();

// The size of the actual letters (not the line box) at 100px
function measureInk(ctx, text, font) {
  const key = font + "|" + text;
  if (!inkCache.has(key)) {
    ctx.font = `100px "${font}"`;
    const m = ctx.measureText(text);
    inkCache.set(key, {
      left: -m.actualBoundingBoxLeft, top: -m.actualBoundingBoxAscent,
      w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
    });
  }
  return inkCache.get(key);
}

function drawText(ctx, L) {
  const shown = TEXTS[L.text] !== undefined ? String(TEXTS[L.text]) : L.text;
  ctx.save();
  ctx.fillStyle = L.color;
  ctx.textBaseline = "alphabetic";
  if (L.tm) {
    // text exactly as it sat in the original drawing (can be turned and stretched)
    ctx.transform(...L.tm);
    ctx.font = `${L.size}px "${L.font}"`;
    ctx.fillText(shown, L.pos[0], L.pos[1]);
  } else if (L.at) {
    // [left x, baseline y, font size]
    ctx.font = `${L.at[2]}px "${L.font}"`;
    ctx.fillText(shown, L.at[0], L.at[1]);
  } else {
    const [x, y, w, h] = L.box;
    const orig = measureInk(ctx, L.text, L.font);
    if (orig.w > 0 && orig.h > 0) {
      ctx.font = `100px "${L.font}"`;
      if (shown === L.text && !L.like) {
        // stretch the letters so they fill the box exactly where the old picture had them
        ctx.translate(x, y);
        ctx.scale(w / orig.w, h / orig.h);
        ctx.fillText(L.text, -orig.left, -orig.top);
      } else {
        // changed text (or text sized like another word): keep the letter size, let the width change
        let k = h / orig.h;
        if (L.like) k = L.like[1] / measureInk(ctx, L.like[0], L.font).h;
        const ink = measureInk(ctx, shown, L.font);
        const baseline = L.like ? y + h : y - orig.top * k;
        let left = x;
        if (L.align === "center") left = x + w / 2 - ink.w * k / 2;
        if (L.align === "right") left = x + w - ink.w * k;
        ctx.translate(left - ink.left * k, baseline);
        ctx.scale(k, k);
        ctx.fillText(shown, 0, 0);
      }
    }
  }
  ctx.restore();
}

/* ---------------------------------------------------------------------
   Painting one picture (in picture units, top-left of its box = 0,0)
   --------------------------------------------------------------------- */
function paintPicture(ctx, p) {
  if (p.img) ctx.drawImage(p.img, p.cx - p.iw / 2, p.cy - p.ih / 2, p.iw, p.ih);
  if (p.words) for (const L of p.words) drawText(ctx, L);
}

/* ---------------------------------------------------------------------
   draw(ctx, picture, x, y, options)
   Puts the picture's pin on screen spot (x, y).
   options: size (percent, 100 = normal), alpha (0-1),
            bright (-100 darker .. 100 lighter), turn (degrees)
   --------------------------------------------------------------------- */
function draw(ctx, p, x, y, o = {}) {
  if (!p) return;
  const alpha = o.alpha === undefined ? 1 : o.alpha;
  if (alpha <= 0) return;
  const k = (o.size || 100) / 100;
  ctx.save();
  ctx.translate(x, y);
  if (o.turn) ctx.rotate(o.turn * Math.PI / 180);
  ctx.scale(k, k);
  if (p.spin) {
    // a flat picture spinning in 3D (the rice bowl): squeeze it sideways over time
    ctx.scale(Math.cos(performance.now() / 2400 * Math.PI * 2), 1);
  }
  ctx.translate(-p.cx, -p.cy);
  if (p.pixel) ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  paintPicture(ctx, p);
  // darker / lighter: the picture's own shape painted black (or added again) on top.
  // (much faster than ctx.filter, which makes the browser redo the whole picture every frame)
  if (o.bright && p.img) {
    ctx.globalAlpha = alpha * Math.min(1, Math.abs(o.bright) / 100);
    if (o.bright > 0) ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(o.bright < 0 ? Files.black(p.img) : p.img, p.cx - p.iw / 2, p.cy - p.ih / 2, p.iw, p.ih);
  }
  ctx.restore();
}

/* ---------------------------------------------------------------------
   Hit testing: is a screen point on a visible pixel of a picture?
   Each picture gets a small see-through map the first time it is asked.
   --------------------------------------------------------------------- */
function pictureMask(p) {
  if (p._mask !== undefined) return p._mask;
  const w = Math.max(1, Math.ceil(p.w)), h = Math.max(1, Math.ceil(p.h));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  paintPicture(g, p);
  let data = null;
  try { data = g.getImageData(0, 0, w, h).data; } catch (e) { /* opened from a file: treat as solid */ }
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = data ? data[i * 4 + 3] : 255;
  p._mask = { w, h, alpha };
  return p._mask;
}

// Was screen point (px, py) on the picture drawn at (x, y) with this size?
function hits(p, x, y, size, px, py) {
  if (!p) return false;
  const k = (size || 100) / 100;
  const u = Math.floor((px - x) / k + p.cx), v = Math.floor((py - y) / k + p.cy);
  const m = pictureMask(p);
  if (u < 0 || v < 0 || u >= m.w || v >= m.h) return false;
  return m.alpha[v * m.w + u] > 0;
}

// Was screen point (px, py) inside the picture's box (good for words)?
function inBox(p, x, y, size, px, py, pad = 0) {
  if (!p) return false;
  const k = (size || 100) / 100;
  const u = (px - x) / k + p.cx, v = (py - y) / k + p.cy;
  return u >= -pad && v >= -pad && u <= p.w + pad && v <= p.h + pad;
}

/* ---------------------------------------------------------------------
   Smooth movement
   The game updates 30 times a second, but screens refresh 60+ times.
   Values that move (panning, fading, shaking) are remembered from the
   last update, and the screen draws them part of the way between the
   old and new value, so motion looks smooth instead of steppy.
   --------------------------------------------------------------------- */
class Smooth {
  constructor() { this.now = {}; this.before = {}; }
  set(key, v) { this.now[key] = v; if (!(key in this.before)) this.before[key] = v; }
  jump(key, v) { this.now[key] = v; this.before[key] = v; }      // move instantly (no blending)
  get(key) { return this.now[key]; }
  snapshot() { Object.assign(this.before, this.now); }          // called at the start of every update
  // the value to draw: `a` is how far we are between the last update (0) and the next (1)
  at(key, a, maxJump = Infinity) {
    const v = this.now[key], b = this.before[key];
    if (b === undefined || Math.abs(v - b) > maxJump) return v;
    return b + (v - b) * a;
  }
}
