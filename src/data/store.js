import { profile as seedProfile } from './profile.js'
import { MOCK_STATE } from './mock-state.js'
import {
  deleteWorkout,
  fetchAthleteMemory,
  fetchBodyMetricsHistory,
  fetchDailyLogs,
  fetchLatestCoachNote,
  fetchMemoryFeedback,
  fetchProfile,
  fetchWorkoutBlocks,
  fetchWorkoutFacts,
  fetchWorkouts,
  insertMemoryFeedback,
  insertWorkout,
  isMockMode,
  subscribeToCoachNotes,
  subscribeToProfile,
  subscribeToWorkouts,
  updateProfile,
  upsertDailyLog,
} from './supabase-client.js'
import {
  normalizeAthleteMemoryRow,
  normalizeBodyMetricsHistoryRow,
  normalizeMemoryFeedbackRow,
  normalizeWorkoutBlockRow,
  normalizeWorkoutFactRow,
} from './memory-engine.js'
import { recalculate } from './engine.js'
import { checkBadges } from './badge-engine.js'
import { classArmorRegen, classFatigueDecay, classXpMult, computeClass } from './class-engine.js'
import { computeGeographyTier, computeVolumeTier } from './epic-volume-engine.js'
import { detectPRs } from './pr-detector.js'
import {
  applyStatDelta,
  computeSessionStatDelta,
  computeSessionXp,
  computeStreakInfo,
  formatMonthShort,
  getLocalDateString,
  normalizeDateString,
  normalizeSession,
} from './rules.js'
import { applySurvival } from './survival-engine.js'

const LS_KEY = 'odiept-state-v8'
const CURRENT_VERSION = 8
const XP_PER_LEVEL = 2000

let _state = null
let _unsubSupabase = []
const _subscribers = new Map()

function _clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function _get(obj, path) {
  return path.split('.').reduce((current, key) => (current != null ? current[key] : undefined), obj)
}

function _set(obj, path, value) {
  const keys = path.split('.')
  const lastKey = keys.pop()
  const target = keys.reduce((current, key) => {
    if (current[key] == null || typeof current[key] !== 'object') current[key] = {}
    return current[key]
  }, obj)
  target[lastKey] = value
}

function _notify(path) {
  _subscribers.forEach((handlers, key) => {
    const isWildcard = path === '*'
    const matches = isWildcard || key === '*' || key === path || path.startsWith(`${key}.`) || key.startsWith(`${path}.`)
    if (!matches) return
    const value = key === '*' ? _state : _get(_state, key)
    handlers.forEach(handler => {
      try {
        handler(value)
      } catch (error) {
        console.error('[store] subscriber error:', error)
      }
    })
  })
}

function _loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function _saveToLS() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ..._state, _version: CURRENT_VERSION }))
  } catch (error) {
    console.warn('[store] localStorage write error:', error.message)
  }
}

function _normalizeXpModel(xp = {}, level = 1) {
  const max = Number(xp.max) || XP_PER_LEVEL
  const current = Number(xp.current) || 0
  const derivedTotal = Math.max(0, ((Math.max(1, Number(level) || 1) - 1) * max) + current)
  const total = Math.max(0, Number(xp.total) || derivedTotal)
  const normalizedLevel = Math.max(1, Math.floor(total / max) + 1)
  const intoLevel = total - ((normalizedLevel - 1) * max)

  return {
    current: intoLevel,
    max,
    total,
    level: normalizedLevel,
  }
}

