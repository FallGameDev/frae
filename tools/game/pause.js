/* =====================================================================
   pause.js: the PAUSE MENU and the JOURNAL (help guide). Used by both
   tapes (the builds paste it in after vhs.js).

   PAUSE (Esc, or the II button in the top-left corner during a night)
     RESUME / JOURNAL / SETTINGS / QUIT (to the title, or the Story hub)
     Everything stops: the game's updates (game.paused) and every sound
     (the Web Audio clock is suspended).

   JOURNAL (like the one in DOORS): a book with chapters on tabs:
     Entities, Mechanics, Items, Cameras, Summary
   Each tape writes its own pages: game.journal() returns
     { title, chapters: [{ id, name, entries: [entry...] }] }
   entry: { name, sub, img (data URL or null), locked, text: [paragraph...],
            tips: [line...], list: [[left, right]...] }
   Entities stay "???" until you've met them (seen on a camera or caught
   by them), just like DOORS.
   ===================================================================== */
"use strict";

const Pause = {
  game: null,
  open: false,
  el: null, btn: null,

  attach(game) { this.game = game; this.build(); },

  // the II button is only there during a night
  showButton(on) {
    this.build();
    this.btn.hidden = !on;
    if (!on && this.open) this.close(true);
  },
  canPause() {
    const g = this.game, n = g && g.n;
    return !!g && g.screen === "night" && !!n && !n.frozen && !n.jumpscare;
  },

  // Esc from the tape's page: true if the pause menu dealt with it
  escape() {
    if (Journal.isOpen()) { Journal.close(); return true; }
    if (this.open) { this.close(); return true; }
    if (this.canPause()) { this.show(); return true; }
    return false;
  },

  show() {
    if (this.open || !this.canPause()) return;
    this.open = true;
    this.game.paused = true;
    try { Sound.ctx.suspend(); } catch (e) {}
    ItemBar.show(false);
    this.el.hidden = false;
    this.el.querySelector(".quit").textContent = Story.on ? "BACK TO HUB" : "QUIT TO TITLE";
    const n = this.game.n;
    this.el.querySelector(".where").textContent =
      (Story.on ? "STORY MODE  ·  " : "") + "NIGHT " + (this.game.level > 6 ? "C" : this.game.level) + "  ·  " + (n.hour === 0 ? 12 : n.hour) + " AM";
    this.el.querySelector(".resume").focus();
  },
  // quiet = closing because the night ended (no sound, no resume)
  close(quiet) {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
    Journal.close();
    if (quiet) return;
    this.game.paused = false;
    try { Sound.ctx.resume(); } catch (e) {}
    ItemBar.show(this.game.screen === "night");
    canvas.focus();
  },
  // the tape calls this when its settings panel closes
  afterSettings() {
    if (!this.open) return;
    this.game.paused = true;
    this.el.hidden = false;
  },
  quit() {
    this.close(true);
    this.game.paused = false;
    try { Sound.ctx.resume(); } catch (e) {}
    if (Story.on) location.href = Story.hub();
    else { this.game.died = false; this.game.showTitle(); }
  },

  build() {
    if (this.el) return;
    const css = document.createElement("style");
    css.textContent = `
      #pauseBtn { position: fixed; left: 8px; top: 8px; z-index: 42; width: 46px; height: 46px; cursor: pointer;
        background: rgba(0,0,0,.7); border: 3px solid #fff; box-shadow: 0 4px 0 #333; color: #fff;
        font: 20px "VCR OSD Mono", monospace; display: flex; align-items: center; justify-content: center; }
      #pauseBtn:hover { border-color: #ffcf3f; }
      #pauseBtn[hidden] { display: none; }
      #pauseMenu { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,.78); font-family: "VCR OSD Mono", monospace; color: #fff; }
      #pauseMenu[hidden] { display: none; }
      #pauseMenu .box { width: min(92vw, 420px); background: linear-gradient(#1846e0, #0d2fb8); border: 4px solid #fff;
        box-shadow: 10px 10px 0 #000; padding: 22px 24px; text-align: center; position: relative; overflow: hidden; }
      #pauseMenu .box::after { content: ""; position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(to bottom, rgba(0,0,30,.16) 0 1px, transparent 1px 3px); }
      #pauseMenu h2 { font-size: 40px; letter-spacing: 3px; margin: 0; text-shadow: -2px 0 rgba(255,40,80,.5), 2px 0 rgba(60,255,255,.5); }
      #pauseMenu .where { color: #7ff6ff; font-size: 16px; margin: 4px 0 18px; }
      #pauseMenu button { display: block; width: 100%; margin: 10px 0; font: 22px "VCR OSD Mono", monospace; color: #fff; cursor: pointer;
        background: transparent; border: 3px solid #fff; padding: 9px; text-align: left; }
      #pauseMenu button:hover, #pauseMenu button:focus { background: rgba(255,255,255,.15); outline: none; }
      #pauseMenu button::before { content: "\\25B6  "; font-size: 15px; }
      #pauseMenu .hint { font-size: 13px; color: rgba(255,255,255,.65); margin-top: 10px; }`;
    document.head.append(css);

    this.btn = document.createElement("button");
    this.btn.id = "pauseBtn"; this.btn.title = "Pause (Esc)"; this.btn.textContent = "II"; this.btn.hidden = true;
    this.btn.setAttribute("data-nomeme", "");
    this.btn.onpointerdown = e => e.stopPropagation();
    this.btn.onclick = e => { e.stopPropagation(); this.btn.blur(); this.show(); };
    document.body.append(this.btn);

    const el = this.el = document.createElement("div");
    el.id = "pauseMenu"; el.hidden = true; el.setAttribute("data-nomeme", "");
    el.innerHTML = `<div class="box">
        <h2>II PAUSE</h2><div class="where"></div>
        <button class="resume">RESUME</button>
        <button class="journal">JOURNAL (HELP GUIDE)</button>
        <button class="settings">SETTINGS</button>
        <button class="quit">QUIT</button>
        <div class="hint">Esc = resume</div>
      </div>`;
    el.querySelector(".resume").onclick = () => this.close();
    el.querySelector(".journal").onclick = () => Journal.open(this.game.journal());
    el.querySelector(".settings").onclick = () => { el.hidden = true; openSettings(); };
    el.querySelector(".quit").onclick = () => this.quit();
    document.body.append(el);

    // a night pauses by itself when you switch tabs or windows
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.show(); });
  },
};

