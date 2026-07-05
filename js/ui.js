// ============================================================
// ui.js - ウィンドウ / メニュー / メッセージ 共通UI部品
// ============================================================
'use strict';

const UI = {
  colors: {
    winBg: 0x101030, winBgA: 0.92, winBorder: 0xe8e0c8,
    text: 0xf0ead8, textDim: 0x9a9480, textDisabled: 0x6a6a72,
    cursor: 0xffd868, hp: 0x78e088, hpLow: 0xe8b040, hpCrit: 0xe86060,
    mp: 0x78a8f0, gold: 0xffd868, danger: 0xff8080, good: 0x90e890,
  },
  fontFamily: "'Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',sans-serif",

  window(w, h, opts = {}) {
    const g = new PIXI.Graphics();
    g.roundRect(0, 0, w, h, 8).fill({ color: opts.bg ?? this.colors.winBg, alpha: opts.alpha ?? this.colors.winBgA });
    g.roundRect(1.5, 1.5, w - 3, h - 3, 7).stroke({ color: opts.border ?? this.colors.winBorder, width: 3 });
    return g;
  },
  text(str, size = 18, color = null, opts = {}) {
    return new PIXI.Text({
      text: str,
      style: {
        fontFamily: this.fontFamily, fontSize: size,
        fill: color ?? this.colors.text,
        fontWeight: opts.bold ? 'bold' : 'normal',
        stroke: opts.stroke ? { color: 0x000000, width: 3 } : undefined,
        wordWrap: !!opts.wrap, wordWrapWidth: opts.wrapWidth || 800,
        breakWords: true, lineHeight: opts.lineHeight || size * 1.45,
      },
    });
  },
  gauge(w, h, ratio, color, bgColor = 0x30304a) {
    const g = new PIXI.Graphics();
    g.roundRect(0, 0, w, h, h / 2).fill(bgColor);
    if (ratio > 0) g.roundRect(0, 0, Math.max(h, w * clamp(ratio, 0, 1)), h, h / 2).fill(color);
    g.roundRect(0.5, 0.5, w - 1, h - 1, h / 2).stroke({ color: 0x000000, width: 1, alpha: 0.5 });
    return g;
  },
  hpColor(ratio) {
    return ratio <= 0.25 ? this.colors.hpCrit : ratio <= 0.5 ? this.colors.hpLow : this.colors.hp;
  },
};

