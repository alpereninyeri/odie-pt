import assert from 'node:assert/strict'
import test from 'node:test'

import { runLiveSmoke } from '../scripts/live-smoke.mjs'

function jsonResponse(status, body) {
  return {
    status,
    text: async () => JSON.stringify(body),
  }
}

function textResponse(status, body) {
  return {
    status,
    text: async () => body,
  }
}

test('live smoke passes the Hevy-only protected production contract', async () => {
  const result = await runLiveSmoke({
    baseUrl: 'https://example.test',
    fetchImpl: async url => {
      const path = new URL(url).pathname
      if (path === '/') return textResponse(200, '<title>OdiePt · Training Console</title>')
      if (path === '/api/snapshot') return jsonResponse(401, { ok: false, error: 'snapshot token is required' })
      if (path === '/api/hevy-sync') return jsonResponse(401, { ok: false, error: 'unauthorized' })
      if (path === '/api/hevy-webhook') return jsonResponse(200, { ok: true, status: 'hevy webhook hazir' })
      return textResponse(404, 'missing')
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.results.map(item => item.name), ['home', '/api/snapshot', '/api/hevy-sync', 'hevy-webhook'])
})

test('live smoke fails an old deployment without snapshot and protected sync', async () => {
  const result = await runLiveSmoke({
    baseUrl: 'https://example.test',
    fetchImpl: async url => {
      const path = new URL(url).pathname
      if (path === '/') return textResponse(200, '<title>OdiePt</title>')
      if (path === '/api/hevy-webhook') return jsonResponse(200, { ok: true, status: 'hevy webhook hazir' })
      return textResponse(404, 'The page could not be found')
    },
  })

  assert.equal(result.ok, false)
  assert.deepEqual(
    result.results.filter(item => !item.ok).map(item => item.name),
    ['/api/snapshot', '/api/hevy-sync'],
  )
})

test('live smoke fails if Hevy webhook health is unavailable', async () => {
  const result = await runLiveSmoke({
    baseUrl: 'https://example.test',
    fetchImpl: async url => {
      const path = new URL(url).pathname
      if (path === '/') return textResponse(200, '<title>OdiePt · Training Console</title>')
      if (path === '/api/snapshot') return jsonResponse(401, { ok: false, error: 'snapshot token is required' })
      if (path === '/api/hevy-sync') return jsonResponse(401, { ok: false, error: 'unauthorized' })
      if (path === '/api/hevy-webhook') return jsonResponse(503, { ok: false, error: 'down' })
      return textResponse(404, 'missing')
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.results.find(item => item.name === 'hevy-webhook').detail, 'expected 200 ok, got 503')
})
