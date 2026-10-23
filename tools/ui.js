/* =====================================================================
   SETTINGS + MODS
   - Settings screen: jumpscares on/off, debug mode on/off, music volume, sound volume, mods
   - Mods: load a mod folder (or .zip), load a mod from a GitHub repo,
     download a template mod, and drag mods between "Downloaded" and
     "In use". In use mods replace game files; the top one wins.
   Mods are saved in this browser (the list in localStorage, the files in
   the browser's file database: no size limit) and applied when the game
   loads, so the page reloads after mods change.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Player settings (saved in this browser)
   --------------------------------------------------------------------- */
// Which game this is (each shell sets GAME_INFO; Tape 1 needs nothing)
const GI = Object.assign({ key: "frae1", modName: "My Eddie's Mod", gameId: "fried-rice-at-eddies-1",
  template: "eddies-1-mod-template.zip", debugKeys: "H next hour &middot; P +10% power &middot; G Golden" },
  typeof GAME_INFO !== "undefined" ? GAME_INFO : {});
const SETTINGS_KEY = GI.key + "-settings";
const settings = { music: 100, sound: 100, jumpscares: "0", debug: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch (e) {}
// Parental setting on the tape menu: no jumpscares at all (Tape 2: sensitive content off too)
if (Global.noJumpscares()) settings.jumpscares = "0";
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  Cloud.saved(SETTINGS_KEY);                    // backed up to the account (tools/global.js)
}
// This tape's sliders, times the global volumes from the tape menu's Settings
function applyVolumes() {
  Sound.musicBus.gain.value = settings.music / 100 * Global.vol("music");
  Sound.sfxBus.gain.value = settings.sound / 100 * Global.vol("sfx");
}

// Words for the settings screen (mods can change these too)
const T = s => (TEXTS[s] !== undefined ? String(TEXTS[s]) : s);

/* ---------------------------------------------------------------------
   Small helpers
   --------------------------------------------------------------------- */
const $ = sel => document.querySelector(sel);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v === false || v === null || v === undefined) continue;     // (disabled: false = not disabled)
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids) e.append(k);
  return e;
}
const MIME = {
  png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  svg: "image/svg+xml", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4",
  ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2", json: "application/json", txt: "text/plain",
  glb: "model/gltf-binary", gltf: "model/gltf+json", obj: "text/plain", fbx: "application/octet-stream"
};
// Games with characters drawn by the game (Tape 2) also take models/ and characters/ in a mod
const HAS_ACTORS = typeof ACTOR_FILES !== "undefined";
// "MyMod/models/Toy_Eddy.GLB" -> "models/toy_eddy.glb" (or null when it is not a character file)
function actorModFile(rel) {
  if (!HAS_ACTORS) return null;
  const m = rel.match(/^(models|characters)\/([^/]+)\.([a-z0-9]+)$/i);
  if (!m) return null;
  const folder = m[1].toLowerCase(), name = m[2].toLowerCase().replace(/[\s-]+/g, "_"), ext = m[3].toLowerCase();
  const ok = folder === "models" ? ["glb", "gltf", "fbx", "obj"] : ["png", "webp", "jpg", "jpeg", "gif", "svg"];
  const known = Object.entries(ACTOR_FILES).some(([role, list]) => role === name || list.some(c => c.file === name));
  return ok.includes(ext) && known ? folder + "/" + name + "." + ext : null;
}
// Blobs need the right type or the browser will not show SVGs
function typed(blob, path) {
  const type = MIME[path.split(".").pop().toLowerCase()] || "application/octet-stream";
  return blob.type === type ? blob : new Blob([blob], { type });
}
// what kind of file an extension is (a mod may swap a file for another of the same kind)
const KINDS = { image: ["png", "webp", "jpg", "jpeg", "gif", "svg"], audio: ["mp3", "wav", "ogg", "m4a"], font: ["ttf", "otf", "woff", "woff2"] };
const kindOf = p => { const e = p.split(".").pop().toLowerCase(); return Object.keys(KINDS).find(k => KINDS[k].includes(e)) || e; };
const stemOf = p => p.split("/").slice(-2).join("/").replace(/\.[^./]+$/, "").toLowerCase();
// Every file the game has (pictures, sounds, fonts): what a mod can replace
function assetFiles() { return [...allImagePaths(), ...Sound.allPaths(), ...Object.keys(FONT_FAMILY)]; }
let GAME_FILE_BY_STEM = null;
// A file the game does not have: new pictures and sounds get the game's own kind of path
// ("img/My Stuff/Big Cat.PNG" -> "img/my-stuff/big-cat.webp"); anything else stays as it is
function newModFile(rel) {
  const m = rel.match(/^(img|snd)\/([^/]+)\/([^/]+)\.([a-z0-9]+)$/i);
  if (m && m[1].toLowerCase() === "img" && kindOf(rel) === "image") return `img/${fileName(m[2])}/${fileName(m[3])}.webp`;
  if (m && m[1].toLowerCase() === "snd" && kindOf(rel) === "audio") return `snd/${fileName(m[2])}/${fileName(m[3])}.mp3`;
  return rel;
}
// "anything/img/office-normal.png" -> "img/office-normal.webp" (the game's own file), or null
function gameFile(path) {
  if (!GAME_FILE_BY_STEM) {
    GAME_FILE_BY_STEM = {};
    for (const a of assetFiles()) GAME_FILE_BY_STEM[stemOf(a)] = a;
  }
  const a = GAME_FILE_BY_STEM[stemOf(path)];
  return a && kindOf(a) === kindOf(path) ? a : null;
}

