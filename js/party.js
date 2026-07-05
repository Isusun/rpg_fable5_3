// ============================================================
// party.js - アクター生成・成長・装備・ステータス計算
// ============================================================
'use strict';

const Party = {
  // クラスsprite番号(キャラシートのセル)
  classSprite: { hero: 0, warrior: 1, mage: 2, priest: 3, thief: 4, monk: 5 },

  createActor(id, name, cls) {
    const a = {
      id, name, cls, lv: 1, exp: 0,
      hp: 0, mp: 0,
      equips: { weapon: null, armor: null, shield: null, acc: null },
    };
    const st = this.baseStats(a);
    a.hp = st.maxhp; a.mp = st.maxmp;
    return a;
  },
  normalizeActor(a) {
    a.lv = clamp(Math.floor(a.lv || 1), 1, MAX_LEVEL);
    a.exp = Math.max(0, Math.floor(a.exp || 0));
    a.equips = a.equips || { weapon: null, armor: null, shield: null, acc: null };
    for (const slot of ['weapon', 'armor', 'shield', 'acc']) {
      const eq = a.equips[slot];
      if (eq && (!EQUIPS[eq] || EQUIPS[eq].slot !== slot)) a.equips[slot] = null;
    }
    const st = this.calcStats(a);
    a.hp = clamp(Math.floor(a.hp ?? st.maxhp), 0, st.maxhp);
    a.mp = clamp(Math.floor(a.mp ?? st.maxmp), 0, st.maxmp);
  },

  // クラス+レベルの素のステータス
  baseStats(a) {
    const c = CLASSES[a.cls];
    const s = {};
    for (const k of ['hp', 'mp', 'atk', 'def', 'agi', 'mag', 'luk']) {
      s[k === 'hp' ? 'maxhp' : k === 'mp' ? 'maxmp' : k] =
        Math.max(k === 'mp' ? 0 : 1, Math.round(c.base[k] + c.gain[k] * (a.lv - 1)));
    }
    return s;
  },
  // 装備込みステータス
  calcStats(a) {
    const s = this.baseStats(a);
    for (const slot of ['weapon', 'armor', 'shield', 'acc']) {
      const eq = EQUIPS[a.equips[slot]];
      if (!eq) continue;
      for (const k of ['atk', 'def', 'agi', 'mag', 'luk']) {
        if (eq[k]) s[k] += eq[k];
      }
    }
    for (const k of Object.keys(s)) s[k] = clamp(s[k], k.startsWith('max') ? 0 : 1, 999);
    return s;
  },
  weaponElem(a) {
    const eq = EQUIPS[a.equips.weapon];
    return (eq && eq.elem) || 'phys';
  },
  equipResist(a, elem) {
    for (const slot of ['armor', 'shield']) {
      const eq = EQUIPS[a.equips[slot]];
      if (eq && eq.resist === elem) return 0.5;
    }
    return 1;
  },
  equipImmune(a, status) {
    const eq = EQUIPS[a.equips.acc];
    return !!(eq && eq.immune === status);
  },

  // 覚えているスキル一覧
  knownSkills(a) {
    const learn = CLASSES[a.cls].learn;
    const out = [];
    for (const lvStr of Object.keys(learn)) {
      if (a.lv >= +lvStr) out.push(learn[lvStr]);
    }
    return out;
  },
  // 経験値加算 → レベルアップ処理。 結果: [{name, lv, skills:[]}...]
  gainExp(a, exp) {
    const results = [];
    a.exp += exp;
    while (a.lv < MAX_LEVEL && a.exp >= expForLevel(a.lv + 1)) {
      const before = this.calcStats(a);
      a.lv++;
      const after = this.calcStats(a);
      // レベルアップでHP/MP全回復はしない。増加分だけ増やす
      a.hp = clamp(a.hp + (after.maxhp - before.maxhp), 1, after.maxhp);
      a.mp = clamp(a.mp + (after.maxmp - before.maxmp), 0, after.maxmp);
      const skills = [];
      const learn = CLASSES[a.cls].learn;
      if (learn[a.lv]) skills.push(SKILLS[learn[a.lv]].name);
      results.push({ name: a.name, lv: a.lv, skills });
    }
    return results;
  },

  // パーティ取得ヘルパ
  members() { return Game.state.party.map(id => Game.state.roster[id]); },
  aliveMembers() { return this.members().filter(a => a.hp > 0); },
  healAll() {
    for (const a of this.members()) {
      const st = this.calcStats(a);
      a.hp = st.maxhp; a.mp = st.maxmp;
    }
  },
  // 隊列位置: 0,1=前衛, 2,3=後衛
  isFrontRow(a) {
    const idx = Game.state.party.indexOf(a.id);
    return idx >= 0 && idx < 2;
  },
};
