// ============================================================
// data.js - クラス・スキル・アイテム・装備・敵データ
// ============================================================
'use strict';

// ---- 属性 ----
// phys(無), fire, ice, bolt, wind, earth, water, light, dark
const ELEM_NAMES = {
  phys: '無', fire: '炎', ice: '氷', bolt: '雷', wind: '風',
  earth: '地', water: '水', light: '光', dark: '闇',
};

// ---- クラス定義 ----
// base: Lv1時, gain: 1レベルごとの上昇量
const CLASSES = {
  hero: {
    name: 'ゆうしゃ', desc: '攻守そろった万能型。光の力と回復を使える。',
    base: { hp: 28, mp: 8, atk: 9, def: 8, agi: 8, mag: 7, luk: 8 },
    gain: { hp: 7.5, mp: 3.0, atk: 2.6, def: 2.3, agi: 2.0, mag: 2.0, luk: 1.6 },
    weapons: ['sword'], learn: {
      3: 'heal1', 6: 'shine1', 10: 'bravesword', 14: 'heal2', 18: 'shine2', 24: 'lightwave', 30: 'heal3',
    },
  },
  warrior: {
    name: 'せんし', desc: 'たかいHPと攻撃力でパーティの盾となる前衛。',
    base: { hp: 36, mp: 2, atk: 11, def: 10, agi: 6, mag: 3, luk: 6 },
    gain: { hp: 9.5, mp: 1.0, atk: 3.2, def: 3.0, agi: 1.4, mag: 0.8, luk: 1.4 },
    weapons: ['sword', 'axe'], learn: {
      4: 'powerslash', 9: 'helmsplit', 16: 'warcry', 22: 'fullswing',
    },
  },
  mage: {
    name: 'まどうし', desc: '多彩な攻撃呪文で敵をなぎはらう。打たれ弱い。',
    base: { hp: 20, mp: 16, atk: 5, def: 5, agi: 7, mag: 12, luk: 7 },
    gain: { hp: 5.0, mp: 5.5, atk: 1.2, def: 1.4, agi: 2.0, mag: 3.4, luk: 1.6 },
    weapons: ['staff', 'dagger'], learn: {
      1: 'fire1', 3: 'ice1', 5: 'bolt1', 8: 'sleepsong', 11: 'fire2', 14: 'ice2', 17: 'bolt2',
      20: 'gale2', 24: 'quake', 28: 'fire3', 32: 'ice3',
    },
  },
  priest: {
    name: 'そうりょ', desc: '回復と補助のスペシャリスト。仲間を支える。',
    base: { hp: 24, mp: 14, atk: 6, def: 6, agi: 6, mag: 10, luk: 8 },
    gain: { hp: 6.0, mp: 5.0, atk: 1.6, def: 1.8, agi: 1.6, mag: 3.0, luk: 1.8 },
    weapons: ['staff', 'hammer'], learn: {
      1: 'heal1', 3: 'cure', 6: 'guardup', 9: 'heal2', 12: 'gale1', 15: 'mightup',
      18: 'revive1', 22: 'heal3', 26: 'shine2', 30: 'healall',
    },
  },
  thief: {
    name: 'とうぞく', desc: '素早さと運が武器。先手を取り敵をかく乱する。',
    base: { hp: 26, mp: 6, atk: 8, def: 6, agi: 12, mag: 5, luk: 12 },
    gain: { hp: 6.5, mp: 2.2, atk: 2.4, def: 1.8, agi: 3.2, mag: 1.4, luk: 2.6 },
    weapons: ['dagger', 'sword'], learn: {
      4: 'poisonedge', 8: 'slowdown', 12: 'gustblade', 17: 'shadowbind', 23: 'armorbreak',
    },
  },
  monk: {
    name: 'ぶとうか', desc: '会心の一撃を連発する拳の達人。装備は苦手。',
    base: { hp: 30, mp: 4, atk: 10, def: 7, agi: 10, mag: 4, luk: 9 },
    gain: { hp: 8.0, mp: 1.6, atk: 3.0, def: 2.0, agi: 2.8, mag: 1.0, luk: 2.2 },
    weapons: ['claw'], learn: {
      4: 'doublehit', 9: 'meditate', 15: 'focusfist', 21: 'triplehit',
    },
  },
};

// 経験値テーブル: Lv n に必要な累計EXP
function expForLevel(lv) {
  if (lv <= 1) return 0;
  return Math.floor(8 * Math.pow(lv - 1, 2.35) + 12 * (lv - 1));
}
const MAX_LEVEL = 40;

