// ============================================================
// battle.js - ターン制バトルシーン
// ============================================================
'use strict';

const BUFF_MULT = { atk: 0.3, def: 0.3, agi: 0.25, mag: 0.3 };
const STATUS_NAMES = { poison: T.statusPoison, sleep: T.statusSleep, paralysis: T.statusParalysis };
const STATUS_COLORS = { poison: 0xb070e0, sleep: 0x8090c0, paralysis: 0xe0d060 };

class Battler {
  constructor(src, isEnemy, index) {
    this.isEnemy = isEnemy;
    this.index = index;
    this.statuses = {};   // {poison:true, sleep:{t}, paralysis:{t}}
    this.buffs = { atk: 0, def: 0, agi: 0, mag: 0 };
    this.guard = false;
    if (isEnemy) {
      this.def = ENEMIES[src.id];
      this.eid = src.id;
      this.name = this.def.name;
      this.hp = this.def.hp; this.maxhp = this.def.hp;
      this.mp = 99;
      this.row = index >= 3 ? 1 : 0;
    } else {
      this.actor = src;
      this.name = src.name;
    }
  }
  get alive() { return this.isEnemy ? this.hp > 0 : this.actor.hp > 0; }
  get curHp() { return this.isEnemy ? this.hp : this.actor.hp; }
  get curMaxHp() { return this.isEnemy ? this.maxhp : Party.calcStats(this.actor).maxhp; }
  stat(k) {
    let base;
    if (this.isEnemy) base = this.def[k] || 1;
    else {
      const s = Party.calcStats(this.actor);
      base = k === 'maxhp' ? s.maxhp : s[k];
    }
    const b = this.buffs[k] || 0;
    let v = base * (1 + (BUFF_MULT[k] || 0) * b);
    return Math.max(1, Math.floor(v));
  }
  damage(v) {
    if (this.isEnemy) this.hp = clamp(this.hp - v, 0, this.maxhp);
    else this.actor.hp = clamp(this.actor.hp - v, 0, Party.calcStats(this.actor).maxhp);
  }
  healHp(v) { this.damage(-v); }
  isFrontRow() {
    if (this.isEnemy) return this.row === 0;
    return Party.isFrontRow(this.actor);
  }
  elemMult(elem) {
    if (elem === 'phys' || !elem) elem = 'phys';
    if (this.isEnemy) {
      const r = this.def.res || {};
      let m = r[elem] != null ? r[elem] : 1;
      if (m === -1) return -1;
      return m;
    }
    return Party.equipResist(this.actor, elem);
  }
  statusImmune(st) {
    if (this.isEnemy) return !!this.def.boss; // ボスは状態異常無効
    return Party.equipImmune(this.actor, st);
  }
}

class BattleScene {
  constructor(enemyDefs, opts = {}) {
    this.container = new PIXI.Container();
    this.opts = opts;
    this.enemyDefs = enemyDefs;
    this.turnNo = 0;
    this.ended = false;
    this.frimdCloak = null; this.frimdStun = false;
    this.azrausHealed = false;
  }
  enter() {
    this.buildBackground();
    this.setupBattlers();
    this.buildEnemySprites();
    this.buildPartyPanel();
    this.msg = new MsgWindow(this.container, { h: 104, y: 46, w: VIEW_W - 80 });
    this.turnLabel = null;
    AudioSys.playBgm(this.opts.boss ? 'boss' : 'battle');
    this.run();
  }
  exit() {
    const bgm = { world: 'field', shadow_world: 'shadow' }[Game.state.map];
    AudioSys.playBgm(bgm || (MAPS[Game.state.map].bgm || 'field'));
  }
  update(dt) {
    // 入力は最前面のUIだけが受け取る(メッセージ > ターゲット選択 > サブメニュー > コマンド)
    if (this.msg) {
      this.msg.update(dt);
      if (this.msg.busy) return;
    }
    if (this.targetSel) { this.targetSel.update(dt); return; }
    if (this.subMenu) { this.subMenu.update(dt); return; }
    if (this.cmdMenu) this.cmdMenu.update(dt);
  }

