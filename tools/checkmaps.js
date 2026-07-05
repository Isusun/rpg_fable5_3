// マップデータ検査スクリプト (node tools/checkmaps.js)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = vm.createContext({ Game: { orbCount: () => 0 }, console });
const codeAll = ['data.js', 'maps.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8').replace(/^'use strict';/m, ''))
  .join('\n') + '\nthis.MAPS = MAPS; this.TILE_DEFS = TILE_DEFS;';
vm.runInContext(codeAll, ctx, { filename: 'maps-bundle.js' });
const { MAPS, TILE_DEFS } = ctx;

let bad = 0;
for (const id of Object.keys(MAPS)) {
  const m = MAPS[id];
  const w = m.rows[0].length;
  m.rows.forEach((row, i) => {
    if (row.length !== w) {
      console.log(`[${id}] row ${i}: len ${row.length} != ${w}  | "${row}"`);
      bad++;
    }
    const ts = TILE_DEFS[m.tileset];
    for (const ch of row) {
      if (!ts[ch]) { console.log(`[${id}] row ${i}: unknown char '${ch}'`); bad++; }
    }
  });
  for (const ev of m.events || []) {
    if (ev.x == null || ev.y == null) continue;
    if (ev.x < 0 || ev.x >= w || ev.y < 0 || ev.y >= m.rows.length) {
      console.log(`[${id}] event ${ev.id} OOB (${ev.x},${ev.y}) map ${w}x${m.rows.length}`);
      bad++;
    }
  }
}
// イベント座標が壁でないか(warp/npc等の立ち位置)
for (const id of Object.keys(MAPS)) {
  const m = MAPS[id];
  const ts = TILE_DEFS[m.tileset];
  for (const ev of m.events || []) {
    const ch = m.rows[ev.y] && m.rows[ev.y][ev.x];
    const def = ch != null ? ts[ch] : null;
    if (def && def.solid && !['door', 'gate'].includes(ev.type)) {
      console.log(`[${id}] event ${ev.id} stands on SOLID tile '${ch}' at (${ev.x},${ev.y})`);
      bad++;
    }
  }
}
// ワープ先の検証
const walkable = (mapId, x, y) => {
  const m = MAPS[mapId];
  if (!m) return `no map ${mapId}`;
  const ch = m.rows[y] && m.rows[y][x];
  if (ch == null) return `OOB (${x},${y})`;
  const def = TILE_DEFS[m.tileset][ch];
  if (!def) return `unknown '${ch}'`;
  if (def.solid) return `solid '${ch}' at (${x},${y})`;
  return null;
};
for (const id of Object.keys(MAPS)) {
  for (const ev of MAPS[id].events || []) {
    for (const key of ['to', 'dest', 'warpInstead']) {
      if (ev[key]) {
        const err = walkable(ev[key].map, ev[key].x, ev[key].y);
        if (err) { console.log(`[${id}] ${ev.id}.${key} → ${ev[key].map}: ${err}`); bad++; }
      }
    }
  }
}
// 主要な開始/復帰座標
for (const [mapId, x, y, label] of [
  ['town_harbel', 13, 9, 'newgame start'],
  ['town_harbel', 13, 18, 'harbel entry'],
  ['shadow_world', 6, 7, 'shadow arrival'],
  ['world', 6, 7, 'world arrival from shadow'],
  ['world', 36, 37, 'ferry arrival'],
]) {
  const err = walkable(mapId, x, y);
  if (err) { console.log(`[start ${label}] ${err}`); bad++; }
}
// エンカウント設定(enc/zones)のあるマップに、encフラグ付き歩行可能タイルが存在するか
for (const id of Object.keys(MAPS)) {
  const m = MAPS[id];
  if (!m.enc && !m.zones) continue;
  const ts = TILE_DEFS[m.tileset];
  let encTiles = 0;
  for (const row of m.rows) for (const ch of row) {
    const def = ts[ch];
    if (def && !def.solid && def.enc) encTiles++;
  }
  if (encTiles === 0) { console.log(`[${id}] エンカウント設定があるのにencタイルが0(戦闘が発生しない)`); bad++; }
}
console.log(bad ? `\n${bad} problems` : 'ALL OK');
