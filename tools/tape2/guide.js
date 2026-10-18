/* =====================================================================
   guide.js (Tape 2): what the VHS guide (vhs.js) teaches after each death.
   Written from how the night actually works in game.js, so if the AI
   changes, change it here too. deathGuide(who) -> slides
   ===================================================================== */
"use strict";

// "CAM 09 Show Stage", "the hallway"...
function guideSpot(s) {
  if (typeof s === "number") return "CAM " + String(s).padStart(2, "0") + " " + CAMS[s];
  return { hall: "the hallway", ventL: "the left vent opening", ventR: "the right vent opening", office: "YOU" }[s] || s;
}
const guideRoute = who => PATHS[who].map(guideSpot).join(" > ");

// The ones who walk into the office (toys and withered, not Endo / Meyg / the monster)
function visitorSlides(who) {
  const name = CAST[who].name;
  const path = PATHS[who];
  const vent = path.includes("ventL") ? "left" : path.includes("ventR") ? "right" : null;
  const out = [
    { title: name, text: ["Route: " + guideRoute(who) + ".",
      "Every 5 seconds or so " + name + " may take one step closer. The higher the level, the more often."],
      tip: GUIDE_EXTRA[who] },
  ];
  if (vent) out.push({ title: "The " + vent + " vent", text: [
    "Near the end " + name + " crawls through CAM " + (vent === "left" ? "05" : "06") + " to the " + vent + " vent opening.",
    "Check it with the " + vent + " VENT LIGHT (" + (vent === "left" ? "A" : "D") + ", or hold the LIGHT button).",
    "Put the MASK on while " + name + " sits in the opening: they think you are one of them and crawl all the way back to the start."] });
  else out.push({ title: "The hallway", text: [
    name + " comes down the hallway in front of you. Flash the flashlight (SPACE) to see who is standing there.",
    "The flashlight does not send " + name + " away. Be ready with the mask."] });
  out.push(
    { title: "Getting in", text: [
      "Nobody gets into the office while you are looking at the office. They only slip in while your camera monitor is UP.",
      "When you put the monitor down and the lights start flickering, someone is in here."],
      tip: "Stay on the cameras too long and they pull the monitor down themselves." },
    { title: "Mask on, fast", text: [
      "The moment the lights flicker, put the MASK on (Q or the bottom-left bar).",
      "You have about 1 second (1.6 seconds on nights 1 and 2)."] },
    { title: "Keep it on", text: [
      "Leave the mask on until the flickering stops and they walk out. That takes 3 to 6 seconds.",
      "Take it off early and they get you."] });
  return out;
}
const GUIDE_EXTRA = {
  tchica: "From CAM 07 she sometimes steps into the hallway first, then heads back to CAM 04.",
  wbonnie: "From CAM 07 " + "Withered Cheddy can also cut through the hallway and come straight to you.",
};

const GUIDE_SLIDES = {
  foxy: () => [
    { title: CAST.foxy.name, text: ["He waits in CAM 08 Parts/Service.",
      "Every 5 seconds or so he may come out and stand in the hallway in front of you."] },
    { title: "Flash him away", text: [
      "When he is in the hallway, flash the flashlight at him (tap SPACE, F, or click and hold) again and again.",
      "He needs 4 to 6 flashes before he gives up (more on high levels), then he walks back."],
      tip: "He will not lunge while the light is shining on him." },
    { title: "No mask", text: ["The mask does nothing against him. Only the flashlight works.",
      "Each flash gives you a few more seconds. Wait too long between flashes and he lunges."] },
    { title: "The stare", text: [
      "If he lunges, his head fills the screen inside an outline. It keeps shrinking.",
      "TAP (click, SPACE or any key) to pump it back up. Too small: TAP! Too big: the outline turns red, so wait.",
      "Keep it inside until the red bar at the bottom fills and he leaves."],
      tip: "Too long outside the outline (the screen goes red) and he gets you." },
    { title: "Battery", text: [
      "The flashlight and vent lights use battery (top left). An empty battery means no flashlight at all.",
      "If " + CAST.bb.name + " gets into your office the lights break until 6 AM. Then you cannot flash him."],
      tip: "Save battery for him on nights he is active." },
  ],
  mangle: () => [
    { title: CAST.mangle.name, text: ["Route: " + guideRoute("mangle") + ". From CAM 10 she may also go through CAM 07 and the hallway."] },
    { title: "Listen for her", text: ["Her radio crackles louder the closer she gets.",
      "Loud static means she is in the hallway or the right vent."] },
    { title: "The right vent", text: ["Check the right vent light (D). Put the MASK on while she is in the opening and she goes all the way back to CAM 12 Kid's Cove.",
      "Like everyone else she only gets in while your monitor is up."] },
    { title: "Once she's in", text: ["She hangs from the ceiling and the static never stops. You cannot get her out.",
      "After a while, every time you put the monitor down she may drop on you (1 in 3)."],
      tip: "Once she is in, flip the monitor as little as you can until 6 AM." },
  ],
  bb: () => [
    { title: CAST.bb.name, text: ["Route: " + guideRoute("bb") + ". You hear him laugh when he moves."] },
    { title: "The left vent", text: ["Check the left vent light (A). Mask on while he is in the opening and he goes back to CAM 10."] },
    { title: "If he gets in", text: ["He does not hurt you himself, but your flashlight and vent lights stop working until 6 AM.",
      "Without the flashlight you cannot stop " + CAST.foxy.name + "."] },
  ],
  puppet: () => [
    { title: CAST.puppet.name, text: ["The music box on CAM 11 Prize Corner keeps him asleep. It winds down all night.",
      "Level 0: empty in about 150 seconds. Level 20: about 50 seconds."] },
    { title: "Wind it up", text: ["Go to CAM 11 and hold the WIND UP button (click and hold).",
      "The little circle shows how full it is. You only hear the tune while you watch CAM 11."] },
    { title: "Too late", text: ["When it runs out, the jack-in-the-box song starts.",
      "Nothing stops it now. About 15 seconds later he comes for you."],
      tip: "Wind it a little between every other job. Never let it get under half." },
  ],
  golden: () => [
    { title: CAST.golden.name, text: ["Rare. When you put the monitor down he may be slumped in your office."] },
    { title: "Get rid of him", text: ["You have about 1.5 seconds: put the MASK on, or lift the monitor back up.",
      "Do nothing and the game shuts down."],
      tip: "His head in the hallway (flashlight) is only a vision. It can't hurt you." },
  ],
};

function deathGuide(who) {
  const slides = GUIDE_SLIDES[who] ? GUIDE_SLIDES[who]() : PATHS[who] ? visitorSlides(who) : [];
  slides.push({ title: "Rewind", text: ["Survive until 6 AM to win the night.", "Press EJECT to rewind the tape."] });
  return slides;
}
