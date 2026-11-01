/* =====================================================================
   NIGHT 5: THROWING THE PHONE AT THE WALL
   The pieces game.js uses for it (startPhoneThrow / drawThrow): the
   timing, the phone in your hand, the pixel explosion, its boom, and the
   scorch mark left on the wall. The explosion is Aidan's GIF + sound
   (BoomFx); the chunky pixel one drawn by the game is the backup.
   ===================================================================== */
"use strict";

// wall: where it hits (office picture units: the wall just right of the hall door, so it's always in view)
// release / hit: seconds after the throw starts; boom: how long the explosion lasts
const THROW = { wall: [284, 76], release: 0.38, hit: 0.78, boom: 1.7 };

// The explosion Aidan picked: a GIF (as a sprite sheet: tools/tape2/fx/explosion.png, 17 frames of 71 x 98,
// 10 per second) and its sound (fx/explosion.mp3). Copied to 2/assets/fx by the build; a mod can swap them.
// Loaded when night 5 starts. If they can't load, the game's own pixel explosion and boom are used.
const BoomFx = {
  frames: 17, w: 71, h: 98, fps: 10,
  pin: [32, 49],                   // the point in a frame where it starts (lands on the wall)
  size: 2.2,                       // drawn this many game pixels per GIF pixel
  volume: 1.6,
  img: null, buffer: null, started: false,
  load() {
    if (this.started) return;
    this.started = true;
    const img = new Image();
    img.onload = () => { this.img = img; };
    img.src = assetUrl("fx/explosion.png");
    fetch(assetUrl("fx/explosion.mp3")).then(r => r.arrayBuffer()).then(d => Sound.ctx.decodeAudioData(d))
      .then(b => { this.buffer = b; }).catch(() => {});
  },
  // the frame for t seconds after the hit (null when it's over)
  draw(ctx, x, y, t) {
    const i = Math.floor(t * this.fps);
    if (!this.img || i >= this.frames) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.img, i * this.w, 0, this.w, this.h,
      x - this.pin[0] * this.size, y - this.pin[1] * this.size, this.w * this.size, this.h * this.size);
    ctx.restore();
  },
};

