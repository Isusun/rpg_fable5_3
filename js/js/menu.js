// ============================================================
// menu.js - メインメニュー・ショップ・酒場・設定
// ============================================================
'use strict';

// ---- メインメニュー(フィールドから) ----
class MenuScene {
  constructor() {
    this.container = new PIXI.Container();
    this.widgets = [];
  }
  enter() {
    // 半透明背景
    const dim = new PIXI.Graphics();
    dim.rect(0, 0, VIEW_W, VIEW_H).fill({ color: 0x000000, alpha: 0.55 });
    this.container.addChild(dim);
    this.msg = null;
    this.showMain();
  }
  exit() {}
  update(dt) {
    if (this.msg && this.msg.busy) { this.msg.update(dt); return; }
    for (const w of [...this.widgets].reverse()) {
      if (w && w.update) { w.update(dt); break; }
    }
  }
  clearWidgets(keep = 0) {
    while (this.widgets.length > keep) {
      const w = this.widgets.pop();
      w.destroy && w.destroy();
      if (w.container && w.container.parent) w.container.parent.removeChild(w.container);
    }
  }
  addWidget(w) { this.widgets.push(w); this.container.addChild(w.container); return w; }
  ensureMsg() {
    if (!this.msg) this.msg = new MsgWindow(this.container);
    return this.msg;
  }
  close() { SceneMgr.pop(); }

  // ==== トップ ====
  showMain() {
    this.clearWidgets();
    this.drawPartySummary();
    this.drawGoldWindow();
    const items = [
      { label: T.menuStatus }, { label: T.menuSkill }, { label: T.menuItem },
      { label: T.menuEquip }, { label: T.menuFormation }, { label: T.menuSettings },
      { label: T.menuSave }, { label: T.menuClose },
    ];
    this.mainMenu = this.addWidget(new Menu({
      items, x: 24, y: 24, w: 210, rowH: 40, visibleRows: 8,
      index: this._mainIdx || 0,
      onOk: (i) => {
        this._mainIdx = i;
        switch (i) {
          case 0: this.showStatus(); break;
          case 1: this.showSkills(); break;
          case 2: this.showItems(); break;
          case 3: this.showEquip(); break;
          case 4: this.showFormation(); break;
          case 5: this.showSettings(); break;
          case 6: this.doSave(); break;
          case 7: this.close(); break;
        }
      },
      onCancel: () => this.close(),
    }));
  }
  drawGoldWindow() {
    const c = new PIXI.Container();
    c.addChild(UI.window(210, 88));
    const g = UI.text(`${Game.state.gold} ${T.gold}`, 20, UI.colors.gold, { bold: true });
    g.x = 18; g.y = 10;
    c.addChild(g);
    const orbs = UI.text(T.orbCount(Game.orbCount()), 16);
    orbs.x = 18; orbs.y = 46;
    c.addChild(orbs);
    c.x = 24; c.y = VIEW_H - 112;
    this.container.addChild(c);
    this.widgets.push({ container: c, destroy: () => c.destroy({ children: true }) });
  }
  drawPartySummary(highlight = -1) {
    if (this.summaryC) { this.summaryC.destroy({ children: true }); }
    const c = new PIXI.Container();
    c.x = 250; c.y = 24;
    Party.members().forEach((a, i) => {
      const st = Party.calcStats(a);
      const w = 168;
      const cell = new PIXI.Container();
      cell.x = i * (w + 8);
      cell.addChild(UI.window(w, 150, highlight === i ? { border: UI.colors.cursor } : {}));
      const face = new PIXI.Sprite(Game.sheets.chars[Party.classSprite[a.cls]]);
      face.width = 44; face.height = 44;
      face.x = 12; face.y = 10;
      cell.addChild(face);
      const name = UI.text(a.name, 16, null, { bold: true });
      name.x = 62; name.y = 12;
      cell.addChild(name);
      const cls = UI.text(`${CLASSES[a.cls].name} Lv${a.lv}`, 13, UI.colors.textDim);
      cls.x = 62; cls.y = 36;
      cell.addChild(cls);
      const hp = UI.text(`HP ${a.hp}/${st.maxhp}`, 14, a.hp <= 0 ? UI.colors.danger : null);
      hp.x = 12; hp.y = 62;
      cell.addChild(hp);
      const hg = UI.gauge(w - 24, 8, a.hp / st.maxhp, UI.hpColor(a.hp / st.maxhp));
      hg.x = 12; hg.y = 84;
      cell.addChild(hg);
      const mp = UI.text(`MP ${a.mp}/${st.maxmp}`, 14);
      mp.x = 12; mp.y = 96;
      cell.addChild(mp);
      const mg = UI.gauge(w - 24, 6, st.maxmp ? a.mp / st.maxmp : 0, UI.colors.mp);
      mg.x = 12; mg.y = 118;
      cell.addChild(mg);
      const pos = UI.text(i < 2 ? '前衛' : '後衛', 12, UI.colors.textDim);
      pos.x = w - 44; pos.y = 128;
      cell.addChild(pos);
      c.addChild(cell);
    });
    this.container.addChild(c);
    this.summaryC = c;
  }
  // メンバー選択メニュー
  pickMember(cb, onCancel) {
    const members = Party.members();
    const menu = this.addWidget(new Menu({
      items: members.map(a => ({ label: `${a.name} (${CLASSES[a.cls].name})` })),
      x: 250, y: 190, w: 300, rowH: 38, visibleRows: members.length,
      onOk: (i) => cb(members[i], i),
      onCancel: onCancel || (() => { this.clearWidgets(this.widgets.length - 1); }),
    }));
    return menu;
  }

