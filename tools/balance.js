// 戦闘バランス簡易シミュレーション (node tools/balance.js)
// 各ゾーンの想定レベル/装備で、与ダメ・被ダメ・撃破ターン数を概算する
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = vm.createContext({ console });
const code = ['data.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8').replace(/^'use strict';/m, '')).join('\n')
  + '\nthis.CLASSES=CLASSES; this.ENEMIES=ENEMIES; this.EQUIPS=EQUIPS; this.SKILLS=SKILLS; this.expForLevel=expForLevel;';
vm.runInContext(code, ctx);
const { CLASSES, ENEMIES, EQUIPS, expForLevel } = ctx;

function stat(cls, lv, k) {
  const c = CLASSES[cls];
  return Math.max(1, Math.round(c.base[k] + c.gain[k] * (lv - 1)));
}
// [ゾーン, 想定Lv, 前衛武器atk, 防具def, 代表雑魚, ボス]
const ZONES = [
  ['序盤平原', 2, 7, 3, ['puni', 'fieldrat', 'thornworm'], null],
  ['洞窟', 4, 7, 3, ['gnome', 'toadstool', 'skelsoldier'], 'boss_gand'],
  ['東平原/海岸', 8, 14, 10, ['mancrab', 'seaserpent'], null],
  ['遺跡', 10, 14, 13, ['jellymage', 'drownedarmor'], 'boss_rival'],
  ['砂漠', 13, 24, 20, ['sandworm', 'dunebandit', 'mummy'], null],
  ['火山', 15, 24, 22, ['firelizard', 'lavaturtle', 'flamedjinn'], 'boss_ignas'],
  ['祠(風)', 12, 24, 20, [], 'boss_zeph'],
  ['雪原', 17, 34, 28, ['snowwolf', 'icegolem', 'frostsprite'], null],
  ['尖塔', 19, 34, 30, [], 'boss_frimd'],
  ['魔王城', 23, 46, 36, ['darkknight', 'deathmage', 'gargoyle'], 'boss_shade2'],
  ['裏世界', 28, 46, 44, ['voidshade', 'abysseye', 'chaosdragon'], 'boss_azraus'],
];

function physDmg(atk, def) { return Math.max(1, (atk - def / 2) / 2); }

console.log('ゾーン | Lv | 戦士与dmg(敵HP→撃破打数) | 敵与dmg(勇者HP) | 魔法与dmg');
for (const [name, lv, watk, adef, mobs, boss] of ZONES) {
  const atkW = stat('warrior', lv, 'atk') + watk;
  const atkH = stat('hero', lv, 'atk') + watk;
  const defH = stat('hero', lv, 'def') + adef;
  const hpH = stat('hero', lv, 'hp');
  const mag = stat('mage', lv, 'mag');
  // 魔法: レベル帯の代表スキル
  const spellPow = lv < 6 ? 16 : lv < 11 ? 38 : lv < 17 ? 48 : lv < 24 ? 78 : 78;
  const spellDmg = Math.floor(spellPow * (1 + mag / 45));
  for (const mid of mobs) {
    const e = ENEMIES[mid];
    const d = physDmg(atkW, e.def);
    const taken = physDmg(e.atk, defH);
    console.log(`${name} Lv${lv} vs ${e.name}: 与${d.toFixed(0)} (HP${e.hp}→${Math.ceil(e.hp / d)}発) | 被${taken.toFixed(0)}/${hpH}HP (${Math.ceil(hpH / taken)}発で死) | 魔${spellDmg}`);
  }
  if (boss) {
    const e = ENEMIES[boss];
    const d = physDmg(atkW, e.def);
    const taken = physDmg(e.atk, defH);
    const partyDpt = d * 2 + spellDmg; // 前衛2人+魔法1(僧侶は回復)
    const turns = Math.ceil(e.hp / partyDpt);
    const healPow = lv < 9 ? 30 : lv < 22 ? 80 : 200;
    console.log(`>> BOSS ${e.name}: HP${e.hp} 討伐${turns}T | ボス与${taken.toFixed(0)}dmg vs 勇者HP${hpH} (${Math.ceil(hpH / taken)}発) | 回復力${healPow}/T`);
  }
}
