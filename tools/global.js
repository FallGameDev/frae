/* =====================================================================
   GLOBAL SETTINGS + ACCOUNTS (tools/global.js)
   Shared by the tape select menu (index.html loads this file) and both
   tapes (build_game1.py / build_game2.py paste it into the game page).

   - Global: settings for EVERY tape, changed on the menu's Settings
     button. Saved in localStorage "frae-global".
       visuals:  brightness, picture quality, VHS effects, calm menu, font
       sound:    master, music and sound effect volume (they multiply
                 each tape's own Music / Sound sliders)
       parental: optional PIN lock, no mods, no jumpscares,
                 story mode only, chicken mode
   - Cloud: accounts on Supabase (email + password, a username), with
     save files, settings and mods backed up to the account.
     No Supabase library is needed: it talks to Supabase's REST API.
     The tables are made by supabase/setup.sql.
   - GZip: tiny zip maker/reader (mods are uploaded as one .zip).
   ===================================================================== */

/* ---------------------------------------------------------------------
   SUPABASE PROJECT
   Paste your project's URL and its "anon public" (publishable) key here.
   (Supabase dashboard > Project Settings > API.) The anon key is safe to
   ship in a web page: Row Level Security in setup.sql keeps every
   player's data private to them.
   --------------------------------------------------------------------- */
const CLOUD_CONFIG = {
  url: "https://bxlipjtmqfjdulpymalo.supabase.co",   // the project (not the /functions/v1/api edge function)
  key: "sb_publishable_R_3CkPs1LA_nRmr_Zlymxg_Xyfqe8wq",   // publishable key (safe in a page; RLS keeps data private)
  modBucket: "mods"   // storage bucket for mod backups (made by setup.sql)
};

/* =====================================================================
   GLOBAL SETTINGS
   ===================================================================== */
const GLOBAL_KEY = "frae-global";
const GLOBAL_DEFAULTS = {
  visuals: {
    brightness: 100,   // 50-150 (%), a CSS filter on the game picture
    quality: "fast",   // "pixel" (no smoothing), "fast" (low smoothing), "pretty" (high smoothing, slower)
    vhs: true,         // menu scanlines, static and tracking bar
    calm: false,       // menu: no flicker or bouncing (reduced motion)
    font: "original"   // "original", "dyslexic" or "mario" (whoo hoo super mario on the ps4): see FONT SETTING
  },
  sound: { master: 100, music: 100, sfx: 100 },
  parental: {
    pin: "",             // SHA-256 of the 4 digit PIN ("" = no lock)
    noMods: false,       // mods are not loaded and the Mods button is locked
    noJumpscares: false, // jumpscares (and Tape 2 sensitive content) are forced OFF
    storyOnly: false,    // only the story nights: no 6th night, no custom night
    chicken: false       // 10x easier, but no achievements
  }
};

const Global = {
  data: null,

  // read the settings (missing values get their defaults)
  load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(GLOBAL_KEY) || "{}") || {}; } catch (e) {}
    const d = JSON.parse(JSON.stringify(GLOBAL_DEFAULTS));
    for (const part of Object.keys(d)) Object.assign(d[part], saved[part] || {});
    this.data = d;
    return d;
  },
  // write them (and back them up to the account)
  save() {
    try { localStorage.setItem(GLOBAL_KEY, JSON.stringify(this.data)); } catch (e) {}
    Cloud.saved(GLOBAL_KEY);
  },

  /* ----- Parental switches, asked by the games ----- */
  noMods()       { return !!this.data.parental.noMods; },
  noJumpscares() { return !!this.data.parental.noJumpscares; },
  storyOnly()    { return !!this.data.parental.storyOnly; },
  chicken()      { return !!this.data.parental.chicken; },

  // Chicken mode: a character's chance to move is cut to 1 in 10.
  // Use it next to every AI roll:  if (rand(1, 20) <= ai && Global.letMove()) move();
  letMove() { return !this.chicken() || Math.random() < 0.1; },
  // Chicken mode: power, flashlight battery and the music box drain 3x slower
  drain() { return this.chicken() ? 1 / 3 : 1; },

  /* ----- Sound: one number (0..1) to multiply a tape's own slider by ----- */
  vol(kind) {
    const s = this.data.sound;
    return (s.master / 100) * ((kind === "music" ? s.music : s.sfx) / 100);
  },

  /* ----- Visuals for a game canvas ----- */
  applyCanvas(canvas) {
    const b = this.data.visuals.brightness;
    canvas.style.filter = b === 100 ? "" : `brightness(${b / 100})`;
  },
  // call after setting the transform each frame (both tapes' render())
  smoothing(ctx) {
    const q = this.data.visuals.quality;
    ctx.imageSmoothingEnabled = q !== "pixel";
    ctx.imageSmoothingQuality = q === "pretty" ? "high" : "low";
  },

  /* ----- PIN lock for the parental section ----- */
  async hashPin(pin) {
    const bytes = new TextEncoder().encode("frae-pin:" + pin);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
  },
  async checkPin(pin) { return !this.data.parental.pin || (await this.hashPin(pin)) === this.data.parental.pin; }
};
Global.load();

/* =====================================================================
   FONT SETTING (menu Settings > Visuals, and each tape's Settings)
   Global.data.visuals.font:
     "original"  nothing changes
     "dyslexic"  every word uses OpenDyslexic (fonts/, SIL Open Font License)
     "mario"     "whoo hoo super mario on the ps4": the same fonts, but every
                 word is memified / badly translated (Meme.say below)
   It changes TEXT only, never pictures:
     - page text (<p>, buttons, panels...): a CSS class for the font, and a
       watcher that swaps each text node for its meme version (and back)
     - game text drawn on the canvas: fillText / strokeText / measureText are
       wrapped, so every word a tape (or a mod) draws follows the setting
   ===================================================================== */
const FONT_ROOT = /\/(?:[1-9]|workshop)\/(?:index\.html)?$/.test(location.pathname) ? "../" : "./";
const DYS_FAMILY = '"OpenDyslexic", sans-serif';

/* ---------------------------------------------------------------------
   MEME TRANSLATOR: "whoo hoo super mario on the ps4"
   1) whole phrases the player sees a lot get their own meme version
   2) everything else goes word by word through MEME_WORDS
   3) longer sentences sometimes get a little ending (" lol", " (real)"...)
   Always the same result for the same text (so nothing flickers).
   --------------------------------------------------------------------- */
