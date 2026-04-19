import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bodyMetricsChanged,
  buildAthleteMemoryCandidates,
  buildBodyMetricsHistoryEntry,
  buildWorkoutBlockRows,
  buildWorkoutFactRows,
  summarizeBlockArchive,
  summarizeBodyMetricsTrend,
  summarizeFeedbackLoop,
} from '../src/data/memory-engine.js'

test('memory engine builds safe athlete memory candidates from hybrid parkour session', () => {
  const rows = buildAthleteMemoryCandidates({
    profileId: 'p1',
    session: {
      type: 'Parkour',
      tags: ['parkour', 'walking', 'explosive'],
      distanceKm: 6.7,
      blockMix: [
        { kind: 'skill', percent: 48 },
        { kind: 'locomotion', percent: 32 },
      ],
      chains: [{ name: 'vault chain', status: 'active' }],
      missingChains: ['direct trunk chain'],
      riskSignals: ['landing load birikti'],
      evidence: ['6.7 km doga yuruyusu', '1 saat parkour vault'],
    },
    nextStats: { str: 62, agi: 83, end: 71, dex: 79, con: 18, sta: 67 },
    nextClass: { id: 'traceur', name: 'Traceur', reason: 'movement dominant', signals: ['parkour'] },
    survival: { status: 'healthy', warnings: ['landing load birikti'] },
  })

  assert.ok(rows.some(item => item.key === 'weakest_stat'))
  assert.ok(rows.some(item => item.key === 'parkour_chain_state'))
  assert.ok(rows.some(item => item.key === 'trunk_gap'))
  assert.ok(rows.some(item => item.key === 'active_class_pattern'))
})

test('memory engine summarizes body metrics history and feedback loop', () => {
  const history = summarizeBodyMetricsTrend([
    { date: '2026-04-20', weight_kg: 72.4, height_cm: 172 },
    { date: '2026-04-10', weight_kg: 73.1, height_cm: 172 },
  ], { weightKg: 72.4, heightCm: 172 })

  const feedback = summarizeFeedbackLoop([
    { feedback_type: 'wrong', note: 'parkour yorumunu gym gibi kurma', created_at: '2026-04-20T10:00:00Z' },
    { feedback_type: 'correct', note: 'landing load yorumu dogruydu', created_at: '2026-04-19T10:00:00Z' },
  ])

  assert.equal(history.currentWeightKg, 72.4)
  assert.equal(history.deltaKg, -0.7)
  assert.equal(feedback.total, 2)
  assert.equal(feedback.wrong, 1)
  assert.equal(feedback.correct, 1)
})

test('memory engine builds relational block and fact rows for persistence', () => {
  const blockRows = buildWorkoutBlockRows('p1', 'w1', [
    { kind: 'skill', label: 'parkour vault', tags: ['parkour'], durationMin: 60, source: 'fact' },
    { kind: 'locomotion', label: 'outdoor walk', tags: ['walking'], distanceKm: 6.7, source: 'fact' },
  ], [
    { kind: 'skill', percent: 58 },
    { kind: 'locomotion', percent: 42 },
  ])
  const factRows = buildWorkoutFactRows('p1', 'w1', [
    { kind: 'activity', raw: '6.7 km doga yuruyusu', label: 'doga yuruyusu', blockKind: 'locomotion', tags: ['walking'] },
  ], { score: 84 })
  const archive = summarizeBlockArchive(blockRows)
  const historyEntry = buildBodyMetricsHistoryEntry('p1', { weightKg: 72.4, heightCm: 172 }, { date: '2026-04-20' })

  assert.equal(blockRows.length, 2)
  assert.equal(blockRows[0].weight_pct, 58)
  assert.equal(factRows.length, 1)
  assert.equal(factRows[0].confidence, 0.84)
  assert.equal(archive[0].kind, 'skill')
  assert.equal(historyEntry.weight_kg, 72.4)
  assert.equal(bodyMetricsChanged({ weightKg: 73 }, { weightKg: 72.4 }), true)
})
