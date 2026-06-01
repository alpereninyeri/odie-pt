import assert from 'node:assert/strict'
import test from 'node:test'

import { authorizeAppRequest } from '../api/app-auth.js'
import { summarizeFeedbackLoop } from '../src/data/memory-engine.js'

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

test('app auth is open when ODIE_APP_ACCESS_TOKEN is not configured', () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  delete process.env.ODIE_APP_ACCESS_TOKEN
  assert.equal(authorizeAppRequest({ headers: {} }).ok, true)
  if (previous != null) process.env.ODIE_APP_ACCESS_TOKEN = previous
})

test('app auth accepts bearer token only when configured', () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  assert.equal(authorizeAppRequest({ headers: { authorization: 'Bearer wrong' } }).ok, false)
  assert.equal(authorizeAppRequest({ headers: { authorization: 'Bearer secret' } }).ok, true)
  if (previous == null) delete process.env.ODIE_APP_ACCESS_TOKEN
  else process.env.ODIE_APP_ACCESS_TOKEN = previous
})

test('tone_good feedback counts as prefer', () => {
  const summary = summarizeFeedbackLoop([
    { feedbackType: 'tone_good', createdAt: '2026-05-28T10:00:00Z' },
    { feedbackType: 'prefer', createdAt: '2026-05-28T10:01:00Z' },
  ])
  assert.equal(summary.prefer, 2)
})

test('private app endpoints reject missing app token when configured', async () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  const { default: askHandler } = await import('../api/ask.js')
  const { default: bodyEventsHandler } = await import('../api/body-events.js')

  const askRes = createMockRes()
  await askHandler({ method: 'GET', headers: {}, query: {} }, askRes)
  assert.equal(askRes.statusCode, 401)
  assert.equal(askRes.body.error, 'unauthorized')

  const bodyRes = createMockRes()
  await bodyEventsHandler({ method: 'GET', headers: {}, query: {} }, bodyRes)
  assert.equal(bodyRes.statusCode, 401)
  assert.equal(bodyRes.body.error, 'unauthorized')

  if (previous == null) delete process.env.ODIE_APP_ACCESS_TOKEN
  else process.env.ODIE_APP_ACCESS_TOKEN = previous
})

test('body events API fails closed when table is missing', async () => {
  const previousToken = process.env.ODIE_APP_ACCESS_TOKEN
  const previousUrl = process.env.VITE_SUPABASE_URL
  const previousKey = process.env.VITE_SUPABASE_ANON_KEY
  const previousFetch = global.fetch
  delete process.env.ODIE_APP_ACCESS_TOKEN
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.VITE_SUPABASE_ANON_KEY = 'anon'

  let calls = 0
  global.fetch = async url => {
    calls += 1
    if (String(url).includes('/profiles?')) {
      return { ok: true, json: async () => [{ id: 'profile-1' }] }
    }
    return {
      ok: false,
      text: async () => '{"code":"42P01","message":"relation public.body_events does not exist"}',
    }
  }

  const { default: bodyEventsHandler } = await import('../api/body-events.js')
  const res = createMockRes()
  await bodyEventsHandler({ method: 'GET', headers: {}, query: {} }, res)

  assert.equal(calls, 2)
  assert.equal(res.statusCode, 503)
  assert.equal(res.body.ok, false)
  assert.equal(res.body.error, 'body_events_missing')
  assert.equal(res.body.schemaReady, false)

  global.fetch = previousFetch
  if (previousToken == null) delete process.env.ODIE_APP_ACCESS_TOKEN
  else process.env.ODIE_APP_ACCESS_TOKEN = previousToken
  if (previousUrl == null) delete process.env.VITE_SUPABASE_URL
  else process.env.VITE_SUPABASE_URL = previousUrl
  if (previousKey == null) delete process.env.VITE_SUPABASE_ANON_KEY
  else process.env.VITE_SUPABASE_ANON_KEY = previousKey
})

test('intake endpoint fails closed without app token', async () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  delete process.env.ODIE_APP_ACCESS_TOKEN
  const { default: intakeHandler } = await import('../api/intake.js')
  const res = createMockRes()
  await intakeHandler({ method: 'POST', headers: {}, query: {}, body: { mode: 'preview', text: 'bench 65kg 3x5' } }, res)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error, 'intake token is required')
  if (previous == null) delete process.env.ODIE_APP_ACCESS_TOKEN
  else process.env.ODIE_APP_ACCESS_TOKEN = previous
})

test('hevy sync rejects unauthenticated cron calls', async () => {
  const previousHevy = process.env.HEVY_INTERNAL_SECRET
  const previousCron = process.env.CRON_SECRET
  process.env.HEVY_INTERNAL_SECRET = 'hevy-secret'
  delete process.env.CRON_SECRET
  const { default: hevySyncHandler } = await import('../api/hevy-sync.js')

  const res = createMockRes()
  await hevySyncHandler({ method: 'GET', headers: {}, query: {} }, res)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error, 'unauthorized')

  if (previousHevy == null) delete process.env.HEVY_INTERNAL_SECRET
  else process.env.HEVY_INTERNAL_SECRET = previousHevy
  if (previousCron == null) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = previousCron
})
