import test from 'node:test'
import assert from 'node:assert/strict'

import { buildOdieContext } from '../src/data/odie-context.js'
import { buildFallbackCoachResponse } from '../src/data/odie-fallback.js'
import { MOCK_STATE } from '../src/data/mock-state.js'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

test('buildOdieContext includes recovery, prs, and visible coach memory', () => {
  const profile = clone(MOCK_STATE.profile)
  const workouts = clone(MOCK_STATE.workouts).slice(0, 4)
  const dailyLogs = clone(MOCK_STATE.dailyLogs).slice(0, 3)
  const coachNote = {
    sections: [
      { title: 'SEANS ANALIZI', lines: ['Omuz yukunu son iki seansta iyi tasidin.'] },
      { title: 'STATE_SYNC', hidden: true, payload: { performance: {} } },
    ],
    quest_hints: ['Carry block ekle'],
    skill_progress: [{ name: 'Barani', note: 'Landing control hala ham.' }],
  }

  const context = buildOdieContext({
    profile,
    workouts,
    dailyLogs,
    prs: {
      Bench: { date: '2026-04-14', weightKg: 65, reps: 5 },
    },
    coachNote,
    nextStats: profile.stats,
    nextClass: { name: 'Hybrid', subName: 'Scout' },
    streak: 4,
    xpEarned: 120,
    survival: { armor: 88, fatigue: 24, status: 'strained', warnings: ['Fatigue yuksek'] },
  })

  assert.equal(context.athlete.className, 'Hybrid')
  assert.equal(context.recovery.status, 'strained')
  assert.equal(context.recentPrs[0].value, '65kg x5')
  assert.equal(context.coachMemory[0].title, 'SEANS ANALIZI')
  assert.ok(Array.isArray(context.questPressure))
  assert.ok(Array.isArray(context.skillPressure))
})

test('buildOdieContext adds trend signals and focus gaps for odie coaching', () => {
  const profile = clone(MOCK_STATE.profile)
  const workouts = clone(MOCK_STATE.workouts)
  const dailyLogs = [{ date: '2026-04-14', steps: 3200, sleepHours: 6.4, waterMl: 1500 }]

  const context = buildOdieContext({
    profile,
    workouts,
    dailyLogs,
    nextStats: profile.stats,
    nextClass: { name: 'Hybrid', subName: 'Scout' },
    streak: 3,
    xpEarned: 90,
    survival: { armor: 82, fatigue: 31, status: 'strained', warnings: [] },
  })

  assert.ok(Array.isArray(context.loadProfile.trendSignals))
  assert.ok(Array.isArray(context.focusGaps))
})

test('fallback coach response stays structured when gemini is unavailable', () => {
  const context = {
    xp: 95,
    streak: 5,
    stats: { str: 62, agi: 58, end: 51, dex: 56, con: 39, sta: 53 },
    odie: {
      stats: {
        weakest: { key: 'con', val: 39 },
        strongest: { key: 'str', val: 62 },
      },
      recovery: {
        armor: 84,
        fatigue: 26,
        status: 'strained',
        warnings: ['Core zinciri dagilmaya basladi'],
      },
      focusGaps: ['Direkt core zinciri son 10 seansta eksik'],
      questPressure: [{ name: 'Core Aktivasyon', progress: 0, total: 1 }],
      skillPressure: [{ branch: 'Core', name: 'L-Sit 10sn', status: 'prog' }],
      performance: [{ name: 'Bench', val: '65 kg', trend: '+2.5', note: 'Yeni peak' }],
      loadProfile: { trendSignals: ['Frekans 2 seans yukarida'] },
    },
  }

  const response = buildFallbackCoachResponse({
    type: 'Push',
    duration_min: 70,
    total_sets: 18,
    volume_kg: 4520,
    highlight: 'Bench 65kg x5',
    has_pr: true,
  }, context)

  assert.match(response.telegramMsg, /Push seansi 70dk/)
  assert.equal(response.coachNote.sections[0].title, 'SEANS ANALIZI')
  assert.equal(response.coachNote.sections.at(-1).title, 'STATE_SYNC')
})
