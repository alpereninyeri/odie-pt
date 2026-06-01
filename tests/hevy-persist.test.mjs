import test from 'node:test'
import assert from 'node:assert/strict'

import { buildExternalWorkoutDraftSession } from '../lib/hevy/persist.js'

test('external workout draft preserves explicit block durations', () => {
  const session = buildExternalWorkoutDraftSession({
    date: '2026-05-31',
    type: 'Yuruyus',
    durationMin: 176,
    distanceKm: 10.5,
    tags: ['walking', 'terrain', 'endurance', 'calisthenics', 'push', 'pull', 'core'],
    blocks: [
      {
        kind: 'locomotion',
        label: 'Doga yuruyusu / Denizli',
        tags: ['walking', 'terrain', 'endurance'],
        durationMin: 130,
        distanceKm: 10.5,
        source: 'manual',
      },
      {
        kind: 'strength',
        label: 'Calisthenics',
        tags: ['calisthenics', 'push', 'pull', 'core'],
        sets: 1,
        durationMin: 40,
        source: 'manual',
      },
    ],
  }, 'manual')

  const locomotion = session.blocks.find(block => block.kind === 'locomotion')
  const strength = session.blocks.find(block => block.kind === 'strength')

  assert.equal(session.date, '2026-05-31')
  assert.equal(locomotion.label, 'Doga yuruyusu / Denizli')
  assert.equal(locomotion.durationMin, 130)
  assert.equal(locomotion.distanceKm, 10.5)
  assert.equal(strength.label, 'Calisthenics')
  assert.equal(strength.durationMin, 40)
})

test('external workout draft derives date from startedAt when source date is missing', () => {
  const session = buildExternalWorkoutDraftSession({
    type: 'Calisthenics',
    durationMin: 40,
    startedAt: '2026-05-30T21:30:00.000Z',
  }, 'hevy')

  assert.equal(session.date, '2026-05-31')
})
