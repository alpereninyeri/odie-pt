import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeSessionStatDelta,
  computeSessionXp,
  computeStreakInfo,
  getLocalDateString,
  hasLegFocus,
  normalizeSession,
} from '../src/data/rules.js'

test('walking defaults to endurance and does not raise core', () => {
  const walk = normalizeSession({
    type: 'Yuruyus',
    durationMin: 90,
    highlight: 'duz tempo',
  }, { source: 'manual' })

  const delta = computeSessionStatDelta(walk)
  assert.equal(walk.primaryCategory, 'endurance')
  assert.equal(delta.end, 2)
  assert.equal(delta.sta, 2)
  assert.equal(delta.con, 0)
})

test('walking with terrain and carry can give micro core', () => {
  const walk = normalizeSession({
    type: 'Yuruyus',
    durationMin: 80,
    notes: 'trail terrain uphill carry',
  }, { source: 'manual' })

  const delta = computeSessionStatDelta(walk)
  assert.equal(delta.con, 1)
})

test('parkour without exercise rows still counts as movement and legs', () => {
  const parkour = normalizeSession({
    type: 'Parkour',
    durationMin: 120,
    highlight: 'landing drills ve flow',
  }, { source: 'telegram' })

  const delta = computeSessionStatDelta(parkour)
  assert.equal(parkour.primaryCategory, 'movement')
  assert.equal(hasLegFocus(parkour), true)
  assert.equal(delta.agi, 2)
  assert.equal(delta.dex, 2)
  assert.equal(delta.sta, 1)
})

test('hanging leg raise produces direct and advanced core delta', () => {
  const core = normalizeSession({
    type: 'Calisthenics',
    exercises: [
      { name: 'Hanging Leg Raise', sets: [{ reps: 8 }, { reps: 7 }] },
    ],
  }, { source: 'manual' })

  const delta = computeSessionStatDelta(core)
  assert.equal(delta.con, 3)
})

test('manual and telegram normalization lead to same deterministic output', () => {
  const base = {
    type: 'Bisiklet',
    durationMin: 95,
    distanceKm: 28,
    notes: 'tempo ride',
  }

  const manual = normalizeSession(base, { source: 'manual' })
  const telegram = normalizeSession(base, { source: 'telegram' })

  assert.equal(manual.primaryCategory, telegram.primaryCategory)
  assert.deepEqual(manual.tags, telegram.tags)
  assert.deepEqual(computeSessionStatDelta(manual), computeSessionStatDelta(telegram))
  assert.deepEqual(
    computeSessionXp(manual, { streakDays: 4, classMultiplier: 1, survivalMultiplier: 1 }),
    computeSessionXp(telegram, { streakDays: 4, classMultiplier: 1, survivalMultiplier: 1 }),
  )
})

test('streak tolerates one empty day and breaks after two full missed days', () => {
  const workouts = [
    { date: '2026-04-10' },
    { date: '2026-04-12' },
    { date: '2026-04-14' },
  ]

  const streak = computeStreakInfo(workouts, '2026-04-14')
  assert.equal(streak.current, 3)

  const broken = computeStreakInfo([{ date: '2026-04-10' }, { date: '2026-04-13' }], '2026-04-13')
  assert.equal(broken.current, 1)
})

test('istanbul local date helper respects local boundary', () => {
  const beforeMidnightUtc = new Date('2026-04-17T20:30:00.000Z')
  const afterMidnightUtc = new Date('2026-04-17T21:30:00.000Z')

  assert.equal(getLocalDateString(beforeMidnightUtc), '2026-04-17')
  assert.equal(getLocalDateString(afterMidnightUtc), '2026-04-18')
})
