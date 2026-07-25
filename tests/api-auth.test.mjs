import assert from 'node:assert/strict'
import test from 'node:test'

import { authorizeAppRequest, requireAppAccess } from '../api/app-auth.js'
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

test('app auth fails closed when ODIE_APP_ACCESS_TOKEN is not configured', () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  delete process.env.ODIE_APP_ACCESS_TOKEN
  assert.equal(authorizeAppRequest({ headers: {} }).ok, false)
  assert.equal(authorizeAppRequest({ headers: {} }).configured, false)
  if (previous != null) process.env.ODIE_APP_ACCESS_TOKEN = previous
})

test('app auth accepts bearer or app header token only when configured', () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  assert.equal(authorizeAppRequest({ headers: { authorization: 'Bearer wrong' } }).ok, false)
  assert.equal(authorizeAppRequest({ headers: { authorization: 'Bearer secret' } }).ok, true)
  assert.equal(authorizeAppRequest({ headers: { 'x-odie-token': 'secret' } }).ok, true)
  assert.equal(authorizeAppRequest({ headers: {}, query: { token: 'secret' } }).ok, false)
  assert.equal(authorizeAppRequest({ headers: {}, query: { secret: 'secret' } }).ok, false)
  if (previous == null) delete process.env.ODIE_APP_ACCESS_TOKEN
  else process.env.ODIE_APP_ACCESS_TOKEN = previous
})

test('requireAppAccess reports missing app token instead of opening the route', () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  delete process.env.ODIE_APP_ACCESS_TOKEN
  const res = createMockRes()
  assert.equal(requireAppAccess({ headers: {}, query: {} }, res), false)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error, 'app token is required')
  if (previous != null) process.env.ODIE_APP_ACCESS_TOKEN = previous
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

