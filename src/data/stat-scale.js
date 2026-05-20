import { countCoreSets, normalizeDateString, normalizeSession, STAT_KEYS } from './rules.js'

export const LIKERT_RESPONSE_LABELS = ['yok', 'zayif', 'gelisiyor', 'orta', 'iyi', 'guclu', 'cok guclu']

export const STAT_CALIBRATION_QUESTIONS = [
  { id: 'str-load', stat: 'str', prompt: 'Agirlik veya vucut agirligi hareketlerinde kuvvet tabanin nasil?' },
  { id: 'str-progress', stat: 'str', prompt: 'Son donemde kuvvet hareketlerinde ilerleme hissin nasil?' },
  { id: 'str-control', stat: 'str', prompt: 'Zor setlerde formu koruma guvenin nasil?' },
  { id: 'agi-speed', stat: 'agi', prompt: 'Yon degistirme ve hizli hareketlerde kendini nasil goruyorsun?' },
  { id: 'agi-landing', stat: 'agi', prompt: 'Ziplama, inis ve patlayici gecislerin ne kadar hazir?' },
  { id: 'agi-flow', stat: 'agi', prompt: 'Parkour/akrobasi akisi icinde ritim ve akicilik nasil?' },
  { id: 'end-base', stat: 'end', prompt: 'Uzun sureli eforda nefes ve tempo tabanin nasil?' },
  { id: 'end-repeat', stat: 'end', prompt: 'Hafta icinde tekrar tekrar hareket etme kapasiten nasil?' },
  { id: 'end-outdoor', stat: 'end', prompt: 'Yuruyus, kosu, bisiklet veya outdoor dayanimi nasil?' },
  { id: 'dex-balance', stat: 'dex', prompt: 'Denge, zamanlama ve koordinasyon kontrolun nasil?' },
  { id: 'dex-skill', stat: 'dex', prompt: 'Yeni teknikleri temiz ogrenme ve tekrar etme hissin nasil?' },
  { id: 'dex-grip', stat: 'dex', prompt: 'Tutus, bar kontrolu ve ince motor guvenin nasil?' },
  { id: 'con-tension', stat: 'con', prompt: 'Hollow, plank, L-sit gibi core tansiyonun nasil?' },
  { id: 'con-transfer', stat: 'con', prompt: 'Core kontrolunun flip, bar ve agirlik hareketlerine transferi nasil?' },
  { id: 'con-consistency', stat: 'con', prompt: 'Core calismasini programa tutarli koyma seviyen nasil?' },
  { id: 'sta-session', stat: 'sta', prompt: 'Tek seansi dusmeden bitirme enerjin nasil?' },
  { id: 'sta-recovery', stat: 'sta', prompt: 'Yorgunken bile kaliteli tekrar uretebilme durumun nasil?' },
  { id: 'sta-week', stat: 'sta', prompt: 'Haftalik toplam yuk ve ritim tasima kapasiten nasil?' },
]

const RANKS = [
  { rank: 'F', label: 'Kapali', min: 0, next: 25 },
  { rank: 'D', label: 'Baslangic', min: 25, next: 40 },
  { rank: 'C', label: 'Kuruluyor', min: 40, next: 55 },
  { rank: 'B', label: 'Stabil', min: 55, next: 72 },
  { rank: 'A', label: 'Guclu', min: 72, next: 88 },
  { rank: 'S', label: 'Kanitli elit', min: 88, next: 100 },
]

const DEFAULT_EVIDENCE = {
  sampleSize: 0,
  activeDays: 0,
  strengthSessions: 0,
  movementSessions: 0,
  enduranceSessions: 0,
  coreSessions: 0,
  parkourSessions: 0,
  balanceExplosiveSessions: 0,
  totalMinutes: 0,
  totalVolumeKg: 0,
  coreSets: 0,
  prSignals: 0,
}

