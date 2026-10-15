/* =====================================================================
   MINI SCRATCH ENGINE
   Runs the converted Scratch scripts in plain JavaScript.

   How it works (short version):
   - Every sprite is a "Target" with a position, costume, size, effects
     and its own variables.
   - Every script is a generator function (function*). The engine steps
     each running script ("thread") until it hits a `yield`, then moves
     to the next one. That is exactly how Scratch shares time between
     scripts, so timing and loop behavior match the original project.
   - 30 times per second the engine runs the threads, then draws all
     visible sprites onto a <canvas>.
   ===================================================================== */
"use strict";

const STAGE_W = 480, STAGE_H = 360;
const FRAME_MS = 1000 / 30;          // Scratch runs at 30 frames per second
const WORK_MS = FRAME_MS * 0.75;     // max time scripts may use per frame
const WAIT = Symbol("wait");         // yielded by waits (not counted as "busy")
const FENCE = 15;                    // sprites must keep 15px on stage (Scratch rule)
let SMOOTH = true;                   // blend movement between steps (set false for exact Scratch look)

/* ---------------------------------------------------------------------
   Scratch value rules
   Scratch treats "10" and 10 the same in math, compares text without
   caring about capital letters, and so on. These helpers copy that.
   --------------------------------------------------------------------- */
function num(v) {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function str(v) { return String(v); }
function bool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return !(v === "" || v === "0" || v.toLowerCase() === "false");
  return Boolean(v);
}
function isWhite(v) { return v === null || (typeof v === "string" && v.trim().length === 0); }
function compare(a, b) {
  let n1 = Number(a), n2 = Number(b);
  if (n1 === 0 && isWhite(a)) n1 = NaN;
  if (n2 === 0 && isWhite(b)) n2 = NaN;
  if (isNaN(n1) || isNaN(n2)) {
    const s1 = String(a).toLowerCase(), s2 = String(b).toLowerCase();
    return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
  }
  if ((n1 === Infinity && n2 === Infinity) || (n1 === -Infinity && n2 === -Infinity)) return 0;
  return n1 - n2;
}
const eq = (a, b) => compare(a, b) === 0;
const lt = (a, b) => compare(a, b) < 0;
const gt = (a, b) => compare(a, b) > 0;
function join(a, b) { return str(a) + str(b); }
function letterOf(i, s) { s = str(s); i = num(i) - 1; return (i < 0 || i >= s.length) ? "" : s.charAt(i); }
function isInt(v) {
  if (typeof v === "number") return isNaN(v) || v === parseInt(v, 10);
  if (typeof v === "boolean") return true;
  if (typeof v === "string") return v.indexOf(".") < 0;
  return false;
}
function random(a, b) {
  const lo = Math.min(num(a), num(b)), hi = Math.max(num(a), num(b));
  if (lo === hi) return lo;
  if (isInt(a) && isInt(b)) return lo + Math.floor(Math.random() * (hi + 1 - lo));
  return Math.random() * (hi - lo) + lo;
}
// Scratch hides tiny float errors in x/y reporters (like 9.999999999)
function limitPrecision(n) { const r = Math.round(n); return Math.abs(n - r) < 1e-9 ? r : n; }

/* ---------------------------------------------------------------------
   Assets: images, fonts and sounds are loaded once, before the game starts
   --------------------------------------------------------------------- */
const Assets = {
  images: new Map(),   // url -> HTMLImageElement
  sounds: new Map(),   // url -> AudioBuffer
  tints: new Map(),    // "url|color" -> canvas (for silhouettes)

  image(url) { return this.images.get(url); },

  // Draws an image filled with one flat color (used for black silhouettes)
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

  // Loads every file and reports progress (0 to 1)
  async loadAll(imageUrls, soundUrls, audio, onProgress) {
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
      try {
        const data = await (await fetch(url)).arrayBuffer();
        this.sounds.set(url, await audio.decodeAudioData(data));
      } catch (e) { console.warn("Missing sound", url, e); }
      tick();
    };
    // a few at a time so the browser stays responsive
    const queue = [...imageUrls.map(u => () => loadImage(u)), ...soundUrls.map(u => () => loadSound(u))];
    const workers = Array.from({ length: 8 }, async () => { while (queue.length) await queue.shift()(); });
    await Promise.all(workers);
  }
};

