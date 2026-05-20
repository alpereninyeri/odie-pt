import assert from 'node:assert/strict'
import test from 'node:test'

import { buildIngestEventRow, normalizeHevyEventType } from '../lib/hevy/ingest-events.js'

test('Hevy ingest audit normalizes create update delete event names', () => {
  assert.equal(normalizeHevyEventType({ type: 'created' }), 'created')
  assert.equal(normalizeHevyEventType({ type: 'workout.updated' }), 'updated')
  assert.equal(normalizeHevyEventType({ type: 'deleted' }), 'deleted')
  assert.equal(normalizeHevyEventType({}, 'backfill'), 'backfill')
})

test('Hevy ingest audit row is safe and compact', () => {
  const row = buildIngestEventRow({
    profileId: 'profile-1',
    externalId: 123,
    eventType: 'workout.updated',
    operation: 'updated',
    status: 'processed',
    payload: { id: 123, page: 2 },
  })

  assert.equal(row.profile_id, 'profile-1')
  assert.equal(row.source, 'hevy')
  assert.equal(row.external_id, '123')
  assert.equal(row.event_type, 'updated')
  assert.equal(row.status, 'processed')
  assert.deepEqual(row.payload, { id: 123, page: 2 })
  assert.ok(row.processed_at)
})
