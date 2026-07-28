import { appAuthConfigured, authorizeAppRequest } from '../lib/app-auth.js'
import {
  buildDirectHevySnapshot,
  resetHevyTemplateCacheForTest,
} from '../lib/hevy/dashboard-snapshot.js'

const CACHE_TTL_MS = 5 * 60 * 1000
const MIN_FORCE_AGE_MS = 60 * 1000

let cache = null
let inFlight = null

function asLimit(value, fallback = 120, max = 160) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(10, Math.min(max, Math.round(numeric)))
}

function cacheHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('Vary', 'Authorization, X-Odie-Token')
}

function syncTimestamp(payload = {}) {
  return payload?.syncState?.last_synced_at || null
}

function timestampAdvanced(before, after) {
  const afterTime = Date.parse(after || '')
  if (!Number.isFinite(afterTime)) return false
  const beforeTime = Date.parse(before || '')
  return !Number.isFinite(beforeTime) || afterTime > beforeTime
}

function refreshOutcome({
  requested = false,
  performed = false,
  previousPayload = null,
  payload = null,
  reason = '',
} = {}) {
  if (!requested) return null
  const advanced = Boolean(performed)
    && timestampAdvanced(syncTimestamp(previousPayload), syncTimestamp(payload))
  return {
    requested: true,
    performed: Boolean(performed),
    last_synced_at_advanced: advanced,
    reason: reason || (advanced ? 'fetched' : performed ? 'fetched_not_advanced' : 'throttled'),
  }
}

function withResponseLimit(payload, workoutLimit, refresh = null) {
  const workouts = Array.isArray(payload.workouts)
    ? payload.workouts.slice(0, workoutLimit)
    : []
  return {
    ...payload,
    workouts,
    syncState: payload.syncState
      ? {
          ...payload.syncState,
          returned_workouts: workouts.length,
          ...(refresh
            ? {
                refresh_requested: refresh.requested,
                refresh_performed: refresh.performed,
                last_synced_at_advanced: refresh.last_synced_at_advanced,
                refresh_reason: refresh.reason,
              }
            : {}),
        }
      : payload.syncState,
  }
}

function sendSnapshot(res, payload, {
  force = false,
  stale = false,
  workoutLimit = 120,
  refresh = null,
} = {}) {
  cacheHeaders(res)
  res.setHeader('X-Odie-Data-Source', stale ? 'hevy-stale-cache' : 'hevy-direct')
  if (refresh) res.setHeader('X-Odie-Refresh', refresh.reason)
  const responsePayload = withResponseLimit(payload, workoutLimit, refresh)
  return res.status(200).json(stale
    ? {
        ...responsePayload,
        stale: true,
        source: { ...responsePayload.source, hevy: 'stale-cache' },
      }
    : responsePayload)
}

export function resetSnapshotCacheForTest() {
  cache = null
  inFlight = null
  resetHevyTemplateCacheForTest()
}

export default async function handler(req, res) {
  cacheHeaders(res)
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'GET gerekli' })
  }
  if (!appAuthConfigured()) {
    return res.status(503).json({ ok: false, error: 'app_auth_not_configured' })
  }
  if (!authorizeAppRequest(req).ok) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  if (!process.env.HEVY_API_KEY) {
    return res.status(500).json({ ok: false, error: 'HEVY_API_KEY env eksik' })
  }

  const now = Date.now()
  const workoutLimit = asLimit(req.query?.workouts)
  const forceRequested = String(req.query?.refresh || '') === '1'
  const cacheAge = cache ? now - cache.fetchedAt : Number.POSITIVE_INFINITY
  const force = forceRequested && cacheAge >= MIN_FORCE_AGE_MS
  const previousPayload = cache?.payload || null

  if (cache && !force && cacheAge < CACHE_TTL_MS) {
    const refresh = refreshOutcome({
      requested: forceRequested,
      performed: false,
      previousPayload,
      payload: cache.payload,
      reason: forceRequested ? 'throttled' : '',
    })
    return sendSnapshot(res, cache.payload, {
      force: forceRequested,
      workoutLimit,
      refresh,
    })
  }

  try {
    let startedFetch = false
    if (!inFlight) {
      startedFetch = true
      inFlight = buildDirectHevySnapshot()
        .then(payload => {
          cache = { payload, fetchedAt: Date.now() }
          return payload
        })
        .finally(() => {
          inFlight = null
        })
    }
    const payload = await inFlight
    const refresh = refreshOutcome({
      requested: forceRequested,
      performed: forceRequested,
      previousPayload,
      payload,
      reason: forceRequested
        ? startedFetch ? 'fetched' : 'joined_inflight'
        : '',
    })
    return sendSnapshot(res, payload, {
      force: forceRequested,
      workoutLimit,
      refresh,
    })
  } catch (error) {
    console.error('[snapshot] Hevy direct fetch failed:', error?.message || error)
    if (cache?.payload) {
      const refresh = refreshOutcome({
        requested: forceRequested,
        performed: false,
        previousPayload,
        payload: cache.payload,
        reason: forceRequested ? 'upstream_failed' : '',
      })
      return sendSnapshot(res, cache.payload, {
        force: forceRequested,
        stale: true,
        workoutLimit,
        refresh,
      })
    }
    cacheHeaders(res)
    return res.status(502).json({ ok: false, error: 'hevy_snapshot_failed' })
  }
}