  // ---- セットアップ ----
  setupBattlers() {
    this.party = Party.members().map((a, i) => new Battler(a, false, i));
    // 同名連番 A,B,C...
    const counts = {};
    this.enemies = this.enemyDefs.map((d, i) => new Battler(d, true, i));
    for (const e of this.enemies) counts[e.eid] = (counts[e.eid] || 0) + 1;
    const seen = {};
    for (const e of this.enemies) {
      if (counts[e.eid] > 1) {
        seen[e.eid] = (seen[e.eid] || 0);
        e.name += String.fromCharCode(65 + seen[e.eid]++);
      }
    }
    if (this.enemies.some(e => e.def.aiScript === 'frimd')) this.frimdCloak = 'fire';
  }
  buildBackground() {
    const g = new PIXI.Graphics();
    const map = MAPS[Game.state.map];
    const themes = {
      world: [0x1a2a4a, 0x2d4a2d], town: [0x1a2a4a, 0x2d4a2d],
      dungeon: [0x14101e, 0x2a2438],
    };
    let [top, bottom] = themes[map.tileset] || themes.dungeon;
    if (map.id.includes('ember')) [top, bottom] = [0x2a1010, 0x4a2418];
    if (map.id.includes('spire') || map.id === 'town_frell') [top, bottom] = [0x182440, 0x3a4a66];
    if (map.id.includes('dark') || map.id.includes('void') || map.id === 'shadow_world') [top, bottom] = [0x180c28, 0x30204a];
    if (Game.state.map === 'world') [top, bottom] = [0x101c38, 0x24422a];
    g.rect(0, 0, VIEW_W, 300).fill(top);
    g.rect(0, 300, VIEW_W, VIEW_H - 300).fill(bottom);
    // 地面の楕円
    g.ellipse(VIEW_W / 2, 320, 380, 70).fill({ color: 0x000000, alpha: 0.25 });
    this.container.addChild(g);
  }
  buildEnemySprites() {
    this.enemyLayer = new PIXI.Container();
    this.container.addChild(this.enemyLayer);
    const n = this.enemies.length;
    for (const e of this.enemies) {
      const [sheetIdx, cell] = e.def.img;
      const tex = Game.sheets['enemies' + (sheetIdx + 1)][cell];
      const sp = new PIXI.Sprite(tex);
      const size = e.def.boss ? 210 : 130;
      const scale = size / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.anchor.set(0.5, 1);
      const front = this.enemies.filter(x => x.row === 0);
      const back = this.enemies.filter(x => x.row === 1);
      const list = e.row === 0 ? front : back;
      const idx = list.indexOf(e);
      const spread = Math.min(200, 640 / Math.max(1, list.length));
      sp.x = VIEW_W / 2 + (idx - (list.length - 1) / 2) * spread;
      sp.y = e.row === 0 ? 330 : 268;
      if (e.row === 1) sp.scale.set(scale * 0.85);
      this.enemyLayer.addChild(sp);
      e.sprite = sp;
      // 名前+状態ラベル
      const label = UI.text(e.name, 14, 0xffffff, { stroke: true });
      label.anchor.set(0.5, 0);
      label.x = sp.x; label.y = sp.y + 4;
      this.enemyLayer.addChild(label);
      e.label = label;
      // HPゲージ(ボスのみ表示、雑魚は割合バー小)
      const gw = e.def.boss ? 180 : 90;
      e.gaugeW = gw;
      e.gauge = new PIXI.Container();
      e.gauge.x = sp.x - gw / 2; e.gauge.y = sp.y + 24;
      this.enemyLayer.addChild(e.gauge);
      this.updateEnemyGauge(e);
    }
  }
  updateEnemyGauge(e) {
    e.gauge.removeChildren().forEach(c => c.destroy());
    if (!e.alive) { e.label.visible = false; return; }
    const ratio = e.hp / e.maxhp;
    e.gauge.addChild(UI.gauge(e.gaugeW, 8, ratio, UI.hpColor(ratio)));
    // 状態異常アイコン
    let sx = 0;
    for (const st of Object.keys(e.statuses)) {
      const tag = UI.text(STATUS_NAMES[st], 12, 0xffffff, { stroke: true });
      const bg = new PIXI.Graphics();
      bg.roundRect(sx - 2, 10, tag.width + 8, 18, 4).fill(STATUS_COLORS[st]);
      tag.x = sx + 2; tag.y = 11;
      e.gauge.addChild(bg, tag);
      sx += tag.width + 12;
    }
    // フリムドの衣表示
    if (e.def.aiScript === 'frimd' && this.frimdCloak) {
      const cloakName = { fire: '炎の衣', ice: '氷の衣', bolt: '雷の衣' }[this.frimdCloak];
      const weak = { fire: '氷', ice: '炎', bolt: '地' }[this.frimdCloak];
      const t = UI.text(`【${cloakName}】弱点:${weak}`, 15, 0xffe080, { bold: true, stroke: true });
      t.x = (e.gaugeW - t.width) / 2; t.y = 10;
      e.gauge.addChild(t);
    }
  }
  buildPartyPanel() {
    if (this.panel) this.panel.destroy({ children: true });
    this.panel = new PIXI.Container();
    this.panel.y = VIEW_H - 150;
    this.container.addChild(this.panel);
    const n = this.party.length;
    const w = (VIEW_W - 40) / 4;
    this.party.forEach((b, i) => {
      const a = b.actor;
      const st = Party.calcStats(a);
      const cell = new PIXI.Container();
      cell.x = 20 + i * w;
      const win = UI.window(w - 8, 142);
      cell.addChild(win);
      b.panelWin = win;
      const name = UI.text(a.name, 17, null, { bold: true });
      name.x = 12; name.y = 8;
      cell.addChild(name);
      const row = UI.text(i < 2 ? '前' : '後', 13, UI.colors.textDim);
      row.x = w - 34; row.y = 10;
      cell.addChild(row);
      const hpText = UI.text(`HP ${a.hp}/${st.maxhp}`, 15, a.hp <= 0 ? UI.colors.danger : null);
      hpText.x = 12; hpText.y = 36;
      cell.addChild(hpText);
      const hpG = UI.gauge(w - 30, 9, a.hp / st.maxhp, UI.hpColor(a.hp / st.maxhp));
      hpG.x = 12; hpG.y = 60;
      cell.addChild(hpG);
      const mpText = UI.text(`MP ${a.mp}/${st.maxmp}`, 15);
      mpText.x = 12; mpText.y = 74;
      cell.addChild(mpText);
      const mpG = UI.gauge(w - 30, 7, st.maxmp ? a.mp / st.maxmp : 0, UI.colors.mp);
      mpG.x = 12; mpG.y = 98;
      cell.addChild(mpG);
      // 状態表示
      let stText = '';
      if (a.hp <= 0) stText = T.statusDead;
      else stText = Object.keys(b.statuses).map(s => STATUS_NAMES[s]).join('・');
      const stLabel = UI.text(stText, 14, a.hp <= 0 ? UI.colors.danger : 0xd0a0e8);
      stLabel.x = 12; stLabel.y = 112;
      cell.addChild(stLabel);
      if (b.guard) {
        const gd = UI.text('防御', 14, 0x90c8f0);
        gd.x = w - 56; gd.y = 112;
        cell.addChild(gd);
      }
      this.panel.addChild(cell);
    });
  }
  refreshUI() {
    this.buildPartyPanel();
    for (const e of this.enemies) this.updateEnemyGauge(e);
  }
  setTurnIndicator(b) {
    if (this.turnLabel) { this.turnLabel.destroy(); this.turnLabel = null; }
    if (this.turnArrow) { this.turnArrow.destroy(); this.turnArrow = null; }
    if (!b) return;
    const t = UI.text(`▼ ${T.whoseTurn(b.name)}`, 17, UI.colors.cursor, { bold: true, stroke: true });
    t.x = 24; t.y = 16;
    this.container.addChild(t);
    this.turnLabel = t;
    if (b.isEnemy && b.sprite) {
      const ar = new PIXI.Graphics();
      ar.poly([-12, -20, 12, -20, 0, -4]).fill(UI.colors.cursor);
      ar.x = b.sprite.x; ar.y = b.sprite.y - b.sprite.height - 24;
      this.enemyLayer.addChild(ar);
      this.turnArrow = ar;
    } else if (!b.isEnemy && b.panelWin) {
      b.panelWin.tint = 0xffe8a0;
    }
  }

