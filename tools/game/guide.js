/* =====================================================================
   guide.js (Tape 1): what the VHS guide (vhs.js) teaches after each death.
   Written from how the night actually works in game.js, so if the AI
   changes, change it here too. deathGuide(killer, powerOut) -> slides
   killer: "Bonnie" (Weddy), "Chica" (Cheddy), "Foxy" (Endo), "Freddy" (Eddie), "Golden"
   ===================================================================== */
"use strict";

// the names the player sees
const GUIDE_NAMES = { Bonnie: "Weddy", Chica: "Cheddy", Foxy: "Endo", Freddy: "Eddie", Golden: "Golden Eddie", Power: "Eddie" };

const GUIDE_POWER_TIP = { title: "Power", text: [
  "Doors, lights and the cameras all use power. The bars next to the clock show how much you use right now.",
  "Shut a door only while someone is there. Later nights drain power faster on their own."] };

const GUIDE_SLIDES = {
  Bonnie: [
    { title: "Weddy", text: ["She comes down the LEFT side: Show Stage, then the Dining Area or Backstage, the West Hall, then the W. Hall Corner or the Supply Closet, then your LEFT door.",
      "Every 5 seconds or so she may move."],
      tip: "Her footsteps get louder the closer she is." },
    { title: "Check the left light", text: ["Press the LEFT LIGHT button (the lower button by the left door).",
      "If she is standing in the window, press the LEFT DOOR button (the upper one) and keep it shut until she leaves. She goes back to the Dining Area."] },
    { title: "Too late?", text: ["If the door was open when she moved, she is INSIDE.",
      "Signs: the left buttons stop working (they buzz) and you hear breathing on the cameras.",
      "She gets you the moment you put the monitor down. All you can do is hope for 6 AM."] },
    GUIDE_POWER_TIP,
  ],
  Chica: [
    { title: "Cheddy", text: ["She comes down the RIGHT side: Show Stage, Dining Area, the Kitchen or the Restrooms, the East Hall, the E. Hall Corner, then your RIGHT door.",
      "Every 5 seconds or so she may move."],
      tip: "The Kitchen has no picture, but you can hear her clattering pots in there." },
    { title: "Check the right light", text: ["Press the RIGHT LIGHT button (the lower button by the right door).",
      "If she is standing in the window, press the RIGHT DOOR button (the upper one) and keep it shut until she leaves. She goes back to the East Hall."] },
    { title: "Too late?", text: ["If the door was open when she moved, she is INSIDE.",
      "Signs: the right buttons stop working (they buzz) and you hear breathing on the cameras.",
      "She gets you the moment you put the monitor down."] },
    GUIDE_POWER_TIP,
  ],
  Foxy: [
    { title: "Endo", text: ["He hides behind the curtain in Pirate Cove.",
      "Every 5 seconds or so he may get a bit further out. After 4 steps he is out of the cove."] },
    { title: "Watch him, but not too much", text: ["Looking at the cameras makes him freeze for a while.",
      "If you sit in the office and never check, he gets ready fast."] },
    { title: "He runs", text: ["Once he leaves the cove he runs down the West Hall within 25 seconds, or right away if you look at the West Hall camera.",
      "Shut the LEFT DOOR. He bangs on it and takes some power, a bit more every time."],
      tip: "Pirate Cove empty? Shut the left door right now." },
    GUIDE_POWER_TIP,
  ],
  Freddy: [
    { title: "Eddie", text: ["He only starts moving once Weddy AND Cheddy have both left the stage.",
      "He laughs every time he moves, and he never moves while you are watching his camera."] },
    { title: "His route", text: ["Show Stage, Dining Area, Restrooms, Kitchen, East Hall, E. Hall Corner, then your RIGHT door.",
      "In the Kitchen you can hear his music box."] },
    { title: "The corner", text: ["At the E. Hall Corner he waits until you switch to another camera, then walks in unless the RIGHT DOOR is shut.",
      "While he is in the East Hall, keep the right door shut or keep your eyes on him."] },
    GUIDE_POWER_TIP,
  ],
  Power: [
    { title: "Out of power", text: ["At 0% everything shuts down: the doors open, the lights and cameras stop."] },
    { title: "Eddie's song", text: ["His face flickers in the left doorway while his music box plays. Then the lights go out and he gets you.",
      "Nothing stops him now. You can only hope 6 AM comes first."] },
    GUIDE_POWER_TIP,
    { title: "Saving power", text: ["Don't leave doors shut or lights on 'just in case'. Check, react, open again.",
      "Endo banging on the left door costs power too."] },
  ],
  Golden: [
    { title: "Golden Eddie", text: ["Very rare: a strange poster in the W. Hall Corner.",
      "If you see it and put the monitor down, he is sitting in your office."] },
    { title: "Look away", text: ["Lift the monitor back up within 5 seconds and he is gone.", "Stare at him and the game shuts down."] },
  ],
};

function deathGuide(killer, powerOut) {
  const key = killer === "Freddy" && powerOut ? "Power" : killer;
  const slides = [...(GUIDE_SLIDES[key] || [])];
  slides.push({ title: "Rewind", text: ["Survive until 6 AM to win the night.", "Press EJECT to rewind the tape."] });
  return { name: GUIDE_NAMES[key] || killer, slides };
}
