import {
  extractAtomicWorkoutFacts,
  parseHydrationLiters,
  parseLoad,
  parseMinutes,
  parseSetsXReps,
  parseSleepHours,
} from '../../src/data/atomic-fact-parser.js'
import { normalizeBodyEvent, normalizeRegionId, regionLabel } from '../../src/data/body-events.js'
import { getLocalDateString, normalizeDateString, normalizeSession } from '../../src/data/rules.js'

const QUESTION_RE = /\?|ne yap|nasıl|nasil|neden|sence|yorum|öner|oner|hangi|kaç|kac/i
const WORKOUT_RE = /\b(bench|press|push|pull|row|squat|deadlift|curl|dip|plank|hollow|l-sit|lsit|muscle|parkour|akrobasi|flip|barani|handstand|koşu|kosu|yürüyüş|yuruyus|bisiklet|gym|bacak|omuz|göğüs|gogus|sırt|sirt|seans|antrenman|idman|set|tekrar|rep|kg|dk)\b/i
const RECOVERY_RE = /\b(uyku|uyudum|saat uy|adım|adim|su iç|su ict|su içt|litre|mood|moral|yorgun|dinlen|toparlan|recovery)\b/i
const BODY_EVENT_RE = /\b(ağrı|agri|ağrıyor|agriyor|sızlıyor|sizliyor|sakat|incindi|çekti|cekti|zorladı|zorladi|kilit|bilek|omuz|diz|bel|kalça|kalca|ayak bileği|ayak bilegi)\b/i
const BODY_METRIC_RE = /\b(kilo|kg oldum|ağırlık|agirlik|yağ|yag|bel|göğüs çevre|gogus cevre|kol çevre|kol cevre)\b/i

function addDays(dateStr, days) {
  const date = new Date(`${normalizeDateString(dateStr)}T00:00:00`)
  date.setDate(date.getDate() + days)
  return getLocalDateString(date)
}

export function inferIntakeDate(text = '', today = getLocalDateString()) {
  const clean = String(text || '').toLowerCase()
  if (/\bdün\b|\bdun\b/.test(clean)) return addDays(today, -1)
  if (/\bönceki gün\b|\bonceki gun\b/.test(clean)) return addDays(today, -2)
  if (/\byarın\b|\byarin\b/.test(clean)) return addDays(today, 1)
  const iso = clean.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso) return normalizeDateString(iso[1], today)
  const dotted = clean.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?\b/)
  if (dotted) {
    const year = dotted[3] || today.slice(0, 4)
    return normalizeDateString(`${year}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}`, today)
  }
  return today
}

function inferWorkoutType(text = '', facts = []) {
  const clean = String(text || '').toLowerCase()
  if (/parkour|precision|landing|vault|wall|flow/.test(clean)) return 'Parkour'
  if (/akrobasi|flip|barani|round off|handstand/.test(clean)) return 'Akrobasi'
  if (/yürüyüş|yuruyus|walk/.test(clean)) return 'Yuruyus'
  if (/koşu|kosu|run/.test(clean)) return 'Kosu'
  if (/bisiklet|bike|cycling/.test(clean)) return 'Bisiklet'
  if (/mobilite|mobility|stretch/.test(clean)) return 'Stretching'
  if (/bacak|squat|deadlift|lunge|leg/.test(clean)) return 'Bacak'
  if (/pull|row|curl|muscle|barfiks/.test(clean)) return 'Pull'
  if (/push|bench|press|dip|göğüs|gogus|triceps/.test(clean)) return 'Push'
  return facts.find(fact => fact.signals?.[0]?.typeHint)?.signals?.[0]?.typeHint || 'Gym'
}

function exerciseNameFrom(text = '') {
  const clean = String(text || '').toLowerCase()
  const names = [
    ['bench', 'Bench Press'],
    ['squat', 'Squat'],
    ['deadlift', 'Deadlift'],
    ['row', 'Row'],
    ['pull', 'Pull-Up'],
    ['barfiks', 'Pull-Up'],
    ['dip', 'Dip'],
    ['curl', 'Curl'],
    ['hollow', 'Hollow Body'],
    ['plank', 'Plank'],
    ['l-sit', 'L-Sit'],
    ['lsit', 'L-Sit'],
    ['muscle', 'Muscle-Up'],
  ]
  return names.find(([needle]) => clean.includes(needle))?.[1] || 'Ana blok'
}

