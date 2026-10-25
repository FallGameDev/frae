/* =====================================================================
   ACHIEVEMENTS
   Steam-style achievements, kept inside each save file (so file 1, 2 and
   3 each have their own). A pop-up slides in at the bottom right when one
   unlocks, and the title screen has an Achievements list.

   To add one: put it in the list below, then call game.unlock("its-id")
   where it should happen. Mods can rename them in texts.json.
   ===================================================================== */
"use strict";

// icon: a symbol drawn on the square picture; colors: the picture's gradient
// hidden: shows as "Hidden achievement" until it is unlocked
const ACHIEVEMENTS = [
  { id: "night1",   icon: "1",  colors: ["#4a6b8a", "#1d2f44"], name: "First Shift",            desc: "Survive Night 1." },
  { id: "night2",   icon: "2",  colors: ["#4a7a8a", "#1d3a44"], name: "Getting the Hang of It",  desc: "Survive Night 2." },
  { id: "night3",   icon: "3",  colors: ["#4a8a7a", "#1d443a"], name: "Halfway Home",            desc: "Survive Night 3." },
  { id: "night4",   icon: "4",  colors: ["#5a8a4a", "#2a441d"], name: "Almost Payday",           desc: "Survive Night 4." },
  { id: "night5",   icon: "★",  colors: ["#d9b44a", "#6b4a12"], name: "Good Job Sport!",         desc: "Survive all five nights." },
  { id: "night6",   icon: "★",  colors: ["#d97a4a", "#6b2a12"], name: "Overtime",                desc: "Survive the 6th night." },
  { id: "max",      icon: "20", colors: ["#d94a4a", "#5a0d0d"], name: "Pampering",               desc: "Beat a custom night with everyone at 20." },
  { id: "easy",     icon: "🧸", colors: ["#7ec8e6", "#1d4a6b"], name: "Child's Play",            desc: "Beat a custom night with everyone on 3 or lower." },
  { id: "power",    icon: "⚡", colors: ["#6a6a6a", "#111111"], name: "Lights Out",              desc: "Run out of power." },
  { id: "frugal",   icon: "%",  colors: ["#4ad97a", "#0d5a2a"], name: "Penny Pincher",           desc: "Survive a night with 30% power or more left." },
  { id: "cams",     icon: "◉",  colors: ["#8a8a9a", "#2a2a38"], name: "Security Expert",         desc: "Look at all 12 cameras in one night." },
  { id: "knock",    icon: "✋", colors: ["#a86a4a", "#3a1d12"], name: "Knock Knock",             desc: "Close the door on Endo." },
  { id: "call",     icon: "☎",  colors: ["#30d158", "#0d5a24"], name: "Hello? Hello?",           desc: "Listen to a whole phone call." },
  { id: "hangup",   icon: "✕",  colors: ["#ff3b30", "#6b0d08"], name: "Not Now, Aidan",          desc: "Hang up on the manager." },
  { id: "caught",   icon: "☠",  colors: ["#5a4a6a", "#120d1d"], name: "Full House",              desc: "Get caught by all four of them." },
  { id: "boop",     icon: "!",  colors: ["#d94ac8", "#5a0d50"], name: "Boop",                    desc: "Boop the poster's nose.", hidden: true },
  { id: "dance",    icon: "♪",  colors: ["#a64ad9", "#3a0d5a"], name: "Show Time",               desc: "Catch the 5 AM dance on the stage camera.", hidden: true },
  { id: "golden",   icon: "?",  colors: ["#e6c34a", "#5a4a0d"], name: "It's Me",                 desc: "Meet Golden Eddie.", hidden: true },
  { id: "fired",    icon: "✉",  colors: ["#e68ab4", "#5a1d38"], name: "You're Fired",            desc: "Enter 1 / 2 / 2 / 7 on the custom night.", hidden: true },
  { id: "rice",     icon: "🍚", colors: ["#e6dcc8", "#6b5a3a"], name: "Dine In",                 desc: "Find the secret song.", hidden: true },
  // limited: only during the OG window (OG in tools/global.js); hidden from the list afterwards unless you got it
  { id: "og",       icon: "OG", colors: ["#ffd84a", "#7a3ad9"], name: "OG",                      desc: "Play the game between Oct 24 and Nov 10, 2026.", limited: true },
];

const ACH_WORD = s => (TEXTS[s] !== undefined ? String(TEXTS[s]) : s);

