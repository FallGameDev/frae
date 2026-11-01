/* =====================================================================
   THE DEV DEBUGGER (Tape 2)

   Open the browser's dev console (Inspect > Console) and type:
       dev.debug
   (dev.debug() works too.) A little panel shows up with the game's
   values: the save file, the night, the clock, battery, music box,
   oxygen, every character's AI level and where they are...

   Changing anything takes two steps: edit the boxes (changed ones turn
   yellow), press APPLY, and say yes to the confirm box, which lists every
   change. The first time you say yes, ACHIEVEMENTS ARE TURNED OFF on this
   save file for good (progress.debugged, checked by unlock()).
   Not in Story Mode (that's saved on your account).
   ===================================================================== */
"use strict";

const DevMenu = {
  box: null,
  fields: [],             // what's showing: {key, label, kind, get, set, ...}
  dirty: new Map(),       // key -> the new value typed in
  shape: "",              // which fields are showing (rebuilt when it changes: night started / ended)
  timer: 0,

  open() {
    if (this.box) { this.box.style.display = ""; return; }
    this.build();
    this.timer = setInterval(() => this.refresh(), 400);
    console.log("%cdev.debug: the debugger is open (achievements turn off on this file once you change something)", "color:#ffcf3f");
  },
  close() {
    if (!this.box) return;
    clearInterval(this.timer);
    this.box.remove();
    this.box = null;
    this.dirty.clear();
  },

  /* ---- what can be changed ---- */
  list() {
    const g = game, p = g.progress, n = g.screen === "night" ? g.n : null;
    const out = [];
    const num = (key, label, get, set, min, max, step = 1) => out.push({ key, label, kind: "num", get, set, min, max, step });
    const yes = (key, label, get, set) => out.push({ key, label, kind: "bool", get, set });
    const pick = (key, label, get, set, options) => out.push({ key, label, kind: "pick", get, set, options });
    const head = label => out.push({ kind: "head", label });
    head("Save file " + g.file);
    num("p.night", "Night reached", () => p.night, v => { p.night = v; }, 1, 7);
    yes("p.beat5", "Star: beat night 5", () => p.beat5, v => { p.beat5 = v; });
    yes("p.beat6", "Star: beat night 6", () => p.beat6, v => { p.beat6 = v; });
    yes("p.beat420", "Star: beat 20/20/20/20", () => p.beat420, v => { p.beat420 = v; });
    head("Game");
    num("g.level", "Night to play (7 = custom)", () => g.level, v => { g.level = v; }, 1, 7);
    num("g.golden", "Golden Eddie: 1 in", () => g.goldenRate, v => { g.goldenRate = v; }, 1, 100000);
    if (n) {
      head("Tonight (night " + g.level + ")");
      num("n.hour", "Hour (0 = 12 AM)", () => n.hour, v => { n.hour = v; }, 0, 5);
      num("n.clock", "Seconds into the hour", () => Math.floor(n.clock), v => { n.clock = Math.min(69, v); }, 0, 69);
      num("n.battery", "Flashlight battery %", () => Math.round(n.battery), v => { n.battery = v; }, 0, 100);
      num("n.musicBox", "Music box %", () => Math.round(n.musicBox * 100), v => { n.musicBox = v / 100; }, 0, 100);
      num("n.oxygen", "Mask oxygen %", () => Math.round(n.oxygen * 100), v => { n.oxygen = v / 100; }, 0, 100);
      head("Who (AI level and spot)");
      for (const who of [...Object.keys(PATHS), "foxy", "golden", "puppet"]) {
        const name = CAST[who] ? CAST[who].name : who;
        num("ai." + who, name + ": AI", () => n.ai[who] || 0, v => { n.ai[who] = v; }, 0, 50);
        if (PATHS[who]) {
          // every spot on their walk (and their side trips), but not "office": that's a visit, not a spot
          const spots = [...new Set([...PATHS[who], ...Object.keys(DETOURS[who] || {}), ...Object.values(DETOURS[who] || {})])]
            .map(s => (typeof s === "string" && /^\d+$/.test(s) ? Number(s) : s)).filter(s => s !== "office");
          pick("at." + who, name + ": spot", () => n.at[who], v => { n.at[who] = v; n.wait[who] = randFloat(4, 6); },
            spots.map(s => [s, typeof s === "number" ? "CAM " + s : s]));
        }
      }
    }
    return out;
  },
  // buttons: [label, what it does (words for the confirm box), do it]
  actions() {
    const g = game, n = g.screen === "night" ? g.n : null;
    const out = [["START NIGHT " + g.level, "start night " + g.level, () => g.startNight()]];
    if (n) {
      out.push(["6 AM NOW", "skip to 6 AM (win the night)", () => { n.hour = 5; n.clock = 70 - TICK; }]);
      out.push(["SEND EVERYONE HOME", "send everyone back to where they start", () => {
        for (const who of Object.keys(PATHS)) { n.at[who] = PATHS[who][0]; n.wait[who] = randFloat(4, 6); }
        n.foxy.hall = false; n.visit = null;
      }]);
      if (g.level === 5) out.push(["THROW THE PHONE", "throw the phone at the wall", () => { BoomFx.load(); g.startPhoneThrow(() => {}); }]);
    }
    return out;
  },

  /* ---- the panel ---- */
  build() {
    const box = this.box = document.createElement("div");
    box.id = "devMenu";
    box.innerHTML = `<style>
      #devMenu { position: fixed; top: 16px; right: 16px; width: 330px; max-height: calc(100vh - 32px); z-index: 99999;
        display: flex; flex-direction: column; font: 13px/1.3 "Share Tech Mono", monospace; color: #f4f1ff;
        background: #171a33; border: 3px solid #0b0c18; border-radius: 16px; box-shadow: 6px 6px 0 #0b0c18; overflow: hidden; }
      #devMenu .bar { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: #ffcf3f; color: #171a33;
        font-weight: bold; cursor: move; user-select: none; border-bottom: 3px solid #0b0c18; }
      #devMenu .bar span { flex: 1; letter-spacing: 1px; }
      #devMenu .x { background: #171a33; color: #ffcf3f; border: 0; border-radius: 8px; width: 26px; height: 26px; cursor: pointer; font-weight: bold; }
      #devMenu .warn { padding: 8px 12px; background: #3b1630; color: #ff9ac8; font-size: 12px; border-bottom: 2px solid #0b0c18; }
      #devMenu .body { overflow-y: auto; padding: 6px 12px 10px; }
      #devMenu .head { margin: 10px 0 4px; color: #7fe0ff; font-weight: bold; text-transform: uppercase; font-size: 12px; }
      #devMenu .row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
      #devMenu .row label { flex: 1; }
      #devMenu input[type=number], #devMenu select { width: 92px; background: #0e1024; color: #fff; border: 2px solid #3a3f78;
        border-radius: 8px; padding: 3px 6px; font: inherit; }
      #devMenu input[type=checkbox] { width: 18px; height: 18px; accent-color: #ffcf3f; }
      #devMenu .dirty input, #devMenu .dirty select { border-color: #ffcf3f; background: #3a3210; }
      #devMenu .btns { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px; border-top: 3px solid #0b0c18; background: #121429; }
      #devMenu button.b { border: 2px solid #0b0c18; border-radius: 10px; padding: 6px 10px; font: inherit; font-weight: bold; cursor: pointer;
        background: #2d3266; color: #fff; box-shadow: 2px 2px 0 #0b0c18; }
      #devMenu button.apply { background: #ffcf3f; color: #171a33; }
      #devMenu button.b:disabled { opacity: 0.4; cursor: default; }
      #devMenu .ask { position: absolute; inset: 0; background: rgba(11,12,24,0.92); display: flex; flex-direction: column; justify-content: center; padding: 18px; gap: 10px; }
      #devMenu .ask ul { margin: 0; padding-left: 18px; max-height: 40vh; overflow: auto; color: #ffcf3f; }
      #devMenu .ask .no { color: #ff9ac8; }
    </style>
    <div class="bar"><span>DEV DEBUGGER</span><button class="x" title="Close">X</button></div>
    <div class="warn"></div>
    <div class="body"></div>
    <div class="btns"></div>`;
    document.body.appendChild(box);
    // typing in the boxes must not move the game (keys 1-6 are items, Q is the mask...)
    for (const t of ["keydown", "keyup", "keypress", "pointerdown", "mousedown", "click", "wheel"]) box.addEventListener(t, e => e.stopPropagation());
    box.querySelector(".x").onclick = () => this.close();
    // drag it around by the yellow bar
    const bar = box.querySelector(".bar");
    bar.addEventListener("pointerdown", e => {
      if (e.target.classList.contains("x")) return;
      const r = box.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      const move = ev => { box.style.left = (ev.clientX - dx) + "px"; box.style.top = (ev.clientY - dy) + "px"; box.style.right = "auto"; };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    });
    this.render();
  },
  render() {
    const body = this.box.querySelector(".body"), btns = this.box.querySelector(".btns"), warn = this.box.querySelector(".warn");
    warn.textContent = Story.on ? "Not in Story Mode: it's saved on your account."
      : game.progress.debugged ? "Achievements are OFF on this save file (the debugger was used)."
      : "Changing anything turns achievements OFF on this save file.";
    this.fields = Story.on ? [] : this.list();
    this.shape = this.fields.map(f => f.key || f.label).join("|");
    body.innerHTML = "";
    for (const f of this.fields) {
      if (f.kind === "head") { const h = document.createElement("div"); h.className = "head"; h.textContent = f.label; body.appendChild(h); continue; }
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("label");
      label.textContent = f.label;
      let input;
      if (f.kind === "bool") { input = document.createElement("input"); input.type = "checkbox"; }
      else if (f.kind === "pick") {
        input = document.createElement("select");
        for (const [v, text] of f.options) { const o = document.createElement("option"); o.value = String(v); o.textContent = text; input.appendChild(o); }
      } else { input = document.createElement("input"); input.type = "number"; input.min = f.min; input.max = f.max; input.step = f.step; }
      const changed = () => {
        let v = f.kind === "bool" ? input.checked : f.kind === "pick" ? input.value : Number(input.value);
        if (f.kind === "pick") v = (f.options.find(([o]) => String(o) === v) || [v])[0];
        if (f.kind === "num") v = Math.max(f.min, Math.min(f.max, Math.round(v / f.step) * f.step));
        if (v === f.get()) this.dirty.delete(f.key); else this.dirty.set(f.key, v);
        row.classList.toggle("dirty", this.dirty.has(f.key));
        this.updateButtons();
      };
      input.addEventListener("input", changed);
      input.addEventListener("change", changed);
      f.input = input; f.row = row;
      row.append(label, input);
      body.appendChild(row);
    }
    btns.innerHTML = "";
    if (!Story.on) {
      const apply = document.createElement("button");
      apply.className = "b apply"; apply.textContent = "APPLY";
      apply.onclick = () => this.confirmApply();
      const undo = document.createElement("button");
      undo.className = "b"; undo.textContent = "UNDO EDITS";
      undo.onclick = () => { this.dirty.clear(); this.render(); };
      btns.append(apply, undo);
      for (const [label, words, fn] of this.actions()) {
        const b = document.createElement("button");
        b.className = "b"; b.textContent = label;
        b.onclick = () => this.ask(["Do this: " + words], fn);
        btns.appendChild(b);
      }
    }
    this.refresh(true);
    this.updateButtons();
  },
  updateButtons() {
    const apply = this.box && this.box.querySelector(".apply");
    if (apply) { apply.disabled = !this.dirty.size; apply.textContent = this.dirty.size ? "APPLY (" + this.dirty.size + ")" : "APPLY"; }
  },
  // show the live values (the ones being edited stay as typed)
  refresh(force) {
    if (!this.box) return;
    const shape = (Story.on ? [] : this.list()).map(f => f.key || f.label).join("|");
    if (!force && shape !== this.shape) { this.render(); return; }           // a night started or ended
    if (this.box.querySelector(".ask")) return;
    for (const f of this.fields) {
      if (!f.input || this.dirty.has(f.key) || document.activeElement === f.input) continue;
      const v = f.get();
      if (f.kind === "bool") f.input.checked = !!v; else f.input.value = String(v);
    }
  },

  /* ---- confirming ---- */
  confirmApply() {
    if (!this.dirty.size) return;
    const lines = [...this.dirty].map(([key, v]) => {
      const f = this.fields.find(x => x.key === key);
      const show = x => (f.kind === "pick" ? ((f.options.find(([o]) => o === x) || [, x])[1]) : f.kind === "bool" ? (x ? "yes" : "no") : x);
      return f.label + ": " + show(f.get()) + " -> " + show(v);
    });
    this.ask(lines, () => {
      for (const [key, v] of this.dirty) { const f = this.fields.find(x => x.key === key); if (f) f.set(v); }
      this.dirty.clear();
    });
  },
  // the confirm box: lists what will happen; YES does it (and turns achievements off on this file)
  ask(lines, fn) {
    const ask = document.createElement("div");
    ask.className = "ask";
    const first = !game.progress.debugged;
    ask.innerHTML = `<b>Change these?</b><ul></ul>` +
      (first ? `<div class="no">This turns ACHIEVEMENTS OFF on save file ${game.file}, for good.</div>` : "") +
      `<div style="display:flex;gap:8px"><button class="b apply">YES, DO IT</button><button class="b">CANCEL</button></div>`;
    const ul = ask.querySelector("ul");
    for (const l of lines) { const li = document.createElement("li"); li.textContent = l; ul.appendChild(li); }
    const [yesB, noB] = ask.querySelectorAll("button");
    noB.onclick = () => ask.remove();
    yesB.onclick = () => {
      ask.remove();
      game.progress.debugged = true;          // no more achievements on this file
      fn();
      game.save();
      this.render();
    };
    this.box.appendChild(ask);
  },
};

// The console command: typing  dev.debug  opens it (so does dev.debug())
window.dev = {
  get debug() { DevMenu.open(); return () => DevMenu.open(); },
};
