import { MOCK_STATE } from './mock-state.js'
import { appHeaders, hasAppAccessToken } from './app-access.js'
import { normalizeSession } from './rules.js'

const CACHE_KEY = 'odiept-dashboard-cache-v2'
const CACHE_SCHEMA_VERSION = 2
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_WORKOUTS = 120

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function validPayloadShape(payload, { requireOk = false } = {}) {
  if (!isObject(payload)) return false
  if (requireOk && payload.ok !== true) return false
  if (!isObject(payload.profile) || !Array.isArray(payload.workouts)) return false
  if (payload.syncState != null && !isObject(payload.syncState)) return false
  return true
}

function readCache(now = Date.now()) {
  try {
    const value = localStorage.getItem(CACHE_KEY)
    if (!value) return null
    const envelope = JSON.parse(value)
    const cachedAt = Date.parse(envelope?.cachedAt || '')
    const ageMs = now - cachedAt
    if (
      envelope?.schemaVersion !== CACHE_SCHEMA_VERSION
      || !Number.isFinite(cachedAt)
      || ageMs < -5 * 60 * 1000
      || ageMs > CACHE_TTL_MS
      || !validPayloadShape(envelope.payload)
    ) {
      return null
    }
    return {
      payload: envelope.payload,
      cachedAt: envelope.cachedAt,
      cacheAgeMs: Math.max(0, ageMs),
    }
  } catch {
    return null
  }
}

function writeCache(value) {
  if (!validPayloadShape(value) || value.mode === 'demo') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      schemaVersion: CACHE_SCHEMA_VERSION,
      cachedAt: new Date().toISOString(),
      payload: value,
    }))
  } catch {}
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem('odiept-dashboard-cache-v1')
  } catch {}
}

function timestampAdvanced(before, after) {
  const afterTime = Date.parse(after || '')
  if (!Number.isFinite(afterTime)) return false
  const beforeTime = Date.parse(before || '')
  return !Number.isFinite(beforeTime) || afterTime > beforeTime
}

function buildRefreshOutcome(snapshot = {}, previousLastSyncedAt = null) {
  const syncState = snapshot.syncState || {}
  const lastSyncedAt = syncState.last_synced_at
    || syncState.lastSyncedAt
    || snapshot.profile?.last_updated
    || null
  const timestampDidAdvance = timestampAdvanced(previousLastSyncedAt, lastSyncedAt)
  const performed = typeof syncState.refresh_performed === 'boolean'
    ? syncState.refresh_performed
    : timestampDidAdvance
  const advanced = typeof syncState.last_synced_at_advanced === 'boolean'
    ? syncState.last_synced_at_advanced
    : performed && timestampDidAdvance

  return {
    requested: true,
    performed,
    advanced,
    reason: syncState.refresh_reason || (advanced ? 'fetched' : 'already_current'),
    previousLastSyncedAt,
    lastSyncedAt,
  }
}

function normalizeWorkout(row = {}) {
  const workout = normalizeSession({
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
    source: row.source || row.external_source || 'hevy',
    createdAt: row.createdAt || row.created_at,
    startedAt: row.startedAt || row.started_at,
    elevationM: row.elevationM ?? row.elevation_m,
    distanceKm: row.distanceKm ?? row.distance_km,
    tags: row.tags || [],
    primaryCategory: row.primaryCategory ?? row.primary_category,
    intensity: row.intensity,
  }, { source: row.source || row.external_source || 'hevy' })

  return {
    ...workout,
    id: row.id || workout.id || `${workout.date}-${workout.type}`,
    startedAt: row.startedAt || row.started_at || null,
    xpEarned: Number(row.xpEarned ?? row.xp_earned) || 0,
    hasPr: Boolean(row.hasPr ?? row.has_pr ?? workout.hasPr),
    source: row.source || row.external_source || workout.source || 'hevy',
  }
}

function normalizeProfile(row = {}) {
  const xpCurrent = Number(row.xp?.current ?? row.xp_current) || 0
  const xpMax = Number(row.xp?.max ?? row.xp_max) || 2000
  const classTrack = row.classTrack && typeof row.classTrack === 'object'
    ? row.classTrack
    : row.class_track && typeof row.class_track === 'object'
      ? row.class_track
      : null
  return {
    id: row.id || null,
    nick: row.nick || 'Sporcu',
    handle: row.handle || '@senuzulme27',
    level: Number(row.level) || 1,
    rank: row.rank || 'Başlangıç',
    className: row.className || row.class || 'Hybrid Athlete',
    displayTitle: row.displayTitle || row.display_title || classTrack?.displayTitle || '',
    classTrack,
    subClass: row.subClass || row.sub_class || '',
    xp: { current: xpCurrent, max: xpMax },
    stats: row.stats || {},
    streak: {
      current: Number(row.streak?.current ?? row.streak_current) || 0,
      max: Number(row.streak?.max ?? row.streak_max) || 0,
      lastWorkoutDate: row.streak?.lastWorkoutDate || row.last_workout_date || null,
    },
    sessions: Number(row.sessions) || 0,
    totalVolumeKg: Number(row.totalVolumeKg ?? row.total_volume_kg) || 0,
    totalSets: Number(row.totalSets ?? row.total_sets) || 0,
    totalMinutes: Number(row.totalMinutes ?? row.total_minutes) || 0,
    armor: Number(row.armor ?? row.armor_current) || 100,
    fatigue: Number(row.fatigue ?? row.fatigue_current) || 0,
    survivalStatus: row.survivalStatus || row.survival_status || 'healthy',
    lastUpdated: row.lastUpdated || row.last_updated || null,
  }
}

