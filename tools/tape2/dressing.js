/* =====================================================================
   THE OFFICE CHANGES EVERY NIGHT (Tape 2)

   Aidan's office render stays the same picture; this file "dresses" it
   on top, a little more each night: plushies (Actors.plush) that show up and move
   around, new posters over the pizza poster, kids' drawings on the walls,
   sticky notes, papers on the floor, things on the desk, and different
   pictures on the TV stacks (left ones swapped, the dark right ones
   turned on).

   Everything is drawn in OFFICE PICTURE UNITS (the office picture is
   480 x 230 units; drawOffice runs this inside inPicture()). The spots
   below were measured on tools/tape2/office/000.png.

   DRESSING[night] is the list of things for that night (custom night =
   7). Each thing is one of:
     { plush: role, at: [x, y], tall, rot, flip, kind }   a character plushie (feet at x, y)
     { prop: "cupcake" | "balloon" | "popped" | "present" | "pizzabox", at, tall, rot }
     { wall: slot, art }       a picture on a wall slot (WALL_SLOTS, drawn in perspective)
     { tv: screen, show }      a TV screen (TV_SCREENS): "bars" "static" "off" "eyes" "text:..." "face:<role>"
     { floor: art, at, w, rot }  a sheet lying flat on the floor/desk
     { ball: [x, y], r }       a crumpled paper ball
   Things with desk: true are on the desk (the figurine keeps away from them).
   Arts are painted once into small canvases (ART below) and cached.
   ===================================================================== */
"use strict";

// Wall spots, as quads with straight up-and-down sides: left side x0 (top t0, bottom b0), right side x1 (t1, b1)
const WALL_SLOTS = {
  pizza:   { x0: 49, t0: 37, b0: 86, x1: 113, t1: 59, b1: 95 },     // over the pizza poster (left wall)
  leftWall:{ x0: 8, t0: 24, b0: 76, x1: 42, t1: 36, b1: 81 },       // further left on the same wall
  notesL:  { x0: 183, t0: 89, b0: 114, x1: 198, t1: 89, b1: 114 },   // the sticky papers left of the hall door
  notesR:  { x0: 275, t0: 83, b0: 114, x1: 294, t1: 83, b1: 114 },   // ...and right of it
  right1:  { x0: 402, t0: 46, b0: 78, x1: 424, t1: 38, b1: 74 },     // next to the kids' drawings (right wall)
  right2:  { x0: 428, t0: 52, b0: 94, x1: 454, t1: 42, b1: 92 },
  overDrawings: { x0: 343, t0: 58, b0: 102, x1: 400, t1: 38, b1: 100 },   // right over the old drawings
};
// The TV screens: [left, top, right, bottom]. L = the stack left of the hall (faces), R = the dark stack on the right.
const TV_SCREENS = {
  Ltop: [169, 104, 180, 112.5], Lmidl: [144.5, 116, 159.5, 123.5], Lmidr: [167.5, 114.5, 180, 124],
  Lbotl: [145, 130, 159.5, 138.8], Lbotr: [167, 129.6, 180, 138.8],
  Rtop: [318, 104.5, 328.5, 112.5], Rmidl: [297.5, 115, 308.5, 125], Rmidr: [316.5, 115.5, 330, 125.6], Rbotl: [297.5, 128.5, 308.5, 135],
};
const ALL_TVS = Object.keys(TV_SCREENS);
const tvs = (list, show) => list.map(tv => ({ tv, show }));

/* ---------------------------------------------------------------------
   Night by night. Night 1 is the office as Aidan made it (plus one note).
   --------------------------------------------------------------------- */
