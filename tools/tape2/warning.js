/* =====================================================================
   warning.js (Tape 2): the sensitive content screen when the game starts.

   SENSITIVE ON   jumpscares on, Toy Weddy keeps her chest
   SENSITIVE OFF  jumpscares off, Toy Weddy's chest (and shirt) are hidden
   It is the same switch as Settings > Jumpscares (changing either one
   changes both). "Don't show this again on this file" is ticked at first;
   it is remembered per save file (frae2-warned-file1..3).
   ===================================================================== */
"use strict";

const warnKey = file => GI.key + "-warned-file" + file;
function needsWarning(file) {
  try { return localStorage.getItem(warnKey(file)) !== "1"; } catch (e) { return true; }
}

function showWarning(then) {
  const box = $("#warnPanel");
  box.innerHTML = "";
  game.paused = true;
  const keep = el("input", { type: "checkbox" });
  keep.checked = true;
  const choose = async (on, btn) => {
    blip();
    for (const b of box.querySelectorAll("button")) b.disabled = true;
    btn.firstChild.textContent = T("LOADING...");
    settings.jumpscares = on ? "1" : "0";
    saveSettings();
    if (keep.checked) { try { localStorage.setItem(warnKey(game.file), "1"); } catch (e) {} }
    await Actors.refreshSensitive();               // Toy Weddy made again with or without her chest
    box.hidden = true;
    game.paused = false;
    canvas.focus();
    then();
  };
  const onBtn = el("button", { class: "on" }, T("SENSITIVE ON"), el("small", {}, T("jumpscares on, everything shown")));
  const offBtn = el("button", { class: "off" }, T("SENSITIVE OFF"), el("small", {}, T("jumpscares off, toned down")));
  onBtn.onclick = () => choose(true, onBtn);
  offBtn.onclick = () => choose(false, offBtn);
  box.append(
    el("h2", {}, T("WARNING")),
    el("p", {}, T("This tape has jumpscares, loud sounds, flashing lights and creepy broken animatronics.")),
    el("p", {}, T("Turn sensitive content off if you'd rather skip the jumpscares. You can change it any time in Settings (Jumpscares).")),
    el("div", { class: "warnBtns" }, onBtn, offBtn),
    el("label", {}, keep, T("Don't show this again on this file")));
  box.hidden = false;
}

// Settings > Jumpscares also switches sensitive content (Toy Weddy made again)
function onJumpscaresChanged() { Actors.refreshSensitive(); }
