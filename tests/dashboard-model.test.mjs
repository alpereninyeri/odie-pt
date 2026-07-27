import assert from 'node:assert/strict'
import test from 'node:test'

import { createDashboardModel, dashboardInternals } from '../src/data/dashboard-model.js'

const today = '2026-07-25'

function workout(overrides = {}) {
  return {
    id: overrides.id || Math.random().toString(36),
    date: '2026-07-24',
    type: 'Push',
    primaryCategory: 'strength',
    durationMin: 60,
    volumeKg: 3000,
    sets: 12,
    exercises: [
      { name: 'Bench Press', sets: [{ reps: 8, weightKg: 50 }, { reps: 8, weightKg: 50 }] },
    ],
    ...overrides,
  }
}

test('dashboard model calculates current and previous 28 day momentum', () => {
  const model = createDashboardModel({
    profile: { stats: { str: 74 }, xp: { current: 500, max: 1000 } },
    workouts: [
      workout({ id: 'new-1', date: '2026-07-24', volumeKg: 4000 }),
      workout({ id: 'new-2', date: '2026-07-18', volumeKg: 4000 }),
      workout({ id: 'old-1', date: '2026-06-20', volumeKg: 2000 }),
    ],
  }, { today })

  assert.equal(model.current28.sessions, 2)
  assert.equal(model.current28.volumeKg, 8000)
  assert.equal(model.previous28.sessions, 1)
  assert.equal(model.momentum.volume, 300)
  assert.equal(model.xp.percent, 50)
})

test('dashboard model finds neglected muscle regions from Hevy exercise history', () => {
  const model = createDashboardModel({
    profile: { stats: {} },
    workouts: [
      workout({ id: 'push-1' }),
      workout({ id: 'push-2', date: '2026-07-20' }),
    ],
  }, { today })

  assert.ok(model.regions.length >= 12)
  assert.equal(model.gaps.length, 4)
  assert.ok(model.gaps.every(region => region.group === 'muscle' && region.load === 0))
  assert.equal(model.gaps.some(region => region.id === 'chest'), false)
  assert.equal(model.quest.region.id, model.gaps[0].id)
  assert.ok(model.quest.action.length > 0)
  assert.ok(model.regions.every(region => region.develops && region.exercisePreview.length))
})

test('leg press credits quads without falsely training chest and glutes stay a muscle region', () => {
  const model = createDashboardModel({
    profile: { stats: {} },
    workouts: [
      workout({
        id: 'leg-press',
        date: '2026-07-24',
        type: 'Bacak',
        exercises: [{ name: 'Leg Press (Machine)', sets: [{ reps: 10, weightKg: 120 }] }],
      }),
    ],
  }, { today: '2026-07-25' })

  const chest = model.regions.find(region => region.id === 'chest')
  const quads = model.regions.find(region => region.id === 'quads')
  const glute = model.regions.find(region => region.id === 'glute')

  assert.equal(chest.load, 0)
  assert.ok(quads.load > 0)
  assert.equal(glute.group, 'muscle')
})

test('dashboard always ranks four weakest regions even without a hard neglect signal', () => {
  const model = createDashboardModel({
    profile: { stats: {} },
    workouts: [
      workout({ id: 'push', type: 'Push' }),
      workout({
        id: 'pull',
        type: 'Pull',
        date: '2026-07-23',
        exercises: [{ name: 'Pull Up', sets: [{ reps: 8 }, { reps: 7 }] }],
      }),
      workout({
        id: 'legs',
        type: 'Bacak',
        date: '2026-07-22',
        exercises: [{ name: 'Squat', sets: [{ reps: 8, weightKg: 80 }] }],
      }),
      workout({
        id: 'core',
        type: 'Core',
        date: '2026-07-21',
        exercises: [{ name: 'Hanging Leg Raise', sets: [{ reps: 10 }] }],
      }),
    ],
  }, { today })

  assert.equal(model.gaps.length, 4)
  assert.deepEqual(
    model.gaps.map(region => region.load),
    [...model.gaps.map(region => region.load)].sort((left, right) => left - right),
  )
})

test('rank display stays rank-first while preserving an internal score', () => {
  assert.equal(dashboardInternals.rankFromScore(95), 'S')
  assert.equal(dashboardInternals.rankFromScore(83), 'A')
  assert.equal(dashboardInternals.rankFromScore(70), 'B')
  assert.equal(dashboardInternals.rankFromScore(20), 'E')

  const model = createDashboardModel({
    profile: { stats: { str: 83, agi: 70 } },
    workouts: [],
  }, { today })
  assert.deepEqual(model.stats.map(stat => [stat.key, stat.rank]), [['str', 'A'], ['agi', 'B']])
})

test('dashboard interprets each workout with a short verdict, stat gains and exercise targets', () => {
  const model = createDashboardModel({
    profile: { stats: {} },
    workouts: [workout({ id: 'push-reading' })],
  }, { today })
  const session = model.sessions[0]

  assert.equal(session.verdict, 'İtiş Gücü')
  assert.ok(session.verdict.split(/\s+/).length <= 2)
  assert.ok(session.statGains.length >= 1 && session.statGains.length <= 2)
  assert.equal(session.statGains[0].short, 'KUV')
  assert.deepEqual(session.exercises[0].targets.map(target => target.label), ['Göğüs'])
})

test('explicit Hevy workout type outranks accessory tags in short verdicts', () => {
  const verdict = dashboardInternals.workoutVerdict

  assert.equal(verdict(workout({
    type: 'Push',
    primaryCategory: 'strength',
    tags: ['push', 'legs', 'running'],
    exercises: [
      { name: 'Bench Press', sets: [{ reps: 8, weightKg: 50 }] },
      { name: 'Treadmill', sets: [{ durationSec: 600 }] },
      { name: 'Leg Extension', sets: [{ reps: 12, weightKg: 30 }] },
    ],
  })), 'İtiş Gücü')

  assert.equal(verdict(workout({
    type: 'Pull',
    primaryCategory: 'strength',
    tags: ['pull', 'core', 'push'],
    exercises: [
      { name: 'Lat Pulldown', sets: [{ reps: 10, weightKg: 55 }] },
      { name: 'Hanging Leg Raise', sets: [{ reps: 12 }] },
      { name: 'Lateral Raise', sets: [{ reps: 15, weightKg: 8 }] },
    ],
  })), 'Çekiş Gücü')

  assert.equal(verdict(workout({
    type: 'Koşu',
    primaryCategory: 'endurance',
    tags: ['running', 'legs'],
    exercises: [
      { name: 'Treadmill', sets: [{ durationSec: 1800, distanceMeters: 5000 }] },
      { name: 'Walking Lunge', sets: [{ reps: 12 }] },
    ],
  })), 'Kondisyon')
})

test('explicit primary category outranks accessory tags when workout type is generic', () => {
  assert.equal(dashboardInternals.workoutVerdict(workout({
    type: 'Gym',
    primaryCategory: 'endurance',
    tags: ['legs', 'push'],
    exercises: [{ name: 'Walking Lunge', sets: [{ reps: 12 }] }],
  })), 'Kondisyon')
})

test('heatmap always returns a stable 28-day window', () => {
  const cells = dashboardInternals.heatmap([
    workout({ id: 'today', date: today, sets: 20 }),
  ], today)
  assert.equal(cells.length, 28)
  assert.equal(cells.at(-1).date, today)
  assert.equal(cells.at(-1).level, 4)
})
