// ============================================================
// main.js - 起動・アセットロード・タイトル・キャラメイク・エンディング
// ============================================================
'use strict';

// マゼンタ背景をチロマキーで透過
function chromaKey(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // マゼンタ系(#FF00FF近傍)を透過
    if (r > 140 && b > 140 && g < 110 && Math.abs(r - b) < 90) d[i + 3] = 0;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

// シートをセル分割
function sliceSheet(baseTex, cols, rows) {
  const cw = baseTex.width / cols, ch = baseTex.height / rows;
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push(new PIXI.Texture({
        source: baseTex.source,
        frame: new PIXI.Rectangle(x * cw, y * ch, cw, ch),
      }));
    }
  }
  return cells;
}

async function loadAssets() {
  const bar = document.getElementById('loadbar');
  const files = [
    ['tiles_world', 'assets/tiles_world.png', false, 4, 4],
    ['tiles_town', 'assets/tiles_town.png', false, 4, 4],
    ['tiles_dungeon', 'assets/tiles_dungeon.png', false, 4, 4],
    ['chars', 'assets/chars.png', true, 4, 4],
    ['enemies1', 'assets/enemies1.png', true, 4, 4],
    ['enemies2', 'assets/enemies2.png', true, 4, 4],
    ['enemies3', 'assets/enemies3.png', true, 2, 2],
    ['title', 'assets/title.png', false, 1, 1],
  ];
  let done = 0;
  for (const [key, url, keyed, cols, rows] of files) {
    try {
      const tex = await PIXI.Assets.load(url);
      let baseTex = tex;
      if (keyed) {
        const canvas = chromaKey(tex.source.resource);
        baseTex = PIXI.Texture.from(canvas);
      }
      baseTex.source.scaleMode = 'nearest';
      if (cols === 1 && rows === 1) Game.textures[key] = baseTex;
      else Game.sheets[key] = sliceSheet(baseTex, cols, rows);
    } catch (e) {
      console.error('asset load failed:', url, e);
      // フォールバック: 単色テクスチャで続行(ソフトロック防止)
      const g = new PIXI.Graphics();
      g.rect(0, 0, 64, 64).fill(0x808080);
      const tex = Game.app.renderer.generateTexture(g);
      if (cols === 1 && rows === 1) Game.textures[key] = tex;
      else Game.sheets[key] = new Array(cols * rows).fill(tex);
    }
    done++;
    bar.style.width = `${Math.floor(done / files.length * 100)}%`;
  }
}

// ============ タイトル ============
class TitleScene {
  constructor(msg) { this.container = new PIXI.Container(); this.initialMsg = msg; }
  enter() {
    AudioSys.playBgm('title');
    const bg = new PIXI.Sprite(Game.textures.title);
    const scale = Math.max(VIEW_W / bg.texture.width, VIEW_H / bg.texture.height);
    bg.scale.set(scale);
    bg.x = (VIEW_W - bg.width) / 2; bg.y = (VIEW_H - bg.height) / 2;
    this.container.addChild(bg);
    const shade = new PIXI.Graphics();
    shade.rect(0, 0, VIEW_W, VIEW_H).fill({ color: 0x000020, alpha: 0.35 });
    this.container.addChild(shade);
    const title = UI.text(T.gameTitle, 64, 0xffe8a0, { bold: true, stroke: true });
    title.anchor.set(0.5);
    title.x = VIEW_W / 2; title.y = 120;
    this.container.addChild(title);
    const sub = UI.text(T.gameSubtitle, 20, 0xd0c8b0, { stroke: true });
    sub.anchor.set(0.5);
    sub.x = VIEW_W / 2; sub.y = 175;
    this.container.addChild(sub);
    this.msg = new MsgWindow(this.container);
    const hasSave = Game.hasSave();
    this.menu = new Menu({
      items: [
        { label: T.titleContinue, disabled: !hasSave },
        { label: T.titleNewGame },
        { label: T.titleSettings },
      ],
      x: VIEW_W / 2 - 140, y: 320, w: 280, rowH: 46, visibleRows: 3,
      index: hasSave ? 0 : 1,
      onOk: (i) => {
        if (i === 0) this.doContinue();
        else if (i === 1) this.doNewGame();
        else this.showSettings();
      },
    });
    this.container.addChild(this.menu.container);
    if (this.initialMsg) this.msg.say(this.initialMsg);
  }
  exit() {}
  update(dt) {
    if (NameInput.current) { NameInput.current.update(dt); return; }
    if (this.msg.busy) { this.msg.update(dt); return; }
    if (this.settingsMenu) { this.settingsMenu.update(dt); return; }
    this.menu.update(dt);
  }
  doContinue() {
    const st = Game.load();
    if (!st) {
      this.msg.say(T.brokenSaveData).then(() => this.doNewGame());
      return;
    }
    Game.state = st;
    Fader.fadeOut(0.4, () => {
      SceneMgr.replace(new FieldScene(st.map, st.x, st.y, st.dir));
      Fader.fadeIn(0.4);
    });
  }
  doNewGame() {
    SceneMgr.push(new CharMakeScene());
  }
  showSettings() {
    const mkItems = () => [
      { label: T.settingBgm, right: AudioSys.settings.bgmOn ? T.settingOn : T.settingOff },
      { label: T.settingSe, right: AudioSys.settings.seOn ? T.settingOn : T.settingOff },
      { label: T.settingVolume, right: `${Math.round(AudioSys.settings.volume * 10)} / 10` },
      { label: T.menuClose },
    ];
    this.menu.active = false;
    this.settingsMenu = new Menu({
      items: mkItems(), x: VIEW_W / 2 - 160, y: 300, w: 320, rowH: 44, visibleRows: 4,
      onOk: (i) => {
        if (i === 0) { AudioSys.setBgmOn(!AudioSys.settings.bgmOn); if (AudioSys.settings.bgmOn) AudioSys.playBgm('title', true); }
        if (i === 1) { AudioSys.setSeOn(!AudioSys.settings.seOn); AudioSys.se('ok'); }
        if (i === 2) AudioSys.setVolume(AudioSys.settings.volume >= 1 ? 0.1 : AudioSys.settings.volume + 0.1);
        if (i === 3) { this.closeSettings(); return; }
        Game.saveSettings();
        this.settingsMenu.setItems(mkItems(), true);
      },
      onCancel: () => this.closeSettings(),
    });
    this.container.addChild(this.settingsMenu.container);
  }
  closeSettings() {
    Game.saveSettings();
    this.settingsMenu.destroy();
    this.settingsMenu = null;
    this.menu.active = true;
  }
}

