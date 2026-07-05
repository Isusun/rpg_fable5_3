// ============================================================
// field.js - フィールド探索シーン・マップイベント
// ============================================================
'use strict';

class FieldScene {
  constructor(mapId, x, y, dir = 'down') {
    this.container = new PIXI.Container();
    this.mapId = mapId;
    this.px = x; this.py = y; this.dir = dir;
    this.moving = null; // {fx,fy,tx,ty,t}
    this.busy = false;  // イベント実行中
    this.encGrace = 6;  // 戦闘直後のエンカウント猶予歩数
    this.eventSprites = {};
  }
  get map() { return MAPS[this.mapId]; }

  enter() {
    Game.state.map = this.mapId;
    Game.state.x = this.px; Game.state.y = this.py; Game.state.dir = this.dir;
    this.buildMap();
    this.buildPlayer();
    this.camera();
    AudioSys.playBgm(this.map.bgm || 'field');
    this.msg = new MsgWindow(this.container);
    this.showMapName();
  }
  exit() {}
  pause() { this.container.visible = false; }
  resume() {
    this.container.visible = true;
    // 状態変化(宝箱・扉・ボス撃破)を反映
    this.refreshEvents();
    AudioSys.playBgm(this.map.bgm || 'field');
  }

  // ---- マップ構築 ----
  buildMap() {
    this.mapLayer = new PIXI.Container();
    this.container.addChild(this.mapLayer);
    const m = this.map;
    const ts = TILE_DEFS[m.tileset];
    const sheet = Game.sheets['tiles_' + m.tileset];
    this.grid = [];
    for (let y = 0; y < m.h; y++) {
      this.grid.push(m.rows[y].split(''));
      for (let x = 0; x < m.w; x++) {
        let ch = m.rows[y][x];
        // 六輝の結界: オーブ6つで消える
        if (ch === 'x' && m.tileset === 'world' && Game.orbCount() >= 6) { ch = 's'; this.grid[y][x] = 's'; }
        const def = ts[ch] || ts['.'] || ts[','];
        const sp = new PIXI.Sprite(sheet[def.cell]);
        sp.width = TILE; sp.height = TILE;
        sp.x = x * TILE; sp.y = y * TILE;
        if (def.tint) sp.tint = def.tint;
        // 道・橋は隣接に合わせて回転(道の絵は縦向き、橋の絵は横向き)
        if (m.tileset === 'world' && (ch === 'r' || ch === 'b')) {
          const isPath = (xx, yy) => 'rbTCcK'.includes((m.rows[yy] || '')[xx] || '');
          const horiz = isPath(x - 1, y) || isPath(x + 1, y);
          const vert = isPath(x, y - 1) || isPath(x, y + 1);
          const rotate = ch === 'r' ? (horiz && !vert) : vert;
          if (rotate) {
            sp.anchor.set(0.5);
            sp.x += TILE / 2; sp.y += TILE / 2;
            sp.rotation = Math.PI / 2;
          }
        }
        this.mapLayer.addChild(sp);
      }
    }
    if (m.tint) this.mapLayer.tint = m.tint;
    // イベントスプライト層(スイッチ等は岩の下に描画)
    this.evLayer = new PIXI.Container();
    this.evLayer.sortableChildren = true;
    this.container.addChild(this.evLayer);
    this.refreshEvents(true);
  }
  refreshEvents(rebuild = false) {
    const m = this.map;
    const st = Game.state;
    if (rebuild) {
      this.evLayer.removeChildren().forEach(c => c.destroy());
      this.eventSprites = {};
      // 岩はマップ入場のたびに初期位置へ(押し込み失敗による詰み防止)
      st.rockPos[m.id] = {};
    }
    for (const ev of m.events || []) {
      let visible = true, cell = null, sheetName = 'chars', tint = null;
      if (ev.hideIf && ev.hideIf(st)) visible = false;
      switch (ev.type) {
        case 'npc': case 'shop': case 'inn': case 'church': case 'tavern': case 'ferry':
          cell = ev.sprite ?? 6; break;
        case 'chest':
          sheetName = 'tiles_dungeon';
          cell = st.openedChests[ev.flag] ? 7 : 6; break;
        case 'door':
          sheetName = 'tiles_dungeon';
          if (st.flags['door_' + ev.id]) visible = false;
          else cell = 5;
          break;
        case 'rock':
          sheetName = 'tiles_dungeon'; cell = 8; break;
        case 'switchplate': {
          sheetName = 'tiles_dungeon';
          cell = this.rockAt(ev.x, ev.y) ? 10 : 9; break;
        }
        case 'gate':
          sheetName = 'tiles_dungeon';
          if (st.flags['gate_' + ev.id]) visible = false; else { cell = 5; tint = 0x88ffcc; }
          break;
        case 'boss':
          if (ev.flag && st.flags[ev.flag]) visible = false;
          else if (ev.sprite != null) cell = ev.sprite;
          else visible = false; // 見えないトリガーボス
          break;
        default: visible = false;
      }
      let sp = this.eventSprites[ev.id];
      if (cell == null || !visible) {
        if (sp) sp.visible = false;
        continue;
      }
      if (!sp) {
        sp = new PIXI.Sprite(Game.sheets[sheetName][cell]);
        sp.width = TILE; sp.height = TILE;
        sp.zIndex = (ev.type === 'switchplate' || ev.type === 'gate') ? 0 : 1;
        this.evLayer.addChild(sp);
        this.eventSprites[ev.id] = sp;
      } else {
        sp.texture = Game.sheets[sheetName][cell];
        sp.visible = true;
      }
      if (tint) sp.tint = tint;
      const pos = this.eventPos(ev);
      sp.x = pos.x * TILE; sp.y = pos.y * TILE;
    }
  }
  eventPos(ev) {
    if (ev.type === 'rock') {
      const saved = Game.state.rockPos[this.mapId][ev.id];
      return saved || { x: ev.x, y: ev.y };
    }
    return { x: ev.x, y: ev.y };
  }
  buildPlayer() {
    const heroCls = Game.state.roster[Game.state.party[0]].cls;
    this.playerSp = new PIXI.Sprite(Game.sheets.chars[Party.classSprite[heroCls]]);
    this.playerSp.width = TILE; this.playerSp.height = TILE;
    this.playerSp.anchor.set(0.5, 0.5);
    this.container.addChild(this.playerSp);
    this.updatePlayerSprite();
  }
  updatePlayerSprite() {
    const px = (this.moving ? this.moving.vx : this.px) * TILE;
    const py = (this.moving ? this.moving.vy : this.py) * TILE;
    this.playerSp.x = px + TILE / 2;
    this.playerSp.y = py + TILE / 2;
    this.playerSp.scale.x = (this.dir === 'left' ? -1 : 1) * Math.abs(this.playerSp.scale.x);
  }
  camera() {
    const m = this.map;
    const vx = (this.moving ? this.moving.vx : this.px) * TILE + TILE / 2;
    const vy = (this.moving ? this.moving.vy : this.py) * TILE + TILE / 2;
    let cx = clamp(vx - VIEW_W / 2, 0, Math.max(0, m.w * TILE - VIEW_W));
    let cy = clamp(vy - VIEW_H / 2, 0, Math.max(0, m.h * TILE - VIEW_H));
    if (m.w * TILE < VIEW_W) cx = (m.w * TILE - VIEW_W) / 2;
    if (m.h * TILE < VIEW_H) cy = (m.h * TILE - VIEW_H) / 2;
    this.mapLayer.x = -cx; this.mapLayer.y = -cy;
    this.evLayer.x = -cx; this.evLayer.y = -cy;
    this.playerSp.x = vx - cx; this.playerSp.y = vy - cy;
    this.playerSp.scale.set(TILE / this.playerSp.texture.width * (this.dir === 'left' ? -1 : 1), TILE / this.playerSp.texture.height);
  }

