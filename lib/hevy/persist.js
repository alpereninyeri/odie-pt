// Hevy normalize edilmis session'i Supabase'e yazar.
// Legacy ingest ile ayni XP / survival / stat / profile pipeline'ini calistirir.
// Hevy verisini deterministik profil/stat pipeline'ina taşır.
// Bu akış bilinçli olarak AI/coach çağrısı yapmaz.
//
// Idempotency: workouts.external_id unique index'i sayesinde ayni Hevy workout iki kez
// yazilamaz. Buna ek olarak burada once SELECT ile kontrol ediyoruz (update path).

import { classArmorRegen, classFatigueDecay, classXpMult, computeClass } from '../../src/data/class-engine.js'
import { detectPRs } from '../../src/data/pr-detector.js'
import {
  computeProfileStatsFromWorkouts,
  computeSessionStatDelta,
  computeSessionXp,
  computeStreakInfo,
  normalizeDateString,
  normalizeSession,
} from '../../src/data/rules.js'
import { applySurvival, applyTimedRecovery } from '../../src/data/survival-engine.js'

// ── Supabase REST helpers (telegram.js'deki sablonun aynisi) ────────────────
function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
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

async function sbPost(table, body) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

async function sbPatch(table, filter, body) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
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

async function sbDelete(table, filter) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: sbHeaders(),
  })
  if (!response.ok) throw new Error(await response.text())
}

function isMissingColumnError(error) {
  const message = String(error?.message || error || '')
  return (
    /column .* does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /table .* does not exist/i.test(message) ||
    /could not find .* column .* schema cache/i.test(message) ||
    /schema cache/i.test(message) ||
    /PGRST204/i.test(message)
  )
}

function missingColumnName(error) {
  const message = String(error?.message || error || '')
  const direct = message.match(/column\s+(?:\w+\.)?([a-z0-9_]+)\s+does not exist/i)
  if (direct?.[1]) return direct[1]
  const schemaCache = message.match(/Could not find the '([^']+)' column/i)
  if (schemaCache?.[1]) return schemaCache[1]
  return ''
}

function removePayloadColumn(payload, column) {
  let removed = false
  const removeFromRow = (row = {}) => {
    if (Object.prototype.hasOwnProperty.call(row, column)) {
      delete row[column]
      removed = true
    }
  }
  if (Array.isArray(payload)) payload.forEach(removeFromRow)
  else removeFromRow(payload)
  return removed
}

async function sbPostWithColumnFallback(table, body) {
  const payload = Array.isArray(body)
    ? body.map(row => ({ ...row }))
    : { ...body }
  const removed = new Set()

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      return await sbPost(table, payload)
    } catch (error) {
      const column = missingColumnName(error)
      if (!column || removed.has(column) || !removePayloadColumn(payload, column)) throw error
      removed.add(column)
    }
  }

  throw new Error(`${table} insert failed after removing missing columns: ${[...removed].join(', ')}`)
}

// ── Profile / state helpers ─────────────────────────────────────────────────
export async function resolveProfile() {
  const explicitId = process.env.ODIEPT_PROFILE_ID
  if (explicitId) {
    const rows = await sbGet(`profiles?select=*&id=eq.${explicitId}&limit=1`)
    return rows?.[0] || null
  }
  const rows = await sbGet('profiles?select=*&order=last_updated.desc&limit=1')
  return rows?.[0] || null
}

function computeLevelState(totalXp, max = 2000) {
  const level = Math.floor(totalXp / max) + 1
  return {
    level,
    xpCurrent: totalXp - ((level - 1) * max),
    xpMax: max,
  }
}

function buildCurrentPrs(workouts) {
  const ordered = [...workouts].sort((left, right) =>
    normalizeDateString(left.date).localeCompare(normalizeDateString(right.date))
  )
  let prs = {}
  for (const workout of ordered) prs = detectPRs(workout, prs).updatedPrs
  return prs
}