// Any picture -> PNG. Drawings (SVG) are made bigger so they stay sharp in close-ups.
async function toPng(blob, path) {
  const url = URL.createObjectURL(typed(blob, path));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let scale = 1;
    if (path.endsWith(".svg")) scale = 4;
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const k = Math.min(1, 4096 / Math.max(w, h));             // keep huge pictures a sane size
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

function sizeText(bytes) {
  return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
}

/* ---------------------------------------------------------------------
   Mod storage: NO SIZE LIMIT
   The list of mods (names, which are in use) lives in localStorage:
     "<game>-mods"        every mod's details, and the names of its files
     "<game>-mods-state"  { downloaded: [ids], inUse: [ids] }  (inUse[0] = top = wins)
   The files themselves (pictures, sounds, models, code...) live in the
   browser's file database (IndexedDB "<game>-mods-files"), which can hold
   as much as the device has room for (localStorage only holds about 5 MB).
   --------------------------------------------------------------------- */
const MODS_KEY = GI.key + "-mods", MODS_STATE_KEY = GI.key + "-mods-state";
const blobToDataUrl = blob => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});
// The file database: key "<mod id>/<path>" -> Blob
const ModFiles = {
  db: null,
  open() {
    if (!this.db) this.db = new Promise((res, rej) => {
      const r = indexedDB.open(MODS_KEY + "-files", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this.db;
  },
  // one transaction; fn gets the store and returns a request (its result is returned)
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction("files", mode);
      const req = fn(t.objectStore("files"));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = t.onabort = () => rej(t.error || new Error("storage error"));
    });
  },
  put(key, blob) { return this.run("readwrite", st => st.put(blob, key)); },
  get(key) { return this.run("readonly", st => st.get(key)); },
  removeMod(id) { return this.run("readwrite", st => st.delete(IDBKeyRange.bound(id + "/", id + "/\uffff"))); },
};