// ---- スキル定義 ----
// kind: atk(攻撃)/heal/cure/revive/buff/debuff/status
// scope: enemy/enemyGroup/enemyAll/ally/allyAll/self/allyDead
// power: 攻撃=威力, heal=回復量基準
// phys: trueなら物理(atk参照), falseは魔法(mag参照)
const SKILLS = {
  // 魔導士 攻撃
  fire1: { name: 'フレイム', mp: 3, kind: 'atk', elem: 'fire', power: 16, scope: 'enemy', desc: '炎の弾で敵1体を焼く' },
  fire2: { name: 'フレイマ', mp: 7, kind: 'atk', elem: 'fire', power: 38, scope: 'enemyGroup', desc: '火炎が敵1グループを包む' },
  fire3: { name: 'フレイガ', mp: 14, kind: 'atk', elem: 'fire', power: 78, scope: 'enemyGroup', desc: '業火が敵1グループを焼き尽くす' },
  ice1: { name: 'フロスト', mp: 3, kind: 'atk', elem: 'ice', power: 18, scope: 'enemy', desc: '氷の刃で敵1体を切り裂く' },
  ice2: { name: 'フロスマ', mp: 8, kind: 'atk', elem: 'ice', power: 42, scope: 'enemy', desc: '巨大な氷塊で敵1体を打つ' },
  ice3: { name: 'フロスガ', mp: 16, kind: 'atk', elem: 'ice', power: 70, scope: 'enemyAll', desc: '吹雪が敵全体を凍てつかせる' },
  bolt1: { name: 'スパーク', mp: 4, kind: 'atk', elem: 'bolt', power: 22, scope: 'enemy', desc: '稲妻で敵1体を撃つ' },
  bolt2: { name: 'スパルガ', mp: 10, kind: 'atk', elem: 'bolt', power: 48, scope: 'enemyGroup', desc: '落雷が敵1グループを貫く' },
  gale1: { name: 'ゲイル', mp: 4, kind: 'atk', elem: 'wind', power: 20, scope: 'enemy', desc: 'かまいたちで敵1体を裂く' },
  gale2: { name: 'ゲイルマ', mp: 9, kind: 'atk', elem: 'wind', power: 44, scope: 'enemyGroup', desc: '竜巻が敵1グループを巻き上げる' },
  quake: { name: 'クエイク', mp: 12, kind: 'atk', elem: 'earth', power: 52, scope: 'enemyAll', desc: '大地震が敵全体を揺るがす' },
  sleepsong: { name: 'ねむりのうた', mp: 5, kind: 'status', status: 'sleep', statusRate: 0.6, scope: 'enemyGroup', desc: '敵1グループを眠らせる' },
  // 勇者
  shine1: { name: 'シャイン', mp: 4, kind: 'atk', elem: 'light', power: 24, scope: 'enemy', desc: '光の矢で敵1体を射る' },
  shine2: { name: 'シャインガ', mp: 11, kind: 'atk', elem: 'light', power: 52, scope: 'enemyGroup', desc: '聖光が敵1グループを浄化する' },
  bravesword: { name: 'ゆうきの剣', mp: 6, kind: 'atk', elem: 'light', power: 1.6, phys: true, scope: 'enemy', desc: '光をまとった斬撃（攻撃力の1.6倍）' },
  lightwave: { name: '光の波動', mp: 15, kind: 'atk', elem: 'light', power: 65, scope: 'enemyAll', desc: '光の波が敵全体を打つ' },
  // 回復・補助
  heal1: { name: 'ヒール', mp: 3, kind: 'heal', power: 30, scope: 'ally', desc: '味方1人のHPを約30回復' },
  heal2: { name: 'ヒールマ', mp: 7, kind: 'heal', power: 80, scope: 'ally', desc: '味方1人のHPを約80回復' },
  heal3: { name: 'ヒールガ', mp: 15, kind: 'heal', power: 999, scope: 'ally', desc: '味方1人のHPを完全回復' },
  healall: { name: 'ヒールラダ', mp: 18, kind: 'heal', power: 70, scope: 'allyAll', desc: '味方全員のHPを約70回復' },
  cure: { name: 'キュア', mp: 3, kind: 'cure', cures: ['poison', 'paralysis'], scope: 'ally', desc: '味方1人の毒・マヒを治す' },
  revive1: { name: 'リザレク', mp: 12, kind: 'revive', power: 0.5, scope: 'allyDead', desc: '戦闘不能の味方1人をHP半分で復活' },
  guardup: { name: 'ガードラ', mp: 3, kind: 'buff', stat: 'def', scope: 'allyAll', desc: '味方全員のまもりを上げる' },
  mightup: { name: 'マイトラ', mp: 4, kind: 'buff', stat: 'atk', scope: 'ally', desc: '味方1人のちからを上げる' },
  // 戦士
  powerslash: { name: 'つよぎり', mp: 2, kind: 'atk', elem: 'phys', power: 1.5, phys: true, scope: 'enemy', desc: '力をこめた一撃（攻撃力の1.5倍）' },
  helmsplit: { name: 'かぶとわり', mp: 3, kind: 'debuff', stat: 'def', dmg: 1.0, phys: true, scope: 'enemy', desc: '攻撃しつつ敵のまもりを下げる' },
  warcry: { name: 'ときの声', mp: 4, kind: 'buff', stat: 'atk', scope: 'self', desc: '自分のちからを大きく上げる', stages: 2 },
  fullswing: { name: 'ぜんりょく斬り', mp: 6, kind: 'atk', elem: 'phys', power: 2.2, phys: true, scope: 'enemy', desc: '渾身の一撃（攻撃力の2.2倍）' },
  // 盗賊
  poisonedge: { name: 'どくがのナイフ', mp: 2, kind: 'atk', elem: 'phys', power: 0.9, phys: true, scope: 'enemy', status: 'poison', statusRate: 0.7, desc: '攻撃し、高確率で毒を与える' },
  slowdown: { name: 'スロウダスト', mp: 3, kind: 'debuff', stat: 'agi', scope: 'enemyGroup', desc: '敵1グループのすばやさを下げる' },
  gustblade: { name: 'しっぷう突き', mp: 4, kind: 'atk', elem: 'wind', power: 1.3, phys: true, scope: 'enemy', priority: true, desc: '必ず先制する風の一撃' },
  shadowbind: { name: 'かげぬい', mp: 5, kind: 'status', status: 'paralysis', statusRate: 0.65, scope: 'enemy', desc: '敵1体をしびれさせる' },
  armorbreak: { name: 'よろいくだき', mp: 5, kind: 'debuff', stat: 'def', stages: 2, dmg: 1.1, phys: true, scope: 'enemy', desc: '攻撃しつつ敵のまもりを大きく下げる' },
  // 武闘家
  doublehit: { name: 'れんげき', mp: 3, kind: 'atk', elem: 'phys', power: 0.8, phys: true, hits: 2, scope: 'enemy', desc: '2回連続で攻撃する' },
  meditate: { name: 'めいそう', mp: 2, kind: 'heal', power: 60, scope: 'self', desc: '精神統一し自分のHPを約60回復' },
  focusfist: { name: 'きあい拳', mp: 5, kind: 'atk', elem: 'phys', power: 1.4, phys: true, critBonus: 0.35, scope: 'enemy', desc: '会心が出やすい一撃' },
  triplehit: { name: 'らんげき', mp: 7, kind: 'atk', elem: 'phys', power: 0.75, phys: true, hits: 3, scope: 'enemyRandom', desc: 'ランダムな敵に3回攻撃' },
  // 敵専用
  e_poison: { name: 'どくの息', mp: 0, kind: 'status', status: 'poison', statusRate: 0.6, scope: 'party', desc: '' },
  e_sleep: { name: 'ねむりの歌', mp: 0, kind: 'status', status: 'sleep', statusRate: 0.38, scope: 'party', desc: '' },
  e_para: { name: 'しびれ糸', mp: 0, kind: 'status', status: 'paralysis', statusRate: 0.5, scope: 'partyOne', desc: '' },
  e_fire: { name: '火の玉', mp: 0, kind: 'atk', elem: 'fire', power: 20, scope: 'partyOne', desc: '' },
  e_firebreath: { name: '炎の息', mp: 0, kind: 'atk', elem: 'fire', power: 28, scope: 'party', desc: '' },
  e_icebreath: { name: '凍える息', mp: 0, kind: 'atk', elem: 'ice', power: 30, scope: 'party', desc: '' },
  e_bolt: { name: '黒い稲妻', mp: 0, kind: 'atk', elem: 'bolt', power: 44, scope: 'partyOne', desc: '' },
  e_dark: { name: 'やみの瘴気', mp: 0, kind: 'atk', elem: 'dark', power: 34, scope: 'party', desc: '' },
  e_darkstrong: { name: '深淵の波動', mp: 0, kind: 'atk', elem: 'dark', power: 54, scope: 'party', desc: '' },
  e_healself: { name: 'いやしの霧', mp: 0, kind: 'heal', power: 60, scope: 'self', desc: '' },
  e_wind: { name: '烈風', mp: 0, kind: 'atk', elem: 'wind', power: 26, scope: 'party', desc: '' },
  e_quake: { name: 'じひびき', mp: 0, kind: 'atk', elem: 'earth', power: 24, scope: 'party', desc: '' },
  e_tidal: { name: 'たかしお', mp: 0, kind: 'atk', elem: 'water', power: 24, scope: 'party', desc: '' },
};

