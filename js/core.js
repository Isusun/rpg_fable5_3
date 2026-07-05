// ============================================================
// core.js - アプリ基盤・入力・シーン管理・セーブ/ロード
// ============================================================
'use strict';

const VIEW_W = 960, VIEW_H = 540;
const TILE = 40;
const SAVE_KEY = 'sixorbs_save_v1';
const SETTINGS_KEY = 'sixorbs_settings_v1';

const rand = (n) => Math.floor(Math.random() * n);
const randf = () => Math.random();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[rand(arr.length)];
function weightedPick(list) { // [[value, weight], ...]
  let total = 0;
  for (const [, w] of list) total += w;
  let r = randf() * total;
  for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
  return list[list.length - 1][0];
}

// ============ 入力 ============
const Input = {
  held: {}, pressed: {}, repeatT: {},
  map: {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    Enter: 'ok', ' ': 'ok', z: 'ok',
    Escape: 'cancel', x: 'cancel', Backspace: 'cancel',
  },
  init() {
    window.addEventListener('keydown', (e) => {
      const k = this.map[e.key] || this.map[e.key.toLowerCase()];
      if (k) {
        e.preventDefault();
        if (!this.held[k]) this.pressed[k] = true;
        this.held[k] = true;
        AudioSys.ensureCtx();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = this.map[e.key] || this.map[e.key.toLowerCase()];
      if (k) this.held[k] = false;
    });
    // タッチボタン
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const down = (e) => { e.preventDefault(); el.classList.add('pressed'); this.virtualDown(key); AudioSys.ensureCtx(); };
      const up = (e) => { e.preventDefault(); el.classList.remove('pressed'); this.virtualUp(key); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointerleave', up);
      el.addEventListener('pointercancel', up);
    };
    bind('btn-up', 'up'); bind('btn-down', 'down'); bind('btn-left', 'left'); bind('btn-right', 'right');
    bind('btn-a', 'ok'); bind('btn-b', 'cancel'); bind('btn-menu', 'menu');
    // タッチデバイスなら仮想パッド表示
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.getElementById('touch-ui').classList.add('visible');
    }
  },
  virtualDown(k) { if (!this.held[k]) this.pressed[k] = true; this.held[k] = true; },
  virtualUp(k) { this.held[k] = false; },
  // 押した瞬間
  hit(k) { return !!this.pressed[k]; },
  // 押しっぱなし
  down(k) { return !!this.held[k]; },
  // リピート付き(メニュー用): 押した瞬間 or 一定時間ごと
  repeat(k, dt) {
    if (this.pressed[k]) { this.repeatT[k] = -0.35; return true; }
    if (this.held[k]) {
      this.repeatT[k] = (this.repeatT[k] || 0) + dt;
      if (this.repeatT[k] >= 0.09) { this.repeatT[k] = 0; return true; }
    } else this.repeatT[k] = 0;
    return false;
  },
  endFrame() { this.pressed = {}; },
};

// ============ シーン管理(ステートマシン) ============
// Scene: { enter(), exit(), update(dt), container }
const SceneMgr = {
  stack: [],
  get current() { return this.stack[this.stack.length - 1] || null; },
  push(scene) {
    if (this.current && this.current.pause) this.current.pause();
    this.stack.push(scene);
    Game.stage.addChild(scene.container);
    scene.enter();
  },
  pop() {
    const s = this.stack.pop();
    if (s) { s.exit && s.exit(); Game.stage.removeChild(s.container); s.container.destroy({ children: true }); }
    if (this.current && this.current.resume) this.current.resume();
  },
  replace(scene) {
    while (this.stack.length) this.pop();
    this.push(scene);
  },
  // 現在のシーンだけ置換（下のスタックは残す）
  swapTop(scene) { this.pop(); this.push(scene); },
  update(dt) {
    const s = this.current;
    if (s) s.update(dt);
  },
};

