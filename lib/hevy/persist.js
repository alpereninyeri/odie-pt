// Hevy normalize edilmis session'i Supabase'e yazar.
// Telegram path'indeki XP / survival / stat / profile pipeline'ini calistirir.
// Yeni Hevy kaydindan sonra ODIE coach note da uretilir; backfill bu davranisi
// opsiyonla kapatir ki tarihsel import gereksiz model cagrisi yapmasin.
//
// Idempotency: workouts.external_id unique index'i sayesinde ayni Hevy workout iki kez
// yazilamaz. Buna ek olarak burada once SELECT ile kontrol ediyoruz (update path).

import { classArmorRegen, classFatigueDecay, classXpMult, computeClass } from '../../src/data/class-engine.js'
import { buildOdieContext } from '../../src/data/odie-context.js'
import { buildFallbackCoachResponse } from '../../src/data/odie-fallback.js'
import {
  buildAthleteMemoryCandidates,
  buildWorkoutBlockRows,
  buildWorkoutFactRows,
  normalizeAthleteMemoryRow,
  normalizeBodyMetricsHistoryRow,
  normalizeMemoryFeedbackRow,
  normalizeWorkoutBlockRow,
  normalizeWorkoutFactRow,
} from '../../src/data/memory-engine.js'
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
import { getCoachResponse } from '../../api/telegram.js'

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

