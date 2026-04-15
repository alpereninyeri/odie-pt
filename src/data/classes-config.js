/**
 * OdiePt Class Evolution — 10 özgün sınıf
 *
 * Her sınıfın bir "trigger" fonksiyonu var: son 10 antrenmanın dağılımına bakıp
 * uyup uymadığını söyler. Sıralama öncelik — ilk eşleşen kazanır.
 *
 * Passive buff sistemi:
 *   statMult: { str: 1.15 } → stat görsel değerinde +%15
 *   xpMult:   { Parkour: 1.3 } → o tür antrenmanda flat XP çarpanı
 *   armorRegen: 2.0 → armor recovery formülünde çarpan
 *   fatigueDecay: 0.75 → fatigue birikimi %25 daha yavaş
 *   hiddenDropBonus: 0.02 → hidden badge drop şansı +%2
 *   prBonus: 1.5 → PR flat bonus XP çarpanı
 *   streakShield: true → 1 günlük kaçırma streak'i kırmaz
 */

const HEAVY = ['Push', 'Pull', 'Bacak']
const MOVEMENT = ['Parkour', 'Akrobasi']
const RECOVERY = ['Stretching', 'Yürüyüş', 'Yuruyus']
const CORE_KEYWORDS = ['hollow', 'l-sit', 'lsit', 'plank', 'dragon', 'core', 'ab wheel', 'crunch', 'leg raise']

function _pct(workouts, types) {
  if (!workouts.length) return 0
  const hit = workouts.filter(w => types.includes(w.type)).length
  return hit / workouts.length
}

function _hasCoreBlock(workouts) {
  const coreHits = workouts.filter(w =>
    (w.exercises || []).some(e =>
      CORE_KEYWORDS.some(kw => (e.name || '').toLowerCase().includes(kw))
    )
  ).length
  return coreHits / Math.max(1, workouts.length)
}

function _uniqueTypes(workouts) {
  return new Set(workouts.map(w => w.type)).size
}

function _nightSessions(workouts) {
  return workouts.filter(w => {
    if (!w.createdAt && !w.created_at) return false
    const h = new Date(w.createdAt || w.created_at).getHours()
    return h >= 22 || h < 6
  }).length
}