  // ---- メインループ ----
  async run() {
    await this.msg.say(this.enemies.length === 1 ? T.battleStart(this.enemies[0].name) : T.battleStartGroup);
    while (!this.ended) {
      this.turnNo++;
      // コマンド入力フェーズ
      const commands = await this.commandPhase();
      if (this.ended) break;
      // にげる(パーティ行動)
      if (commands === 'flee') {
        if (await this.tryFlee()) break;
        await this.enemyFreeRound();
        if (await this.checkEnd()) break;
        continue;
      }
      // 行動順: agi順(乱数±20%)、priority優先
      const actors = [...this.party.filter(b => b.alive), ...this.enemies.filter(e => e.alive)];
      for (const e of this.enemies.filter(x => x.alive)) {
        e.plan = this.enemyPlan(e);
        if (e.def.turns2) e.plan2 = this.enemyPlan(e);
      }
      actors.sort((a, b) => {
        const pa = (!a.isEnemy && commands[a.index]?.skill && SKILLS[commands[a.index].skill]?.priority) ? 1 : 0;
        const pb = (!b.isEnemy && commands[b.index]?.skill && SKILLS[commands[b.index].skill]?.priority) ? 1 : 0;
        if (pa !== pb) return pb - pa;
        return b.stat('agi') * (0.8 + randf() * 0.4) - a.stat('agi') * (0.8 + randf() * 0.4);
      });
      for (const b of actors) {
        if (this.ended) break;
        if (!b.alive) continue;
        await this.takeTurn(b, b.isEnemy ? null : commands[b.index]);
        this.refreshUI();
        if (await this.checkEnd()) break;
        if (b.isEnemy && b.plan2 && b.alive) {
          await this.takeTurn(b, null, true);
          this.refreshUI();
          if (await this.checkEnd()) break;
        }
      }
      if (this.ended) break;
      // ターン終了処理(毒など)
      await this.endOfTurn();
      if (await this.checkEnd()) break;
    }
  }