// ============ 選択メニュー ============
// items: [{label, right?, disabled?, help?, color?}]
class Menu {
  constructor(opts) {
    this.items = opts.items || [];
    this.cols = opts.cols || 1;
    this.x = opts.x || 0; this.y = opts.y || 0;
    this.w = opts.w || 260;
    this.rowH = opts.rowH || 34;
    this.visibleRows = opts.visibleRows || Math.ceil(this.items.length / this.cols);
    this.onOk = opts.onOk || (() => {});
    this.onCancel = opts.onCancel || null;
    this.onChange = opts.onChange || null;
    this.fontSize = opts.fontSize || 18;
    this.noWindow = opts.noWindow;
    this.index = clamp(opts.index || 0, 0, Math.max(0, this.items.length - 1));
    this.scroll = 0;
    this.active = true;
    this.container = new PIXI.Container();
    this.container.x = this.x; this.container.y = this.y;
    this.padX = opts.padX ?? 16; this.padY = opts.padY ?? 12;
    this.build();
  }
  get rows() { return Math.ceil(this.items.length / this.cols); }
  get height() { return this.visibleRows * this.rowH + this.padY * 2; }
  build() {
    this.container.removeChildren().forEach(c => c.destroy({ children: true }));
    if (!this.noWindow) this.container.addChild(UI.window(this.w, this.height));
    this.itemArea = new PIXI.Container();
    this.container.addChild(this.itemArea);
    this.cursorG = new PIXI.Graphics();
    this.itemArea.addChild(this.cursorG);
    this.labels = [];
    this.renderItems();
  }
  colW() { return (this.w - this.padX * 2) / this.cols; }
  renderItems() {
    if (this.destroyed) return;
    // 既存ラベル破棄
    for (const l of this.labels) l.destroy({ children: true });
    this.labels = [];
    this.ensureVisible();
    const startRow = this.scroll;
    const endRow = Math.min(this.rows, startRow + this.visibleRows);
    for (let r = startRow; r < endRow; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        if (i >= this.items.length) break;
        const it = this.items[i];
        const cont = new PIXI.Container();
        const color = it.disabled ? UI.colors.textDisabled : (it.color ?? UI.colors.text);
        const label = UI.text(it.label, this.fontSize, color);
        label.x = this.padX + c * this.colW() + 22;
        label.y = this.padY + (r - startRow) * this.rowH + (this.rowH - this.fontSize * 1.3) / 2;
        cont.addChild(label);
        if (it.right != null) {
          const rt = UI.text(String(it.right), this.fontSize, it.disabled ? UI.colors.textDisabled : UI.colors.textDim);
          rt.anchor?.set && rt.anchor.set(1, 0);
          rt.x = this.padX + (c + 1) * this.colW() - 8;
          rt.y = label.y;
          rt.anchor.set(1, 0);
          cont.addChild(rt);
        }
        // タッチ対応
        const hit = new PIXI.Graphics();
        hit.rect(this.padX + c * this.colW(), this.padY + (r - startRow) * this.rowH, this.colW(), this.rowH).fill({ color: 0xffffff, alpha: 0.0001 });
        hit.eventMode = 'static';
        hit.cursor = 'pointer';
        hit.on('pointertap', () => {
          if (!this.active) return;
          if (this.index === i) this.confirm();
          else { this.index = i; AudioSys.se('cursor'); this.renderItems(); if (this.onChange) this.onChange(this.index); }
        });
        cont.addChild(hit);
        this.itemArea.addChild(cont);
        this.labels.push(cont);
      }
    }
    this.drawCursor();
    // スクロール矢印
    if (this.scrollArrows) { this.scrollArrows.destroy(); this.scrollArrows = null; }
    if (this.rows > this.visibleRows) {
      const g = new PIXI.Graphics();
      if (this.scroll > 0) g.poly([this.w / 2 - 8, 10, this.w / 2 + 8, 10, this.w / 2, 3]).fill(UI.colors.textDim);
      if (this.scroll + this.visibleRows < this.rows) g.poly([this.w / 2 - 8, this.height - 10, this.w / 2 + 8, this.height - 10, this.w / 2, this.height - 3]).fill(UI.colors.textDim);
      this.container.addChild(g);
      this.scrollArrows = g;
    }
  }
  ensureVisible() {
    const row = Math.floor(this.index / this.cols);
    if (row < this.scroll) this.scroll = row;
    if (row >= this.scroll + this.visibleRows) this.scroll = row - this.visibleRows + 1;
  }
  drawCursor() {
    if (this.destroyed) return;
    this.cursorG.clear();
    if (!this.items.length) return;
    const row = Math.floor(this.index / this.cols);
    if (row < this.scroll || row >= this.scroll + this.visibleRows) return;
    const c = this.index % this.cols;
    const x = this.padX + c * this.colW();
    const y = this.padY + (row - this.scroll) * this.rowH;
    this.cursorG.roundRect(x + 2, y + 2, this.colW() - 4, this.rowH - 4, 6)
      .stroke({ color: UI.colors.cursor, width: 2 })
      .fill({ color: UI.colors.cursor, alpha: 0.12 });
    // ▶マーク
    this.cursorG.poly([x + 8, y + this.rowH / 2 - 6, x + 8, y + this.rowH / 2 + 6, x + 17, y + this.rowH / 2]).fill(UI.colors.cursor);
  }
  move(d) {
    if (!this.items.length) return;
    const old = this.index;
    if (this.cols === 1) {
      this.index = (this.index + d + this.items.length) % this.items.length;
    } else {
      if (d === -1 || d === 1) { // 左右
        this.index = clamp(this.index + d, 0, this.items.length - 1);
      } else { // 上下 (±cols)
        let ni = this.index + d;
        if (ni < 0) ni = this.index + (this.rows - 1) * this.cols, ni = ni >= this.items.length ? this.items.length - 1 : ni;
        else if (ni >= this.items.length) ni = this.index % this.cols;
        this.index = clamp(ni, 0, this.items.length - 1);
      }
    }
    if (old !== this.index) {
      AudioSys.se('cursor');
      this.renderItems();
      if (this.onChange) this.onChange(this.index);
    }
  }
  confirm() {
    const it = this.items[this.index];
    if (!it || it.disabled) { AudioSys.se('buzzer'); return; }
    AudioSys.se('ok');
    this.onOk(this.index, it);
  }
  update(dt) {
    if (!this.active || this.destroyed) return;
    if (Input.repeat('up', dt)) this.move(this.cols === 1 ? -1 : -this.cols);
    if (Input.repeat('down', dt)) this.move(this.cols === 1 ? 1 : this.cols);
    if (this.cols > 1) {
      if (Input.repeat('left', dt)) this.move(-1);
      if (Input.repeat('right', dt)) this.move(1);
    }
    if (Input.hit('ok')) this.confirm();
    if (Input.hit('cancel') && this.onCancel) { AudioSys.se('cancel'); this.onCancel(); }
  }
  setItems(items, keepIndex = false) {
    this.items = items;
    if (!keepIndex) this.index = 0;
    this.index = clamp(this.index, 0, Math.max(0, items.length - 1));
    this.scroll = clamp(this.scroll, 0, Math.max(0, this.rows - this.visibleRows));
    this.renderItems();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.container.destroy({ children: true });
  }
}