function toSupabaseExercises(exercises) {
  return (exercises || []).map(exercise => ({
    name: exercise.name,
    sets: (exercise.sets || []).map(set => ({
      reps: set.reps,
      weight_kg: set.weightKg,
      duration_sec: set.durationSec,
      distance_meters: set.distanceMeters,
      note: set.note || '',
    })),
  }))
}

function toSupabaseBlocks(blocks = []) {
  return (blocks || []).map(block => ({
    kind: block.kind,
    label: block.label,
    tags: block.tags || [],
    sets: block.sets || 0,
    reps: block.reps,
    volume_kg: block.volumeKg || 0,
    duration_min: block.durationMin || 0,
    distance_km: block.distanceKm || 0,
    source: block.source || 'session',
  }))
}

// ── Idempotency ─────────────────────────────────────────────────────────────
async function findExistingByExternalId(profileId, externalSource, externalId) {
  const rows = await sbGet(
    `workouts?select=id&profile_id=eq.${profileId}&external_source=eq.${encodeURIComponent(externalSource)}&external_id=eq.${encodeURIComponent(externalId)}&limit=1`
  )
  return rows?.[0]?.id || null
}

// ── Ana ingest fonksiyonu ───────────────────────────────────────────────────
// payload: normalizeHevyWorkout cikti
// options.deletePrevious: update durumlarinda eski satiri silip yeniden olusturur
//   (XP/stats geriye sarmadan yeni hesapla — basit ve dogru)
export async function ingestNormalizedExternalWorkout(payload, { onUpdate = 'replace' } = {}) {
  const profile = await resolveProfile()
  if (!profile) throw new Error('Profil bulunamadi')

  const externalSource = payload.externalSource
  const externalId = payload.externalId
  const source = payload.source || externalSource || 'hevy'
  if (!externalSource || !externalId) {
    throw new Error('external_source / external_id eksik')
  }

  // Idempotency: zaten var mi?
  const existingId = await findExistingByExternalId(profile.id, externalSource, externalId)
  if (existingId && onUpdate === 'skip') {
    return { status: 'skipped', workoutId: existingId }
  }
  if (existingId && onUpdate === 'replace') {
    // Eski satiri sil; profil sayilarini geri sar.
    await rollbackExistingWorkout(profile.id, existingId)
  }

  // Profil + workout history'sini cek (XP/survival hesabi icin)
  const [profileFresh, workoutRows] = await Promise.all([
    sbGet(`profiles?select=*&id=eq.${profile.id}&limit=1`).then(r => r?.[0] || profile),
    sbGet(`workouts?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=120`),
  ])
  const workouts = workoutRows || []
  const draftSession = buildExternalWorkoutDraftSession(payload, source)
  const sessionDate = draftSession.date

  const currentPrs = buildCurrentPrs(workouts)
  const prDetection = detectPRs(draftSession, currentPrs)
  const session = { ...draftSession, hasPr: draftSession.hasPr || prDetection.hasPr }

  const currentClass = computeClass(workouts)
  const currentSurvival = applyTimedRecovery({
    armor: Number(profileFresh.armor_current) || 100,
    fatigue: Number(profileFresh.fatigue_current) || 0,
    consecutiveHeavy: Number(profileFresh.consecutive_heavy) || 0,
    injuryUntil: profileFresh.injury_until || null,
    status: profileFresh.survival_status || 'healthy',
  }, workouts[0] || null, { now: session.startedAt || session.createdAt || new Date() })
  const survival = applySurvival({
    armor: currentSurvival.armor,
    fatigue: currentSurvival.fatigue,
    consecutiveHeavy: currentSurvival.consecutiveHeavy,
    injuryUntil: currentSurvival.injuryUntil,
  }, session, {
    armorRegen: classArmorRegen(currentClass),
    fatigueDecay: classFatigueDecay(currentClass),
  })

  const streak = computeStreakInfo(workouts, sessionDate)
  const xpInfo = computeSessionXp(session, {
    streakDays: streak.current,
    classMultiplier: classXpMult(currentClass, session.type),
    survivalMultiplier: survival.xpMultiplier,
    prBonusMultiplier: currentClass?.passive?.prBonus || 1,
    doubleSession: workouts.some(workout => normalizeDateString(workout.date) === sessionDate),
  })
  const statDelta = computeSessionStatDelta(session)
  const nextStats = computeProfileStatsFromWorkouts([session, ...workouts], profileFresh.stats || {})

  const xpMax = Number(profileFresh.xp_max) || 2000
  const existingTotalXp = Number(profileFresh.xp_total)
    || (((Number(profileFresh.level) || 1) - 1) * xpMax + (Number(profileFresh.xp_current) || 0))
  const nextTotalXp = existingTotalXp + xpInfo.xpEarned
  const levelState = computeLevelState(nextTotalXp, xpMax)
  const nextClass = computeClass([session, ...workouts])

  const workoutPayload = {
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
    blocks: toSupabaseBlocks(session.blocks),
    source,
    distance_km: session.distanceKm,
    elevation_m: session.elevationM,
    active_energy_kcal: Math.round(Number(payload.healthMetrics?.activeEnergyKcal ?? payload.activeEnergyKcal) || 0),
    avg_heart_rate: Math.round(Number(payload.healthMetrics?.avgHeartRate ?? payload.avgHeartRate) || 0) || null,
    max_heart_rate: Math.round(Number(payload.healthMetrics?.maxHeartRate ?? payload.maxHeartRate) || 0) || null,
    class_mult: classXpMult(currentClass, session.type),
    survival_status: survival.status,
    stat_delta: statDelta,
    created_at: session.createdAt,
    started_at: session.startedAt || null,
    external_source: externalSource,
    external_id: externalId,
    raw_external: payload.rawExternal || null,
  }

  const insertedRows = await sbPostWithColumnFallback('workouts', workoutPayload)
  const workoutId = insertedRows?.[0]?.id || null

  const profilePatch = {
    xp_current: levelState.xpCurrent,
    xp_max: levelState.xpMax,
    xp_total: nextTotalXp,
    level: levelState.level,
    sessions: (Number(profileFresh.sessions) || 0) + 1,
    total_volume_kg: (Number(profileFresh.total_volume_kg) || 0) + (session.volumeKg || 0),
    total_sets: (Number(profileFresh.total_sets) || 0) + (session.sets || 0),
    total_minutes: (Number(profileFresh.total_minutes) || 0) + (session.durationMin || 0),
    total_km: (Number(profileFresh.total_km) || 0) + (session.distanceKm || 0),
    stats: nextStats,
    streak_current: streak.current,
    streak_max: Math.max(Number(profileFresh.streak_max) || 0, streak.max),
    last_workout_date: sessionDate,
    armor_current: survival.armor,
    fatigue_current: survival.fatigue,
    consecutive_heavy: survival.consecutiveHeavy,
    injury_until: survival.injuryUntil,
    survival_status: survival.status,
    class_id: nextClass.id,
    class: nextClass.name,
    sub_class: nextClass.subName,
    last_updated: new Date().toISOString(),
  }

  try {
    await sbPatch('profiles', `id=eq.${profile.id}`, profilePatch)
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    // legacy fallback (sadece kritik alanlar)
    await sbPatch('profiles', `id=eq.${profile.id}`, {
      xp_current: profilePatch.xp_current,
      xp_max: profilePatch.xp_max,
      level: profilePatch.level,
      sessions: profilePatch.sessions,
      total_volume_kg: profilePatch.total_volume_kg,
      total_sets: profilePatch.total_sets,
      total_minutes: profilePatch.total_minutes,
      stats: profilePatch.stats,
      streak_current: profilePatch.streak_current,
      streak_max: profilePatch.streak_max,
      last_workout_date: profilePatch.last_workout_date,
      last_updated: profilePatch.last_updated,
    })
  }

  return {
    status: existingId ? 'updated' : 'inserted',
    workoutId,
    xpEarned: xpInfo.xpEarned,
    type: session.type,
    date: sessionDate,
  }
}

