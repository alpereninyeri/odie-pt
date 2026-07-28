import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDirectHevySnapshot,
  collectHevyExerciseTemplates,
  collectHevyWorkoutHistory,
  collectRecentHevyWorkouts,
} from '../lib/hevy/dashboard-snapshot.js'

test('exercise template collector reads the full catalog and deduplicates ids', async () => {
  const catalog = await collectHevyExerciseTemplates({
    listPage: async page => ({
      page,
      page_count: 2,
      exercise_templates: page === 1
        ? [{ id: 'a' }, { id: 'b' }]
        : [{ id: 'b' }, { id: 'c' }],
    }),
  })

  assert.deepEqual(catalog.templates.map(template => template.id), ['a', 'b', 'c'])
  assert.equal(catalog.pagination.fetched_pages, 2)
  assert.equal(catalog.pagination.complete, true)
})

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
      exercise_template_id: exercise.includes('Lat')
        ? 'lat-template'
        : exercise.includes('Bench')
          ? 'chest-template'
          : exercise.includes('Squat')
            ? 'quad-template'
            : 'hamstring-template',
      notes: `exercise-private-${index}`,
      sets: [
        { type: 'warmup', weight_kg: 40 + index, reps: 8, rpe: 5 },
        { type: 'normal', weight_kg: 40 + index, reps: 8, rpe: 8 },
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

test('full-history collector deduplicates overlapping page IDs and reports pagination anomalies', async () => {
  const calls = []
  const pageRows = {
    1: Array.from({ length: 10 }, (_, index) => ({ id: `w-${index + 1}` })),
    2: [
      { id: 'w-10' },
      ...Array.from({ length: 9 }, (_, index) => ({ id: `w-${index + 11}` })),
    ],
    3: [{ id: 'w-20' }],
  }
  const history = await collectHevyWorkoutHistory({
    expectedWorkoutCount: 20,
    listPage: async page => {
      calls.push(page)
      return {
        page,
        page_count: 3,
        workouts: pageRows[page] || [],
      }
    },
  })

  assert.equal(history.workouts.length, 20)
  assert.equal(history.workouts[0].id, 'w-1')
  assert.equal(history.workouts.at(-1).id, 'w-20')
  assert.equal(history.pagination.duplicate_workouts_removed, 1)
  assert.equal(history.pagination.complete, true)
  assert.equal(history.pagination.warnings.includes('duplicates_removed:1'), true)
  assert.equal(history.pagination.warnings.includes('page_count_mismatch:3:2'), true)
  assert.deepEqual([...calls].sort((left, right) => left - right), [1, 2, 3])
})

test('full-history collector fails explicit when the safety page cap is reached', async () => {
  const history = await collectHevyWorkoutHistory({
    expectedWorkoutCount: 100,
    maxPages: 2,
    listPage: async page => ({
      page,
      page_count: 10,
      workouts: Array.from({ length: 10 }, (_, index) => ({
        id: `w-${((page - 1) * 10) + index + 1}`,
      })),
    }),
  })

  assert.equal(history.workouts.length, 20)
  assert.equal(history.pagination.page_cap_reached, true)
  assert.equal(history.pagination.complete, false)
  assert.equal(history.pagination.warnings.includes('page_cap_reached:10:2'), true)
})

test('direct Hevy snapshot derives the game profile and strips private source fields', async () => {
  const rows = [
    rawWorkout(0, { exercise: 'Lat Pulldown (Cable)', date: '2026-07-24' }),
    rawWorkout(1, { exercise: 'Bench Press (Barbell)', date: '2026-07-23' }),
    rawWorkout(2, { exercise: 'Squat (Barbell)', date: '2026-07-22' }),
    rawWorkout(3, { exercise: 'Romanian Deadlift (Barbell)', date: '2026-07-21' }),
  ]
  const snapshot = await buildDirectHevySnapshot({
    listPage: async () => ({ page: 1, page_count: 1, workouts: rows }),
    listTemplatePage: async () => ({
      page: 1,
      page_count: 1,
      exercise_templates: [
        { id: 'lat-template', primary_muscle_group: 'lats', secondary_muscle_groups: ['biceps'] },
        { id: 'chest-template', primary_muscle_group: 'chest', secondary_muscle_groups: ['triceps'] },
        { id: 'quad-template', primary_muscle_group: 'quadriceps', secondary_muscle_groups: ['glutes'] },
        { id: 'hamstring-template', primary_muscle_group: 'hamstrings', secondary_muscle_groups: ['glutes'] },
      ],
    }),
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
  assert.ok(snapshot.workouts[0].exercises[0].impactTags.includes('pull'))
  assert.equal(snapshot.workouts[0].exercises[0].impactTags.includes('body-control'), false)
  assert.deepEqual(snapshot.workouts[0].exercises[0].muscleTargets, [
    { regionId: 'lat', role: 'primary', source: 'hevy-template' },
    { regionId: 'biceps', role: 'secondary', source: 'hevy-template' },
  ])
  assert.equal(snapshot.workouts[0].exercises[0].sets[0].type, 'warmup')
  assert.equal(snapshot.workouts[0].exercises[0].sets[1].rpe, 8)
  assert.equal(snapshot.syncState.mode, 'direct')
  assert.equal(snapshot.syncState.truncated, false)
  assert.equal(snapshot.syncState.history_complete, true)
  assert.equal(snapshot.syncState.pagination.fetched_pages, 1)
  assert.equal(snapshot.syncState.mapping.source, 'hevy-template')
  assert.equal(snapshot.syncState.mapping.coverage_percent, 100)
  assert.equal(snapshot.privacy, 'private-athlete')
})

test('direct Hevy snapshot keeps 240-workout history complete with bounded gamification cost', async () => {
  const total = 240
  const rows = Array.from({ length: total }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10)
    return rawWorkout(index, {
      exercise: index % 3 === 0 ? 'Squat (Barbell)' : 'Bench Press (Barbell)',
      date,
    })
  }).reverse()
  const pageCount = Math.ceil(rows.length / 10)
  const startedAt = performance.now()
  const snapshot = await buildDirectHevySnapshot({
    listPage: async page => ({
      page,
      page_count: pageCount,
      workouts: rows.slice((page - 1) * 10, page * 10),
    }),
    getCount: async () => total,
    getUser: async () => ({ name: 'Alperen' }),
    now: new Date('2026-07-25T09:00:00Z'),
  })
  const elapsedMs = performance.now() - startedAt

  assert.equal(snapshot.workouts.length, total)
  assert.equal(snapshot.profile.sessions, total)
  assert.equal(snapshot.syncState.fetched_workouts, total)
  assert.equal(snapshot.syncState.total_workouts, total)
  assert.equal(snapshot.syncState.truncated, false)
  assert.equal(snapshot.syncState.history_complete, true)
  assert.equal(snapshot.syncState.pagination.fetched_pages, pageCount)
  assert.ok(elapsedMs < 4000, `240-workout snapshot took ${Math.round(elapsedMs)}ms`)
})