test('private app endpoints rate limit repeated unauthorized attempts before data access', async () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  const uniqueIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`
  const { default: bodyEventsHandler } = await import('../api/body-events.js')
  const { default: nextSessionHandler } = await import('../api/next-session.js')

  let bodyRes = null
  for (let i = 0; i < 91; i += 1) {
    bodyRes = createMockRes()
    await bodyEventsHandler({ method: 'GET', headers: { 'x-forwarded-for': uniqueIp }, query: {} }, bodyRes)
  }
  assert.equal(bodyRes.statusCode, 429)
  assert.equal(bodyRes.body.error, 'rate_limited')

  let nextRes = null
  for (let i = 0; i < 91; i += 1) {
    nextRes = createMockRes()
    await nextSessionHandler({ method: 'GET', headers: { 'x-forwarded-for': `${uniqueIp}-next` }, query: {} }, nextRes)
  }
  assert.equal(nextRes.statusCode, 429)
  assert.equal(nextRes.body.error, 'rate_limited')

  if (previous == null) delete process.env.ODIE_APP_ACCESS_TOKEN
  else process.env.ODIE_APP_ACCESS_TOKEN = previous
})

test('personal API endpoints fail closed when app token is not configured', async () => {
  const previous = process.env.ODIE_APP_ACCESS_TOKEN
  delete process.env.ODIE_APP_ACCESS_TOKEN
  const { default: askHandler } = await import('../api/ask.js')
  const { default: bodyEventsHandler } = await import('../api/body-events.js')
  const { default: nextSessionHandler } = await import('../api/next-session.js')

  const askRes = createMockRes()
  await askHandler({ method: 'GET', headers: {}, query: {} }, askRes)
  assert.equal(askRes.statusCode, 401)
  assert.equal(askRes.body.error, 'ask token is required')

  const bodyRes = createMockRes()
  await bodyEventsHandler({ method: 'GET', headers: {}, query: {} }, bodyRes)
  assert.equal(bodyRes.statusCode, 401)
  assert.equal(bodyRes.body.error, 'body-events token is required')

  const nextRes = createMockRes()
  await nextSessionHandler({ method: 'GET', headers: {}, query: {} }, nextRes)
  assert.equal(nextRes.statusCode, 401)
  assert.equal(nextRes.body.error, 'next-session token is required')

  if (previous == null) delete process.env.ODIE_APP_ACCESS_TOKEN
  else process.env.ODIE_APP_ACCESS_TOKEN = previous
})

test('health status redacts personal Apple details unless app token is provided', async () => {
  const previousToken = process.env.ODIE_APP_ACCESS_TOKEN
  const previousUrl = process.env.VITE_SUPABASE_URL
  const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const previousFetch = global.fetch
  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'

  global.fetch = async url => {
    const requestUrl = String(url)
    if (requestUrl.includes('/profiles?')) {
      return { ok: true, json: async () => [{ id: 'profile-1', last_updated: '2026-06-25T08:00:00Z' }] }
    }
    if (requestUrl.includes('/health_daily_summary?')) {
      return {
        ok: true,
        json: async () => [{
          day: '2026-06-25',
          sleep_hours: 7.25,
          hrv_sdnn: 52,
          resting_heart_rate: 58,
          updated_at: '2026-06-25T07:00:00Z',
        }],
      }
    }
    if (requestUrl.includes('/health_telemetry?')) {
      return { ok: true, json: async () => [{ kind: 'heart', metric_type: 'hrvSdnn', day: '2026-06-25', created_at: '2026-06-25T07:05:00Z' }] }
    }
    if (requestUrl.includes('/ingest_events?')) {
      return { ok: true, json: async () => [{ id: 'evt-1', source: 'apple_health', operation: 'import', status: 'failed', error: 'raw secret details', created_at: '2026-06-25T07:10:00Z' }] }
    }
    if (requestUrl.includes('/workouts?') && requestUrl.includes('source=eq.apple_health')) {
      return {
        ok: true,
        json: async () => [{
          id: 'apple-w1',
          date: '2026-06-25',
          type: 'Hiking',
          duration_min: 42,
          distance_km: 4.2,
          source: 'apple_health',
          created_at: '2026-06-25T08:00:00Z',
        }],
      }
    }
    if (requestUrl.includes('/body_events?')) {
      return { ok: true, json: async () => [{ id: 'body-1' }] }
    }
    return { ok: true, json: async () => [] }
  }

  const { default: healthStatusHandler } = await import('../api/health-status.js')
  const publicRes = createMockRes()
  await healthStatusHandler({ method: 'GET', headers: {}, query: {} }, publicRes)
  assert.equal(publicRes.statusCode, 200)
  assert.equal(publicRes.body.dailySummary, null)
  assert.equal(publicRes.body.lastAppleWorkout, null)
  assert.equal(publicRes.body.lastSyncAt, null)
  assert.equal(publicRes.body.sources.appleSleep, 'private')
  assert.equal(publicRes.body.sources.appleHeart, 'private')
  assert.equal(publicRes.body.truthMap.summary, null)
  assert.equal('recentEvents' in publicRes.body, false)
  assert.equal('telemetryPreview' in publicRes.body, false)
  assert.equal('lastError' in publicRes.body, false)

  const privateRes = createMockRes()
  await healthStatusHandler({ method: 'GET', headers: { authorization: 'Bearer secret' }, query: {} }, privateRes)
  assert.equal(privateRes.statusCode, 200)
  assert.equal(privateRes.body.dailySummary.totalSleepHours, 7.25)
  assert.equal(privateRes.body.lastAppleWorkout.id, 'apple-w1')
  assert.equal(privateRes.body.sources.appleSleep, 'linked')
  assert.equal(privateRes.body.lastError.error, 'redacted')
  assert.equal(privateRes.body.recentEvents[0].error, 'redacted')
  assert.equal(privateRes.body.telemetryPreview[0].metricType, 'hrvSdnn')

  global.fetch = previousFetch
  if (previousToken == null) delete process.env.ODIE_APP_ACCESS_TOKEN
  else process.env.ODIE_APP_ACCESS_TOKEN = previousToken
  if (previousUrl == null) delete process.env.VITE_SUPABASE_URL
  else process.env.VITE_SUPABASE_URL = previousUrl
  if (previousServiceKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey
})

test('snapshot endpoint is token gated and returns the dashboard data bundle', async () => {
  const previousToken = process.env.ODIE_APP_ACCESS_TOKEN
  const previousUrl = process.env.VITE_SUPABASE_URL
  const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const previousFetch = global.fetch
  const { default: snapshotHandler } = await import('../api/snapshot.js')

  delete process.env.ODIE_APP_ACCESS_TOKEN
  const noTokenRes = createMockRes()
  await snapshotHandler({ method: 'GET', headers: {}, query: {} }, noTokenRes)
  assert.equal(noTokenRes.statusCode, 401)
  assert.equal(noTokenRes.body.error, 'snapshot token is required')

  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  let fetchCalls = 0
  global.fetch = async () => {
    fetchCalls += 1
    return { ok: true, json: async () => [] }
  }
  const noServiceRes = createMockRes()
  await snapshotHandler({ method: 'GET', headers: { authorization: 'Bearer secret' }, query: {} }, noServiceRes)
  assert.equal(noServiceRes.statusCode, 500)
  assert.equal(noServiceRes.body.error, 'Supabase service env eksik')
  assert.equal(fetchCalls, 0)

  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  global.fetch = async url => {
    fetchCalls += 1
    const requestUrl = String(url)
    if (requestUrl.includes('/profiles?')) {
      return { ok: true, json: async () => [{ id: 'profile-1', level: 4, last_updated: '2026-06-25T08:00:00Z' }] }
    }
    if (requestUrl.includes('/workouts?')) {
      return { ok: true, json: async () => [{ id: 'w1', profile_id: 'profile-1', date: '2026-06-25', type: 'Push', source: 'hevy' }] }
    }
    if (requestUrl.includes('/hevy_sync_state?')) {
      return { ok: true, json: async () => [{ profile_id: 'profile-1', last_synced_at: '2026-06-25T08:15:00Z' }] }
    }
    return { ok: true, json: async () => [] }
  }

  const okRes = createMockRes()
  await snapshotHandler({ method: 'GET', headers: { authorization: 'Bearer secret' }, query: {} }, okRes)
  assert.equal(okRes.statusCode, 200)
  assert.equal(okRes.body.ok, true)
  assert.equal(okRes.body.profile.id, 'profile-1')
  assert.equal(okRes.body.workouts[0].id, 'w1')
  assert.equal(okRes.body.syncState.last_synced_at, '2026-06-25T08:15:00Z')
  assert.deepEqual(okRes.body.source, { hevy: 'missing' })
  assert.equal('latestCoachNote' in okRes.body, false)
  assert.equal('athleteMemory' in okRes.body, false)

  global.fetch = previousFetch
  if (previousToken == null) delete process.env.ODIE_APP_ACCESS_TOKEN
  else process.env.ODIE_APP_ACCESS_TOKEN = previousToken
  if (previousUrl == null) delete process.env.VITE_SUPABASE_URL
  else process.env.VITE_SUPABASE_URL = previousUrl
  if (previousServiceKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey
})

test('body events API fails closed when table is missing', async () => {
  const previousToken = process.env.ODIE_APP_ACCESS_TOKEN
  const previousUrl = process.env.VITE_SUPABASE_URL
  const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const previousFetch = global.fetch
  process.env.ODIE_APP_ACCESS_TOKEN = 'secret'
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'

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
  await bodyEventsHandler({ method: 'GET', headers: { authorization: 'Bearer secret' }, query: {} }, res)

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
  if (previousServiceKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey
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

test('telegram webhook fails closed without secret and chat allowlist', async () => {
  const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const previousChat = process.env.TELEGRAM_CHAT_ID
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
  const { default: telegramHandler } = await import('../api/telegram.js')

  const missingSecretRes = createMockRes()
  await telegramHandler({ method: 'POST', headers: {}, body: { message: { text: '/start', chat: { id: 1 } } } }, missingSecretRes)
  assert.equal(missingSecretRes.statusCode, 500)
  assert.equal(missingSecretRes.body.error, 'telegram webhook secret is required')

  process.env.TELEGRAM_WEBHOOK_SECRET = 'telegram-secret'
  const invalidSecretRes = createMockRes()
  await telegramHandler({
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
    body: { message: { text: '/start', chat: { id: 1 } } },
  }, invalidSecretRes)
  assert.equal(invalidSecretRes.statusCode, 401)
  assert.equal(invalidSecretRes.body.error, 'unauthorized')

  const missingChatRes = createMockRes()
  await telegramHandler({
    method: 'POST',
    headers: { 'x-telegram-bot-api-secret-token': 'telegram-secret' },
    body: { message: { text: '/start', chat: { id: 1 } } },
  }, missingChatRes)
  assert.equal(missingChatRes.statusCode, 500)
  assert.equal(missingChatRes.body.error, 'telegram chat id is required')

  if (previousSecret == null) delete process.env.TELEGRAM_WEBHOOK_SECRET
  else process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret
  if (previousChat == null) delete process.env.TELEGRAM_CHAT_ID
  else process.env.TELEGRAM_CHAT_ID = previousChat
})

test('telegram webhook rate limits repeated secret failures', async () => {
  const previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const previousChat = process.env.TELEGRAM_CHAT_ID
  process.env.TELEGRAM_WEBHOOK_SECRET = 'telegram-secret'
  process.env.TELEGRAM_CHAT_ID = '1'
  const { default: telegramHandler } = await import('../api/telegram.js')

  let res = null
  for (let i = 0; i < 41; i += 1) {
    res = createMockRes()
    await telegramHandler({
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.77',
        'x-telegram-bot-api-secret-token': `wrong-${i}`,
      },
      body: { message: { text: '/start', chat: { id: 1 } } },
    }, res)
  }
  assert.equal(res.statusCode, 429)
  assert.equal(res.body.error, 'rate_limited')

  if (previousSecret == null) delete process.env.TELEGRAM_WEBHOOK_SECRET
  else process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret
  if (previousChat == null) delete process.env.TELEGRAM_CHAT_ID
  else process.env.TELEGRAM_CHAT_ID = previousChat
})

test('hevy maintenance routes reject query string secrets in production', async () => {
  const previousHevy = process.env.HEVY_INTERNAL_SECRET
  const previousCron = process.env.CRON_SECRET
  const previousNodeEnv = process.env.NODE_ENV
  process.env.HEVY_INTERNAL_SECRET = 'hevy-secret'
  delete process.env.CRON_SECRET
  process.env.NODE_ENV = 'production'
  const { default: hevySyncHandler } = await import('../api/hevy-sync.js')
  const { default: hevyBackfillHandler } = await import('../api/hevy-backfill.js')
  const { default: hevyWebhookHandler } = await import('../api/hevy-webhook.js')

  const syncRes = createMockRes()
  await hevySyncHandler({ method: 'GET', headers: {}, query: { secret: 'hevy-secret' } }, syncRes)
  assert.equal(syncRes.statusCode, 401)
  assert.equal(syncRes.body.error, 'unauthorized')

  const backfillRes = createMockRes()
  await hevyBackfillHandler({ method: 'POST', headers: {}, query: { secret: 'hevy-secret' } }, backfillRes)
  assert.equal(backfillRes.statusCode, 401)
  assert.equal(backfillRes.body.error, 'unauthorized')

  const previousWebhook = process.env.HEVY_WEBHOOK_SECRET
  process.env.HEVY_WEBHOOK_SECRET = 'hevy-secret'
  const webhookRes = createMockRes()
  await hevyWebhookHandler({ method: 'POST', headers: {}, query: { secret: 'hevy-secret' }, body: { id: 'w1' } }, webhookRes)
  assert.equal(webhookRes.statusCode, 401)
  assert.equal(webhookRes.body.error, 'gecersiz secret')

  if (previousHevy == null) delete process.env.HEVY_INTERNAL_SECRET
  else process.env.HEVY_INTERNAL_SECRET = previousHevy
  if (previousWebhook == null) delete process.env.HEVY_WEBHOOK_SECRET
  else process.env.HEVY_WEBHOOK_SECRET = previousWebhook
  if (previousCron == null) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = previousCron
  if (previousNodeEnv == null) delete process.env.NODE_ENV
  else process.env.NODE_ENV = previousNodeEnv
})