const MEME_PHRASES = {
  // menu + title screens
  "fried rice at eddie's": "frid rais at eddie's", "fried rice at eddies": "frid rais at eddies",
  "fried rice at eddie's!": "frid rais at eddie's!!1", "fried rice at eddie's is closing": "frid rais at eddie's iz closin (sad)",
  "start": "go go go", "locked": "nope", "save file": "memory card", "settings": "teh knobs", "play": "play (pls)",
  "episode 1": "episod 1: rais awakens", "episode 2": "episod 2: electric boogaloo", "coming soon": "soon™",
  "this tape has not been recorded yet.": "dis tape iz still in teh microwave.", "no signal": "no wifi",
  "here studios": "here studios (we r here)", "new game": "new gaem", "continue": "keep goin", "dine in": "eat here???",
  "custom night": "make ur own nitemare", "customize night": "build-a-nitemare", "6th night": "nite 6 (the sequel)",
  "it's already dark.": "is already dark bro.", "it's still dark.": "still dark. sun is on vacation.",
  "spooky": "spoopy", "spooky night": "spoopy nite", "custom": "custom (fancy)", "ready": "lets gooo",
  // settings
  "jumpscares": "boo moments", "debug mode": "hacker mode 1337", "music": "jamz", "sound": "noize", "mods": "modz",
  "devlog": "dev diary", "confirm": "ok fine", "on": "yes", "off": "nah", "back": "go back", "< back": "< go back",
  "change": "swap", "erase": "yeet", "empty": "nothin here", "file": "card", "select a file": "pick a memory card pls",
  "visuals": "looky stuff", "parental": "grown up stuff", "account": "u", "brightness": "how bright",
  "picture quality": "how pretty", "vhs effects": "old tv mode", "calm menu": "chill menu", "font": "letterz",
  "master": "big boss volume", "sound effects": "boops n beeps", "x close": "x bye",
  "sign in": "log in pls", "create account": "make a u", "sign out": "log out (bye)", "forgot password?": "forgor password? 💀",
  "chicken mode": "bawk bawk mode", "story mode only": "just da story", "pin lock": "secret code",
  "allowed": "ok", "blocked": "nuh uh", "workshop": "mod mall", "browse": "look around", "publish": "send it",
  "install": "gimme", "installed": "got it", "my mods": "my modz", "copy link": "steal link", "more": "moar",
  "load unpacked": "load (open box)", "load packed": "load (closed box)", "download template": "get teh starter pack",
  "downloaded": "got it", "in use": "doin stuff",
  // in the games
  "night": "nite", "achievements": "trophees", "achievement unlocked!": "u did a thing!!",
  "hidden achievement": "secret trophee (shhh)", "keep playing to find it.": "keep playin 2 find it, ez.",
  "unlocked": "gotted", "game over": "game over (skill issue)", "you're fired.": "ur yeeted.", "you're fired": "ur yeeted",
  "the end.": "teh end. roll credits.", "the end": "teh end", "power left:": "juice left:", "usage:": "how much ur usin:",
  "door": "dor", "light": "lite", "incoming call...": "some1 is callin u...", "hello? hello?": "ello? ello? is dis thing on",
  "what could go wrong?": "wat could go wrong? (everything)", "f*ck no!": "heck nah!", "golden freddy rate?": "golden eddie chance???",
  "mike wazowski": "mike wazowski (real)", "the peepeepoopoo monster": "teh peepeepoopoo monster (very scary)",
  "warning": "hey listen!", "help wanted": "pls help", "pink slip": "pink paper of doom", "great!!": "gr8!!!",
  "nice try!": "nice try lol", "too big!": "2 big!", "a.i. level": "how smart", "name": "naem", "kitchen": "cookin room",
  "restrooms": "potty", "show stage": "da stage", "pirate cove": "pirate zone", "the puppet": "teh puppet (tall)",
  "loading": "loadin", "loading...": "loadin..."
};
const MEME_WORDS = {
  you: "u", your: "ur", "you're": "ur", youre: "ur", are: "r", the: "teh", night: "nite", nights: "nites",
  please: "pls", okay: "k", really: "rly", because: "bc", with: "wif", this: "dis", that: "dat", what: "wat",
  cool: "kewl", great: "gr8", food: "noms", eat: "nom", scary: "spoopy", power: "juice", camera: "cam", cameras: "cams",
  light: "lite", lights: "lites", door: "dor", doors: "dors", animatronic: "robo dude", animatronics: "robo dudes",
  characters: "guys", flashlight: "flashy stick", mask: "face hat", music: "jamz", sound: "noize",
  achievement: "trophee", achievements: "trophees", survive: "dont die on", beat: "destroy", my: "mah", and: "n",
  to: "2", for: "4", too: "2", be: "b", see: "c", oh: "o", hello: "ello", friend: "fren", friends: "frens",
  children: "smol humans", child: "smol human", kid: "smol human", kids: "smol humans", money: "moneyz", dollars: "dollarz",
  fired: "yeeted", closing: "closin", working: "workin", nothing: "nothin", something: "somethin", going: "goin",
  cooking: "cookin", frying: "fryin", playing: "playin", everyone: "every1", someone: "some1", anyone: "any1",
  before: "b4", later: "l8r", wait: "w8", new: "nu", very: "v", love: "luv", enough: "enuf", thanks: "thx",
  people: "ppl", is: "iz", easy: "ez", hard: "hard (cri)", extreme: "EXTREEEME", file: "card", files: "cards",
  save: "sav", saving: "savin", loading: "loadin", load: "lod", settings: "knobs", sensitive: "spicy",
  jumpscare: "boo moment", jumpscares: "boo moments", mod: "mod", account: "acc", password: "passwrd",
  username: "naem", delete: "yeet", deleted: "yeeted", remove: "yeet", hold: "hold (tight)", press: "smash",
  click: "clicky", yes: "ye", no: "nah", isn: "iz", "don't": "dont", "can't": "cant", "won't": "wont",
  empty: "nothin", fried: "frid", rice: "rais", shift: "shift (ugh)", job: "jerb", manager: "boss man", call: "ring ring", phone: "phon", prize: "prize (shiny)"
};
const MEME_ENDINGS = ["", "", "", " lol", " (real)", " fr fr", "!!1", " (trust)", " no cap", "™", " xD", ""];

const Meme = {
  cache: new Map(),
  hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; },
  // make "result" look like "like" (ALL CAPS, Capitalized or as it is)
  caseLike(result, like) {
    const letters = like.replace(/[^A-Za-z]/g, "");
    if (letters.length > 1 && letters === letters.toUpperCase()) return result.toUpperCase();
    if (/^[^A-Za-z]*[A-Z]/.test(like)) return result.replace(/[a-z]/, c => c.toUpperCase());
    return result;
  },
  say(text) {
    if (typeof text !== "string") text = String(text);
    if (!/[A-Za-z]{2}/.test(text)) return text;                 // numbers, "1A", "%"... stay
    const hit = this.cache.get(text);
    if (hit !== undefined) return hit;
    // keep the spaces around the words where they were
    const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = m[2];
    let out;
    const phrase = MEME_PHRASES[core.toLowerCase().replace(/\s+/g, " ")];
    if (phrase !== undefined) out = this.caseLike(phrase, core);
    else {
      out = core.replace(/[A-Za-z][A-Za-z']*/g, w => {
        const rep = MEME_WORDS[w.toLowerCase()];
        return rep === undefined ? w : this.caseLike(rep, w);
      });
      // sentences sometimes get an ending (never after a number or a colon)
      if (core.split(/\s+/).length >= 4 && !/[\d:]$/.test(core)) {
        const end = MEME_ENDINGS[this.hash(core) % MEME_ENDINGS.length];
        const caps = core.replace(/[^A-Za-z]/g, "") === core.replace(/[^A-Za-z]/g, "").toUpperCase();
        out = out.replace(/[.!?]*$/, p => (caps ? end.toUpperCase() : end) + (p || ""));      // (lowercase unless ALL CAPS)
      }
    }
    out = m[1] + out + m[3];
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(text, out);
    return out;
  }
};