function _normalizeProfileSeed() {
  const mockProfile = MOCK_STATE.profile || {}
  const seedXp = _normalizeXpModel({
    current: mockProfile.xp?.current ?? seedProfile.xp?.current ?? 0,
    max: mockProfile.xp?.max ?? seedProfile.xp?.max ?? XP_PER_LEVEL,
  }, mockProfile.level ?? seedProfile.level ?? 1)

  return {
    id: null,
    nick: mockProfile.nick || seedProfile.nick,
    handle: mockProfile.handle || seedProfile.handle,
    rank: mockProfile.rank || seedProfile.rank,
    rankIcon: mockProfile.rankIcon || seedProfile.rankIcon,
    class: mockProfile.class || seedProfile.class,
    subClass: mockProfile.subClass || seedProfile.subClass,
    avatar: mockProfile.avatar || seedProfile.avatar,
    level: seedXp.level,
    xp: {
      current: seedXp.current,
      max: seedXp.max,
      total: seedXp.total,
    },
    sessions: Number(mockProfile.sessions) || 0,
    totalVolumeKg: Number(mockProfile.totalVolumeKg) || 0,
    totalSets: Number(mockProfile.totalSets) || 0,
    totalMinutes: Number(mockProfile.totalMinutes) || 0,
    totalVolume: mockProfile.totalVolume || seedProfile.totalVolume || '0 kg',
    totalTime: mockProfile.totalTime || seedProfile.totalTime || '0h 0min',
    totalKm: 0,
    stats: { ...(mockProfile.stats || { str: 0, agi: 0, end: 0, dex: 0, con: 0, sta: 0 }) },
    streak: {
      current: Number(mockProfile.streak?.current) || 0,
      max: Number(mockProfile.streak?.max) || 0,
      multiplier: Number(mockProfile.streak?.multiplier) || 1,
      label: mockProfile.streak?.label || '',
      lastWorkoutDate: mockProfile.streak?.lastWorkoutDate || null,
    },
    armor: 100,
    fatigue: 0,
    consecutiveHeavy: 0,
    injuryUntil: null,
    survivalStatus: 'healthy',
    survivalWarnings: [],
    classId: null,
    classObj: null,
    epicVolume: null,
    epicGeography: null,
    currentFocus: '',
    lastUpdated: mockProfile.lastUpdated || new Date().toISOString(),
  }
}

function _buildSeedStats() {
  return (seedProfile.stats || []).map(stat => ({
    ...stat,
    val: 0,
    critical: false,
    desc: 'Canli veri geldikce otomatik guncellenir.',
    coach: 'Anlamli yorum icin yeni seans veya sync bekleniyor.',
    detail: Array.isArray(stat.detail)
      ? stat.detail.map(item => ({ ...item, val: '-' }))
      : [],
  }))
}

function _buildSeedPerformance() {
  return (seedProfile.performance || []).map(item => ({
    ...item,
    val: '—',
    note: 'Henuz canli performans sinyali yok.',
    trend: 'Bekleniyor',
    trendColor: 'var(--dim)',
    tip: 'Yeni workout geldikce peak ve trend burada toplanir.',
    details: Array.isArray(item.details)
      ? item.details.map(detail => ({ ...detail, val: '-' }))
      : [],
    history: [],
  }))
}

function _buildSeedMuscles() {
  return (seedProfile.muscles || []).map(item => ({
    ...item,
    sets: '0',
    rank: 'F',
    tag: 'Awaiting Data',
    tagClass: 'tw',
    detail: 'Bolgesel analiz yeni workout history geldikce sifirdan hesaplanir.',
    tip: 'Tek egzersiz degil, tum bloklar burada toplanacak.',
  }))
}

function _buildSeedHealth() {
  return {
    metrics: [],
    warnings: [],
    readiness: {
      score: null,
      confidence: 'low',
      source: 'setup',
      reason: 'Henüz günlük log ve yeterli yük verisi yok.',
    },
  }
}

function _buildSeedCoachNote() {
  return {
    id: null,
    date: '',
    xpNote: '',
    sections: [],
    warnings: [],
  }
}

function _normalizeBodyMetrics(input = {}) {
  const weightKg = Number(input.weightKg ?? input.weight_kg)
  const heightCm = Number(input.heightCm ?? input.height_cm)
  return {
    weightKg: Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 10) / 10 : null,
    heightCm: Number.isFinite(heightCm) && heightCm > 0 ? Math.round(heightCm) : null,
    updatedAt: input.updatedAt || input.updated_at || null,
    note: input.note || '',
  }
}

function _normalizeWorkoutRow(row = {}) {
  const normalized = normalizeSession({
    id: row.id,
    date: row.date,
    type: row.type,
    durationMin: row.durationMin ?? row.duration_min,
    volumeKg: row.volumeKg ?? row.volume_kg,
    sets: row.sets,
    highlight: row.highlight,
    exercises: row.exercises || [],
    hasPr: row.hasPr ?? row.has_pr,
    notes: row.notes || '',
    source: row.source || 'manual',
    createdAt: row.createdAt || row.created_at || row.started_at,
    elevationM: row.elevationM ?? row.elevation_m,
    distanceKm: row.distanceKm ?? row.distance_km,
    tags: row.tags || [],
    primaryCategory: row.primaryCategory ?? row.primary_category,
    intensity: row.intensity,
    blocks: row.blocks || [],
  }, { source: row.source || 'manual' })

  return {
    ...normalized,
    id: row.id || normalized.id || `w-${normalized.date}-${Date.now()}`,
    xpEarned: Number(row.xpEarned ?? row.xp_earned) || 0,
    xpMultiplier: Number(row.xpMultiplier ?? row.xp_multiplier) || 1,
    classMult: Number(row.classMult ?? row.class_mult) || 1,
    survivalStatus: row.survivalStatus ?? row.survival_status ?? 'healthy',
    statDelta: row.statDelta ?? row.stat_delta ?? {},
  }
}

