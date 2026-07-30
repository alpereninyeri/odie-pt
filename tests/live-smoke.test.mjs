import assert from 'node:assert/strict'
import test from 'node:test'

import { runLiveSmoke } from '../scripts/live-smoke.mjs'

function responseHeaders(values = {}) {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]),
  )
  return {
    get(name) {
      return normalized.get(String(name).toLowerCase()) || null
    },
  }
}

function jsonResponse(status, body, headers = {}) {
  return {
    status,
    headers: responseHeaders(headers),
    text: async () => JSON.stringify(body),
  }
}

function textResponse(status, body) {
  return {
    status,
    headers: responseHeaders(),
    text: async () => body,
  }
}

test('live smoke passes the direct Hevy production contract', async () => {
  const result = await runLiveSmoke({
    baseUrl: 'https://example.test',
    fetchImpl: async url => {
      const path = new URL(url).pathname
      if (path === '/') return textResponse(200, '<title>OdiePt · Training Console</title>')
      if (path === '/api/snapshot') {
        return jsonResponse(200, {
          ok: true,
          profile: { nick: 'Alperen' },
          workouts: [{ id: 'w1', date: '2026-07-25' }],
          source: { hevy: 'live-direct', storage: 'none' },
          privacy: 'public-readonly',
        }, { 'cache-control': 'private, no-store, max-age=0' })
      }
      return textResponse(404, 'missing')
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.results.map(item => item.name), ['home', 'snapshot'])
})

test('live smoke fails an old deployment without the direct snapshot', async () => {
  const result = await runLiveSmoke({
    baseUrl: 'https://example.test',
    fetchImpl: async url => {
      const path = new URL(url).pathname
      if (path === '/') return textResponse(200, '<title>OdiePt</title>')
      return textResponse(404, 'The page could not be found')
    },
  })

  assert.equal(result.ok, false)
  assert.deepEqual(
    result.results.filter(item => !item.ok).map(item => item.name),
    ['snapshot'],
  )
})

test('live smoke fails if snapshot exposes raw or private workout fields', async () => {
  const result = await runLiveSmoke({
    baseUrl: 'https://example.test',
    fetchImpl: async url => {
      const path = new URL(url).pathname
      if (path === '/') return textResponse(200, '<title>OdiePt · Training Console</title>')
      if (path === '/api/snapshot') {
        return jsonResponse(200, {
          ok: true,
          profile: { nick: 'Alperen' },
          workouts: [{ id: 'w1', notes: 'private' }],
          source: { hevy: 'live-direct' },
          privacy: 'public-readonly',
        }, { 'cache-control': 'private, no-store' })
      }
      return textResponse(404, 'missing')
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.results.find(item => item.name === 'snapshot').detail, 'snapshot exposes private/raw workout fields')
})