function _number(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function _rankForScore(score, canUseS = false) {
  const safe = Math.max(0, Math.min(100, _number(score)))
  if (safe >= 88 && !canUseS) return RANKS[4]
  return [...RANKS].reverse().find(rank => safe >= rank.min) || RANKS[0]
}

function _progressWithinRank(score, rankInfo) {
  const min = rankInfo?.min ?? 0
  const next = rankInfo?.next ?? 100
  if (next <= min) return 100
  return Math.max(0, Math.min(100, Math.round(((_number(score) - min) / (next - min)) * 100)))
}

function _hasTag(session, tag) {
  return Array.isArray(session.tags) && session.tags.includes(tag)
}

function _hasBlockKind(session, kinds = []) {
  return Array.isArray(session.blocks) && session.blocks.some(block => kinds.includes(block.kind))
}

export function normalizeStatCalibration(calibration = {}) {
  const answers = calibration?.answers && typeof calibration.answers === 'object' ? calibration.answers : {}
  const safeAnswers = {}
  for (const question of STAT_CALIBRATION_QUESTIONS) {
    const value = Math.round(_number(answers[question.id], 0))
    if (value >= 1 && value <= 7) safeAnswers[question.id] = value
  }

  return {
    completedAt: calibration?.completedAt || calibration?.completed_at || null,
    version: Number(calibration?.version) || 1,
    answers: safeAnswers,
  }
}

export function computeCalibrationScores(calibration = {}) {
  const normalized = normalizeStatCalibration(calibration)
  const grouped = Object.fromEntries(STAT_KEYS.map(key => [key, []]))
  for (const question of STAT_CALIBRATION_QUESTIONS) {
    const value = normalized.answers[question.id]
    if (value) grouped[question.stat].push(value)
  }

  return Object.fromEntries(STAT_KEYS.map(key => {
    const values = grouped[key] || []
    if (!values.length) return [key, null]
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    return [key, Math.round((((avg - 1) / 6) * 100) * 10) / 10]
  }))
}

export function computeStatEvidence(workouts = []) {
  const evidence = { ...DEFAULT_EVIDENCE }
  const activeDates = new Set()

  for (const rawWorkout of workouts || []) {
    const workout = normalizeSession(rawWorkout)
    const tags = new Set(workout.tags || [])
    activeDates.add(normalizeDateString(workout.date))
    evidence.sampleSize += 1
    evidence.totalMinutes += _number(workout.durationMin)
    evidence.totalVolumeKg += _number(workout.volumeKg)
    evidence.coreSets += countCoreSets(workout)
    if (workout.hasPr || workout.has_pr || tags.has('pr')) evidence.prSignals += 1

    if (workout.primaryCategory === 'strength' || _hasBlockKind(workout, ['strength'])) evidence.strengthSessions += 1
    if (workout.primaryCategory === 'movement' || _hasBlockKind(workout, ['skill', 'explosive'])) evidence.movementSessions += 1
    if (workout.primaryCategory === 'endurance' || _hasBlockKind(workout, ['locomotion'])) evidence.enduranceSessions += 1
    if (_hasBlockKind(workout, ['core']) || countCoreSets(workout) > 0 || tags.has('core')) evidence.coreSessions += 1
    if (tags.has('parkour') || tags.has('acrobatics')) evidence.parkourSessions += 1
    if (tags.has('balance') || tags.has('explosive') || tags.has('grip') || _hasBlockKind(workout, ['skill', 'explosive'])) {
      evidence.balanceExplosiveSessions += 1
    }
  }

  evidence.activeDays = activeDates.size
  return evidence
}

export function canUnlockSRank(key, evidence = DEFAULT_EVIDENCE) {
  switch (key) {
    case 'str':
      return evidence.strengthSessions >= 12 && (evidence.prSignals >= 1 || evidence.totalVolumeKg >= 50000)
    case 'agi':
    case 'dex':
      return evidence.movementSessions >= 8 && (evidence.parkourSessions >= 4 || evidence.balanceExplosiveSessions >= 8)
    case 'end':
    case 'sta':
      return evidence.enduranceSessions >= 8 && (evidence.totalMinutes >= 600 || evidence.activeDays >= 16)
    case 'con':
      return evidence.coreSessions >= 8 && evidence.coreSets >= 36
    default:
      return false
  }
}

export function calibrationWeight(sampleSize = 0, hasCalibration = false) {
  if (!hasCalibration) return 0
  return Math.max(0, Math.min(0.15, 0.15 * (1 - (_number(sampleSize) / 30))))
}

export function confidenceForStat(key, evidence = DEFAULT_EVIDENCE, calibration = {}) {
  const hasCalibration = Object.keys(normalizeStatCalibration(calibration).answers || {}).length > 0
  if (!evidence.sampleSize && !hasCalibration) return 'seed'
  if (evidence.sampleSize >= 30) return 'high'
  if (evidence.sampleSize >= 15) return 'medium'
  if (evidence.sampleSize >= 5 || hasCalibration) return 'low'
  return 'seed'
}

export function computeStatScale(key, rawScore = 0, context = {}) {
  const evidence = context.evidence || computeStatEvidence(context.workouts || [])
  const calibration = normalizeStatCalibration(context.calibration || {})
  const calibrationScores = context.calibrationScores || computeCalibrationScores(calibration)
  const calibrationScore = calibrationScores[key]
  const weight = calibrationWeight(evidence.sampleSize, calibrationScore != null)
  const raw = Math.max(0, Math.min(100, Math.round(_number(rawScore) * 10) / 10))
  const scaleScore = calibrationScore == null
    ? raw
    : Math.round(((raw * (1 - weight)) + (calibrationScore * weight)) * 10) / 10
  const sUnlocked = canUnlockSRank(key, evidence)
  const rankInfo = _rankForScore(scaleScore, sUnlocked)

  return {
    rawScore: raw,
    scaleScore,
    rank: rankInfo.rank,
    rankLabel: rankInfo.label,
    confidence: confidenceForStat(key, evidence, calibration),
    progressToNext: _progressWithinRank(scaleScore, rankInfo),
    sUnlocked,
    calibrationWeight: Math.round(weight * 100),
  }
}

export function attachStatScales(stats = [], context = {}) {
  const evidence = context.evidence || computeStatEvidence(context.workouts || [])
  const calibration = normalizeStatCalibration(context.calibration || {})
  const calibrationScores = computeCalibrationScores(calibration)

  return (stats || []).map(stat => {
    const key = stat.key
    const scale = computeStatScale(key, stat.val, { evidence, calibration, calibrationScores })
    return {
      ...stat,
      rawVal: scale.rawScore,
      scaleScore: scale.scaleScore,
      rank: scale.rank,
      rankLabel: scale.rankLabel,
      confidence: scale.confidence,
      progressToNext: scale.progressToNext,
      sUnlocked: scale.sUnlocked,
      calibrationWeight: scale.calibrationWeight,
    }
  })
}
