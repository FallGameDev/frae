/* =====================================================================
   vhs.js: after a death, a blue VHS screen says STOP, then it plays a
   guide (slides) on how to survive whoever got you. Used by both tapes.

     const g = new VhsGuide("Withered Endo", slides);
     each update:  if (g.step(this.clicks, this.keys)) ...finished
     each frame:   g.draw(ctx)

   A slide: { title, text: ["paragraph", ...], tip: "optional line" }
   Controls: click / SPACE / ENTER / RIGHT = next, LEFT = back,
             DOWN or the SKIP button = skip the rest.
   Font: "VCR OSD Mono" (assets/fonts/VCR_OSD_MONO.ttf, from Aidan).
   ===================================================================== */
"use strict";

const VHS_FONT = '"VCR OSD Mono", "Share Tech Mono", monospace';
const VHS_BLUE = ["#1846e0", "#0d2fb8"];        // top and bottom of the blue screen
const VHS_CYAN = "#7ff6ff";
const VHS_STOP_TIME = 2.2;                      // seconds the STOP card stays (a click skips it)
// footer buttons: [left, top, width, height]
const VHS_BUTTONS = { back: [14, 324, 92, 24], next: [194, 324, 92, 24], skip: [374, 324, 92, 24] };

class VhsGuide {
  constructor(name, slides) {
    this.name = name;                 // who got you (shown on the STOP card)
    this.slides = slides;
    this.phase = "stop";              // "stop" card, then "play" (the slides)
    this.t = 0;                       // seconds since it started (the tape counter)
    this.pageT = 0;                   // seconds on this page
    this.page = 0;
    this.done = false;
  }

  // One update. Returns true when the guide is finished.
  step(clicks, keys) {
    const dt = typeof TICK === "number" ? TICK : 1 / 30;
    this.t += dt;
    this.pageT += dt;
    if (this.phase === "stop") {
      if (this.t > VHS_STOP_TIME || (this.t > 0.4 && (clicks.length || keys.length))) { this.phase = "play"; this.pageT = 0; }
      return false;
    }
    if (this.pageT < 0.2) return false;          // (so one click doesn't flip two pages)
    for (const c of clicks) {
      const b = this.buttonAt(c.x, c.y);
      if (b === "back") this.turn(-1);
      else if (b === "skip") this.done = true;
      else this.turn(1);
      break;
    }
    for (const k of keys) {
      if (k === "left") this.turn(-1);
      else if (k === "down") this.done = true;
      else if (k === "enter" || k === "space" || k === "right") this.turn(1);
      break;
    }
    return this.done;
  }
  turn(d) {
    const p = this.page + d;
    if (p < 0) return;
    if (p >= this.slides.length) { this.done = true; return; }
    this.page = p;
    this.pageT = 0;
  }
  buttonAt(x, y) {
    for (const [k, [bx, by, bw, bh]] of Object.entries(VHS_BUTTONS))
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return k;
    return null;
  }

  /* ---------------- drawing ---------------- */
  draw(ctx) {
    ctx.save();
    // the blue screen
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, VHS_BLUE[0]); g.addColorStop(1, VHS_BLUE[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, 360);
    // the picture wobbles a pixel now and then (old tape)
    const wob = Math.sin(this.t * 37) > 0.97 ? 1 : 0;
    ctx.translate(wob, 0);
    if (this.phase === "stop") this.drawStop(ctx);
    else this.drawSlide(ctx);
    ctx.restore();
    vhsLines(ctx, this.t);
  }

  drawStop(ctx) {
    const blink = Math.floor(this.t * 2) % 2 === 0;
    vhsText(ctx, "STOP", 30, 52, 30);
    if (blink) { ctx.fillStyle = "#fff"; ctx.fillRect(122, 30, 20, 20); }     // the square stop sign
    vhsText(ctx, vhsCounter(this.t), 450, 52, 18, { align: "right" });
    if (this.t > 0.5) {
      vhsText(ctx, "CAUGHT BY", 240, 170, 16, { align: "center", color: VHS_CYAN });
      vhsText(ctx, String(this.name).toUpperCase(), 240, 200, 24, { align: "center" });
    }
    if (this.t > 1.2) vhsText(ctx, "PRESS PLAY FOR THE GUIDE", 240, 300, 12, { align: "center", color: VHS_CYAN });
  }

