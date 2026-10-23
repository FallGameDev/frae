/* =====================================================================
   GLOBAL SETTINGS + ACCOUNTS (tools/global.js)
   Shared by the tape select menu (index.html loads this file) and both
   tapes (build_game1.py / build_game2.py paste it into the game page).

   - Global: settings for EVERY tape, changed on the menu's Settings
     button. Saved in localStorage "frae-global".
       visuals:  brightness, picture quality, VHS effects, calm menu
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
    calm: false        // menu: no flicker or bouncing (reduced motion)
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
   A TAPE'S MODS, read and written from outside the game
   (the same layout as ModDB / ModFiles in tools/ui.js:
    localStorage "<tape>-mods" + "<tape>-mods-state",
    IndexedDB "<tape>-mods-files", store "files", key "<mod id>/<path>")
   ===================================================================== */
const TAPES = [
  { tape: 1, key: "frae1", name: "Tape 1" },
  { tape: 2, key: "frae2", name: "Tape 2" }
];
function TapeMods(key) {
  const listKey = key + "-mods", stateKey = key + "-mods-state";
  let db = null;
  const open = () => db || (db = new Promise((res, rej) => {
    const r = indexedDB.open(listKey + "-files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction("files", mode);
      const req = fn(t.objectStore("files"));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = t.onabort = () => rej(t.error || new Error("storage error"));
    });
  };
  return {
    list() { try { return JSON.parse(localStorage.getItem(listKey) || "[]"); } catch (e) { return []; } },
    state() { try { return JSON.parse(localStorage.getItem(stateKey)) || { downloaded: [], inUse: [] }; } catch (e) { return { downloaded: [], inUse: [] }; } },
    // one mod as a .zip: mod.json (its details + file types) and files/<path>
    async pack(id) {
      const info = this.list().find(m => m.id === id);
      if (!info) throw new Error("That mod is not on this device");
      const entries = [], types = {};
      for (const path of info.fileList || []) {
        const blob = await run("readonly", st => st.get(id + "/" + path)).catch(() => null);
        if (!blob) continue;
        types[path] = blob.type || "";
        entries.push({ path: "files/" + path, bytes: new Uint8Array(await blob.arrayBuffer()) });
      }
      const meta = new TextEncoder().encode(JSON.stringify({ ...info, types }));
      return makeZip([{ path: "mod.json", bytes: meta }, ...entries]);
    },
    // a zip made by pack() goes back into this tape (in the Downloaded list)
    async unpack(zip) {
      const items = await readZip(zip);
      const metaFile = items.find(f => f.path === "mod.json");
      if (!metaFile) throw new Error("This backup is missing mod.json");
      const { types = {}, ...info } = JSON.parse(await metaFile.blob.text());
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      await run("readwrite", st => st.delete(IDBKeyRange.bound(info.id + "/", info.id + "/￿")));
      const fileList = [];
      for (const f of items) {
        if (!f.path.startsWith("files/")) continue;
        const path = f.path.slice(6);
        await run("readwrite", st => st.put(new Blob([f.blob], { type: types[path] || "" }), info.id + "/" + path));
        fileList.push(path);
      }
      const list = this.list().filter(m => m.id !== info.id);
      list.push({ ...info, fileList });
      localStorage.setItem(listKey, JSON.stringify(list));
      const st = this.state();
      if (!st.downloaded.includes(info.id) && !st.inUse.includes(info.id)) st.downloaded.unshift(info.id);
      localStorage.setItem(stateKey, JSON.stringify(st));
      return info;
    }
  };
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
    if (key === GLOBAL_KEY) Global.load();
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
    const info = store.list().find(m => m.id === id);
    const zip = await store.pack(id);
    const path = this.uid() + "/" + tape.tape + "-" + id + ".zip";
    await this.call("/storage/v1/object/" + CLOUD_CONFIG.modBucket + "/" + path, {
      method: "POST", headers: { "x-upsert": "true", "Content-Type": "application/zip" }, body: zip
    });
    await this.call("/rest/v1/mods?on_conflict=user_id,id", {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      json: { user_id: this.uid(), id, tape: tape.tape, name: info.name, author: info.author || "", version: info.version || "",
              kind: this.modKind(info), size: zip.size, path, updated_at: new Date().toISOString() }
    });
  },
  async installMod(row) {
    const tape = TAPES.find(t => t.tape === row.tape);
    const res = await this.call("/storage/v1/object/authenticated/" + CLOUD_CONFIG.modBucket + "/" + row.path, { raw: true });
    return await TapeMods(tape.key).unpack(await res.blob());
  },
  async deleteMod(row) {
    await this.call("/storage/v1/object/" + CLOUD_CONFIG.modBucket + "/" + row.path, { method: "DELETE" }).catch(() => {});
    await this.call("/rest/v1/mods?user_id=eq." + this.uid() + "&id=eq." + encodeURIComponent(row.id), { method: "DELETE" });
  }
};
Cloud.loadSession();

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
