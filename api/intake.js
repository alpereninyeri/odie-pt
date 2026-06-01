import { appAuthConfigured, authorizeAppRequest } from './app-auth.js'
import { parseIntakeText } from '../lib/odie-intake/parser.js'
import { classArmorRegen, classFatigueDecay, classXpMult, computeClass } from '../src/data/class-engine.js'
import { applyBodyEventAction, normalizeBodyEventRow, normalizeRegionId, toSupabaseBodyEvent } from '../src/data/body-events.js'
import { buildBodyMapState, sessionClosesBodyMapPriority, sessionClosesGameQuest, sessionTouchesBodyRegion } from '../src/data/body-map-engine.js'
import { buildBodyMetricsHistoryEntry } from '../src/data/memory-engine.js'
import {
  computeProfileStatsFromWorkouts,
  computeSessionStatDelta,
  computeSessionXp,
  computeStreakInfo,
  getLocalDateString,
  normalizeDateString,
  normalizeSession,
} from '../src/data/rules.js'
import { applySurvival, applyTimedRecovery } from '../src/data/survival-engine.js'

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

async function sbPost(table, body, prefer = 'return=representation') {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: prefer },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.status === 204 ? [] : response.json()
}

async function sbPatch(table, filter, body) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
}

async function sbPatchReturning(table, filter, body) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.status === 204 ? [] : response.json()
}