  // ==== つよさ ====
  showStatus() {
    this.clearWidgets(2); // mainMenu, gold
    this.pickMember((a) => this.showStatusDetail(a), () => this.showMain());
  }
  showStatusDetail(a) {
    this.clearWidgets(2);
    const st = Party.calcStats(a);
    const base = Party.baseStats(a);
    const c = new PIXI.Container();
    c.x = 250; c.y = 190;
    const w = 660, h = 320;
    c.addChild(UI.window(w, h));
    const title = UI.text(`${a.name}  ${CLASSES[a.cls].name}  Lv${a.lv}`, 20, null, { bold: true });
    title.x = 20; title.y = 14;
    c.addChild(title);
    const lines1 = [
      [T.statHp, `${a.hp} / ${st.maxhp}`],
      [T.statMp, `${a.mp} / ${st.maxmp}`],
      [T.statExp, `${a.exp}`],
      [T.statNext, a.lv >= MAX_LEVEL ? '---' : `${expForLevel(a.lv + 1) - a.exp}`],
    ];
    const lines2 = [
      [T.statAtk, st.atk, st.atk - base.atk], [T.statDef, st.def, st.def - base.def],
      [T.statAgi, st.agi, st.agi - base.agi], [T.statMag, st.mag, st.mag - base.mag],
      [T.statLuk, st.luk, st.luk - base.luk],
    ];
    lines1.forEach(([k, v], i) => {
      const kt = UI.text(k, 17, UI.colors.textDim); kt.x = 24; kt.y = 58 + i * 32;
      const vt = UI.text(String(v), 17); vt.x = 140; vt.y = 58 + i * 32;
      c.addChild(kt, vt);
    });
    lines2.forEach(([k, v, bonus], i) => {
      const kt = UI.text(k, 17, UI.colors.textDim); kt.x = 24; kt.y = 196 + i * 24;
      const vt = UI.text(`${v}` + (bonus ? ` (+${bonus})` : ''), 17, bonus ? UI.colors.good : null);
      vt.x = 140; vt.y = 196 + i * 24;
      c.addChild(kt, vt);
    });
    // 装備欄
    const slots = [['weapon', T.slotWeapon], ['armor', T.slotArmor], ['shield', T.slotShield], ['acc', T.slotAcc]];
    slots.forEach(([slot, label], i) => {
      const kt = UI.text(label, 17, UI.colors.textDim); kt.x = 340; kt.y = 58 + i * 32;
      const eq = EQUIPS[a.equips[slot]];
      const vt = UI.text(eq ? eq.name : T.equipNone, 17); vt.x = 440; vt.y = 58 + i * 32;
      c.addChild(kt, vt);
    });
    const hint = UI.text('Bボタン/Escでもどる', 14, UI.colors.textDim);
    hint.x = w - 190; hint.y = h - 30;
    c.addChild(hint);
    this.container.addChild(c);
    this.widgets.push({
      container: c,
      destroy: () => c.destroy({ children: true }),
      update: (dt) => { if (Input.hit('cancel') || Input.hit('ok')) { AudioSys.se('cancel'); this.showStatus(); } },
    });
  }

