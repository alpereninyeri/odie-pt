// Supabase client — credentials .env'den alınır
// VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY .env dosyasına ekle
// Örnek: VITE_SUPABASE_URL=https://xxxx.supabase.co
//        VITE_SUPABASE_ANON_KEY=eyJ...

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Credentials eksikse mock modda çalış (offline geliştirme için)
export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

export const isMockMode = !supabase

// ── Profil ──────────────────────────────────────────────────────────────────

export async function fetchProfile() {
  if (isMockMode) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single()
  if (error) { console.warn('[supabase] fetchProfile:', error.message); return null }
  return data
}

export async function updateProfile(patch) {
  if (isMockMode) return
  await supabase.from('profiles').update({ ...patch, last_updated: new Date().toISOString() }).neq('id', '')
}

// ── Workouts ─────────────────────────────────────────────────────────────────

export async function fetchWorkouts(limit = 100) {
  if (isMockMode) return []
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)
  if (error) { console.warn('[supabase] fetchWorkouts:', error.message); return [] }
  return data
}

export async function insertWorkout(workout) {
  if (isMockMode) return null
  const { data, error } = await supabase.from('workouts').insert(workout).select().single()
  if (error) { console.warn('[supabase] insertWorkout:', error.message); return null }
  return data
}

// ── Coach Notes ──────────────────────────────────────────────────────────────

export async function fetchLatestCoachNote() {
  if (isMockMode) return null
  const { data, error } = await supabase
    .from('coach_notes')
    .select('*')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) { console.warn('[supabase] fetchLatestCoachNote:', error.message); return null }
  return data
}

// ── Daily Logs ───────────────────────────────────────────────────────────────

export async function fetchTodayLog(date) {
  if (isMockMode) return null
  const { data } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  return data
}

export async function upsertDailyLog(log) {
  if (isMockMode) return
  await supabase.from('daily_logs').upsert(log, { onConflict: 'date,profile_id' })
}

// ── Realtime ─────────────────────────────────────────────────────────────────

export function subscribeToProfile(onUpdate) {
  if (isMockMode) return () => {}
  const channel = supabase
    .channel('odiept-profile')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
      onUpdate(payload.new)
    })
    .subscribe()
  // Unsubscribe fonksiyonu döndür
  return () => supabase.removeChannel(channel)
}

export function subscribeToWorkouts(onInsert) {
  if (isMockMode) return () => {}
  const channel = supabase
    .channel('odiept-workouts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workouts' }, payload => {
      onInsert(payload.new)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}
