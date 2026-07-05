// ============================================================
// maps.js - タイル定義・全マップデータ・イベント
// ============================================================
'use strict';

// ---- タイル定義 ----
// sheet: 'world'|'town'|'dungeon', cell: 0-15, solid, enc(エンカウント有), tint
const TILE_DEFS = {
  world: {
    '.': { cell: 0, enc: true },            // 草原
    'f': { cell: 1, enc: true },            // 森
    'm': { cell: 2, solid: true },          // 山
    '~': { cell: 3, solid: true },          // 海
    's': { cell: 4, enc: true },            // 砂漠
    'r': { cell: 5 },                       // 街道(エンカウント無)
    'h': { cell: 6, enc: true },            // 丘
    'S': { cell: 7, enc: true },            // 雪原
    'v': { cell: 8, enc: true },            // 火山岩
    'V': { cell: 9, solid: true },          // 溶岩
    'b': { cell: 10 },                      // 橋
    'w': { cell: 11, enc: true },           // 湿地
    'T': { cell: 12 },                      // 町
    'C': { cell: 13 },                      // 城・城下町
    'c': { cell: 14 },                      // 洞窟入口
    'g': { cell: 14, tint: 0xb090ff },      // 祠
    'K': { cell: 15 },                      // 魔王城
    'x': { cell: 15, tint: 0x9955cc, solid: true }, // 六輝の結界
  },
  town: {
    '.': { cell: 0 },                       // 石畳
    '#': { cell: 1, solid: true },          // 壁
    'D': { cell: 2 },                       // 出入口(戸)
    '=': { cell: 3, solid: true, counter: true }, // カウンター
    ',': { cell: 4 },                       // 屋内床
    't': { cell: 5, solid: true },          // 木
    'F': { cell: 6, solid: true },          // 柵
    '~': { cell: 7, solid: true },          // 水
    'g': { cell: 8 },                       // 草
    'B': { cell: 10 },                      // ベッド
    'l': { cell: 11, solid: true },         // 井戸
    'k': { cell: 12 },                      // 絨毯
    'K': { cell: 13, solid: true },         // 本棚
    'E': { cell: 14, solid: true },         // テーブル
  },
  dungeon: {
    ',': { cell: 0 },                       // 石床
    '#': { cell: 1, solid: true },          // 壁
    '<': { cell: 2 },                       // 上り階段
    '>': { cell: 3 },                       // 下り階段
    'D': { cell: 4 },                       // 扉(開放済)
    'p': { cell: 11, solid: true },         // 柱
    '_': { cell: 12, solid: true },         // 闇
    '~': { cell: 13, solid: true },         // 地底湖
    'V': { cell: 14, solid: true },         // 溶岩
    'A': { cell: 15 },                      // 祭壇
    'k': { cell: 0, tint: 0xdd7788 },       // 赤絨毯(床の色替え)
  },
};

// ダンジョン生成ヘルパー: 全面壁から部屋・通路を彫る
function carveMap(w, h, ops) {
  const g = Array.from({ length: h }, () => Array(w).fill('#'));
  for (const [op, x1, y1, x2, y2, ch] of ops) {
    if (op === 'rect') { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y][x] = ch || ','; }
    else if (op === 'set') g[y1][x1] = x2; // [set, x, y, ch]
  }
  return g.map(r => r.join(''));
}

// ============ ワールドマップ (60 x 44) プログラム生成 ============
function buildWorldRows() {
  const W = 60, H = 44;
  const g = Array.from({ length: H }, () => Array(W).fill('~'));
  const rect = (x1, y1, x2, y2, ch) => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y][x] = ch; };
  const set = (x, y, ch) => { g[y][x] = ch; };
  const scatter = (x1, y1, x2, y2, ch, n, seedArr) => {
    // 決定的な散布(座標配列)
    for (const [x, y] of seedArr) if (x >= x1 && x <= x2 && y >= y1 && y <= y2) g[y][x] = ch;
  };

  // ---- 西の大陸 (x2-20, y4-32) ----
  rect(2, 5, 20, 32, '.');
  rect(2, 4, 14, 4, '~');
  rect(2, 5, 13, 9, 'f');            // 北の森
  rect(15, 5, 20, 7, '~');
  rect(4, 10, 7, 11, 'f');
  scatter(2, 12, 20, 32, 'h', 0, [[10, 12], [11, 13], [9, 22], [10, 22], [6, 21], [16, 27], [17, 28], [5, 28], [15, 13], [16, 14]]);
  rect(3, 30, 8, 32, 'f');
  // 祠エリア
  set(6, 6, 'g');                    // 黄昏の祠(裏世界ゲート)
  set(14, 6, 'c');                   // 風唱の祠(要古代のカギ)
  rect(13, 5, 15, 5, 'm'); set(13, 6, 'm'); set(15, 6, 'm'); // 祠を山で囲む
  // 山脈 + 囁きの洞窟
  rect(21, 12, 23, 31, 'm');
  set(21, 20, 'c'); set(23, 20, 'c');
  // 街道: ハーベル→洞窟
  rect(9, 20, 20, 20, 'r');
  rect(9, 21, 9, 24, 'r');
  rect(9, 24, 11, 24, 'r');
  set(12, 24, 'C');                  // ハーベル城下町
  // ---- 東の地方 (x24-55, y12-29) ----
  rect(24, 12, 53, 29, '.');
  rect(50, 26, 53, 29, '~'); rect(52, 22, 53, 25, '~');
  rect(24, 30, 43, 34, '~');
  scatter(24, 12, 53, 29, 'h', 0, [[27, 14], [28, 15], [30, 14], [34, 18], [35, 19], [46, 15], [47, 16], [29, 25], [30, 26], [40, 13]]);
  rect(36, 26, 38, 28, 'f'); rect(45, 13, 47, 14, 'f');
  set(32, 16, 'T');                  // カルスト
  // 街道: 洞窟→分岐→カルスト/メリア
  rect(24, 20, 41, 20, 'r');
  rect(32, 17, 32, 20, 'r');
  rect(41, 20, 41, 24, 'r');
  rect(42, 24, 48, 24, 'r');
  set(49, 24, 'T');                  // 港町メリア
  // 沈んだ遺跡(南東の砂浜)
  rect(45, 28, 47, 29, 's');
  set(46, 30, 's'); set(46, 31, 'c'); rect(45, 30, 45, 31, '~'); rect(47, 30, 47, 31, '~');
  // ---- 北の雪国 (x36-57, y1-9) ----
  rect(36, 1, 57, 9, 'S');
  rect(36, 1, 57, 1, 'm');
  rect(36, 2, 36, 9, 'm'); rect(57, 2, 57, 9, 'm');
  set(45, 4, 'T');                   // 雪の町フレル
  rect(52, 2, 56, 2, 'm'); set(52, 3, 'm'); set(56, 3, 'm'); set(55, 3, 'S');
  set(54, 3, 'c');                   // 氷晶尖塔
  rect(44, 5, 44, 9, 'r');
  // 川と橋(雪国への関所)
  rect(37, 10, 56, 11, '~');
  set(44, 10, 'b'); set(44, 11, 'b');
  rect(44, 12, 44, 13, 'r');
  // ---- 南の砂の大陸 (y35-42) ----
  rect(12, 36, 40, 41, 's');
  rect(14, 42, 36, 42, 's');
  rect(10, 37, 11, 40, '~');
  set(28, 38, 'T');                  // 砂漠の町ザーラ
  rect(12, 38, 16, 41, 'v');         // 火山地帯
  set(13, 40, 'c');                  // 燃えさかる深淵
  set(36, 36, 's');                  // 渡し船の桟橋
  // ---- 暗黒島(魔王城) ----
  rect(29, 29, 33, 32, 'v');
  rect(28, 29, 28, 32, '~'); rect(34, 29, 34, 32, '~');
  set(31, 30, 'K');                  // 魔王城
  set(31, 33, 'v'); set(31, 34, 'x'); set(31, 35, 'x'); // 結界(オーブ6つで消滅)
  return g.map(r => r.join(''));
}
const WORLD_ROWS = buildWorldRows();


