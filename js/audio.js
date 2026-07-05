// ============================================================
// audio.js - WebAudio チップチューン BGM / 効果音
// ============================================================
'use strict';

const AudioSys = {
  ctx: null,
  masterGain: null, bgmGain: null, seGain: null,
  currentBgm: null, bgmTimer: null, bgmNodes: [],
  settings: { bgmOn: false, seOn: false, volume: 0.7 },

  init() {
    // ユーザー操作後に遅延生成する
  },
  ensureCtx() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.connect(this.masterGain);
      this.seGain = this.ctx.createGain();
      this.seGain.connect(this.masterGain);
      this.applyVolume();
    } catch (e) { console.warn('AudioContext unavailable', e); }
  },
  applyVolume() {
    if (!this.ctx) return;
    this.masterGain.gain.value = this.settings.volume * 0.5; // 音割れ防止で控えめに
    this.bgmGain.gain.value = this.settings.bgmOn ? 0.55 : 0;
    this.seGain.gain.value = this.settings.seOn ? 0.9 : 0;
  },
  setBgmOn(on) { this.settings.bgmOn = on; if (on) this.ensureCtx(); this.applyVolume(); if (on && this.currentBgm) this.playBgm(this.currentBgm, true); if (!on) this.stopBgmNodes(); },
  setSeOn(on) { this.settings.seOn = on; if (on) this.ensureCtx(); this.applyVolume(); },
  setVolume(v) { this.settings.volume = Math.max(0, Math.min(1, v)); this.applyVolume(); },

  // ---- BGM ----
  stopBgmNodes() {
    if (this.bgmTimer) { clearTimeout(this.bgmTimer); this.bgmTimer = null; }
    for (const n of this.bgmNodes) { try { n.stop(); } catch (e) { /* already stopped */ } }
    this.bgmNodes = [];
  },
  playBgm(name, force) {
    if (this.currentBgm === name && !force) return;
    this.currentBgm = name;
    this.stopBgmNodes();
    if (!this.settings.bgmOn) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const song = SONGS[name];
    if (!song) return;
    this.scheduleSong(song);
  },
  stopBgm() { this.currentBgm = null; this.stopBgmNodes(); },
  scheduleSong(song) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    const beat = 60 / song.bpm / 2; // 8分音符単位
    let loopLen = 0;
    for (const track of song.tracks) {
      let t = 0;
      for (const [note, len] of track.notes) {
        const dur = len * beat;
        if (note !== 0) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = track.wave || 'square';
          osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);
          const vol = (track.vol || 0.16);
          g.gain.setValueAtTime(0, t0 + t);
          g.gain.linearRampToValueAtTime(vol, t0 + t + 0.012);
          g.gain.setValueAtTime(vol, t0 + t + dur * 0.7);
          g.gain.linearRampToValueAtTime(0, t0 + t + dur * 0.95);
          osc.connect(g); g.connect(this.bgmGain);
          osc.start(t0 + t); osc.stop(t0 + t + dur);
          this.bgmNodes.push(osc);
        }
        t += dur;
      }
      loopLen = Math.max(loopLen, t);
    }
    if (song.loop !== false) {
      this.bgmTimer = setTimeout(() => {
        if (this.settings.bgmOn && this.currentBgm) this.scheduleSong(SONGS[this.currentBgm] || song);
      }, loopLen * 1000 - 30);
    }
  },

  // ---- SE ----
  se(name) {
    if (!this.settings.seOn) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const fn = SE_DEFS[name];
    if (fn) fn(this.ctx, this.seGain);
  },
};

// 簡易トーンヘルパ
function seTone(ctx, out, { freq = 440, freq2 = null, dur = 0.1, type = 'square', vol = 0.25, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freq2 !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g); g.connect(out);
  osc.start(t0); osc.stop(t0 + dur + 0.01);
}
function seNoise(ctx, out, { dur = 0.15, vol = 0.2, delay = 0, low = false }) {
  const t0 = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = vol;
  if (low) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    src.connect(f); f.connect(g);
  } else src.connect(g);
  g.connect(out);
  src.start(t0);
}

