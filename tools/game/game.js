/* =====================================================================
   FRIED RICE AT EDDIE'S (game 1)
   The whole game, written as a normal browser game:
     - update() runs 30 times a second and moves the game forward
     - render() draws the current screen (as often as the screen allows)
     - "screens" (title, night, game over...) decide what is shown

   Short cutscenes (the 6 AM chime, the newspaper ad, the power going
   out) are written as small step-by-step scripts with `yield seconds`
   pauses. See the Scripts class below.

   Screen spots are in game pixels: (0, 0) is the top-left corner of
   the 480 x 360 game screen.
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

/* ---------------------------------------------------------------------
   Scripts: tiny step-by-step sequences
     scripts.run(function* () { ...; yield 2; ...; yield () => done; })
       yield 2          wait 2 seconds
       yield            wait one update
       yield () => x    wait until x is true
   Every script belongs to a "tag" so whole groups can be stopped at once
   (for example everything about the night stops when you die).
   --------------------------------------------------------------------- */
class Scripts {
  constructor() { this.list = []; }
  run(tag, gen) {
    const s = { tag, gen, wait: 0, until: null };
    this.list.push(s);
    return s;
  }
  stop(...tags) { this.list = this.list.filter(s => !tags.includes(s.tag)); }
  stopAll() { this.list = []; }
  has(tag) { return this.list.some(s => s.tag === tag); }
  update() {
    for (const s of [...this.list]) {
      if (!this.list.includes(s)) continue;              // stopped by another script this update
      if (s.wait > 0) { s.wait -= TICK; if (s.wait > 1e-9) continue; }
      if (s.until && !s.until()) continue;
      s.until = null;
      const r = s.gen.next();
      if (!this.list.includes(s)) continue;               // it stopped itself (changed screen)
      if (r.done) { this.list.splice(this.list.indexOf(s), 1); continue; }
      if (typeof r.value === "number") s.wait = r.value;
      else if (typeof r.value === "function") s.until = r.value;
    }
  }
}

/* ---------------------------------------------------------------------
   The cameras: button spot on the map and which room picture they show
   --------------------------------------------------------------------- */
const CAMERAS = [
  { button: "CAM1A", room: "Show Stage",     x: 367, y: 180 },
  { button: "CAM0",  room: "Entrance",       x: 415, y: 189 },
  { button: "CAM1B", room: "Dining Area",    x: 359, y: 203 },
  { button: "CAM1C", room: "Pirate Cove",    x: 349, y: 232 },
  { button: "CAM2A", room: "West Hall",      x: 366, y: 271 },
  { button: "CAM2B", room: "W. Hall Corner", x: 366, y: 287 },
  { button: "CAM3",  room: "Supply Closet",  x: 337, y: 266 },
  { button: "CAM4A", room: "East Hall",      x: 407, y: 271 },
  { button: "CAM4B", room: "E. Hall Corner", x: 407, y: 287 },
  { button: "CAM5",  room: "Backstage",      x: 320, y: 210 },
  { button: "CAM6",  room: "Kitchen",        x: 438, y: 261 },
  { button: "CAM7",  room: "Restrooms",      x: 445, y: 214 },
];
// room name -> picture group
const ROOM_ART = {
  "Show Stage": "Show Stage", "Entrance": "entrance", "Dining Area": "Dining Area",
  "Pirate Cove": "Pirate Cove", "West Hall": "West Hall", "W. Hall Corner": "west hall corner",
  "Supply Closet": "supply closet", "East Hall": "east hall", "E. Hall Corner": "east hall corner",
  "Backstage": "backstage", "Kitchen": "kitchen", "Restrooms": "restrooms",
};

// The phone handset icon (Material Design "call" icon, 24 x 24)
const PHONE_ICON = new Path2D("M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z");

// Starting difficulty (AI level 0-20) of each character on nights 1-6
const NIGHT_AI = {
  //        Eddie (Freddy)  Weddy (Bonnie)  Cheddy (Chica)  Endo (Foxy)
  1: { freddy: 0,             bonnie: 0,  chica: 0,  foxy: 0 },
  2: { freddy: 0,             bonnie: 3,  chica: 1,  foxy: 1 },
  3: { freddy: 1,             bonnie: 0,  chica: 5,  foxy: 2 },
  4: { freddy: () => rand(1, 3), bonnie: 2, chica: 4, foxy: 6 },
  5: { freddy: 3,             bonnie: 5,  chica: 7,  foxy: 5 },
  6: { freddy: 4,             bonnie: 10, chica: 12, foxy: 6 },
};

/* ---------------------------------------------------------------------
   Save files (stay after closing the page)
   There are 3 save files. The page address picks one: 1/?file=2
   Each file is kept in this browser's localStorage as "frae1-save-file2".
   --------------------------------------------------------------------- */
const SAVE_FILES = 3;
const saveKey = file => "frae1-save-file" + file;
const TAPE = 1;                                  // this tape's number (Story Mode)
const CAM_TIME_SPEED = 1.15;                     // the clock runs this much faster while the cameras are up

// The file number from the address (?file=1, 2 or 3), or null if it is missing or not 1-3
function fileFromUrl() {
  if (Story.on) return "story";                 // Story Mode keeps its own local file (frae1-save-filestory)
  const f = Number(new URLSearchParams(location.search).get("file"));
  return Number.isInteger(f) && f >= 1 && f <= SAVE_FILES ? f : null;
}

function loadProgress(file) {
  const p = { night: 1, beat5: false, beat6: false, beat420: false, started: false,
              achievements: {},   // achievement id -> when it was unlocked
              caughtBy: [],       // who has caught you (for "Full House")
              seen: [] };         // who you've met (the journal fills in their page)
  try {
    // the very first version had one save: it becomes file 1
    if (file === 1 && !localStorage.getItem(saveKey(1)) && localStorage.getItem("frae1-save"))
      localStorage.setItem(saveKey(1), localStorage.getItem("frae1-save"));
    const raw = localStorage.getItem(saveKey(file));
    if (raw) {
      const s = JSON.parse(raw);
      // (older saves used the Scratch variable names)
      p.night = Number(s.night ?? s.level ?? 1) || 1;
      p.beat5 = !!Number(s.beat5 ?? s["beat 5"] ?? 0);
      p.beat6 = !!Number(s.beat6 ?? s["beat 6"] ?? 0);
      p.beat420 = !!Number(s.beat420 ?? s["beat 420"] ?? 0);
      p.achievements = (s.achievements && typeof s.achievements === "object") ? s.achievements : {};
      p.caughtBy = Array.isArray(s.caughtBy) ? s.caughtBy : [];
      p.seen = Array.isArray(s.seen) ? s.seen : [];
      p.started = true;
      if (s.night === undefined) saveProgress(file, p);      // rewrite old saves in the new shape
    }
  } catch (e) { /* storage blocked: play without saving */ }
  return p;
}
function saveProgress(file, p) {
  try {
    localStorage.setItem(saveKey(file), JSON.stringify({ night: p.night, beat5: p.beat5, beat6: p.beat6, beat420: p.beat420,
                                                      achievements: p.achievements, caughtBy: p.caughtBy, seen: p.seen }));
    Cloud.saved(saveKey(file));                  // backed up to the account if signed in (tools/global.js)
  } catch (e) {}
}
function eraseProgress(file) { try { localStorage.removeItem(saveKey(file)); Cloud.erased(saveKey(file)); } catch (e) {} }