  drawSlide(ctx) {
    const s = this.slides[this.page];
    // top: PLAY (a blinking triangle) and the page
    if (Math.floor(this.t * 2) % 2 === 0) vhsTriangle(ctx, 30, 33, 18, 1);
    vhsText(ctx, "PLAY", 56, 50, 22);
    vhsText(ctx, "GUIDE " + (this.page + 1) + "/" + this.slides.length, 450, 50, 16, { align: "right" });
    vhsText(ctx, String(this.name).toUpperCase(), 450, 68, 11, { align: "right", color: VHS_CYAN });
    // the slide
    vhsText(ctx, String(s.title).toUpperCase(), 30, 104, 20, { color: VHS_CYAN });
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(30, 112, 420, 2);
    let y = 136;
    // the words appear quickly, like a typed caption
    let budget = Math.floor(this.pageT * 260);
    ctx.font = "13px " + VHS_FONT;
    for (const para of s.text || []) {
      for (const line of vhsWrap(ctx, para, 420)) {
        if (budget <= 0) break;
        vhsText(ctx, line.slice(0, budget), 30, y, 13);
        budget -= line.length;
        y += 18;
      }
      y += 8;
    }
    if (s.tip && budget > 0) {
      ctx.font = "12px " + VHS_FONT;
      for (const line of vhsWrap(ctx, "TIP: " + s.tip, 420)) { vhsText(ctx, line, 30, y, 12, { color: VHS_CYAN }); y += 17; }
    }
    // bottom: the tape counter and the buttons
    vhsText(ctx, "SP " + vhsCounter(this.t), 450, 312, 11, { align: "right", color: "rgba(255,255,255,0.7)" });
    const last = this.page === this.slides.length - 1;
    this.button(ctx, "back", "BACK", this.page > 0);
    this.button(ctx, "next", last ? "EJECT" : "NEXT", true);
    this.button(ctx, "skip", "SKIP", !last);
  }
  button(ctx, id, label, on) {
    const [x, y, w, h] = VHS_BUTTONS[id];
    ctx.globalAlpha = on ? 1 : 0.3;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    // a little VCR symbol on each
    if (id === "back") vhsTriangle(ctx, x + 8, y + 6, 12, -1);
    if (id === "next") vhsTriangle(ctx, x + 8, y + 6, 12, 1);
    if (id === "skip") { vhsTriangle(ctx, x + 6, y + 6, 12, 1); vhsTriangle(ctx, x + 13, y + 6, 12, 1); }
    vhsText(ctx, label, x + w / 2 + 9, y + 17, 13, { align: "center" });
    ctx.globalAlpha = 1;
  }
}

// White VCR text with the slight red / cyan edges of an old TV
function vhsText(ctx, s, x, y, size, o = {}) {
  ctx.font = size + "px " + VHS_FONT;
  ctx.textAlign = o.align || "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,40,80,0.45)"; ctx.fillText(s, x - 1, y);
  ctx.fillStyle = "rgba(60,255,255,0.45)"; ctx.fillText(s, x + 1, y);
  ctx.fillStyle = o.color || "#fff"; ctx.fillText(s, x, y);
}
// A play triangle (dir 1) or a back one (-1), size tall, top-left at (x, y)
function vhsTriangle(ctx, x, y, size, dir) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  if (dir > 0) { ctx.moveTo(x, y); ctx.lineTo(x + size * 0.8, y + size / 2); ctx.lineTo(x, y + size); }
  else { ctx.moveTo(x + size * 0.8, y); ctx.lineTo(x, y + size / 2); ctx.lineTo(x + size * 0.8, y + size); }
  ctx.fill();
}
// 0:00:00 like a VCR counter
function vhsCounter(t) {
  const s = Math.floor(t);
  return Math.floor(s / 3600) + ":" + String(Math.floor(s / 60) % 60).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}