const DRESSING = {
  1: [
    { floor: "note:wind the music box :)", at: [118, 176], w: 14, rot: -12, desk: true },
  ],
  2: [
    { floor: "note:wind the music box :)", at: [122, 178], w: 14, rot: 8, desk: true },
    { tv: "Ltop", show: "bars" },
    { wall: "right1", art: "drawing:tfreddy" },
    { wall: "notesL", art: "sticky:Fred was here" },
    { plush: "tbonnie", at: [323, 104.5], tall: 12 },                  // on top of the right TVs
    { prop: "cupcake", at: [128, 165], tall: 11, desk: true },
    { ball: [44, 196], r: 4 },
  ],
  3: [
    { wall: "pizza", art: "poster:celebrate" },
    { wall: "right1", art: "drawing:tfreddy" },
    { wall: "right2", art: "drawing:tchica" },
    { wall: "notesL", art: "sticky:Fred was here" },
    ...tvs(["Ltop", "Lmidr"], "static"),
    { tv: "Lmidl", show: "face:tfreddy" }, { tv: "Lbotl", show: "face:tchica" }, { tv: "Lbotr", show: "face:tbonnie" },
    { tv: "Rmidl", show: "bars" },
    { plush: "tbonnie", at: [350, 168], tall: 20, desk: true },          // moved down onto the desk
    { plush: "tchica", at: [42, 186], tall: 30 },
    { prop: "cupcake", at: [174.5, 103.5], tall: 8 },                   // up on the left TVs now
    { prop: "balloon", at: [430, 196], tall: 46 },
    { ball: [44, 196], r: 4 }, { ball: [458, 205], r: 5 },
    { floor: "paper", at: [70, 205], w: 26, rot: 25 },
  ],
  4: [
    { wall: "pizza", art: "poster:celebrate-torn" },
    { wall: "leftWall", art: "poster:missing" },
    { wall: "right1", art: "drawing:tfreddy" },
    { wall: "right2", art: "drawing:tchica" },
    { wall: "notesL", art: "sticky:they move at night" },
    { wall: "notesR", art: "sticky:CHECK THE VENTS" },
    ...tvs(["Ltop", "Lmidl", "Lmidr", "Lbotr"], "static"),
    { tv: "Lbotl", show: "face:wfreddy" },
    { tv: "Rmidl", show: "static" }, { tv: "Rtop", show: "face:mangle" },
    { plush: "tbonnie", at: [205, 182], tall: 22, rot: 78, desk: true },   // fallen over in the middle of the desk
    { plush: "tchica", at: [440, 180], tall: 28 },                        // crossed the room
    { plush: "foxy", at: [150, 147], tall: 16 },
    { prop: "cupcake", at: [118, 178], tall: 12, rot: -20, desk: true },
    { prop: "popped", at: [430, 196], tall: 30 },
    { prop: "present", at: [28, 194], tall: 20 },
    { ball: [44, 196], r: 4 }, { ball: [458, 205], r: 5 }, { ball: [96, 186], r: 3.5 }, { ball: [330, 150], r: 3 },
    { floor: "paper", at: [70, 205], w: 26, rot: 25 }, { floor: "paper", at: [445, 214], w: 30, rot: -40 },
  ],
  5: [
    { wall: "pizza", art: "poster:itsme" },
    { wall: "leftWall", art: "poster:missing" },
    { wall: "overDrawings", art: "drawing:red" },
    { wall: "right1", art: "drawing:redsmall" },
    { wall: "right2", art: "drawing:wchica" },
    { wall: "notesL", art: "sticky:HELP" },
    { wall: "notesR", art: "sticky:don't take the mask off" },
    ...tvs(["Ltop", "Lmidr", "Rtop", "Rbotl"], "static"),
    { tv: "Lmidl", show: "face:wbonnie" }, { tv: "Lbotl", show: "face:wchica" }, { tv: "Lbotr", show: "face:foxy" },
    { tv: "Rmidl", show: "eyes" }, { tv: "Rmidr", show: "text:IT'S ME" },
    { plush: "tbonnie", at: [323, 104.5], tall: 12, kind: "creep" },      // back on the TVs, but wrong
    { plush: "tchica", at: [128, 165], tall: 20, kind: "creep", desk: true },
    { plush: "foxy", at: [42, 186], tall: 30, kind: "creep" },
    { plush: "mangle", at: [455, 200], tall: 30, rot: 160, kind: "creep" },
    { plush: "bb", at: [150, 147], tall: 15 },
    { prop: "present", at: [350, 168], tall: 16, desk: true },
    { prop: "popped", at: [430, 196], tall: 30 },
    { ball: [44, 200], r: 4 }, { ball: [458, 205], r: 5 }, { ball: [96, 186], r: 3.5 }, { ball: [330, 150], r: 3 }, { ball: [24, 215], r: 5 },
    { floor: "paper", at: [70, 205], w: 26, rot: 25 }, { floor: "paper", at: [445, 214], w: 30, rot: -40 },
    { floor: "drawing:red", at: [15, 180], w: 22, rot: 70 }, { floor: "paper", at: [205, 180], w: 18, rot: 5, desk: true },
  ],
  6: [
    { wall: "pizza", art: "poster:golden" },
    { wall: "leftWall", art: "poster:itsme" },
    { wall: "overDrawings", art: "drawing:red" },
    { wall: "right1", art: "poster:itsme-small" },
    { wall: "right2", art: "drawing:redsmall" },
    { wall: "notesL", art: "sticky:IT'S ME" },
    { wall: "notesR", art: "sticky:IT'S ME" },
    ...tvs(ALL_TVS, "eyes"),
    { tv: "Lmidr", show: "text:IT'S ME" }, { tv: "Rmidr", show: "text:IT'S ME" },
    // everyone came to watch you
    { plush: "tfreddy", at: [174.5, 103.5], tall: 12, kind: "creep" },
    { plush: "tbonnie", at: [323, 104.5], tall: 12, kind: "creep" },
    { plush: "tchica", at: [128, 165], tall: 20, kind: "creep", desk: true },
    { plush: "golden", at: [350, 168], tall: 22, kind: "creep", desk: true },
    { plush: "foxy", at: [42, 186], tall: 30, kind: "creep" },
    { plush: "wfreddy", at: [440, 180], tall: 28, kind: "creep" },
    { plush: "mangle", at: [455, 205], tall: 30, rot: 160, kind: "creep" },
    { plush: "bb", at: [150, 147], tall: 15, kind: "creep" },
    { plush: "puppet", at: [330, 148], tall: 18, kind: "creep" },
    { plush: "wchica", at: [24, 210], tall: 40, kind: "creep" },
    { prop: "popped", at: [430, 196], tall: 30 },
    { ball: [96, 186], r: 3.5 }, { ball: [458, 214], r: 5 },
    { floor: "paper", at: [70, 205], w: 26, rot: 25 }, { floor: "paper", at: [445, 218], w: 30, rot: -40 },
    { floor: "drawing:red", at: [205, 181], w: 18, rot: -8, desk: true }, { floor: "poster:missing", at: [110, 214], w: 30, rot: 15 },
  ],
};
DRESSING[7] = DRESSING[6];          // custom night: the office as it is on the 6th night