// ============ メッセージウィンドウ(タイプライター+選択肢) ============
class MsgWindow {
  constructor(parent, opts = {}) {
    this.w = opts.w || VIEW_W - 80;
    this.h = opts.h || 130;
    this.container = new PIXI.Container();
    this.container.x = opts.x ?? 40;
    this.container.y = opts.y ?? VIEW_H - this.h - 16;
    this.container.visible = false;
    this.win = UI.window(this.w, this.h);
    this.container.addChild(this.win);
    this.label = UI.text('', 19, null, { wrap: true, wrapWidth: this.w - 44, lineHeight: 28 });
    this.label.x = 22; this.label.y = 14;
    this.container.addChild(this.label);
    this.nextArrow = new PIXI.Graphics();
    this.nextArrow.poly([0, 0, 16, 0, 8, 9]).fill(UI.colors.cursor);
    this.nextArrow.x = this.w / 2 - 8; this.nextArrow.y = this.h - 16;
    this.nextArrow.visible = false;
    this.container.addChild(this.nextArrow);
    parent.addChild(this.container);
    this.queue = []; this.cur = null; this.charT = 0; this.chars = 0;
    this.resolve = null; this.choiceMenu = null; this.blinkT = 0;
    // タップで送り
    this.win.eventMode = 'static';
    this.win.on('pointertap', () => { if (this.active && !this.choiceMenu) this.advance(); });
  }
  get active() { return this.container.visible; }
  get busy() { return this.container.visible || !!this.choiceMenu; }
  // lines: string | string[] を表示してPromise
  say(lines) {
    if (typeof lines === 'string') lines = [lines];
    return new Promise((res) => {
      this.queue = lines.slice();
      this.resolve = res;
      this.container.visible = true;
      this.nextLine();
    });
  }
  nextLine() {
    if (!this.queue.length) {
      this.container.visible = false;
      this.cur = null;
      const r = this.resolve; this.resolve = null;
      if (r) r();
      return;
    }
    this.cur = this.queue.shift();
    this.chars = 0; this.charT = 0;
    this.label.text = '';
    this.nextArrow.visible = false;
  }
  advance() {
    if (!this.cur) return;
    if (this.chars < this.cur.length) {
      this.chars = this.cur.length;
      this.label.text = this.cur;
      this.nextArrow.visible = true;
    } else {
      this.nextLine();
    }
  }
  // 選択肢: Promise<index> (キャンセルは defaultCancel 指定時その値)
  choice(options, opts = {}) {
    return new Promise((res) => {
      const w = opts.w || 240;
      this.choiceMenu = new Menu({
        items: options.map(o => ({ label: o })),
        x: this.container.x + this.w - w - 14,
        y: this.container.y - options.length * 36 - 26,
        w, rowH: 36, visibleRows: options.length,
        index: opts.index || 0,
        onOk: (i) => { this.closeChoice(); res(i); },
        onCancel: opts.cancelIndex != null ? () => { this.closeChoice(); res(opts.cancelIndex); } : null,
      });
      this.container.parent.addChild(this.choiceMenu.container);
    });
  }
  closeChoice() {
    if (this.choiceMenu) { this.choiceMenu.destroy(); this.choiceMenu = null; }
  }
  update(dt) {
    if (this.choiceMenu) { this.choiceMenu.update(dt); return; }
    if (!this.active || !this.cur) return;
    const speed = Game.reducedMotion ? 200 : 60; // 文字/秒
    if (this.chars < this.cur.length) {
      this.charT += dt * speed;
      const n = Math.min(this.cur.length, Math.floor(this.charT));
      if (n !== this.chars) {
        this.chars = n;
        this.label.text = this.cur.slice(0, n);
      }
      if (this.chars >= this.cur.length) this.nextArrow.visible = true;
    } else {
      this.blinkT += dt;
      this.nextArrow.alpha = 0.5 + 0.5 * Math.sin(this.blinkT * 6);
    }
    if (Input.hit('ok') || Input.hit('cancel')) this.advance();
  }
  destroy() { this.container.destroy({ children: true }); }
}

// ダメージポップ数字
function damagePop(parent, x, y, text, color = 0xffffff, big = false) {
  const t = UI.text(String(text), big ? 34 : 26, color, { bold: true, stroke: true });
  t.anchor.set(0.5);
  t.x = x; t.y = y;
  parent.addChild(t);
  let life = 0;
  const tick = (ticker) => {
    if (t.destroyed) { Game.app.ticker.remove(tick); return; }
    life += ticker.deltaMS / 1000;
    const dur = Game.reducedMotion ? 0.5 : 0.9;
    t.y = y - (Game.reducedMotion ? 10 : 36 * Math.min(1, life / 0.35));
    if (life > dur * 0.6) t.alpha = 1 - (life - dur * 0.6) / (dur * 0.4);
    if (life >= dur) { Game.app.ticker.remove(tick); t.destroy(); }
  };
  Game.app.ticker.add(tick);
}