// ワールドのエンカウントゾーン ([x1,y1,x2,y2] 順にチェック)
const WORLD_ZONES = [
  { rect: [34, 0, 59, 11], table: 'snowfield' },
  { rect: [0, 35, 59, 43], table: 'desert' },
  { rect: [26, 30, 40, 34], table: 'darkcastle' },
  { rect: [42, 18, 59, 31], table: 'coast' },
  { rect: [24, 12, 59, 34], table: 'plains2' },
  { rect: [0, 0, 23, 11], table: 'plains2' },
  { rect: [0, 12, 23, 34], table: 'plains' },
];

// ============ マップ定義 ============
// warp先座標はマップ座標。イベント type:
//  npc / chest / warp / door / rock / switchplate / trigger / shop / inn / church / tavern / boss / ferry
const MAPS = {};

MAPS.world = {
  id: 'world', name: 'エルデア大陸', tileset: 'world', rows: WORLD_ROWS,
  bgm: 'field', zones: WORLD_ZONES, outside: true,
  events: [
    { id: 'e_harbel', type: 'warp', x: 12, y: 24, to: { map: 'town_harbel', x: 13, y: 18 } },
    { id: 'e_karst', type: 'warp', x: 32, y: 16, to: { map: 'town_karst', x: 11, y: 15 } },
    { id: 'e_meria', type: 'warp', x: 49, y: 24, to: { map: 'town_meria', x: 12, y: 16 } },
    { id: 'e_zahra', type: 'warp', x: 28, y: 38, to: { map: 'town_zahra', x: 11, y: 15 } },
    { id: 'e_frell', type: 'warp', x: 45, y: 4, to: { map: 'town_frell', x: 10, y: 15 } },
    { id: 'e_cave_w', type: 'warp', x: 21, y: 20, to: { map: 'dun_cave', x: 1, y: 8 } },
    { id: 'e_cave_e', type: 'warp', x: 23, y: 20, to: { map: 'dun_cave', x: 22, y: 8 } },
    { id: 'e_ruins', type: 'warp', x: 46, y: 31, to: { map: 'dun_ruins1', x: 11, y: 16 } },
    { id: 'e_spire', type: 'warp', x: 54, y: 3, to: { map: 'dun_spire1', x: 9, y: 14 } },
    { id: 'e_ember', type: 'warp', x: 13, y: 40, to: { map: 'dun_ember1', x: 10, y: 14 } },
    { id: 'e_shrine_wind', type: 'warp', x: 14, y: 6, to: { map: 'dun_shrine', x: 9, y: 12 },
      locked: 'ancient', lockMsg: '風唱の祠の扉は固く閉ざされている。古代のカギが必要だ。' },
    { id: 'e_darkcastle', type: 'warp', x: 31, y: 30, to: { map: 'dun_dark1', x: 11, y: 18 } },
    { id: 'e_shadowgate', type: 'trigger', x: 6, y: 6, script: 'shadowgate' },
    { id: 'e_ferry_back', type: 'ferry', x: 36, y: 36, sprite: 11,
      dest: { map: 'town_meria', x: 8, y: 12 }, msg: 'メリア港へ戻るかい？' },
    { id: 'e_bridge_guard', type: 'npc', x: 44, y: 12, sprite: 10, solidNpc: true,
      hideIf: (g) => Game.orbCount() >= 3,
      dialog: ['ここから北は雪の魔物が凶暴で通せない！', 'オーブを3つ集めたほどの勇者なら、話は別だがな。'] },
  ],
};

