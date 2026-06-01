import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeProfileStatsFromWorkouts,
  computeProfileStatsSnapshotDaysAgo,
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

test('profile stat calibration soft-caps large Hevy/backfill histories', () => {
  const workouts = Array.from({ length: 80 }, (_, index) => ({
    date: `2026-04-${String((index % 28) + 1).padStart(2, '0')}`,
    statDelta: { str: 3, agi: 2, end: 1, dex: 3, con: 0, sta: 2 },
  }))

  const stats = computeProfileStatsFromWorkouts(workouts, { str: 100, agi: 100, end: 100, dex: 100, con: 18, sta: 100 }, {
    todayStr: '2026-04-30',
  })

  assert.ok(stats.str < 100)
  assert.ok(stats.dex < 100)
  assert.ok(stats.str <= 94)
  assert.ok(stats.dex <= 91)
  assert.ok(stats.con < stats.str)
})

test('profile stat snapshot uses calibrated history instead of raw delta subtraction', () => {
  const oldWorkouts = Array.from({ length: 45 }, (_, index) => ({
    date: `2026-03-${String((index % 20) + 1).padStart(2, '0')}`,
    statDelta: { str: 2, agi: 1, end: 1, dex: 2, con: 0, sta: 1 },
  }))
  const recentWorkouts = Array.from({ length: 20 }, (_, index) => ({
    date: `2026-04-${String((index % 20) + 1).padStart(2, '0')}`,
    statDelta: { str: 3, agi: 2, end: 1, dex: 3, con: 1, sta: 2 },
  }))
  const workouts = [...recentWorkouts, ...oldWorkouts]
  const current = computeProfileStatsFromWorkouts(workouts, {}, { todayStr: '2026-04-30' })
  const snapshot = computeProfileStatsSnapshotDaysAgo(workouts, current, 30, '2026-04-30')

  assert.ok(snapshot.str > 0)
  assert.ok(current.str - snapshot.str < 40)
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

test('session XP exposes a user-facing breakdown', () => {
  const session = normalizeSession({
    type: 'Calisthenics',
    durationMin: 45,
    exercises: [{ name: 'Hollow Body', sets: [{ durationSec: 25 }] }],
  })
  const xp = computeSessionXp(session, {
    streakDays: 4,
    classMultiplier: 1,
    survivalMultiplier: 1,
    fatigue: 35,
    armor: 90,
    closingGap: true,
    questCompleted: true,
    activeQuest: { xpReward: 35 },
  })

  assert.ok(xp.breakdown.some(part => part.label === 'Ana Hamle XP'))
  assert.ok(xp.breakdown.some(part => part.label === 'Kapanan Hat Bonusu'))
  assert.ok(xp.breakdown.some(part => part.label === 'Ara Gorev XP'))
  assert.ok(xp.xpEarned > 100)
})

test('session XP caps bounty rewards and skips active quest duplicates', () => {
  const session = normalizeSession({ type: 'Push', durationMin: 45 })
  const xp = computeSessionXp(session, {
    streakDays: 2,
    classMultiplier: 1,
    survivalMultiplier: 1,
    questCompleted: true,
    activeQuest: { xpReward: 35 },
    bountyRewards: [
      { id: 'daily_active:day:2026-06-01', bountyId: 'daily_active', label: 'Active quest', xp: 35 },
      { id: 'combo_chain:day:2026-06-01', bountyId: 'combo_chain', label: 'Combo chain', xp: 40 },
      { id: 'combo_chain:day:2026-06-01', bountyId: 'combo_chain', label: 'Combo chain duplicate', xp: 40 },
      { id: 'weak_line:week:2026-06-01', bountyId: 'weak_line', label: 'Weak line', xp: 200 },
    ],
  })

  const bountyParts = xp.breakdown.filter(part => part.key.startsWith('bounty:'))
  assert.equal(xp.breakdown.some(part => part.key === 'quest' && part.value === 35), true)
  assert.equal(bountyParts.reduce((sum, part) => sum + part.value, 0), 120)
  assert.equal(bountyParts.filter(part => part.key === 'bounty:combo_chain').length, 1)
  assert.equal(bountyParts.some(part => part.key === 'bounty:daily_active'), false)
})

test('PR bonus is limited when fatigue is high and locked when armor is low', () => {
  const prSession = normalizeSession({ type: 'Push', hasPr: true, durationMin: 70 })
  const fresh = computeSessionXp(prSession, { survivalMultiplier: 1, fatigue: 40, armor: 90 })
  const tired = computeSessionXp(prSession, { survivalMultiplier: 1, fatigue: 82, armor: 90 })
  const fragile = computeSessionXp(prSession, { survivalMultiplier: 1, fatigue: 40, armor: 32 })

  const prFresh = fresh.breakdown.find(part => part.key === 'pr')?.value || 0
  const prTired = tired.breakdown.find(part => part.key === 'pr')?.value || 0
  const prFragile = fragile.breakdown.find(part => part.key === 'pr')?.value || 0

  assert.equal(prFresh, 50)
  assert.equal(prTired, 15)
  assert.equal(prFragile, 0)
})

test('streak allows adjacent days only and breaks after one empty day', () => {
  const workouts = [
    { date: '2026-04-10' },
    { date: '2026-04-11' },
    { date: '2026-04-12' },
  ]

  const streak = computeStreakInfo(workouts, '2026-04-12')
  assert.equal(streak.current, 3)

  const broken = computeStreakInfo([{ date: '2026-04-10' }, { date: '2026-04-12' }], '2026-04-12')
  assert.equal(broken.current, 1)
})

test('normalizeSession keeps startedAt when present', () => {
  const session = normalizeSession({
    type: 'Push',
    date: '2026-04-18',
    startedAt: '2026-04-18T10:30:00.000Z',
  })

  assert.equal(session.startedAt, '2026-04-18T10:30:00.000Z')
})

test('istanbul local date helper respects local boundary', () => {
  const beforeMidnightUtc = new Date('2026-04-17T20:30:00.000Z')
  const afterMidnightUtc = new Date('2026-04-17T21:30:00.000Z')

  assert.equal(getLocalDateString(beforeMidnightUtc), '2026-04-17')
  assert.equal(getLocalDateString(afterMidnightUtc), '2026-04-18')
})
