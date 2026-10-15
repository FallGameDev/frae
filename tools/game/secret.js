/* =====================================================================
   THE SECRET "DINE IN" MUSIC VIDEO
   Click Dine In on the title screen. A glitchy title, a newspaper,
   then the Fried Rice at Eddie's song with lyrics over the dining room.

   The video is timed to the song, so it is written as a timeline:
   a few "actors" (pictures on screen) and short scripts that move,
   fade and swap them at the same moments as the original.
   ===================================================================== */
"use strict";

Object.assign(Game.prototype, {

  startSecret() {
    this.go("secret");
    Sound.stopAll();
    this.sp.music.setVolume(100);
    this.sp.music.play("Stage", "Fried Rice At Eddies (1)_E_major__bpm_103");
    this.secretStart = this.tick;
    this.actors = [];
    const A = (name, group, picName, o = {}) => {
      // an actor: a picture with a spot, size and see-through amount (0 = solid, 100 = gone)
      const a = { name, group, pic: picName, x: o.x ?? 240, y: o.y ?? 180, size: o.size ?? 100, ghost: o.ghost ?? 0, show: !!o.show, z: o.z };
      this.actors.push(a);
      return a;
    };
    // back to front
    const bowl    = A("bowl", "Secret??//Freddy menu", "Freddy menu glitch 1", { z: 1 });
    const office  = A("office", "Secret??//Office", "Screenshot 2025-01-15 145529", { size: 110, z: 2 });
    const statik  = A("static", "Secret??//Fnaf Static", "Fnaf Static", { size: 150, z: 3 });
    const line1   = A("line1", "Secret??//Static Line", "costume1", { z: 4 });
    const line2   = A("line2", "Secret??//Static Line2", "costume1", { z: 5 });
    const menu    = A("menu", "Secret??//New/continue", "costume1", { z: 6 });
    const title   = A("title", "Secret??//Title", "costume1", { z: 7 });
    const lyrics  = A("lyrics", "Secret??//Lyrics", "costume1", { size: 105, ghost: 10, z: 8 });
    const black   = A("black", "Secret??//Sprite1", "costume1", { x: 276, y: 152, z: 9 });
    const glitch  = A("glitch", "Secret??//Glitch lines song", "Hide", { ghost: 86, z: 10 });
    const hud     = A("hud", "Usage Bars", "Usage6", { x: 65, y: 298, size: 40, z: 11 });
    const paper   = A("paper", "Secret??//Fnaf Newspaper", "Fnaf Newspaper", { ghost: 100, z: 12 });
    const flash   = A("flash", "Secret??//Freddy Hallucination", "Screenshot 2025-01-15 150514", { ghost: 10, z: 13 });
    const fadeOut = A("fadeout", "Secret??//Fade out", "costume1", { ghost: 100, z: 14 });
    for (const a of this.actors) this.smoothActor(a, true);

    const run = gen => this.scripts.run("secret", gen.call(this));
    const fadeBy = function* (a, step, times) { for (let i = 0; i < times; i++) { a.ghost = Math.max(0, Math.min(100, a.ghost + step)); yield; } };
    const shake = function* (a, amount, times) {
      for (let i = 0; i < times; i++) {
        a.x += amount; yield 0.05; a.y += amount; yield 0.05; a.y -= amount; yield 0.05; a.x -= amount; yield;
      }
      a.x = 240; a.y = 180;
    };
    const pulse = function* (a, beats, wait, grow, base) {
      a.size = base;
      for (let i = 0; i < beats; i++) { yield wait; a.size = 100; for (let k = 0; k < 5; k++) { a.size += grow; yield; } yield; }
    };

    // ---------- 0 s: glitchy title screen ----------
    run(function* () { statik.show = true; statik.ghost = 100; yield* fadeBy(statik, -0.35, 100); });
    run(function* () { let i = 0; for (;;) { statik.pic = ART[statik.group].list[i++ % 8]; yield; } });
    for (const line of [line1, line2]) {
      run(function* () { line.show = true; line.ghost = 100; yield 0.65; yield* fadeBy(line, -0.32, 100); });
      run(function* () { for (let i = 0; i < 100; i++) { line.y += 1.2; yield 0.04; yield; } });
    }
    run(function* () { title.show = true; title.ghost = 100; yield* fadeBy(title, -1, 100); });
    run(function* () { menu.show = true; menu.ghost = 100; yield* fadeBy(menu, -1, 100); });
    run(function* () { yield 2; menu.pic = "costume2"; yield 0.7; menu.pic = "costume1"; });     // Dine In -> Take Away flicker
    run(function* () { bowl.show = true; bowl.ghost = 100; yield* fadeBy(bowl, -1, 100); });
    run(function* () {
      for (;;) {
        bowl.pic = "Freddy menu glitch 1"; yield randFloat(1.5, 2.5);
        bowl.pic = "Freddy menu glitch 2"; yield 0.08;
        bowl.pic = "Freddy menu glitch 3"; yield;
      }
    });
    // the hunger meter in the corner
    run(function* () { yield 9.49; hud.show = true; });

    // ---------- 5 s: the newspaper ----------
    run(function* () {
      yield 5;
      this.scripts.run("secret", function* () {                     // the title screen goes away 3 s later
        yield 3;
        for (const a of [statik, line1, line2, title, menu, bowl]) a.show = false;
      }.call(this));
      this.scripts.run("secret", function* () {                     // a quick glitch and a face flash
        yield 3.68;
        glitch.ghost = 70; glitch.show = true;
        for (const c of ["costume2", "costume3", "costume4", "costume5", "costume6"]) { glitch.pic = c; yield 0.02; }
        glitch.pic = "Hide"; glitch.show = false;
      }.call(this));
      this.scripts.run("secret", function* () { yield 3.68; flash.show = true; yield 0.2; flash.show = false; }.call(this));
      paper.ghost = 100; paper.show = true;
      yield* fadeBy(paper, -1.5, 75);
      yield 1.2;
      paper.show = false;
      yield 0.6;
      this.secretSong();
    });

    this.secret = { office, lyrics, glitch, black, hud, flash, fadeOut, run, fadeBy, shake, pulse };
  },

  // ---------- the song part (about 9.3 s in) ----------
  secretSong() {
    const { office, lyrics, glitch, black, flash, fadeOut, run, shake, pulse } = this.secret;
    office.show = true;
    lyrics.show = true; lyrics.ghost = 10;
    // lyrics cards, timed to the song
    run(function* () {
      const cards = [["costume1", 4.5], ["costume2", 4.82], ["costume3", 4.45], ["costume4", 4.75], ["costume5", 4.75],
                     ["costume6", 4.75], ["costume7", 4.6], ["costume8", 3.35], ["costume9", 5.1], ["costume10", 4.1],
                     ["costume9", 5], ["costume10", 4.2], ["costume12", 0.35]];
      for (const [c, t] of cards) { lyrics.pic = c; yield t; }
      for (let i = 0; i < 200; i++) { lyrics.ghost = Math.min(100, lyrics.ghost + 0.5); yield; }
      yield 13;
      lyrics.ghost = 10;                                                    // "Fried Rice At Eddies"
    });
    // glitch lines flash on every beat
    run(function* () {
      glitch.pic = "Hide"; glitch.ghost = 86; glitch.show = true;
      for (let i = 0; i < 115; i++) {
        glitch.pic = "Hide"; yield 0.92;
        for (const c of ["costume1", "costume2", "costume3", "costume4", "costume5"]) { glitch.pic = c; yield 0.01; }
        glitch.pic = "costume6"; glitch.pic = "Hide"; yield;
      }
    });
    // the room shakes harder and softer through the song, and pulses on the beat
    run(function* () {
      const parts = [[0.8, 79], [1.5, 81], [2.2, 80], [2.5, 80], [0.8, 79], [1.5, 76], [2.2, 84], [0.5, 86]];
      for (let p = 0; p < parts.length; p++) {
        this.secretPart = p + 1;
        if (p === 3) { run(function* () { yield* pulse(office, 31, 0.38, 2, 110); }); run(function* () { yield* pulse(lyrics, 33, 0.38, 1.5, 110); }); }
        if (p === 4) { run(function* () { yield* pulse(office, 48, 0.92, 2, 110); }); run(function* () { yield* pulse(lyrics, 48, 0.92, 1.5, 110); }); }
        const lyricShake = [0.4, 0.75, 1.1, 1.25, 0.4, 0.75, 1.1, 0.25][p];
        run(function* () { yield* shake(lyrics, lyricShake, parts[p][1]); });
        yield* shake(office, parts[p][0], parts[p][1]);
      }
    });
    run(function* () { yield* pulse(office, 49, 0.92, 2, 110); });
    run(function* () { yield* pulse(lyrics, 49, 0.92, 1, 110); });
    // the end: black screen when the song finishes, a last glitch, fade out
    run(function* () {
      yield () => (this.tick - this.secretStart) * TICK >= 92;
      black.show = true;
      yield () => this.sp.music.playing.size === 0;
      yield 2;
      glitch.ghost = 70; glitch.show = true;
      for (const c of ["costume2", "costume3", "costume4", "costume5", "costume6"]) { glitch.pic = c; yield 0.025; }
      glitch.pic = "Hide";
      yield 0.1;
      flash.show = true; yield 0.1; flash.show = false;
      fadeOut.ghost = 100; fadeOut.show = true;
      for (let i = 0; i < 200; i++) { fadeOut.ghost -= 0.5; yield; }
      yield 1;
      this.showTitle();
    });
  },

  // Remember an actor's spot so it can be drawn smoothly between updates
  smoothActor(a, jump) {
    for (const k of ["x", "y", "size", "ghost"]) (jump ? this.smooth.jump : this.smooth.set).call(this.smooth, a.name + k, a[k]);
  },

  updateSecret() {
    for (const a of this.actors) this.smoothActor(a, false);
  },

  drawSecret(ctx, t) {
    for (const a of [...this.actors].sort((p, q) => p.z - q.z)) {
      if (!a.show || a.pic === "Hide") continue;
      const s = this.smooth, k = a.name;
      const ghost = s.at(k + "ghost", t, 25);
      draw(ctx, pic(a.group, a.pic), s.at(k + "x", t, 20), s.at(k + "y", t, 20),
           { size: s.at(k + "size", t, 20), alpha: 1 - Math.max(0, Math.min(100, ghost)) / 100 });
    }
  },
});