  // ---- 判定 ----
  tileAt(x, y) {
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return null;
    return this.grid[y][x];
  }
  tileDef(x, y) {
    const ch = this.tileAt(x, y);
    if (ch == null) return null;
    return TILE_DEFS[this.map.tileset][ch];
  }
  isSolid(x, y) {
    const def = this.tileDef(x, y);
    if (!def || def.solid) return true;
    const ev = this.eventAt(x, y);
    if (ev) {
      if (['npc', 'shop', 'inn', 'church', 'tavern', 'ferry', 'rock', 'boss'].includes(ev.type)) {
        if (ev.type === 'boss' && ev.flag && Game.state.flags[ev.flag]) return false;
        if (ev.hideIf && ev.hideIf(Game.state)) return false;
        return true;
      }
      if (ev.type === 'door' && !Game.state.flags['door_' + ev.id]) return true;
      if (ev.type === 'gate' && !Game.state.flags['gate_' + ev.id]) return true;
    }
    return false;
  }
  eventAt(x, y) {
    for (const ev of this.map.events || []) {
      const pos = this.eventPos(ev);
      if (pos.x === x && pos.y === y) {
        if (ev.hideIf && ev.hideIf(Game.state)) continue;
        if (ev.type === 'boss' && ev.flag && Game.state.flags[ev.flag]) continue;
        return ev;
      }
    }
    return null;
  }
  rockAt(x, y) {
    for (const ev of this.map.events || []) {
      if (ev.type !== 'rock') continue;
      const pos = this.eventPos(ev);
      if (pos.x === x && pos.y === y) return ev;
    }
    return null;
  }