  // ==== スキル ====
  showSkills() {
    this.clearWidgets(2);
    this.pickMember((a) => this.showSkillList(a), () => this.showMain());
  }
  showSkillList(a) {
    this.clearWidgets(2);
    const skills = Party.knownSkills(a);
    const help = UI.text('', 15, UI.colors.textDim, { wrap: true, wrapWidth: 620 });
    help.x = 262; help.y = 500;
    this.container.addChild(help);
    const helpW = { container: help, destroy: () => help.destroy() };
    if (!skills.length) {
      this.ensureMsg().say(`${a.name}はまだスキルを覚えていない。レベルを上げよう。`).then(() => this.showSkills());
      return;
    }
    const items = skills.map(id => ({
      label: SKILLS[id].name, right: `MP${SKILLS[id].mp}`,
      disabled: !this.skillUsableInField(SKILLS[id]) || a.mp < SKILLS[id].mp,
    }));
    const menu = this.addWidget(new Menu({
      items, x: 250, y: 190, w: 400, rowH: 36, visibleRows: 8,
      onChange: (i) => { help.text = SKILLS[skills[i]].desc || ''; },
      onOk: async (i) => {
        const s = SKILLS[skills[i]];
        // フィールドで使えるのは回復系のみ
        await this.useFieldSkill(a, skills[i]);
      },
      onCancel: () => { this.showSkills(); },
    }));
    help.text = SKILLS[skills[0]].desc || '';
    this.widgets.push(helpW);
  }
  skillUsableInField(s) {
    return ['heal', 'cure', 'revive'].includes(s.kind);
  }
  async useFieldSkill(a, skillId) {
    const s = SKILLS[skillId];
    if (a.mp < s.mp) { await this.ensureMsg().say(T.notEnoughMp); return; }
    // 対象選択
    this.pickTargetMember(s.kind === 'revive', async (t) => {
      if (!t) return;
      const st = Party.calcStats(t);
      if (s.kind === 'heal') {
        if (t.hp <= 0 || t.hp >= st.maxhp) { await this.ensureMsg().say(T.itemNoEffect); return; }
        a.mp -= s.mp;
        const v = Math.min(st.maxhp - t.hp, Math.floor(s.power * (1 + Party.calcStats(a).mag / 60)));
        t.hp += v;
        AudioSys.se('heal');
        await this.ensureMsg().say(T.heal(t.name, v));
      } else if (s.kind === 'cure') {
        await this.ensureMsg().say(T.itemNoEffect); // フィールドでは状態異常が残らない仕様
      } else if (s.kind === 'revive') {
        if (t.hp > 0) { await this.ensureMsg().say(T.itemNoEffect); return; }
        a.mp -= s.mp;
        t.hp = Math.max(1, Math.floor(st.maxhp * s.power));
        AudioSys.se('heal');
        await this.ensureMsg().say(T.revived(t.name));
      }
      this.drawPartySummary();
    });
  }
  pickTargetMember(deadOnly, cb) {
    const pool = Party.members().filter(m => deadOnly ? m.hp <= 0 : true);
    if (!pool.length) { this.ensureMsg().say(T.itemNoEffect); return; }
    const menu = this.addWidget(new Menu({
      items: pool.map(m => ({ label: `${m.name}  HP${m.hp}`, color: m.hp <= 0 ? UI.colors.danger : null })),
      x: 480, y: 250, w: 280, rowH: 38, visibleRows: Math.min(4, pool.length),
      onOk: (i) => { this.clearWidgets(this.widgets.length - 1); cb(pool[i]); },
      onCancel: () => { this.clearWidgets(this.widgets.length - 1); cb(null); },
    }));
  }

  // ==== どうぐ ====
  showItems() {
    this.clearWidgets(2);
    const ids = Object.keys(Game.state.inv);
    if (!ids.length) {
      this.ensureMsg().say(T.itemNoItems).then(() => this.showMain());
      return;
    }
    const help = UI.text('', 15, UI.colors.textDim, { wrap: true, wrapWidth: 620 });
    help.x = 262; help.y = 520;
    this.container.addChild(help);
    this.widgets.push({ container: help, destroy: () => help.destroy() });
    const mkItems = () => Object.keys(Game.state.inv).map(id => {
      const it = ITEMS[id] || EQUIPS[id];
      const isEq = !ITEMS[id];
      return {
        label: it.name, right: `×${Game.state.inv[id]}`, id,
        disabled: isEq || !(ITEMS[id] && ITEMS[id].usableField),
      };
    });
    const menu = this.addWidget(new Menu({
      items: mkItems(), x: 250, y: 190, w: 420, rowH: 36, visibleRows: 8,
      onChange: (i) => {
        const id = menu.items[i]?.id;
        const it = ITEMS[id] || EQUIPS[id];
        help.text = it ? (it.desc || equipDesc(it)) : '';
      },
      onOk: async (i) => {
        const id = menu.items[i].id;
        await this.useFieldItem(id, () => {
          const items = mkItems();
          if (!items.length) { this.showMain(); return; }
          menu.setItems(items, true);
          this.drawPartySummary();
        });
      },
      onCancel: () => this.showMain(),
    }));
    if (menu.items.length) {
      const it0 = ITEMS[menu.items[0].id] || EQUIPS[menu.items[0].id];
      help.text = it0.desc || equipDesc(it0);
    }
  }
  async useFieldItem(id, refresh) {
    const it = ITEMS[id];
    if (!it || !it.usableField) { await this.ensureMsg().say(T.itemCannotUse); return; }
    if (it.kind === 'teleport') {
      const inn = Game.state.lastInn;
      Game.removeItem(id);
      this.close();
      const fs = SceneMgr.current;
      Fader.fadeOut(0.4, () => {
        SceneMgr.replace(new FieldScene(inn.map, inn.x, inn.y, 'down'));
        Fader.fadeIn(0.4);
      });
      return;
    }
    this.pickTargetMember(it.kind === 'revive', async (t) => {
      if (!t) return;
      const st = Party.calcStats(t);
      if (it.kind === 'heal') {
        if (t.hp <= 0 || t.hp >= st.maxhp) { await this.ensureMsg().say(T.itemNoEffect); return; }
        Game.removeItem(id);
        const v = Math.min(st.maxhp - t.hp, it.power);
        t.hp += v;
        AudioSys.se('heal');
        await this.ensureMsg().say(T.heal(t.name, v));
      } else if (it.kind === 'healmp') {
        if (t.hp <= 0 || t.mp >= st.maxmp) { await this.ensureMsg().say(T.itemNoEffect); return; }
        Game.removeItem(id);
        const v = Math.min(st.maxmp - t.mp, it.power);
        t.mp += v;
        AudioSys.se('heal');
        await this.ensureMsg().say(T.healMp(t.name, v));
      } else if (it.kind === 'revive') {
        if (t.hp > 0) { await this.ensureMsg().say(T.itemNoEffect); return; }
        Game.removeItem(id);
        t.hp = Math.max(1, Math.floor(st.maxhp * it.power));
        AudioSys.se('heal');
        await this.ensureMsg().say(T.revived(t.name));
      } else if (it.kind === 'cure') {
        // フィールドでは状態異常なし(死亡以外)
        await this.ensureMsg().say(T.itemNoEffect);
        return;
      }
      refresh();
    });
  }

