// 到達性検査: 各マップで開始点から主要地点へ歩けるかBFS (node tools/reach.js)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = vm.createContext({ Game: { orbCount: () => 6 }, console });
const code = ['data.js', 'maps.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8').replace(/^'use strict';/m, ''))
  .join('\n') + '\nthis.MAPS = MAPS; this.TILE_DEFS = TILE_DEFS;';
vm.runInContext(code, ctx, { filename: 'bundle.js' });
const { MAPS, TILE_DEFS } = ctx;

function bfs(mapId, sx, sy) {
  const m = MAPS[mapId];
  const ts = TILE_DEFS[m.tileset];
  const w = m.rows[0].length, h = m.rows.length;
  // 常時通行不可のイベント(岩は押せるので通行可扱い、NPC/ボスは障害物)
  const solidEv = new Set();
  for (const ev of m.events || []) {
    if (ev.hideIf) continue; // 条件で消えるNPC(橋の衛兵等)は終盤想定で通行可
    if (['npc', 'shop', 'inn', 'church', 'tavern', 'ferry', 'boss'].includes(ev.type)) {
      solidEv.add(ev.x + ',' + ev.y);
    }
  }
  const seen = new Set([sx + ',' + sy]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, key = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(key)) continue;
      const def = ts[m.rows[ny][nx]];
      if (!def || def.solid) continue; // 'x'はorb6でsandになるが、rows上はxのまま→特別扱い
      if (solidEv.has(key)) continue;
      seen.add(key);
      q.push([nx, ny]);
    }
  }
  return seen;
}
// 'x'を通行可として扱うため一時的に置換したワールド
function worldOpen() {
  const m = MAPS.world;
  const rows = m.rows.map(r => r.replace(/x/g, 's'));
  return { ...m, rows };
}
MAPS.world_open = { ...worldOpen(), id: 'world_open' };

let bad = 0;
function check(mapId, sx, sy, targets) {
  const seen = bfs(mapId, sx, sy);
  const m = MAPS[mapId];
  for (const [label, tx, ty, adjacentOk] of targets) {
    let ok = seen.has(tx + ',' + ty);
    if (!ok && adjacentOk) {
      ok = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => seen.has((tx + dx) + ',' + (ty + dy)));
    }
    if (!ok) { console.log(`[${mapId}] UNREACHABLE: ${label} (${tx},${ty}) from (${sx},${sy})`); bad++; }
  }
}
const A = true; // 隣接到達でOK(solidイベント)

// ワールド西大陸(開始地点から)
check('world_open', 12, 25, [
  ['囁きの洞窟西', 21, 20], ['風唱の祠', 14, 6], ['黄昏の祠', 6, 6],
]);
// 設計確認: 西大陸から東へは洞窟経由でしか行けない
{
  const seen = bfs('world_open', 12, 25);
  if (seen.has('32,16')) { console.log('[world] 洞窟を迂回して東大陸に行けてしまう(設計崩壊)'); bad++; }
}
// 洞窟東側からの東エリア到達(洞窟経由後)
check('world_open', 24, 20, [['カルスト', 32, 16], ['メリア', 49, 24], ['遺跡', 46, 31], ['フレル', 45, 4]]);
// フェリー到着(36,37)から砂漠エリア
check('world_open', 36, 37, [['ザーラ', 28, 38], ['燃えさかる深淵', 13, 40], ['魔王城', 31, 30], ['船着き場NPC', 36, 36, A]]);
// 洞窟西側は西大陸から(結界なし状態=素のworld)
check('world', 12, 25, [['囁きの洞窟西', 21, 20], ['風唱の祠', 14, 6]]);

