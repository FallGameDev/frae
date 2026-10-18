/* =====================================================================
   FRIED RICE AT EDDIE'S 2 (Tape 2)
   The whole game, written as a normal browser game:
     - update() runs 30 times a second and moves the game forward
     - render() draws the current screen (as often as the screen allows)
     - "screens" (title, night, custom...) decide what is shown

   How a night works (like FNaF 2):
     - there are no doors. You have a MASK, a FLASHLIGHT and the CAMERAS
     - characters walk from camera to camera, then come down the hall or
       crawl through the two air vents into the office
     - when someone is in the office, put the mask on right away
     - Withered Endo (in the hall) only leaves if you flash the light at him
     - the music box (camera 11) must be wound up or the Puppet comes
     - the flashlight runs on a battery; when it is empty you are in trouble

   Positions use Scratch's stage spots (x right, y UP, 0,0 = middle),
   because every picture came from the Scratch project. S(x, y) turns
   them into canvas spots on the 480 x 360 game screen.
   ===================================================================== */
"use strict";

const TICK = 1 / 30;                  // seconds per update
const TICK_MS = 1000 / 30;

/* ---------------------------------------------------------------------
   Small helpers
   --------------------------------------------------------------------- */
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));    // whole number lo..hi
const randFloat = (lo, hi) => lo + Math.random() * (hi - lo);
const chance = n => rand(1, n) === 1;                                      // "1 in n"
const pick = list => list[Math.floor(Math.random() * list.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SX = x => 240 + x;              // Scratch x -> screen x
const SY = y => 180 - y;              // Scratch y -> screen y

// A word the game shows. Mods can change it in texts.json ("group" is just
// where it is listed in texts.json). The build collects every W("...", "...").
const W = (group, s) => (TEXTS[s] !== undefined ? String(TEXTS[s]) : s);

/* ---------------------------------------------------------------------
   Scripts: tiny step-by-step sequences (same as Tape 1)
     yield 2          wait 2 seconds
     yield            wait one update
     yield () => x    wait until x is true
   --------------------------------------------------------------------- */
class Scripts {
  constructor() { this.list = []; }
  run(tag, gen) { const s = { tag, gen, wait: 0, until: null }; this.list.push(s); return s; }
  stop(...tags) { this.list = this.list.filter(s => !tags.includes(s.tag)); }
  stopAll() { this.list = []; }
  has(tag) { return this.list.some(s => s.tag === tag); }
  update() {
    for (const s of [...this.list]) {
      if (!this.list.includes(s)) continue;
      if (s.wait > 0) { s.wait -= TICK; if (s.wait > 1e-9) continue; }
      if (s.until && !s.until()) continue;
      s.until = null;
      const r = s.gen.next();
      if (!this.list.includes(s)) continue;
      if (r.done) { this.list.splice(this.list.indexOf(s), 1); continue; }
      if (typeof r.value === "number") s.wait = r.value;
      else if (typeof r.value === "function") s.until = r.value;
    }
  }
}

/* ---------------------------------------------------------------------
   The cast. Every character has an id the code uses, and a name the
   player sees (mods can rename them in texts.json).
   --------------------------------------------------------------------- */
const CAST = {
  tfreddy: { name: W("Characters", "Toy Eddy") },
  tbonnie: { name: W("Characters", "Toy Cheddy") },     // the ids are the FNaF 2 spots: Cheddy takes Bonnie's,
  tchica:  { name: W("Characters", "Toy Weddy") },      // Weddy takes Chica's, Eddy takes Freddy's
  mangle:  { name: W("Characters", "Meyg") },
  bb:      { name: W("Characters", "The Peepeepoopoo Monster") },   // Balloon Boy's spot (Aidan's picture, characters/bb.png)
  puppet:  { name: W("Characters", "The Puppet") },
  wfreddy: { name: W("Characters", "Withered Eddy") },
  wbonnie: { name: W("Characters", "Withered Cheddy") },
  wchica:  { name: W("Characters", "Withered Weddy") },
  foxy:    { name: W("Characters", "Withered Endo") },
  golden:  { name: W("Characters", "Golden Eddie") },
};
// the 10 you can set on the custom night (top row, then bottom row, like FNaF 2)
// Custom night: where each portrait's right eye is (as you look at it), in the 80 x 70 portrait,
// and how big the star over it is (percent of the 48-wide star picture)
const EYE_SPOT = {
  wfreddy: [49.5, 45, 42], wbonnie: [48, 51, 40], wchica: [49, 46.5, 40], foxy: [43, 56, 40], bb: [51, 21, 30],
  tfreddy: [47, 29, 42], tbonnie: [47, 28, 42], tchica: [47, 29, 42], mangle: [53, 41, 40], golden: [56, 54, 40],
};
// Which death minigame each character sends you to (anyone else: a random one)
//   run   GET READY! (the rainbow guy)     cake   Give Cake to the Children     gifts   Give Gifts, Give Life
const MINIGAME_FOR = { foxy: "run", mangle: "run", wfreddy: "cake", tfreddy: "cake", puppet: "gifts" };
const CUSTOM_ORDER = ["wfreddy", "wbonnie", "wchica", "foxy", "bb", "tfreddy", "tbonnie", "tchica", "mangle", "golden"];

/* ---------------------------------------------------------------------
   The 12 cameras
   --------------------------------------------------------------------- */
const CAMS = {
  1: W("Cameras", "Party Room 1"), 2: W("Cameras", "Party Room 2"), 3: W("Cameras", "Party Room 3"),
  4: W("Cameras", "Party Room 4"), 5: W("Cameras", "Left Air Vent"), 6: W("Cameras", "Right Air Vent"),
  7: W("Cameras", "Main Hall"), 8: W("Cameras", "Parts/Service"), 9: W("Cameras", "Show Stage"),
  10: W("Cameras", "Game Area"), 11: W("Cameras", "Prize Corner"), 12: W("Cameras", "Kid's Cove"),
};

// The 12 buttons on the camera map: [left, top, width, height] from the map's middle
// (map picture units; the map is drawn at 45%). Each "lit<N>" picture's pin is its top-left corner.
const MAP_BUTTONS = {
  1: [-166, 43, 36.5, 22.5], 2: [-46, 43, 36.5, 22.5], 3: [-166, -13, 36.5, 22.5], 4: [-43, -14, 36.5, 22.5],
  5: [-165.5, 129.5, 36.5, 22.5], 6: [-41, 128, 36.5, 22.5], 7: [-5, -81, 36.5, 22.5], 8: [-159, -93, 36.5, 22.5],
  9: [151, -125, 36.5, 22.5], 10: [71, -4, 36.5, 22.5], 11: [179, -39, 36.5, 22.5], 12: [166, 34, 36.5, 22.5],
};

/* ---------------------------------------------------------------------
   Where everyone walks. Numbers are cameras; the other spots are:
     hall   the dark hallway in front of the office (flashlight shows it)
     ventL  ventR   the openings of the air vents (the vent lights show them)
     office in the office with you
   Each list is the walk from start to the office. Some spots have a
   second way to go ("or").
   --------------------------------------------------------------------- */
const PATHS = {
  tfreddy: [9, 10, "hall", "office"],
  tbonnie: [9, 3, 4, 2, 6, "ventR", "office"],
  tchica:  [9, 7, 4, 1, 5, "ventL", "office"],
  mangle:  [12, 10, "hall", 6, "ventR", "office"],
  bb:      [10, 5, "ventL", "office"],
  wfreddy: [8, 7, 3, "hall", "office"],
  wbonnie: [8, 7, 1, 5, "ventL", "office"],
  wchica:  [8, 4, 2, 6, "ventR", "office"],
};
// side trips: from this spot they may go here instead (then carry on from there)
const DETOURS = {
  tchica: { 7: "hall", hall: 4 },
  wbonnie: { 7: "hall", hall: "office" },
  mangle: { 10: 7, 7: "hall" },
};

// AI (0-20) on nights 1-6 (custom night = 7). Some go up during the night (HOURLY).
const NIGHT_AI = {
  //  toys...                                         withered...
  1: { tfreddy: 0, tbonnie: 0, tchica: 0, mangle: 0, bb: 0, wfreddy: 0, wbonnie: 0, wchica: 0, foxy: 0, golden: 0, puppet: 1 },
  2: { tfreddy: 2, tbonnie: 3, tchica: 3, mangle: 3, bb: 3, wfreddy: 0, wbonnie: 0, wchica: 0, foxy: 1, golden: 0, puppet: 3 },
  3: { tfreddy: 0, tbonnie: 0, tchica: 0, mangle: 0, bb: 1, wfreddy: 2, wbonnie: 2, wchica: 2, foxy: 2, golden: 0, puppet: 5 },
  4: { tfreddy: 0, tbonnie: 0, tchica: 0, mangle: 5, bb: 3, wfreddy: 3, wbonnie: 4, wchica: 3, foxy: 7, golden: 0, puppet: 7 },
  5: { tfreddy: 5, tbonnie: 2, tchica: 2, mangle: 1, bb: 5, wfreddy: 4, wbonnie: 4, wchica: 4, foxy: 2, golden: 0, puppet: 9 },
  6: { tfreddy: 6, tbonnie: 5, tchica: 5, mangle: 4, bb: 6, wfreddy: 6, wbonnie: 6, wchica: 6, foxy: 5, golden: 3, puppet: 12 },
};
// at these hours, these characters wake up a bit more (night 1 starts slow)
const HOURLY = {
  1: { 2: { tbonnie: 2, tchica: 1 }, 3: { tbonnie: 1, tchica: 1, tfreddy: 1 }, 4: { bb: 1 } },
};

// The custom night's ready-made challenges (FNaF 2 style). The numbers
// follow CUSTOM_ORDER. "prize" is the plush you win on the desk.
const PRESETS = [
  { name: W("Custom night", "Custom"), ai: null },
  { name: W("Custom night", "20/20/20/20"), ai: [20, 20, 20, 20, 0, 0, 0, 0, 0, 0], prize: "star" },
  { name: W("Custom night", "New & Shiny"), ai: [0, 0, 0, 0, 10, 10, 10, 10, 10, 0], prize: "Sprite59" },
  { name: W("Custom night", "Double Trouble"), ai: [0, 20, 0, 5, 0, 0, 20, 0, 0, 0], prize: "Sprite66" },
  { name: W("Custom night", "Night of Misfits"), ai: [0, 0, 0, 0, 20, 0, 0, 0, 20, 10], prize: "Sprite58" },
  { name: W("Custom night", "Endo Endo"), ai: [0, 0, 0, 20, 0, 0, 0, 0, 20, 0], prize: "Sprite62" },
  { name: W("Custom night", "Ladies Night"), ai: [0, 0, 20, 0, 0, 0, 0, 20, 20, 0], prize: "Sprite60" },
  { name: W("Custom night", "Eddy's Circus"), ai: [20, 0, 0, 10, 10, 20, 0, 0, 0, 10], prize: "Sprite63" },
  { name: W("Custom night", "Cupcake Challenge"), ai: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5], prize: "Sprite61" },
  { name: W("Custom night", "Eddie Fever"), ai: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], prize: "Sprite65" },
  { name: W("Custom night", "Golden Eddie"), ai: [1, 9, 8, 7, 1, 9, 8, 7, 1, 9], prize: "Sprite64" },
  { name: W("Custom night", "F*CK NO!"), ai: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20] },        // everyone on 20
];
// where each prize plush sits (Scratch spot, next to the desk)
const PRIZE_SPOT = {
  Sprite58: [35, -100], Sprite59: [-75, -105], Sprite60: [-105, -115], Sprite61: [80, -100], Sprite62: [-40, -110],
  Sprite63: [-125, -105], Sprite64: [120, -125], Sprite65: [20, -130], Sprite66: [60, -90],
};

