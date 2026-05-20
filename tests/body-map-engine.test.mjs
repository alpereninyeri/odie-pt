import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildBodyMapState,
  scoreUnlockTargets,
  sessionClosesGameQuest,
} from '../src/data/body-map-engine.js'
import { profile as seedProfile } from '../src/data/profile.js'
import { normalizeSession } from '../src/data/rules.js'
import { buildSemanticProfile } from '../src/data/semantic-profile.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('body map turns high fatigue into a safe recovery side quest', () => {
  const workouts = [
    normalizeSession({ date: '2026-05-20', type: 'Parkour', durationMin: 90, highlight: 'precision landing and vault flow' }),
    normalizeSession({ date: '2026-05-18', type: 'Akrobasi', durationMin: 70, highlight: 'barani prep and landing mechanics' }),
  ]
  const state = {
    profile: {
      fatigue: 82,
      armor: 46,
      classObj: { id: 'duvar_orucu' },
    },
    health: { readiness: { score: 38 } },
    workouts,
    dailyLogs: [],
    muscleBalance: [],
    skills: clone(seedProfile.skills),
  }

  const bodyMapState = buildBodyMapState({ state, today: '2026-05-21' })
  const landing = bodyMapState.movementLines.find(line => line.id === 'landing')

  assert.equal(bodyMapState.dailyQuest.kind, 'recovery')
  assert.equal(bodyMapState.dailyQuest.safeMode, true)
  assert.ok(landing.progress > 0)
  assert.equal(sessionClosesGameQuest(normalizeSession({ type: 'Stretching', durationMin: 20 }), bodyMapState.dailyQuest), true)
})

test('body map selects a repair quest when a muscle line is neglected', () => {
  const workouts = [
    normalizeSession({ date: '2026-05-20', type: 'Push', durationMin: 70, exercises: [{ name: 'Bench Press', sets: [{ reps: 8 }, { reps: 8 }] }] }),
    normalizeSession({ date: '2026-05-18', type: 'Push', durationMin: 65, exercises: [{ name: 'Incline Press', sets: [{ reps: 10 }, { reps: 10 }] }] }),
  ]
  const state = {
    profile: {
      fatigue: 22,
      armor: 92,
      classObj: { id: 'cekirdek_alevi' },
    },
    health: { readiness: { score: 78 } },
    workouts,
    dailyLogs: [],
    muscleBalance: [
      { label: 'Gogus', sets: 24 },
      { label: 'Omuz', sets: 18 },
      { label: 'Core', sets: 0 },
    ],
    skills: clone(seedProfile.skills),
  }

  const bodyMapState = buildBodyMapState({ state, today: '2026-05-21' })

  assert.equal(bodyMapState.dailyQuest.kind, 'repair')
  assert.equal(bodyMapState.dailyQuest.linkedRegion, 'core')
  assert.match(bodyMapState.xpPreview.text, /Kapanan Hat/)
})

test('unlock targets expose linked regions, movement lines and near-unlock progress', () => {
  const workouts = [
    normalizeSession({
      date: '2026-05-20',
      type: 'Calisthenics',
      durationMin: 40,
      exercises: [{ name: 'Hollow Body', sets: [{ durationSec: 28 }, { durationSec: 24 }] }],
    }),
    normalizeSession({ date: '2026-05-18', type: 'Parkour', durationMin: 60, highlight: 'precision landing drill' }),
  ]
  const semantic = buildSemanticProfile(workouts, [])
  const targets = scoreUnlockTargets(clone(seedProfile.skills), semantic)
  const hollow = targets.find(target => target.name.includes('Hollow'))
  const landing = targets.find(target => target.name === 'Precision Landing I')

  assert.ok(hollow.progress >= 90)
  assert.deepEqual(hollow.linkedRegions, ['core'])
  assert.equal(landing.linkedMovement, 'landing')
  assert.ok(landing.todayStep)
})
