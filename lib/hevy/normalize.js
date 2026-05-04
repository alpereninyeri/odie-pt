// Hevy workout objesi -> OdiePt session shape.
// Hevy structured data verir; type'i egzersiz adlarindan tahmin ediyoruz.
// Coach yorumu ayri bir pipeline'da uretilir, burada sadece veri normalize.

const PUSH_KEYWORDS = [
  'bench', 'press', 'push', 'dip', 'tricep',
  'overhead', 'pec deck', 'fly', 'lateral raise', 'front raise',
  'incline', 'decline', 'shoulder press', 'military',
]
const PULL_KEYWORDS = [
  'row', 'pull-up', 'pullup', 'pull up', 'curl', 'lat ',
  'face pull', 'chin', 'pulldown', 'shrug', 'rear delt',
  'reverse fly', 'deadlift', 'rdl', 'pull',
]
const LEGS_KEYWORDS = [
  'squat', 'lunge', 'leg ', 'calf', 'hip thrust',
  'glute', 'hamstring', 'quad', 'step up', 'split squat',
  'good morning', 'sled',
]
const CARDIO_KEYWORDS = [
  'run', 'kosu', 'koşu', 'walk', 'yuru', 'yürü',
  'bike', 'bisiklet', 'cycle', 'rowing', 'erg',
  'elliptical', 'stair', 'treadmill',
]
const CORE_KEYWORDS = [
  'crunch', 'plank', 'russian', 'leg raise',
  'sit up', 'situp', 'hollow', 'core', 'ab wheel',
]

function lc(value) {
  return String(value || '').toLocaleLowerCase('en-US')
}

function classifyExercise(name) {
  const n = lc(name)
  if (!n) return null
  // Sira onemli: "Leg Press" -> Push'a kaymasin diye legs once, sonra cardio,
  // sonra core, sonra pull/push (en jenerik kelimeler).
  if (LEGS_KEYWORDS.some(k => n.includes(k))) return 'Bacak'
  if (CARDIO_KEYWORDS.some(k => n.includes(k))) return 'Koşu'
  if (CORE_KEYWORDS.some(k => n.includes(k))) return 'Custom'
  if (PULL_KEYWORDS.some(k => n.includes(k))) return 'Pull'
  if (PUSH_KEYWORDS.some(k => n.includes(k))) return 'Push'
  return null
}

function inferType(exercises) {
  const tally = { Push: 0, Pull: 0, Bacak: 0, Koşu: 0 }
  for (const ex of exercises || []) {
    const tag = classifyExercise(ex.title)
    if (tag && tally[tag] !== undefined) {
      tally[tag] += (ex.sets?.length || 1)
    }
  }
  let best = null
  let max = 0
  for (const [k, v] of Object.entries(tally)) {
    if (v > max) {
      max = v
      best = k
    }
  }
  return best || 'Gym'
}

function tagsFromExercises(exercises) {
  const tags = new Set(['hevy'])
  for (const ex of exercises || []) {
    const cls = classifyExercise(ex.title)
    if (cls === 'Push') tags.add('push')
    if (cls === 'Pull') tags.add('pull')
    if (cls === 'Bacak') tags.add('legs')
    if (cls === 'Koşu') tags.add('endurance')
    if (CORE_KEYWORDS.some(k => lc(ex.title).includes(k))) tags.add('core')
  }
  return [...tags]
}

function toOdieExercises(hevyExercises = []) {
  return (hevyExercises || []).map(ex => ({
    name: ex.title || '(?)',
    sets: (ex.sets || []).map(set => ({
      reps: set.reps ?? null,
      weightKg: Number(set.weight_kg) || 0,
      durationSec: set.duration_seconds ?? null,
      distanceMeters: Number(set.distance_meters) || (Number(set.distance_km) ? Number(set.distance_km) * 1000 : 0),
      note: set.notes || '',
    })),
  }))
}

function totalsOf(exercises) {
  let sets = 0
  let volumeKg = 0
  let distanceM = 0
  for (const ex of exercises) {
    for (const s of ex.sets || []) {
      sets += 1
      volumeKg += (Number(s.weightKg) || 0) * (Number(s.reps) || 0)
    }
  }
  for (const ex of exercises) {
    for (const s of ex.sets || []) {
      const m = Number(s.distanceMeters ?? s.distance_meters)
      if (Number.isFinite(m)) distanceM += m
    }
  }
  return { sets, volumeKg, distanceKm: distanceM ? distanceM / 1000 : 0 }
}

function compactNumber(value, digits = 1) {
  const numeric = Number(value) || 0
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(digits).replace(/\.0+$/, '')
}

function totalDurationSec(sets = []) {
  return (sets || []).reduce((sum, set) => sum + (Number(set.durationSec) || 0), 0)
}

function totalDistanceMeters(sets = []) {
  return (sets || []).reduce((sum, set) => sum + (Number(set.distanceMeters) || 0), 0)
}

