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
        })
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
  assert.deepEqual(result.results.filter(item => !item.ok).map(item => item.name), ['snapshot'])
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
        })
      }
      return textResponse(404, 'missing')
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.results.find(item => item.name === 'snapshot').detail, 'snapshot exposes private/raw workout fields')
})
