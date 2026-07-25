import assert from 'node:assert/strict'
import test from 'node:test'

import { publicErrorCode, publicErrorStatus } from '../api/public-error.js'

test('public errors sanitize raw database and upstream failures', () => {
  assert.equal(publicErrorCode(new Error('relation public.body_events does not exist')), 'schema_missing')
  assert.equal(publicErrorStatus(new Error('schema cache missing column')), 503)
  assert.equal(publicErrorCode(new Error('fetch failed ECONNRESET')), 'upstream_failed')
  assert.equal(publicErrorCode(new Error('password=secret stack dump'), 'route_failed'), 'route_failed')
})
