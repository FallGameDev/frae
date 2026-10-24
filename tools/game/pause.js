/* =====================================================================
   pause.js: the PAUSE MENU and the JOURNAL (help guide). Used by both
   tapes (the builds paste it in after vhs.js).

   PAUSE (Esc, or the II button in the top-left corner during a night)
     RESUME / JOURNAL / SETTINGS / QUIT (to the title, or the Story hub)
     Everything stops: the game's updates (game.paused) and every sound
     (the Web Audio clock is suspended).

   JOURNAL (works like the one in DOORS, looks like the blue VHS guide screen) with chapters:
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
   Little pixel pictures for the journal (12 x 12, same colors as ITEMS)
   --------------------------------------------------------------------- */
const JOURNAL_ICONS = {
  door:    [".##########.", ".#........#.", ".#.######.#.", ".#.#....#.#.", ".#.#....#.#.", ".#.#....#.#.", ".#.#..g.#.#.", ".#.#....#.#.", ".#.#....#.#.", ".#.######.#.", ".#........#.", "############"],
  light:   ["....####....", "...#gggg#...", "..#gggggg#..", "..#gggggg#..", "..#gggggg#..", "...#gggg#...", "....#gg#....", "....####....", "....#dd#....", "....####....", ".....##.....", "............"],
  power:   [".......gg...", "......gg....", ".....gg.....", "....gg......", "...gggggg...", "......gg....", ".....gg.....", "....gg......", "...gg.......", "..gg........", "............", "............"],
  clock:   ["...######...", "..#......#..", ".#...#....#.", "#....#.....#", "#....#.....#", "#....###...#", "#..........#", "#..........#", ".#........#.", "..#......#..", "...######...", "............"],
  phone:   ["............", ".##......##.", "#gg#....#gg#", "#gg######gg#", ".##.#..#.##.", "...#....#...", "..#..##..#..", "..#.#..#.#..", "..#..##..#..", "..#......#..", "..########..", "............"],
  mask:    ["..########..", ".#gggggggg#.", "#gggggggggg#", "#g##gggg##g#", "#gggggggggg#", "#gggggggggg#", "#g#gggggg#g#", "#gg######gg#", ".#gggggggg#.", "..#gggggg#..", "...######...", "............"],
  flash:   ["...........g", ".........g..", ".##.....g...", "#dd######..g", "#dd#gggggg..", "#dd#gggggg.g", "#dd######...", ".##.....g...", ".........g..", "...........g", "............", "............"],
  vent:    ["############", "#..........#", "#.########.#", "#..........#", "#.########.#", "#..........#", "#.########.#", "#..........#", "#.########.#", "#..........#", "############", "............"],
  monitor: ["############", "#bbbbbbbbbb#", "#bbbbbbbbbb#", "#bb##bbbbbb#", "#bbbbbbbbbb#", "#bbbbbbbbbb#", "#bbbbbbbbbb#", "############", ".....##.....", "....####....", "............", "............"],
  music:   [".....######.", ".....#....#.", ".....######.", ".....#....#.", ".....#....#.", ".....#....#.", "..####..####", ".#gggg.#gggg", ".#gggg.#gggg", "..####..####", "............", "............"],
  cam:     ["............", "............", ".#######....", "#ddddddd#.##", "#d##ddddd###", "#d##dddd####", "#ddddddd####", "#ddddddd#.##", ".#######....", "............", "............", "............"],
  radio:   ["............", ".........#..", "........#...", ".#########..", "#dddddddd#..", "#d##dd####..", "#d##dddddd#.", "#dddd#dd#d#.", "#dddd#dd#d#.", ".##########.", "............", "............"],
  eye:     ["............", "............", "....####....", "..##....##..", ".#...##...#.", "#...####...#", "#...####...#", ".#...##...#.", "..##....##..", "....####....", "............", "............"],
  skull:   ["...######...", "..#......#..", ".#........#.", ".#.##..##.#.", ".#.##..##.#.", ".#........#.", "..#..##..#..", "...#....#...", "...#.#.#.#..", "....####....", "............", "............"],
  star:    [".....gg.....", ".....gg.....", "....gggg....", "gggggggggggg", ".gggggggggg.", "..gggggggg..", "...gggggg...", "..ggg..ggg..", ".gg......gg.", "............", "............", "............"],
};
function journalIcon(name, size = 24) {
  const grid = JOURNAL_ICONS[name];
  if (!grid) return "";
  let rects = "";
  grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ITEM_COLORS[ch]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${ITEM_COLORS[ch]}"/>`;
  }));
  return `<svg viewBox="0 0 12 12" width="${size}" height="${size}" shape-rendering="crispEdges">${rects}</svg>`;
}
// A tiny camera map: cams = [{ x, y, label, on }] in any units (fitted to the box), you = { x, y }
function journalMap(map) {
  const pts = [...map.cams, ...(map.you ? [map.you] : [])];
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const bw = span * 0.11, bh = bw * 0.58, fs = bh * 0.62, u = span / 120;      // box, letters and line sizes follow the map's size
  const x0 = Math.min(...xs) - bw, x1 = Math.max(...xs) + bw, y0 = Math.min(...ys) - bh * 1.2, y1 = Math.max(...ys) + bh * 2;
  const box = c => `<g><rect x="${c.x - bw / 2}" y="${c.y - bh / 2}" width="${bw}" height="${bh}" fill="${c.on ? "#fff" : "rgba(0,0,40,.5)"}" stroke="#fff" stroke-width="${u}"/>
    <text x="${c.x}" y="${c.y + fs * 0.36}" font-size="${fs}" text-anchor="middle" fill="${c.on ? "#0d2fb8" : "#fff"}" font-family="VCR OSD Mono, monospace">${c.label}</text></g>`;
  const ys2 = bh * 0.7;
  return `<svg class="minimap" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}">
    ${map.cams.map(box).join("")}
    ${map.you ? `<rect x="${map.you.x - ys2 / 2}" y="${map.you.y - ys2 / 2}" width="${ys2}" height="${ys2}" fill="#ff2a3c"/><text x="${map.you.x}" y="${map.you.y + ys2 + fs * 0.8}" font-size="${fs * 0.9}" text-anchor="middle" fill="#fff" font-family="VCR OSD Mono, monospace">YOU</text>` : ""}
  </svg>`;
}

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
    // Looks like the blue VHS guide screen (vhs.js): blue picture, VCR letters with red/cyan edges, scan lines
    const css = document.createElement("style");
    css.textContent = `
      #journal { position: fixed; inset: 0; z-index: 95; display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,.85); padding: 14px; }
      #journal[hidden] { display: none; }
      #journal .tv { position: relative; width: min(1000px, 100%); height: min(660px, 94vh); display: flex; flex-direction: column;
        background: linear-gradient(#1846e0, #0d2fb8); border: 4px solid #fff; box-shadow: 10px 10px 0 #000; overflow: hidden;
        color: #fff; font-family: "VCR OSD Mono", "Share Tech Mono", monospace; }
      #journal .tv::after { content: ""; position: absolute; inset: 0; pointer-events: none;
        background: repeating-linear-gradient(to bottom, rgba(0,0,30,.16) 0 1px, transparent 1px 3px); }
      #journal .band { position: absolute; left: 0; right: 0; height: 26px; pointer-events: none; z-index: 1;
        background: linear-gradient(transparent, rgba(255,255,255,.07), transparent); animation: jroll 9s linear infinite; }
      @keyframes jroll { from { top: -40px; } to { top: 105%; } }
      #journal .vt { text-shadow: -1px 0 rgba(255,40,80,.55), 1px 0 rgba(60,255,255,.55); }
      #journal .top { display: flex; align-items: center; gap: 12px; padding: 14px 20px 8px; }
      #journal .top .play { font-size: 26px; flex: 1; }
      #journal .top .play::before { content: "\\25B6  "; }
      #journal .top .count { font-size: 18px; }
      #journal .tabs { display: flex; gap: 8px; padding: 0 20px 12px; flex-wrap: wrap; border-bottom: 2px solid rgba(255,255,255,.8); }
      #journal .tabs button, #journal .eject { font: 15px "VCR OSD Mono", monospace; color: #fff; background: transparent; cursor: pointer;
        border: 2px solid #fff; padding: 6px 12px; text-shadow: -1px 0 rgba(255,40,80,.55), 1px 0 rgba(60,255,255,.55); }
      #journal .tabs button:hover, #journal .eject:hover { background: rgba(255,255,255,.15); }
      #journal .tabs button.on { background: #fff; color: #0d2fb8; text-shadow: none; }
      #journal .body { flex: 1; display: flex; min-height: 0; }
      #journal .left { width: 34%; overflow-y: auto; padding: 12px 14px 12px 20px; border-right: 2px solid rgba(255,255,255,.35); }
      #journal .right { flex: 1; overflow-y: auto; padding: 14px 22px; }
      #journal .chap { font-size: 14px; color: #7ff6ff; margin-bottom: 8px; letter-spacing: 1px; }
      #journal .list button { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; cursor: pointer; background: none;
        border: none; padding: 6px 6px; font: 17px "VCR OSD Mono", monospace; color: #fff; text-shadow: -1px 0 rgba(255,40,80,.5), 1px 0 rgba(60,255,255,.5); }
      #journal .list button:hover { background: rgba(255,255,255,.12); }
      #journal .list button.on { background: rgba(255,255,255,.22); }
      #journal .list button.on::after { content: " \\25C0"; margin-left: auto; }
      #journal .list button.locked { color: rgba(255,255,255,.45); }
      #journal .list img, #journal .list .noimg { width: 32px; height: 32px; flex: none; border: 2px solid #fff; background: #0a1a66; object-fit: cover; }
      #journal .list .noimg { display: flex; align-items: center; justify-content: center; font-size: 14px; text-shadow: none; }
      #journal .list .noimg svg { width: 24px; height: 24px; }
      #journal .entry { animation: jtrack .35s steps(4); }
      @keyframes jtrack { 0% { opacity: 0; transform: translateX(-6px); filter: blur(1px); } 60% { opacity: 1; transform: translateX(2px); } 100% { transform: none; } }
      #journal .entry h2 { font-size: 28px; margin: 0; font-weight: normal; }
      #journal .entry .sub { color: #7ff6ff; font-size: 15px; margin: 2px 0 6px; }
      #journal .entry hr { border: none; border-top: 2px solid rgba(255,255,255,.8); margin: 6px 0 14px; }
      #journal .entry .photo { float: right; width: 140px; height: 140px; margin: 0 0 12px 16px; border: 3px solid #fff; background: #0a1a66;
        object-fit: cover; filter: saturate(.8) contrast(1.1); }
      #journal .entry .photo.lockedimg { display: flex; align-items: center; justify-content: center; font-size: 60px; }
      #journal .entry p { font-size: 16px; line-height: 24px; margin: 0 0 10px; }
      #journal .entry .tips { margin: 12px 0 0; color: #7ff6ff; font-size: 15px; line-height: 22px; }
      #journal .entry table { width: 100%; border-collapse: collapse; margin: 4px 0 12px; font-size: 15px; }
      #journal .entry td { border-bottom: 1px dashed rgba(255,255,255,.35); padding: 5px 4px; vertical-align: top; }
      #journal .entry td:first-child { color: #7ff6ff; white-space: nowrap; padding-right: 14px; }
      #journal .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 2px 0 12px; }
      #journal .chips .lbl { color: #7ff6ff; font-size: 13px; width: 100%; margin-bottom: 2px; }
      #journal .chip { display: inline-flex; align-items: center; gap: 6px; border: 2px solid #fff; padding: 3px 7px; font-size: 13px; background: rgba(0,0,40,.35); }
      #journal .chip.end { background: #fff; color: #0d2fb8; text-shadow: none; }
      #journal .arrow { color: #7ff6ff; font-size: 13px; }
      #journal .minimap { display: block; width: auto; height: 170px; max-width: 100%; margin: 4px 0 14px; border: 2px solid rgba(255,255,255,.6); background: rgba(0,0,40,.3); }
      #journal .bigicon { float: right; width: 140px; height: 140px; margin: 0 0 12px 16px; border: 3px solid #fff; background: #0a1a66;
        display: flex; align-items: center; justify-content: center; }
      #journal .foot { display: flex; justify-content: space-between; align-items: center; padding: 8px 20px 12px; border-top: 2px solid rgba(255,255,255,.8);
        font-size: 13px; color: rgba(255,255,255,.7); }
      #journal .eject::before { content: "\\23CF  "; }
      @media (max-width: 760px) {
        #journal { padding: 6px; }
        #journal .tv { height: 96vh; }
        #journal .tabs { flex-wrap: nowrap; overflow-x: auto; }
        #journal .body { flex-direction: column; }
        #journal .left { width: auto; max-height: 30%; border-right: none; border-bottom: 2px solid rgba(255,255,255,.35); }
        #journal .entry .photo { width: 90px; height: 90px; }
        #journal .foot .keys { display: none; }
        #journal .top .title { display: none; }
        #journal .top .play { font-size: 20px; }
      }`;
    document.head.append(css);
    const el = this.el = document.createElement("div");
    el.id = "journal"; el.hidden = true; el.setAttribute("data-nomeme", "");
    el.innerHTML = `<div class="tv"><div class="band"></div>
      <div class="top"><span class="play vt">PLAY</span><span class="title vt"></span><span class="count vt"></span></div>
      <div class="tabs"></div>
      <div class="body"><div class="left"></div><div class="right"></div></div>
      <div class="foot"><span class="keys">TABS = CHAPTERS · ESC = BACK TO THE PAUSE MENU</span><button class="eject">EJECT</button></div></div>`;
    el.querySelector(".eject").onclick = () => this.close();
    el.addEventListener("click", e => { if (e.target === el) this.close(); });
    document.body.append(el);
    // the tape counter ticks while the journal is open
    const t0 = Date.now();
    setInterval(() => { if (this.isOpen()) el.querySelector(".count").textContent = "SP " + vhsCounter((Date.now() - t0) / 1000); }, 500);
  },

  draw() {
    const d = this.data, ch = d.chapters[this.chapter], en = ch.entries[this.entry] || ch.entries[0];
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    this.el.querySelector(".title").textContent = String(d.title).toUpperCase();
    // chapter buttons
    const tabs = this.el.querySelector(".tabs");
    tabs.innerHTML = d.chapters.map((c, i) => `<button data-i="${i}" class="${i === this.chapter ? "on" : ""}">${esc(c.name.toUpperCase())}</button>`).join("");
    tabs.querySelectorAll("button").forEach(b => b.onclick = () => { this.chapter = +b.dataset.i; this.entry = 0; this.draw(); });
    // left: the list of pages
    const left = this.el.querySelector(".left");
    left.innerHTML = `<div class="chap">${esc(ch.name.toUpperCase())}${ch.note ? " · " + esc(ch.note.toUpperCase()) : ""}</div>
      <div class="list">${ch.entries.map((e, i) => `<button data-i="${i}" class="${i === this.entry ? "on" : ""}${e.locked ? " locked" : ""}">
        ${e.img && !e.locked ? `<img src="${e.img}" alt="">` : e.pix ? `<span class="noimg">${journalIcon(e.pix, 24)}</span>` : e.icon ? `<span class="noimg">${e.icon}</span>` : `<span class="noimg">${e.locked ? "?" : i + 1}</span>`}
        <span>${esc(e.locked ? "???" : e.name.toUpperCase())}</span></button>`).join("")}</div>`;
    left.querySelectorAll(".list button").forEach(b => b.onclick = () => { this.entry = +b.dataset.i; this.draw(); });
    // right: the page
    const right = this.el.querySelector(".right");
    if (!en) { right.innerHTML = ""; return; }
    if (en.locked) {
      right.innerHTML = `<div class="entry vt"><div class="photo lockedimg">?</div><h2>???</h2>
        <div class="sub">NO SIGNAL</div><hr>
        <p>You haven't run into this one yet. Keep your eyes on the cameras.</p>
        <p>This tape records them once you've seen them, or once they've caught you.</p></div>`;
      right.scrollTop = 0;
      return;
    }
    right.innerHTML = `<div class="entry vt">
      ${en.img ? `<img class="photo" src="${en.img}" alt="">` : en.iconBig ? `<div class="bigicon">${en.iconBig}</div>` : en.pix ? `<div class="bigicon">${journalIcon(en.pix, 110)}</div>` : ""}
      <h2>${esc(en.name.toUpperCase())}</h2>${en.sub ? `<div class="sub">${esc(en.sub.toUpperCase())}</div>` : ""}<hr>
      ${en.route ? `<div class="chips"><span class="lbl">ROUTE</span>${en.route.map((r, i) => `<span class="chip${i === en.route.length - 1 ? " end" : ""}">${esc(r)}</span>`).join('<span class="arrow">&#9654;</span>')}</div>` : ""}
      ${en.counters ? `<div class="chips"><span class="lbl">HOW TO STOP THEM</span>${en.counters.map(([ic, t]) => `<span class="chip">${journalIcon(ic, 16)}${esc(t)}</span>`).join("")}</div>` : ""}
      ${(en.text || []).map(p => `<p>${esc(p)}</p>`).join("")}
      ${en.map ? journalMap(en.map) : ""}
      ${en.list ? `<table>${en.list.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>` : ""}
      ${en.tips && en.tips.length ? `<div class="tips">${en.tips.map(t => "TIP: " + esc(t)).join("<br>")}</div>` : ""}
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
    note: Items.loaded ? "you own " + ITEMS.reduce((a, it) => a + Items.count(it.id), 0) : "sign in to use them",
    entries: [
      { name: "How items work", pix: "star", text: [
        "Buy them with EXP in the SHOP (Story Mode hub). Spending EXP never lowers your level.",
        "Signed in, your items show down the LEFT side during any night. Click one or press 1 to 6. The frying pan works by itself."],
        tips: ["Items you don't use stay on your account for the next night."] },
      ...ITEMS.map(it => ({
        name: it.name, iconBig: itemIcon(it.id, 110), icon: itemIcon(it.id, 26),
        sub: it.price + " EXP in the shop" + (Items.loaded ? "  ·  you have " + Items.count(it.id) : ""),
        text: [it.desc, ...((extra || {})[it.id] || [])],
      })),
    ],
  };
}