/* =====================================================================
   THE GAME
   ===================================================================== */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });   // no see-through canvas: cheaper to show
    this.scripts = new Scripts();
    this.smooth = new Smooth();
    this.file = 1;                  // which save file (picked on the file screen or by ?file=)
    this.progress = loadProgress(1);
    this.mouse = { x: 240, y: 180, down: false };
    this.clicks = [];               // clicks waiting to be handled this update
    this.keys = [];                 // key presses waiting to be handled this update
    this.goldenRate = 10000;        // 1 in this many monitor flips can show Golden (debug mode can change it)
    this.paused = false;            // settings screen open
    this.makeSpeakers();
    this.screen = "black";
    this.layers = [];               // full-screen pictures on top (endings, game over...)
  }

  /* ---------------------------------------------------------------
     Speakers (each one has its own volume, like the original sprites)
     --------------------------------------------------------------- */
  makeSpeakers() {
    const sp = v => Sound.speaker(v);
    this.sp = {
      music: sp(100),       // title song, night music, secret song
      blip: sp(100),        // menu blips
      vhs: sp(70),          // the song on the VHS death guide
      star: sp(5),          // rare circus music
      office: sp(25),       // fan buzz
      nose: sp(100),        // boop, window scare, error buzz
      fan: sp(100),         // power-out ambience
      lights: sp(0),        // light hum
      doors: sp(100),
      monitor: sp(0),       // tape eject
      flip: sp(0),          // monitor up / down
      power: sp(100),       // power down
      steps: sp(20),        // footsteps
      phone: sp(100),
      breath: sp(0),        // breathing when someone is in the office
      map: sp(0),           // danger ambience
      redDot: sp(0),        // kitchen music box
      black: sp(100),       // camera garble
      pirate: sp(5),        // pirate song
      westHall: sp(75),     // running, whispering
      corner: sp(100),      // girl laugh
      foxy: sp(100),        // door knock
      eddie: sp(40),        // laugh
      golden: sp(0),
      sixAm: sp(100),
      halluc: sp(0),
      kitchen: sp(0),       // oven clatter
      dance: sp(100),
      backdrop: sp(100),    // ending song
    };
  }

  /* ---------------------------------------------------------------
     Main loop pieces
     --------------------------------------------------------------- */
  update() {
    this.smooth.snapshot();
    this.tick = (this.tick || 0) + 1;
    if (!this.paused) {
      this.scripts.update();
      if (this.screen === "title") this.updateTitle();
      else if (this.screen === "custom") this.updateCustom();
      else if (this.screen === "night") this.updateNight();
      else if (this.screen === "secret") this.updateSecret();
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
    Global.smoothing(ctx);                 // picture quality from the menu's Settings ("fast" = low smoothing)
    if (this.screen === "title") this.drawTitle(ctx, a);
    else if (this.screen === "custom") this.drawCustom(ctx, a);
    else if (this.screen === "night") this.drawNight(ctx, a);
    else if (this.screen === "secret") this.drawSecret(ctx, a);
    // full-screen pictures on top (newspaper ad, game over, endings, 6 AM...)
    for (const L of this.layers) L.draw(ctx, a);
  }

  // Changes screen: stops every script and sound of the old one
  go(screen) {
    if (screen !== "night") ItemBar.show(false);          // item bar: nights only
    Pause.game = this;
    Pause.showButton(Pause.allowed(screen));              // II button: title, custom night and nights
    this.scripts.stopAll();
    this.layers = [];
    this.screen = screen;
    // a click or key that changed the screen is used up: it must not also land on the new screen
    this.clicks.length = 0;
    this.keys.length = 0;
  }

  // Adds a picture that covers the screen, with its own fade (0 = see-through, 1 = solid)
  overlay(group, name, o = {}) {
    const L = {
      pic: group ? pic(group, name) : null, x: o.x ?? 240, y: o.y ?? 180, size: o.size || 100, fade: o.fade ?? 1, key: "ov" + Math.random(),
      paint: o.paint,                   // optional: a drawing function instead of a picture (like Tape 2)
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

  // A script that fades an overlay in or out over 50 updates (like the original)
  *fade(L, to) {
    const from = L.fade;
    for (let i = 1; i <= 50; i++) { L.setFade(from + (to - from) * i / 50); yield; }
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

  /* =================================================================
     TITLE SCREEN
     ================================================================= */
  menuItems() {
    // top to bottom, like the original menu
    const items = [
      { id: "dine",     group: "dine in",      name: "text",   x: 88.23, y: 188.98, show: true },
      { id: "new",      group: "new game",     name: "text",   x: 105,   y: 210,    show: true },
      { id: "continue", group: "continue",     name: "text",   x: 105,   y: 235,    show: true },
      // Spooky (the 6th night) unlocks after beating nights 1-5; the custom night is always open
      // (parental "story mode only" hides both)
      { id: "night6",   group: "6th Night",    name: "string", x: 110,   y: 265,    show: this.progress.beat5 && !Global.storyOnly() },
      { id: "custom",   group: "Custom Night", name: "string", x: 125,   y: 290,    show: !Global.storyOnly() },
    ];
    // DEMO (before Oct 31, see Demo in global.js): only Dine In and Night 1
    if (Demo.on()) return items.filter(i => i.id === "dine" || i.id === "new");
    return items.filter(i => i.show);
  }

  // Switch to a save file (1-3)
  useFile(file) {
    this.file = file;
    this.progress = loadProgress(file);
  }
  // Save progress. Never while debug mode is on (debug keys could skip nights for free)
  save() { if (!settings.debug) saveProgress(this.file, this.progress); }

  // First screen after loading
  async boot() {
    await Promise.all([Demo.check(), loadItemsQuick()]);   // server time + who is signed in + shop items
    this.claimOG();                                         // OG achievement + bonus EXP (until Nov 10)
    if (Story.on) return this.storyBoot();
    this.showTitle();
    // a 1 in 1000 surprise when the game opens: eyes stare at you for 10 seconds
    if (chance(1000)) {
      const eyes = this.overlay("hallucinations", "Bonnie Eyes");
      this.scripts.run("title", function* () { yield 10; this.removeOverlay(eyes); }.call(this));
    }
  }

  showTitle() {
    if (Story.on) return this.storyDone();      // Story Mode has no title screen
    this.go("title");
    Sound.stopAll();
    this.sp.music.setVolume(100);
    this.sp.music.play("Stage", "Menu", { loop: true });
    this.level = this.progress.night;
    const p = this.progress;
    const extras = !Global.storyOnly();      // story mode only: never land on a hidden item
    this.selected = extras && p.beat6 ? "custom" : extras && p.beat5 ? "night6" : this.level === 1 ? "new" : "continue";
    if (Demo.on()) { this.selected = "new"; this.level = 1; }      // demo: only Night 1
    this.hovered = null;
    this.settingsHover = false;
    this.face = 1;                      // which flickering face picture
    this.smooth.jump("titleX", 105); this.smooth.jump("titleY", 106);
    this.titleDir = -172;               // the title text wobbles in a little circle
    // the face behind the menu flickers to a random picture every 0.2-0.5 seconds
    this.scripts.run("title", function* () {
      for (;;) { yield rand(2, 5) / 10; this.face = rand(1, 4); }
    }.call(this));
  }

  updateTitle() {
    // title text wobble: move 1 step, turn 15 degrees, every update
    const r = this.titleDir * Math.PI / 180;
    this.smooth.set("titleX", this.smooth.get("titleX") + Math.sin(r));
    this.smooth.set("titleY", this.smooth.get("titleY") - Math.cos(r));
    this.titleDir += 15;

    // hovering a menu item selects it (with a blip)
    const items = this.menuItems();
    const over = items.find(i => inBox(pic(i.group, i.name), i.x, i.y, 40, this.mouse.x, this.mouse.y, 2) && this.textHit(i));
    const overId = over ? over.id : null;
    if (overId && overId !== this.hovered) { this.sp.blip.play("new game", "blip3"); this.selected = overId; }
    this.hovered = overId;
    // the whole box around the word counts (not just the letters), like the menu items
    const sHover = inBox(pic("SettingsButton", "Deselected"), 30, 305, 10, this.mouse.x, this.mouse.y, 40);
    if (sHover && !this.settingsHover) this.sp.blip.play("new game", "blip3");
    this.settingsHover = sHover;

    const aHover = this.mouse.x > 375 && this.mouse.y > 296 && this.mouse.y < 314;
    if (aHover && !this.achHover) this.sp.blip.play("new game", "blip3");
    this.achHover = aHover;
    for (const c of this.clicks) {
      if (aHover) { openAchievements(); return; }
      if (sHover) { openSettings(); return; }
      if (over) { this.choose(over.id); return; }
    }
    // keyboard: up / down to move, Enter or Space to pick
    for (const k of this.keys) {
      const i = items.findIndex(it => it.id === this.selected);
      if (k === "up" || k === "down") {
        const next = items[(i + (k === "up" ? -1 : 1) + items.length) % items.length];
        this.selected = next.id;
        this.sp.blip.play("new game", "blip3");
      } else if (k === "enter") { this.choose(this.selected); return; }
    }
  }

  // Menu words are wide boxes; only count the part with letters in it
  textHit(item) {
    const p = pic(item.group, item.name);
    const L = (p.words || []).find(l => l.text !== undefined);
    if (!L || !L.box) return true;
    const u = (this.mouse.x - item.x) / 0.4 + p.cx;
    const shown = TEXTS[L.text] !== undefined ? String(TEXTS[L.text]) : L.text;
    const ink = measureInk(this.ctx, shown, L.font), k = L.like ? L.like[1] / measureInk(this.ctx, L.like[0], L.font).h : L.box[3] / measureInk(this.ctx, L.text, L.font).h;
    const width = (shown === L.text && !L.like) ? L.box[2] : ink.w * k;
    return u >= L.box[0] - 6 && u <= L.box[0] + width + 6;
  }

  choose(id) {
    if (Demo.on() && id !== "dine" && id !== "new") return;        // demo: nothing else
    if (id === "dine") return this.startSecret();
    if (id === "new") {
      this.level = 1;
      this.progress.night = 1;
      this.phoneMuted = false;              // the phone guy calls again
      this.died = false;
      return this.newspaperAd();
    }
    if (id === "continue") return this.startIntro();
    if (id === "night6") { this.level = 6; return this.startIntro(); }
    if (id === "custom") return this.showCustom();
  }

  drawTitle(ctx, a) {
    draw(ctx, picAt("back", this.face), 240, 180);
    draw(ctx, pic("FNaF text", "text"), this.smooth.at("titleX", a), this.smooth.at("titleY", a), { size: 40 });
    if (this.progress.beat5) draw(ctx, pic("Star", "beat5"), 110, 160, { size: 50 });
    const items = this.menuItems();
    for (const i of items) draw(ctx, pic(i.group, i.name), i.x, i.y, { size: 40 });
    const sel = items.find(i => i.id === this.selected);
    if (sel) draw(ctx, pic("selection", "arrows"), 45, sel.y, { size: 40 });
    if (this.selected === "continue") {
      // "Night 3" next to Continue
      draw(ctx, pic("night", "string"), 80, 250, { size: 40 });
      draw(ctx, pic("level", String(Math.min(7, this.level))), 100, 249, { size: 40 });
    }
    draw(ctx, pic("SettingsButton", this.settingsHover ? "Selected" : "Deselected"), 30, 305, { size: 10 });
    // "Achievements 3/19" in the bottom right corner
    const got = countedAchievements(this.progress.achievements);     // (bonus ones like OG don't count)
    ctx.save();
    ctx.font = '8px "Share Tech Mono"';
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillStyle = this.achHover ? "#f7931e" : "#fff";
    ctx.fillText(ACH_WORD("Achievements") + "  " + got + "/" + COUNTED_ACHIEVEMENTS.length, 472, 305);
    // DEMO tag + countdown in the top right corner
    if (Demo.on()) {
      ctx.textBaseline = "top"; ctx.font = '10px "Share Tech Mono"'; ctx.fillStyle = "#f7931e";
      ctx.fillText(ACH_WORD("DEMO") + "  ·  " + ACH_WORD("full game in") + " " + Demo.left(), 444, 8);       // (left of the pause button)
    }
    ctx.restore();
  }

  // Back from the settings screen
  settingsClosed() { if (this.screen === "title") this.showTitle(); Pause.afterSettings(); }

  /* =================================================================
     NEWSPAPER AD (New Game), NIGHT INTRO, LOADING
     ================================================================= */
  newspaperAd() {
    const ad = this.overlay("Backdrop", "help wanted ad", { fade: 0 });
    this.scripts.run("ad", function* () {
      yield* this.fade(ad, 1);
      this.scripts.stop("title");
      this.screen = "black";
      // stays 5 seconds, or until you click
      let t = 0;
      yield () => (t += TICK) >= 5 || this.mouse.down;
      yield* this.fade(ad, 0);
      this.startIntro();
    }.call(this));
  }

  startIntro() {
    this.go("black");
    Sound.stopAll();
    if (this.level < 6) this.progress.night = this.level;     // Continue starts from here
    this.save();
    const day = this.overlay("what day", `12:00AM ${this.level} Night`, { x: 240, y: 170, size: 40 });
    this.scripts.run("intro", function* () {
      yield 2;
      yield* this.fade(day, 0);
      this.removeOverlay(day);
      // the spinning rice bowl in the corner while the night "loads"
      const spinner = this.overlay("loading", "icon", { x: 465, y: 300, size: 50 });
      yield rand(5, 10);
      this.removeOverlay(spinner);
      this.startNight();
    }.call(this));
  }

  /* =================================================================
     THE NIGHT
     ================================================================= */
  startNight() {
    this.go("night");
    const L = this.level;
    // everything about the office
    const n = this.n = {
      power: 999,                 // 999 = 99.9%
      hour: 0,                    // 0 = 12 AM ... 6 = 6 AM
      clock: 0,                   // seconds into the current hour
      twitch: 1,
      leftDoor: false, rightDoor: false, leftLight: false, rightLight: false,
      monitorUp: false,           // the player wants the monitor up
      camsUp: false,              // the cameras are showing (monitor fully up)
      monitorFrame: 0,            // 0 = put away, 1-10 = flipping frames
      camera: "Show Stage",
      flipArmed: false,           // the flip bar at the bottom is ready to be touched
      powerOut: false,
      // where everyone is
      bonnie: { at: "Show Stage", spot: 2 },
      chica: { at: "Show Stage", spot: 1 },
      freddy: { at: "Show Stage" },
      foxy: { stage: 1, cooldown: randFloat(1, 17.5), attackTimer: 0, knockLoss: 10 },
      ai: { freddy: 0, bonnie: 0, chica: 0, foxy: 0 },
      // what each camera room shows right now (picked when you look)
      rooms: {},
      visions: {},                // rare creepy pictures rolled each time the monitor goes up
      golden: 0,                  // 1 = Golden is in the corner this time
      goldenLaugh: false,
      goldenInOffice: false,
      goldenWatch: false,
      blackout: false,            // interrupted camera (someone moved)
      jumpscare: null,            // {group, frames, i}
      officePic: "normal",
      hallFlicker: 2,
      fanFrame: 1,
      scareLeft: true, scareRight: true,
      hallucination: null,       // creepy face flashing this update
      phone: "off",              // the call banner: off, ringing (incoming call) or talking
      callTime: 0,                // seconds into the call (shown on the banner)
      dance: 0,                   // dance frame (0 = no dance)
    };
    if (L <= 6) {
      const ai = NIGHT_AI[L];
      for (const k of ["freddy", "bonnie", "chica", "foxy"]) n.ai[k] = typeof ai[k] === "function" ? ai[k]() : ai[k];
    } else {
      Object.assign(n.ai, this.customAI);
    }
    this.smooth.jump("pan", 60);       // office looks left/right (-60..60)
    this.smooth.jump("camPan", 60);    // camera view slowly slides
    this.smooth.jump("slideY", 0);
    this.smooth.jump("phoneShow", 0);   // the call banner starts hidden

    // looping sounds of the office
    const sp = this.sp;
    sp.music.setVolume(100);
    sp.music.play("Stage", "ColdPresc B", { loop: true });
    sp.office.setVolume(25);
    sp.office.play("office", "Buzz_Fan_Florescent2", { loop: true });
    sp.lights.setVolume(0);
    sp.lights.play("left button panel", "BallastHumMedium2", { loop: true });
    sp.map.setVolume(0);
    sp.map.play("map", "EerieAmbienceLargeSca_MV005", { loop: true });

    this.runPower();
    this.runPhone();
    this.runBonnie();
    this.runChica();
    this.runFoxy();
    this.runFreddy();
    this.runCameraPan();
    this.runAmbience();
    if (settings.jumpscares === "1") this.runHallucinations();
    // shop items (see ITEMS in global.js)
    n.time = 0;                  // seconds into the night (item timers)
    n.trap = null;               // the camera room with a bear trap in it
    n.placingTrap = false;
    n.glassesUntil = 0;
    n.stopwatchUsed = false;
    for (const k of ["bonnie", "chica", "freddy", "foxy"]) n[k].stunUntil = 0;
    ItemBar.attach(this);
    ItemBar.show(true);
    Pause.attach(this);
    Pause.showButton(true);
  }

  // --------------------------------------------------------------
  // The clock: one hour every 90 seconds, 6 AM wins.
  // The characters get a bit harder at 2, 3 and 4 AM.
  // --------------------------------------------------------------
  updateClock() {
    const n = this.n;
    n.time += TICK;
    n.clock += TICK * (n.camsUp ? CAM_TIME_SPEED : 1);    // the night goes a little faster while you watch the cameras
    if (n.clock < 90) return;
    n.clock -= 90;
    n.hour++;
    if (n.hour === 2) n.ai.bonnie++;
    if (n.hour === 3 || n.hour === 4) { n.ai.bonnie++; n.ai.chica++; n.ai.foxy++; }
    if (n.hour === 6) this.sixAM();
  }

  // --------------------------------------------------------------
  // Power: every second it drops by how many things are on
  // (plus a little extra on later nights)
  // --------------------------------------------------------------
  usage() {
    const n = this.n;
    return 1 + n.leftDoor + n.leftLight + n.rightDoor + n.rightLight + n.camsUp;
  }
  runPower() {
    const n = this.n;
    this.scripts.run("night", function* () {
      while (n.power > 0) {
        yield 1;
        // nights 1-4 add 0.0 - 0.3 per second, later nights add 0.4
        const extra = this.level < 5 ? (this.level - 1) / 10 : 0.4;
        n.power -= (this.usage() + extra) * Global.drain();     // (chicken mode: 3x slower)
      }
      this.powerOut();
    }.call(this));
  }

  // --------------------------------------------------------------
  // The phone call at the start of nights 1-5
  // --------------------------------------------------------------
  runPhone() {
    const n = this.n;
    if (this.level >= 6 || this.died) return;
    const calls = { 1: "voiceover1c", 2: "voiceover2a", 3: "voiceover3", 4: "voiceover4", 5: "voiceover5" };
    const sp = this.sp.phone;
    sp.setVolume(100);
    let ring = null, call = null;

    // Pick up: the ringing stops and the call plays
    const answer = () => {
      if (n.phone !== "ringing") return;
      this.scripts.stop("ring");
      ring.fadeOut(0.15);
      call = sp.play("Phone Calls", calls[this.level]);
      n.phone = "talking";
      n.callTime = 0;
      this.scripts.run("phone", function* () {
        yield () => call.done;
        n.phone = "off";                              // the banner goes away when the call ends
        this.unlock("call");
      }.call(this));
    };
    // Hang up: everything stops and the banner goes away
    const hangUp = () => {
      this.unlock("hangup");
      if (ring) ring.stop();
      if (call) call.stop();
      this.scripts.stop("ring", "phone");
      n.phone = "off";
    };
    this.phoneTap = () => (n.phone === "ringing" ? answer() : hangUp());

    // The phone rings for 3 to 8 seconds (the banner shows up 1 second in), then picks up by itself
    this.scripts.run("ring", function* () {
      ring = sp.play("Phone Calls", "ringtone");
      const ringFor = randFloat(3, 8);
      yield 1;
      n.phone = "ringing";
      yield ringFor - 1;
      answer();
    }.call(this));
  }

  /* --------------------------------------------------------------
     THE CALL BANNER (top left, like an iPhone call)
     Click it while it rings to pick up, click it during the call to hang up.
     -------------------------------------------------------------- */
  phoneBox() { return { x: 8, y: 8, w: 160, h: 42 }; }

  updatePhone() {
    const n = this.n;
    if (n.phone === "talking") n.callTime += TICK;
    // slide in / fade out smoothly
    const show = this.smooth.get("phoneShow") || 0;
    this.smooth.set("phoneShow", Math.max(0, Math.min(1, show + (n.phone === "off" ? -0.15 : 0.15))));
  }

  drawPhone(ctx, a) {
    const n = this.n, show = this.smooth.at("phoneShow", a) || 0;
    if (show <= 0) return;
    const { x, y: y0, w, h } = this.phoneBox();
    const y = y0 - (1 - show) * 14;
    const word = s => (TEXTS[s] !== undefined ? String(TEXTS[s]) : s);
    ctx.save();
    ctx.globalAlpha = show;
    // the dark glassy card
    ctx.fillStyle = "rgba(28, 28, 32, 0.92)";
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 13); ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)"; ctx.lineWidth = 0.75; ctx.stroke();
    // the caller picture: a gradient circle with their letters
    const cx = x + 21, cy = y + h / 2, r = 14;
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, "#7ee08a"); g.addColorStop(1, "#1f9e4a");     // green, light at the top
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = '600 11px "Sans Serif"';
    ctx.fillText(word("AM"), cx, cy + 0.5);
    // name and what is happening
    ctx.textAlign = "left";
    ctx.font = '600 10px "Sans Serif"';
    ctx.fillText(word("Aidan") + " (" + word("Manager") + ")", x + 41, y + 15, w - 80);
    ctx.font = '8px "Sans Serif"';
    ctx.fillStyle = "rgba(235, 235, 245, 0.6)";
    if (n.phone === "ringing") ctx.fillText(word("incoming call..."), x + 41, y + 28);
    else {
      const t = Math.floor(n.callTime);
      ctx.fillText(Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"), x + 41, y + 28);
    }
    // the round button: green to answer, red to hang up
    const bx = x + w - 21, ringing = n.phone === "ringing";
    const pulse = ringing ? 1 + 0.06 * Math.sin(performance.now() / 120) : 1;
    ctx.fillStyle = ringing ? "#30d158" : "#ff3b30";
    ctx.beginPath(); ctx.arc(bx, cy, 13 * pulse, 0, Math.PI * 2); ctx.fill();
    // the handset (turned down when it means hang up)
    ctx.translate(bx, cy);
    if (!ringing) ctx.rotate(Math.PI * 0.75);
    ctx.scale(0.62, 0.62);
    ctx.translate(-12, -12);
    ctx.fillStyle = "#fff";
    ctx.fill(PHONE_ICON);
    ctx.restore();
  }

  // --------------------------------------------------------------
  // WEDDY (Bonnie): left side. Every ~5 seconds she may move.
  // --------------------------------------------------------------
  runBonnie() {
    const n = this.n, b = n.bonnie;
    this.scripts.run("bonnie", function* () {
      for (;;) {
        yield 4.97;
        if (b.stunUntil > n.time) continue;                     // caught in the bear trap
        if (rand(1, 20) <= n.ai.bonnie && Global.letMove()) this.moveBonnie();   // (chicken mode: 1 in 10)
        if (b.at === "Got You") return;
      }
    }.call(this));
  }
  moveBonnie() {
    const n = this.n, b = n.bonnie;
    b.spot = rand(1, 2);
    this.leaveCheck(b.at);
    const coin = rand(1, 2);
    const before = b.at;
    // two possible paths from each room (picked by a coin flip)
    const paths = coin === 1 ? {
      "Show Stage": "Backstage", "Backstage": "Dining Area", "Dining Area": "Backstage",
      "West Hall": ["Supply Closet", "close"], "W. Hall Corner": ["Supply Closet", "close"],
      "Supply Closet": ["Ready to Attack", "closer"],
    } : {
      "Show Stage": "Dining Area", "Backstage": ["West Hall", "far"], "Dining Area": ["West Hall", "far"],
      "West Hall": ["W. Hall Corner", "closer"], "W. Hall Corner": ["Ready to Attack", "very close"],
      "Supply Closet": ["West Hall", "far"],
    };
    if (before === "Ready to Attack") {
      if (n.leftDoor) { this.footsteps("close"); b.at = "Dining Area"; }
      else { b.at = "Got You"; n.leftLight = false; }        // she gets in
    } else if (paths[before]) {
      const to = paths[before];
      if (Array.isArray(to)) { this.footsteps(to[1]); b.at = to[0]; } else b.at = to;
    }
    this.arriveCheck(b.at);
    this.trapCheck("bonnie");
  }

  // --------------------------------------------------------------
  // CHEDDY (Chica): right side.
  // --------------------------------------------------------------
  runChica() {
    const n = this.n, c = n.chica;
    this.scripts.run("chica", function* () {
      for (;;) {
        yield 4.98;
        if (c.stunUntil > n.time) continue;                     // caught in the bear trap
        if (rand(1, 20) <= n.ai.chica && Global.letMove()) this.moveChica();
        if (c.at === "Got You") return;
      }
    }.call(this));
  }
  moveChica() {
    const n = this.n, c = n.chica;
    c.spot = rand(1, 2);
    this.leaveCheck(c.at);
    const intoEastHall = () => { c.at = "East Hall"; this.footsteps(c.spot === 1 ? "far" : "close"); };
    if (c.at === "Show Stage") c.at = "Dining Area";
    else if (c.at === "Ready to Attack") {
      if (n.rightDoor) { c.at = "East Hall"; c.spot = 1; this.footsteps("close"); }
      else { c.at = "Got You"; n.rightLight = false; }
    } else if (rand(1, 2) === 1) {
      if (c.at === "Dining Area" || c.at === "Kitchen") c.at = "Restrooms";
      else if (c.at === "Restrooms") c.at = "Kitchen";
      else if (c.at === "East Hall") c.at = "Dining Area";
      else if (c.at === "E. Hall Corner") intoEastHall();
    } else {
      if (c.at === "Dining Area") c.at = "Kitchen";
      else if (c.at === "Kitchen" || c.at === "Restrooms") intoEastHall();
      else if (c.at === "East Hall") { this.footsteps("closer"); c.at = "E. Hall Corner"; }
      else if (c.at === "E. Hall Corner") { this.footsteps("very close"); c.at = "Ready to Attack"; }
    }
    this.arriveCheck(c.at);
    this.trapCheck("chica");
  }

  // If you are watching the camera someone leaves or enters, it cuts out
  leaveCheck(room) { if (this.n.camsUp && room === this.n.camera) this.interrupt(); }
  arriveCheck(room) { if (this.n.camsUp && room === this.n.camera) this.interrupt(); }

  footsteps(howClose) {
    const vol = { far: 10, close: 20, closer: 30, "very close": 40 }[howClose];
    this.sp.steps.setVolume(vol);
    this.sp.steps.play("Usage word", "deep steps");
  }

  // --------------------------------------------------------------
  // ENDO (Foxy): hides in the cove, runs down the west hall.
  // Watching the cameras keeps him still for a while.
  // --------------------------------------------------------------
  runFoxy() {
    const n = this.n, f = n.foxy;
    f.knockLoss = 10;
    // cooldown: looking at the cameras resets it, the office counts it down
    this.scripts.run("foxy", function* () {
      for (;;) {
        if (n.camsUp) { f.cooldown = randFloat(1, 17.5); yield 1.1; }
        else if (f.cooldown > 0) { yield 0.5; f.cooldown -= 0.5; }
        else yield;
      }
    }.call(this));
    this.scripts.run("foxy", function* () {
      for (;;) {
        yield 5.01;
        if (f.stunUntil > n.time) continue;                     // caught in the bear trap
        if (rand(1, 20) > n.ai.foxy || f.cooldown > 0 || !Global.letMove()) continue;
        f.stage++;
        if (f.stage !== 4) continue;
        // he is out of the cove: 25 seconds until he runs (or right away if you watch the hall)
        f.attackTimer = 25;
        while (f.stage !== 5 && f.attackTimer > 0) { yield 1; f.attackTimer--; }
        if (f.stage === 4) f.stage = 6;
        else yield () => f.stage === 6;
        if (this.trapCheck("foxy", "West Hall")) continue;      // a bear trap in the west hall stops his run
        if (n.leftDoor) {
          // he bangs on the closed door and costs some power
          n.power -= f.knockLoss;
          this.sp.foxy.play("Foxy", "knock2");
          f.stage = 1;
          f.knockLoss += 50;
          this.unlock("knock");
        } else {
          if (n.camsUp) this.lowerMonitor();
          return this.jumpscare("Foxy");
        }
      }
    }.call(this));
  }

  // He runs down the hall when you look at it after he left the cove
  foxyRun() {
    const n = this.n;
    n.foxy.stage = 5;
    this.sp.westHall.setVolume(100);
    this.sp.westHall.play("West Hall", "run");
    n.foxyRunFrame = 1;
    this.scripts.run("foxy run", function* () {
      for (let i = 1; i <= 31; i++) { n.foxyRunFrame = i; yield; }
    }.call(this));
    this.scripts.run("foxy run", function* () { yield 2; n.foxy.stage = 6; }.call(this));
  }

  // --------------------------------------------------------------
  // EDDIE (Freddy): only moves once both others left the stage,
  // and never while you are watching him.
  // --------------------------------------------------------------
  runFreddy() {
    const n = this.n, fr = n.freddy;
    const path = { "Show Stage": ["Dining Area", 15], "Dining Area": ["Restrooms", 20], "Restrooms": ["Kitchen", 30],
                   "Kitchen": ["East Hall", 40], "East Hall": ["E. Hall Corner", 60] };
    this.scripts.run("freddy", function* () {
      for (;;) {
        yield 3.02;
        if (n.bonnie.at === "Show Stage" || n.chica.at === "Show Stage") continue;
        if (fr.stunUntil > n.time) continue;                    // caught in the bear trap
        if (rand(1, 20) > n.ai.freddy || !Global.letMove()) continue;
        if (fr.at === "Got You") {
          if (n.camsUp) this.lowerMonitor();
          return this.jumpscare("Eddie");
        }
        if (n.camsUp && n.camera === fr.at) continue;        // you are watching him
        this.freddyRunSound();
        if (path[fr.at]) {
          const [to, vol] = path[fr.at];
          fr.at = to;
          this.sp.eddie.setVolume(vol);
        } else if (fr.at === "E. Hall Corner") {
          // he waits until you look at a different camera, then walks in (unless the door is shut)
          yield () => n.camsUp && n.camera !== fr.at;
          if (n.rightDoor) { fr.at = "East Hall"; this.sp.eddie.setVolume(60); }
          else { fr.at = "Got You"; this.sp.eddie.setVolume(80); }
          this.freddyRunSound();
        }
        this.sp.eddie.play("Eddie", "pop");         // his laugh
        this.arriveCheck(fr.at);
        if (this.trapCheck("freddy")) continue;
      }
    }.call(this));
  }
  freddyRunSound() {
    const vol = { "Show Stage": 30, "Dining Area": 35, "Restrooms": 40, "Kitchen": 60, "East Hall": 75, "E. Hall Corner": 75, "Got You": 100 }[this.n.freddy.at];
    if (vol) this.sp.westHall.setVolume(vol);
    if (this.n.freddy.at === "Got You") this.sp.westHall.play("West Hall", "whispering2", { loop: true });
    this.sp.westHall.play("West Hall", "running fast3");
  }

  // --------------------------------------------------------------
  // The camera picture slowly slides left and right
  // --------------------------------------------------------------
  runCameraPan() {
    this.scripts.run("night", function* () {
      const glide = function* (from, to) {
        for (let t = TICK; t < 6; t += TICK) { this.smooth.set("camPan", from + (to - from) * t / 6); yield; }
        this.smooth.set("camPan", to);
      }.bind(this);
      for (;;) { yield* glide(60, -60); yield 2; yield* glide(-60, 60); yield 2; }
    }.call(this));
  }

  // --------------------------------------------------------------
  // Background sounds that react to danger
  // --------------------------------------------------------------
  runAmbience() {
    const n = this.n, sp = this.sp;
    // the rare circus tune and pirate song, kitchen clatter, Eddie's music box
    this.scripts.run("night", function* () {
      for (;;) { yield 5; if (chance(100)) sp.star.play("Star", "circus"); }
    }.call(this));
    this.scripts.run("night", function* () {
      for (;;) {
        yield 1;
        if (n.foxy.stage === 1 && chance(100) && !sp.pirate.isPlaying("pirate song2")) sp.pirate.play("Pirate Cove", "pirate song2");
      }
    }.call(this));
    this.scripts.run("night", function* () {
      for (;;) {
        const h = sp.kitchen.play("kitchen", pick(["OVEN-DRA_1_GEN-HDF18119", "OVEN-DRA_2_GEN-HDF18120", "OVEN-DRAWE_GEN-HDF18122", "OVEN-DRA_7_GEN-HDF18121"]));
        yield () => h.done;
        yield;
      }
    }.call(this));
    // map dot blinks every second
    this.scripts.run("night", function* () { for (;;) { n.mapBlink = !n.mapBlink; yield 1; } }.call(this));
    // red "recording" dot blinks every quarter second
    this.scripts.run("night", function* () { for (;;) { n.redDot = true; yield 0.25; n.redDot = false; yield 0.25; } }.call(this));
  }

  // Every update: sound volumes that depend on what is going on
  updateNightSounds() {
    const n = this.n, sp = this.sp, at = (who, room) => n[who].at === room;
    if (n.powerOut) return;
    // danger ambience gets louder the closer they are
    let v = 0;
    if (at("freddy", "Got You")) v = 100;
    else if (["Ready to Attack", "Got You"].includes(n.bonnie.at) || ["Ready to Attack", "Got You"].includes(n.chica.at)) v = 75;
    else if (at("bonnie", "W. Hall Corner") || at("chica", "E. Hall Corner") || at("freddy", "E. Hall Corner")) v = 50;
    else if (at("bonnie", "West Hall") || at("bonnie", "Supply Closet") || at("chica", "East Hall") || n.foxy.stage > 2 || at("freddy", "East Hall")) v = 30;
    sp.map.setVolume(v);
    sp.lights.setVolume(n.leftLight || n.rightLight ? 100 : 0);
    sp.office.setVolume(n.camsUp ? 10 : 25);
    sp.phone.setVolume(n.camsUp ? 50 : 100);
    sp.pirate.setVolume(n.camsUp && n.camera === "Pirate Cove" ? 15 : 5);
    // Cheddy clattering in the kitchen
    const watchingKitchen = n.camsUp && n.camera === "Kitchen";
    sp.kitchen.setVolume(at("chica", "Kitchen") ? (watchingKitchen ? 75 : n.camsUp ? 20 : 10) : 0);
    // Eddie's music box in the kitchen
    if (at("freddy", "Kitchen")) {
      keepPlaying(sp.redDot, "red dot", "kitchen");
      sp.redDot.setVolume(watchingKitchen ? 50 : 5);
    } else if (!this.scripts.has("jingle")) sp.redDot.setVolume(0);
  }

  // --------------------------------------------------------------
  // Hallucinations (only with jumpscares ON): rare one-frame creepy faces
  // --------------------------------------------------------------
  runHallucinations() {
    const n = this.n;
    n.hallucA = 0;
    n.hallucPic = 3;
    this.scripts.run("halluc", function* () { for (;;) { yield 1; n.hallucA = rand(1, 1000); } }.call(this));
    this.scripts.run("halluc", function* () {
      for (;;) { yield rand(1, 2) / 10; n.hallucPic = pick([1, 2, 4]); }
    }.call(this));
  }

  /* --------------------------------------------------------------
     THE MONITOR
     -------------------------------------------------------------- */
  raiseMonitor() {
    const n = this.n;
    n.monitorUp = true;
    this.sp.flip.setVolume(100);
    this.sp.flip.play("flip panel", "CAMERA_VIDEO_LOA_60105303");
    this.rollVisions();
    // the dance: look at the stage at 5 AM
    if (n.camera === "Show Stage" && n.hour === 5) this.startDance();
    this.scripts.run("monitor", function* () {
      for (let f = 1; f <= 10; f++) { n.monitorFrame = f; yield; }
      n.camsUp = true;
      n.monitorFrame = 0;
      this.seeCamera(n.camera);
      n.leftLight = n.rightLight = false;
      this.sp.monitor.setVolume(100);
      this.sp.monitor.play("moniter", "MiniDV_Tape_Eject_1");
      this.goldenWatchReset();
      this.showCamera();
      // someone is in the office: you hear breathing, then the monitor gets pulled down
      if (n.bonnie.at === "Got You" || n.chica.at === "Got You") this.breathing();
    }.call(this));
  }

  // Monitor goes down: back to the office (this is when Weddy or Cheddy get you)
  lowerMonitor() {
    const n = this.n;
    const wasUp = n.camsUp || n.monitorFrame > 0;
    n.monitorUp = false;
    n.camsUp = false;
    this.scripts.stop("monitor", "breath");
    this.sp.breath.setVolume(0);
    this.sp.breath.stopAll();
    n.blackout = false;
    this.sp.halluc.setVolume(0);
    if (wasUp) {
      const from = n.monitorFrame || 10;
      this.scripts.run("monitor", function* () {
        for (let f = from; f >= 1; f--) { n.monitorFrame = f; yield; }
        n.monitorFrame = 0;
      }.call(this));
    }
    if (n.power > 0 && !n.powerOut) {
      if (n.bonnie.at === "Got You" && n.chica.at !== "Got You") return this.jumpscare("Bonnie");
      if (n.chica.at === "Got You") return this.jumpscare("Chica");
    }
    if (n.goldenWatch) this.goldenInOffice();
  }

  flipMonitor() {
    const n = this.n;
    if (!n.monitorUp) this.raiseMonitor();
    else {
      this.sp.flip.setVolume(100);
      this.sp.flip.play("flip panel", "put down");
      this.lowerMonitor();
    }
  }

  breathing() {
    const n = this.n, sp = this.sp;
    sp.breath.setVolume(50);
    this.scripts.run("breath", function* () {
      for (;;) {
        const h = sp.breath.play("border", pick(["Vocals_Breaths_S_35972012", "Vocals_Breaths_S_35972006", "Vocals_Breaths_S_35972008", "Vocals_Breaths_S_35972014"]));
        yield () => h.done;
      }
    }.call(this));
    this.scripts.run("breath", function* () {
      yield 10;
      if (n.camsUp) this.lowerMonitor();
    }.call(this));
  }

  // Rare pictures, rolled each time the monitor goes up
  rollVisions() {
    const n = this.n, v = n.visions;
    v.stage = rand(1, 100);           // stage stare
    v.cove = chance(100);             // "it's me" in the cove
    v.corner = rand(1, 100);          // west corner poster
    v.east = rand(1, 100);            // east hall posters
    v.poster = rand(1, 2);
    v.eastCorner = rand(1, 100);      // newspaper clippings
    v.article = rand(1, 4);
    v.backstage = rand(1, 100);
    n.golden = rand(1, Math.max(1, Math.round(this.goldenRate)));
    n.goldenLaugh = n.golden === 1 && n.bonnie.at !== "W. Hall Corner";
  }

  // Switching to a camera (or the monitor finishing going up)
  showCamera() {
    const n = this.n;
    this.pickRoomPictures();
    if (n.camera === "West Hall" && n.foxy.stage === 4) this.foxyRun();
    if (n.camera === "W. Hall Corner" && n.goldenLaugh) {
      n.goldenLaugh = false;
      this.sp.corner.play("west hall corner", "Laugh_Giggle_Girl_1");
      n.goldenWatch = true;            // Golden will be in the office when you put the monitor down
    }
  }

  switchCamera(room) {
    this.n.camera = room;
    this.seeCamera(room);
    this.goldenWatchReset();
    this.showCamera();
  }

  // "Security Expert": every camera looked at in one night
  seeCamera(room) {
    const seen = this.n.camsSeen || (this.n.camsSeen = new Set());
    seen.add(room);
    if (seen.size === CAMERAS.length) this.unlock("cams");
  }

  // Someone moved on the camera you watch: it goes black for 3 seconds
  interrupt() {
    const n = this.n;
    this.showCamera();
    n.blackout = true;
    this.sp.black.play("Black", pick(["garble1", "garble2", "garble3", "COMPUTER_DIGITAL_L2076505"]));
    this.scripts.stop("blackout");
    this.scripts.run("blackout", function* () { yield 3; n.blackout = false; }.call(this));
  }

  // What every camera room shows, decided when you look (like a photo)
  pickRoomPictures() {
    const n = this.n, v = n.visions, r = n.rooms;
    const { bonnie: b, chica: c, freddy: f } = n;
    const onStage = who => n[who].at === "Show Stage";
    // Show Stage
    if (onStage("bonnie") && onStage("chica") && onStage("freddy")) r["Show Stage"] = v.stage === 1 ? "all stare" : "all present";
    else if (!onStage("bonnie") && onStage("chica") && onStage("freddy")) r["Show Stage"] = "bonnie gone";
    else if (onStage("bonnie") && !onStage("chica") && onStage("freddy")) r["Show Stage"] = "chica gone";
    else if (onStage("freddy")) r["Show Stage"] = v.stage === 1 ? "freddy stare" : "freddy";
    else r["Show Stage"] = "all gone";
    // Dining Area and Entrance (same rules)
    for (const room of ["Dining Area", "Entrance"]) {
      if (c.at === room) r[room] = c.spot === 1 ? "chica" : "chica close";
      else if (b.at === room) r[room] = b.spot === 1 ? "bonnie" : "bonnie close";
      else if (f.at === room) r[room] = "freddy";
      else r[room] = "empty";
    }
    // Pirate Cove
    r["Pirate Cove"] = ["curtain closed", "curtain closed", "peeking out", "standing outside"][n.foxy.stage] || (v.cove ? "leave cove it's me" : "leave cove");
    // West Hall Corner
    if (b.at === "W. Hall Corner") r["W. Hall Corner"] = "bonnie";
    else if (n.golden === 1) r["W. Hall Corner"] = "Golden Freddy";
    else r["W. Hall Corner"] = v.corner === 1 ? "freddy rip" : "clear";
    // Supply Closet
    r["Supply Closet"] = b.at === "Supply Closet" ? "bonnie" : "clear";
    // East Hall
    if (c.at === "East Hall") r["East Hall"] = c.spot === 1 ? "chica" : "chica close";
    else if (f.at === "East Hall") r["East Hall"] = "freddy";
    else if (v.east === 1) r["East Hall"] = v.poster === 1 ? "crying kids" : "it's me";
    else r["East Hall"] = "clear";
    // East Hall Corner
    if (c.at === "E. Hall Corner") r["E. Hall Corner"] = "chica";
    else if (f.at === "E. Hall Corner") r["E. Hall Corner"] = "freddy";
    else if (v.eastCorner < 5) r["E. Hall Corner"] = ["kids vanish", "shutdown", "close year end", "five missing"][v.article - 1];
    else r["E. Hall Corner"] = "clear";
    // Backstage
    if (b.at === "Backstage") r["Backstage"] = b.spot === 1 ? "bonnie" : "bonnie stare";
    else r["Backstage"] = v.backstage === 1 ? "stare" : "clear";
    // Restrooms
    if (c.at === "Restrooms") r["Restrooms"] = c.spot === 1 ? "chica" : "chica close";
    else if (f.at === "Restrooms") r["Restrooms"] = "freddy";
    else r["Restrooms"] = "clear";
  }

  // The picture a room shows this very update (some rooms twitch and flicker live)
  roomPicture(room) {
    const n = this.n;
    if (room === "West Hall") {
      if (n.foxy.stage === 5) return `FoxyRun (${n.foxyRunFrame || 31})`;
      if (n.hallFlicker > 3) return "light off";
      return n.bonnie.at === "West Hall" ? "bonnie" : "light on";
    }
    if (room === "Kitchen") return n.chica.at === "Kitchen" ? "chicarumble1" : "none";
    // on night 4 and later, Weddy and Cheddy twitch in the hall corners
    if (this.level > 3 && room === "W. Hall Corner" && n.bonnie.at === room) return n.twitch < 25 ? "bonnie" : n.twitch < 29 ? "twitch" : "open mouth";
    if (this.level > 3 && room === "E. Hall Corner" && n.chica.at === room) return n.twitch < 25 ? "chica" : n.twitch < 29 ? "twitch" : "open mouth";
    return n.rooms[room];
  }

  /* --------------------------------------------------------------
     Golden (very rare): seen in the west corner, then sitting in
     the office when you put the monitor down. Look away (raise the
     monitor) within 5 seconds or it is over.
     -------------------------------------------------------------- */
  goldenWatchReset() {
    const n = this.n;
    if (n.goldenInOffice) {
      n.goldenInOffice = false;
      this.sp.golden.setVolume(0);
      this.scripts.stop("golden");
    }
  }
  goldenInOffice() {
    this.unlock("golden");
    const n = this.n;
    n.goldenWatch = false;
    n.goldenInOffice = true;
    this.sp.golden.setVolume(100);
    this.sp.golden.play("Golden", "golden-freddy_robotic-voice-fnaf-1-made-with-Voicemod");
    this.scripts.run("golden", function* () {
      yield 5;
      if (n.goldenInOffice) this.creepyEnd(true);
    }.call(this));
  }

  /* --------------------------------------------------------------
     The dance on the stage camera at 5 AM (ends the night early)
     -------------------------------------------------------------- */
  startDance() {
    this.unlock("dance");
    const n = this.n;
    this.sp.dance.play("dance", "Download (5)");
    this.scripts.run("dance", function* () {
      for (let i = 1; i <= 91; i++) { n.dance = i; yield 0.05; yield; }
      n.dance = 0;
      this.sixAM();
    }.call(this));
  }

  /* --------------------------------------------------------------
     Every update of the night
     -------------------------------------------------------------- */
  updateNight() {
    const n = this.n, m = this.mouse;
    if (n.frozen) return;                       // 6 AM: the office just sits there
    if (n.jumpscare) return this.updateJumpscare();
    this.updateClock();
    if (n.frozen || this.screen !== "night") return;
    n.hallFlicker = rand(1, 10);
    if (this.tick % 2 === 0) n.twitch = rand(1, 30);

    // looking around the office: the closer the mouse is to the edge, the faster
    if (!n.monitorUp && !n.monitorFrame) {
      const dx = m.x - 240;
      let pan = this.smooth.get("pan"), speed = 0;
      if (Math.abs(dx) > 150) speed = 10; else if (Math.abs(dx) > 50) speed = 5; else if (Math.abs(dx) > 20) speed = 2;
      pan -= Math.sign(dx) * speed;
      this.smooth.set("pan", Math.max(-60, Math.min(60, pan)));
    }
    if (!n.monitorUp && !n.powerOut) n.fanFrame = n.fanFrame % 9 + 1;      // fan blades spin

    this.updateOfficePicture();
    this.updateWindowScare();
    this.updateFlipBar();
    this.updateNightSounds();
    this.updatePhone();
    if (n.placingTrap && !n.monitorUp) n.placingTrap = false;     // put the monitor down: no trap set
    if (this.tick % 15 === 0) this.noteSeen();
    if (this.n.hallucA !== undefined) {
      n.hallucination = (n.hallucA === 1 && chance(10)) ? n.hallucPic : null;
    }

    for (const c of this.clicks) this.nightClick(c.x, c.y);
    for (const k of this.keys) {
      if (k === "space" && !n.powerOut && (n.monitorFrame === 0)) this.flipMonitor();
    }
  }

  // The office picture: lights, who is at the window, and the flicker
  updateOfficePicture() {
    const n = this.n;
    if (n.powerOut) return;
    const flick = () => (this.tick % 5 === 4 ? "normal2" : "normal");        // the room light flickers
    if (n.leftLight) n.officePic = n.hallFlicker > 1 ? (n.bonnie.at === "Ready to Attack" ? "left light bonnie" : "left light on") : flick();
    else if (n.rightLight) n.officePic = n.hallFlicker > 1 ? (n.chica.at === "Ready to Attack" ? "right light chica" : "right light on") : flick();
    else n.officePic = flick();
  }

  // Seeing someone at the window for the first time plays a sting
  updateWindowScare() {
    const n = this.n;
    if (n.bonnie.at !== "Ready to Attack") n.scareLeft = true;
    if (n.chica.at !== "Ready to Attack") n.scareRight = true;
    if (n.leftLight && n.bonnie.at === "Ready to Attack" && n.scareLeft) { n.scareLeft = false; this.sp.nose.play("nose", "windowscare"); }
    else if (n.rightLight && n.chica.at === "Ready to Attack" && n.scareRight) { n.scareRight = false; this.sp.nose.play("nose", "windowscare"); }
  }

  // The bar at the bottom: move the mouse over it to flip the monitor
  // (you have to move off it, above it, before it works again)
  updateFlipBar() {
    const n = this.n, m = this.mouse;
    if (n.powerOut || n.monitorFrame) return;
    const bar = pic("flip panel", "flip down");
    const touching = hits(bar, 205, 295, 45, m.x, m.y);
    if (!n.flipArmed) {
      if (!touching && m.y < 295) n.flipArmed = true;
    } else if (touching) {
      n.flipArmed = false;
      this.flipMonitor();
    }
  }

  nightClick(x, y) {
    const n = this.n, pan = this.smooth.get("pan");
    // mute call button
    // the call banner: pick up or hang up
    const pb = this.phoneBox();
    if (n.phone !== "off" && x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) { this.phoneTap(); return; }
    if (n.camsUp) {
      // camera buttons on the map
      for (const cam of CAMERAS) {
        if (!hits(pic(cam.button, "Inactive"), cam.x, cam.y, 40, x, y)) continue;
        if (n.placingTrap) return this.placeTrap(cam);         // setting the bear trap
        this.switchCamera(cam.room); return;
      }
      return;
    }
    if (n.monitorUp || n.monitorFrame || n.powerOut) return;
    // the button panels next to the doors: top button = door, bottom button = light
    const left = pic("left button panel", this.panelPic(n.leftDoor, n.leftLight));
    if (hits(left, 240 + pan, 180, 125, x, y)) return this.pressButton("left", y);
    const right = pic("right button panel", this.panelPic(n.rightDoor, n.rightLight));
    if (hits(right, 515 + pan, 204, 34, x, y)) return this.pressButton("right", y);
    // boop the poster's nose
    if (hits(pic("nose", "normal"), 240 + pan, 180, 125, x, y)) { this.sp.nose.play("nose", "PartyFavorraspyPart_AC01__3"); this.unlock("boop"); }
  }
  panelPic(door, light) {
    return door && light ? "both on" : door ? "door on" : light ? "light on" : "both off";
  }
  pressButton(side, y) {
    const n = this.n;
    const someoneIn = (side === "left" ? n.bonnie : n.chica).at === "Got You";
    const door = side + "Door", light = side + "Light", other = (side === "left" ? "right" : "left") + "Light";
    if (y > 205) {                                  // light button
      if (n[light]) n[light] = false;
      else if (someoneIn) this.sp.nose.play("nose", "error");
      else { n[light] = true; n[other] = false; }
    } else if (y < 198) {                           // door button
      if (n[door]) { n[door] = false; this.sp.doors.play("Door L", "SFXBible_12478"); }
      else if (someoneIn) this.sp.nose.play("nose", "error");
      else { n[door] = true; this.sp.doors.play("Door L", "SFXBible_12478"); }
    }
  }

  /* --------------------------------------------------------------
     POWER OUT: everything shuts off, then Eddie plays his music box
     -------------------------------------------------------------- */
  powerOut() {
    this.unlock("power");
    const n = this.n, sp = this.sp;
    if (n.monitorUp || n.monitorFrame) {
      if (n.monitorFrame !== 1) { sp.flip.setVolume(100); sp.flip.play("flip panel", "put down"); }
    }
    n.monitorUp = n.camsUp = false;
    n.monitorFrame = 0;
    n.powerOut = true;
    n.power = 0;
    n.leftDoor = n.rightDoor = n.leftLight = n.rightLight = false;
    n.officePic = "power out";
    n.blackout = false;
    n.hallucination = null;
    // the AI stops (they are coming anyway)
    this.scripts.stop("bonnie", "chica", "foxy", "freddy", "halluc", "breath", "golden", "phone", "ring", "monitor");
    n.phone = "off";
    n.goldenInOffice = false;
    for (const s of ["office", "lights", "map", "kitchen", "redDot", "breath", "golden", "pirate", "phone", "westHall"]) sp[s].stopAll();
    sp.fan.play("fan", "ambience2", { loop: true });
    sp.power.play("Power Left %", "powerdown");
    this.scripts.run("powerout", function* () {
      yield 5 * rand(1, 4);
      yield 5;
      // Eddie's face flickers in the dark door while his music box plays
      this.footsteps("closer");
      this.scripts.run("jingle", function* () {
        for (;;) { yield 0.05; n.officePic = chance(4) ? "power out freddy" : "power out"; }
      }.call(this));
      sp.redDot.setVolume(100);
      const box = sp.redDot.play("red dot", "music box");
      yield () => box.done;
      this.scripts.stop("jingle");
      n.officePic = "po out";
      yield 0.1;
      // lights flicker, then total darkness
      for (let i = 0; i < 10; i++) {
        if (chance(2)) { n.officePic = "power out"; sp.office.setVolume(100); sp.office.play("office", "Buzz_Fan_Florescent2"); }
        else { n.officePic = "Blackout"; sp.office.setVolume(0); }
        yield;
      }
      n.officePic = "Blackout";
      Sound.stopAll();
      yield 5 * rand(1, 4);
      this.footsteps("very close");
      yield 5;
      this.jumpscare("Eddie");
    }.call(this));
  }

  /* --------------------------------------------------------------
     JUMPSCARES
     -------------------------------------------------------------- */
  jumpscare(who) {
    const n = this.n;
    if (this.panSave(who)) return;              // the frying pan (shop item): BONK, you live
    // the night stops: nobody moves, the clock stops
    this.scripts.stop("night", "bonnie", "chica", "foxy", "freddy", "halluc", "breath", "golden", "powerout", "jingle", "dance", "phone", "ring");
    n.hallucination = null;
    n.phone = "off";
    this.killer = { Bonnie: "Bonnie", Chica: "Chica", Foxy: "Foxy", Eddie: "Freddy" }[who];
    this.killedByPowerOut = !!n.powerOut;          // (the guide after: power out, not Eddie's walk)
    this.caughtBy(this.killer);
    if (settings.jumpscares !== "1") return this.dead();
    this.sp.halluc.setVolume(100);
    this.sp.halluc.play("hallucinations", "XSCREAM2");
    // which frames play, in order (the same picks as the original animation)
    let frames;
    if (who === "Bonnie") frames = [].concat(...[1, 2, 3].map(() => [1, 3, 5, 7, 9, 11])).map(i => `ScareBonnie (${i})`);
    if (who === "Chica") frames = [].concat(...[1, 2, 3].map(() => [2, 4, 6, 8, 10, 12, 14])).map(i => `Chica_Scare (${i})`);
    if (who === "Foxy") frames = [1, ...Array.from({ length: 20 }, (_, i) => i + 1)].map(i => `FoxyScare (${i})`);
    if (who === "Eddie") frames = [...Array(30).fill("costume2"), "costume3"];
    n.jumpscare = { who, frames, i: 0 };
  }
  updateJumpscare() {
    const j = this.n.jumpscare;
    j.i++;
    if (j.i >= j.frames.length) { this.n.jumpscare = null; this.dead(); }
  }

  /* --------------------------------------------------------------
     DEATH: "game over" screen, then back to the title
     -------------------------------------------------------------- */
  dead() {
    this.died = true;              // the phone guy stops calling until you win a night
    this.go("black");
    Sound.stopAll();
    const js = settings.jumpscares === "1";
    this.scripts.run("gameover", function* () {
      // the VHS STOP screen and the survival guide (vhs.js, guide.js)
      yield* this.playGuide(this.killer, this.killedByPowerOut);
      const card = this.overlay("Backdrop", js ? "mike stuffed" : "NoJS" + this.killer, { fade: 0 });
      // a tiny chance of something worse while you look at it
      this.scripts.run("gameover", function* () {
        for (let i = 0; i < 10; i++) { yield 1; if (chance(10000)) return this.creepyEnd(); }
      }.call(this));
      yield* this.fade(card, 1);
      yield js ? 15 : 3;
      this.showTitle();
    }.call(this));
  }

  // The blue VHS screen: STOP, then the guide's slides (until EJECT or SKIP)
  *playGuide(killer, powerOut) {
    const { name, slides } = deathGuide(killer, powerOut);
    const g = new VhsGuide(name, slides);
    this.sp.monitor.setVolume(100);
    this.sp.monitor.play("moniter", "MiniDV_Tape_Eject_1");     // the tape stopping
    this.sp.vhs.play("VHS", "Self", { loop: true });
    const L = { draw: ctx => g.draw(ctx) };
    this.layers.push(L);
    yield () => g.step(this.clicks, this.keys);
    this.sp.vhs.stopAll();
    this.removeOverlay(L);
  }

  // Golden's scream: the game shuts down (back to the title)
  creepyEnd(guide) {
    this.go("black");
    Sound.stopAll();
    this.sp.halluc.setVolume(100);
    this.sp.halluc.play("hallucinations", "XSCREAM2");
    this.overlay("hallucinations", settings.jumpscares === "1" ? "Golden Freddy" : "NoJSGFreddy");
    this.scripts.run("creepy", function* () {
      yield 1; Sound.stopAll(); this.layers = []; yield 2;
      if (guide) yield* this.playGuide("Golden");       // (he got you in the office: how to beat him)
      this.showTitle();
    }.call(this));
  }

  /* --------------------------------------------------------------
     6 AM: the clock rolls over and the night is won
     -------------------------------------------------------------- */
  sixAM() {
    const n = this.n;
    // the night stops but stays on screen for 3 seconds under the 6 AM card
    this.scripts.stop("night", "bonnie", "chica", "foxy", "freddy", "halluc", "breath", "golden", "powerout", "jingle", "dance", "phone", "ring", "monitor", "blackout");
    if (n) { n.hallucination = null; n.frozen = true; n.phone = "off"; this.smooth.jump("phoneShow", 0); }
    Sound.stopAll();
    this.died = false;
    const sp = this.sp;
    sp.sixAm.play("6am back", "chimes 2");
    const roll = this.overlay("6am back", "slide", { x: 220, y: 197, fade: 0 });
    const card = this.overlay("6am fore", "am5", { fade: 0 });
    // the 5 rolls up into a 6 behind the window of the card
    this.scripts.run("6am", function* () {
      yield* this.fade(card, 1);
      roll.setFade(1);
      card.pic = pic("6am fore", "am");
      yield 3;
      card.pic = pic("6am fore", "am6");
      yield 2;
      yield* this.fade(card, 0);
      yield 2;
      this.nightWon();
    }.call(this));
    this.scripts.run("6am", function* () {
      yield () => roll.fade === 1;
      const key = "slide" + roll.key;
      this.smooth.jump(key, 197);
      roll.draw = (ctx, a) => draw(ctx, roll.pic, 220, this.smooth.at(key, a), { alpha: roll.fade });
      for (let t = TICK; t < 3; t += TICK) { this.smooth.set(key, 197 - 38 * t / 3); yield; }
      this.smooth.set(key, 159);
      sp.sixAm.play("6am back", "CROWD_SMALL_CHIL_EC049202");
      this.removeOverlay(roll);
    }.call(this));
    this.scripts.run("6am", function* () {
      yield 3;
      if (this.screen === "night") this.screen = "black";      // the office disappears
    }.call(this));
  }

  nightWon() {
    const L = this.level;
    // achievements for surviving
    if (L <= 6) this.unlock("night" + L);
    if (this.n && this.n.power >= 300) this.unlock("frugal");
    // Story Mode: the database adds EXP; nights 1-4 go straight to the pop-up, 5+ show their ending first
    if (Story.on) {
      this.storyWin = Story.win(TAPE, L);
      this.storyWin.catch(() => {});
      if (L < 5) return this.showTitle();
    }
    else if (Demo.on()) return this.demoEnd();     // demo: Night 1 is the end
    if (L < 5) { this.level = L + 1; return this.startIntro(); }
    if (L === 5) { this.progress.beat5 = true; return this.ending("beat5"); }
    if (L === 6) { this.progress.beat6 = true; return this.ending("beat6"); }
    // custom night (night 7): 20/20/20/20 earns the last star
    const ai = this.customAI || {};
    if (ai.freddy > 19 && ai.bonnie > 19 && ai.chica > 19 && ai.foxy > 19) { this.progress.beat420 = true; this.unlock("max"); }
    if (ai.freddy <= 3 && ai.bonnie <= 3 && ai.chica <= 3 && ai.foxy <= 3) this.unlock("easy");
    return this.ending("pink slip");
  }

  /* =================================================================
     STORY MODE (?save=story&data=N, see Story in tools/global.js)
     No title screen: the night in data starts right away (7 = custom
     night, picked on the custom screen). When the round ends (won, lost
     or backed out) the pop-up asks: back to the hub, or continue / retry.
     ================================================================= */
  async storyBoot() {
    this.go("black");
    if (!(await Story.start(TAPE))) return;           // not signed in or not unlocked: back to the hub
    this.storyWin = null;
    this.died = false;
    if (Story.night === 7) return this.showCustom();
    this.level = Story.night;
    this.startIntro();
  }
  // called instead of the title screen in Story Mode
  storyDone() {
    if (this.storyOver) return;
    this.storyOver = true;
    const quit = this.screen === "custom";             // backed out of the custom night screen
    this.go("black");
    Sound.stopAll();
    Story.after(TAPE, !!this.storyWin, this.storyWin, quit);
  }

  // DEMO: after Night 1, "end of the demo" with the countdown, then the title
  demoEnd() {
    this.save();
    this.go("black");
    const card = this.overlay(null, null, { fade: 0, paint: ctx => {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 480, 360);
      ctx.textAlign = "center"; ctx.fillStyle = "#fff";
      ctx.font = '22px "VCR OSD Mono"'; ctx.fillText(ACH_WORD("END OF THE DEMO"), 240, 140);
      ctx.font = '12px "Share Tech Mono"';
      ctx.fillText(ACH_WORD("Thanks for playing Night 1!"), 240, 172);
      ctx.fillText(ACH_WORD("The full game opens") + " " + Demo.releaseText, 240, 194);
      ctx.fillStyle = "#f7931e"; ctx.fillText(Demo.left(), 240, 222);
      ctx.fillStyle = "#777"; ctx.font = '9px "Share Tech Mono"'; ctx.fillText(ACH_WORD("click to go back"), 240, 300);
    } });
    this.scripts.run("ending", function* () {
      yield* this.fade(card, 1);
      yield 1;
      let t = 0;
      yield () => (t += TICK) > 20 || this.clicks.length > 0;
      yield* this.fade(card, 0);
      this.showTitle();
    }.call(this));
  }

  // The paycheck / pink slip screens after nights 5, 6 and 7
  ending(name) {
    this.save();
    this.go("black");
    this.sp.redDot.setVolume(100);
    this.scripts.run("ending", function* () {
      const h = this.sp.redDot.play("red dot", "kitchen");
      yield () => h.done;
      this.sp.redDot.play("red dot", "kitchen");
    }.call(this));
    const card = this.overlay("Backdrop", name, { fade: 0 });
    this.scripts.run("ending", function* () {
      yield* this.fade(card, 1);
      yield 25;
      yield* this.fade(card, 0);
      this.showTitle();
    }.call(this));
  }

  /* =================================================================
     CUSTOM NIGHT
     ================================================================= */
  showCustom() {
    if (Global.storyOnly()) return;          // parental: story mode only
    this.go("custom");
    if (!this.customPick) this.customPick = [1, 2, 2, 7];      // Eddie, Weddy, Cheddy, Endo
    this.smooth.jump("customFade", 0);
    this.customHold = 0;
    this.scripts.run("custom", function* () {
      for (let i = 1; i <= 50; i++) { this.smooth.set("customFade", i / 50); yield; }
    }.call(this));
  }

  updateCustom() {
    const m = this.mouse;
    // hold the mouse on an arrow: the number goes down (left half) or up (right half) every 0.1 s
    const arrowsX = [85, 190, 290, 395];
    if (m.down) {
      this.customHold -= TICK;
      if (this.customHold <= 0) {
        arrowsX.forEach((x, i) => {
          if (!hits(pic("ai set", "ai set"), x, 220, 25, m.x, m.y)) return;
          if (m.x < x && this.customPick[i] > 0) this.customPick[i]--;
          if (m.x > x && this.customPick[i] < 20) this.customPick[i]++;
          this.customHold = 0.1;
        });
      }
    } else this.customHold = 0;
    this.backHover = m.x < 70 && m.y < 34;                // the "< BACK" button, top left
    for (const c of this.clicks) {
      if (this.backHover) { this.sp.blip.play("new game", "blip3"); return this.showTitle(); }
      if (hits(pic("Ready", "active"), 415, 290, 50, c.x, c.y)) return this.startCustomNight();
    }
    for (const k of this.keys) if (k === "enter") return this.startCustomNight();
  }

  startCustomNight() {
    const [fr, bo, ch, fo] = this.customPick;
    this.customAI = { freddy: fr, bonnie: bo, chica: ch, foxy: fo };
    this.level = 7;
    const code = this.customPick.join("/");
    if (code === "1/9/8/7") { this.customPick = [1, 2, 2, 7]; return this.creepyEnd(); }
    if (code === "1/2/2/7") {
      this.unlock("fired");
      // the joke code: you're fired before the night even starts
      this.customPick = [1, 2, 2, 7];
      this.go("black");
      this.sixAM();
      this.sp.backdrop.play("Backdrop", "shimmy-shimmy-yay-made-with-Voicemod", { loop: true });
      const slip = this.overlay("Backdrop", "pink slip2");
      this.layers.push(this.layers.splice(this.layers.indexOf(slip), 1)[0]);     // keep it on top
      this.scripts.run("6am", function* () {
        for (;;) { yield; const i = this.layers.indexOf(slip); if (i >= 0 && i !== this.layers.length - 1) this.layers.push(this.layers.splice(i, 1)[0]); }
      }.call(this));
      return;
    }
    this.startIntro();
  }

  drawCustom(ctx, a) {
    const f = this.smooth.at("customFade", a);
    draw(ctx, pic("Backdrop", "custom night"), 240, 180, { alpha: f });
    const arrowsX = [85, 190, 290, 395], tensX = [85, 185, 285, 390], onesX = [100, 200, 300, 405];
    this.customPick.forEach((v, i) => {
      draw(ctx, pic("ai set", "ai set"), arrowsX[i], 220, { size: 25, alpha: f });
      const s = String(v);
      if (v > 9) draw(ctx, pic("Custom10", s[0]), tensX[i], 220, { size: 40, alpha: f });
      draw(ctx, pic("Custom01", v > 9 ? s[1] : s[0]), onesX[i], 220, { size: 40, alpha: f });
    });
    draw(ctx, pic("Ready", "active"), 415, 290, { size: 50, alpha: f });
    // "< BACK" in the top left corner (goes back to the title)
    ctx.save();
    ctx.globalAlpha = f;
    ctx.fillStyle = this.backHover ? "#f7931e" : "#fff";
    ctx.beginPath(); ctx.moveTo(10, 17); ctx.lineTo(19, 10); ctx.lineTo(19, 24); ctx.closePath(); ctx.fill();   // the arrow
    ctx.font = '10px "Share Tech Mono"'; ctx.textBaseline = "middle";
    ctx.fillText(ACH_WORD("BACK"), 24, 17.5);
    ctx.restore();
  }

  /* =================================================================
     DRAWING THE NIGHT
     ================================================================= */
  drawNight(ctx, a) {
    const n = this.n;
    const pan = this.smooth.at("pan", a);
    const ox = 240 + pan;                     // where the middle of the office is on screen
    if (n.jumpscare && n.jumpscare.who === "Eddie") {
      // Eddie's jumpscare covers the screen
      draw(ctx, pic("office", n.powerOut ? "Blackout" : n.officePic), ox, 180, { size: 125 });
      draw(ctx, pic("Eddie", n.jumpscare.frames[n.jumpscare.i]), 240, 180, { size: 64.23 });
      return;
    }
    if (!n.camsUp) {
      // ---- the office ----
      draw(ctx, pic("office", n.officePic), ox, 180, { size: 125 });
      if (!n.powerOut) {
        if (n.leftDoor) draw(ctx, pic("Door L", "DoorL (13)"), ox - 235, 176, { size: 86.02 });
        if (n.rightDoor) draw(ctx, pic("Door R", "DoorR (13)"), ox + 223, 174, { size: 78 });
        draw(ctx, pic("left button panel", this.panelPic(n.leftDoor, n.leftLight)), ox, 180, { size: 125 });
        draw(ctx, pic("right button panel", this.panelPic(n.rightDoor, n.rightLight)), ox + 275, 204, { size: 34 });
        draw(ctx, pic("fan", "fan" + n.fanFrame), ox, 180, { size: 125 });
      }
      if (n.goldenInOffice) draw(ctx, pic("Golden", "YellowBear"), ox - 50, 220, { size: 50 });
    } else {
      // ---- the cameras ----
      const room = n.camera;
      const x = room === "Supply Closet" ? 300 : 240 + this.smooth.at("camPan", a);
      draw(ctx, pic(ROOM_ART[room], this.roomPicture(room)), x, 180, { size: 125 });
      if (n.blackout) draw(ctx, pic("Black", "blank"), 240, 180);
      draw(ctx, pic("border", "white rectangle"), 240, 180);
      draw(ctx, pic("map", n.mapBlink ? "dot big" : "dot small"), 390, 240, { size: 40 });
      const blink = Math.floor(this.tick / 15) % 2 === 0;
      for (const cam of CAMERAS) draw(ctx, pic(cam.button, cam.room === room && blink ? "Active" : "Inactive"), cam.x, cam.y, { size: 40 });
      this.drawItemsOnMap(ctx);                  // bear trap + x-ray glasses (shop items)
      if (n.redDot) draw(ctx, pic("red dot", "blinking"), 35, 85, { size: 40 });
      // which camera this is, next to the red recording dot ("CAM 1A  Show Stage")
      const cam = CAMERAS.find(c => c.room === room);
      ctx.save();
      ctx.font = '9px "Pixel"';
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#000"; ctx.shadowBlur = 2;
      ctx.fillText(ACH_WORD("CAM") + " " + cam.button.replace("CAM", "") + "   " + ACH_WORD(room), 48, 86);
      ctx.restore();
    }
    // monitor flipping up or down
    if (n.monitorFrame) draw(ctx, pic("moniter", `Moniter (${n.monitorFrame})`), 240, 180);
    this.drawNightInfo(ctx, a);
    if (n.dance) draw(ctx, picAt("dance", n.dance), 240, 180, { size: 160 });
    // creepy one-frame faces
    if (n.hallucination) draw(ctx, picAt("hallucinations", n.hallucination), 240, 180);
    // jumpscare on top of everything
    if (n.jumpscare) {
      const g = n.jumpscare.who;
      draw(ctx, pic(g, n.jumpscare.frames[n.jumpscare.i]), ox, 180, { size: 125 });
    }
  }

  // Clock, night number, power and usage, the flip bar and the mute button
  drawNightInfo(ctx, a) {
    const n = this.n;
    if (n.powerOut) return;
    draw(ctx, pic("time AM", n.hour === 0 ? "12am" : n.hour + "am"), 456, 64, { size: 40 });
    draw(ctx, pic("night", "text"), 440, 75, { size: 40 });
    draw(ctx, pic("level", String(this.level)), 460, 75, { size: 40 });
    draw(ctx, pic("Power Left %", "text"), 40, 285, { size: 40 });
    const pct = Math.max(0, Math.floor(n.power / 10));
    if (pct >= 10) {
      draw(ctx, pic("Power 10", String(Math.floor(pct / 10))), 75, 285, { size: 55 });
      draw(ctx, pic("Power 01", String(pct % 10)), 83, 285, { size: 55 });
    } else draw(ctx, pic("Power 01", String(pct)), 83, 285, { size: 55 });
    draw(ctx, pic("Usage word", "text"), 28, 297, { size: 40 });
    draw(ctx, pic("Usage Bars", "Usage" + Math.min(6, this.usage())), 65, 298, { size: 40 });
    if (n.flipArmed && !n.monitorFrame) draw(ctx, pic("flip panel", "flip down"), 205, 295, { size: 45, bright: -10 });
    this.drawPhone(ctx, a);
  }

  /* =================================================================
     THE JOURNAL (pause menu > JOURNAL, see pause.js)
     ================================================================= */
  // Remember who you've met (their journal page opens up)
  noteSeen() {
    const n = this.n, p = this.progress, seen = new Set();
    if (n.camsUp) {
      for (const [k, key] of [["bonnie", "Bonnie"], ["chica", "Chica"], ["freddy", "Freddy"]]) if (n[k].at === n.camera) seen.add(key);
      if ((n.camera === "Pirate Cove" && n.foxy.stage >= 2) || (n.camera === "West Hall" && n.foxy.stage >= 5)) seen.add("Foxy");
    } else {
      if (n.leftLight && n.bonnie.at === "Ready to Attack") seen.add("Bonnie");
      if (n.rightLight && n.chica.at === "Ready to Attack") seen.add("Chica");
    }
    if (n.goldenInOffice) seen.add("Golden");
    let added = false;
    for (const k of seen) if (!p.seen.includes(k)) { p.seen.push(k); added = true; }
    if (added) this.save();
  }
  met(key) { return this.progress.seen.includes(key) || this.progress.caughtBy.includes(key); }

  journal() {
    const n = this.n, p = this.progress, W1 = ACH_WORD;
    const label = c => c.button.replace("CAM", "");
    // a little camera map with some rooms lit up
    const map = rooms => ({ cams: CAMERAS.map(c => ({ x: c.x, y: c.y, label: label(c), on: rooms.includes(c.room) })), you: { x: 387, y: 300 } });
    const face = k => journalPicture((g, s) => k ? this.drawFace(g, k, s / 2, s / 2, s) : draw(g, pic("Golden", "YellowBear"), s / 2, s / 2 + 10, { size: 45 }));
    const E = (k, name, sub, route, rooms, counters, text, tip) =>
      ({ name: W1(name), sub: W1(sub), img: face(k), route, counters, map: map(rooms), text, tips: tip ? [tip] : [] });
    const entities = [
      E("bonnie", "Weddy", "Left side", ["Stage", "Dining / Backstage", "West Hall", "Corner / Closet", "LEFT DOOR"],
        ["Show Stage", "Dining Area", "Backstage", "West Hall", "W. Hall Corner", "Supply Closet"],
        [["light", "Left light"], ["door", "Left door"]],
        ["Wanders down the LEFT side to your left doorway.", "Check the left light. If she's standing there, shut the left door until she leaves."],
        "If the left buttons stop working, she's already inside."),
      E("chica", "Cheddy", "Right side", ["Stage", "Dining", "Kitchen / Restrooms", "East Hall", "E. Corner", "RIGHT DOOR"],
        ["Show Stage", "Dining Area", "Kitchen", "Restrooms", "East Hall", "E. Hall Corner"],
        [["light", "Right light"], ["door", "Right door"]],
        ["Wanders down the RIGHT side to your right doorway.", "Check the right light. If she's standing there, shut the right door until she leaves."],
        "If the right buttons stop working, she's already inside."),
      E("freddy", "Eddie", "The leader", ["Stage", "Dining", "Restrooms", "Kitchen", "East Hall", "E. Corner", "RIGHT DOOR"],
        ["Show Stage", "Dining Area", "Restrooms", "Kitchen", "East Hall", "E. Hall Corner"],
        [["eye", "Watch him"], ["door", "Right door"]],
        ["Waits until Weddy AND Cheddy leave the stage. Never moves while you watch his camera.", "Listen for his laugh: it means he moved."],
        "At the E. Hall Corner, shut the right door before you switch cameras."),
      E("foxy", "Endo", "Pirate Cove", ["Pirate Cove", "West Hall", "LEFT DOOR"], ["Pirate Cove", "West Hall"],
        [["cam", "Check the cove"], ["door", "Left door"]],
        ["Hides behind the curtain. Looking at the cameras keeps him there longer.", "Once he's out, he RUNS down the West Hall to your left door."],
        "Every bang on the shut door costs you power."),
      E(null, "Golden Eddie", "Very rare", ["W. Corner poster", "YOUR OFFICE"], ["W. Hall Corner"],
        [["monitor", "Lift the monitor"]],
        ["A strange poster in the W. Hall Corner. Put the monitor down and he's sitting in your office."],
        "Lift the monitor back up within 5 seconds."),
    ];
    const mech = [
      { name: W1("Power"), pix: "power", text: ["Doors, lights and cameras all use power. The bars at the bottom left show how much right now.", "Hit 0% and the lights go out."],
        tips: ["Check, react, open again. Don't keep doors shut 'just in case'."] },
      { name: W1("Doors"), pix: "door", text: ["The top button by each door shuts it. Nobody gets through a shut door, but it drains a lot of power."] },
      { name: W1("Lights"), pix: "light", text: ["The bottom button by each door lights the doorway, so you can see who's there."] },
      { name: W1("Cameras"), pix: "monitor", text: ["SPACE (or the bar at the bottom) lifts the monitor. Click a camera on the map to look.", "The night moves a little faster while it's up."] },
      { name: W1("The clock"), pix: "clock", text: ["12 AM to 6 AM, 90 seconds an hour. Everyone gets more active at 2, 3 and 4 AM."] },
      { name: W1("Phone calls"), pix: "phone", text: ["On nights 1 to 5 the phone rings at the start. Pick up for advice, or hang up."] },
      { name: W1("Power out"), pix: "skull", text: ["Everything shuts off and the doors open. Eddie's song plays in the left doorway, then he comes in."],
        tips: ["Nothing stops him now. Hope 6 AM comes first (or use a battery pack)."] },
    ];
    const WHO = {
      "Show Stage": "Weddy, Cheddy and Eddie start here.", "Entrance": "Nobody walks through here.",
      "Dining Area": "Weddy, Cheddy and Eddie.", "Pirate Cove": "Endo's curtain.",
      "West Hall": "Weddy, and Endo when he runs.", "W. Hall Corner": "Weddy, right before your LEFT door.",
      "Supply Closet": "Weddy, right before your LEFT door.", "East Hall": "Cheddy and Eddie.",
      "E. Hall Corner": "Cheddy and Eddie, right before your RIGHT door.", "Backstage": "Weddy.",
      "Kitchen": "Cheddy and Eddie.", "Restrooms": "Cheddy and Eddie.",
    };
    const cams = [{ name: W1("The map"), pix: "cam", map: map([]), text: ["Your office is the red square. The left hall leads to your LEFT door, the right hall to your RIGHT door."],
        tips: ["Watching the cameras keeps Endo behind his curtain longer."] },
      ...CAMERAS.map(c => ({ name: W1("CAM") + " " + label(c) + "  " + W1(c.room), pix: "cam", map: map([c.room]), text: [WHO[c.room] || ""] }))];
    const tonight = [];
    const TIP = { bonnie: "left light, left door", chica: "right light, right door", freddy: "watch the E. Hall Corner", foxy: "peek at Pirate Cove" };
    if (n) for (const k of ["bonnie", "chica", "freddy", "foxy"]) if (n.ai[k] > 0) tonight.push([this.itemName(k), W1(TIP[k])]);
    const got = countedAchievements(p.achievements);
    const summary = [
      { name: W1("Tonight"), pix: "clock", sub: n ? (this.level > 6 ? W1("Custom Night") : W1("Night") + " " + this.level) + "  ·  " + (n.hour === 0 ? 12 : n.hour) + " AM  ·  " + Math.max(0, Math.floor(n.power / 10)) + "% " + W1("power") : "",
        text: [tonight.length ? W1("Who's moving tonight:") : W1("Nobody is moving tonight. Just watch your power.")], list: tonight },
      { name: W1("Quick rules"), pix: "star", list: [
          [W1("LEFT side"), W1("Weddy and Endo")], [W1("RIGHT side"), W1("Cheddy and Eddie")],
          [W1("Doors"), W1("stop them, but drain power")], [W1("Lights"), W1("show who's at the door")],
          [W1("0% power"), W1("lights out, Eddie comes")], [W1("6 AM"), W1("you win")]] },
      { name: W1("Your file"), pix: "eye", sub: Story.on ? W1("Story Mode") : W1("Save file") + " " + this.file, list: [
          [W1("Night reached"), String(p.night)], [W1("Stars"), "★".repeat((p.beat5 ? 1 : 0) + (p.beat6 ? 1 : 0) + (p.beat420 ? 1 : 0)) || "-"],
          [W1("Achievements"), got + " / " + COUNTED_ACHIEVEMENTS.length], [W1("Caught by"), p.caughtBy.map(k => W1(GUIDE_NAMES[k] || k)).join(", ") || "-"]] },
    ];
    return {
      title: W1("Journal") + "  ·  " + W1("Tape 1"),
      chapters: [
        { id: "entities", name: W1("Entities"), entries: entities },
        { id: "mechanics", name: W1("Mechanics"), entries: mech },
        journalItems({ battery: ["Tape 1: it even brings the power back after a power out."], trap: ["Tape 1: click a camera on the map. Endo gets caught in the West Hall."] }),
        { id: "cameras", name: W1("Cameras"), entries: cams },
        { id: "summary", name: W1("Summary"), entries: summary },
      ],
    };
  }

  /* =================================================================
     SHOP ITEMS (bought in the Story Mode hub, see ITEMS in global.js)
     ================================================================= */
  // What the item bar shows under an item: null = can't use it now
  itemNote(id) {
    const n = this.n;
    if (this.screen !== "night" || !n || n.frozen || n.jumpscare) return null;
    if (id === "stopwatch") return n.stopwatchUsed ? null : "";
    if (id === "glasses") return n.glassesUntil > n.time ? Math.ceil(n.glassesUntil - n.time) + "s" : "";
    if (id === "trap") return n.trap ? "SET" : n.placingTrap ? "PICK" : n.powerOut ? null : "";
    return "";
  }
  // Use an item: true = used (take one), false = not now, "later" = taken when it is placed
  useItem(id) {
    const n = this.n;
    if (this.itemNote(id) === null) return false;
    if (id === "stopwatch") {
      n.stopwatchUsed = true;
      n.clock += 90;                                     // one whole hour (the clock moves on next update)
      Items.sfx("tick");
      ItemBar.say(ACH_WORD("Stopwatch: one hour skipped!"));
      return true;
    }
    if (id === "battery") {
      if (n.powerOut) this.powerBack();
      n.power = 999;
      Items.sfx("power");
      ItemBar.say(ACH_WORD("Battery pack: power back to 100%!"));
      return true;
    }
    if (id === "glasses") {
      n.glassesUntil = n.time + 30;
      ItemBar.say(ACH_WORD("X-ray glasses on for 30 seconds: look at the camera map!"));
      return true;
    }
    if (id === "trap") {
      if (n.trap) { ItemBar.say(ACH_WORD("A bear trap is already set.")); return false; }
      n.placingTrap = true;
      if (!n.monitorUp && !n.monitorFrame) this.flipMonitor();
      ItemBar.say(ACH_WORD("Click a camera on the map to set the bear trap there."));
      return "later";
    }
    if (id === "horn") { this.airHorn(); return true; }
    return false;
  }

  // the names the player sees
  itemName(k) { return ACH_WORD({ bonnie: "Weddy", chica: "Cheddy", freddy: "Eddie", foxy: "Endo" }[k]); }

  // Send someone back to the start (and keep them there `stun` seconds)
  sendHome(k, stun = 0) {
    const n = this.n;
    if (k === "bonnie" || k === "chica") {
      n[k].at = "Show Stage"; n[k].spot = k === "bonnie" ? 2 : 1;
      if (k === "bonnie") n.leftLight = false; else n.rightLight = false;
      this.scripts.stop(k);
      if (k === "bonnie") this.runBonnie(); else this.runChica();
    }
    if (k === "freddy") {
      n.freddy.at = "Show Stage";
      this.sp.westHall.stopAll();
      this.scripts.stop("freddy");
      this.runFreddy();
    }
    if (k === "foxy") {
      n.foxy.stage = 1; n.foxy.cooldown = randFloat(5, 17.5); n.foxyRunFrame = 0;
      this.scripts.stop("foxy", "foxy run");
      this.runFoxy();
    }
    n[k].stunUntil = n.time + stun;
  }

  // The frying pan: whoever caught you goes back to the start. Returns true if it saved you.
  panSave(who) {
    const n = this.n;
    if (!n || n.frozen || n.jumpscare || !Items.count("pan")) return false;
    Items.spend("pan");
    Items.sfx("bonk");
    const k = { Bonnie: "bonnie", Chica: "chica", Foxy: "foxy", Eddie: "freddy" }[who];
    if (n.powerOut) {
      // in the dark: BONK, and the lights come back on (with a little power)
      this.powerBack();
      n.power = 200;
    }
    this.sendHome(k, 5);
    ItemBar.say(ACH_WORD("BONK! The frying pan sent") + " " + this.itemName(k) + " " + ACH_WORD("back. You're safe!"), 4000);
    return true;
  }

  // After a power out: lights, sounds and everyone's moving again
  powerBack() {
    const n = this.n, sp = this.sp;
    this.scripts.stop("powerout", "jingle", "night");
    n.powerOut = false;
    n.officePic = "normal";
    for (const s of ["fan", "power", "redDot", "steps"]) sp[s].stopAll();
    sp.music.setVolume(100); sp.music.play("Stage", "ColdPresc B", { loop: true });
    sp.office.setVolume(25); sp.office.play("office", "Buzz_Fan_Florescent2", { loop: true });
    sp.lights.setVolume(0); sp.lights.play("left button panel", "BallastHumMedium2", { loop: true });
    sp.map.setVolume(0); sp.map.play("map", "EerieAmbienceLargeSca_MV005", { loop: true });
    for (const k of ["bonnie", "chica", "freddy", "foxy"]) this.sendHome(k, 5);
    this.runPower();
    this.runCameraPan();
    this.runAmbience();
    if (settings.jumpscares === "1") { this.scripts.stop("halluc"); this.runHallucinations(); }
  }

  // The air horn: everyone close to the office runs back to the start
  airHorn() {
    const n = this.n, near = ["West Hall", "W. Hall Corner", "Supply Closet", "East Hall", "E. Hall Corner", "Ready to Attack", "Got You"];
    Items.sfx("horn");
    const ran = [];
    for (const k of ["bonnie", "chica", "freddy"]) if (near.includes(n[k].at)) { this.sendHome(k, 5); ran.push(this.itemName(k)); }
    if (n.foxy.stage >= 3) { this.sendHome("foxy", 5); ran.push(this.itemName("foxy")); }
    ItemBar.say(ran.length ? ACH_WORD("HONK! Back to the stage:") + " " + ran.join(", ") : ACH_WORD("HONK! Nobody was close."));
  }

  // Bear trap: set it on the camera that was clicked
  placeTrap(cam) {
    const n = this.n;
    if (!Items.spend("trap")) { n.placingTrap = false; return; }
    n.trap = cam.room;
    n.placingTrap = false;
    Items.sfx("snap");
    ItemBar.say(ACH_WORD("Bear trap set on") + " " + ACH_WORD("CAM") + " " + cam.button.replace("CAM", "") + ".");
  }
  // Did k just walk into the trap? (room = where they are now)
  trapCheck(k, room) {
    const n = this.n;
    room = room || n[k].at;
    if (!n.trap || n.trap !== room) return false;
    const cam = CAMERAS.find(c => c.room === room);
    n.trap = null;
    this.sendHome(k, 15);
    Items.sfx("snap");
    ItemBar.say(ACH_WORD("SNAP!") + " " + this.itemName(k) + " " + ACH_WORD("stepped in the bear trap on") + " " + ACH_WORD("CAM") + " " +
                (cam ? cam.button.replace("CAM", "") : "") + "! " + ACH_WORD("Back to the start for 15 seconds."), 4500);
    return true;
  }

  // a character's face (cut from the custom night picture), size game pixels wide, centered on x, y
  drawFace(ctx, k, x, y, size) {
    const spot = { freddy: [84, 139.5], bonnie: [192.5, 139.5], chica: [290, 142], foxy: [400, 139.5] }[k];
    const z = size / 100;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#000"; ctx.fill(); ctx.clip();
    draw(ctx, pic("Backdrop", "custom night"), x + (240 - spot[0]) * z, y + (180 - spot[1]) * z, { size: 100 * z });
    ctx.restore();
    ctx.save(); ctx.strokeStyle = "#ffcf3f"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  // On the camera map: the bear trap, and (with the glasses on) everyone's face on their camera
  drawItemsOnMap(ctx) {
    const n = this.n;
    if (n.trap) { const c = CAMERAS.find(c => c.room === n.trap); if (c) drawItemIcon(ctx, "trap", c.x - 10, c.y - 6, 9); }
    if (n.placingTrap && Math.floor(this.tick / 10) % 2) {
      ctx.save(); ctx.font = '9px "Pixel"'; ctx.fillStyle = "#ffcf3f"; ctx.textAlign = "center";
      ctx.fillText(ACH_WORD("PICK A CAMERA FOR THE TRAP"), 385, 165); ctx.restore();
    }
    if (!(n.glassesUntil > n.time)) return;
    // where each one is on the map (the doors count as the hall corners, on the office side)
    const spots = {};
    const add = (k, room, dx = 0) => { const c = CAMERAS.find(c => c.room === room); if (c) (spots[room] = spots[room] || { c, dx, list: [] }).list.push(k); };
    for (const k of ["freddy", "bonnie", "chica"]) {
      const at = n[k].at;
      if (at === "Ready to Attack" || at === "Got You") add(k, k === "bonnie" ? "W. Hall Corner" : "E. Hall Corner", k === "bonnie" ? 14 : -14);
      else add(k, at);
    }
    add("foxy", n.foxy.stage >= 4 ? "West Hall" : "Pirate Cove");
    for (const s of Object.values(spots)) s.list.forEach((k, i) => this.drawFace(ctx, k, s.c.x + s.dx + (i - (s.list.length - 1) / 2) * 11, s.c.y, 11));
  }

  /* =================================================================
     DEBUG MODE (Settings > Debug mode): live numbers for testing
     ================================================================= */
  debugInfo() {
    const out = { screen: this.screen, level: this.level, scripts: this.scripts.list.length };
    const n = this.n;
    if (this.screen === "night" && n) {
      Object.assign(out, {
        power: (Math.max(0, n.power) / 10).toFixed(1) + "%",
        time: (n.hour === 0 ? 12 : n.hour) + " AM",
        usage: this.usage(),
        camera: n.camsUp ? n.camera : "(office)",
        Eddie: `${n.freddy.at} (AI ${n.ai.freddy})`,
        Weddy: `${n.bonnie.at} (AI ${n.ai.bonnie})`,
        Cheddy: `${n.chica.at} (AI ${n.ai.chica})`,
        Endo: `stage ${n.foxy.stage}, wait ${Math.max(0, n.foxy.cooldown).toFixed(1)}s (AI ${n.foxy.ai ?? n.ai.foxy})`,
        doors: `${n.leftDoor ? "L" : "-"} ${n.rightDoor ? "R" : "-"}`,
        lights: `${n.leftLight ? "L" : "-"} ${n.rightLight ? "R" : "-"}`,
      });
    }
    out["golden 1 in"] = this.goldenRate;
    return out;
  }

  // Debug buttons
  debugSkipHour() { if (this.screen === "night" && this.n && !this.n.frozen) this.n.clock = 90 - TICK; }
  debugAddPower() { if (this.screen === "night" && this.n && !this.n.powerOut) this.n.power = Math.min(999, this.n.power + 100); }
}
