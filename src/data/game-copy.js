const TECHNICAL_TERMS = /\b(api|json|endpoint|schema|migration|payload|cache|fallback|telemetry|confidence|evidence|source|supabase|gemini)\b|kanıt|kanit|güven|guven/gi

const VISIBLE_LABELS = {
  hud: 'Komuta',
  missionLoop: 'Görev Döngüsü',
  level: 'Seviye',
  quest: 'Görev',
  reward: 'Ödül',
  ready: 'Hazır',
  recovery: 'Toparlanma',
  locked: 'Kilitli',
  unlocked: 'Açıldı',
  inProgress: 'Yolda',
}

const WORKOUT_LABELS = {
  Gym: 'Güç',
  Push: 'İtiş',
  Pull: 'Çekiş',
  Shoulder: 'Omuz',
  Bacak: 'Bacak',
  Parkour: 'Parkur',
  Akrobasi: 'Akrobasi',
  Acro: 'Akrobasi',
  Calisthenics: 'Vücut Ağırlığı',
  Yuruyus: 'Yürüyüş',
  'Yürüyüş': 'Yürüyüş',
  Kosu: 'Koşu',
  'Koşu': 'Koşu',
  Bisiklet: 'Bisiklet',
  Tirmanis: 'Tırmanış',
  'Tırmanış': 'Tırmanış',
  Stretching: 'Mobilite',
  Recovery: 'Toparlanma',
  Custom: 'Serbest',
}

const FLAVORS = [
  'Bugün gösteriş yok; temiz tekrar var.',
  'Kısa iş, net iş. Panoyu bir kare ilerlet.',
  'Zorlamadan kazan. Seri bozulmasın.',
  'Ana hattı yak, gerisini ODIE toplar.',
  'Bir temiz hamle bugünün kapısını açar.',
  'Formu koru, ödül zaten gelir.',
  'Canı yakmadan ateşi canlı tut.',
]

function hashText(value = '') {
  let hash = 2166136261
  for (const ch of String(value)) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

export function gameLabel(key = '', fallback = '') {
  return VISIBLE_LABELS[key] || fallback || key
}

export function displayWorkoutType(type = '') {
  return WORKOUT_LABELS[type] || type || 'Seans'
}

export function deterministicFlavor(seed = '', date = '') {
  const key = `${date || ''}:${seed || ''}`
  return FLAVORS[hashText(key) % FLAVORS.length]
}

export function cleanGameText(value = '', fallback = '') {
  const cleaned = String(value || fallback || '')
    .replace(TECHNICAL_TERMS, 'not')
    .replace(/\bMission Loop\b/g, 'Görev Döngüsü')
    .replace(/\bHUD\b/g, 'Komuta')
    .replace(/\bLVL\b/g, 'Seviye')
    .replace(/\bLOCKED\b/g, 'Kilitli')
    .replace(/\bUNLOCKED\b/g, 'Açıldı')
    .replace(/\bIN PROG\b/g, 'Yolda')
    .replace(/\bREQ\b/g, 'Şart')
    .replace(/\bReadiness\b/g, 'Hazırlık')
    .replace(/\bRecovery\b/g, 'Toparlanma')
    .replace(/\bCustom\b/g, 'Serbest')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || fallback
}

export function visibleTechnicalPattern() {
  return TECHNICAL_TERMS
}