// Breaks a paragraph into lines that fit `w`
function vhsWrap(ctx, text, w) {
  const out = [];
  let line = "";
  for (const word of String(text).split(" ")) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > w && line) { out.push(line); line = word; }
    else line = test;
  }
  if (line) out.push(line);
  return out;
}
// Scan lines (a picture made once) and a soft tracking band rolling down
let vhsScan = null;
function vhsLines(ctx, t) {
  if (!vhsScan) {
    vhsScan = document.createElement("canvas");
    vhsScan.width = 480; vhsScan.height = 360;
    const g = vhsScan.getContext("2d");
    g.fillStyle = "rgba(0,0,30,0.16)";
    for (let y = 0; y < 360; y += 3) g.fillRect(0, y, 480, 1);
  }
  ctx.drawImage(vhsScan, 0, 0);
  const band = (t * 45) % 460 - 50;
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, band, 480, 22);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, band + 9, 480, 2);
}

/* ---------------------------------------------------------------------
   GAME OVER on the blue VHS screen (after the guide). Both tapes.
     const g = new VhsGameOver({ who: "Withered Endo", night: "NIGHT 3", time: "4 AM" });
     each update:  const pick = g.step(clicks, keys)   // "retry", "eject" or null
     each frame:   g.draw(ctx)
   TRY AGAIN (click it, or ENTER / SPACE) and EJECT (click it, or DOWN).
   --------------------------------------------------------------------- */
const VHS_OVER_BUTTONS = { retry: [110, 268, 120, 30], eject: [250, 268, 120, 30] };
class VhsGameOver {
  constructor(info) {
    this.info = info;
    this.t = 0;
    this.pick = null;
  }
  step(clicks, keys) {
    this.t += typeof TICK === "number" ? TICK : 1 / 30;
    if (this.t < 0.6) return null;                 // (so the click that ended the guide doesn't count)
    for (const c of clicks) {
      for (const [k, [x, y, w, h]] of Object.entries(VHS_OVER_BUTTONS))
        if (c.x >= x && c.x <= x + w && c.y >= y && c.y <= y + h) this.pick = k;
    }
    for (const k of keys) {
      if (k === "enter" || k === "space") this.pick = "retry";
      if (k === "down") this.pick = "eject";
    }
    return this.pick;
  }
  draw(ctx) {
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, VHS_BLUE[0]); g.addColorStop(1, VHS_BLUE[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 480, 360);
    if (Math.sin(this.t * 37) > 0.97) ctx.translate(1, 0);
    // top: the tape is stopped
    vhsText(ctx, "STOP", 30, 52, 22);
    if (Math.floor(this.t * 2) % 2 === 0) { ctx.fillStyle = "#fff"; ctx.fillRect(100, 35, 16, 16); }
    vhsText(ctx, vhsCounter(this.t), 450, 52, 18, { align: "right" });
    // the big words
    const a = Math.min(1, this.t * 2);
    ctx.globalAlpha = a;
    vhsText(ctx, "GAME OVER", 240, 150, 44, { align: "center" });
    ctx.globalAlpha = 1;
    if (this.t > 0.4) {
      vhsText(ctx, [this.info.night, this.info.time].filter(Boolean).join("  ·  "), 240, 186, 14, { align: "center", color: VHS_CYAN });
      if (this.info.who) vhsText(ctx, "CAUGHT BY " + String(this.info.who).toUpperCase(), 240, 212, 14, { align: "center" });
    }
    // buttons
    if (this.t > 0.6) {
      for (const [id, [x, y, w, h]] of Object.entries(VHS_OVER_BUTTONS)) {
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        if (id === "retry") vhsTriangle(ctx, x + 10, y + 8, 14, 1);
        else { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(x + 10, y + 18); ctx.lineTo(x + 18, y + 8); ctx.lineTo(x + 26, y + 18); ctx.fill(); ctx.fillRect(x + 10, y + 20, 16, 3); }
        vhsText(ctx, id === "retry" ? "TRY AGAIN" : "EJECT", x + w / 2 + 10, y + 20, 13, { align: "center" });
      }
      vhsText(ctx, "ENTER = TRY AGAIN    DOWN = EJECT", 240, 326, 10, { align: "center", color: "rgba(255,255,255,0.65)" });
    }
    ctx.restore();
    vhsLines(ctx, this.t);
  }
}
