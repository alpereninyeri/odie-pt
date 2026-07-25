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

test('snapshot auth is public by default and optional when configured', () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  delete process.env.ODIE_APP_ACCESS_TOKEN
  assert.equal(appAuthConfigured(), false)
  assert.deepEqual(authorizeAppRequest({ headers: {} }), { ok: false, configured: false })

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
    await snapshotHandler({ method: 'GET', headers: {}, query: {} }, publicRes)
    assert.equal(publicRes.statusCode, 200)
    assert.equal(publicRes.body.ok, true)
    assert.equal(publicRes.body.profile.nick, 'Alperen')
    assert.equal(publicRes.body.workouts[0].id, 'hevy-w1')
    assert.equal(publicRes.body.workouts[0].exercises[0].name, 'Bench Press (Barbell)')
    assert.equal(publicRes.body.workouts[0].notes, undefined)
    assert.equal(publicRes.body.workouts[0].rawExternal, undefined)
    assert.deepEqual(publicRes.body.source, { hevy: 'live-direct', storage: 'none' })
    assert.equal(publicRes.body.privacy, 'public-summary')
    assert.equal(publicRes.headers['X-Odie-Data-Source'], 'hevy-direct')
    assert.equal(fetchCalls, 3)

    process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
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
    assert.equal(privateRes.headers['Cache-Control'], 'private, no-store')
  } finally {
    global.fetch = previousFetch
    restoreEnv('ODIE_APP_ACCESS_TOKEN', previousToken)
    restoreEnv('HEVY_API_KEY', previousHevyKey)
    resetSnapshotCacheForTest()
  }
})
