import { isMissingColumnError, resolveProfile, sbGet } from '../lib/hevy/persist.js'
import { appAuthConfigured, authorizeAppRequest } from './app-auth.js'

function isMissingRelation(error) {
  const message = String(error?.message || error || '')
  return isMissingColumnError(error) || /health_telemetry|health_daily_summary|ingest_events|body_events/i.test(message) || /schema cache/i.test(message)
}
async function sbGetSafe(path, fallback = []) {
  try {
    return await sbGet(path)
  } catch (error) {
    if (isMissingRelation(error)) return fallback
    throw error
  }
}

function normalizeWorkout(row = {}) {
  return row?.id ? {
    id: row.id,
    date: row.date,
    type: row.type,
    durationMin: Number(row.duration_min) || 0,
    distanceKm: Number(row.distance_km) || 0,
    activeEnergyKcal: Number(row.active_energy_kcal) || 0,
    avgHeartRate: Number(row.avg_heart_rate) || 0,
    source: row.source || '',
    createdAt: row.created_at,
  } : null
}

function normalizeSummary(row = {}) {
  if (!row?.day) return null
  return {
    day: row.day,
    sleepScore: row.sleep_score,
    movementScore: row.movement_score,
    heartScore: row.heart_score,
    recoveryScore: row.recovery_score,
    strainScore: row.strain_score,
    dataConfidence: row.data_confidence,
    totalSleepHours: Number(row.sleep_hours) || 0,
    deepSleepHours: Number(row.deep_sleep_hours) || 0,
    remSleepHours: Number(row.rem_sleep_hours) || 0,
    coreSleepHours: Number(row.core_sleep_hours) || 0,
    awakeMinutes: Number(row.awake_minutes) || 0,
    sleepEfficiency: row.sleep_efficiency,
    steps: Number(row.steps) || 0,
    walkingDistanceKm: Number(row.distance_km) || 0,
    activeEnergyKcal: Number(row.active_energy_kcal) || 0,
    exerciseMinutes: Number(row.exercise_minutes) || 0,
    restingHeartRate: Number(row.resting_heart_rate) || 0,
    avgHeartRate: Number(row.avg_heart_rate) || 0,
    maxHeartRate: Number(row.max_heart_rate) || 0,
    walkingHeartRateAverage: Number(row.walking_heart_rate) || 0,
    hrvSdnn: Number(row.hrv_sdnn) || 0,
    updatedAt: row.updated_at || row.created_at,
  }
}

function normalizeEvent(row = {}) {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    operation: row.operation,
    status: row.status,
    error: row.error ? 'redacted' : '',
    createdAt: row.created_at,
    processedAt: row.processed_at,
  }
}

function latestError(events = []) {
  return events.find(event => event.status === 'failed' || event.error) || null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'GET gerekli' })
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    return res.status(500).json({ ok: false, error: 'Supabase env eksik' })
  }

  try {
    const profile = await resolveProfile()
    if (!profile?.id) return res.status(404).json({ ok: false, error: 'Profil bulunamadi' })

    const [summaryRows, telemetryRows, eventRows, workoutRows, bodyRows] = await Promise.all([
      sbGetSafe(`health_daily_summary?select=*&profile_id=eq.${profile.id}&order=day.desc&limit=7`, null),
      sbGetSafe(`health_telemetry?select=kind,metric_type,day,created_at&profile_id=eq.${profile.id}&order=created_at.desc&limit=12`, null),
      sbGetSafe(`ingest_events?select=*&profile_id=eq.${profile.id}&source=eq.apple_health&order=created_at.desc&limit=12`, []),
      sbGetSafe(`workouts?select=*&profile_id=eq.${profile.id}&source=eq.apple_health&order=date.desc,created_at.desc&limit=1`, []),
      sbGetSafe(`body_events?select=id&profile_id=eq.${profile.id}&limit=1`, null),
    ])

    const schemaReady = Array.isArray(summaryRows) && Array.isArray(telemetryRows) && Array.isArray(bodyRows)
    const auth = authorizeAppRequest(req)
    const recentEvents = (eventRows || []).map(row => normalizeEvent(row))
    const dailySummary = normalizeSummary(summaryRows?.[0] || {})
    const lastAppleWorkout = normalizeWorkout(workoutRows?.[0] || {})
    const lastError = latestError(recentEvents)
    const lastSyncAt = [
      dailySummary?.updatedAt,
      lastAppleWorkout?.createdAt,
      recentEvents[0]?.processedAt || recentEvents[0]?.createdAt,
    ].filter(Boolean).sort().pop() || null

    const publicStatus = {
      ok: true,
      schemaReady,
      authConfigured: Boolean(process.env.HEALTH_IMPORT_TOKEN),
      privateConfigured: appAuthConfigured(),
      sources: {
        hevy: 'configured',
        appleWorkout: lastAppleWorkout ? 'linked' : 'waiting',
        appleSleep: dailySummary?.totalSleepHours ? 'linked' : 'waiting',
        appleHeart: dailySummary?.hrvSdnn || dailySummary?.restingHeartRate ? 'linked' : 'waiting',
        manual: 'available',
      },
      dailySummary,
      lastAppleWorkout,
      lastSyncAt,
      missing: !schemaReady,
    }

    if (!auth.configured || !auth.ok) return res.status(200).json(publicStatus)

    return res.status(200).json({
      ...publicStatus,
      lastError: lastError ? normalizeEvent(lastError) : null,
      recentEvents,
      telemetryPreview: Array.isArray(telemetryRows)
        ? telemetryRows.map(row => ({
          kind: row.kind,
          metricType: row.metric_type,
          day: row.day,
          createdAt: row.created_at,
        }))
        : [],
    })
  } catch (error) {
    console.error('[health-status] failed:', error?.message || error)
    return res.status(500).json({ ok: false, error: String(error?.message || error) })
  }
}
