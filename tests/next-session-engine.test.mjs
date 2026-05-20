import assert from 'node:assert/strict'
import test from 'node:test'

import { buildNextSessionRecommendation } from '../src/data/next-session-engine.js'

const today = '2026-05-20'
const baseProfile = {
  armor: 86,
  fatigue: 24,
  survivalStatus: 'healthy',
  lastUpdated: '2026-05-20T08:00:00.000Z',
}

test('next session keeps Hevy as live source and allows conservative progression', () => {
  const rec = buildNextSessionRecommendation({
    today,
    now: new Date('2026-05-20T12:00:00.000Z'),
    profile: baseProfile,
    health: { readiness: { score: 82 } },
    workouts: [
      {
        date: '2026-05-19',
        type: 'Push',
        durationMin: 72,
        sets: 20,
        source: 'hevy',
        tags: ['push'],
        blocks: [{ kind: 'strength', label: 'Bench', sets: 5, tags: ['push'] }],
      },
    ],
  })

  assert.equal(rec.sourceHealth.hevyCount, 1)
  assert.equal(rec.primaryGoal.key, 'balance')
  assert.match(rec.coachCommand, /3 net set|8-12 dk|ego/i)
  assert.ok(rec.confidence >= 50)
})

test('next session locks heavy work when fatigue is high', () => {
  const rec = buildNextSessionRecommendation({
    today,
    profile: { ...baseProfile, fatigue: 82, armor: 48, survivalStatus: 'cns_overloaded' },
    workouts: [
      { date: '2026-05-20', type: 'Pull', durationMin: 90, sets: 24, source: 'hevy', tags: ['pull'] },
    ],
  })

  assert.equal(rec.primaryGoal.key, 'recovery')
  assert.equal(rec.tone, 'danger')
  assert.ok(rec.progressionCaps.some(item => /PR|Ana lift/i.test(item)))
  assert.match(rec.coachCommand, /30 dk yuruyus/i)
})

test('next session holds load after a recent PR', () => {
  const rec = buildNextSessionRecommendation({
    today,
    now: new Date('2026-05-20T12:00:00.000Z'),
    profile: baseProfile,
    workouts: [
      {
        date: '2026-05-20',
        startedAt: '2026-05-20T08:00:00.000Z',
        type: 'Push',
        durationMin: 68,
        sets: 18,
        source: 'hevy',
        tags: ['push', 'legs', 'core'],
        highlight: 'Bench PR 75kg x 1',
        hasPr: true,
      },
    ],
  })

  assert.equal(rec.primaryGoal.key, 'pr-hold')
  assert.match(rec.coachCommand, /\+0kg|ayni kiloda/i)
})