function summarizeExercise(exercise = {}) {
  const sets = exercise.sets || []
  const setCount = sets.length
  const maxWeight = Math.max(0, ...sets.map(set => Number(set.weightKg) || 0))
  const maxReps = Math.max(0, ...sets.map(set => Number(set.reps) || 0))
  const durationSec = totalDurationSec(sets)
  const distanceMeters = totalDistanceMeters(sets)
  const parts = []

  if (setCount) parts.push(`${setCount} set`)
  if (maxWeight) parts.push(`${compactNumber(maxWeight)}kg`)
  if (maxReps) parts.push(`${maxReps} rep`)
  if (durationSec) parts.push(`${Math.round(durationSec / 60)}dk`)
  if (distanceMeters) parts.push(`${compactNumber(distanceMeters / 1000)}km`)

  return `${exercise.name}: ${parts.join(' / ') || 'detay var'}`
}

function blockKindForClass(className) {
  if (className === 'Push' || className === 'Pull' || className === 'Bacak') return 'strength'
  if (className === 'Custom') return 'core'
  if (className === 'KoÅŸu') return 'locomotion'
  return 'mixed'
}

function buildHevySignals(exercises = [], totals = {}, meta = {}) {
  const evidence = []
  const facts = []
  const tags = meta.tags || []
  const summaryParts = [
    totals.sets ? `${totals.sets} set` : null,
    totals.volumeKg ? `${Math.round(totals.volumeKg).toLocaleString('tr-TR')}kg` : null,
    meta.durationMin ? `${meta.durationMin}dk` : null,
    totals.distanceKm ? `${compactNumber(totals.distanceKm)}km` : null,
  ].filter(Boolean)

  if (summaryParts.length) {
    const raw = `Hevy toplam: ${summaryParts.join(' / ')}`
    evidence.push(raw)
    facts.push({
      kind: 'summary',
      raw,
      label: 'Hevy toplam',
      durationMin: meta.durationMin || 0,
      distanceKm: totals.distanceKm || 0,
      blockKind: totals.distanceKm ? 'locomotion' : 'mixed',
      signals: ['hevy', 'summary'],
      tags,
    })
  }

  for (const exercise of exercises.slice(0, 12)) {
    const className = classifyExercise(exercise.name)
    const raw = summarizeExercise(exercise)
    evidence.push(raw)
    facts.push({
      kind: 'exercise',
      raw,
      label: exercise.name,
      durationMin: Math.round(totalDurationSec(exercise.sets || []) / 60),
      distanceKm: Math.round((totalDistanceMeters(exercise.sets || []) / 1000) * 100) / 100,
      blockKind: blockKindForClass(className),
      signals: [className, 'hevy'].filter(Boolean),
      tags,
    })
  }

  const score = Math.max(35, Math.min(95,
    52
    + (exercises.length * 5)
    + Math.min(20, (totals.sets || 0) * 1.4)
    + (meta.durationMin ? 8 : 0)
    + (totals.volumeKg || totals.distanceKm ? 8 : 0)
  ))

  const reasons = [
    exercises.length ? `${exercises.length} hareket` : null,
    totals.sets ? `${totals.sets} set` : null,
    totals.volumeKg ? `${Math.round(totals.volumeKg).toLocaleString('tr-TR')}kg hacim` : null,
    totals.distanceKm ? `${compactNumber(totals.distanceKm)}km mesafe` : null,
  ].filter(Boolean)

  return {
    evidence: evidence.slice(0, 10),
    facts,
    confidence: {
      score: Math.round(score),
      level: score >= 72 ? 'high' : score >= 52 ? 'medium' : 'low',
      reasons,
    },
  }
}

function durationMinFrom(workout) {
  const start = Date.parse(workout.start_time)
  const end = Date.parse(workout.end_time)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.round((end - start) / 60000))
}

function dateFrom(workout) {
  const source = workout.start_time || workout.created_at
  const d = source ? new Date(source) : new Date()
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export function normalizeHevyWorkout(workout) {
  if (!workout || !workout.id) {
    throw new Error('normalizeHevyWorkout: workout veya id eksik')
  }
  const odieExercises = toOdieExercises(workout.exercises || [])
  const { sets, volumeKg, distanceKm } = totalsOf(odieExercises)
  const durationMin = durationMinFrom(workout)
  const type = inferType(workout.exercises || [])
  const highlight = String(workout.title || '').slice(0, 80)
  const notes = String(workout.description || '').slice(0, 500)
  const tags = tagsFromExercises(workout.exercises || [])
  const signals = buildHevySignals(odieExercises, { sets, volumeKg, distanceKm }, { durationMin, tags })

  return {
    date: dateFrom(workout),
    type,
    durationMin,
    distanceKm,
    elevationM: 0,
    tags,
    exercises: odieExercises,
    volumeKg,
    sets,
    highlight,
    notes,
    evidence: signals.evidence,
    facts: signals.facts,
    confidence: signals.confidence,
    hasPr: false,
    source: 'hevy',
    createdAt: workout.created_at || new Date().toISOString(),
    externalSource: 'hevy',
    externalId: String(workout.id),
    rawExternal: workout,
    startedAt: workout.start_time || null,
  }
}
