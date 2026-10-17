/* =====================================================================
   WHERE THE CHARACTERS STAND  (written by tools/tape2/cast.py: edit the
   tables there and rebuild, this file is made again)

   Every spot a character can be seen, measured by hand from where the
   FNaF character stood in the original pictures. The game draws the
   character there (its 3D model from the models folder, or its 2D
   drawing) on top of the empty room. See actors.js.

   box    [left, top, right, bottom] in the room picture (its own pixels,
          0,0 = the picture's top-left corner)
   mode   "body": the whole character fits the box (feet at the bottom)
          "head": the head fills the box (close-ups, vents, posters)
   shade  how dark the character is there (0 = full light, 0.9 = almost black)
   role   who it is (when the spot's name is not the role)
   rot    turned this many degrees
   cut    only drawn inside [left, top, width, height]
   same   looks the same with and without the camera flashlight
   kind   "lunge" = reaching for you (otherwise standing)
   ===================================================================== */
"use strict";

// camera number -> spot -> where (spot = the role, unless it says role:)
const CAM_POSES = {
  1: {
    wbonnie: {box: [55, 75, 150, 350], mode: "body", shade: 0.48},
    tchica: {box: [45, 125, 170, 300], mode: "body", shade: 0.09},
  },
  2: {
    wchica: {box: [132.5, 15, 277.5, 210], mode: "head", shade: 0.34},
    tbonnie: {box: [320, 75, 415, 210], mode: "body", shade: 0},
  },
  3: {
    wfreddy: {box: [85, 60, 385, 360], mode: "head", shade: 0.55},
    tbonnie: {box: [175, 30, 265, 220], mode: "body", shade: 0.27},
  },
  4: {
    tbonnie: {box: [100, -30, 370, 290], mode: "head", shade: 0.28},
    wchica: {box: [190, 85, 320, 275], mode: "body", shade: 0.17},
    tchica: {box: [160, 65, 235, 250], mode: "body", shade: 0},
  },
  5: {
    wbonnie: {box: [150, 50, 325, 280], mode: "head", shade: 0.34},
    tchica: {box: [140, 95, 260, 250], mode: "head", shade: 0},
    bb: {box: [135, 90, 310, 280], mode: "head", shade: 0},
    endo: {box: [135, 145, 350, 280], mode: "head", shade: 0.39},
  },
  6: {
    tbonnie: {box: [220, 90, 405, 250], mode: "head", shade: 0},
    mangle: {box: [200, 95, 395, 295], mode: "head", shade: 0},
    wchica: {box: [190, 85, 380, 350], mode: "head", shade: 0.21},
  },
  7: {
    tchica: {box: [102.5, 75, 187.5, 165], mode: "head", shade: 0.38},
    wbonnie: {box: [180, 67.5, 220, 150], mode: "body", shade: 0.62},
    wfreddy: {box: [215, 62.5, 260, 225], mode: "body", shade: 0.41},
    puppetwalk1: {box: [195, 2.5, 280, 225], mode: "body", shade: 0.6, role: "puppet", same: true},
    puppetwalk2: {box: [185, 30, 310, 180], mode: "head", shade: 0.21, role: "puppet", same: true},
    puppetwalk3: {box: [155, 20, 325, 200], mode: "head", shade: 0.33, role: "puppet", same: true},
    mangle: {box: [102.5, 75, 187.5, 165], mode: "head", shade: 0.38},
  },
  8: {
    wchica: {box: [60, 50, 165, 180], mode: "body", shade: 0.31},
    wbonnie: {box: [85, -10, 165, 170], mode: "body", shade: 0.17},
    foxy: {box: [200, 10, 285, 225], mode: "body", shade: 0.13},
    wfreddy: {box: [275, 85, 325, 150], mode: "head", shade: 0.13},
    shadow: {box: [115, 15, 260, 165], mode: "body", shade: 0.05, same: true, tint: true},
  },
  9: {
    tbonnie: {box: [85, 20, 185, 235], mode: "body", shade: 0.28},
    tfreddy: {box: [190, 5, 310, 240], mode: "body", shade: 0.24},
    tchica: {box: [315, 20, 420, 235], mode: "body", shade: 0.38},
  },
  10: {
    bb: {box: [45, 85, 140, 225], mode: "body", shade: 0.31},
    tfreddy: {box: [145, 65, 195, 172.5], mode: "body", shade: 0},
    mangle: {box: [145, 65, 195, 172.5], mode: "body", shade: 0},
  },
  11: {
    puppet1: {box: [302.5, 75, 342.5, 165], mode: "body", shade: 0.5, role: "puppet", cut: [0, 0, 480, 129], same: true},
    puppet2: {box: [295, 62.5, 345, 165], mode: "body", shade: 0.51, role: "puppet", cut: [0, 0, 480, 129], same: true},
    puppet3: {box: [280, 47.5, 350, 210], mode: "body", shade: 0.59, role: "puppet", same: true},
    endo: {box: [265, 0, 380, 230], mode: "body", shade: 0.54, same: true},
  },
  12: {
    mangle: {box: [225, 70, 355, 165], mode: "body", shade: 0.14, rot: -75},
  },
};

