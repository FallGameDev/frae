/* =====================================================================
   DEATH MINIGAMES (8-bit)
   Sometimes, after you get caught, a strange little 8-bit game starts
   instead of the game over screen (like FNaF 2). Three of them:

     cake   Take Cake to the Children: give cake to the six kids before
            they get upset... while a child cries outside.
     gifts  Give Gifts, Give Life: the Puppet gives each child a present,
            then a new face.
     run    Endo Go! Go! Go!: run to the kids at the party, three times.

   Move with the arrow keys / WASD, or hold the mouse (finger) where you
   want to go. Each one ends on its own, then it is back to the title.
   ===================================================================== */
"use strict";

Object.assign(Game.prototype, {

  startMinigame(which) {
    this.go("mini");
    Sound.stopAll();
    this.unlock("minigame");
    which = which || pick(["cake", "gifts", "run"]);
    const m = this.mini = { which, t: 0, x: 240, y: 200, face: 1, over: false, text: "", flip: false };
    this.sp.mini.play("Sprite45", "During mini game.mp3", { loop: true });
    if (which === "cake") {
      m.x = 240; m.y = 190;
      // the six kids: where they stand and how happy they are (1 = happy, 0 = crying)
      m.kids = [[90, 282], [90, 202], [90, 122], [390, 282], [390, 202], [390, 122]].map(([x, y]) => ({ x, y, mood: randFloat(0.6, 1), fed: false }));
      m.crying = 0;          // the child outside: 0..9 (9 = gone grey)
      m.car = -1;            // the purple car (x position, -1 = not here)
      this.scripts.run("mini", function* () {
        yield 22;
        m.car = -140;                                       // a car pulls up outside...
        yield () => m.car >= 110;
        for (let i = 1; i <= 9; i++) { m.crying = i; yield 0.5; }
        yield 1.5;
        this.endMinigame();
      }.call(this));
    } else if (which === "gifts") {
      m.kids = [[70, 150], [70, 290], [330, 150], [330, 290]].map(([x, y], i) => ({ x, y, gift: false, face: null, who: ["wfreddy", "wbonnie", "wchica", "foxy"][i] }));
      m.score = 0;
      m.phase = "gifts";
    } else {
      m.x = 70; m.y = 270; m.runs = 0; m.state = "ready";
      this.scripts.run("mini", function* () { yield 2; m.state = "go"; }.call(this));
    }
  },

  // Where the player wants to go this update (-1, 0 or 1 on each axis)
  miniInput() {
    let dx = (this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0);
    let dy = (this.held.has("down") ? 1 : 0) - (this.held.has("up") ? 1 : 0);
    const ms = this.mouse, m = this.mini;
    if (ms.down) {
      const ax = ms.x - m.x, ay = ms.y - m.y;
      if (Math.abs(ax) > 6) dx = Math.sign(ax);
      if (Math.abs(ay) > 6) dy = Math.sign(ay);
    }
    return [dx, dy];
  },

  updateMini() {
    const m = this.mini;
    if (!m || m.over) return;
    m.t += TICK;
    const [dx, dy] = this.miniInput();
    if (dx) m.flip = dx < 0;
    if (dx || dy) m.face = Math.floor(m.t * 6) % 2;
    if (m.which === "cake") {
      m.x = clamp(m.x + dx * 3.2, 140, 340); m.y = clamp(m.y + dy * 3.2, 80, 300);
      for (const k of m.kids) {
        k.mood = Math.max(0, k.mood - TICK / randFloat(7, 10));
        if (Math.hypot(k.x - m.x, k.y - m.y) < 70 && (dx || dy || this.mouse.down) && k.mood < 0.98) {
          if (!k.fed || k.mood < 0.9) this.sp.blip.play("Sprite10", "COMPUTER_DIGITAL_L2076605");
          k.mood = 1; k.fed = true;
        }
      }
      if (m.kids.every(k => k.fed)) this.unlock("cake");
      if (m.car >= -140) m.car = Math.min(110, m.car + 2.5);
    } else if (m.which === "gifts") {
      m.x = clamp(m.x + dx * 3.5, 40, 440); m.y = clamp(m.y + dy * 3.5, 70, 320);
      for (const k of m.kids) {
        if (Math.hypot(k.x - m.x, k.y - m.y) > 45) continue;
        if (m.phase === "gifts" && !k.gift) { k.gift = true; m.score += 100; this.blip(); }
        if (m.phase === "life" && !k.face) { k.face = k.who; m.score += 100; this.blip(); }
      }
      if (m.phase === "gifts" && m.kids.every(k => k.gift)) m.phase = "life";
      if (m.phase === "life" && m.kids.every(k => k.face) && !m.done) {
        m.done = true;
        this.scripts.run("mini", function* () {
          yield 1.5;
          m.last = true;                     // one more child, in the middle...
          yield 1.5;
          if (settings.jumpscares === "1") { m.scare = true; this.sp.scream.play("Sprite27", "Xscream2"); yield 0.8; }
          this.endMinigame();
        }.call(this));
      }
    } else {
      if (m.state === "go") {
        m.x = Math.min(440, m.x + Math.max(0, dx) * 4.5);
        if (m.x >= 420) {
          m.runs++;
          m.state = m.runs >= 3 ? "late" : "party";
          this.scripts.run("mini", function* () {
            if (m.state === "party") { this.sp.chime.play("Ambience", "CROWD_SMALL_CHIL_EC049202"); yield 2.5; m.x = 70; m.state = "ready"; yield 1.5; m.state = "go"; }
            else { yield 3; this.endMinigame(); }
          }.call(this));
        }
      }
    }
  },

  endMinigame() {
    const m = this.mini;
    m.over = true;
    this.scripts.stop("mini");
    Sound.stopAll();
    this.sp.stat.play("Sprite28", "After Death");
    if (m.which === "run") this.riceria = true;          // the title after this one is "Eddies Riceria"
    const st = this.overlay(null, null, { paint: ctx => this.drawStatic(ctx, 1) });
    this.scripts.run("dead", function* () { yield 2.5; this.removeOverlay(st); this.showTitle(); }.call(this));
  },

  // A big blocky 8-bit fire: columns of flame that flicker (left x, floor y, width, tallest height)
  drawPixelFire(ctx, x, floor, w, tall, t) {
    const cell = 8, cols = Math.ceil(w / cell), step = Math.floor(t * 12);
    const noise = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    const colors = ["#a80c08", "#e8300c", "#ff7a00", "#ffc400", "#fff1a0"];      // outside -> inside
    ctx.save();
    for (let i = 0; i < cols; i++) {
      // taller in the middle, every column jumps a little each step
      const mid = 1 - Math.abs((i + 0.5) / cols * 2 - 1);
      const h = tall * (0.35 + 0.65 * Math.pow(mid, 0.7)) * (0.75 + 0.35 * noise(i, step));
      const rows = Math.max(1, Math.round(h / cell));
      for (let r = 0; r < rows; r++) {
        // the higher up, the more it is the outer (red) color; sparks break off at the top
        const up = r / rows;
        const layer = Math.max(0, Math.min(colors.length - 1, Math.floor((1 - up) * colors.length * (0.55 + 0.45 * mid) - noise(i + r, step) * 1.2)));
        if (up > 0.85 && noise(i * 7 + r, step) < 0.35) continue;
        ctx.fillStyle = colors[layer];
        ctx.fillRect(x + i * cell, floor - (r + 1) * cell, cell, cell);
      }
      // a spark or two above the flames
      if (noise(i, step + 99) < 0.12) {
        ctx.fillStyle = colors[3];
        ctx.fillRect(x + i * cell, floor - (rows + 2 + Math.floor(noise(i, step + 7) * 5)) * cell, cell / 2, cell / 2);
      }
    }
    ctx.restore();
  },

  // An 8-bit character (flipped to face left if needed)
  drawPixel(ctx, name, x, y, size, flip) {
    const p = pic("Pixel", name);
    if (!p) return;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    draw(ctx, p, 0, Math.round(this.mini.face && !this.mini.over ? -2 : 0), { size });
    ctx.restore();
  },

  drawMini(ctx) {
    const m = this.mini;
    if (!m) return;
    ctx.imageSmoothingEnabled = false;
    if (m.which === "cake") {
      draw(ctx, pic("Sprite45", "give cake"), 240, 180);
      for (const k of m.kids) {
        // happy (green), getting upset (pink), angry (red)
        const f = k.mood > 0.66 ? "CakeChildSprite-" + (Math.floor(m.t * 3) % 2) :
                  k.mood > 0.33 ? "CakeChildSprite-" + (2 + Math.floor(m.t * 3) % 2) :
                  "CakeChildIrritatedSprite-" + (Math.floor(m.t * 8) % 6);
        draw(ctx, pic("Sprite47", f), k.x, k.y, { size: 45 });
      }
      this.drawPixel(ctx, "wfreddy", m.x, m.y + 40, 70, m.flip);
      // the cake he is carrying
      ctx.fillStyle = "#f5f0d0"; ctx.fillRect(m.x + (m.flip ? -34 : 16), m.y - 8, 18, 9);
      ctx.fillStyle = "#e02a5a"; ctx.fillRect(m.x + (m.flip ? -34 : 16), m.y - 11, 18, 3);
      ctx.fillStyle = "#4a8aff"; ctx.fillRect(m.x + (m.flip ? -26 : 24), m.y - 17, 2, 6);
      // outside: the crying child, and the car
      draw(ctx, picAt("Sprite53", Math.min(10, 1 + m.crying)), 131, 342, { size: 30 });
      if (m.car > -140) draw(ctx, pic("Sprite54", "Purple_Car"), m.car - 160 + 240, 330, { size: 30 });
      this.text(ctx, W("Minigames", "Take cake to the children."), 240, 24, { size: 12, align: "center", font: "Press Start 2P" });
    } else if (m.which === "gifts") {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 480, 360);
      ctx.strokeStyle = "#ccc"; ctx.lineWidth = 8; ctx.strokeRect(14, 50, 452, 300);
      const word = m.phase === "gifts" ? W("Minigames", "Give gifts.") : W("Minigames", "Give life.");
      this.text(ctx, String(m.score).padStart(4, "0") + "  " + word, 20, 36, { size: 16, font: "Press Start 2P" });
      for (const k of m.kids) {
        draw(ctx, pic("Sprite69", k.gift ? "GiveThemLifeEndo2" : "GiveThemLifeEndo"), k.x, k.y, { size: 50 });
        if (k.face) this.drawPixel(ctx, "head-" + k.face, k.x - 4, k.y - 22, 75);
      }
      if (m.last) draw(ctx, pic("Sprite69", "GiveThemLifeEndo"), 240, 210, { size: 50 });
      this.drawPixel(ctx, "puppet", m.x, m.y + 40, 60, m.flip);
      if (m.scare) drawScare(ctx, "puppet", 8);
    } else {
      const bg = m.state === "late" ? "foxy stage2" : m.state === "party" ? "foxy stage" :
                 m.state === "ready" ? "foxy GET READY" : (m.t % 1 < 0.5 ? "foxy GO! GO! GO!" : "foxy blank");
      draw(ctx, pic("Sprite45", bg), 240, 180);
      if (m.state === "party") draw(ctx, picAt("Sprite75", 1 + Math.floor(m.t * 8) % 8), 380, 200, { size: 60 });
      if (m.state === "late") {
        // the last run: no man, no children... just a huge fire
        ctx.fillStyle = "#000"; ctx.fillRect(213, 112, 250, 223);     // (the grey children in the picture are covered)
        this.drawPixelFire(ctx, 205, 336, 262, 300, m.t);
      }
      // Aidan's Endo running (8-bit)
      this.drawPixel(ctx, "runner", m.x, m.y + 40, 65, false);
    }
  },
});