  // ---- 更新 ----
  update(dt) {
    this.msg.update(dt);
    if (this.busy || Fader.busy) return;
    if (this.moving) {
      this.moving.t += dt * 6.5;
      if (this.moving.t >= 1) {
        this.px = this.moving.tx; this.py = this.moving.ty;
        this.moving = null;
        Game.state.x = this.px; Game.state.y = this.py; Game.state.dir = this.dir;
        this.onStep();
      } else {
        const mv = this.moving;
        mv.vx = mv.fx + (mv.tx - mv.fx) * mv.t;
        mv.vy = mv.fy + (mv.ty - mv.fy) * mv.t;
      }
      this.camera();
      return;
    }
    // メニュー
    if (Input.hit('cancel') || Input.hit('menu')) {
      AudioSys.se('ok');
      SceneMgr.push(new MenuScene());
      return;
    }
    // 調べる/話す
    if (Input.hit('ok')) {
      this.interact();
      return;
    }
    // 移動
    const dirs = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    for (const [d, dx, dy] of dirs) {
      if (Input.down(d) || Input.hit(d)) {
        this.dir = d;
        const nx = this.px + dx, ny = this.py + dy;
        // 岩押し
        const rock = this.rockAt(nx, ny);
        if (rock) { this.tryPushRock(rock, dx, dy); return; }
        if (!this.isSolid(nx, ny)) {
          this.moving = { fx: this.px, fy: this.py, tx: nx, ty: ny, t: 0, vx: this.px, vy: this.py };
        } else this.camera();
        return;
      }
    }
  }