// The phone handset icon (Material Design "call" icon, 24 x 24)
const PHONE_ICON = new Path2D("M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z");

/* ---------------------------------------------------------------------
   Save files (3 of them). The page address picks one: 2/?file=2
   Kept in this browser as "frae2-save-file2".
   beat5 / beat6 / beat420 are the three stars (same names as Tape 1 so
   the game menu can show them).
   --------------------------------------------------------------------- */
const SAVE_FILES = 3;
const saveKey = file => "frae2-save-file" + file;

function fileFromUrl() {
  const f = Number(new URLSearchParams(location.search).get("file"));
  return Number.isInteger(f) && f >= 1 && f <= SAVE_FILES ? f : null;
}
function loadProgress(file) {
  const p = { night: 1, beat5: false, beat6: false, beat420: false, started: false,
              prizes: [], achievements: {}, caughtBy: [], custom: null };
  try {
    const raw = localStorage.getItem(saveKey(file));
    if (raw) {
      const s = JSON.parse(raw);
      p.night = Number(s.night) || 1;
      p.beat5 = !!s.beat5; p.beat6 = !!s.beat6; p.beat420 = !!s.beat420;
      p.prizes = Array.isArray(s.prizes) ? s.prizes : [];
      p.achievements = (s.achievements && typeof s.achievements === "object") ? s.achievements : {};
      p.caughtBy = Array.isArray(s.caughtBy) ? s.caughtBy : [];
      p.custom = Array.isArray(s.custom) ? s.custom : null;
      p.started = true;
    }
  } catch (e) { /* storage blocked: play without saving */ }
  return p;
}
function saveProgress(file, p) {
  try {
    localStorage.setItem(saveKey(file), JSON.stringify({ night: p.night, beat5: p.beat5, beat6: p.beat6, beat420: p.beat420,
      prizes: p.prizes, achievements: p.achievements, caughtBy: p.caughtBy, custom: p.custom }));
  } catch (e) {}
}
function eraseProgress(file) { try { localStorage.removeItem(saveKey(file)); } catch (e) {} }

