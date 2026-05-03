// Hevy normalize edilmis session'i Supabase'e yazar.
// Aynen telegram.js path'indeki XP / survival / stat / profile guncellemesini calistirir
// ama coach yorumu uretmez (Hevy ingest'inde sessiz tutuyoruz; coach feed bir sonraki
// site etkilesiminde / Telegram cevabinda Hevy verisini de gorerek yorum yapar).
//
// Idempotency: workouts.external_id unique index'i sayesinde ayni Hevy workout iki kez
// yazilamaz. Buna ek olarak burada once SELECT ile kontrol ediyoruz (update path).

import { classArmorRegen, classFatigueDecay, classXpMult, computeClass } from '../../src/data/class-engine.js'
import {
  buildWorkoutBlockRows,
  buildWorkoutFactRows,
} from '../../src/data/memory-engine.js'
import { detectPRs } from '../../src/data/pr-detector.js'
import {
  applyStatDelta,
  computeSessionStatDelta,
  computeSessionXp,
  computeStreakInfo,
  normalizeDateString,
  normalizeSession,
} from '../../src/data/rules.js'
import { applySurvival } from '../../src/data/survival-engine.js'

// ── Supabase REST helpers (telegram.js'deki sablonun aynisi) ────────────────
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
  const sessionDate = payload.date

  const draftSession = normalizeSession({
    date: sessionDate,
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
    source: 'hevy',
    startedAt: payload.startedAt,
    createdAt: payload.createdAt,
  }, { source: 'hevy' })

  const currentPrs = buildCurrentPrs(workouts)
  const prDetection = detectPRs(draftSession, currentPrs)
  const session = { ...draftSession, hasPr: draftSession.hasPr || prDetection.hasPr }

  const currentClass = computeClass(workouts)
  const survival = applySurvival({
    armor: Number(profileFresh.armor_current) || 100,
    fatigue: Number(profileFresh.fatigue_current) || 0,
    consecutiveHeavy: Number(profileFresh.consecutive_heavy) || 0,
    injuryUntil: profileFresh.injury_until || null,
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
  const nextStats = applyStatDelta(profileFresh.stats || {}, statDelta)

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
    source: 'hevy',
    distance_km: session.distanceKm,
    elevation_m: session.elevationM,
    class_mult: classXpMult(currentClass, session.type),
    survival_status: survival.status,
    stat_delta: statDelta,
    created_at: session.createdAt,
    started_at: session.startedAt || null,
    external_source: externalSource,
    external_id: externalId,
    raw_external: payload.rawExternal || null,
  }

  let insertedRows
  try {
    insertedRows = await sbPost('workouts', workoutPayload)
  } catch (error) {
    // raw_external / external_* kolonlari yoksa graceful fallback (migration uygulanmadi)
    if (!isMissingColumnError(error)) throw error
    const lite = { ...workoutPayload }
    delete lite.raw_external
    delete lite.external_source
    delete lite.external_id
    delete lite.started_at
    insertedRows = await sbPost('workouts', lite)
  }
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

  // Workout artifacts (blocks + facts) — telegram path'iyle ayni
  if (workoutId) {
    const blockRows = buildWorkoutBlockRows(profile.id, workoutId, session.blocks || [], session.blockMix || [])
    if (blockRows.length) {
      try { await sbPost('workout_blocks', blockRows) } catch (error) {
        if (!isMissingColumnError(error)) throw error
      }
    }
    const factRows = buildWorkoutFactRows(profile.id, workoutId, session.facts || [], session.confidence)
    if (factRows.length) {
      try { await sbPost('workout_facts', factRows) } catch (error) {
        if (!isMissingColumnError(error)) throw error
      }
    }
  }

  return {
    status: existingId ? 'updated' : 'inserted',
    workoutId,
    xpEarned: xpInfo.xpEarned,
    type: session.type,
    date: sessionDate,
  }
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