  onStep() {
    Game.state.steps++;
    const ev = this.eventAt(this.px, this.py);
    if (ev) {
      if (ev.type === 'warp' && !ev.locked) { this.doWarp(ev.to); return; }
      if (ev.type === 'warp' && ev.locked) { this.tryLockedWarp(ev); return; }
      if (ev.type === 'edge') { this.doWarp(ev.to); return; }
      if (ev.type === 'trigger') { this.runScript(ev.script, ev); return; }
    }
    // エンカウント
    const def = this.tileDef(this.px, this.py);
    if (def && def.enc && this.encGrace-- <= 0) {
      const table = this.encTable();
      if (table && randf() < table.rate) {
        this.encGrace = 4;
        this.startBattle(weightedPick(table.groups));
      }
    }
  }
  encTable() {
    const m = this.map;
    if (m.zones) {
      for (const z of m.zones) {
        const [x1, y1, x2, y2] = z.rect;
        if (this.px >= x1 && this.px <= x2 && this.py >= y1 && this.py <= y2) return ENC_TABLES[z.table];
      }
      return null;
    }
    return m.enc ? ENC_TABLES[m.enc] : null;
  }

  doWarp(to) {
    this.busy = true;
    Fader.fadeOut(0.3, () => {
      SceneMgr.replace(new FieldScene(to.map, to.x, to.y, this.dir));
      Fader.fadeIn(0.3);
    });
  }
  async tryLockedWarp(ev) {
    const need = ev.locked === 'cave' ? 'cavekey' : 'ancientkey';
    this.busy = true;
    if (Game.hasItem(need)) {
      AudioSys.se('door');
      await this.msg.say(T.doorUnlock(ITEMS[need].name));
      this.busy = false;
      this.doWarp(ev.to);
    } else {
      await this.msg.say(ev.lockMsg || T.doorLocked);
      // 一歩戻す
      const back = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[this.dir];
      this.px += back[0]; this.py += back[1];
      Game.state.x = this.px; Game.state.y = this.py;
      this.camera();
      this.busy = false;
    }
  }

  tryPushRock(rock, dx, dy) {
    const pos = this.eventPos(rock);
    const nx = pos.x + dx, ny = pos.y + dy;
    if (this.isSolid(nx, ny) || this.eventAt(nx, ny) && this.eventAt(nx, ny).type !== 'switchplate') {
      // 動かない
      this.camera();
      return;
    }
    Game.state.rockPos[this.mapId][rock.id] = { x: nx, y: ny };
    AudioSys.se('quake');
    this.refreshEvents();
    // プレイヤーが岩の元位置へ進む
    this.moving = { fx: this.px, fy: this.py, tx: pos.x, ty: pos.y, t: 0, vx: this.px, vy: this.py };
    this.checkGates();
  }
  checkGates() {
    for (const ev of this.map.events || []) {
      if (ev.type !== 'gate' || Game.state.flags['gate_' + ev.id]) continue;
      const allOn = ev.openWhen.every(pid => {
        const plate = this.map.events.find(e => e.id === pid);
        return plate && this.rockAt(plate.x, plate.y);
      });
      if (allOn) {
        Game.state.flags['gate_' + ev.id] = true;
        AudioSys.se('chest');
        this.refreshEvents();
        this.busy = true;
        this.msg.say(T.switchOn).then(() => { this.busy = false; });
      }
    }
  }