// the office: hall-<who> (hall light), ventL- / ventR-<who> (vent lights), in-<who> (in the office)
const OFFICE_POSES = {
  "hall-wfreddy": {box: [214.5, 75, 261.5, 228.5], mode: "body", shade: 0.27},
  "hall-foxy": {box: [215, 75, 265, 210], mode: "body", shade: 0.27},
  "hall-tfreddy": {box: [230, 70, 280, 225], mode: "body", shade: 0.28},
  "hall-tchica": {box: [225, 80, 265, 167.5], mode: "body", shade: 0.02},
  "hall-wbonnie": {box: [230, 75, 270, 225], mode: "body", shade: 0.31},
  "hall-mangle": {box: [235, 70, 280, 165], mode: "body", shade: 0.02},
  "hall-golden": {box: [210, 75, 280, 145], mode: "head", shade: 0.35},
  "ventL-tchica": {box: [17.5, 140, 57.5, 185], mode: "head", shade: 0.62, cut: [10, 140, 57.5, 90]},
  "ventL-bb": {box: [15, 147.5, 52.5, 192.5], mode: "head", shade: 0.7, cut: [10, 140, 57.5, 90]},
  "ventL-wbonnie": {box: [15, 135, 57.5, 187.5], mode: "head", shade: 0.64, cut: [10, 140, 57.5, 90]},
  "ventL-endo": {box: [12.5, 150, 57.5, 195], mode: "head", shade: 0.74, cut: [10, 140, 57.5, 90]},
  "ventR-tbonnie": {box: [420, 140, 465, 190], mode: "head", shade: 0.73, cut: [412.5, 135, 57.5, 95]},
  "ventR-mangle": {box: [422.5, 142.5, 465, 200], mode: "head", shade: 0.7, cut: [412.5, 135, 57.5, 95]},
  "ventR-wchica": {box: [417.5, 137.5, 467.5, 192.5], mode: "head", shade: 0.75, cut: [412.5, 135, 57.5, 95]},
  "in-wchica": {box: [180, 0, 300, 235], mode: "body", shade: 0.53, kind: "lunge"},
  "in-wbonnie": {box: [190, -15, 280, 230], mode: "body", shade: 0.66, kind: "lunge"},
  "in-tfreddy": {box: [250, 0, 390, 235], mode: "body", shade: 0.58, kind: "lunge"},
  "in-wfreddy": {box: [165, 0, 350, 235], mode: "body", shade: 0.57, kind: "lunge"},
  "in-tchica": {box: [190, 10, 290, 235], mode: "body", shade: 0.55, kind: "lunge"},
  "in-tbonnie": {box: [190, -5, 290, 235], mode: "body", shade: 0.66, kind: "lunge"},
};

// posters, paper plates and plushies in the rooms ("office" or the camera number);
// in a dark room the game makes them darker
const ROOM_COVERS = {
  "office": [
    {role: "tfreddy", box: [14.56, 44.85, 62.44, 81.15], mode: "head", shade: 0.35, cut: [7, 30, 63, 82.5]},
  ],
  "1": [
    {role: "tbonnie", box: [76.6, 85.3, 118.4, 122.7], mode: "head", shade: 0.35, cut: [70, 70, 165, 85]},
    {role: "tfreddy", box: [131.6, 85.3, 173.4, 122.7], mode: "head", shade: 0.35, cut: [70, 70, 165, 85]},
    {role: "tchica", box: [186.6, 85.3, 228.4, 122.7], mode: "head", shade: 0.35, cut: [70, 70, 165, 85]},
  ],
  "3": [
    {role: "tbonnie", box: [253.36, 54.53, 274.64, 80.27], mode: "head", shade: 0.35, cut: [250, 44, 84, 58.5]},
    {role: "tfreddy", box: [281.36, 54.53, 302.64, 80.27], mode: "head", shade: 0.35, cut: [250, 44, 84, 58.5]},
    {role: "tchica", box: [309.36, 54.53, 330.64, 80.27], mode: "head", shade: 0.35, cut: [250, 44, 84, 58.5]},
  ],
  "4": [
    {role: "tbonnie", box: [283.5, 76, 321.5, 125], mode: "head", shade: 0.3, cut: [277.5, 70, 50, 61]},
    {role: "tfreddy", box: [346, 96, 386.5, 144], mode: "head", shade: 0.3, cut: [340, 90, 52.5, 60]},
  ],
  "7": [
    {role: "tbonnie", box: [8.4, 82.4, 61.6, 161.6], mode: "head", shade: 0.35, cut: [0, 50, 70, 180]},
    {role: "tchica", box: [79.08, 64.7, 104.92, 137.3], mode: "head", shade: 0.35, cut: [75, 35, 34, 165]},
    {role: "tfreddy", box: [428.08, 83.4, 472.92, 140.6], mode: "head", shade: 0.35, cut: [421, 60, 59, 130]},
  ],
  "11": [
    {role: "tbonnie", box: [184.96, 30.8, 210.04, 57.2], mode: "head", shade: 0.35, cut: [181, 20, 99, 60]},
    {role: "tfreddy", box: [217.96, 30.8, 243.04, 57.2], mode: "head", shade: 0.35, cut: [181, 20, 99, 60]},
    {role: "tchica", box: [250.96, 30.8, 276.04, 57.2], mode: "head", shade: 0.35, cut: [181, 20, 99, 60]},
    {role: "tchica", box: [36, 35, 82.5, 85], mode: "body", shade: 0.55},
    {role: "tfreddy", box: [131, 114, 167.5, 150], mode: "body", shade: 0.55},
  ],
};
