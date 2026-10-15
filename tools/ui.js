/* =====================================================================
   SETTINGS + MODS
   - Settings screen: jumpscares on/off, debug mode on/off, music volume, sound volume, mods
   - Mods: load a mod folder (or .zip), load a mod from a GitHub repo,
     download a template mod, and drag mods between "Downloaded" and
     "In use". In use mods replace game files; the top one wins.
   Mods are saved in this browser (localStorage) and applied when the game
   loads, so the page reloads after mods change.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Player settings (saved in this browser)
   --------------------------------------------------------------------- */
const SETTINGS_KEY = "frae1-settings";
const settings = { music: 100, sound: 100, jumpscares: "0", debug: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); } catch (e) {}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }
function applyVolumes() {
  Sound.musicBus.gain.value = settings.music / 100;
  Sound.sfxBus.gain.value = settings.sound / 100;
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
    else e.setAttribute(k, v);
  }
  for (const k of kids) e.append(k);
  return e;
}
const MIME = {
  png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  svg: "image/svg+xml", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4",
  ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2", json: "application/json", txt: "text/plain"
};
// Blobs need the right type or the browser will not show SVGs
function typed(blob, path) {
  const type = MIME[path.split(".").pop().toLowerCase()] || "application/octet-stream";
  return blob.type === type ? blob : new Blob([blob], { type });
}
// what kind of file an extension is (a mod may swap a file for another of the same kind)
const KINDS = { image: ["png", "webp", "jpg", "jpeg", "gif", "svg"], audio: ["mp3", "wav", "ogg", "m4a"], font: ["ttf", "otf", "woff", "woff2"] };
const kindOf = p => { const e = p.split(".").pop().toLowerCase(); return Object.keys(KINDS).find(k => KINDS[k].includes(e)) || e; };
const stemOf = p => p.split("/").slice(-2).join("/").replace(/\.[^./]+$/, "").toLowerCase();
let GAME_FILE_BY_STEM = null;
// "anything/img/office-normal.png" -> "img/office-normal.webp" (the game's own file), or null
function gameFile(path) {
  if (!GAME_FILE_BY_STEM) {
    GAME_FILE_BY_STEM = {};
    for (const a of ASSET_FILES) GAME_FILE_BY_STEM[stemOf(a)] = a;
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
    if (path.endsWith(".svg")) scale = path.startsWith("characters/") ? 6 : 4;
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
   Mod storage (localStorage)
   Store "mods": { id, name, author, version, description, source, size, files: {path: Blob}, texts }
   Store "meta": "state" -> { downloaded: [ids], inUse: [ids] }  (inUse[0] = top = wins)
   --------------------------------------------------------------------- */
// Mods live in localStorage: "frae1-mods" holds every mod (its files as text,
// so pictures and sounds are stored as data: URLs), "frae1-mods-state" holds
// which mods are downloaded and which are in use (top first).
// Browsers give a site about 5 MB of localStorage, so mods must stay small.
const MODS_KEY = "frae1-mods", MODS_STATE_KEY = "frae1-mods-state";
const blobToDataUrl = blob => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});
const ModDB = {
  read() { try { return JSON.parse(localStorage.getItem(MODS_KEY) || "[]"); } catch (e) { return []; } },
  write(list) {
    try { localStorage.setItem(MODS_KEY, JSON.stringify(list)); }
    catch (e) { throw new Error("Not enough room in this browser's storage for that mod (about 5 MB total). Try a smaller mod, or delete one."); }
  },
  // every mod, with its files turned back into Blobs
  async allMods() {
    const list = this.read();
    for (const m of list) {
      const files = {};
      for (const [path, url] of Object.entries(m.files)) files[path] = await (await fetch(url)).blob();
      m.files = files;
    }
    return list;
  },
  async putMod(m) {
    const files = {};
    for (const [path, blob] of Object.entries(m.files)) files[path] = await blobToDataUrl(blob);
    this.write([...this.read().filter(x => x.id !== m.id), { ...m, files }]);
  },
  async deleteMod(id) { this.write(this.read().filter(x => x.id !== id)); },
  async getState() {
    try { return JSON.parse(localStorage.getItem(MODS_STATE_KEY)) || { downloaded: [], inUse: [] }; }
    catch (e) { return { downloaded: [], inUse: [] }; }
  },
  async putState(st) { localStorage.setItem(MODS_STATE_KEY, JSON.stringify(st)); },

  // Mods saved by the older version (IndexedDB) move over to localStorage once
  async moveOldMods() {
    if (localStorage.getItem(MODS_KEY) !== null || !window.indexedDB || !indexedDB.databases) return;
    const dbs = await indexedDB.databases();
    if (!dbs.some(d => d.name === "frae1-mods")) return;
    const db = await new Promise((res, rej) => { const r = indexedDB.open("frae1-mods"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
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
    indexedDB.deleteDatabase("frae1-mods");
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
    source, files: {}, texts: null, size: 0
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
    // only keep files the game actually has (a mod replaces files, it cannot add new ones).
    // Same name, any picture/sound/font type: img/x.png replaces img/x.webp
    const target = gameFile(rel);
    if (!target) continue;
    mod.files[target] = typed(f.blob, rel);
    mod.size += f.blob.size;
  }
  if (!Object.keys(mod.files).length && !mod.texts) {
    throw new Error("No game files found. A mod needs files like img/..., snd/... or a texts.json (download the template to see).");
  }
  return mod;
}

async function addMod(mod) {
  await ModDB.putMod(mod);
  const st = await ModDB.getState();
  st.downloaded.unshift(mod.id);
  await ModDB.putState(st);
}

/* ---------------------------------------------------------------------
   ZIP files (no libraries): write uncompressed zips, read normal zips
   --------------------------------------------------------------------- */
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
// Blob (.zip) -> [{path, blob}]
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
    name: "My Eddie's Mod",
    author: "",
    version: "1.0.0",
    description: "Describe your mod here",
    game: "fried-rice-at-eddies-1",
    howTo: "Replace any file in img, snd, characters or fonts with your own using the SAME file name. Pictures can be PNG, JPG, WEBP or SVG at any size (they are stretched to fit the same spot). Sounds can be MP3, WAV or OGG. Change words in texts.json (only change the text on the right side). Delete the files you did not change to keep your mod small. Then load the folder (or a .zip of it) in Settings > Mods."
  };
  entries.push({ path: "manifest.json", bytes: enc.encode(JSON.stringify(manifest, null, 2)) });
  entries.push({ path: "texts.json", bytes: enc.encode(JSON.stringify(DEFAULT_TEXTS, null, 2)) });
  let done = 0;
  const queue = [...ASSET_FILES];
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
      onProgress(++done / ASSET_FILES.length);
    }
  });
  await Promise.all(workers);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return makeZip(entries);
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
  const wanted = blobs.filter(t => /(^|\/)(manifest\.json|texts\.json)$/i.test(t.path) ||
                                   gameFile(t.path));
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
async function applyMods() {
  // start with the game's own words
  const texts = {};
  const mergeTexts = obj => {
    for (const [k, v] of Object.entries(obj || {})) {
      if (v && typeof v === "object") mergeTexts(v);            // groups
      else if (typeof v === "string" && (v !== k || !(k in texts))) texts[k] = v;
    }
  };
  mergeTexts(DEFAULT_TEXTS);
  let mods = [];
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
  const url = {};
  for (const [path, blob] of Object.entries(files)) {
    url["assets/" + path] = URL.createObjectURL(blob);
    if (FONT_FAMILY[path]) {
      try {
        const face = new FontFace(FONT_FAMILY[path], await blob.arrayBuffer());
        await face.load();
        document.fonts.add(face);
      } catch (e) { console.warn("Mod font did not load", path); }
    }
  }
  // point every picture layer and sound at the mod's file instead
  for (const group of Object.values(ART))
    for (const p of Object.values(group.pics)) for (const L of p.layers) if (L.img && url[L.img]) L.img = url[L.img];
  for (const group of Object.values(SOUNDS))
    for (const s of Object.values(group)) if (url[s.src]) s.src = url[s.src];
  return mods.length;
}

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
  if (!settings.debug) return;
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
      `<div class="keys">H next hour &middot; P +10% power &middot; G Golden</div>`;
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
  return T("Night") + " " + p.night + (stars ? "  " + stars : "");
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
    onclick: () => { settings.jumpscares = val; saveSettings(); buildSettings(); blip(); }
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
       el("div", { class: "pair" }, jsBtn("ON", "1"), jsBtn("OFF", "0"))),
    el("div", { class: "row" }, el("span", { class: "label" }, T("Debug mode")),
       el("div", { class: "pair" }, dbBtn("ON", true), dbBtn("OFF", false))),
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
       el("button", { class: "big", onclick: () => { blip(); openMods(); } }, T("Mods"))),
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
    download(zip, "eddies-1-mod-template.zip");
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
  $("#ghInput").addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") loadPacked(); });
  showTab("unpacked");
}
function showTab(which) {
  $("#tabUnpacked").classList.toggle("on", which === "unpacked");
  $("#tabPacked").classList.toggle("on", which === "packed");
  $("#paneUnpacked").hidden = which !== "unpacked";
  $("#panePacked").hidden = which !== "packed";
}