// ---- アイテム ----
const ITEMS = {
  // 消費
  herb: { name: 'やくそう', kind: 'heal', power: 32, price: 8, scope: 'ally', desc: 'HPを約32回復する薬草', usableField: true },
  herb2: { name: '上やくそう', kind: 'heal', power: 90, price: 36, scope: 'ally', desc: 'HPを約90回復する上質な薬草', usableField: true },
  herb3: { name: '特やくそう', kind: 'heal', power: 250, price: 150, scope: 'ally', desc: 'HPを約250回復する秘伝の薬', usableField: true },
  ether: { name: 'まほうの水', kind: 'healmp', power: 30, price: 120, scope: 'ally', desc: 'MPを30回復する不思議な水', usableField: true },
  antidote: { name: 'どくけし草', kind: 'cure', cures: ['poison'], price: 10, scope: 'ally', desc: '毒を治す薬草', usableField: true },
  wakebell: { name: 'めざましベル', kind: 'cure', cures: ['sleep', 'paralysis'], price: 25, scope: 'ally', desc: '眠り・マヒを治すベル', usableField: true },
  panacea: { name: '万能薬', kind: 'cure', cures: ['poison', 'sleep', 'paralysis'], heal: 50, price: 90, scope: 'ally', desc: '状態異常を治しHPも回復', usableField: true },
  phoenixdown: { name: 'ふっかつの羽', kind: 'revive', power: 0.5, price: 300, scope: 'allyDead', desc: '戦闘不能の仲間をHP半分で復活', usableField: true },
  wingfeather: { name: 'テレポの翼', kind: 'teleport', price: 40, desc: '最後に泊まった町へ瞬間移動する', usableField: true, fieldOnly: true },
  bomb: { name: '爆炎玉', kind: 'atk', elem: 'fire', power: 45, price: 100, scope: 'enemyGroup', desc: '敵1グループに炎ダメージ', battleOnly: true },
  // 大事なもの
  orb_earth: { name: '大地のオーブ', kind: 'key', desc: '大地の輝きを宿すオーブ。六輝のひとつ' },
  orb_tide: { name: '潮のオーブ', kind: 'key', desc: '海の輝きを宿すオーブ。六輝のひとつ' },
  orb_frost: { name: '氷華のオーブ', kind: 'key', desc: '氷の輝きを宿すオーブ。六輝のひとつ' },
  orb_flame: { name: '焔のオーブ', kind: 'key', desc: '炎の輝きを宿すオーブ。六輝のひとつ' },
  orb_wind: { name: '風唱のオーブ', kind: 'key', desc: '風の輝きを宿すオーブ。六輝のひとつ' },
  orb_light: { name: '光燿のオーブ', kind: 'key', desc: '光の輝きを宿すオーブ。六輝のひとつ' },
  cavekey: { name: '洞窟のカギ', kind: 'key', unlocks: 'cave', desc: '古びた鉄のカギ。洞窟の扉を開く' },
  ancientkey: { name: '古代のカギ', kind: 'key', unlocks: 'ancient', desc: '青く光るカギ。古代の扉を開く' },
  ferrypass: { name: '渡し船の手形', kind: 'key', desc: 'メリア港の渡し船に乗るための手形' },
};
const ORB_IDS = ['orb_earth', 'orb_tide', 'orb_frost', 'orb_flame', 'orb_wind', 'orb_light'];

