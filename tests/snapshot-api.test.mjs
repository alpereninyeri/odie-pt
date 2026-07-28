import assert from 'node:assert/strict'
import test from 'node:test'

import { appAuthConfigured, authorizeAppRequest } from '../lib/app-auth.js'
import snapshotHandler, { resetSnapshotCacheForTest } from '../api/snapshot.js'

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
    setHeader(key, value) {
      this.headers[key] = value
      return this
    },
  }
}

function restoreEnv(name, value) {
  if (value == null) delete process.env[name]
  else process.env[name] = value
}

test('snapshot endpoint fails closed when app auth is not configured', async () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  delete process.env.ODIE_APP_ACCESS_TOKEN
  assert.equal(appAuthConfigured(), false)
  assert.deepEqual(authorizeAppRequest({ headers: {} }), { ok: false, configured: false })
  const unconfiguredRes = createMockRes()
  await snapshotHandler({ method: 'GET', headers: {}, query: {} }, unconfiguredRes)
  assert.equal(unconfiguredRes.statusCode, 503)
  assert.equal(unconfiguredRes.body.error, 'app_auth_not_configured')
  assert.match(unconfiguredRes.headers['Cache-Control'], /private/)
  assert.match(unconfiguredRes.headers['Cache-Control'], /no-store/)

  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  assert.equal(appAuthConfigured(), true)
  assert.equal(authorizeAppRequest({ headers: {} }).ok, false)
  assert.equal(authorizeAppRequest({ headers: { authorization: 'Bearer secret' } }).ok, true)
  assert.equal(authorizeAppRequest({ headers: { 'x-odie-token': 'secret' } }).ok, true)
  assert.equal(authorizeAppRequest({ headers: {}, query: { token: 'secret' } }).ok, false)
  restoreEnv('ODIE_APP_ACCESS_TOKEN', previous)
})

test('snapshot reads Hevy directly without exposing private workout fields', async () => {
  const previousToken = process.env.ODIE_APP_ACCESS_TOKEN
  const previousHevyKey = process.env.HEVY_API_KEY
  const previousFetch = global.fetch

  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  process.env.HEVY_API_KEY = 'hevy-key'
  let fetchCalls = 0
  global.fetch = async url => {
    fetchCalls += 1
    const requestUrl = String(url)
    if (requestUrl.includes('/v1/workouts/count')) {
      return { ok: true, json: async () => ({ workout_count: 1 }) }
    }
    if (requestUrl.includes('/v1/user/info')) {
      return {
        ok: true,
        json: async () => ({ data: { name: 'Alperen', url: 'https://hevy.com/user/senuzulme27' } }),
      }
    }
    if (requestUrl.includes('/v1/exercise_templates')) {
      return {
        ok: true,
        json: async () => ({
          page: 1,
          page_count: 1,
          exercise_templates: [{
            id: 'bench-template',
            primary_muscle_group: 'chest',
            secondary_muscle_groups: ['triceps'],
          }],
        }),
      }
    }
    if (requestUrl.includes('/v1/workouts?')) {
      return {
        ok: true,
        json: async () => ({
          page: 1,
          page_count: 1,
          workouts: [{
            id: 'hevy-w1',
            title: 'Push',
            description: 'private note',
            start_time: '2026-06-25T08:00:00Z',
            end_time: '2026-06-25T09:00:00Z',
            created_at: '2026-06-25T09:01:00Z',
            exercises: [{
              title: 'Bench Press (Barbell)',
              exercise_template_id: 'bench-template',
              notes: 'private exercise note',
              sets: [{ weight_kg: 80, reps: 8 }],
            }],
          }],
        }),
      }
    }
    throw new Error(`unexpected fetch ${requestUrl}`)
  }

  try {
    resetSnapshotCacheForTest()
    const lockedRes = createMockRes()
    await snapshotHandler({ method: 'GET', headers: {}, query: {} }, lockedRes)
    assert.equal(lockedRes.statusCode, 401)
    assert.equal(lockedRes.body.error, 'unauthorized')

    const privateRes = createMockRes()
    await snapshotHandler({
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
      query: {},
    }, privateRes)
    assert.equal(privateRes.statusCode, 200)
    assert.equal(privateRes.body.ok, true)
    assert.equal(privateRes.body.profile.nick, 'Alperen')
    assert.equal(privateRes.body.workouts[0].id, 'hevy-w1')
    assert.equal(privateRes.body.workouts[0].exercises[0].name, 'Bench Press (Barbell)')
    assert.equal(privateRes.body.workouts[0].notes, undefined)
    assert.equal(privateRes.body.workouts[0].rawExternal, undefined)
    assert.equal(privateRes.body.source.hevy, 'live-direct')
    assert.equal(privateRes.body.source.storage, 'none')
    assert.equal(privateRes.body.source.mapping, 'hevy-template')
    assert.equal(privateRes.body.privacy, 'private-athlete')
    assert.equal(privateRes.headers['X-Odie-Data-Source'], 'hevy-direct')
    assert.match(privateRes.headers['Cache-Control'], /private/)
    assert.match(privateRes.headers['Cache-Control'], /no-store/)
    assert.equal(privateRes.headers.Vary, 'Authorization, X-Odie-Token')
    assert.equal(fetchCalls, 4)
  } finally {
    global.fetch = previousFetch
    restoreEnv('ODIE_APP_ACCESS_TOKEN', previousToken)
    restoreEnv('HEVY_API_KEY', previousHevyKey)
    resetSnapshotCacheForTest()
  }
})