  // ==== そうび ====
  showEquip() {
    this.clearWidgets(2);
    this.pickMember((a) => this.showEquipSlots(a), () => this.showMain());
  }
  showEquipSlots(a) {
    this.clearWidgets(2);
    const slots = [['weapon', T.slotWeapon], ['armor', T.slotArmor], ['shield', T.slotShield], ['acc', T.slotAcc]];
    const statBox = this.makeStatCompare(a);
    const menu = this.addWidget(new Menu({
      items: slots.map(([slot, label]) => ({
        label: `${label}：${EQUIPS[a.equips[slot]] ? EQUIPS[a.equips[slot]].name : T.equipNone}`,
      })),
      x: 250, y: 190, w: 400, rowH: 40, visibleRows: 4,
      onOk: (i) => this.showEquipChoices(a, slots[i][0]),
      onCancel: () => { statBox.destroy(); this.showEquip(); },
    }));
    this.widgets.push({ container: statBox.c, destroy: () => statBox.destroy() });
  }
  makeStatCompare(a, previewSlot, previewId) {
    const c = new PIXI.Container();
    c.x = 670; c.y = 190;
    const draw = () => {
      c.removeChildren().forEach(x => x.destroy({ children: true }));
      c.addChild(UI.window(260, 240));
      const cur = Party.calcStats(a);
      let next = cur;
      if (previewSlot !== undefined) {
        const saved = a.equips[previewSlot];
        a.equips[previewSlot] = previewId;
        next = Party.calcStats(a);
        a.equips[previewSlot] = saved;
      }
      const rows = [['maxhp', T.statHp], ['atk', T.statAtk], ['def', T.statDef], ['agi', T.statAgi], ['mag', T.statMag], ['luk', T.statLuk]];
      rows.forEach(([k, label], i) => {
        const kt = UI.text(label, 15, UI.colors.textDim); kt.x = 16; kt.y = 14 + i * 34;
        const diff = next[k] - cur[k];
        const col = diff > 0 ? UI.colors.good : diff < 0 ? UI.colors.danger : null;
        const vt = UI.text(`${cur[k]}${diff !== 0 ? ` → ${next[k]}` : ''}`, 15, col);
        vt.x = 110; vt.y = 14 + i * 34;
        c.addChild(kt, vt);
      });
    };
    draw();
    this.container.addChild(c);
    return { c, draw: (slot, id) => { previewSlot = slot; previewId = id; draw(); }, destroy: () => c.destroy({ children: true }) };
  }
  showEquipChoices(a, slot) {
    this.clearWidgets(2);
    const statBox = this.makeStatCompare(a);
    // 所持している該当スロット装備
    const owned = Object.keys(Game.state.inv).filter(id => EQUIPS[id] && EQUIPS[id].slot === slot);
    const items = [{ label: T.equipNone, id: null }];
    for (const id of owned) {
      const eq = EQUIPS[id];
      items.push({ label: eq.name, right: `×${Game.state.inv[id]}`, id, disabled: !canEquip(a.cls, eq) });
    }
    const menu = this.addWidget(new Menu({
      items, x: 250, y: 190, w: 400, rowH: 36, visibleRows: 8,
      onChange: (i) => statBox.draw(slot, items[i].id),
      onOk: (i) => {
        const newId = items[i].id;
        const oldId = a.equips[slot];
        if (newId === oldId) { statBox.destroy(); this.showEquipSlots(a); return; }
        if (newId) {
          if (!canEquip(a.cls, EQUIPS[newId])) { this.ensureMsg().say(T.equipCannot); return; }
          Game.removeItem(newId);
        }
        if (oldId) Game.addItem(oldId);
        a.equips[slot] = newId;
        AudioSys.se('ok');
        statBox.destroy();
        this.drawPartySummary();
        this.showEquipSlots(a);
      },
      onCancel: () => { statBox.destroy(); this.showEquipSlots(a); },
    }));
    statBox.draw(slot, items[0].id);
    this.widgets.push({ container: statBox.c, destroy: () => statBox.destroy() });
  }

  // ==== ならびかえ ====
  showFormation() {
    this.clearWidgets(2);
    this.ensureMsg();
    const members = Party.members();
    let first = -1;
    const mkItems = () => Party.members().map((a, i) => ({
      label: `${i + 1}. ${a.name} (${i < 2 ? '前衛' : '後衛'})`,
      color: i === first ? UI.colors.cursor : null,
    }));
    const menu = this.addWidget(new Menu({
      items: mkItems(), x: 250, y: 190, w: 360, rowH: 40, visibleRows: 4,
      onOk: (i) => {
        if (first < 0) { first = i; menu.setItems(mkItems(), true); }
        else {
          const p = Game.state.party;
          [p[first], p[i]] = [p[i], p[first]];
          first = -1;
          AudioSys.se('ok');
          menu.setItems(mkItems(), true);
          this.drawPartySummary();
        }
      },
      onCancel: () => this.showMain(),
    }));
    const hint = UI.text(T.formationHint, 15, UI.colors.textDim);
    hint.x = 262; hint.y = 370;
    this.container.addChild(hint);
    this.widgets.push({ container: hint, destroy: () => hint.destroy() });
  }