// ---- 装備 ----
// slot: weapon/armor/shield/acc, wtype: sword/axe/staff/dagger/claw/hammer
const EQUIPS = {
  // 武器
  w_stick: { name: 'ひのきの棒', slot: 'weapon', wtype: 'staff', atk: 2, price: 10 },
  w_dagger1: { name: '銅のナイフ', slot: 'weapon', wtype: 'dagger', atk: 4, price: 30 },
  w_sword1: { name: '銅の剣', slot: 'weapon', wtype: 'sword', atk: 7, price: 90 },
  w_claw1: { name: '皮の爪', slot: 'weapon', wtype: 'claw', atk: 6, price: 70 },
  w_staff1: { name: '樫の杖', slot: 'weapon', wtype: 'staff', atk: 4, mag: 3, price: 80 },
  w_hammer1: { name: '木づち', slot: 'weapon', wtype: 'hammer', atk: 6, price: 60 },
  w_sword2: { name: '鉄の剣', slot: 'weapon', wtype: 'sword', atk: 14, price: 320 },
  w_dagger2: { name: '鋼のダガー', slot: 'weapon', wtype: 'dagger', atk: 11, agi: 3, price: 280 },
  w_axe1: { name: '戦斧', slot: 'weapon', wtype: 'axe', atk: 17, agi: -2, price: 400 },
  w_claw2: { name: '鉄の爪', slot: 'weapon', wtype: 'claw', atk: 13, price: 300 },
  w_staff2: { name: '賢者の杖', slot: 'weapon', wtype: 'staff', atk: 8, mag: 8, price: 420 },
  w_hammer2: { name: '銀の槌', slot: 'weapon', wtype: 'hammer', atk: 15, price: 380 },
  w_sword3: { name: '白銀の剣', slot: 'weapon', wtype: 'sword', atk: 24, price: 1100 },
  w_dagger3: { name: '疾風のダガー', slot: 'weapon', wtype: 'dagger', atk: 19, agi: 8, price: 980 },
  w_claw3: { name: '虎牙の爪', slot: 'weapon', wtype: 'claw', atk: 22, luk: 4, price: 1000 },
  w_staff3: { name: '星霜の杖', slot: 'weapon', wtype: 'staff', atk: 12, mag: 16, price: 1250 },
  w_axe2: { name: '巨人の斧', slot: 'weapon', wtype: 'axe', atk: 30, agi: -4, price: 1500 },
  w_sword4: { name: '炎竜の剣', slot: 'weapon', wtype: 'sword', atk: 34, elem: 'fire', price: 2600 },
  w_hammer3: { name: '聖光の槌', slot: 'weapon', wtype: 'hammer', atk: 28, mag: 8, elem: 'light', price: 2400 },
  w_claw4: { name: '氷結の爪', slot: 'weapon', wtype: 'claw', atk: 31, elem: 'ice', price: 2500 },
  w_dagger4: { name: '影牙のダガー', slot: 'weapon', wtype: 'dagger', atk: 27, agi: 12, luk: 6, price: 2300 },
  w_staff4: { name: '天冠の杖', slot: 'weapon', wtype: 'staff', atk: 16, mag: 26, price: 2800 },
  w_sword5: { name: '光燿の聖剣', slot: 'weapon', wtype: 'sword', atk: 46, mag: 8, elem: 'light', price: 0, noSell: true },
  w_axe3: { name: '滅嵐の大斧', slot: 'weapon', wtype: 'axe', atk: 48, agi: -3, price: 6800 },
  w_claw5: { name: '雷神の爪', slot: 'weapon', wtype: 'claw', atk: 42, agi: 6, elem: 'bolt', price: 6200 },
  w_staff5: { name: '深淵の杖', slot: 'weapon', wtype: 'staff', atk: 20, mag: 38, price: 7000 },
  w_dagger5: { name: '虚空のダガー', slot: 'weapon', wtype: 'dagger', atk: 38, agi: 16, luk: 10, price: 6000 },
  // よろい
  a_clothes: { name: '旅人の服', slot: 'armor', def: 3, price: 20 },
  a_leather: { name: '皮のよろい', slot: 'armor', def: 7, price: 110 },
  a_robe1: { name: '祈りのローブ', slot: 'armor', def: 5, mag: 3, price: 130 },
  a_chain: { name: 'くさりかたびら', slot: 'armor', def: 13, price: 350 },
  a_gi: { name: '武道着', slot: 'armor', def: 10, agi: 4, price: 320 },
  a_robe2: { name: '魔法のローブ', slot: 'armor', def: 10, mag: 6, price: 400 },
  a_iron: { name: '鉄のよろい', slot: 'armor', def: 20, agi: -2, price: 950 },
  a_silkrobe: { name: '星織のローブ', slot: 'armor', def: 16, mag: 10, price: 1300 },
  a_silver: { name: '白銀のよろい', slot: 'armor', def: 28, price: 2400 },
  a_flame: { name: '火竜のよろい', slot: 'armor', def: 34, resist: 'fire', price: 5200 },
  a_frost: { name: '氷華のローブ', slot: 'armor', def: 26, mag: 14, resist: 'ice', price: 4800 },
  a_holy: { name: '聖銀のよろい', slot: 'armor', def: 44, resist: 'dark', price: 9000 },
  // 盾
  s_wood: { name: '木の盾', slot: 'shield', def: 2, price: 40 },
  s_leather: { name: '皮の盾', slot: 'shield', def: 4, price: 150 },
  s_iron: { name: '鉄の盾', slot: 'shield', def: 8, price: 520 },
  s_silver: { name: '白銀の盾', slot: 'shield', def: 13, price: 1600 },
  s_mirror: { name: '水鏡の盾', slot: 'shield', def: 18, resist: 'water', price: 3800 },
  s_aegis: { name: '聖光の大盾', slot: 'shield', def: 25, resist: 'dark', price: 8200 },
  // 装飾品
  ac_ring1: { name: '力の指輪', slot: 'acc', atk: 5, price: 500 },
  ac_ring2: { name: '守りの指輪', slot: 'acc', def: 5, price: 500 },
  ac_boots: { name: '風走りの靴', slot: 'acc', agi: 8, price: 800 },
  ac_charm: { name: '幸運のお守り', slot: 'acc', luk: 10, price: 700 },
  ac_amulet: { name: '目覚ましの首飾り', slot: 'acc', immune: 'sleep', price: 1200 },
  ac_poisonguard: { name: '毒よけの腕輪', slot: 'acc', immune: 'poison', price: 1200 },
  ac_sage: { name: '賢者の耳飾り', slot: 'acc', mag: 12, price: 2000 },
  ac_hero: { name: '六輝の紋章', slot: 'acc', atk: 8, def: 8, agi: 8, mag: 8, price: 0, noSell: true },
};