/* ---------------------------------------------------------------------
   Drawing
   --------------------------------------------------------------------- */
const Dressing = {
  arts: new Map(),          // "art name" -> {img, black}

  // the list for a night
  list(level) { return DRESSING[Math.min(7, Math.max(1, level))] || []; },

  // spots on the desk that are taken tonight, for the figurine: [left, top, right, bottom]
  // in FIGURINE_DESK units (x from the office's middle, y = screen y)
  deskBlocks(level) {
    const out = [];
    for (const t of this.list(level)) {
      if (!t.desk) continue;
      const [x, y] = t.at || t.plush && t.at;
      const size = t.tall || t.w || 12;
      const X = (x - 240) * 1.5, Y = 180 + (y - 115) * 1.5;
      out.push([X - size * 0.9, Y - 6, X + size * 0.9, Y + 6]);
    }
    return out;
  },

  // Everything for tonight. Runs inside inPicture() (office picture units).
  // shade: how dark the office is right now (0..1), tick: the game's tick (TV static)
  draw(ctx, level, shade, tick) {
    for (const t of this.list(level)) {
      if (t.wall) this.quad(ctx, this.art(t.art), WALL_SLOTS[t.wall], shade);
      else if (t.tv) this.screen(ctx, TV_SCREENS[t.tv], t.show, shade, tick);
      else if (t.floor) this.flat(ctx, this.art(t.floor), t.at, t.w, t.rot || 0, shade);
      else if (t.ball) this.ball(ctx, t.ball, t.r, shade);
      else if (t.prop) this.prop(ctx, t, shade);
      else if (t.plush) {
        const [x, y] = t.at, h = t.tall;
        drawActor(ctx, t.plush, [x - h * 0.45, y - h, x + h * 0.45, y],
          { mode: "body", kind: t.kind || "stand", still: true, plush: true, rot: t.rot || 0, flip: t.flip, shade: Math.min(0.9, shade + 0.1) });
      }
    }
  },

  // a picture on a wall, in perspective (drawn in thin up-and-down strips)
  quad(ctx, a, q, shade) {
    if (!a || !q) return;
    const N = Math.max(8, Math.ceil(Math.abs(q.x1 - q.x0) * 1.5));
    const W = a.img.width, H = a.img.height;
    const strips = img => {
      for (let i = 0; i < N; i++) {
        const f = i / N, f2 = (i + 1) / N;
        const dx = q.x0 + (q.x1 - q.x0) * f, dw = (q.x1 - q.x0) / N;
        const t = q.t0 + (q.t1 - q.t0) * (f + f2) / 2, b = q.b0 + (q.b1 - q.b0) * (f + f2) / 2;
        ctx.drawImage(img, W * f, 0, W / N, H, dx, t, dw + 0.25, b - t);
      }
    };
    strips(a.img);
    if (shade > 0.01) { ctx.save(); ctx.globalAlpha *= shade; strips(a.black); ctx.restore(); }
  },

  // a sheet lying flat (squashed: seen from above at an angle)
  flat(ctx, a, [x, y], w, rot, shade) {
    if (!a) return;
    const h = w * a.img.height / a.img.width;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.42);
    ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(a.img, -w / 2, -h / 2, w, h);
    if (shade > 0.01) { ctx.globalAlpha *= Math.min(0.9, shade + 0.08); ctx.drawImage(a.black, -w / 2, -h / 2, w, h); }
    ctx.restore();
  },

  ball(ctx, [x, y], r, shade) {
    const a = this.art("ball");
    this.flatUp(ctx, a, x, y, r * 2.2, 0, shade);
  },
  // standing up (props): bottom middle at (x, y), `tall` units tall
  flatUp(ctx, a, x, y, tall, rot, shade) {
    if (!a) return;
    const w = tall * a.img.width / a.img.height;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(a.img, -w / 2, -tall, w, tall);
    if (shade > 0.01) { ctx.globalAlpha *= shade; ctx.drawImage(a.black, -w / 2, -tall, w, tall); }
    ctx.restore();
  },
  prop(ctx, t, shade) { this.flatUp(ctx, this.art("prop:" + t.prop), t.at[0], t.at[1], t.tall, t.rot || 0, shade); },

  // a TV screen (they glow, so they are only a little darker than the room)
  screen(ctx, r, show, shade, tick) {
    if (!r) return;
    const [x0, y0, x1, y1] = r;
    let a;
    if (show === "static") a = this.art("tv:static" + (Math.floor(tick / 2) % 4));
    else if (show === "eyes") a = this.art(Math.floor(tick / 45) % 9 === 0 ? "tv:off" : "tv:eyes");     // (they blink)
    else a = this.art("tv:" + show);
    if (!a) return;
    ctx.drawImage(a.img, x0, y0, x1 - x0, y1 - y0);
    // the glass: a little shine and darker edges
    const g = ctx.createRadialGradient((x0 + x1) / 2, (y0 + y1) / 2, 0, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) * 0.7);
    g.addColorStop(0.55, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (shade > 0.3) { ctx.globalAlpha = (shade - 0.3) * 0.6; ctx.drawImage(a.black, x0, y0, x1 - x0, y1 - y0); ctx.globalAlpha = 1; }
  },

  /* ---- the pictures, painted once ---- */
  art(name) {
    if (this.arts.has(name)) return this.arts.get(name);
    const made = paintArt(name);
    const a = made ? { img: made, black: blackCopy(made, made.width, made.height) } : null;
    // (a character picture made before the 3D models are ready would be the wrong one: only keep finished ones)
    if (a || !name.includes(":")) this.arts.set(name, a);
    return a;
  },
};