// ============ ハーベル城下町 (26x20) ============
MAPS.town_harbel = {
  id: 'town_harbel', name: 'ハーベル城下町', tileset: 'town', bgm: 'town', town: true,
  rows: [
    'tttttttttttttttttttttttttt',
    't####################gggtt',
    't#,,,,,,,,,,,k,,,,,,#ggggt',
    't#,K,,E,,,,,,k,,,B,,#gtggt',
    't#,,,,,,,,,,,k,,,,,,#ggggt',
    't##########,,k,,#####ggggt',
    'tggggg#,,,,,,,k,,,,,#ggggt',
    'tggggg#,,,,,,,k,,,,,#gtggt',
    'tggggg######D#######gggggt',
    'tgggggggggg...ggggggggggtt',
    't####g#####...#####gg####t',
    't#,,,#g#,,,#g#,,,#ggg#,,#t',
    't#,B,Dg#,,,Dg#,=,Dggg#,=#t',
    't#,,,#g#,=,#g#,,,#ggg#,,#t',
    't#####g#####g#####ggg##D#t',
    'tgggggg..l...........ggggt',
    'tg.gggg.gggggg.gggggg.gggt',
    'tg.......g.........gg.gggt',
    'ttgggggggg.gggggggggggggtt',
    'tttttttttttttDtttttttttttt',
  ],
  exit: { map: 'world', x: 12, y: 25 }, // 町の外周から出た時
  events: [
    { id: 'h_exit', type: 'warp', x: 13, y: 19, to: { map: 'world', x: 12, y: 25 } },
    // 王様(玉座) — メインクエスト進行
    { id: 'h_king', type: 'npc', x: 13, y: 3, sprite: 9, script: 'king' },
    { id: 'h_soldier1', type: 'npc', x: 11, y: 7, sprite: 10,
      dialog: ['王様が勇者どのをお待ちだ。玉座の間へ進まれよ。'] },
    { id: 'h_minister', type: 'npc', x: 15, y: 7, sprite: 8,
      dialog: (g) => g.flags.got_lightorb
        ? ['六つのオーブが揃えば、南の海の結界は消える。', '魔王城は南の暗黒島…どうかご無事で。']
        : ['星々の光が奪われてから、夜が長くなった気がします…'] },
    // 宿屋
    { id: 'h_inn', type: 'inn', x: 2, y: 12, sprite: 7, price: 6, faceDir: 'right' },
    // 道具屋
    { id: 'h_itemshop', type: 'shop', x: 14, y: 12, sprite: 11, shop: 'harbel_item' },
    // 武器屋
    { id: 'h_weaponshop', type: 'shop', x: 23, y: 11, sprite: 11, shop: 'harbel_weapon' },
    // 酒場マスター(仲間登録)
    { id: 'h_tavern', type: 'tavern', x: 9, y: 12, sprite: 14 },
    // 教会(復活)
    { id: 'h_church', type: 'church', x: 21, y: 16, sprite: 12 },
    { id: 'h_villager1', type: 'npc', x: 6, y: 16, sprite: 6,
      dialog: ['東の山にある囁きの洞窟が、隣の国への唯一の道だ。', '洞窟の扉は王家のカギでしか開かないらしい。'] },
    { id: 'h_villager2', type: 'npc', x: 16, y: 17, sprite: 7,
      dialog: (g) => g.flags.cleared_game
        ? ['町の北西にある古い祠…あそこから黄昏の気配がする。', '行くなら十分に備えてね。']
        : ['酒場で仲間を集められるよ。4人パーティが基本だね。'] },
    { id: 'h_child', type: 'npc', x: 10, y: 9, sprite: 13,
      dialog: ['ぼく、おっきくなったら ぶとうかになる！', 'かいしんのいちげき、バシーン！って。'] },
    { id: 'h_chest1', type: 'chest', x: 2, y: 4, item: 'herb', flag: 'chest_h1' },
  ],
};

// ============ カルスト山あいの町 (22x17) ============
MAPS.town_karst = {
  id: 'town_karst', name: '山の町カルスト', tileset: 'town', bgm: 'town', town: true,
  rows: [
    'tttttttttttttttttttttt',
    'tggg####g####gggg####t',
    'tggg#,,#g#,,#gggg#,,#t',
    'tggg#,=Dg#,BDgggg#,=Dt',
    'tggg#,,#g#,,#gggg#,,#t',
    'tggg####g####gggg####t',
    'tgggggg.......gggggggt',
    'tg###gg.ggggg.ggg###gt',
    'tg#,#gg.ggggg.ggg#,#gt',
    'tg#,Dgg.glgg..gggD,#gt',
    'tg#,#gg.......ggg#,#gt',
    'tg###gg.gggg.gggg###gt',
    'tggggg..gggg..ggggggtt',
    'tgggg.gggggggg.gggggtt',
    'tggg.gggggggggg.ggggtt',
    'ttgg.gggggggggg.ggggtt',
    'ttttttttttDttttttttttt',
  ],
  exit: { map: 'world', x: 32, y: 17 },
  events: [
    { id: 'k_exit', type: 'warp', x: 10, y: 16, to: { map: 'world', x: 32, y: 17 } },
    { id: 'k_weapon', type: 'shop', x: 5, y: 3, sprite: 11, shop: 'karst_weapon' },
    { id: 'k_inn', type: 'inn', x: 10, y: 3, sprite: 7, price: 15 },
    { id: 'k_item', type: 'shop', x: 18, y: 3, sprite: 11, shop: 'karst_item' },
    { id: 'k_elder', type: 'npc', x: 3, y: 8, sprite: 8,
      dialog: (g) => {
        if (!g.flags.orb_earth_got) return ['囁きの洞窟の奥に、大地のオーブを守る岩の巨人がいる。', '雷の呪文がよく効くと聞くがのう。'];
        if (!g.flags.orb_tide_got) return ['東の港町メリアの沖に、古い遺跡が沈んでおる。', '潮のオーブはそこじゃろう。海辺の洞窟から入れるはずじゃ。'];
        return ['北の橋の先は雪の国。氷晶竜は身にまとう属性を変えるという。', 'まとった属性の弱点を突けば、ヤツはひるむそうじゃ。'];
      } },
    { id: 'k_church', type: 'church', x: 18, y: 9, sprite: 12 },
    { id: 'k_villager1', type: 'npc', x: 8, y: 12, sprite: 6,
      dialog: ['遺跡の宝箱で「古代のカギ」を見た者がいるらしい。', '西の大陸の祠は、そのカギで開くって話だ。'] },
    { id: 'k_villager2', type: 'npc', x: 13, y: 7, sprite: 13,
      dialog: ['ねむり攻撃はこわいよ〜。めざましベルを持っておくと安心だよ。'] },
    { id: 'k_chest1', type: 'chest', x: 3, y: 10, item: 'wakebell', flag: 'chest_k1' },
  ],
};