/* =====================================================================
   THE GAME
   ===================================================================== */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });   // no see-through canvas: cheaper to show
    this.scripts = new Scripts();
    this.smooth = new Smooth();
    this.file = 1;
    this.progress = loadProgress(1);
    this.mouse = { x: 240, y: 180, down: false };
    this.clicks = [];
    this.keys = [];
    this.held = new Set();          // keys being held down (flashlight, vent lights)
    this.goldenRate = 1000;         // 1 in this many monitor flips can bring Golden Eddie (left arrow changes it)
    this.paused = false;
    this.makeSpeakers();
    this.screen = "black";
    this.layers = [];
    this.tick = 0;
  }

  makeSpeakers() {
    const sp = v => Sound.speaker(v);
    this.sp = {
      music: sp(100), blip: sp(60), fan: sp(25), amb: sp(40), buzz: sp(0), vent: sp(0), flip: sp(100),
      camHum: sp(0), camBlip: sp(60), mask: sp(100), breath: sp(0), steps: sp(30), bb: sp(80), radio: sp(0),
      musicbox: sp(0), windup: sp(70), jack: sp(0), scream: sp(100), stat: sp(100), phone: sp(100),
      chime: sp(100), honk: sp(100), mini: sp(80), flicker: sp(100),
      vhs: sp(70),               // the song on the VHS death guide
    };
  }

  /* ---------------------------------------------------------------
     Main loop pieces
     --------------------------------------------------------------- */
  update() {
    this.smooth.snapshot();
    this.tick++;
    if (!this.paused) {
      this.scripts.update();
      if (this.screen === "title") this.updateTitle();
      else if (this.screen === "custom") this.updateCustom();
      else if (this.screen === "night") this.updateNight();
      else if (this.screen === "mini") this.updateMini();
      else if (this.screen === "card") this.updateCard();
    }
    this.clicks.length = 0;
    this.keys.length = 0;
  }

  render(a) {
    const ctx = this.ctx, k = this.canvas.width / VIEW_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";     // "high" re-filters every scaled picture each frame (slow)
    if (this.screen === "title") this.drawTitle(ctx, a);
    else if (this.screen === "custom") this.drawCustom(ctx, a);
    else if (this.screen === "night") this.drawNight(ctx, a);
    else if (this.screen === "mini") this.drawMini(ctx, a);
    for (const L of this.layers) L.draw(ctx, a);
  }

  go(screen) {
    this.scripts.stopAll();
    this.layers = [];
    this.screen = screen;
  }

  // A layer on top of everything: a picture, or any drawing function, with its own fade
  overlay(group, name, o = {}) {
    const L = {
      pic: group ? pic(group, name) : null, x: o.x ?? 240, y: o.y ?? 180, size: o.size || 100, fade: o.fade ?? 1,
      key: "ov" + Math.random(), paint: o.paint,
      draw: (ctx, a) => {
        const f = this.smooth.at(L.key, a);
        if (L.paint) { ctx.save(); ctx.globalAlpha *= f; L.paint(ctx, a); ctx.restore(); }
        else draw(ctx, L.pic, L.x, L.y, { size: L.size, alpha: f });
      },
      setFade: f => { L.fade = f; this.smooth.set(L.key, f); },
    };
    this.smooth.jump(L.key, L.fade);
    this.layers.push(L);
    return L;
  }
  removeOverlay(L) { this.layers = this.layers.filter(x => x !== L); }
  *fade(L, to, steps = 40) {
    const from = L.fade;
    for (let i = 1; i <= steps; i++) { L.setFade(from + (to - from) * i / steps); yield; }
  }

  /* ---------------------------------------------------------------
     Input (called by the page)
     --------------------------------------------------------------- */
  pointer(x, y, down) {
    this.mouse.x = x; this.mouse.y = y;
    if (down === true && !this.mouse.down) this.clicks.push({ x, y });
    if (down !== undefined) this.mouse.down = down;
  }
  key(k) { this.keys.push(k); }
  hold(k, on) { if (on) this.held.add(k); else this.held.delete(k); }

  // Text helper: draws words with a font, size and color
  text(ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || ""} ${o.size || 10}px "${o.font || "Share Tech Mono"}"`;
    ctx.fillStyle = o.color || "#fff";
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.base || "alphabetic";
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    if (o.shadow) {
      // a dark copy just behind the words (much cheaper than a blurred shadow)
      const c = ctx.fillStyle;
      ctx.fillStyle = o.shadow;
      ctx.fillText(s, x + 1, y + 1, o.max);
      ctx.fillStyle = c;
    }
    ctx.fillText(s, x, y, o.max);
    ctx.restore();
  }

  // (TV static removed: the game stays smooth. Full strength = plain black screen.)
  drawStatic(ctx, strength) {
    if (strength < 1) return;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 480, 360);
  }

  /* =================================================================
     TITLE SCREEN
     ================================================================= */
  useFile(file) { this.file = file; this.progress = loadProgress(file); }
  save() { if (!settings.debug) saveProgress(this.file, this.progress); }

  boot() { this.showTitle(); }

  menuItems() {
    const items = [
      { id: "new",      label: W("Title menu", "New Game"),   show: true },
      { id: "continue", label: W("Title menu", "Continue"),   show: true },
      { id: "night6",   label: W("Title menu", "6th Night"),  show: this.progress.beat5 },
      { id: "custom",   label: W("Title menu", "It's still dark."), show: true },
    ].filter(i => i.show);
    items.forEach((it, i) => { it.x = 46; it.y = 222 + i * 26; });
    return items;
  }

  showTitle() {
    this.go("title");
    Sound.stopAll();
    this.sp.music.setVolume(100);
    this.sp.music.play("Title", "title", { loop: true });
    this.level = this.progress.night;
    this.selected = this.progress.beat6 ? "custom" : this.progress.beat5 ? "night6" : this.level === 1 ? "new" : "continue";
    this.hovered = null;
    this.face = 1;
    this.titleFlash = 0;
    // right after the GET READY run: the title is "Eddies Riceria" (just this once)
    this.titleRiceria = !!this.riceria;
    this.riceria = false;
    this.smooth.jump("titleFade", 0);
    this.scripts.run("title", function* () {
      for (let i = 1; i <= 30; i++) { this.smooth.set("titleFade", i / 30); yield; }
    }.call(this));
    // the faces behind the menu twitch now and then (like FNaF 2's title)
    this.scripts.run("title", function* () {
      for (;;) {
        this.face = 1;
        yield randFloat(1.5, 5);
        this.face = rand(2, 4);
        this.titleFlash = 1;
        yield randFloat(0.05, 0.25);
      }
    }.call(this));
  }

  updateTitle() {
    const m = this.mouse, items = this.menuItems();
    this.titleFlash = Math.max(0, this.titleFlash - 0.08);
    const over = items.find(i => m.x > i.x - 24 && m.x < i.x + 190 && m.y > i.y - 18 && m.y < i.y + 6);
    if (over && over.id !== this.hovered) { this.blip(); this.selected = over.id; }
    this.hovered = over ? over.id : null;
    const sHover = m.x < 110 && m.y > 330;
    const aHover = m.x > 330 && m.y > 330;
    if ((sHover && !this.settingsHover) || (aHover && !this.achHover)) this.blip();
    this.settingsHover = sHover; this.achHover = aHover;
    for (const c of this.clicks) {
      if (aHover) { openAchievements(); return; }
      if (sHover) { openSettings(); return; }
      if (over) { this.choose(over.id); return; }
    }
    for (const k of this.keys) {
      const i = items.findIndex(it => it.id === this.selected);
      if (k === "up" || k === "down") {
        this.selected = items[(i + (k === "up" ? -1 : 1) + items.length) % items.length].id;
        this.blip();
      } else if (k === "enter") { this.choose(this.selected); return; }
    }
  }
  blip() { this.sp.blip.play("Sprite10", "COMPUTER_DIGITAL_L2076605"); }

  choose(id) {
    if (id === "new") {
      this.level = 1;
      this.progress.night = 1;
      this.died = false;
      return this.newspaper();
    }
    if (id === "continue") return this.startIntro();
    if (id === "night6") { this.level = 6; return this.startIntro(); }
    if (id === "custom") return this.showCustom();
  }

  drawTitle(ctx, a) {
    const f = this.smooth.at("titleFade", a);
    ctx.save();
    ctx.globalAlpha = f;
    // faces on the right, then the words
    const face = TITLE_FACES[(this.face - 1) % TITLE_FACES.length];
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 480, 360);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 480, 360); ctx.clip();
    if (this.titleRiceria) draw(ctx, pic("Riceria", "crying"), 360, 185);      // the rainbow guy, crying
    else drawActor(ctx, face.role, face.box, { mode: "head", kind: "title", still: true, rot: face.rot, shade: face.shade });   // (no idle animation on the menu)
    ctx.restore();
    const title = this.titleRiceria ? [W("Title menu", "Eddies"), W("Title menu", "Riceria")]
      : [W("Title menu", "Fried"), W("Title menu", "Rice"), W("Title menu", "at"), W("Title menu", "Eddie's"), W("Title menu", "2")];
    title.forEach((s, i) => this.text(ctx, s, 22, 46 + i * 27, { size: 27 }));
    // stars (nights 5 and 6 beaten, and the 20/20/20/20 night)
    const stars = [this.progress.beat5, this.progress.beat6, this.progress.beat420].filter(Boolean).length;
    for (let i = 0; i < stars; i++) draw(ctx, pic("Sprite29", "Gold_Star"), 34 + i * 26, 192, { size: 22 });
    for (const it of this.menuItems()) {
      this.text(ctx, it.label, it.x, it.y, { size: 17 });
      if (it.id === this.selected) this.text(ctx, ">>", it.x - 26, it.y, { size: 17 });
      if (it.id === "continue" && this.selected === "continue")
        this.text(ctx, W("Title menu", "Night") + " " + Math.min(5, this.level), it.x + 1, it.y + 12, { size: 9, color: "#bbb" });
    }
    this.text(ctx, W("Settings", "Settings"), 14, 350, { size: 11, color: this.settingsHover ? "#f7931e" : "#fff" });
    const got = ACHIEVEMENTS.filter(x => this.progress.achievements[x.id]).length;
    this.text(ctx, ACH_WORD("Achievements") + "  " + got + "/" + ACHIEVEMENTS.length, 470, 350,
      { size: 11, align: "right", color: this.achHover ? "#f7931e" : "#fff" });
    ctx.restore();
  }

  settingsClosed() { if (this.screen === "title") this.showTitle(); }

  /* =================================================================
     NEWSPAPER (New Game) AND THE NIGHT INTRO
     ================================================================= */
  newspaper() {
    const ad = this.overlay(null, null, { fade: 0, paint: ctx => this.drawNewspaper(ctx) });
    this.scripts.run("ad", function* () {
      yield* this.fade(ad, 1, 30);
      this.scripts.stop("title");
      this.screen = "black";
      this.sp.music.stopAll();
      let t = 0;
      yield () => (t += TICK) >= 6 || this.clicks.length > 0;
      yield* this.fade(ad, 0, 30);
      this.startIntro();
    }.call(this));
  }

  startIntro() {
    this.go("black");
    Sound.stopAll();
    if (this.level < 6) this.progress.night = this.level;
    this.save();
    const ord = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th"][this.level];
    const card = this.overlay(null, null, { paint: ctx => {
      this.text(ctx, "12:00 AM", 240, 170, { size: 26, align: "center", font: "Press Start 2P" });
      this.text(ctx, ord + " " + W("Night start", "Night"), 240, 200, { size: 14, align: "center", font: "Press Start 2P" });
    } });
    this.scripts.run("intro", function* () {
      this.sp.blip.play("Sprite10", "Change camera");
      yield 2.2;
      yield* this.fade(card, 0, 30);
      this.removeOverlay(card);
      // the spinning rice bowl in the corner while the night loads
      const spin = this.overlay("Loading", "icon", { x: 450, y: 320, size: 60 });
      yield randFloat(1.5, 3);
      this.removeOverlay(spin);
      this.startNight();
    }.call(this));
  }

  /* =================================================================
     THE NIGHT
     ================================================================= */
  startNight() {
    this.go("night");
    const L = this.level;
    const ai = {};
    if (L <= 6) Object.assign(ai, NIGHT_AI[L]);
    else Object.assign(ai, this.customAI, { puppet: 10 });
    const n = this.n = {
      hour: 0, clock: 0,
      battery: 100,
      musicBox: 1,              // 1 = fully wound, 0 = empty (the Puppet comes)
      puppet: 0,                // 0 = in the box, 1-3 = coming out, 4 = here
      maskUp: false, maskFrame: 0,          // 0 = off, 1-6 = sliding up/down
      monitorUp: false, camsUp: false, monitorFrame: 0,
      cam: 9,
      maskArmed: false, monitorArmed: false,
      flash: false, ventL: false, ventR: false,     // lights on right now
      flashHeld: 0,              // how long the hallway light has been held (counts flashes for Endo)
      camFlash: false,
      at: {},                    // where each character is
      wait: {},                  // seconds until each character's next chance to move
      ai,
      visit: null,               // someone in the office: {who, t, masked, leaveIn}
      bbIn: false, mangleIn: false, mangleAttack: 0,
      foxy: { hall: false, timer: 0, flashes: 0, need: 6, retreat: 0 },
      golden: null,              // "hall" or "office" when he shows up
      goldenTimer: 0,
      switchFx: 0,               // camera switch static (fades out)
      hallFlicker: false,
      fanFrame: 1,
      phone: "off", callTime: 0,
      halluc: null,
      endo: false, shadow: false,
      slide: 0,                  // Toy Cheddy sliding past the mask
      jumpscare: null,
      frozen: false,
      camsSeen: new Set(),
      maskTime: 0,
    };
    for (const who of Object.keys(PATHS)) { n.at[who] = PATHS[who][0]; n.wait[who] = randFloat(4, 6); }
    n.at.foxy = 8; n.wait.foxy = randFloat(4, 6);
    this.smooth.jump("pan", 0);
    this.smooth.jump("camPan", 0);
    this.smooth.jump("phoneShow", 0);
    this.smooth.jump("slide", -500);

    const sp = this.sp;
    // (no static hum on the cameras, the flashlight or the vent lights: just the fan and rain)
    sp.fan.setVolume(25); sp.fan.play("Fansound", "fansound", { loop: true });
    sp.amb.setVolume(35); sp.amb.play("Stage", "Ambient", { loop: true });
    sp.radio.setVolume(0); sp.radio.play("Mangle", "elec garble", { loop: true });
    sp.musicbox.setVolume(0); sp.musicbox.play("Sprite6", "Music_Box_Melody_Playful", { loop: true });
    sp.breath.setVolume(0); sp.breath.play("Sprite3", "deepbreaths", { loop: true });

    this.runPhone();
    this.runCameraPan();
    this.runExtras();
    if (L === 1) this.showHelp();
  }

  // A short how-to on the first night
  showHelp() {
    const help = this.overlay(null, null, { fade: 0, paint: ctx => {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(100, 92, 280, 42);
      this.text(ctx, W("Help", "Hold SPACE (or click and hold) for the flashlight"), 240, 106, { size: 8, align: "center" });
      this.text(ctx, W("Help", "Q / bottom-left bar: mask    E / bottom-right bar: cameras"), 240, 118, { size: 8, align: "center" });
      this.text(ctx, W("Help", "A / D (or hold the LIGHT buttons): vent lights"), 240, 129, { size: 8, align: "center" });
    } });
    this.scripts.run("night", function* () {
      yield* this.fade(help, 1, 20);
      yield 9;
      yield* this.fade(help, 0, 30);
      this.removeOverlay(help);
    }.call(this));
  }

  /* --------------------------------------------------------------
     THE CLOCK: one hour every 70 seconds, 6 AM wins
     -------------------------------------------------------------- */
  updateClock() {
    const n = this.n;
    n.clock += TICK;
    if (n.clock < 70) return;
    n.clock -= 70;
    n.hour++;
    // later hours wake everyone up a little
    const extra = (HOURLY[this.level] || {})[n.hour];
    if (extra) for (const [k, v] of Object.entries(extra)) n.ai[k] += v;
    if (this.level >= 2 && this.level <= 6 && (n.hour === 3 || n.hour === 5))
      for (const k of Object.keys(n.ai)) if (n.ai[k] > 0 && k !== "golden") n.ai[k] = Math.min(20, n.ai[k] + 1);
    if (n.hour === 6) this.sixAM();
  }

  /* --------------------------------------------------------------
     THE PHONE CALL (nights 1-6). Same call banner as Tape 1.
     -------------------------------------------------------------- */
  runPhone() {
    const n = this.n;
    if (this.level > 6 || this.died) return;
    const sp = this.sp.phone;
    let ring = null, call = null;
    const answer = () => {
      if (n.phone !== "ringing") return;
      this.scripts.stop("ring");
      if (ring) ring.fadeOut(0.15);
      call = sp.play("Sprite11", "call " + this.level + "b");
      n.phone = "talking";
      n.callTime = 0;
      this.scripts.run("phone", function* () {
        yield () => call.done;
        n.phone = "off";
        this.unlock("call");
      }.call(this));
    };
    const hangUp = () => {
      this.unlock("hangup");
      if (ring) ring.stop();
      if (call) call.stop();
      this.scripts.stop("ring", "phone");
      n.phone = "off";
    };
    this.phoneTap = () => (n.phone === "ringing" ? answer() : hangUp());
    this.scripts.run("ring", function* () {
      yield 1.5;
      ring = sp.play("Ringtone", "ringtone");
      yield 1;
      n.phone = "ringing";
      yield randFloat(2, 6);
      answer();
    }.call(this));
  }
  phoneBox() { return { x: 8, y: 52, w: 160, h: 42 }; }
  updatePhone() {
    const n = this.n;
    if (n.phone === "talking") n.callTime += TICK;
    const show = this.smooth.get("phoneShow") || 0;
    this.smooth.set("phoneShow", clamp(show + (n.phone === "off" ? -0.15 : 0.15), 0, 1));
    this.sp.phone.setVolume(n.camsUp ? 55 : 100);
  }
  drawPhone(ctx, a) {
    const n = this.n, show = this.smooth.at("phoneShow", a) || 0;
    if (show <= 0) return;
    const { x, y: y0, w, h } = this.phoneBox();
    const y = y0 - (1 - show) * 14;
    ctx.save();
    ctx.globalAlpha = show;
    ctx.fillStyle = "rgba(28, 28, 32, 0.92)";
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 13); ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"; ctx.lineWidth = 0.75; ctx.stroke();
    const cx = x + 21, cy = y + h / 2, r = 14;
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, "#c39bff"); g.addColorStop(1, "#6a2bd1");   // Fred's purple circle
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = '600 11px "Sans Serif"';
    ctx.fillText(W("Phone", "F"), cx, cy + 0.5);
    ctx.textAlign = "left";
    ctx.font = '600 10px "Sans Serif"';
    ctx.fillText(W("Phone", "Fred"), x + 41, y + 15, w - 80);
    ctx.font = '8px "Sans Serif"';
    ctx.fillStyle = "rgba(235, 235, 245, 0.6)";
    if (n.phone === "ringing") ctx.fillText(W("Phone", "incoming call..."), x + 41, y + 28);
    else {
      const t = Math.floor(n.callTime);
      ctx.fillText(Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"), x + 41, y + 28);
    }
    const bx = x + w - 21, ringing = n.phone === "ringing";
    const pulse = ringing ? 1 + 0.06 * Math.sin(performance.now() / 120) : 1;
    ctx.fillStyle = ringing ? "#30d158" : "#ff3b30";
    ctx.beginPath(); ctx.arc(bx, cy, 13 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.translate(bx, cy);
    if (!ringing) ctx.rotate(Math.PI * 0.75);
    ctx.scale(0.62, 0.62);
    ctx.translate(-12, -12);
    ctx.fillStyle = "#fff";
    ctx.fill(PHONE_ICON);
    ctx.restore();
  }

  /* --------------------------------------------------------------
     The camera picture slowly slides left and right
     -------------------------------------------------------------- */
  runCameraPan() {
    this.scripts.run("night", function* () {
      const glide = function* (from, to) {
        for (let t = TICK; t < 7; t += TICK) { this.smooth.set("camPan", from + (to - from) * t / 7); yield; }
        this.smooth.set("camPan", to);
      }.bind(this);
      for (;;) { yield* glide(110, -110); yield 2; yield* glide(-110, 110); yield 2; }
    }.call(this));
  }

  // Little things that make the night feel alive (and a few rare scares)
  runExtras() {
    const n = this.n;
    // the fan on the desk spins
    this.scripts.run("night", function* () { for (;;) { n.fanFrame = 3 - n.fanFrame; yield 0.07; } }.call(this));
    // the bare endoskeleton sometimes sits in the left vent (it does nothing)
    this.scripts.run("night", function* () {
      for (;;) { yield 20; n.endo = this.level >= 2 && chance(6); n.shadow = this.level >= 3 && chance(40); }
    }.call(this));
    // rare one-frame scary faces (only with jumpscares ON)
    if (settings.jumpscares === "1") {
      this.scripts.run("night", function* () {
        for (;;) {
          yield 1;
          if (this.level >= 2 && chance(400) && !n.maskUp) {
            n.halluc = pick(["bbEyes", "shadowHead"]);
            yield randFloat(0.1, 0.4);
            n.halluc = null;
          }
        }
      }.call(this));
    }
  }

  /* --------------------------------------------------------------
     THE CHARACTERS
     Every ~5 seconds each one gets a chance to move: roll 1-20, and if
     the roll is their AI level or lower, they take the next step.
     -------------------------------------------------------------- */
  updateCharacters() {
    const n = this.n;
    for (const who of Object.keys(PATHS)) {
      if (n.ai[who] <= 0 || n.at[who] === "office" || n.at[who] === "gone") continue;
      n.wait[who] -= TICK;
      if (n.wait[who] > 0) continue;
      n.wait[who] = randFloat(4.5, 5.5);
      if (rand(1, 20) <= n.ai[who]) this.step(who);
    }
    this.updateFoxy();
  }

  // Someone in a spot that only one can use?
  taken(spot, me) {
    const n = this.n;
    if (spot === "office") return !!n.visit || Object.entries(n.at).some(([k, v]) => k !== me && v === "office");
    if (spot === "hall" || spot === "ventL" || spot === "ventR")
      return Object.entries(n.at).some(([k, v]) => k !== me && k !== "foxy" && v === spot);
    return false;
  }

  // Take one step toward the office
  step(who) {
    const n = this.n, path = PATHS[who], here = n.at[who];
    let next;
    const detour = (DETOURS[who] || {})[here];
    if (detour !== undefined && chance(2)) next = detour;
    else if (here === "hall" && DETOURS[who] && DETOURS[who].hall !== undefined) next = DETOURS[who].hall;
    else next = path[path.indexOf(here) + 1];
    if (next === undefined) return;

    // at a vent opening or in the hall: the last step into the office
    if (next === "office") {
      // a mask on while they are at the vent sends them back (they think you are one of them)
      if ((here === "ventL" || here === "ventR") && n.maskUp) return this.sendBack(who);
      // they only sneak in while you are looking at the cameras
      if (!n.camsUp || this.taken("office", who)) return;
      if (who === "bb") return this.bbEnters();
      if (who === "mangle") return this.mangleEnters();
      n.at[who] = "office";
      n.visit = { who, t: 0, started: false, masked: 0 };
      this.sp.steps.setVolume(60);
      this.sp.steps.play("Left Vent", "ventwalk1");
      return;
    }
    if (this.taken(next, who)) return;
    const from = here;
    n.at[who] = next;
    // footsteps in the vents
    if (next === 5 || next === 6 || next === "ventL" || next === "ventR") {
      this.sp.steps.setVolume(next === "ventL" || next === "ventR" ? 60 : 30);
      this.sp.steps.play("Left Vent", pick(["ventwalk1", "ventwalk2"]));
    }
    if (who === "bb") this.sp.bb.play("BB", pick(["Hello?", "Hi!", "Laugh"]));
    // the camera you watch glitches when someone leaves or comes in
    if (n.camsUp && (from === n.cam || next === n.cam)) this.camGlitch();
  }

  // Back to the start (they leave the office or the vent)
  sendBack(who) {
    const n = this.n;
    n.at[who] = PATHS[who][0];
    n.wait[who] = randFloat(6, 9);
    if (who === "bb") this.sp.bb.play("BB", "Hi!");
  }

  // BB gets in: he laughs, and your lights stop working until 6 AM
  bbEnters() {
    const n = this.n;
    n.at.bb = "office";
    n.bbIn = true;
    this.sp.bb.setVolume(100);
    this.sp.bb.play("BB in the office", "echo4b");
  }
  // Meyg gets in: hangs from the ceiling, radio crackling, and may drop on you
  mangleEnters() {
    const n = this.n;
    n.at.mangle = "office";
    n.mangleIn = true;
    n.mangleAttack = randFloat(8, 25);
  }

  /* --------------------------------------------------------------
     WITHERED ENDO (Foxy): comes from Parts/Service to the hallway.
     Flash the light at him over and over until he gives up.
     -------------------------------------------------------------- */
  updateFoxy() {
    const n = this.n, f = n.foxy;
    if (n.ai.foxy <= 0) return;
    if (!f.hall) {
      n.wait.foxy -= TICK;
      if (n.wait.foxy > 0) return;
      n.wait.foxy = randFloat(4.5, 5.5);
      if (rand(1, 20) > n.ai.foxy || this.taken("hall", "foxy") && chance(2)) return;
      if (n.camsUp && n.cam === 8) this.camGlitch();
      f.hall = true;
      n.at.foxy = "hall";
      f.flashes = 0;
      f.need = rand(4, 6) + Math.floor(n.ai.foxy / 5);
      f.timer = randFloat(14, 22) - n.ai.foxy * 0.3;
      f.retreat = 0;
      return;
    }
    // he is in the hall
    if (f.retreat > 0) {                      // flashed enough: he walks back
      f.retreat -= TICK;
      if (f.retreat <= 0) { f.hall = false; n.at.foxy = 8; n.wait.foxy = randFloat(8, 14); }
      return;
    }
    f.timer -= TICK;
    if (f.timer <= 0) {
      if (n.flash && !n.maskUp && !n.camsUp) { f.timer = 1; return; }   // he will not lunge into the light
      if (n.camsUp) this.forceMonitorDown();
      this.startStare();                       // he does not kill you right away: the stare minigame
    }
  }
  // Called when the hallway light turns on
  flashedHall() {
    const f = this.n.foxy;
    if (!f.hall || f.retreat > 0) return;
    f.flashes++;
    f.timer = Math.max(f.timer, 3);
    if (f.flashes >= f.need) { f.retreat = randFloat(1, 2.5); this.unlock("flash"); }
  }

  /* --------------------------------------------------------------
     WITHERED ENDO'S STARE (like Alma in DOORS)
     When he lunges, his head (Aidan's drawing, tools/tape2/endo_stare.png)
     fills the screen inside its outline. The head keeps shrinking; every
     tap (click, Space, any game key) pumps it bigger. Keep the head inside
     the outline: not so small it slips away, not so big it bursts out.
     Too long outside and he gets you. Hold on long enough and he leaves.
     The night (clock, everyone else) waits while this happens.
     -------------------------------------------------------------- */
  startStare() {
    const n = this.n, ai = n.ai.foxy;
    n.maskUp = false; n.maskFrame = 0;
    n.flash = n.ventL = n.ventR = false;
    n.stare = {
      t: 0,                        // seconds so far
      need: 6 + ai * 0.2,          // seconds to hold on (6 s on level 0, 10 s on level 20)
      s: 1.04, v: 0,               // head size (1 = just fills the outline) and how fast it is changing
      pull: 0.13 + ai * 0.007,     // how fast it shrinks by itself (size per second)
      wobble: ai / 20,             // harder levels: the outline breathes and the head gets shoved around
      ring: 1,                     // outline size (it breathes on harder levels)
      danger: 0,                   // 0..1: fills while the head is outside, he gets you at 1
      out: false, pump: 0, won: 0, // pump = a little flash on each tap; won counts up after you make it
    };
    this.sp.flicker.setVolume(100);
    this.sp.flicker.play("Light Left", "ComputerInteriorLong_EVL02_2");
  }
  updateStare() {
    const n = this.n, st = n.stare, f = n.foxy;
    // he gives up: the head shrinks away, then the night goes on
    if (st.won) {
      st.won += TICK;
      st.s = Math.max(0, st.s - TICK * 2.2);
      if (st.won > 0.7) {
        n.stare = null;
        f.hall = false; f.retreat = 0; n.at.foxy = 8; n.wait.foxy = randFloat(10, 16);
      }
      return;
    }
    st.t += TICK;
    const taps = this.clicks.length + this.keys.length;
    if (taps) { st.v += 0.3 * Math.min(taps, 2); st.pump = 1; }   // each tap: about +0.065 size
    if (st.wobble && chance(20)) st.v += randFloat(-0.25, 0.25) * st.wobble;   // a shove now and then
    st.v *= 0.85;                                             // a pump fades out in about a quarter second
    st.s = clamp(st.s + (st.v - st.pull) * TICK, 0.55, 1.45); // always shrinking
    st.ring = 1 + Math.sin(st.t * 1.3) * 0.05 * st.wobble;
    const rel = st.s / st.ring;
    st.out = rel < 0.93 || rel > 1.14;                        // 1.14 = the head touches the outline's outer edge
    st.danger = clamp(st.danger + (st.out ? TICK / 1.1 : -TICK / 2), 0, 1);
    st.pump = Math.max(0, st.pump - TICK * 5);
    this.sp.breath.setVolume(40 + st.danger * 60);
    if (st.danger >= 1) { n.stare = null; this.jumpscare("foxy"); return; }
    if (st.t >= st.need) { st.won = TICK; this.sp.flicker.stopAll(); }
  }
  drawStare(ctx) {
    const st = this.n.stare;
    // the office goes almost black
    ctx.fillStyle = "rgba(0,0,0," + (st.won ? 0.88 * (1 - st.won / 0.7) : 0.88) + ")";
    ctx.fillRect(0, 0, VIEW_W, 360);
    const shake = st.won ? 0 : 1.5 + st.danger * 5;
    const x = 240 + randFloat(-shake, shake), y = 180 + randFloat(-shake, shake);
    // the outline: it turns red when the head is out of it, and blinks bright on each tap
    draw(ctx, pic("Stare", st.out && !st.won ? "ring-red" : "ring"), x, y,
      { size: st.ring * 100, alpha: st.won ? 1 - st.won / 0.7 : 1, bright: st.pump * 25 });
    draw(ctx, pic("Stare", "head"), x, y, { size: st.s * 100, bright: -st.danger * 20 });
    if (st.won) return;
    // red closing in as he gets closer to getting you
    if (st.danger > 0) {
      const g = ctx.createRadialGradient(240, 180, 90, 240, 180, 300);
      g.addColorStop(0, "rgba(200,0,0,0)");
      g.addColorStop(1, "rgba(200,0,0," + (0.75 * st.danger) + ")");
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, 360);
    }
    // how long is left (a bar filling up along the bottom)
    ctx.fillStyle = "#300"; ctx.fillRect(140, 322, 200, 6);
    ctx.fillStyle = "#e00"; ctx.fillRect(140, 322, 200 * Math.min(1, st.t / st.need), 6);
    if (st.t < 1.6 || st.out) {
      const msg = st.out ? (st.s / st.ring < 1 ? W("Stare", "TAP!") : W("Stare", "TOO BIG!")) : W("Stare", "TAP TO KEEP HIM IN THE SHAPE");
      this.text(ctx, msg, 240, 30, { size: 16, align: "center", font: "Press Start 2P", color: st.out ? "#ff3030" : "#fff", shadow: "#000" });
    }
  }

  /* --------------------------------------------------------------
     SOMEONE IN THE OFFICE
     They come in while the cameras are up. When you put the monitor
     down, the lights flicker and you have a moment to put on the mask.
     Keep it on until they leave.
     -------------------------------------------------------------- */
  updateVisit() {
    const n = this.n, v = n.visit;
    if (!v) return;
    if (!v.started) {
      // waiting for you to put the monitor down (they pull it down after a while)
      v.t += TICK;
      if (v.t > 7 && n.camsUp) this.forceMonitorDown();
      if (!n.monitorUp && !n.monitorFrame) { v.started = true; v.t = 0; this.officeFlicker(true); }
      return;
    }
    v.t += TICK;
    const grace = this.level <= 2 ? 1.6 : 1.1;
    if (n.maskUp && n.maskFrame === 0) {
      v.masked += TICK;
      if (v.masked > (v.leaveAt || (v.leaveAt = randFloat(3, 5.5)))) {
        // they give up and go back
        n.at[v.who] = "gone";
        const who = v.who;
        n.visit = null;
        this.officeFlicker(false);
        this.unlock("mask");
        this.scripts.run("night", function* () { yield 5; if (this.n && n.at[who] === "gone") this.sendBack(who); }.call(this));
      }
      return;
    }
    if (v.masked > 0 && !n.maskUp) return this.jumpscare(v.who);     // took the mask off too early
    if (v.t > grace) this.jumpscare(v.who);
  }
  officeFlicker(on) {
    const sp = this.sp;
    if (on) { sp.flicker.setVolume(100); sp.flicker.play("Light Left", "ComputerInteriorLong_EVL02_2"); }
    else { sp.flicker.stopAll(); sp.flicker.play("Sprite21", "recording1"); }
  }

  /* --------------------------------------------------------------
     THE PUPPET: the music box (camera 11) winds down all night.
     Hold the button on camera 11 to wind it back up.
     -------------------------------------------------------------- */
  updateMusicBox() {
    const n = this.n;
    if (n.puppet > 0) return;
    const ai = n.ai.puppet;
    const secondsToEmpty = 150 - ai * 5;
    n.musicBox -= TICK / secondsToEmpty;
    // the tune plays only while you watch camera 11
    this.sp.musicbox.setVolume(n.camsUp && n.cam === 11 ? 35 : 0);
    if (n.musicBox <= 0) { n.musicBox = 0; this.puppetComes(); }
  }
  windMusicBox() {
    const n = this.n;
    if (n.puppet > 0) return;
    n.musicBox = Math.min(1, n.musicBox + TICK / 2.2);
    if (this.tick % 9 === 0) this.sp.windup.play("Wind up", "windup2");
    if (n.musicBox === 1) this.unlock("wound");
  }
  puppetComes() {
    const n = this.n, sp = this.sp;
    n.puppet = 1;
    sp.musicbox.stopAll();
    sp.jack.setVolume(5);
    sp.jack.play("Sprite27", "jackinthebox");
    this.scripts.run("puppet", function* () {
      for (let i = 0; i < 10; i++) { sp.jack.setVolume(5 + i * 2); yield 0.25; }
      n.puppet = 2;
      for (let i = 0; i < 10; i++) { sp.jack.setVolume(25 + i * 7); yield 0.4; }
      n.puppet = 3;
      sp.jack.setVolume(100);
      yield randFloat(6, 14);
      n.puppet = 4;
      if (n.camsUp) this.forceMonitorDown();
      this.jumpscare("puppet");
    }.call(this));
  }

  /* --------------------------------------------------------------
     GOLDEN EDDIE (rare): a head in the hallway, or slumped in the
     office when you put the monitor down. In the office: put the mask
     on or pick the monitor back up, fast.
     -------------------------------------------------------------- */
  rollGolden() {
    const n = this.n;
    const ai = n.ai.golden;
    const odds = ai > 0 ? Math.max(4, 60 - ai * 3) : Math.max(1, Math.round(this.goldenRate));
    if (n.golden || this.level < 3 && ai <= 0) return;
    if (rand(1, odds) === 1) {
      n.golden = "office";
      n.goldenTimer = 1.6;
      this.unlock("golden");
    }
  }
  updateGolden() {
    const n = this.n;
    if (n.golden !== "office") return;
    if (n.maskUp || n.camsUp) { n.golden = null; return; }
    n.goldenTimer -= TICK;
    if (n.goldenTimer <= 0) { n.golden = null; this.jumpscare("golden"); }
  }

  /* --------------------------------------------------------------
     THE MASK (bottom-left bar, or Q)
     -------------------------------------------------------------- */
  toggleMask() {
    const n = this.n;
    if (n.monitorUp || n.monitorFrame || n.maskFrame) return;
    n.maskUp = !n.maskUp;
    this.sp.mask.play("Sprite4", n.maskUp ? "mask.show" : "mask.hide");
    const up = n.maskUp;
    this.scripts.run("mask", function* () {
      for (let f = 1; f <= 6; f++) { n.maskFrame = up ? f : 7 - f; yield; }
      n.maskFrame = 0;
    }.call(this));
  }

  /* --------------------------------------------------------------
     THE MONITOR (bottom-right bar, or E)
     -------------------------------------------------------------- */
  toggleMonitor() {
    const n = this.n;
    if (n.maskUp || n.maskFrame || n.monitorFrame) return;
    if (!n.monitorUp) this.raiseMonitor(); else this.lowerMonitor();
  }
  raiseMonitor() {
    const n = this.n;
    n.monitorUp = true;
    this.sp.flip.play("Sprite5", "Cam Up");
    this.rollGolden();
    if (n.golden === "office") n.golden = null;     // he only shows when you put it down
    this.scripts.run("monitor", function* () {
      for (let f = 1; f <= 11; f++) { n.monitorFrame = f; yield; }
      n.monitorFrame = 0;
      n.camsUp = true;
      n.switchFx = 1;
      this.seeCam(n.cam);
    }.call(this));
  }
  lowerMonitor() {
    const n = this.n;
    const wasUp = n.camsUp;
    n.monitorUp = false;
    n.camsUp = false;
    this.scripts.stop("monitor");
    this.sp.flip.play("Sprite5", "Cam down");
    this.scripts.run("monitor", function* () {
      for (let f = wasUp ? 11 : n.monitorFrame; f >= 1; f--) { n.monitorFrame = f; yield; }
      n.monitorFrame = 0;
      this.afterMonitorDown();
    }.call(this));
  }
  forceMonitorDown() { if (this.n.monitorUp) this.lowerMonitor(); }
  afterMonitorDown() {
    const n = this.n;
    // Golden Eddie might be sitting there now
    if (!n.visit && chance(3)) this.rollGolden();
    // Meyg might drop down
    if (n.mangleIn && n.mangleAttack <= 0 && chance(3)) this.jumpscare("mangle");
  }

  /* --------------------------------------------------------------
     THE CAMERAS
     -------------------------------------------------------------- */
  switchCam(c) {
    const n = this.n;
    if (n.cam === c) return;
    n.cam = c;
    n.switchFx = 1;
    this.seeCam(c);
  }
  seeCam(c) {
    const n = this.n;
    n.camsSeen.add(c);
    if (n.camsSeen.size === 12) this.unlock("cams");
  }
  camGlitch() { this.n.switchFx = 1; }

  /* --------------------------------------------------------------
     EVERY UPDATE OF THE NIGHT
     -------------------------------------------------------------- */
  updateNight() {
    const n = this.n, m = this.mouse;
    if (n.frozen) return;
    if (n.jumpscare) return this.updateJumpscare();
    if (n.stare) return this.updateStare();          // Withered Endo's stare: the night waits
    this.updateClock();
    if (n.frozen || this.screen !== "night") return;

    // looking around the office (mouse near the edges)
    if (!n.camsUp && !n.monitorFrame && !n.maskUp) {
      const dx = m.x - 240;
      let pan = this.smooth.get("pan");
      const speed = Math.abs(dx) > 150 ? 15 : Math.abs(dx) > 70 ? 6 : 0;
      pan = clamp(pan - Math.sign(dx) * speed, -95, 95);
      this.smooth.set("pan", pan);
    }

    this.updateBars();
    this.updateLights();
    this.updateCharacters();
    this.updateVisit();
    this.updateMusicBox();
    this.updateGolden();
    this.updatePhone();
    this.updateNightSounds();
    if (n.mangleIn) n.mangleAttack -= TICK;
    n.switchFx = Math.max(0, n.switchFx - 0.08);
    n.maskTime = n.maskUp ? n.maskTime + TICK : 0;

    // Toy Cheddy slides past while the mask is on
    if (n.visit && n.visit.who === "tbonnie" && n.visit.started && n.maskUp) n.slide = Math.min(1, n.slide + TICK / 2.5);
    else n.slide = 0;

    for (const c of this.clicks) this.nightClick(c.x, c.y);
    for (const k of this.keys) {
      if (k === "mask") this.toggleMask();
      if (k === "cams") this.toggleMonitor();
    }
  }

  // The two bars at the bottom: move the mouse over them (move off and back to use again)
  updateBars() {
    const n = this.n, m = this.mouse;
    const onMask = m.y > SY(-150) && m.x > SX(-240) && m.x < SX(-5);
    const onCams = m.y > SY(-150) && m.x > SX(5) && m.x < SX(240);
    if (m.y < SY(-140)) { n.maskArmed = true; n.monitorArmed = true; }
    if (onMask && n.maskArmed && !n.camsUp) { n.maskArmed = false; this.toggleMask(); }
    if (onCams && n.monitorArmed && !n.maskUp) { n.monitorArmed = false; this.toggleMonitor(); }
  }

  // Flashlight and vent lights (they need battery, and BB in the office breaks them)
  updateLights() {
    const n = this.n, m = this.mouse;
    const ok = n.battery > 0 && !n.bbIn;
    const pan = this.smooth.get("pan");
    const office = !n.camsUp && !n.monitorFrame && !n.maskUp && !n.maskFrame;
    // vent light buttons (hold them) or A / D
    const onLeft = m.down && hits(pic("Light Left", "0"), SX(pan - 300), SY(-15), 65, m.x, m.y);
    const onRight = m.down && hits(pic("Right Right", "0"), SX(pan + 300), SY(-15), 65, m.x, m.y);
    const ventL = office && ok && (onLeft || this.held.has("left"));
    const ventR = office && ok && !ventL && (onRight || this.held.has("right"));
    // flashlight: SPACE / F / Ctrl, or click and hold on the room (not on a button or bar)
    const mouseLight = m.down && !onLeft && !onRight && m.y < SY(-140) && !this.onPhone(m.x, m.y);
    const want = this.held.has("flash") || mouseLight;
    const hall = office && ok && want && !ventL && !ventR;
    if (hall && !n.flash) {
      this.flashedHall();
      if (this.level >= 3 && !n.golden && chance(45)) n.golden = "hall";
    }
    if (!hall && n.golden === "hall") n.golden = null;
    n.flash = hall;
    n.ventL = ventL; n.ventR = ventR;
    // on the cameras the flashlight lights up the room
    n.camFlash = n.camsUp && ok && want && !this.onMap(m.x, m.y);
    const on = n.flash || n.ventL || n.ventR || n.camFlash;
    if (on) n.battery = Math.max(0, n.battery - TICK * (this.level >= 5 ? 1.2 : 1));
    if (n.flash) n.hallFlicker = (n.foxy.hall || Object.values(n.at).includes("hall")) && chance(5);
    else n.hallFlicker = false;
    // the music box button on camera 11
    n.winding = n.camsUp && n.cam === 11 && m.down && hits(pic("Wind up", "Wind up0"), SX(-10), SY(-90), 100, m.x, m.y);
    if (n.winding) this.windMusicBox();
  }
  onPhone(x, y) {
    const pb = this.phoneBox();
    return this.n.phone !== "off" && x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h;
  }
  onMap(x, y) {
    if (!this.n.camsUp) return false;
    if (x > 280 && y > 170) return true;                                          // the map
    if (this.n.cam === 11 && hits(pic("Wind up", "Wind up0"), SX(-10), SY(-90), 100, x, y)) return true;
    return false;
  }

  updateNightSounds() {
    const n = this.n, sp = this.sp;
    sp.fan.setVolume(n.camsUp ? 10 : n.maskUp ? 15 : 25);
    sp.breath.setVolume(n.maskUp ? 70 : 0);
    // radio static when Meyg is close
    const m = n.at.mangle;
    sp.radio.setVolume(n.mangleIn ? 45 : m === "hall" || m === "ventR" ? 30 : m === 6 ? 15 : (n.camsUp && n.cam === m) ? 10 : 0);
  }

  nightClick(x, y) {
    const n = this.n;
    if (this.onPhone(x, y)) { this.phoneTap(); return; }
    if (n.camsUp) {
      for (const [k, r] of Object.entries(MAP_BUTTONS)) {
        const bx = SX(139) + r[0] * 0.45, by = SY(-73) + r[1] * 0.45;
        if (x >= bx - 2 && x <= bx + r[2] * 0.45 + 2 && y >= by - 2 && y <= by + r[3] * 0.45 + 2) { this.switchCam(Number(k)); return; }
      }
      return;
    }
    if (n.maskUp || n.monitorFrame) return;
    // honk the nose on the poster (top left wall)
    const pan = this.smooth.get("pan");
    if (Math.hypot(x - (SX(pan) - 303), y - 104) < 14) { this.sp.honk.play("Sprite21", "PartyFavorraspyPart_AC01__3"); this.unlock("honk"); }
  }

  /* =================================================================
     JUMPSCARES, DEATH, 6 AM
     ================================================================= */
  jumpscare(who) {
    const n = this.n;
    if (n.jumpscare || n.frozen) return;
    this.scripts.stop("night", "puppet", "ring", "phone", "monitor", "mask");
    n.phone = "off";
    n.halluc = null;
    n.maskUp = false; n.maskFrame = 0;
    n.monitorUp = n.camsUp = false; n.monitorFrame = 0;
    this.killer = who;
    this.caughtBy(who);
    Sound.stopAll();
    if (who === "golden") return this.goldenCrash();
    if (settings.jumpscares !== "1") return this.dead();
    this.sp.scream.play("Sprite27", "Xscream2");
    n.jumpscare = { who, frames: SCARE_FRAMES(who), i: 0 };
  }
  updateJumpscare() {
    const j = this.n.jumpscare;
    if (this.tick % 2 === 0) j.i++;
    if (j.i >= j.frames + 4) { this.n.jumpscare = null; this.dead(); }
  }

  // The VHS STOP screen and the survival guide (vhs.js, guide.js),
  // then (sometimes) a strange little 8-bit game, then the title
  dead() {
    this.died = true;
    this.go("black");
    Sound.stopAll();
    this.scripts.run("dead", function* () {
      yield* this.playGuide(this.killer);
      // 1 in 3 deaths go to a minigame, picked by who caught you
      if (chance(3)) return this.startMinigame(MINIGAME_FOR[this.killer]);
      const over = this.overlay(null, null, { fade: 0, paint: ctx => this.text(ctx, W("Game over", "GAME OVER"), 470, 350,
        { size: 20, align: "right", font: "Press Start 2P" }) });
      yield* this.fade(over, 1, 20);
      yield 3;
      this.showTitle();
    }.call(this));
  }

  // Golden Eddie: no jumpscare, the game just shuts down
  goldenCrash() {
    this.go("black");
    Sound.stopAll();
    this.sp.scream.play("Sprite27", "Xscream2");
    if (settings.jumpscares === "1") this.overlay(null, null, { paint: ctx => drawScare(ctx, "golden", 0) });
    this.scripts.run("crash", function* () {
      yield 1.2; Sound.stopAll(); this.layers = []; yield 2;
      yield* this.playGuide("golden");
      this.showTitle();
    }.call(this));
  }

  // The blue VHS screen: STOP, then the guide's slides for `who` (until EJECT or SKIP)
  *playGuide(who) {
    const g = new VhsGuide(CAST[who] ? CAST[who].name : who, deathGuide(who));
    this.sp.blip.play("Sprite10", "COMPUTER_DIGITAL_L2076605");
    this.sp.vhs.play("VHS", "Self", { loop: true });
    const L = this.overlay(null, null, { paint: ctx => g.draw(ctx) });
    yield () => g.step(this.clicks, this.keys);
    this.sp.vhs.stopAll();
    this.removeOverlay(L);
  }

  sixAM() {
    const n = this.n;
    this.scripts.stop("night", "puppet", "ring", "phone", "monitor", "mask");
    n.frozen = true; n.phone = "off"; n.halluc = null;
    this.smooth.jump("phoneShow", 0);
    Sound.stopAll();
    this.died = false;
    this.sp.chime.play("Ambience", "Chimes");
    const card = this.overlay(null, null, { fade: 0, paint: (ctx, a) => {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 480, 360);
      const k = this.smooth.at("roll", a) || 0;         // the 5 rolls up into a 6
      ctx.save();
      ctx.beginPath(); ctx.rect(150, 150, 70, 50); ctx.clip();
      this.text(ctx, "5", 210, 196 - k * 46, { size: 40, align: "right", font: "Press Start 2P" });
      this.text(ctx, "6", 210, 242 - k * 46, { size: 40, align: "right", font: "Press Start 2P" });
      ctx.restore();
      this.text(ctx, "AM", 230, 196, { size: 40, font: "Press Start 2P" });
    } });
    this.smooth.jump("roll", 0);
    this.scripts.run("6am", function* () {
      yield* this.fade(card, 1, 30);
      yield 1.5;
      for (let t = 0; t <= 1; t += TICK / 2) { this.smooth.set("roll", t); yield; }
      this.smooth.set("roll", 1);
      this.sp.chime.play("Ambience", "CROWD_SMALL_CHIL_EC049202");
      yield 4;
      yield* this.fade(card, 0, 30);
      this.nightWon();
    }.call(this));
    this.scripts.run("6am", function* () { yield 1; if (this.screen === "night") this.screen = "black"; }.call(this));
  }

  nightWon() {
    const L = this.level, n = this.n;
    if (L <= 6) this.unlock("night" + L);
    if (n && n.battery >= 50) this.unlock("battery");
    if (L < 5) { this.level = L + 1; return this.startIntro(); }
    if (L === 5) { this.progress.beat5 = true; this.progress.night = 5; return this.ending("paycheck"); }
    if (L === 6) { this.progress.beat6 = true; return this.ending("check2"); }
    // custom night: the preset's prize
    const p = PRESETS[this.presetIndex || 0];
    if (p.prize === "star") { this.progress.beat420 = true; this.unlock("max"); }
    else if (p.prize && !this.progress.prizes.includes(p.prize)) this.progress.prizes.push(p.prize);
    if (p.prize) this.unlock("prize");
    if (this.progress.prizes.length >= 9) this.unlock("allprizes");
    return this.ending("pinkslip");
  }

  // The paycheck / bonus / pink slip, with the end song
  ending(name) {
    this.save();
    this.go("black");
    this.sp.music.play("Sprite19", "FNAF 2 - Win Music-Lullaby Waltz (End Of The Game).mp3");
    const card = this.overlay(null, null, { fade: 0, paint: ctx => this.drawEnding(ctx, name) });
    this.scripts.run("ending", function* () {
      yield* this.fade(card, 1, 30);
      yield 2;
      let t = 0;
      yield () => (t += TICK) > 25 || this.clicks.length > 0;
      yield* this.fade(card, 0, 30);
      this.showTitle();
    }.call(this));
  }
  updateCard() {}

  /* =================================================================
     NEWSPAPER AND ENDING CARDS (drawn by the game, with the new cast)
     ================================================================= */
  // A character standing with its feet at (x, y), `h` game pixels tall
  drawChar(ctx, who, x, y, h, o = {}) {
    drawActor(ctx, who, [x - h, y - h, x + h, y], { mode: "body", still: true, alpha: o.alpha, shade: addShade(0, o.bright), rot: o.turn });
  }
  // Old newspaper paper with fake columns of text
  drawPaper(ctx, x, y, w, h, tilt) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate(tilt); ctx.translate(-w / 2, -h / 2);
    ctx.fillStyle = "#cfcbc0"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(60,60,60,0.25)";
    for (let yy = 8; yy < h - 4; yy += 6) for (let xx = 6; xx < w - 20; xx += 70) ctx.fillRect(xx, yy, 58 - (yy * 7 + xx) % 23, 2);
    ctx.restore();
  }
  // The toys posing for a photo (black and white)
  drawPhoto(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = "#5c5c5c"; ctx.fillRect(x, y, w, h);
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.filter = "grayscale(1) contrast(1.1)";
    this.drawChar(ctx, "tbonnie", x + w * 0.22, y + h + 4, h * 0.95);
    this.drawChar(ctx, "tchica", x + w * 0.78, y + h + 4, h * 0.92);
    this.drawChar(ctx, "tfreddy", x + w * 0.5, y + h + 6, h * 1.02);
    ctx.restore();
  }
  drawNewspaper(ctx) {
    // Aidan's newspaper ad, on paper of the same grey
    ctx.fillStyle = "#cacaca"; ctx.fillRect(0, 0, 480, 360);
    draw(ctx, pic("Newspaper", "page"), 240, 180);
  }
  // (the old drawn newspaper, not used any more)
  drawOldNewspaper(ctx) {
    this.drawPaper(ctx, -20, -20, 520, 400, 0);
    this.drawPaper(ctx, 70, 30, 340, 320, -0.02);
    const C = { font: "Courier Prime" };
    ctx.save();
    ctx.translate(240, 190); ctx.rotate(-0.02); ctx.translate(-240, -190);
    ctx.fillStyle = "#111"; ctx.fillRect(80, 52, 320, 40);
    this.text(ctx, W("Newspaper", "HELP WANTED"), 240, 82, { ...C, size: 30, align: "center", color: "#eee" });
    this.text(ctx, W("Newspaper", "Grand Re-Opening!!!"), 240, 116, { ...C, size: 17, align: "center", color: "#111" });
    this.drawPhoto(ctx, 92, 130, 180, 180);
    const lines = [W("Newspaper", "Old rice shop"), W("Newspaper", "given new life!"), "", W("Newspaper", "Come be a part of"),
      W("Newspaper", "the new face of"), W("Newspaper", "Fried Rice at Eddie's!"), "", W("Newspaper", "What could go wrong?"), "",
      W("Newspaper", "$100.50 a week!"), W("Newspaper", "To apply call:"), W("Newspaper", "1-555-EDDIES")];
    lines.forEach((s, i) => this.text(ctx, s, 336, 146 + i * 13, { ...C, size: 9.5, align: "center", color: "#111" }));
    ctx.restore();
    // the red circle someone drew around it
    ctx.save();
    ctx.strokeStyle = "rgba(210,20,20,0.9)"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.ellipse(242, 190, 205, 165, -0.08, 0.15, Math.PI * 1.98); ctx.stroke();
    ctx.restore();
  }
  // A check: color, words and where it sits
  drawCheck(ctx, x, y, w, h, tilt, color, words) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt);
    ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = color; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
    const C = { font: "Courier Prime", color: "#223" };
    this.text(ctx, "142", w / 2 - 14, -h / 2 + 18, { ...C, size: 9, align: "right" });
    this.text(ctx, words.date, w / 2 - 50, -h / 2 + 32, { ...C, size: 9 });
    this.text(ctx, W("Endings", "PAY TO THE ORDER OF") + "  " + W("Endings", "Night Guard"), -w / 2 + 12, -h / 2 + 50, { ...C, size: 9 });
    this.text(ctx, "$ " + words.amount, w / 2 - 14, -h / 2 + 50, { ...C, size: 10, align: "right" });
    this.text(ctx, words.spelled, -w / 2 + 12, -h / 2 + 68, { ...C, size: 9 });
    this.text(ctx, W("Endings", "Fried Rice at Eddie's"), w / 2 - 14, h / 2 - 30, { ...C, size: 10, align: "right" });
    this.text(ctx, words.memo, -w / 2 + 12, h / 2 - 12, { ...C, size: 10 });
    ctx.restore();
  }
  drawEnding(ctx, name) {
    const theEnd = () => this.text(ctx, W("Endings", "THE END"), 462, 340, { size: 22, align: "right", font: "Courier Prime", weight: "bold", shadow: "#000" });
    if (name === "paycheck") {
      const g = ctx.createLinearGradient(0, 0, 0, 360);
      g.addColorStop(0, "#8a4a5a"); g.addColorStop(1, "#3a1a2a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 480, 360);
      ctx.save(); ctx.globalAlpha = 0.85;
      this.drawChar(ctx, "tbonnie", 95, 372, 300, { bright: -15 });
      this.drawChar(ctx, "tchica", 385, 372, 290, { bright: -15 });
      this.drawChar(ctx, "tfreddy", 240, 378, 320, { bright: -10 });
      ctx.restore();
      this.drawCheck(ctx, 240, 190, 260, 125, -0.04, "#dff1df",
        { date: "11-12-1987", amount: "100.50", spelled: W("Endings", "One hundred dollars and 50/100"), memo: W("Endings", "Welcome to the family!") });
      return theEnd();
    }
    if (name === "check2") {
      this.drawPaper(ctx, -20, -20, 520, 400, 0);
      ctx.fillStyle = "#111"; ctx.fillRect(0, 10, 360, 48);
      this.text(ctx, W("Endings", "ROBOTS SCRAPPED"), 180, 48, { font: "Courier Prime", size: 34, align: "center", color: "#eee" });
      this.text(ctx, W("Endings", "Fried Rice at Eddie's is Closing"), 20, 84, { font: "Courier Prime", size: 15, color: "#111" });
      this.drawPhoto(ctx, 20, 100, 220, 200);
      const lines = [W("Endings", "After being open only"), W("Endings", "a few short weeks,"), W("Endings", "Fried Rice at Eddie's"),
        W("Endings", "is closing its doors."), "", W("Endings", "The new characters"), W("Endings", "will be scrapped, but"),
        W("Endings", "the old ones are being"), W("Endings", "kept for later..."), "", W("Endings", "It's a minor setback.")];
      lines.forEach((s, i) => this.text(ctx, s, 360, 112 + i * 14, { font: "Courier Prime", size: 10, align: "center", color: "#111" }));
      this.drawCheck(ctx, 215, 245, 250, 115, 0.12, "#f2c4d6",
        { date: "11-13-1987", amount: "20.10", spelled: W("Endings", "Twenty dollars and 10/100"), memo: W("Endings", "Overtime") });
      return theEnd();
    }
    // pink slip (custom night)
    ctx.fillStyle = "#1c2244"; ctx.fillRect(0, 0, 480, 360);
    ctx.save(); ctx.globalAlpha = 0.45;
    this.drawChar(ctx, "wbonnie", 80, 380, 360, { bright: -30 });
    this.drawChar(ctx, "wchica", 400, 380, 350, { bright: -30 });
    this.drawChar(ctx, "wfreddy", 240, 390, 390, { bright: -30 });
    ctx.restore();
    const word = W("Endings", "GREAT!!"), colors = ["#ff8fd0", "#ffe26a", "#9fd3ff", "#8dff8d", "#ffb36b", "#ff8fd0", "#8ff0ff"];
    ctx.save();
    ctx.font = 'bold 64px "Serif"';
    ctx.textBaseline = "alphabetic";
    let x = 240 - ctx.measureText(word).width / 2;
    [...word].forEach((ch, i) => {
      ctx.fillStyle = "#000"; ctx.fillText(ch, x + 3, 113);
      ctx.fillStyle = colors[i % colors.length]; ctx.fillText(ch, x, 110);
      x += ctx.measureText(ch).width;
    });
    ctx.restore();
    this.text(ctx, W("Endings", "(Now get out.)"), 240, 136, { font: "Serif", size: 15, align: "center", shadow: "#000" });
    ctx.save();
    ctx.translate(250, 210); ctx.rotate(0.35);
    ctx.fillStyle = "#f28cb4"; ctx.fillRect(-60, -42, 120, 84);
    this.text(ctx, W("Endings", "PINK SLIP"), 0, -18, { font: "Serif", size: 16, align: "center", color: "#401020", weight: "bold" });
    for (let i = 0; i < 4; i++) { ctx.fillStyle = "rgba(64,16,32,0.4)"; ctx.fillRect(-48, -4 + i * 9, 96 - i * 14, 2); }
    ctx.restore();
    const R = { font: "Serif", size: 12, shadow: "#000" };
    this.text(ctx, W("Endings", "You're fired."), 26, 270, R);
    this.text(ctx, W("Endings", "Reasons:"), 26, 298, R);
    this.text(ctx, W("Endings", "-Tampering with the characters"), 26, 316, R);
    this.text(ctx, W("Endings", "-Odor"), 26, 334, R);
    theEnd();
  }

  /* =================================================================
     CUSTOM NIGHT ("It's still dark.")
     ================================================================= */
  showCustom() {
    this.go("custom");
    if (!this.customPick) this.customPick = this.progress.custom ? [...this.progress.custom] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.presetIndex = this.presetIndex || 0;
    this.smooth.jump("customFade", 0);
    this.customHold = 0;
    this.scripts.run("custom", function* () {
      for (let i = 1; i <= 30; i++) { this.smooth.set("customFade", i / 30); yield; }
    }.call(this));
  }
  // where each portrait card is
  customCard(i) {
    const col = i % 5, row = Math.floor(i / 5);
    return { x: 24 + col * 88, y: 46 + row * 128, w: 80, h: 118 };
  }
  updateCustom() {
    const m = this.mouse;
    const preset = PRESETS[this.presetIndex];
    // hold an arrow: the number keeps changing every 0.12 s
    const now = this.tick * TICK;
    if (m.down) {
      if (!this.customDown) { this.customDown = true; this.customFresh = true; }      // a new press
      this.customHold -= TICK;
      if (this.customHold <= 0) {
        for (let i = 0; i < 10; i++) {
          const c = this.customCard(i), y = c.y + c.h - 14;
          if (m.y < y - 9 || m.y > y + 9) continue;
          const delta = m.x > c.x && m.x < c.x + 22 ? -1 : m.x > c.x + c.w - 22 && m.x < c.x + c.w ? 1 : 0;
          if (!delta) continue;
          if (preset.ai) { this.presetIndex = 0; }          // touching a number goes back to Custom
          // past the end wraps round (< on 0 -> 20, > on 20 -> 0), but only for one calm press:
          // not while holding the button down, and not when it is being spammed
          const next = this.customPick[i] + delta;
          const calm = this.customFresh && now - (this.customLastPress ?? -9) > 0.4;
          if ((next < 0 || next > 20) && calm) this.customPick[i] = next < 0 ? 20 : 0;
          else this.customPick[i] = clamp(next, 0, 20);
          this.customLastPress = now;
          this.customHold = 0.12;
          this.blip();
        }
        this.customFresh = false;
      }
    } else { this.customHold = 0; this.customDown = false; }
    this.backHover = m.x < 70 && m.y < 30;
    for (const c of this.clicks) {
      if (this.backHover) { this.blip(); return this.showTitle(); }
      // preset arrows (bottom left)
      if (c.y > 316 && c.y < 342) {
        if (c.x > 20 && c.x < 40) this.setPreset(-1);
        if (c.x > 200 && c.x < 222) this.setPreset(1);
        if (c.x > 380 && c.x < 462) return this.startCustomNight();
      }
    }
    for (const k of this.keys) {
      if (k === "enter") return this.startCustomNight();
      if (k === "left" || k === "right") this.setPreset(k === "left" ? -1 : 1);
    }
  }
  setPreset(d) {
    this.presetIndex = (this.presetIndex + d + PRESETS.length) % PRESETS.length;
    const p = PRESETS[this.presetIndex];
    if (p.ai) this.customPick = [...p.ai];
    else if (this.progress.custom) this.customPick = [...this.progress.custom];
    this.blip();
  }
  startCustomNight() {
    this.customAI = {};
    CUSTOM_ORDER.forEach((k, i) => { this.customAI[k] = this.customPick[i]; });
    if (!PRESETS[this.presetIndex].ai) { this.progress.custom = [...this.customPick]; this.save(); }
    this.level = 7;
    this.startIntro();
  }
  drawCustom(ctx, a) {
    const f = this.smooth.at("customFade", a);
    ctx.save();
    ctx.globalAlpha = f;
    this.text(ctx, W("Custom night", "Customize Night"), 240, 30, { size: 18, align: "center" });
    for (let i = 0; i < 10; i++) {
      const who = CUSTOM_ORDER[i], c = this.customCard(i);
      ctx.fillStyle = "#111"; ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
      // the portrait (clipped to the card)
      ctx.save();
      ctx.beginPath(); ctx.rect(c.x + 3, c.y + 3, c.w - 6, 70); ctx.clip();
      drawSpot(ctx, { ...HEAD_SPOT, role: who }, c.x + c.w / 2, c.y + 40, 100);
      // the red star over their right eye (as you look at them): invisible at 0, solid from 13 up
      const level = this.customPick[i], eye = EYE_SPOT[who];
      if (level > 0 && eye) draw(ctx, pic("Custom", "star"), c.x + c.w / 2 - 40 + eye[0], c.y + 40 - 35 + eye[1],
        { size: eye[2], alpha: Math.min(1, level / 13) });
      ctx.restore();
      this.text(ctx, CAST[who].name, c.x + c.w / 2, c.y + 86, { size: 8, align: "center", max: c.w - 6 });
      const y = c.y + c.h - 14;
      ctx.fillStyle = "#4a4a4a"; ctx.fillRect(c.x + 3, y - 8, 18, 16); ctx.fillRect(c.x + c.w - 21, y - 8, 18, 16);
      this.text(ctx, "<", c.x + 12, y + 4, { size: 12, align: "center" });
      this.text(ctx, ">", c.x + c.w - 12, y + 4, { size: 12, align: "center" });
      this.text(ctx, String(this.customPick[i]), c.x + c.w / 2, y + 5, { size: 14, align: "center" });
    }
    this.text(ctx, W("Custom night", "(0-2) easy   (3-6) med   (7-12) hard   (13-20) extreme"), 240, 310, { size: 8, align: "center", color: "#999" });
    // preset picker
    const p = PRESETS[this.presetIndex];
    ctx.fillStyle = "#f7931e"; ctx.fillRect(20, 318, 20, 22); ctx.fillRect(202, 318, 20, 22);
    this.text(ctx, "<", 30, 334, { size: 13, align: "center" });
    this.text(ctx, ">", 212, 334, { size: 13, align: "center" });
    this.text(ctx, p.name, 121, 334, { size: 13, align: "center", max: 155 });
    const won = p.prize === "star" ? this.progress.beat420 : p.prize && this.progress.prizes.includes(p.prize);
    if (won) draw(ctx, pic("Sprite29", "Gold_Star"), 236, 329, { size: 16 });
    ctx.fillStyle = "#666"; ctx.fillRect(380, 316, 82, 26);
    this.text(ctx, W("Custom night", "READY"), 421, 336, { size: 17, align: "center" });
    // < BACK
    ctx.fillStyle = this.backHover ? "#f7931e" : "#fff";
    ctx.beginPath(); ctx.moveTo(10, 15); ctx.lineTo(19, 8); ctx.lineTo(19, 22); ctx.closePath(); ctx.fill();
    this.text(ctx, ACH_WORD("BACK"), 24, 19, { size: 10, color: this.backHover ? "#f7931e" : "#fff" });
    ctx.restore();
  }

  /* =================================================================
     DRAWING THE NIGHT
     ================================================================= */
  drawNight(ctx, a) {
    const n = this.n;
    if (n.jumpscare) {
      const j = n.jumpscare;
      drawScare(ctx, j.who, Math.min(j.i, j.frames - 1));
      return;
    }
    const pan = this.smooth.at("pan", a);
    if (!n.camsUp) this.drawOffice(ctx, pan, a);
    else this.drawCams(ctx, a);
    // monitor flipping up or down
    if (n.monitorFrame) draw(ctx, picAt("Sprite5", n.monitorFrame), 240, 180);
    // the mask
    if (n.maskFrame) draw(ctx, picAt("Sprite4", n.maskFrame), 240, 180, { size: 150 });
    else if (n.maskUp) {
      const bob = Math.sin(this.tick / 9) * 3;
      draw(ctx, pic("Sprite3", "88"), SX(-15), SY(15) + bob, { size: 150 });
    }
    this.drawHud(ctx, a);
    if (n.halluc && !n.camsUp) {
      if (n.halluc === "bbEyes") drawSpot(ctx, EXTRA_SPOTS.bbEyes, SX(pan + 100), SY(-150), 50);
      else draw(ctx, pic("Sprite67", "costume1"), 240, 180);
    }
    if (n.stare) this.drawStare(ctx);
  }

  drawOffice(ctx, pan, a) {
    const n = this.n;
    const ox = SX(pan), oy = 180;
    // which light is on decides the office picture
    let base = "000";
    if (n.flash) base = "010";
    else if (n.ventL) base = "100";
    else if (n.ventR) base = "001";
    const v = n.visit && n.visit.started ? n.visit : null;
    // someone in the office: the lights flicker
    const flick = v && !n.maskUp ? (this.tick % 6 < 2 ? -85 : 0) : 0;
    const room = pic("Office", base), dim = n.hallFlicker ? -60 : flick;
    draw(ctx, room, ox, oy, { size: 150, bright: dim });
    // the new cast on the posters (darker when the hall light is off)
    inPicture(ctx, room, ox, oy, 150, () => {
      for (const s of ROOM_COVERS.office || []) drawActor(ctx, s.role, s.box, { ...s, still: true, shade: addShade(s.shade + (base === "010" ? 0 : 0.5), dim) });
    });
    // who is in the hall / at a vent (drawn by the game: see actors.js and poses.js)
    const pose = name => {
      const s = OFFICE_POSES[name];
      const kind = name.startsWith("hall") ? "hall" : name.startsWith("vent") ? "vent" : "creep";
      if (s) inPicture(ctx, room, ox, oy, 150, () => drawActor(ctx, name.split("-")[1], s.box, { kind, ...s, shade: addShade(s.shade, flick) }));
    };
    if (n.flash) {
      for (const [who, at] of Object.entries(n.at)) if (at === "hall") pose("hall-" + who);
      if (n.golden === "hall") pose("hall-golden");
    }
    if (n.ventL) {
      for (const [who, at] of Object.entries(n.at)) if (at === "ventL") pose("ventL-" + who);
      if (n.endo && n.at.bb !== "ventL") pose("ventL-endo");
    }
    if (n.ventR) for (const [who, at] of Object.entries(n.at)) if (at === "ventR") pose("ventR-" + who);
    if (v && v.who !== "tbonnie") pose("in-" + v.who);
    // (the desk and fan are part of Aidan's office picture now)
    // the prizes from the custom night, on the desk
    for (const prize of this.progress.prizes) {
      const p = PRIZE_SPOT[prize];
      if (!p) continue;
      if (PLUSH_ROLE[prize]) drawSpot(ctx, { ...PLUSH_SPOT, role: PLUSH_ROLE[prize] }, SX(pan + p[0]), SY(p[1]), 50);
      else if (hasPic("Plush", prize)) draw(ctx, pic("Plush", prize), SX(pan + p[0]), SY(p[1]), { size: 50 });
    }
    // others in the office
    if (n.bbIn) drawSpot(ctx, EXTRA_SPOTS.bb, SX(pan - 90), SY(-20), 65);
    if (n.mangleIn) drawSpot(ctx, EXTRA_SPOTS.mangle, SX(pan + 100), SY(120), 65);
    if (n.golden === "office") drawSpot(ctx, EXTRA_SPOTS.golden, SX(pan - 20), SY(-42), 75);
    if (n.shadow && !n.flash) drawSpot(ctx, EXTRA_SPOTS.shadow, SX(pan - 170), SY(0), 100, { alpha: 0.85 });
    if (v && v.who === "tbonnie") {
      // Toy Cheddy right in front of you; with the mask on Cheddy runs off across the room
      if (!n.maskUp) pose("in-tbonnie");
      else drawSpot(ctx, EXTRA_SPOTS.tbonnie, 620 - n.slide * 820, SY(25), 160, { shade: addShade(EXTRA_SPOTS.tbonnie.shade, flick) });
    }
    // vent light buttons
    draw(ctx, pic("Light Left", n.ventL ? "1" : "0"), SX(pan - 300), SY(-15), { size: 65 });
    draw(ctx, pic("Right Right", n.ventR ? "1" : "0"), SX(pan + 300), SY(-15), { size: 65 });
  }

  drawCams(ctx, a) {
    const n = this.n, c = n.cam;
    const group = "Cam" + c;
    const light = n.camFlash;
    const x = 240 + this.smooth.at("camPan", a);
    const room = pic(group, light ? "light" : "dark");
    draw(ctx, room, x, 180, { size: 150 });
    // the characters in the room (drawn by the game: see actors.js and poses.js).
    // Without the flashlight they are barely there.
    const spots = CAM_POSES[c] || {};
    const pose = name => {
      const s = spots[name];
      if (!s) return;
      const shade = light || s.same ? s.shade : Math.max(0.86, s.shade);
      // calm on the stage, creepy everywhere else
      const kind = c === 9 ? "stand" : c === 5 || c === 6 ? "vent" : c === 7 ? "hall" : "creep";   // (lying down in the vents, walking in the hall)
      inPicture(ctx, room, x, 180, 150, () => drawActor(ctx, s.role || name, s.box, { kind, ...s, shade }));
    };
    inPicture(ctx, room, x, 180, 150, () => {
      for (const s of ROOM_COVERS[c] || []) drawActor(ctx, s.role, s.box, { ...s, still: true, shade: Math.min(0.95, s.shade + (light ? 0 : 0.5)) });
    });
    for (const [who, at] of Object.entries(n.at)) if (at === c) pose(who);
    // the Puppet coming out of the box, and walking down the main hall
    if (c === 11 && n.puppet > 0) pose("puppet" + Math.min(3, n.puppet));
    if (c === 7 && n.puppet >= 3) pose("puppetwalk" + (1 + Math.floor(this.tick / 20) % 3));
    if (c === 8 && n.shadow && light) pose("shadow");
    if (c === 11 && n.endo && light && n.puppet === 0) pose("endo");
    // (no TV static on the cameras: a clean picture keeps the game smooth)
    // the map and its buttons
    draw(ctx, pic("Map", "map"), SX(139), SY(-73), { size: 45 });
    const r = MAP_BUTTONS[c];
    if (Math.floor(this.tick / 15) % 2 === 0)
      draw(ctx, pic("Map", "lit" + c), SX(139) + r[0] * 0.45, SY(-73) + r[1] * 0.45, { size: 45 });
    this.text(ctx, CAMS[c], 292, 178, { size: 12, shadow: "#000" });
    // music box controls on camera 11
    if (c === 11) {
      draw(ctx, pic("Wind up", n.winding ? "Wind up1" : "Wind up0"), SX(-10), SY(-90), { size: 100 });
      this.drawMusicPie(ctx, SX(-90), SY(-83) - 18, 14);
    }
    // red recording dot
    if (Math.floor(this.tick / 15) % 2 === 0) { ctx.fillStyle = "#e01010"; ctx.beginPath(); ctx.arc(28, 80, 6, 0, Math.PI * 2); ctx.fill(); }
  }

  // The music box timer: a white pie that empties (FNaF 2 style)
  drawMusicPie(ctx, x, y, r) {
    const v = this.n.musicBox;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawHud(ctx, a) {
    const n = this.n;
    // clock and night
    this.text(ctx, (n.hour === 0 ? 12 : n.hour) + " AM", 462, 36, { size: 20, align: "right", font: "Press Start 2P", shadow: "#000" });
    this.text(ctx, W("Office", "Night") + " " + this.level, 462, 52, { size: 10, align: "right", shadow: "#000" });
    // flashlight battery (4 bars)
    const bars = n.battery <= 0 ? 0 : Math.min(4, Math.ceil(n.battery / 25));
    draw(ctx, pic("Sprite12", String(bars)), SX(-215), SY(145), { size: 50 });
    // the two bars at the bottom (hidden while you use them)
    if (!n.camsUp && !n.monitorFrame && !n.maskFrame) draw(ctx, pic("Sprite2", "119"), SX(-120), SY(-165), { size: 50, alpha: n.maskUp ? 0.8 : 1 });
    if (!n.maskUp && !n.maskFrame && !n.monitorFrame) draw(ctx, pic("Sprite1", "95"), SX(120), SY(-165), { size: 50 });
    // music box warning (yellow, then red when almost empty)
    if (n.musicBox < 0.35 && n.puppet === 0 && Math.floor(this.tick / 8) % 2 === 0) {
      const red = n.musicBox < 0.15;
      if (n.camsUp) draw(ctx, pic("Sprite7", red ? "REDALERT!" : "Normal alert"), SX(-190), SY(-120), { size: 40 });
      else draw(ctx, pic("Sprite7", red ? "REDALERT!" : "Normal alert"), SX(205), SY(-61), { size: 25 });
    }
    this.drawPhone(ctx, a);
  }

  /* =================================================================
     DEBUG MODE: live numbers (Settings > Debug mode)
     ================================================================= */
  debugInfo() {
    const out = { screen: this.screen, level: this.level, scripts: this.scripts.list.length };
    const n = this.n;
    if (this.screen === "night" && n) {
      out.time = (n.hour === 0 ? 12 : n.hour) + " AM";
      out.battery = Math.round(n.battery) + "%";
      out["music box"] = Math.round(n.musicBox * 100) + "%" + (n.puppet ? " (Puppet " + n.puppet + ")" : "");
      out.view = n.camsUp ? "CAM " + n.cam : n.maskUp ? "mask" : "office";
      for (const k of Object.keys(PATHS)) out[CAST[k].name] = `${n.at[k]} (AI ${n.ai[k]})`;
      out[CAST.foxy.name] = n.foxy.hall ? `hall ${n.foxy.flashes}/${n.foxy.need} flashes, ${n.foxy.timer.toFixed(1)}s` : `8 (AI ${n.ai.foxy})`;
      if (n.visit) out["in office"] = CAST[n.visit.who].name + (n.visit.started ? "" : " (waiting)");
    }
    out["golden 1 in"] = this.goldenRate;
    out["3D models"] = Object.keys(Actors.models).map(r => CAST[r] ? CAST[r].name : r).join(", ") || "none (2D drawings)";
    return out;
  }
  debugSkipHour() { if (this.screen === "night" && this.n && !this.n.frozen) this.n.clock = 70 - TICK; }
  debugAddPower() { if (this.screen === "night" && this.n) { this.n.battery = 100; this.n.musicBox = 1; } }
}