Object.assign(Game.prototype, {

  // OG window (Oct 24 to Nov 10, 2026): the OG achievement on this save file
  // + the one-time 500 EXP account bonus (OG in tools/global.js)
  claimOG() {
    if (OG.open()) this.unlock("og");
    OG.claim();
  },

  // Unlock an achievement (once per save file) and show the pop-up
  unlock(id) {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    const got = this.progress.achievements;
    if (!a || got[id]) return;
    if (settings.debug) return;                 // no achievements while debug mode is on
    if (Global.chicken()) return;               // ...or in chicken mode (tape menu > Settings > Parental)
    got[id] = Date.now();
    this.progress.started = true;
    this.save();
    achievementToast(a);
  },

  // Remember who caught you (for "Full House")
  caughtBy(who) {
    const list = this.progress.caughtBy;
    if (!list.includes(who)) { list.push(who); this.save(); }
    if (["Bonnie", "Chica", "Foxy", "Freddy"].every(k => list.includes(k))) this.unlock("caught");
  },
});

/* ---------------------------------------------------------------------
   The pop-up (bottom right, like Steam's)
   --------------------------------------------------------------------- */
function achievementIcon(a, locked) {
  const icon = el("div", { class: "achIcon" + (locked ? " locked" : "") }, locked && a.hidden ? "?" : a.icon);
  icon.style.background = `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})`;
  return icon;
}

function achievementToast(a) {
  const box = $("#toasts");
  const toast = el("div", { class: "toast" },
    achievementIcon(a, false),
    el("div", { class: "toastText" },
      el("div", { class: "toastTitle" }, ACH_WORD("Achievement Unlocked!")),
      el("div", { class: "toastName" }, ACH_WORD(a.name))));
  box.append(toast);
  achievementChime();
  // slide up, stay 5 seconds, slide back down
  requestAnimationFrame(() => toast.classList.add("in"));
  setTimeout(() => { toast.classList.remove("in"); setTimeout(() => toast.remove(), 450); }, 5000);
}

// a soft two-note chime (made with Web Audio, follows the Sound slider)
function achievementChime() {
  const ac = Sound.ctx;
  [[880, 0], [1320, 0.11]].forEach(([f, t]) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, ac.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.08, ac.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.5);
    o.connect(g).connect(Sound.sfxBus);
    o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.55);
  });
}

// The achievements that COUNT toward your progress (the "3/21" counters, the % bar).
// Limited ones (OG) are a bonus: you can still get them and they show in the list,
// but they never count, so players who missed the window can still reach 100%.
const COUNTED_ACHIEVEMENTS = ACHIEVEMENTS.filter(a => !a.limited);
function countedAchievements(got) { return COUNTED_ACHIEVEMENTS.filter(a => got && got[a.id]).length; }

/* ---------------------------------------------------------------------
   The list (opened from the title screen)
   --------------------------------------------------------------------- */
function openAchievements() {
  const got = game.progress.achievements;
  // a limited one (OG) only shows while it can still be earned, or once you have it
  const LIST = ACHIEVEMENTS.filter(a => !a.limited || got[a.id] || OG.open());
  const done = countedAchievements(got);                        // bonus ones (OG) don't count
  const pct = Math.round(done / COUNTED_ACHIEVEMENTS.length * 100);
  const box = $("#achPanel");
  box.innerHTML = "";
  const date = t => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  // unlocked first (newest on top), then locked
  const order = [...LIST].sort((p, q) => (got[q.id] || 0) - (got[p.id] || 0));
  const rows = order.map(a => {
    const unlocked = !!got[a.id], secret = !unlocked && a.hidden;
    return el("div", { class: "achRow" + (unlocked ? "" : " locked") },
      achievementIcon(a, !unlocked),
      el("div", { class: "achText" },
        el("div", { class: "achName" }, secret ? ACH_WORD("Hidden achievement") : ACH_WORD(a.name),
          a.limited ? el("span", { class: "achBonus" }, ACH_WORD("BONUS")) : ""),
        el("div", { class: "achDesc" }, secret ? ACH_WORD("Keep playing to find it.") : ACH_WORD(a.desc))),
      el("div", { class: "achDate" }, unlocked ? ACH_WORD("Unlocked") + " " + date(got[a.id]) : ""));
  });
  const bar = el("div", { class: "achBar" }, el("div", { class: "achFill" }));
  bar.firstChild.style.width = pct + "%";
  box.append(
    el("div", { class: "achTop" },
      el("button", { onclick: closeAchievements }, "< " + ACH_WORD("BACK")),
      el("h2", {}, ACH_WORD("Achievements")),
      el("div", { class: "achCount" }, `${done} / ${COUNTED_ACHIEVEMENTS.length} (${pct}%)  ·  ${game.file === "story" ? ACH_WORD("STORY MODE") : ACH_WORD("FILE") + " " + game.file}`)),
    bar,
    el("div", { class: "achList" }, ...rows));
  box.hidden = false;
  game.paused = true;
}
function closeAchievements() {
  $("#achPanel").hidden = true;
  game.paused = false;
  canvas.focus();
}
