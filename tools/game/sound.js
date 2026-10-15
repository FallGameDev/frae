/* =====================================================================
   SOUND
   Every sound lives in SOUNDS (made by the build), looked up by group
   and name, for example Sound.play("office", "Buzz_Fan_Florescent2").

   Sounds go through a "speaker". A speaker has its own volume
   (0-100), like a radio you can turn up and down while it plays.
   Speakers feed two volume knobs from the Settings screen:
     music  (songs and jingles)
     sound  (everything else)
   ===================================================================== */
"use strict";

const Sound = {
  ctx: new (window.AudioContext || window.webkitAudioContext)(),
  buffers: new Map(),       // url -> decoded sound
  speakers: [],

  async load(url) {
    const data = await (await fetch(url)).arrayBuffer();
    this.buffers.set(url, await this.ctx.decodeAudioData(data));
  },

  // A speaker for one thing in the game (the phone, the fan, the kitchen...)
  speaker(volume = 100) {
    const s = new Speaker(volume);
    this.speakers.push(s);
    return s;
  },

  // Silence everything (the game's "stop all sounds")
  stopAll() { for (const s of this.speakers) s.stopAll(); }
};

// The two volume knobs (the Settings sliders change these)
Sound.master = Sound.ctx.createGain();
Sound.master.connect(Sound.ctx.destination);
Sound.musicBus = Sound.ctx.createGain();
Sound.sfxBus = Sound.ctx.createGain();
Sound.musicBus.connect(Sound.master);
Sound.sfxBus.connect(Sound.master);

class Speaker {
  constructor(volume) {
    // one volume node for music and one for sounds, so each still follows its own knob
    this.music = Sound.ctx.createGain();
    this.sfx = Sound.ctx.createGain();
    this.music.connect(Sound.musicBus);
    this.sfx.connect(Sound.sfxBus);
    this.playing = new Map();     // sound name -> what is playing
    this.setVolume(volume);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(100, v));
    this.music.gain.value = this.sfx.gain.value = this.volume / 100;
  }

  /* Play a sound. Starting a sound that is already playing on this
     speaker starts it over. Options: loop (repeat forever).
     Returns a handle: handle.done turns true when it finishes. */
  play(group, name, o = {}) {
    const info = SOUNDS[group] && SOUNDS[group][name];
    const buffer = info && Sound.buffers.get(info.src);
    const handle = { done: true, stop() {} };
    if (!buffer) { if (!info) console.warn("No sound", group, name); return handle; }
    this.stop(name);
    const src = Sound.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = !!o.loop;
    src.connect(info.music ? this.music : this.sfx);
    handle.done = false;
    handle.stop = () => { try { src.stop(); } catch (e) {} handle.done = true; };
    src.onended = () => { handle.done = true; if (this.playing.get(name) === handle) this.playing.delete(name); };
    src.start();
    this.playing.set(name, handle);
    return handle;
  }

  isPlaying(name) { const h = this.playing.get(name); return !!h && !h.done; }
  stop(name) { const h = this.playing.get(name); if (h) { h.stop(); this.playing.delete(name); } }
  stopAll() { for (const h of this.playing.values()) h.stop(); this.playing.clear(); }
}

// Play a sound on a speaker only if it is not already playing (for sounds that loop back to back)
function keepPlaying(speaker, group, name) {
  if (!speaker.isPlaying(name)) speaker.play(group, name);
}