function buildExercise(text = '') {
  const sets = parseSetsXReps(text)
  const load = parseLoad(text)
  if (!sets?.sets || !sets?.reps) return []
  return [{
    name: exerciseNameFrom(text),
    sets: Array.from({ length: sets.sets }, () => ({
      reps: sets.reps,
      kg: Number(load?.weight_kg) || 0,
      weightKg: Number(load?.weight_kg) || 0,
    })),
  }]
}

function volumeFromExercises(exercises = []) {
  return Math.round(exercises.reduce((sum, exercise) => (
    sum + (exercise.sets || []).reduce((setSum, set) => setSum + ((Number(set.kg ?? set.weightKg) || 0) * (Number(set.reps) || 0)), 0)
  ), 0))
}

function parseWorkout(text = '', today = getLocalDateString()) {
  const atomic = extractAtomicWorkoutFacts(text)
  const facts = atomic.facts || []
  const exercises = buildExercise(text)
  const durationMin = parseMinutes(text) || facts.find(fact => fact.durationMin)?.durationMin || 45
  const distanceKm = facts.reduce((sum, fact) => sum + (Number(fact.distanceKm) || 0), 0)
  const sets = exercises.reduce((sum, exercise) => sum + (exercise.sets || []).length, 0) || facts.reduce((sum, fact) => sum + (Number(fact.sets) || 0), 0)
  const volumeKg = volumeFromExercises(exercises) || facts.reduce((sum, fact) => sum + ((Number(fact.weightKg) || 0) * (Number(fact.reps) || 0) * (Number(fact.sets) || 0)), 0)
  const tags = [...new Set(facts.flatMap(fact => fact.tags || []))]
  const session = normalizeSession({
    date: inferIntakeDate(text, today),
    type: inferWorkoutType(text, facts),
    durationMin,
    distanceKm,
    source: 'web_odie',
    exercises,
    sets,
    volumeKg,
    highlight: String(text).slice(0, 140),
    notes: 'ODIE doğal dil girişi',
    tags,
    hasPr: /\bpr\b|rekor|en iyi/i.test(text),
  }, { source: 'web_odie' })
  return session
}

function parseDaily(text = '', today = getLocalDateString()) {
  const sleepHours = parseSleepHours(text)
  const liters = parseHydrationLiters(text)
  const steps = Number(String(text).match(/(\d{3,6})\s*(adım|adim|step)/i)?.[1]) || 0
  const mood = Number(String(text).match(/\b(?:mood|moral)\s*(\d)\b/i)?.[1]) || 0
  return {
    date: inferIntakeDate(text, today),
    sleepHours: sleepHours || 0,
    waterMl: liters ? Math.round(liters * 1000) : 0,
    steps,
    mood,
  }
}

function parseBodyEvent(text = '', today = getLocalDateString()) {
  const regionMatch = String(text).match(/(omuz|bilek|diz|bel|kalça|kalca|core|göğüs|gogus|sırt|sirt|ayak bileği|ayak bilegi)/i)
  const region = normalizeRegionId(regionMatch?.[1] || 'core')
  const severity = /\b(çok|cok|sert|fena|kötü|kotu)\b/i.test(text) ? 4 : 3
  const eta = Number(String(text).match(/(\d+)\s*gün/i)?.[1]) || (severity >= 4 ? 5 : 3)
  return normalizeBodyEvent({
    kind: 'injury',
    region,
    severity,
    recoveryPercent: severity >= 4 ? 35 : 60,
    etaDays: eta,
    status: 'active',
    note: String(text).slice(0, 180),
    source: 'web_odie',
  }, { today })
}

function parseBodyMetric(text = '', today = getLocalDateString()) {
  const weight = String(text).match(/(?:kilo|ağırlık|agirlik)?\s*(\d{2,3}(?:[.,]\d+)?)\s*kg/i)
  const bodyFat = String(text).match(/(?:yağ|yag)\s*%?\s*(\d{1,2}(?:[.,]\d+)?)/i)
  const waist = String(text).match(/(?:bel)\s*(\d{2,3}(?:[.,]\d+)?)\s*cm/i)
  const metrics = {}
  if (weight) metrics.weightKg = Number(weight[1].replace(',', '.'))
  if (bodyFat) metrics.bodyFatPct = Number(bodyFat[1].replace(',', '.'))
  if (waist) metrics.waistCm = Number(waist[1].replace(',', '.'))
  return {
    date: inferIntakeDate(text, today),
    metrics,
  }
}