function _normalizeDailyLog(row = {}) {
  return {
    id: row.id || null,
    date: normalizeDateString(row.date),
    waterMl: Number(row.waterMl ?? row.water_ml) || 0,
    sleepHours: Number(row.sleepHours ?? row.sleep_hours) || 0,
    steps: Number(row.steps) || 0,
    mood: Number(row.mood) || 3,
    createdAt: row.createdAt || row.created_at || null,
  }
}

function _normalizeProfileRow(row = {}) {
  const xp = _normalizeXpModel({
    current: row.xp_current,
    max: row.xp_max,
    total: row.xp_total,
  }, row.level)

  return {
    id: row.id || null,
    nick: row.nick || seedProfile.nick,
    handle: row.handle || seedProfile.handle,
    rank: row.rank || seedProfile.rank,
    rankIcon: row.rank_icon || seedProfile.rankIcon,
    class: row.class || seedProfile.class,
    subClass: row.sub_class || seedProfile.subClass,
    avatar: row.avatar || seedProfile.avatar,
    level: xp.level,
    xp: { current: xp.current, max: xp.max, total: xp.total },
    sessions: Number(row.sessions) || 0,
    totalVolumeKg: Number(row.total_volume_kg) || 0,
    totalSets: Number(row.total_sets) || 0,
    totalMinutes: Number(row.total_minutes) || 0,
    totalVolume: seedProfile.totalVolume,
    totalTime: seedProfile.totalTime,
    totalKm: Number(row.total_km) || 0,
    stats: {
      str: Number(row.stats?.str) || 0,
      agi: Number(row.stats?.agi) || 0,
      end: Number(row.stats?.end) || 0,
      dex: Number(row.stats?.dex) || 0,
      con: Number(row.stats?.con) || 0,
      sta: Number(row.stats?.sta) || 0,
    },
    streak: {
      current: Number(row.streak_current) || 0,
      max: Number(row.streak_max) || 0,
      multiplier: 1,
      label: '',
      lastWorkoutDate: row.last_workout_date || null,
    },
    armor: Number(row.armor_current ?? row.armor) || 100,
    fatigue: Number(row.fatigue_current ?? row.fatigue) || 0,
    consecutiveHeavy: Number(row.consecutive_heavy ?? row.consecutiveHeavy) || 0,
    injuryUntil: row.injury_until ?? row.injuryUntil ?? null,
    survivalStatus: row.survival_status ?? row.survivalStatus ?? 'healthy',
    survivalWarnings: Array.isArray(row.survival_warnings) ? row.survival_warnings : [],
    classId: row.class_id ?? row.classId ?? null,
    classObj: null,
    epicVolume: null,
    epicGeography: null,
    currentFocus: '',
    lastUpdated: row.last_updated || new Date().toISOString(),
    bodyMetrics: _normalizeBodyMetrics(row.body_metrics || {}),
  }
}

function _buildSeed() {
  return {
    _version: CURRENT_VERSION,
    profile: _normalizeProfileSeed(),
    workouts: (MOCK_STATE.workouts || []).map(workout => _normalizeWorkoutRow(workout)),
    dailyLogs: (MOCK_STATE.dailyLogs || []).map(log => _normalizeDailyLog(log)),
    prs: {},
    badges: _clone(MOCK_STATE.badges || []),
    globalStats: [],
    stats: _buildSeedStats(),
    performance: _buildSeedPerformance(),
    debuffs: [],
    muscleBalance: _clone(seedProfile.muscleBalance || []),
    muscles: _buildSeedMuscles(),
    skills: _clone(seedProfile.skills || []),
    health: _buildSeedHealth(),
    quests: _clone(seedProfile.quests || {}),
    achievements: _clone(seedProfile.achievements || []),
    workoutLog: [],
    coachNote: _buildSeedCoachNote(),
    coachQuestHints: [],
    coachSkillProgress: [],
    bodyMetrics: _normalizeBodyMetrics(seedProfile.bodyMetrics || {}),
    athleteMemory: [],
    memoryFeedback: [],
    bodyMetricsHistory: [],
    workoutBlocks: [],
    workoutFacts: [],
  }
}

function _sortWorkouts(workouts = []) {
  workouts.sort((left, right) => {
    const leftDate = normalizeDateString(left.date)
    const rightDate = normalizeDateString(right.date)
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate)
    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''))
  })
}

