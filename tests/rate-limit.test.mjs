import assert from 'node:assert/strict'
import test from 'node:test'

import { consumeRateLimit } from '../api/rate-limit.js'

test('rate limiter allows a small burst then blocks by route and client key', () => {
  const req = { headers: { authorization: 'Bearer test-rate-token' } }
  const first = consumeRateLimit(req, { id: `unit-${Date.now()}`, limit: 2, windowMs: 60_000 })
  const second = consumeRateLimit(req, { id: `unit-${Date.now()}-separate`, limit: 2, windowMs: 60_000 })
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)

  const id = `unit-bucket-${Date.now()}`
  assert.equal(consumeRateLimit(req, { id, limit: 2, windowMs: 60_000 }).ok, true)
  assert.equal(consumeRateLimit(req, { id, limit: 2, windowMs: 60_000 }).ok, true)
  const blocked = consumeRateLimit(req, { id, limit: 2, windowMs: 60_000 })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.retryAfter > 0, true)
})

test('rate limiter prefers forwarded IP over varying auth headers', () => {
  const id = `unit-ip-${Date.now()}`
  const first = {
    headers: {
      'x-forwarded-for': '203.0.113.9',
      authorization: 'Bearer token-a',
    },
  }
  const second = {
    headers: {
      'x-forwarded-for': '203.0.113.9',
      authorization: 'Bearer token-b',
    },
  }

  assert.equal(consumeRateLimit(first, { id, limit: 1, windowMs: 60_000 }).ok, true)
  assert.equal(consumeRateLimit(second, { id, limit: 1, windowMs: 60_000 }).ok, false)
})
