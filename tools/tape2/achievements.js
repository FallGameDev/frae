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
  { id: "night1",   icon: "1",  colors: ["#4a6b8a", "#1d2f44"], name: "New Hire",                desc: "Survive Night 1." },
  { id: "night2",   icon: "2",  colors: ["#4a7a8a", "#1d3a44"], name: "Grand Re-Opening",        desc: "Survive Night 2." },
  { id: "night3",   icon: "3",  colors: ["#4a8a7a", "#1d443a"], name: "Old Friends",             desc: "Survive Night 3." },
  { id: "night4",   icon: "4",  colors: ["#5a8a4a", "#2a441d"], name: "Parts and Service",       desc: "Survive Night 4." },
  { id: "night5",   icon: "★",  colors: ["#d9b44a", "#6b4a12"], name: "Payday",                  desc: "Survive all five nights." },
  { id: "night6",   icon: "★",  colors: ["#d97a4a", "#6b2a12"], name: "Bonus Shift",             desc: "Survive the 6th night." },
  { id: "max",      icon: "20", colors: ["#d94a4a", "#5a0d0d"], name: "20/20/20/20",             desc: "Beat the 20/20/20/20 custom night." },
  { id: "prize",    icon: "🧸", colors: ["#7ec8e6", "#1d4a6b"], name: "Prize Winner",            desc: "Win a prize on a custom night challenge." },
  { id: "allprizes",icon: "🏆", colors: ["#e6c34a", "#6b4a12"], name: "Full Desk",               desc: "Win every custom night prize." },
  { id: "mask",     icon: "☺",  colors: ["#a86a4a", "#3a1d12"], name: "One of Us",               desc: "Fool someone in the office with the mask." },
  { id: "flash",    icon: "☀",  colors: ["#e6dc6a", "#5a5212"], name: "Lights, Camera",          desc: "Flash Withered Endo back down the hall." },
  { id: "wound",    icon: "♫",  colors: ["#a64ad9", "#3a0d5a"], name: "Wind It Up",              desc: "Wind the music box all the way up." },
  { id: "battery",  icon: "🔋", colors: ["#4ad97a", "#0d5a2a"], name: "Battery Saver",           desc: "Survive a night with half the battery left." },
  { id: "cams",     icon: "◉",  colors: ["#8a8a9a", "#2a2a38"], name: "Security Expert",         desc: "Look at all 12 cameras in one night." },
  { id: "call",     icon: "☎",  colors: ["#30d158", "#0d5a24"], name: "Hello? Hello?",           desc: "Listen to a whole phone call." },
  { id: "hangup",   icon: "✕",  colors: ["#ff3b30", "#6b0d08"], name: "Not Now, Aidan",          desc: "Hang up on the manager." },
  { id: "caught",   icon: "☠",  colors: ["#5a4a6a", "#120d1d"], name: "Everybody's Here",        desc: "Get caught by 8 different characters." },
  { id: "honk",     icon: "!",  colors: ["#d94ac8", "#5a0d50"], name: "Honk",                    desc: "Honk the poster's nose.", hidden: true },
  { id: "golden",   icon: "?",  colors: ["#e6c34a", "#5a4a0d"], name: "It's Me",                 desc: "Meet Golden Eddie.", hidden: true },
  { id: "minigame", icon: "▣",  colors: ["#6a6aff", "#12125a"], name: "Insert Coin",             desc: "Play one of the strange 8-bit games.", hidden: true },
  { id: "yay",      icon: "✓",  colors: ["#3a8cff", "#0d2f6b"], name: "yay",                     desc: "Somehow hit the yay button at 6 AM.", hidden: true },
  { id: "cake",     icon: "🎂", colors: ["#e68ab4", "#5a1d38"], name: "Take Cake",               desc: "Give cake to every child.", hidden: true },
];

const ACH_WORD = s => (TEXTS[s] !== undefined ? String(TEXTS[s]) : s);

Object.assign(Game.prototype, {

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

  // Remember who caught you (for "Everybody's Here")
  caughtBy(who) {
    const list = this.progress.caughtBy;
    if (!list.includes(who)) { list.push(who); this.save(); }
    if (list.length >= 8) this.unlock("caught");
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

/* ---------------------------------------------------------------------
   The list (opened from the title screen)
   --------------------------------------------------------------------- */
function openAchievements() {
  const got = game.progress.achievements;
  const done = ACHIEVEMENTS.filter(a => got[a.id]).length;
  const pct = Math.round(done / ACHIEVEMENTS.length * 100);
  const box = $("#achPanel");
  box.innerHTML = "";
  const date = t => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  // unlocked first (newest on top), then locked
  const order = [...ACHIEVEMENTS].sort((p, q) => (got[q.id] || 0) - (got[p.id] || 0));
  const rows = order.map(a => {
    const unlocked = !!got[a.id], secret = !unlocked && a.hidden;
    return el("div", { class: "achRow" + (unlocked ? "" : " locked") },
      achievementIcon(a, !unlocked),
      el("div", { class: "achText" },
        el("div", { class: "achName" }, secret ? ACH_WORD("Hidden achievement") : ACH_WORD(a.name)),
        el("div", { class: "achDesc" }, secret ? ACH_WORD("Keep playing to find it.") : ACH_WORD(a.desc))),
      el("div", { class: "achDate" }, unlocked ? ACH_WORD("Unlocked") + " " + date(got[a.id]) : ""));
  });
  const bar = el("div", { class: "achBar" }, el("div", { class: "achFill" }));
  bar.firstChild.style.width = pct + "%";
  box.append(
    el("div", { class: "achTop" },
      el("button", { onclick: closeAchievements }, "< " + ACH_WORD("BACK")),
      el("h2", {}, ACH_WORD("Achievements")),
      el("div", { class: "achCount" }, `${done} / ${ACHIEVEMENTS.length} (${pct}%)  ·  ${game.file === "story" ? ACH_WORD("STORY MODE") : ACH_WORD("FILE") + " " + game.file}`)),
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
