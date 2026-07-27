// Hevy workout objesi -> OdiePt session shape.
// Hevy structured data verir; type'i egzersiz adlarindan tahmin ediyoruz.
// Coach yorumu ayri bir pipeline'da uretilir, burada sadece veri normalize.

import { normalizeDateString } from '../../src/data/rules.js'
import {
  ONTOLOGY_CONCEPTS,
  deriveTagsFromSignals,
  normalizeOntologyText,
} from '../../src/data/sports-ontology.js'

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
  'glute', 'hamstring', 'quad', 'hip abduction', 'hip adduction',
  'abductor', 'adductor', 'step up', 'split squat',
  'good morning', 'sled',
]
const CARDIO_KEYWORDS = [
  'run', 'kosu', 'koşu', 'walk', 'yuru', 'yürü',
  'running', 'walking', 'yuruyus', 'yurume',
  'bike', 'bisiklet', 'cycle', 'cycling', 'rowing', 'erg',
  'elliptical', 'stair', 'treadmill',
]
const CORE_KEYWORDS = [
  'crunch', 'plank', 'russian', 'leg raise',
  'sit up', 'situp', 'hollow', 'core', 'ab wheel',
]
const ONTOLOGY_TYPE_MAP = {
  Push: 'Push',
  Pull: 'Pull',
  Bacak: 'Bacak',
  Shoulder: 'Push',
  Parkour: 'Parkour',
  Akrobasi: 'Akrobasi',
  Calisthenics: 'Calisthenics',
  Yuruyus: 'Yürüyüş',
  Kosu: 'Koşu',
  Bisiklet: 'Bisiklet',
  Kayak: 'Kayak',
  Tirmanis: 'Tırmanış',
  Stretching: 'Stretching',
}
const SPECIALTY_TYPE_TAGS = {
  Parkour: ['parkour', 'legs', 'balance'],
  Akrobasi: ['acrobatics', 'balance'],
  Calisthenics: ['calisthenics'],
  Yürüyüş: ['walking', 'endurance', 'recovery'],
  Koşu: ['running', 'legs', 'endurance'],
  Bisiklet: ['cycling', 'legs', 'endurance'],
  Kayak: ['ski', 'legs', 'balance', 'endurance'],
  Tırmanış: ['climbing', 'pull', 'grip'],
  Stretching: ['mobility', 'recovery'],
}
const TITLE_TYPE_PATTERNS = [
  ['Parkour', [
    'parkour', 'freerun', 'freerunning', 'vault antrenmani', 'vault drill',
    'kong vault', 'speed vault', 'lazy vault', 'dash vault', 'precision jump',
    'wall run', 'climb up', 'cat leap', 'tic tac', 'underbar', 'quadrupedal',
  ]],
  ['Akrobasi', ['akrobasi', 'acrobatics', 'tricking']],
  ['Calisthenics', [
    'calisthenics', 'calisthenic', 'kalistenik', 'bodyweight', 'street workout',
    'vucut agirligi', 'front lever', 'back lever', 'planche', 'muscle up',
    'handstand', 'l-sit', 'lsit', 'human flag',
  ]],
  ['Tırmanış', ['tirmanis', 'tirmanisi', 'tirmanma', 'climb', 'climbing', 'boulder', 'bouldering', 'fingerboard']],
  ['Yürüyüş', ['yuruyus', 'yuruyusu', 'doga yuruyusu', 'dag yuruyusu', 'trail walk', 'hike', 'hiking', 'trek', 'trekking']],
  ['Bisiklet', ['bisiklet', 'cycling', 'bike', 'biking', 'mountain bike', 'mountain biking']],
  ['Kayak', ['kayak', 'skiing']],
  ['Koşu', ['kosu', 'kosusu', 'outdoor run', 'running', 'run', 'jog', 'jogging']],
  ['Bacak', ['bacak', 'leg day', 'legs']],
  ['Pull', ['pull']],
  ['Push', ['push']],
]
const EXERCISE_TYPE_ALIASES = [
  ['Tırmanış', ['tirmanis', 'tirmanisi', 'tirmanma', 'bouldering', 'climbing']],
  ['Yürüyüş', ['yuruyusu', 'doga yuruyusu', 'dag yuruyusu', 'hiking', 'trekking']],
  ['Bisiklet', ['biking', 'mountain biking']],
  ['Koşu', ['kosusu', 'running', 'jogging']],
  ['Calisthenics', ['calisthenics', 'bodyweight', 'street workout']],
]
const SKILL_TITLE_TYPES = new Set(['Parkour', 'Akrobasi', 'Calisthenics', 'Tırmanış'])
const ONTOLOGY_CACHE_LIMIT = 512
const ontologySignalCache = new Map()
const exerciseClassCache = new Map()
const normalizedKeywordGroups = {
  push: PUSH_KEYWORDS.map(normalizeOntologyText),
  pull: PULL_KEYWORDS.map(normalizeOntologyText),
  legs: LEGS_KEYWORDS.map(normalizeOntologyText),
  cardio: CARDIO_KEYWORDS.map(normalizeOntologyText),
  core: CORE_KEYWORDS.map(normalizeOntologyText),
}
const normalizedOntologyConcepts = ONTOLOGY_CONCEPTS.map(concept => ({
  ...concept,
  normalizedPatterns: [...new Set(
    (concept.patterns || []).map(normalizeOntologyText).filter(Boolean),
  )].sort((left, right) => right.length - left.length),
}))

