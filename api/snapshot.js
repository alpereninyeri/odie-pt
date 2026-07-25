import { appAuthConfigured, authorizeAppRequest } from '../lib/app-auth.js'
import { buildDirectHevySnapshot } from '../lib/hevy/dashboard-snapshot.js'

const CACHE_TTL_MS = 5 * 60 * 1000
const MIN_FORCE_AGE_MS = 60 * 1000

let cache = null
let inFlight = null

function asLimit(value, fallback = 120, max = 160) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(10, Math.min(max, Math.round(numeric)))
}

function cacheHeaders(res, { force = false } = {}) {
  if (appAuthConfigured()) {
    res.setHeader('Cache-Control', 'private, no-store')
    return
  }
  res.setHeader(
    'Cache-Control',
    force
      ? 'public, s-maxage=60, stale-while-revalidate=600'
      : 'public, s-maxage=300, stale-while-revalidate=3600',
  )
}

function sendSnapshot(res, payload, { force = false, stale = false } = {}) {
  cacheHeaders(res, { force })
  res.setHeader('X-Odie-Data-Source', stale ? 'hevy-stale-cache' : 'hevy-direct')
  return res.status(200).json(stale
    ? {
        ...payload,
        stale: true,
        source: { ...payload.source, hevy: 'stale-cache' },
      }
    : payload)
}

export function resetSnapshotCacheForTest() {
  cache = null
  inFlight = null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'GET gerekli' })
  }
  if (appAuthConfigured() && !authorizeAppRequest(req).ok) {
    return res.status(401).json({ ok: false, error: 'unauthorized' })
  }
  if (!process.env.HEVY_API_KEY) {
    return res.status(500).json({ ok: false, error: 'HEVY_API_KEY env eksik' })
  }

  const now = Date.now()
  const forceRequested = String(req.query?.refresh || '') === '1'
  const cacheAge = cache ? now - cache.fetchedAt : Number.POSITIVE_INFINITY
  const force = forceRequested && cacheAge >= MIN_FORCE_AGE_MS

  if (cache && !force && cacheAge < CACHE_TTL_MS) {
    return sendSnapshot(res, cache.payload, { force: forceRequested })
  }

  try {
    if (!inFlight) {
      const workoutLimit = asLimit(req.query?.workouts)
      inFlight = buildDirectHevySnapshot({ workoutLimit })
        .then(payload => {
          cache = { payload, fetchedAt: Date.now() }
          return payload
        })
        .finally(() => {
          inFlight = null
        })
    }
    const payload = await inFlight
    return sendSnapshot(res, payload, { force: forceRequested })
  } catch (error) {
    console.error('[snapshot] Hevy direct fetch failed:', error?.message || error)
    if (cache?.payload) {
      return sendSnapshot(res, cache.payload, { force: forceRequested, stale: true })
    }
    return res.status(502).json({ ok: false, error: 'hevy_snapshot_failed' })
  }
}
