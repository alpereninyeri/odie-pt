import assert from 'node:assert/strict'
import test from 'node:test'

import { cleanGameText, deterministicFlavor, displayWorkoutType } from '../src/data/game-copy.js'

test('game copy cleans technical and old HUD language', () => {
  const text = cleanGameText('Mission Loop LVL confidence endpoint payload')
  assert.equal(text.includes('Mission Loop'), false)
  assert.equal(text.includes('LVL'), false)
  assert.equal(text.includes('confidence'), false)
  assert.equal(text.includes('endpoint'), false)
})

test('deterministic flavor is stable for same day and changes with seed/date', () => {
  assert.equal(deterministicFlavor('quest-a', '2026-05-29'), deterministicFlavor('quest-a', '2026-05-29'))
  assert.notEqual(deterministicFlavor('quest-a', '2026-05-29'), deterministicFlavor('quest-b', '2026-05-29'))
})

test('workout labels are Turkish game labels', () => {
  assert.equal(displayWorkoutType('Gym'), 'Güç')
  assert.equal(displayWorkoutType('Yuruyus'), 'Yürüyüş')
  assert.equal(displayWorkoutType('Stretching'), 'Mobilite')
})
