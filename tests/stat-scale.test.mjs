import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STAT_CALIBRATION_QUESTIONS,
  attachStatScales,
  calibrationWeight,
  computeStatEvidence,
  computeStatScale,
  normalizeStatCalibration,
} from '../src/data/stat-scale.js'

const gymSession = index => ({
  date: `2026-04-${String((index % 28) + 1).padStart(2, '0')}`,
  type: 'Gym',
  tags: ['gym', 'push'],
  primaryCategory: 'strength',
  durationMin: 60,
  volumeKg: 3500,
  sets: 18,
  hasPr: index === 0,
})

const parkourSession = index => ({
  date: `2026-04-${String((index % 28) + 1).padStart(2, '0')}`,
  type: 'Parkour',
  tags: ['parkour', 'acrobatics', 'explosive', 'balance'],
  primaryCategory: 'movement',
  durationMin: 80,
})

test('same raw score can produce different ranks based on stat-specific evidence', () => {
  const strengthEvidence = computeStatEvidence(Array.from({ length: 14 }, (_, index) => gymSession(index)))
  const weakEvidence = computeStatEvidence([{ ...gymSession(0), hasPr: false }])

  const proven = computeStatScale('str', 92, { evidence: strengthEvidence })
  const unproven = computeStatScale('str', 92, { evidence: weakEvidence })

  assert.equal(proven.rank, 'S')
  assert.equal(unproven.rank, 'A')
})

test('90 plus raw score cannot unlock S without evidence gate', () => {
  const evidence = computeStatEvidence(Array.from({ length: 12 }, (_, index) => parkourSession(index)))
  const con = computeStatScale('con', 95, { evidence })

  assert.equal(con.sUnlocked, false)
  assert.equal(con.rank, 'A')
})

test('calibration fades out once enough real workouts exist', () => {
  assert.equal(calibrationWeight(0, true), 0.15)
  assert.equal(calibrationWeight(15, true), 0.075)
  assert.equal(calibrationWeight(30, true), 0)
  assert.equal(calibrationWeight(60, true), 0)
})

test('calibration answers are normalized and attached to stat metadata', () => {
  const calibration = normalizeStatCalibration({
    completedAt: '2026-05-20T12:00:00.000Z',
    answers: Object.fromEntries(STAT_CALIBRATION_QUESTIONS.map(question => [question.id, 7])),
  })
  const stats = attachStatScales([{ key: 'str', val: 50 }], {
    workouts: [],
    calibration,
  })

  assert.equal(stats[0].rawVal, 50)
  assert.equal(stats[0].confidence, 'low')
  assert.ok(stats[0].scaleScore > 50)
  assert.ok(stats[0].calibrationWeight <= 15)
})