// ============ 港町メリア (24x18) ============
MAPS.town_meria = {
  id: 'town_meria', name: '港町メリア', tileset: 'town', bgm: 'town', town: true,
  rows: [
    'tttttttttttttttttttttttt',
    't#####g#####ggg######ggt',
    't#,,,#g#,,,#ggg#,,,,#ggt',
    't#,=,Dg#,B,Dggg#,==,Dggt',
    't#,,,#g#,,,#ggg#,,,,#ggt',
    't#####g#####ggg######ggt',
    'tgggg.........gggggggggt',
    'tg###g.g###g.g###ggggggt',
    'tg#,Dg.g#,Dg.gD,#ggggggt',
    'tg###g.g###g.g###gggggtt',
    'tgggg.........ggggggggtt',
    'tggggggg......ggggggggtt',
    'tggggggg..~~~~~~~~~~~ttt',
    'tggggggg..~~~~~~~~~~~ttt',
    'tggggggg..ggggggggggggtt',
    'tggggg.......gggggggggtt',
    'tgggggg.ggg.ggggggggggtt',
    'ttttttttttDttttttttttttt',
  ],
  exit: { map: 'world', x: 49, y: 25 },
  events: [
    { id: 'm_exit', type: 'warp', x: 10, y: 17, to: { map: 'world', x: 49, y: 25 } },
    { id: 'm_item', type: 'shop', x: 2, y: 3, sprite: 11, shop: 'meria_item' },
    { id: 'm_inn', type: 'inn', x: 8, y: 3, sprite: 7, price: 25 },
    { id: 'm_weapon', type: 'shop', x: 16, y: 3, sprite: 11, shop: 'meria_weapon' },
    { id: 'm_church', type: 'church', x: 14, y: 8, sprite: 12 },
    { id: 'm_ferry', type: 'ferry', x: 9, y: 13, sprite: 11,
      needPass: true, dest: { map: 'world', x: 36, y: 37 },
      msg: '南の砂の大陸へ渡るかい？',
      noPassMsg: '渡し船に乗るには手形が要るんだ。潮のオーブを取り戻した英雄なら、船主が手形をくれるだろうよ。' },
    { id: 'm_shipowner', type: 'npc', x: 9, y: 8, sprite: 8, script: 'shipowner' },
    { id: 'm_villager1', type: 'npc', x: 5, y: 10, sprite: 7,
      dialog: ['南東の海辺の洞窟から、沈んだ遺跡に入れるのよ。', '中は水浸しだから、雷に弱い魔物が多いって。'] },
    { id: 'm_villager2', type: 'npc', x: 16, y: 15, sprite: 6,
      dialog: ['砂の大陸の火山には、炎将イグナスが巣くっている。', '氷や水の術がなければ、勝ち目はないだろうな。'] },
    { id: 'm_chest1', type: 'chest', x: 17, y: 2, item: 'ether', flag: 'chest_m1' },
  ],
};

// ============ 砂漠の町ザーラ (22x17) ============
MAPS.town_zahra = {
  id: 'town_zahra', name: '砂漠の町ザーラ', tileset: 'town', bgm: 'town', town: true,
  rows: [
    'tttttttttttttttttttttt',
    't####gg####ggg#####ggt',
    't#,,#gg#,,#ggg#,,,#ggt',
    't#,=Dgg#,BDggg#,=,Dggt',
    't#,,#gg#,,#ggg#,,,#ggt',
    't####gg####ggg#####ggt',
    'tggg...........ggggggt',
    'tggg.ggggggggg.ggggggt',
    'tggg.gg~~~gggg.ggggggt',
    'tggg.gg~~~gggg.gg###gt',
    'tggg.ggggggggg.ggD,#gt',
    'tggg.ggggggggg.gg#,#gt',
    'tggg...........gg###gt',
    'tgggggg.gggg.ggggggggt',
    'tggggg.gggggg.ggggggtt',
    'ttggg.gggggggg.gggggtt',
    'tttttttttttDtttttttttt',
  ],
  exit: { map: 'world', x: 28, y: 39 },
  events: [
    { id: 'z_exit', type: 'warp', x: 11, y: 16, to: { map: 'world', x: 28, y: 39 } },
    { id: 'z_weapon', type: 'shop', x: 2, y: 3, sprite: 11, shop: 'zahra_weapon' },
    { id: 'z_inn', type: 'inn', x: 8, y: 3, sprite: 7, price: 40 },
    { id: 'z_item', type: 'shop', x: 17, y: 3, sprite: 11, shop: 'zahra_item' },
    { id: 'z_church', type: 'church', x: 18, y: 10, sprite: 12 },
    { id: 'z_sage', type: 'npc', x: 9, y: 10, sprite: 8,
      dialog: (g) => {
        if (!g.flags.orb_flame_got) return ['西の火山「燃えさかる深淵」に焔のオーブが眠っておる。', '炎将イグナスは氷と水を何より恐れておるよ。'];
        if (!g.flags.orb_wind_got) return ['風唱のオーブは、西の大陸の北の祠にある。', '祠の岩は、押して封印の台座に載せるのじゃ。二つ同時にな。'];
        return ['六つのオーブが揃うとき、南の海の結界が開く。', '魔王シェイドヴェインを倒せるのは、そなたらだけじゃ。'];
      } },
    { id: 'z_villager1', type: 'npc', x: 6, y: 13, sprite: 7,
      dialog: ['オアシスの水はあまいよ〜。砂漠の魔物は氷に弱いものが多いね。'] },
    { id: 'z_dancer', type: 'npc', x: 13, y: 8, sprite: 14,
      dialog: ['砂丘の盗賊はお金をたくさん落とすの。装備を整えるなら狩ってみたら？'] },
    { id: 'z_chest1', type: 'chest', x: 9, y: 2, item: 'phoenixdown', flag: 'chest_z1' },
  ],
};