  // ==== せってい ====
  showSettings() {
    this.clearWidgets(2);
    const mkItems = () => [
      { label: T.settingBgm, right: AudioSys.settings.bgmOn ? T.settingOn : T.settingOff },
      { label: T.settingSe, right: AudioSys.settings.seOn ? T.settingOn : T.settingOff },
      { label: T.settingVolume, right: `${Math.round(AudioSys.settings.volume * 10)} / 10` },
      { label: T.settingReduceFx, right: Game.reducedMotion ? T.settingOn : T.settingOff },
    ];
    const menu = this.addWidget(new Menu({
      items: mkItems(), x: 250, y: 190, w: 400, rowH: 42, visibleRows: 4,
      onOk: (i) => {
        if (i === 0) AudioSys.setBgmOn(!AudioSys.settings.bgmOn);
        if (i === 1) { AudioSys.setSeOn(!AudioSys.settings.seOn); AudioSys.se('ok'); }
        if (i === 2) AudioSys.setVolume(AudioSys.settings.volume >= 1 ? 0.1 : AudioSys.settings.volume + 0.1);
        if (i === 3) Game.reducedMotion = !Game.reducedMotion;
        Game.saveSettings();
        menu.setItems(mkItems(), true);
        if (i === 0 && AudioSys.settings.bgmOn) AudioSys.playBgm(MAPS[Game.state.map].bgm || 'field', true);
      },
      onCancel: () => this.showMain(),
    }));
    const hint = UI.text('決定キーで切替(設定は自動保存されます)', 15, UI.colors.textDim);
    hint.x = 262; hint.y = 380;
    this.container.addChild(hint);
    this.widgets.push({ container: hint, destroy: () => hint.destroy() });
  }

  // ==== セーブ ====
  async doSave() {
    const ok = Game.save();
    AudioSys.se(ok ? 'save' : 'buzzer');
    await this.ensureMsg().say(ok ? T.saveDone : T.saveFailed);
    this.showMain();
  }
}

// 装備の説明文生成
function equipDesc(eq) {
  const parts = [];
  for (const [k, label] of [['atk', T.statAtk], ['def', T.statDef], ['agi', T.statAgi], ['mag', T.statMag], ['luk', T.statLuk]]) {
    if (eq[k]) parts.push(`${label}${eq[k] > 0 ? '+' : ''}${eq[k]}`);
  }
  if (eq.elem) parts.push(`${ELEM_NAMES[eq.elem]}属性`);
  if (eq.resist) parts.push(`${ELEM_NAMES[eq.resist]}耐性`);
  if (eq.immune) parts.push(`${STATUS_NAMES[eq.immune]}無効`);
  return parts.join(' ') || '特殊な効果はない';
}