async function sbGetSafe(path, fallback = []) {
  try {
    return await sbGet(path)
  } catch (error) {
    if (isMissingColumnError(error)) return fallback
    throw error
  }
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

function normalizeWorkoutRowForCoach(row = {}) {
  const normalized = normalizeSession({
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
    source: row.source || 'hevy',
    createdAt: row.created_at,
    startedAt: row.started_at,
    tags: row.tags || [],
    primaryCategory: row.primary_category,
    intensity: row.intensity,
    distanceKm: row.distance_km,
    elevationM: row.elevation_m,
    activeEnergyKcal: row.active_energy_kcal,
    avgHeartRate: row.avg_heart_rate,
    maxHeartRate: row.max_heart_rate,
    blocks: row.blocks || [],
  }, { source: row.source || 'hevy' })

  return {
    ...normalized,
    xpEarned: Number(row.xp_earned) || 0,
    xpMultiplier: Number(row.xp_multiplier) || 1,
  }
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

function normalizeCoachNoteRow(row = null) {
  if (!row) return null
  return {
    ...row,
    sections: Array.isArray(row.sections) ? row.sections : [],
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    quest_hints: Array.isArray(row.quest_hints) ? row.quest_hints : [],
    skill_progress: Array.isArray(row.skill_progress) ? row.skill_progress : [],
  }
}

function normalizeQuestionRow(row = {}) {
  return {
    id: row.id || null,
    question: String(row.question || '').trim(),
    answer: String(row.answer || '').trim(),
    responseJson: row.response_json || {},
    model: row.model || '',
    source: row.source || 'web',
    createdAt: row.created_at || null,
  }
}

function buildParsedForCoach(session = {}) {
  return {
    type: session.type,
    duration_min: session.durationMin,
    distance_km: session.distanceKm,
    elevation_m: session.elevationM,
    tags: session.tags || [],
    exercises: toSupabaseExercises(session.exercises || []),
    volume_kg: session.volumeKg,
    total_sets: session.sets,
    highlight: session.highlight || '',
    has_pr: session.hasPr,
    notes: session.notes || '',
    blocks: session.blocks || [],
    block_mix: session.blockMix || [],
    evidence: session.evidence || [],
    facts: session.facts || [],
    confidence: session.confidence || null,
    chains: session.chains || [],
    missing_chains: session.missingChains || [],
    risk_signals: session.riskSignals || [],
  }
}

async function persistAthleteMemory({ profileId, workoutId, session, nextStats, nextClass, survival, source = 'hevy' }) {
  const memoryRows = buildAthleteMemoryCandidates({
    profileId,
    session,
    nextStats,
    nextClass,
    survival,
  }).map(row => ({
    ...row,
    value_jsonb: {
      ...(row.value_jsonb || {}),
      sessionDate: session.date,
      workoutId,
      source,
    },
  }))

  if (!memoryRows.length) return
  try {
    await sbUpsert('athlete_memory', memoryRows, 'profile_id,scope,key')
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
  }
}

async function generateAndPersistCoachNote({
  profile,
  workoutId,
  session,
  workouts,
  nextStats,
  nextClass,
  survival,
  streak,
  xpEarned,
  healthSummary = null,
}) {
  if (!profile?.id || !workoutId) return { status: 'skipped' }

  const [
    dailyLogRows,
    coachRows,
    athleteMemoryRows,
    memoryFeedbackRows,
    bodyMetricsHistoryRows,
    workoutBlockRows,
    workoutFactRows,
    questionRows,
  ] = await Promise.all([
    sbGetSafe(`daily_logs?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=14`, []),
    sbGetSafe(`coach_notes?select=*&profile_id=eq.${profile.id}&order=date.desc,created_at.desc&limit=1`, []),
    sbGetSafe(`athlete_memory?select=*&profile_id=eq.${profile.id}&active=eq.true&order=last_used_at.desc,created_at.desc&limit=24`, []),
    sbGetSafe(`memory_feedback?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=24`, []),
    sbGetSafe(`body_metrics_history?select=*&profile_id=eq.${profile.id}&order=date.desc,created_at.desc&limit=30`, []),
    sbGetSafe(`workout_blocks?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=320`, []),
    sbGetSafe(`workout_facts?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=320`, []),
    sbGetSafe(`odie_questions?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=8`, []),
  ])

  const dailyLogs = (dailyLogRows || []).map(row => normalizeDailyLogRow(row))
  const latestCoachNote = normalizeCoachNoteRow((coachRows || [])[0] || null)
  const athleteMemory = (athleteMemoryRows || []).map(row => normalizeAthleteMemoryRow(row))
  const memoryFeedback = (memoryFeedbackRows || []).map(row => normalizeMemoryFeedbackRow(row))
  const bodyMetricsHistory = (bodyMetricsHistoryRows || []).map(row => normalizeBodyMetricsHistoryRow(row))
  const workoutBlocks = (workoutBlockRows || []).map(row => normalizeWorkoutBlockRow(row))
  const workoutFacts = (workoutFactRows || []).map(row => normalizeWorkoutFactRow(row))
  const questionHistory = (questionRows || []).map(row => normalizeQuestionRow(row))
  const coachWorkouts = (workouts || []).map(row => normalizeWorkoutRowForCoach(row))
  const currentPrs = buildCurrentPrs(coachWorkouts)
  const parsedForCoach = buildParsedForCoach(session)
  let odie = null
  let coachNote = null
  let stateSync = null
  let source = 'gemini'

  try {
    odie = buildOdieContext({
      profile,
      workouts: coachWorkouts,
      dailyLogs,
      athleteMemory,
      memoryFeedback,
      bodyMetricsHistory,
      workoutBlocks,
      workoutFacts,
      prs: currentPrs,
      coachNote: latestCoachNote,
      nextStats,
      nextClass,
      session,
      streak,
      xpEarned,
      survival,
      healthSummary,
    })

    const coach = await getCoachResponse(parsedForCoach, {
      xp: xpEarned,
      streak,
      className: nextClass.name,
      stats: nextStats,
      recentWorkouts: coachWorkouts,
      recentQuestions: questionHistory,
      bodyMetrics: profile.body_metrics || {},
      odie,
    })
    coachNote = coach.coachNote
    stateSync = coach.stateSync || null
  } catch (error) {
    source = 'fallback'
    console.warn('[hevy-persist] coach generation fallback:', error?.message || error)
    const fallback = buildFallbackCoachResponse(parsedForCoach, {
      xp: xpEarned,
      streak,
      className: nextClass.name,
      stats: nextStats,
      recentWorkouts: coachWorkouts,
      recentQuestions: questionHistory,
      bodyMetrics: profile.body_metrics || {},
      odie: odie || buildOdieContext({
        profile,
        workouts: coachWorkouts,
        dailyLogs,
        athleteMemory,
        memoryFeedback,
        bodyMetricsHistory,
        workoutBlocks,
        workoutFacts,
        prs: currentPrs,
        coachNote: latestCoachNote,
        nextStats,
        nextClass,
        session,
        streak,
        xpEarned,
        survival,
        healthSummary,
      }),
    })
    coachNote = fallback.coachNote
    stateSync = fallback.coachNote?.sections?.find(section => section?.hidden && section?.payload)?.payload || null
  }

  if (!coachNote) return { status: 'empty' }

  const coachPayload = {
    profile_id: profile.id,
    workout_id: workoutId,
    date: session.date,
    sections: coachNote.sections || [],
    xp_note: coachNote.xp_note || `+${xpEarned} XP`,
    warnings: coachNote.warnings || stateSync?.warnings || survival.warnings || [],
    quest_hints: coachNote.quest_hints?.length ? coachNote.quest_hints : (stateSync?.quest_hints || []),
    skill_progress: coachNote.skill_progress?.length ? coachNote.skill_progress : (stateSync?.skill_progress || []),
  }

  try {
    await sbPost('coach_notes', coachPayload)
  } catch (error) {
    if (!isMissingColumnError(error)) throw error
    await sbPost('coach_notes', {
      profile_id: profile.id,
      workout_id: workoutId,
      date: session.date,
      sections: coachPayload.sections,
      xp_note: coachPayload.xp_note,
    })
  }

  return { status: 'inserted', source }
}

// ── Idempotency ─────────────────────────────────────────────────────────────
async function findExistingByExternalId(profileId, externalSource, externalId) {
  const rows = await sbGet(
    `workouts?select=id&profile_id=eq.${profileId}&external_source=eq.${encodeURIComponent(externalSource)}&external_id=eq.${encodeURIComponent(externalId)}&limit=1`
  )
  return rows?.[0]?.id || null
}

function normalizeHealthSummaryRow(row = null) {
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
    steps: Number(row.steps) || 0,
    walkingDistanceKm: Number(row.distance_km) || 0,
    activeEnergyKcal: Number(row.active_energy_kcal) || 0,
    restingHeartRate: Number(row.resting_heart_rate) || 0,
    hrvSdnn: Number(row.hrv_sdnn) || 0,
  }
}

// ── Ana ingest fonksiyonu ───────────────────────────────────────────────────
// payload: normalizeHevyWorkout cikti
// options.deletePrevious: update durumlarinda eski satiri silip yeniden olusturur
//   (XP/stats geriye sarmadan yeni hesapla — basit ve dogru)
export async function ingestNormalizedExternalWorkout(payload, { onUpdate = 'replace', generateCoach = true } = {}) {
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
  const [profileFresh, workoutRows, healthSummaryRows] = await Promise.all([
    sbGet(`profiles?select=*&id=eq.${profile.id}&limit=1`).then(r => r?.[0] || profile),
    sbGet(`workouts?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=120`),
    sbGetSafe(`health_daily_summary?select=*&profile_id=eq.${profile.id}&order=day.desc&limit=1`, []),
  ])
  const workouts = workoutRows || []
  const healthSummary = normalizeHealthSummaryRow((healthSummaryRows || [])[0] || null)
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
    evidence: payload.evidence || [],
    facts: payload.facts || [],
    confidence: payload.confidence || null,
    source,
    startedAt: payload.startedAt,
    createdAt: payload.createdAt,
  }, { source })

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
    healthSummary,
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
    delete lite.active_energy_kcal
    delete lite.avg_heart_rate
    delete lite.max_heart_rate
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
    await persistAthleteMemory({ profileId: profile.id, workoutId, session, nextStats, nextClass, survival, source })
  }

  let coachResult = { status: 'disabled' }
  if (generateCoach) {
    try {
      coachResult = await generateAndPersistCoachNote({
        profile: profileFresh,
        workoutId,
        session,
        workouts,
        nextStats,
        nextClass,
        survival,
        streak: streak.current,
        xpEarned: xpInfo.xpEarned,
        healthSummary,
      })
    } catch (error) {
      coachResult = { status: 'failed', error: String(error?.message || error) }
      console.warn('[hevy-persist] coach note failed:', error?.message || error)
    }
  }

  return {
    status: existingId ? 'updated' : 'inserted',
    workoutId,
    xpEarned: xpInfo.xpEarned,
    type: session.type,
    date: sessionDate,
    coach: coachResult,
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