const ModDB = {
  read() { try { return JSON.parse(localStorage.getItem(MODS_KEY) || "[]"); } catch (e) { return []; } },
  write(list) {
    try { localStorage.setItem(MODS_KEY, JSON.stringify(list)); }
    catch (e) { throw new Error("Could not save the mod list (browser storage is full)."); }
  },
  // every mod, with its files as Blobs
  async allMods() {
    await this.upgrade();
    const list = this.read();
    for (const m of list) {
      const files = {};
      for (const path of m.fileList || []) {
        const blob = await ModFiles.get(m.id + "/" + path).catch(() => null);
        if (blob) files[path] = blob;
      }
      m.files = files;
    }
    return list;
  },
  async putMod(m) {
    // ask the browser to keep our files (so it doesn't clear them when space is low)
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    try {
      await ModFiles.removeMod(m.id);
      for (const [path, blob] of Object.entries(m.files)) await ModFiles.put(m.id + "/" + path, blob);
    } catch (e) {
      await ModFiles.removeMod(m.id).catch(() => {});
      throw new Error("Not enough free space on this device for that mod (" + sizeText(m.size || 0) + "). Free some space or delete a mod.");
    }
    const { files, ...info } = m;
    this.write([...this.read().filter(x => x.id !== m.id), { ...info, fileList: Object.keys(files) }]);
  },
  async deleteMod(id) {
    this.write(this.read().filter(x => x.id !== id));
    await ModFiles.removeMod(id).catch(() => {});
  },
  async getState() {
    try { return JSON.parse(localStorage.getItem(MODS_STATE_KEY)) || { downloaded: [], inUse: [] }; }
    catch (e) { return { downloaded: [], inUse: [] }; }
  },
  async putState(st) { localStorage.setItem(MODS_STATE_KEY, JSON.stringify(st)); },
  // mods saved by the 5 MB version (files as data: URLs inside localStorage) move to the file database once
  async upgrade() {
    const list = this.read();
    if (!list.some(m => m.files && !m.fileList)) return;
    for (const m of list) {
      if (!m.files || m.fileList) continue;
      const files = {};
      for (const [path, url] of Object.entries(m.files)) files[path] = await (await fetch(url)).blob();
      await this.putMod({ ...m, files });
    }
  },

  // Mods saved by the older version (IndexedDB) move over to localStorage once
  async moveOldMods() {
    if (localStorage.getItem(MODS_KEY) !== null || !window.indexedDB || !indexedDB.databases) return;
    const dbs = await indexedDB.databases();
    if (!dbs.some(d => d.name === MODS_KEY)) return;
    const db = await new Promise((res, rej) => { const r = indexedDB.open(MODS_KEY); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const get = (store, fn) => new Promise(res => {
      try { const req = fn(db.transaction(store).objectStore(store)); req.onsuccess = () => res(req.result); req.onerror = () => res(null); }
      catch (e) { res(null); }
    });
    const mods = (await get("mods", s => s.getAll())) || [];
    const state = (await get("meta", s => s.get("state"))) || { downloaded: [], inUse: [] };
    db.close();
    this.write([]);
    for (const m of mods) { try { await this.putMod(m); } catch (e) { console.warn("Old mod too big to move", m.name); } }
    const kept = new Set(this.read().map(m => m.id));
    await this.putState({ downloaded: state.downloaded.filter(id => kept.has(id)), inUse: state.inUse.filter(id => kept.has(id)) });
    indexedDB.deleteDatabase(MODS_KEY);
  }
};

/* ---------------------------------------------------------------------
   Turning a list of files into a mod
   files: [{path, blob}] with paths like "MyMod/img/x.webp"
   --------------------------------------------------------------------- */
async function makeMod(files, fallbackName, source) {
  files = files.filter(f => !/(^|\/)(\.|__MACOSX)/.test(f.path));   // skip hidden/system files
  // the folder holding manifest.json is the mod's main folder
  const manifests = files.filter(f => /(^|\/)manifest\.json$/i.test(f.path))
                         .sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  let root = "";
  if (manifests.length) root = manifests[0].path.replace(/manifest\.json$/i, "");
  else {
    // no manifest: if everything sits in one folder, use that folder
    const tops = new Set(files.map(f => f.path.split("/")[0]));
    if (tops.size === 1 && files.every(f => f.path.includes("/"))) root = [...tops][0] + "/";
  }
  let manifest = {};
  if (manifests.length) {
    try { manifest = JSON.parse(await manifests[0].blob.text()); }
    catch (e) { throw new Error("manifest.json is not valid JSON"); }
  }
  const mod = {
    id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: String(manifest.name || fallbackName || "Unnamed mod"),
    author: String(manifest.author || ""),
    version: String(manifest.version || ""),
    description: String(manifest.description || ""),
    source, files: {}, texts: null, size: 0, scripts: []
  };
  for (const f of files) {
    if (!f.path.startsWith(root)) continue;
    const rel = f.path.slice(root.length).replace(/^assets\//, "");
    if (/^manifest\.json$/i.test(rel)) continue;
    if (/^texts\.json$/i.test(rel)) {
      try { mod.texts = JSON.parse(await f.blob.text()); }
      catch (e) { throw new Error("texts.json is not valid JSON"); }
      continue;
    }
    // Every file is kept (no limits):
    //  - a file the game has (same name, any picture/sound/font type: img/x.png replaces img/x.webp)
    //  - characters: models/<name>.glb and characters/<name>.png (see actors.js)
    //  - NEW pictures img/<group>/<name>.png and sounds snd/<group>/<name>.mp3 (added to the game)
    //  - code: mod.js and any .js file (runs before the game starts, see MOD SCRIPTS)
    //  - anything else, kept as it is (a script can use it with FRAE.file("path"))
    const target = actorModFile(rel) || gameFile(rel) || newModFile(rel);
    mod.files[target] = typed(f.blob, rel);
    mod.size += f.blob.size;
    if (/\.m?js$/i.test(rel)) mod.scripts.push(target);
  }
  // mod.js first, then the other scripts by name
  mod.scripts.sort((a, b) => (b.toLowerCase() === "mod.js") - (a.toLowerCase() === "mod.js") || a.localeCompare(b));
  if (mod.scripts.length && !confirm(`"${mod.name}" runs its own code (${mod.scripts.join(", ")}).\n\n` +
      "Code in a mod can change ANYTHING in the game, and can also read your save files. Only use mods you trust.\n\nLoad it?")) {
    throw new Error("Not loaded (the mod has code and you said no)");
  }
  if (!Object.keys(mod.files).length && !mod.texts) {
    throw new Error("This mod is empty (download the template to see what a mod can have).");
  }
  return mod;
}

async function addMod(mod) {
  await ModDB.putMod(mod);
  const st = await ModDB.getState();
  st.downloaded.unshift(mod.id);
  await ModDB.putState(st);
}


/* ZIP files: makeZip() / readZip() live in tools/global.js (shared with the menu) */
function download(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

/* ---------------------------------------------------------------------
   Template mod: every game file (except the loading picture) + manifest + texts
   --------------------------------------------------------------------- */
async function buildTemplate(onProgress) {
  const enc = new TextEncoder(), entries = [];
  const manifest = {
    name: GI.modName,
    author: "",
    version: "1.0.0",
    description: "Describe your mod here",
    game: GI.gameId,
    howTo: "Replace any file in img, snd or fonts with your own using the SAME file name. Pictures can be PNG, JPG, WEBP or SVG at any size (they are stretched to fit the same spot). Sounds can be MP3, WAV or OGG. Change words in texts.json (only change the text on the right side). Delete the files you did not change to keep your mod small. Then load the folder (or a .zip of it) in Settings > Mods.",
    noLimits: "You can also ADD things: new pictures (img/<any folder>/<name>.png) and sounds (snd/<any folder>/<name>.mp3), any other file, and CODE: mod.js runs while the game loads and can change anything (see the notes inside mod.js)."
  };
  if (HAS_ACTORS) manifest.characters = "Characters: put a 3D model in models (toy_eddy.glb, withered_weddy.fbx... any of .glb .gltf .fbx .obj; .glb works best) or a full-body 2D drawing in characters (withered_eddy.png...). A model wins over a drawing, and both win over the game's own. File names: the ones already in those folders, or see models/README.txt.";
  entries.push({ path: "manifest.json", bytes: enc.encode(JSON.stringify(manifest, null, 2)) });
  entries.push({ path: "texts.json", bytes: enc.encode(JSON.stringify(DEFAULT_TEXTS, null, 2)) });
  entries.push({ path: "mod.js", bytes: enc.encode(MOD_JS_EXAMPLE) });
  let done = 0;
  // (the characters' drawings go in characters/ instead of img/chars)
  const files = assetFiles().filter(f => !(HAS_ACTORS && f.startsWith("img/chars/")));
  const queue = [...files];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const f = queue.shift();
      const blob = await (await fetch("assets/" + f)).blob();
      if (kindOf(f) === "image") {
        // every picture goes in the template as a PNG (easy to open in any paint program)
        const png = await toPng(blob, f);
        entries.push({ path: f.replace(/\.[^.]+$/, ".png"), bytes: new Uint8Array(await png.arrayBuffer()) });
      } else {
        entries.push({ path: f, bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      onProgress(++done / files.length);
    }
  });
  await Promise.all(workers);
  if (HAS_ACTORS) await addActorTemplate(entries, enc);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return makeZip(entries);
}

// mod.js in the template: notes and small examples (all switched off with //)
const MOD_JS_EXAMPLE = `// =====================================================================
// mod.js: your mod's own code. It runs while the game loads, before the
// title screen, and can change ANYTHING. (Delete this file if you don't need it.)
//
// Useful things:
//   game                  the running game (game.n = the night, game.level, game.progress...)
//   Game.prototype        every game function (update, render, drawOffice, startNight...)
//   PICTURE_NAMES         every picture group; pic("Group", "name") gets one, draw(ctx, p, x, y) draws it
//   SOUND_NAMES           every sound; game.sp.<speaker>.play("Group", "name")
//   TEXTS                 every word on screen (old text -> new text)
//   settings              the Settings menu values
//   FRAE.file(path)       url of any file in this mod
//   FRAE.image(path)      a picture from this mod, ready to draw (Promise)
//   FRAE.onReady(fn)      run when everything is loaded
//   FRAE.after / before / replace(object, "function", yourFunction)
//
// New pictures: put them in img/<any folder>/<name>.png and use pic("<folder>", "<name>").
// New sounds:   snd/<any folder>/<name>.mp3 and play them the same way.
// Open the browser console (F12) to see errors from your code.
// =====================================================================

// EXAMPLE: say hi when the game is ready
// FRAE.onReady(game => console.log("My mod is on!"));

// EXAMPLE: draw something of your own on top of every frame
// FRAE.after(Game.prototype, "render", function () {
//   const ctx = this.ctx;
//   ctx.fillStyle = "#ff0";
//   ctx.font = '12px "Press Start 2P"';
//   ctx.fillText("MODDED", 10, 350);
// });
`;

// Tape 2 templates: models/ (the game's 3D models) and characters/ (every 2D drawing, as PNG)
async function addActorTemplate(entries, enc) {
  const lines = ["Characters in this game: put ONE file per character in models (3D) or characters (2D).",
                 "A mod's model wins over its drawing, and both win over the game's own.", "",
                 "File name          Character"];
  const have = new Set(entries.map(e => e.path));
  for (const [role, list] of Object.entries(ACTOR_FILES)) {
    const name = list[0].file;
    lines.push(name.padEnd(19) + (CAST[role] ? CAST[role].name : role));
    // the game's own model, if it has one (so you can see how it is made)
    let model = false;
    for (const choice of list) {
      for (const type of MODEL_TYPES) {
        const path = "models/" + choice.file + "." + type;
        try {
          if (have.has(path)) { model = true; break; }
          const r = await fetch(MODEL_DIR + choice.file + "." + type);
          if (r.ok) { entries.push({ path, bytes: new Uint8Array(await r.arrayBuffer()) }); have.add(path); model = true; break; }
        } catch (e) { /* none */ }
      }
      if (model) break;
    }
    // the 2D drawing (only for characters without a model: a drawing in a mod wins over the game's model)
    if (!model && hasPic("Chars", role)) {
      try {
        const f = picturePath("Chars", role);
        const png = await toPng(await (await fetch("assets/" + f)).blob(), f);
        entries.push({ path: "characters/" + name + ".png", bytes: new Uint8Array(await png.arrayBuffer()) });
      } catch (e) { console.warn("No drawing for", role, e); }
    }
  }
  lines.push("toy_endo           Meyg (Toy Endo, bent and broken, until there is a meyg model)");
  lines.push("Faces: models/faces/<name>_head2.png (creepy) and _head3.png (scary) swap the head texture.");
  lines.push("", "3D: .glb works best (one file with colors and skeleton). .gltf must be one file (no .bin).",
             ".fbx and .obj work too. Models built on the base skeleton (UpperArm.L, Head...) get posed",
             "by the game (standing, and reaching for you). Browsers can't open .blend: export .glb.",
             "2D: a full-body drawing, see-through background, any size. The head is the top 40%.");
  const text = enc.encode(lines.join("\n"));
  entries.push({ path: "models/README.txt", bytes: text });
  entries.push({ path: "characters/README.txt", bytes: text });
}

/* ---------------------------------------------------------------------
   Loading a mod from GitHub ("packed")
   Accepts: user/repo, github.com/user/repo, or .../tree/branch/folder
   --------------------------------------------------------------------- */
async function loadFromGitHub(input, onStatus) {
  const m = input.trim().replace(/\.git$/, "").match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\/tree\/([^/]+)\/?(.*))?/);
  if (!m) throw new Error("Type a GitHub repo like user/repo");
  const [, owner, repo, branchIn, folderIn] = m;
  onStatus("Looking up " + owner + "/" + repo + "...");
  const api = "https://api.github.com/repos/" + owner + "/" + repo;
  const info = await fetch(api);
  if (info.status === 404) throw new Error("Repo not found (it has to be public)");
  if (!info.ok) throw new Error("GitHub said no (" + info.status + "). Try again in a bit.");
  const branch = branchIn || (await info.json()).default_branch;
  const tree = await (await fetch(api + "/git/trees/" + encodeURIComponent(branch) + "?recursive=1")).json();
  if (!tree.tree) throw new Error("Could not read the repo files");
  const folder = (folderIn || "").replace(/\/$/, "");
  const blobs = tree.tree.filter(t => t.type === "blob" && (!folder || t.path.startsWith(folder + "/")));
  const wanted = blobs.filter(t => !/(^|\/)(\.|README|LICENSE)/i.test(t.path));      // every file (no limits)
  if (!wanted.length) throw new Error("No mod files in that repo");
  const files = [];
  let done = 0;
  const queue = [...wanted];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const t = queue.shift();
      const url = "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch + "/" + t.path.split("/").map(encodeURIComponent).join("/");
      const r = await fetch(url);
      if (r.ok) files.push({ path: t.path, blob: await r.blob() });
      onStatus("Downloading " + (++done) + " / " + wanted.length);
    }
  });
  await Promise.all(workers);
  return makeMod(files, repo, { type: "github", repo: owner + "/" + repo, branch });
}

