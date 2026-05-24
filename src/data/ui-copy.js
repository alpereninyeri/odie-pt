const UI_LABELS = {
  readiness: 'Hazir',
  armor: 'Kalkan',
  fatigue: 'Yorgunluk',
  risk: 'Dikkat',
  source: 'Defter',
  pulse: 'Son iz',
  confidence: 'Iz netligi',
  command: 'Bugunun Rotasi',
  class: 'Karakter Tipi',
  focus: 'Bugunku Odak',
  archetype: 'Karakter Tipi',
  unlock: 'Siradaki Acilim',
  mainMove: 'Ana hamle',
  supportMove: 'Destek',
}

const GOAL_TITLES = {
  onboarding: 'Ilk Temiz Kayit',
  recovery: 'Toparlanma Gunu',
  technical: 'Form Gunu',
  'pr-hold': 'Rekor Sonrasi Temkin',
  balance: 'Hatti Kapat',
  progress: 'Kucuk Artis Gunu',
}

export function uiLabel(key, fallback = '') {
  return UI_LABELS[key] || fallback || key
}

export function goalTitle(goal = {}) {
  return GOAL_TITLES[goal.key] || goal.title || GOAL_TITLES.progress
}

export function riskToneLabel({ fatigue = 0, armor = 100, readiness = null } = {}) {
  if (Number(fatigue) >= 70) return 'Yuksek dikkat'
  if (Number(armor) < 60) return 'Kalkan dusuk'
  if (Number.isFinite(Number(readiness)) && Number(readiness) < 55) return 'Kontrollu'
  return 'Stabil'
}

export function sourceLabel(source = '') {
  const key = String(source || '').toLowerCase()
  if (key === 'hevy') return 'HEVY'
  if (key === 'telegram') return 'TG'
  if (key === 'apple_health') return 'Apple Health'
  if (key) return 'WEB'
  return 'Bekliyor'
}
