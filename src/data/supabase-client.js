import { createClient } from '@supabase/supabase-js'
import {
  normalizeAthleteMemoryRow,
  normalizeBodyMetricsHistoryRow,
  normalizeMemoryFeedbackRow,
  normalizeWorkoutBlockRow,
  normalizeWorkoutFactRow,
} from './memory-engine.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const PROFILE_ID_KEY = 'odiept-profile-id'

export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

export const isMockMode = !supabase

let _profileId = null
const LEGACY_DB_TYPES = new Set(['Push', 'Pull', 'Shoulder', 'Parkour', 'Akrobasi', 'Bacak', 'Yürüyüş', 'Stretching', 'Custom'])

function _loadProfileId() {
  if (_profileId) return _profileId
  try {
    _profileId = localStorage.getItem(PROFILE_ID_KEY) || null
  } catch {
    _profileId = null
  }
  return _profileId
}

function _saveProfileId(id) {
  if (!id) return
  _profileId = id
  try {
    localStorage.setItem(PROFILE_ID_KEY, id)
  } catch {}
}

async function _resolveProfileId() {
  const saved = _loadProfileId()
  if (saved) return saved
  const profile = await fetchProfile()
  return profile?.id || null
}

function _isMissingColumnError(error) {
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

function _normalizeLegacyType(type = 'Custom') {
  if (type === 'Yuruyus') return 'Yürüyüş'
  if (LEGACY_DB_TYPES.has(type)) return type
  return 'Custom'
}

function _legacyHighlight(workout = {}) {
  const originalType = workout.type || 'Custom'
  const normalizedType = _normalizeLegacyType(originalType)
  const highlight = String(workout.highlight || '').trim()
  if (normalizedType === originalType) return highlight
  return `[${originalType}] ${highlight}`.trim()
}

function _toLegacyWorkout(workout = {}) {
  return {
    profile_id: workout.profile_id,
    date: workout.date,
    type: _normalizeLegacyType(workout.type),
    duration_min: workout.duration_min,
    volume_kg: workout.volume_kg,
    sets: workout.sets,
    highlight: _legacyHighlight(workout),
    exercises: workout.exercises || [],
    xp_earned: workout.xp_earned,
    xp_multiplier: workout.xp_multiplier,
    has_pr: workout.has_pr,
  }
}

function _toLegacyProfilePatch(patch = {}) {
  return {
    nick: patch.nick,
    handle: patch.handle,
    rank: patch.rank,
    rank_icon: patch.rank_icon,
    class: patch.class,
    sub_class: patch.sub_class,
    avatar: patch.avatar,
    xp_current: patch.xp_current,
    xp_max: patch.xp_max,
    level: patch.level,
    sessions: patch.sessions,
    total_volume_kg: patch.total_volume_kg,
    total_sets: patch.total_sets,
    total_minutes: patch.total_minutes,
    stats: patch.stats,
    streak_current: patch.streak_current,
    streak_max: patch.streak_max,
    last_workout_date: patch.last_workout_date,
    last_updated: patch.last_updated,
  }
}

export async function fetchProfile() {
  if (isMockMode) return null

  const savedId = _loadProfileId()
  if (savedId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', savedId)
      .maybeSingle()
    if (!error && data) return data
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('last_updated', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('[supabase] fetchProfile:', error.message)
    return null
  }

  const profile = data?.[0] || null
  if (profile?.id) _saveProfileId(profile.id)
  return profile
}

export async function updateProfile(patch) {
  if (isMockMode) return
  const profileId = await _resolveProfileId()
  if (!profileId) return
  const payload = { ...patch, last_updated: new Date().toISOString() }
  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', profileId)
  if (!error) return

  if (_isMissingColumnError(error)) {
    const { error: legacyError } = await supabase
      .from('profiles')
      .update(_toLegacyProfilePatch(payload))
      .eq('id', profileId)
    if (!legacyError) return
    console.warn('[supabase] updateProfile legacy fallback:', legacyError.message)
    return
  }

  console.warn('[supabase] updateProfile:', error.message)
}

export async function fetchWorkouts(limit = 100) {
  if (isMockMode) return []
  const profileId = await _resolveProfileId()
  let query = supabase
    .from('workouts')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)
  if (profileId) query = query.eq('profile_id', profileId)
  const { data, error } = await query
  if (error) {
    console.warn('[supabase] fetchWorkouts:', error.message)
    return []
  }
  return data || []
}

export async function deleteWorkout(id) {
  if (isMockMode) return false
  if (!id) return false
  const profileId = await _resolveProfileId()
  let query = supabase.from('workouts').delete().eq('id', id)
  if (profileId) query = query.eq('profile_id', profileId)
  const { error } = await query
  if (error) {
    console.warn('[supabase] deleteWorkout:', error.message)
    return false
  }
  return true
}

export async function insertWorkout(workout) {
  if (isMockMode) return null
  const profileId = await _resolveProfileId()
  const payload = { ...workout, profile_id: workout.profile_id || profileId }
  const { data, error } = await supabase
    .from('workouts')
    .insert(payload)
    .select()
    .single()
  if (!error) return data

  if (_isMissingColumnError(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from('workouts')
      .insert(_toLegacyWorkout(payload))
      .select()
      .single()
    if (!legacyError) return legacyData
    console.warn('[supabase] insertWorkout legacy fallback:', legacyError.message)
    return null
  }

  console.warn('[supabase] insertWorkout:', error.message)
  return null
}

export async function fetchLatestCoachNote() {
  if (isMockMode) return null
  const profileId = await _resolveProfileId()
  let query = supabase
    .from('coach_notes')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
  if (profileId) query = query.eq('profile_id', profileId)
  const { data, error } = await query.maybeSingle()
  if (error) {
    console.warn('[supabase] fetchLatestCoachNote:', error.message)
    return null
  }
  return data
}

export async function fetchDailyLogs(limit = 30) {
  if (isMockMode) return []
  const profileId = await _resolveProfileId()
  let query = supabase
    .from('daily_logs')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)
  if (profileId) query = query.eq('profile_id', profileId)
  const { data, error } = await query
  if (error) {
    console.warn('[supabase] fetchDailyLogs:', error.message)
    return []
  }
  return data || []
}

export async function fetchAthleteMemory(limit = 24) {
  if (isMockMode) return []
  const profileId = await _resolveProfileId()
  let query = supabase
    .from('athlete_memory')
    .select('*')
    .eq('active', true)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (profileId) query = query.eq('profile_id', profileId)
  const { data, error } = await query
  if (error) {
    if (_isMissingColumnError(error)) return []
    console.warn('[supabase] fetchAthleteMemory:', error.message)
    return []
  }
  return (data || []).map(row => normalizeAthleteMemoryRow(row))
}

export async function fetchMemoryFeedback(limit = 20) {
  if (isMockMode) return []
  const profileId = await _resolveProfileId()
  let query = supabase
    .from('memory_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (profileId) query = query.eq('profile_id', profileId)
  const { data, error } = await query
  if (error) {
    if (_isMissingColumnError(error)) return []
    console.warn('[supabase] fetchMemoryFeedback:', error.message)
    return []
  }
  return (data || []).map(row => normalizeMemoryFeedbackRow(row))
}

export async function fetchBodyMetricsHistory(limit = 30) {
  if (isMockMode) return []
  const profileId = await _resolveProfileId()
  let query = supabase
    .from('body_metrics_history')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (profileId) query = query.eq('profile_id', profileId)
  const { data, error } = await query
  if (error) {
    if (_isMissingColumnError(error)) return []
    console.warn('[supabase] fetchBodyMetricsHistory:', error.message)
    return []
  }
  return (data || []).map(row => normalizeBodyMetricsHistoryRow(row))
}

export async function fetchWorkoutBlocks(limit = 240) {
  if (isMockMode) return []
  const profileId = await _resolveProfileId()
  let query = supabase
    .from('workout_blocks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (profileId) query = query.eq('profile_id', profileId)
  const { data, error } = await query
  if (error) {
    if (_isMissingColumnError(error)) return []
    console.warn('[supabase] fetchWorkoutBlocks:', error.message)
    return []
  }
  return (data || []).map(row => normalizeWorkoutBlockRow(row))
}

export async function fetchWorkoutFacts(limit = 240) {
  if (isMockMode) return []
  const profileId = await _resolveProfileId()
  let query = supabase
    .from('workout_facts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (profileId) query = query.eq('profile_id', profileId)
  const { data, error } = await query
  if (error) {
    if (_isMissingColumnError(error)) return []
    console.warn('[supabase] fetchWorkoutFacts:', error.message)
    return []
  }
  return (data || []).map(row => normalizeWorkoutFactRow(row))
}

export async function fetchTodayLog(date) {
  if (isMockMode) return null
  const profileId = await _resolveProfileId()
  let query = supabase
    .from('daily_logs')
    .select('*')
    .eq('date', date)
    .limit(1)
  if (profileId) query = query.eq('profile_id', profileId)
  const { data, error } = await query.maybeSingle()
  if (error) return null
  return data
}

export async function upsertDailyLog(log) {
  if (isMockMode) return
  const profileId = await _resolveProfileId()
  await supabase.from('daily_logs').upsert({ ...log, profile_id: profileId }, { onConflict: 'date,profile_id' })
}

export async function insertMemoryFeedback(feedback) {
  if (isMockMode) return null
  const profileId = await _resolveProfileId()
  const payload = { ...feedback, profile_id: feedback.profile_id || profileId }
  const { data, error } = await supabase
    .from('memory_feedback')
    .insert(payload)
    .select()
    .single()
  if (error) {
    if (_isMissingColumnError(error)) return null
    console.warn('[supabase] insertMemoryFeedback:', error.message)
    return null
  }
  return normalizeMemoryFeedbackRow(data)
}

export function subscribeToProfile(onUpdate) {
  if (isMockMode) return () => {}
  const channel = supabase
    .channel('odiept-profile')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
      if (_profileId && payload.new?.id && payload.new.id !== _profileId) return
      if (payload.new?.id) _saveProfileId(payload.new.id)
      onUpdate(payload.new)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeToWorkouts(onInsert) {
  if (isMockMode) return () => {}
  const channel = supabase
    .channel('odiept-workouts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workouts' }, payload => {
      if (_profileId && payload.new?.profile_id && payload.new.profile_id !== _profileId) return
      onInsert(payload.new)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeToCoachNotes(onInsert) {
  if (isMockMode) return () => {}
  const channel = supabase
    .channel('odiept-coach-notes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coach_notes' }, payload => {
      if (_profileId && payload.new?.profile_id && payload.new.profile_id !== _profileId) return
      onInsert(payload.new)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}
