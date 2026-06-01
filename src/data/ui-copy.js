const UI_LABELS = {
  readiness: 'Hazır',
  armor: 'Can',
  fatigue: 'Yorgun',
  risk: 'Dikkat',
  source: 'Kayıt',
  pulse: 'Son seans',
  confidence: 'Durum',
  command: 'Bugün',
  class: 'Tip',
  focus: 'Odak',
  archetype: 'Tip',
  unlock: 'Yeni hareket',
  mainMove: 'Ana iş',
  supportMove: 'Ek iş',
}

const GOAL_TITLES = {
  onboarding: 'İlk kayıt',
  recovery: 'Dinlenme',
  technical: 'Form',
  'pr-hold': 'Rekor sonrası',
  balance: 'Eksiği kapat',
  progress: 'Küçük artış',
}

const SIMPLE_COPY_REPLACEMENTS = [
  [/\breadiness\b/gi, 'hazırlık'],
  [/\bconfidence\b/gi, 'durum'],
  [/\bevidence\b/gi, 'not'],
  [/\bsignal\w*\b/gi, 'not'],
  [/\bsinyal\w*\b/gi, 'not'],
  [/\bkanit\w*/gi, 'not'],
  [/kan\u0131t\w*/gi, 'not'],
  [/\bdefter\w*/gi, 'kayıt'],
  [/\bpanel\w*/gi, 'kart'],
  [/\bkarar motoru\b/gi, 'sistem'],
  [/\bmotoru\b/gi, 'sistem'],
  [/\brecete\b/gi, 'plan'],
  [/\bprotokol\b/gi, 'plan'],
  [/\btelemetri\b/gi, 'veri'],
  [/\bledger\b/gi, 'kayıt'],
  [/\bmigration\b/gi, 'kurulum'],
  [/\bsync\b/gi, 'eşleme'],
  [/\bendpoint\b/gi, 'adres'],
  [/\bkalkan\w*\s+onar/gi, 'can topla'],
  [/\bkalkan\w*/gi, 'can'],
  [/\bAkis\b/g, 'Can'],
  [/\bakis\b/g, 'can'],
  [/\barmor\b/gi, 'can'],
  [/\bIsik\b/g, 'Hazır'],
  [/\bisik\b/g, 'hazır'],
  [/\bsis\b/gi, 'yorgunluk'],
  [/\btemkin\w*/gi, 'dikkat'],
  [/\brisk\w*/gi, 'dikkat'],
  [/\bbaglam\b/gi, 'durum'],
  [/\bmodu\b/gi, 'hali'],
  [/\bcanli veri\b/gi, 'güncel kayıt'],
  [/\bcanli kaynak\b/gi, 'kayıt'],
  [/\bcanli kayit\b/gi, 'güncel kayıt'],
  [/\bveri geldikce\b/gi, 'kayıt geldikçe'],
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
  if (Number(armor) < 60) return 'Can düşük'
  if (Number.isFinite(Number(readiness)) && Number(readiness) < 55) return 'Kontrollü'
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