function restEstimate(kind, record = {}) {
  if (kind === 'body_event') return `${record.etaDays || 3} gün temkin`
  if (kind === 'daily_log' && Number(record.sleepHours) > 0 && Number(record.sleepHours) < 6) return '24 saat düşük tempo'
  if (kind === 'workout') {
    if (record.primaryCategory === 'strength' || Number(record.volumeKg) > 2500) return '36-48 saat'
    if (record.primaryCategory === 'movement') return '24-36 saat'
    return '12-24 saat'
  }
  return 'ODIE yeni kayıtla netleştirir'
}

export function parseIntakeText(text = '', { today = getLocalDateString() } = {}) {
  const input = String(text || '').trim()
  if (!input) return { kind: 'needs_clarification', reason: 'Boş giriş.', question: 'Ne kaydedeyim patron?' }

  const hasWorkout = WORKOUT_RE.test(input)
  const hasStrongWorkout = /\b(bench|press|pull|row|squat|deadlift|parkour|koşu|kosu|yürüyüş|yuruyus|antrenman|idman|seans|set|tekrar|rep|kg|dk)\b/i.test(input)
  const hasRecovery = RECOVERY_RE.test(input)
  const hasBodyEvent = BODY_EVENT_RE.test(input)
  const hasBodyMetric = BODY_METRIC_RE.test(input)
  const asksQuestion = QUESTION_RE.test(input)

  if (hasBodyEvent && !hasStrongWorkout) {
    const record = parseBodyEvent(input, today)
    return {
      kind: 'body_event',
      title: `${regionLabel(record.region)} temkine alındı`,
      summary: record.note || input,
      record,
      restEstimate: restEstimate('body_event', record),
      requiresConfirmation: true,
    }
  }

  if (hasBodyMetric && !hasWorkout) {
    const record = parseBodyMetric(input, today)
    if (!Object.keys(record.metrics || {}).length) {
      return { kind: 'needs_clarification', reason: 'Ölçüm bulundu ama değer net değil.', question: 'Hangi ölçümü kaç olarak yazayım?' }
    }
    return {
      kind: 'body_metric',
      title: 'Vücut ölçüsü',
      summary: Object.entries(record.metrics).map(([key, value]) => `${key}: ${value}`).join(' · '),
      record,
      restEstimate: restEstimate('body_metric', record),
      requiresConfirmation: true,
    }
  }

  if (hasRecovery && !hasWorkout) {
    const record = parseDaily(input, today)
    if (!record.sleepHours && !record.waterMl && !record.steps && !record.mood) {
      return { kind: 'needs_clarification', reason: 'Toparlanma sinyali var ama sayı yok.', question: 'Uyku, adım veya su değerini kaç yazayım?' }
    }
    return {
      kind: 'daily_log',
      title: 'Günlük can kaydı',
      summary: `${record.sleepHours || 0}s uyku · ${record.steps || 0} adım · ${record.waterMl || 0}ml su`,
      record,
      restEstimate: restEstimate('daily_log', record),
      requiresConfirmation: true,
    }
  }

  if (hasWorkout) {
    const record = parseWorkout(input, today)
    const isStrength = ['Gym', 'Push', 'Pull', 'Shoulder', 'Bacak', 'Calisthenics'].includes(record.type)
    if (isStrength && (!record.exercises?.length || !record.sets || !record.volumeKg)) {
      return {
        kind: 'needs_clarification',
        reason: 'Güç kaydı için set, tekrar ve kg eksik.',
        question: 'Egzersiz + set x tekrar + kg şeklinde yaz: bench 65kg 3x5 gibi.',
      }
    }
    return {
      kind: 'workout',
      title: `${record.type} kaydı`,
      summary: `${record.durationMin || 0} dk · ${record.sets || 0} set · ${Math.round(record.volumeKg || 0)} kg`,
      record,
      restEstimate: restEstimate('workout', record),
      requiresConfirmation: true,
    }
  }

  if (asksQuestion) {
    return {
      kind: 'question',
      title: 'ODIE sorusu',
      summary: input,
      record: { question: input },
      restEstimate: '',
      requiresConfirmation: false,
    }
  }

  return {
    kind: 'needs_clarification',
    reason: 'Bunu kayıt mı soru mu ayırt edemedim.',
    question: 'Bunu seans, vücut notu, ölçüm ya da soru olarak mı yazayım?',
  }
}