function classifyExercise(name) {
  const n = normalizeOntologyText(String(name || '').slice(0, 256))
  if (!n) return null
  if (exerciseClassCache.has(n)) return exerciseClassCache.get(n)
  // Sira onemli: "Leg Press" -> Push'a kaymasin diye legs once, sonra cardio,
  // sonra core, sonra pull/push (en jenerik kelimeler).
  let result = null
  if (normalizedKeywordGroups.legs.some(keyword => includesBoundedPhrase(n, keyword))) result = 'Bacak'
  else if (normalizedKeywordGroups.cardio.some(keyword => includesBoundedPhrase(n, keyword))) result = 'Koşu'
  else if (normalizedKeywordGroups.core.some(keyword => includesBoundedPhrase(n, keyword))) result = 'Custom'
  else if (normalizedKeywordGroups.pull.some(keyword => includesBoundedPhrase(n, keyword))) result = 'Pull'
  else if (normalizedKeywordGroups.push.some(keyword => includesBoundedPhrase(n, keyword))) result = 'Push'
  setBoundedCache(exerciseClassCache, n, result)
  return result
}

function isWordCharacter(value = '') {
  return /^[a-z0-9]$/i.test(value)
}

function setBoundedCache(cache, key, value) {
  if (cache.size >= ONTOLOGY_CACHE_LIMIT) {
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, value)
}

function includesBoundedPhrase(text = '', phrase = '') {
  if (!text || !phrase) return false
  let index = text.indexOf(phrase)
  while (index >= 0) {
    const before = index > 0 ? text[index - 1] : ''
    const afterIndex = index + phrase.length
    const after = afterIndex < text.length ? text[afterIndex] : ''
    const leftBoundary = !isWordCharacter(phrase[0]) || !isWordCharacter(before)
    const rightBoundary = !isWordCharacter(phrase[phrase.length - 1]) || !isWordCharacter(after)
    if (leftBoundary && rightBoundary) return true
    index = text.indexOf(phrase, index + 1)
  }
  return false
}

function matchedPatternLength(text = '', patterns = []) {
  for (const pattern of patterns) {
    if (includesBoundedPhrase(text, pattern)) return pattern.length
  }
  return 0
}

function detectHevyOntologySignals(input = '') {
  const text = normalizeOntologyText(String(input || '').slice(0, 256))
  if (!text) return []
  if (ontologySignalCache.has(text)) return ontologySignalCache.get(text)

  const signals = normalizedOntologyConcepts
    .map(concept => ({
      concept,
      matchedLength: matchedPatternLength(text, concept.normalizedPatterns),
    }))
    .filter(item => item.matchedLength > 0)
    .map(({ concept, matchedLength }) => ({
      id: concept.id,
      label: concept.label,
      tags: [...(concept.tags || [])],
      blockKind: concept.blockKind,
      typeHint: concept.typeHint,
      score: Number(concept.score) || 0,
      matchedLength,
    }))

  setBoundedCache(ontologySignalCache, text, signals)
  return signals
}

function explicitTypeFromText(input = '', patterns = TITLE_TYPE_PATTERNS) {
  const text = normalizeOntologyText(String(input || '').slice(0, 256))
  if (!text) return null
  const matches = []
  for (const [type, aliases] of patterns) {
    const matchedAlias = aliases
      .filter(alias => includesBoundedPhrase(text, alias))
      .sort((left, right) => right.length - left.length)[0]
    if (matchedAlias) {
      matches.push({ type, length: matchedAlias.length })
    }
  }
  const skillMatch = matches
    .filter(match => SKILL_TITLE_TYPES.has(match.type))
    .sort((left, right) => right.length - left.length)[0]
  if (skillMatch) return skillMatch.type
  const unique = [...new Set(matches.map(match => match.type))]
  return unique.length === 1 ? unique[0] : null
}

