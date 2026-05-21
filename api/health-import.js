// POST /api/health-import
// iOS Shortcuts Apple Health bridge. The shortcut sends workout/activity JSON
// with Authorization: Bearer <HEALTH_IMPORT_TOKEN>.

import { recordIngestEvent } from '../lib/hevy/ingest-events.js'
import { ingestNormalizedExternalWorkout, isMissingColumnError, resolveProfile, sbGet, sbUpsert } from '../lib/hevy/persist.js'
import {
  mergeTelemetryIntoSummary,
  normalizeHealthImportPayload,
  summaryToDailyLog,
} from '../src/data/health-telemetry.js'

function providedToken(req) {
  const header = String(req.headers?.authorization || '')
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7)
  return ''
}

export function authorizeHealthImport(req) {
  const expected = process.env.HEALTH_IMPORT_TOKEN
  if (!expected) return { ok: false, status: 500, error: 'HEALTH_IMPORT_TOKEN tanimsiz' }
  if (providedToken(req) !== expected) return { ok: false, status: 401, error: 'unauthorized' }
  return { ok: true }
}

function parseBody(body) {
  if (!body) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  return body
}

function telemetryDbRow(profileId, row = {}) {
  return {
    profile_id: profileId,
    source: row.source || 'apple_health',
    external_source: row.externalSource || row.external_source || 'apple_health_shortcut',
    external_id: row.externalId || row.external_id || '',
    kind: row.kind || 'activity_day',
    metric_type: row.metricType || row.metric_type || '',
    day: row.day,
    start_at: row.startAt || row.start_at || null,
    end_at: row.endAt || row.end_at || null,
    value_num: row.valueNum ?? row.value_num ?? null,
    unit: row.unit || '',
    value_jsonb: row.valueJson || row.value_jsonb || {},
    raw_jsonb: row.raw || row.raw_jsonb || {},
    confidence: Number(row.confidence) || 0.86,
  }
}

function summaryFromRow(row = {}) {
  return {
    day: row.day,
    sleepScore: row.sleep_score,
    movementScore: row.movement_score,
    heartScore: row.heart_score,
    recoveryScore: row.recovery_score,
    strainScore: row.strain_score,
    dataConfidence: row.data_confidence,
    totalSleepHours: row.sleep_hours,
    deepSleepHours: row.deep_sleep_hours,
    remSleepHours: row.rem_sleep_hours,
    coreSleepHours: row.core_sleep_hours,
    awakeMinutes: row.awake_minutes,
    sleepEfficiency: row.sleep_efficiency,
    steps: row.steps,
    walkingDistanceKm: row.distance_km,
    activeEnergyKcal: row.active_energy_kcal,
    exerciseMinutes: row.exercise_minutes,
    restingHeartRate: row.resting_heart_rate,
    avgHeartRate: row.avg_heart_rate,
    maxHeartRate: row.max_heart_rate,
    walkingHeartRateAverage: row.walking_heart_rate,
    hrvSdnn: row.hrv_sdnn,
  }
}

function summaryDbRow(profileId, summary = {}) {
  return {
    profile_id: profileId,
    day: summary.day,
    sleep_score: summary.sleepScore,
    movement_score: summary.movementScore,
    heart_score: summary.heartScore,
    recovery_score: summary.recoveryScore,
    strain_score: summary.strainScore,
    data_confidence: Math.round(Number(summary.dataConfidence) || 0),
    sleep_hours: Number(summary.totalSleepHours ?? summary.sleepHours) || 0,
    deep_sleep_hours: Number(summary.deepSleepHours) || 0,
    rem_sleep_hours: Number(summary.remSleepHours) || 0,
    core_sleep_hours: Number(summary.coreSleepHours) || 0,
    awake_minutes: Math.round(Number(summary.awakeMinutes) || 0),
    sleep_efficiency: summary.sleepEfficiency ?? null,
    steps: Math.round(Number(summary.steps) || 0),
    distance_km: Number(summary.walkingDistanceKm ?? summary.distanceKm ?? summary.workoutDistanceKm) || 0,
    active_energy_kcal: Math.round(Number(summary.activeEnergyKcal ?? summary.workoutActiveEnergyKcal) || 0),
    exercise_minutes: Math.round(Number(summary.exerciseMinutes ?? summary.workoutDurationMin) || 0),
    resting_heart_rate: summary.restingHeartRate ? Math.round(Number(summary.restingHeartRate)) : null,
    avg_heart_rate: summary.avgHeartRate ? Math.round(Number(summary.avgHeartRate)) : null,
    max_heart_rate: summary.maxHeartRate ? Math.round(Number(summary.maxHeartRate)) : null,
    walking_heart_rate: summary.walkingHeartRateAverage ? Math.round(Number(summary.walkingHeartRateAverage)) : null,
    hrv_sdnn: summary.hrvSdnn ? Math.round(Number(summary.hrvSdnn)) : null,
    strain_notes: {
      workoutDurationMin: summary.workoutDurationMin || 0,
      workoutDistanceKm: summary.workoutDistanceKm || 0,
      workoutActiveEnergyKcal: summary.workoutActiveEnergyKcal || 0,
    },
    updated_at: new Date().toISOString(),
  }
}

function dailyLogDbRow(profileId, summary = {}) {
  const log = summaryToDailyLog(summary)
  return {
    profile_id: profileId,
    date: log.date,
    sleep_hours: log.sleepHours,
    steps: log.steps,
    active_energy_kcal: log.activeEnergyKcal,
    resting_heart_rate: log.restingHeartRate || null,
    hrv_sdnn: log.hrvSdnn || null,
    data_confidence: log.dataConfidence,
    source: 'apple_health',
  }
}

