import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHevyProfile } from '../lib/hevy/dashboard-snapshot.js'
import {
  buildClassTrack,
  CLASS_TRACK_FAMILIES,
  classTrackInternals,
} from '../src/data/class-track.js'

function strengthWorkout(index, weightKg) {
  const date = new Date(Date.UTC(2026, 6, 27 - index, 12))
  return {
    id: `strength-${index}`,
    date: date.toISOString().slice(0, 10),
    startedAt: date.toISOString(),
    type: 'Push',
    durationMin: 60,
    tags: ['push'],
    exercises: [{
      name: 'Bench Press',
      sets: [
        { reps: 8, weightKg },
        { reps: 8, weightKg },
      ],
    }],
    volumeKg: weightKg * 16,
    sets: 2,
    xpEarned: 100,
  }
}

function strengthHistory(recentWeight, replacedWeight) {
  return Array.from({ length: 11 }, (_, index) => (
    strengthWorkout(index, index === 10 ? replacedWeight : recentWeight)
  ))
}

function shiftingStrengthHistory(incomingWeight, baselineWeight, outgoingWeight) {
  return Array.from({ length: 11 }, (_, index) => {
    if (index === 0) return strengthWorkout(index, incomingWeight)
    if (index === 10) return strengthWorkout(index, outgoingWeight)
    return strengthWorkout(index, baselineWeight)
  })
}

test('class track exposes at least twenty unique intermediate titles across every canonical family', () => {
  const families = Object.values(CLASS_TRACK_FAMILIES)
  const titles = families.flat()

  assert.equal(families.length, 11)
  assert.ok(titles.length >= 20)
  assert.equal(new Set(titles).size, titles.length)
  assert.ok(families.every(stages => stages.length >= 3))
})

test('class track is deterministic and keeps canonical class identity separate from display title', () => {
  const workouts = strengthHistory(90, 40)
  const first = buildClassTrack(workouts)
  const second = buildClassTrack([...workouts].reverse())

  assert.deepEqual(first, second)
  assert.equal(first.familyId, 'ayi_pencesi')
  assert.equal(first.familyName, 'Ayı Pençesi')
  assert.ok(CLASS_TRACK_FAMILIES.ayi_pencesi.includes(first.displayTitle))
  assert.ok(first.affinity >= 0 && first.affinity <= 100)
  assert.ok(Math.abs(first.delta) <= 3)
})

test('overlapping recent windows produce small upward and downward class form changes', () => {
  const rising = buildClassTrack(shiftingStrengthHistory(100, 30, 30))
  const falling = buildClassTrack(shiftingStrengthHistory(30, 30, 100))

  assert.equal(rising.familyId, 'ayi_pencesi')
  assert.equal(falling.familyId, 'ayi_pencesi')
  assert.ok(rising.delta > 0)
  assert.equal(rising.direction, 'up')
  assert.ok(falling.delta < 0)
  assert.equal(falling.direction, 'down')
  assert.ok(Math.abs(rising.delta) <= 3)
  assert.ok(Math.abs(falling.delta) <= 3)
})

test('switching class families is a neutral transition rather than a fake upgrade', () => {
  const delta = classTrackInternals.smallDelta(
    { id: 'ayi_pencesi', matchScore: 5 },
    { id: 'ruzgar_kosucusu', matchScore: 7 },
    74,
    81,
  )

  assert.equal(delta, 0)
})

test('Hevy profile keeps canonical class while publishing a safe presentation track', () => {
  const workouts = strengthHistory(90, 40)
  const profile = buildHevyProfile(workouts, {
    user: { name: 'Alperen' },
    totalWorkoutCount: workouts.length,
    now: new Date('2026-07-27T12:00:00Z'),
  })

  assert.equal(profile.class, 'Ayı Pençesi')
  assert.equal(profile.display_title, profile.class_track.displayTitle)
  assert.equal(profile.class_track.familyId, 'ayi_pencesi')
  assert.equal(profile.class_track.familyName, profile.class)
  assert.equal(profile.class_track.runnerUp?.score, undefined)
  assert.equal(profile.class_track.passive, undefined)
})
