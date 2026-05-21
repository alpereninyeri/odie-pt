import { getLocalDateString, normalizeDateString, normalizeText } from './rules.js'
import { normalizeAppleHealthPayload } from './apple-health.js'

export const HEALTH_IMPORT_KINDS = ['workout', 'activity_day', 'sleep', 'heart', 'body_metric']

const METRIC_UNITS = {
  steps: 'count',
  walkingDistanceKm: 'km',
  activeEnergyKcal: 'kcal',
  exerciseMinutes: 'min',
  flightsClimbed: 'count',
  standHours: 'h',
  totalSleepHours: 'h',
  deepSleepHours: 'h',
  remSleepHours: 'h',
  coreSleepHours: 'h',
  awakeMinutes: 'min',
  sleepEfficiency: 'pct',
  restingHeartRate: 'bpm',
  avgHeartRate: 'bpm',
  maxHeartRate: 'bpm',
  walkingHeartRateAverage: 'bpm',
  hrvSdnn: 'ms',
  heartRateRecoveryOneMinute: 'bpm',
  weightKg: 'kg',
  bodyFatPct: 'pct',
  workoutDistanceKm: 'km',
  workoutDurationMin: 'min',
  workoutActiveEnergyKcal: 'kcal',
  workoutElevationM: 'm',
  workoutAvgHeartRate: 'bpm',
  workoutMaxHeartRate: 'bpm',
}