  // ---- コマンド入力 ----
  commandPhase() {
    return new Promise(async (resolve) => {
      const commands = {};
      const alive = this.party.filter(b => b.alive && !b.statuses.sleep && !b.statuses.paralysis);
      for (const b of this.party) b.guard = false;
      let i = 0;
      while (i < alive.length) {
        const b = alive[i];
        this.setTurnIndicator(b);
        this.refreshUI();
        const cmd = await this.askCommand(b, i > 0);
        if (cmd === 'back') { i = Math.max(0, i - 1); continue; }
        if (cmd.type === 'flee') {
          this.setTurnIndicator(null);
          resolve('flee');
          return;
        }
        commands[b.index] = cmd;
        i++;
      }
      this.setTurnIndicator(null);
      resolve(commands);
    });
  }
  askCommand(b, canBack) {
    return new Promise((resolve) => {
      const items = [
        { label: T.cmdFight }, { label: T.cmdSkill }, { label: T.cmdGuard },
        { label: T.cmdItem }, { label: T.cmdFlee, disabled: !!this.opts.boss },
      ];
      this.cmdMenu = new Menu({
        items, x: 24, y: VIEW_H - 150 - 200, w: 200, rowH: 36, visibleRows: 5,
        onOk: async (idx) => {
          switch (idx) {
            case 0: { // たたかう
              const t = await this.selectEnemyTarget();
              if (t == null) return;
              this.closeCmd(); resolve({ type: 'attack', target: t });
              break;
            }
            case 1: { // スキル
              const sel = await this.selectSkill(b);
              if (!sel) return;
              this.closeCmd(); resolve(sel);
              break;
            }
            case 2: this.closeCmd(); resolve({ type: 'guard' }); break;
            case 3: { // どうぐ
              const sel = await this.selectBattleItem(b);
              if (!sel) return;
              this.closeCmd(); resolve(sel);
              break;
            }
            case 4: this.closeCmd(); resolve({ type: 'flee' }); break;
          }
        },
        onCancel: canBack ? () => { this.closeCmd(); resolve('back'); } : null,
      });
      this.container.addChild(this.cmdMenu.container);
    });
  }
  closeCmd() {
    if (this.cmdMenu) { this.cmdMenu.destroy(); this.cmdMenu = null; }
    if (this.subMenu) { this.subMenu.destroy(); this.subMenu = null; }
  }
  // 敵ターゲット選択 Promise<enemyIndex|null>
  selectEnemyTarget() {
    return new Promise((resolve) => {
      const alive = this.enemies.filter(e => e.alive);
      if (alive.length === 1) { resolve(this.enemies.indexOf(alive[0])); return; }
      let idx = 0;
      const cursor = new PIXI.Graphics();
      this.enemyLayer.addChild(cursor);
      const draw = () => {
        const e = alive[idx];
        cursor.clear();
        cursor.poly([e.sprite.x - 12, e.sprite.y - e.sprite.height - 22, e.sprite.x + 12, e.sprite.y - e.sprite.height - 22, e.sprite.x, e.sprite.y - e.sprite.height - 6]).fill(0xff8080);
      };
      draw();
      // タップ選択
      const taps = alive.map((e) => {
        e.sprite.eventMode = 'static';
        const fn = () => { finish(this.enemies.indexOf(e)); };
        e.sprite.on('pointertap', fn);
        return { e, fn };
      });
      const finish = (v) => {
        cursor.destroy();
        for (const { e, fn } of taps) { e.sprite.off('pointertap', fn); e.sprite.eventMode = 'auto'; }
        this.targetSel = null;
        resolve(v);
      };
      this.targetSel = {
        update: (dt) => {
          if (Input.repeat('left', dt)) { idx = (idx + alive.length - 1) % alive.length; AudioSys.se('cursor'); draw(); }
          if (Input.repeat('right', dt)) { idx = (idx + 1) % alive.length; AudioSys.se('cursor'); draw(); }
          if (Input.hit('ok')) { AudioSys.se('ok'); finish(this.enemies.indexOf(alive[idx])); }
          if (Input.hit('cancel')) { AudioSys.se('cancel'); finish(null); }
        },
      };
    });
  }
  // 味方ターゲット選択 Promise<partyIndex|null>
  selectAllyTarget(deadOnly = false) {
    return new Promise((resolve) => {
      const pool = this.party.filter(b => deadOnly ? !b.alive : true);
      if (!pool.length) { resolve(null); return; }
      const menu = new Menu({
        items: pool.map(b => ({ label: `${b.name}  HP${b.actor.hp}`, color: b.alive ? null : UI.colors.danger })),
        x: 260, y: VIEW_H - 150 - 44 * Math.min(4, pool.length) - 30, w: 300, rowH: 40, visibleRows: Math.min(4, pool.length),
        onOk: (i) => { menu.destroy(); this.subMenu2 = null; resolve(this.party.indexOf(pool[i])); },
        onCancel: () => { menu.destroy(); this.subMenu2 = null; resolve(null); },
      });
      this.container.addChild(menu.container);
      // subMenuスロットを一時利用
      const prev = this.subMenu;
      this.subMenu = menu;
      const origResolve = resolve;
      resolve = (v) => { this.subMenu = prev; origResolve(v); };
    });
  }
  async selectSkill(b) {
    const skills = Party.knownSkills(b.actor);
    if (!skills.length) {
      await this.msg.say(`${b.name}はまだスキルを覚えていない。`);
      return null;
    }
    return new Promise((resolve) => {
      const items = skills.map(id => {
        const s = SKILLS[id];
        return { label: s.name, right: `MP${s.mp}`, disabled: b.actor.mp < s.mp, help: s.desc };
      });
      const helpLabel = UI.text('', 15, UI.colors.textDim);
      helpLabel.x = 250; helpLabel.y = VIEW_H - 150 - 34;
      this.container.addChild(helpLabel);
      const menu = new Menu({
        items, x: 235, y: VIEW_H - 150 - 260, w: 330, rowH: 36, visibleRows: 6,
        onChange: (i) => { helpLabel.text = SKILLS[skills[i]].desc || ''; },
        onOk: async (i) => {
          const id = skills[i];
          const s = SKILLS[id];
          let target = null;
          if (s.scope === 'enemy') {
            target = await this.selectEnemyTarget();
            if (target == null) return;
          } else if (s.scope === 'ally') {
            target = await this.selectAllyTarget();
            if (target == null) return;
          } else if (s.scope === 'allyDead') {
            if (!this.party.some(x => !x.alive)) { await this.msg.say(T.itemNoEffect); return; }
            target = await this.selectAllyTarget(true);
            if (target == null) return;
          } else if (s.scope === 'enemyGroup' || s.scope === 'enemyAll' || s.scope === 'enemyRandom') {
            target = -1;
          }
          menu.destroy(); helpLabel.destroy(); this.subMenu = null;
          resolve({ type: 'skill', skill: id, target });
        },
        onCancel: () => { menu.destroy(); helpLabel.destroy(); this.subMenu = null; resolve(null); },
      });
      helpLabel.text = SKILLS[skills[0]].desc || '';
      this.container.addChild(menu.container);
      this.subMenu = menu;
    });
  }
  async selectBattleItem(b) {
    const usable = Object.keys(Game.state.inv).filter(id => {
      const it = ITEMS[id];
      return it && (it.usableField || it.battleOnly) && it.kind !== 'key' && !it.fieldOnly;
    });
    if (!usable.length) {
      await this.msg.say(T.itemNoItems);
      return null;
    }
    return new Promise((resolve) => {
      const menu = new Menu({
        items: usable.map(id => ({ label: ITEMS[id].name, right: `×${Game.state.inv[id]}` })),
        x: 235, y: VIEW_H - 150 - 260, w: 330, rowH: 36, visibleRows: 6,
        onOk: async (i) => {
          const id = usable[i];
          const it = ITEMS[id];
          let target = null;
          if (it.scope === 'ally') {
            target = await this.selectAllyTarget();
            if (target == null) return;
          } else if (it.scope === 'allyDead') {
            if (!this.party.some(x => !x.alive)) { await this.msg.say(T.itemNoEffect); return; }
            target = await this.selectAllyTarget(true);
            if (target == null) return;
          } else target = -1;
          menu.destroy(); this.subMenu = null;
          resolve({ type: 'item', item: id, target });
        },
        onCancel: () => { menu.destroy(); this.subMenu = null; resolve(null); },
      });
      this.container.addChild(menu.container);
      this.subMenu = menu;
    });
  }

  // ---- ターン実行 ----
  async takeTurn(b, cmd, isSecond = false) {
    // 睡眠・マヒ処理
    if (b.statuses.sleep) {
      b.statuses.sleep.t++;
      if (b.statuses.sleep.t >= 2 && randf() < 0.45 || b.statuses.sleep.t > 4) {
        delete b.statuses.sleep;
        await this.say(T.wokeUp(b.name));
      } else {
        await this.say(T.sleeping(b.name));
        return;
      }
    }
    if (b.statuses.paralysis) {
      b.statuses.paralysis.t++;
      if (b.statuses.paralysis.t >= 2 && randf() < 0.4 || b.statuses.paralysis.t > 3) {
        delete b.statuses.paralysis;
        await this.say(T.paraRecover(b.name));
      } else {
        await this.say(T.paralyzedSkip(b.name));
        return;
      }
    }
    this.setTurnIndicator(b);
    if (b.isEnemy) {
      await this.enemyAct(b, isSecond);
    } else {
      if (!cmd) { /* 入力時に眠っていた等 */ }
      else if (cmd.type === 'attack') await this.doAttack(b, this.pickTarget(cmd.target, this.enemies));
      else if (cmd.type === 'guard') { b.guard = true; await this.say(T.guard(b.name)); }
      else if (cmd.type === 'skill') await this.doSkill(b, cmd.skill, cmd.target);
      else if (cmd.type === 'item') await this.doItem(b, cmd.item, cmd.target);
    }
    this.setTurnIndicator(null);
  }
  pickTarget(idx, pool) {
    // 指定ターゲットが死亡済なら生存からランダム
    if (idx != null && idx >= 0 && pool[idx] && pool[idx].alive) return pool[idx];
    const alive = pool.filter(x => x.alive);
    return alive.length ? pick(alive) : null;
  }
  say(lines) { return this.msg.say(lines); }