/* ---------------------------------------------------------------------
   Costumes
   A costume is a stack of layers drawn in "costume units" (1 unit =
   1 Scratch pixel at 100% size). Layer types:
     {img, x, y, w, h}          a picture
     {img, m:[a,b,c,d,e,f], iw, ih, tint?}  a character picture placed with a
                                matrix (used for characters on cameras)
     {rect:[x,y,w,h], fill, stroke, lw}     a rectangle
     {text, font, color, box:[x,y,w,h]}     real text squeezed into a box
   --------------------------------------------------------------------- */
const textCache = new Map();   // font|text -> measured ink box

function measureInk(ctx, text, font) {
  const key = font + "|" + text;
  if (!textCache.has(key)) {
    ctx.font = `100px "${font}"`;
    const m = ctx.measureText(text);
    textCache.set(key, {
      left: -m.actualBoundingBoxLeft, top: -m.actualBoundingBoxAscent,
      w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
    });
  }
  return textCache.get(key);
}

// Words shown in the game. Mods can change them with texts.json
// (original text -> new text). Filled in before the game starts.
let TEXTS = {};

function drawCostume(ctx, cos) {
  if (cos.spin && ctx !== maskCtx) {
    // a flat picture spinning in 3D (like the rice bowl on the loading screen): squeeze it sideways
    const turn = Math.cos(performance.now() / 2400 * Math.PI * 2);
    ctx.translate(cos.w / 2, 0); ctx.scale(turn, 1); ctx.translate(-cos.w / 2, 0);
  }
  if (cos.clip) { ctx.beginPath(); ctx.rect(0, 0, cos.w, cos.h); ctx.clip(); }
  for (const L of cos.layers) {
    if (L.img) {
      const img = L.tint ? Assets.tinted(L.img, L.tint) : Assets.image(L.img);
      if (!img || (img.complete === false)) continue;
      ctx.save();
      if (L.cut) {                      // only show part of the picture
        ctx.beginPath(); ctx.rect(...L.cut); ctx.clip();
      }
      if (L.outline) {                  // only show the picture inside these shapes (custom night heads)
        if (!L._clip) {
          L._clip = new Path2D();
          for (const [d, m] of L.outline) L._clip.addPath(new Path2D(d), new DOMMatrix(m));
        }
        ctx.clip(L._clip);
      }
      if (L.m) {
        ctx.transform(...L.m);
        ctx.drawImage(img, 0, 0, L.iw, L.ih);
      } else {
        ctx.drawImage(img, L.x, L.y, L.w, L.h);
      }
      if (L.shade) {                    // darken the picture (characters in dark rooms)
        ctx.globalAlpha *= L.shade;
        const dark = Assets.tinted(L.img, "#000");
        if (L.m) ctx.drawImage(dark, 0, 0, L.iw, L.ih); else ctx.drawImage(dark, L.x, L.y, L.w, L.h);
      }
      ctx.restore();
    } else if (L.rect) {
      const [x, y, w, h] = L.rect;
      if (L.fill && L.hole) {
        // a filled box with a see-through window cut out of it
        const [hx, hy, hw, hh] = L.hole;
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.rect(hx, hy, hw, hh);
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
}

function drawText(ctx, L) {
  const shown = TEXTS[L.text] !== undefined ? String(TEXTS[L.text]) : L.text;
  if (L.tm) {
    // text exactly as it was in an SVG drawing (can be turned and stretched)
    ctx.save();
    ctx.transform(...L.tm);
    ctx.font = `${L.size}px "${L.font}"`;
    ctx.fillStyle = L.color;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(shown, L.pos[0], L.pos[1]);
    ctx.restore();
    return;
  }
  if (L.at) {
    // text placed like in the original drawing: [left x, baseline y, font size]
    ctx.save();
    ctx.font = `${L.at[2]}px "${L.font}"`;
    ctx.fillStyle = L.color;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(shown, L.at[0], L.at[1]);
    ctx.restore();
    return;
  }
  const [x, y, w, h] = L.box;
  const orig = measureInk(ctx, L.text, L.font);
  if (orig.w <= 0 || orig.h <= 0) return;
  ctx.save();
  ctx.font = `100px "${L.font}"`;
  ctx.fillStyle = L.color;
  ctx.textBaseline = "alphabetic";
  if (shown === L.text && !L.like) {
    // Stretch the text so its ink fills the box exactly where the old picture had it
    ctx.translate(x, y);
    ctx.scale(w / orig.w, h / orig.h);
    ctx.fillText(L.text, -orig.left, -orig.top);
  } else {
    // Changed text (or text sized like another one): keep the letter size, let the width change
    let k = h / orig.h;
    if (L.like) k = L.like[1] / measureInk(ctx, L.like[0], L.font).h;   // same letter size as L.like[0]
    const ink = measureInk(ctx, shown, L.font);
    const baseline = L.like ? y + h : y - orig.top * k;   // "like" boxes end on the baseline
    let left = x;
    if (L.align === "center") left = x + w / 2 - ink.w * k / 2;
    if (L.align === "right") left = x + w - ink.w * k;
    ctx.translate(left - ink.left * k, baseline);
    ctx.scale(k, k);
    ctx.fillText(shown, 0, 0);
  }
  ctx.restore();
}

let maskCtx = null;                  // (spinning costumes are measured unturned)

// Builds a 1-unit-per-pixel see-through map of a costume, used for clicks,
// "touching mouse" checks and keeping sprites on the stage.
function costumeMask(cos) {
  if (cos.mask !== undefined) return cos.mask;
  const w = Math.max(1, Math.ceil(cos.w)), h = Math.max(1, Math.ceil(cos.h));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  maskCtx = g;
  drawCostume(g, cos);
  maskCtx = null;
  let data = null;
  try { data = g.getImageData(0, 0, w, h).data; } catch (e) { data = null; }  // blocked when opened from a file:// URL
  let minX = w, minY = h, maxX = -1, maxY = -1;
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = data ? data[(y * w + x) * 4 + 3] : 255;
    alpha[y * w + x] = a;
    if (a > 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  cos.mask = { w, h, alpha, box: maxX < 0 ? null : [minX, minY, maxX + 1, maxY + 1] };
  return cos.mask;
}

/* ---------------------------------------------------------------------
   Target = a sprite (or the stage, or a clone of a sprite)
   --------------------------------------------------------------------- */
class Target {
  constructor(rt, def, from) {
    this.rt = rt;
    this.def = def;                      // shared data: name, costumes, sounds, scripts
    this.name = def.name;
    this.isStage = def.isStage;
    this.isClone = !!from;
    const s = from || def.start;         // starting values (or the parent's for clones)
    this.x = s.x; this.y = s.y;
    this.dir = s.dir; this.size = s.size;
    this.visible = s.visible;
    this.costumeIndex = s.costumeIndex;
    this.rotationStyle = s.rotationStyle;
    this.draggable = s.draggable;
    this.volume = s.volume;
    this.effects = { ghost: 0, brightness: 0, ...(from ? from.effects : {}) };
    this.v = { ...(from ? from.v : def.start.vars) };   // local variables
    // sound output for this sprite (each sprite has its own volume);
    // music goes through the Music slider, everything else through the Sound slider
    this.outMusic = rt.audio.createGain();
    this.outSfx = rt.audio.createGain();
    this.outMusic.gain.value = this.outSfx.gain.value = this.volume / 100;
    this.outMusic.connect(rt.musicBus);
    this.outSfx.connect(rt.sfxBus);
    this.playing = new Map();            // sound index -> playback info
  }

  get costumeObj() { return this.def.costumes[this.costumeIndex]; }
  get costumeName() { return this.costumeObj.name; }
  get costumeNumber() { return this.costumeIndex + 1; }
  get xPos() { return limitPrecision(this.x); }
  get yPos() { return limitPrecision(this.y); }

  /* ---- motion ---- */
  goTo(x, y) {
    if (this.isStage) return;
    [x, y] = this.fence(x, y);
    if (x !== this.x || y !== this.y) { this.x = x; this.y = y; this.changed(); }
  }
  changeX(dx) { this.goTo(this.x + dx, this.y); }
  changeY(dy) { this.goTo(this.x, this.y + dy); }
  setX(x) { this.goTo(x, this.y); }
  setY(y) { this.goTo(this.x, y); }
  move(steps) {
    const r = (90 - this.dir) * Math.PI / 180;
    this.goTo(this.x + steps * Math.cos(r), this.y + steps * Math.sin(r));
  }
  turn(deg) {
    let d = (this.dir + deg) % 360;
    if (d > 180) d -= 360; if (d <= -180) d += 360;
    this.dir = d; this.changed();
  }
  goToTarget(name) {
    if (name === "_mouse_") return this.goTo(this.rt.mouseX, this.rt.mouseY);
    if (name === "_random_") return this.goTo(Math.round(STAGE_W * (Math.random() - 0.5)), Math.round(STAGE_H * (Math.random() - 0.5)));
    const t = this.rt.sprite(name);
    if (t) this.goTo(t.x, t.y);
  }
  *glide(secs, x, y) {
    const sx = this.x, sy = this.y, start = performance.now(), ms = secs * 1000;
    if (ms <= 0) { this.goTo(x, y); return; }
    yield WAIT;
    for (;;) {
      const f = (performance.now() - start) / ms;
      if (f >= 1) { this.goTo(x, y); return; }
      this.goTo(sx + (x - sx) * f, sy + (y - sy) * f);
      yield WAIT;
    }
  }

  // Scratch keeps at least a small part of every sprite on the stage
  bounds(x = this.x, y = this.y) {
    const m = costumeMask(this.costumeObj);
    if (!m.box) return null;
    const c = this.costumeObj, s = this.size / 100;
    const [x0, y0, x1, y1] = m.box;
    let pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([u, v]) => [(u - c.cx) * s, (c.cy - v) * s]);
    if (this.rotationStyle === "all around" && this.dir !== 90) {
      const r = (90 - this.dir) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
      pts = pts.map(([px, py]) => [px * cs - py * sn, px * sn + py * cs]);
    } else if (this.rotationStyle === "left-right" && this.dir < 0) {
      pts = pts.map(([px, py]) => [-px, py]);
    }
    const xs = pts.map(p => p[0] + x), ys = pts.map(p => p[1] + y);
    return { left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) };
  }
  fence(x, y) {
    const b = this.bounds();
    if (!b) return [x, y];
    const dx = x - this.x, dy = y - this.y;
    const inset = Math.floor(Math.min(b.right - b.left, b.top - b.bottom) / 2);
    const sx = STAGE_W / 2 - Math.min(FENCE, inset), sy = STAGE_H / 2 - Math.min(FENCE, inset);
    if (b.right + dx < -sx) x = Math.ceil(this.x - (sx + b.right));
    else if (b.left + dx > sx) x = Math.floor(this.x + (sx - b.left));
    if (b.top + dy < -sy) y = Math.ceil(this.y - (sy + b.top));
    else if (b.bottom + dy > sy) y = Math.floor(this.y + (sy - b.bottom));
    return [x, y];
  }

  /* ---- looks ---- */
  show() { if (!this.visible) { this.visible = true; this.rt.redraw(); } }
  hide() { if (this.visible) { this.visible = false; this.rt.redraw(); } }
  costume(c) {
    const list = this.def.costumes;
    if (typeof c === "number") { this.setCostumeIndex(c - 1); return; }
    const i = list.findIndex(k => k.name === c);
    if (i >= 0) { this.setCostumeIndex(i); return; }
    if (c === "next costume") return this.nextCostume();
    if (c === "previous costume") return this.setCostumeIndex(this.costumeIndex - 1);
    if (c === "random costume") return this.setCostumeIndex(Math.floor(Math.random() * list.length));
    if (!isNaN(Number(c)) && !isWhite(c)) this.setCostumeIndex(Number(c) - 1);
  }
  setCostumeIndex(i) {
    const n = this.def.costumes.length;
    i = ((Math.round(i) % n) + n) % n;
    if (i !== this.costumeIndex) { this.costumeIndex = i; this.changed(); }
  }
  nextCostume() { this.setCostumeIndex(this.costumeIndex + 1); }
  setSize(size) {
    if (this.isStage) return;
    const c = this.costumeObj;
    const minScale = Math.min(1, Math.max(5 / c.w, 5 / c.h));
    const maxScale = Math.min(1.5 * STAGE_W / c.w, 1.5 * STAGE_H / c.h);
    const s = Math.min(maxScale, Math.max(minScale, size / 100)) * 100;
    if (s !== this.size) { this.size = s; this.changed(); }
  }
  effect(name) { return this.effects[name] || 0; }
  setEffect(name, value) {
    if (name === "ghost") value = Math.min(100, Math.max(0, value));
    if (name === "brightness") value = Math.min(100, Math.max(-100, value));
    this.effects[name] = value; this.changed();
  }
  clearEffects() { this.effects = { ghost: 0, brightness: 0 }; this.changed(); }
  goToFront() { this.rt.moveLayer(this, Infinity); }
  goToBack() { this.rt.moveLayer(this, -Infinity); }
  moveLayers(n) { this.rt.moveLayer(this, Math.round(n), true); }
  changed() { if (this.visible) this.rt.redraw(); }

  /* ---- sound ---- */
  findSound(s) {
    const list = this.def.sounds;
    let i = list.findIndex(k => k.name === s);
    if (i < 0 && typeof s === "number") i = ((Math.round(s) - 1) % list.length + list.length) % list.length;
    if (i < 0 && !isNaN(Number(s)) && !isWhite(s)) i = ((Math.round(Number(s)) - 1) % list.length + list.length) % list.length;
    return i;
  }
  playSound(s) {
    const i = this.findSound(s);
    if (i < 0) return null;
    this.stopSound(i);                    // playing the same sound again restarts it
    const buf = Assets.sounds.get(this.def.sounds[i].src);
    const p = { done: false };
    if (buf) {
      const src = this.rt.audio.createBufferSource();
      src.buffer = buf;
      src.connect(this.def.sounds[i].music ? this.outMusic : this.outSfx);
      src.onended = () => { p.done = true; if (this.playing.get(i) === p) this.playing.delete(i); };
      src.start();
      p.src = src;
    } else p.done = true;
    this.playing.set(i, p);
    return p;
  }
  *playSoundUntilDone(s) {
    const p = this.playSound(s);
    while (p && !p.done) yield WAIT;
  }
  stopSound(i) {
    const p = this.playing.get(i);
    if (p) { p.done = true; try { p.src && p.src.stop(); } catch (e) {} this.playing.delete(i); }
  }
  stopSounds() { for (const i of [...this.playing.keys()]) this.stopSound(i); }
  setVolume(v) {
    this.volume = Math.min(100, Math.max(0, v));
    this.outMusic.gain.value = this.outSfx.gain.value = this.volume / 100;
  }

  /* ---- sensing ---- */
  // true if stage point (x, y) lands on a non-see-through pixel of this sprite
  hitTest(x, y) {
    const c = this.costumeObj, s = this.size / 100;
    let px = x - this.x, py = y - this.y;
    if (this.rotationStyle === "all around" && this.dir !== 90) {
      const r = -(90 - this.dir) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
      [px, py] = [px * cs - py * sn, px * sn + py * cs];
    } else if (this.rotationStyle === "left-right" && this.dir < 0) px = -px;
    const u = Math.floor(px / s + c.cx), v = Math.floor(c.cy - py / s);
    const m = costumeMask(c);
    if (u < 0 || v < 0 || u >= m.w || v >= m.h) return false;
    return m.alpha[v * m.w + u] > 0;
  }
  touching(what) {
    if (what === "_mouse_") {
      if (this.isStage) return false;
      return this.hitTest(this.rt.mouseX, this.rt.mouseY);
    }
    return false; // (this project only checks the mouse pointer)
  }
}

/* ---------------------------------------------------------------------
   Thread = one running script
   --------------------------------------------------------------------- */
class Thread {
  constructor(target, script) {
    this.target = target;
    this.script = script;
    this.gen = script.fn.call(target, target);
    this.done = false;
  }
}

/* ---------------------------------------------------------------------
   Runtime = the whole game: all sprites, all running scripts, drawing
   --------------------------------------------------------------------- */
class Runtime {
  constructor(canvas, project) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.audio.createGain();
    this.master.connect(this.audio.destination);
    this.musicBus = this.audio.createGain();      // Music volume (settings)
    this.sfxBus = this.audio.createGain();        // Sound volume (settings)
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.hooks = {};                              // page code that runs when a message is broadcast
    this.project = project;
    this.defs = new Map();                 // sprite name -> shared definition
    this.targets = [];                     // stage + sprites + clones
    this.drawOrder = [];                   // sprites from back to front
    this.threads = [];
    this.cur = null;                       // the thread being stepped right now
    this.mouseX = 0; this.mouseY = 0; this.mouseDown = false;
    this.keys = new Set();
    this.arrowHistory = [];
    this.answer = "";
    this.needsRedraw = true;
    this.redrawRequested = false;
    for (const d of project.targets) { d.scripts = []; this.defs.set(d.name, d); }
  }

  /* ---- setup ---- */
  scripts(name, register) {
    const d = this.defs.get(name);
    if (!d) return;
    register({ on: (type, arg, fn) => {
      if (typeof arg === "function") { fn = arg; arg = null; }
      d.scripts.push({ type, arg: arg === null ? null : String(arg).toLowerCase(), fn });
    } });
  }
  createTargets() {
    for (const t of this.targets) t.stopSounds();
    this.targets = []; this.drawOrder = [];
    const defs = [...this.defs.values()].sort((a, b) => a.start.layer - b.start.layer);
    for (const d of defs) {
      const t = new Target(this, d);
      this.targets.push(t);
      if (t.isStage) { this.stage = t; G = t.v; } else this.drawOrder.push(t);
    }
  }
  sprite(name) { return this.targets.find(t => t.name === name && !t.isClone && !t.isStage); }

  /* ---- scripts and events ---- */
  // Scripts start top sprite first, stage last (same order as Scratch)
  executionOrder() { return [...this.drawOrder].reverse().concat(this.stage ? [this.stage] : []); }

  startHats(type, arg = null, only = null, restart = true) {
    const key = arg === null ? null : String(arg).toLowerCase();
    const started = [];
    for (const t of only ? [only] : this.executionOrder()) {
      for (const s of t.def.scripts) {
        if (s.type !== type || s.arg !== key) continue;
        const old = this.threads.find(th => th.target === t && th.script === s && !th.done);
        if (old) {
          if (!restart) continue;
          const fresh = new Thread(t, s);
          old.done = true;                       // the old run stops at its next pause
          this.threads[this.threads.indexOf(old)] = fresh;
          started.push(fresh);
        } else {
          const th = new Thread(t, s);
          this.threads.push(th);
          started.push(th);
        }
      }
    }
    return started;
  }
  broadcast(name) {
    const hook = this.hooks[str(name).toLowerCase()];
    if (hook) hook();
    return this.startHats("broadcast", str(name));
  }
  *broadcastAndWait(name) {
    const started = this.broadcast(name);
    yield WAIT;
    while (started.some(th => !th.done)) yield WAIT;
  }
  *wait(secs) {
    const end = performance.now() + Math.max(0, secs * 1000);
    this.redraw();                               // Scratch ends the busy loop when a wait starts
    yield WAIT;
    while (performance.now() < end) yield WAIT;
  }
  *waitUntil(test) { while (!test()) yield WAIT; }
  *ask(question) {
    const box = document.getElementById("ask");
    const input = document.getElementById("askInput");
    document.getElementById("askText").textContent = question;
    box.hidden = false; input.value = ""; input.focus();
    let answered = null;
    const finish = () => { answered = input.value; };
    box.onsubmit = e => { e.preventDefault(); finish(); };
    while (answered === null) yield WAIT;
    box.hidden = true;
    this.answer = answered;
    document.getElementById("stage").focus();
  }

  stopOtherScripts(t) {
    for (const th of this.threads) if (th.target === t && th !== this.cur) th.done = true;
    t.stopSounds();                              // Scratch also stops that sprite's sounds
  }
  stopAllSounds() { for (const t of this.targets) t.stopSounds(); }
  stopAll() {
    for (const th of this.threads) th.done = true;
    this.threads = [];
    this.stopAllSounds();
    this.targets = this.targets.filter(t => !t.isClone);
    this.drawOrder = this.drawOrder.filter(t => !t.isClone);
    for (const t of this.targets) t.clearEffects();
    this.redraw();
  }
  greenFlag() {
    this.stopAll();
    this.startHats("flag");
  }

  createClone(t, which) {
    const src = which === "_myself_" ? t : this.sprite(which);
    if (!src || this.targets.filter(k => k.isClone).length >= 300) return;
    const c = new Target(this, src.def, src);
    this.targets.push(c);
    this.drawOrder.splice(this.drawOrder.indexOf(src), 0, c);   // clones sit just behind the original
    this.startHats("clone", null, c);
  }

  // value of another sprite ("x position of Fan", etc.)
  of(name, prop) {
    const t = name === "_stage_" ? this.stage : this.sprite(name);
    if (!t) return 0;
    switch (prop) {
      case "x position": return t.xPos;
      case "y position": return t.yPos;
      case "direction": return t.dir;
      case "costume #": case "backdrop #": return t.costumeNumber;
      case "costume name": case "backdrop name": return t.costumeName;
      case "size": return t.size;
      case "volume": return t.volume;
      default: return prop in t.v ? t.v[prop] : 0;
    }
  }

  moveLayer(t, n, relative = false) {
    const list = this.drawOrder, i = list.indexOf(t);
    if (i < 0) return;
    list.splice(i, 1);
    let j = relative ? i + n : (n > 0 ? list.length : 0);
    j = Math.max(0, Math.min(list.length, j));
    list.splice(j, 0, t);
    this.redraw();
  }

  redraw() { this.redrawRequested = true; this.needsRedraw = true; }

  /* ---- one frame of scripts ---- */
  step() {
    this.redrawRequested = false;
    // remember where everything was, so frames drawn between steps can blend smoothly
    for (const t of this.targets) {
      t.prev = { x: t.x, y: t.y, size: t.size, dir: t.dir, ghost: t.effects.ghost, costume: t.costumeIndex, visible: t.visible };
    }
    // "while key held" hats (Makey Makey key block) start whenever the key is down
    for (const t of this.executionOrder()) for (const s of t.def.scripts) {
      if (s.type === "keyHeld" && this.keys.has(s.arg)) this.startHats("keyHeld", s.arg, t, false);
    }
    const start = performance.now();
    let busy;
    do {
      busy = 0;
      for (let i = 0; i < this.threads.length; i++) {
        const th = this.threads[i];
        if (th.done) continue;
        this.cur = th;
        let r;
        try { r = th.gen.next(); }
        catch (e) { console.error(`Script error in "${th.target.name}"`, e); r = { done: true }; }
        if (r.done) th.done = true;
        else if (r.value !== WAIT && !th.done) busy++;
      }
      this.cur = null;
      this.threads = this.threads.filter(th => !th.done);
    } while (busy > 0 && !this.redrawRequested && performance.now() - start < WORK_MS);
  }

  /* ---- drawing ---- */
  // a = how far we are between the last step and the next one (0 to 1).
  // Position, size, turn and fade are blended so movement looks smooth on fast screens;
  // big jumps (teleports, costume changes) are not blended.
  render(a = 1) {
    const ctx = this.ctx, cw = this.canvas.width, ch = this.canvas.height;
    const k = cw / STAGE_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    let moving = false;
    for (const t of [this.stage, ...this.drawOrder]) {
      if (!t || !t.visible) continue;
      let { x, y, size, dir } = t, ghost = t.effects.ghost;
      const p = t.prev;
      if (SMOOTH && p && a < 1 && p.visible && !t.isStage) {
        // Same rules as TurboWarp's interpolation:
        const f = (u, v) => u + (v - u) * a;
        // position: always, unless it is a big jump (judged by the sprite's own size)
        const dx = x - p.x, dy = y - p.y;
        const b = t.bounds();
        const tol = b ? Math.min(240, Math.max(50, 1.5 * ((b.right - b.left) + (b.top - b.bottom)))) : 50;
        if ((Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) && Math.abs(dx) < tol && Math.abs(dy) < tol) {
          x = f(p.x, x); y = f(p.y, y); moving = true;
        }
        // fade: small changes only
        const dg = ghost - p.ghost;
        if (dg !== 0 && Math.abs(dg) < 25) { ghost = f(p.ghost, ghost); moving = true; }
        // turn and size: only while the costume stays the same
        if (p.costume === t.costumeIndex) {
          if (dir !== p.dir && !(p.dir % 90 === 0 && dir % 90 === 0)) {
            const r1 = p.dir * Math.PI / 180, r2 = dir * Math.PI / 180;
            dir = Math.atan2(f(Math.sin(r1), Math.sin(r2)), f(Math.cos(r1), Math.cos(r2))) * 180 / Math.PI;
            moving = true;
          }
          if (size !== p.size && Math.abs(size - p.size) < 100) { size = f(p.size, size); moving = true; }
        }
      }
      if (ghost >= 100) continue;
      const c = t.costumeObj;
      ctx.save();
      ctx.setTransform(k, 0, 0, k, 0, 0);
      if (t.isStage) {
        ctx.translate(STAGE_W / 2 - c.cx, STAGE_H / 2 - c.cy);
      } else {
        ctx.translate(STAGE_W / 2 + x, STAGE_H / 2 - y);
        if (t.rotationStyle === "all around") ctx.rotate((dir - 90) * Math.PI / 180);
        else if (t.rotationStyle === "left-right" && dir < 0) ctx.scale(-1, 1);
        ctx.scale(size / 100, size / 100);
        ctx.translate(-c.cx, -c.cy);
      }
      ctx.globalAlpha = 1 - ghost / 100;
      // brightness: Scratch adds light; a CSS filter is a close match
      if (t.effects.brightness) ctx.filter = `brightness(${Math.max(0, 1 + t.effects.brightness / 100)})`;
      drawCostume(ctx, c);
      ctx.restore();
      if (c.spin) moving = true;        // keep the spin going
    }
    this.needsRedraw = false;
    this.moving = moving;               // keep drawing in-between frames while something moves
  }

  /* ---- input ---- */
  setMouse(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const x = (clientX - r.left) / r.width * STAGE_W - STAGE_W / 2;
    const y = STAGE_H / 2 - (clientY - r.top) / r.height * STAGE_H;
    this.mouseX = Math.round(Math.max(-STAGE_W / 2, Math.min(STAGE_W / 2, x)));
    this.mouseY = Math.round(Math.max(-STAGE_H / 2, Math.min(STAGE_H / 2, y)));
  }
  pick(x, y) {
    for (let i = this.drawOrder.length - 1; i >= 0; i--) {
      const t = this.drawOrder[i];
      if (t.visible && t.hitTest(x, y)) return t;
    }
    return null;
  }
  mousePressed() {
    this.mouseDown = true;
    const t = this.pick(this.mouseX, this.mouseY);
    if (!t) return;
    if (t.draggable) { this.drag = { t, ox: t.x - this.mouseX, oy: t.y - this.mouseY, moved: false }; t.goToFront(); }
    else this.startHats("click", null, t);
  }
  mouseMoved() {
    if (this.drag && this.mouseDown) {
      const d = this.drag;
      d.t.goTo(this.mouseX + d.ox, this.mouseY + d.oy);
      d.moved = true;
    }
  }
  mouseReleased() {
    this.mouseDown = false;
    if (this.drag) { if (!this.drag.moved) this.startHats("click", null, this.drag.t); this.drag = null; }
  }
  keyPressed(key) {
    this.keys.add(key);
    this.startHats("key", key, null, false);
    this.startHats("key", "any", null, false);
    // Makey Makey "when code pressed" (arrow key sequences)
    const arrow = { "left arrow": "LEFT", "right arrow": "RIGHT", "up arrow": "UP", "down arrow": "DOWN" }[key];
    if (arrow) {
      this.arrowHistory.push(arrow);
      if (this.arrowHistory.length > 8) this.arrowHistory.shift();
      for (const t of this.executionOrder()) for (const s of t.def.scripts) {
        if (s.type !== "keySequence") continue;
        const seq = s.arg.toUpperCase().split(" ");
        if (this.arrowHistory.slice(-seq.length).join(" ") === seq.join(" ")) {
          this.startHats("keySequence", s.arg, t, false);
        }
      }
    }
  }
  keyReleased(key) { this.keys.delete(key); }
}

// Turns a browser key name into Scratch's key name
function scratchKey(e) {
  const map = { ArrowLeft: "left arrow", ArrowRight: "right arrow", ArrowUp: "up arrow", ArrowDown: "down arrow", " ": "space", Enter: "enter" };
  if (map[e.key]) return map[e.key];
  return e.key.length === 1 ? e.key.toLowerCase() : null;
}

// Stage variables are global, so scripts can just write G.level
let G = {};
let rt;
function scripts(name, register) { rt.scripts(name, register); }
