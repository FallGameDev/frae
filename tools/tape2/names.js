/* =====================================================================
   PICTURES AND SOUNDS
   Every picture is the file assets/img/<group>/<name>.webp and every sound
   is assets/snd/<group>/<name>.mp3 (names written in lower case with
   dashes, see fileName in pictures.js). This list says which ones exist,
   in order (picAt(group, 3) is the third picture of a group).
   Made by tools/flatten.py.
   ===================================================================== */
"use strict";

const PICTURE_NAMES = {
  "Light Left": ["0", "1"],
  "Right Right": ["0", "1"],
  "Sprite1": ["95"],
  "Sprite2": ["119"],
  "Sprite3": ["88"],
  "Sprite4": ["0", "1", "2", "3", "4", "5"],
  "Sprite5": ["114", "97", "116", "99", "103", "104", "105", "106", "110", "112", "113", "none"],
  "Wind up": ["Wind up0", "Wind up1"],
  "Sprite7": ["REDALERT!", "Normal alert"],
  "Sprite12": ["1", "2", "3", "4", "0"],
  "Sprite29": ["Gold_Star"],
  "Sprite45": ["give cake", "foxy GET READY", "foxy GO! GO! GO!", "foxy blank", "foxy stage", "foxy stage2"],
  "Sprite47": ["CakeChildSprite-0", "CakeChildSprite-1", "CakeChildSprite-2", "CakeChildSprite-3", "CakeChildIrritatedSprite-0", "CakeChildIrritatedSprite-1", "CakeChildIrritatedSprite-2", "CakeChildIrritatedSprite-3", "CakeChildIrritatedSprite-4", "CakeChildIrritatedSprite-5"],
  "Sprite53": ["CakeChildCryingDying-0", "CakeChildCryingDying-1", "CakeChildCryingDying-4", "CakeChildCryingDying-6", "CakeChildCryingDying-8", "CakeChildCryingDying-11", "CakeChildCryingDying-12", "CakeChildCryingDying-13", "CakeChildCryingDying-14", "CakeChildCryingDying-16"],
  "Sprite54": ["Purple_Car"],
  "Sprite67": ["costume1"],
  "Sprite69": ["GiveThemLifeEndo", "GiveThemLifeEndo2"],
  "Sprite75": ["ConfettiBurst-0", "ConfettiBurst-1", "ConfettiBurst-2", "ConfettiBurst-3", "ConfettiBurst-4", "ConfettiBurst-5", "ConfettiBurst-6", "ConfettiBurst-7"],
  "Office": ["000", "010", "100", "001"],
  "Cam1": ["dark", "light"],
  "Cam2": ["dark", "light"],
  "Cam3": ["dark", "light"],
  "Cam4": ["dark", "light"],
  "Cam5": ["dark", "light"],
  "Cam6": ["dark", "light"],
  "Cam7": ["dark", "light"],
  "Cam8": ["dark", "light"],
  "Cam9": ["dark", "light"],
  "Cam10": ["dark", "light"],
  "Cam11": ["dark", "light"],
  "Cam12": ["dark", "light"],
  "Chars": ["tfreddy", "tbonnie", "tchica", "wfreddy", "wbonnie", "wchica", "foxy", "mangle", "golden", "endo", "shadow", "bb", "puppet"],
  "Plush": ["Sprite61", "Sprite65"],
  "Custom": ["star"],
  "Riceria": ["crying"],
  "Loading": ["icon"],
  "Pixel": ["wfreddy", "head-wfreddy", "foxy", "head-foxy", "puppet", "head-puppet", "wbonnie", "head-wbonnie", "wchica", "head-wchica", "tfreddy", "head-tfreddy", "runner"],
  "Map": ["map", "lit1", "lit2", "lit3", "lit4", "lit5", "lit6", "lit7", "lit8", "lit9", "lit10", "lit11", "lit12"],
};

const SOUND_NAMES = {
  "Stage": ["Ambient"],
  "Light Left": ["ComputerInteriorLong_EVL02_2"],
  "Sprite3": ["deepbreaths"],
  "Sprite4": ["mask.show", "mask.hide"],
  "Sprite5": ["Cam Up", "Cam down"],
  "Mangle": ["elec garble"],
  "The office": ["buzzlight"],
  "Party 01": ["With_S3"],
  "Left Vent": ["ventwalk1", "ventwalk2"],
  "Wind up": ["windup2"],
  "Sprite6": ["Music_Box_Melody_Playful"],
  "Sprite10": ["Change camera", "COMPUTER_DIGITAL_L2076605", "ComputerInteriorLong_EVL02_14"],
  "Sprite11": ["call 1b", "call 2b", "call 3b", "call 4b", "call 5b", "call 6b"],
  "Fansound": ["Fake", "Fake1", "fansound"],
  "Ambience": ["Chimes", "CROWD_SMALL_CHIL_EC049202"],
  "BB": ["Hello?", "Hi!", "Laugh"],
  "Sprite16": ["ambience2"],
  "Sprite17": ["machineturn2"],
  "Sprite19": ["FNAF 2 - Win Music-Lullaby Waltz (End Of The Game).mp3"],
  "BB in the office": ["echo4b"],
  "Sprite28": ["After Death"],
  "Sprite45": ["During mini game.mp3"],
  "Sprite21": ["PartyFavorraspyPart_AC01__3", "recording1"],
  "Sprite27": ["Xscream2", "After Death", "jackinthebox"],
  "Title": ["title"],
  "Ringtone": ["ringtone"],
};

// sounds that follow the Music slider (all others follow the Sound slider)
const MUSIC_NAMES = new Set(["Chimes", "During mini game.mp3", "FNAF 2 - Win Music-Lullaby Waltz (End Of The Game).mp3", "Music_Box_Melody_Playful", "With_S3", "jackinthebox", "title"]);

// pictures saved at half size (1 image pixel per game pixel) to save memory: long animations
const HALF_SIZE_GROUPS = new Set(["Sprite4", "Sprite5", "Sprite10", "Sprite28", "Sprite45"]);
// pictures saved at 3 image pixels per game pixel (big and sharp: the office)
const BIG_SIZE_GROUPS = new Set(["Office"]);