// 武器種を装備できるか
function canEquip(cls, eq) {
  if (eq.slot === 'weapon') return CLASSES[cls].weapons.includes(eq.wtype);
  if (eq.slot === 'shield') return ['hero', 'warrior', 'priest', 'thief'].includes(cls);
  return true; // よろい・装飾品は全クラス可
}

// ---- 敵データ ----
// res: 属性倍率 (2=弱点, 0.5=耐性, 0=無効, -1=吸収)
// ai: [{skill|'attack'|'guard', w(重み), hpBelow?}]
// img: [シート番号, セル番号]
const ENEMIES = {
  // Z1: ハーベル平原
  puni: { name: 'ぷにまる', img: [0, 0], hp: 12, atk: 13, def: 4, agi: 4, mag: 2, luk: 3, exp: 3, gold: 4, res: { fire: 2 }, ai: [{ a: 'attack', w: 10 }] },
  fieldrat: { name: 'のねずみ', img: [0, 1], hp: 15, atk: 15, def: 5, agi: 8, mag: 2, luk: 5, exp: 5, gold: 6, ai: [{ a: 'attack', w: 10 }] },
  batty: { name: 'いたずらコウモリ', img: [0, 2], hp: 14, atk: 14, def: 4, agi: 11, mag: 3, luk: 6, exp: 6, gold: 7, res: { wind: 2 }, ai: [{ a: 'attack', w: 10 }] },
  thornworm: { name: 'とげいもむし', img: [0, 3], hp: 22, atk: 18, def: 8, agi: 3, mag: 2, luk: 3, exp: 9, gold: 10, res: { fire: 2, ice: 0.5 }, ai: [{ a: 'attack', w: 8 }, { a: 'e_poison', w: 3 }] },
  // Z2: 囁きの洞窟・山道
  gnome: { name: '洞窟ノーム', img: [0, 4], hp: 28, atk: 24, def: 10, agi: 7, mag: 4, luk: 5, exp: 14, gold: 16, res: { bolt: 2, earth: 0.5 }, ai: [{ a: 'attack', w: 10 }], drop: { item: 'herb', rate: 0.15 } },
  toadstool: { name: 'わらいダケ', img: [0, 5], hp: 25, atk: 22, def: 9, agi: 5, mag: 6, luk: 4, exp: 15, gold: 14, res: { fire: 2 }, ai: [{ a: 'attack', w: 6 }, { a: 'e_sleep', w: 4 }] },
  skelsoldier: { name: 'がいこつ兵', img: [0, 6], hp: 38, atk: 30, def: 12, agi: 8, mag: 3, luk: 4, exp: 24, gold: 26, res: { light: 2, dark: 0.5 }, ai: [{ a: 'attack', w: 8 }, { a: 'powerslash', w: 2 }], drop: { item: 'antidote', rate: 0.1 } },
  cavespider: { name: '大洞グモ', img: [0, 7], hp: 30, atk: 26, def: 9, agi: 12, mag: 3, luk: 6, exp: 18, gold: 18, res: { fire: 2 }, ai: [{ a: 'attack', w: 7 }, { a: 'e_para', w: 3 }] },
  // Z3: 海沿い・沈没遺跡
  mancrab: { name: 'ひとくいガニ', img: [0, 8], hp: 45, atk: 46, def: 20, agi: 6, mag: 3, luk: 5, exp: 32, gold: 30, res: { bolt: 2, water: 0.5, fire: 0.5 }, ai: [{ a: 'attack', w: 10 }] },
  jellymage: { name: '魔導クラゲ', img: [0, 9], hp: 36, atk: 34, def: 10, agi: 10, mag: 14, luk: 7, exp: 35, gold: 34, res: { bolt: 2, water: -1 }, ai: [{ a: 'attack', w: 4 }, { a: 'e_sleep', w: 3 }, { a: 'fire1', w: 3 }] },
  drownedarmor: { name: 'さまよう鎧', img: [0, 10], hp: 60, atk: 52, def: 24, agi: 5, mag: 4, luk: 3, exp: 48, gold: 45, res: { bolt: 2, phys: 0.7, dark: 0.5 }, ai: [{ a: 'attack', w: 8 }, { a: 'helmsplit', w: 2 }], drop: { item: 'herb2', rate: 0.12 } },
  seaserpent: { name: 'うみへび', img: [0, 11], hp: 50, atk: 48, def: 14, agi: 13, mag: 8, luk: 6, exp: 40, gold: 38, res: { bolt: 2, water: 0.5, ice: 0.5 }, ai: [{ a: 'attack', w: 7 }, { a: 'e_poison', w: 3 }] },
  // Z4: 砂漠
  sandworm: { name: 'サンドワーム', img: [0, 12], hp: 75, atk: 76, def: 18, agi: 7, mag: 4, luk: 4, exp: 60, gold: 52, res: { water: 2, ice: 2, fire: 0.5, earth: 0.5 }, ai: [{ a: 'attack', w: 8 }, { a: 'e_quake', w: 2 }] },
  dunebandit: { name: '砂丘の盗賊', img: [0, 13], hp: 58, atk: 72, def: 16, agi: 16, mag: 6, luk: 12, exp: 55, gold: 90, ai: [{ a: 'attack', w: 7 }, { a: 'poisonedge', w: 3 }], drop: { item: 'wingfeather', rate: 0.1 } },
  mummy: { name: 'ミイラ兵', img: [0, 14], hp: 70, atk: 80, def: 20, agi: 6, mag: 5, luk: 3, exp: 65, gold: 58, res: { fire: 2, light: 2, dark: 0.5 }, ai: [{ a: 'attack', w: 7 }, { a: 'e_para', w: 3 }] },
  scorpio: { name: 'デスサソリ', img: [0, 15], hp: 55, atk: 82, def: 24, agi: 11, mag: 4, luk: 6, exp: 62, gold: 55, res: { ice: 2, fire: 0.5 }, ai: [{ a: 'attack', w: 6 }, { a: 'e_poison', w: 4 }] },
  // Z5: 雪原
  snowwolf: { name: '吹雪オオカミ', img: [1, 0], hp: 80, atk: 92, def: 22, agi: 20, mag: 8, luk: 8, exp: 85, gold: 70, res: { fire: 2, ice: 0.5 }, ai: [{ a: 'attack', w: 8 }, { a: 'e_icebreath', w: 2 }] },
  icegolem: { name: 'アイスゴーレム', img: [1, 1], hp: 120, atk: 96, def: 34, agi: 6, mag: 6, luk: 3, exp: 110, gold: 88, res: { fire: 2, ice: 0, phys: 0.7 }, ai: [{ a: 'attack', w: 8 }, { a: 'e_icebreath', w: 2 }] },
  frostsprite: { name: '吹雪の精', img: [1, 2], hp: 65, atk: 80, def: 20, agi: 18, mag: 20, luk: 10, exp: 95, gold: 80, res: { fire: 2, ice: -1 }, ai: [{ a: 'ice2', w: 5 }, { a: 'attack', w: 3 }, { a: 'e_sleep', w: 2 }] },
  // Z6: 火山
  firelizard: { name: '火トカゲ', img: [1, 3], hp: 90, atk: 84, def: 26, agi: 14, mag: 10, luk: 7, exp: 120, gold: 95, res: { ice: 2, water: 2, fire: -1 }, ai: [{ a: 'attack', w: 6 }, { a: 'e_firebreath', w: 4 }] },
  lavaturtle: { name: '溶岩ガメ', img: [1, 4], hp: 140, atk: 86, def: 44, agi: 5, mag: 8, luk: 4, exp: 140, gold: 110, res: { ice: 2, water: 2, fire: 0, phys: 0.6 }, ai: [{ a: 'attack', w: 7 }, { a: 'e_firebreath', w: 3 }] },
  flamedjinn: { name: '炎の魔人', img: [1, 5], hp: 100, atk: 82, def: 28, agi: 16, mag: 24, luk: 9, exp: 150, gold: 130, res: { ice: 2, water: 2, fire: -1 }, ai: [{ a: 'fire2', w: 4 }, { a: 'attack', w: 4 }, { a: 'e_firebreath', w: 2 }], drop: { item: 'bomb', rate: 0.15 } },
  // Z7: 魔王城
  darkknight: { name: '闇の騎士', img: [1, 6], hp: 160, atk: 118, def: 40, agi: 18, mag: 12, luk: 8, exp: 220, gold: 160, res: { light: 2, dark: 0.5 }, ai: [{ a: 'attack', w: 6 }, { a: 'fullswing', w: 2 }, { a: 'helmsplit', w: 2 }] },
  deathmage: { name: 'デスメイジ', img: [1, 7], hp: 110, atk: 96, def: 26, agi: 20, mag: 34, luk: 10, exp: 240, gold: 180, res: { light: 2, dark: -1 }, ai: [{ a: 'e_dark', w: 4 }, { a: 'e_bolt', w: 3 }, { a: 'e_sleep', w: 3 }], drop: { item: 'ether', rate: 0.15 } },
  gargoyle: { name: 'ガーゴイル', img: [1, 8], hp: 140, atk: 116, def: 48, agi: 22, mag: 10, luk: 8, exp: 230, gold: 170, res: { phys: 0.6, bolt: 2 }, ai: [{ a: 'attack', w: 7 }, { a: 'e_para', w: 3 }] },
  // Z8: 黄昏の世界(裏)
  voidshade: { name: '虚無の影', img: [1, 9], hp: 220, atk: 140, def: 50, agi: 30, mag: 30, luk: 15, exp: 500, gold: 300, res: { light: 2, dark: 0, phys: 0.7 }, ai: [{ a: 'attack', w: 5 }, { a: 'e_dark', w: 3 }, { a: 'e_sleep', w: 2 }] },
  abysseye: { name: '深淵の目', img: [1, 10], hp: 180, atk: 120, def: 44, agi: 26, mag: 44, luk: 18, exp: 520, gold: 340, res: { light: 2, dark: -1 }, ai: [{ a: 'e_darkstrong', w: 3 }, { a: 'e_bolt', w: 3 }, { a: 'e_para', w: 2 }, { a: 'e_healself', w: 2 }] },
  chaosdragon: { name: 'カオスドラゴン', img: [1, 11], hp: 300, atk: 155, def: 56, agi: 24, mag: 36, luk: 12, exp: 800, gold: 500, res: { phys: 0.8 }, ai: [{ a: 'attack', w: 4 }, { a: 'e_firebreath', w: 3 }, { a: 'e_icebreath', w: 3 }], drop: { item: 'herb3', rate: 0.3 } },
  // ---- ボス ----
  boss_gand: {
    name: 'ゴーレム長ガンド', img: [1, 12], boss: true, hp: 220, atk: 38, def: 18, agi: 5, mag: 6, luk: 5, exp: 120, gold: 150,
    res: { bolt: 2, earth: 0, phys: 0.85, fire: 0.7 },
    ai: [{ a: 'attack', w: 6 }, { a: 'e_quake', w: 3 }, { a: 'warcry', w: 1 }],
  },
  boss_rival: {
    name: '深海の主リヴァル', img: [1, 13], boss: true, hp: 440, atk: 56, def: 24, agi: 12, mag: 18, luk: 8, exp: 350, gold: 400,
    res: { bolt: 2, water: -1, ice: 0.5, fire: 0.7 },
    ai: [{ a: 'attack', w: 6 }, { a: 'e_tidal', w: 2 }, { a: 'e_sleep', w: 2 }],
  },
  boss_zeph: {
    name: '風の番人ゼフ', img: [1, 14], boss: true, hp: 560, atk: 72, def: 30, agi: 26, mag: 22, luk: 12, exp: 550, gold: 550,
    res: { earth: 2, wind: 0, phys: 0.85 },
    ai: [{ a: 'attack', w: 4 }, { a: 'e_wind', w: 3 }, { a: 'gustblade', w: 2 }, { a: 'slowdown', w: 1 }],
  },
  boss_frimd: {
    name: '氷晶竜フリムド', img: [1, 15], boss: true, hp: 850, atk: 112, def: 34, agi: 18, mag: 28, luk: 10, exp: 900, gold: 800,
    res: { ice: 0, fire: 1 }, // 属性シールドはAIスクリプトで制御
    aiScript: 'frimd',
  },
  boss_ignas: {
    name: '炎将イグナス', img: [2, 0], boss: true, hp: 950, atk: 110, def: 40, agi: 22, mag: 30, luk: 12, exp: 1300, gold: 1100,
    res: { ice: 2, water: 2, fire: -1 },
    ai: [{ a: 'attack', w: 4 }, { a: 'e_firebreath', w: 3 }, { a: 'fullswing', w: 2 }, { a: 'warcry', w: 1 }],
  },
  boss_shade1: {
    name: '魔王シェイドヴェイン', img: [2, 1], boss: true, hp: 900, atk: 118, def: 48, agi: 28, mag: 40, luk: 15, exp: 0, gold: 0,
    res: { light: 1.5, dark: 0, phys: 0.85 },
    ai: [{ a: 'attack', w: 4 }, { a: 'e_dark', w: 3 }, { a: 'e_bolt', w: 2 }, { a: 'e_sleep', w: 1 }],
  },
  boss_shade2: {
    name: '魔王シェイドヴェイン・真', img: [2, 2], boss: true, hp: 1500, atk: 135, def: 54, agi: 32, mag: 48, luk: 18, exp: 4000, gold: 3000,
    res: { light: 1.5, dark: -1, phys: 0.8 },
    ai: [{ a: 'attack', w: 3 }, { a: 'e_darkstrong', w: 3 }, { a: 'e_icebreath', w: 2 }, { a: 'e_para', w: 1 }, { a: 'e_healself', w: 1, hpBelow: 0.3 }],
    turns2: true, // 1ターンに2回行動
  },
  boss_azraus: {
    name: '混沌神アズラウス', img: [2, 3], boss: true, hp: 3600, atk: 185, def: 66, agi: 40, mag: 60, luk: 25, exp: 0, gold: 0,
    res: { dark: 0, phys: 0.8 },
    aiScript: 'azraus', turns2: true,
  },
};