// ---- ショップ ----
class ShopScene {
  constructor(shopId) {
    this.container = new PIXI.Container();
    this.shop = SHOPS[shopId];
  }
  enter() {
    const dim = new PIXI.Graphics();
    dim.rect(0, 0, VIEW_W, VIEW_H).fill({ color: 0x000000, alpha: 0.55 });
    this.container.addChild(dim);
    this.msg = new MsgWindow(this.container);
    this.widgets = [];
    this.goldLabel = null;
    this.showTop();
  }
  exit() {}
  update(dt) {
    if (NameInput.current) { NameInput.current.update(dt); return; }
    if (this.msg.busy) { this.msg.update(dt); return; }
    const w = this.widgets[this.widgets.length - 1];
    if (w && w.update) w.update(dt);
  }
  clearW() {
    while (this.widgets.length) {
      const w = this.widgets.pop();
      w.destroy && w.destroy();
    }
    if (this.goldC) { this.goldC.destroy({ children: true }); this.goldC = null; }
  }
  drawGold() {
    if (this.goldC) this.goldC.destroy({ children: true });
    const c = new PIXI.Container();
    c.addChild(UI.window(240, 60));
    const t = UI.text(`所持金：${Game.state.gold} ${T.gold}`, 18, UI.colors.gold);
    t.x = 16; t.y = 16;
    c.addChild(t);
    c.x = VIEW_W - 264; c.y = 24;
    this.container.addChild(c);
    this.goldC = c;
  }
  showTop() {
    this.clearW();
    this.drawGold();
    const menu = new Menu({
      items: [{ label: T.shopBuy }, { label: T.shopSell }, { label: T.shopLeave }],
      x: 24, y: 24, w: 200, rowH: 42, visibleRows: 3,
      onOk: (i) => {
        if (i === 0) this.showBuy();
        else if (i === 1) this.showSell();
        else SceneMgr.pop();
      },
      onCancel: () => SceneMgr.pop(),
    });
    this.widgets.push(menu);
    this.container.addChild(menu.container);
  }
  showBuy() {
    this.clearW();
    this.drawGold();
    const helpBox = new PIXI.Container();
    helpBox.addChild(UI.window(440, 150));
    const help = UI.text('', 15, UI.colors.textDim, { wrap: true, wrapWidth: 400 });
    help.x = 18; help.y = 14;
    helpBox.addChild(help);
    helpBox.x = 470; helpBox.y = 100;
    this.container.addChild(helpBox);
    this.widgets.push({ container: helpBox, destroy: () => helpBox.destroy({ children: true }) });
    const stock = this.shop.stock;
    const mkItems = () => stock.map(id => {
      const it = ITEMS[id] || EQUIPS[id];
      return { label: it.name, right: `${it.price}G`, id, disabled: it.price > Game.state.gold };
    });
    const menu = new Menu({
      items: mkItems(), x: 24, y: 24, w: 430, rowH: 36, visibleRows: 10,
      onChange: (i) => this.updateBuyHelp(help, stock[i]),
      onOk: async (i) => {
        const id = stock[i];
        const it = ITEMS[id] || EQUIPS[id];
        if (Game.state.gold < it.price) { await this.msg.say(T.shopNoMoney); return; }
        Game.state.gold -= it.price;
        Game.addItem(id);
        AudioSys.se('chest');
        this.drawGold();
        menu.setItems(mkItems(), true);
        await this.msg.say(T.shopBought(it.name) + (EQUIPS[id] ? ' そうびはメニューから！' : ''));
      },
      onCancel: () => this.showTop(),
    });
    this.updateBuyHelp(help, stock[0]);
    this.widgets.push(menu);
    this.container.addChild(menu.container);
  }
  updateBuyHelp(help, id) {
    const it = ITEMS[id] || EQUIPS[id];
    if (ITEMS[id]) { help.text = it.desc; return; }
    // 装備: 誰が装備できるか
    const who = Object.keys(CLASSES).filter(c => canEquip(c, it)).map(c => CLASSES[c].name).join('・');
    help.text = `${equipDesc(it)}｜装備可：${who}`;
  }
  showSell() {
    this.clearW();
    this.drawGold();
    const sellable = () => Object.keys(Game.state.inv).filter(id => {
      const it = ITEMS[id] || EQUIPS[id];
      return it && it.kind !== 'key' && !it.noSell && it.price > 0;
    });
    if (!sellable().length) {
      this.msg.say(T.shopNothingToSell).then(() => this.showTop());
      return;
    }
    const mkItems = () => sellable().map(id => {
      const it = ITEMS[id] || EQUIPS[id];
      return { label: it.name, right: `${Math.floor(it.price / 2)}G ×${Game.state.inv[id]}`, id };
    });
    const menu = new Menu({
      items: mkItems(), x: 24, y: 24, w: 460, rowH: 36, visibleRows: 10,
      onOk: async (i) => {
        const id = menu.items[i].id;
        const it = ITEMS[id] || EQUIPS[id];
        const g = Math.floor(it.price / 2);
        Game.removeItem(id);
        Game.state.gold += g;
        AudioSys.se('chest');
        this.drawGold();
        const items = mkItems();
        if (!items.length) { await this.msg.say(T.shopSold(it.name, g)); this.showTop(); return; }
        menu.setItems(items, true);
        await this.msg.say(T.shopSold(it.name, g));
      },
      onCancel: () => this.showTop(),
    });
    this.widgets.push(menu);
    this.container.addChild(menu.container);
  }
}

