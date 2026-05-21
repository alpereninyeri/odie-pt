import { buildNextSessionRecommendation } from '../src/data/next-session-engine.js'
import { normalizeBodyEventRow } from '../src/data/body-events.js'
import { normalizeDateString } from '../src/data/rules.js'

function sbHeaders() {
  const key = process.env.VITE_SUPABASE_ANON_KEY
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

async function sbGet(path) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    headers: sbHeaders(),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

function isMissingRelation(error) {
  const message = String(error?.message || error || '')
  return /relation .* does not exist/i.test(message) || /schema cache/i.test(message) || /PGRST204/i.test(message)
}

async function sbGetSafe(path, fallback = []) {
  try {
    return await sbGet(path)
  } catch (error) {
    if (isMissingRelation(error)) return fallback
    throw error
  }
}

async function resolveProfile() {
  const explicitId = process.env.ODIEPT_PROFILE_ID
  if (explicitId) {
    const rows = await sbGet(`profiles?select=*&id=eq.${explicitId}&limit=1`)
    return rows?.[0] || null
  }
  const rows = await sbGet('profiles?select=*&order=last_updated.desc&limit=1')
  return rows?.[0] || null
}

function normalizeWorkoutRow(row = {}) {
  return {
    id: row.id,
    date: normalizeDateString(row.date),
    type: row.type || 'Custom',
    durationMin: Number(row.duration_min) || 0,
    volumeKg: Number(row.volume_kg) || 0,
    sets: Number(row.sets) || 0,
    highlight: row.highlight || '',
    notes: row.notes || '',
    source: row.source || 'manual',
    tags: Array.isArray(row.tags) ? row.tags : [],
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    distanceKm: Number(row.distance_km) || 0,
    elevationM: Number(row.elevation_m) || 0,
    activeEnergyKcal: Number(row.active_energy_kcal) || 0,
    avgHeartRate: Number(row.avg_heart_rate) || 0,
    maxHeartRate: Number(row.max_heart_rate) || 0,
    hasPr: row.has_pr,
    createdAt: row.created_at,
    startedAt: row.started_at,
  }
}

function normalizeDailyLog(row = {}) {
  return {
    date: row.date,
    sleepHours: Number(row.sleep_hours) || 0,
    waterMl: Number(row.water_ml) || 0,
    steps: Number(row.steps) || 0,
    mood: Number(row.mood) || 0,
  }
}

function normalizeHealthSummary(row = null) {
  if (!row) return null
  return {
    day: row.day,
    sleepScore: Number(row.sleep_score),
    movementScore: Number(row.movement_score),
    heartScore: Number(row.heart_score),
    recoveryScore: Number(row.recovery_score),
    strainScore: Number(row.strain_score),
    dataConfidence: Number(row.data_confidence) || 0,
    totalSleepHours: Number(row.sleep_hours) || 0,
    deepSleepHours: Number(row.deep_sleep_hours) || 0,
    remSleepHours: Number(row.rem_sleep_hours) || 0,
    coreSleepHours: Number(row.core_sleep_hours) || 0,
    awakeMinutes: Number(row.awake_minutes) || 0,
    sleepEfficiency: Number(row.sleep_efficiency) || null,
    steps: Number(row.steps) || 0,
    walkingDistanceKm: Number(row.distance_km) || 0,
    activeEnergyKcal: Number(row.active_energy_kcal) || 0,
    exerciseMinutes: Number(row.exercise_minutes) || 0,
    restingHeartRate: Number(row.resting_heart_rate) || 0,
    avgHeartRate: Number(row.avg_heart_rate) || 0,
    maxHeartRate: Number(row.max_heart_rate) || 0,
    walkingHeartRateAverage: Number(row.walking_heart_rate) || 0,
    hrvSdnn: Number(row.hrv_sdnn) || 0,
  }
}

function normalizeProfile(row = {}) {
  return {
    id: row.id,
    level: Number(row.level) || 1,
    class: row.class || '',
    sessions: Number(row.sessions) || 0,
    stats: row.stats || {},
    armor: Number(row.armor_current) || 100,
    fatigue: Number(row.fatigue_current) || 0,
    survivalStatus: row.survival_status || 'healthy',
    lastUpdated: row.last_updated || null,
  }
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
    const profileRow = await resolveProfile()
    if (!profileRow?.id) return res.status(404).json({ ok: false, error: 'Profil bulunamadi' })

    const [workoutRows, dailyLogRows, feedbackRows, bodyEventRows, healthSummaryRows] = await Promise.all([
      sbGetSafe(`workouts?select=*&profile_id=eq.${profileRow.id}&order=date.desc,created_at.desc&limit=120`, []),
      sbGetSafe(`daily_logs?select=*&profile_id=eq.${profileRow.id}&order=date.desc&limit=30`, []),
      sbGetSafe(`memory_feedback?select=*&profile_id=eq.${profileRow.id}&order=created_at.desc&limit=24`, []),
      sbGetSafe(`body_events?select=*&profile_id=eq.${profileRow.id}&order=created_at.desc&limit=40`, []),
      sbGetSafe(`health_daily_summary?select=*&profile_id=eq.${profileRow.id}&order=day.desc&limit=1`, []),
    ])
    const healthDailySummary = normalizeHealthSummary((healthSummaryRows || [])[0] || null)

    const recommendation = buildNextSessionRecommendation({
      profile: normalizeProfile(profileRow),
      workouts: (workoutRows || []).map(row => normalizeWorkoutRow(row)),
      dailyLogs: (dailyLogRows || []).map(row => normalizeDailyLog(row)),
      memoryFeedback: feedbackRows || [],
      health: { dailySummary: healthDailySummary },
      bodyEvents: (bodyEventRows || []).map(row => normalizeBodyEventRow(row)),
    })

    return res.status(200).json({ ok: true, recommendation })
  } catch (error) {
    console.error('[next-session] failed:', error?.message || error)
    return res.status(500).json({ ok: false, error: String(error?.message || error) })
  }
}