  // 通常攻撃
  async doAttack(b, target, opts = {}) {
    if (!target) return;
    await this.say(T.attack(b.name));
    AudioSys.se('hit');
    const elem = b.isEnemy ? 'phys' : Party.weaponElem(b.actor);
    await this.dealPhysical(b, target, 1.0, elem, opts);
  }
  async dealPhysical(b, target, mult, elem, { critBonus = 0, statusAdd = null, statusRate = 0 } = {}) {
    // 命中(回避)
    const evade = 0.04 + (target.stat('agi') > b.stat('agi') * 2 ? 0.06 : 0);
    if (randf() < evade) {
      await this.popAndSay(target, 'MISS', 0xcccccc, `${target.name}は 身をかわした！`);
      return;
    }
    let atk = b.stat('atk');
    let def = target.stat('def');
    if (target.guard) def *= 2;
    let base = Math.max(1, (atk - def / 2) / 2);
    // 隊列補正
    if (!b.isFrontRow()) base *= 0.72;
    if (!target.isFrontRow()) base *= 0.85;
    let crit = false;
    const critRate = 1 / 24 + b.stat('luk') * 0.0018 + critBonus;
    if (randf() < critRate) { crit = true; base = Math.max(base * 2, atk * 0.8); }
    let mult2 = target.elemMult(elem);
    let dmg = Math.floor(base * mult * (0.85 + randf() * 0.3) * Math.abs(mult2 === 0 ? 0 : mult2));
    if (mult2 === -1) { // 吸収
      target.healHp(dmg);
      await this.popAndSay(target, '+' + dmg, 0x90e890, T.absorb(target.name));
      return;
    }
    if (mult2 === 0 || dmg <= 0) {
      await this.popAndSay(target, '0', 0xcccccc, T.noDamage(target.name));
      return;
    }
    if (crit) { AudioSys.se('crit'); await this.say(T.critical); }
    await this.applyDamage(b, target, dmg, mult2, crit);
    // 追加状態異常
    if (statusAdd && target.alive && randf() < statusRate) await this.inflict(target, statusAdd);
    // 睡眠は攻撃で起きることがある
    if (target.statuses.sleep && randf() < 0.5) {
      delete target.statuses.sleep;
      await this.say(T.wokeUp(target.name));
    }
  }
  async applyDamage(src, target, dmg, elemMult, big = false) {
    dmg = Math.max(1, Math.floor(dmg));
    // フリムドの衣: 弱点属性でスタン(スクリプト側で判定済みの値が来る)
    target.damage(dmg);
    this.hitEffect(target);
    const msgs = [];
    if (elemMult >= 1.5) msgs.push(T.weak);
    else if (elemMult > 0 && elemMult <= 0.6) msgs.push(T.resist);
    msgs.push(T.damage(target.name, dmg));
    this.pop(target, dmg, big ? 0xffe060 : 0xffffff, big);
    this.refreshUI();
    await this.say(msgs.length > 1 ? msgs.join(' ') : msgs[0]);
    if (!target.alive) await this.handleDeath(target);
  }
  async handleDeath(target) {
    if (target.isEnemy) {
      AudioSys.se('dead');
      if (!Game.reducedMotion && target.sprite) {
        const sp = target.sprite;
        let t = 0;
        const tick = (tk) => {
          if (sp.destroyed) { Game.app.ticker.remove(tick); return; }
          t += tk.deltaMS / 1000;
          sp.alpha = 1 - t / 0.4;
          if (t >= 0.4) { Game.app.ticker.remove(tick); sp.visible = false; }
        };
        Game.app.ticker.add(tick);
      } else if (target.sprite) target.sprite.visible = false;
      target.label.visible = false;
      this.updateEnemyGauge(target);
      await this.say(T.enemyDown(target.name));
    } else {
      AudioSys.se('dead');
      target.statuses = {};
      this.refreshUI();
      await this.say(T.actorDown(target.name));
    }
  }
  hitEffect(target) {
    if (Game.reducedMotion) return;
    if (target.isEnemy && target.sprite) {
      const sp = target.sprite;
      const ox = sp.x;
      let t = 0;
      const tick = (tk) => {
        if (sp.destroyed) { Game.app.ticker.remove(tick); return; }
        t += tk.deltaMS / 1000;
        sp.x = ox + Math.sin(t * 60) * 6 * (1 - t / 0.25);
        sp.tint = 0xff8080;
        if (t >= 0.25) { Game.app.ticker.remove(tick); sp.x = ox; sp.tint = 0xffffff; }
      };
      Game.app.ticker.add(tick);
    } else if (!target.isEnemy) {
      // 画面シェイク
      const c = this.container;
      let t = 0;
      const tick = (tk) => {
        if (c.destroyed) { Game.app.ticker.remove(tick); return; }
        t += tk.deltaMS / 1000;
        c.x = Math.sin(t * 70) * 7 * (1 - t / 0.3);
        if (t >= 0.3) { Game.app.ticker.remove(tick); c.x = 0; }
      };
      Game.app.ticker.add(tick);
    }
  }
  pop(target, text, color, big = false) {
    let x, y;
    if (target.isEnemy && target.sprite) { x = target.sprite.x; y = target.sprite.y - target.sprite.height / 2; damagePop(this.enemyLayer, x, y, text, color, big); }
    else {
      const i = this.party.indexOf(target);
      const w = (VIEW_W - 40) / 4;
      damagePop(this.container, 20 + i * w + w / 2, VIEW_H - 150 + 40, text, color, big);
    }
  }
  async popAndSay(target, popText, color, line) {
    this.pop(target, popText, color);
    await this.say(line);
  }