/* ---------------------------------------------------------------------
   Page text: a watcher swaps each text node for its meme version and
   remembers the real words, so switching back puts them back.
   Not touched: <script>, <style>, text boxes, and [data-nomeme] (the
   Font buttons themselves).
   --------------------------------------------------------------------- */
const MemeDOM = {
  real: new WeakMap(),       // text node -> the real words
  shown: new WeakMap(),      // text node -> the meme words we put there
  watcher: null,
  skip(node) {
    const p = node.parentElement;
    return !p || !!p.closest("script, style, textarea, input, select, option, [data-nomeme], [contenteditable]");
  },
  fix(node) {
    if (this.skip(node)) return;
    const now = node.data;
    if (this.shown.get(node) === now) return;                   // it already shows our version
    this.real.set(node, now);                                   // (new words from the page)
    const meme = Meme.say(now);
    this.shown.set(node, meme);
    if (meme !== now) node.data = meme;
  },
  walk(root, fn) {
    if (!root) return;
    if (root.nodeType === 3) { fn(root); return; }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) fn(n);
  },
  start() {
    if (this.watcher || !document.body) return;
    this.walk(document.body, n => this.fix(n));
    this.watcher = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === "characterData") this.fix(m.target);
        else for (const n of m.addedNodes) this.walk(n, t => this.fix(t));
      }
    });
    this.watcher.observe(document.body, { subtree: true, childList: true, characterData: true });
  },
  stop() {
    if (!this.watcher) return;
    this.watcher.disconnect();
    this.watcher = null;
    // put the real words back
    this.walk(document.body, n => {
      if (this.real.has(n) && this.shown.get(n) === n.data) n.data = this.real.get(n);
    });
    this.real = new WeakMap();
    this.shown = new WeakMap();
  }
};

/* ---------------------------------------------------------------------
   Canvas text (the games): wrap fillText / strokeText / measureText
   --------------------------------------------------------------------- */
const Fonts = {
  mode: "original",
  version: 0,                  // goes up when the mode changes (text caches use it)
  fontCache: new Map(),
  // '600 11px "Sans Serif"' -> '600 11px "OpenDyslexic", sans-serif'
  dysFont(f) {
    let out = this.fontCache.get(f);
    if (out === undefined) {
      const m = f.match(/^(.*?)(\d+(?:\.\d+)?)px(\s*\/\s*\S+)?\s+(.+)$/);
      out = m ? m[1] + m[2] + "px" + (m[3] || "") + " " + DYS_FAMILY : f;
      this.fontCache.set(f, out);
    }
    return out;
  },
  // is text drawn differently than the game was made for? (Tape 1 then lets words keep their own width)
  reflow() { return this.mode !== "original"; },

  // load the font + set things up for the current setting
  apply() {
    this.mode = ["dyslexic", "mario"].includes(Global.data.visuals.font) ? Global.data.visuals.font : "original";
    this.version++;
    document.documentElement.classList.toggle("frae-dyslexic", this.mode === "dyslexic");
    document.documentElement.classList.toggle("frae-mario", this.mode === "mario");
    if (this.mode === "dyslexic" && document.fonts) {
      document.fonts.load('16px "OpenDyslexic"').catch(() => {});
      document.fonts.load('bold 16px "OpenDyslexic"').catch(() => {});
    }
    if (this.mode === "mario") MemeDOM.start(); else MemeDOM.stop();
  },

  // the @font-face rules + "every page word uses OpenDyslexic" (only while the class is on)
  addStyles() {
    if (document.getElementById("frae-fonts")) return;
    const url = n => new URL(FONT_ROOT + "fonts/" + n, location.href).href;
    const st = document.createElement("style");
    st.id = "frae-fonts";
    st.textContent = `
      @font-face { font-family: "OpenDyslexic"; src: url("${url("opendyslexic-latin-400-normal.woff2")}") format("woff2");
                   font-weight: 100 600; font-display: swap; size-adjust: 76%; }
      @font-face { font-family: "OpenDyslexic"; src: url("${url("opendyslexic-latin-700-normal.woff2")}") format("woff2");
                   font-weight: 700 900; font-display: swap; size-adjust: 76%; }
      html.frae-dyslexic body, html.frae-dyslexic body *:not(svg):not(svg *) { font-family: ${DYS_FAMILY} !important; }`;
    (document.head || document.documentElement).appendChild(st);
  },

  hookCanvas() {
    for (const C of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D]) {
      if (!C || C.prototype.__fraeFonts) continue;
      const P = C.prototype, fill = P.fillText, stroke = P.strokeText, measure = P.measureText;
      P.__fraeFonts = true;
      // run one call with the swapped font + words, then put the font back (so code reading ctx.font sees its own)
      const wrap = original => function (text, ...rest) {
        if (Fonts.mode === "original") return original.call(this, text, ...rest);
        const f = this.font;
        if (Fonts.mode === "dyslexic") this.font = Fonts.dysFont(f);
        try { return original.call(this, Fonts.mode === "mario" ? Meme.say(text) : text, ...rest); }
        finally { if (Fonts.mode === "dyslexic") this.font = f; }
      };
      P.fillText = wrap(fill);
      P.strokeText = wrap(stroke);
      P.measureText = wrap(measure);
    }
  },

  start() {
    this.hookCanvas();
    this.addStyles();
    const go = () => this.apply();
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go, { once: true });
  }
};
Fonts.start();

/* =====================================================================
   ZIP (stored, not compressed: fast, and pictures/sounds are already small)
   ===================================================================== */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// entries: [{path, bytes: Uint8Array}] -> Blob (.zip, "stored" so it is fast)