export function buildExternalWorkoutDraftSession(payload = {}, source = payload.source || payload.externalSource || 'hevy') {
  return normalizeSession({
    date: payload.date,
    type: payload.type,
    durationMin: payload.durationMin,
    distanceKm: payload.distanceKm,
    elevationM: payload.elevationM,
    tags: payload.tags || [],
    exercises: payload.exercises || [],
    volumeKg: payload.volumeKg,
    sets: payload.sets,
    highlight: payload.highlight || '',
    hasPr: payload.hasPr,
    notes: payload.notes || '',
    evidence: payload.evidence || [],
    facts: payload.facts || [],
    blocks: payload.blocks || [],
    confidence: payload.confidence || null,
    source,
    startedAt: payload.startedAt,
    createdAt: payload.createdAt,
  }, { source })
}

export async function deleteByExternalId(externalSource, externalId) {
  const profile = await resolveProfile()
  if (!profile) return { status: 'no-profile' }
  const id = await findExistingByExternalId(profile.id, externalSource, externalId)
  if (!id) return { status: 'not-found' }
  await rollbackExistingWorkout(profile.id, id)
  return { status: 'deleted', workoutId: id }
}

// Mevcut workout'u silerken profil sayilarini geri sar (basit, idempotent).
async function rollbackExistingWorkout(profileId, workoutId) {
  const rows = await sbGet(`workouts?select=*&id=eq.${workoutId}&limit=1`)
  const old = rows?.[0]
  if (!old) return

  const profileRows = await sbGet(`profiles?select=*&id=eq.${profileId}&limit=1`)
  const profile = profileRows?.[0]
  if (profile) {
    const xpMax = Number(profile.xp_max) || 2000
    const existingTotalXp = Number(profile.xp_total)
      || (((Number(profile.level) || 1) - 1) * xpMax + (Number(profile.xp_current) || 0))
    const nextTotalXp = Math.max(0, existingTotalXp - (Number(old.xp_earned) || 0))
    const levelState = computeLevelState(nextTotalXp, xpMax)
    const workoutRows = await sbGet(`workouts?select=*&profile_id=eq.${profileId}&order=date.desc&limit=200`)
    const remainingWorkouts = (workoutRows || []).filter(workout => String(workout.id) !== String(workoutId))
    const nextStats = computeProfileStatsFromWorkouts(remainingWorkouts, profile.stats || {})

    await sbPatch('profiles', `id=eq.${profileId}`, {
      xp_current: levelState.xpCurrent,
      xp_max: levelState.xpMax,
      xp_total: nextTotalXp,
      level: levelState.level,
      sessions: Math.max(0, (Number(profile.sessions) || 0) - 1),
      total_volume_kg: Math.max(0, (Number(profile.total_volume_kg) || 0) - (Number(old.volume_kg) || 0)),
      total_sets: Math.max(0, (Number(profile.total_sets) || 0) - (Number(old.sets) || 0)),
      total_minutes: Math.max(0, (Number(profile.total_minutes) || 0) - (Number(old.duration_min) || 0)),
      total_km: Math.max(0, (Number(profile.total_km) || 0) - (Number(old.distance_km) || 0)),
      stats: nextStats,
      last_updated: new Date().toISOString(),
    }).catch(error => {
      if (!isMissingColumnError(error)) throw error
    })
  }

  await sbDelete('workouts', `id=eq.${workoutId}`)
}

// ── Hevy sync state cursor ──────────────────────────────────────────────────
export async function getSyncState(profileId) {
  const rows = await sbGet(`hevy_sync_state?select=*&profile_id=eq.${profileId}&limit=1`)
  return rows?.[0] || null
}

export async function updateSyncState(profileId, patch) {
  const body = [{ profile_id: profileId, updated_at: new Date().toISOString(), ...patch }]
  try {
    await sbUpsert('hevy_sync_state', body, 'profile_id')
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
  }
}

// Re-exports (endpoint'lerin kullanmasi icin)
export { sbGet, sbPost, sbPatch, sbUpsert, isMissingColumnError }
