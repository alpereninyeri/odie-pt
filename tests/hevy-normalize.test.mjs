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
  assert.ok(normalized.evidence.some(item => item.includes('5.2km')))
  assert.ok(normalized.facts.some(item => item.label === 'Treadmill Run'))
  assert.equal(normalized.confidence.level, 'high')
})

test('Hevy normalization uses Istanbul local day for UTC boundary starts', () => {
  const workout = {
    id: 'hevy-boundary-1',
    title: 'Night calisthenics',
    start_time: '2026-05-30T21:30:00.000Z',
    end_time: '2026-05-30T22:10:00.000Z',
    created_at: '2026-05-30T22:12:00.000Z',
    exercises: [
      {
        title: 'Push Up',
        sets: [{ reps: 20 }],
      },
    ],
  }

  const normalized = normalizeHevyWorkout(workout)

  assert.equal(normalized.date, '2026-05-31')
  assert.equal(normalized.durationMin, 40)
})
