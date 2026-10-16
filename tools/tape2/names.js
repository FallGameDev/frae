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
  "Sprite10": ["66", "67", "68", "70"],
  "Sprite12": ["1", "2", "3", "4", "0"],
  "Sprite13": ["1", "2"],
  "Sprite28": ["costume1", "costume2", "costume3", "costume4"],
  "Sprite29": ["Gold_Star"],
  "Sprite45": ["give cake", "foxy GET READY", "foxy GO! GO! GO!", "foxy blank", "foxy stage", "foxy stage2"],
  "Sprite47": ["CakeChildSprite-0", "CakeChildSprite-1", "CakeChildSprite-2", "CakeChildSprite-3", "CakeChildIrritatedSprite-0", "CakeChildIrritatedSprite-1", "CakeChildIrritatedSprite-2", "CakeChildIrritatedSprite-3", "CakeChildIrritatedSprite-4", "CakeChildIrritatedSprite-5"],
  "Sprite53": ["CakeChildCryingDying-0", "CakeChildCryingDying-1", "CakeChildCryingDying-4", "CakeChildCryingDying-6", "CakeChildCryingDying-8", "CakeChildCryingDying-11", "CakeChildCryingDying-12", "CakeChildCryingDying-13", "CakeChildCryingDying-14", "CakeChildCryingDying-16"],
  "Sprite54": ["Purple_Car"],
  "Sprite67": ["costume1"],
  "Sprite69": ["GiveThemLifeEndo", "GiveThemLifeEndo2"],
  "Sprite75": ["ConfettiBurst-0", "ConfettiBurst-1", "ConfettiBurst-2", "ConfettiBurst-3", "ConfettiBurst-4", "ConfettiBurst-5", "ConfettiBurst-6", "ConfettiBurst-7"],
  "Sprite76": ["Purple_man"],
  "Office": ["000", "010", "100", "001"],
  "OfficePose": ["hall-wfreddy", "hall-foxy", "hall-tfreddy", "hall-tchica", "hall-wbonnie", "hall-mangle", "hall-golden", "ventL-tchica", "ventL-bb", "ventL-wbonnie", "ventL-endo", "ventR-tbonnie", "ventR-mangle", "ventR-wchica", "in-wchica", "in-wbonnie", "in-tfreddy", "in-wfreddy", "in-tchica", "in-tbonnie"],
  "Cam1": ["dark", "light", "wbonnie", "wbonnie-dark", "tchica", "tchica-dark"],
  "Cam2": ["dark", "light", "wchica", "wchica-dark", "tbonnie", "tbonnie-dark"],
  "Cam3": ["dark", "light", "wfreddy", "wfreddy-dark", "tbonnie", "tbonnie-dark"],
  "Cam4": ["dark", "light", "tbonnie", "tbonnie-dark", "wchica", "wchica-dark", "tchica", "tchica-dark"],
  "Cam5": ["dark", "light", "wbonnie", "wbonnie-dark", "tchica", "tchica-dark", "bb", "bb-dark", "endo", "endo-dark"],
  "Cam6": ["dark", "light", "tbonnie", "tbonnie-dark", "mangle", "mangle-dark", "wchica", "wchica-dark"],
  "Cam7": ["dark", "light", "tchica", "tchica-dark", "wbonnie", "wbonnie-dark", "wfreddy", "wfreddy-dark", "puppetwalk1", "puppetwalk2", "puppetwalk3", "mangle", "mangle-dark"],
  "Cam8": ["dark", "light", "wchica", "wchica-dark", "wbonnie", "wbonnie-dark", "foxy", "foxy-dark", "wfreddy", "wfreddy-dark", "shadow"],
  "Cam9": ["dark", "light", "tbonnie", "tbonnie-dark", "tfreddy", "tfreddy-dark", "tchica", "tchica-dark"],
  "Cam10": ["dark", "light", "bb", "bb-dark", "tfreddy", "tfreddy-dark", "mangle", "mangle-dark"],
  "Cam11": ["dark", "light", "puppet1", "puppet2", "puppet3", "endo"],
  "Cam12": ["dark", "light", "mangle", "mangle-dark"],
  "Chars": ["tfreddy", "tbonnie", "tchica", "wfreddy", "wbonnie", "wchica", "foxy", "mangle", "golden", "endo", "shadow", "bb", "puppet"],
  "Heads": ["tfreddy", "tbonnie", "tchica", "wfreddy", "wbonnie", "wchica", "foxy", "mangle", "golden", "endo", "shadow", "bb", "puppet"],
  "Scare": ["tfreddy-1", "tfreddy-2", "tfreddy-3", "tfreddy-4", "tfreddy-5", "tfreddy-6", "tfreddy-7", "tfreddy-8", "tfreddy-9", "tbonnie-1", "tbonnie-2", "tbonnie-3", "tbonnie-4", "tbonnie-5", "tbonnie-6", "tbonnie-7", "tbonnie-8", "tbonnie-9", "tchica-1", "tchica-2", "tchica-3", "tchica-4", "tchica-5", "tchica-6", "tchica-7", "tchica-8", "tchica-9", "mangle-1", "mangle-2", "mangle-3", "mangle-4", "mangle-5", "mangle-6", "mangle-7", "mangle-8", "mangle-9", "bb-1", "bb-2", "bb-3", "bb-4", "bb-5", "bb-6", "bb-7", "bb-8", "bb-9", "puppet-1", "puppet-2", "puppet-3", "puppet-4", "puppet-5", "puppet-6", "puppet-7", "puppet-8", "puppet-9", "wfreddy-1", "wfreddy-2", "wfreddy-3", "wfreddy-4", "wfreddy-5", "wfreddy-6", "wfreddy-7", "wfreddy-8", "wfreddy-9", "wbonnie-1", "wbonnie-2", "wbonnie-3", "wbonnie-4", "wbonnie-5", "wbonnie-6", "wbonnie-7", "wbonnie-8", "wbonnie-9", "wchica-1", "wchica-2", "wchica-3", "wchica-4", "wchica-5", "wchica-6", "wchica-7", "wchica-8", "wchica-9", "foxy-1", "foxy-2", "foxy-3", "foxy-4", "foxy-5", "foxy-6", "foxy-7", "foxy-8", "foxy-9", "golden-1"],
  "OfficeExtra": ["bb", "mangle", "golden", "shadow", "tbonnie", "bbEyes"],
  "Plush": ["Sprite58", "Sprite59", "Sprite60", "Sprite62", "Sprite63", "Sprite64", "Sprite66", "Sprite61", "Sprite65"],
  "Title": ["face1", "face2", "face3", "face4"],
  "Loading": ["icon"],
  "Pixel": ["wfreddy", "head-wfreddy", "foxy", "head-foxy", "puppet", "head-puppet", "wbonnie", "head-wbonnie", "wchica", "head-wchica", "tfreddy", "head-tfreddy"],
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