// ============ キャラクターメイク ============
class CharMakeScene {
  constructor() { this.container = new PIXI.Container(); }
  enter() {
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, VIEW_W, VIEW_H).fill(0x101024);
    this.container.addChild(bg);
    const title = UI.text(T.charMakeTitle, 28, null, { bold: true, stroke: true });
    title.x = 40; title.y = 24;
    this.container.addChild(title);
    this.msg = new MsgWindow(this.container);
    this.step = 'class';
    this.showClassSelect();
  }
  exit() {}
  update(dt) {
    if (NameInput.current) { NameInput.current.update(dt); return; }
    if (this.msg.busy) { this.msg.update(dt); return; }
    if (this.menu) this.menu.update(dt);
  }
  showClassSelect() {
    const clsIds = Object.keys(CLASSES);
    const info = new PIXI.Container();
    info.x = 380; info.y = 90;
    this.container.addChild(info);
    const drawInfo = (cls) => {
      info.removeChildren().forEach(c => c.destroy({ children: true }));
      info.addChild(UI.window(520, 360));
      const c = CLASSES[cls];
      const face = new PIXI.Sprite(Game.sheets.chars[Party.classSprite[cls]]);
      face.width = 96; face.height = 96;
      face.x = 24; face.y = 20;
      info.addChild(face);
      const name = UI.text(c.name, 26, null, { bold: true });
      name.x = 140; name.y = 30;
      info.addChild(name);
      const desc = UI.text(c.desc, 16, UI.colors.textDim, { wrap: true, wrapWidth: 350 });
      desc.x = 140; desc.y = 72;
      info.addChild(desc);
      const rows = [
        ['HP', c.base.hp, 10], ['MP', c.base.mp, 16], [T.statAtk, c.base.atk, 12],
        [T.statDef, c.base.def, 12], [T.statAgi, c.base.agi, 12], [T.statMag, c.base.mag, 12], [T.statLuk, c.base.luk, 12],
      ];
      rows.forEach(([label, v, max], i) => {
        const kt = UI.text(label, 15, UI.colors.textDim);
        kt.x = 30; kt.y = 140 + i * 30;
        const gauge = UI.gauge(240, 10, v / (max * 3), 0x90b8e8);
        gauge.x = 120; gauge.y = 146 + i * 30;
        const vt = UI.text(String(v), 15);
        vt.x = 380; vt.y = 140 + i * 30;
        info.addChild(kt, gauge, vt);
      });
    };
    this.menu = new Menu({
      items: clsIds.map(c => ({ label: CLASSES[c].name })),
      x: 40, y: 90, w: 280, rowH: 52, visibleRows: 6,
      onChange: (i) => drawInfo(clsIds[i]),
      onOk: async (i) => {
        const cls = clsIds[i];
        const name = await NameInput.show(this.container, 'レイン');
        if (!name) return;
        await this.confirmStart(name, cls);
      },
      onCancel: () => SceneMgr.pop(),
    });
    this.container.addChild(this.menu.container);
    drawInfo(clsIds[0]);
    const hint = UI.text('クラスを選んで決定 → 名前入力', 15, UI.colors.textDim);
    hint.x = 44; hint.y = 448;
    this.container.addChild(hint);
  }
  async confirmStart(name, cls) {
    await this.msg.say(`${name}（${CLASSES[cls].name}）。 ${T.charMakeConfirm}`);
    const c = await this.msg.choice(['はじめる', 'えらびなおす'], { cancelIndex: 1 });
    if (c !== 0) return;
    Game.state = Game.newState(name, cls);
    AudioSys.stopBgm();
    Fader.fadeOut(0.6, async () => {
      SceneMgr.replace(new FieldScene('town_harbel', 13, 9, 'up'));
      Fader.fadeIn(0.6, async () => {
        const fs = SceneMgr.current;
        fs.busy = true;
        await fs.msg.say([
          '――星々の光が消えた夜。',
          '魔王シェイドヴェインは六輝のオーブを奪い、世界エルデアは終わらない黄昏に沈み始めた。',
          `ハーベルの王より召し出された若き冒険者・${Game.state.roster.hero1.name}。`,
          '玉座の間で、王が待っている。（上へ進もう。▲ボタン/矢印キーで移動）',
        ]);
        fs.busy = false;
      });
    });
  }
}