export const CLASSES = [
  {
    id: 'gok_kartali',
    name: 'Gök Kartalı',
    subName: 'Sky Eagle Sub-Class',
    icon: '🦅',
    color: '#60a5fa',
    desc: 'Parkour + Akrobasi kombosu. Havada yaşayan, yere korkarak inen.',
    buff: 'AGI +%12 · DEX +%12 · Parkour XP x1.3',
    passive: {
      statMult: { agi: 1.12, dex: 1.12 },
      xpMult:   { Parkour: 1.3, Akrobasi: 1.3 },
    },
    trigger: (ws) => _pct(ws, MOVEMENT) >= 0.5 && _uniqueTypes(ws) >= 3,
  },
  {
    id: 'duvar_orucu',
    name: 'Duvar Örücü',
    subName: 'Wall Weaver Sub-Class',
    icon: '🕷️',
    color: '#a78bfa',
    desc: 'Akrobasi uzmanı. Dikey dünyayı yatay gibi kullanır.',
    buff: 'DEX +%20 · Akrobasi PR bonusu x1.5',
    passive: {
      statMult: { dex: 1.2 },
      xpMult:   { Akrobasi: 1.35 },
      prBonus:  1.5,
    },
    trigger: (ws) => _pct(ws, ['Akrobasi']) >= 0.4,
  },
  {
    id: 'vinc_gezgini',
    name: 'Vinç Gezgini',
    subName: 'Crane Walker Sub-Class',
    icon: '🦉',
    color: '#34d399',
    desc: 'Saf parkour. Düşme korkusu yok, çatı onun sokağı.',
    buff: 'AGI +%15 · Streak shield (1 gün kaçırsan kırılmaz)',
    passive: {
      statMult: { agi: 1.15 },
      xpMult:   { Parkour: 1.25 },
      streakShield: true,
    },
    trigger: (ws) => _pct(ws, ['Parkour']) >= 0.4,
  },
  {
    id: 'ayi_pencesi',
    name: 'Ayı Pençesi',
    subName: 'Bear Paw Sub-Class',
    icon: '🐻',
    color: '#f59e0b',
    desc: 'Saf güç. Hacim kralı, yerden kaldırılamayan kütle.',
    buff: 'STR +%20 · Push/Pull XP +%15 · Volume bonusu',
    passive: {
      statMult: { str: 1.2 },
      xpMult:   { Push: 1.15, Pull: 1.15 },
    },
    trigger: (ws) => _pct(ws, ['Push', 'Pull']) >= 0.5,
  },
  {
    id: 'celik_omurga',
    name: 'Çelik Omurga',
    subName: 'Steel Spine Sub-Class',
    icon: '⛓️',
    color: '#94a3b8',
    desc: 'Bacak + denge. Kimse onu deviremez, kök salmış.',
    buff: 'END +%20 · STA +%15 · Fatigue direnci',
    passive: {
      statMult: { end: 1.2, sta: 1.15 },
      fatigueDecay: 0.7,
    },
    trigger: (ws) => _pct(ws, ['Bacak']) >= 0.3,
  },
  {
    id: 'cekirdek_alevi',
    name: 'Çekirdek Alevi',
    subName: 'Core Flame Sub-Class',
    icon: '🔥',
    color: '#ef4444',
    desc: 'Gövde içten yanıyor. Hareket merkezini kilitleyen usta.',
    buff: 'CON +%30 · PR bonusu x1.5 · Core XP x1.4',
    passive: {
      statMult: { con: 1.3 },
      xpMult:   { Custom: 1.2 },
      prBonus:  1.5,
    },
    trigger: (ws) => _hasCoreBlock(ws) >= 0.3,
  },
  {
    id: 'ruzgar_kosucusu',
    name: 'Rüzgâr Koşucusu',
    subName: 'Wind Runner Sub-Class',
    icon: '🌪️',
    color: '#22d3ee',
    desc: 'Yürüyüş + parkour. Mesafe tanımaz, nefesi rüzgârdır.',
    buff: 'STA +%25 · Yürüyüş XP x2 · Streak shield',
    passive: {
      statMult: { sta: 1.25 },
      xpMult:   { Yürüyüş: 2.0, Yuruyus: 2.0 },
      streakShield: true,
    },
    trigger: (ws) => _pct(ws, ['Yürüyüş', 'Yuruyus', 'Parkour']) >= 0.5,
  },
  {
    id: 'mermer_heykel',
    name: 'Mermer Heykel',
    subName: 'Marble Statue Sub-Class',
    icon: '🗿',
    color: '#cbd5e1',
    desc: 'Esneklik + iyileşme. Armor bar tükenmez, yaralanmaya bağışık.',
    buff: 'Armor regen x2 · Fatigue birikimi %40 yavaş',
    passive: {
      statMult: { dex: 1.1, end: 1.1 },
      armorRegen:   2.0,
      fatigueDecay: 0.6,
    },
    trigger: (ws) => _pct(ws, ['Stretching']) >= 0.3,
  },
  {
    id: 'golge_gezgini',
    name: 'Gölge Gezgini',
    subName: 'Night Walker Sub-Class',
    icon: '🌙',
    color: '#8b5cf6',
    desc: 'Gece antrenmanı. Dünya uyurken çalışan sessiz avcı.',
    buff: 'Hidden XP x1.5 · Hidden badge drop +%3',
    passive: {
      statMult: { agi: 1.08, dex: 1.08 },
      xpMult:   { Custom: 1.5 },
      hiddenDropBonus: 0.03,
    },
    trigger: (ws) => _nightSessions(ws) >= 4,
  },
  {
    id: 'merakli_ruh',
    name: 'Meraklı Ruh',
    subName: 'Wanderer Sub-Class',
    icon: '🔮',
    color: '#f472b6',
    desc: 'Her şeyi dener. Uzmanlaşmaz ama her kapıyı açar.',
    buff: 'Tüm statlar +%5 · Hidden drop +%2 · Tüm XP x1.1',
    passive: {
      statMult: { str: 1.05, agi: 1.05, end: 1.05, dex: 1.05, con: 1.05, sta: 1.05 },
      xpMult:   { Push: 1.1, Pull: 1.1, Bacak: 1.1, Parkour: 1.1, Akrobasi: 1.1, Shoulder: 1.1, Stretching: 1.1, Yürüyüş: 1.1, Yuruyus: 1.1, Custom: 1.1 },
      hiddenDropBonus: 0.02,
    },
    trigger: (ws) => _uniqueTypes(ws) >= 6,
  },
]

export const DEFAULT_CLASS = {
  id: 'cirak',
  name: 'Çırak',
  subName: 'Awakening Sub-Class',
  icon: '🥚',
  color: '#64748b',
  desc: 'Henüz yolunu bulmadın. İlk 10 antrenmandan sonra sınıfın belirir.',
  buff: 'Henüz pasif yok — deseni oluştur',
  passive: {},
  trigger: () => true,
}