// 町: 入口→出口/施設(隣接可)
check('town_harbel', 13, 18, [
  ['出口', 13, 19], ['王様', 13, 3, A], ['宿屋', 2, 12, A], ['道具屋', 14, 12, A], ['武器屋前', 23, 13],
  ['酒場', 9, 12, A], ['教会', 21, 16, A], ['宝箱', 2, 4, A], ['開始位置', 13, 9],
]);
check('town_karst', 11, 15, [['出口', 10, 16], ['宿屋', 10, 3, A], ['長老', 3, 8, A], ['教会', 18, 9, A], ['宝箱', 3, 10, A]]);
check('town_meria', 12, 16, [['出口', 10, 17], ['道具屋', 2, 3, A], ['宿屋', 8, 3, A], ['武器屋', 16, 3, A], ['教会', 14, 8, A], ['渡し船', 9, 13, A], ['船主', 9, 8, A], ['宝箱', 17, 2, A]]);
check('town_zahra', 11, 15, [['出口', 11, 16], ['宿屋', 8, 3, A], ['道具屋', 17, 3, A], ['教会', 18, 10, A], ['賢者', 9, 10, A], ['宝箱', 9, 2, A]]);
check('town_frell', 10, 15, [['出口', 9, 16], ['宿屋', 7, 3, A], ['教会', 8, 10, A], ['長老', 4, 13, A], ['宝箱', 8, 2, A]]);

// ダンジョン
check('dun_cave', 1, 8, [['東出口', 22, 8], ['宝1', 5, 3, A], ['宝2', 20, 13, A], ['宝3', 3, 13, A], ['扉前', 10, 15], ['ボス階段', 10, 17]]);
check('dun_cave_boss', 5, 8, [['ボス', 5, 3, A], ['出口', 5, 9]]);
check('dun_ruins1', 11, 16, [['B2階段', 11, 7], ['宝1(古代のカギ)', 3, 12, A], ['宝2', 20, 12, A], ['宝3', 21, 1, A]]);
check('dun_ruins2', 10, 2, [['ボス', 10, 10, A], ['宝', 2, 12, A], ['上り階段', 10, 1]]);
check('dun_shrine', 9, 12, [['岩1', 5, 7, A], ['岩2', 13, 7, A], ['スイッチ1', 3, 10], ['スイッチ2', 15, 10], ['ゲート', 9, 4, A], ['宝', 17, 12, A]]);
check('dun_spire1', 9, 14, [['上り階段', 10, 7], ['宝1', 18, 1, A], ['宝2', 1, 14, A]]);
check('dun_spire2', 8, 10, [['ボス', 5, 3, A], ['宝', 15, 1, A], ['下り階段', 8, 8]]);
check('dun_ember1', 10, 14, [['下り階段', 13, 7], ['宝1', 20, 1, A], ['宝2', 1, 14, A]]);
check('dun_ember2', 9, 2, [['ボス', 9, 7, A], ['宝', 16, 11, A], ['上り階段', 9, 1]]);
check('dun_dark1', 11, 18, [['上り階段', 12, 3], ['宝1', 2, 2, A], ['宝2', 21, 2, A], ['宝3', 2, 18, A]]);
check('dun_dark2', 8, 9, [['魔王', 6, 3, A], ['下り階段', 8, 10]]);
check('dun_void', 10, 14, [['裏ボス', 10, 2, A], ['宝1', 2, 13, A], ['宝2', 18, 13, A], ['出口', 10, 15]]);

// ゲート閉鎖時に祠のボスへ到達できない(パズルが意味を持つ)ことも確認
{
  const m = MAPS.dun_shrine;
  const gate = m.events.find(e => e.type === 'gate');
  const solidGate = new Set([gate.x + ',' + gate.y]);
  const ts = TILE_DEFS[m.tileset];
  const w = m.rows[0].length, h = m.rows.length;
  const seen = new Set(['9,12']);
  const q = [[9, 12]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, key = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(key) || solidGate.has(key)) continue;
      const def = ts[m.rows[ny][nx]];
      if (!def || def.solid) continue;
      seen.add(key);
      q.push([nx, ny]);
    }
  }
  const boss = m.events.find(e => e.type === 'boss');
  const bossReach = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => seen.has((boss.x + dx) + ',' + (boss.y + dy)));
  if (bossReach) { console.log('[dun_shrine] ゲート閉鎖時にボスへ到達できてしまう(パズル無意味)'); bad++; }
}

console.log(bad ? `\n${bad} unreachable` : 'ALL REACHABLE');