// A phone (the one with Fred on the screen), centered at x, y
function drawHeldPhone(ctx, x, y, scale, rot) {
  if (scale <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#121216";
  ctx.beginPath(); ctx.roundRect(-11, -20, 22, 40, 5); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#1e3260";
  ctx.fillRect(-9, -16, 18, 30);
  ctx.fillStyle = "#8a52e8";                                         // Fred's purple circle
  ctx.beginPath(); ctx.arc(0, -7, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff3b30";                                         // hang up
  ctx.beginPath(); ctx.arc(0, 8, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// The explosion at (x, y). t: 0 (it just hit) to 1 (gone). Everything snapped to a pixel grid.
const BOOM_PX = 4;
const BOOM_SIZE = 1.35;                 // how big the whole explosion is
const BOOM_COLORS = ["#ffffff", "#fff3a0", "#ffc21a", "#ff7a12", "#e2381c", "#6e2a1c", "#2c2424"];
function boomColor(age) { return BOOM_COLORS[Math.min(BOOM_COLORS.length - 1, Math.floor(age * BOOM_COLORS.length))]; }
function pixelDisc(ctx, cx, cy, r) {
  const P = BOOM_PX, n = Math.ceil(r / P);
  const gx = Math.round(cx / P) * P, gy = Math.round(cy / P) * P;
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    if ((i * i + j * j) * P * P <= r * r) ctx.fillRect(gx + i * P, gy + j * P, P, P);
  }
}
function pixelRing(ctx, cx, cy, r, w) {
  const P = BOOM_PX, steps = Math.max(12, Math.round(r * 0.9));
  for (let s = 0; s < steps; s++) {
    const a = s / steps * Math.PI * 2;
    for (let d = 0; d < w; d += P) ctx.fillRect(Math.round((cx + Math.cos(a) * (r + d)) / P) * P, Math.round((cy + Math.sin(a) * (r + d)) / P) * P, P, P);
  }
}
// the puffs: [x offset, y offset, size, when it starts (0..1)]
const BOOM_PUFFS = [[0, 0, 34, 0], [-22, -10, 24, 0.06], [20, -14, 26, 0.09], [-10, 18, 22, 0.12], [24, 14, 20, 0.15],
                    [-30, 8, 18, 0.2], [6, -30, 22, 0.22], [32, -2, 16, 0.27], [-4, 4, 28, 0.3]];
function drawExplosion(ctx, x, y, t, tick) {
  if (t >= 1) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // the white flash over everything
  const flash = 0.14 * 1.25 / THROW.boom;
  if (t < flash) { ctx.fillStyle = "rgba(255,255,255," + (0.75 * (1 - t / flash)) + ")"; ctx.fillRect(0, 0, 480, 360); }
  // Aidan's explosion GIF, when it loaded
  if (BoomFx.img) { ctx.restore(); BoomFx.draw(ctx, x, y, t * THROW.boom); return; }
  t = Math.min(1, t * THROW.boom / 1.25);          // (the game's own one is 1.25 s long)
  // the shockwave ring
  if (t < 0.45) {
    ctx.globalAlpha = 1 - t / 0.45;
    ctx.fillStyle = "#fffbe0";
    pixelRing(ctx, x, y, 10 + t * 170, BOOM_PX * 2);
    ctx.globalAlpha = 1;
  }
  // the puffs: grow fast, then go from white to fire to smoke
  for (const [dx0, dy0, size0, start] of BOOM_PUFFS) {
    const dx = dx0 * BOOM_SIZE, dy = dy0 * BOOM_SIZE, size = size0 * BOOM_SIZE;
    const local = (t - start) / (1 - start);
    if (local <= 0) continue;
    const grow = 1 - Math.pow(1 - Math.min(1, local * 2.2), 3);
    const rise = local * 26;                                       // smoke drifts up
    ctx.globalAlpha = local < 0.7 ? 1 : 1 - (local - 0.7) / 0.3;
    ctx.fillStyle = boomColor(local);
    pixelDisc(ctx, x + dx * grow, y + dy * grow - rise, size * grow * (local > 0.75 ? 1.15 : 1));
    // a hot middle while it's young
    if (local < 0.45) { ctx.fillStyle = boomColor(local * 0.4); pixelDisc(ctx, x + dx * grow, y + dy * grow - rise, size * grow * 0.45); }
  }
  ctx.globalAlpha = 1;
  // sparks and bits of phone flying out and falling
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + (i % 3) * 0.3, speed = 90 + (i * 37) % 80;
    const st = t * THROW.boom;
    const px = x + Math.cos(a) * speed * st, py = y + Math.sin(a) * speed * st + 160 * st * st;
    ctx.fillStyle = i % 4 === 0 ? "#151518" : boomColor(Math.min(0.85, t * 1.3));
    ctx.fillRect(Math.round(px / BOOM_PX) * BOOM_PX, Math.round(py / BOOM_PX) * BOOM_PX, BOOM_PX, BOOM_PX);
  }
  ctx.restore();
}

// BOOM (made by the game: rumbling noise that closes down, plus a chiptune drop)
function explosionSound() {
  const c = Sound.ctx, t = c.currentTime;
  if (BoomFx.buffer) {
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = BoomFx.buffer; g.gain.value = BoomFx.volume;
    src.connect(g).connect(Sound.sfxBus);
    src.start();
    return;
  }
  const len = Math.round(c.sampleRate * 1.6);
  const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  let hold = 0;
  for (let i = 0; i < len; i++) { if (i % 3 === 0) hold = Math.random() * 2 - 1; d[i] = hold; }     // crunchy noise
  const noise = c.createBufferSource(); noise.buffer = buf;
  const lp = c.createBiquadFilter(); lp.type = "lowpass";
  lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(90, t + 1.4);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  noise.connect(lp).connect(g).connect(Sound.sfxBus);
  noise.start(t); noise.stop(t + 1.6);
  const sq = c.createOscillator(); sq.type = "square";
  sq.frequency.setValueAtTime(220, t); sq.frequency.exponentialRampToValueAtTime(35, t + 0.6);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(0.22, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
  sq.connect(g2).connect(Sound.sfxBus);
  sq.start(t); sq.stop(t + 0.7);
}

// The burn mark where it hit, with bits of phone on the floor under it (office picture units, drawn in drawOffice)
function drawScorch(ctx, [u, v], tick) {
  ctx.save();
  const g = ctx.createRadialGradient(u, v, 1, u, v, 16);
  g.addColorStop(0, "rgba(10,8,6,0.85)"); g.addColorStop(0.6, "rgba(20,14,10,0.5)"); g.addColorStop(1, "rgba(20,14,10,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(u, v, 16, 13, 0, 0, Math.PI * 2); ctx.fill();
  // cracks
  ctx.strokeStyle = "rgba(12,10,8,0.8)"; ctx.lineWidth = 0.6;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.4;
    ctx.beginPath(); ctx.moveTo(u + Math.cos(a) * 3, v + Math.sin(a) * 3);
    ctx.lineTo(u + Math.cos(a + 0.2) * 9, v + Math.sin(a + 0.2) * 8);
    ctx.lineTo(u + Math.cos(a - 0.1) * 15, v + Math.sin(a - 0.1) * 12);
    ctx.stroke();
  }
  // bits of the phone on the floor under it
  ctx.fillStyle = "#141417";
  for (const [dx, w, h, r] of [[-12, 3, 1.6, 0.3], [-6, 2, 1.2, -0.5], [4, 4, 1.8, 0.1], [9, 1.6, 1.4, 0.8]]) {
    ctx.save(); ctx.translate(u + dx, 139); ctx.rotate(r); ctx.fillRect(-w / 2, -h, w, h); ctx.restore();
  }
  ctx.fillStyle = "#1e3260"; ctx.fillRect(u + 2.5, 137.8, 2, 1);          // a bit of the screen
  // a thin wisp of smoke still coming off it
  for (let i = 0; i < 4; i++) {
    const k = ((tick / 60 + i / 4) % 1);
    ctx.fillStyle = "rgba(90,90,90," + (0.18 * (1 - k)) + ")";
    ctx.beginPath(); ctx.arc(u + Math.sin(k * 6 + i) * 3, v - 4 - k * 22, 2 + k * 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
