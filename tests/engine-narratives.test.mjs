import test from 'node:test'
import assert from 'node:assert/strict'

import { recalculate } from '../src/data/engine.js'
import { MOCK_STATE } from '../src/data/mock-state.js'
import { profile as seedProfile } from '../src/data/profile.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function buildState() {
  return {
    profile: {
      ...clone(MOCK_STATE.profile),
      xp: {
        current: MOCK_STATE.profile.xp.current,
        max: MOCK_STATE.profile.xp.max,
        total: (((MOCK_STATE.profile.level || 1) - 1) * (MOCK_STATE.profile.xp.max || 2000)) + (MOCK_STATE.profile.xp.current || 0),
      },
      totalKm: 0,
      armor: 100,
      fatigue: 0,
      survivalWarnings: [],
      survivalStatus: 'healthy',
    },
    workouts: clone(MOCK_STATE.workouts),
    dailyLogs: clone(MOCK_STATE.dailyLogs),
    stats: clone(seedProfile.stats),
    performance: clone(seedProfile.performance),
    debuffs: clone(seedProfile.debuffs),
    muscleBalance: clone(seedProfile.muscleBalance),
    muscles: clone(seedProfile.muscles),
    skills: clone(seedProfile.skills),
    health: clone(seedProfile.health),
    quests: clone(seedProfile.quests),
    coachNote: clone(seedProfile.coachNote),
    coachQuestHints: [],
    coachSkillProgress: [],
    bodyMetrics: { weightKg: 73, heightCm: 178, updatedAt: '2026-04-18' },
  }
}

test('muscle and stat narratives stop using stale chest copy', () => {
  const state = buildState()
  recalculate(state)

  const chest = state.muscles.find(item => /g/i.test(item.name) && /s/i.test(item.name))
  const strength = state.stats.find(item => item.key === 'str')

  assert.ok(chest.detail.includes('65kg'))
  assert.ok(!chest.detail.includes('60kg x 7'))
  assert.ok(strength.desc.includes('bench 65kg') || strength.desc.includes('bench 65'))
})

test('core narrative stays direct and does not count locomotion as core', () => {
  const state = buildState()
  recalculate(state)

  const core = state.stats.find(item => item.key === 'con')
  assert.match(core.desc, /Lokomotion tek basina core sayilmiyor/i)
})

test('hidden coach payload can override performance card copy', () => {
  const state = buildState()
  state.coachNote.sections.push({
    title: 'STATE_SYNC',
    hidden: true,
    payload: {
      performance: {
        bench: {
          note: 'Gemini bench override',
          tip: 'Gemini tip',
          details: ['Peak', 'Trend', 'Driver', 'Next'],
        },
      },
    },
  })

  recalculate(state)

  const bench = state.performance.find(item => item.key === 'bench')
  assert.equal(bench.note, 'Gemini bench override')
  assert.equal(bench.tip, 'Gemini tip')
})

test('health metrics derive kilo and bmi from bodyMetrics instead of static fallback', () => {
  const state = buildState()
  recalculate(state)

  const kilo = state.health.metrics.find(item => item.label === 'Kilo')
  const bmi = state.health.metrics.find(item => item.label === 'BMI')

  assert.equal(kilo.val, '73 kg')
  assert.equal(bmi.val, '23')
})