// ---- 酒場(キャラ作成・入替) ----
const PRESET_NAMES = ['アルト', 'ミラ', 'ガイン', 'セラ', 'ロッド', 'ユナ', 'ダイン', 'リコ'];
class TavernScene {
  constructor() {
    this.container = new PIXI.Container();
  }
  enter() {
    const dim = new PIXI.Graphics();
    dim.rect(0, 0, VIEW_W, VIEW_H).fill({ color: 0x000000, alpha: 0.6 });
    this.container.addChild(dim);
    const title = UI.text(T.tavernTitle, 24, null, { bold: true, stroke: true });
    title.x = 30; title.y = 20;
    this.container.addChild(title);
    this.msg = new MsgWindow(this.container);
    this.widgets = [];
    this.showTop();
  }
  exit() {}
  update(dt) {
    if (NameInput.current) { NameInput.current.update(dt); return; }
    if (this.msg.busy) { this.msg.update(dt); return; }
    const w = this.widgets[this.widgets.length - 1];
    if (w && w.update) w.update(dt);
  }
  clearW() {
    while (this.widgets.length) { const w = this.widgets.pop(); w.destroy && w.destroy(); }
    if (this.rosterC) { this.rosterC.destroy({ children: true }); this.rosterC = null; }
  }
  drawRoster() {
    if (this.rosterC) this.rosterC.destroy({ children: true });
    const c = new PIXI.Container();
    c.x = 320; c.y = 70;
    const st = Game.state;
    const all = Object.keys(st.roster);
    all.forEach((id, i) => {
      const a = st.roster[id];
      const inParty = st.party.includes(id);
      const cell = new PIXI.Container();
      cell.x = (i % 2) * 310; cell.y = Math.floor(i / 2) * 82;
      cell.addChild(UI.window(300, 76, inParty ? { border: 0x90e890 } : {}));
      const face = new PIXI.Sprite(Game.sheets.chars[Party.classSprite[a.cls]]);
      face.width = 40; face.height = 40; face.x = 10; face.y = 14;
      cell.addChild(face);
      const name = UI.text(`${a.name}  Lv${a.lv}`, 16, null, { bold: true });
      name.x = 58; name.y = 10;
      cell.addChild(name);
      const info = UI.text(`${CLASSES[a.cls].name}  ${inParty ? `隊列${st.party.indexOf(id) + 1}` : T.tavernBench}`, 14, inParty ? UI.colors.good : UI.colors.textDim);
      info.x = 58; info.y = 40;
      cell.addChild(info);
      c.addChild(cell);
    });
    this.container.addChild(c);
    this.rosterC = c;
  }
  showTop() {
    this.clearW();
    this.drawRoster();
    const menu = new Menu({
      items: [
        { label: T.tavernCreate }, { label: T.tavernAdd }, { label: T.tavernRemove },
        { label: T.tavernDelete }, { label: T.tavernLeave },
      ],
      x: 24, y: 70, w: 250, rowH: 44, visibleRows: 5,
      onOk: (i) => {
        if (i === 0) this.createFlow();
        else if (i === 1) this.addFlow();
        else if (i === 2) this.removeFlow();
        else if (i === 3) this.deleteFlow();
        else SceneMgr.pop();
      },
      onCancel: () => SceneMgr.pop(),
    });
    this.widgets.push(menu);
    this.container.addChild(menu.container);
  }
  // 仲間の登録抹消(主人公以外・確認つき・装備は所持品へ返却)
  deleteFlow() {
    const st = Game.state;
    const ids = Object.keys(st.roster).filter(id => id !== 'hero1');
    if (!ids.length) { this.msg.say(T.tavernNoDeletable); return; }
    this.clearW();
    this.drawRoster();
    const menu = new Menu({
      items: ids.map(id => ({ label: `${st.roster[id].name} (${CLASSES[st.roster[id].cls].name} Lv${st.roster[id].lv})` })),
      x: 24, y: 70, w: 280, rowH: 40, visibleRows: Math.min(7, ids.length),
      onOk: async (i) => {
        const id = ids[i];
        const a = st.roster[id];
        await this.msg.say(T.tavernDeleteConfirm(a.name));
        const c = await this.msg.choice([T.tavernDeleteYes, T.tavernDeleteNo], { cancelIndex: 1 });
        if (c === 0) {
          for (const slot of ['weapon', 'armor', 'shield', 'acc']) {
            if (a.equips[slot]) Game.addItem(a.equips[slot]);
          }
          const pi = st.party.indexOf(id);
          if (pi >= 0) st.party.splice(pi, 1);
          delete st.roster[id];
          AudioSys.se('cancel');
          await this.msg.say(T.tavernDeleted(a.name));
        }
        this.showTop();
      },
      onCancel: () => this.showTop(),
    });
    this.widgets.push(menu);
    this.container.addChild(menu.container);
  }
  async createFlow() {
    if (Object.keys(Game.state.roster).length >= 8) {
      await this.msg.say(T.tavernRosterFull);
      return;
    }
    this.clearW();
    this.drawRoster();
    // クラス選択
    const clsIds = Object.keys(CLASSES);
    const help = UI.text('', 15, UI.colors.textDim, { wrap: true, wrapWidth: 560 });
    help.x = 36; help.y = 400;
    this.container.addChild(help);
    this.widgets.push({ container: help, destroy: () => help.destroy() });
    const menu = new Menu({
      items: clsIds.map(c => ({ label: CLASSES[c].name })),
      x: 24, y: 70, w: 250, rowH: 40, visibleRows: 6,
      onChange: (i) => { help.text = CLASSES[clsIds[i]].desc; },
      onOk: async (i) => {
        const cls = clsIds[i];
        const name = await NameInput.show(this.container, PRESET_NAMES[rand(PRESET_NAMES.length)]);
        if (!name) { this.showTop(); return; }
        const id = 'ally' + Date.now() % 1000000;
        const actor = Party.createActor(id, name, cls);
        // 主人公のレベルの7割程度で参加
        const heroLv = Game.state.roster[Game.state.party[0]].lv;
        const joinLv = Math.max(1, Math.floor(heroLv * 0.75));
        actor.lv = joinLv;
        actor.exp = expForLevel(joinLv);
        const st = Party.calcStats(actor);
        actor.hp = st.maxhp; actor.mp = st.maxmp;
        Game.state.roster[id] = actor;
        if (Game.state.party.length < 4) Game.state.party.push(id);
        AudioSys.se('levelup');
        await this.msg.say(T.tavernCreated(name));
        this.showTop();
      },
      onCancel: () => this.showTop(),
    });
    help.text = CLASSES[clsIds[0]].desc;
    this.widgets.push(menu);
    this.container.addChild(menu.container);
  }
  addFlow() {
    const st = Game.state;
    const bench = Object.keys(st.roster).filter(id => !st.party.includes(id));
    if (!bench.length) { this.msg.say('ひかえの仲間がいません。「仲間をつくる」で登録できます。'); return; }
    if (st.party.length >= 4) { this.msg.say(T.tavernFull + '先にだれかを外してください。'); return; }
    this.clearW();
    this.drawRoster();
    const menu = new Menu({
      items: bench.map(id => ({ label: `${st.roster[id].name} (${CLASSES[st.roster[id].cls].name} Lv${st.roster[id].lv})` })),
      x: 24, y: 70, w: 280, rowH: 40, visibleRows: Math.min(6, bench.length),
      onOk: (i) => {
        st.party.push(bench[i]);
        AudioSys.se('ok');
        this.showTop();
      },
      onCancel: () => this.showTop(),
    });
    this.widgets.push(menu);
    this.container.addChild(menu.container);
  }
  removeFlow() {
    const st = Game.state;
    if (st.party.length <= 1) { this.msg.say(T.tavernLastOne); return; }
    this.clearW();
    this.drawRoster();
    const menu = new Menu({
      items: st.party.map(id => ({
        label: `${st.roster[id].name} (${CLASSES[st.roster[id].cls].name})`,
        disabled: id === 'hero1',
      })),
      x: 24, y: 70, w: 280, rowH: 40, visibleRows: st.party.length,
      onOk: (i) => {
        if (st.party[i] === 'hero1') { this.msg.say(T.tavernHeroStay); return; }
        st.party.splice(i, 1);
        AudioSys.se('cancel');
        this.showTop();
      },
      onCancel: () => this.showTop(),
    });
    this.widgets.push(menu);
    this.container.addChild(menu.container);
  }
}