function _sortDailyLogs(logs = []) {
  logs.sort((left, right) => normalizeDateString(right.date).localeCompare(normalizeDateString(left.date)))
}

function _rebuildPrs(workouts = []) {
  const ordered = [...workouts].sort((left, right) => {
    const leftDate = normalizeDateString(left.date)
    const rightDate = normalizeDateString(right.date)
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate)
    return String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
  })

  let prs = {}
  for (const workout of ordered) {
    prs = detectPRs(workout, prs).updatedPrs
  }
  return prs
}

function _buildWorkoutLog(workouts = []) {
  return workouts.slice(0, 20).map(workout => ({
    date: formatMonthShort(workout.date),
    type: workout.type,
    duration: workout.durationMin ? `${workout.durationMin}dk` : '-',
    volume: workout.volumeKg ? `${Math.round(workout.volumeKg).toLocaleString('tr-TR')} kg` : '-',
    sets: workout.sets || '-',
    highlight: workout.highlight || '',
    blocks: (workout.blocks || []).map(block => block.kind).slice(0, 4),
  }))
}

function _deriveCurrentFocus(state) {
  const criticalStat = (state.stats || []).find(stat => stat.critical)
  if (criticalStat) return `${criticalStat.label} toparlama`

  const coreBalance = (state.muscleBalance || []).find(item => item.label === 'Core')
  if ((coreBalance?.sets || 0) < 16) return 'Core stabilitesi'

  const recent = state.workouts?.[0]
  if (!recent) return 'Desen kurma'

  switch (recent.primaryCategory) {
    case 'movement':
      return 'Landing + control'
    case 'endurance':
      return 'Aerobik taban'
    case 'strength':
      return 'Kuvvet ilerlemesi'
    case 'recovery':
      return 'Recovery reset'
    default:
      return 'Hybrid denge'
  }
}

function _deriveMetaFields(state) {
  if (!state?.profile) return

  const profile = state.profile
  const workouts = state.workouts || []
  const totals = workouts.reduce((acc, workout) => {
    acc.volumeKg += Number(workout.volumeKg) || 0
    acc.sets += Number(workout.sets) || 0
    acc.minutes += Number(workout.durationMin) || 0
    acc.km += Number(workout.distanceKm) || 0
    return acc
  }, { volumeKg: 0, sets: 0, minutes: 0, km: 0 })

  profile.sessions = workouts.length
  profile.totalVolumeKg = totals.volumeKg
  profile.totalSets = totals.sets
  profile.totalMinutes = totals.minutes
  profile.totalKm = Math.round(totals.km * 10) / 10

  const latestWorkoutDate = workouts[0]?.date
  profile.streak = latestWorkoutDate
    ? computeStreakInfo(workouts, latestWorkoutDate)
    : { current: 0, max: 0, multiplier: 1, label: '', lastWorkoutDate: null }

  const xp = _normalizeXpModel(profile.xp, profile.level)
  profile.level = xp.level
  profile.xp = { current: xp.current, max: xp.max, total: xp.total }

  const classObj = computeClass(workouts)
  profile.classId = classObj.id
  profile.classObj = classObj
  profile.class = classObj.name
  profile.subClass = classObj.subName || seedProfile.subClass
  profile.epicVolume = computeVolumeTier(profile.totalVolumeKg || 0)
  profile.epicGeography = computeGeographyTier(profile.totalKm || 0)
}

function _refreshDerivedState(state) {
  _sortWorkouts(state.workouts)
  _sortDailyLogs(state.dailyLogs)
  state.prs = _rebuildPrs(state.workouts || [])
  _deriveMetaFields(state)
  recalculate(state)
  state.workoutLog = _buildWorkoutLog(state.workouts || [])
  state.profile.currentFocus = _deriveCurrentFocus(state)
}

function _applyCoachNote(row) {
  if (!_state || !row) return
  _state.coachNote = {
    id: row.id || null,
    date: formatMonthShort(row.date),
    sections: row.sections || [],
    xpNote: row.xp_note || row.xpNote || '',
    warnings: row.warnings || [],
  }
  _state.coachQuestHints = Array.isArray(row.quest_hints) ? row.quest_hints : (_state.coachQuestHints || [])
  _state.coachSkillProgress = Array.isArray(row.skill_progress) ? row.skill_progress : (_state.coachSkillProgress || [])
  if (Array.isArray(row.warnings)) {
    _state.profile.survivalWarnings = row.warnings
  }
}

