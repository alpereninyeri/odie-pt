import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeHevyWorkout } from '../lib/hevy/normalize.js'

test('Hevy normalization preserves cardio set distance', () => {
  const workout = {
    id: 'hevy-distance-1',
    title: 'Outdoor run',
    start_time: '2026-04-21T07:00:00.000Z',
    end_time: '2026-04-21T07:35:00.000Z',
    created_at: '2026-04-21T07:36:00.000Z',
    exercises: [
      {
        title: 'Treadmill Run',
        sets: [
          { duration_seconds: 2100, distance_meters: 5200 },
        ],
      },
    ],
  }

  const normalized = normalizeHevyWorkout(workout)

  assert.equal(normalized.distanceKm, 5.2)
  assert.equal(normalized.durationMin, 35)
  assert.ok(normalized.tags.includes('endurance'))
})