async function sbUpsert(table, body, onConflict) {
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : ''
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}${query}`, {
    method: 'POST',
    headers: {
      ...sbHeaders(),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

async function sbGetSafe(path, fallback = []) {
  try {
    return await sbGet(path)
  } catch {
    return fallback
  }
}

function isMissingRelation(error) {
  const message = String(error?.message || error || '')
  return /relation .* does not exist/i.test(message) || /table .* does not exist/i.test(message) || /schema cache/i.test(message) || /PGRST204/i.test(message)
}

function activeBodyEventFilter(profileId, region) {
  return `profile_id=eq.${profileId}&region=eq.${encodeURIComponent(region)}&status=in.(active,watch,rehab)&order=created_at.desc&limit=1`
}

function toBodyEventPatchPayload(event = {}) {
  return {
    kind: event.kind,
    region: event.region,
    side: event.side,
    severity: event.severity,
    recovery_percent: event.baseRecoveryPercent ?? event.recoveryPercent,
    expected_clear_at: event.expectedClearAt || null,
    status: event.status,
    note: event.note || '',
    source: event.source || 'web_odie',
    odie_interpretation: event.odieInterpretation || null,
    updated_at: new Date().toISOString(),
  }
}

function parseBody(body) {
  if (body && typeof body === 'object') return body
  try {
    return JSON.parse(String(body || '{}'))
  } catch {
    return {}
  }
}

function requireStrictAppAccess(req, res) {
  if (!appAuthConfigured()) {
    res.status(401).json({ ok: false, error: 'intake token is required' })
    return false
  }
  const auth = authorizeAppRequest(req)
  if (auth.ok) return true
  res.status(401).json({ ok: false, error: 'unauthorized' })
  return false
}

async function resolveProfile() {
  const explicitId = process.env.ODIE_PROFILE_ID
  if (explicitId) {
    const explicitRows = await sbGet(`profiles?select=*&id=eq.${explicitId}&limit=1`)
    if (explicitRows?.[0]) return explicitRows[0]
  }
  const rows = await sbGet('profiles?select=*&order=last_updated.desc&limit=1')
  return rows?.[0] || null
}

function normalizeWorkoutRow(row = {}) {
  return normalizeSession({
    id: row.id,
    date: row.date,
    type: row.type,
    durationMin: row.duration_min,
    volumeKg: row.volume_kg,
    sets: row.sets,
    highlight: row.highlight,
    exercises: row.exercises || [],
    hasPr: row.has_pr,
    notes: row.notes || '',
    source: row.source || 'web_odie',
    createdAt: row.created_at,
    tags: row.tags || [],
    primaryCategory: row.primary_category,
    intensity: row.intensity,
    distanceKm: row.distance_km,
    elevationM: row.elevation_m,
    blocks: row.blocks || [],
  }, { source: row.source || 'web_odie' })
}

function normalizeDailyLogRow(row = {}) {
  return {
    date: row.date,
    waterMl: Number(row.waterMl ?? row.water_ml) || 0,
    sleepHours: Number(row.sleepHours ?? row.sleep_hours) || 0,
    steps: Number(row.steps) || 0,
    mood: Number(row.mood) || 0,
  }
}

function computeLevelState(totalXp, max = 2000) {
  const level = Math.floor(totalXp / max) + 1
  return {
    level,
    xpCurrent: totalXp - ((level - 1) * max),
    xpMax: max,
  }
}

function toSupabaseExercises(exercises = []) {
  return (exercises || []).map(exercise => ({
    name: exercise.name,
    sets: (exercise.sets || []).map(set => ({
      reps: set.reps,
      weight_kg: set.weightKg ?? set.kg ?? 0,
      duration_sec: set.durationSec,
      note: set.note || '',
    })),
  }))
}

function workoutPayload(profile, session, xpInfo, statDelta, currentClass, survival) {
  return {
    profile_id: profile.id,
    date: session.date,
    type: session.type,
    duration_min: session.durationMin,
    volume_kg: session.volumeKg,
    sets: session.sets,
    highlight: session.highlight,
    exercises: toSupabaseExercises(session.exercises),
    xp_earned: xpInfo.xpEarned,
    xp_multiplier: xpInfo.streakMult,
    has_pr: session.hasPr,
    notes: session.notes,
    primary_category: session.primaryCategory,
    tags: session.tags,
    intensity: session.intensity,
    blocks: session.blocks || [],
    source: 'web_odie',
    distance_km: session.distanceKm,
    elevation_m: session.elevationM,
    class_mult: classXpMult(currentClass, session.type),
    survival_status: survival.status,
    stat_delta: statDelta,
    created_at: session.createdAt || new Date().toISOString(),
  }
}

async function confirmWorkout(profile, preview) {
  const [workoutRows, dailyLogRows, bodyEventRows, healthRows] = await Promise.all([
    sbGet(`workouts?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=80`),
    sbGet(`daily_logs?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=21`),
    sbGetSafe(`body_events?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=40`, []),
    sbGetSafe(`health_daily_summary?select=*&profile_id=eq.${profile.id}&order=day.desc&limit=1`, []),
  ])
  const workouts = (workoutRows || []).map(row => normalizeWorkoutRow(row))
  const dailyLogs = (dailyLogRows || []).map(row => normalizeDailyLogRow(row))
  const bodyEvents = (bodyEventRows || []).map(row => normalizeBodyEventRow(row))
  const session = normalizeSession({
    ...(preview.record || {}),
    source: 'web_odie',
  }, { source: 'web_odie' })
  const currentClass = computeClass(workouts)
  const survivalInput = applyTimedRecovery({
    armor: Number(profile.armor_current) || 100,
    fatigue: Number(profile.fatigue_current) || 0,
    consecutiveHeavy: Number(profile.consecutive_heavy) || 0,
    injuryUntil: profile.injury_until || null,
    status: profile.survival_status || 'healthy',
  }, workouts[0] || null)
  const survival = applySurvival({
    armor: survivalInput.armor ?? 100,
    fatigue: survivalInput.fatigue ?? 0,
    consecutiveHeavy: survivalInput.consecutiveHeavy ?? 0,
    injuryUntil: survivalInput.injuryUntil || null,
  }, session, {
    armorRegen: classArmorRegen(currentClass),
    fatigueDecay: classFatigueDecay(currentClass),
  })
  const bodyMapState = buildBodyMapState({
    state: {
      profile: {
        ...profile,
        armor: survivalInput.armor,
        fatigue: survivalInput.fatigue,
        classObj: currentClass,
      },
      workouts,
      dailyLogs,
      bodyEvents,
      healthDailySummary: healthRows?.[0] || null,
    },
    profile,
  })
  const injuryConflict = bodyEvents.some(event => sessionTouchesBodyRegion(session, event.region))
  const streak = computeStreakInfo(workouts, session.date)
  const xpInfo = computeSessionXp(session, {
    streakDays: streak.current,
    classMultiplier: classXpMult(currentClass, session.type),
    survivalMultiplier: survival.xpMultiplier,
    prBonusMultiplier: currentClass?.passive?.prBonus || 1,
    doubleSession: workouts.some(workout => normalizeDateString(workout.date) === session.date),
    fatigue: survivalInput.fatigue ?? (Number(profile.fatigue_current) || 0),
    armor: survivalInput.armor ?? (Number(profile.armor_current) || 100),
    closingGap: sessionClosesBodyMapPriority(session, bodyMapState),
    questCompleted: sessionClosesGameQuest(session, bodyMapState?.dailyQuest),
    activeQuest: bodyMapState?.dailyQuest || null,
    injuryConflict,
  })
  const statDelta = computeSessionStatDelta(session)
  const nextStats = computeProfileStatsFromWorkouts([session, ...workouts], profile.stats || {})
  const inserted = await sbPost('workouts', workoutPayload(profile, session, xpInfo, statDelta, currentClass, survival))
  const nextTotalXp = (Number(profile.xp_total) || Number(profile.xp_current) || 0) + xpInfo.xpEarned
  const levelState = computeLevelState(nextTotalXp, Number(profile.xp_max) || 2000)
  await sbPatch('profiles', `id=eq.${profile.id}`, {
    xp_current: levelState.xpCurrent,
    xp_max: levelState.xpMax,
    xp_total: nextTotalXp,
    level: levelState.level,
    sessions: (Number(profile.sessions) || 0) + 1,
    total_volume_kg: (Number(profile.total_volume_kg) || 0) + (session.volumeKg || 0),
    total_sets: (Number(profile.total_sets) || 0) + (session.sets || 0),
    total_minutes: (Number(profile.total_minutes) || 0) + (session.durationMin || 0),
    total_km: (Number(profile.total_km) || 0) + (session.distanceKm || 0),
    stats: nextStats,
    streak_current: streak.current,
    streak_max: Math.max(Number(profile.streak_max) || 0, streak.max),
    last_workout_date: session.date,
    armor_current: survival.armor,
    fatigue_current: survival.fatigue,
    consecutive_heavy: survival.consecutiveHeavy,
    injury_until: survival.injuryUntil,
    survival_status: survival.status,
    class_id: currentClass.id,
    class: currentClass.name,
    sub_class: currentClass.subName,
    last_updated: new Date().toISOString(),
  })
  return {
    workout: inserted?.[0] || null,
    reward: {
      xp: xpInfo.xpEarned,
      chips: [`+${xpInfo.xpEarned} XP`, `Seviye ${levelState.level}`, `Seri ${streak.current}`],
    },
  }
}

async function confirmDailyLog(profile, preview) {
  const record = preview.record || {}
  const payload = {
    profile_id: profile.id,
    date: record.date || getLocalDateString(),
    sleep_hours: Number(record.sleepHours) || 0,
    water_ml: Number(record.waterMl) || 0,
    steps: Number(record.steps) || 0,
    mood: Number(record.mood) || 0,
  }
  const rows = await sbUpsert('daily_logs', [payload], 'profile_id,date')
  return { dailyLog: rows?.[0] || payload }
}

async function confirmBodyEvent(profile, preview) {
  const event = toSupabaseBodyEvent(preview.record || {})
  const activeRows = await sbGet(`body_events?select=*&${activeBodyEventFilter(profile.id, event.region)}`)
  if (activeRows?.[0]) {
    const error = new Error('Bu bölgede aktif sakatlık kaydı var. Karttan güncelle.')
    error.status = 409
    error.code = 'active_body_event_exists'
    throw error
  }
  const rows = await sbPost('body_events', [{ ...event, profile_id: profile.id }])
  return { event: rows?.[0] || event }
}

async function confirmBodyEventUpdate(profile, preview) {
  const record = preview.record || {}
  const region = normalizeRegionId(record.region || record.regionId || '')
  if (!region) {
    const error = new Error('Hangi bölgeyi güncelleyeceğim net değil.')
    error.status = 400
    error.code = 'body_event_region_required'
    throw error
  }
  const activeRows = await sbGet(`body_events?select=*&${activeBodyEventFilter(profile.id, region)}`)
  const existing = activeRows?.[0]
  if (!existing) {
    const error = new Error('Bu bölgede aktif sakatlık kaydı yok.')
    error.status = 404
    error.code = 'body_event_not_found'
    throw error
  }
  const patched = applyBodyEventAction(normalizeBodyEventRow(existing), record)
  const rows = await sbPatchReturning(
    'body_events',
    `profile_id=eq.${profile.id}&id=eq.${encodeURIComponent(existing.id)}`,
    toBodyEventPatchPayload(patched),
  )
  return { event: rows?.[0] || patched }
}

async function confirmBodyMetric(profile, preview) {
  const record = preview.record || {}
  const nextMetrics = {
    ...(profile.body_metrics || {}),
    ...(record.metrics || {}),
    updated_at: new Date().toISOString(),
  }
  await sbPatch('profiles', `id=eq.${profile.id}`, {
    body_metrics: nextMetrics,
    last_updated: new Date().toISOString(),
  })
  const history = buildBodyMetricsHistoryEntry(profile.id, nextMetrics, {
    date: record.date || getLocalDateString(),
    source: 'web_odie',
  })
  if (history) await sbPost('body_metrics_history', history, 'return=minimal')
  return { bodyMetrics: nextMetrics }
}

export default async function handler(req, res) {
  try {
    if (!requireStrictAppAccess(req, res)) return
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

    const body = parseBody(req.body)
    const mode = String(body.mode || 'preview')
    const text = String(body.text || body.preview?.summary || body.preview?.record?.highlight || '').trim()
    const preview = body.preview || parseIntakeText(text)

    if (mode === 'preview') {
      return res.status(200).json({ ok: true, preview })
    }

    if (mode !== 'confirm') {
      return res.status(400).json({ ok: false, error: 'Geçersiz mod' })
    }

    if (!preview?.kind || preview.kind === 'needs_clarification' || preview.kind === 'question') {
      return res.status(400).json({ ok: false, error: 'Bu kayıt onaya hazır değil', preview })
    }

    const profile = await resolveProfile()
    if (!profile) return res.status(404).json({ ok: false, error: 'Profil bulunamadı' })

    let result = null
    if (preview.kind === 'workout') result = await confirmWorkout(profile, preview)
    if (preview.kind === 'daily_log') result = await confirmDailyLog(profile, preview)
    if (preview.kind === 'body_event') result = await confirmBodyEvent(profile, preview)
    if (preview.kind === 'body_event_update') result = await confirmBodyEventUpdate(profile, preview)
    if (preview.kind === 'body_metric') result = await confirmBodyMetric(profile, preview)

    return res.status(200).json({ ok: true, kind: preview.kind, preview, result })
  } catch (error) {
    console.error('[intake] failed:', error?.message || error)
    if (isMissingRelation(error)) return res.status(503).json({ ok: false, error: 'body_events_missing', schemaReady: false })
    return res.status(error?.status || 500).json({ ok: false, error: error?.message || 'ODIE intake failed', code: error?.code || undefined })
  }
}