  // スキル使用(パーティ)
  async doSkill(b, skillId, targetIdx) {
    const s = SKILLS[skillId];
    if (b.actor.mp < s.mp) { await this.say(T.notEnoughMp); return; }
    b.actor.mp -= s.mp;
    this.refreshUI();
    await this.say(T.useSkill(b.name, s.name));
    await this.execSkill(b, s, targetIdx);
  }
  // スキル効果(敵味方共通ロジック)
  async execSkill(user, s, targetIdx) {
    const allies = user.isEnemy ? this.enemies : this.party;
    const foes = user.isEnemy ? this.party : this.enemies;
    switch (s.kind) {
      case 'atk': {
        AudioSys.se(s.phys ? 'hit' : 'magic');
        if (s.phys) {
          // 物理スキル
          const hits = s.hits || 1;
          for (let h = 0; h < hits; h++) {
            let target;
            if (s.scope === 'enemyRandom') target = this.pickTarget(-1, foes);
            else target = this.pickTarget(targetIdx, foes);
            if (!target) break;
            await this.dealPhysical(user, target, s.power, s.elem, {
              critBonus: s.critBonus || 0,
              statusAdd: s.status, statusRate: s.statusRate || 0,
            });
            if (this.enemies.every(e => !e.alive) || this.party.every(p => !p.alive)) break;
          }
        } else {
          // 魔法
          let targets;
          if (s.scope === 'enemy' || s.scope === 'partyOne') targets = [this.pickTarget(targetIdx, foes)];
          else if (s.scope === 'enemyGroup') {
            // 同種グループ全体
            const t = this.pickTarget(targetIdx, foes);
            targets = t ? foes.filter(x => x.alive && (!x.isEnemy ? true : x.eid === t.eid)) : [];
            if (t && !t.isEnemy) targets = foes.filter(x => x.alive);
          } else targets = foes.filter(x => x.alive);
          for (const target of targets.filter(Boolean)) {
            await this.magicDamage(user, target, s);
            if (s.status && target.alive && randf() < (s.statusRate || 0)) await this.inflict(target, s.status);
          }
        }
        break;
      }
      case 'heal': {
        AudioSys.se('heal');
        let targets;
        if (s.scope === 'self') targets = [user];
        else if (s.scope === 'allyAll') targets = allies.filter(x => x.alive);
        else targets = [user.isEnemy ? user : this.party[targetIdx] || user];
        for (const t of targets) {
          if (!t.alive) continue;
          const amount = Math.min(t.curMaxHp - t.curHp, Math.floor(s.power * (1 + user.stat('mag') / 60) * (0.9 + randf() * 0.2)));
          t.healHp(amount);
          this.pop(t, '+' + amount, 0x90e890);
          this.refreshUI();
          await this.say(T.heal(t.name, amount));
        }
        break;
      }
      case 'cure': {
        AudioSys.se('heal');
        const t = user.isEnemy ? user : this.party[targetIdx] || user;
        const cured = [];
        for (const st of s.cures) if (t.statuses[st]) { delete t.statuses[st]; cured.push(STATUS_NAMES[st]); }
        this.refreshUI();
        await this.say(cured.length ? T.cured(t.name, cured.join('・')) : T.itemNoEffect);
        break;
      }
      case 'revive': {
        const t = this.party[targetIdx];
        if (!t || t.alive) { await this.say(T.itemNoEffect); break; }
        AudioSys.se('heal');
        t.actor.hp = Math.max(1, Math.floor(Party.calcStats(t.actor).maxhp * s.power));
        this.refreshUI();
        await this.say(T.revived(t.name));
        break;
      }
      case 'buff': {
        AudioSys.se('magic');
        let targets;
        if (s.scope === 'self') targets = [user];
        else if (s.scope === 'allyAll') targets = allies.filter(x => x.alive);
        else targets = [user.isEnemy ? user : this.party[targetIdx] || user];
        for (const t of targets) {
          const stages = s.stages || 1;
          if (t.buffs[s.stat] >= 2) { await this.say(T.buffMax); continue; }
          t.buffs[s.stat] = clamp(t.buffs[s.stat] + stages, -2, 2);
          await this.say(T.buffUp(t.name, statName(s.stat)));
        }
        break;
      }
      case 'debuff': {
        AudioSys.se('magic');
        // ダメージ付きデバフ(かぶとわり等)
        if (s.dmg) {
          const target = this.pickTarget(targetIdx, foes);
          if (!target) break;
          AudioSys.se('hit');
          await this.dealPhysical(user, target, s.dmg, 'phys');
          if (target.alive && randf() < 0.8) {
            target.buffs[s.stat] = clamp(target.buffs[s.stat] - (s.stages || 1), -2, 2);
            await this.say(T.buffDown(target.name, statName(s.stat)));
          }
        } else {
          let targets;
          if (s.scope === 'enemyGroup') {
            const t = this.pickTarget(targetIdx, foes);
            targets = t ? foes.filter(x => x.alive && (x.isEnemy ? x.eid === t.eid : true)) : [];
          } else targets = [this.pickTarget(targetIdx, foes)];
          for (const t of targets.filter(Boolean)) {
            if (randf() < 0.75 && !(t.isEnemy && t.def.boss && randf() < 0.5)) {
              t.buffs[s.stat] = clamp(t.buffs[s.stat] - (s.stages || 1), -2, 2);
              await this.say(T.buffDown(t.name, statName(s.stat)));
            } else await this.say(T.statusMissed);
          }
        }
        break;
      }
      case 'status': {
        AudioSys.se('magic');
        let targets;
        if (s.scope === 'party') targets = foes.filter(x => x.alive);
        else targets = [this.pickTarget(targetIdx, foes)];
        for (const t of targets.filter(Boolean)) {
          if (randf() < (s.statusRate || 0.5)) await this.inflict(t, s.status);
          else await this.say(T.statusMissed);
        }
        break;
      }
    }
  }
  async magicDamage(user, target, s) {
    let mult = target.elemMult(s.elem);
    // フリムド衣スクリプト
    if (target.isEnemy && target.def.aiScript === 'frimd') {
      const res = this.frimdElemCheck(s.elem);
      mult = res.mult;
      if (res.stun) this.frimdStun = true;
    }
    // 敵の魔法はプレイヤーより賢さ倍率を緩やかに(高magボスの全体攻撃対策)
    const magScale = user.isEnemy ? 120 : 45;
    let dmg = Math.floor(s.power * (1 + user.stat('mag') / magScale) * (0.9 + randf() * 0.2));
    if (target.guard) dmg = Math.floor(dmg * 0.55);
    if (mult === -1) {
      target.healHp(dmg);
      this.refreshUI();
      await this.popAndSay(target, '+' + dmg, 0x90e890, T.absorb(target.name));
      if (this.frimdStun) await this.frimdStunMsg(target);
      return;
    }
    dmg = Math.floor(dmg * mult);
    if (mult === 0 || dmg <= 0) {
      await this.popAndSay(target, '0', 0xcccccc, T.noDamage(target.name));
      return;
    }
    await this.applyDamage(user, target, dmg, mult, mult >= 1.5);
    if (this.frimdStun && target.alive) await this.frimdStunMsg(target);
  }
  frimdElemCheck(elem) {
    const weak = { fire: 'ice', ice: 'fire', bolt: 'earth' }[this.frimdCloak];
    if (elem === this.frimdCloak) return { mult: -1, stun: false };
    if (elem === weak) return { mult: 2.2, stun: true };
    return { mult: 0.7, stun: false };
  }
  async frimdStunMsg(target) {
    await this.say(`${target.name}の衣がくだけた！ ${target.name}はひるんでいる！`);
  }
  async inflict(target, status) {
    if (target.statuses[status] || !target.alive) { await this.say(T.alreadyStatus); return; }
    if (target.statusImmune(status)) { await this.say(T.statusMissed); return; }
    AudioSys.se('poison');
    if (status === 'poison') { target.statuses.poison = true; await this.say(T.poisoned(target.name)); }
    if (status === 'sleep') { target.statuses.sleep = { t: 0 }; await this.say(T.slept(target.name)); }
    if (status === 'paralysis') { target.statuses.paralysis = { t: 0 }; await this.say(T.paralyzed(target.name)); }
    this.refreshUI();
  }
  async doItem(b, itemId, targetIdx) {
    if (!Game.hasItem(itemId)) { await this.say(T.itemNoEffect); return; }
    const it = ITEMS[itemId];
    Game.removeItem(itemId);
    await this.say(T.useItem(b.name, it.name));
    // アイテムをスキル形式に変換して実行
    const pseudo = { kind: it.kind === 'healmp' ? 'healmp' : it.kind, power: it.power, cures: it.cures, scope: it.scope, elem: it.elem, name: it.name };
    if (it.kind === 'healmp') {
      const t = this.party[targetIdx] || b;
      const amount = Math.min(Party.calcStats(t.actor).maxmp - t.actor.mp, it.power);
      t.actor.mp += amount;
      AudioSys.se('heal');
      this.refreshUI();
      await this.say(T.healMp(t.name, amount));
    } else if (it.kind === 'atk') {
      await this.execSkill(b, { kind: 'atk', elem: it.elem, power: it.power, scope: 'enemyGroup' }, -1);
    } else if (it.kind === 'cure' && it.heal) {
      const t = this.party[targetIdx] || b;
      for (const st of it.cures) delete t.statuses[st];
      const amount = Math.min(t.curMaxHp - t.curHp, it.heal);
      t.healHp(amount);
      AudioSys.se('heal');
      this.refreshUI();
      await this.say(T.heal(t.name, amount));
    } else {
      await this.execSkill(b, pseudo, targetIdx);
    }
  }