/* ---------------------------------------------------------------------
   Applying mods when the game loads
   --------------------------------------------------------------------- */
const FONT_FAMILY = {
  "fonts/NotoSans-Medium.ttf": "Sans Serif", "fonts/SourceSerifPro-Regular.otf": "Serif",
  "fonts/Grand9K-Pixel.ttf": "Pixel", "fonts/PressStart2P.woff2": "Press Start 2P",
  "fonts/CourierPrime.woff2": "Courier Prime", "fonts/ShareTechMono.woff2": "Share Tech Mono"
};
let DEFAULT_TEXTS = {};      // every word the game shows (assets/texts.json), by group
async function applyMods() {
  // start with the game's own words
  try { DEFAULT_TEXTS = await (await fetch("assets/texts.json")).json(); } catch (e) { console.warn("No texts.json", e); }
  const texts = {};
  const mergeTexts = obj => {
    for (const [k, v] of Object.entries(obj || {})) {
      if (v && typeof v === "object") mergeTexts(v);            // groups
      else if (typeof v === "string" && (v !== k || !(k in texts))) texts[k] = v;
    }
  };
  mergeTexts(DEFAULT_TEXTS);
  let mods = [];
  if (Global.noMods()) { TEXTS = texts; return 0; }      // parental setting: play without mods
  try {
    await ModDB.moveOldMods().catch(e => console.warn("Could not move old mods", e));
    const st = await ModDB.getState();
    const all = await ModDB.allMods();
    mods = st.inUse.map(id => all.find(m => m.id === id)).filter(Boolean);
  } catch (e) { console.warn("Mods unavailable", e); }
  // bottom mod first, so the top mod's files and words win
  const files = {};
  for (const mod of [...mods].reverse()) {
    Object.assign(files, mod.files);
    if (mod.texts) mergeTexts(mod.texts);
  }
  TEXTS = texts;
  addNewModFiles(files);
  for (const [path, blob] of Object.entries(files)) {
    MOD_FILES[path] = URL.createObjectURL(blob);         // the game loads this instead of its own file
    if (FONT_FAMILY[path]) {
      try {
        const face = new FontFace(FONT_FAMILY[path], await blob.arrayBuffer());
        await face.load();
        document.fonts.add(face);
      } catch (e) { console.warn("Mod font did not load", path); }
    }
  }
  // mod code runs last (bottom mod first, so the top mod's code has the final say)
  for (const mod of [...mods].reverse()) {
    for (const path of mod.scripts || []) {
      const blob = mod.files[path];
      if (!blob) continue;
      FRAE.mod = mod.name;
      try { await runModScript(blob, mod.name + "/" + path); }
      catch (e) { console.error("Mod code failed:", mod.name, path, e); }
    }
  }
  FRAE.mod = null;
  return mods.length;
}