// ---- エンカウント定義 ----
// groups: [ [enemyId, ...], weight ]
const ENC_TABLES = {
  plains: { rate: 0.055, groups: [
    [['puni'], 3], [['puni', 'puni'], 3], [['fieldrat'], 3], [['fieldrat', 'puni'], 2], [['batty', 'batty'], 2], [['thornworm'], 1],
  ]},
  plains2: { rate: 0.06, groups: [
    [['thornworm', 'puni', 'puni'], 3], [['batty', 'batty', 'fieldrat'], 3], [['gnome'], 3], [['gnome', 'gnome'], 2], [['toadstool', 'thornworm'], 2],
  ]},
  cave: { rate: 0.08, groups: [
    [['gnome', 'gnome'], 3], [['toadstool'], 2], [['toadstool', 'gnome'], 3], [['cavespider', 'cavespider'], 2], [['skelsoldier'], 2], [['skelsoldier', 'gnome'], 1],
  ]},
  coast: { rate: 0.06, groups: [
    [['mancrab'], 3], [['mancrab', 'mancrab'], 2], [['seaserpent'], 3], [['jellymage', 'jellymage'], 2], [['skelsoldier', 'cavespider'], 2],
  ]},
  ruins: { rate: 0.08, groups: [
    [['jellymage', 'jellymage'], 3], [['drownedarmor'], 3], [['drownedarmor', 'jellymage'], 2], [['seaserpent', 'mancrab'], 3], [['drownedarmor', 'drownedarmor'], 1],
  ]},
  desert: { rate: 0.065, groups: [
    [['sandworm'], 3], [['dunebandit', 'dunebandit'], 3], [['scorpio', 'scorpio'], 2], [['mummy', 'dunebandit'], 2], [['sandworm', 'scorpio'], 2],
  ]},
  snowfield: { rate: 0.065, groups: [
    [['snowwolf', 'snowwolf'], 3], [['frostsprite'], 3], [['icegolem'], 2], [['frostsprite', 'snowwolf'], 2], [['icegolem', 'frostsprite'], 1],
  ]},
  spire: { rate: 0.08, groups: [
    [['icegolem'], 3], [['frostsprite', 'frostsprite'], 3], [['snowwolf', 'snowwolf', 'frostsprite'], 2], [['icegolem', 'icegolem'], 1],
  ]},
  volcano: { rate: 0.08, groups: [
    [['firelizard', 'firelizard'], 3], [['lavaturtle'], 3], [['flamedjinn'], 2], [['flamedjinn', 'firelizard'], 2], [['lavaturtle', 'flamedjinn'], 1],
  ]},
  darkcastle: { rate: 0.085, groups: [
    [['darkknight'], 3], [['deathmage', 'gargoyle'], 3], [['gargoyle', 'gargoyle'], 2], [['darkknight', 'deathmage'], 2], [['darkknight', 'darkknight', 'deathmage'], 1],
  ]},
  shadowworld: { rate: 0.06, groups: [
    [['voidshade', 'voidshade'], 3], [['abysseye'], 3], [['chaosdragon'], 2], [['voidshade', 'abysseye'], 2],
  ]},
  voidsanctum: { rate: 0.085, groups: [
    [['abysseye', 'abysseye'], 3], [['chaosdragon', 'voidshade'], 3], [['chaosdragon', 'chaosdragon'], 1], [['voidshade', 'voidshade', 'abysseye'], 2],
  ]},
};

