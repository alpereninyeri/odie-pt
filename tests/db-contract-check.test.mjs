import assert from 'node:assert/strict'
import test from 'node:test'

import {
  REQUIRED_DB_CONTRACT,
  buildRestCheckUrl,
  runDbContractCheck,
  serviceKeyFromEnv,
} from '../scripts/db-contract-check.mjs'

test('db contract check covers only the live Hevy dashboard contract', () => {
  const tables = new Map(REQUIRED_DB_CONTRACT.map(check => [check.table, check.columns]))
  assert.deepEqual([...tables.keys()], ['profiles', 'workouts', 'hevy_sync_state', 'ingest_events'])
  assert.ok(tables.get('profiles').includes('stats'))
  assert.ok(tables.get('workouts').includes('exercises'))
  assert.ok(tables.get('workouts').includes('external_id'))
  assert.ok(tables.get('hevy_sync_state').includes('last_event_id'))
  assert.ok(tables.get('ingest_events').includes('payload'))
  assert.ok(tables.get('ingest_events').includes('processed_at'))
})

test('db contract check builds read-only Supabase REST probes', () => {
  const url = buildRestCheckUrl('https://example.supabase.co/', {
    table: 'workouts',
    columns: ['id', 'external_id', 'blocks'],
  })
  assert.equal(
    url,
    'https://example.supabase.co/rest/v1/workouts?select=id%2Cexternal_id%2Cblocks&limit=0',
  )
})

test('db contract check fails closed when service env is missing', async () => {
  const result = await runDbContractCheck({
    env: {},
    fetchImpl: async () => {
      throw new Error('fetch should not run without env')
    },
  })
  assert.equal(result.ok, false)
  assert.equal(result.checked, 0)
  assert.equal(result.failures.length, 2)
})

test('db contract check reports missing columns without leaking service key', async () => {
  const calls = []
  const result = await runDbContractCheck({
    env: {
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
    },
    checks: [
      { table: 'workouts', columns: ['id', 'blocks'] },
      { table: 'body_events', columns: ['id', 'side'] },
    ],
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), auth: options.headers.Authorization })
      if (String(url).includes('body_events')) {
        return {
          ok: false,
          status: 400,
          text: async () => 'Could not find the side column. Bearer service-secret',
        }
      }
      return { ok: true, text: async () => '' }
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.checked, 2)
  assert.equal(result.failures[0].table, 'body_events')
  assert.match(result.failures[0].detail, /side column/)
  assert.doesNotMatch(result.failures[0].detail, /service-secret/)
  assert.equal(calls[0].auth, 'Bearer service-secret')
})

test('db contract check accepts either service env name', () => {
  assert.equal(serviceKeyFromEnv({ SUPABASE_SERVICE_KEY: 'fallback-service' }), 'fallback-service')
  assert.equal(serviceKeyFromEnv({ SUPABASE_SERVICE_ROLE_KEY: 'role-service', SUPABASE_SERVICE_KEY: 'fallback-service' }), 'role-service')
})