// New pictures and sounds from mods join the game's lists (so pic("My Stuff", "big-cat") works)
function addNewModFiles(files) {
  const have = new Set([...allImagePaths(), ...Sound.allPaths()]);
  for (const path of Object.keys(files)) {
    if (have.has(path)) continue;
    const m = path.match(/^(img|snd)\/([^/]+)\/([^/]+)\.(webp|mp3)$/);
    if (!m) continue;
    const list = m[1] === "img" ? PICTURE_NAMES : SOUND_NAMES;
    // an existing group with the same file name, or a new group named after the folder
    const group = Object.keys(list).find(g => fileName(g) === m[2]) || m[2];
    (list[group] = list[group] || []).push(m[3]);
  }
}

// Runs one script file from a mod (a normal <script>, so it can use and change everything)
function runModScript(blob, label) {
  return new Promise(resolve => {
    const el = document.createElement("script");
    el.src = URL.createObjectURL(new Blob([blob], { type: "text/javascript" }));
    el.dataset.mod = label;
    el.onload = () => resolve();
    el.onerror = () => { console.error("Mod code did not load:", label); resolve(); };
    document.head.appendChild(el);
  });
}

/* =====================================================================
   MOD SCRIPTS: the modding toolbox (FRAE)
   A mod's mod.js (and any other .js file in it) runs while the game
   loads, before the title screen. It can use and change EVERYTHING:
   the game object (game), the Game class, every picture, sound, word
   and setting. These helpers make the common jobs short:

     FRAE.file("my-folder/thing.png")   url of any file in your mod
     FRAE.onReady(game => { ... })       run when everything is loaded
     FRAE.after(Game.prototype, "update", function () { ... })
         run your code after one of the game's functions
     FRAE.before(obj, "name", function (...args) { ... })
         run your code before it
     FRAE.replace(obj, "name", function (original, ...args) { ... })
         swap it for your own (call original(...args) to still run it)
     FRAE.image("my-folder/thing.png")   a ready-to-draw <img> (Promise)
   ===================================================================== */
const FRAE = {
  mod: null,
  readyList: [],
  file: path => MOD_FILES[path] || MOD_FILES[newModFile(path)] || null,
  onReady(fn) { this.readyList.push(fn); },
  runReady(game) {
    for (const fn of this.readyList) { try { fn(game); } catch (e) { console.error("Mod onReady failed", e); } }
  },
  after(obj, name, fn) {
    const old = obj[name];
    obj[name] = function (...args) { const r = old.apply(this, args); fn.apply(this, [r, ...args]); return r; };
  },
  before(obj, name, fn) {
    const old = obj[name];
    obj[name] = function (...args) { fn.apply(this, args); return old.apply(this, args); };
  },
  replace(obj, name, fn) {
    const old = obj[name];
    obj[name] = function (...args) { return fn.call(this, (...a) => old.apply(this, a), ...args); };
  },
  image(path) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = FRAE.file(path) || path; });
  },
};


/* =====================================================================
   DEBUG MODE
   A see-through box in the top left corner that shows what the game is
   doing right now: speed (FPS), the mouse spot, the screen, and during a
   night the power, time and where every character is. Values that just
   changed show in yellow.
   Extra keys while debug mode is on:
     H  skip to the next hour      P  +10% power
     G  make Golden show up on the next monitor flip (press again to undo)
   ===================================================================== */
let debugTimer = 0, debugFrames = 0, debugLast = {};
// counts screen refreshes so we can show FPS
function debugCount() { debugFrames++; if (settings.debug) requestAnimationFrame(debugCount); }
function applyDebug() {
  const box = $("#debug");
  box.hidden = !settings.debug;
  clearInterval(debugTimer);
  if (!settings.debug) {
    // debug mode off: anything that changed while it was on is thrown away (back to the saved file)
    if (typeof game !== "undefined" && game.file) {
      const level = game.level;
      game.useFile(game.file);
      if (game.screen !== "title") game.level = level;      // finish the current night as it is
    }
    return;
  }
  debugFrames = 0;
  requestAnimationFrame(debugCount);
  let lastTime = performance.now();
  const esc = v => String(v).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  debugTimer = setInterval(() => {
    const now = performance.now();
    const fps = Math.round(debugFrames * 1000 / (now - lastTime));
    debugFrames = 0; lastTime = now;
    const info = game.debugInfo();
    const rows = Object.entries(info).map(([k, v]) => {
      const changed = debugLast[k] !== undefined && debugLast[k] !== String(v);
      debugLast[k] = String(v);
      return `<div${changed ? ' class="chg"' : ""}>${esc(k)} <b>${esc(v)}</b></div>`;
    }).join("");
    box.innerHTML =
      `<div class="head">DEBUG</div>` +
      `<div>FPS <b>${fps}</b> &nbsp; mouse <b>${Math.round(game.mouse.x)}, ${Math.round(game.mouse.y)}</b>${game.mouse.down ? " (down)" : ""}</div>` +
      `<div class="vars">${rows}</div>` +
      `<div class="keys">${GI.debugKeys}</div>` +
      `<div class="warn">${T("Saving and achievements are off")}</div>`;
  }, 200);
}
document.addEventListener("keydown", e => {
  if (!settings.debug || e.target.tagName === "INPUT" || e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "h") game.debugSkipHour();
  if (k === "p") game.debugAddPower();
  if (k === "g") game.goldenRate = game.goldenRate === 1 ? 10000 : 1;
});