// ============ 雪の町フレル (20x17) ============
MAPS.town_frell = {
  id: 'town_frell', name: '雪の町フレル', tileset: 'town', bgm: 'town', town: true,
  rows: [
    'tttttttttttttttttttt',
    't####g####gg#####ggt',
    't#,,#g#,,#gg#,,,#ggt',
    't#,=Dg#,BDgg#,=,Dggt',
    't#,,#g#,,#gg#,,,#ggt',
    't####g####gg#####ggt',
    'tgg.........gggggggt',
    'tgg.ggggggg.gggggggt',
    'tgg.ggg#####ggggggtt',
    'tgg.ggg#,,,#ggggggtt',
    'tgg.gggD,B,#ggggggtt',
    'tgg.ggg#####ggggggtt',
    'tgg.........ggggggtt',
    'tggggg.ggg.gggggggtt',
    'tggggg.ggg.gggggggtt',
    'ttggg.ggggg.ggggggtt',
    'tttttttttDtttttttttt',
  ],
  exit: { map: 'world', x: 45, y: 5 },
  events: [
    { id: 'f_exit', type: 'warp', x: 9, y: 16, to: { map: 'world', x: 45, y: 5 } },
    { id: 'f_weapon', type: 'shop', x: 2, y: 3, sprite: 11, shop: 'frell_weapon' },
    { id: 'f_inn', type: 'inn', x: 7, y: 3, sprite: 7, price: 60 },
    { id: 'f_item', type: 'shop', x: 15, y: 3, sprite: 11, shop: 'frell_item' },
    { id: 'f_church', type: 'church', x: 8, y: 10, sprite: 12 },
    { id: 'f_elder', type: 'npc', x: 4, y: 13, sprite: 8,
      dialog: (g) => g.flags.orb_frost_got
        ? ['オーブが5つ揃ったら、ハーベルの王のもとへ。', '最後のひとつ「光燿のオーブ」は王家が守っておるでな。']
        : ['北東の氷晶尖塔に氷華のオーブがある。', '氷晶竜フリムドは 炎・氷・雷の衣を順にまとう。', 'まとう衣の「弱点」を突けば、ひるんで隙が生まれるぞ。'] },
    { id: 'f_villager1', type: 'npc', x: 12, y: 13, sprite: 6,
      dialog: ['フリムドが氷の衣のときは炎を、炎の衣のときは氷を。', '雷の衣のときは…大地の力じゃな。'] },
    { id: 'f_chest1', type: 'chest', x: 8, y: 2, item: 'herb3', flag: 'chest_f1' },
  ],
};

// ============ 囁きの洞窟 (24x18) ============
MAPS.dun_cave = {
  id: 'dun_cave', name: '囁きの洞窟', tileset: 'dungeon', bgm: 'dungeon', enc: 'cave',
  rows: [
    '########################',
    '#,,,,,#,,,,,,,,#,,,,,,,#',
    '#,###,#,######,#,#####,#',
    '#,#,,,,,#,,,,,,,,#,,,,,#',
    '#,#,#####,######,#,###,#',
    '#,#,,,,,#,,,,,,#,,,#,,,#',
    '#,#####,######,#####,#,#',
    '#,,,,,,,,,,,,,,,,,,,,#,#',
    'D,####,########,####,#,D',
    '#,#,,,,#,,,,,,#,,,,,,#,#',
    '#,#,##,#,####,#,####,#,#',
    '#,,,,#,,,#,,,,,,#,,,,,,#',
    '#,##,#####,####,#,####,#',
    '#,#,,,,,,,,#,,,,#,,,,#,#',
    '#,#,######,#,##,#####,#,#'.slice(0, 24),
    '#,,,,#,,,,,#,,,,,,,,,,,#',
    '#,####,###D#############',
    '##########>#############',
  ],
  events: [
    { id: 'c_exit_w', type: 'edge', x: 0, y: 8, to: { map: 'world', x: 20, y: 20 } },
    { id: 'c_exit_e', type: 'edge', x: 23, y: 8, to: { map: 'world', x: 24, y: 20 } },
    { id: 'c_lockdoor', type: 'door', x: 10, y: 16, locked: 'cave',
      lockMsg: '王家の紋章が刻まれた扉だ。洞窟のカギが必要だ。' },
    { id: 'c_chest1', type: 'chest', x: 5, y: 3, item: 'herb', flag: 'chest_c1' },
    { id: 'c_chest2', type: 'chest', x: 20, y: 13, gold: 120, flag: 'chest_c2' },
    { id: 'c_chest3', type: 'chest', x: 3, y: 13, item: 'w_hammer1', flag: 'chest_c3' },
    { id: 'c_boss', type: 'warp', x: 10, y: 17, to: { map: 'dun_cave_boss', x: 5, y: 8 } },
  ],
};
// 洞窟ボス部屋 (11x10)
MAPS.dun_cave_boss = {
  id: 'dun_cave_boss', name: '大地の間', tileset: 'dungeon', bgm: 'dungeon',
  rows: [
    '###########',
    '#,,,,,,,,,#',
    '#,p,,,,,p,#',
    '#,,,,A,,,,#',
    '#,,,AAA,,,#',
    '#,,,,A,,,,#',
    '#,p,,,,,p,#',
    '#,,,,,,,,,#',
    '#,,,,,,,,,#',
    '#####D#####',
  ],
  events: [
    { id: 'cb_exit', type: 'warp', x: 5, y: 9, to: { map: 'dun_cave', x: 10, y: 16 } },
    { id: 'cb_boss', type: 'boss', x: 5, y: 3, sprite: 15, flag: 'orb_earth_got',
      enemies: ['boss_gand'], orb: 'orb_earth',
      preMsg: ['岩の巨人が目を覚ました！', '「オーブハ…ワタサヌ…」'] },
  ],
};