  // ---- 敵AI ----
  enemyPlan(e) {
    // aiScript持ちは実行時に決定
    if (e.def.aiScript) return null;
    const hpRatio = e.hp / e.maxhp;
    const cands = (e.def.ai || [{ a: 'attack', w: 1 }]).filter(c => c.hpBelow == null || hpRatio <= c.hpBelow);
    return weightedPick(cands.map(c => [c.a, c.w]));
  }
  async enemyAct(e, isSecond) {
    // フリムドのひるみ
    if (e.def.aiScript === 'frimd' && this.frimdStun) {
      this.frimdStun = false;
      await this.say(`${e.name}はひるんで動けない！`);
      // 衣チェンジ
      this.rotateFrimdCloak(e);
      return;
    }
    let action = isSecond ? e.plan2 : e.plan;
    if (e.def.aiScript === 'frimd') action = this.frimdAction(e);
    if (e.def.aiScript === 'azraus') action = this.azrausAction(e);
    if (!action) action = 'attack';
    if (action === 'attack') {
      const target = this.pickPartyTarget();
      if (target) await this.doAttack(e, target);
    } else if (SKILLS[action]) {
      const s = SKILLS[action];
      await this.say(T.useSkill(e.name, s.name));
      let tIdx = -1;
      if (s.scope === 'partyOne' || s.scope === 'enemy') {
        const t = this.pickPartyTarget();
        tIdx = this.party.indexOf(t);
      }
      await this.execSkill(e, s, tIdx);
    }
    if (e.def.aiScript === 'frimd' && this.turnNo % 2 === 0) this.rotateFrimdCloak(e);
  }
  pickPartyTarget() {
    // 前衛が狙われやすい
    const alive = this.party.filter(b => b.alive);
    if (!alive.length) return null;
    const weighted = alive.map(b => [b, b.isFrontRow() ? 3 : 1]);
    return weightedPick(weighted);
  }
  rotateFrimdCloak(e) {
    const order = ['fire', 'ice', 'bolt'];
    const next = order[(order.indexOf(this.frimdCloak) + 1 + rand(2)) % 3];
    this.frimdCloak = next;
    const cn = { fire: '炎', ice: '氷', bolt: '雷' }[next];
    this.updateEnemyGauge(e);
    this.msgQueueCloak = `${e.name}は【${cn}の衣】をまとった！`;
  }
  frimdAction(e) {
    if (this.msgQueueCloak) { /* 衣変更メッセージはactの前に */ }
    const r = randf();
    if (r < 0.4) return 'attack';
    if (r < 0.7) return 'e_icebreath';
    return 'e_sleep';
  }
  azrausAction(e) {
    const ratio = e.hp / e.maxhp;
    if (ratio < 0.3 && !this.azrausHealed) { this.azrausHealed = true; return 'e_healself'; }
    const pool = ratio < 0.5
      ? [['e_darkstrong', 3], ['attack', 3], ['e_firebreath', 2], ['e_icebreath', 2], ['e_para', 1]]
      : [['attack', 4], ['e_dark', 3], ['e_bolt', 2], ['e_sleep', 1]];
    return weightedPick(pool);
  }
  async enemyFreeRound() {
    for (const e of this.enemies.filter(x => x.alive)) {
      e.plan = this.enemyPlan(e);
      await this.takeTurn(e, null);
      this.refreshUI();
      if (this.party.every(b => !b.alive)) break;
    }
  }

