import test from 'node:test'
import assert from 'node:assert/strict'

import {
  RECOVERY_TICK_HOURS,
  RECOVERY_WINDOW_HOURS,
  applyTimedRecovery,
} from '../src/data/survival-engine.js'

test('timed recovery drops fatigue in 2 hour ticks and fully recovers by 40 hours', () => {
  const latestWorkout = {
    date: '2026-04-29',
    startedAt: '2026-04-29T10:00:00.000Z',
    durationMin: 60,
  }
  const base = { armor: 70, fatigue: 100, consecutiveHeavy: 2 }

  const afterTwoHours = applyTimedRecovery(base, latestWorkout, {
    now: '2026-04-29T13:00:00.000Z',
  })
  assert.equal(afterTwoHours.recovery.tickHours, RECOVERY_TICK_HOURS)
  assert.equal(afterTwoHours.recovery.progressPct, 5)
  assert.equal(afterTwoHours.fatigue, 95)
  assert.equal(afterTwoHours.armor, 72)

  const afterWindow = applyTimedRecovery(base, latestWorkout, {
    now: '2026-05-01T03:00:00.000Z',
  })
  assert.equal(afterWindow.recovery.windowHours, RECOVERY_WINDOW_HOURS)
  assert.equal(afterWindow.recovery.progressPct, 100)
  assert.equal(afterWindow.fatigue, 0)
  assert.equal(afterWindow.armor, 100)
  assert.equal(afterWindow.status, 'healthy')
})

test('timed recovery keeps high fatigue status until enough ticks pass', () => {
  const latestWorkout = {
    createdAt: '2026-04-29T10:00:00.000Z',
  }
  const base = { armor: 86, fatigue: 100 }

  const early = applyTimedRecovery(base, latestWorkout, {
    now: '2026-04-29T18:30:00.000Z',
  })
  assert.equal(early.fatigue, 80)
  assert.equal(early.status, 'cns_overloaded')

  const later = applyTimedRecovery(base, latestWorkout, {
    now: '2026-04-30T20:30:00.000Z',
  })
  assert.equal(later.fatigue, 15)
  assert.equal(later.status, 'healthy')
})
