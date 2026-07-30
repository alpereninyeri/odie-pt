import assert from 'node:assert/strict'
import test from 'node:test'

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

test('snapshot endpoint is public read-only and only requires Hevy configuration', async () => {
  const previousHevyKey = process.env.HEVY_API_KEY
  delete process.env.HEVY_API_KEY
  const unconfiguredRes = createMockRes()
  await snapshotHandler({ method: 'GET', headers: {}, query: {} }, unconfiguredRes)
  assert.equal(unconfiguredRes.statusCode, 500)
  assert.equal(unconfiguredRes.body.error, 'HEVY_API_KEY env eksik')
  assert.match(unconfiguredRes.headers['Cache-Control'], /private/)
  assert.match(unconfiguredRes.headers['Cache-Control'], /no-store/)
  assert.equal(unconfiguredRes.headers.Vary, undefined)
  restoreEnv('HEVY_API_KEY', previousHevyKey)
})

test('snapshot reads Hevy publicly without exposing raw workout fields', async () => {
  const previousToken = process.env.ODIE_APP_ACCESS_TOKEN
  const previousHevyKey = process.env.HEVY_API_KEY
  const previousFetch = global.fetch

  delete process.env.ODIE_APP_ACCESS_TOKEN
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
    const publicRes = createMockRes()
    await snapshotHandler({
      method: 'GET',
      headers: {},
      query: {},
    }, publicRes)
    assert.equal(publicRes.statusCode, 200)
    assert.equal(publicRes.body.ok, true)
    assert.equal(publicRes.body.profile.nick, 'Alperen')
    assert.equal(publicRes.body.workouts[0].id, 'hevy-w1')
    assert.equal(publicRes.body.workouts[0].exercises[0].name, 'Bench Press (Barbell)')
    assert.equal(publicRes.body.workouts[0].notes, undefined)
    assert.equal(publicRes.body.workouts[0].rawExternal, undefined)
    assert.equal(publicRes.body.source.hevy, 'live-direct')
    assert.equal(publicRes.body.source.storage, 'none')
    assert.equal(publicRes.body.source.mapping, 'hevy-template')
    assert.equal(publicRes.body.privacy, 'public-readonly')
    assert.equal(publicRes.headers['X-Odie-Data-Source'], 'hevy-direct')
    assert.match(publicRes.headers['Cache-Control'], /private/)
    assert.match(publicRes.headers['Cache-Control'], /no-store/)
    assert.equal(publicRes.headers.Vary, undefined)
    assert.equal(fetchCalls, 4)
  } finally {
    global.fetch = previousFetch
    restoreEnv('ODIE_APP_ACCESS_TOKEN', previousToken)
    restoreEnv('HEVY_API_KEY', previousHevyKey)
    resetSnapshotCacheForTest()
  }
})

test('a small response cannot poison the full-history snapshot cache', async () => {
  const previousHevyKey = process.env.HEVY_API_KEY
  const previousFetch = global.fetch

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
      headers: {},
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
      headers: {},
      query: { workouts: '120' },
    }, fullRes)
    assert.equal(fullRes.statusCode, 200)
    assert.equal(fullRes.body.workouts.length, 12)
    assert.equal(fullRes.body.syncState.returned_workouts, 12)
    assert.equal(pageFetches, 2)
  } finally {
    global.fetch = previousFetch
    restoreEnv('HEVY_API_KEY', previousHevyKey)
    resetSnapshotCacheForTest()
  }
})

test('manual refresh bypasses CDN cache and reports whether sync time advanced', async () => {
  const previousHevyKey = process.env.HEVY_API_KEY
  const previousFetch = global.fetch

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
      headers: {},
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
      headers: {},
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
    restoreEnv('HEVY_API_KEY', previousHevyKey)
    resetSnapshotCacheForTest()
  }
})