const SE_DEFS = {
  cursor: (c, o) => seTone(c, o, { freq: 880, dur: 0.05, vol: 0.15 }),
  ok: (c, o) => { seTone(c, o, { freq: 660, dur: 0.06, vol: 0.18 }); seTone(c, o, { freq: 990, dur: 0.08, vol: 0.18, delay: 0.06 }); },
  cancel: (c, o) => seTone(c, o, { freq: 440, freq2: 220, dur: 0.1, vol: 0.15 }),
  buzzer: (c, o) => seTone(c, o, { freq: 150, dur: 0.15, type: 'sawtooth', vol: 0.2 }),
  hit: (c, o) => { seNoise(c, o, { dur: 0.12, vol: 0.3 }); seTone(c, o, { freq: 220, freq2: 80, dur: 0.1, vol: 0.2 }); },
  crit: (c, o) => { seNoise(c, o, { dur: 0.2, vol: 0.4 }); seTone(c, o, { freq: 440, freq2: 60, dur: 0.22, type: 'sawtooth', vol: 0.3 }); },
  magic: (c, o) => { seTone(c, o, { freq: 500, freq2: 1600, dur: 0.2, type: 'triangle', vol: 0.22 }); seTone(c, o, { freq: 750, freq2: 2000, dur: 0.2, type: 'triangle', vol: 0.15, delay: 0.06 }); },
  heal: (c, o) => { seTone(c, o, { freq: 620, dur: 0.09, type: 'triangle', vol: 0.2 }); seTone(c, o, { freq: 830, dur: 0.09, type: 'triangle', vol: 0.2, delay: 0.08 }); seTone(c, o, { freq: 1100, dur: 0.14, type: 'triangle', vol: 0.2, delay: 0.16 }); },
  levelup: (c, o) => { [523, 659, 784, 1047].forEach((f, i) => seTone(c, o, { freq: f, dur: 0.12, vol: 0.2, delay: i * 0.09 })); },
  chest: (c, o) => { seTone(c, o, { freq: 700, dur: 0.08, vol: 0.2 }); seTone(c, o, { freq: 1050, dur: 0.15, vol: 0.2, delay: 0.09 }); },
  door: (c, o) => { seTone(c, o, { freq: 200, freq2: 120, dur: 0.18, type: 'sawtooth', vol: 0.16 }); },
  save: (c, o) => { seTone(c, o, { freq: 784, dur: 0.09, vol: 0.2 }); seTone(c, o, { freq: 1175, dur: 0.16, vol: 0.2, delay: 0.1 }); },
  encounter: (c, o) => { seTone(c, o, { freq: 300, freq2: 900, dur: 0.16, type: 'sawtooth', vol: 0.2 }); seTone(c, o, { freq: 220, freq2: 660, dur: 0.16, type: 'sawtooth', vol: 0.2, delay: 0.1 }); },
  flee: (c, o) => { [500, 400, 300, 200].forEach((f, i) => seTone(c, o, { freq: f, dur: 0.07, vol: 0.15, delay: i * 0.06 })); },
  dead: (c, o) => { seTone(c, o, { freq: 220, freq2: 55, dur: 0.5, type: 'triangle', vol: 0.25 }); seNoise(c, o, { dur: 0.3, vol: 0.2, low: true }); },
  poison: (c, o) => seTone(c, o, { freq: 350, freq2: 200, dur: 0.2, type: 'triangle', vol: 0.18 }),
  step: (c, o) => seNoise(c, o, { dur: 0.03, vol: 0.05, low: true }),
  quake: (c, o) => seNoise(c, o, { dur: 0.5, vol: 0.35, low: true }),
};