// ============ 沈んだ遺跡 B1 (24x18) ============
MAPS.dun_ruins1 = {
  id: 'dun_ruins1', name: '沈んだ遺跡 B1', tileset: 'dungeon', bgm: 'dungeon', enc: 'ruins',
  rows: [
    '########################',
    '#,,,,,~~~#,,,,#~~~,,,,,#',
    '#,###,~~~#,##,#~~~,###,#',
    '#,#,,,,,,,,##,,,,,,,#,,#',
    '#,#,#####,####,#####,#,#',
    '#,#,#,,,,,,,,,,,,,,#,#,#',
    '#,,,#,~~~~#,,#~~~~,#,,,#',
    '#,###,~~~~#>,#~~~~,###,#',
    '#,#,,,,,,,####,,,,,,,#,#',
    '#,#,####,,,,,,,,####,#,#',
    '#,#,#,,,,######,,,,#,#,#',
    '#,,,#,##,#,,,,#,##,#,,,#',
    '#,#,,,,#,#,,,,#,#,,,,#,#',
    '#,#####,,#,,,,#,,#####,#',
    '#,,,,,,,,##DD##,,,,,,,,#',
    '#,######,,,,,,,,######,#',
    '#,,,,,,,,,,D,,,,,,,,,,,#',
    '############D###########',
  ],
  events: [
    { id: 'r1_exit', type: 'edge', x: 12, y: 17, to: { map: 'world', x: 46, y: 30 } },
    { id: 'r1_down', type: 'warp', x: 11, y: 7, to: { map: 'dun_ruins2', x: 10, y: 2 } },
    { id: 'r1_chest1', type: 'chest', x: 3, y: 12, item: 'ancientkey', flag: 'chest_r1' },
    { id: 'r1_chest2', type: 'chest', x: 20, y: 12, gold: 350, flag: 'chest_r2' },
    { id: 'r1_chest3', type: 'chest', x: 21, y: 1, item: 'a_chain', flag: 'chest_r3' },
  ],
};
// 沈んだ遺跡 B2 (20x14)
MAPS.dun_ruins2 = {
  id: 'dun_ruins2', name: '沈んだ遺跡 最深部', tileset: 'dungeon', bgm: 'dungeon', enc: 'ruins',
  rows: [
    '####################',
    '#,,,,,,,,,<,,,,,,,,#',
    '#,~~~~#,,,,,,#~~~~,#',
    '#,~~~~#,####,#~~~~,#',
    '#,,,,,#,#,,#,#,,,,,#',
    '#,###,,,#,,#,,,###,#',
    '#,#,,,###,,#type,#,#'.replace('type', '##,,'),
    '#,#,,,,,,,,,,,,,#,#'.padEnd(20, '#'),
    '#,#,,###,,,,###,,#,#',
    '#,,,,#,,,,,,,,#,,,,#',
    '#,##,#,,AAAA,,#,##,#',
    '#,,,,,,,AAAA,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,#',
    '####################',
  ],
  events: [
    { id: 'r2_up', type: 'warp', x: 10, y: 1, to: { map: 'dun_ruins1', x: 12, y: 7 } },
    { id: 'r2_chest1', type: 'chest', x: 2, y: 12, item: 'ether', flag: 'chest_r4' },
    { id: 'r2_boss', type: 'boss', x: 10, y: 10, sprite: 15, flag: 'orb_tide_got',
      enemies: ['boss_rival'], orb: 'orb_tide',
      preMsg: ['水底から巨大な影がゆらりと立ち上がる…', '「我ガ眠リヲ妨ゲル者ハ、藻屑トナレ」'] },
  ],
};

// ============ 風唱の祠 (19x15) — 押し岩パズル ============
MAPS.dun_shrine = {
  id: 'dun_shrine', name: '風唱の祠', tileset: 'dungeon', bgm: 'dungeon', enc: null,
  rows: carveMap(19, 15, [
    ['rect', 1, 1, 17, 3],          // ボスの間(北)
    ['rect', 1, 5, 17, 12],         // 祈りの間(南)
    ['set', 9, 4, ','],             // ゲート通路
    ['set', 9, 13, 'D'],            // 入口
    ['set', 8, 2, 'A'], ['set', 10, 2, 'A'],
    ['set', 2, 2, 'p'], ['set', 16, 2, 'p'], ['set', 2, 11, 'p'], ['set', 16, 11, 'p'],
  ]),
  events: [
    { id: 's_exit', type: 'warp', x: 9, y: 13, to: { map: 'world', x: 14, y: 7 } },
    // パズル: 岩2つを封印の台座(スイッチ)へ押し込むとゲートが開く
    { id: 's_rock1', type: 'rock', x: 5, y: 7 },
    { id: 's_rock2', type: 'rock', x: 13, y: 7 },
    { id: 's_plate1', type: 'switchplate', x: 3, y: 10 },
    { id: 's_plate2', type: 'switchplate', x: 15, y: 10 },
    { id: 's_gate', type: 'gate', x: 9, y: 4,
      openWhen: ['s_plate1', 's_plate2'],
      msg: '風の結界だ。二つの封印の台座に岩を載せれば解けるようだ。' },
    { id: 's_boss', type: 'boss', x: 9, y: 2, sprite: 15, flag: 'orb_wind_got',
      enemies: ['boss_zeph'], orb: 'orb_wind',
      preMsg: ['風がうずまき、人の形を成した！', '「よくぞ封印を解いた。だが、オーブは実力で勝ち取れ！」'] },
    { id: 's_chest1', type: 'chest', x: 17, y: 12, item: 'w_staff2', flag: 'chest_s1' },
  ],
};