// The room's warm yellow light, painted over paper so it doesn't look stuck on
const ROOM_TINT = "#e9d6a4";

function newCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")];
}
// a little wobbly line (crayon / handwriting)
function wobbly(g, pts, wob = 1.2) {
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = x + (Math.sin(x * 7.1 + y * 3.3) * wob), jy = y + (Math.cos(x * 2.7 + y * 5.9) * wob);
    if (i === 0) g.moveTo(jx, jy); else g.lineTo(jx, jy);
  });
  g.stroke();
}
function tint(g, w, h) {
  const shape = document.createElement("canvas");          // (multiply also paints the see-through parts: put them back after)
  shape.width = w; shape.height = h;
  shape.getContext("2d").drawImage(g.canvas, 0, 0);
  g.save();
  g.globalCompositeOperation = "multiply";
  g.fillStyle = ROOM_TINT; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(shape, 0, 0);
  g.restore();
}
// paper with a torn, see-through edge somewhere
function paper(g, w, h, color = "#f4f1e6") {
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
}
// a character's head (or whole body) painted into a box (needs the characters loaded)
function charInto(g, role, box, o = {}) {
  if (!Actors.get(role, o.kind || "stand", true)) return false;
  drawActor(g, role, box, { mode: o.mode || "head", still: true, kind: o.kind || "stand", shade: o.shade || 0, tint: o.tint, rot: o.rot });
  return true;
}
function bigText(g, text, x, y, size, color, font = "Press Start 2P", o = {}) {
  g.save();
  g.font = (o.bold ? "bold " : "") + size + "px \"" + font + "\"";
  g.textAlign = o.align || "center"; g.textBaseline = "middle";
  if (o.rot) { g.translate(x, y); g.rotate(o.rot); x = 0; y = 0; }
  // (shrink to fit)
  if (o.maxW) { const m = g.measureText(text).width; if (m > o.maxW) g.font = (o.bold ? "bold " : "") + Math.floor(size * o.maxW / m) + "px \"" + font + "\""; }
  if (o.outline) { g.lineWidth = o.outline; g.strokeStyle = "#000"; g.strokeText(text, x, y); }
  g.fillStyle = color; g.fillText(text, x, y);
  g.restore();
}

