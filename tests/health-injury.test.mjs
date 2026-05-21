import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeAppleHealthPayload } from '../src/data/apple-health.js'
import { bodyEventToInjury, normalizeBodyEvent } from '../src/data/body-events.js'
import { buildBodyMapState, sessionTouchesBodyRegion } from '../src/data/body-map-engine.js'
import { computeSessionXp, normalizeSession } from '../src/data/rules.js'
import { profile as seedProfile } from '../src/data/profile.js'
import { authorizeHealthImport } from '../api/health-import.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('Apple Health hiking payload becomes an idempotent Odie workout', () => {
  const payload = {
    activityType: 'Hiking',
    startAt: '2026-05-21T08:00:00+03:00',
    endAt: '2026-05-21T10:35:00+03:00',
    distanceKm: 12,
    steps: 16200,
    elevationM: 310,
    routeName: 'Doga parkuru',
  }
  const first = normalizeAppleHealthPayload(payload, { now: new Date('2026-05-21T11:00:00Z') })
  const second = normalizeAppleHealthPayload(payload, { now: new Date('2026-05-21T11:05:00Z') })

  assert.equal(first.source, 'apple_health')
  assert.equal(first.externalSource, 'apple_health_shortcut')
  assert.equal(first.externalId, second.externalId)
  assert.equal(first.distanceKm, 12)
  assert.equal(first.durationMin, 155)
  assert.ok(first.tags.includes('walking'))
  assert.ok(first.tags.includes('terrain'))
  assert.equal(first.primaryCategory, 'endurance')
})

test('manual body event persists as an active injury signal for body map', () => {
  const bodyEvent = normalizeBodyEvent({
    kind: 'injury',
    region: 'wrist',
    severity: 3,
    recoveryPercent: 70,
    expectedClearAt: '2026-05-27',
    note: 'Agir grip temkinli.',
  }, { today: '2026-05-21' })
  const injury = bodyEventToInjury(bodyEvent, { today: '2026-05-21' })

  assert.equal(injury.regionId, 'wrist')
  assert.equal(injury.recoveryPct, 70)
  assert.equal(injury.remainingPct, 30)
  assert.equal(injury.etaDays, 6)
  assert.match(injury.odieInterpretation.command, /Bilek temkinde/)
})

test('body events feed body map priority and injury quest', () => {
  const state = {
    profile: {
      fatigue: 22,
      armor: 90,
      classObj: { id: 'duvar_orucu' },
    },
    bodyEvents: [
      normalizeBodyEvent({
        kind: 'injury',
        region: 'wrist',
        recoveryPercent: 70,
        expectedClearAt: '2026-05-27',
      }, { today: '2026-05-21' }),
    ],
    health: { readiness: { score: 74 } },
    workouts: [],
    dailyLogs: [],
    muscleBalance: [],
    skills: clone(seedProfile.skills),
  }

  const bodyMapState = buildBodyMapState({ state, today: '2026-05-21' })
  const wrist = bodyMapState.regions.find(region => region.id === 'wrist')

  assert.equal(wrist.injury.remainingPct, 30)
  assert.equal(bodyMapState.priority.region.id, 'wrist')
  assert.equal(bodyMapState.dailyQuest.kind, 'injury')
})

test('injured-region PR locks PR bonus', () => {
  const prSession = normalizeSession({
    type: 'Push',
    hasPr: true,
    durationMin: 70,
    exercises: [{ name: 'Push Up', sets: [{ reps: 20 }] }],
  })
  const xp = computeSessionXp(prSession, {
    survivalMultiplier: 1,
    fatigue: 40,
    armor: 90,
    injuryConflict: sessionTouchesBodyRegion(prSession, 'wrist'),
  })

  assert.ok(xp.breakdown.some(part => part.key === 'pr_locked' && part.value === 0))
  assert.equal(xp.breakdown.find(part => part.key === 'pr')?.value || 0, 0)
})

test('health import endpoint rejects missing or wrong token before ingest', () => {
  const previous = process.env.HEALTH_IMPORT_TOKEN
  delete process.env.HEALTH_IMPORT_TOKEN
  assert.deepEqual(
    authorizeHealthImport({ headers: {}, query: {} }),
    { ok: false, status: 500, error: 'HEALTH_IMPORT_TOKEN tanimsiz' },
  )

  process.env.HEALTH_IMPORT_TOKEN = 'secret'
  assert.deepEqual(
    authorizeHealthImport({ headers: { authorization: 'Bearer wrong' }, query: {} }),
    { ok: false, status: 401, error: 'unauthorized' },
  )
  assert.deepEqual(
    authorizeHealthImport({ headers: { authorization: 'Bearer secret' }, query: {} }),
    { ok: true },
  )

  if (previous == null) delete process.env.HEALTH_IMPORT_TOKEN
  else process.env.HEALTH_IMPORT_TOKEN = previous
})