// ---- 名前入力(かなキーボード) ----
const KANA_PAGES = [
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんぁぃぅぇぉゃゅょっーがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ',
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンァィゥェォャュョッーガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ',
];
const NameInput = {
  current: null,
  show(parent, defaultName = '') {
    if (NameInput.current) return Promise.resolve(null); // 二重起動防止
    return new Promise((resolve) => {
      const c = new PIXI.Container();
      c.zIndex = 100;
      const overlay = new PIXI.Graphics();
      overlay.rect(0, 0, VIEW_W, VIEW_H).fill({ color: 0x000000, alpha: 0.7 });
      c.addChild(overlay);
      const winW = 700, winH = 470;
      const win = UI.window(winW, winH);
      win.x = (VIEW_W - winW) / 2; win.y = 24;
      c.addChild(win);
      const bx = win.x, by = win.y;
      const title = UI.text(T.charMakeName + '（最大6文字）', 18, null, { bold: true });
      title.x = bx + 24; title.y = by + 14;
      c.addChild(title);
      let name = defaultName;
      let page = 0;
      const nameLabel = UI.text('', 26, UI.colors.cursor, { bold: true });
      nameLabel.x = bx + 24; nameLabel.y = by + 46;
      c.addChild(nameLabel);
      const updateName = () => { nameLabel.text = name + '＿'.repeat(Math.max(0, 6 - name.length)); };
      updateName();
      parent.addChild(c);
      let menu = null;
      const buildMenu = () => {
        const chars = KANA_PAGES[page].split('');
        const items = chars.map(ch => ({ label: ch }));
        items.push({ label: T.kanaPage, color: 0x90c8f0 });
        items.push({ label: T.kanaBack, color: 0xe8b040 });
        items.push({ label: T.kanaDone, color: 0x90e890 });
        if (menu) { menu.destroy(); }
        menu = new Menu({
          items, cols: 10, x: bx + 20, y: by + 90, w: winW - 40, rowH: 34, visibleRows: 10,
          fontSize: 17, noWindow: true, padX: 4, padY: 4,
          onOk: (i) => {
            const it = items[i];
            if (it.label === T.kanaDone) {
              if (!name.length) { AudioSys.se('buzzer'); return; }
              cleanup(); resolve(name);
            } else if (it.label === T.kanaBack) {
              name = name.slice(0, -1); updateName();
            } else if (it.label === T.kanaPage) {
              page = (page + 1) % KANA_PAGES.length;
              buildMenu();
            } else if (name.length < 6) {
              name += it.label; updateName();
            } else AudioSys.se('buzzer');
          },
          onCancel: () => {
            if (name.length) { name = name.slice(0, -1); updateName(); }
            else { cleanup(); resolve(null); }
          },
        });
        c.addChild(menu.container);
      };
      const cleanup = () => {
        NameInput.current = null;
        window.removeEventListener('keydown', keyHandler);
        if (menu) menu.destroyed = true;
        c.destroy({ children: true });
      };
      buildMenu();
      // キーボード直接入力も受け付け
      const keyHandler = (e) => {
        if (e.key.length === 1 && /[ぁ-んァ-ヶーa-zA-Z0-9]/.test(e.key) && name.length < 6) {
          name += e.key; updateName();
        }
      };
      window.addEventListener('keydown', keyHandler);
      NameInput.current = { update: (dt) => {
        if (!menu) return;
        if (menu.destroyed || menu.container.destroyed) { NameInput.current = null; return; }
        menu.update(dt);
      } };
    });
  },
};