function makeZip(entries) {
  const parts = [], central = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const e of entries) {
    const name = enc.encode(e.path), crc = crc32(e.bytes), n = e.bytes.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true); h.setUint16(26, name.length, true);
    parts.push(h, name, e.bytes);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(c, name);
    offset += 30 + name.length + n;
  }
  const size = central.reduce((a, p) => a + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
// Blob (.zip) -> [{path, blob}]  (stored or deflated files)
async function readZip(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let e = buf.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("That file is not a zip");
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const dec = new TextDecoder(), out = [];
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const path = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (path.endsWith("/")) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    let data = buf.slice(start, start + csize);
    if (method === 8) {
      const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      data = new Uint8Array(await new Response(ds).arrayBuffer());
    } else if (method !== 0) continue;
    out.push({ path, blob: new Blob([data]) });
  }
  return out;
}

/* =====================================================================
   MOD IMAGES: a whole mod packed into the pixels of one PNG
   Every pixel holds 3 bytes of the file (red, green, blue; alpha is
   always 255), 2048 pixels wide, read left to right, top to bottom.
   The bytes are:
     "BFC1"                 magic (4 bytes)
     version                1 byte (1), then 3 empty bytes
     name length            4 bytes, big-endian
     type length            4 bytes, big-endian
     data length            4 bytes, big-endian
     name, type, data       (like "my-mod.zip", "application/zip", the zip)
     0xFF                   fills the rest of the last row
   Uploads to Supabase storage are these images; loading turns the
   pixels back into the original file. The PNG is written and read here
   in plain JS (no canvas), so no browser can shift a color or hit a
   canvas size limit.
   ===================================================================== */
const ModImage = {
  WIDTH: 2048,

  // file Blob -> PNG Blob
  async encode(blob, name = "mod.zip", mime = blob.type || "application/zip") {
    const enc = new TextEncoder();
    const nameB = enc.encode(name), mimeB = enc.encode(mime);
    const data = new Uint8Array(await blob.arrayBuffer());
    const total = 20 + nameB.length + mimeB.length + data.length;
    const w = this.WIDTH, h = Math.max(1, Math.ceil(total / 3 / w));
    // the byte stream (3 per pixel), padded with 0xFF
    const bytes = new Uint8Array(w * h * 3).fill(0xFF);
    const dv = new DataView(bytes.buffer);
    bytes.set([0x42, 0x46, 0x43, 0x31, 1, 0, 0, 0]);          // "BFC1", version 1, 3 empty bytes
    dv.setUint32(8, nameB.length); dv.setUint32(12, mimeB.length); dv.setUint32(16, data.length);
    bytes.set(nameB, 20); bytes.set(mimeB, 20 + nameB.length); bytes.set(data, 20 + nameB.length + mimeB.length);
    // PNG rows: filter byte 0, then RGBA pixels
    const raw = new Uint8Array(h * (1 + w * 4));
    for (let y = 0, i = 0, o = 0; y < h; y++) {
      raw[o++] = 0;
      for (let x = 0; x < w; x++) { raw[o++] = bytes[i++]; raw[o++] = bytes[i++]; raw[o++] = bytes[i++]; raw[o++] = 255; }
    }
    const zlib = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
    const ihdr = new Uint8Array(13), hv = new DataView(ihdr.buffer);
    hv.setUint32(0, w); hv.setUint32(4, h); ihdr.set([8, 6, 0, 0, 0], 8);   // 8-bit RGBA, no interlace
    return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
                     this.chunk("IHDR", ihdr), this.chunk("IDAT", zlib), this.chunk("IEND", new Uint8Array(0))], { type: "image/png" });
  },
  chunk(type, data) {
    const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  },

  // is this a mod image? (a PNG; the header is checked when decoding)
  async isImage(blob) {
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    return head[0] === 137 && head[1] === 80 && head[2] === 78 && head[3] === 71;
  },

  // PNG Blob -> { name, mime, blob } (the original file)
  async decode(png) {
    const buf = new Uint8Array(await png.arrayBuffer()), dv = new DataView(buf.buffer);
    if (!(buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71)) throw new Error("That file is not a PNG.");
    let p = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0;
    const idat = [];
    while (p < buf.length) {
      const len = dv.getUint32(p), kind = String.fromCharCode(...buf.subarray(p + 4, p + 8));
      const body = buf.subarray(p + 8, p + 8 + len);
      if (kind === "IHDR") { w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); depth = body[8]; type = body[9]; interlace = body[12]; }
      else if (kind === "IDAT") idat.push(body);
      else if (kind === "IEND") break;
      p += 12 + len;
    }
    if (depth !== 8 || (type !== 6 && type !== 2) || interlace) throw new Error("This image isn't a mod image (it must be an 8-bit RGB/RGBA PNG).");
    const bpp = type === 6 ? 4 : 3, stride = w * bpp;
    const raw = new Uint8Array(await new Response(new Blob(idat).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
    // undo the PNG row filters, keeping only R, G, B of each pixel
    const bytes = new Uint8Array(w * h * 3);
    let prev = new Uint8Array(stride), cur = new Uint8Array(stride), o = 0;
    for (let y = 0, i = 0; y < h; y++) {
      const f = raw[i++];
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
        let v = raw[i++];
        if (f === 1) v += a;
        else if (f === 2) v += b;
        else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        cur[x] = v & 255;
      }
      for (let x = 0; x < stride; x += bpp) { bytes[o++] = cur[x]; bytes[o++] = cur[x + 1]; bytes[o++] = cur[x + 2]; }
      [prev, cur] = [cur, prev];
    }
    // read the header and cut the original file out
    if (!(bytes[0] === 0x42 && bytes[1] === 0x46 && bytes[2] === 0x43 && bytes[3] === 0x31)) throw new Error("This picture doesn't have a mod packed inside it.");
    const hv = new DataView(bytes.buffer);
    const nl = hv.getUint32(8), ml = hv.getUint32(12), dl = hv.getUint32(16);
    if (20 + nl + ml + dl > bytes.length) throw new Error("This mod image is cut off (part of it is missing).");
    const dec = new TextDecoder();
    const name = dec.decode(bytes.subarray(20, 20 + nl)), mime = dec.decode(bytes.subarray(20 + nl, 20 + nl + ml));
    const start = 20 + nl + ml;
    return { name, mime, blob: new Blob([bytes.subarray(start, start + dl)], { type: mime }) };
  },

  // whatever was downloaded (a mod image, or an old plain .zip) -> the zip
  async toZip(blob) {
    return (await this.isImage(blob)) ? (await this.decode(blob)).blob : blob;
  }
};

/* =====================================================================
   A TAPE'S MODS: NO SIZE LIMIT
   Everything about a tape's mods lives in the browser's file database
   (IndexedDB "<tape>-mods-files"), never in localStorage (which only
   holds a few MB in total):
     store "files"  key "<mod id>/<path>" -> Blob (pictures, sounds, models, code...)
     store "meta"   key "list"  -> every mod's details (name, author, texts, file names...)
                    key "state" -> { downloaded: [ids], inUse: [ids] } (inUse[0] = top = wins)
   IndexedDB can use as much of the disk as the browser allows (usually
   gigabytes), and the page asks the browser to keep it (persistent storage).
   Mod lists saved by older versions in localStorage ("<tape>-mods",
   "<tape>-mods-state") move over by themselves the first time, and are
   then removed from localStorage to free it up.
   Used by the games (ModDB in tools/ui.js), the menu and the workshop.
   ===================================================================== */
