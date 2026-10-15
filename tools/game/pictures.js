/* =====================================================================
   PICTURES
   Loads every picture and draws it on the game screen.

   The game screen is 480 x 360 "game pixels" (it is scaled up to fit
   the window). (0, 0) is the TOP-LEFT corner, x goes right, y goes down.

   Every picture lives in ART (made by tools/build_game1.py), looked up
   by group and name, for example pic("office", "normal").
   A picture has:
     w, h     its size in game pixels at 100%
     cx, cy   its "pin": the point that goes on the spot you draw it at
     layers   what it is made of, back to front:
                {img, x, y, w, h}            an image file
                {img, m, iw, ih, tint?, ...} a character image placed with a matrix
                {rect, fill, stroke, lw, hole?}  a box
                {text, font, color, ...}     real text (mods can change it)
   ===================================================================== */
"use strict";

const VIEW_W = 480, VIEW_H = 360;

/* ---------------------------------------------------------------------
   Loading files
   --------------------------------------------------------------------- */
const Files = {
  images: new Map(),   // url -> <img>
  tints: new Map(),    // "url|color" -> canvas filled with one color (silhouettes, shading)

  image(url) { return this.images.get(url); },

  // The same image, but every visible pixel painted one flat color
  tinted(url, color) {
    const key = url + "|" + color;
    if (!this.tints.has(key)) {
      const img = this.image(url);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.ceil(img.naturalWidth * 2));
      c.height = Math.max(1, Math.ceil(img.naturalHeight * 2));
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, c.width, c.height);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = color;
      g.fillRect(0, 0, c.width, c.height);
      this.tints.set(key, c);
    }
    return this.tints.get(key);
  },

  // Loads every picture and sound, reporting progress from 0 to 1
  async loadAll(imageUrls, soundUrls, onProgress) {
    const total = imageUrls.length + soundUrls.length;
    let done = 0;
    const tick = () => onProgress(++done / total);
    const loadImage = url => new Promise(res => {
      const img = new Image();
      img.onload = () => { this.images.set(url, img); tick(); res(); };
      img.onerror = () => { console.warn("Missing image", url); this.images.set(url, img); tick(); res(); };
      img.src = url;
    });
    const loadSound = async url => {
      try { await Sound.load(url); } catch (e) { console.warn("Missing sound", url, e); }
      tick();
    };
    // a few files at a time so the browser stays responsive
    const queue = [...imageUrls.map(u => () => loadImage(u)), ...soundUrls.map(u => () => loadSound(u))];
    const workers = Array.from({ length: 8 }, async () => { while (queue.length) await queue.shift()(); });
    await Promise.all(workers);
  }
};

// Every image file any picture uses (for the loading bar)
function allImageUrls() {
  const urls = new Set();
  for (const group of Object.values(ART))
    for (const p of Object.values(group.pics))
      for (const L of p.layers) if (L.img) urls.add(L.img);
  return [...urls];
}

/* ---------------------------------------------------------------------
   Finding pictures
   --------------------------------------------------------------------- */
function pic(group, name) {
  const g = ART[group];
  const p = g && g.pics[name];
  if (!p) console.warn("No picture", group, name);
  return p;
}
// The n-th picture of a group (1 = first), for random picks and number names
function picAt(group, n) {
  const list = ART[group].list;
  const i = ((Math.round(n) - 1) % list.length + list.length) % list.length;
  return ART[group].pics[list[i]];
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
   Drawing one picture's layers (in picture units, top-left = 0,0)
   --------------------------------------------------------------------- */
function drawLayers(ctx, p) {
  ctx.save();
  if (p.clip) { ctx.beginPath(); ctx.rect(0, 0, p.w, p.h); ctx.clip(); }     // nothing pokes out of the picture
  for (const L of p.layers) {
    if (L.img) {
      const img = L.tint ? Files.tinted(L.img, L.tint) : Files.image(L.img);
      if (!img || img.complete === false) continue;
      ctx.save();
      if (L.cut) { ctx.beginPath(); ctx.rect(...L.cut); ctx.clip(); }     // only part of the image
      if (L.outline) {                                                     // only inside these shapes
        if (!L._clip) {
          L._clip = new Path2D();
          for (const [d, m] of L.outline) L._clip.addPath(new Path2D(d), new DOMMatrix(m));
        }
        ctx.clip(L._clip);
      }
      if (L.m) { ctx.transform(...L.m); ctx.drawImage(img, 0, 0, L.iw, L.ih); }
      else ctx.drawImage(img, L.x, L.y, L.w, L.h);
      if (L.shade) {                                                       // darker (characters in dark rooms)
        ctx.globalAlpha *= L.shade;
        const dark = Files.tinted(L.img, "#000");
        if (L.m) ctx.drawImage(dark, 0, 0, L.iw, L.ih); else ctx.drawImage(dark, L.x, L.y, L.w, L.h);
      }
      ctx.restore();
    } else if (L.rect) {
      const [x, y, w, h] = L.rect;
      if (L.fill && L.hole) {
        // a filled box with a see-through window
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.rect(...L.hole);
        ctx.fillStyle = L.fill;
        ctx.fill("evenodd");
      } else if (L.fill) { ctx.fillStyle = L.fill; ctx.fillRect(x, y, w, h); }
      if (L.stroke) {
        ctx.strokeStyle = L.stroke; ctx.lineWidth = L.lw;
        ctx.strokeRect(x + L.lw / 2, y + L.lw / 2, w - L.lw, h - L.lw);
      }
    } else if (L.text !== undefined) {
      drawText(ctx, L);
    }
  }
  ctx.restore();
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
  ctx.globalAlpha *= alpha;
  if (o.bright) ctx.filter = `brightness(${Math.max(0, 1 + o.bright / 100)})`;
  drawLayers(ctx, p);
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
  drawLayers(g, p);
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

// Was screen point (px, py) inside the picture's rectangle (good for words)?
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
