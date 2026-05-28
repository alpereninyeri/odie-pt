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