// ============ エンディング ============
class EndingScene {
  constructor(trueEnd) {
    this.container = new PIXI.Container();
    this.trueEnd = trueEnd;
  }
  enter() {
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, VIEW_W, VIEW_H).fill(0x000010);
    this.container.addChild(bg);
    this.msg = new MsgWindow(this.container);
    this.done = false;
    this.play();
  }
  exit() {}
  update(dt) { this.msg.update(dt); }
  async play() {
    AudioSys.playBgm('ending');
    const title = UI.text(this.trueEnd ? T.trueEndTitle : T.endingTitle, 42, 0xffe8a0, { bold: true, stroke: true });
    title.anchor.set(0.5);
    title.x = VIEW_W / 2; title.y = 160;
    title.alpha = 0;
    this.container.addChild(title);
    // フェードイン
    await new Promise(res => {
      let t = 0;
      const tick = (tk) => {
        if (title.destroyed) { Game.app.ticker.remove(tick); res(); return; }
        t += tk.deltaMS / 1000;
        title.alpha = Math.min(1, t / 1.2);
        if (t >= 1.3) { Game.app.ticker.remove(tick); res(); }
      };
      Game.app.ticker.add(tick);
    });
    const heroName = Game.state.roster.hero1.name;
    if (this.trueEnd) {
      await this.msg.say([
        '混沌神アズラウスは消滅し、裏の世界にも光が満ちた。',
        `${heroName}たちの旅は、すべての世界を救った真の英雄譚として語り継がれる。`,
        T.thanks,
      ]);
      const end = UI.text(T.theEnd, 36, 0xffffff, { bold: true });
      end.anchor.set(0.5);
      end.x = VIEW_W / 2; end.y = 320;
      this.container.addChild(end);
      await this.msg.say('タイトルへ戻ります。（冒険の続きは「つづきから」でどうぞ）');
      Game.save();
      Fader.fadeOut(1.0, () => {
        SceneMgr.replace(new TitleScene());
        Fader.fadeIn(1.0);
      });
    } else {
      await this.msg.say([
        `魔王は滅び、六輝のオーブは空へ帰った。${heroName}たちは英雄として迎えられた。`,
        T.postGameMsg,
        '（クリアデータをセーブしました。裏世界に挑戦できます！）',
      ]);
      Game.save();
      Fader.fadeOut(0.8, () => {
        SceneMgr.pop(); // エンディングを閉じてフィールドへ
        Fader.fadeIn(0.8);
      });
    }
  }
}

// ============ 起動 ============
(async () => {
  try {
    await Game.init();
    Fader.init();
    validateMaps();
    await loadAssets();
    document.getElementById('loading').style.display = 'none';
    SceneMgr.push(new TitleScene());
  } catch (e) {
    console.error(e);
    document.getElementById('loading').innerHTML =
      `<div>エラーが発生しました。ページを再読み込みしてください。<br><small>${String(e).slice(0, 200)}</small></div>`;
  }
})();