/* =====================================================================
   GOLDEN EDDIE'S RATE (press the left arrow, like in the original)
   Golden shows up 1 in this many times you flip the monitor up.
   ===================================================================== */
function askGoldenRate() {
  const form = $("#ask"), input = $("#askInput");
  $("#askText").textContent = T("Golden Freddy Rate?") + " (1 in " + game.goldenRate + ")";
  input.value = "";
  form.hidden = false;
  game.paused = true;
  input.focus();
  form.onsubmit = e => {
    e.preventDefault();
    const n = Math.round(Number(input.value));
    if (n >= 1) game.goldenRate = n;
    form.hidden = true;
    game.paused = false;
    canvas.focus();
  };
}

/* =====================================================================
   SAVE FILES
   Shown when the address has no ?file= (or not 1-3). Picking a file puts
   ?file=N in the address so a refresh or bookmark keeps the same file.
   ===================================================================== */
function fileSummary(n) {
  const p = loadProgress(n);
  if (!p.started) return T("EMPTY");
  const stars = "★".repeat(p.beat5 + p.beat6 + p.beat420);
  const trophies = Object.keys(p.achievements).length;          // achievements unlocked
  return T("Night") + " " + p.night + (stars ? "  " + stars : "") + (trophies ? "  ·  🏆 " + trophies : "");
}
function showFiles() {
  const box = $("#filesPanel");
  box.innerHTML = "";
  const slots = el("div", { class: "slots" });
  for (let n = 1; n <= SAVE_FILES; n++) {
    const p = loadProgress(n);
    const slot = el("button", { class: "slot" + (p.started ? "" : " empty"), onclick: () => pickFile(n) },
      el("span", { class: "fileName" }, T("FILE") + " " + n),
      el("span", { class: "fileInfo" }, fileSummary(n)));
    const erase = el("button", { class: "erase", title: "Erase this file", onclick: e => {
      e.stopPropagation();
      if (confirm(T("FILE") + " " + n + ": erase this save?")) { eraseProgress(n); showFiles(); }
    } }, T("ERASE"));
    slots.append(el("div", { class: "slotWrap" }, slot, p.started ? erase : ""));
  }
  box.append(el("h2", {}, T("Select a file")), slots, el("div", { class: "hint" }, "1 / 2 / 3  ·  Esc: game menu"));
  box.hidden = false;
}
function pickFile(n) {
  blip();
  history.replaceState(null, "", "?file=" + n);
  try { localStorage.setItem("frae-file", String(n)); } catch (e) {}      // the game menu remembers it too
  $("#filesPanel").hidden = true;
  game.useFile(n);
  game.boot();
  canvas.focus();
}
document.addEventListener("keydown", e => {
  if ($("#filesPanel").hidden || e.target.tagName === "INPUT") return;
  const n = Number(e.key);
  if (n >= 1 && n <= SAVE_FILES) pickFile(n);
});

/* =====================================================================
   SETTINGS SCREEN
   ===================================================================== */
