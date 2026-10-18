/* =====================================================================
   ACTORS: the characters, drawn by the game wherever they stand

   Every character is drawn at runtime on top of the empty rooms, the
   office, the title screen, the jumpscares and so on. What gets drawn:

     1. its 3D model, if there is one in the models folder of the repo
        (models/toy_eddy.glb, models/withered_weddy.obj ...). Any of
        .glb  .gltf  .fbx  .obj  works. (Browsers can't open .blend
        files: tools/convert_models.py turns them into .glb.)
     2. otherwise its 2D drawing (the "Chars" pictures).

   The models are rendered ONCE while the game loads (standing, and
   reaching for you), into flat pictures. Drawing those every frame is
   as cheap as drawing any other picture, so there is no 3D cost while
   you play.

   Which file is which character: ACTOR_FILES below. The first file name
   that exists wins.

   Skeletons: a model built on the base model's skeleton is posed with
   MODEL_POSES. Any other skeleton (an uploaded model, Mixamo, Rigify...)
   follows THE SET RIG (below): its arms, legs, chest and head are found
   by name and pointed the same way, so every model gets the same poses.
   Animations: if a model has a looping animation (the one named idle or
   loop, otherwise its first one), it plays whenever the character is
   standing (rendered while loading into up to 30 frames).
   Faces: the toys have three (models/faces): calm when standing ("stand":
   the stage, newspapers...), creepy when wandering ("creep": cameras, hall,
   vents, title) and scary when reaching for you ("lunge").

   MODS can bring their own characters (Settings > Mods):
     models/<name>.glb (or .gltf .fbx .obj)    a 3D model
     characters/<name>.png (or .webp .jpg .svg)  a 2D drawing (full body)
   <name> is the same as the model names below (toy_eddy, withered_weddy...)
   or the role (tfreddy, wbonnie...). What wins, best first:
     mod model > mod drawing > the game's model (models/) > the game's drawing
   ===================================================================== */
"use strict";

const MODEL_DIR = "../models/";
const MODEL_TYPES = ["glb", "gltf", "fbx", "obj"];

// role -> model file names to look for (without the ending), first one found wins.
// pose: "broken" = bent and wrecked (Toy Endo's model standing in for Meyg)
const ACTOR_FILES = {
  tfreddy: [{ file: "toy_eddy" }],
  tbonnie: [{ file: "toy_cheddy" }],      // Bonnie's spot: Cheddy
  tchica:  [{ file: "toy_weddy" }],       // Chica's spot: Weddy
  mangle:  [{ file: "meyg" }, { file: "mangled_endo" }, { file: "toy_endo", pose: "broken" }],
  bb:      [{ file: "balloon_kid" }],
  puppet:  [{ file: "the_puppet" }, { file: "puppet" }],
  wfreddy: [{ file: "withered_eddy" }],
  wbonnie: [{ file: "withered_cheddy" }],
  wchica:  [{ file: "withered_weddy" }],
  foxy:    [{ file: "withered_endo" }],
  golden:  [{ file: "golden_eddie" }, { file: "golden_eddy" }],
  endo:    [{ file: "endo" }, { file: "endoskeleton" }],
  // the shadow in Parts/Service is drawn all black, so any Eddy works
  shadow:  [{ file: "shadow_eddy" }, { file: "withered_eddy" }, { file: "toy_eddy" }],
};

// Bone poses for the 3D models: bone name -> [x, y, z] turn in degrees (the
// bone's own axes, like the rotation boxes in Blender's pose mode).
// Bone names are matched without dots, spaces or capitals ("UpperArm.L" = "upperarml").
const MODEL_POSES = {
  stand: { "UpperArm.L": [-78, 0, 0], "UpperArm.R": [-78, 0, 0], "Head": [0, 6, 0] },
  lunge: { "UpperArm.L": [-12, 0, -88], "UpperArm.R": [-12, 0, 88], "Chest": [-14, 0, 0], "Head": [-12, -10, 0],
           "Ear.L": [0, -20, 0], "Ear.R": [0, 20, 0], "Leg.L": [18, 0, 0], "Leg.R": [-12, 0, 0] },
  // wrecked: twisted head, one arm wrenched up, one hanging, legs splayed
  broken: { "UpperArm.L": [40, 0, 30], "UpperArm.R": [-88, 0, 0], "Head": [12, 14, 12], "Chest": [8, 10, 6],
            "Ear.L": [0, -55, 0], "Ear.R": [0, 70, 30], "Leg.L": [0, 25, 0], "Leg.R": [30, -15, 0], "Hand.L": [60, 0, 0] },
  brokenlunge: { "UpperArm.L": [-10, 0, -75], "UpperArm.R": [-30, 0, 85], "Chest": [-18, 6, 0], "Head": [-10, 12, 14],
                 "Ear.L": [0, -55, 0], "Ear.R": [0, 70, 30], "Leg.L": [20, 20, 0] },
};
const ACTOR_RENDER_H = 760;            // how tall (in pixels) each 3D character picture is made
const ACTOR_ANIM_H = 440;              // ...and each frame of an animation (smaller: there are many)
const ACTOR_ANIM_FPS = 12, ACTOR_ANIM_MAX = 10;   // at most 10 frames per loop (memory)
const SCARE_W = 640, SCARE_H = 480;
// Jiggle bones (any bone named Bust / Jiggle / Breast): spring physics in the game instead of keyframes.
//   stiff: spring strength, damp: how fast it settles, reach: how far the tip may lag (x its length),
//   squash: how much it may stretch / squash (0.2 = 20%), length: the tip's distance (bone units)
const JIGGLE_BONE = /^(bust|jiggle|breast)/;
const JIGGLE = { stiff: 170, damp: 7, reach: 0.6, squash: 0.18, length: 0.3 };    // jumpscares are drawn live, this big

/* ---------------------------------------------------------------------
   THE SET RIG: models that don't use the base model's skeleton
   (uploaded models, Mixamo, Rigify, VRoid...) are posed through it.
   Their bones are matched to these few parts by name, then each part is
   turned to POINT a set way, so any skeleton ends up in the same pose:
     chest, head, armL, armR (upper arms), legL, legR (thighs)
   Directions: x = the character's left, y = up, z = toward you.
   --------------------------------------------------------------------- */