function round(value, digits = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const factor = 10 ** digits
  return Math.round(numeric * factor) / factor
}

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function firstFinite(...values) {
  for (const value of values) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

function toIso(value = '') {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function metricValue(input = {}, keys = [], digits = 1) {
  const value = firstFinite(...keys.map(key => input[key]))
  return value == null ? null : round(value, digits)
}

function resolveKind(input = {}, fallback = '') {
  const raw = normalizeText(input.kind || input.sampleKind || input.sample_kind || fallback || '')
  if (raw.includes('workout') || raw.includes('antrenman')) return 'workout'
  if (raw.includes('sleep') || raw.includes('uyku')) return 'sleep'
  if (raw.includes('heart') || raw.includes('hrv') || raw.includes('nabiz') || raw.includes('kalp')) return 'heart'
  if (raw.includes('body') || raw.includes('metric') || raw.includes('kilo')) return 'body_metric'
  if (raw.includes('activity') || raw.includes('day') || raw.includes('adim') || raw.includes('hareket')) return 'activity_day'
  if (input.activityType || input.startAt || input.durationMin || input.distanceKm) return 'workout'
  return fallback || 'activity_day'
}

function resolveDay(input = {}, startAt = null, now = new Date()) {
  return normalizeDateString(
    input.day || input.date || input.startDate || input.start_at || input.startAt || startAt,
    getLocalDateString(now),
  )
}

function externalIdFor(input = {}, { kind, metricType, day, startAt, value }) {
  const explicit = input.externalId || input.external_id || input.id || input.uuid
  if (explicit) return `${explicit}:${metricType}`
  const source = normalizeText(input.source || input.externalSource || input.external_source || 'apple_health')
  const anchor = startAt || day
  return `${source}:${kind}:${metricType}:${anchor}:${value ?? 0}`
}

function makeTelemetryRow(input = {}, context = {}, metricType, value, unit = METRIC_UNITS[metricType] || '') {
  if (value == null || Number.isNaN(Number(value))) return null
  const day = context.day || resolveDay(input, context.startAt, context.now)
  const startAt = context.startAt || toIso(input.startAt || input.start_at || input.startDate || input.start_date)
  const endAt = context.endAt || toIso(input.endAt || input.end_at || input.endDate || input.end_date)
  const kind = context.kind || resolveKind(input)
  return {
    source: 'apple_health',
    externalSource: input.externalSource || input.external_source || 'apple_health_shortcut',
    externalId: externalIdFor(input, { kind, metricType, day, startAt, value }),
    kind,
    metricType,
    day,
    startAt,
    endAt,
    valueNum: Number(value),
    unit,
    confidence: Number(input.confidence) || 0.86,
    valueJson: {},
    raw: input,
  }
}

function rowsFromMetrics(input = {}, context = {}, metrics = {}) {
  return Object.entries(metrics)
    .map(([metricType, value]) => makeTelemetryRow(input, context, metricType, value))
    .filter(Boolean)
}

export function normalizeActivityDaySample(input = {}, { now = new Date() } = {}) {
  const kind = 'activity_day'
  const day = resolveDay(input, null, now)
  const metrics = {
    steps: metricValue(input, ['steps', 'stepCount', 'step_count'], 0),
    walkingDistanceKm: metricValue(input, ['walkingDistanceKm', 'walking_distance_km', 'distanceWalkingRunningKm', 'distanceKm'], 2),
    activeEnergyKcal: metricValue(input, ['activeEnergyKcal', 'active_energy_kcal', 'calories', 'kcal'], 0),
    exerciseMinutes: metricValue(input, ['exerciseMinutes', 'exercise_minutes', 'appleExerciseTime', 'workoutMinutes'], 0),
    flightsClimbed: metricValue(input, ['flightsClimbed', 'flights_climbed', 'flights'], 0),
    standHours: metricValue(input, ['standHours', 'stand_hours'], 1),
  }
  return rowsFromMetrics(input, { kind, day, now }, metrics)
}

export function normalizeSleepSample(input = {}, { now = new Date() } = {}) {
  const kind = 'sleep'
  const startAt = toIso(input.startAt || input.start_at || input.sleepStartAt || input.sleep_start_at)
  const endAt = toIso(input.endAt || input.end_at || input.sleepEndAt || input.sleep_end_at)
  const day = normalizeDateString(input.day || input.date || input.sleepDay || input.sleep_day || endAt || startAt, getLocalDateString(now))
  const totalSleepHours = metricValue(input, ['totalSleepHours', 'total_sleep_hours', 'asleepHours', 'sleepHours'], 2)
  const awakeMinutes = metricValue(input, ['awakeMinutes', 'awake_minutes'], 0)
  const inBedHours = metricValue(input, ['inBedHours', 'in_bed_hours'], 2)
  const computedEfficiency = totalSleepHours && inBedHours
    ? clamp(Math.round((totalSleepHours / Math.max(totalSleepHours, inBedHours)) * 100), 0, 100)
    : totalSleepHours && awakeMinutes != null
      ? clamp(Math.round((totalSleepHours / (totalSleepHours + (awakeMinutes / 60))) * 100), 0, 100)
      : null
  const metrics = {
    totalSleepHours,
    deepSleepHours: metricValue(input, ['deepSleepHours', 'deep_sleep_hours'], 2),
    remSleepHours: metricValue(input, ['remSleepHours', 'rem_sleep_hours'], 2),
    coreSleepHours: metricValue(input, ['coreSleepHours', 'core_sleep_hours'], 2),
    awakeMinutes,
    sleepEfficiency: metricValue(input, ['sleepEfficiency', 'sleep_efficiency'], 0) ?? computedEfficiency,
  }
  return rowsFromMetrics(input, { kind, day, startAt, endAt, now }, metrics)
}

export function normalizeHeartSample(input = {}, { now = new Date() } = {}) {
  const kind = 'heart'
  const startAt = toIso(input.startAt || input.start_at || input.date)
  const endAt = toIso(input.endAt || input.end_at)
  const day = resolveDay(input, startAt, now)
  const metrics = {
    restingHeartRate: metricValue(input, ['restingHeartRate', 'resting_heart_rate', 'rhr'], 0),
    avgHeartRate: metricValue(input, ['avgHeartRate', 'avg_heart_rate', 'heartRateAvg'], 0),
    maxHeartRate: metricValue(input, ['maxHeartRate', 'max_heart_rate', 'heartRateMax'], 0),
    walkingHeartRateAverage: metricValue(input, ['walkingHeartRateAverage', 'walking_heart_rate_average'], 0),
    hrvSdnn: metricValue(input, ['hrvSdnn', 'hrv_sdnn', 'heartRateVariabilitySdnn', 'heart_rate_variability_sdnn'], 0),
    heartRateRecoveryOneMinute: metricValue(input, ['heartRateRecoveryOneMinute', 'heart_rate_recovery_one_minute', 'hrRecoveryOneMinute'], 0),
  }
  return rowsFromMetrics(input, { kind, day, startAt, endAt, now }, metrics)
}

export function normalizeBodyMetricSample(input = {}, { now = new Date() } = {}) {
  const kind = 'body_metric'
  const day = resolveDay(input, null, now)
  const metrics = {
    weightKg: metricValue(input, ['weightKg', 'weight_kg'], 1),
    bodyFatPct: metricValue(input, ['bodyFatPct', 'body_fat_pct', 'bodyFatPercentage'], 1),
  }
  return rowsFromMetrics(input, { kind, day, now }, metrics)
}

export function normalizeWorkoutTelemetry(input = {}, { now = new Date() } = {}) {
  const workout = normalizeAppleHealthPayload(input, { now })
  const day = workout.date
  const context = {
    kind: 'workout',
    day,
    startAt: workout.startedAt,
    endAt: workout.healthMetrics?.endAt || null,
    now,
  }
  const metrics = {
    workoutDistanceKm: workout.distanceKm || null,
    workoutDurationMin: workout.durationMin || null,
    workoutActiveEnergyKcal: workout.healthMetrics?.activeEnergyKcal || null,
    workoutElevationM: workout.elevationM || null,
    workoutAvgHeartRate: workout.healthMetrics?.avgHeartRate || null,
    workoutMaxHeartRate: metricValue(input, ['maxHeartRate', 'max_heart_rate', 'heartRateMax'], 0),
    heartRateRecoveryOneMinute: metricValue(input, ['heartRateRecoveryOneMinute', 'heart_rate_recovery_one_minute'], 0),
  }
  return {
    workout,
    telemetry: rowsFromMetrics(input, context, metrics),
  }
}

export function normalizeHealthImportPayload(input = {}, { now = new Date() } = {}) {
  const rootKind = resolveKind(input, '')
  const rawSamples = Array.isArray(input.samples)
    ? input.samples
    : Array.isArray(input.data)
      ? input.data
      : [input]

  const workouts = []
  const telemetry = []

  for (const raw of rawSamples) {
    const sample = rootKind && raw !== input ? { kind: rootKind, ...raw } : raw
    const kind = resolveKind(sample, rootKind)
    if (kind === 'workout') {
      const normalized = normalizeWorkoutTelemetry(sample, { now })
      workouts.push(normalized.workout)
      telemetry.push(...normalized.telemetry)
    } else if (kind === 'sleep') {
      telemetry.push(...normalizeSleepSample(sample, { now }))
    } else if (kind === 'heart') {
      telemetry.push(...normalizeHeartSample(sample, { now }))
    } else if (kind === 'body_metric') {
      telemetry.push(...normalizeBodyMetricSample(sample, { now }))
    } else {
      telemetry.push(...normalizeActivityDaySample(sample, { now }))
    }
  }

  return {
    source: 'apple_health',
    receivedKinds: [...new Set([
      ...workouts.map(() => 'workout'),
      ...telemetry.map(row => row.kind),
    ])],
    workouts,
    telemetry,
    days: [...new Set(telemetry.map(row => row.day).filter(Boolean))],
  }
}

function scoreSleep(summary = {}) {
  const sleep = Number(summary.totalSleepHours ?? summary.sleepHours) || 0
  if (!sleep) return null
  let score = sleep >= 8 ? 94 : sleep >= 7.2 ? 86 : sleep >= 6.5 ? 72 : sleep >= 5.5 ? 52 : 32
  const efficiency = Number(summary.sleepEfficiency) || 0
  if (efficiency >= 88) score += 4
  else if (efficiency && efficiency < 75) score -= 8
  return clamp(score)
}

function scoreMovement(summary = {}) {
  const steps = Number(summary.steps) || 0
  const exercise = Number(summary.exerciseMinutes) || 0
  const distance = Number(summary.walkingDistanceKm ?? summary.distanceKm) || 0
  const kcal = Number(summary.activeEnergyKcal) || 0
  if (!steps && !exercise && !distance && !kcal) return null
  return clamp(Math.round(
    Math.min(58, (steps / 10000) * 58)
    + Math.min(22, (exercise / 45) * 22)
    + Math.min(12, (distance / 8) * 12)
    + Math.min(8, (kcal / 650) * 8)
  ))
}

function scoreHeart(summary = {}) {
  const hrv = Number(summary.hrvSdnn) || 0
  const rhr = Number(summary.restingHeartRate) || 0
  const walking = Number(summary.walkingHeartRateAverage) || 0
  if (!hrv && !rhr && !walking) return null
  let score = 62
  if (hrv >= 65) score += 20
  else if (hrv >= 45) score += 10
  else if (hrv && hrv < 30) score -= 18
  else if (hrv && hrv < 40) score -= 8

  if (rhr && rhr <= 55) score += 12
  else if (rhr && rhr <= 64) score += 5
  else if (rhr >= 78) score -= 18
  else if (rhr >= 70) score -= 8

  if (walking && walking >= 118) score -= 5
  return clamp(score)
}

function scoreStrain(summary = {}) {
  const steps = Number(summary.steps) || 0
  const distance = Number(summary.walkingDistanceKm ?? summary.distanceKm) || 0
  const exercise = Number(summary.exerciseMinutes) || 0
  const workoutMinutes = Number(summary.workoutDurationMin) || 0
  const workoutDistance = Number(summary.workoutDistanceKm) || 0
  const activeKcal = Number(summary.activeEnergyKcal ?? summary.workoutActiveEnergyKcal) || 0
  if (!steps && !distance && !exercise && !workoutMinutes && !workoutDistance && !activeKcal) return null
  return clamp(Math.round(
    Math.min(30, (steps / 14000) * 30)
    + Math.min(18, (distance / 12) * 18)
    + Math.min(18, (exercise / 60) * 18)
    + Math.min(22, (workoutMinutes / 120) * 22)
    + Math.min(12, (activeKcal / 900) * 12)
  ))
}

export function buildHealthDailySummary(metrics = {}, { day = getLocalDateString() } = {}) {
  const sleepScore = scoreSleep(metrics)
  const movementScore = scoreMovement(metrics)
  const heartScore = scoreHeart(metrics)
  const strainScore = scoreStrain(metrics)
  const recoveryParts = [
    sleepScore != null ? { value: sleepScore, weight: 0.45 } : null,
    heartScore != null ? { value: heartScore, weight: 0.35 } : null,
    strainScore != null ? { value: 100 - strainScore, weight: 0.2 } : null,
  ].filter(Boolean)
  const recoveryScore = recoveryParts.length
    ? clamp(Math.round(
      recoveryParts.reduce((sum, part) => sum + (part.value * part.weight), 0)
      / recoveryParts.reduce((sum, part) => sum + part.weight, 0),
    ))
    : null
  const present = [
    Number(metrics.totalSleepHours ?? metrics.sleepHours) > 0,
    Number(metrics.steps) > 0 || Number(metrics.exerciseMinutes) > 0,
    Number(metrics.hrvSdnn) > 0 || Number(metrics.restingHeartRate) > 0,
    Number(metrics.workoutDurationMin) > 0 || Number(metrics.workoutDistanceKm) > 0,
  ].filter(Boolean).length
  return {
    day,
    sleepScore,
    movementScore,
    heartScore,
    recoveryScore,
    strainScore,
    dataConfidence: Math.round((present / 4) * 100),
    ...metrics,
  }
}

export function mergeTelemetryIntoSummary(rows = [], existing = {}, day = getLocalDateString()) {
  const metrics = { ...(existing || {}) }
  for (const row of rows.filter(item => item.day === day)) {
    metrics[row.metricType] = row.valueNum
  }
  return buildHealthDailySummary(metrics, { day })
}

export function summaryToDailyLog(summary = {}) {
  return {
    date: summary.day,
    sleepHours: Number(summary.totalSleepHours ?? summary.sleepHours) || 0,
    steps: Math.round(Number(summary.steps) || 0),
    activeEnergyKcal: Math.round(Number(summary.activeEnergyKcal) || 0),
    restingHeartRate: Math.round(Number(summary.restingHeartRate) || 0),
    hrvSdnn: Math.round(Number(summary.hrvSdnn) || 0),
    dataConfidence: Math.round(Number(summary.dataConfidence) || 0),
  }
}
