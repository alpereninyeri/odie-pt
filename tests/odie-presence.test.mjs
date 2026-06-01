import test from 'node:test'
import assert from 'node:assert/strict'

import { buildOdiePresence } from '../src/data/odie-presence.js'

test('odie presence reads Apple sleep and heart as conversational context', () => {
  const presence = buildOdiePresence({
    state: {
      workouts: [
        { date: '2026-05-22', type: 'Yuruyus', source: 'apple_health', durationMin: 150, distanceKm: 12 },
      ],
      healthDailySummary: {
        day: '2026-05-22',
        sleepScore: 34,
        heartScore: 41,
        strainScore: 76,
        recoveryScore: 45,
        dataConfidence: 82,
        totalSleepHours: 5.1,
        steps: 17800,
        hrvSdnn: 31,
        restingHeartRate: 64,
      },
    },
    profile: { nick: 'SenUzulme27' },
  })

  assert.equal(presence.dataConfidence, 82)
  assert.match(presence.chatLine, /Uyku|Kalp|Günlük hareket|Apple|ağır PR|hafif hareket|teknik tekrar/i)
  assert.ok(presence.signals.some(item => item.key === 'sleep'))
  assert.ok(presence.quickPrompts.some(item => /uyku|HRV|yürüyüş/i.test(item)))
})

test('odie presence surfaces memory corrections and injury guard', () => {
  const presence = buildOdiePresence({
    state: {
      workouts: [],
      bodyEvents: [
        { region: 'wrist', recoveryPercent: 70, expectedClearAt: '2026-05-28', status: 'active' },
      ],
      athleteMemory: [
        { scope: 'core', summary: 'Core zinciri tekrar eden zayif halka.', confidence: 0.8, active: true },
      ],
      memoryFeedback: [
        { feedbackType: 'wrong', note: 'Parkour yorumunu gym gibi kurma.' },
      ],
    },
    profile: { nick: 'SenUzulme27' },
    today: '2026-05-22',
  })

  assert.equal(presence.mood, 'guard')
  assert.match(presence.chatLine, /ağır grip|kilitliyorum|güvenli/i)
  assert.ok(presence.memoryCards.some(item => item.label === 'düzeltme'))
  assert.ok(presence.signals.some(item => item.key === 'injury'))
})