const SET_RIG_POSES = {
  stand:       { chest: [0, 1, 0.04], armL: [0.2, -1, 0.06], armR: [-0.2, -1, 0.06], legL: [0.06, -1, 0], legR: [-0.06, -1, 0] },
  lunge:       { chest: [0, 1, 0.38], head: [0, 0.7, 1], armL: [0.32, 0.18, 1], armR: [-0.32, 0.18, 1],
                 legL: [0.08, -1, 0.35], legR: [-0.08, -1, -0.25] },
  broken:      { chest: [0.25, 1, 0.12], head: [0.6, 0.6, 0.4], armL: [0.55, 1, 0.2], armR: [-0.12, -1, 0.15],
                 legL: [0.45, -1, 0.05], legR: [-0.3, -1, 0.35] },
  brokenlunge: { chest: [0.15, 1, 0.45], head: [0.5, 0.5, 1], armL: [0.4, 0.3, 1], armR: [-0.2, 0.1, 1],
                 legL: [0.3, -1, 0.3], legR: [-0.1, -1, -0.2] },
};
// bone names -> set-rig part ("mixamorig:LeftArm", "DEF-upper_arm.L", "Bip01 L Thigh", "J_Bip_L_UpperArm"...)
const SET_RIG_PARTS = { arm: ["upperarm", "arm", "uparm"], leg: ["upleg", "upperleg", "thigh", "leg"] };
const SET_RIG_CHEST = ["upperchest", "chest", "spine2", "spine02", "spine1", "spine01", "spine"];
function setRigPart(rawName) {
  const n = String(rawName).toLowerCase().replace(/[^a-z0-9]/g, "")
    .replace(/^(mixamorig\d*|bip0*1|bip|def|org|ccbase|jbip|jbipc|valvebiped|bip01|armature)/, "");
  if (n === "head") return "head";
  // side at the start ("leftarm", "lthigh") or at the end ("upperarml", "thighleft")
  const tries = [["L", n.match(/^(?:left|l)(.+)$/)], ["L", n.match(/^(.+?)(?:left|l)$/)],
                 ["R", n.match(/^(?:right|r)(.+)$/)], ["R", n.match(/^(.+?)(?:right|r)$/)]];
  for (const [side, m] of tries) {
    if (!m) continue;
    for (const [part, names] of Object.entries(SET_RIG_PARTS)) if (names.includes(m[1])) return part + side;
  }
  return null;
}
// Does this skeleton follow the base model (Root > Hips > Chest > Head, UpperArm.L ...)? Then it uses MODEL_POSES.
const isBaseRig = bones => ["hips", "chest", "head", "upperarml", "upperarmr", "legl", "legr"].every(b => bones[b]);

// The names a character can have in a mod's models/ and characters/ folders
const actorNames = role => [...ACTOR_FILES[role].map(c => c.file), role];
// The first mod file for a character in a folder (MOD_FILES is filled by the Mods code)
function modActorFile(folder, role, types) {
  if (typeof MOD_FILES === "undefined") return null;
  for (const name of actorNames(role)) for (const type of types) {
    const url = MOD_FILES[folder + "/" + name + "." + type];
    if (url) return { url, type, file: name, pose: (ACTOR_FILES[role].find(c => c.file === name) || {}).pose };
  }
  return null;
}
const DRAWING_TYPES = ["png", "webp", "jpg", "jpeg", "gif", "svg"];
const loadImage = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