// ---- 楽曲データ ----
// notes: [MIDIノート(0=休符), 8分音符単位の長さ]
const N = (s) => { // 'C4'表記→MIDI
  const m = s.match(/^([A-G])(#?)(\d)$/);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return 12 * (+m[3] + 1) + base + (m[2] ? 1 : 0);
};
function mel(str) { // 'C4:2 E4:1 R:1' 形式
  return str.trim().split(/\s+/).map(tok => {
    const [n, l] = tok.split(':');
    return [n === 'R' ? 0 : N(n), +(l || 1)];
  });
}

const SONGS = {
  title: { bpm: 76, tracks: [
    { wave: 'triangle', vol: 0.18, notes: mel('E4:2 G4:2 B4:2 C5:4 B4:2 G4:2 E4:4 D4:2 F4:2 A4:2 B4:4 A4:2 F4:2 D4:4 E4:2 G4:2 B4:2 E5:4 D5:2 B4:2 G4:4 A4:2 B4:2 C5:2 B4:2 A4:2 G4:2 E4:6') },
    { wave: 'square', vol: 0.07, notes: mel('E3:8 C3:8 E3:8 A2:4 B2:4 E3:8 C3:8 A2:8 E3:8') },
  ]},
  field: { bpm: 112, tracks: [
    { wave: 'square', vol: 0.14, notes: mel('G4:2 A4:1 B4:1 D5:2 B4:2 C5:2 B4:1 A4:1 G4:4 E4:2 G4:1 A4:1 B4:2 A4:1 G4:1 A4:4 R:2 G4:2 A4:1 B4:1 D5:2 E5:2 D5:2 C5:1 B4:1 C5:4 D5:2 C5:1 B4:1 A4:2 B4:1 A4:1 G4:6') },
    { wave: 'triangle', vol: 0.16, notes: mel('G2:4 D3:4 E2:4 B2:4 C3:4 G2:4 D3:4 D3:4 G2:4 D3:4 A2:4 C3:4 C3:4 D3:4 G2:8') },
  ]},
  town: { bpm: 100, tracks: [
    { wave: 'square', vol: 0.12, notes: mel('C5:2 E5:1 C5:1 G4:2 A4:1 B4:1 C5:2 D5:1 C5:1 B4:4 A4:2 B4:1 A4:1 G4:2 E4:2 F4:2 G4:1 A4:1 G4:4 C5:2 E5:1 C5:1 G4:2 A4:1 B4:1 C5:2 E5:2 D5:4 C5:2 B4:1 A4:1 G4:2 A4:2 C5:6') },
    { wave: 'triangle', vol: 0.15, notes: mel('C3:4 G3:4 F3:4 G3:4 A3:4 E3:4 F3:4 G3:4 C3:4 G3:4 F3:4 C3:4 F3:4 G3:4 C3:8') },
  ]},
  dungeon: { bpm: 84, tracks: [
    { wave: 'square', vol: 0.1, notes: mel('E4:3 F4:1 E4:2 C4:2 D4:3 E4:1 D4:2 B3:2 C4:3 D4:1 C4:2 A3:2 B3:2 G3:2 B3:4 E4:3 F4:1 G4:2 E4:2 F4:3 G4:1 A4:2 F4:2 E4:2 D4:2 C4:2 B3:2 E4:8') },
    { wave: 'triangle', vol: 0.16, notes: mel('E2:8 B2:8 A2:8 E2:8 C3:8 A2:8 B2:8 E2:8') },
  ]},
  dungeon2: { bpm: 92, tracks: [
    { wave: 'sawtooth', vol: 0.07, notes: mel('C4:1 R:1 C4:1 R:1 D4:1 C4:1 B3:2 C4:1 R:1 E4:1 R:1 F4:1 E4:1 D4:2 G4:1 R:1 G4:1 R:1 A4:1 G4:1 F4:2 E4:2 D4:2 C4:2 B3:2 C4:1 R:1 C4:1 R:1 D4:1 C4:1 G4:2 A4:2 G4:2 F4:2 E4:2 D4:4 B3:4') },
    { wave: 'triangle', vol: 0.17, notes: mel('C3:4 C3:4 G2:4 G2:4 A2:4 A2:4 F2:4 G2:4 C3:4 C3:4 A2:4 A2:4 F2:4 G2:4 C3:8') },
  ]},
  battle: { bpm: 150, tracks: [
    { wave: 'square', vol: 0.13, notes: mel('A4:1 A4:1 C5:1 A4:1 E5:2 D5:1 C5:1 B4:2 E4:2 G4:1 A4:1 B4:2 A4:1 A4:1 C5:1 A4:1 F5:2 E5:1 D5:1 C5:2 A4:2 B4:1 C5:1 D5:2 E5:1 E5:1 F5:1 E5:1 D5:2 C5:1 B4:1 A4:2 C5:2 B4:1 A4:1 G4:1 A4:1 B4:2 E4:2 A4:4') },
    { wave: 'triangle', vol: 0.18, notes: mel('A2:2 A2:1 A2:1 A2:2 G2:2 F2:2 F2:1 F2:1 E2:2 E2:2 A2:2 A2:1 A2:1 A2:2 G2:2 F2:2 F2:1 F2:1 E2:2 E2:2 D2:2 D2:2 E2:2 E2:2 F2:2 F2:2 E2:2 E2:2 A2:2 A2:2 E2:2 E2:2 A2:4') },
  ]},
  boss: { bpm: 158, tracks: [
    { wave: 'sawtooth', vol: 0.09, notes: mel('D4:1 D4:1 F4:1 D4:1 A4:2 G4:1 F4:1 E4:1 E4:1 G4:1 E4:1 B4:2 A4:1 G4:1 F4:1 F4:1 A4:1 F4:1 C5:2 B4:1 A4:1 G4:2 A4:2 B4:2 C5:2 D5:1 D5:1 C5:1 B4:1 A4:2 G4:2 F4:2 E4:2 D4:4') },
    { wave: 'triangle', vol: 0.18, notes: mel('D2:1 D2:1 D3:1 D2:1 D2:1 D3:1 D2:1 D2:1 E2:1 E2:1 E3:1 E2:1 E2:1 E3:1 E2:1 E2:1 F2:1 F2:1 F3:1 F2:1 F2:1 F3:1 F2:1 F2:1 G2:2 G2:2 A2:2 A2:2 D2:2 A2:2 D2:2 A2:2 D2:4') },
  ]},
  shadow: { bpm: 70, tracks: [
    { wave: 'triangle', vol: 0.16, notes: mel('E4:4 F4:4 E4:2 D4:2 C4:4 B3:4 C4:2 D4:2 E4:4 G4:4 F4:2 E4:2 D4:8 E4:4 C4:4 B3:2 C4:2 D4:4 E4:12') },
    { wave: 'sine', vol: 0.2, notes: mel('A1:16 F2:16 G2:16 A1:16') },
  ]},
  victory: { bpm: 130, loop: false, tracks: [
    { wave: 'square', vol: 0.15, notes: mel('C5:1 C5:1 C5:1 C5:2 G4:2 A4:2 C5:2 B4:1 C5:3') },
    { wave: 'triangle', vol: 0.16, notes: mel('C3:2 C3:2 F3:2 G3:2 C3:4') },
  ]},
  ending: { bpm: 88, tracks: [
    { wave: 'triangle', vol: 0.17, notes: mel('G4:2 C5:2 E5:2 G5:4 E5:2 C5:2 D5:4 E5:2 D5:2 C5:2 A4:2 G4:6 G4:2 C5:2 E5:2 A5:4 G5:2 E5:2 F5:4 E5:2 D5:2 C5:8') },
    { wave: 'square', vol: 0.07, notes: mel('C3:8 G3:8 F3:8 G3:8 C3:8 A3:8 F3:4 G3:4 C3:8') },
  ]},
};