  // ---- 調べる ----
  async interact() {
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.dir];
    let ev = this.eventAt(this.px + dx, this.py + dy);
    // カウンター越し
    if (!ev) {
      const def = this.tileDef(this.px + dx, this.py + dy);
      if (def && def.counter) ev = this.eventAt(this.px + dx * 2, this.py + dy * 2);
    }
    if (!ev) return;
    this.busy = true;
    try {
      switch (ev.type) {
        case 'npc': {
          if (ev.script) { await this.runScriptInner(ev.script, ev); break; }
          const lines = typeof ev.dialog === 'function' ? ev.dialog(Game.state) : ev.dialog;
          await this.msg.say(lines);
          break;
        }
        case 'chest': {
          if (Game.state.openedChests[ev.flag]) { await this.msg.say(T.chestEmpty); break; }
          Game.state.openedChests[ev.flag] = true;
          AudioSys.se('chest');
          this.refreshEvents();
          if (ev.gold) { Game.state.gold += ev.gold; await this.msg.say(T.chestGold(ev.gold)); }
          else { Game.addItem(ev.item); await this.msg.say(T.chestGet(Game.itemName(ev.item))); }
          break;
        }
        case 'door': {
          const need = ev.locked === 'cave' ? 'cavekey' : 'ancientkey';
          if (Game.hasItem(need)) {
            AudioSys.se('door');
            Game.state.flags['door_' + ev.id] = true;
            this.refreshEvents();
            await this.msg.say(T.doorUnlock(ITEMS[need].name));
          } else await this.msg.say(ev.lockMsg || T.doorLocked);
          break;
        }
        case 'gate': await this.msg.say(ev.msg || T.cannotEnterYet); break;
        case 'rock': await this.msg.say(T.rockBlocked); break;
        case 'inn': await this.doInn(ev); break;
        case 'church': await this.doChurch(ev); break;
        case 'shop': {
          const hello = ev.hello || T.shopWelcome;
          await this.msg.say(hello);
          SceneMgr.push(new ShopScene(ev.shop));
          break;
        }
        case 'tavern': SceneMgr.push(new TavernScene()); break;
        case 'ferry': await this.doFerry(ev); break;
        case 'boss': await this.doBoss(ev); break;
      }
    } finally {
      this.busy = false;
    }
  }

  async doInn(ev) {
    const price = ev.price;
    await this.msg.say(T.innPrompt(price));
    const c = await this.msg.choice([T.innStay, T.innNo], { cancelIndex: 1 });
    if (c !== 0) return;
    if (Game.state.gold < price) { await this.msg.say(T.innNoMoney); return; }
    Game.state.gold -= price;
    Game.state.lastInn = { map: this.mapId, x: this.px, y: this.py };
    await new Promise(res => Fader.fadeOut(0.5, () => {
      Party.healAll();
      AudioSys.se('heal');
      Fader.fadeIn(0.5, res);
    }));
    await this.msg.say(T.innDone);
  }
  async doChurch(ev) {
    const dead = Party.members().filter(a => a.hp <= 0);
    if (!dead.length) {
      await this.msg.say('ようこそ。皆さまに星の加護がありますように。');
      return;
    }
    for (const a of dead) {
      const fee = a.lv * 12;
      await this.msg.say(`${a.name}を蘇らせますか？ お布施は${fee}Gです。`);
      const c = await this.msg.choice(['お願いする', 'やめる'], { cancelIndex: 1 });
      if (c === 0) {
        if (Game.state.gold < fee) { await this.msg.say('お布施が足りないようです…'); continue; }
        Game.state.gold -= fee;
        a.hp = Party.calcStats(a).maxhp;
        AudioSys.se('heal');
        await this.msg.say(T.revived(a.name));
      }
    }
  }
  async doFerry(ev) {
    if (ev.needPass && !Game.hasItem('ferrypass')) {
      await this.msg.say(ev.noPassMsg);
      return;
    }
    await this.msg.say(ev.msg);
    const c = await this.msg.choice(['乗る', 'やめる'], { cancelIndex: 1 });
    if (c === 0) this.doWarp(ev.dest);
  }

  async doBoss(ev) {
    if (ev.preMsg) await this.msg.say(ev.preMsg);
    await this.startBossBattle(ev);
  }
  startBossBattle(ev) {
    return new Promise((resolve) => {
      AudioSys.se('encounter');
      Fader.fadeOut(0.4, () => {
        SceneMgr.push(new BattleScene(ev.enemies.map(id => ({ id })), {
          boss: true, chain: ev.chain,
          onEnd: async (result) => {
            if (result === 'win') {
              if (ev.flag) Game.state.flags[ev.flag] = true;
              this.refreshEvents();
              this.busy = true;
              if (ev.orb) {
                Game.addItem(ev.orb);
                Game.state.flags[ev.orb + '_got'] = true;
                AudioSys.se('levelup');
                await this.msg.say([T.orbGet(ITEMS[ev.orb].name), T.orbCount(Game.orbCount())]);
              }
              if (ev.script === 'shade') await this.scriptEnding();
              if (ev.script === 'azraus_end') await this.scriptTrueEnding();
              this.busy = false;
            }
            resolve();
          },
        }));
        Fader.fadeIn(0.3);
      });
    });
  }
  startBattle(enemyIds) {
    this.busy = true;
    AudioSys.se('encounter');
    this.flashScreen(() => {
      SceneMgr.push(new BattleScene(enemyIds.map(id => ({ id })), {
        onEnd: () => { this.busy = false; },
      }));
    });
  }
  flashScreen(cb) {
    if (Game.reducedMotion) { Fader.fadeOut(0.15, () => { cb(); Fader.fadeIn(0.15); }); return; }
    let n = 0;
    const flash = () => {
      Fader.fadeOut(0.08, () => Fader.fadeIn(0.08, () => {
        if (++n < 2) flash();
        else Fader.fadeOut(0.15, () => { cb(); Fader.fadeIn(0.2); });
      }));
    };
    flash();
  }

  // ---- ストーリースクリプト ----
  async runScript(name, ev) {
    this.busy = true;
    try { await this.runScriptInner(name, ev); } finally { this.busy = false; }
  }
  async runScriptInner(name, ev) {
    const st = Game.state;
    const say = (l) => this.msg.say(l);
    switch (name) {
      case 'king': {
        if (!st.flags.metKing) {
          await say([
            '王「おお、よくぞ参った、' + st.roster[st.party[0]].name + 'よ。」',
            '王「知っての通り、魔王シェイドヴェインが星々の光…六輝のオーブを奪い、世界は闇に沈みつつある。」',
            '王「奪われしオーブは大地・潮・氷華・焔・風唱の5つ。そして最後の光燿のオーブは、我が王家が守っておる。」',
            '王「5つのオーブを取り戻したなら、光燿のオーブをそなたに託そう。」',
            '王「まずは東の【囁きの洞窟】じゃ。これを持ってゆけ。」',
          ]);
          Game.addItem('cavekey');
          AudioSys.se('chest');
          await say([T.chestGet(ITEMS.cavekey.name).replace('宝箱をあけた！ ', ''), '王「町の酒場で仲間を集めるのを忘れるでないぞ。」']);
          st.flags.metKing = true;
        } else if (st.flags.cleared_game) {
          await say(['王「エルデアの英雄よ！ そなたらの武勇は永遠に語り継がれよう。」', '王「…北西の祠に開いた黄昏の道。あの先の闇も、そなたらなら祓えるやもしれぬな。」']);
        } else if (Game.orbCount() >= 5 && !st.flags.got_lightorb) {
          await say([
            '王「おお…5つのオーブを取り戻したか！ 見事じゃ！」',
            '王「約束通り、王家に伝わる最後の輝き…光燿のオーブをそなたに託す。」',
          ]);
          Game.addItem('orb_light');
          st.flags.orb_light_got = true;
          st.flags.got_lightorb = true;
          AudioSys.se('levelup');
          await say([T.orbGet(ITEMS.orb_light.name), T.orbCount(6)]);
          Game.addItem('w_sword5');
          AudioSys.se('chest');
          await say([
            '王「それと、初代勇者の剣【光燿の聖剣】も持ってゆくがよい。」',
            `${ITEMS_OR_EQUIP_NAME('w_sword5')}を手に入れた！`,
            '王「六輝が揃った今、南の海の結界は消えた。魔王城は南の暗黒島にある。」',
            '王「エルデアの命運、そなたらに託したぞ！」',
          ]);
        } else {
          const hints = [];
          if (!st.flags.orb_earth_got) hints.push('王「まずは東の囁きの洞窟じゃ。奥の扉はそのカギで開く。」');
          else if (!st.flags.orb_tide_got) hints.push('王「東の国の港町メリアの近くに、遺跡が沈んでおると聞く。」');
          else hints.push('王「残るオーブは氷の国、火の山、風の祠…そなたの旅路に光のあらんことを。」');
          await say(['王「おお、勇者よ。旅は順調か。」', ...hints, `王「現在のオーブ… ${Game.orbCount()} / 6 じゃ。」`]);
        }
        break;
      }
      case 'shipowner': {
        if (st.flags.orb_tide_got && !Game.hasItem('ferrypass') && !st.flags.gave_pass) {
          await say([
            '船主「あんたが遺跡の主を倒してくれたのか！ 海が穏やかになったよ。」',
            '船主「礼にこいつをやろう。渡し船で南の砂の大陸へ行けるぜ。」',
          ]);
          Game.addItem('ferrypass');
          st.flags.gave_pass = true;
          AudioSys.se('chest');
          await say(`${ITEMS.ferrypass.name}を手に入れた！`);
        } else if (st.flags.gave_pass) {
          await say('船主「南の大陸は暑いぜ〜。水と氷の備えを忘れなさんな。」');
        } else {
          await say(['船主「沖の遺跡に魔物が住み着いてから、海が荒れて船が出せねえ。」', '船主「南東の海辺の洞窟から遺跡に入れるらしいが…」']);
        }
        break;
      }
      case 'shadowgate': {
        if (!st.flags.cleared_game) {
          await say('古い祠だ。静かに眠っている…');
        } else {
          await say('祠の奥に、黄昏色の渦が揺らめいている…');
          const c = await this.msg.choice(['渦に飛び込む', 'やめる'], { cancelIndex: 1 });
          if (c === 0) this.doWarp({ map: 'shadow_world', x: 3, y: 7 });
        }
        break;
      }
      case 'shadowgate_back': {
        await say('光の渦が揺らめいている。元の世界へ戻れそうだ。');
        const c = await this.msg.choice(['戻る', 'やめる'], { cancelIndex: 1 });
        if (c === 0) this.doWarp({ map: 'world', x: 3, y: 7 });
        break;
      }
    }
  }

  async scriptEnding() {
    Game.state.flags.cleared_game = true;
    AudioSys.playBgm('ending');
    await this.msg.say([
      '闇が晴れ、六つの光が空へ昇ってゆく…',
      '星々はふたたび瞬き、エルデアに朝が訪れた。',
    ]);
    SceneMgr.push(new EndingScene(false));
  }
  async scriptTrueEnding() {
    Game.state.flags.beat_azraus = true;
    AudioSys.playBgm('ending');
    await this.msg.say([
      '混沌の渦が消え、黄昏の世界に静寂が戻る。',
      'すべての可能性のエルデアが、光に包まれた——。',
    ]);
    SceneMgr.push(new EndingScene(true));
  }

  showMapName() {
    const label = UI.text(this.map.name, 20, null, { bold: true, stroke: true });
    label.anchor.set(0.5, 0);
    label.x = VIEW_W / 2; label.y = 18;
    const bg = new PIXI.Graphics();
    bg.roundRect(VIEW_W / 2 - label.width / 2 - 16, 12, label.width + 32, 36, 8).fill({ color: 0x000000, alpha: 0.55 });
    this.container.addChild(bg, label);
    let t = 0;
    const tick = (tk) => {
      if (bg.destroyed || label.destroyed) { Game.app.ticker.remove(tick); return; }
      t += tk.deltaMS / 1000;
      if (t > 1.6) {
        const a = 1 - (t - 1.6) / 0.4;
        bg.alpha = label.alpha = Math.max(0, a);
        if (a <= 0) { Game.app.ticker.remove(tick); bg.destroy(); label.destroy(); }
      }
    };
    Game.app.ticker.add(tick);
  }
}

// 名前解決ヘルパ(アイテム/装備どちらでも)
function ITEMS_OR_EQUIP_NAME(id) { return ITEMS[id] ? ITEMS[id].name : EQUIPS[id].name; }