// One finished character picture: the image, its black copy (for darkening),
// and where its body and head are inside it (pixels: [left, top, right, bottom])
function makeSprite(canvas, headPart, same) {
  const w = canvas.naturalWidth || canvas.width, h = canvas.naturalHeight || canvas.height;
  if (same) return { img: canvas, black: blackCopy(canvas, w, h), w, h, body: same.body, head: same.head, face: canvas.face };   // animation frames share one box
  const k = Math.min(1, 220 / Math.max(w, h));         // measure on a small copy (fast)
  const sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
  const m = document.createElement("canvas");
  m.width = sw; m.height = sh;
  const g = m.getContext("2d", { willReadFrequently: true });
  g.drawImage(canvas, 0, 0, sw, sh);
  const a = g.getImageData(0, 0, sw, sh).data;
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (a[(y * sw + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = sw - 1; y1 = sh - 1; }
  // the head: the top part of the body, as wide as the drawing is there
  const band = Math.round(y0 + (y1 - y0) * headPart);
  let hx0 = sw, hx1 = -1;
  for (let y = y0; y <= band; y++) for (let x = 0; x < sw; x++) {
    if (a[(y * sw + x) * 4 + 3] > 40) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
  }
  if (hx1 < 0) { hx0 = x0; hx1 = x1; }
  return { img: canvas, black: blackCopy(canvas, w, h), w, h, face: canvas.face,
           body: [x0 / k, y0 / k, (x1 + 1) / k, (y1 + 1) / k],
           head: [hx0 / k, y0 / k, (hx1 + 1) / k, (band + 1) / k] };
}

// 2D drawings whose head is not simply the top of the picture: where it is
// (left, top, right, bottom as parts of the picture's width and height)
const HEAD_FRACTION = {
  bb: [0.17, 0.0, 0.52, 0.5],      // the Peepeepoopoo Monster: his face is on the left
};

const Actors = {
  sprites: new Map(),          // "role/kind" -> sprite
  models: {},                  // role -> the model file used (for the debug panel)

  get(role, kind, still) {
    const fallback = { vent: "creep", hall: "creep", title: "creep" }[kind];
    const s = this.sprites.get(role + "/" + (kind || "stand")) || (fallback && this.sprites.get(role + "/" + fallback))
      || this.sprites.get(role + "/stand") || this.flat(role);
    // an animation: the frame for right now (or always the first one when it should hold still)
    if (s && s.frames) return still ? s.frames[0] : s.frames[Math.floor(performance.now() / 1000 * s.fps) % s.frames.length];
    return s;
  },
  // every picture (for the warm-up while loading)
  allPictures() {
    const out = [];
    for (const s of this.sprites.values()) for (const f of s.frames || [s]) out.push(f.img, f.black);
    return out;
  },

  // the 2D drawing (made the first time it is needed)
  flat(role) {
    const key = role + "/stand";
    if (this.sprites.has(key)) return this.sprites.get(key);
    if (!hasPic("Chars", role)) return null;
    const p = pic("Chars", role);
    if (!p.img) return null;
    const s = makeSprite(p.img, 0.4);       // measured straight from the picture (no slow copy)
    const hf = HEAD_FRACTION[role];
    if (hf) s.head = [hf[0] * s.w, hf[1] * s.h, hf[2] * s.w, hf[3] * s.h];
    this.sprites.set(key, s);
    return s;
  },

  // Look for each character's model and render it. Never fails: anything
  // that goes wrong just leaves that character as its 2D drawing.
  async load(onProgress) {
    // measure every 2D drawing now, while loading (measuring during the night made the game stutter)
    for (const role of Object.keys(ACTOR_FILES)) this.flat(role);
    const found = {};
    await Promise.all(Object.entries(ACTOR_FILES).map(async ([role, list]) => {
      // 1. a mod's 3D model
      const modModel = modActorFile("models", role, MODEL_TYPES);
      if (modModel) { found[role] = modModel; return; }
      // 2. a mod's 2D drawing (wins over the game's own model)
      const modDrawing = modActorFile("characters", role, DRAWING_TYPES);
      if (modDrawing) {
        try {
          const img = await loadImage(modDrawing.url);
          if (img.decode) await img.decode().catch(() => {});
          this.sprites.set(role + "/stand", makeSprite(img, 0.4));
          this.sprites.delete(role + "/lunge");
          this.models[role] = "mod drawing";
          return;
        } catch (e) { console.warn("Mod drawing did not load", modDrawing.file, e); }
      }
      // 3. the game's own model in the models folder
      for (const choice of list) {
        for (const type of MODEL_TYPES) {
          const url = MODEL_DIR + choice.file + "." + type;
          try {
            const r = await fetch(url, { method: "HEAD", cache: "no-cache" });
            if (r.ok) { found[role] = { ...choice, url, type }; return; }
          } catch (e) { /* no file */ }
        }
      }
    }));
    const roles = Object.keys(found);
    if (!roles.length) return;
    let three;
    try { three = await this.startThree(); }
    catch (e) { console.warn("3D models could not be started (using the 2D drawings)", e); return; }
    const cache = new Map();          // the same file used twice (the shadow) is loaded once
    let done = 0;
    for (const role of roles) {
      const f = found[role];
      try {
        if (!cache.has(f.url)) cache.set(f.url, await three.loadModel(f.url, f.type));
        const model = cache.get(f.url);
        const poses = f.pose === "broken" ? ["broken", "brokenlunge"] : ["stand", "lunge"];
        // the toys' other faces (models/faces/<file>_head2.png creepy, _head3.png scary), when there are some
        const faces = await three.loadFaces(f.file);
        // standing: its own looping animation if it has one, otherwise the standing pose (calm face)
        three.setFace(model, null);
        const animate = model.clip && role !== "shadow";      // (the all-black shadow doesn't need to move)
        if (animate) this.sprites.set(role + "/stand", three.renderAnimation(model, 8, poses[0]));
        else this.sprites.set(role + "/stand", makeSprite(three.render(model, poses[0], 8), 0.36));
        // creeping around (cameras, hall, vents): standing, creepy face
        if (faces[2]) {
          three.setFace(model, faces[2]);
          this.sprites.set(role + "/creep", animate ? three.renderAnimation(model, 8, poses[0]) : makeSprite(three.render(model, poses[0], 8), 0.36));
        }
        if (role !== "shadow") {
          if (faces[2]) three.setFace(model, faces[2]);
          // lying down in the vents, walking down the hall (small pictures: they are drawn small)
          if (model.crawlClip) this.sprites.set(role + "/vent", three.renderAnimation(model, 0, poses[0], { clip: model.crawlClip, frames: 8, H: 300, view: "low", wholeHead: true }));
          if (model.walkClip) this.sprites.set(role + "/hall", three.renderAnimation(model, 4, poses[0], { clip: model.walkClip, frames: 8, H: 320 }));
          // the title screen close-up: one big sharp picture
          if (TITLE_FACES.some(f => f.role === role)) {
            const big = makeSprite(three.renderBig(model, poses[0], 1100), 0.36);
            const [x0, y0, x1, y1] = big.body;            // the head and ears: the top of the close-up
            big.head = [x0, y0, x1, y0 + (y1 - y0) * 0.72];
            this.sprites.set(role + "/title", big);
          }
        }
        // reaching for you (in the office, jumpscares): scary face
        three.setFace(model, faces[3] || faces[2] || null);
        this.sprites.set(role + "/lunge", makeSprite(three.render(model, poses[1], 0), 0.36));
        three.setFace(model, null);
        if (model.scareClip && role !== "shadow") this.scares[role] = { model, face: faces[3] || faces[2] || null };
        this.models[role] = f.url;
      } catch (e) { console.warn("Could not use the 3D model", f.url, e); }
      if (onProgress) onProgress(++done / roles.length);
    }
    // keep three.js only if a jumpscare needs it
    if (Object.keys(this.scares).length) this.three = three;
    else three.dispose();
  },

  // ---- live 3D jumpscares ----
  scares: {},                  // role -> {model, face}
  hasScare(role) { return !!(this.three && this.scares[role]); },
  scareLength(role) { return this.hasScare(role) ? this.scares[role].model.scareClip.duration : 0; },
  scareFrame(role, t) {
    const s = this.scares[role];
    this.three.setFace(s.model, s.face);
    return this.three.renderScare(s.model, t);
  },

  // three.js (lib/three, loaded only when there is a model to show)
  async startThree() {
    const THREE = await import("three");
    const R = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    // stage lights: a soft room light, a key light from above the camera, a fill and a rim
    scene.add(new THREE.HemisphereLight(0xc8c8d8, 0x2a2a30, 1.1));
    for (const [x, y, z, power] of [[-2.5, 4.5, 4, 2.4], [3.5, 2, 3, 0.8], [0.5, 3.5, -4, 1.8]]) {
      const l = new THREE.DirectionalLight(0xffffff, power);
      l.position.set(x, y, z);
      scene.add(l);
    }
    const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 1000);
    const DEG = Math.PI / 180;
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

    async function loadModel(url, type) {
      let root, clips = [];
      if (type === "glb" || type === "gltf") {
        const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
        const gltf = await new GLTFLoader().loadAsync(url);
        root = gltf.scene; clips = gltf.animations || [];
      } else if (type === "fbx") {
        const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js");
        root = await new FBXLoader().loadAsync(url);
        clips = root.animations || [];
      } else {
        const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
        root = await new OBJLoader().loadAsync(url);
        // a plain .obj has no colors: give it a plastic grey
        root.traverse(o => { if (o.isMesh && (!o.material || o.material.type === "MeshPhongMaterial"))
          o.material = new THREE.MeshStandardMaterial({ color: 0xb8b0a8, roughness: 0.6 }); });
      }
      // make every model the same size (2.4 tall, feet on the floor, in the middle).
      // (measured on the real, skinned shape: "precise")
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root, true);
      const size = box.getSize(new THREE.Vector3());
      const k = 2.4 / (size.y || 1);
      root.scale.multiplyScalar(k);
      root.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(root, true);
      const c = b2.getCenter(new THREE.Vector3());
      root.position.x -= c.x; root.position.z -= c.z; root.position.y -= b2.min.y;
      root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
      // the bones by their plain names, with their resting turn (and place) remembered
      const bones = {};
      root.traverse(o => { if (o.isBone) { bones[norm(o.name)] = o; o.userData.rest = o.quaternion.clone(); o.userData.restPos = o.position.clone(); } });
      const model = { root, bones, baseRig: isBaseRig(bones) };
      model.face = findFace(model);
      // bones that wobble by themselves (Weddy's Bust): spring physics, never keyframes
      model.jiggles = Object.entries(bones).filter(([n]) => JIGGLE_BONE.test(n)).map(([, bone]) => ({ bone }));
      // not the base skeleton: find the set-rig parts in it
      if (!model.baseRig) model.rig = findSetRig(root);
      // a looping animation: the one called idle/loop, otherwise the first one (that isn't a jumpscare)
      const isScare = c => /scare|jump|death|kill/i.test(c.name);
      const clip = clips.find(c => /idle|loop/i.test(c.name)) || clips.find(c => !isScare(c) && !/crawl|vent|prone|walk|hall/i.test(c.name));
      const usable = c => c && c.duration > 0.05 && c.tracks.length;
      if (usable(clip) || usable(clips.find(isScare))) model.mixer = new THREE.AnimationMixer(root);
      if (usable(clip)) {
        model.action = model.mixer.clipAction(clip);
        model.action.play();
        model.clip = clip;
      }
      // a jumpscare animation (Scare / Jumpscare / Death): played live when this character gets you
      // lying down in a vent / coming down the hall
      const crawl = clips.find(c => /crawl|vent|prone/i.test(c.name)), walk = clips.find(c => /walk|hall/i.test(c.name));
      if (usable(crawl)) model.crawlClip = crawl;
      if (usable(walk)) model.walkClip = walk;
      const scare = clips.find(isScare);
      if (usable(scare)) { model.scareClip = scare; model.scareAction = model.mixer.clipAction(scare); }
      return model;
    }

    // Where the face is: the front of the head material's shape, kept in the Head bone's own
    // space so it follows the head through every animation (for FACE_OFF, Weddy's missing face plate)
    function findFace(model) {
      const bone = model.bones.head;
      if (!bone) return null;
      model.root.updateMatrixWorld(true);
      const v = new THREE.Vector3(), box = new THREE.Box3();
      let n = 0;
      model.root.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const g = o.geometry, idx = g.index;
        const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : g.attributes.position.count, materialIndex: 0 }];
        for (const grp of groups) {
          const m = mats[grp.materialIndex || 0];
          if (!m || !/head/i.test(m.name || "")) continue;
          for (let i = grp.start; i < grp.start + grp.count; i += 3) {
            o.getVertexPosition(idx ? idx.getX(i) : i, v);
            box.expandByPoint(v.applyMatrix4(o.matrixWorld));
            n++;
          }
        }
      });
      if (!n) return null;
      const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      const r = Math.max(size.x, size.y) / 2;
      const front = new THREE.Vector3(c.x, c.y - 0.06 * r, box.max.z);        // the models look toward +z
      const inv = new THREE.Quaternion();
      bone.getWorldQuaternion(inv).invert();
      return { bone, r, local: bone.worldToLocal(front.clone()),
               fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(inv), up: new THREE.Vector3(0, 1, 0).applyQuaternion(inv) };
    }
    // The face on a W x H picture seen by `cam`: its middle (x, y), the face's right and up
    // directions in pixels (a, b), and how much it looks at the camera (1 = straight at it)
    const _f = new THREE.Vector3(), _fn = new THREE.Vector3(), _fu = new THREE.Vector3(), _fr = new THREE.Vector3(), _fp = new THREE.Vector3();
    function faceAt(model, cam, W, H) {
      const F = model.face;
      if (!F) return null;
      F.bone.updateWorldMatrix(true, false);
      const p = F.bone.localToWorld(_f.copy(F.local));
      _fn.copy(F.fwd).transformDirection(F.bone.matrixWorld);
      _fu.copy(F.up).transformDirection(F.bone.matrixWorld);
      _fr.crossVectors(_fu, _fn).normalize();
      const look = _fp.copy(cam.position).sub(p).normalize().dot(_fn);
      const px = q => { const s = q.clone().project(cam); return [(s.x + 1) / 2 * W, (1 - s.y) / 2 * H]; };
      const [x, y] = px(p);
      const [rx, ry] = px(p.clone().addScaledVector(_fr, F.r));
      const [ux, uy] = px(p.clone().addScaledVector(_fu, F.r));
      return { x, y, ax: rx - x, ay: ry - y, bx: ux - x, by: uy - y, look };
    }

    /* Jiggle physics (in place of Blender's soft body lattice, which a .glb can't carry):
       the bone's tip is a weight on a spring. Where the tip WOULD be (the animated body
       carrying it) pulls the weight; the bone then points at the weight and stretches or
       squashes with it. So the chest lags, bounces and settles on its own. */
    const _jh = new THREE.Vector3(), _jt = new THREE.Vector3(), _jd = new THREE.Vector3(), _jq = new THREE.Quaternion(),
          _jw = new THREE.Quaternion(), _jp = new THREE.Quaternion(), _ja = new THREE.Vector3(), _jb = new THREE.Vector3();
    function jiggleReset(model) { for (const J of model.jiggles || []) J.p = null; }
    function jiggleStep(model, dt) {
      for (const J of model.jiggles || []) {
        const b = J.bone;
        b.scale.set(1, 1, 1);
        b.updateWorldMatrix(true, false);
        b.getWorldPosition(_jh);
        _jt.set(0, JIGGLE.length, 0); b.localToWorld(_jt);           // where the tip would be (bones point along +y)
        if (!J.p) { J.p = _jt.clone(); J.v = new THREE.Vector3(); J.rest = _jt.distanceTo(_jh); }
        // spring toward the target, with damping
        _jd.copy(_jt).sub(J.p).multiplyScalar(JIGGLE.stiff).addScaledVector(J.v, -JIGGLE.damp);
        J.v.addScaledVector(_jd, dt);
        J.p.addScaledVector(J.v, dt);
        // don't let it fly off (a big lunge)
        const off = J.p.distanceTo(_jt), max = J.rest * JIGGLE.reach;
        if (off > max) J.p.sub(_jt).multiplyScalar(max / off).add(_jt);
        // point the bone at the weight
        _ja.copy(_jt).sub(_jh).normalize();
        _jb.copy(J.p).sub(_jh);
        const stretch = Math.min(1 + JIGGLE.squash, Math.max(1 - JIGGLE.squash, _jb.length() / J.rest));
        _jq.setFromUnitVectors(_ja, _jb.normalize());
        b.getWorldQuaternion(_jw);
        b.parent.getWorldQuaternion(_jp);
        b.quaternion.copy(_jp.invert().multiply(_jq.multiply(_jw)));
        b.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
        b.updateMatrixWorld(true);
        J.stretch = stretch; J.bend = _ja.angleTo(_jb) * 180 / Math.PI; J.off = J.p.distanceTo(_jt); J.speed = J.v.length();   // (for the debug panel)
      }
    }

    const isAncestor = (a, b) => { for (let p = b.parent; p; p = p.parent) if (p === a) return true; return false; };
    const firstChildBone = (b, toward) => {
      const kids = b.children.filter(c => c.isBone);
      return (toward && kids.find(k => k === toward || isAncestor(k, toward))) || kids[0] || null;
    };
    function findSetRig(root) {
      const rig = {}, all = [];
      root.traverse(o => { if (o.isBone) all.push(o); });
      for (const b of all) {
        const part = setRigPart(b.name);
        if (!part) continue;
        // two bones for one part (Mixamo's UpLeg and Leg): the one closer to the body wins
        if (!rig[part] || isAncestor(b, rig[part])) rig[part] = b;
      }
      const plain = b => b.name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^(mixamorig\d*|bip0*1|def|org|jbipc?)/, "");
      for (const want of SET_RIG_CHEST) { const b = all.find(x => plain(x) === want); if (b) { rig.chest = b; break; } }
      return rig;
    }
    // turn one bone so it points along `dir` (from the bone to its child)
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _bw = new THREE.Quaternion(), _pw = new THREE.Quaternion();
    function aim(bone, child, dir) {
      if (!bone || !child) return;
      bone.getWorldPosition(_a); child.getWorldPosition(_b);
      const d = _b.sub(_a);
      if (d.lengthSq() < 1e-10) return;
      _q.setFromUnitVectors(d.normalize(), new THREE.Vector3(...dir).normalize());
      bone.getWorldQuaternion(_bw);
      bone.parent.getWorldQuaternion(_pw);
      bone.quaternion.copy(_pw.invert().multiply(_q.multiply(_bw)));
      bone.updateMatrixWorld(true);
    }
    function poseSetRig(model, which) {
      const rig = model.rig, P = SET_RIG_POSES[which] || {};
      model.root.updateMatrixWorld(true);
      if (P.chest && rig.chest) aim(rig.chest, firstChildBone(rig.chest, rig.head), P.chest);
      if (P.head && rig.head) aim(rig.head, firstChildBone(rig.head), P.head);
      for (const part of ["armL", "armR", "legL", "legR"]) if (P[part] && rig[part]) aim(rig[part], firstChildBone(rig[part]), P[part]);
    }

    function pose(model, which) {
      for (const b of Object.values(model.bones)) { b.quaternion.copy(b.userData.rest); b.position.copy(b.userData.restPos); }
      if (!model.baseRig) { poseSetRig(model, which); return; }
      for (const [name, [x, y, z]] of Object.entries(MODEL_POSES[which] || {})) {
        const b = model.bones[norm(name)];
        // Blender's XYZ turn order = three.js "ZYX"
        if (b) b.quaternion.copy(b.userData.rest).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x * DEG, y * DEG, z * DEG, "ZYX")));
      }
      model.root.updateMatrixWorld(true);
    }

    // one picture of the model in a pose, seen from `angle` degrees to the side
    function render(model, which, angle) {
      pose(model, which);
      return trim(shoot(model, angle, ACTOR_RENDER_H));
    }
    // the model as it is now -> a picture (H pixels tall, not cut down)
    function shoot(model, angle, H, view) {
      const W = Math.round(H * (view === "low" ? 1.4 : 0.95));
      R.setSize(W, H, false);
      camera.aspect = W / H;
      const d = 9.2, a = angle * DEG;
      if (view === "face") {
        // a close-up of the head (the title screen): the head fills the picture, nice and sharp
        camera.position.set(0, 2.05, 4.2);
        camera.lookAt(0, 2.0, 0);
      } else if (view === "low") {
        // lying down (vents): seen from in front, a bit above, so the face looking up is in view
        camera.position.set(Math.sin(a) * d, 2.4, Math.cos(a) * d + 1.5);
        camera.lookAt(0, 0.35, 1.2);
      } else {
        camera.position.set(Math.sin(a) * d, 1.45, Math.cos(a) * d);
        camera.lookAt(0, 1.2, 0);
      }
      camera.updateProjectionMatrix();
      scene.add(model.root);
      R.render(scene, camera);
      scene.remove(model.root);
      // copy it into a normal picture, cut down to the character
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      c.getContext("2d", { willReadFrequently: true }).drawImage(R.domElement, 0, 0);
      c.face = faceAt(model, camera, W, H);
      return c;
    }
    // the model's looping animation -> pictures (frames), all cut to the same box so it doesn't wobble
    // o: {clip (default: the idle loop), frames, H (picture height), view ("low" for lying down), wholeHead}
    function renderAnimation(model, angle, standPose, o = {}) {
      const clip = o.clip || model.clip;
      const n = Math.max(2, Math.min(o.frames || ACTOR_ANIM_MAX, Math.round(clip.duration * ACTOR_ANIM_FPS)));
      const act = clip === model.clip ? model.action : model.mixer.clipAction(clip);
      model.mixer.stopAllAction();
      act.reset().play();
      const shots = [];
      const at = t => {
        pose(model, standPose);                       // standing pose for the bones the animation doesn't move...
        model.mixer.stopAllAction();
        act.reset().play();                           // (restarted each time: see renderScare)
        model.mixer.setTime(t);                       // ...then the animation on top
        model.root.updateMatrixWorld(true);
      };
      if (model.jiggles && model.jiggles.length) {
        // with jiggle bones: play the loop twice (the first time lets the wobble settle into its rhythm)
        jiggleReset(model);
        const dt = 1 / 60, D = clip.duration;
        let next = 0;
        for (let t = 0; next < n; t += dt) {
          at(t % D);
          jiggleStep(model, dt);
          if (t >= D + next * D / n - 1e-6) { shots.push(shoot(model, angle, o.H || ACTOR_ANIM_H, o.view)); next++; }
        }
      } else {
        for (let i = 0; i < n; i++) {
          at(clip.duration * i / n);
          shots.push(shoot(model, angle, o.H || ACTOR_ANIM_H, o.view));
        }
      }
      model.mixer.stopAllAction();
      if (model.action) model.action.play();
      model.mixer.setTime(0);
      const box = unionBox(shots);
      const frames = shots.map(c => cropTo(c, box));
      const first = makeSprite(frames[0], 0.36);
      if (o.wholeHead) first.head = first.body.slice();   // lying down: the whole thing goes where the head would
      const sprites = frames.map((c, i) => (i === 0 ? first : makeSprite(c, 0.36, first)));
      return { frames: sprites, fps: n / clip.duration };
    }
    // a still picture, bigger than usual (the title screen close-up)
    function renderBig(model, which, H) {
      pose(model, which);
      return trim(shoot(model, 0, H, "face"));
    }

    function dispose() { R.dispose(); R.forceContextLoss && R.forceContextLoss(); }

    // One moment of a jumpscare, from where you sit (live: only while a jumpscare plays)
    const scareCam = new THREE.PerspectiveCamera(55, SCARE_W / SCARE_H, 0.01, 1000);
    function renderScare(model, t) {
      const end = model.scareClip.duration - 0.001;
      // the jumpscare's pose at time tt (the clip is restarted every time: setting the time again
      // and again on a running clip loses the pose after a while)
      const scareAt = tt => {
        for (const b of Object.values(model.bones)) { b.quaternion.copy(b.userData.rest); b.position.copy(b.userData.restPos); }
        model.mixer.stopAllAction();
        model.scareAction.reset().play();
        model.mixer.setTime(Math.min(tt, end));
      };
      if (model.jiggles && model.jiggles.length) {
        // the jiggle bones catch up from the last frame shown, in small steps
        if (model.scareT === undefined || t < model.scareT) { jiggleReset(model); model.scareT = 0; }
        for (let tt = model.scareT; tt < t; tt += 1 / 60) {
          scareAt(tt);
          model.root.updateMatrixWorld(true);
          jiggleStep(model, 1 / 60);
        }
        model.scareT = t;
        // (the jiggle bones keep where the physics put them; everything else is set for exactly t)
        const keep = model.jiggles.map(J => [J.bone, J.bone.quaternion.clone(), J.bone.scale.clone()]);
        scareAt(t);
        for (const [b, q, sc] of keep) { b.quaternion.copy(q); b.scale.copy(sc); }
      } else {
        scareAt(t);
      }
      model.root.updateMatrixWorld(true);
      R.setSize(SCARE_W, SCARE_H, false);
      scareCam.position.set(0, 1.62, 3.15);
      scareCam.lookAt(0, 1.42, 0);
      scene.add(model.root);
      R.render(scene, scareCam);
      Actors.scareFace = faceAt(model, scareCam, SCARE_W, SCARE_H);
      scene.remove(model.root);
      model.scareAction.stop();
      if (model.action) model.action.play();
      return R.domElement;
    }
    // A toy's other faces: head textures painted by tools/face_toys.py (a mod can bring its own)
    const texLoader = new THREE.TextureLoader();
    async function loadFaces(file) {
      const out = {};
      for (const n of [2, 3]) {
        const rel = "models/faces/" + file + "_head" + n + ".png";
        const url = (typeof MOD_FILES !== "undefined" && MOD_FILES[rel]) || "../" + rel;
        try {
          const t = await texLoader.loadAsync(url);
          t.flipY = false;                               // (the way glTF models read pictures)
          t.colorSpace = THREE.SRGBColorSpace;
          out[n] = t;
        } catch (e) { /* this model has no such face */ }
      }
      return out;
    }
    // Put a face texture on the head (null = the model's own)
    function setFace(model, tex) {
      model.root.traverse(o => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m || !/head/i.test(m.name || "")) continue;
          if (m.userData.ownMap === undefined) m.userData.ownMap = m.map || null;
          const map = tex || m.userData.ownMap;
          m.map = map;
          m.needsUpdate = true;
        }
      });
    }

    return { loadModel, render, renderAnimation, renderBig, renderScare, loadFaces, setFace, dispose };
  },
};