// ============ 氷晶尖塔 1F (20x16) ============
MAPS.dun_spire1 = {
  id: 'dun_spire1', name: '氷晶尖塔 1F', tileset: 'dungeon', bgm: 'dungeon', enc: 'spire', tint: 0xcfe4ff,
  rows: carveMap(20, 16, [
    ['rect', 1, 1, 18, 1], ['rect', 1, 14, 18, 14],   // 外周回廊(上下)
    ['rect', 1, 1, 1, 14], ['rect', 18, 1, 18, 14],   // 外周回廊(左右)
    ['rect', 3, 3, 16, 3], ['rect', 3, 12, 16, 12],   // 内周回廊(上下)
    ['rect', 3, 3, 3, 12], ['rect', 16, 3, 16, 12],   // 内周回廊(左右)
    ['set', 9, 2, ','],                                // 外→内 接続(北)
    ['rect', 6, 6, 13, 9],                             // 中央の間
    ['set', 9, 4, ','], ['set', 9, 5, ','],            // 内→中央 接続
    ['set', 10, 7, '<'],
    ['set', 9, 15, 'D'],                               // 入口
    ['set', 7, 8, 'p'], ['set', 12, 8, 'p'],
  ]),
  events: [
    { id: 'sp1_exit', type: 'edge', x: 9, y: 15, to: { map: 'world', x: 54, y: 4 } },
    { id: 'sp1_up', type: 'warp', x: 10, y: 7, to: { map: 'dun_spire2', x: 8, y: 10 } },
    { id: 'sp1_chest1', type: 'chest', x: 18, y: 1, item: 'herb3', flag: 'chest_sp1' },
    { id: 'sp1_chest2', type: 'chest', x: 1, y: 14, gold: 800, flag: 'chest_sp2' },
  ],
};

// 氷晶尖塔 頂上 (17x12)
MAPS.dun_spire2 = {
  id: 'dun_spire2', name: '氷晶尖塔 頂上', tileset: 'dungeon', bgm: 'dungeon', enc: 'spire', tint: 0xcfe4ff,
  rows: [
    '#################',
    '#,,,,,,,,,,,,,,,#',
    '#,p,,,,,,,,,,p,,#',
    '#,,,,AAA,,,,,,,,#',
    '#,,,,AAA,,,,,,,,#',
    '#,,,,,,,,,,,,,,,#',
    '#,p,,,,,,,,,,p,,#',
    '#,,,,,,,,,,,,,,,#',
    '#,,,,,,,>,,,,,,,#',
    '#,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,#',
    '#################',
  ],
  events: [
    { id: 'sp2_down', type: 'warp', x: 8, y: 8, to: { map: 'dun_spire1', x: 10, y: 6 } },
    { id: 'sp2_chest1', type: 'chest', x: 15, y: 1, item: 'w_sword3', flag: 'chest_sp3' },
    { id: 'sp2_boss', type: 'boss', x: 5, y: 3, sprite: 15, flag: 'orb_frost_got',
      enemies: ['boss_frimd'], orb: 'orb_frost',
      preMsg: ['氷の竜が翼を広げた。まとう衣が刻々と色を変える…！', '「賢キ者ノミ、我ガ衣ヲ剥ガセルダロウ」'] },
  ],
};

// ============ 燃えさかる深淵 B1 (22x16) ============
MAPS.dun_ember1 = {
  id: 'dun_ember1', name: '燃えさかる深淵 B1', tileset: 'dungeon', bgm: 'dungeon', enc: 'volcano', tint: 0xffd8c0,
  rows: [
    '######################',
    '#,,,,,VV#,,,,,,VV,,,,#',
    '#,###,VV#,####,VV,##,#',
    '#,#,,,,,,,#,,,,,,,,#,#',
    '#,#,#####,#,##VV##,#,#',
    '#,#,,,,,#,#,,,VV,#,,,#',
    '#,#####,#,####,#,####,#'.slice(0, 22),
    '#,,,,,,,#,,,,>,#,,,,,#',
    '#,#####,######,#,###,#',
    '#,#,,,,,,,,,,,,#,,#,,#',
    '#,#,VVVV,#####,##,#,#,#'.slice(0, 22),
    '#,#,VVVV,#,,,,,,#,,,#,#'.slice(0, 22),
    '#,#,,,,,,#,####,####,#',
    '#,#####,##,#,,,,,,,,,#',
    '#,,,,,,,,,,#,#########',
    '###########D##########',
  ],
  events: [
    { id: 'em1_exit', type: 'edge', x: 11, y: 15, to: { map: 'world', x: 14, y: 40 } },
    { id: 'em1_down', type: 'warp', x: 13, y: 7, to: { map: 'dun_ember2', x: 9, y: 2 } },
    { id: 'em1_chest1', type: 'chest', x: 20, y: 1, item: 'phoenixdown', flag: 'chest_e1' },
    { id: 'em1_chest2', type: 'chest', x: 1, y: 14, item: 'bomb', flag: 'chest_e2' },
  ],
};
// 燃えさかる深淵 最深部 (18x13)
MAPS.dun_ember2 = {
  id: 'dun_ember2', name: '燃えさかる深淵 最深部', tileset: 'dungeon', bgm: 'dungeon', enc: 'volcano', tint: 0xffd8c0,
  rows: [
    '##################',
    '#,,,,,,,,<,,,,,,,#',
    '#,VVV,,,,,,,,VVV,#',
    '#,VVV,,,,,,,,VVV,#',
    '#,,,,,,,,,,,,,,,,#',
    '#,,,,,######,,,,,#',
    '#,,,,##,,,,##,,,,#',
    '#,,,,#,AAAA,#,,,,#',
    '#,,,,#,AAAA,#,,,,#',
    '#,,,,#,,,,,,#,,,,#',
    '#,,,,###DD###,,,,#',
    '#,,,,,,,,,,,,,,,,#',
    '##################',
  ],
  events: [
    { id: 'em2_up', type: 'warp', x: 9, y: 1, to: { map: 'dun_ember1', x: 12, y: 7 } },
    { id: 'em2_chest1', type: 'chest', x: 16, y: 11, item: 'w_sword4', flag: 'chest_e3' },
    { id: 'em2_boss', type: 'boss', x: 9, y: 7, sprite: 15, flag: 'orb_flame_got',
      enemies: ['boss_ignas'], orb: 'orb_flame',
      preMsg: ['溶岩の中から炎の巨人が現れた！', '「我ガ炎ニ焼カレニ来タカ、小サキ者ヨ！」'] },
  ],
};

