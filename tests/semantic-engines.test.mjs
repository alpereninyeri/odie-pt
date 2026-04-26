import test from 'node:test'
import assert from 'node:assert/strict'

import { computeClass } from '../src/data/class-engine.js'
import { appendClassQuests, buildClassQuests } from '../src/data/class-quests.js'
import { profile as seedProfile } from '../src/data/profile.js'
import { appendCoachQuests, updateQuests } from '../src/data/quest-engine.js'
import { computeStatSnapshotDaysAgo, normalizeSession } from '../src/data/rules.js'
import { buildSemanticProfile } from '../src/data/semantic-profile.js'
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

test('class quest pack injects core-focused weekly quests for cekirdek_alevi', () => {
  const workouts = [
    normalizeSession({
      date: '2026-04-22',
      type: 'Calisthenics',
      durationMin: 40,
      exercises: [
        { name: 'Hollow Body', sets: [{ durationSec: 32 }, { durationSec: 28 }] },
        { name: 'Hanging Leg Raise', sets: [{ reps: 8 }, { reps: 8 }] },
      ],
    }),
    normalizeSession({
      date: '2026-04-21',
      type: 'Calisthenics',
      durationMin: 35,
      exercises: [{ name: 'Plank', sets: [{ durationSec: 50 }] }, { name: 'L-Sit', sets: [{ durationSec: 12 }] }],
    }),
    normalizeSession({
      date: '2026-04-20',
      type: 'Calisthenics',
      durationMin: 30,
      exercises: [{ name: 'Ab Wheel', sets: [{ reps: 10 }] }],
    }),
    normalizeSession({
      date: '2026-04-19',
      type: 'Calisthenics',
      durationMin: 32,
      exercises: [{ name: 'Hollow Rock', sets: [{ durationSec: 30 }] }],
    }),
  ]

  const seedQuests = clone(seedProfile.quests)
  const out = appendClassQuests(seedQuests, 'cekirdek_alevi', workouts, [], '2026-04-22')
  const classQuests = (out.weekly || []).filter(quest => quest.fromClass && quest.classId === 'cekirdek_alevi')
  assert.ok(classQuests.length >= 2, 'pack injects at least two class quests')
  const hollow = classQuests.find(quest => quest.name === 'Hollow 30sn')
  assert.ok(hollow, 'hollow quest exists')
  assert.equal(hollow.done, true)
  const coreBlock = classQuests.find(quest => quest.name === 'Core blok x4')
  assert.ok(coreBlock, 'core block quest exists')
  assert.equal(coreBlock.progress, 4)
  assert.equal(coreBlock.done, true)
})

test('class quest pack returns no quests for unknown class', () => {
  const out = buildClassQuests('cirak', buildSemanticProfile([]))
  assert.deepEqual(out, [])
})

test('appendCoachQuests is idempotent across repeated recalculation', () => {
  let quests = clone(seedProfile.quests)
  for (let i = 0; i < 10; i += 1) {
    quests = appendCoachQuests(quests, ['Esneklik Seansları - 0/2'])
  }
  const coachQuests = (quests.weekly || []).filter(quest => quest.fromCoach)
  assert.equal(coachQuests.length, 1, 'coach hint should not accumulate')
})

test('appendClassQuests is idempotent across repeated recalculation', () => {
  let quests = clone(seedProfile.quests)
  const workouts = [
    normalizeSession({ date: '2026-04-22', type: 'Bacak', durationMin: 60 }),
    normalizeSession({ date: '2026-04-21', type: 'Yürüyüş', durationMin: 90, distanceKm: 7 }),
  ]
  for (let i = 0; i < 10; i += 1) {
    quests = appendClassQuests(quests, 'celik_omurga', workouts, [], '2026-04-22')
  }
  const classQuests = (quests.weekly || []).filter(quest => quest.fromClass)
  assert.equal(classQuests.length, 3, 'class quests should not accumulate')
})

test('computeStatSnapshotDaysAgo subtracts recent statDelta from current stats', () => {
  const workouts = [
    { date: '2026-04-22', statDelta: { str: 2, agi: 1, end: 0, dex: 0, con: 0, sta: 0 } },
    { date: '2026-04-15', statDelta: { str: 1, agi: 0, end: 1, dex: 0, con: 0, sta: 0 } },
    { date: '2026-03-10', statDelta: { str: 5, agi: 5, end: 5, dex: 5, con: 5, sta: 5 } },
  ]
  const current = { str: 50, agi: 30, end: 40, dex: 20, con: 10, sta: 25 }
  const snapshot = computeStatSnapshotDaysAgo(workouts, current, 30, '2026-04-25')
  assert.equal(snapshot.str, 47)
  assert.equal(snapshot.agi, 29)
  assert.equal(snapshot.end, 39)
  assert.equal(snapshot.dex, 20)
})