// The picture's shape in black (for darkening)
function blackCopy(canvas, w, h) {
  const black = document.createElement("canvas");
  black.width = w; black.height = h;
  const bg = black.getContext("2d");
  bg.drawImage(canvas, 0, 0);
  bg.globalCompositeOperation = "source-in";
  bg.fillStyle = "#000"; bg.fillRect(0, 0, w, h);
  return black;
}
// The box around everything drawn in any of these pictures (same size pictures)
function unionBox(list) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const c of list) {
    const { width: w, height: h } = c;
    const a = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      if (a[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  const w = list[0].width, h = list[0].height;
  if (x1 < 0) return [0, 0, w, h];
  return [Math.max(0, x0 - 4), Math.max(0, y0 - 4), Math.min(w, x1 + 5), Math.min(h, y1 + 5)];
}
function cropTo(c, [x0, y0, x1, y1]) {
  const out = document.createElement("canvas");
  out.width = x1 - x0; out.height = y1 - y0;
  out.getContext("2d").drawImage(c, -x0, -y0);
  out.face = shiftFace(c.face, x0, y0);
  return out;
}
const shiftFace = (f, x0, y0) => (f ? { ...f, x: f.x - x0, y: f.y - y0 } : null);
// Cut the empty space around a picture away (keeps memory small)
function trim(c) {
  const g = c.getContext("2d", { willReadFrequently: true });
  const { width: w, height: h } = c;
  const a = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (a[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return c;
  x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(w, x1 + 5); y1 = Math.min(h, y1 + 5);
  const out = document.createElement("canvas");
  out.width = x1 - x0; out.height = y1 - y0;
  out.getContext("2d").drawImage(c, -x0, -y0);
  out.face = shiftFace(c.face, x0, y0);
  return out;
}

/* ---------------------------------------------------------------------
   drawActor(ctx, role, box, options)
   Draws a character into box [left, top, right, bottom] (current units).
   options: mode "body" (feet at the bottom of the box) or "head" (head fills it),
            kind "lunge", shade 0..1 (darker), tint true (all black), still (no idle animation),
            rot (degrees), cut [x, y, w, h] (only inside), alpha, flip
   --------------------------------------------------------------------- */
function drawActor(ctx, role, box, o = {}) {
  const s = Actors.get(role, o.kind, o.still);
  if (!s) return;
  const head = o.mode === "head";
  const part = head ? s.head : s.body;
  let k = (box[3] - box[1]) / Math.max(1, part[3] - part[1]);
  // a very wide character (the Peepeepoopoo Monster) in a spot made for a tall one: keep it near the spot's width
  if (!head) k = Math.min(k, (box[2] - box[0]) * 1.6 / Math.max(1, part[2] - part[0]));
  const ax = (part[0] + part[2]) / 2, ay = head ? (part[1] + part[3]) / 2 : part[3];   // this point of the picture...
  const tx = (box[0] + box[2]) / 2, ty = head ? (box[1] + box[3]) / 2 : box[3];       // ...goes here
  ctx.save();
  if (o.cut) { ctx.beginPath(); ctx.rect(o.cut[0], o.cut[1], o.cut[2], o.cut[3]); ctx.clip(); }
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(tx, ty);
  if (o.rot) ctx.rotate(o.rot * Math.PI / 180);
  ctx.scale(o.flip ? -k : k, k);
  ctx.translate(-ax, -ay);
  if (!o.tint) ctx.drawImage(s.img, 0, 0);
  if (faceOff(role, o.kind)) drawRedaction(ctx, s.face);
  const shade = o.tint ? 1 : Math.min(0.95, o.shade || 0);
  if (shade > 0.01) { ctx.globalAlpha *= shade; ctx.drawImage(s.black, 0, 0); }
  ctx.restore();
}

/* ---------------------------------------------------------------------
   Weddy (Toy Chica's spot) takes her face plate off when she leaves the
   stage, like Toy Chica: where her face was there is a glitching black
   box, like Honcho's head in DOORS. FACE_OFF: role -> the kinds it shows on
   ("scare" = her live 3D jumpscare). Needs a 3D model (it follows the head bone).
   --------------------------------------------------------------------- */
const FACE_OFF = { tchica: ["creep", "vent", "hall", "lunge", "scare"] };
const faceOff = (role, kind) => !!(FACE_OFF[role] && FACE_OFF[role].includes(kind));
// a small repeatable random number list (the same glitch for everything drawn in the same moment)
function glitchRandom(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
// The black box over the face. f: where the face is (from faceAt), in the picture's pixels.
function drawRedaction(ctx, f) {
  if (!f || f.look < 0.1) return;                       // her face is turned away
  const rnd = glitchRandom(Math.floor(performance.now() / 70));   // a new glitch about 14 times a second
  ctx.save();
  // face space: x -1..1 = left..right of the face, y -1..1 = top..bottom
  // (the whole front of the head, edge to edge and top to chin; the ears stick out)
  ctx.transform(f.ax * 1.06, f.ay * 1.06, -f.bx * 1.08, -f.by * 1.08, f.x + f.bx * 0.2, f.y + f.by * 0.2);
  const jump = rnd() < 0.3 ? (rnd() - 0.5) * 0.4 : 0;     // the whole box jumps sideways
  ctx.fillStyle = "#000";
  for (let i = 0; i < 4; i++) {                          // 4 slices, each can slip
    const slip = rnd() < 0.3 ? (rnd() - 0.5) * 0.55 : 0;
    const wide = rnd() < 0.12 ? 0.75 + rnd() * 0.2 : 1;
    ctx.fillRect(-1 + jump + slip, -1 + i * 0.5, 2 * wide, 0.52);
  }
  if (rnd() < 0.25) {                                    // a faint second copy, a bit off
    ctx.globalAlpha *= 0.45;
    ctx.fillRect(-1 + jump + (rnd() - 0.5) * 0.9, -1 + (rnd() - 0.5) * 0.5, 2, 2);
    ctx.globalAlpha /= 0.45;
  }
  if (rnd() < 0.55) {                                    // a thin static line through it
    ctx.fillStyle = rnd() < 0.5 ? "#fff" : "#7a7a7a";
    ctx.fillRect(-1.25 + (rnd() - 0.5) * 0.4, -1 + rnd() * 2, 0.5 + rnd() * 2, 0.07);
  }
  ctx.restore();
}

// Draws a character spot that was made for a picture of its own:
// spot.pin is that picture's pin, spot.box is in its units. (x, y, size) like draw().
function drawSpot(ctx, spot, x, y, size = 100, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-spot.pin[0], -spot.pin[1]);
  drawActor(ctx, spot.role, spot.box, { ...spot, ...o });
  ctx.restore();
}

// Runs fn with the drawing lined up with a room picture drawn by draw(ctx, p, x, y, {size})
// (so spots measured in the room picture land in the right place)
function inPicture(ctx, p, x, y, size, fn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.translate(-p.cx, -p.cy);
  fn();
  ctx.restore();
}

// "darker" in draw()'s units (-100..0) and a shade together (both darken)
const addShade = (shade, bright) => 1 - (1 - (shade || 0)) * (1 - Math.max(0, -(bright || 0)) / 100);

/* ---------------------------------------------------------------------
   Character spots that are not in a room (the old pictures' pins and boxes)
   --------------------------------------------------------------------- */
const EXTRA_SPOTS = {
  // in the office
  bb:      { role: "bb", pin: [141, 180], box: [40, 20, 250, 345], mode: "body", shade: 0.35 },
  mangle:  { role: "mangle", pin: [205, 108], box: [60, -120, 300, 200], mode: "body", rot: 168, shade: 0.45, kind: "lunge" },
  golden:  { role: "golden", pin: [180, 180], box: [40, 40, 320, 340], mode: "body", rot: -12, shade: 0.5 },
  shadow:  { role: "shadow", pin: [84, 180], box: [10, 20, 158, 360], mode: "body", tint: true },
  tbonnie: { role: "tbonnie", pin: [75, 104], box: [-20, 10, 170, 150], mode: "head", rot: -8, shade: 0.4, kind: "lunge" },
  bbEyes:  { role: "bb", pin: [83, 69], box: [10, 10, 156, 130], mode: "head", shade: 0.7 },
};
// custom night prizes that are characters (little plushies on the desk)
const PLUSH_ROLE = { Sprite58: "bb", Sprite59: "wbonnie", Sprite60: "wchica", Sprite62: "foxy",
                     Sprite63: "wfreddy", Sprite64: "golden", Sprite66: "tbonnie" };
const PLUSH_SPOT = { pin: [60, 85], box: [10, 10, 110, 165], mode: "body", shade: 0.3, still: true };
// custom night portraits
const HEAD_SPOT = { pin: [40, 35], box: [4, 4, 76, 66], mode: "head", still: true };      // (no idle animation here)
// title screen faces (Toy Eddy staring, and the old ones for a split second)
const TITLE_FACES = [
  { role: "tfreddy", box: [250, 30, 520, 330], shade: 0.5, rot: -3 },
  { role: "wfreddy", box: [240, 20, 530, 340], shade: 0.45, rot: -6 },
  { role: "wbonnie", box: [250, -10, 520, 330], shade: 0.45, rot: -6 },
  { role: "wchica", box: [240, 20, 530, 340], shade: 0.45, rot: -6 },
];
// jumpscares: how many steps the lunge takes
const SCARE_FRAMES = who => (Actors.hasScare(who) ? Math.ceil(Actors.scareLength(who) * 15) + 6
  : who === "golden" ? 1 : 9);

// A 3D jumpscare (the model's own Scare animation), drawn live over the dark office
function drawScare3D(ctx, who, i) {
  const t = i / 15, len = Actors.scareLength(who);
  ctx.save();
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 480, 360);
  const office = pic("Office", "000");
  if (office && office.img) ctx.drawImage(office.img, -60, 0, 600, 360);
  ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, 480, 360);
  // the screen shakes harder as it reaches you
  const k = Math.min(1, t / Math.max(0.1, len)), sh = 2 + 9 * k * k;
  ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  ctx.drawImage(Actors.scareFrame(who, t), -8, -6, 496, 372);
  if (faceOff(who, "scare")) { ctx.translate(-8, -6); ctx.scale(496 / SCARE_W, 372 / SCARE_H); drawRedaction(ctx, Actors.scareFace); }
  ctx.restore();
}

// One jumpscare step: the character lunging at you in the dark office
function drawScare(ctx, who, i) {
  if (Actors.hasScare(who)) return drawScare3D(ctx, who, i);
  const frames = SCARE_FRAMES(who);
  const k = Math.min(1, i / Math.max(1, frames - 1));
  const u = k * k * (3 - 2 * k);                       // smooth start and stop
  const jit = Math.sin(i * 2.7) * 6 * u;
  const hh = who === "golden" ? 330 : 120 + 260 * u;
  const hy = who === "puppet" ? 300 - 120 * u : 190 - 20 * u;
  ctx.save();
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 480, 360);
  const office = pic("Office", "000");
  if (office && office.img) ctx.drawImage(office.img, -60, 0, 600, 360);
  ctx.fillStyle = `rgba(0,0,0,${0.35 + 0.25 * u})`; ctx.fillRect(0, 0, 480, 360);
  drawActor(ctx, who, [240 + jit - hh / 2, hy - hh / 2, 240 + jit + hh / 2, hy + hh / 2],
    { mode: "head", kind: "lunge", rot: Math.sin(i * 1.9) * 7 * u, shade: 0.18 });
  ctx.restore();
}