// ============ 魔王城 (24x20) ============
MAPS.dun_dark1 = {
  id: 'dun_dark1', name: '魔王城', tileset: 'dungeon', bgm: 'dungeon2', enc: 'darkcastle', tint: 0xb9a8d8,
  rows: carveMap(24, 20, [
    ['rect', 2, 14, 21, 18],            // 大広間(南)
    ['rect', 2, 2, 21, 6],              // 上の大広間(北)
    ['rect', 3, 7, 3, 13], ['rect', 20, 7, 20, 13],   // 左右の回廊
    ['rect', 11, 7, 12, 13],            // 中央回廊
    ['set', 11, 19, 'D'], ['set', 12, 19, 'D'],       // 正門
    ['set', 12, 3, '<'],
    ['set', 6, 4, 'p'], ['set', 9, 4, 'p'], ['set', 14, 4, 'p'], ['set', 17, 4, 'p'],
    ['set', 6, 16, 'p'], ['set', 17, 16, 'p'],
  ]),
  events: [
    { id: 'd1_exit', type: 'edge', x: 11, y: 19, to: { map: 'world', x: 31, y: 31 } },
    { id: 'd1_exit2', type: 'edge', x: 12, y: 19, to: { map: 'world', x: 31, y: 31 } },
    { id: 'd1_up', type: 'warp', x: 12, y: 3, to: { map: 'dun_dark2', x: 8, y: 9 } },
    { id: 'd1_chest1', type: 'chest', x: 2, y: 2, item: 'a_holy', flag: 'chest_d1' },
    { id: 'd1_chest2', type: 'chest', x: 21, y: 2, item: 'herb3', flag: 'chest_d2' },
    { id: 'd1_chest3', type: 'chest', x: 2, y: 18, gold: 2000, flag: 'chest_d3' },
  ],
};

// 魔王の玉座 (17x13)
MAPS.dun_dark2 = {
  id: 'dun_dark2', name: '魔王の玉座', tileset: 'dungeon', bgm: 'dungeon2', tint: 0xb9a8d8,
  rows: [
    '#################',
    '#,,,,,,,,,,,,,,,#',
    '#,p,,,,,,,,,,p,,#',
    '#,,,,,kkk,,,,,,,#',
    '#,,,,,kkk,,,,,,,#',
    '#,,,,,,k,,,,,,,,#',
    '#,p,,,,k,,,,,p,,#',
    '#,,,,,,k,,,,,,,,#',
    '#,,,,,,k,,,,,,,,#',
    '#,,,,,,,,,,,,,,,#',
    '#,,,,,,,>,,,,,,,#',
    '#,,,,,,,,,,,,,,,#',
    '#################',
  ],
  events: [
    { id: 'd2_down', type: 'warp', x: 8, y: 10, to: { map: 'dun_dark1', x: 12, y: 3 } },
    { id: 'd2_boss', type: 'boss', x: 6, y: 3, sprite: 15, flag: 'beat_shade',
      enemies: ['boss_shade1'], chain: ['boss_shade2'], script: 'shade',
      preMsg: ['玉座に深い闇が渦巻いている…', '「よくぞここまで来た、光の器よ。」', '「だが六輝の光も、この闇の前では無力と知れ！」'] },
  ],
};

// ============ 裏世界: 黄昏のエルデア ============
MAPS.shadow_world = {
  id: 'shadow_world', name: '黄昏のエルデア', tileset: 'world', rows: WORLD_ROWS,
  bgm: 'shadow', zones: [{ rect: [0, 0, 59, 43], table: 'shadowworld' }], outside: true,
  tint: 0x8877bb,
  events: [
    { id: 'sw_gate', type: 'trigger', x: 6, y: 6, script: 'shadowgate_back' },
    { id: 'sw_sanctum', type: 'warp', x: 31, y: 30, to: { map: 'dun_void', x: 10, y: 14 } },
    { id: 'sw_merchant', type: 'shop', x: 12, y: 24, sprite: 11, shop: 'shadow_shop',
      hello: '…こんな世界でも、商売は続けるさ。いい品があるよ。' },
    { id: 'sw_item', type: 'shop', x: 32, y: 16, sprite: 11, shop: 'shadow_item',
      hello: '生き残りの商人さ。何か要るかい？' },
    { id: 'sw_ghost', type: 'npc', x: 49, y: 24, sprite: 12,
      dialog: ['ここは滅びた可能性のエルデア…', '南の島の「虚無の聖域」に、混沌の神が座している。', '奴を討てば、すべての世界に真の平和が訪れるだろう。'] },
  ],
};

// ============ 虚無の聖域 (21x16) ============
MAPS.dun_void = {
  id: 'dun_void', name: '虚無の聖域', tileset: 'dungeon', bgm: 'dungeon2', enc: 'voidsanctum', tint: 0x9f8fd0,
  rows: [
    '#####################',
    '#,,,,,,,,,,,,,,,,,,,#',
    '#,p,,AAA,,,,,AAA,,p,#',
    '#,,,,AAA,,,,,AAA,,,,#',
    '#,,,,,,,,,,,,,,,,,,,#',
    '#,,##,##,,###,##,##,#',
    '#,,#,,,,,,,,,,,,,#,,#',
    '#,,#,##,#####,##,#,,#',
    '#,,,,#,,,,,,,,#,,,,,#',
    '#,##,#,,,,,,,,#,##,,#',
    '#,,#,#,,####,,#,#,,,#',
    '#,,,,,,,#,,#,,,,,,,,#',
    '#,####,,#,,#,,####,,#',
    '#,,,,,,,#,,#,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,#',
    '##########D##########',
  ],
  events: [
    { id: 'v_exit', type: 'edge', x: 10, y: 15, to: { map: 'shadow_world', x: 31, y: 31 } },
    { id: 'v_chest1', type: 'chest', x: 2, y: 13, item: 'ac_hero', flag: 'chest_v1' },
    { id: 'v_chest2', type: 'chest', x: 18, y: 13, item: 'herb3', flag: 'chest_v2' },
    { id: 'v_boss', type: 'boss', x: 10, y: 2, sprite: 15, flag: 'beat_azraus',
      enemies: ['boss_azraus'], script: 'azraus_end',
      preMsg: ['聖域の最奥、星のない空の下に「それ」はいた。', '「……面白イ。滅ビノ運命ニ抗ウ光ヨ」', '「混沌ノ渦ニ、共ニ堕チヨウゾ！」'] },
  ],
};
