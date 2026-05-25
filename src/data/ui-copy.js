const UI_LABELS = {
  readiness: 'Hazir',
  armor: 'Can',
  fatigue: 'Yorgun',
  risk: 'Dikkat',
  source: 'Kayit',
  pulse: 'Son seans',
  confidence: 'Durum',
  command: 'Bugun',
  class: 'Tip',
  focus: 'Odak',
  archetype: 'Tip',
  unlock: 'Yeni hareket',
  mainMove: 'Ana is',
  supportMove: 'Ek is',
}

const GOAL_TITLES = {
  onboarding: 'Ilk kayit',
  recovery: 'Dinlenme',
  technical: 'Form',
  'pr-hold': 'Rekor sonrasi',
  balance: 'Eksigi kapat',
  progress: 'Kucuk artis',
}

const SIMPLE_COPY_REPLACEMENTS = [
  [/\breadiness\b/gi, 'hazirlik'],
  [/\bconfidence\b/gi, 'durum'],
  [/\bevidence\b/gi, 'not'],
  [/\bsignal\w*\b/gi, 'not'],
  [/\bsinyal\w*\b/gi, 'not'],
  [/\bkanit\w*/gi, 'not'],
  [/kan\u0131t\w*/gi, 'not'],
  [/\bdefter\w*/gi, 'kayit'],
  [/\bpanel\w*/gi, 'kart'],
  [/\bkarar motoru\b/gi, 'sistem'],
  [/\bmotoru\b/gi, 'sistem'],
  [/\brecete\b/gi, 'plan'],
  [/\bprotokol\b/gi, 'plan'],
  [/\btelemetri\b/gi, 'veri'],
  [/\bledger\b/gi, 'kayit'],
  [/\bmigration\b/gi, 'kurulum'],
  [/\bsync\b/gi, 'esleme'],
  [/\bendpoint\b/gi, 'adres'],
  [/\bkalkan\w*\s+onar/gi, 'can topla'],
  [/\bkalkan\w*/gi, 'can'],
  [/\bAkis\b/g, 'Can'],
  [/\bakis\b/g, 'can'],
  [/\barmor\b/gi, 'can'],
  [/\bIsik\b/g, 'Hazir'],
  [/\bisik\b/g, 'hazir'],
  [/\bsis\b/gi, 'yorgunluk'],
  [/\btemkin\w*/gi, 'dikkat'],
  [/\brisk\w*/gi, 'dikkat'],
  [/\bbaglam\b/gi, 'durum'],
  [/\bmodu\b/gi, 'hali'],
  [/\bcanli veri\b/gi, 'guncel kayit'],
  [/\bcanli kaynak\b/gi, 'kayit'],
  [/\bcanli kayit\b/gi, 'guncel kayit'],
  [/\bveri geldikce\b/gi, 'kayit geldikce'],
]

export function plainCopyText(value = '') {
  let out = String(value || '')
  SIMPLE_COPY_REPLACEMENTS.forEach(([pattern, replacement]) => {
    out = out.replace(pattern, replacement)
  })
  return out.replace(/\s+/g, ' ').trim()
}

export function uiLabel(key, fallback = '') {
  return UI_LABELS[key] || fallback || key
}

export function goalTitle(goal = {}) {
  return GOAL_TITLES[goal.key] || goal.title || GOAL_TITLES.progress
}

export function riskToneLabel({ fatigue = 0, armor = 100, readiness = null } = {}) {
  if (Number(fatigue) >= 70) return 'Dikkat'
  if (Number(armor) < 60) return 'Can dusuk'
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
