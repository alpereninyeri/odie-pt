import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDirectHevySnapshot,
  collectRecentHevyWorkouts,
} from '../lib/hevy/dashboard-snapshot.js'

function rawWorkout(index, {
  exercise = index % 2 ? 'Bench Press (Barbell)' : 'Lat Pulldown (Cable)',
  date = `2026-07-${String(24 - index).padStart(2, '0')}`,
} = {}) {
  return {
    id: `hevy-${index}`,
    title: index % 2 ? 'Push' : 'Pull',
    description: `private-${index}`,
    start_time: `${date}T08:00:00Z`,
    end_time: `${date}T09:00:00Z`,
    created_at: `${date}T09:01:00Z`,
    exercises: [{
      title: exercise,
      notes: `exercise-private-${index}`,
      sets: [
        { weight_kg: 40 + index, reps: 8 },
        { weight_kg: 40 + index, reps: 8 },
      ],
    }],
  }
}

test('direct Hevy collector respects page size and keeps newest page order', async () => {
  const calls = []
  const listPage = async page => {
    calls.push(page)
    return {
      page,
      page_count: 4,
      workouts: Array.from({ length: 10 }, (_, offset) => ({
        id: `w-${((page - 1) * 10) + offset + 1}`,
      })),
    }
  }

  const workouts = await collectRecentHevyWorkouts({
    limit: 25,
    listPage,
    concurrency: 3,
  })

  assert.equal(workouts.length, 25)
  assert.equal(workouts[0].id, 'w-1')
  assert.equal(workouts.at(-1).id, 'w-25')
  assert.deepEqual([...calls].sort((left, right) => left - right), [1, 2, 3])
})

test('direct Hevy snapshot derives the game profile and strips private source fields', async () => {
  const rows = [
    rawWorkout(0, { exercise: 'Lat Pulldown (Cable)', date: '2026-07-24' }),
    rawWorkout(1, { exercise: 'Bench Press (Barbell)', date: '2026-07-23' }),
    rawWorkout(2, { exercise: 'Squat (Barbell)', date: '2026-07-22' }),
    rawWorkout(3, { exercise: 'Romanian Deadlift (Barbell)', date: '2026-07-21' }),
  ]
  const snapshot = await buildDirectHevySnapshot({
    workoutLimit: 20,
    listPage: async () => ({ page: 1, page_count: 1, workouts: rows }),
    getCount: async () => 4,
    getUser: async () => ({ name: 'Alperen', url: 'https://hevy.com/user/senuzulme27' }),
    now: new Date('2026-07-25T09:00:00Z'),
  })

  assert.equal(snapshot.ok, true)
  assert.equal(snapshot.profile.nick, 'Alperen')
  assert.equal(snapshot.profile.handle, '@senuzulme27')
  assert.equal(Object.keys(snapshot.profile.stats).length, 6)
  assert.ok(snapshot.profile.lifetime_xp > 0)
  assert.ok(snapshot.profile.level >= 1)
  assert.equal(snapshot.profile.sessions, 4)
  assert.equal(snapshot.workouts.length, 4)
  assert.equal(snapshot.workouts[0].date, '2026-07-24')
  assert.equal(snapshot.workouts[0].notes, undefined)
  assert.equal(snapshot.workouts[0].rawExternal, undefined)
  assert.equal(snapshot.workouts[0].exercises[0].notes, undefined)
  assert.equal(snapshot.syncState.mode, 'direct')
  assert.equal(snapshot.syncState.truncated, false)
})