function buildSettings() {
  const box = $("#settingsPanel");
  box.innerHTML = "";
  // ON/OFF buttons for debug mode
  const dbBtn = (label, val) => el("button", {
    class: "pick" + (settings.debug === val ? " on" : ""),
    onclick: () => { settings.debug = val; saveSettings(); applyDebug(); buildSettings(); blip(); }
  }, T(label));
  const jsBtn = (label, val) => el("button", {
    class: "pick" + (settings.jumpscares === val ? " on" : ""),
    disabled: Global.noJumpscares(),                     // locked by the parental settings
    onclick: () => {
      settings.jumpscares = val; saveSettings(); buildSettings(); blip();
      if (typeof onJumpscaresChanged === "function") onJumpscaresChanged();      // (Tape 2: sensitive content follows it)
    }
  }, T(label));
  const slider = (key) => {
    const out = el("span", { class: "val" }, settings[key] + "%");
    const input = el("input", { type: "range", min: "0", max: "100", step: "5", value: settings[key] });
    input.addEventListener("input", () => { settings[key] = +input.value; out.textContent = input.value + "%"; applyVolumes(); saveSettings(); });
    return [input, out];
  };
  box.append(
    el("h2", {}, T("Settings")),
    el("div", { class: "row" }, el("span", { class: "label" }, T("Jumpscares")),
       el("div", { class: "pair" }, jsBtn("ON", "1"), jsBtn("OFF", "0")),
       Global.noJumpscares() ? el("span", { class: "note" }, T("locked by parental settings")) : ""),
    el("div", { class: "row" }, el("span", { class: "label" }, T("Debug mode")),
       el("div", { class: "pair" }, dbBtn("ON", true), dbBtn("OFF", false)),
       el("span", { class: "note" }, T("no saving or achievements while on"))),
    el("div", { class: "row" }, el("span", { class: "label" }, T("Save file")),
       el("span", { class: "fileNow" }, T("FILE") + " " + game.file + "  (" + fileSummary(game.file) + ")"),
       el("button", { class: "small", onclick: () => {
         // back to the file screen
         $("#settingsPanel").hidden = true;
         game.paused = false;
         game.go("black");
         Sound.stopAll();
         history.replaceState(null, "", location.pathname);
         showFiles();
       } }, T("CHANGE"))),
    el("div", { class: "row" }, el("span", { class: "label" }, T("Music")), ...slider("music")),
    el("div", { class: "row" }, el("span", { class: "label" }, T("Sound")), ...slider("sound")),
    el("div", { class: "row" }, el("span", { class: "label" }, ""),
       el("button", { class: "big", disabled: Global.noMods(), title: Global.noMods() ? T("Mods are turned off in the parental settings") : "",
                      onclick: () => { blip(); openMods(); } }, T("Mods")),
       el("button", { class: "big", onclick: () => { blip(); openDevlog(); } }, T("Devlog")),
       Global.chicken() ? el("span", { class: "note" }, T("Chicken mode: 10x easier, no achievements")) : ""),
    el("button", { class: "confirm", onclick: closeSettings }, T("CONFIRM"))
  );
}
function openSettings() {
  buildSettings();
  $("#settingsPanel").hidden = false;
  game.paused = true;
}
function closeSettings() {
  $("#settingsPanel").hidden = true;
  game.paused = false;
  game.settingsClosed();
  canvas.focus();
}
// a short menu blip (made with Web Audio, so it follows the Sound slider)
function blip() {
  const ac = Sound.ctx, o = ac.createOscillator(), g = ac.createGain();
  o.type = "square"; o.frequency.value = 660;
  g.gain.setValueAtTime(0.05, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
  o.connect(g).connect(Sound.sfxBus); o.start(); o.stop(ac.currentTime + 0.08);
}

/* =====================================================================
   DEVLOG (Settings > Devlog): every update, newest first, by day.
   The list is tools/devlog.json (the build puts this tape's part in DEVLOG).
   ===================================================================== */
function openDevlog() {
  const box = $("#devlogPanel");
  box.innerHTML = "";
  const log = typeof DEVLOG !== "undefined" ? DEVLOG : [];
  const days = new Map();
  for (const e of log) { if (!days.has(e.date)) days.set(e.date, []); days.get(e.date).push(e); }
  const list = el("div", { class: "logList" });
  const order = [...days.keys()].sort().reverse();
  order.forEach((d, i) => {
    const items = days.get(d);
    const when = new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    const day = el("div", { class: "logDay" },
      el("div", { class: "logHead" },
        el("span", { class: "logVer" }, T("Update") + " " + (order.length - i)),
        el("span", { class: "logDate" }, when),
        el("span", { class: "logCount" }, items.length + " " + T(items.length === 1 ? "change" : "changes"))),
      el("ul", {}, ...items.map(e => el("li", { class: e.tapes.length > 1 ? "both" : "" }, e.text,
        e.tapes.length > 1 ? el("span", { class: "logTag" }, T("both tapes")) : ""))));
    list.append(day);
  });
  box.append(
    el("div", { class: "logTop" },
      el("button", { onclick: closeDevlog }, "< " + T("BACK")),
      el("h2", {}, T("Devlog")),
      el("span", { class: "logTotal" }, log.length + " " + T("changes") + ", " + order.length + " " + T("updates"))),
    list);
  box.hidden = false;
  list.scrollTop = 0;
}
function closeDevlog() { $("#devlogPanel").hidden = true; blip(); }

/* =====================================================================
   MODS SCREEN
   ===================================================================== */
let modState = null, modList = [], modsChanged = false;

async function openMods() {
  $("#modsPanel").hidden = false;
  try {
    modState = await ModDB.getState();
    modList = await ModDB.allMods();
  } catch (e) {
    modStatus("Mods cannot be saved in this browser (private mode?)", true);
    modState = { downloaded: [], inUse: [] }; modList = [];
  }
  // forget ids of deleted mods, add mods missing from both lists
  const ids = new Set(modList.map(m => m.id));
  modState.downloaded = modState.downloaded.filter(id => ids.has(id));
  modState.inUse = modState.inUse.filter(id => ids.has(id));
  for (const m of modList) if (!modState.downloaded.includes(m.id) && !modState.inUse.includes(m.id)) modState.downloaded.push(m.id);
  renderMods();
}
async function closeMods() {
  $("#modsPanel").hidden = true;
  if (modsChanged) {
    // mods are applied while loading, so load the game again
    $("#reloadNote").hidden = false;
    setTimeout(() => location.reload(), 300);
  }
}
function modStatus(msg, bad) {
  const s = $("#modStatus");
  s.textContent = msg;
  s.classList.toggle("bad", !!bad);
}
async function saveModState() {
  modsChanged = true;
  try { await ModDB.putState(modState); } catch (e) {}
}

function renderMods() {
  for (const [key, listEl] of [["downloaded", $("#modsDownloaded")], ["inUse", $("#modsInUse")]]) {
    listEl.innerHTML = "";
    for (const id of modState[key]) {
      const m = modList.find(x => x.id === id);
      if (!m) continue;
      const files = Object.keys(m.files).length;
      const card = el("div", { class: "mod", "data-id": id },
        el("div", { class: "modName" }, m.name),
        el("div", { class: "modInfo" }, [m.author && "by " + m.author, m.version && "v" + m.version,
          files + " file" + (files === 1 ? "" : "s") + (m.texts ? " + texts" : ""), sizeText(m.size)].filter(Boolean).join(" · ")),
        el("button", { class: "del", title: "Delete this mod", onclick: e => { e.stopPropagation(); deleteMod(id); } }, "×"));
      if (m.description) card.title = m.description;
      // double click (or double tap) moves a mod to the other list
      card.addEventListener("dblclick", () => moveMod(id, key === "inUse" ? "downloaded" : "inUse", 0));
      card.addEventListener("pointerdown", e => startDrag(e, card, id));
      listEl.append(card);
    }
    if (!listEl.children.length) listEl.append(el("div", { class: "empty" }, key === "inUse" ? "Drag mods here to use them" : "No mods yet"));
  }
}
function moveMod(id, toKey, index) {
  for (const k of ["downloaded", "inUse"]) modState[k] = modState[k].filter(x => x !== id);
  modState[toKey].splice(Math.min(index, modState[toKey].length), 0, id);
  saveModState();
  renderMods();
}
async function deleteMod(id) {
  const m = modList.find(x => x.id === id);
  if (!confirm("Delete \"" + (m ? m.name : "mod") + "\"?")) return;
  try { await ModDB.deleteMod(id); } catch (e) {}
  modList = modList.filter(x => x.id !== id);
  const wasInUse = modState.inUse.includes(id);
  modState.downloaded = modState.downloaded.filter(x => x !== id);
  modState.inUse = modState.inUse.filter(x => x !== id);
  if (wasInUse) modsChanged = true;
  await ModDB.putState(modState).catch(() => {});
  renderMods();
}

/* ---- drag and drop (works with mouse and touch) ---- */
let drag = null;
function startDrag(e, card, id) {
  if (e.target.closest(".del")) return;
  const r = card.getBoundingClientRect();
  drag = { id, card, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, live: false };
  card.setPointerCapture(e.pointerId);
  card.addEventListener("pointermove", dragMove);
  card.addEventListener("pointerup", dragEnd, { once: true });
  card.addEventListener("pointercancel", dragEnd, { once: true });
}
function dragMove(e) {
  if (!drag) return;
  if (!drag.live) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.live = true;
    drag.ghost = drag.card.cloneNode(true);
    drag.ghost.classList.add("ghost");
    drag.ghost.style.width = drag.w + "px";
    $("#modsPanel").append(drag.ghost);           // inside the panel so it keeps the panel's text size
    drag.card.classList.add("dragging");
    drag.mark = el("div", { class: "dropMark" });
  }
  drag.ghost.style.left = (e.clientX - drag.ox) + "px";
  drag.ghost.style.top = (e.clientY - drag.oy) + "px";
  // where would it land?
  const target = dropTarget(e.clientX, e.clientY);
  if (target) {
    const kids = [...target.list.querySelectorAll(".mod:not(.dragging)")];
    const before = kids[target.index];
    before ? target.list.insertBefore(drag.mark, before) : target.list.append(drag.mark);
  } else drag.mark.remove();
}
function dropTarget(x, y) {
  for (const [key, list] of [["downloaded", $("#modsDownloaded")], ["inUse", $("#modsInUse")]]) {
    const r = list.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top - 10 || y > r.bottom + 10) continue;
    const kids = [...list.querySelectorAll(".mod:not(.dragging)")];
    let index = kids.length;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i].getBoundingClientRect();
      if (y < k.top + k.height / 2) { index = i; break; }
    }
    return { key, list, index };
  }
  return null;
}
function dragEnd(e) {
  const d = drag;
  drag = null;
  if (!d) return;
  d.card.removeEventListener("pointermove", dragMove);
  if (!d.live) return;
  d.ghost.remove();
  if (d.mark) d.mark.remove();
  d.card.classList.remove("dragging");
  const target = dropTarget(e.clientX, e.clientY);
  if (target) moveMod(d.id, target.key, target.index);
}