async function fetchExistingSummary(profileId, day) {
  try {
    const rows = await sbGet(`health_daily_summary?select=*&profile_id=eq.${profileId}&day=eq.${day}&limit=1`)
    return rows?.[0] ? summaryFromRow(rows[0]) : { day }
  } catch (error) {
    if (isMissingColumnError(error) || /health_daily_summary/i.test(String(error?.message || error))) {
      const schemaError = new Error('schema_missing: health_daily_summary')
      schemaError.code = 'schema_missing'
      throw schemaError
    }
    throw error
  }
}

async function upsertDailyLog(profileId, summary = {}) {
  const row = dailyLogDbRow(profileId, summary)
  try {
    await sbUpsert('daily_logs', [row], 'profile_id,date')
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    await sbUpsert('daily_logs', [{
      profile_id: profileId,
      date: row.date,
      sleep_hours: row.sleep_hours,
      steps: row.steps,
    }], 'profile_id,date')
  }
}

export async function persistHealthTelemetry(profileId, telemetry = []) {
  if (!telemetry.length) return { telemetryRows: 0, summaries: [] }
  try {
    await sbUpsert(
      'health_telemetry',
      telemetry.map(row => telemetryDbRow(profileId, row)),
      'profile_id,external_source,external_id,metric_type',
    )
  } catch (error) {
    if (isMissingColumnError(error) || /health_telemetry/i.test(String(error?.message || error))) {
      const schemaError = new Error('schema_missing: health_telemetry')
      schemaError.code = 'schema_missing'
      throw schemaError
    }
    throw error
  }

  const days = [...new Set(telemetry.map(row => row.day).filter(Boolean))]
  const summaries = []
  for (const day of days) {
    const existing = await fetchExistingSummary(profileId, day)
    const summary = mergeTelemetryIntoSummary(telemetry, existing, day)
    await sbUpsert('health_daily_summary', [summaryDbRow(profileId, summary)], 'profile_id,day')
    await upsertDailyLog(profileId, summary)
    summaries.push(summary)
  }
  return { telemetryRows: telemetry.length, summaries }
}

export async function processHealthImportBody(body = {}, { generateCoach = true } = {}) {
  const normalized = normalizeHealthImportPayload(body)
  if (!normalized.workouts.length && !normalized.telemetry.length) {
    const error = new Error('Payload health verisi icermeli')
    error.status = 400
    throw error
  }

  const profile = await resolveProfile()
  await recordIngestEvent({
    profileId: profile?.id,
    source: 'apple_health',
    externalId: body.externalId || body.external_id || '',
    eventType: 'webhook',
    operation: 'received',
    status: 'received',
    payload: body,
  })

  const workoutResults = []
  for (const workout of normalized.workouts) {
    if (!workout.durationMin && !workout.distanceKm) continue
    const result = await ingestNormalizedExternalWorkout(workout, {
      onUpdate: 'skip',
      generateCoach,
    })
    workoutResults.push({
      ...result,
      workout: {
        type: workout.type,
        date: workout.date,
        distanceKm: workout.distanceKm,
        durationMin: workout.durationMin,
        source: workout.source,
      },
    })
  }

  const telemetryResult = await persistHealthTelemetry(profile.id, normalized.telemetry)
  const status = workoutResults.some(result => result.status !== 'skipped') || telemetryResult.telemetryRows
    ? 'processed'
    : 'skipped'

  await recordIngestEvent({
    profileId: profile?.id,
    source: 'apple_health',
    externalId: body.externalId || body.external_id || normalized.telemetry?.[0]?.externalId || '',
    eventType: 'webhook',
    operation: status,
    status,
    payload: {
      kinds: normalized.receivedKinds,
      workouts: workoutResults.length,
      telemetryRows: telemetryResult.telemetryRows,
      days: telemetryResult.summaries.map(item => item.day),
    },
  })

  return {
    profile,
    normalized,
    workoutResults,
    telemetryResult,
    status,
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      status: 'apple health import hazir',
      auth: process.env.HEALTH_IMPORT_TOKEN ? 'configured' : 'missing-token',
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'POST gerekli' })
  }

  const auth = authorizeHealthImport(req)
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error })

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    return res.status(500).json({ ok: false, error: 'Supabase env eksik' })
  }

  let profile = null
  let body = null

  try {
    body = parseBody(req.body)
    const result = await processHealthImportBody(body)
    profile = result.profile

    return res.status(200).json({
      ok: true,
      status: result.status,
      kinds: result.normalized.receivedKinds,
      workouts: result.workoutResults,
      telemetryRows: result.telemetryResult.telemetryRows,
      summaries: result.telemetryResult.summaries,
    })
  } catch (error) {
    const status = error.status || (error.code === 'schema_missing' ? 503 : 500)
    await recordIngestEvent({
      profileId: profile?.id,
      source: 'apple_health',
      externalId: body?.externalId || body?.external_id || '',
      eventType: 'webhook',
      operation: 'failed',
      status: 'failed',
      error: String(error?.message || error),
      payload: body || {},
    })
    console.error('[health-import] failed:', error?.message || error)
    return res.status(status).json({
      ok: false,
      code: error.code || (status === 400 ? 'validation_failed' : 'health_import_failed'),
      error: String(error?.message || error),
    })
  }
}