// ---- ショップ定義 ----
const SHOPS = {
  harbel_item: { kind: 'item', stock: ['herb', 'antidote', 'wakebell', 'wingfeather'] },
  harbel_weapon: { kind: 'equip', stock: ['w_stick', 'w_dagger1', 'w_sword1', 'w_claw1', 'w_staff1', 'w_hammer1', 'a_clothes', 's_wood'] },
  karst_item: { kind: 'item', stock: ['herb', 'herb2', 'antidote', 'wakebell', 'wingfeather'] },
  karst_weapon: { kind: 'equip', stock: ['w_sword2', 'w_dagger2', 'w_claw2', 'w_hammer2', 'a_leather', 'a_robe1', 'a_gi', 's_leather'] },
  meria_item: { kind: 'item', stock: ['herb', 'herb2', 'ether', 'antidote', 'wakebell', 'panacea', 'wingfeather'] },
  meria_weapon: { kind: 'equip', stock: ['w_axe1', 'w_staff2', 'w_sword2', 'a_chain', 'a_robe2', 's_iron', 'ac_ring1', 'ac_ring2'] },
  zahra_item: { kind: 'item', stock: ['herb2', 'ether', 'panacea', 'phoenixdown', 'bomb', 'wingfeather'] },
  zahra_weapon: { kind: 'equip', stock: ['w_sword3', 'w_dagger3', 'w_claw3', 'w_staff3', 'w_axe2', 'a_iron', 'a_silkrobe', 's_silver', 'ac_boots', 'ac_charm'] },
  frell_item: { kind: 'item', stock: ['herb2', 'herb3', 'ether', 'panacea', 'phoenixdown', 'wingfeather'] },
  frell_weapon: { kind: 'equip', stock: ['w_sword4', 'w_hammer3', 'w_claw4', 'w_dagger4', 'w_staff4', 'a_silver', 'a_flame', 'a_frost', 'ac_amulet', 'ac_poisonguard'] },
  shadow_shop: { kind: 'equip', stock: ['w_axe3', 'w_claw5', 'w_staff5', 'w_dagger5', 'a_holy', 's_mirror', 's_aegis', 'ac_sage'] },
  shadow_item: { kind: 'item', stock: ['herb3', 'ether', 'panacea', 'phoenixdown', 'bomb'] },
};