test('a small response cannot poison the full-history snapshot cache', async () => {
  const previousToken = process.env.ODIE_APP_ACCESS_TOKEN
  const previousHevyKey = process.env.HEVY_API_KEY
  const previousFetch = global.fetch

  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  process.env.HEVY_API_KEY = 'hevy-key'
  let pageFetches = 0

  const workout = index => ({
    id: `hevy-${index}`,
    title: 'Full body',
    start_time: `2026-07-${String(25 - index).padStart(2, '0')}T08:00:00Z`,
    end_time: `2026-07-${String(25 - index).padStart(2, '0')}T09:00:00Z`,
    exercises: [{
      title: 'Bench Press (Barbell)',
      sets: [{ weight_kg: 60, reps: 8 }],
    }],
  })
  const allWorkouts = Array.from({ length: 12 }, (_, index) => workout(index))

  global.fetch = async url => {
    const requestUrl = new URL(String(url))
    if (requestUrl.pathname === '/v1/workouts/count') {
      return { ok: true, json: async () => ({ workout_count: 12 }) }
    }
    if (requestUrl.pathname === '/v1/user/info') {
      return {
        ok: true,
        json: async () => ({ data: { name: 'Alperen' } }),
      }
    }
    if (requestUrl.pathname === '/v1/workouts') {
      pageFetches += 1
      const page = Number(requestUrl.searchParams.get('page'))
      return {
        ok: true,
        json: async () => ({
          page,
          page_count: 2,
          workouts: page === 1 ? allWorkouts.slice(0, 10) : allWorkouts.slice(10),
        }),
      }
    }
    throw new Error(`unexpected fetch ${requestUrl}`)
  }

  try {
    resetSnapshotCacheForTest()
    const compactRes = createMockRes()
    await snapshotHandler({
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
      query: { workouts: '10' },
    }, compactRes)
    assert.equal(compactRes.statusCode, 200)
    assert.equal(compactRes.body.workouts.length, 10)
    assert.equal(compactRes.body.profile.sessions, 12)
    assert.equal(compactRes.body.syncState.fetched_workouts, 12)
    assert.equal(compactRes.body.syncState.returned_workouts, 10)

    const fullRes = createMockRes()
    await snapshotHandler({
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
      query: { workouts: '120' },
    }, fullRes)
    assert.equal(fullRes.statusCode, 200)
    assert.equal(fullRes.body.workouts.length, 12)
    assert.equal(fullRes.body.syncState.returned_workouts, 12)
    assert.equal(pageFetches, 2)
  } finally {
    global.fetch = previousFetch
    restoreEnv('ODIE_APP_ACCESS_TOKEN', previousToken)
    restoreEnv('HEVY_API_KEY', previousHevyKey)
    resetSnapshotCacheForTest()
  }
})

test('manual refresh bypasses CDN cache and reports whether sync time advanced', async () => {
  const previousToken = process.env.ODIE_APP_ACCESS_TOKEN
  const previousHevyKey = process.env.HEVY_API_KEY
  const previousFetch = global.fetch

  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  process.env.HEVY_API_KEY = 'hevy-key'
  let fetchCalls = 0
  global.fetch = async url => {
    fetchCalls += 1
    const requestUrl = String(url)
    if (requestUrl.includes('/v1/workouts/count')) {
      return { ok: true, json: async () => ({ workout_count: 1 }) }
    }
    if (requestUrl.includes('/v1/user/info')) {
      return { ok: true, json: async () => ({ data: { name: 'Alperen' } }) }
    }
    return {
      ok: true,
      json: async () => ({
        page: 1,
        page_count: 1,
        workouts: [{
          id: 'hevy-refresh-1',
          title: 'Push',
          start_time: '2026-07-25T08:00:00Z',
          end_time: '2026-07-25T09:00:00Z',
          exercises: [{
            title: 'Bench Press (Barbell)',
            sets: [{ weight_kg: 80, reps: 8 }],
          }],
        }],
      }),
    }
  }

  try {
    resetSnapshotCacheForTest()
    const refreshedRes = createMockRes()
    await snapshotHandler({
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
      query: { workouts: '10', refresh: '1', refresh_nonce: 'first' },
    }, refreshedRes)

    assert.equal(refreshedRes.statusCode, 200)
    assert.match(refreshedRes.headers['Cache-Control'], /private/)
    assert.match(refreshedRes.headers['Cache-Control'], /no-store/)
    assert.equal(refreshedRes.headers['X-Odie-Refresh'], 'fetched')
    assert.equal(refreshedRes.body.syncState.refresh_requested, true)
    assert.equal(refreshedRes.body.syncState.refresh_performed, true)
    assert.equal(refreshedRes.body.syncState.last_synced_at_advanced, true)
    assert.equal(refreshedRes.body.syncState.refresh_reason, 'fetched')
    assert.equal(fetchCalls, 4)

    const currentRes = createMockRes()
    await snapshotHandler({
      method: 'GET',
      headers: { authorization: 'Bearer secret' },
      query: { workouts: '10', refresh: '1', refresh_nonce: 'second' },
    }, currentRes)

    assert.equal(currentRes.statusCode, 200)
    assert.match(currentRes.headers['Cache-Control'], /private/)
    assert.match(currentRes.headers['Cache-Control'], /no-store/)
    assert.equal(currentRes.headers['X-Odie-Refresh'], 'throttled')
    assert.equal(currentRes.body.syncState.refresh_requested, true)
    assert.equal(currentRes.body.syncState.refresh_performed, false)
    assert.equal(currentRes.body.syncState.last_synced_at_advanced, false)
    assert.equal(currentRes.body.syncState.refresh_reason, 'throttled')
    assert.equal(fetchCalls, 4)
  } finally {
    global.fetch = previousFetch
    restoreEnv('ODIE_APP_ACCESS_TOKEN', previousToken)
    restoreEnv('HEVY_API_KEY', previousHevyKey)
    resetSnapshotCacheForTest()
  }
})