function _applySupabaseProfile(row) {
  if (!_state || !row) return
  const normalizedProfile = _normalizeProfileRow(row)
  _state.profile = {
    ..._state.profile,
    ...normalizedProfile,
  }
  _state.bodyMetrics = normalizedProfile.bodyMetrics || _state.bodyMetrics
}

function _unlockEarnedBadges(emit = false) {
  const newBadges = checkBadges(_state)
  if (!newBadges.length) return []

  _state.badges = (_state.badges || []).map(badge => {
    const earned = newBadges.find(item => item.id === badge.id)
    return earned ? { ...badge, earnedAt: earned.earnedAt, locked: false } : badge
  })

  if (emit) {
    _set(_state, '_newBadges', newBadges)
    _notify('_newBadges')
  }

  return newBadges
}

function _hydrateState(state) {
  const seed = _buildSeed()
  const merged = {
    ...seed,
    ...state,
    profile: {
      ...seed.profile,
      ...(state?.profile || {}),
      stats: {
        ...seed.profile.stats,
        ...(state?.profile?.stats || {}),
      },
      xp: {
        ...seed.profile.xp,
        ...(state?.profile?.xp || {}),
      },
      streak: {
        ...seed.profile.streak,
        ...(state?.profile?.streak || {}),
      },
    },
    workouts: (state?.workouts || seed.workouts).map(workout => _normalizeWorkoutRow(workout)),
    dailyLogs: (state?.dailyLogs || seed.dailyLogs).map(log => _normalizeDailyLog(log)),
    badges: _clone(state?.badges || seed.badges),
    globalStats: _clone(state?.globalStats || seed.globalStats),
    stats: _clone(state?.stats || seed.stats),
    performance: _clone(state?.performance || seed.performance),
    debuffs: _clone(state?.debuffs || seed.debuffs),
    muscleBalance: _clone(state?.muscleBalance || seed.muscleBalance),
    muscles: _clone(state?.muscles || seed.muscles),
    skills: _clone(state?.skills || seed.skills),
    health: _clone(state?.health || seed.health),
    quests: _clone(state?.quests || seed.quests),
    achievements: _clone(state?.achievements || seed.achievements),
    workoutLog: _clone(state?.workoutLog || seed.workoutLog),
    coachNote: _clone(state?.coachNote || seed.coachNote),
    coachQuestHints: _clone(state?.coachQuestHints || []),
    coachSkillProgress: _clone(state?.coachSkillProgress || []),
    bodyMetrics: _clone(state?.bodyMetrics || seed.bodyMetrics || {}),
    athleteMemory: (state?.athleteMemory || []).map(item => normalizeAthleteMemoryRow(item)),
    memoryFeedback: (state?.memoryFeedback || []).map(item => normalizeMemoryFeedbackRow(item)),
    bodyMetricsHistory: (state?.bodyMetricsHistory || []).map(item => normalizeBodyMetricsHistoryRow(item)),
    workoutBlocks: (state?.workoutBlocks || []).map(item => normalizeWorkoutBlockRow(item)),
    workoutFacts: (state?.workoutFacts || []).map(item => normalizeWorkoutFactRow(item)),
  }

  merged.bodyMetrics = _normalizeBodyMetrics(merged.bodyMetrics)

  const xp = _normalizeXpModel(merged.profile.xp, merged.profile.level)
  merged.profile.level = xp.level
  merged.profile.xp = { current: xp.current, max: xp.max, total: xp.total }
  _refreshDerivedState(merged)
  return merged
}

