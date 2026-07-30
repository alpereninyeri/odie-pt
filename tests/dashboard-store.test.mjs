import assert from 'node:assert/strict'
import test from 'node:test'

import { dashboardStoreInternals } from '../src/data/dashboard-store.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

test('dashboard cache uses a versioned envelope and rejects stale payloads', () => {
  const previous = globalThis.localStorage
  globalThis.localStorage = memoryStorage()
  const now = Date.parse('2026-07-29T12:00:00.000Z')
  const payload = {
    profile: { nick: 'Alperen' },
    workouts: [],
    syncState: { last_synced_at: '2026-07-29T11:55:00.000Z' },
    mode: 'live',
  }

  try {
    dashboardStoreInternals.writeCache(payload)
    const fresh = dashboardStoreInternals.readCache(Date.now())
    assert.equal(fresh.payload.profile.nick, 'Alperen')
    assert.equal(fresh.payload.mode, 'live')

    localStorage.setItem(dashboardStoreInternals.CACHE_KEY, JSON.stringify({
      schemaVersion: dashboardStoreInternals.CACHE_SCHEMA_VERSION,
      cachedAt: new Date(now - dashboardStoreInternals.CACHE_TTL_MS - 1).toISOString(),
      payload,
    }))
    assert.equal(dashboardStoreInternals.readCache(now), null)
  } finally {
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  }
})

test('dashboard cache rejects wrong schema and malformed snapshot shapes', () => {
  const previous = globalThis.localStorage
  globalThis.localStorage = memoryStorage()
  const now = Date.parse('2026-07-29T12:00:00.000Z')

  try {
    localStorage.setItem(dashboardStoreInternals.CACHE_KEY, JSON.stringify({
      schemaVersion: 1,
      cachedAt: new Date(now).toISOString(),
      payload: { profile: {}, workouts: [] },
    }))
    assert.equal(dashboardStoreInternals.readCache(now), null)

    localStorage.setItem(dashboardStoreInternals.CACHE_KEY, JSON.stringify({
      schemaVersion: dashboardStoreInternals.CACHE_SCHEMA_VERSION,
      cachedAt: new Date(now).toISOString(),
      payload: { profile: {}, workouts: 'not-an-array' },
    }))
    assert.equal(dashboardStoreInternals.readCache(now), null)
    assert.equal(
      dashboardStoreInternals.validPayloadShape({ ok: true, profile: {}, workouts: [] }, { requireOk: true }),
      true,
    )
  } finally {
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  }
})

test('malformed sync metadata never gets a fabricated fresh timestamp', () => {
  const normalized = dashboardStoreInternals.normalizePayload({
    profile: { nick: 'Alperen' },
    workouts: [],
  })

  assert.equal(normalized.lastSyncedAt, null)
})

test('dashboard cache exposes a purge primitive', () => {
  const previous = globalThis.localStorage
  globalThis.localStorage = memoryStorage()
  try {
    localStorage.setItem(dashboardStoreInternals.CACHE_KEY, 'private-data')
    localStorage.setItem('odiept-dashboard-cache-v1', 'legacy-private-data')
    dashboardStoreInternals.clearCache()
    assert.equal(localStorage.getItem(dashboardStoreInternals.CACHE_KEY), null)
    assert.equal(localStorage.getItem('odiept-dashboard-cache-v1'), null)
  } finally {
    if (previous === undefined) delete globalThis.localStorage
    else globalThis.localStorage = previous
  }
})