/* ---------------------------------------------------------------------
   THE JOURNAL (an old notebook: chapter tabs, a list of pages, the page)
   --------------------------------------------------------------------- */
const Journal = {
  el: null, data: null, chapter: 0, entry: 0,

  isOpen() { return !!this.el && !this.el.hidden; },
  open(data, chapterId) {
    this.build();
    this.data = data;
    const i = data.chapters.findIndex(c => c.id === chapterId);
    this.chapter = i >= 0 ? i : 0;
    this.entry = 0;
    this.el.hidden = false;
    this.draw();
  },
  close() { if (this.el) this.el.hidden = true; },

  build() {
    if (this.el) return;
    const css = document.createElement("style");
    css.textContent = `
      #journal { position: fixed; inset: 0; z-index: 95; display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,.8); padding: 14px; }
      #journal[hidden] { display: none; }
      #journal .book { position: relative; width: min(980px, calc(100% - 120px)); margin-right: 104px; height: min(640px, 92vh); display: flex;
        background: #3b2414; padding: 14px; border-radius: 8px; box-shadow: 0 18px 50px #000, inset 0 0 0 3px #1d1008; }
      #journal .page { flex: 1; overflow-y: auto; padding: 22px 26px; color: #2b1d10; font-family: "Courier Prime", monospace;
        background: #e9dcc0; background-image: repeating-linear-gradient(to bottom, transparent 0 27px, rgba(80,60,30,.13) 27px 28px),
          radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.35), transparent 60%), radial-gradient(ellipse at 80% 90%, rgba(120,80,30,.25), transparent 55%); }
      #journal .left { border-radius: 4px 0 0 4px; box-shadow: inset -14px 0 18px -12px rgba(60,30,0,.5); max-width: 36%; }
      #journal .right { border-radius: 0 4px 4px 0; box-shadow: inset 14px 0 18px -12px rgba(60,30,0,.5); }
      #journal h1 { font: 28px "VCR OSD Mono", monospace; letter-spacing: 2px; color: #3b2414; margin: 0 0 4px; }
      #journal .chap { font-size: 14px; color: #7a5a35; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 1px; }
      #journal .list button { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; cursor: pointer;
        background: none; border: none; border-bottom: 1px dashed rgba(80,60,30,.35); padding: 7px 4px; font: 17px "Courier Prime", monospace; color: #2b1d10; }
      #journal .list button:hover { background: rgba(120,80,30,.12); }
      #journal .list button.on { background: rgba(120,80,30,.22); font-weight: bold; }
      #journal .list button.locked { color: #9a8463; }
      #journal .list img, #journal .list .noimg { width: 34px; height: 34px; flex: none; border-radius: 50%; border: 2px solid #3b2414; background: #1a120a; object-fit: cover; }
      #journal .list .noimg { display: flex; align-items: center; justify-content: center; color: #e9dcc0; font: 16px "VCR OSD Mono", monospace; }
      #journal .entry h2 { font: 30px "VCR OSD Mono", monospace; margin: 0; color: #3b2414; }
      #journal .entry .sub { color: #7a5a35; font-size: 15px; margin: 2px 0 14px; }
      #journal .entry .photo { float: right; width: 150px; height: 150px; margin: 0 0 12px 16px; border: 6px solid #fff;
        box-shadow: 3px 4px 8px rgba(0,0,0,.45); transform: rotate(3deg); background: #111; object-fit: cover; }
      #journal .entry .photo.lockedimg { display: flex; align-items: center; justify-content: center; color: #555; font: 60px "VCR OSD Mono", monospace; }
      #journal .entry p { font-size: 17px; line-height: 28px; margin: 0 0 12px; }
      #journal .entry .tips { margin: 14px 0 0; padding: 10px 14px; border: 2px solid #b8402a; color: #8c2a17; transform: rotate(-.6deg);
        font-size: 16px; line-height: 24px; background: rgba(184,64,42,.06); }
      #journal .entry .tips b { display: block; font: 15px "VCR OSD Mono", monospace; letter-spacing: 1px; }
      #journal .entry table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 16px; }
      #journal .entry td { border-bottom: 1px dashed rgba(80,60,30,.35); padding: 5px 4px; vertical-align: top; }
      #journal .entry td:first-child { font-weight: bold; white-space: nowrap; padding-right: 14px; }
      #journal .tabs { position: absolute; right: -2px; top: 26px; transform: translateX(100%); display: flex; flex-direction: column; gap: 6px; }
      #journal .tabs button { font: 14px "VCR OSD Mono", monospace; padding: 10px 12px 10px 10px; border: none; cursor: pointer;
        border-radius: 0 6px 6px 0; color: #2b1d10; box-shadow: 3px 3px 0 rgba(0,0,0,.4); text-align: left; min-width: 104px; }
      #journal .tabs button.on { transform: translateX(6px); font-weight: bold; }
      #journal .close { position: absolute; top: -12px; right: -12px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
        background: #b8402a; color: #fff; border: 3px solid #1d1008; font: 20px "VCR OSD Mono", monospace; z-index: 2; }
      @media (max-width: 760px) {
        #journal .book { flex-direction: column; height: 92vh; padding: 10px; padding-top: 52px; width: 100%; margin-right: 0; }
        #journal .left { max-width: none; max-height: 34%; }
        #journal .tabs { top: 8px; left: 10px; right: 10px; transform: none; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; }
        #journal .tabs button { border-radius: 6px 6px 0 0; min-width: 0; }
        #journal .tabs button.on { transform: translateY(3px); }
        #journal .entry .photo { width: 96px; height: 96px; }
      }`;
    document.head.append(css);
    const el = this.el = document.createElement("div");
    el.id = "journal"; el.hidden = true; el.setAttribute("data-nomeme", "");
    el.innerHTML = `<div class="book"><button class="close" title="Close (Esc)">X</button>
      <div class="page left"></div><div class="page right"></div><div class="tabs"></div></div>`;
    el.querySelector(".close").onclick = () => this.close();
    el.addEventListener("click", e => { if (e.target === el) this.close(); });
    document.body.append(el);
  },

  draw() {
    const d = this.data, ch = d.chapters[this.chapter], en = ch.entries[this.entry] || ch.entries[0];
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const TAB_COLORS = ["#d9a441", "#8fb36a", "#6fa3c9", "#c97a6f", "#b08fc9"];
    // tabs
    const tabs = this.el.querySelector(".tabs");
    tabs.innerHTML = d.chapters.map((c, i) =>
      `<button data-i="${i}" class="${i === this.chapter ? "on" : ""}" style="background:${TAB_COLORS[i % TAB_COLORS.length]}">${esc(c.name.toUpperCase())}</button>`).join("");
    tabs.querySelectorAll("button").forEach(b => b.onclick = () => { this.chapter = +b.dataset.i; this.entry = 0; this.draw(); });
    // left page: the list
    const left = this.el.querySelector(".left");
    left.innerHTML = `<h1>${esc(d.title)}</h1><div class="chap">${esc(ch.name)}${ch.note ? " · " + esc(ch.note) : ""}</div>
      <div class="list">${ch.entries.map((e, i) => `<button data-i="${i}" class="${i === this.entry ? "on" : ""}${e.locked ? " locked" : ""}">
        ${e.img && !e.locked ? `<img src="${e.img}" alt="">` : e.icon ? `<span class="noimg">${e.icon}</span>` : `<span class="noimg">${e.locked ? "?" : i + 1}</span>`}
        <span>${esc(e.locked ? "???" : e.name)}</span></button>`).join("")}</div>`;
    left.querySelectorAll(".list button").forEach(b => b.onclick = () => { this.entry = +b.dataset.i; this.draw(); });
    // right page: the entry
    const right = this.el.querySelector(".right");
    if (!en) { right.innerHTML = ""; return; }
    if (en.locked) {
      right.innerHTML = `<div class="entry"><div class="photo lockedimg">?</div><h2>???</h2>
        <div class="sub">Not met yet</div>
        <p>You haven't run into this one yet. Keep your eyes on the cameras.</p>
        <p>This page fills itself in once you've seen them, or once they've caught you.</p></div>`;
      right.scrollTop = 0;
      return;
    }
    right.innerHTML = `<div class="entry">
      ${en.img ? `<img class="photo" src="${en.img}" alt="">` : en.iconBig ? `<div class="photo" style="display:flex;align-items:center;justify-content:center;background:#111">${en.iconBig}</div>` : ""}
      <h2>${esc(en.name)}</h2>${en.sub ? `<div class="sub">${esc(en.sub)}</div>` : ""}
      ${(en.text || []).map(p => `<p>${esc(p)}</p>`).join("")}
      ${en.list ? `<table>${en.list.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>` : ""}
      ${en.tips && en.tips.length ? `<div class="tips"><b>SURVIVAL NOTES</b>${en.tips.map(t => "&bull; " + esc(t)).join("<br>")}</div>` : ""}
    </div>`;
    right.scrollTop = 0;
  },
};

// Slides from a death guide (vhs.js format) -> journal paragraphs and notes
function journalFromSlides(slides) {
  const text = [], tips = [];
  for (const s of slides || []) {
    if (s.title === "Rewind") continue;
    text.push(...(s.text || []));
    if (s.tip) tips.push(s.tip);
  }
  return { text, tips };
}

// A picture drawn on a little canvas, as a data URL (portraits for the journal)
function journalPicture(paint, size = 160) {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = "#111"; g.fillRect(0, 0, size, size);
    paint(g, size);
    return c.toDataURL("image/png");
  } catch (e) { return null; }
}

// The items chapter is the same on both tapes (the shop items, see ITEMS in global.js)
function journalItems(extra) {
  return {
    id: "items", name: "Items",
    note: Items.loaded ? "you own " + ITEMS.reduce((a, it) => a + Items.count(it.id), 0) : "sign in to use items",
    entries: [
      { name: "How items work", icon: "?", text: [
        "Items come from the SHOP in the Story Mode hub. You pay with the EXP you earn by beating nights in Story Mode. Spending EXP never lowers your level.",
        "While you're signed in, every item you own shows down the LEFT side of the screen during a night, in Story Mode and in the normal game.",
        "Click an item, or press its number (1 to 6), to use it. The frying pan works by itself."],
        tips: ["Items you don't use stay on your account for the next night."] },
      ...ITEMS.map(it => ({
        name: it.name, iconBig: itemIcon(it.id, 110), icon: itemIcon(it.id, 26),
        sub: it.price + " EXP in the shop" + (Items.loaded ? "  ·  you have " + Items.count(it.id) : ""),
        text: [it.desc, ...((extra || {})[it.id] || [])],
      })),
    ],
  };
}
