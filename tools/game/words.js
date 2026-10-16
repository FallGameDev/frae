/* =====================================================================
   WORDS ON PICTURES
   Real text drawn on top of some pictures (menus, clock, camera buttons,
   the secret song lyrics...). Mods can change any of it in texts.json.
   box: the picture's [width, height, pin x, pin y]; each word has its
   font, color and where it sits in the picture. Made by tools/flatten.py.
   ===================================================================== */
"use strict";

const PICTURE_WORDS = {
  "FNaF text/text": { box: [143, 217, 95.5, 140], words: [
    {"text": "Fried", "font": "Sans Serif", "color": "#ffffff", "box": [2, 0, 123, 43.5]},
    {"text": "Rice", "font": "Sans Serif", "color": "#ffffff", "box": [2, 64, 100, 41.5]},
    {"text": "at", "font": "Sans Serif", "color": "#fafafa", "box": [0, 120, 49.5, 37]},
    {"text": "Eddies", "font": "Sans Serif", "color": "#ffffff", "box": [1, 179, 142, 38]},
  ] },
  "continue/text": { box: [204, 34, 102, 17], words: [
    {"text": "Continue", "font": "Share Tech Mono", "color": "#ffffff", "box": [0, 0, 204, 34]},
  ] },
  "6th Night/string": { box: [422, 60.8, 115.5, 26], words: [
    {"text": "Spooky", "font": "Share Tech Mono", "color": "#ffffff", "box": [2.000000000000014, 8, 167, 33], "like": ["New Game", 33], "align": "left"},
  ] },
  "Custom Night/string": { box: [422.265, 68.55, 153.265, 33.005], words: [
    {"text": "It's already dark.", "font": "Share Tech Mono", "color": "#ffffff", "box": [2.265, 15.75, 307.5, 33], "like": ["New Game", 33], "align": "left"},
  ] },
  "selection/arrows": { box: [43, 26, 21, 13], words: [
    {"text": ">>", "font": "Sans Serif", "color": "#ffffff", "box": [0, 0, 43, 26]},
  ] },
  "Backdrop/mike stuffed": { box: [564.451, 270, 282.225, 135], words: [
    {"text": "Game Over", "font": "Sans Serif", "color": "#ffffff", "tm": [1, 0, 0, 1, 396.22502, 262.01], "size": 22, "pos": [0, 0]},
  ] },
  "Backdrop/beat5": { box: [530.562, 270, 265.281, 135], words: [
    {"text": "Good Job Sport!", "font": "Sans Serif", "color": "#fffffd", "tm": [0.5, 0, 0, 0.5, 195.46846, 41.53016], "size": 40, "pos": [0, 0]},
    {"text": "See you next week!", "font": "Sans Serif", "color": "#fffffd", "tm": [0.5, 0, 0, 0.5, 178.79847, 242.84982], "size": 40, "pos": [0, 0]},
    {"text": "Mike Wazowski", "font": "Sans Serif", "color": "#000000", "tm": [0.37398, 0.04271, -0.04109, 0.38872, 157.54338, 84.19367], "size": 40, "pos": [0, 0]},
    {"text": "1227 dollars", "font": "Sans Serif", "color": "#000000", "tm": [0.37399, 0.04271, -0.04109, 0.38872, 154.75993, 111.45944], "size": 40, "pos": [0, 0]},
    {"text": "All five nights", "font": "Sans Serif", "color": "#000000", "tm": [0.37399, 0.04271, -0.04109, 0.38872, 149.82334, 167.92626], "size": 40, "pos": [0, 0]},
  ] },
  "Backdrop/custom night": { box: [480, 308.019, 240, 173.019], words: [
    {"text": "left arrow for golden eddie! :D", "font": "Sans Serif", "color": "#ffffff", "at": [308.5, 12.478, 11.474], "group": "Custom night"},
    {"text": "Eddie", "font": "Sans Serif", "color": "#ffffff", "at": [57.931, 88.363, 20], "group": "Custom night"},
    {"text": "Weddy", "font": "Sans Serif", "color": "#ffffff", "at": [160.808, 88.363, 20], "group": "Custom night"},
    {"text": "Cheddy", "font": "Sans Serif", "color": "#ffffff", "at": [255.334, 88.363, 20], "group": "Custom night"},
    {"text": "???", "font": "Sans Serif", "color": "#ffffff", "at": [388.233, 87.333, 20], "group": "Custom night"},
    {"text": "Customize Night", "font": "Share Tech Mono", "color": "#ebebeb", "box": [168, 53, 144, 15], "group": "Custom night"},
    {"text": "A.I. Level", "font": "Share Tech Mono", "color": "#dcdcdc", "box": [50, 188, 74, 10], "group": "Custom night"},
    {"text": "A.I. Level", "font": "Share Tech Mono", "color": "#d2d2d2", "box": [152, 188, 75, 10], "group": "Custom night"},
    {"text": "A.I. Level", "font": "Share Tech Mono", "color": "#c8c8c8", "box": [255, 188, 74, 10], "group": "Custom night"},
    {"text": "A.I. Level", "font": "Share Tech Mono", "color": "#d8d8d8", "box": [357, 188, 74, 10], "group": "Custom night"},
    {"text": "(0-2)easy  (3-6)med  (7-12)hard (12+)extreme", "font": "Share Tech Mono", "color": "#c3c3c3", "box": [50, 289, 294, 10], "group": "Custom night"},
  ] },
  "Backdrop/beat6": { box: [530.563, 275, 260.282, 135], words: [
    {"text": "Good Job Sport!", "font": "Sans Serif", "color": "#fffffd", "tm": [0.5, 0, 0, 0.5, 195.46914, 46.53016], "size": 40, "pos": [0, 0]},
    {"text": "The end.", "font": "Sans Serif", "color": "#fffffd", "tm": [0.5, 0, 0, 0.5, 219.08161, 248.31369], "size": 40, "pos": [0, 0]},
    {"text": "Mike Wazowski", "font": "Sans Serif", "color": "#000000", "tm": [0.37399, 0.04271, -0.04109, 0.38872, 157.54407, 89.19367], "size": 40, "pos": [0, 0]},
    {"text": "1987 dollars", "font": "Sans Serif", "color": "#000000", "tm": [0.37399, 0.04271, -0.04109, 0.38872, 154.76061, 116.45944], "size": 40, "pos": [0, 0]},
    {"text": "Overtime Work", "font": "Sans Serif", "color": "#000000", "tm": [0.37399, 0.04271, -0.04109, 0.38872, 149.82402, 172.92626], "size": 40, "pos": [0, 0]},
  ] },
  "Backdrop/pink slip": { box: [530.563, 275, 260.282, 135], words: [
    {"text": "The end.", "font": "Sans Serif", "color": "#fffffd", "tm": [0.5, 0, 0, 0.5, 219.08162, 248.31369], "size": 40, "pos": [0, 0]},
    {"text": "Notice Of Termination (you're fired)", "font": "Sans Serif", "color": "#000000", "tm": [0.29594, -0.07591, 0.0814, 0.30664, 145.90983, 129.97713], "size": 40, "pos": [0, 0]},
    {"text": "Mike Wazowski", "font": "Sans Serif", "color": "#000000", "tm": [0.36462, -0.09352, 0.10029, 0.3778, 153.63472, 157.43624], "size": 40, "pos": [0, 0]},
    {"text": "Pampering with the Animatronics", "font": "Sans Serif", "color": "#000000", "tm": [0.36462, -0.09352, 0.10029, 0.3778, 161.51911, 220.82785], "size": 40, "pos": [0, 0]},
  ] },
  "Backdrop/NoJSFreddy": { box: [480, 270, 240, 135], words: [
    {"text": "NICE TRY!", "font": "Sans Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 192.5, 184.8], "size": 40, "pos": [0, 0]},
    {"text": "GAME OVER", "font": "Sans Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 361.5, 259.8], "size": 40, "pos": [0, 0]},
  ] },
  "Backdrop/NoJSBonnie": { box: [480, 270, 240, 135], words: [
    {"text": "NICE TRY!", "font": "Sans Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 192.5, 184.8], "size": 40, "pos": [0, 0]},
    {"text": "GAME OVER", "font": "Sans Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 361.5, 259.8], "size": 40, "pos": [0, 0]},
  ] },
  "Backdrop/NoJSChica": { box: [480, 270, 240, 135], words: [
    {"text": "NICE TRY!", "font": "Sans Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 192.5, 184.8], "size": 40, "pos": [0, 0]},
    {"text": "GAME OVER", "font": "Sans Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 361.5, 259.8], "size": 40, "pos": [0, 0]},
  ] },
  "Backdrop/NoJSFoxy": { box: [480, 270, 240, 135], words: [
    {"text": "NICE TRY!", "font": "Sans Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 192.5, 184.8], "size": 40, "pos": [0, 0]},
    {"text": "GAME OVER", "font": "Sans Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 361.5, 259.8], "size": 40, "pos": [0, 0]},
  ] },
  "what day/12:00AM 1 Night": { box: [227, 97, 113, 48], words: [
    {"text": "12:00 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [13, 0, 201, 31]},
    {"text": "1st Night", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 66, 227, 31]},
  ] },
  "what day/12:00AM 2 Night": { box: [231, 97, 115, 48], words: [
    {"text": "12:00 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [17, 0, 201, 31]},
    {"text": "2nd Night", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 66, 231, 31]},
  ] },
  "what day/12:00AM 3 Night": { box: [231, 97, 115, 48], words: [
    {"text": "12:00 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [17, 0, 201, 31]},
    {"text": "3rd Night", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 66, 231, 31]},
  ] },
  "what day/12:00AM 4 Night": { box: [231, 97, 115, 48], words: [
    {"text": "12:00 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [17, 0, 201, 31]},
    {"text": "4th Night", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 66, 231, 31]},
  ] },
  "what day/12:00AM 5 Night": { box: [231, 97, 115, 48], words: [
    {"text": "12:00 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [17, 0, 201, 31]},
    {"text": "5th Night", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 66, 231, 31]},
  ] },
  "what day/12:00AM 6 Night": { box: [253.5, 97, 136.5, 48], words: [
    {"text": "12:00 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [38.5, 0, 202, 31]},
    {"text": "Spooky Night", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 66, 253.5, 31]},
  ] },
  "what day/12:00AM 7 Night": { box: [240, 100, 120, 50], words: [
    {"text": "12:00 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [19, 0, 208, 32]},
    {"text": "7th Night", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 68, 240, 32]},
  ] },
  "left button panel/both off": { box: [14.272, 47.413, 232.299, 3.452], words: [
    {"text": "Door", "font": "Serif", "color": "#ffffff", "tm": [0.13317, 0, 0, 0.13317, 1.80638, 20.31974], "size": 40, "pos": [0, 0]},
    {"text": "Light", "font": "Serif", "color": "#ffffff", "tm": [0.13317, 0, 0, 0.13317, 2.04828, 41.60709], "size": 40, "pos": [0, 0]},
  ] },
  "right button panel/both off": { box: [53.587, 178.018, 25.273, 81.33], words: [
    {"text": "Door", "font": "Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 2.56651, 76.29357], "size": 40, "pos": [0, 0]},
    {"text": "Light", "font": "Serif", "color": "#ffffff", "tm": [0.5, 0, 0, 0.5, 3.47476, 156.22018], "size": 40, "pos": [0, 0]},
  ] },
  "Power Left %/text": { box: [199.5, 14, 68, 7], words: [
    {"text": "Power left:", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 137, 14]},
    {"text": "%", "font": "Press Start 2P", "color": "#ffffff", "box": [188.5, 0, 11, 14]},
  ] },
  "Usage word/text": { box: [72, 14, 36, 7], words: [
    {"text": "Usage:", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 72, 14]},
  ] },
  "Power 10/0": { box: [12, 16, 6, 8], words: [
    {"text": "0", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 10/1": { box: [8, 16, 4, 8], words: [
    {"text": "1", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 8, 16]},
  ] },
  "Power 10/2": { box: [12, 16, 6, 8], words: [
    {"text": "2", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 10/3": { box: [12, 16, 6, 8], words: [
    {"text": "3", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 10/4": { box: [12, 16, 6, 8], words: [
    {"text": "4", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 10/5": { box: [12, 16, 6, 8], words: [
    {"text": "5", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 10/6": { box: [12, 16, 6, 8], words: [
    {"text": "6", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 10/7": { box: [12, 16, 6, 8], words: [
    {"text": "7", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 10/8": { box: [12, 16, 6, 8], words: [
    {"text": "8", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 10/9": { box: [12, 16, 6, 8], words: [
    {"text": "9", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 01/0": { box: [12, 16, 6, 8], words: [
    {"text": "0", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 01/1": { box: [8, 16, 4, 8], words: [
    {"text": "1", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 8, 16]},
  ] },
  "Power 01/2": { box: [12, 16, 6, 8], words: [
    {"text": "2", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 01/3": { box: [12, 16, 6, 8], words: [
    {"text": "3", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 01/4": { box: [12, 16, 6, 8], words: [
    {"text": "4", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 01/5": { box: [12, 16, 6, 8], words: [
    {"text": "5", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 01/6": { box: [12, 16, 6, 8], words: [
    {"text": "6", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 01/7": { box: [12, 16, 6, 8], words: [
    {"text": "7", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 01/8": { box: [12, 16, 6, 8], words: [
    {"text": "8", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Power 01/9": { box: [12, 16, 6, 8], words: [
    {"text": "9", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "Phone Calls/mute bar": { box: [118.058, 168.933, 59.029, 84.466], words: [
    {"text": "Aidan", "font": "Sans Serif", "color": "#ffffff", "tm": [0.37248, 0, 0, 0.37248, 26.42045, 127.86619], "size": 40, "pos": [0, 0]},
    {"text": "Manager", "font": "Sans Serif", "color": "#ffffff", "tm": [0.37248, 0, 0, 0.37248, 26.42045, 127.86619], "size": 40, "pos": [0, 46.15]},
  ] },
  "time AM/text": { box: [42, 26, 21, 13], words: [
    {"text": "AM", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 42, 26]},
  ] },
  "time AM/12am": { box: [96.5, 28, 75.5, 15], words: [
    {"text": "12 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 96.5, 28]},
  ] },
  "time AM/1am": { box: [67.5, 28, 46.5, 15], words: [
    {"text": "1 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 67.5, 28]},
  ] },
  "time AM/2am": { box: [76.5, 27, 55.5, 14], words: [
    {"text": "2 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 76.5, 27]},
  ] },
  "time AM/3am": { box: [71.5, 28, 50.5, 15], words: [
    {"text": "3 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 71.5, 28]},
  ] },
  "time AM/4am": { box: [71.5, 28, 50.5, 15], words: [
    {"text": "4 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 71.5, 28]},
  ] },
  "time AM/5am": { box: [74, 28, 53, 15], words: [
    {"text": "5 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 74, 28]},
  ] },
  "time AM/6am": { box: [71.5, 28, 50.5, 15], words: [
    {"text": "6 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 71.5, 28]},
  ] },
  "night/text": { box: [63, 14, 31, 7], words: [
    {"text": "Night", "font": "Press Start 2P", "color": "#ffffff", "box": [0, 0, 63, 14]},
  ] },
  "night/string": { box: [63, 22, 31, 11], words: [
    {"text": "Night", "font": "Share Tech Mono", "color": "#ffffff", "box": [0, 0, 63, 22]},
  ] },
  "level/1": { box: [8, 16, 4, 8], words: [
    {"text": "1", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 8, 16]},
  ] },
  "level/2": { box: [12, 16, 6, 8], words: [
    {"text": "2", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "level/3": { box: [12, 16, 6, 8], words: [
    {"text": "3", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "level/4": { box: [12, 16, 6, 8], words: [
    {"text": "4", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "level/5": { box: [12, 16, 6, 8], words: [
    {"text": "5", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "level/6": { box: [12, 16, 6, 8], words: [
    {"text": "6", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "level/7": { box: [12, 16, 6, 8], words: [
    {"text": "7", "font": "Press Start 2P", "color": "#fffffe", "box": [0, 0, 12, 16]},
  ] },
  "CAM1A/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "1A", "font": "Press Start 2P", "color": "#ffffff", "box": [11, 21, 19, 12]},
  ] },
  "CAM1A/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "1A", "font": "Press Start 2P", "color": "#ffffff", "box": [11, 21, 19, 12]},
  ] },
  "CAM0/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "0", "font": "Press Start 2P", "color": "#ffffff", "box": [9.5, 22, 9, 12.5]},
  ] },
  "CAM0/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "0", "font": "Press Start 2P", "color": "#ffffff", "box": [9.5, 22, 9, 12.5]},
  ] },
  "CAM1B/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "1B", "font": "Press Start 2P", "color": "#ffffff", "box": [11, 21, 19, 12]},
  ] },
  "CAM1B/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "1B", "font": "Press Start 2P", "color": "#ffffff", "box": [11, 21, 19, 12]},
  ] },
  "CAM1C/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "1C", "font": "Press Start 2P", "color": "#ffffff", "box": [11, 21, 19, 12]},
  ] },
  "CAM1C/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "1C", "font": "Press Start 2P", "color": "#ffffff", "box": [11, 21, 19, 12]},
  ] },
  "new game/text": { box: [207, 36, 102.5, 17], words: [
    {"text": "New Game", "font": "Share Tech Mono", "color": "#fcfcfc", "box": [1.5, 1, 203, 33]},
  ] },
  "CAM2A/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "2A", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 20, 12]},
  ] },
  "CAM2A/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "2A", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 20, 12]},
  ] },
  "CAM2B/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "2B", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 20, 12]},
  ] },
  "CAM2B/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "2B", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 20, 12]},
  ] },
  "CAM3/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "3", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 9, 12]},
  ] },
  "CAM3/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "3", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 9, 12]},
  ] },
  "CAM4A/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "4A", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 20, 12]},
  ] },
  "CAM4A/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "4A", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 20, 12]},
  ] },
  "CAM4B/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "4B", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 20, 12]},
  ] },
  "CAM4B/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "4B", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 20, 12]},
  ] },
  "CAM5/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "5", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 9, 12]},
  ] },
  "CAM5/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "5", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 9, 12]},
  ] },
  "CAM6/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "6", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 9, 12]},
  ] },
  "CAM6/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "6", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 9, 12]},
  ] },
  "CAM7/Inactive": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31, 12]},
    {"text": "7", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 9, 12]},
  ] },
  "CAM7/Active": { box: [60, 40, 30, 20], words: [
    {"text": "CAM", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 8, 31.5, 12]},
    {"text": "7", "font": "Press Start 2P", "color": "#ffffff", "box": [10, 21, 9, 12]},
  ] },
  "6am back/slide": { box: [42, 68, 24, 30], words: [
    {"text": "5", "font": "Press Start 2P", "color": "#fffffe", "box": [13.5, 0, 21, 28]},
    {"text": "6", "font": "Press Start 2P", "color": "#fffffe", "box": [13.5, 38, 21, 28]},
  ] },
  "6am fore/am5": { box: [480, 360, 240, 180], words: [
    {"text": "5 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [209.5, 166, 71.5, 28]},
  ] },
  "6am fore/am": { box: [480, 360, 240, 180], words: [
    {"text": "AM", "font": "Press Start 2P", "color": "#ffffff", "box": [239, 166.5, 42, 26]},
  ] },
  "6am fore/am6": { box: [480, 360, 240, 180], words: [
    {"text": "6 AM", "font": "Press Start 2P", "color": "#ffffff", "box": [210, 166, 71, 28]},
  ] },
  "hallucinations/It's Me1": { box: [480, 270, 240, 135], words: [
    {"text": "IT'S ME", "font": "Courier Prime", "color": "#ffffff", "box": [66, 52, 242, 41]},
  ] },
  "hallucinations/It's Me2": { box: [480, 270, 240, 135], words: [
    {"text": "IT'S ME", "font": "Courier Prime", "color": "#ffffff", "box": [163, 144, 242, 41]},
  ] },
  "Custom10/1": { box: [35, 75, 17, 37], words: [
    {"text": "1", "font": "Sans Serif", "color": "#fffffe", "box": [4, 18, 28, 41]},
  ] },
  "Custom10/2": { box: [35, 75, 17, 37], words: [
    {"text": "2", "font": "Sans Serif", "color": "#fffffe", "box": [4, 17, 28, 42]},
  ] },
  "Custom01/0": { box: [35, 75, 17, 37], words: [
    {"text": "0", "font": "Sans Serif", "color": "#fffffe", "box": [2, 17, 32, 43]},
  ] },
  "Custom01/1": { box: [35, 75, 17, 37], words: [
    {"text": "1", "font": "Sans Serif", "color": "#fffffe", "box": [4, 18, 28, 41]},
  ] },
  "Custom01/2": { box: [35, 75, 17, 37], words: [
    {"text": "2", "font": "Sans Serif", "color": "#fffffe", "box": [4, 17, 28, 42]},
  ] },
  "Custom01/3": { box: [35, 75, 17, 37], words: [
    {"text": "3", "font": "Sans Serif", "color": "#fffffe", "box": [4, 17, 27, 43]},
  ] },
  "Custom01/4": { box: [35, 75, 17, 37], words: [
    {"text": "4", "font": "Sans Serif", "color": "#fffffe", "box": [1, 18, 33, 41]},
  ] },
  "Custom01/5": { box: [35, 75, 17, 37], words: [
    {"text": "5", "font": "Sans Serif", "color": "#fffffe", "box": [5, 18, 26, 42]},
  ] },
  "Custom01/6": { box: [35, 75, 17, 37], words: [
    {"text": "6", "font": "Sans Serif", "color": "#fffffe", "box": [3, 18, 30, 42]},
  ] },
  "Custom01/7": { box: [35, 75, 17, 37], words: [
    {"text": "7", "font": "Sans Serif", "color": "#fffffe", "box": [3, 18, 28, 41]},
  ] },
  "Custom01/8": { box: [35, 75, 17, 37], words: [
    {"text": "8", "font": "Sans Serif", "color": "#fffffe", "box": [3, 17, 29, 43]},
  ] },
  "Custom01/9": { box: [35, 75, 17, 37], words: [
    {"text": "9", "font": "Sans Serif", "color": "#fffffe", "box": [2, 17, 30, 42]},
  ] },
  "Ready/active": { box: [186, 58, 93, 29], words: [
    {"text": "READY", "font": "Sans Serif", "color": "#ffffff", "box": [9, 9, 170, 41]},
  ] },
  "SettingsButton/Deselected": { box: [480, 122.5, 240, 61.25], words: [
    {"text": "Settings", "font": "Share Tech Mono", "color": "#ffffff", "box": [6, 14, 465, 98]},
  ] },
  "SettingsButton/Selected": { box: [480, 123, 240, 61.5], words: [
    {"text": "Settings", "font": "Share Tech Mono", "color": "#ffffff", "box": [10.5, 14, 459, 98]},
  ] },
  "Secret??//Title/costume1": { box: [100, 152, 187.399, 164.126], words: [
    {"text": "Fried", "font": "Sans Serif", "color": "#ffffff", "box": [4, 10, 70, 24.5]},
    {"text": "Rice", "font": "Sans Serif", "color": "#ffffff", "box": [4, 46.5, 57, 24]},
    {"text": "At", "font": "Sans Serif", "color": "#ffffff", "box": [1, 83.5, 32, 23]},
    {"text": "Eddies", "font": "Sans Serif", "color": "#ffffff", "box": [4, 118, 93.5, 24.5]},
  ] },
  "Secret??//New/continue/costume1": { box: [165, 82, 208.451, -32.835], words: [
    {"text": ">>", "font": "Sans Serif", "color": "#ffffff", "box": [0, 14, 19, 14.5]},
    {"text": "Dine In", "font": "Sans Serif", "color": "#ffffff", "box": [26, 9.5, 91, 21]},
    {"text": "Take Away", "font": "Sans Serif", "color": "#ffffff", "box": [24.5, 53, 139, 27.5]},
  ] },
  "Secret??//New/continue/costume2": { box: [164, 82, 208.451, -32.646], words: [
    {"text": "Dine In", "font": "Sans Serif", "color": "#ffffff", "box": [26, 9.5, 91, 21]},
    {"text": ">>", "font": "Sans Serif", "color": "#ffffff", "box": [0, 57.5, 19, 15]},
    {"text": "Take Away", "font": "Sans Serif", "color": "#ffffff", "box": [24.5, 53, 139, 27.5]},
  ] },
  "Secret??//Lyrics/costume1": { box: [292, 50, 129.546, 29.516], words: [
    {"text": "were cooking every night", "font": "Pixel", "color": "#ffffff", "box": [0.5, 7.5, 253, 19]},
    {"text": "up bowls of such delicous rice", "font": "Pixel", "color": "#ffffff", "box": [0.5, 29.5, 289, 19]},
  ] },
  "Secret??//Lyrics/costume2": { box: [354, 54, 190.117, 31.365], words: [
    {"text": "newcomers can eat with us", "font": "Pixel", "color": "#ffffff", "box": [46.5, 7.5, 281.5, 18]},
    {"text": "you could dine in or get takeaway", "font": "Pixel", "color": "#ffffff", "box": [0.5, 31, 350.5, 20.5]},
  ] },
  "Secret??//Lyrics/costume3": { box: [379, 178, 186.408, 138.308], words: [
    {"text": "We could do brown or white", "font": "Pixel", "color": "#ffffff", "box": [49, 113, 264.5, 16.5]},
    {"text": "we've been frying rice all of our lives", "font": "Pixel", "color": "#ffffff", "box": [0.5, 135, 370.5, 19]},
  ] },
  "Secret??//Lyrics/costume4": { box: [357, 50, 156.045, 29.519], words: [
    {"text": "No imposter's stealing recipes", "font": "Pixel", "color": "#fbfbfb", "box": [0.5, 7.5, 303.5, 19]},
    {"text": "but its just rice ain't hard to make", "font": "Pixel", "color": "#fbfbfb", "box": [5.5, 29.5, 349, 19]},
  ] },
  "Secret??//Lyrics/costume5": { box: [316, 94, 157.971, 51.478], words: [
    {"text": "Please let us  in!", "font": "Pixel", "color": "#ffffff", "box": [58, 7.5, 158.5, 16.5]},
    {"text": "thats what our customers say", "font": "Pixel", "color": "#ffffff", "box": [0, 51.5, 308, 19]},
    {"text": "they want that door open", "font": "Pixel", "color": "#ffffff", "box": [0, 73.5, 260, 19]},
  ] },
  "Secret??//Lyrics/costume6": { box: [516, 128, 304.669, 95.597], words: [
    {"text": "They Are poor little souls", "font": "Pixel", "color": "#ffffff", "box": [178.5, 62.5, 257.5, 19]},
    {"text": "who eat out of our bowls", "font": "Pixel", "color": "#ffffff", "box": [159, 84.5, 248, 16.5]},
    {"text": "and were forced to feed em till there full", "font": "Pixel", "color": "#ffffff", "box": [101.5, 106.5, 411.5, 16.5]},
  ] },
  "Secret??//Lyrics/costume7": { box: [562, 72, 328.118, 41.336], words: [
    {"text": "We've been frying no fails", "font": "Pixel", "color": "#ffffff", "box": [238.5, 7.5, 257.5, 19]},
    {"text": "located in south wales", "font": "Pixel", "color": "#ffffff", "box": [267.5, 29.5, 219, 16.5]},
    {"text": "this is eddies home and heaven", "font": "Pixel", "color": "#ffffff", "box": [157, 51.5, 305.5, 16.5]},
  ] },
  "Secret??//Lyrics/costume8": { box: [311, 72, 191.604, 40.498], words: [
    {"text": "Join us, be our friend", "font": "Pixel", "color": "#ffffff", "box": [82, 7.5, 214, 19]},
    {"text": "we be so glad you attend", "font": "Pixel", "color": "#ffffff", "box": [58, 29.5, 245.5, 19]},
    {"text": "after all you only got", "font": "Pixel", "color": "#ffffff", "box": [62.5, 51.5, 212, 19]},
  ] },
  "Secret??//Lyrics/costume9": { box: [296, 55, 148.25, 37.539], words: [
    {"text": "Fried Rice at Eddies", "font": "Pixel", "color": "#ffffff", "box": [26.5, 7.5, 195, 16.5]},
    {"text": "Is this where you want to be", "font": "Pixel", "color": "#ffffff", "box": [0.5, 32.5, 292.5, 20]},
  ] },
  "Secret??//Lyrics/costume10": { box: [271, 55, 128.25, 38.319], words: [
    {"text": "you wont regret it", "font": "Pixel", "color": "#ffffff", "box": [40.5, 7.5, 187.5, 19]},
    {"text": "what would you wanna eat", "font": "Pixel", "color": "#ffffff", "box": [0.5, 33, 267.5, 20]},
  ] },
  "Secret??//Lyrics/costume12": { box: [200, 29, 121.85, 18.319], words: [
    {"text": "Fried Rice At Eddies", "font": "Pixel", "color": "#ffffff", "box": [0, 7.5, 197.5, 16.5]},
  ] },
  "dine in/text": { box: [426.134, 54.05, 65.206, 17.463], words: [
    {"text": "Dine In", "font": "Share Tech Mono", "color": "#ffffff", "box": [6.134, 1.25, 118.5, 33], "like": ["New Game", 33], "align": "left"},
  ] },
};