// ============ ゲーム全体状態 ============
const Game = {
  app: null, stage: null, textures: {}, sheets: {},
  state: null,       // 進行データ(セーブ対象)
  reducedMotion: false,

  async init() {
    this.app = new PIXI.Application();
    await this.app.init({ width: VIEW_W, height: VIEW_H, background: 0x0a0a14, antialias: false });
    document.getElementById('game-container').appendChild(this.app.canvas);
    this.stage = this.app.stage;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Input.init();
    this.loadSettings();
    this.app.ticker.add((ticker) => {
      const dt = Math.min(ticker.deltaMS / 1000, 0.1);
      if (!Fader.busy) SceneMgr.update(dt); // フェード中は入力・進行を停止
      Fader.update(dt);
      Input.endFrame();
      if (this.state) this.state.playTime += dt;
    });
  },
  resize() {
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    this.app.canvas.style.width = `${VIEW_W * scale}px`;
    this.app.canvas.style.height = `${VIEW_H * scale}px`;
  },

  // ---- 新規ゲーム状態 ----
  newState(heroName, heroClass) {
    const hero = Party.createActor('hero1', heroName, heroClass);
    return {
      version: 1,
      roster: { hero1: hero },
      party: ['hero1'],
      gold: 60,
      inv: { herb: 4, antidote: 1 },
      flags: {},
      map: 'town_harbel', x: 13, y: 9, dir: 'down',
      lastInn: { map: 'town_harbel', x: 13, y: 9 },
      steps: 0, playTime: 0,
      openedChests: {}, rockPos: {},
    };
  },

  orbCount() {
    if (!this.state) return 0;
    return ORB_IDS.filter(id => this.state.inv[id] > 0).length;
  },
  hasItem(id) { return (this.state.inv[id] || 0) > 0; },
  addItem(id, n = 1) {
    this.state.inv[id] = (this.state.inv[id] || 0) + n;
  },
  removeItem(id, n = 1) {
    const cur = this.state.inv[id] || 0;
    if (cur <= n) delete this.state.inv[id];
    else this.state.inv[id] = cur - n;
  },
  itemName(id) { return ITEMS[id] ? ITEMS[id].name : (EQUIPS[id] ? EQUIPS[id].name : '???'); },

  // ---- セーブ/ロード ----
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      return true;
    } catch (e) { console.warn('save failed', e); return false; }
  },
  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  },
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const st = JSON.parse(raw);
      // 妥当性チェック(壊れたセーブは捨てる)
      if (!st || st.version !== 1 || !st.roster || !Array.isArray(st.party) || !st.party.length) return null;
      if (!MAPS[st.map]) return null;
      for (const id of st.party) if (!st.roster[id]) return null;
      for (const aid of Object.keys(st.roster)) {
        const a = st.roster[aid];
        if (!CLASSES[a.cls] || typeof a.lv !== 'number') return null;
        Party.normalizeActor(a);
      }
      st.inv = st.inv || {}; st.flags = st.flags || {};
      st.openedChests = st.openedChests || {}; st.rockPos = st.rockPos || {};
      st.gold = Math.max(0, Math.floor(st.gold || 0));
      st.playTime = st.playTime || 0; st.steps = st.steps || 0;
      if (!st.lastInn || !MAPS[st.lastInn.map]) st.lastInn = { map: 'town_harbel', x: 13, y: 9 };
      return st;
    } catch (e) { console.warn('load failed', e); return null; }
  },
  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          AudioSys.settings.bgmOn = !!s.bgmOn;
          AudioSys.settings.seOn = !!s.seOn;
          if (typeof s.volume === 'number') AudioSys.settings.volume = clamp(s.volume, 0, 1);
          if (typeof s.reduceFx === 'boolean') this.reducedMotion = s.reduceFx || this.reducedMotion;
        }
      }
    } catch (e) { /* 破損時はデフォルト */ }
    AudioSys.applyVolume();
  },
  saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        bgmOn: AudioSys.settings.bgmOn, seOn: AudioSys.settings.seOn,
        volume: AudioSys.settings.volume, reduceFx: this.reducedMotion,
      }));
    } catch (e) { /* noop */ }
  },
};

// ============ フェード演出 ============
const Fader = {
  overlay: null, t: 0, dur: 0, mode: null, cb: null, color: 0x000000,
  init() {
    this.overlay = new PIXI.Graphics();
    this.overlay.rect(0, 0, VIEW_W, VIEW_H).fill(0x000000);
    this.overlay.alpha = 0;
    this.overlay.zIndex = 9999;
    this.overlay.eventMode = 'none';
    Game.stage.addChild(this.overlay);
    Game.stage.sortableChildren = true;
  },
  fadeOut(dur, cb) {
    if (Game.reducedMotion) dur = Math.min(dur, 0.12);
    this.mode = 'out'; this.t = 0; this.dur = dur; this.cb = cb;
  },
  fadeIn(dur, cb) {
    if (Game.reducedMotion) dur = Math.min(dur, 0.12);
    this.mode = 'in'; this.t = 0; this.dur = dur; this.cb = cb;
  },
  update(dt) {
    if (!this.mode) return;
    this.t += dt;
    const p = clamp(this.t / this.dur, 0, 1);
    this.overlay.alpha = this.mode === 'out' ? p : 1 - p;
    Game.stage.setChildIndex(this.overlay, Game.stage.children.length - 1);
    if (p >= 1) {
      const cb = this.cb;
      this.mode = null; this.cb = null;
      if (cb) cb();
    }
  },
  get busy() { return this.mode !== null; },
};

// マップデータ検証(開発時の座標ずれ検出)
function validateMaps() {
  for (const id of Object.keys(MAPS)) {
    const m = MAPS[id];
    const w = m.rows[0].length;
    m.w = w; m.h = m.rows.length;
    m.rows.forEach((row, i) => {
      if (row.length !== w) console.error(`[MAP ${id}] row ${i} length ${row.length} != ${w}`);
      const ts = TILE_DEFS[m.tileset];
      for (const ch of row) {
        if (!ts[ch]) console.error(`[MAP ${id}] unknown tile char '${ch}' in row ${i}`);
      }
    });
    for (const ev of m.events || []) {
      if (ev.x < 0 || ev.x >= m.w || ev.y < 0 || ev.y >= m.h) {
        console.error(`[MAP ${id}] event ${ev.id} out of bounds (${ev.x},${ev.y})`);
      }
    }
  }
}