function canonicalSignalType(signals = []) {
  const parkourClimbUp = signals.find(signal => signal.id === 'climb_up_pk')
  if (parkourClimbUp) return { type: 'Parkour', signal: parkourClimbUp }

  const ranked = [...signals]
    .filter(signal => ONTOLOGY_TYPE_MAP[signal.typeHint])
    .sort((left, right) => (
      Number(right.matchedLength || 0) - Number(left.matchedLength || 0)
      || Number(right.score || 0) - Number(left.score || 0)
    ))
  const signal = ranked[0]
  return signal
    ? { type: ONTOLOGY_TYPE_MAP[signal.typeHint], signal }
    : null
}

function typeInfoForExercise(exercise = {}, signals = []) {
  const aliasType = explicitTypeFromText(exercise.title, EXERCISE_TYPE_ALIASES)
  if (aliasType) {
    return {
      type: aliasType,
      score: 20,
      specificity: normalizeOntologyText(exercise.title).length,
    }
  }

  const signalType = canonicalSignalType(signals)
  if (!signalType) return null
  return {
    type: signalType.type,
    score: Number(signalType.signal.score) || 0,
    specificity: Number(signalType.signal.matchedLength) || 0,
  }
}

function collectOntologySignals(workout = {}) {
  const titleSignals = detectHevyOntologySignals(workout.title || '')
  const exerciseRows = (workout.exercises || []).map(exercise => {
    const signals = detectHevyOntologySignals(exercise?.title || '')
    return {
      exercise,
      signals,
      typeInfo: typeInfoForExercise(exercise, signals),
    }
  })
  return {
    titleSignals,
    exerciseRows,
    all: [...titleSignals, ...exerciseRows.flatMap(row => row.signals)],
  }
}

function exerciseUnitCount(exercise = {}) {
  return Math.max(1, exercise.sets?.length || 0)
}

function inferType(workout = {}, ontology = collectOntologySignals(workout)) {
  const titleType = explicitTypeFromText(workout.title)
  if (titleType) return titleType

  const candidates = new Map()

  for (const row of ontology.exerciseRows) {
    const type = row.typeInfo?.type || classifyExercise(row.exercise?.title)
    if (!type || type === 'Gym') continue
    const units = exerciseUnitCount(row.exercise)
    const current = candidates.get(type) || {
      type,
      units: 0,
      score: 0,
      specificity: 0,
    }
    current.units += units
    current.score += Number(row.typeInfo?.score || 0) * units
    current.specificity = Math.max(current.specificity, Number(row.typeInfo?.specificity || 0))
    candidates.set(current.type, current)
  }

  const winner = [...candidates.values()]
    .sort((left, right) => (
      right.units - left.units
      || right.specificity - left.specificity
      || right.score - left.score
    ))[0]

  return winner?.type || 'Gym'
}

function tagsFromExercises(exercises, ontology = {}, type = 'Gym') {
  const tags = new Set(['hevy'])
  for (const ex of exercises || []) {
    const cls = classifyExercise(ex.title)
    if (cls === 'Push') tags.add('push')
    if (cls === 'Pull') tags.add('pull')
    if (cls === 'Bacak') tags.add('legs')
    if (cls === 'Koşu') tags.add('endurance')
    if (cls === 'Custom') tags.add('core')
  }

  if (SPECIALTY_TYPE_TAGS[type]) {
    for (const tag of deriveTagsFromSignals(ontology.all || [])) tags.add(tag)
    for (const tag of SPECIALTY_TYPE_TAGS[type] || []) tags.add(tag)
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
  return normalizeDateString(source)
}

export function normalizeHevyWorkout(workout) {
  if (!workout || !workout.id) {
    throw new Error('normalizeHevyWorkout: workout veya id eksik')
  }
  const odieExercises = toOdieExercises(workout.exercises || [])
  const { sets, volumeKg, distanceKm } = totalsOf(odieExercises)
  const durationMin = durationMinFrom(workout)
  const ontology = collectOntologySignals(workout)
  const type = inferType(workout, ontology)
  const highlight = String(workout.title || '').slice(0, 80)
  const notes = String(workout.description || '').slice(0, 500)
  const tags = tagsFromExercises(workout.exercises || [], ontology, type)
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