  // ---- ターン終了時 ----
  async endOfTurn() {
    // 衣チェンジメッセージ
    if (this.msgQueueCloak) { await this.say(this.msgQueueCloak); this.msgQueueCloak = null; }
    for (const b of [...this.party, ...this.enemies]) {
      if (!b.alive) continue;
      if (b.statuses.poison) {
        const dmg = Math.max(1, Math.floor(b.curMaxHp / (b.isEnemy ? 10 : 12)));
        b.damage(dmg);
        AudioSys.se('poison');
        this.pop(b, dmg, 0xb070e0);
        this.refreshUI();
        await this.say(T.poisonDmg(b.name, dmg));
        if (!b.alive) await this.handleDeath(b);
      }
      b.guard = false;
    }
  }

  // ---- 逃走 ----
  async tryFlee() {
    AudioSys.se('flee');
    const pAgi = Math.max(...this.party.filter(b => b.alive).map(b => b.stat('agi')));
    const eAgi = Math.max(...this.enemies.filter(e => e.alive).map(e => e.stat('agi')));
    const chance = clamp(0.55 + (pAgi - eAgi) * 0.02, 0.25, 0.95);
    if (randf() < chance) {
      await this.say(T.fleeSuccess);
      this.finish('flee');
      return true;
    }
    await this.say(T.fleeFail);
    return false;
  }

  // ---- 終了判定 ----
  async checkEnd() {
    if (this.ended) return true;
    if (this.party.every(b => !b.alive)) {
      await this.onDefeat();
      return true;
    }
    if (this.enemies.every(e => !e.alive)) {
      // 連戦(魔王第2形態)
      if (this.opts.chain && this.opts.chain.length) {
        await this.doChain();
        return false;
      }
      await this.onVictory();
      return true;
    }
    return false;
  }
  async doChain() {
    const nextId = this.opts.chain.shift();
    await this.say([
      '倒したかに見えた…その時！',
      '「……フフ……ハハハハ！ よくぞ我が仮面を砕いた。」',
      '「見せてやろう、闇の真の姿を！」',
    ]);
    // 敵を再構築
    this.enemyLayer.destroy({ children: true });
    this.enemyDefs = [{ id: nextId }];
    const counts = {};
    this.enemies = this.enemyDefs.map((d, i) => new Battler(d, true, i));
    this.buildEnemySprites();
    this.refreshUI();
    AudioSys.playBgm('boss', true);
    await this.say(T.battleStart(this.enemies[0].name));
  }
  async onVictory() {
    AudioSys.playBgm('victory');
    let exp = 0, gold = 0;
    const drops = [];
    for (const e of this.enemies) {
      exp += e.def.exp; gold += e.def.gold;
      if (e.def.drop && randf() < e.def.drop.rate) drops.push(e.def.drop.item);
    }
    await this.say([T.victory, T.gotExpGold(exp, gold)]);
    Game.state.gold += gold;
    for (const d of drops) {
      Game.addItem(d);
      await this.say(T.gotDrop(Game.itemName(d)));
    }
    // 経験値(生存者のみ)
    for (const b of this.party.filter(x => x.alive)) {
      const ups = Party.gainExp(b.actor, exp);
      for (const up of ups) {
        AudioSys.se('levelup');
        this.refreshUI();
        const lines = [T.levelUp(up.name, up.lv)];
        for (const sk of up.skills) lines.push(T.learnedSkill(up.name, sk));
        await this.say(lines);
      }
    }
    this.finish('win');
  }
  async onDefeat() {
    AudioSys.stopBgm();
    await this.say(T.partyWiped);
    this.ended = true;
    Fader.fadeOut(1.0, () => {
      SceneMgr.pop(); // battle
      // ゲームオーバー処理: 教会復帰
      Game.state.gold = Math.floor(Game.state.gold / 2);
      for (const a of Party.members()) {
        const st = Party.calcStats(a);
        a.hp = Math.max(1, Math.floor(st.maxhp / 2));
      }
      const inn = Game.state.lastInn;
      SceneMgr.replace(new FieldScene(inn.map, inn.x, inn.y, 'down'));
      const fs = SceneMgr.current;
      fs.busy = true;
      Fader.fadeIn(1.0, async () => {
        await fs.msg.say([T.gameOverMsg, T.gameOverRevive]);
        fs.busy = false;
        if (this.opts.onEnd) this.opts.onEnd('lose');
      });
    });
  }
  finish(result) {
    this.ended = true;
    // 戦闘終了時に状態異常・バフをクリア
    for (const b of this.party) { b.statuses = {}; b.buffs = { atk: 0, def: 0, agi: 0, mag: 0 }; }
    Fader.fadeOut(0.35, () => {
      SceneMgr.pop();
      Fader.fadeIn(0.35);
      if (this.opts.onEnd) this.opts.onEnd(result);
    });
  }
}

function statName(k) {
  return { atk: T.statAtk, def: T.statDef, agi: T.statAgi, mag: T.statMag, luk: T.statLuk }[k] || k;
}
