import { normalizeSession } from './rules.js'

function _pct(workouts, matcher) {
  if (!workouts.length) return 0
  return workouts.filter(matcher).length / workouts.length
}

function _hasTag(workout, tag) {
  return workout.tags?.includes(tag)
}

function _uniqueSignals(workouts) {
  const signals = new Set()
  for (const workout of workouts) {
    signals.add(workout.type)
    signals.add(workout.primaryCategory)
    for (const tag of (workout.tags || [])) signals.add(tag)
  }
  return signals.size
}

function _coreShare(workouts) {
  return _pct(workouts, workout => _hasTag(workout, 'core'))
}

function _nightSessions(workouts) {
  return workouts.filter(workout => {
    if (!workout.createdAt && !workout.created_at) return false
    const hour = new Date(workout.createdAt || workout.created_at).getHours()
    return hour >= 22 || hour < 6
  }).length
}

export const CLASSES = [
  {
    id: 'golge_akrobat',
    name: 'Gölge Akrobat',
    subName: 'Shadow Acrobat',
    icon: '🥷',
    color: '#6d5efc',
    desc: 'Kuvvet, çeviklik ve akrobasiyi aynı gövdede toplayan çok-sporlu ninja profilin.',
    buff: 'STR +%10 · AGI +%15 · DEX +%15 · Movement XP x1.2',
    passive: {
      statMult: { str: 1.1, agi: 1.15, dex: 1.15 },
      xpMult: { Parkour: 1.2, Akrobasi: 1.2, Tırmanış: 1.15, Push: 1.05, Pull: 1.05 },
      prBonus: 1.2,
    },
    trigger: workouts => _pct(workouts, workout => workout.primaryCategory === 'strength') >= 0.3
      && _pct(workouts, workout => workout.primaryCategory === 'movement') >= 0.2
      && _uniqueSignals(workouts) >= 8,
  },
  {
    id: 'gok_kartali',
    name: 'Gök Kartalı',
    subName: 'Sky Eagle',
    icon: '🦅',
    color: '#4a90ff',
    desc: 'Akrobasi ve parkour hattında havada rahat, inişte kontrollü hareket eden profil.',
    buff: 'AGI +%12 · DEX +%12 · Movement XP x1.3',
    passive: {
      statMult: { agi: 1.12, dex: 1.12 },
      xpMult: { Parkour: 1.3, Akrobasi: 1.3 },
    },
    trigger: workouts => _pct(workouts, workout => workout.primaryCategory === 'movement') >= 0.5,
  },
  {
    id: 'duvar_orucu',
    name: 'Duvar Örücü',
    subName: 'Wall Weaver',
    icon: '🕷️',
    color: '#8a74ff',
    desc: 'Akrobasi, dönüş ve duvar okuma odaklı, ince koordinasyonla öne çıkan profil.',
    buff: 'DEX +%18 · Akrobasi XP x1.35',
    passive: {
      statMult: { dex: 1.18 },
      xpMult: { Akrobasi: 1.35, Tırmanış: 1.1 },
    },
    trigger: workouts => _pct(workouts, workout => _hasTag(workout, 'acrobatics')) >= 0.35,
  },
  {
    id: 'vinc_gezgini',
    name: 'Vinç Gezgini',
    subName: 'Crane Walker',
    icon: '🦉',
    color: '#34c79a',
    desc: 'Parkour, zemin okuma ve rota akışı baskın; şehir onun oyun alanı.',
    buff: 'AGI +%15 · Parkour XP x1.25',
    passive: {
      statMult: { agi: 1.15 },
      xpMult: { Parkour: 1.25 },
      streakShield: true,
    },
    trigger: workouts => _pct(workouts, workout => _hasTag(workout, 'parkour')) >= 0.4,
  },
  {
    id: 'ayi_pencesi',
    name: 'Ayı Pençesi',
    subName: 'Bear Paw',
    icon: '🐻',
    color: '#f4a026',
    desc: 'Saf kuvvet, hacim ve güçlü itiş-çekiş bloklarıyla ilerleyen profil.',
    buff: 'STR +%20 · Push/Pull XP x1.15',
    passive: {
      statMult: { str: 1.2 },
      xpMult: { Push: 1.15, Pull: 1.15, Calisthenics: 1.1, Gym: 1.1 },
    },
    trigger: workouts => _pct(workouts, workout => workout.primaryCategory === 'strength') >= 0.55,
  },
  {
    id: 'celik_omurga',
    name: 'Çelik Omurga',
    subName: 'Steel Spine',
    icon: '⛓️',
    color: '#7a8896',
    desc: 'Alt vücut, yük taşıma ve dayanıklılık birlikte çalışan sağlam bir iskelet.',
    buff: 'END +%18 · STA +%15 · Fatigue direnci',
    passive: {
      statMult: { end: 1.18, sta: 1.15 },
      fatigueDecay: 0.75,
    },
    trigger: workouts => _pct(workouts, workout => _hasTag(workout, 'legs')) >= 0.4
      && _pct(workouts, workout => workout.primaryCategory === 'endurance') >= 0.2,
  },
  {
    id: 'cekirdek_alevi',
    name: 'Çekirdek Alevi',
    subName: 'Core Flame',
    icon: '🔥',
    color: '#ff6b6b',
    desc: 'Gövdeden güç üreten, body-tension ve hanging core ile kilitlenen profil.',
    buff: 'CON +%28 · Core bonus XP x1.25',
    passive: {
      statMult: { con: 1.28 },
      xpMult: { Calisthenics: 1.1, Custom: 1.15 },
      prBonus: 1.2,
    },
    trigger: workouts => _coreShare(workouts) >= 0.3,
  },
  {
    id: 'ruzgar_kosucusu',
    name: 'Rüzgar Koşucusu',
    subName: 'Wind Runner',
    icon: '🌬️',
    color: '#3cc7ff',
    desc: 'Yürüyüş, bisiklet, koşu ve parkour arasında mesafe ve akışı birleştiren profil.',
    buff: 'STA +%20 · Endurance XP x1.2',
    passive: {
      statMult: { sta: 1.2 },
      xpMult: { Yürüyüş: 1.2, Bisiklet: 1.2, Koşu: 1.2, Kayak: 1.1 },
      streakShield: true,
    },
    trigger: workouts => _pct(workouts, workout => workout.primaryCategory === 'endurance') >= 0.45,
  },
  {
    id: 'mermer_heykel',
    name: 'Mermer Heykel',
    subName: 'Marble Statue',
    icon: '🗿',
    color: '#cfd6e4',
    desc: 'Mobilite, esneklik ve toparlanma kalitesini yüksek tutan sabırlı profil.',
    buff: 'Armor regen x2 · Fatigue gain x0.6',
    passive: {
      statMult: { dex: 1.08, end: 1.08 },
      armorRegen: 2.0,
      fatigueDecay: 0.6,
    },
    trigger: workouts => _pct(workouts, workout => workout.primaryCategory === 'recovery') >= 0.3,
  },
  {
    id: 'golge_gezgini',
    name: 'Gölge Gezgini',
    subName: 'Night Walker',
    icon: '🌙',
    color: '#7d6bff',
    desc: 'Gece çalışan, sakin ve sessiz ama sürekliliği yüksek profil.',
    buff: 'Hidden XP x1.3 · Hidden badge drop +%3',
    passive: {
      statMult: { agi: 1.06, dex: 1.06 },
      xpMult: { Custom: 1.3 },
      hiddenDropBonus: 0.03,
    },
    trigger: workouts => _nightSessions(workouts) >= 4,
  },
  {
    id: 'merakli_ruh',
    name: 'Meraklı Ruh',
    subName: 'Wanderer',
    icon: '🔮',
    color: '#f57bb6',
    desc: 'Her branştan beslenen, uzmanlık kadar çeşitliliğe de yatırım yapan profil.',
    buff: 'Tüm statlar +%5 · Tüm XP x1.08',
    passive: {
      statMult: { str: 1.05, agi: 1.05, end: 1.05, dex: 1.05, con: 1.05, sta: 1.05 },
      xpMult: {
        Push: 1.08,
        Pull: 1.08,
        Bacak: 1.08,
        Parkour: 1.08,
        Akrobasi: 1.08,
        Yürüyüş: 1.08,
        Stretching: 1.08,
        Bisiklet: 1.08,
        Kayak: 1.08,
        Tırmanış: 1.08,
        Calisthenics: 1.08,
        Gym: 1.08,
        Koşu: 1.08,
        Custom: 1.08,
      },
      hiddenDropBonus: 0.02,
    },
    trigger: workouts => _uniqueSignals(workouts) >= 12,
  },
]

export const DEFAULT_CLASS = {
  id: 'cirak',
  name: 'Çırak',
  subName: 'Awakening',
  icon: '🥚',
  color: '#7b8190',
  desc: 'Desen oluşuyor. 10 antrenmanlık patern oturduğunda sınıf netleşecek.',
  buff: 'Henüz pasif yok — desen oluşuyor',
  passive: {},
  trigger: () => true,
}

export function normalizeClassWorkouts(workouts = []) {
  return workouts.map(workout => normalizeSession(workout))
}