function normalizePayload(payload = {}, fallbackMode = 'live') {
  const workouts = (payload.workouts || [])
    .map(normalizeWorkout)
    .filter(workout => workout.date)
    .sort((left, right) => String(right.startedAt || right.date).localeCompare(String(left.startedAt || left.date)))

  return {
    profile: normalizeProfile(payload.profile || {}),
    workouts,
    syncState: payload.syncState || null,
    source: payload.source || { hevy: 'configured' },
    privacy: payload.privacy || 'private-athlete',
    mode: fallbackMode,
    lastSyncedAt:
      payload.syncState?.last_synced_at
      || payload.syncState?.lastSyncedAt
      || payload.profile?.last_updated
      || null,
    cachedAt: null,
    cacheAgeMs: null,
  }
}

function demoPayload() {
  const sourceWorkouts = Array.isArray(MOCK_STATE.workouts) ? MOCK_STATE.workouts : []
  const latestDate = sourceWorkouts
    .map(workout => String(workout.date || '').slice(0, 10))
    .filter(Boolean)
    .sort()
    .at(-1)
  const target = new Date()
  target.setHours(12, 0, 0, 0)
  target.setDate(target.getDate() - 1)
  const latest = latestDate ? new Date(`${latestDate}T12:00:00`) : target
  const shiftDays = Math.round((target.getTime() - latest.getTime()) / 86_400_000)
  const workouts = sourceWorkouts.map(workout => {
    const date = new Date(`${String(workout.date || latestDate).slice(0, 10)}T12:00:00`)
    date.setDate(date.getDate() + shiftDays)
    return { ...workout, date: date.toISOString().slice(0, 10) }
  })

  return normalizePayload({
    profile: MOCK_STATE.profile,
    workouts,
    source: { hevy: 'demo' },
  }, 'demo')
}

let state = {
  ...demoPayload(),
  status: 'booting',
  error: '',
  syncSummary: null,
  refreshOutcome: null,
}

const listeners = new Set()

function emit() {
  for (const listener of listeners) listener(state)
}

async function readJson(response, fallback) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || fallback)
  }
  if (!validPayloadShape(payload, { requireOk: true })) {
    throw new Error('snapshot_invalid')
  }
  return payload
}

export const dashboardStore = {
  getState() {
    return state
  },

  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  async init() {
    const cached = hasAppAccessToken() ? readCache() : null
    if (cached) {
      state = {
        ...normalizePayload(cached.payload, 'cache'),
        cachedAt: cached.cachedAt,
        cacheAgeMs: cached.cacheAgeMs,
        status: 'syncing',
        error: '',
        syncSummary: null,
        refreshOutcome: null,
      }
    } else {
      state = { ...state, status: 'syncing', refreshOutcome: null }
    }
    emit()

    try {
      await this.refresh()
    } catch {}
    return state
  },

  async refresh({ pullHevy = false } = {}) {
    const previousLastSyncedAt = state.lastSyncedAt || null
    state = { ...state, status: 'syncing', error: '', syncSummary: null, refreshOutcome: null }
    emit()

    try {
      const params = new URLSearchParams({ workouts: String(MAX_WORKOUTS) })
      if (pullHevy) {
        params.set('refresh', '1')
        params.set('refresh_nonce', Date.now().toString(36))
      }
      const snapshotResponse = await fetch(`/api/snapshot?${params}`, {
        headers: appHeaders(),
      })
      const snapshot = await readJson(snapshotResponse, 'snapshot_failed')
      const normalized = normalizePayload(snapshot, 'live')
      const refreshOutcome = pullHevy
        ? buildRefreshOutcome(snapshot, previousLastSyncedAt)
        : null
      const refreshFailed = refreshOutcome?.reason === 'upstream_failed'
      state = {
        ...normalized,
        status: refreshFailed ? 'error' : 'ready',
        error: refreshFailed ? 'refresh_failed' : '',
        syncSummary: pullHevy
          ? {
              refreshed: Boolean(refreshOutcome?.advanced),
              fetched: Number(snapshot.syncState?.fetched_workouts) || normalized.workouts.length,
              reason: refreshOutcome?.reason || 'already_current',
              lastSyncedAt: refreshOutcome?.lastSyncedAt || normalized.lastSyncedAt,
            }
          : null,
        refreshOutcome,
      }
      writeCache(normalized)
      emit()
      return state
    } catch (error) {
      state = {
        ...state,
        status: 'error',
        mode: state.mode === 'demo'
          ? 'demo'
          : state.workouts?.length
            ? 'cache'
            : state.mode,
        error: String(error?.message || error || 'sync_failed'),
        refreshOutcome: pullHevy
          ? {
              requested: true,
              performed: false,
              advanced: false,
              reason: 'request_failed',
              previousLastSyncedAt,
              lastSyncedAt: state.lastSyncedAt || null,
            }
          : null,
      }
      emit()
      throw error
    }
  },

  clearCache,
}

export const dashboardStoreInternals = {
  CACHE_KEY,
  CACHE_SCHEMA_VERSION,
  CACHE_TTL_MS,
  clearCache,
  normalizePayload,
  readCache,
  validPayloadShape,
  writeCache,
}
