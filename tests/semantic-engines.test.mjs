import test from 'node:test'
import assert from 'node:assert/strict'

import { computeClass } from '../src/data/class-engine.js'
import { profile as seedProfile } from '../src/data/profile.js'
import { updateQuests } from '../src/data/quest-engine.js'
import { normalizeSession } from '../src/data/rules.js'
import { updateSkills } from '../src/data/skill-engine.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('semantic class engine identifies aerial movement builds without rigid exercise rows', () => {
  const workouts = [
    normalizeSession({ type: 'Akrobasi', durationMin: 70, highlight: 'front flip flow and round off landing' }),
    normalizeSession({ type: 'Akrobasi', durationMin: 65, highlight: 'barani deneme ve landing drill' }),
    normalizeSession({ type: 'Akrobasi', durationMin: 60, highlight: 'round off to flip prep' }),
    normalizeSession({ type: 'Parkour', durationMin: 90, highlight: 'precision jump, rail flow, landing' }),
    normalizeSession({ type: 'Parkour', durationMin: 80, highlight: 'vault flow and terrain' }),
    normalizeSession({ type: 'Akrobasi', durationMin: 55, highlight: 'front flip repeat' }),
    normalizeSession({ type: 'Stretching', durationMin: 25, notes: 'hip flexor and shoulder mobility' }),
    normalizeSession({ type: 'Akrobasi', durationMin: 50, highlight: 'barani prep' }),
    normalizeSession({ type: 'Parkour', durationMin: 75, highlight: 'landing mechanics' }),
    normalizeSession({ type: 'Stretching', durationMin: 20, notes: 'bridge prep' }),
  ]

  const classObj = computeClass(workouts)
  assert.equal(classObj.id, 'gok_kartali')
  assert.ok(Array.isArray(classObj.signals))
  assert.ok(classObj.reason)
})

test('semantic skill engine advances acrobatics mobility and core trees from session meaning', () => {
  const workouts = [
    normalizeSession({ type: 'Akrobasi', durationMin: 55, highlight: 'front flip flow' }),
    normalizeSession({ type: 'Stretching', durationMin: 25, notes: 'shoulder mobility and hip flexor work' }),
    normalizeSession({
      type: 'Calisthenics',
      durationMin: 35,
      exercises: [{ name: 'Hollow Body', sets: [{ durationSec: 20 }, { durationSec: 20 }] }],
    }),
  ]

  const skills = updateSkills(clone(seedProfile.skills), workouts, [])
  const allItems = skills.flatMap(branch => branch.items)

  assert.equal(allItems.find(item => item.name === 'Front Flip')?.status, 'done')
  assert.equal(allItems.find(item => item.name === 'Shoulder Flexibility')?.status, 'prog')
  assert.equal(allItems.find(item => item.name === 'Hollow Body 30sn')?.status, 'prog')
})

test('semantic quest engine counts parkour and mobility sessions without explicit exercise names', () => {
  const workouts = [
    normalizeSession({ date: '2026-04-18', type: 'Parkour', durationMin: 90, highlight: 'landing flow and precision jump' }),
    normalizeSession({ date: '2026-04-17', type: 'Stretching', durationMin: 25, notes: 'full mobility reset' }),
    normalizeSession({ date: '2026-04-16', type: 'Stretching', durationMin: 20, notes: 'hip flexor shoulder mobility' }),
    normalizeSession({
      date: '2026-04-15',
      type: 'Calisthenics',
      durationMin: 40,
      exercises: [{ name: 'Muscle-Up', sets: [{ reps: 3 }] }],
    }),
  ]

  const quests = updateQuests(clone(seedProfile.quests), workouts, [
    { date: '2026-04-18', steps: 9500, sleepHours: 7.4, waterMl: 2300 },
  ], '2026-04-18')

  assert.equal(quests.weekly.find(quest => quest.name === 'Bacak Günü')?.done, true)
  assert.equal(quests.weekly.find(quest => quest.name === 'Esneklik Seansları')?.done, true)
  assert.equal(quests.weekly.find(quest => quest.name === 'Muscle-Up Challenge')?.progress, 3)
})