function _toSupabaseExercises(exercises = []) {
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

function _toSupabaseWorkout(workout) {
  return {
    profile_id: _state?.profile?.id || null,
    date: workout.date,
    type: workout.type,
    duration_min: workout.durationMin,
    volume_kg: workout.volumeKg,
    sets: workout.sets,
    highlight: workout.highlight || '',
    exercises: _toSupabaseExercises(workout.exercises),
    xp_earned: workout.xpEarned || 0,
    xp_multiplier: workout.xpMultiplier || 1,
    has_pr: Boolean(workout.hasPr),
    notes: workout.notes || '',
    primary_category: workout.primaryCategory,
    tags: workout.tags || [],
    intensity: workout.intensity,
    blocks: workout.blocks || [],
    source: workout.source || 'manual',
    distance_km: workout.distanceKm || 0,
    elevation_m: workout.elevationM || 0,
    class_mult: workout.classMult || 1,
    survival_status: workout.survivalStatus || 'healthy',
    stat_delta: workout.statDelta || {},
    created_at: workout.createdAt || new Date().toISOString(),
  }
}

function _toSupabaseProfile(profile, bodyMetrics = null) {
  return {
    nick: profile.nick,
    handle: profile.handle,
    rank: profile.rank,
    rank_icon: profile.rankIcon,
    class: profile.class,
    sub_class: profile.subClass,
    avatar: profile.avatar,
    level: profile.level,
    xp_current: profile.xp.current,
    xp_max: profile.xp.max,
    xp_total: profile.xp.total,
    sessions: profile.sessions,
    total_volume_kg: profile.totalVolumeKg,
    total_sets: profile.totalSets,
    total_minutes: profile.totalMinutes,
    total_km: profile.totalKm || 0,
    stats: profile.stats,
    streak_current: profile.streak?.current || 0,
    streak_max: profile.streak?.max || 0,
    last_workout_date: profile.streak?.lastWorkoutDate || null,
    armor_current: profile.armor ?? 100,
    fatigue_current: profile.fatigue ?? 0,
    consecutive_heavy: profile.consecutiveHeavy ?? 0,
    injury_until: profile.injuryUntil || null,
    survival_status: profile.survivalStatus || 'healthy',
    class_id: profile.classId || null,
    body_metrics: _normalizeBodyMetrics(bodyMetrics || {}),
  }
}

function _maybeRefreshPath(path) {
  return [
    'workouts',
    'dailyLogs',
    'profile.stats',
    'profile.xp',
    'profile.armor',
    'profile.fatigue',
    'profile.survivalWarnings',
    'bodyMetrics',
    'bodyMetricsHistory',
    'coachNote',
    'coachQuestHints',
    'coachSkillProgress',
  ].some(prefix => path === prefix || path.startsWith(`${prefix}.`))
}

function _mergeToProfile(state) {
  const profile = state.profile || {}
  return {
    ...seedProfile,
    nick: profile.nick,
    handle: profile.handle,
    rank: profile.rank,
    rankIcon: profile.rankIcon,
    class: profile.classObj?.name || profile.class,
    subClass: profile.classObj?.subName || profile.subClass,
    avatar: profile.avatar,
    level: profile.level,
    xp: profile.xp,
    sessions: profile.sessions,
    totalVolume: profile.totalVolume,
    totalSets: profile.totalSets,
    totalTime: profile.totalTime,
    streak: profile.streak,
    globalStats: state.globalStats,
    stats: state.stats,
    performance: state.performance,
    debuffs: state.debuffs,
    muscleBalance: state.muscleBalance,
    muscles: state.muscles,
    skills: state.skills,
    health: state.health,
    quests: state.quests,
    achievements: state.achievements,
    workoutLog: state.workoutLog,
    workouts: state.workouts,
    dailyLogs: state.dailyLogs,
    coachNote: state.coachNote,
    currentFocus: profile.currentFocus,
    bodyMetrics: state.bodyMetrics,
    athleteMemory: state.athleteMemory || [],
    memoryFeedback: state.memoryFeedback || [],
    bodyMetricsHistory: state.bodyMetricsHistory || [],
    workoutBlocks: state.workoutBlocks || [],
    workoutFacts: state.workoutFacts || [],
  }
}

async function _syncMemoryLayer() {
  if (!_state || isMockMode) return

  const [athleteMemoryRows, memoryFeedbackRows, bodyMetricsHistoryRows, workoutBlockRows, workoutFactRows] = await Promise.all([
    fetchAthleteMemory(24),
    fetchMemoryFeedback(24),
    fetchBodyMetricsHistory(30),
    fetchWorkoutBlocks(320),
    fetchWorkoutFacts(320),
  ])

  _state.athleteMemory = (athleteMemoryRows || []).map(item => normalizeAthleteMemoryRow(item))
  _state.memoryFeedback = (memoryFeedbackRows || []).map(item => normalizeMemoryFeedbackRow(item))
  _state.bodyMetricsHistory = (bodyMetricsHistoryRows || []).map(item => normalizeBodyMetricsHistoryRow(item))
  _state.workoutBlocks = (workoutBlockRows || []).map(item => normalizeWorkoutBlockRow(item))
  _state.workoutFacts = (workoutFactRows || []).map(item => normalizeWorkoutFactRow(item))
}

export const store = {
  async init() {
    try {
      ['odiept-state-v1', 'odiept-state-v2', 'odiept-state-v3', 'odiept-state-v4', 'odiept-state-v6', 'odiept-state-v7'].forEach(key => localStorage.removeItem(key))
    } catch {}

    const cached = _loadFromLS()
    _state = cached && cached._version === CURRENT_VERSION ? _hydrateState(cached) : _hydrateState(_buildSeed())
    _unlockEarnedBadges(false)

    if (!isMockMode) {
      try {
        await this.syncFromSupabase()
      } catch (error) {
        console.warn('[store] Supabase sync failed, using local state:', error.message)
      }

      _unsubSupabase.push(subscribeToProfile(async profileRow => {
        _applySupabaseProfile(profileRow)
        try { await _syncMemoryLayer() } catch {}
        _refreshDerivedState(_state)
        _unlockEarnedBadges(false)
        _saveToLS()
        _notify('*')
      }))

      _unsubSupabase.push(subscribeToWorkouts(async workoutRow => {
        const workoutId = String(workoutRow.id)
        if (_state.workouts.some(workout => String(workout.id) === workoutId)) return

        _state.workouts.unshift(_normalizeWorkoutRow(workoutRow))
        try { await _syncMemoryLayer() } catch {}
        _refreshDerivedState(_state)
        _unlockEarnedBadges(false)
        _saveToLS()
        _notify('*')

        try {
          const coachNote = await fetchLatestCoachNote()
          if (coachNote?.sections?.length) {
            _applyCoachNote(coachNote)
            _refreshDerivedState(_state)
            _saveToLS()
            _notify('*')
          }
        } catch {}
      }))

      _unsubSupabase.push(subscribeToCoachNotes(async coachRow => {
        if (!coachRow?.sections?.length) return
        _applyCoachNote(coachRow)
        try { await _syncMemoryLayer() } catch {}
        _refreshDerivedState(_state)
        _saveToLS()
        _notify('*')
        _set(_state, '_coachUpdated', coachRow)
        _notify('_coachUpdated')
      }))
    }

    _saveToLS()
    return _state
  },

  get(path) {
    return _get(_state, path)
  },

  set(path, value) {
    _set(_state, path, value)
    const needsRefresh = _maybeRefreshPath(path)
    if (needsRefresh) _refreshDerivedState(_state)
    _saveToLS()
    _notify(needsRefresh ? '*' : path)
  },

  getState() {
    return _state
  },

  getProfile() {
    return _mergeToProfile(_state || _buildSeed())
  },

  subscribe(path, fn) {
    if (!_subscribers.has(path)) _subscribers.set(path, new Set())
    _subscribers.get(path).add(fn)
    return () => this.unsubscribe(path, fn)
  },

  unsubscribe(path, fn) {
    _subscribers.get(path)?.delete(fn)
  },

  async addWorkout(session) {
    const normalized = normalizeSession(session, { source: session.source || 'manual' })
    const currentClass = _state.profile.classObj || computeClass(_state.workouts || [])
    const streak = computeStreakInfo(_state.workouts || [], normalized.date)
    const survival = applySurvival({
      armor: _state.profile.armor ?? 100,
      fatigue: _state.profile.fatigue ?? 0,
      consecutiveHeavy: _state.profile.consecutiveHeavy ?? 0,
      injuryUntil: _state.profile.injuryUntil || null,
    }, normalized, {
      armorRegen: classArmorRegen(currentClass),
      fatigueDecay: classFatigueDecay(currentClass),
    })

    const xpContext = {
      streakDays: streak.current,
      classMultiplier: classXpMult(currentClass, normalized.type),
      survivalMultiplier: survival.xpMultiplier,
      prBonusMultiplier: currentClass?.passive?.prBonus || 1,
      doubleSession: (_state.workouts || []).some(workout => normalizeDateString(workout.date) === normalized.date),
    }
    const xp = computeSessionXp(normalized, xpContext)
    const statDelta = computeSessionStatDelta(normalized)
    const nextStats = applyStatDelta(_state.profile.stats || {}, statDelta)

    const workout = {
      ...normalized,
      id: normalized.id || `w${Date.now()}`,
      xpEarned: xp.xpEarned,
      xpMultiplier: xp.streakMult,
      classMult: xpContext.classMultiplier,
      survivalStatus: survival.status,
      statDelta,
      createdAt: normalized.createdAt || new Date().toISOString(),
    }

    _state.workouts.unshift(workout)
    _state.profile.stats = nextStats
    _state.profile.streak = streak
    _state.profile.xp.total = (Number(_state.profile.xp.total) || 0) + xp.xpEarned
    _state.profile.armor = survival.armor
    _state.profile.fatigue = survival.fatigue
    _state.profile.consecutiveHeavy = survival.consecutiveHeavy
    _state.profile.injuryUntil = survival.injuryUntil
    _state.profile.survivalStatus = survival.status
    _state.profile.survivalWarnings = survival.warnings || []
    _state.profile.lastUpdated = new Date().toISOString()

    _refreshDerivedState(_state)
    const previousClassId = currentClass?.id
    const nextClass = _state.profile.classObj
    if (nextClass?.id && previousClassId && nextClass.id !== previousClassId) {
      _set(_state, '_classChanged', nextClass)
      _notify('_classChanged')
    }

    _unlockEarnedBadges(true)

    if (!isMockMode) {
      const inserted = await insertWorkout(_toSupabaseWorkout(workout))
      if (inserted?.id) workout.id = inserted.id
      await updateProfile(_toSupabaseProfile(_state.profile, _state.bodyMetrics))
    }

    _saveToLS()
    _notify('*')
    return workout
  },

  async deleteWorkout(id) {
    if (!id) return false
    const targetId = String(id)
    const index = (_state.workouts || []).findIndex(item => String(item.id) === targetId)
    if (index < 0) return false
    const removed = _state.workouts.splice(index, 1)[0]

    const xpRefund = Number(removed?.xpEarned) || 0
    if (xpRefund) {
      const total = Math.max(0, (Number(_state.profile.xp.total) || 0) - xpRefund)
      _state.profile.xp.total = total
    }
    _state.profile.lastUpdated = new Date().toISOString()

    _refreshDerivedState(_state)
    _saveToLS()
    _notify('*')

    if (!isMockMode) {
      try {
        await deleteWorkout(removed.id)
        await updateProfile(_toSupabaseProfile(_state.profile, _state.bodyMetrics))
      } catch (error) {
        console.warn('[store] deleteWorkout sync failed:', error.message)
      }
    }
    return true
  },

  async saveDailyLog(log) {
    const normalized = _normalizeDailyLog(log)
    const existingIndex = (_state.dailyLogs || []).findIndex(item => normalizeDateString(item.date) === normalized.date)
    if (existingIndex >= 0) _state.dailyLogs[existingIndex] = { ..._state.dailyLogs[existingIndex], ...normalized }
    else _state.dailyLogs.unshift(normalized)

    _refreshDerivedState(_state)
    _saveToLS()
    _notify('*')

    if (!isMockMode) {
      await upsertDailyLog({
        date: normalized.date,
        water_ml: normalized.waterMl,
        sleep_hours: normalized.sleepHours,
        steps: normalized.steps,
        mood: normalized.mood,
      })
    }

    return normalized
  },

  async syncFromSupabase() {
    const [profileRow, workoutRows, dailyLogRows, coachNoteRow] = await Promise.all([
      fetchProfile(),
      fetchWorkouts(200),
      fetchDailyLogs(45),
      fetchLatestCoachNote(),
    ])

    if (profileRow) _applySupabaseProfile(profileRow)
    if (Array.isArray(workoutRows) && workoutRows.length) _state.workouts = workoutRows.map(row => _normalizeWorkoutRow(row))
    if (Array.isArray(dailyLogRows) && dailyLogRows.length) _state.dailyLogs = dailyLogRows.map(row => _normalizeDailyLog(row))
    if (coachNoteRow?.sections?.length) _applyCoachNote(coachNoteRow)
    await _syncMemoryLayer()

    _refreshDerivedState(_state)
    _unlockEarnedBadges(false)
    _saveToLS()
    _notify('*')
  },

  async addMemoryFeedback({ feedbackType = 'correct', note = '', memoryId = null } = {}) {
    const payload = {
      coach_note_id: _state?.coachNote?.id || null,
      memory_id: memoryId || null,
      feedback_type: feedbackType,
      note: note || `${feedbackType} feedback`,
      created_at: new Date().toISOString(),
    }

    const normalized = normalizeMemoryFeedbackRow(payload)
    _state.memoryFeedback.unshift(normalized)
    _saveToLS()
    _notify('*')

    if (!isMockMode) {
      const inserted = await insertMemoryFeedback(payload)
      if (inserted?.id) {
        _state.memoryFeedback[0] = inserted
        _saveToLS()
        _notify('*')
      }
    }

    return normalized
  },

  export() {
    return JSON.stringify(_state, null, 2)
  },

  import(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      _state = _hydrateState({ ...data, _version: CURRENT_VERSION })
      _unlockEarnedBadges(false)
      _saveToLS()
      _notify('*')
    } catch (error) {
      console.error('[store] import error:', error)
    }
  },

  reset() {
    try {
      localStorage.removeItem(LS_KEY)
    } catch {}
    _state = _hydrateState(_buildSeed())
    _saveToLS()
    _notify('*')
  },

  destroy() {
    _unsubSupabase.forEach(unsub => unsub())
    _unsubSupabase = []
  },
}