function paintArt(name) {
  const [kind, what = ""] = name.split(/:(.*)/s);
  // ---- posters (the pizza poster's spot and the walls) ----
  if (kind === "poster") {
    const small = what.endsWith("-small");
    const [c, g] = newCanvas(small ? 120 : 200, small ? 150 : 150);
    const w = c.width, h = c.height;
    if (what === "celebrate" || what === "celebrate-torn") {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, "#1d2b8f"); grd.addColorStop(1, "#4a1170");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { g.fillStyle = ["#ffd400", "#ff4fa3", "#3fe0ff"][i % 3]; g.fillRect((i * 53) % w, (i * 37) % h, 3, 3); }
      if (!charInto(g, "tfreddy", [60, 22, 140, 112])) return null;
      bigText(g, W("Office", "CELEBRATE!"), w / 2, 130, 17, "#ffd400", "Press Start 2P", { outline: 4, maxW: w - 16 });
      g.strokeStyle = "#ff4fa3"; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      if (what === "celebrate-torn") {
        // a big corner ripped off (see-through) and a scratch across his face
        g.globalCompositeOperation = "destination-out";
        g.beginPath(); g.moveTo(w, 0); g.lineTo(w * 0.45, 0);
        for (let i = 0; i <= 10; i++) g.lineTo(w * 0.45 + i * w * 0.055 + (i % 2) * 6, h * 0.08 + i * h * 0.075 + (i % 2 ? -6 : 4));
        g.lineTo(w, h * 0.85); g.closePath(); g.fill();
        g.globalCompositeOperation = "source-over";
        g.strokeStyle = "rgba(20,0,0,0.85)"; g.lineWidth = 3;
        wobbly(g, [[40, 40], [80, 70], [110, 66], [150, 98]], 2);
      }
    } else if (what === "missing") {
      paper(g, w, h);
      bigText(g, W("Office", "MISSING"), w / 2, 20, 18, "#111", "Press Start 2P", { maxW: w - 16 });
      g.fillStyle = "#555"; g.fillRect(55, 34, 90, 70);
      g.fillStyle = "#ddd"; g.beginPath(); g.arc(100, 60, 14, 0, Math.PI * 2); g.fill();
      g.fillRect(80, 76, 40, 28);
      bigText(g, W("Office", "HAVE YOU SEEN ME?"), w / 2, 118, 11, "#111", "Courier Prime", { bold: true, maxW: w - 20 });
      g.fillStyle = "rgba(0,0,0,0.5)";
      for (let i = 0; i < 3; i++) g.fillRect(24, 128 + i * 6, w - 48 - i * 20, 2);
    } else if (what === "itsme" || what === "itsme-small") {
      g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#a10f0f"; g.lineWidth = 2;
      for (let i = 0; i < 9; i++) wobbly(g, [[8, 10 + i * 16], [w - 8, 14 + i * 16]], 2.5);
      bigText(g, W("Office", "IT'S ME"), w / 2, h / 2, small ? 18 : 30, "#d31b1b", "Press Start 2P", { rot: -0.08, maxW: w - 10 });
    } else if (what === "golden") {
      const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
      grd.addColorStop(0, "#3a2c05"); grd.addColorStop(1, "#000");
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      if (!charInto(g, "golden", [50, 10, 150, 120], { shade: 0.25 })) return null;
      bigText(g, W("Office", "IT'S ME"), w / 2, 134, 16, "#f3c623", "Press Start 2P", { outline: 4 });
    } else return null;
    tint(g, w, h);
    return c;
  }
  // ---- kids' crayon drawings ----
  if (kind === "drawing") {
    const small = what === "redsmall";
    const [c, g] = newCanvas(small ? 110 : 130, small ? 140 : 160);
    const w = c.width, h = c.height;
    paper(g, w, h);
    g.lineCap = "round"; g.lineJoin = "round";
    if (what === "red" || what === "redsmall") {
      // red crayon: you, and someone very big standing behind you
      g.strokeStyle = "#c01010"; g.lineWidth = small ? 3 : 4;
      for (let i = 0; i < 5; i++) wobbly(g, [[12 + i * 6, 12], [w - 12 - i * 4, h * 0.2 + i * 3]], 3);
      g.lineWidth = 3;
      wobbly(g, [[w * 0.3, h * 0.55], [w * 0.3, h * 0.82]]); g.beginPath(); g.arc(w * 0.3, h * 0.49, 8, 0, Math.PI * 2); g.stroke();
      wobbly(g, [[w * 0.3, h * 0.82], [w * 0.22, h * 0.95]]); wobbly(g, [[w * 0.3, h * 0.82], [w * 0.38, h * 0.95]]);
      g.strokeStyle = "#5a0000"; g.lineWidth = 4;
      g.beginPath(); g.ellipse(w * 0.66, h * 0.55, w * 0.22, h * 0.36, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "#fff"; g.fillRect(w * 0.58, h * 0.4, 5, 5); g.fillRect(w * 0.7, h * 0.4, 5, 5);
      bigText(g, W("Office", "RUN"), w * 0.5, h * 0.3, small ? 16 : 20, "#c01010", "Sans Serif", { bold: true, rot: 0.15 });
    } else {
      // a happy crayon drawing of a toy: sun, grass, the toy and a kid holding hands
      g.fillStyle = "#ffd400"; g.beginPath(); g.arc(w - 22, 22, 12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#35a33a"; g.lineWidth = 4; wobbly(g, [[6, h - 14], [w - 6, h - 16]], 2);
      if (!charInto(g, what, [w * 0.12, h * 0.22, w * 0.62, h - 14], { mode: "body" })) return null;
      g.strokeStyle = "#2d5bd6"; g.lineWidth = 3;
      const kx = w * 0.78;
      g.beginPath(); g.arc(kx, h * 0.56, 7, 0, Math.PI * 2); g.stroke();
      wobbly(g, [[kx, h * 0.62], [kx, h * 0.8]]); wobbly(g, [[kx, h * 0.8], [kx - 6, h - 16]]); wobbly(g, [[kx, h * 0.8], [kx + 6, h - 16]]);
      wobbly(g, [[kx, h * 0.68], [w * 0.6, h * 0.66]]);
      if (what === "wchica") {
        // the withered one: scribbled over
        g.strokeStyle = "rgba(10,10,10,0.8)"; g.lineWidth = 3;
        for (let i = 0; i < 7; i++) wobbly(g, [[w * 0.1, h * 0.3 + i * 10], [w * 0.62, h * 0.25 + i * 12]], 3);
      }
    }
    tint(g, w, h);
    return c;
  }
  // ---- sticky notes ----
  if (kind === "sticky" || kind === "note") {
    const [c, g] = newCanvas(80, 80);
    paper(g, 80, 80, kind === "note" ? "#f4f1e6" : "#ffe766");
    const words = what.split(" ");
    const lines = [];
    for (const word of words) { const l = lines[lines.length - 1]; if (l && (l + " " + word).length <= 10) lines[lines.length - 1] = l + " " + word; else lines.push(word); }
    const color = /HELP|IT'S ME/.test(what) ? "#b00000" : "#1b2a6b";
    lines.slice(0, 4).forEach((l, i) => bigText(g, W("Office", l), 40, 40 + (i - (Math.min(4, lines.length) - 1) / 2) * 16, 15, color, "Courier Prime", { bold: true, maxW: 72 }));
    tint(g, 80, 80);
    return c;
  }
  if (kind === "paper") {
    const [c, g] = newCanvas(80, 100);
    paper(g, 80, 100);
    g.fillStyle = "rgba(20,30,90,0.55)";
    for (let i = 0; i < 9; i++) g.fillRect(8, 12 + i * 9, 64 - (i * 17) % 25, 2);
    tint(g, 80, 100);
    return c;
  }
  if (kind === "ball") {
    const [c, g] = newCanvas(40, 40);
    g.fillStyle = "#e8e6df"; g.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 15 + (i % 3) * 2; g.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); }
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 1.5;
    wobbly(g, [[8, 16], [18, 22], [28, 12]], 1); wobbly(g, [[14, 30], [22, 24], [32, 28]], 1);
    tint(g, 40, 40);
    return c;
  }
  // ---- props ----
  if (kind === "prop") {
    if (what === "cupcake") {
      const [c, g] = newCanvas(60, 80);
      g.fillStyle = "#c8a0e8"; g.beginPath(); g.moveTo(12, 48); g.lineTo(48, 48); g.lineTo(42, 78); g.lineTo(18, 78); g.closePath(); g.fill();
      g.strokeStyle = "rgba(0,0,0,0.25)"; for (let x = 20; x < 44; x += 6) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x + 1, 76); g.stroke(); }
      g.fillStyle = "#ff7fb2"; g.beginPath(); g.ellipse(30, 44, 22, 14, 0, Math.PI, 0); g.lineTo(52, 48); g.lineTo(8, 48); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(23, 38, 5, 0, Math.PI * 2); g.arc(37, 38, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#111"; g.beginPath(); g.arc(24, 39, 2.5, 0, Math.PI * 2); g.arc(38, 39, 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3a9cff"; g.fillRect(28, 14, 4, 18); g.fillStyle = "#ffcc33"; g.beginPath(); g.ellipse(30, 10, 3, 5, 0, 0, Math.PI * 2); g.fill();
      tint(g, 60, 80);
      return c;
    }
    if (what === "balloon" || what === "popped") {
      const [c, g] = newCanvas(40, 120);
      g.strokeStyle = "#ddd"; g.lineWidth = 1.5; wobbly(g, [[20, 118], [18, 90], [22, 60], [20, 38]], 2);
      if (what === "balloon") {
        g.fillStyle = "#e3262f"; g.beginPath(); g.ellipse(20, 22, 15, 19, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(255,255,255,0.4)"; g.beginPath(); g.ellipse(14, 15, 4, 6, -0.4, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = "#b11a22";
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(20, 40); g.lineTo(12 + i * 6, 26 + (i % 2) * 6); g.lineTo(16 + i * 5, 34); g.fill(); }
      }
      tint(g, 40, 120);
      return c;
    }
    if (what === "present") {
      const [c, g] = newCanvas(70, 70);
      g.fillStyle = "#2f62d6"; g.fillRect(6, 22, 58, 46);
      g.fillStyle = "#4b80f0"; g.fillRect(2, 14, 66, 12);
      g.fillStyle = "#ffcc33"; g.fillRect(30, 14, 10, 54);
      g.strokeStyle = "#ffcc33"; g.lineWidth = 5; g.beginPath(); g.ellipse(26, 8, 9, 6, 0.4, 0, Math.PI * 2); g.ellipse(44, 8, 9, 6, -0.4, 0, Math.PI * 2); g.stroke();
      tint(g, 70, 70);
      return c;
    }
    return null;
  }
  // ---- TV pictures ----
  if (kind === "tv") {
    const [c, g] = newCanvas(64, 48);
    g.fillStyle = "#06080a"; g.fillRect(0, 0, 64, 48);
    if (what.startsWith("static")) {
      const d = g.createImageData(64, 48);
      let s = 1 + Number(what.slice(6)) * 7919;
      for (let i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = 40 + (s % 180); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0);
    } else if (what === "bars") {
      ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 64 / 7, 0, 64 / 7 + 1, 34); });
      g.fillStyle = "#111"; g.fillRect(0, 34, 64, 14);
    } else if (what === "eyes") {
      g.fillStyle = "#000"; g.fillRect(0, 0, 64, 48);
      for (const x of [22, 42]) { g.fillStyle = "#fff"; g.beginPath(); g.arc(x, 22, 4, 0, Math.PI * 2); g.fill(); }
    } else if (what === "off") {
      // just the dark glass
    } else if (what.startsWith("text:")) {
      g.fillStyle = "#000"; g.fillRect(0, 0, 64, 48);
      bigText(g, W("Office", what.slice(5)), 32, 24, 10, "#e01b1b", "Press Start 2P", { maxW: 60 });
    } else if (what.startsWith("face:")) {
      g.fillStyle = "#10233a"; g.fillRect(0, 0, 64, 48);
      if (!charInto(g, what.slice(5), [14, 4, 50, 44], { kind: "creep" })) return null;
    }
    // scan lines
    g.fillStyle = "rgba(0,0,0,0.28)";
    for (let y = 0; y < 48; y += 3) g.fillRect(0, y, 64, 1);
    return c;
  }
  return null;
}
