import test from 'node:test'
import assert from 'node:assert/strict'

import { buildBodyMapState } from '../src/data/body-map-engine.js'
import {
  mergeTelemetryIntoSummary,
  normalizeHealthImportPayload,
} from '../src/data/health-telemetry.js'
import { buildNextSessionRecommendation } from '../src/data/next-session-engine.js'
import { computeSessionXp, normalizeSession } from '../src/data/rules.js'
import { profile as seedProfile } from '../src/data/profile.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('sleep payload normalizes into telemetry and daily recovery summary', () => {
  const payload = {
    kind: 'sleep',
    samples: [{
      externalId: 'sleep-2026-05-22',
      startAt: '2026-05-21T23:20:00+03:00',
      endAt: '2026-05-22T06:10:00+03:00',
      totalSleepHours: 5.4,
      deepSleepHours: 0.7,
      remSleepHours: 1.1,
      coreSleepHours: 3.6,
      awakeMinutes: 28,
    }],
  }

  const normalized = normalizeHealthImportPayload(payload, { now: new Date('2026-05-22T04:00:00Z') })
  const summary = mergeTelemetryIntoSummary(normalized.telemetry, {}, '2026-05-22')

  assert.ok(normalized.telemetry.some(row => row.metricType === 'totalSleepHours'))
  assert.ok(normalized.telemetry.some(row => row.metricType === 'deepSleepHours'))
  assert.equal(summary.totalSleepHours, 5.4)
  assert.ok(summary.sleepScore < 60)
  assert.equal(summary.dataConfidence, 25)
})

test('Apple Health batch supports activity, heart and workout samples with stable ids', () => {
  const payload = {
    samples: [
      { kind: 'activity_day', day: '2026-05-22', steps: 16200, walkingDistanceKm: 12, activeEnergyKcal: 760, exerciseMinutes: 122 },
      { kind: 'heart', day: '2026-05-22', restingHeartRate: 72, hrvSdnn: 28, walkingHeartRateAverage: 118 },
      { kind: 'workout', externalId: 'hike-12k', activityType: 'Hiking', startAt: '2026-05-22T09:00:00+03:00', endAt: '2026-05-22T11:35:00+03:00', distanceKm: 12, activeEnergyKcal: 840, avgHeartRate: 132 },
    ],
  }

  const first = normalizeHealthImportPayload(payload, { now: new Date('2026-05-22T12:00:00Z') })
  const second = normalizeHealthImportPayload(payload, { now: new Date('2026-05-22T12:05:00Z') })
  const summary = mergeTelemetryIntoSummary(first.telemetry, {}, '2026-05-22')

  assert.equal(first.workouts.length, 1)
  assert.equal(first.workouts[0].distanceKm, 12)
  assert.equal(first.telemetry[0].externalId, second.telemetry[0].externalId)
  assert.ok(summary.movementScore >= 85)
  assert.ok(summary.strainScore >= 70)
  assert.ok(summary.heartScore < 60)
})

test('low sleep locks PR bonus and rewards a safe recovery choice', () => {
  const prSession = normalizeSession({ type: 'Push', hasPr: true, durationMin: 70 })
  const xp = computeSessionXp(prSession, {
    survivalMultiplier: 1,
    fatigue: 35,
    armor: 90,
    healthSummary: { sleepScore: 34, heartScore: 72 },
  })

  assert.ok(xp.breakdown.some(part => part.key === 'pr_locked' && part.value === 0))
  assert.equal(xp.breakdown.find(part => part.key === 'pr')?.value || 0, 0)

  const recovery = computeSessionXp(normalizeSession({ type: 'Stretching', durationMin: 20 }), {
    survivalMultiplier: 1,
    fatigue: 70,
    armor: 70,
    healthSummary: { sleepScore: 34, heartScore: 72 },
    activeQuest: { safeMode: true },
  })
  assert.ok(recovery.breakdown.some(part => part.key === 'sleep_recovery'))
  assert.ok(recovery.breakdown.some(part => part.key === 'injury_safe'))
})

test('daily game quest prioritizes Apple sleep and long hiking load', () => {
  const baseState = {
    profile: { fatigue: 20, armor: 88, classObj: { id: 'duvar_orucu' } },
    workouts: [],
    dailyLogs: [],
    muscleBalance: [],
    skills: clone(seedProfile.skills),
  }
  const sleepState = {
    ...baseState,
    health: { readiness: { score: 68 }, vitalScores: { sleep: 34, summary: { day: '2026-05-22', sleepScore: 34 } } },
    healthDailySummary: { day: '2026-05-22', sleepScore: 34 },
  }
  const hikeState = {
    ...baseState,
    health: { readiness: { score: 70 }, vitalScores: { strain: 78, summary: { day: '2026-05-22', strainScore: 78, walkingDistanceKm: 12 } } },
    healthDailySummary: { day: '2026-05-22', strainScore: 78, walkingDistanceKm: 12 },
  }

  assert.equal(buildBodyMapState({ state: sleepState, today: '2026-05-22' }).dailyQuest.kind, 'health_recovery')
  assert.equal(buildBodyMapState({ state: hikeState, today: '2026-05-22' }).dailyQuest.name, 'Ayak Bilegi + Kalf Bakimi')
})

test('next session engine reacts to heart and strain signals from Vital OS', () => {
  const workouts = [normalizeSession({ date: '2026-05-21', type: 'Pull', durationMin: 55 }, { source: 'hevy' })]
  const heart = buildNextSessionRecommendation({
    profile: { armor: 90, fatigue: 30 },
    workouts,
    health: { dailySummary: { heartScore: 38, recoveryScore: 52, dataConfidence: 75, hrvSdnn: 24, restingHeartRate: 74 } },
    today: '2026-05-22',
    now: new Date('2026-05-22T09:00:00Z'),
  })
  const strain = buildNextSessionRecommendation({
    profile: { armor: 90, fatigue: 30 },
    workouts,
    health: { dailySummary: { heartScore: 72, strainScore: 82, recoveryScore: 55, dataConfidence: 75, steps: 16800 } },
    today: '2026-05-22',
    now: new Date('2026-05-22T09:00:00Z'),
  })

  assert.equal(heart.primaryGoal.key, 'heart-calm')
  assert.equal(strain.primaryGoal.key, 'strain-drain')
})