/* ---- loading mods ---- */
async function loadUnpacked(fileList, fromZip) {
  fileList = [...(fileList || [])];            // copy now: the picker is cleared right after
  if (!fileList.length) return;
  try {
    let files, name;
    if (fromZip) {
      modStatus("Opening zip...");
      files = await readZip(fileList[0]);
      name = fileList[0].name.replace(/\.zip$/i, "");
    } else {
      files = [...fileList].map(f => ({ path: f.webkitRelativePath || f.name, blob: f }));
      name = (files[0].path.split("/")[0]) || "Mod";
    }
    const mod = await makeMod(files, name, { type: fromZip ? "zip" : "folder" });
    await addMod(mod);
    modList.push(mod);
    modState.downloaded.unshift(mod.id);
    renderMods();
    modStatus("Loaded \"" + mod.name + "\". Drag it to In use to turn it on.");
  } catch (e) {
    modStatus(e.message || String(e), true);
  }
}
async function loadPacked() {
  const input = $("#ghInput").value;
  if (!input.trim()) return modStatus("Type a GitHub repo first, like user/repo", true);
  $("#ghLoad").disabled = true;
  try {
    const mod = await loadFromGitHub(input, msg => modStatus(msg));
    await addMod(mod);
    modList.push(mod);
    modState.downloaded.unshift(mod.id);
    renderMods();
    modStatus("Loaded \"" + mod.name + "\" from GitHub. Drag it to In use to turn it on.");
  } catch (e) {
    modStatus(e.message || String(e), true);
  }
  $("#ghLoad").disabled = false;
}
async function downloadTemplate() {
  const btn = $("#tplBtn");
  btn.disabled = true;
  try {
    const zip = await buildTemplate(p => modStatus("Packing template... " + Math.round(p * 100) + "%"));
    download(zip, GI.template);
    modStatus("Template downloaded. Unzip it, change files, then load the folder.");
  } catch (e) {
    modStatus("Could not make the template: " + (e.message || e), true);
  }
  btn.disabled = false;
}

/* ---- wire up the buttons ---- */
function setupModsUI() {
  $("#modsBack").onclick = closeMods;
  $("#tabUnpacked").onclick = () => showTab("unpacked");
  $("#tabPacked").onclick = () => showTab("packed");
  $("#pickFolder").onclick = () => $("#folderInput").click();
  $("#pickZip").onclick = () => $("#zipInput").click();
  $("#folderInput").onchange = e => { loadUnpacked(e.target.files, false); e.target.value = ""; };
  $("#zipInput").onchange = e => { loadUnpacked(e.target.files, true); e.target.value = ""; };
  $("#tplBtn").onclick = downloadTemplate;
  $("#ghLoad").onclick = loadPacked;
  // WORKSHOP: the shared page (workshop/index.html) for this tape; BACK there returns to this exact page
  $("#workshopBtn").onclick = () => {
    blip();
    const tape = GI.key.replace(/\D/g, "");
    location.href = "../workshop/?tape=" + tape + "&back=" + encodeURIComponent(location.pathname + location.search);
  };
  $("#ghInput").addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") loadPacked(); });
  showTab("unpacked");
}
function showTab(which) {
  $("#tabUnpacked").classList.toggle("on", which === "unpacked");
  $("#tabPacked").classList.toggle("on", which === "packed");
  $("#paneUnpacked").hidden = which !== "unpacked";
  $("#panePacked").hidden = which !== "packed";
}