const TAPES = [
  { tape: 1, key: "frae1", name: "Tape 1" },
  { tape: 2, key: "frae2", name: "Tape 2" }
];
const TAPE_MODS = {};        // one store object per tape (shares the open database)
function TapeMods(key) {
  if (TAPE_MODS[key]) return TAPE_MODS[key];
  const listKey = key + "-mods", stateKey = key + "-mods-state";
  let db = null, moved = null;

  // open the database (version 2 added the "meta" store)
  const open = () => db || (db = new Promise((res, rej) => {
    const r = indexedDB.open(listKey + "-files", 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("files")) d.createObjectStore("files");
      if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
    };
    r.onsuccess = () => {
      clearTimeout(waited);
      const d = r.result;
      d.onversionchange = () => { d.close(); db = null; };      // let a newer page upgrade it
      res(d);
    };
    // another tab still has the old version open: wait a little, then say so instead of hanging
    let waited = null;
    r.onblocked = () => {
      waited = setTimeout(() => { db = null; rej(new Error("Close the other Fried Rice at Eddie's tabs, then try again (mod storage is updating).")); }, 5000);
    };
    r.onerror = () => { clearTimeout(waited); db = null; rej(r.error); };
  }));
  // one transaction on one store; fn gets the store and returns a request (its result is returned)
  const run = async (store, mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = t.onabort = () => rej(t.error || new Error("storage error"));
    });
  };
  const getMeta = k => run("meta", "readonly", st => st.get(k));
  const setMeta = (k, v) => run("meta", "readwrite", st => st.put(v, k));

  // first use: bring an old localStorage list over, then free localStorage
  const moveFromLocalStorage = () => moved || (moved = (async () => {
    let oldList = null, oldState = null;
    try { oldList = localStorage.getItem(listKey); oldState = localStorage.getItem(stateKey); } catch (e) {}
    if (oldList !== null && (await getMeta("list")) === undefined) {
      try { await setMeta("list", JSON.parse(oldList) || []); } catch (e) { await setMeta("list", []); }
    }
    if (oldState !== null && (await getMeta("state")) === undefined) {
      try { await setMeta("state", JSON.parse(oldState) || { downloaded: [], inUse: [] }); } catch (e) {}
    }
    try { localStorage.removeItem(listKey); localStorage.removeItem(stateKey); } catch (e) {}
  })());

  const store = TAPE_MODS[key] = {
    /* ----- the list and the order (async: they live in IndexedDB) ----- */
    async list() { await moveFromLocalStorage(); return (await getMeta("list")) || []; },
    async putList(list) { await moveFromLocalStorage(); await setMeta("list", list); },
    async state() {
      await moveFromLocalStorage();
      const st = await getMeta("state");
      return st && Array.isArray(st.downloaded) && Array.isArray(st.inUse) ? st : { downloaded: [], inUse: [] };
    },
    async putState(st) { await moveFromLocalStorage(); await setMeta("state", { downloaded: st.downloaded, inUse: st.inUse }); },
    // was there an old localStorage list? (ui.js checks this for even older saves)
    hadOldList() { try { return localStorage.getItem(listKey) !== null; } catch (e) { return false; } },

    /* ----- files ----- */
    getFile(k) { return run("files", "readonly", st => st.get(k)); },
    putFile(k, blob) { return run("files", "readwrite", st => st.put(blob, k)); },
    removeFiles(id) { return run("files", "readwrite", st => st.delete(IDBKeyRange.bound(id + "/", id + "/\uffff"))); },
    // ask the browser to keep our files (so it doesn't clear them when space is low)
    persist() { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); },

    /* ----- one mod as a .zip: mod.json (its details + file types) and files/<path> ----- */
    // extra: details to change in mod.json (the workshop sets author/name/version...)
    async pack(id, extra = {}) {
      const info = (await this.list()).find(m => m.id === id);
      if (!info) throw new Error("That mod is not on this device");
      const entries = [], types = {};
      for (const path of info.fileList || []) {
        const blob = await this.getFile(id + "/" + path).catch(() => null);
        if (!blob) continue;
        types[path] = blob.type || "";
        entries.push({ path: "files/" + path, bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      const meta = new TextEncoder().encode(JSON.stringify({ ...info, ...extra, types }));
      return makeZip([{ path: "mod.json", bytes: meta }, ...entries]);
    },
    // a zip made by pack() goes back into this tape (in the Downloaded list)
    // overrides: details to change (the workshop gives each install its own id + source)
    // check(info): called before anything is saved; throw to stop (like "this mod has code")
    async unpack(zip, overrides = {}, check = null) {
      const items = await readZip(zip);
      const metaFile = items.find(f => f.path === "mod.json");
      if (!metaFile) throw new Error("This backup is missing mod.json");
      const { types = {}, ...saved } = JSON.parse(await metaFile.blob.text());
      const info = { ...saved, ...overrides };
      if (check) await check(info);
      this.persist();
      await this.removeFiles(info.id);
      const fileList = [];
      for (const f of items) {
        if (!f.path.startsWith("files/")) continue;
        const path = f.path.slice(6);
        await this.putFile(info.id + "/" + path, new Blob([f.blob], { type: types[path] || "" }));
        fileList.push(path);
      }
      const list = (await this.list()).filter(m => m.id !== info.id);
      list.push({ ...info, fileList });
      await this.putList(list);
      const st = await this.state();
      if (!st.downloaded.includes(info.id) && !st.inUse.includes(info.id)) st.downloaded.unshift(info.id);
      await this.putState(st);
      return info;
    }
  };
  return store;
}

// How much space this site can use, for the Mods screen ("12 MB used of 2.1 GB")
async function storageText() {
  try {
    const est = await navigator.storage.estimate();
    const t = b => b > 1073741824 ? (b / 1073741824).toFixed(1) + " GB" : b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB";
    return t(est.usage || 0) + " used of " + t(est.quota || 0);
  } catch (e) { return ""; }
}

/* =====================================================================
   CLOUD: Supabase accounts (auth + database + storage, plain fetch)
   ===================================================================== */
const ACCOUNT_KEY = "frae-account";   // the signed in session on this device
const SYNC_KEY = "frae-sync";         // { key: { local: ms of last local change, synced: ms of last sync } }

// Which localStorage keys travel with the account
const SYNC_MATCH = /^(frae\d+-save-file\d+|frae\d+-settings|frae-global)$/;

const Cloud = {
  session: null,
  profile: null,     // { username, created_at }
  pushTimers: {},

  ready() { return !!(CLOUD_CONFIG.url && CLOUD_CONFIG.key); },
  signedIn() { return !!(this.session && this.session.user); },
  uid() { return this.session && this.session.user.id; },

  /* ----- session on this device ----- */
  loadSession() {
    try { this.session = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null"); } catch (e) { this.session = null; }
    try { this.profile = JSON.parse(localStorage.getItem(ACCOUNT_KEY + "-profile") || "null"); } catch (e) { this.profile = null; }
  },
  keepSession(s) {
    // Supabase gives expires_in (seconds); remember when it runs out
    if (s && !s.expires_at) s.expires_at = Math.floor(Date.now() / 1000) + (s.expires_in || 3600);
    this.session = s;
    try {
      if (s) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(s));
      else { localStorage.removeItem(ACCOUNT_KEY); localStorage.removeItem(ACCOUNT_KEY + "-profile"); this.profile = null; }
    } catch (e) {}
  },
  keepProfile(p) {
    this.profile = p;
    try { localStorage.setItem(ACCOUNT_KEY + "-profile", JSON.stringify(p)); } catch (e) {}
  },

  /* ----- talking to Supabase ----- */
  async call(path, opts = {}) {
    if (!this.ready()) throw new Error("Accounts are not set up yet.");
    const headers = Object.assign({ apikey: CLOUD_CONFIG.key }, opts.headers || {});
    if (opts.auth !== false && this.signedIn()) headers.Authorization = "Bearer " + (await this.token());
    if (opts.json !== undefined) { headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.json); }
    const res = await fetch(CLOUD_CONFIG.url.replace(/\/$/, "") + path, { method: opts.method || "GET", headers, body: opts.body });
    if (!res.ok) {
      let msg = res.status + "";
      try { const j = await res.json(); msg = j.msg || j.message || j.error_description || j.error || msg; } catch (e) {}
      const err = new Error(friendlyError(msg));
      err.status = res.status;
      throw err;
    }
    if (opts.raw) return res;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },
  // a fresh access token (refreshed a minute before it runs out)
  async token() {
    const s = this.session;
    if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    const fresh = await fetch(CLOUD_CONFIG.url.replace(/\/$/, "") + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: { apikey: CLOUD_CONFIG.key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    if (!fresh.ok) { this.keepSession(null); throw new Error("You were signed out. Please sign in again."); }
    this.keepSession(await fresh.json());
    return this.session.access_token;
  },

  /* ----- account ----- */
  // where email links send the player back to: the tape menu
  home() { return location.origin + location.pathname.replace(/\/(1|2|3|4)\/(index\.html)?$/, "/").replace(/index\.html$/, ""); },
  async usernameTaken(name) {
    return !!(await this.call("/rest/v1/rpc/username_taken", { method: "POST", json: { name }, auth: false }));
  },
  async signUp(email, password, username) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new Error("Usernames are 3 to 20 letters, numbers or _.");
    if (await this.usernameTaken(username)) throw new Error("That username is taken.");
    const r = await this.call("/auth/v1/signup?redirect_to=" + encodeURIComponent(this.home()), { method: "POST", auth: false, json: { email, password, data: { username } } });
    // with "Confirm email" on, there is no session until they click the link in their email
    if (!r.access_token) return { confirm: true };
    this.keepSession(r);
    await this.loadProfile();
    return { confirm: false };
  },
  async signIn(email, password) {
    const r = await this.call("/auth/v1/token?grant_type=password", { method: "POST", auth: false, json: { email, password } });
    this.keepSession(r);
    await this.loadProfile();
  },
  // Links in Supabase emails (confirm account, reset password) come back to the menu
  // with the session in the address: #access_token=...&refresh_token=...&type=signup|recovery
  // Returns the type ("signup", "recovery"...) or null.
  async fromLink() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.get("access_token") || !this.ready()) return null;
    history.replaceState(null, "", location.pathname + location.search);    // tidy the address
    const s = { access_token: h.get("access_token"), refresh_token: h.get("refresh_token"),
                expires_in: Number(h.get("expires_in")) || 3600, token_type: "bearer" };
    this.keepSession(s);
    try {
      s.user = await this.call("/auth/v1/user", { headers: { Authorization: "Bearer " + s.access_token } });
      this.keepSession(s);
      await this.loadProfile();
    } catch (e) { this.keepSession(null); return null; }
    return h.get("type") || "signup";
  },
  async signOut() {
    try { await this.call("/auth/v1/logout", { method: "POST" }); } catch (e) {}
    this.keepSession(null);
  },
  async resetPassword(email) {
    await this.call("/auth/v1/recover?redirect_to=" + encodeURIComponent(this.home()), { method: "POST", auth: false, json: { email } });
  },
  async changePassword(password) {
    await this.call("/auth/v1/user", { method: "PUT", json: { password } });
  },
  async loadProfile() {
    const rows = await this.call("/rest/v1/profiles?select=username,created_at&id=eq." + this.uid());
    this.keepProfile(rows[0] || { username: "player", created_at: new Date().toISOString() });
    return this.profile;
  },
  async changeUsername(name) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new Error("Usernames are 3 to 20 letters, numbers or _.");
    if (name.toLowerCase() !== (this.profile.username || "").toLowerCase() && await this.usernameTaken(name)) throw new Error("That username is taken.");
    await this.call("/rest/v1/profiles?id=eq." + this.uid(), { method: "PATCH", json: { username: name } });
    this.keepProfile({ ...this.profile, username: name });
  },
  // deletes the mod files first (the database can't), then the account and its rows
  async deleteAccount() {
    const mods = await this.cloudMods();
    for (const m of mods) await this.deleteMod(m).catch(() => {});
    for (const w of await this.myWorkshop().catch(() => [])) await this.unpublish(w).catch(() => {});
    await this.call("/rest/v1/rpc/delete_my_account", { method: "POST", json: {} });
    this.keepSession(null);
  },

  /* =================================================================
     SAVES AND SETTINGS SYNC
     Every synced key remembers when it last changed here (local) and
     when it last matched the account (synced). Newest change wins.
     ================================================================= */
  times() { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || "{}"); } catch (e) { return {}; } },
  setTimes(t) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(t)); } catch (e) {} },

  // The games call this after writing a synced key (saveProgress, settings...)
  saved(key) {
    if (!SYNC_MATCH.test(key)) return;
    const t = this.times();
    t[key] = Object.assign(t[key] || {}, { local: Date.now() });
    this.setTimes(t);
    if (!this.signedIn()) return;
    clearTimeout(this.pushTimers[key]);
    this.pushTimers[key] = setTimeout(() => this.push(key).catch(e => console.warn("Cloud save failed", key, e)), 1500);
  },
  // ...and this after erasing one (so the account forgets it too)
  erased(key) {
    if (!SYNC_MATCH.test(key)) return;
    const t = this.times();
    delete t[key];
    this.setTimes(t);
    if (this.signedIn()) this.call("/rest/v1/saves?key=eq." + encodeURIComponent(key) + "&user_id=eq." + this.uid(), { method: "DELETE" })
      .catch(e => console.warn("Cloud erase failed", key, e));
  },
  localValue(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  },
  async push(key) {
    const data = this.localValue(key);
    if (data === undefined) return;
    const now = Date.now();
    await this.call("/rest/v1/saves?on_conflict=user_id,key", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      json: { user_id: this.uid(), key, data, updated_at: new Date(now).toISOString() }
    });
    const t = this.times();
    t[key] = { local: now, synced: now };
    this.setTimes(t);
  },
  pull(key, row) {
    const value = typeof row.data === "string" ? row.data : JSON.stringify(row.data);
    localStorage.setItem(key, value);
    const ms = Date.parse(row.updated_at);
    const t = this.times();
    t[key] = { local: ms, synced: ms };
    this.setTimes(t);
    if (key === GLOBAL_KEY) { Global.load(); Fonts.apply(); }
  },
  async cloudRows() {
    return await this.call("/rest/v1/saves?select=key,data,updated_at&user_id=eq." + this.uid());
  },

  // Two way sync. Returns { pulled, pushed, conflicts: [keys] }.
  // A conflict = this device and the account both have different data for a key
  // that was never synced here (like signing in on a device that already has saves).
  // prefer: "local" or "cloud" settles those conflicts.
  async sync(prefer) {
    const rows = await this.cloudRows();
    const cloud = Object.fromEntries(rows.map(r => [r.key, r]));
    const keys = new Set(rows.map(r => r.key));
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (SYNC_MATCH.test(k)) keys.add(k); }
    const out = { pulled: 0, pushed: 0, conflicts: [] };
    for (const key of keys) {
      if (!SYNC_MATCH.test(key)) continue;
      const t = this.times()[key] || {};
      const local = this.localValue(key), row = cloud[key];
      const cloudMs = row ? Date.parse(row.updated_at) : 0;
      if (local === undefined) { if (row) { this.pull(key, row); out.pulled++; } continue; }
      if (!row) { await this.push(key); out.pushed++; continue; }
      if (JSON.stringify(local) === JSON.stringify(row.data)) {     // same data: just remember they match
        const tt = this.times(); tt[key] = { local: cloudMs, synced: cloudMs }; this.setTimes(tt);
        continue;
      }
      if (!t.synced) {
        // never synced here and they differ: ask the player (unless they already chose)
        if (prefer === "cloud") { this.pull(key, row); out.pulled++; }
        else if (prefer === "local") { await this.push(key); out.pushed++; }
        else out.conflicts.push(key);
        continue;
      }
      const localChanged = (t.local || 0) > t.synced;
      const cloudChanged = cloudMs > t.synced;
      if (localChanged && (!cloudChanged || t.local >= cloudMs)) { await this.push(key); out.pushed++; }
      else if (cloudChanged) { this.pull(key, row); out.pulled++; }
    }
    return out;
  },
  // Manual buttons: copy everything one way
  async uploadAll() {
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (SYNC_MATCH.test(k)) await this.push(k); }
  },
  async downloadAll() {
    for (const row of await this.cloudRows()) this.pull(row.key, row);
  },

  /* =================================================================
     MODS ON THE ACCOUNT
     Each mod is one zip in storage: mods/<user id>/<tape>-<mod id>.zip
     plus a row in the "mods" table (name, author, size, installed/created)
     ================================================================= */
  async cloudMods() {
    return await this.call("/rest/v1/mods?select=*&user_id=eq." + this.uid() + "&order=updated_at.desc");
  },
  // "created" = the mod's author is this account's username, else "installed"
  modKind(info) {
    const me = (this.profile && this.profile.username || "").toLowerCase();
    return me && (info.author || "").trim().toLowerCase() === me ? "created" : "installed";
  },
  async uploadMod(tape, id) {
    const store = TapeMods(tape.key);
    const info = (await store.list()).find(m => m.id === id);
    const zip = await store.pack(id);
    const png = await ModImage.encode(zip, (info.name || id) + ".zip");      // the whole mod as one picture
    const path = this.uid() + "/" + tape.tape + "-" + id + ".png";
    await this.call("/storage/v1/object/" + CLOUD_CONFIG.modBucket + "/" + path, {
      method: "POST", headers: { "x-upsert": "true", "Content-Type": "image/png" }, body: png
    });
    const old = (await this.cloudMods().catch(() => [])).find(r => r.id === id && r.path !== path);
    if (old) this.call("/storage/v1/object/" + CLOUD_CONFIG.modBucket + "/" + old.path, { method: "DELETE" }).catch(() => {});
    await this.call("/rest/v1/mods?on_conflict=user_id,id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      json: { user_id: this.uid(), id, tape: tape.tape, name: info.name, author: info.author || "", version: info.version || "",
              kind: this.modKind(info), size: png.size, path, updated_at: new Date().toISOString() }
    });
  },
  async installMod(row) {
    const tape = TAPES.find(t => t.tape === row.tape);
    const res = await this.call("/storage/v1/object/authenticated/" + CLOUD_CONFIG.modBucket + "/" + row.path, { raw: true });
    return await TapeMods(tape.key).unpack(await ModImage.toZip(await res.blob()));    // picture -> original zip
  },
  async deleteMod(row) {
    await this.call("/storage/v1/object/" + CLOUD_CONFIG.modBucket + "/" + row.path, { method: "DELETE" }).catch(() => {});
    await this.call("/rest/v1/mods?user_id=eq." + this.uid() + "&id=eq." + encodeURIComponent(row.id), { method: "DELETE" });
  },

  /* =================================================================
     WORKSHOP (workshop/index.html): published mods everyone can install
     Table "workshop" + public storage bucket "workshop" (setup.sql).
     Mature mods are left out of the list and only open by their link.
     ================================================================= */
  // the list: opts { tape, search, sort: "new" | "popular", limit }
  async workshopList(opts = {}) {
    let q = "/rest/v1/workshop?select=*&mature=eq.false";
    if (opts.tape) q += "&tape=eq." + Number(opts.tape);
    const s = String(opts.search || "").replace(/[^\w\s'-]/g, " ").trim();
    if (s) q += "&or=(name.ilike.*" + encodeURIComponent(s) + "*,author.ilike.*" + encodeURIComponent(s) + "*)";
    q += "&order=" + (opts.sort === "popular" ? "downloads.desc,created_at.desc" : "created_at.desc");
    q += "&limit=" + (opts.limit || 60);
    return await this.call(q);
  },
  // one mod by its link (mature ones too)
  async workshopGet(id) {
    const rows = await this.call("/rest/v1/rpc/workshop_get", { method: "POST", json: { mod_id: id } });
    return rows[0] || null;
  },
  async myWorkshop() {
    return await this.call("/rest/v1/workshop?select=*&user_id=eq." + this.uid() + "&order=updated_at.desc");
  },
  // publish (or update, when row.id is given) a mod from this device.
  // details: { name, description, version, mature }. The author is always your username.
  async publish(tape, localId, details, row) {
    const store = TapeMods(tape.key);
    const info = (await store.list()).find(m => m.id === localId);
    if (!info) throw new Error("That mod is not on this device any more.");
    const author = this.profile && this.profile.username || "player";
    const id = row ? row.id : crypto.randomUUID();
    const zip = await store.pack(localId, { name: details.name, description: details.description, version: details.version, author });
    const png = await ModImage.encode(zip, details.name + ".zip");          // the whole mod as one picture
    const path = this.uid() + "/" + id + ".png";
    await this.call("/storage/v1/object/workshop/" + path, {
      method: "POST", headers: { "x-upsert": "true", "Content-Type": "image/png" }, body: png
    });
    if (row && row.path !== path) this.call("/storage/v1/object/workshop/" + row.path, { method: "DELETE" }).catch(() => {});
    const data = { name: details.name, description: details.description, version: details.version, mature: !!details.mature,
                   tape: tape.tape, has_code: !!(info.scripts && info.scripts.length), size: png.size, path,
                   source_mod: localId, updated_at: new Date().toISOString() };
    if (row) await this.call("/rest/v1/workshop?id=eq." + id, { method: "PATCH", json: data });
    else await this.call("/rest/v1/workshop", { method: "POST", headers: { Prefer: "return=minimal" }, json: { id, user_id: this.uid(), ...data } });
    return id;
  },
  // change only the words / mature switch (no new upload)
  async editWorkshop(row, details) {
    await this.call("/rest/v1/workshop?id=eq." + row.id, { method: "PATCH", json: {
      name: details.name, description: details.description, version: details.version, mature: !!details.mature } });
    // (updated_at is left alone: it means "the files changed", so installs only show UPDATE for new files)
  },
  async unpublish(row) {
    await this.call("/storage/v1/object/workshop/" + row.path, { method: "DELETE" }).catch(() => {});
    await this.call("/rest/v1/workshop?id=eq." + row.id, { method: "DELETE" });
  },
  // download + put it in that tape's Downloaded list (id "ws-<workshop id>")
  async installWorkshop(row, check) {
    const tape = TAPES.find(t => t.tape === row.tape);
    if (!tape) throw new Error("That tape isn't out yet.");
    const res = await fetch(CLOUD_CONFIG.url.replace(/\/$/, "") + "/storage/v1/object/public/workshop/" + row.path + "?v=" + Date.parse(row.updated_at));
    if (!res.ok) throw new Error("Could not download that mod (" + res.status + ").");
    const info = await TapeMods(tape.key).unpack(await ModImage.toZip(await res.blob()), {     // picture -> original zip
      id: "ws-" + row.id, name: row.name, author: row.author, version: row.version, description: row.description,
      source: { type: "workshop", id: row.id, updated: row.updated_at }
    }, check);
    this.call("/rest/v1/rpc/workshop_downloaded", { method: "POST", json: { mod_id: row.id }, auth: false }).catch(() => {});
    return info;
  }
};
Cloud.loadSession();

/* =====================================================================
   DEMO (until the release on October 31, 2026 at 4:15 PM Eastern)
   Before the release, only the demo can be played:
     Tape 1: Night 1 and Dine In. Tape 2: locked.
   Signed in as one of the BYPASS accounts = the whole game.
   - Demo.on()     true while the demo is in force for this player
   - Demo.check()  call once on load (the menu and both tapes do): fixes the
                   clock with the web server's time and asks Supabase who is
                   really signed in (a copied/edited profile doesn't count)
   - Demo.left()   "6d 4h 12m" until the release
   Note: everything here runs in the player's browser, so a determined
   player can still get around it. It stops normal players, not hackers.
   ===================================================================== */
const DEMO = {
  until: Date.parse("2026-10-31T16:15:00-04:00"),   // Oct 31, 4:15 PM in Florida (EDT)
  bypass: ["fallgamedev", "jfor"],                   // usernames (any capitals) that can play everything
};
const Demo = {
  offset: 0,         // server time minus this device's time (ms)
  verified: null,    // true = Supabase confirmed the profile, false = the session is fake/expired, null = not checked
  checking: null,

  now() { return Date.now() + this.offset; },
  released() { return this.now() >= DEMO.until; },
  // signed in as FallGameDev or Jfor (and Supabase didn't say otherwise)
  owner() {
    const u = Cloud.signedIn() && Cloud.profile && Cloud.profile.username;
    return !!u && DEMO.bypass.includes(String(u).toLowerCase()) && this.verified !== false;
  },
  on() { return !this.released() && !this.owner(); },
  // time left, in words
  left() {
    let s = Math.max(0, Math.floor((DEMO.until - this.now()) / 1000));
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
  },
  releaseText: "October 31 at 4:15 PM (Eastern)",

  check() {
    if (this.checking) return this.checking;
    const work = (async () => {
      // 1. the web server's clock (changing the computer's clock doesn't unlock it)
      try {
        const t0 = Date.now();
        const r = await fetch(location.href.split("#")[0], { method: "HEAD", cache: "no-store" });
        const server = Date.parse(r.headers.get("Date"));
        if (server) this.offset = server - (t0 + Date.now()) / 2;
      } catch (e) {}
      // 2. who is signed in, asked to Supabase with the real session
      if (Cloud.ready() && Cloud.signedIn()) {
        try { await Cloud.loadProfile(); this.verified = true; }
        catch (e) { if (e.status === 401 || e.status === 403 || /signed out/i.test(e.message)) this.verified = false; }
      }
    })();
    // never hold the game up more than 4 seconds (offline, slow network...)
    this.checking = Promise.race([work, new Promise(r => setTimeout(r, 4000))]);
    return this.checking;
  },
  // after signing in or out (menu Settings), check again
  recheck() { this.checking = null; this.verified = null; return this.check(); },
};

// Supabase error words -> plain words for players
function friendlyError(msg) {
  const m = String(msg);
  if (/invalid login credentials/i.test(m)) return "Wrong email or password.";
  if (/email not confirmed/i.test(m)) return "Check your email and click the link to confirm your account first.";
  if (/already registered|already been registered/i.test(m)) return "There is already an account with that email.";
  if (/password should be at least/i.test(m)) return "Passwords need at least 6 characters.";
  if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a minute and try again.";
  if (/duplicate key.*username|profiles_username/i.test(m)) return "That username is taken.";
  if (/payload too large|413|exceeded the maximum/i.test(m)) return "That mod is too big for the account's storage limit.";
  if (/failed to fetch|networkerror/i.test(m)) return "Could not reach the account server. Check your internet.";
  return m;
}
