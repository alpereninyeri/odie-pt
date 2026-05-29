import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDataTruthMap, selectTrustedHealthSummary } from '../src/data/data-truth-engine.js'

test('truth map marks Apple disabled and never trusts stale health summary', () => {
  const state = {
    healthStatus: {
      schemaReady: false,
      appleStatus: 'apple_disabled',
      missing: true,
      authConfigured: true,
      privateConfigured: false,
      sources: {
        hevy: 'configured',
        telegram: 'configured',
        odieIntake: 'blocked',
      },
    },
    healthDailySummary: {
      day: '2026-05-28',
      sleepScore: 88,
      heartScore: 82,
      strainScore: 35,
    },
    workouts: [
      { date: '2026-05-28', source: 'hevy', type: 'Push' },
    ],
  }

  const map = buildDataTruthMap({ state })

  assert.equal(selectTrustedHealthSummary(state), null)
  assert.equal(map.schemaReady, false)
  assert.equal(map.appleDisabled, true)
  assert.equal(map.byKey.apple.state, 'disabled')
  assert.equal(map.byKey.apple.lit, false)
  assert.equal(map.byKey.odie.state, 'blocked')
  assert.equal(map.byKey.hevy.lit, true)
})

test('truth map trusts Apple summary only after schema is ready', () => {
  const state = {
    healthStatus: {
      schemaReady: true,
      appleStatus: 'apple_ready',
      authConfigured: true,
      privateConfigured: true,
      sources: {
        appleSleep: 'linked',
        appleHeart: 'linked',
        odieIntake: 'protected',
      },
      dailySummary: {
        day: '2026-05-29',
        totalSleepHours: 7.2,
        sleepScore: 82,
        heartScore: 76,
        strainScore: 42,
      },
    },
    workouts: [
      { date: '2026-05-29', source: 'apple_health', type: 'Yuruyus' },
      { date: '2026-05-28', source: 'web_odie', type: 'Gym' },
    ],
  }

  const map = buildDataTruthMap({ state })

  assert.equal(selectTrustedHealthSummary(state)?.day, '2026-05-29')
  assert.equal(map.schemaReady, true)
  assert.equal(map.appleDisabled, false)
  assert.equal(map.byKey.apple.state, 'active')
  assert.equal(map.byKey.apple.lit, true)
  assert.equal(map.byKey.odie.lit, true)
})
